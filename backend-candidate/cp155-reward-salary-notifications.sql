-- CP145 notification-only correction. No payment rates, balances, grants or permission changes.
-- Replaces captured live definitions; rollout is separately tracked. Do not replay old payouts.
begin;

CREATE OR REPLACE FUNCTION private.notify_wallet_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rocket public.room_rocket_rewards%rowtype;
begin
  -- Ranking payouts already emit one aggregate notification. Preserve every ledger chunk.
  if new.kind::text='owner_grant' and new.reference_type='reward_grant'
    and exists(select 1 from public.reward_grants g where g.id::text=new.reference_id and g.user_id=new.user_id and g.source='ranking' and g.reason in (select 'Automatic '||(case rp.program when 'room_weekly' then 'Room' when 'family_monthly' then 'Family' when 'recharge_weekly' then 'Recharge' end)||' '||coalesce(rp.period_kind,'period')||' reward' from public.ranking_reward_programs rp where rp.program in ('room_weekly','family_monthly','recharge_weekly')))
  then return new; end if;
  if new.kind::text='adjustment' and new.reference_type='room_rocket_reward' and new.coin_delta>0 then
    select * into rocket from public.room_rocket_rewards where id::text=new.reference_id and user_id=new.user_id and coins=new.coin_delta;
    if rocket.id is not null then
      perform private.notify_user(new.user_id,'reward','Rocket level '||rocket.level::text||' reward','🪙 '||new.coin_delta::text||' coins added to your wallet • Rocket level '||rocket.level::text);
    end if;
    return new;
  end if;
  -- CP settlement already emits its authoritative aggregate message.
  if new.kind::text='owner_grant' and new.reference_type='reward_grant' and exists(select 1 from public.reward_grants g where g.id::text=new.reference_id and g.user_id=new.user_id and g.source='ranking' and g.reason='Automatic Weekly CP reward') then return new; end if;
  if new.kind::text='recharge' then
    perform private.notify_user(new.user_id,'recharge','Recharge received','+'||new.coin_delta::text||' coins added to your wallet');
  elsif new.kind::text='owner_grant' then
    perform private.notify_user(new.user_id,'wallet','Wallet updated',concat_ws(' • ',case when new.coin_delta<>0 then (case when new.coin_delta>=0 then '+' else '' end)||new.coin_delta::text||' coins' end,case when new.earned_delta<>0 then (case when new.earned_delta>=0 then '+' else '' end)||new.earned_delta::text||' diamonds' end,coalesce(new.note,'Owner adjustment')));
  elsif new.kind::text='adjustment' and new.reference_type='earned_exchange' then
    perform private.notify_user(new.user_id,'exchange','Exchange complete',(-new.earned_delta)::text||' diamonds → '||new.coin_delta::text||' coins');
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.owner_settle_salary_record(p_salary_record uuid, p_note text DEFAULT 'Salary settlement'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid:=auth.uid(); r private.salary_records%rowtype; target_public bigint; due bigint; new_balance bigint;
begin
 if me is null then raise exception 'Authentication required'; end if;
 select * into r from private.salary_records where id=p_salary_record for update;
 if r.id is null then raise exception 'Salary record not found'; end if;
 if not private.has_permission_for_user('salary.manage',r.user_id,me) then raise exception 'Salary permission required for this user scope'; end if;
 if r.status='cancelled' then raise exception 'Cancelled salary cannot be settled'; end if;
 due:=greatest(0,r.earned_amount-r.advance_used-r.settled_amount);
 if due<1 then raise exception 'No salary remaining to settle'; end if;
 insert into public.wallets(user_id,coin_balance,earned_balance) values(r.user_id,due,0) on conflict(user_id) do update set coin_balance=public.wallets.coin_balance+excluded.coin_balance,updated_at=now() returning coin_balance into new_balance;
 update private.salary_records set settled_amount=settled_amount+due,status='settled',updated_at=now() where id=r.id;
 select public_id into target_public from public.profiles where id=r.user_id;
 insert into public.wallet_entries(user_id,kind,coin_delta,earned_delta,reference_type,reference_id,actor_id,note) values(r.user_id,'salary_settlement',due,0,'salary_record',r.id::text,me,left(coalesce(p_note,'Salary settlement'),500));
 insert into private.financial_ledger(user_id,account_type,delta,balance_after,action,reference_type,reference_id,actor_id,note) values(r.user_id,'personal_coins',due,new_balance,'salary.settlement','salary_record',r.id::text,me,left(coalesce(p_note,'Salary settlement'),500));
 insert into public.audit_log(actor_id,action,target_type,target_id,metadata) values(me,'salary_settled','salary_record',r.id::text,jsonb_build_object('amount',due,'target_public_id',target_public,'wallet_balance',new_balance));
 perform private.notify_user(r.user_id,'salary',coalesce((select nullif(display_name,'') from private.role_definitions where role_key=r.role_key),initcap(replace(r.role_key,'_',' ')))||' salary settled','🪙 '||due::text||' added to your wallet for '||r.period_key);
 return jsonb_build_object('record_id',r.id,'amount',due,'wallet_balance',new_balance,'public_id',target_public);
end$function$;

CREATE OR REPLACE FUNCTION public.owner_set_salary_progress(p_public_id bigint, p_role text, p_period_key text, p_eligible_units bigint, p_earned_amount bigint, p_status text DEFAULT 'open'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid:=auth.uid(); target uuid; pol private.salary_policies%rowtype; existing private.salary_records%rowtype;
begin
 if me is null then raise exception 'Authentication required'; end if;
 if p_eligible_units<0 or p_earned_amount<0 or p_status not in ('open','qualified','cancelled') then raise exception 'Invalid salary record'; end if;
 if char_length(btrim(coalesce(p_period_key,'')))<3 or char_length(p_period_key)>40 then raise exception 'Period key required'; end if;
 select id into target from public.profiles where public_id=p_public_id; if target is null then raise exception 'User not found'; end if;
 if not private.has_permission_for_user('salary.manage',target,me) then raise exception 'Salary permission required for this user scope'; end if;
 if not exists(select 1 from private.role_assignments ra where ra.user_id=target and ra.role_key=p_role and ra.status in ('active','temporary') and (ra.expires_at is null or ra.expires_at>now())) then raise exception 'Target does not have this active role'; end if;
 select * into pol from private.salary_policies where role_key=p_role and active;
 if pol.role_key is null then raise exception 'No active salary policy for this role'; end if;
 select * into existing from private.salary_records where user_id=target and role_key=p_role and period_key=btrim(p_period_key) for update;
 if existing.id is not null and (existing.advance_used>p_earned_amount or existing.settled_amount>p_earned_amount-existing.advance_used) then raise exception 'Earned amount cannot be reduced below already used/settled salary'; end if;
 insert into private.salary_records(user_id,role_key,period_key,eligible_units,earned_amount,status,policy_snapshot)
 values(target,p_role,btrim(p_period_key),p_eligible_units,p_earned_amount,p_status,jsonb_build_object('target_units',coalesce(pol.target_units,0),'salary_percent',coalesce(pol.salary_percent,0),'advance_percent',coalesce(pol.advance_percent,0),'cycle',coalesce(pol.cycle,'monthly'),'captured_at',now()))
 on conflict(user_id,role_key,period_key) do update set eligible_units=excluded.eligible_units,earned_amount=excluded.earned_amount,status=excluded.status,policy_snapshot=case when private.salary_records.policy_snapshot='{}'::jsonb then excluded.policy_snapshot else private.salary_records.policy_snapshot end,updated_at=now();
 insert into public.audit_log(actor_id,action,target_type,target_id,metadata) values(me,'salary_progress_set','user',target::text,jsonb_build_object('public_id',p_public_id,'role',p_role,'period_key',p_period_key,'eligible_units',p_eligible_units,'earned_amount',p_earned_amount,'status',p_status));
 perform private.notify_user(target,'salary',coalesce((select nullif(display_name,'') from private.role_definitions where role_key=p_role),initcap(replace(p_role,'_',' ')))||' salary progress updated',coalesce((select nullif(display_name,'') from private.role_definitions where role_key=p_role),initcap(replace(p_role,'_',' ')))||' • '||btrim(p_period_key)||' • earned '||p_earned_amount::text);
 return public.owner_salary_user_report(p_public_id);
end$function$;

CREATE OR REPLACE FUNCTION public.request_salary_advance(p_salary_record uuid, p_amount bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid:=auth.uid(); r private.salary_records%rowtype; allowed bigint; new_balance bigint;
begin
 if me is null then raise exception 'Authentication required'; end if;
 select * into r from private.salary_records where id=p_salary_record and user_id=me for update;
 if r.id is null then raise exception 'Salary record not found'; end if;
 if r.status not in ('open','qualified') then raise exception 'Advance is unavailable for this salary status'; end if;
 allowed:=least(greatest(0,r.earned_amount-r.advance_used-r.settled_amount),greatest(0,floor(r.earned_amount*(coalesce((r.policy_snapshot->>'advance_percent')::numeric,0)/100.0))::bigint-r.advance_used));
 if p_amount<1 or p_amount>allowed then raise exception 'Advance exceeds available limit'; end if;
 insert into public.wallets(user_id,coin_balance,earned_balance) values(me,p_amount,0) on conflict(user_id) do update set coin_balance=public.wallets.coin_balance+excluded.coin_balance,updated_at=now() returning coin_balance into new_balance;
 update private.salary_records set advance_used=advance_used+p_amount,updated_at=now() where id=r.id;
 insert into public.wallet_entries(user_id,kind,coin_delta,earned_delta,reference_type,reference_id,actor_id,note) values(me,'salary_advance',p_amount,0,'salary_record',r.id::text,me,'Salary advance • '||r.role_key||' • '||r.period_key);
 insert into private.financial_ledger(user_id,account_type,delta,balance_after,action,reference_type,reference_id,actor_id,note) values(me,'personal_coins',p_amount,new_balance,'salary.advance','salary_record',r.id::text,me,'Salary advance');
 insert into public.audit_log(actor_id,action,target_type,target_id,metadata) values(me,'salary_advance_taken','salary_record',r.id::text,jsonb_build_object('amount',p_amount,'wallet_balance',new_balance,'remaining_advance',allowed-p_amount));
 perform private.notify_user(me,'salary',coalesce((select nullif(display_name,'') from private.role_definitions where role_key=r.role_key),initcap(replace(r.role_key,'_',' ')))||' salary advance','🪙 '||p_amount::text||' added to your wallet • '||r.period_key||' • deducted from final salary');
 return jsonb_build_object('amount',p_amount,'wallet_balance',new_balance,'remaining_advance',allowed-p_amount);
end$function$;
commit;
