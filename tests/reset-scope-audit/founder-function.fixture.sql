CREATE OR REPLACE FUNCTION private.is_founder(p_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists(
  select 1 from private.role_assignments ra
  where ra.user_id=p_user and ra.role_key='root_founder'
    and ra.status in ('active','temporary') and (ra.starts_at is null or ra.starts_at<=now()) and exists(select 1 from private.role_definitions effective_definition where effective_definition.role_key=ra.role_key and effective_definition.active)
    and (ra.expires_at is null or ra.expires_at>now())
) or exists(
  select 1 from private.admin_roles ar
  where ar.user_id=p_user and ar.role='owner' and ar.protected
); $function$

