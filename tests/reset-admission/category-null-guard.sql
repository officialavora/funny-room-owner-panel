\set ON_ERROR_STOP on
-- Synthetic category-array normalization only. Never run on a live database.
DO $$ BEGIN
 IF current_database() !~ '^funnyroom_reset_admission_[a-z0-9_]+$' THEN RAISE EXCEPTION 'REFUSE_DATABASE_NAME'; END IF;
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'REQUIRE_POSTGRES17'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','private','extensions')) OR EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public') THEN RAISE EXCEPTION 'REQUIRE_EMPTY_FIXTURE_DATABASE'; END IF;
END $$;
BEGIN;
CREATE SCHEMA private;
CREATE TABLE public.category_guard_results(name text PRIMARY KEY,pass boolean NOT NULL CHECK(pass));
CREATE OR REPLACE FUNCTION private.owner_reset_v3_complete_categories(p_categories text[])
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare allowed constant text[]:=array[
 'main','wealth','charm','vip','svip','coins','diamonds','seller_status','seller_balance',
 'cosmetics','reward_grants','roles','permission_overrides','family_membership','agency_membership',
 'relationships','room_membership','room_rewards','wallet_freeze','main_freeze','wealth_freeze',
 'charm_freeze','vip_freeze','account_restriction','dp_restriction','typing_restriction',
 'emoji_restriction','message_restriction','room_join_restriction'
]; normalized text[];
begin
 select coalesce(array_agg(distinct lower(btrim(x)) order by lower(btrim(x))),'{}'::text[]) into normalized from unnest(coalesce(p_categories,'{}'::text[])) x;
 if cardinality(normalized)<1 then raise exception using errcode='22023',message='RESET_CATEGORY_REQUIRED'; end if;
 if exists(select 1 from unnest(normalized)x where not(x=any(allowed))) then raise exception using errcode='22023',message='RESET_CATEGORY_UNSUPPORTED'; end if;
 return normalized;
end;
$function$
;

DO $$ BEGIN
 IF private.owner_reset_v3_complete_categories(ARRAY[NULL]::text[]) IS DISTINCT FROM ARRAY[NULL]::text[] THEN RAISE EXCEPTION 'BASELINE_NULL_COUNTEREXAMPLE_MISSING'; END IF;
 INSERT INTO public.category_guard_results VALUES('baseline_null_false_accept',true);
 IF private.owner_reset_v3_complete_categories(ARRAY['coins',NULL]::text[]) IS DISTINCT FROM ARRAY['coins',NULL]::text[] THEN RAISE EXCEPTION 'BASELINE_MIXED_COUNTEREXAMPLE_MISSING'; END IF;
 INSERT INTO public.category_guard_results VALUES('baseline_mixed_false_accept',true);
END $$;
CREATE OR REPLACE FUNCTION private.owner_reset_v3_complete_categories(p_categories text[])
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare allowed constant text[]:=array[
 'main','wealth','charm','vip','svip','coins','diamonds','seller_status','seller_balance',
 'cosmetics','reward_grants','roles','permission_overrides','family_membership','agency_membership',
 'relationships','room_membership','room_rewards','wallet_freeze','main_freeze','wealth_freeze',
 'charm_freeze','vip_freeze','account_restriction','dp_restriction','typing_restriction',
 'emoji_restriction','message_restriction','room_join_restriction'
]; normalized text[];
begin
 select coalesce(array_agg(distinct lower(btrim(x)) order by lower(btrim(x))),'{}'::text[]) into normalized from unnest(coalesce(p_categories,'{}'::text[])) x;
 if cardinality(normalized)<1 then raise exception using errcode='22023',message='RESET_CATEGORY_REQUIRED'; end if;
 if exists(select 1 from unnest(normalized)x where (x=any(allowed)) is not true) then raise exception using errcode='22023',message='RESET_CATEGORY_UNSUPPORTED'; end if;
 return normalized;
end;
$function$
;

CREATE FUNCTION pg_temp.expect_category_reject(name text,input text[],expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE gotstate text;gotmessage text;
BEGIN
 BEGIN PERFORM private.owner_reset_v3_complete_categories(input);
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS gotstate=RETURNED_SQLSTATE,gotmessage=MESSAGE_TEXT;
 END;
 IF gotstate IS DISTINCT FROM '22023' OR gotmessage IS DISTINCT FROM expected THEN RAISE EXCEPTION 'CATEGORY_REJECTION_MISMATCH: % % %',name,gotstate,gotmessage; END IF;
 INSERT INTO public.category_guard_results VALUES(name,true);
END $$;
SELECT pg_temp.expect_category_reject('candidate_null_array',NULL,'RESET_CATEGORY_REQUIRED');
SELECT pg_temp.expect_category_reject('candidate_empty_array','{}','RESET_CATEGORY_REQUIRED');
SELECT pg_temp.expect_category_reject('candidate_null_element',ARRAY[NULL]::text[],'RESET_CATEGORY_UNSUPPORTED');
SELECT pg_temp.expect_category_reject('candidate_mixed_null',ARRAY['coins',NULL]::text[],'RESET_CATEGORY_UNSUPPORTED');
SELECT pg_temp.expect_category_reject('candidate_blank',ARRAY[' '],'RESET_CATEGORY_UNSUPPORTED');
SELECT pg_temp.expect_category_reject('candidate_unknown',ARRAY['unknown'],'RESET_CATEGORY_UNSUPPORTED');
DO $$ DECLARE label text; BEGIN
 IF private.owner_reset_v3_complete_categories(ARRAY[' COINS ','coins']) IS DISTINCT FROM ARRAY['coins'] THEN RAISE EXCEPTION 'NORMALIZATION_CHANGED'; END IF;
 INSERT INTO public.category_guard_results VALUES('candidate_normalization',true);
 FOREACH label IN ARRAY ARRAY['main','wealth','charm','vip','svip','coins','diamonds','seller_status','seller_balance','cosmetics','reward_grants','roles','permission_overrides','family_membership','agency_membership','relationships','room_membership','room_rewards','wallet_freeze','main_freeze','wealth_freeze','charm_freeze','vip_freeze','account_restriction','dp_restriction','typing_restriction','emoji_restriction','message_restriction','room_join_restriction']::text[] LOOP
  IF private.owner_reset_v3_complete_categories(ARRAY[label]) IS DISTINCT FROM ARRAY[label] THEN RAISE EXCEPTION 'ALLOWED_LABEL_CHANGED:%',label; END IF;
  INSERT INTO public.category_guard_results VALUES('candidate_allowed_'||label,true);
 END LOOP;
 IF (SELECT count(*) FROM public.category_guard_results)<>38 OR EXISTS(SELECT 1 FROM public.category_guard_results WHERE pass IS DISTINCT FROM true) THEN RAISE EXCEPTION 'CATEGORY_38_REQUIRED'; END IF;
END $$;
TABLE public.category_guard_results;
SELECT count(*) AS passed_category_fixture_cases FROM public.category_guard_results;
ROLLBACK;
