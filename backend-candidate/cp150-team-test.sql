BEGIN;
DO $$
DECLARE f uuid:=gen_random_uuid(); india uuid:=gen_random_uuid(); india2 uuid:=gen_random_uuid(); pakistan uuid:=gen_random_uuid(); admin_in uuid:=gen_random_uuid(); sibling uuid:=gen_random_uuid(); user_in uuid:=gen_random_uuid(); user_pk uuid:=gen_random_uuid(); u uuid;
BEGIN
 FOREACH u IN ARRAY ARRAY[f,india,india2,pakistan,admin_in,sibling,user_in,user_pk] LOOP
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(u,'cp150-fixture-'||u||'@example.invalid','{"display_name":"CP150 rollback fixture"}');
  INSERT INTO public.profiles(id,display_name) VALUES(u,'CP150 rollback fixture') ON CONFLICT DO NOTHING;
 END LOOP;
 UPDATE public.profiles SET country_code='IN' WHERE id IN(india,india2,admin_in,sibling,user_in);
 UPDATE public.profiles SET country_code='PK' WHERE id IN(pakistan,user_pk);
 INSERT INTO private.role_assignments(user_id,role_key,context_type,context_id,status,granted_by) VALUES
 (f,'root_founder','global','*','active',null),
 (india,'country_manager','country','IN','active',f),
 (india2,'country_manager','country','IN','active',f),
 (pakistan,'country_manager','country','PK','active',f),
 (admin_in,'admin','country','IN','active',india),
 (sibling,'admin','country','IN','active',india2);
 INSERT INTO private.permission_overrides(user_id,permission_key,allowed,context_type,context_id,status,granted_by,reason) VALUES
 (india,'users.view',true,'country','IN','active',f,'CP150 test'),
 (pakistan,'users.view',true,'country','PK','active',f,'CP150 test'),
 (admin_in,'users.view',true,'country','IN','active',india,'CP150 test');
 IF NOT private.can_view_user(admin_in,india) THEN RAISE EXCEPTION 'PARENT_CANNOT_VIEW_CHILD';END IF;
 IF private.can_view_user(india,admin_in) THEN RAISE EXCEPTION 'CHILD_SEES_PARENT';END IF;
 IF private.can_view_user(sibling,india) THEN RAISE EXCEPTION 'OTHER_BRANCH_VISIBLE';END IF;
 IF private.can_view_user(pakistan,india) OR private.can_view_user(user_pk,india) THEN RAISE EXCEPTION 'OTHER_COUNTRY_VISIBLE';END IF;
 IF NOT private.can_view_user(user_in,india) OR NOT private.can_view_user(user_pk,pakistan) THEN RAISE EXCEPTION 'SCOPED_MEMBER_HIDDEN';END IF;
 -- A legacy admin compatibility record must not bypass the staff tree or country.
 INSERT INTO private.admin_roles(user_id,role,protected) VALUES(admin_in,'admin',false);
 IF private.can_view_user(user_pk,admin_in) OR private.can_view_user(sibling,admin_in) THEN RAISE EXCEPTION 'LEGACY_ADMIN_SCOPE_BYPASS';END IF;
 -- Even an explicit/global permission cannot expose equal/higher authority or another staff branch.
 INSERT INTO private.permission_overrides(user_id,permission_key,allowed,context_type,context_id,status,granted_by,reason)
 VALUES(admin_in,'profiles.manage',true,'global','*','active',f,'CP150 test');
 IF private.has_permission_for_user('profiles.manage',india,admin_in) OR private.has_permission_for_user('profiles.manage',sibling,admin_in) THEN RAISE EXCEPTION 'POWER_BYPASSES_TREE';END IF;
 IF NOT private.can_view_user(india,f) OR NOT private.can_view_user(pakistan,f) THEN RAISE EXCEPTION 'FOUNDER_LOCKED_OUT';END IF;
 PERFORM set_config('request.jwt.claim.sub',india::text,true);
 IF EXISTS(SELECT 1 FROM public.panel_staff_tree() WHERE user_id IN(f,india2,pakistan,sibling)) THEN RAISE EXCEPTION 'TREE_BRANCH_LEAK';END IF;
 IF EXISTS(SELECT 1 FROM public.panel_staff_tree() WHERE user_id=india AND (parent_user_id IS NOT NULL OR parent_public_id IS NOT NULL OR parent_display_name IS NOT NULL)) THEN RAISE EXCEPTION 'PARENT_METADATA_LEAK';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.panel_staff_tree() WHERE user_id=admin_in) THEN RAISE EXCEPTION 'TREE_CHILD_MISSING';END IF;
 IF EXISTS(SELECT 1 FROM public.owner_role_members('admin') WHERE user_id=sibling) OR NOT EXISTS(SELECT 1 FROM public.owner_role_members('admin') WHERE user_id=admin_in) THEN RAISE EXCEPTION 'ROLE_DIRECTORY_BRANCH_ERROR';END IF;
 IF EXISTS(SELECT 1 FROM public.owner_role_summary() WHERE role_key='root_founder') THEN RAISE EXCEPTION 'ROLE_SUMMARY_UPPER_METADATA';END IF;
 UPDATE private.role_assignments SET status='suspended' WHERE user_id=admin_in;
 IF NOT EXISTS(SELECT 1 FROM public.panel_staff_tree() WHERE user_id=admin_in) THEN RAISE EXCEPTION 'SUSPENDED_CHILD_DISAPPEARED';END IF;
 IF private.active_role_rank(admin_in)<>0 THEN RAISE EXCEPTION 'LEGACY_ROLE_RESURRECTED_SUSPENDED_ACTOR';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.owner_role_members('admin') WHERE user_id=admin_in AND status='suspended') THEN RAISE EXCEPTION 'SUSPENDED_ROLE_DIRECTORY_CHILD_HIDDEN';END IF;
 UPDATE private.role_assignments SET status='suspended' WHERE user_id=india;
 IF private.can_view_user(user_in,india) THEN RAISE EXCEPTION 'SUSPENDED_ACTOR_ACCESS';END IF;
 RAISE NOTICE 'CP150 TEAM ISOLATION PASS: parent/child, country, branch, powers, self metadata, legacy bypass, suspension';
END $$;

ROLLBACK;
