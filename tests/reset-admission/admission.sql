\set ON_ERROR_STOP on
-- NOT RUN. ONLY an empty disposable PostgreSQL17 fixture database.
-- Not a production restore, full dry-run, preservation, auth or replay test.
DO $$ BEGIN
 IF current_database() !~ '^funnyroom_reset_admission_[a-z0-9_]+$' THEN
  RAISE EXCEPTION 'REFUSE_DATABASE_NAME'; END IF;
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN
  RAISE EXCEPTION 'REQUIRE_POSTGRES17'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','private'))
 OR EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public') THEN
  RAISE EXCEPTION 'REQUIRE_EMPTY_FIXTURE_DATABASE'; END IF;
END $$;
BEGIN;
CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql IMMUTABLE AS
 $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION private.is_founder(uuid) RETURNS boolean LANGUAGE sql IMMUTABLE AS
 $$ SELECT $1='00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION private.require_owner_operation_actor(text,text,text) RETURNS void
 LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
-- Downstream tripwire: passing admission reaches ZZ001 without any reset work.
CREATE FUNCTION private.owner_reset_v3_complete_categories(text[]) RETURNS text[]
 LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='ZZ001',MESSAGE='FIXTURE_DOWNSTREAM_REACHED'; END $$;
CREATE TABLE public.audit_log(actor_id uuid,action text,target_type text,target_id text,metadata jsonb);
CREATE TABLE private.owner_reset_v3_batch_jobs ("id" uuid, "request_id" uuid, "actor_id" uuid, "scope_type" text, "country_code" text, "categories" text[], "reason" text, "status" text, "snapshot_hash" text, "confirmation_digest" text, "target_count" integer, "total_scope_count" integer, "eligible_count" integer, "remaining_scope_count" integer, "excluded_count" integer, "success_count" integer, "failure_count" integer, "manual_review_count" integer, "cursor_ordinal" integer, "max_batch_size" integer, "created_at" timestamp with time zone, "confirmed_at" timestamp with time zone, "started_at" timestamp with time zone, "completed_at" timestamp with time zone);
CREATE TABLE private.owner_reset_v3_batch_targets ("job_id" uuid, "ordinal" integer, "target_user_id" uuid, "target_public_id" bigint, "protected" boolean, "status" text, "target_snapshot" jsonb, "target_snapshot_hash" text, "target_request_id" uuid, "target_operation_id" uuid, "error_code" text, "error_message" text, "attempts" integer, "processed_at" timestamp with time zone);

INSERT INTO private.owner_reset_v3_batch_jobs(id,actor_id,status,snapshot_hash,target_count,excluded_count,reason)
 VALUES('00000000-0000-0000-0000-000000000002',auth.uid(),'prepared','fixture-hash',0,0,'fixture only');
CREATE TABLE public.admission_results(version text,case_name text,expected_state text,observed_state text,expected_message text,observed_message text,pass boolean);
-- Fixed expected outcomes: omission/duplication/extra cases cannot pass silently.
CREATE TABLE public.expected_admission_cases(
 version text NOT NULL, case_name text NOT NULL, expected_state text NOT NULL,
 expected_message text, PRIMARY KEY(version,case_name));
INSERT INTO public.expected_admission_cases VALUES
 ('baseline','null-limit','ZZ001','FIXTURE_DOWNSTREAM_REACHED'),
 ('baseline','zero-limit','22023','BULK_INPUT_INVALID'),
 ('baseline','negative-limit','22023','BULK_INPUT_INVALID'),
 ('baseline','over-limit','22023','BULK_INPUT_INVALID'),
 ('baseline','null-scope','ZZ001','FIXTURE_DOWNSTREAM_REACHED'),
 ('baseline','valid-limit-boundary','ZZ001','FIXTURE_DOWNSTREAM_REACHED'),
 ('baseline','null-hash','00000',NULL),
 ('baseline','wrong-hash','40001','BULK_SNAPSHOT_MISMATCH'),
 ('baseline','null-first','00000',NULL),
 ('baseline','null-second','00000',NULL),
 ('baseline','wrong-first','22023','BULK_CONFIRMATION_MISMATCH'),
 ('baseline','valid-confirm','00000',NULL),
 ('baseline','null-chunk','00000',NULL),
 ('baseline','zero-chunk','22023','CHUNK_SIZE_INVALID'),
 ('baseline','negative-chunk','22023','CHUNK_SIZE_INVALID'),
 ('baseline','over-chunk','22023','CHUNK_SIZE_INVALID'),
 ('baseline','valid-chunk','00000',NULL),
 ('patched','null-limit','22023','BULK_INPUT_INVALID'),
 ('patched','zero-limit','22023','BULK_INPUT_INVALID'),
 ('patched','negative-limit','22023','BULK_INPUT_INVALID'),
 ('patched','over-limit','22023','BULK_INPUT_INVALID'),
 ('patched','null-scope','22023','BULK_SCOPE_INVALID'),
 ('patched','valid-limit-boundary','ZZ001','FIXTURE_DOWNSTREAM_REACHED'),
 ('patched','null-hash','40001','BULK_SNAPSHOT_MISMATCH'),
 ('patched','wrong-hash','40001','BULK_SNAPSHOT_MISMATCH'),
 ('patched','null-first','22023','BULK_CONFIRMATION_MISMATCH'),
 ('patched','null-second','22023','BULK_CONFIRMATION_MISMATCH'),
 ('patched','wrong-first','22023','BULK_CONFIRMATION_MISMATCH'),
 ('patched','valid-confirm','00000',NULL),
 ('patched','null-chunk','22023','CHUNK_SIZE_INVALID'),
 ('patched','zero-chunk','22023','CHUNK_SIZE_INVALID'),
 ('patched','negative-chunk','22023','CHUNK_SIZE_INVALID'),
 ('patched','over-chunk','22023','CHUNK_SIZE_INVALID'),
 ('patched','valid-chunk','00000',NULL);
CREATE FUNCTION public.check_admission(v text,n text,q text,expected text,msg text DEFAULT NULL) RETURNS void
 LANGUAGE plpgsql AS $$
 DECLARE actual text:='00000'; details text:=''; before_jobs jsonb; before_audit jsonb;
 after_jobs jsonb; after_audit jsonb; BEGIN
 SELECT jsonb_agg(to_jsonb(j) ORDER BY to_jsonb(j)::text) INTO before_jobs FROM private.owner_reset_v3_batch_jobs j;
 SELECT jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text) INTO before_audit FROM public.audit_log a;
 BEGIN EXECUTE q; EXCEPTION WHEN OTHERS THEN actual:=SQLSTATE;details:=SQLERRM; END;
 SELECT jsonb_agg(to_jsonb(j) ORDER BY to_jsonb(j)::text) INTO after_jobs FROM private.owner_reset_v3_batch_jobs j;
 SELECT jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text) INTO after_audit FROM public.audit_log a;
 IF expected<>'00000' AND actual=expected AND
    (after_jobs IS DISTINCT FROM before_jobs OR after_audit IS DISTINCT FROM before_audit) THEN
  RAISE EXCEPTION 'REJECTED_CALL_MUTATED_FIXTURE_STATE: %/%',v,n;
 END IF;
 IF n IN ('valid-confirm','null-hash','null-first','null-second') AND expected='00000' AND actual='00000' THEN
  IF jsonb_array_length(coalesce(after_audit,'[]'::jsonb))<>jsonb_array_length(coalesce(before_audit,'[]'::jsonb))+1
     OR (SELECT count(*) FROM jsonb_array_elements(coalesce(after_audit,'[]'::jsonb)) a
         WHERE a->>'action'='owner_safe_reset_v3_batch_confirmed'
           AND a->>'target_id'='00000000-0000-0000-0000-000000000002' AND a->>'actor_id'=auth.uid()::text)
        <> (SELECT count(*) FROM jsonb_array_elements(coalesce(before_audit,'[]'::jsonb)) a
         WHERE a->>'action'='owner_safe_reset_v3_batch_confirmed'
           AND a->>'target_id'='00000000-0000-0000-0000-000000000002' AND a->>'actor_id'=auth.uid()::text)+1 THEN
   RAISE EXCEPTION 'CONFIRM_AUDIT_MISSING: %/%',v,n;
  END IF;
 END IF;
 INSERT INTO public.admission_results VALUES(v,n,expected,actual,msg,details,actual=expected AND (msg IS NULL OR details=msg));
END $$;
CREATE OR REPLACE FUNCTION public.owner_prepare_safe_reset_v3_batch(p_scope_type text, p_selected_public_ids bigint[], p_country_code text, p_categories text[], p_reason text, p_request_id uuid, p_max_targets integer DEFAULT 1000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); cats text[]; cc text:=upper(btrim(coalesce(p_country_code,''))); job private.owner_reset_v3_batch_jobs%rowtype; rec record; n integer:=0; total_scope integer:=0; eligible integer:=0; excluded integer:=0; combined jsonb:='[]'; h text; blocked boolean:=false;
begin
 if actor is null or not private.is_founder(actor) then raise exception using errcode='42501',message='FOUNDER_SCOPE_REQUIRED'; end if;
 perform private.require_owner_operation_actor('owner.user.reset.bulk',case when p_scope_type='all' then 'all' else case when p_scope_type='country' then 'country' else 'selected' end end,null);
 if p_scope_type not in ('selected','country','all') then raise exception using errcode='22023',message='BULK_SCOPE_INVALID'; end if;
 if p_scope_type='country' and cc!~'^[A-Z]{2}$' then raise exception using errcode='22023',message='COUNTRY_CODE_INVALID'; end if;
 if p_scope_type='selected' and (cardinality(coalesce(p_selected_public_ids,'{}'::bigint[]))<1 or cardinality(p_selected_public_ids)>p_max_targets) then raise exception using errcode='22023',message='SELECTED_TARGET_COUNT_INVALID'; end if;
 if p_max_targets not between 1 and 1000 or p_request_id is null or char_length(btrim(coalesce(p_reason,'')))<5 then raise exception using errcode='22023',message='BULK_INPUT_INVALID'; end if;
 cats:=private.owner_reset_v3_complete_categories(p_categories);
 select * into job from private.owner_reset_v3_batch_jobs where request_id=p_request_id;
 if found then return jsonb_build_object('job_id',job.id,'status',job.status,'total_scope_count',job.total_scope_count,'eligible_count',job.eligible_count,'target_count',job.target_count,'excluded_count',job.excluded_count,'remaining_scope_count',job.remaining_scope_count,'error_code',case when job.status='blocked' then 'SCOPE_EXCEEDS_SAFE_LIMIT' else null end,'idempotent_replay',true); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select count(*),count(*) filter(where private.owner_operation_target_is_protected('user',p.public_id::text))
 into total_scope,excluded from public.profiles p where
  (p_scope_type='selected' and p.public_id=any(p_selected_public_ids))
  or (p_scope_type='country' and p.country_code=cc)
  or p_scope_type='all';
 eligible:=total_scope-excluded;
 if total_scope=0 then raise exception using errcode='P0002',message='NO_TARGETS_FOUND'; end if;
 blocked:=p_scope_type in ('country','all') and eligible>p_max_targets;
 insert into private.owner_reset_v3_batch_jobs(request_id,actor_id,scope_type,country_code,categories,reason,status,snapshot_hash,target_count,total_scope_count,eligible_count,remaining_scope_count,excluded_count)
 values(p_request_id,actor,p_scope_type,case when p_scope_type='country' then cc else null end,cats,btrim(p_reason),case when blocked then 'blocked' else 'prepared' end,'pending',case when blocked then 0 else eligible end,total_scope,eligible,case when blocked then eligible else 0 end,excluded) returning * into job;
 if blocked then
  h:=encode(extensions.digest(convert_to(jsonb_build_object('scope',p_scope_type,'country',job.country_code,'total',total_scope,'eligible',eligible,'excluded',excluded,'max',p_max_targets,'categories',cats)::text,'UTF8'),'sha256'),'hex');
  update private.owner_reset_v3_batch_jobs set snapshot_hash=h where id=job.id returning * into job;
  insert into public.audit_log(actor_id,action,target_type,target_id,before_data,metadata) values(actor,'owner_safe_reset_v3_batch_blocked','reset_batch',job.id::text,jsonb_build_object('scope',p_scope_type,'total_scope_count',total_scope,'eligible_count',eligible,'excluded_count',excluded,'remaining_scope_count',eligible,'safe_limit',p_max_targets),jsonb_build_object('error_code','SCOPE_EXCEEDS_SAFE_LIMIT','categories',cats,'reason',btrim(p_reason)));
  return jsonb_build_object('job_id',job.id,'status','blocked','error_code','SCOPE_EXCEEDS_SAFE_LIMIT','scope_type',p_scope_type,'country_code',job.country_code,'total_scope_count',total_scope,'eligible_count',eligible,'target_count',0,'excluded_count',excluded,'remaining_scope_count',eligible,'safe_limit',p_max_targets,'snapshot_hash',h,'exact_targets','[]'::jsonb,'execution_allowed',false,'idempotent_replay',false,'mutation_executed',false);
 end if;
 for rec in select p.id,p.public_id,private.owner_operation_target_is_protected('user',p.public_id::text) protected from public.profiles p where (p_scope_type='selected' and p.public_id=any(p_selected_public_ids)) or (p_scope_type='country' and p.country_code=cc) or p_scope_type='all' order by p.public_id loop
  n:=n+1;
  if rec.protected then insert into private.owner_reset_v3_batch_targets(job_id,ordinal,target_user_id,target_public_id,protected,status) values(job.id,n,rec.id,rec.public_id,true,'excluded');
  else combined:=private.owner_reset_v3_complete_snapshot(rec.id,rec.public_id); h:=encode(extensions.digest(convert_to(combined::text,'UTF8'),'sha256'),'hex'); insert into private.owner_reset_v3_batch_targets(job_id,ordinal,target_user_id,target_public_id,status,target_snapshot,target_snapshot_hash) values(job.id,n,rec.id,rec.public_id,'pending',combined,h); end if;
 end loop;
 h:=encode(extensions.digest(convert_to((select jsonb_agg(jsonb_build_object('public_id',t.target_public_id,'protected',t.protected,'hash',t.target_snapshot_hash) order by t.ordinal) from private.owner_reset_v3_batch_targets t where t.job_id=job.id)::text,'UTF8'),'sha256'),'hex');
 update private.owner_reset_v3_batch_jobs set snapshot_hash=h,target_count=eligible,total_scope_count=total_scope,eligible_count=eligible,remaining_scope_count=0,excluded_count=excluded where id=job.id returning * into job;
 insert into public.audit_log(actor_id,action,target_type,target_id,before_data,metadata) values(actor,'owner_safe_reset_v3_batch_prepared','reset_batch',job.id::text,jsonb_build_object('scope',p_scope_type,'total_scope_count',total_scope,'eligible_count',eligible,'target_count',job.target_count,'excluded_count',excluded,'remaining_scope_count',0,'snapshot_hash',h),jsonb_build_object('categories',cats,'reason',btrim(p_reason)));
 return jsonb_build_object('job_id',job.id,'status','prepared','scope_type',p_scope_type,'country_code',job.country_code,'total_scope_count',total_scope,'eligible_count',eligible,'target_count',job.target_count,'excluded_count',excluded,'remaining_scope_count',0,'snapshot_hash',h,'exact_targets',(select jsonb_agg(jsonb_build_object('public_id',t.target_public_id,'status',t.status) order by t.ordinal) from private.owner_reset_v3_batch_targets t where t.job_id=job.id),'confirmation_required','BULK RESET V3 '||job.id::text,'second_confirmation_required','BULK CONFIRM '||job.id::text,'execution_allowed',true,'idempotent_replay',false,'mutation_executed',false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.owner_confirm_safe_reset_v3_batch(p_job_id uuid, p_snapshot_hash text, p_confirmation text, p_second_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); job private.owner_reset_v3_batch_jobs%rowtype;
begin
 if actor is null or not private.is_founder(actor) then raise exception using errcode='42501',message='FOUNDER_SCOPE_REQUIRED'; end if;
 select * into job from private.owner_reset_v3_batch_jobs where id=p_job_id for update;
 if job.id is null then raise exception using errcode='P0002',message='JOB_NOT_FOUND'; end if;
 if job.actor_id<>actor then raise exception using errcode='42501',message='JOB_ACTOR_MISMATCH'; end if;
 if job.status in ('ready','running','paused','completed','partially_failed') then return jsonb_build_object('job_id',job.id,'status',job.status,'idempotent_replay',true); end if;
 if job.status<>'prepared' or p_snapshot_hash<>job.snapshot_hash then raise exception using errcode='40001',message='BULK_SNAPSHOT_MISMATCH'; end if;
 if p_confirmation<>('BULK RESET V3 '||job.id::text) or p_second_confirmation<>('BULK CONFIRM '||job.id::text) then raise exception using errcode='22023',message='BULK_CONFIRMATION_MISMATCH'; end if;
 update private.owner_reset_v3_batch_jobs set status='ready',confirmation_digest=encode(extensions.digest(p_confirmation||':'||p_second_confirmation,'sha256'),'hex'),confirmed_at=now() where id=job.id;
 insert into public.audit_log(actor_id,action,target_type,target_id,metadata) values(actor,'owner_safe_reset_v3_batch_confirmed','reset_batch',job.id::text,jsonb_build_object('target_count',job.target_count,'excluded_count',job.excluded_count,'reason',job.reason));
 return jsonb_build_object('job_id',job.id,'status','ready','idempotent_replay',false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.owner_process_safe_reset_v3_batch_chunk(p_job_id uuid, p_chunk_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); job private.owner_reset_v3_batch_jobs%rowtype; t private.owner_reset_v3_batch_targets%rowtype; current_snapshot jsonb; prep jsonb; done jsonb; success integer:=0; failed integer:=0; manual integer:=0; remaining integer;
begin
 if actor is null or not private.is_founder(actor) then raise exception using errcode='42501',message='FOUNDER_SCOPE_REQUIRED'; end if;
 if p_chunk_size not between 1 and 25 then raise exception using errcode='22023',message='CHUNK_SIZE_INVALID'; end if;
 select * into job from private.owner_reset_v3_batch_jobs where id=p_job_id for update;
 if job.id is null or job.actor_id<>actor then raise exception using errcode='42501',message='JOB_NOT_FOUND_OR_DENIED'; end if;
 if job.status not in ('ready','running') then raise exception using errcode='55000',message='JOB_NOT_RUNNABLE'; end if;
 update private.owner_reset_v3_batch_jobs set status='running',started_at=coalesce(started_at,now()) where id=job.id;
 for t in select * from private.owner_reset_v3_batch_targets x where x.job_id=job.id and x.status in ('pending','retry') order by x.ordinal limit p_chunk_size for update skip locked loop
  begin
   update private.owner_reset_v3_batch_targets set status='running',attempts=attempts+1 where job_id=t.job_id and ordinal=t.ordinal;
   if private.owner_operation_target_is_protected('user',t.target_public_id::text) then
    update private.owner_reset_v3_batch_targets set status='excluded',protected=true,error_code='PROTECTED_TARGET',processed_at=now() where job_id=t.job_id and ordinal=t.ordinal; continue;
   end if;
   current_snapshot:=private.owner_reset_v3_complete_snapshot(t.target_user_id,t.target_public_id);
   if current_snapshot<>t.target_snapshot or encode(extensions.digest(convert_to(current_snapshot::text,'UTF8'),'sha256'),'hex')<>t.target_snapshot_hash then
    update private.owner_reset_v3_batch_targets set status='manual_review',error_code='BULK_TARGET_SNAPSHOT_STALE',error_message='Target changed after bulk preview',processed_at=now() where job_id=t.job_id and ordinal=t.ordinal; manual:=manual+1; continue;
   end if;
   prep:=public.owner_prepare_safe_reset_v3_complete(t.target_public_id,job.categories,'Bulk '||job.scope_type||' • '||job.reason,t.target_request_id,15);
   done:=public.owner_execute_safe_reset_v3_complete((prep->>'operation_id')::uuid,prep->>'snapshot_hash','RESET V3 '||t.target_public_id::text||' '||(prep->>'operation_id'),case when jsonb_array_length(prep->'red_zone_categories')>0 then 'RED ZONE '||(prep->>'operation_id') else null end);
   if done->>'status'='completed' then update private.owner_reset_v3_batch_targets set status='completed',target_operation_id=(prep->>'operation_id')::uuid,processed_at=now(),error_code=null,error_message=null where job_id=t.job_id and ordinal=t.ordinal; success:=success+1;
   else update private.owner_reset_v3_batch_targets set status='failed',target_operation_id=(prep->>'operation_id')::uuid,error_code=coalesce(done->>'error_code','TARGET_EXECUTION_FAILED'),error_message=done->>'error_message',processed_at=now() where job_id=t.job_id and ordinal=t.ordinal; failed:=failed+1; end if;
  exception when others then
   update private.owner_reset_v3_batch_targets set status='failed',error_code=sqlstate,error_message=left(sqlerrm,500),processed_at=now() where job_id=t.job_id and ordinal=t.ordinal; failed:=failed+1;
  end;
 end loop;
 select count(*) into remaining from private.owner_reset_v3_batch_targets where job_id=job.id and status in ('pending','retry','running');
 update private.owner_reset_v3_batch_jobs set cursor_ordinal=coalesce((select max(ordinal) from private.owner_reset_v3_batch_targets where job_id=job.id and status in ('completed','failed','manual_review')),cursor_ordinal),success_count=(select count(*) from private.owner_reset_v3_batch_targets where job_id=job.id and status='completed'),failure_count=(select count(*) from private.owner_reset_v3_batch_targets where job_id=job.id and status='failed'),manual_review_count=(select count(*) from private.owner_reset_v3_batch_targets where job_id=job.id and status='manual_review'),status=case when remaining>0 then 'running' when (select count(*) from private.owner_reset_v3_batch_targets where job_id=job.id and status='completed')=job.target_count and not exists(select 1 from private.owner_reset_v3_batch_targets where job_id=job.id and status in ('failed','manual_review')) then 'completed' else 'partially_failed' end,completed_at=case when remaining=0 then now() else null end where id=job.id returning * into job;
 return jsonb_build_object('job_id',job.id,'status',job.status,'chunk_success',success,'chunk_failed',failed,'chunk_manual_review',manual,'success_count',job.success_count,'failure_count',job.failure_count,'manual_review_count',job.manual_review_count,'remaining',remaining,'cursor',job.cursor_ordinal,'full_success',job.status='completed');
end;
$function$;

SELECT public.check_admission('baseline','null-limit','SELECT public.owner_prepare_safe_reset_v3_batch(''all'',NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',NULL)','ZZ001','FIXTURE_DOWNSTREAM_REACHED');
SELECT public.check_admission('baseline','zero-limit','SELECT public.owner_prepare_safe_reset_v3_batch(''all'',NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',0)','22023','BULK_INPUT_INVALID');
SELECT public.check_admission('baseline','negative-limit','SELECT public.owner_prepare_safe_reset_v3_batch(''all'',NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',-1)','22023','BULK_INPUT_INVALID');
SELECT public.check_admission('baseline','over-limit','SELECT public.owner_prepare_safe_reset_v3_batch(''all'',NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',1001)','22023','BULK_INPUT_INVALID');
SELECT public.check_admission('baseline','null-scope','SELECT public.owner_prepare_safe_reset_v3_batch(NULL,NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',1000)','ZZ001','FIXTURE_DOWNSTREAM_REACHED');
SELECT public.check_admission('baseline','valid-limit-boundary','SELECT public.owner_prepare_safe_reset_v3_batch(''all'',NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',1000)','ZZ001','FIXTURE_DOWNSTREAM_REACHED');
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('baseline','null-hash','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,NULL,''BULK RESET V3 00000000-0000-0000-0000-000000000002'',''BULK CONFIRM 00000000-0000-0000-0000-000000000002'')','00000',NULL);
DO $$ BEGIN
 IF (SELECT count(*) FROM private.owner_reset_v3_batch_jobs
     WHERE id='00000000-0000-0000-0000-000000000002'::uuid
       AND status='ready' AND confirmed_at IS NOT NULL AND confirmation_digest=encode(extensions.digest('BULK RESET V3 00000000-0000-0000-0000-000000000002:BULK CONFIRM 00000000-0000-0000-0000-000000000002','sha256'),'hex'))<>1 THEN
  RAISE EXCEPTION 'CONFIRM_TRANSITION_MISSING: baseline/null-hash';
 END IF;
END $$;
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('baseline','wrong-hash','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,''wrong'',''BULK RESET V3 00000000-0000-0000-0000-000000000002'',''BULK CONFIRM 00000000-0000-0000-0000-000000000002'')','40001','BULK_SNAPSHOT_MISMATCH');
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('baseline','null-first','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,''fixture-hash'',NULL,''BULK CONFIRM 00000000-0000-0000-0000-000000000002'')','00000',NULL);
DO $$ BEGIN
 IF (SELECT count(*) FROM private.owner_reset_v3_batch_jobs
     WHERE id='00000000-0000-0000-0000-000000000002'::uuid
       AND status='ready' AND confirmed_at IS NOT NULL AND confirmation_digest IS NULL)<>1 THEN
  RAISE EXCEPTION 'CONFIRM_TRANSITION_MISSING: baseline/null-first';
 END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM private.owner_reset_v3_batch_jobs WHERE status='ready' AND confirmation_digest IS NULL) THEN RAISE EXCEPTION 'BASELINE_NULL_DIGEST_NOT_REPRODUCED'; END IF; END $$;
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('baseline','null-second','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,''fixture-hash'',''BULK RESET V3 00000000-0000-0000-0000-000000000002'',NULL)','00000',NULL);
DO $$ BEGIN
 IF (SELECT count(*) FROM private.owner_reset_v3_batch_jobs
     WHERE id='00000000-0000-0000-0000-000000000002'::uuid
       AND status='ready' AND confirmed_at IS NOT NULL AND confirmation_digest IS NULL)<>1 THEN
  RAISE EXCEPTION 'CONFIRM_TRANSITION_MISSING: baseline/null-second';
 END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM private.owner_reset_v3_batch_jobs WHERE status='ready' AND confirmation_digest IS NULL) THEN RAISE EXCEPTION 'BASELINE_NULL_DIGEST_NOT_REPRODUCED'; END IF; END $$;
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('baseline','wrong-first','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,''fixture-hash'',''wrong'',''BULK CONFIRM 00000000-0000-0000-0000-000000000002'')','22023','BULK_CONFIRMATION_MISMATCH');
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('baseline','valid-confirm','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,''fixture-hash'',''BULK RESET V3 00000000-0000-0000-0000-000000000002'',''BULK CONFIRM 00000000-0000-0000-0000-000000000002'')','00000',NULL);
DO $$ BEGIN
 IF (SELECT count(*) FROM private.owner_reset_v3_batch_jobs
     WHERE id='00000000-0000-0000-0000-000000000002'::uuid
       AND status='ready' AND confirmed_at IS NOT NULL AND confirmation_digest=encode(extensions.digest('BULK RESET V3 00000000-0000-0000-0000-000000000002:BULK CONFIRM 00000000-0000-0000-0000-000000000002','sha256'),'hex'))<>1 THEN
  RAISE EXCEPTION 'CONFIRM_TRANSITION_MISSING: baseline/valid-confirm';
 END IF;
END $$;
UPDATE private.owner_reset_v3_batch_jobs SET status='ready';
SELECT public.check_admission('baseline','null-chunk','SELECT public.owner_process_safe_reset_v3_batch_chunk(''00000000-0000-0000-0000-000000000002''::uuid,NULL)','00000',NULL);
UPDATE private.owner_reset_v3_batch_jobs SET status='ready';
SELECT public.check_admission('baseline','zero-chunk','SELECT public.owner_process_safe_reset_v3_batch_chunk(''00000000-0000-0000-0000-000000000002''::uuid,0)','22023','CHUNK_SIZE_INVALID');
UPDATE private.owner_reset_v3_batch_jobs SET status='ready';
SELECT public.check_admission('baseline','negative-chunk','SELECT public.owner_process_safe_reset_v3_batch_chunk(''00000000-0000-0000-0000-000000000002''::uuid,-1)','22023','CHUNK_SIZE_INVALID');
UPDATE private.owner_reset_v3_batch_jobs SET status='ready';
SELECT public.check_admission('baseline','over-chunk','SELECT public.owner_process_safe_reset_v3_batch_chunk(''00000000-0000-0000-0000-000000000002''::uuid,26)','22023','CHUNK_SIZE_INVALID');
UPDATE private.owner_reset_v3_batch_jobs SET status='ready';
SELECT public.check_admission('baseline','valid-chunk','SELECT public.owner_process_safe_reset_v3_batch_chunk(''00000000-0000-0000-0000-000000000002''::uuid,1)','00000',NULL);
CREATE OR REPLACE FUNCTION public.owner_prepare_safe_reset_v3_batch(p_scope_type text, p_selected_public_ids bigint[], p_country_code text, p_categories text[], p_reason text, p_request_id uuid, p_max_targets integer DEFAULT 1000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); cats text[]; cc text:=upper(btrim(coalesce(p_country_code,''))); job private.owner_reset_v3_batch_jobs%rowtype; rec record; n integer:=0; total_scope integer:=0; eligible integer:=0; excluded integer:=0; combined jsonb:='[]'; h text; blocked boolean:=false;
begin
 if actor is null or not private.is_founder(actor) then raise exception using errcode='42501',message='FOUNDER_SCOPE_REQUIRED'; end if;
 perform private.require_owner_operation_actor('owner.user.reset.bulk',case when p_scope_type='all' then 'all' else case when p_scope_type='country' then 'country' else 'selected' end end,null);
 if p_scope_type is null or p_scope_type not in ('selected','country','all') then raise exception using errcode='22023',message='BULK_SCOPE_INVALID'; end if;
 if p_scope_type='country' and cc!~'^[A-Z]{2}$' then raise exception using errcode='22023',message='COUNTRY_CODE_INVALID'; end if;
 if p_scope_type='selected' and (cardinality(coalesce(p_selected_public_ids,'{}'::bigint[]))<1 or cardinality(p_selected_public_ids)>p_max_targets) then raise exception using errcode='22023',message='SELECTED_TARGET_COUNT_INVALID'; end if;
 if p_max_targets is null or p_max_targets not between 1 and 1000 or p_request_id is null or char_length(btrim(coalesce(p_reason,'')))<5 then raise exception using errcode='22023',message='BULK_INPUT_INVALID'; end if;
 cats:=private.owner_reset_v3_complete_categories(p_categories);
 select * into job from private.owner_reset_v3_batch_jobs where request_id=p_request_id;
 if found then return jsonb_build_object('job_id',job.id,'status',job.status,'total_scope_count',job.total_scope_count,'eligible_count',job.eligible_count,'target_count',job.target_count,'excluded_count',job.excluded_count,'remaining_scope_count',job.remaining_scope_count,'error_code',case when job.status='blocked' then 'SCOPE_EXCEEDS_SAFE_LIMIT' else null end,'idempotent_replay',true); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select count(*),count(*) filter(where private.owner_operation_target_is_protected('user',p.public_id::text))
 into total_scope,excluded from public.profiles p where
  (p_scope_type='selected' and p.public_id=any(p_selected_public_ids))
  or (p_scope_type='country' and p.country_code=cc)
  or p_scope_type='all';
 eligible:=total_scope-excluded;
 if total_scope=0 then raise exception using errcode='P0002',message='NO_TARGETS_FOUND'; end if;
 blocked:=p_scope_type in ('country','all') and eligible>p_max_targets;
 insert into private.owner_reset_v3_batch_jobs(request_id,actor_id,scope_type,country_code,categories,reason,status,snapshot_hash,target_count,total_scope_count,eligible_count,remaining_scope_count,excluded_count)
 values(p_request_id,actor,p_scope_type,case when p_scope_type='country' then cc else null end,cats,btrim(p_reason),case when blocked then 'blocked' else 'prepared' end,'pending',case when blocked then 0 else eligible end,total_scope,eligible,case when blocked then eligible else 0 end,excluded) returning * into job;
 if blocked then
  h:=encode(extensions.digest(convert_to(jsonb_build_object('scope',p_scope_type,'country',job.country_code,'total',total_scope,'eligible',eligible,'excluded',excluded,'max',p_max_targets,'categories',cats)::text,'UTF8'),'sha256'),'hex');
  update private.owner_reset_v3_batch_jobs set snapshot_hash=h where id=job.id returning * into job;
  insert into public.audit_log(actor_id,action,target_type,target_id,before_data,metadata) values(actor,'owner_safe_reset_v3_batch_blocked','reset_batch',job.id::text,jsonb_build_object('scope',p_scope_type,'total_scope_count',total_scope,'eligible_count',eligible,'excluded_count',excluded,'remaining_scope_count',eligible,'safe_limit',p_max_targets),jsonb_build_object('error_code','SCOPE_EXCEEDS_SAFE_LIMIT','categories',cats,'reason',btrim(p_reason)));
  return jsonb_build_object('job_id',job.id,'status','blocked','error_code','SCOPE_EXCEEDS_SAFE_LIMIT','scope_type',p_scope_type,'country_code',job.country_code,'total_scope_count',total_scope,'eligible_count',eligible,'target_count',0,'excluded_count',excluded,'remaining_scope_count',eligible,'safe_limit',p_max_targets,'snapshot_hash',h,'exact_targets','[]'::jsonb,'execution_allowed',false,'idempotent_replay',false,'mutation_executed',false);
 end if;
 for rec in select p.id,p.public_id,private.owner_operation_target_is_protected('user',p.public_id::text) protected from public.profiles p where (p_scope_type='selected' and p.public_id=any(p_selected_public_ids)) or (p_scope_type='country' and p.country_code=cc) or p_scope_type='all' order by p.public_id loop
  n:=n+1;
  if rec.protected then insert into private.owner_reset_v3_batch_targets(job_id,ordinal,target_user_id,target_public_id,protected,status) values(job.id,n,rec.id,rec.public_id,true,'excluded');
  else combined:=private.owner_reset_v3_complete_snapshot(rec.id,rec.public_id); h:=encode(extensions.digest(convert_to(combined::text,'UTF8'),'sha256'),'hex'); insert into private.owner_reset_v3_batch_targets(job_id,ordinal,target_user_id,target_public_id,status,target_snapshot,target_snapshot_hash) values(job.id,n,rec.id,rec.public_id,'pending',combined,h); end if;
 end loop;
 h:=encode(extensions.digest(convert_to((select jsonb_agg(jsonb_build_object('public_id',t.target_public_id,'protected',t.protected,'hash',t.target_snapshot_hash) order by t.ordinal) from private.owner_reset_v3_batch_targets t where t.job_id=job.id)::text,'UTF8'),'sha256'),'hex');
 update private.owner_reset_v3_batch_jobs set snapshot_hash=h,target_count=eligible,total_scope_count=total_scope,eligible_count=eligible,remaining_scope_count=0,excluded_count=excluded where id=job.id returning * into job;
 insert into public.audit_log(actor_id,action,target_type,target_id,before_data,metadata) values(actor,'owner_safe_reset_v3_batch_prepared','reset_batch',job.id::text,jsonb_build_object('scope',p_scope_type,'total_scope_count',total_scope,'eligible_count',eligible,'target_count',job.target_count,'excluded_count',excluded,'remaining_scope_count',0,'snapshot_hash',h),jsonb_build_object('categories',cats,'reason',btrim(p_reason)));
 return jsonb_build_object('job_id',job.id,'status','prepared','scope_type',p_scope_type,'country_code',job.country_code,'total_scope_count',total_scope,'eligible_count',eligible,'target_count',job.target_count,'excluded_count',excluded,'remaining_scope_count',0,'snapshot_hash',h,'exact_targets',(select jsonb_agg(jsonb_build_object('public_id',t.target_public_id,'status',t.status) order by t.ordinal) from private.owner_reset_v3_batch_targets t where t.job_id=job.id),'confirmation_required','BULK RESET V3 '||job.id::text,'second_confirmation_required','BULK CONFIRM '||job.id::text,'execution_allowed',true,'idempotent_replay',false,'mutation_executed',false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.owner_confirm_safe_reset_v3_batch(p_job_id uuid, p_snapshot_hash text, p_confirmation text, p_second_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); job private.owner_reset_v3_batch_jobs%rowtype;
begin
 if actor is null or not private.is_founder(actor) then raise exception using errcode='42501',message='FOUNDER_SCOPE_REQUIRED'; end if;
 select * into job from private.owner_reset_v3_batch_jobs where id=p_job_id for update;
 if job.id is null then raise exception using errcode='P0002',message='JOB_NOT_FOUND'; end if;
 if job.actor_id<>actor then raise exception using errcode='42501',message='JOB_ACTOR_MISMATCH'; end if;
 if job.status in ('ready','running','paused','completed','partially_failed') then return jsonb_build_object('job_id',job.id,'status',job.status,'idempotent_replay',true); end if;
 if job.status<>'prepared' or p_snapshot_hash is null or p_snapshot_hash is distinct from job.snapshot_hash then raise exception using errcode='40001',message='BULK_SNAPSHOT_MISMATCH'; end if;
 if p_confirmation is distinct from ('BULK RESET V3 '||job.id::text) or p_second_confirmation is distinct from ('BULK CONFIRM '||job.id::text) then raise exception using errcode='22023',message='BULK_CONFIRMATION_MISMATCH'; end if;
 update private.owner_reset_v3_batch_jobs set status='ready',confirmation_digest=encode(extensions.digest(p_confirmation||':'||p_second_confirmation,'sha256'),'hex'),confirmed_at=now() where id=job.id;
 insert into public.audit_log(actor_id,action,target_type,target_id,metadata) values(actor,'owner_safe_reset_v3_batch_confirmed','reset_batch',job.id::text,jsonb_build_object('target_count',job.target_count,'excluded_count',job.excluded_count,'reason',job.reason));
 return jsonb_build_object('job_id',job.id,'status','ready','idempotent_replay',false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.owner_process_safe_reset_v3_batch_chunk(p_job_id uuid, p_chunk_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); job private.owner_reset_v3_batch_jobs%rowtype; t private.owner_reset_v3_batch_targets%rowtype; current_snapshot jsonb; prep jsonb; done jsonb; success integer:=0; failed integer:=0; manual integer:=0; remaining integer;
begin
 if actor is null or not private.is_founder(actor) then raise exception using errcode='42501',message='FOUNDER_SCOPE_REQUIRED'; end if;
 if p_chunk_size is null or p_chunk_size not between 1 and 25 then raise exception using errcode='22023',message='CHUNK_SIZE_INVALID'; end if;
 select * into job from private.owner_reset_v3_batch_jobs where id=p_job_id for update;
 if job.id is null or job.actor_id<>actor then raise exception using errcode='42501',message='JOB_NOT_FOUND_OR_DENIED'; end if;
 if job.status not in ('ready','running') then raise exception using errcode='55000',message='JOB_NOT_RUNNABLE'; end if;
 update private.owner_reset_v3_batch_jobs set status='running',started_at=coalesce(started_at,now()) where id=job.id;
 for t in select * from private.owner_reset_v3_batch_targets x where x.job_id=job.id and x.status in ('pending','retry') order by x.ordinal limit p_chunk_size for update skip locked loop
  begin
   update private.owner_reset_v3_batch_targets set status='running',attempts=attempts+1 where job_id=t.job_id and ordinal=t.ordinal;
   if private.owner_operation_target_is_protected('user',t.target_public_id::text) then
    update private.owner_reset_v3_batch_targets set status='excluded',protected=true,error_code='PROTECTED_TARGET',processed_at=now() where job_id=t.job_id and ordinal=t.ordinal; continue;
   end if;
   current_snapshot:=private.owner_reset_v3_complete_snapshot(t.target_user_id,t.target_public_id);
   if current_snapshot<>t.target_snapshot or encode(extensions.digest(convert_to(current_snapshot::text,'UTF8'),'sha256'),'hex')<>t.target_snapshot_hash then
    update private.owner_reset_v3_batch_targets set status='manual_review',error_code='BULK_TARGET_SNAPSHOT_STALE',error_message='Target changed after bulk preview',processed_at=now() where job_id=t.job_id and ordinal=t.ordinal; manual:=manual+1; continue;
   end if;
   prep:=public.owner_prepare_safe_reset_v3_complete(t.target_public_id,job.categories,'Bulk '||job.scope_type||' • '||job.reason,t.target_request_id,15);
   done:=public.owner_execute_safe_reset_v3_complete((prep->>'operation_id')::uuid,prep->>'snapshot_hash','RESET V3 '||t.target_public_id::text||' '||(prep->>'operation_id'),case when jsonb_array_length(prep->'red_zone_categories')>0 then 'RED ZONE '||(prep->>'operation_id') else null end);
   if done->>'status'='completed' then update private.owner_reset_v3_batch_targets set status='completed',target_operation_id=(prep->>'operation_id')::uuid,processed_at=now(),error_code=null,error_message=null where job_id=t.job_id and ordinal=t.ordinal; success:=success+1;
   else update private.owner_reset_v3_batch_targets set status='failed',target_operation_id=(prep->>'operation_id')::uuid,error_code=coalesce(done->>'error_code','TARGET_EXECUTION_FAILED'),error_message=done->>'error_message',processed_at=now() where job_id=t.job_id and ordinal=t.ordinal; failed:=failed+1; end if;
  exception when others then
   update private.owner_reset_v3_batch_targets set status='failed',error_code=sqlstate,error_message=left(sqlerrm,500),processed_at=now() where job_id=t.job_id and ordinal=t.ordinal; failed:=failed+1;
  end;
 end loop;
 select count(*) into remaining from private.owner_reset_v3_batch_targets where job_id=job.id and status in ('pending','retry','running');
 update private.owner_reset_v3_batch_jobs set cursor_ordinal=coalesce((select max(ordinal) from private.owner_reset_v3_batch_targets where job_id=job.id and status in ('completed','failed','manual_review')),cursor_ordinal),success_count=(select count(*) from private.owner_reset_v3_batch_targets where job_id=job.id and status='completed'),failure_count=(select count(*) from private.owner_reset_v3_batch_targets where job_id=job.id and status='failed'),manual_review_count=(select count(*) from private.owner_reset_v3_batch_targets where job_id=job.id and status='manual_review'),status=case when remaining>0 then 'running' when (select count(*) from private.owner_reset_v3_batch_targets where job_id=job.id and status='completed')=job.target_count and not exists(select 1 from private.owner_reset_v3_batch_targets where job_id=job.id and status in ('failed','manual_review')) then 'completed' else 'partially_failed' end,completed_at=case when remaining=0 then now() else null end where id=job.id returning * into job;
 return jsonb_build_object('job_id',job.id,'status',job.status,'chunk_success',success,'chunk_failed',failed,'chunk_manual_review',manual,'success_count',job.success_count,'failure_count',job.failure_count,'manual_review_count',job.manual_review_count,'remaining',remaining,'cursor',job.cursor_ordinal,'full_success',job.status='completed');
end;
$function$;

SELECT public.check_admission('patched','null-limit','SELECT public.owner_prepare_safe_reset_v3_batch(''all'',NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',NULL)','22023','BULK_INPUT_INVALID');
SELECT public.check_admission('patched','zero-limit','SELECT public.owner_prepare_safe_reset_v3_batch(''all'',NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',0)','22023','BULK_INPUT_INVALID');
SELECT public.check_admission('patched','negative-limit','SELECT public.owner_prepare_safe_reset_v3_batch(''all'',NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',-1)','22023','BULK_INPUT_INVALID');
SELECT public.check_admission('patched','over-limit','SELECT public.owner_prepare_safe_reset_v3_batch(''all'',NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',1001)','22023','BULK_INPUT_INVALID');
SELECT public.check_admission('patched','null-scope','SELECT public.owner_prepare_safe_reset_v3_batch(NULL,NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',1000)','22023','BULK_SCOPE_INVALID');
SELECT public.check_admission('patched','valid-limit-boundary','SELECT public.owner_prepare_safe_reset_v3_batch(''all'',NULL,NULL,ARRAY[''coins''],''fixture reason'',''00000000-0000-0000-0000-000000000003'',1000)','ZZ001','FIXTURE_DOWNSTREAM_REACHED');
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('patched','null-hash','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,NULL,''BULK RESET V3 00000000-0000-0000-0000-000000000002'',''BULK CONFIRM 00000000-0000-0000-0000-000000000002'')','40001','BULK_SNAPSHOT_MISMATCH');
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('patched','wrong-hash','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,''wrong'',''BULK RESET V3 00000000-0000-0000-0000-000000000002'',''BULK CONFIRM 00000000-0000-0000-0000-000000000002'')','40001','BULK_SNAPSHOT_MISMATCH');
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('patched','null-first','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,''fixture-hash'',NULL,''BULK CONFIRM 00000000-0000-0000-0000-000000000002'')','22023','BULK_CONFIRMATION_MISMATCH');
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('patched','null-second','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,''fixture-hash'',''BULK RESET V3 00000000-0000-0000-0000-000000000002'',NULL)','22023','BULK_CONFIRMATION_MISMATCH');
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('patched','wrong-first','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,''fixture-hash'',''wrong'',''BULK CONFIRM 00000000-0000-0000-0000-000000000002'')','22023','BULK_CONFIRMATION_MISMATCH');
UPDATE private.owner_reset_v3_batch_jobs SET status='prepared',confirmation_digest=NULL,confirmed_at=NULL;
SELECT public.check_admission('patched','valid-confirm','SELECT public.owner_confirm_safe_reset_v3_batch(''00000000-0000-0000-0000-000000000002''::uuid,''fixture-hash'',''BULK RESET V3 00000000-0000-0000-0000-000000000002'',''BULK CONFIRM 00000000-0000-0000-0000-000000000002'')','00000',NULL);
DO $$ BEGIN
 IF (SELECT count(*) FROM private.owner_reset_v3_batch_jobs
     WHERE id='00000000-0000-0000-0000-000000000002'::uuid
       AND status='ready' AND confirmed_at IS NOT NULL AND confirmation_digest=encode(extensions.digest('BULK RESET V3 00000000-0000-0000-0000-000000000002:BULK CONFIRM 00000000-0000-0000-0000-000000000002','sha256'),'hex'))<>1 THEN
  RAISE EXCEPTION 'CONFIRM_TRANSITION_MISSING: patched/valid-confirm';
 END IF;
END $$;
UPDATE private.owner_reset_v3_batch_jobs SET status='ready';
SELECT public.check_admission('patched','null-chunk','SELECT public.owner_process_safe_reset_v3_batch_chunk(''00000000-0000-0000-0000-000000000002''::uuid,NULL)','22023','CHUNK_SIZE_INVALID');
UPDATE private.owner_reset_v3_batch_jobs SET status='ready';
SELECT public.check_admission('patched','zero-chunk','SELECT public.owner_process_safe_reset_v3_batch_chunk(''00000000-0000-0000-0000-000000000002''::uuid,0)','22023','CHUNK_SIZE_INVALID');
UPDATE private.owner_reset_v3_batch_jobs SET status='ready';
SELECT public.check_admission('patched','negative-chunk','SELECT public.owner_process_safe_reset_v3_batch_chunk(''00000000-0000-0000-0000-000000000002''::uuid,-1)','22023','CHUNK_SIZE_INVALID');
UPDATE private.owner_reset_v3_batch_jobs SET status='ready';
SELECT public.check_admission('patched','over-chunk','SELECT public.owner_process_safe_reset_v3_batch_chunk(''00000000-0000-0000-0000-000000000002''::uuid,26)','22023','CHUNK_SIZE_INVALID');
UPDATE private.owner_reset_v3_batch_jobs SET status='ready';
SELECT public.check_admission('patched','valid-chunk','SELECT public.owner_process_safe_reset_v3_batch_chunk(''00000000-0000-0000-0000-000000000002''::uuid,1)','00000',NULL);

TABLE public.admission_results;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.expected_admission_cases)<>34
    OR (SELECT count(*) FROM public.admission_results)<>34
    OR EXISTS(SELECT 1 FROM public.admission_results GROUP BY version,case_name HAVING count(*)<>1)
    OR EXISTS(
      SELECT 1 FROM public.expected_admission_cases e
      FULL JOIN public.admission_results r USING(version,case_name)
      WHERE e.version IS NULL OR r.version IS NULL OR r.pass IS DISTINCT FROM true
        OR r.expected_state IS DISTINCT FROM e.expected_state
        OR r.expected_message IS DISTINCT FROM e.expected_message
        OR r.observed_state IS DISTINCT FROM e.expected_state
        OR (e.expected_message IS NOT NULL AND r.observed_message IS DISTINCT FROM e.expected_message)
    ) THEN RAISE EXCEPTION 'ADMISSION_TEST_SET_OR_OUTCOME_FAILURE'; END IF;
END $$;
SELECT count(*) AS passed_fixture_cases FROM public.admission_results WHERE pass;
ROLLBACK;
