-- ISOLATED REVIEW ONLY. No production installation or full-reset executor.
-- Temporary functions deliberately disappear with this test connection.
-- Production integration still needs durable operation history, authorization,
-- complete backups/restore, writer fencing and settlement/epoch closure.
CREATE FUNCTION pg_temp.cosmetic_reset_snapshot(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_profile jsonb;
BEGIN
 IF p_user IS NULL THEN RAISE EXCEPTION 'target_required'; END IF;
 SELECT to_jsonb(p) INTO v_profile FROM public.profiles p WHERE p.id=p_user;
 IF v_profile IS NULL THEN RAISE EXCEPTION 'target_missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE private.is_founder(p.id))
 THEN RAISE EXCEPTION 'owner_unresolved'; END IF;
 IF private.is_founder(p_user)
 OR EXISTS(SELECT 1 FROM private.admin_roles WHERE user_id=p_user AND role='owner')
 OR EXISTS(SELECT 1 FROM private.role_assignments WHERE user_id=p_user AND role_key='root_founder')
 OR EXISTS(SELECT 1 FROM private.owner_protected_targets x WHERE x.active
   AND x.target_type IN ('user','profile','account')
   AND x.target_id IN (p_user::text,v_profile->>'public_id'))
 THEN RAISE EXCEPTION 'protected_target'; END IF;
 IF EXISTS(SELECT 1 FROM private.owner_protected_targets WHERE active
   AND (target_type IS NULL OR target_type NOT IN ('user','profile','account')))
 THEN RAISE EXCEPTION 'unresolved_protection_scope'; END IF;
 RETURN jsonb_build_object('policy','cosmetic-coverage-review-v1','user_id',p_user,
 'profile',v_profile,
 'grants',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id)
   FROM private.cosmetic_grants g WHERE g.user_id=p_user),'[]'::jsonb),
 'equipped',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.kind)
   FROM private.cosmetic_equipped_v142 e WHERE e.user_id=p_user),'[]'::jsonb));
END $$;

CREATE FUNCTION pg_temp.cosmetic_reset_apply(p_user uuid,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_before jsonb; v_after jsonb; v_grants bigint; v_equipped bigint;
BEGIN
 -- Explicit fixture capability: this is NOT an authorization mechanism.
 IF current_setting('funnyroom.isolated_fixture',true) IS DISTINCT FROM 'true'
 THEN RAISE EXCEPTION 'isolated_review_only'; END IF;
 IF p_expected IS NULL THEN RAISE EXCEPTION 'snapshot_required'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_user FOR UPDATE;
 PERFORM 1 FROM private.cosmetic_grants WHERE user_id=p_user ORDER BY id FOR UPDATE;
 PERFORM 1 FROM private.cosmetic_equipped_v142 WHERE user_id=p_user ORDER BY kind FOR UPDATE;
 v_before:=pg_temp.cosmetic_reset_snapshot(p_user);
 IF v_before IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'stale_snapshot'; END IF;
 -- Revoke all effective grants, including purchase/permanent/future-start grants.
 -- Retain grant identity, source, provenance and all historical grant rows.
 UPDATE private.cosmetic_grants g SET status='revoked',updated_at=now()
 WHERE g.user_id=p_user AND g.status IN ('active','suspended');
 GET DIAGNOSTICS v_grants=ROW_COUNT;
 -- The deployed BEFORE UPDATE trigger rejects NULL cosmetic_code. Removing a
 -- selection row represents unequip; do not disable the eligibility trigger.
 DELETE FROM private.cosmetic_equipped_v142 WHERE user_id=p_user;
 GET DIAGNOSTICS v_equipped=ROW_COUNT;
 UPDATE public.profiles SET frame_code=NULL,entry_code=NULL,bubble_code=NULL,
   badge_code=NULL,medal_code=NULL,updated_at=now() WHERE id=p_user;
 v_after:=pg_temp.cosmetic_reset_snapshot(p_user);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_after->'grants') g
   WHERE g->>'status' IN ('active','suspended'))
 OR jsonb_array_length(v_after->'equipped')<>0
 THEN RAISE EXCEPTION 'postcheck_failed'; END IF;
 IF ((v_before->'profile')-ARRAY['frame_code','entry_code','bubble_code','badge_code','medal_code','updated_at'])
   IS DISTINCT FROM ((v_after->'profile')-ARRAY['frame_code','entry_code','bubble_code','badge_code','medal_code','updated_at'])
 THEN RAISE EXCEPTION 'profile_preservation_failed'; END IF;
 RETURN jsonb_build_object('before',v_before,'after',v_after,
   'revoked_grants',v_grants,'removed_selections',v_equipped,'live_reset_ready',false);
END $$;
REVOKE ALL ON FUNCTION pg_temp.cosmetic_reset_snapshot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION pg_temp.cosmetic_reset_apply(uuid,jsonb) FROM PUBLIC;
