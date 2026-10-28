-- Additive candidate. Keep financial category, UUID, slug and sending engines intact.
alter table public.gift_catalog add column if not exists catalog_section text;
alter table public.gift_catalog add column if not exists display_id text;
alter table public.gift_catalog add constraint gift_catalog_section_v1_check check (catalog_section is null or catalog_section in ('Gift','CP','Lucky','SVIP','Flag','Exclusive','Funny'));
alter table public.gift_catalog add constraint gift_catalog_display_id_v1_check check (display_id is null or display_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$');
alter table public.gift_catalog add constraint gift_catalog_lucky_section_v1_check check (catalog_section is null or ((catalog_section='Lucky')=(lower(coalesce(category,''))='lucky')));
create unique index gift_catalog_display_id_v1_unique on public.gift_catalog(lower(display_id)) where display_id is not null;

create or replace function public.owner_save_gift_v4(p_gift uuid,p_values jsonb,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old public.gift_catalog%rowtype; saved public.gift_catalog%rowtype; result jsonb;
 section text:=nullif(btrim(p_values->>'catalog_section'),''); label text:=nullif(btrim(p_values->>'display_id'),'');
begin
 if actor is null or not private.is_founder(actor) then raise exception 'Founder permission required' using errcode='42501'; end if;
 if section is not null and section not in ('Gift','CP','Lucky','SVIP','Flag','Exclusive','Funny') then raise exception 'Invalid gift section' using errcode='22023'; end if;
 if label is not null and label !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$' then raise exception 'Invalid gift display ID' using errcode='22023'; end if;
 if p_gift is not null then
  select * into old from public.gift_catalog where id=p_gift for update;
  if not found then raise exception 'Gift not found';end if;
  -- Omitted additive fields from compatible callers preserve their existing values.
  if not (p_values?'catalog_section') then section:=old.catalog_section;end if;
  if not (p_values?'display_id') then label:=old.display_id;end if;
 end if;
 -- Lucky remains the existing financial engine, not a visual-only relocation.
 if (section='Lucky' and lower(coalesce(p_values->>'category',''))<>'lucky') or
    (lower(coalesce(p_values->>'category',''))='lucky' and section is not null and section<>'Lucky') then
  raise exception 'Lucky gifts must remain in Lucky; configure its existing engine separately' using errcode='22023';
 end if;
 result:=public.owner_save_gift_v3(p_gift,p_values,p_expected_version);
 update public.gift_catalog set catalog_section=section,display_id=label where id=(result->>'id')::uuid returning * into saved;
 insert into public.audit_log(actor_id,action,target_type,target_id,before_data,after_data)
 values(actor,'gift.catalog.save_v4','gift',saved.id::text,case when old.id is not null then to_jsonb(old) end,to_jsonb(saved));
 return to_jsonb(saved);
end $$;
revoke all on function public.owner_save_gift_v4(uuid,jsonb,integer) from public,anon;
grant execute on function public.owner_save_gift_v4(uuid,jsonb,integer) to authenticated;

-- Aggregate quantities once from the canonical committed transaction ledger.
-- Multi-recipient units count once per recipient. No client counters or send hooks.
-- Exclude reversed/held-for-review receipts and nonfinal Lucky results.
create or replace function public.load_gift_catalog_ranked_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 return coalesce((
  with totals as (
   select t.gift_id,sum(t.quantity)::numeric as units
   from public.gift_transactions t
   where t.quantity>0
    and not exists(select 1 from private.gift_transaction_reversal_markers_v1 m where m.gift_transaction_id=t.id)
    and not exists(select 1 from public.lucky_gift_results_v1 l where l.gift_transaction_id=t.id and
      (l.status is distinct from 'final' or l.reversed_at is not null or coalesce(l.reversal_status,'none') not in ('none','not_reversed')))
   group by t.gift_id
  )
  select jsonb_agg(to_jsonb(g)||jsonb_build_object('sent_quantity',coalesce(t.units,0)::text)
   order by coalesce(t.units,0) desc,g.featured desc,g.sort_order,g.coin_price,g.id)
  from public.gift_catalog g left join totals t on t.gift_id=g.id where g.active
 ),'[]'::jsonb);
end $$;
revoke all on function public.load_gift_catalog_ranked_v1() from public,anon;
grant execute on function public.load_gift_catalog_ranked_v1() to authenticated;
