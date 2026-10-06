+CREATE OR REPLACE FUNCTION private.enforce_id_protection_v152()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid();target uuid;begin
 -- Preserve self actions, Founder management and trusted offline/security cleanup.
 if actor is null or private.is_founder(actor) then if tg_op='DELETE' then return old;end if;return new;end if;
 if tg_table_name='profiles' then target:=old.id;else target:=old.user_id;end if;
 if actor=target then if tg_op='DELETE' then return old;end if;return new;end if;
 if tg_table_name='profiles' then
  if tg_op='DELETE' and private.has_id_protection_v152(target,'account') then raise exception 'This ID has account protection';end if;
  if tg_op='UPDATE' then
   if new.status is distinct from old.status and private.has_id_protection_v152(target,'account') then raise exception 'This ID has account protection';end if;
   if (new.display_name is distinct from old.display_name or new.bio is distinct from old.bio or new.avatar_url is distinct from old.avatar_url or new.cover_url is distinct from old.cover_url or new.country_code is distinct from old.country_code or new.profile_audio_url is distinct from old.profile_audio_url) and private.has_id_protection_v152(target,'profile') then raise exception 'This ID has profile protection';end if;
  end if;
 elsif tg_table_name='room_members' then
  if tg_op='DELETE' and private.has_id_protection_v152(target,'room_kick') then raise exception 'This ID has room protection';end if;
  if tg_op='UPDATE' then
   if new.left_at is distinct from old.left_at and new.left_at is not null and private.has_id_protection_v152(target,'room_kick') then raise exception 'This ID has room protection';end if;
   if new.muted and not old.muted and private.has_id_protection_v152(target,'room_mute') then raise exception 'This ID has mic protection';end if;
   if old.seat_number is not null and new.seat_number is distinct from old.seat_number and private.has_id_protection_v152(target,'seat_drop') then raise exception 'This ID has seat protection';end if;
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $function$
;
