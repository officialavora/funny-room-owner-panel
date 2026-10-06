CREATE OR REPLACE FUNCTION private.active_role_rank(p_user uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select greatest(
    coalesce((select max(rd.rank)::int
      from private.role_assignments ra
      join private.role_definitions rd on rd.role_key=ra.role_key
      where ra.user_id=p_user
        and ra.status in ('active','temporary') and (ra.starts_at is null or ra.starts_at<=now()) and exists(select 1 from private.role_definitions effective_definition where effective_definition.role_key=ra.role_key and effective_definition.active)
        and (ra.expires_at is null or ra.expires_at>now())),0),
    coalesce((select max(case ar.role
      when 'owner' then 100 when 'super_admin' then 60 when 'admin' then 50
      when 'moderator' then 25 when 'support' then 25 else 0 end)
      from private.admin_roles ar where ar.user_id=p_user
        and not exists(select 1 from private.role_assignments managed join private.role_definitions def on def.role_key=managed.role_key where managed.user_id=p_user and def.rank>=20)),0)
  );
$function$;


CREATE OR REPLACE FUNCTION private.is_authority_descendant(p_actor uuid, p_target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with recursive lineage(user_id, granted_by) as (
    select ra.user_id, ra.granted_by
    from private.role_assignments ra
    where ra.user_id = p_target
      and ra.status in ('active','temporary','suspended','under_review')
      and exists(select 1 from private.role_definitions effective_definition where effective_definition.role_key=ra.role_key and effective_definition.active)
    union
    select ra.user_id, ra.granted_by
    from private.role_assignments ra
    join lineage l on l.granted_by = ra.user_id
    where ra.status in ('active','temporary','suspended','under_review')
      and exists(select 1 from private.role_definitions effective_definition where effective_definition.role_key=ra.role_key and effective_definition.active)
  )
  select p_actor is not null and p_target is not null and (
    p_actor = p_target
    or private.is_founder(p_actor)
    or (private.active_role_rank(p_actor)>0 and exists(select 1 from lineage where granted_by = p_actor))
  );
$function$;


CREATE OR REPLACE FUNCTION private.has_permission_for_user(p_permission text, p_target uuid, p_actor uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target_country text; target_public text; agency_owner_public text; agency_scope text; agency_scopes text[];
begin
  if p_actor is null or p_target is null then return false; end if;
  if private.is_founder(p_actor) then return true; end if;
  -- Business seller/merchant transfers are not administrative access. Keep their existing policy.
  if p_permission not in ('seller.recharge','seller.transfer') then
    if p_actor<>p_target and private.active_role_rank(p_actor)<=private.active_role_rank(p_target) then return false; end if;
    if p_actor<>p_target and private.active_role_rank(p_target)>=20
      and not private.is_authority_descendant(p_actor,p_target) then return false; end if;
  end if;
  select upper(coalesce(country_code,'')),public_id::text into target_country,target_public from public.profiles where id=p_target;
  if target_public is null then return false; end if;

  if private.has_permission_denial(p_permission,'user',target_public,p_actor) then return false; end if;
  if target_country<>'' and private.has_permission_denial(p_permission,'country',target_country,p_actor) then return false; end if;


  -- Specific denials apply before broader grants, including both agency identifiers.
  if private.has_permission_denial(p_permission,'seller',target_public,p_actor)
    or private.has_permission_denial(p_permission,'merchant',target_public,p_actor) then return false; end if;
  select coalesce(array_agg(distinct scope_id),'{}'::text[]) into agency_scopes from (
    select o.id::text scope_id from public.organization_members om
      join public.organizations o on o.id=om.organization_id and o.kind='agency' and o.status='active'
      where om.user_id=p_target
    union
    select owner_profile.public_id::text from public.organization_members om
      join public.organizations o on o.id=om.organization_id and o.kind='agency' and o.status='active'
      join public.profiles owner_profile on owner_profile.id=o.owner_id where om.user_id=p_target
    union
    select ra.context_id from private.role_assignments ra
      where ra.user_id=p_target and ra.context_type='agency'
        and ra.status in ('active','temporary','suspended','under_review')
        and private.is_authority_descendant(p_actor,p_target)
  ) effective_agencies;
  foreach agency_scope in array agency_scopes loop
    if private.has_permission_denial(p_permission,'agency',agency_scope,p_actor) then return false; end if;
  end loop;
  if private.has_permission(p_permission,'global','*',p_actor) then return true; end if;
  if target_country<>'' and private.has_permission(p_permission,'country',target_country,p_actor) then return true; end if;
  if private.has_permission(p_permission,'user',target_public,p_actor) then return true; end if;
  if private.has_permission(p_permission,'seller',target_public,p_actor) then return true; end if;
  if private.has_permission(p_permission,'merchant',target_public,p_actor) then return true; end if;

  foreach agency_scope in array agency_scopes loop
    if private.has_permission(p_permission,'agency',agency_scope,p_actor) then return true; end if;
  end loop;
  return false;
end
$function$;


CREATE OR REPLACE FUNCTION private.can_view_user(p_target uuid, p_actor uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor_rank integer:=private.active_role_rank(p_actor); target_rank integer:=private.active_role_rank(p_target);
begin
  if p_actor is null or p_target is null then return false; end if;
  if private.is_founder(p_actor) or p_target=p_actor then return true; end if;
  if actor_rank<=target_rank then return false; end if;
  -- Staff branches remain isolated even for legacy admin compatibility records.
  if target_rank>=20 and not private.is_authority_descendant(p_actor,p_target) then return false; end if;
  return private.has_permission_for_user('users.view',p_target,p_actor);
end$function$;


CREATE OR REPLACE FUNCTION public.panel_staff_tree()
 RETURNS TABLE(assignment_id uuid, user_id uuid, public_id bigint, display_name text, role_key text, role_name text, rank integer, context_type text, context_id text, status text, parent_user_id uuid, parent_public_id bigint, parent_display_name text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select ra.id,p.id,p.public_id,p.display_name,ra.role_key,rd.display_name,rd.rank,
         ra.context_type,ra.context_id,ra.status,
         case when ra.user_id=auth.uid() and not private.is_founder(auth.uid()) then null else ra.granted_by end,
         case when ra.user_id=auth.uid() and not private.is_founder(auth.uid()) then null else parent.public_id end,
         case when ra.user_id=auth.uid() and not private.is_founder(auth.uid()) then null else parent.display_name end,ra.created_at
  from private.role_assignments ra
  join private.role_definitions rd on rd.role_key=ra.role_key
  join public.profiles p on p.id=ra.user_id
  left join public.profiles parent on parent.id=ra.granted_by
  where auth.uid() is not null
    and ra.status in ('active','temporary','suspended','under_review')
    and (private.is_founder(auth.uid()) or (private.is_authority_descendant(auth.uid(),ra.user_id) and private.can_view_user(ra.user_id,auth.uid()) and (ra.user_id=auth.uid() or rd.rank<private.active_role_rank(auth.uid()))))
  order by rd.rank desc,ra.created_at,p.public_id;
$function$;


REVOKE ALL ON FUNCTION public.panel_staff_tree() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.panel_staff_tree() TO authenticated;
REVOKE ALL ON FUNCTION private.is_authority_descendant(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.owner_set_role_state(p_assignment uuid, p_status text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); target uuid; role_name text; scope_type text; scope_id text; assigned_rank integer; actor_rank integer; actor_ceiling integer;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if p_status not in ('active','suspended','under_review','revoked') then raise exception 'Invalid status'; end if;
 select user_id,role_key,context_type,context_id into target,role_name,scope_type,scope_id
 from private.role_assignments where id=p_assignment for update;
 if target is null then raise exception 'Assignment not found'; end if;
 if role_name='root_founder' then raise exception 'Founder role is protected'; end if;
 if target=actor then raise exception 'Self role change is not allowed'; end if;
 if not private.is_founder(actor) then
   select rank into assigned_rank from private.role_definitions where role_key=role_name;
   actor_rank:=private.active_role_rank(actor);
   if assigned_rank>=actor_rank or actor_rank<=0 then raise exception 'You can manage only posts below your own';end if;
   if p_status='active' then
    select coalesce(max(rd.delegation_ceiling),0) into actor_ceiling from private.role_assignments ra join private.role_definitions rd on rd.role_key=ra.role_key where ra.user_id=actor and ra.status in ('active','temporary') and (ra.starts_at is null or ra.starts_at<=now()) and (ra.expires_at is null or ra.expires_at>now()) and rd.active;
    if assigned_rank>actor_ceiling then raise exception 'Role restoration exceeds delegation ceiling';end if;
   end if;
   if not private.is_authority_descendant(actor,target) then raise exception 'Target is outside your staff tree'; end if;
   if not private.has_permission('roles.remove',scope_type,scope_id,actor) then raise exception 'Role removal permission required for this scope'; end if;
 end if;
 update private.role_assignments set status=p_status,is_primary=false,
   suspended_at=case when p_status='suspended' then now() else suspended_at end,
   revoked_at=case when p_status='revoked' then now() else revoked_at end,
   reason=left(coalesce(p_reason,''),500),updated_at=now()
 where id=p_assignment;
 perform private.recalculate_primary_role(target);
 insert into public.audit_log(actor_id,action,target_type,target_id,after_data)
 values(actor,'role.state','role_assignment',p_assignment::text,
   jsonb_build_object('status',p_status,'reason',p_reason,'context_type',scope_type,'context_id',scope_id));
end;
$function$
;


CREATE OR REPLACE FUNCTION public.owner_authority_dashboard(p_public_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); target uuid; result jsonb; actor_rank int; actor_ceiling int;
begin
  select id into target from public.profiles where public_id=p_public_id;
  if target is null then raise exception 'User not found'; end if;
  if actor is null or (not private.is_founder(actor) and not private.has_permission_for_user('users.view',target,actor)) then raise exception 'User view permission required'; end if;
  actor_rank:=case when private.is_founder(actor) then 100 else private.active_role_rank(actor) end;
  select coalesce(max(rd.delegation_ceiling),0) into actor_ceiling from private.role_assignments ra join private.role_definitions rd on rd.role_key=ra.role_key where ra.user_id=actor and ra.status in ('active','temporary') and (ra.expires_at is null or ra.expires_at>now());
  if private.is_founder(actor) then actor_ceiling:=99; end if;
  select jsonb_build_object(
    'profile',(select jsonb_build_object('id',p.id,'public_id',p.public_id,'display_name',p.display_name,'avatar_url',p.avatar_url,'country_code',p.country_code,'status',p.status,'level',p.level,'vip_level',p.vip_level) from public.profiles p where p.id=target),
    'actor_rank',actor_rank,'delegation_ceiling',actor_ceiling,
    'roles',coalesce((select jsonb_agg(jsonb_build_object('assignment_id',ra.id,'role_key',ra.role_key,'title',rd.display_name,'rank',rd.rank,'context_type',ra.context_type,'context_id',ra.context_id,'status',ra.status,'expires_at',ra.expires_at) order by rd.rank desc,ra.created_at desc) from private.role_assignments ra join private.role_definitions rd on rd.role_key=ra.role_key where ra.user_id=target and ra.status in ('active','temporary','under_review','suspended') and (private.is_founder(actor) or target=actor or rd.rank<actor_rank)),'[]'::jsonb),
    'role_permissions',coalesce((select jsonb_agg(jsonb_build_object('role_key',ra.role_key,'permission_key',rp.permission_key,'context_type',ra.context_type,'context_id',ra.context_id,'expires_at',ra.expires_at) order by ra.created_at desc,rp.permission_key) from private.role_assignments ra join private.role_permissions rp on rp.role_key=ra.role_key join private.role_definitions scope_definition on scope_definition.role_key=ra.role_key where ra.user_id=target and (private.is_founder(actor) or target=actor or scope_definition.rank<actor_rank) and ra.status in ('active','temporary') and (ra.expires_at is null or ra.expires_at>now())),'[]'::jsonb),
    'permission_overrides',coalesce((select jsonb_agg(jsonb_build_object('id',po.id,'permission_key',po.permission_key,'allowed',po.allowed,'context_type',po.context_type,'context_id',po.context_id,'status',po.status,'expires_at',po.expires_at,'reason',po.reason) order by po.created_at desc) from private.permission_overrides po where po.user_id=target and po.status='active' and (po.expires_at is null or po.expires_at>now())),'[]'::jsonb),
    'available_permissions',coalesce((select jsonb_agg(jsonb_build_object('permission_key',pd.permission_key,'description',pd.description,'sensitive',pd.sensitive) order by pd.permission_key) from private.permission_definitions pd),'[]'::jsonb),
    'available_roles',coalesce((select jsonb_agg(jsonb_build_object('role_key',rd.role_key,'display_name',rd.display_name,'rank',rd.rank,'sensitive',rd.is_sensitive) order by rd.rank desc) from private.role_definitions rd where rd.active and rd.role_key<>'root_founder' and rd.rank<actor_rank and rd.rank<=actor_ceiling),'[]'::jsonb)
  ) into result;
  return result;
end
$function$
;

REVOKE ALL ON FUNCTION public.owner_set_role_state(uuid,text,text),public.owner_authority_dashboard(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_set_role_state(uuid,text,text),public.owner_authority_dashboard(bigint) TO authenticated;
