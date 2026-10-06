-- Candidate: existing IDs cannot be stolen from inactive branches or managed above rank.
CREATE OR REPLACE FUNCTION public.owner_assign_multi_role(p_user uuid, p_role text, p_context_type text DEFAULT 'global'::text, p_context_id text DEFAULT '*'::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reason text DEFAULT ''::text, p_primary boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); assignment_id uuid; target_rank int; actor_rank int;
 actor_ceiling int; target_country text; target_public text;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if p_context_type not in ('global','country','agency','user','seller','merchant') then raise exception 'Invalid authority scope'; end if;
 if coalesce(trim(p_context_id),'')='' then raise exception 'Scope ID required'; end if;
 if not private.is_founder(actor) and not private.has_permission('roles.assign',p_context_type,p_context_id,actor) then
   raise exception 'Role assignment permission required for this scope';
 end if;
 if p_user is null or p_user=actor then raise exception 'Self-assignment is not allowed'; end if;
 select rank into target_rank from private.role_definitions where role_key=p_role and active;
 if target_rank is null or p_role='root_founder' then raise exception 'Invalid or protected role'; end if;
 actor_rank:=case when private.is_founder(actor) then 100 else private.active_role_rank(actor) end;
 if actor_rank<=0 or target_rank>=actor_rank then raise exception 'You can assign only roles below your own post'; end if;
 if not private.is_founder(actor) and exists(select 1 from private.role_assignments x join private.role_definitions xd on xd.role_key=x.role_key where x.user_id=p_user and x.status in ('active','temporary','under_review','suspended') and xd.rank>=actor_rank) then raise exception 'Target holds an equal or higher protected post';end if;
 select upper(coalesce(country_code,'')),public_id::text into target_country,target_public from public.profiles where id=p_user;
 if target_public is null then raise exception 'Target user not found'; end if;
 if p_context_type='country' and upper(p_context_id)<>target_country then raise exception 'Target user is outside the selected country scope'; end if;
 if p_context_type in ('user','seller','merchant') and p_context_id<>target_public then raise exception 'Selected scope does not match target permanent ID'; end if;
 if not private.is_founder(actor)
   and exists(select 1 from private.role_assignments x where x.user_id=p_user and x.status in ('active','temporary','under_review','suspended') and exists(select 1 from private.role_definitions xd where xd.role_key=x.role_key and xd.rank>=20))
   and not private.is_authority_descendant(actor,p_user) then
   raise exception 'Target already belongs to another protected staff branch';
 end if;
 if not private.is_founder(actor) and exists(select 1 from private.role_assignments x where x.user_id=p_user and x.role_key=p_role and x.context_type=p_context_type and x.context_id=case when p_context_type='country' then upper(p_context_id) else p_context_id end and x.status in ('active','temporary','under_review','suspended') and not private.authority_assignment_in_branch_v153(actor,x.user_id,x.granted_by)) then raise exception 'Existing assignment belongs to another authority branch';end if;
 select coalesce(max(rd.delegation_ceiling),0) into actor_ceiling
 from private.role_assignments ra join private.role_definitions rd on rd.role_key=ra.role_key
 where ra.user_id=actor and ra.status in ('active','temporary') and (ra.starts_at is null or ra.starts_at<=now()) and exists(select 1 from private.role_definitions effective_definition where effective_definition.role_key=ra.role_key and effective_definition.active) and (ra.expires_at is null or ra.expires_at>now());
 if private.is_founder(actor) then actor_ceiling:=99; end if;
 if target_rank>actor_ceiling then raise exception 'Delegation ceiling exceeded'; end if;
 insert into private.role_assignments(user_id,role_key,context_type,context_id,status,is_primary,source,expires_at,granted_by,approved_by,reason)
 values(p_user,p_role,p_context_type,case when p_context_type='country' then upper(p_context_id) else p_context_id end,
   case when p_expires_at is null then 'active' else 'temporary' end,false,'manual',p_expires_at,actor,actor,left(coalesce(p_reason,''),500))
 on conflict(user_id,role_key,context_type,context_id) where status in ('active','temporary','under_review','suspended')
 do update set status=excluded.status,is_primary=false,expires_at=excluded.expires_at,
   granted_by=actor,approved_by=actor,reason=excluded.reason,updated_at=now()
 returning id into assignment_id;
 perform private.recalculate_primary_role(p_user);
 insert into public.audit_log(actor_id,action,target_type,target_id,after_data,metadata)
 values(actor,'role.assign_tree','user',p_user::text,
   jsonb_build_object('assignment_id',assignment_id,'role',p_role,'context_type',p_context_type,'context_id',p_context_id,'expires_at',p_expires_at,'parent_user_id',actor),
   jsonb_build_object('actor_rank',actor_rank,'target_rank',target_rank,'branch_isolated',true));
 return assignment_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.owner_set_permission_override(p_public_id bigint, p_permission text, p_allowed boolean, p_context_type text DEFAULT 'global'::text, p_context_id text DEFAULT '*'::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reason text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); target uuid; override_id uuid; target_country text;
 target_public text; is_sensitive boolean; normalized_context_id text;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 select id,upper(coalesce(country_code,'')),public_id::text into target,target_country,target_public
 from public.profiles where public_id=p_public_id;
 if target is null then raise exception 'User not found'; end if;
 if target=actor then raise exception 'Self-approval is not allowed'; end if;
 if p_context_type not in ('global','country','agency','room','user','seller','merchant') then raise exception 'Invalid authority scope'; end if;
 if coalesce(trim(p_context_id),'')='' then raise exception 'Scope ID required'; end if;
 select sensitive into is_sensitive from private.permission_definitions where permission_key=p_permission;
 if is_sensitive is null then raise exception 'Unknown permission'; end if;
 if not private.is_founder(actor) then
   if not private.is_authority_descendant(actor,target) then raise exception 'Target is outside your staff tree'; end if;
   if exists(select 1 from private.role_assignments x join private.role_definitions xd on xd.role_key=x.role_key where x.user_id=target and x.status in ('active','temporary','under_review','suspended') and xd.rank>=private.active_role_rank(actor)) then raise exception 'Target holds an equal or higher protected post';end if;
   if p_permission in ('wallet.adjust','seller.recharge','seller.transfer','withdrawals.approve') then
     raise exception 'Only Root Owner can grant or deny finance mutation power';
   end if;
   if not private.has_permission('permissions.assign',p_context_type,p_context_id,actor) then raise exception 'Permission delegation not allowed in this scope'; end if;
   if p_allowed and not private.has_permission(p_permission,p_context_type,p_context_id,actor) then raise exception 'Cannot delegate a permission you do not hold in this scope'; end if;
 end if;
 if p_context_type='country' and upper(p_context_id)<>target_country then raise exception 'Target user is outside the selected country scope'; end if;
 if p_context_type in ('user','seller','merchant') and p_context_id<>target_public then raise exception 'Selected scope does not match target permanent ID'; end if;
 normalized_context_id:=case when p_context_type='country' then upper(p_context_id) else p_context_id end;
 select id into override_id from private.permission_overrides
 where user_id=target and permission_key=p_permission and context_type=p_context_type
   and context_id=normalized_context_id and status='active' order by created_at desc limit 1;
 if override_id is not null and not private.is_founder(actor) and exists(select 1 from private.permission_overrides po where po.id=override_id and not private.authority_assignment_in_branch_v153(actor,po.user_id,po.granted_by)) then raise exception 'Permission belongs to another authority branch';end if;
 if override_id is null then
   insert into private.permission_overrides(user_id,permission_key,allowed,context_type,context_id,status,expires_at,granted_by,reason)
   values(target,p_permission,p_allowed,p_context_type,normalized_context_id,'active',p_expires_at,actor,left(coalesce(p_reason,''),500))
   returning id into override_id;
 else
   update private.permission_overrides set allowed=p_allowed,status='active',expires_at=p_expires_at,
     granted_by=actor,reason=left(coalesce(p_reason,''),500) where id=override_id;
 end if;
 update private.permission_overrides set status='revoked',reason='Superseded by permission edit'
 where user_id=target and permission_key=p_permission and context_type=p_context_type
   and context_id=normalized_context_id and status='active' and id<>override_id;
 insert into public.audit_log(actor_id,action,target_type,target_id,after_data,metadata)
 values(actor,case when p_allowed then 'permission.override_allow' else 'permission.override_deny' end,'user',target::text,
   jsonb_build_object('permission',p_permission,'allowed',p_allowed,'context_type',p_context_type,'context_id',normalized_context_id,'expires_at',p_expires_at),
   jsonb_build_object('sensitive',is_sensitive,'public_id',p_public_id,'branch_isolated',true));
 return override_id;
end;
$function$
;
