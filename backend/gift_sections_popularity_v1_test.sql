-- Rollback only. Claims simulate actors: not real JWT/device acceptance.
begin;
set local statement_timeout='15s';
do $$
declare actor uuid; ordinary uuid; g public.gift_catalog%rowtype; saved jsonb; duplicate public.gift_catalog%rowtype;
 vals jsonb; ranked jsonb; entry jsonb; previous numeric:=null; actual numeric; checks integer:=0;
begin
 select id into actor from public.profiles where private.is_founder(id) limit 1;
 if actor is null then raise exception 'Founder fixture unavailable';end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.load_gift_catalog_ranked_v1();raise exception 'Anonymous reader allowed';exception when insufficient_privilege then checks:=checks+1;end;
 begin perform public.owner_save_gift_v4(null,'{}',null);raise exception 'Anonymous writer allowed';exception when insufficient_privilege then checks:=checks+1;end;
 ordinary:=gen_random_uuid(); -- simulated non-Founder actor; no retained Auth account
 perform set_config('request.jwt.claim.sub',ordinary::text,true);
 begin perform public.owner_save_gift_v4(null,'{}',null);raise exception 'Ordinary writer allowed';exception when insufficient_privilege then checks:=checks+1;end;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select * into g from public.gift_catalog where lower(category)<>'lucky' and proposal_relationship is null limit 1;
 if g.id is null then raise exception 'Catalogue fixture unavailable';end if;
 vals:=to_jsonb(g)||jsonb_build_object('catalog_section','Exclusive','display_id','test_unique_01','effect_duration_ms',coalesce(g.effect_duration_ms,4000));
 saved:=public.owner_save_gift_v4(g.id,vals,g.policy_version);
 if saved->>'id'<>g.id::text or saved->>'slug'<>g.slug or saved->>'display_id'<>'test_unique_01' or saved->>'catalog_section'<>'Exclusive' or (saved->>'coin_price')::bigint<>g.coin_price or saved->>'category'<>g.category then raise exception 'Save preservation failed';end if;checks:=checks+1;
 begin perform public.owner_save_gift_v4(g.id,vals,g.policy_version);raise exception 'Stale revision allowed';exception when serialization_failure then checks:=checks+1;end;
 begin perform public.owner_save_gift_v4(g.id,vals||'{"catalog_section":"Lucky"}',(saved->>'policy_version')::integer);raise exception 'Wrong Lucky engine allowed';exception when invalid_parameter_value then checks:=checks+1;end;
 begin perform public.owner_save_gift_v4(g.id,vals||'{"display_id":"bad id"}',(saved->>'policy_version')::integer);raise exception 'Invalid display ID allowed';exception when invalid_parameter_value then checks:=checks+1;end;
 select * into duplicate from public.gift_catalog where id<>g.id and lower(category)<>'lucky' and proposal_relationship is null limit 1;
 begin perform public.owner_save_gift_v4(duplicate.id,to_jsonb(duplicate)||jsonb_build_object('display_id','TEST_UNIQUE_01','effect_duration_ms',coalesce(duplicate.effect_duration_ms,4000)),duplicate.policy_version);raise exception 'Duplicate ID allowed';exception when unique_violation then checks:=checks+1;end;
 ranked:=public.load_gift_catalog_ranked_v1();
 if jsonb_array_length(ranked)<>(select count(*) from public.gift_catalog where active) then raise exception 'Existing gifts lost';end if;checks:=checks+1;
 for entry in select value from jsonb_array_elements(ranked) loop
  if previous is not null and (entry->>'sent_quantity')::numeric>previous then raise exception 'Wrong popularity order';end if;
  select coalesce(sum(t.quantity),0) into actual from public.gift_transactions t where t.gift_id=(entry->>'id')::uuid and t.quantity>0
   and not exists(select 1 from private.gift_transaction_reversal_markers_v1 m where m.gift_transaction_id=t.id)
   and not exists(select 1 from public.lucky_gift_results_v1 l where l.gift_transaction_id=t.id and (l.status is distinct from 'final' or l.reversed_at is not null or coalesce(l.reversal_status,'none') not in ('none','not_reversed')));
  if actual<>(entry->>'sent_quantity')::numeric then raise exception 'Historical quantity mismatch';end if;
  previous:=(entry->>'sent_quantity')::numeric;
 end loop;checks:=checks+1;
 if not exists(select 1 from public.audit_log where actor_id=actor and target_id=g.id::text and action='gift.catalog.save_v4' and after_data->>'display_id'='test_unique_01') then raise exception 'Missing audit';end if;checks:=checks+1;
 raise notice 'PASS % backend groups; all existing active gifts and historical quantities checked; rollback',checks;
end $$;
select 'PASS 11 simulated-actor/catalogue/audit/historical-order groups; rolled back' as result;
rollback;
