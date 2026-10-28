-- STAGING ONLY, rollback fixtures; no wallet/reward/notification triggers run.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
alter table public.gift_transactions disable trigger user;
do $$
declare actor uuid; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); reversed uuid:=gen_random_uuid(); result jsonb; qa numeric; qb numeric; pos_a bigint; pos_b bigint;
begin
 select id into actor from public.profiles where private.is_founder(id) limit 1;
 if actor is null then raise exception 'Founder fixture unavailable';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.gift_catalog(id,slug,name,coin_price,diamond_value,category,active,sort_order,asset_key)
 values(a,'fixture-'||a,'Rollback quantity fixture A',1000,1000,'standard',true,0,'fixture-only'),
       (b,'fixture-'||b,'Rollback quantity fixture B',1,1,'standard',true,9999,'fixture-only');
 insert into public.gift_transactions(gift_id,sender_id,receiver_id,quantity,total_coins,is_self_gift)
 values(a,actor,actor,100,100000,true),(a,actor,actor,7,7000,true),(b,actor,actor,110,110,true);
 insert into public.gift_transactions(id,gift_id,sender_id,receiver_id,quantity,total_coins,is_self_gift)
 values(reversed,a,actor,actor,50,50000,true);
 insert into private.gift_transaction_reversal_markers_v1(gift_transaction_id,lucky_request_id,reversal_operation_id,status,reason)
 values(reversed,gen_random_uuid(),gen_random_uuid(),'reversed','Rollback-only quantity test');
 result:=public.load_gift_catalog_ranked_v1();
 select (value->>'sent_quantity')::numeric,ord into qa,pos_a from jsonb_array_elements(result) with ordinality as x(value,ord) where value->>'id'=a::text;
 select (value->>'sent_quantity')::numeric,ord into qb,pos_b from jsonb_array_elements(result) with ordinality as x(value,ord) where value->>'id'=b::text;
 if qa<>107 or qb<>110 or pos_b>=pos_a then raise exception 'Historical quantity ordering or reversal exclusion failed';end if;
 -- A later committed-ledger row promotes the existing gift on the next read.
 insert into public.gift_transactions(gift_id,sender_id,receiver_id,quantity,total_coins,is_self_gift) values(a,actor,actor,4,4000,true);
 result:=public.load_gift_catalog_ranked_v1();
 select ord into pos_a from jsonb_array_elements(result) with ordinality as x(value,ord) where value->>'id'=a::text;
 select ord into pos_b from jsonb_array_elements(result) with ordinality as x(value,ord) where value->>'id'=b::text;
 if pos_a>=pos_b then raise exception 'Existing gift did not rise after additional sends';end if;
end $$;
select 'PASS historical combo quantities, quantity over spend/featured/order, reversal exclusion and later-send promotion; rollback only' result;
rollback;
