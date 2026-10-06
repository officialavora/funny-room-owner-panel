CREATE OR REPLACE FUNCTION public.panel_create_explicit_staff_authority(
 p_user uuid,p_role text,p_permissions text[],p_context_type text,p_context_id text,p_expires_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();target_public bigint;assignment uuid;permission record;chosen boolean;ctx text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required';END IF;
 IF p_user IS NULL OR p_user=actor OR private.is_founder(p_user) THEN RAISE EXCEPTION 'Invalid or protected target';END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user AND u.raw_app_meta_data->>'created_by'=actor::text AND u.raw_app_meta_data ? 'panel_login_id') THEN RAISE EXCEPTION 'New staff must be created by the authenticated parent';END IF;
 IF EXISTS(SELECT 1 FROM private.role_assignments ra WHERE ra.user_id=p_user AND ra.status IN('active','temporary','under_review','suspended')) THEN RAISE EXCEPTION 'Existing IDs must use the individual authority controls';END IF;
 IF p_role NOT IN('co_owner','country_manager','manager','super_admin','admin','bd_leader','cs_leader','bd','moderator','cs','event_manager','coin_seller','merchant','agency_owner','host') THEN RAISE EXCEPTION 'Staff role not allowed';END IF;
 IF p_permissions IS NULL OR EXISTS(SELECT 1 FROM unnest(p_permissions) key WHERE NOT EXISTS(SELECT 1 FROM private.permission_definitions d WHERE d.permission_key=key)) THEN RAISE EXCEPTION 'Unknown permission selection';END IF;
 ctx:=CASE WHEN p_context_type='country' THEN upper(p_context_id) ELSE p_context_id END;
 IF NOT private.is_founder(actor) AND NOT private.has_permission('permissions.assign',p_context_type,ctx,actor) THEN RAISE EXCEPTION 'Permission delegation required in selected scope';END IF;
 FOREACH ctx IN ARRAY p_permissions LOOP
  IF NOT private.is_founder(actor) AND (ctx IN('wallet.adjust','seller.recharge','seller.transfer','withdrawals.approve') OR NOT private.has_permission(ctx,p_context_type,p_context_id,actor)) THEN RAISE EXCEPTION 'Selected power cannot be delegated';END IF;
 END LOOP;
 ctx:=CASE WHEN p_context_type='country' THEN upper(p_context_id) ELSE p_context_id END;
 assignment:=public.owner_assign_multi_role(p_user,p_role,p_context_type,ctx,p_expires_at,'Explicit scoped staff creation',true);
 SELECT public_id INTO target_public FROM public.profiles WHERE id=p_user;
 -- Every omitted role preset receives a scoped denial: selected powers are exact, not additive.
 FOR permission IN SELECT permission_key FROM private.permission_definitions LOOP
  chosen:=permission.permission_key=ANY(p_permissions);
  INSERT INTO private.permission_overrides(user_id,permission_key,allowed,context_type,context_id,status,expires_at,granted_by,reason)
  VALUES(p_user,permission.permission_key,chosen,p_context_type,ctx,'active',p_expires_at,actor,'Explicit scoped staff powers');
 END LOOP;
 INSERT INTO public.audit_log(actor_id,action,target_type,target_id,metadata)
 VALUES(actor,'panel.staff_explicit_powers','user',p_user::text,jsonb_build_object('assignment_id',assignment,'parent_user_id',actor,'role',p_role,'context_type',p_context_type,'context_id',ctx,'selected_permissions',p_permissions,'expires_at',p_expires_at));
 RETURN jsonb_build_object('public_id',target_public,'assignment_id',assignment,'permission_mode','explicit','context_type',p_context_type,'context_id',ctx);
END $$;
REVOKE ALL ON FUNCTION public.panel_create_explicit_staff_authority(uuid,text,text[],text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.panel_create_explicit_staff_authority(uuid,text,text[],text,text,timestamptz) TO authenticated;
