-- Additive Founder workspace. Existing consumers and canonical reward delivery stay authoritative.
CREATE TABLE IF NOT EXISTS private.banner_workspace_receipts_v1 (
 actor_id uuid NOT NULL, request_id uuid NOT NULL, request_hash text NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE private.banner_workspace_receipts_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.banner_workspace_receipts_v1 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.banner_workspace_rows_v1(p_family text)
RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_family='popular' THEN RETURN QUERY SELECT to_jsonb(b) FROM public.popular_feature_banners b;
 ELSIF p_family='birthday' THEN RETURN QUERY SELECT to_jsonb(b)||jsonb_build_object('title','Birthday '||b.event_date::text) FROM public.birthday_events b;
 ELSIF p_family='ops' THEN RETURN QUERY SELECT to_jsonb(b) FROM private.ops_banners b;
 ELSIF p_family='campaign' THEN RETURN QUERY SELECT to_jsonb(b) FROM public.campaign_banners b;
 ELSIF p_family='reward' THEN RETURN QUERY SELECT to_jsonb(b)||jsonb_build_object('image_url',b.banner_url,'tiers',
  (SELECT coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('items',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.sort_order,i.id),'[]') FROM public.reward_tier_items i WHERE i.tier_id=t.id)) ORDER BY t.sort_order,t.id),'[]') FROM public.reward_campaign_tiers t WHERE t.campaign_id=b.id)) FROM public.reward_campaigns b;
 ELSE RAISE EXCEPTION 'BANNER_FAMILY_INVALID'; END IF;
END $$;
REVOKE ALL ON FUNCTION private.banner_workspace_rows_v1(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.owner_banner_workspace_list_v1(p_family text,p_limit int DEFAULT 50,p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid();out_rows jsonb;
BEGIN
 IF a IS NULL OR NOT private.is_founder(a) THEN RAISE EXCEPTION USING errcode='42501',message='FOUNDER_REQUIRED'; END IF;
 SELECT coalesce(jsonb_agg(r||jsonb_build_object('revision',md5(r::text))),'[]') INTO out_rows FROM
 (SELECT r FROM private.banner_workspace_rows_v1(p_family) r ORDER BY r->>'updated_at' DESC,r->>'id' LIMIT least(greatest(p_limit,1),100) OFFSET greatest(p_offset,0)) s;
 RETURN jsonb_build_object('actor_id',a,'family',p_family,'rows',out_rows);
END $$;
REVOKE ALL ON FUNCTION public.owner_banner_workspace_list_v1(text,int,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_banner_workspace_list_v1(text,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_banner_workspace_save_v1(p_family text,p_id uuid,p_expected_revision text,p_payload jsonb,p_tiers jsonb,p_reason text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid();before_row jsonb;after_row jsonb;receipt private.banner_workspace_receipts_v1;body_hash text;target uuid:=coalesce(p_id,gen_random_uuid());j jsonb;k jsonb;c public.cosmetic_catalog;res jsonb;img text;payload jsonb;expected_kind text;
BEGIN
 IF a IS NULL OR NOT private.is_founder(a) THEN RAISE EXCEPTION USING errcode='42501',message='FOUNDER_REQUIRED'; END IF;
 IF p_request_id IS NULL OR length(btrim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'REQUEST_AND_REASON_REQUIRED'; END IF;
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PAYLOAD_INVALID'; END IF;
 body_hash:=md5(jsonb_build_array(p_family,p_id,p_expected_revision,p_payload,p_tiers,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text||p_request_id::text,0));
 SELECT * INTO receipt FROM private.banner_workspace_receipts_v1 WHERE actor_id=a AND request_id=p_request_id;
 IF FOUND THEN IF receipt.request_hash<>body_hash THEN RAISE EXCEPTION 'REQUEST_ID_CONFLICT'; END IF; RETURN receipt.result; END IF;
 -- Serialize with normal row editors as well as this workspace, then compare the entire read snapshot.
 IF p_family='popular' THEN PERFORM 1 FROM public.popular_feature_banners WHERE id=target FOR UPDATE;
 ELSIF p_family='birthday' THEN PERFORM 1 FROM public.birthday_events WHERE id=target FOR UPDATE;
 ELSIF p_family='ops' THEN PERFORM 1 FROM private.ops_banners WHERE id=target FOR UPDATE;
 ELSIF p_family='campaign' THEN PERFORM 1 FROM public.campaign_banners WHERE id=target FOR UPDATE;
 ELSIF p_family='reward' THEN PERFORM 1 FROM public.reward_campaigns WHERE id=target FOR UPDATE;
 ELSE RAISE EXCEPTION 'BANNER_FAMILY_INVALID'; END IF;
 SELECT r INTO before_row FROM private.banner_workspace_rows_v1(p_family) r WHERE r->>'id'=target::text;
 IF p_id IS NOT NULL AND (before_row IS NULL OR p_expected_revision IS DISTINCT FROM md5(before_row::text)) THEN RAISE EXCEPTION USING errcode='40001',message='BANNER_CHANGED_REFRESH'; END IF;
 IF p_id IS NULL AND p_expected_revision IS NOT NULL THEN RAISE EXCEPTION 'NEW_BANNER_REVISION_INVALID'; END IF;
 IF p_payload ? 'operation' THEN
  IF p_id IS NULL OR p_payload->>'operation' NOT IN ('activate','pause') THEN RAISE EXCEPTION 'BANNER_OPERATION_INVALID'; END IF;
  IF p_family='reward' THEN
   -- The current public claim reader measures legacy recharge units and omits
   -- campaign variant/config. Do not publish a new USD/festival offer against it.
   IF p_payload->>'operation'='activate' AND coalesce(before_row->'config'->>'eligibility_mode','legacy_recharge')<>'legacy_recharge' THEN
    IF to_regprocedure('private.campaign_metric_v171(uuid,uuid)') IS NULL
     OR position('campaign_metric_v171' in pg_get_functiondef('public.claim_recharge_reward(uuid,uuid,bigint)'::regprocedure))=0
     OR position('campaign_metric_v171' in pg_get_functiondef('public.load_my_recharge_reward_state(uuid)'::regprocedure))=0
     OR position('''config''' in pg_get_functiondef('public.load_recharge_campaigns()'::regprocedure))=0
    THEN RAISE EXCEPTION 'CAMPAIGN_METRIC_CONTRACT_NOT_INSTALLED'; END IF;
   END IF;
   IF p_payload->>'operation'='activate' AND EXISTS(SELECT 1 FROM public.reward_campaign_tiers t JOIN public.reward_tier_items i ON i.tier_id=t.id WHERE t.campaign_id=p_id AND i.reward_kind NOT IN ('coins','profile_frame','entry_effect','chat_bubble','badge','cosmetic')) THEN RAISE EXCEPTION 'REWARD_TYPE_NOT_SUPPORTED'; END IF;
   PERFORM public.owner_set_reward_campaign_state(p_id,CASE WHEN p_payload->>'operation'='activate' THEN 'active' ELSE 'paused' END,p_reason,p_request_id);
  ELSIF p_family='campaign' THEN
   PERFORM public.owner_set_campaign_banner_state(p_id,CASE WHEN p_payload->>'operation'='activate' THEN 'activate' ELSE 'deactivate' END,p_reason,p_request_id);
  ELSIF p_family='popular' THEN
   IF p_payload->>'operation'='activate' AND NOT private.can_publish_front_banner((before_row->>'created_by')::uuid) THEN RAISE EXCEPTION 'ORIGINAL_PUBLISHER_NOT_AUTHORIZED'; END IF;
   UPDATE public.popular_feature_banners SET active=(p_payload->>'operation'='activate'),updated_at=clock_timestamp() WHERE id=p_id;
  ELSIF p_family='birthday' THEN
   IF p_payload->>'operation'='activate' AND NOT private.can_publish_front_banner((before_row->>'creator_id')::uuid) THEN RAISE EXCEPTION 'ORIGINAL_PUBLISHER_NOT_AUTHORIZED'; END IF;
   UPDATE public.birthday_events SET active=(p_payload->>'operation'='activate'),updated_at=clock_timestamp() WHERE id=p_id;
  ELSE UPDATE private.ops_banners SET active=(p_payload->>'operation'='activate'),updated_by=a,updated_at=clock_timestamp() WHERE id=p_id;
  END IF;
  SELECT r INTO after_row FROM private.banner_workspace_rows_v1(p_family) r WHERE r->>'id'=p_id::text;
  INSERT INTO public.audit_log(actor_id,action,target_type,target_id,metadata) VALUES(a,'banner.workspace_state','banner',p_id::text,jsonb_build_object('family',p_family,'reason',p_reason,'before',before_row,'after',after_row,'request_id',p_request_id));
  res:=jsonb_build_object('actor_id',a,'family',p_family,'row',after_row||jsonb_build_object('revision',md5(after_row::text)),'request_id',p_request_id);
  INSERT INTO private.banner_workspace_receipts_v1(actor_id,request_id,request_hash,result) VALUES(a,p_request_id,body_hash,res);RETURN res;
 END IF;
 img:=nullif(p_payload->>'image_url','');
 IF img IS NULL OR img !~ '^https://[^[:space:]]+$' OR img ~* '\.(mp4|webm)(\?|$)' THEN RAISE EXCEPTION 'BANNER_IMAGE_HTTPS_REQUIRED'; END IF;
 IF length(btrim(coalesce(p_payload->>'title','')))<2 THEN RAISE EXCEPTION 'BANNER_TITLE_REQUIRED'; END IF;
 IF p_family='popular' THEN
  IF p_id IS NULL THEN INSERT INTO public.popular_feature_banners(id,title,image_url,active,created_by) VALUES(target,p_payload->>'title',img,false,a);
  ELSE UPDATE public.popular_feature_banners SET title=p_payload->>'title',image_url=img,updated_at=clock_timestamp() WHERE id=target; END IF;
 ELSIF p_family='birthday' THEN
  IF p_id IS NULL THEN RAISE EXCEPTION 'CREATE_BIRTHDAY_IN_EXISTING_EVENT_FLOW'; END IF;
  UPDATE public.birthday_events SET image_url=img,updated_at=clock_timestamp() WHERE id=target;
 ELSIF p_family='ops' THEN
  IF p_id IS NULL THEN target:=public.owner_upsert_banner(NULL,coalesce(p_payload->>'placement','home'),p_payload->>'title','',img,'none',NULL,NULL,now(),NULL,0,false);
  ELSE UPDATE private.ops_banners SET title=p_payload->>'title',image_url=img,updated_by=a,updated_at=clock_timestamp() WHERE id=target; END IF;
 ELSIF p_family='campaign' THEN
  IF p_id IS NULL THEN
   res:=public.owner_upsert_campaign_banner(NULL,jsonb_build_object('title',p_payload->>'title','image_url',img,'campaign_id',p_payload->>'campaign_id','starts_at',p_payload->>'starts_at','ends_at',p_payload->>'ends_at'),p_reason,p_request_id);target:=(res->>'banner_id')::uuid;
  ELSE
   IF nullif(p_payload->>'campaign_id','') IS DISTINCT FROM nullif(before_row->>'campaign_id','') THEN RAISE EXCEPTION 'EXISTING_CAMPAIGN_LINK_IMMUTABLE'; END IF;
   UPDATE public.campaign_banners SET title=p_payload->>'title',image_url=img,updated_at=clock_timestamp() WHERE id=target;
  END IF;
 ELSIF p_family='reward' THEN
  IF before_row IS NOT NULL AND before_row->>'status' NOT IN ('draft','paused') THEN RAISE EXCEPTION 'PAUSE_OR_DUPLICATE_BEFORE_REWARD_EDIT'; END IF;
  IF EXISTS(SELECT 1 FROM public.campaign_claims WHERE campaign_id=target) THEN RAISE EXCEPTION 'EXISTING_CLAIMS_REQUIRE_NEW_CAMPAIGN'; END IF;
  IF jsonb_typeof(p_tiers) IS DISTINCT FROM 'array' OR jsonb_array_length(p_tiers) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'USE_1_TO_100_TIERS'; END IF;
  FOR j IN SELECT * FROM jsonb_array_elements(p_tiers) LOOP
   IF coalesce(j->>'required_recharge','') !~ '^[0-9]{1,16}$' OR (j->>'required_recharge')::numeric NOT BETWEEN 1 AND 9007199254740991 OR jsonb_typeof(j->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(j->'items') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'TIER_INVALID'; END IF;
   FOR k IN SELECT * FROM jsonb_array_elements(j->'items') LOOP
    IF k->>'kind' NOT IN ('coins','profile_frame','entry_effect','chat_bubble','badge','cosmetic') OR k->>'kind' IS NULL THEN RAISE EXCEPTION 'REWARD_TYPE_NOT_SUPPORTED'; END IF;
    IF coalesce(k->>'quantity','') !~ '^[0-9]{1,10}$' OR (k->>'quantity')::numeric NOT BETWEEN 1 AND 1000000000 THEN RAISE EXCEPTION 'REWARD_QUANTITY_INVALID'; END IF;
    IF k->>'kind'<>'coins' THEN
     SELECT * INTO c FROM public.cosmetic_catalog WHERE code=k->>'code' AND active;
     IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_CATALOGUE_ITEM_REQUIRED'; END IF;
     expected_kind:=CASE k->>'kind' WHEN 'profile_frame' THEN 'frame' WHEN 'entry_effect' THEN 'entry' WHEN 'chat_bubble' THEN 'bubble' WHEN 'badge' THEN 'badge' ELSE c.kind END;
     IF c.kind<>expected_kind OR (k->>'quantity')::numeric<>1 THEN RAISE EXCEPTION 'CATALOGUE_KIND_OR_QUANTITY_INVALID'; END IF;
     IF NOT coalesce((k->>'permanent')::boolean,false) AND (nullif(k->>'duration_seconds','') IS NULL OR (k->>'duration_seconds')::numeric NOT BETWEEN 1 AND 315360000) THEN RAISE EXCEPTION 'REWARD_DURATION_REQUIRED'; END IF;
    END IF;
   END LOOP;
  END LOOP;
  payload:=coalesce(before_row,'{}')||p_payload||jsonb_build_object('banner_url',img);
  IF p_id IS NULL THEN payload:=payload||jsonb_build_object('eligible_sources',jsonb_build_array('app','seller','agency')); END IF;
  IF p_id IS NULL THEN
   IF p_payload->'config'->>'variant' NOT IN ('recharge','festival') OR p_payload->'config'->>'variant' IS NULL THEN RAISE EXCEPTION 'CAMPAIGN_VARIANT_REQUIRED'; END IF;
  ELSE payload:=payload||jsonb_build_object('config',before_row->'config'); END IF;
  res:=public.owner_upsert_reward_campaign(p_id,payload,p_reason,p_request_id);target:=(res->>'campaign_id')::uuid;
  PERFORM public.owner_replace_campaign_tiers(target,p_tiers,p_reason,p_request_id);
 END IF;
 IF p_family IN ('popular','birthday') AND p_payload ? 'music_url' THEN
  IF nullif(p_payload->>'music_url','') IS NOT NULL AND p_payload->>'music_url' !~ '^https://[^[:space:]]+$' THEN RAISE EXCEPTION 'MUSIC_HTTPS_REQUIRED'; END IF;
  IF p_family='popular' THEN UPDATE public.popular_feature_banners SET music_url=nullif(p_payload->>'music_url',''),music_enabled=coalesce((p_payload->>'music_enabled')::boolean,false),updated_at=clock_timestamp() WHERE id=target;
  ELSE UPDATE public.birthday_events SET music_url=nullif(p_payload->>'music_url',''),music_enabled=coalesce((p_payload->>'music_enabled')::boolean,false),updated_at=clock_timestamp() WHERE id=target; END IF;
 END IF;
 SELECT r INTO after_row FROM private.banner_workspace_rows_v1(p_family) r WHERE r->>'id'=target::text;
 INSERT INTO public.audit_log(actor_id,action,target_type,target_id,metadata) VALUES(a,'banner.workspace_saved','banner',target::text,jsonb_build_object('family',p_family,'reason',p_reason,'before',before_row,'after',after_row,'request_id',p_request_id));
 res:=jsonb_build_object('actor_id',a,'family',p_family,'row',after_row||jsonb_build_object('revision',md5(after_row::text)),'request_id',p_request_id);
 INSERT INTO private.banner_workspace_receipts_v1(actor_id,request_id,request_hash,result) VALUES(a,p_request_id,body_hash,res);
 RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.owner_banner_workspace_save_v1(text,uuid,text,jsonb,jsonb,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_banner_workspace_save_v1(text,uuid,text,jsonb,jsonb,text,uuid) TO authenticated;
