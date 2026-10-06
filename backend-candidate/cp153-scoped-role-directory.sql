-- Candidate only: scoped role directory for application and existing Owner panel.
CREATE OR REPLACE FUNCTION public.owner_role_summary()
RETURNS TABLE(role_key text,display_name text,member_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
 select rd.role_key,rd.display_name,count(ra.id)
 from private.role_definitions rd
 left join private.role_assignments ra on ra.role_key=rd.role_key
  and ra.status in ('active','temporary') and (ra.starts_at is null or ra.starts_at<=now())
  and (ra.expires_at is null or ra.expires_at>now())
  and private.authority_assignment_in_branch_v153(auth.uid(),ra.user_id,ra.granted_by)
  and (private.is_founder(auth.uid()) or
   (private.is_authority_descendant(auth.uid(),ra.user_id) and private.can_view_user(ra.user_id,auth.uid())
    and (ra.user_id=auth.uid() or rd.rank<private.active_role_rank(auth.uid()))))
 where auth.uid() is not null and (private.is_founder(auth.uid()) or private.active_role_rank(auth.uid())>0)
  and (private.is_founder(auth.uid()) or rd.rank<=private.active_role_rank(auth.uid()))
 group by rd.role_key,rd.display_name,rd.rank order by rd.rank desc;
$function$;
CREATE OR REPLACE FUNCTION public.owner_role_members(p_role text)
RETURNS TABLE(assignment_id uuid,user_id uuid,public_id bigint,display_name text,role_key text,context_type text,context_id text,status text,expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
 select ra.id,p.id,p.public_id,p.display_name,ra.role_key,ra.context_type,ra.context_id,ra.status,ra.expires_at
 from private.role_assignments ra join public.profiles p on p.id=ra.user_id
 join private.role_definitions rd on rd.role_key=ra.role_key
 where auth.uid() is not null and ra.role_key=p_role and private.authority_assignment_in_branch_v153(auth.uid(),ra.user_id,ra.granted_by) and
 (private.is_founder(auth.uid()) or
  (private.active_role_rank(auth.uid())>0 and ra.status in ('active','temporary','suspended','under_review')
   and private.is_authority_descendant(auth.uid(),ra.user_id) and private.can_view_user(ra.user_id,auth.uid())
   and (ra.user_id=auth.uid() or rd.rank<private.active_role_rank(auth.uid()))))
 order by p.public_id;
$function$;
REVOKE ALL ON FUNCTION public.owner_role_summary() FROM anon;
REVOKE ALL ON FUNCTION public.owner_role_members(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.owner_role_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_role_members(text) TO authenticated;
