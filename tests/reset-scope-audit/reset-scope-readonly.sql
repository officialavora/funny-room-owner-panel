-- Read-only reset-scope audit. No reset function is called.
-- Counts and hashes only: this is NOT a recoverable backup or reset approval.
WITH owners AS MATERIALIZED (
 SELECT p.id FROM public.profiles p WHERE private.is_founder(p.id)
 UNION SELECT user_id FROM private.admin_roles WHERE role='owner'
 UNION SELECT user_id FROM private.role_assignments WHERE role_key='root_founder'
), protected AS MATERIALIZED (
 SELECT id FROM owners
 UNION SELECT p.id FROM public.profiles p JOIN private.owner_protected_targets x
 ON x.active AND x.target_type IN ('user','profile','account')
 AND x.target_id IN (p.id::text,p.public_id::text)
), targets AS MATERIALIZED (
 SELECT p.id FROM public.profiles p WHERE NOT EXISTS(SELECT 1 FROM protected o WHERE o.id=p.id)
), grants AS MATERIALIZED (
 SELECT g.* FROM private.cosmetic_grants g JOIN targets t ON t.id=g.user_id
), memberships AS MATERIALIZED (
 SELECT m.* FROM private.svip_memberships m JOIN targets t ON t.id=m.user_id
), rewards AS MATERIALIZED (
 SELECT r.* FROM public.reward_grants r JOIN targets t ON t.id=r.user_id
), fingerprints AS (
 SELECT 'profile_identity_content' AS surface,
   to_jsonb(p)-ARRAY['level','vip_level','points','frame_code','entry_code','bubble_code','badge_code','medal_code','updated_at'] AS value
 FROM public.profiles p
 UNION ALL SELECT 'owner_profiles_whole',to_jsonb(p) FROM public.profiles p JOIN owners o ON o.id=p.id
 UNION ALL SELECT 'rooms_whole',to_jsonb(r) FROM public.rooms r
 UNION ALL SELECT 'moments',to_jsonb(r) FROM public.moments r
 UNION ALL SELECT 'moment_comments',to_jsonb(r) FROM public.moment_comments r
 UNION ALL SELECT 'moment_likes',to_jsonb(r) FROM public.moment_likes r
 UNION ALL SELECT 'profile_cover_likes',to_jsonb(r) FROM public.profile_cover_likes r
 UNION ALL SELECT 'organization_members',to_jsonb(r) FROM public.organization_members r
 UNION ALL SELECT 'organizations',to_jsonb(r) FROM public.organizations r
 UNION ALL SELECT 'cp_relationships',to_jsonb(r) FROM public.cp_relationships r
 UNION ALL SELECT 'affinity_bonds',to_jsonb(r) FROM public.affinity_bonds r
 UNION ALL SELECT 'room_memberships',to_jsonb(r) FROM public.room_memberships r
 UNION ALL SELECT 'security_roles',to_jsonb(r) FROM private.role_assignments r
 UNION ALL SELECT 'admin_roles',to_jsonb(r) FROM private.admin_roles r
 UNION ALL SELECT 'cosmetic_catalog',to_jsonb(r) FROM public.cosmetic_catalog r
 UNION ALL SELECT 'gift_catalog',to_jsonb(r) FROM public.gift_catalog r
), expected_surfaces(surface) AS (VALUES
 ('profile_identity_content'),('owner_profiles_whole'),('rooms_whole'),('moments'),
 ('moment_comments'),('moment_likes'),('profile_cover_likes'),('organization_members'),
 ('organizations'),('cp_relationships'),('affinity_bonds'),('room_memberships'),
 ('security_roles'),('admin_roles'),('cosmetic_catalog'),('gift_catalog')
), fingerprint_groups AS (
 SELECT e.surface,count(f.value) AS rows,
 encode(sha256(convert_to(coalesce(jsonb_agg(f.value ORDER BY f.value::text)
   FILTER (WHERE f.value IS NOT NULL),'[]'::jsonb)::text,'UTF8')),'hex') AS sha256
 FROM expected_surfaces e LEFT JOIN fingerprints f ON f.surface=e.surface GROUP BY e.surface
)
SELECT jsonb_build_object(
 'format','funnyroom-reset-scope-readonly-v1',
 'captured_at',statement_timestamp(),'engine',version(),'database_role',current_user,
 'profiles',(SELECT count(*) FROM public.profiles),
 'owner_profiles',(SELECT count(*) FROM owners),
 'protected_profiles',(SELECT count(*) FROM protected),
 'candidate_profiles',(SELECT count(*) FROM targets),
 'unresolved_protected_target_types',(SELECT coalesce(jsonb_agg(DISTINCT target_type),'[]'::jsonb)
   FROM private.owner_protected_targets WHERE active AND target_type NOT IN ('user','profile','account')),
 'cosmetic_grants',jsonb_build_object(
   'rows',(SELECT count(*) FROM grants),
   'effective_state',(SELECT count(*) FROM grants WHERE status IN ('active','suspended')),
   'old_policy_omits',(SELECT count(*) FROM grants WHERE status IN ('active','suspended') AND (source='purchase' OR expires_at IS NULL)),
   'future_effective_state',(SELECT count(*) FROM grants WHERE status IN ('active','suspended') AND starts_at>statement_timestamp()),
   'by_source_status',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.source,q.status),'[]'::jsonb)
      FROM (SELECT source,status,count(*) AS rows FROM grants GROUP BY source,status) q)),
 'authoritative_equipped',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.kind),'[]'::jsonb)
   FROM (SELECT e.kind,count(*) AS rows,count(e.cosmetic_code) AS selected
   FROM private.cosmetic_equipped_v142 e JOIN targets t ON t.id=e.user_id GROUP BY e.kind) q),
 'svip_memberships',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.status,q.permanent),'[]'::jsonb)
   FROM (SELECT status,permanent,count(*) AS rows FROM memberships GROUP BY status,permanent) q),
 'svip_cross_user_links',(SELECT count(*) FROM private.svip_entitlement_grants e JOIN targets t ON t.id=e.user_id
   LEFT JOIN private.cosmetic_grants g ON g.id=e.cosmetic_grant_id
   LEFT JOIN private.svip_memberships m ON m.id=e.membership_id
   WHERE (e.cosmetic_grant_id IS NOT NULL AND (g.id IS NULL OR g.user_id IS DISTINCT FROM e.user_id))
      OR m.id IS NULL OR m.user_id IS DISTINCT FROM e.user_id),
 'reward_grants',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.state,q.permanent),'[]'::jsonb)
   FROM (SELECT state,permanent,count(*) AS rows FROM rewards GROUP BY state,permanent) q),
 'birthday_enabled_benefits',(SELECT count(*) FROM public.birthday_events b JOIN targets t ON t.id=b.user_id WHERE b.benefits_enabled),
 'birthday_current_sync_eligible',(SELECT count(*) FROM public.birthday_events b JOIN targets t ON t.id=b.user_id
   WHERE b.benefits_enabled AND b.active AND b.starts_at<=statement_timestamp() AND (b.permanent OR b.ends_at>statement_timestamp())),
 'wallet_nonzero',(SELECT count(*) FROM public.wallets w JOIN targets t ON t.id=w.user_id WHERE w.coin_balance<>0 OR w.earned_balance<>0),
 'wallet_negative',(SELECT count(*) FROM public.wallets w JOIN targets t ON t.id=w.user_id WHERE w.coin_balance<0 OR w.earned_balance<0),
 'settlements',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.status),'[]'::jsonb)
   FROM (SELECT s.status,count(*) AS rows FROM private.settlement_requests s JOIN targets t ON t.id=s.user_id GROUP BY s.status) q),
 'active_crons',(SELECT count(*) FROM cron.job WHERE active),
 'reset_jobs',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.status),'[]'::jsonb)
   FROM (SELECT status,count(*) AS rows FROM private.owner_reset_v3_batch_jobs GROUP BY status) q),
 'selected_protected_fingerprints',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.surface),'[]'::jsonb) FROM fingerprint_groups q),
 'coverage','selected schema-backed categories and protected surfaces; not complete writer/dependency/media coverage',
 'recoverable_backup',false,'writer_cutover_verified',false,'live_reset_ready',false
) AS audit;
