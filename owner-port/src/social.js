import { useCallback, useEffect, useRef, useState } from 'react';
import {File} from 'expo-file-system';
import {AppState} from 'react-native';
import { supabase } from '../lib/supabase';
import { indexCanonicalRoomCards, mergeCanonicalRoomCardImage, resolveRoomCardImage } from './roomCardImage';

const profileSelect = 'id,public_id,display_name,avatar_url,is_verified,level,vip_level,frame_code,entry_code,bubble_code,badge_code,medal_code';

export const recordRoomVisit=(roomId)=>supabase.rpc('record_room_visit',{target_room:roomId});
export const heartbeatRoom=(roomId)=>supabase.rpc('heartbeat_room',{p_room:roomId});
export const loadRoomMembershipState=(roomId)=>supabase.rpc('get_room_membership_state',{p_room:roomId});
export const joinRoomMembership=(roomId)=>supabase.rpc('join_room_membership',{p_room:roomId});
export const leaveRoomMembership=(roomId)=>supabase.rpc('leave_room_membership',{p_room:roomId});
export const loadRoomDiscovery=(feed='popular',limit=30)=>supabase.rpc('get_room_discovery_v2',{feed,limit_count:limit});
export const loadLeaderboard=(board='sending',period='daily',limit=50)=>supabase.rpc('get_leaderboard',{board,period,limit_count:limit});
export const loadActiveCosmetics=(userId)=>supabase.rpc('get_active_cosmetics',{target_user:userId});
export const ownerGrantCosmetic=(publicId,code,durationDays=null,reason='')=>supabase.rpc('owner_grant_cosmetic',{target_public_id:Number(publicId),asset_code:code,duration_days:durationDays,reason_text:reason});
export const ownerSetCosmeticGrant=(grantId,state,reason='')=>supabase.rpc('owner_set_cosmetic_grant',{grant_id:grantId,new_state:state,reason_text:reason});

const mapDiscoveredRoom=(r)=>({
 id:r.room_id,publicId:r.public_id,title:r.name,host:r.host_name||'Host',users:Number(r.active_members||0),emoji:'🎙️',
 tag:r.country_code||'Global',countryCode:r.country_code||null,country_code:r.country_code||null,real:true,visibility:r.is_locked?'locked':'public',seatCount:r.seat_count,isLive:Boolean(r.is_live)&&Number(r.active_members||0)>0,ownerId:r.owner_id,
 coverUrl:r.cover_url,avatarUrl:resolveRoomCardImage(r),background_url:r.background_url||null,isLocked:Boolean(r.is_locked),
 giftScore:Number(r.gift_score||0),lastActivityAt:r.last_activity_at,lastVisitedAt:r.last_visited_at,visitCount:Number(r.visit_count||0),
 popularityScore:Number(r.popularity_score||0),roomAudioUrl:r.room_audio_url||null,createdAt:r.created_at||null,roomMode:r.room_mode||'audio',videoUrl:r.video_url||null,
 isPinned:Boolean(r.is_pinned),pinEndsAt:r.pin_ends_at||null,pinPermanent:Boolean(r.pin_permanent),weeklyRank:Number(r.weekly_rank||0),rankFrameCode:r.rank_frame_code||null,rankFrameEndsAt:r.rank_frame_ends_at||null,
});
export function usePublicRooms({enabled=true}={}) {
  const [rooms,setRooms]=useState([]);
  const refreshSequence=useRef(0);
  const mounted=useRef(true);
  const pendingDiscovery=useRef(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;refreshSequence.current+=1;}},[]);
  const performRefresh=useCallback(async()=>{
    const sequence=++refreshSequence.current;
    const all=await loadRoomDiscovery('all',1000);
    if(!mounted.current||sequence!==refreshSequence.current||all.error)return;
    const discovered=all.data||[];
    const roomIds=[...new Set(discovered.map(row=>row.room_id).filter(Boolean))];
    let canonicalById=new Map(),decorationsById=new Map();
    if(roomIds.length){
      const [canonical,decorations]=await Promise.all([supabase.from('rooms').select('id,avatar_url').in('id',roomIds),supabase.rpc('load_room_card_decorations_v1',{p_rooms:roomIds})]);
      if(!mounted.current||sequence!==refreshSequence.current)return;
      if(!canonical.error)canonicalById=indexCanonicalRoomCards(canonical.data||[]);
      if(!decorations.error)decorationsById=new Map((decorations.data||[]).map(x=>[String(x.room_id),x]));
    }
    if(mounted.current&&sequence===refreshSequence.current)setRooms(discovered.map(raw=>({...raw,...(decorationsById.get(String(raw.room_id))||{})})).map(mapDiscoveredRoom).map(room=>mergeCanonicalRoomCardImage(room,canonicalById)));
  },[]);
  const refresh=useCallback(()=>{
    if(pendingDiscovery.current)return pendingDiscovery.current;
    const pending=performRefresh().finally(()=>{if(pendingDiscovery.current===pending)pendingDiscovery.current=null;});
    pendingDiscovery.current=pending;return pending;
  },[performRefresh]);
  useEffect(()=>{
    if(!enabled)return undefined;
    let live=true,eventTimer=null;
    const poll=()=>{if(live&&AppState.currentState==='active')void refresh().catch(()=>{});};
    const onChange=()=>{if(eventTimer||AppState.currentState!=='active')return;eventTimer=setTimeout(()=>{eventTimer=null;poll();},350);};
    poll();
    const channel=supabase.channel('public-rooms').on('postgres_changes',{event:'*',schema:'public',table:'rooms'},onChange).on('postgres_changes',{event:'*',schema:'public',table:'room_video_states'},onChange).subscribe();
    const timer=setInterval(poll,30000),app=AppState.addEventListener('change',state=>{if(state==='active')poll();});
    return()=>{live=false;clearTimeout(eventTimer);clearInterval(timer);app.remove();supabase.removeChannel(channel);};
  },[enabled,refresh]);
  return {rooms,refresh};
}

export function useRealtimeRoom(room, user) {
  const [messages,setMessages]=useState([]);
  const [members,setMembers]=useState([]);

  const refreshMembers=useCallback(async()=>{
    if(!room?.real||!room?.id)return;
    const {data}=await supabase
      .from('room_members')
      .select(`room_id,user_id,role,seat_number,muted,joined_at,last_active_at,profiles!room_members_user_id_fkey(${profileSelect})`)
      .eq('room_id',room.id)
      .is('left_at',null)
      .order('joined_at');
    setMembers((data||[]).map(row=>({
      userId:row.user_id,
      role:row.role,
      seatNumber:row.seat_number,
      muted:row.muted,
      joinedAt:row.joined_at,
      profile:row.profiles || null,
    })));
  },[room?.id,room?.real]);

  const refreshMessages=useCallback(async()=>{
    if(!room?.real||!room?.id||!user?.id)return;
    const {data}=await supabase
      .from('room_messages')
      .select('id,body,created_at,sender_id,profiles!room_messages_sender_id_fkey(display_name,avatar_url,is_verified,public_id,frame_code,bubble_code,badge_code,medal_code,vip_level,level)')
      .eq('room_id',room.id)
      .is('deleted_at',null)
      .order('created_at')
      .limit(100);
    setMessages((data||[]).map(x=>({
      id:String(x.id),
      senderId:x.sender_id,
      name:x.sender_id===user.id?'You':(x.profiles?.display_name||'Member'),
      avatarUrl:x.profiles?.avatar_url||null,
      verified:Boolean(x.profiles?.is_verified),
      publicId:x.profiles?.public_id||null,
      frameCode:x.profiles?.frame_code||null,
      bubbleCode:x.profiles?.bubble_code||null,
      badgeCode:x.profiles?.badge_code||null,
      medalCode:x.profiles?.medal_code||null,
      vipLevel:x.profiles?.vip_level||0,
      level:x.profiles?.level||1,
      text:x.body,
      createdAt:x.created_at,
    })));
  },[room?.id,room?.real,user?.id]);

  useEffect(()=>{
    if(!room?.real||!user?.id)return undefined;
    supabase.rpc('join_room',{p_room:room.id}).then(({error})=>{
      if(!error)refreshMembers();
    });
    refreshMessages();
    refreshMembers();
    const messageChannel=supabase
      .channel('room-messages-'+room.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'room_messages',filter:'room_id=eq.'+room.id},()=>refreshMessages())
      .subscribe();
    const memberChannel=supabase
      .channel('room-members-'+room.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'room_members',filter:'room_id=eq.'+room.id},()=>refreshMembers())
      .subscribe();
    return()=>{
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(memberChannel);
    };
  },[room?.id,room?.real,user?.id,refreshMembers,refreshMessages]);

  const send=useCallback(async body=>{
    if(!room?.real||!user?.id)return false;
    const clean=String(body||'').trim();
    if(!clean)return false;
    const {error}=await supabase.from('room_messages').insert({room_id:room.id,sender_id:user.id,body:clean});
    return !error;
  },[room?.id,room?.real,user?.id]);

  return { messages, members, audienceCount:members.length, refreshMembers, send };
}

export const loadRoomMembers=(roomId)=>supabase
  .from('room_members')
  .select(`room_id,user_id,role,seat_number,muted,joined_at,profiles!room_members_user_id_fkey(${profileSelect})`)
  .eq('room_id',roomId)
  .is('left_at',null)
  .order('joined_at');

export const followUser=(followerId,followedId)=>supabase.from('follows').upsert(
  {follower_id:followerId,followed_id:followedId},
  {onConflict:'follower_id,followed_id',ignoreDuplicates:true},
);
export const unfollowUser=(followerId,followedId)=>supabase.from('follows').delete().eq('follower_id',followerId).eq('followed_id',followedId);
export const updateProfile=(userId,changes)=>supabase.from('profiles').update(changes).eq('id',userId).select().single();
export const loadWallet=userId=>supabase.from('wallets').select('coin_balance,earned_balance').eq('user_id',userId).single();
export const loadGiftCatalog=()=>supabase.from('gift_catalog').select('*').eq('active',true).order('coin_price');
export const sendGift=(receiverId,giftId,roomId,quantity=1)=>supabase.rpc('send_gift',{p_receiver:receiverId,p_gift:giftId,p_room:roomId||null,p_quantity:quantity});
export const loadGiftHistory=(userId,limit=50)=>supabase
  .from('gift_transactions')
  .select('id,gift_id,sender_id,receiver_id,room_id,quantity,total_coins,created_at,gift_catalog(name,slug,effect_kind,asset_key)')
  .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
  .order('created_at',{ascending:false})
  .limit(limit);

export async function loadStaffAccess() {
  const { data, error } = await supabase.rpc('current_staff_access');
  return { data: data || { is_staff:false, role:null, protected:false }, error };
}

export async function loadStaffDashboard(search='',section='Users',page=0) {
 const key=String(section||'Users'),index=Math.max(0,Math.trunc(Number(page)||0)),query=String(search||'');
 const args=key==='Rooms'||key==='Live'?{p_live_only:key==='Live',p_search:query}:key==='Reports'?{p_status:'open'}:key==='Families'||key==='Agencies'?{p_kind:key==='Families'?'family':'agency',p_search:query}:{p_search:query};
 const rpc=key==='Rooms'||key==='Live'?'staff_list_rooms':key==='Reports'?'staff_list_reports':key==='Families'||key==='Agencies'?'staff_list_organizations':'staff_list_users_v2';
 const countsPromise=Promise.resolve(supabase.rpc('staff_dashboard_counts')).catch(error=>({data:null,error}));let list,pagingUnavailable=false;
 try{list=await supabase.rpc(rpc+'_page_v149',{...args,p_limit:51,p_offset:index*50});
  if(index===0&&list.error&&['PGRST202','42883'].includes(list.error.code)){pagingUnavailable=true;list=await supabase.rpc(rpc,{...args,p_limit:50});}
 }catch(error){list={data:[],error};}
 const counts=await countsPromise,raw=Array.isArray(list.data)?list.data:[],rows=raw.slice(0,50);
 return {counts:counts.data||{},users:key==='Users'?rows:[],rooms:key==='Rooms'||key==='Live'?rows:[],reports:key==='Reports'?rows:[],organizations:key==='Families'||key==='Agencies'?rows:[],section:key,search:query,page:index,hasMore:!pagingUnavailable&&raw.length>50,pagingUnavailable,error:counts.error||list.error};
}

export const ownerAssignRole=(userId,role,protectedAccount=false)=>
  supabase.rpc('owner_assign_role',{p_user:userId,p_role:role,p_protected:protectedAccount});

export const ownerSetOfficial=(userId,values)=>
  supabase.rpc('owner_set_official',{
    p_user:userId,
    p_verified:Boolean(values.verified),
    p_title:values.title||null,
    p_badge:values.badge||null,
    p_medal:values.medal||null,
    p_frame:values.frame||null,
    p_country_code:values.countryCode||null,
  });

export const ownerGrantPoints=(userId,points,reason='Owner adjustment')=>
  supabase.rpc('owner_grant_points',{p_user:userId,p_points:Number(points),p_reason:reason});

export const loadAuthorityContexts=()=>supabase.rpc('current_authority_contexts');

export const ownerAssignMultiRole=(userId,role,options={})=>
  supabase.rpc('owner_assign_multi_role',{
    p_user:userId,
    p_role:role,
    p_context_type:options.contextType||'global',
    p_context_id:options.contextId||'*',
    p_expires_at:options.expiresAt||null,
    p_reason:options.reason||'Owner assignment',
    p_primary:Boolean(options.primary),
  });

export const ownerSetRoleState=(assignmentId,status,reason)=>
  supabase.rpc('owner_set_role_state',{p_assignment:assignmentId,p_status:status,p_reason:reason||'Owner action'});

export const ownerAdjustCoinsByPublicId=(publicId,amount,note)=>
  supabase.rpc('owner_adjust_coins_by_public_id',{p_public_id:Number(publicId),p_amount:Number(amount),p_note:note});

export const ownerAdjustSellerBalance=(publicId,amount,note)=>
  supabase.rpc('owner_adjust_seller_balance',{p_public_id:Number(publicId),p_amount:Number(amount),p_note:note});

export const ownerWalletReport=(publicId,limit=50)=>
  supabase.rpc('owner_wallet_report',{p_public_id:Number(publicId),p_limit:limit});

export const searchPeople=async(query)=>{
  const clean=String(query||'').trim();
  let request=supabase.from('profiles').select('id,public_id,display_name,bio,avatar_url,cover_url,cover_gallery,level,vip_level,is_verified,frame_code,entry_code,bubble_code,badge_code,medal_code,country_code,profile_audio_url').eq('status','active').limit(30);
  if(/^\d+$/.test(clean))request=request.eq('public_id',Number(clean));
  else if(clean)request=request.ilike('display_name',`%${clean}%`);
  return request.order('public_id');
};

export const searchRooms=async(query)=>{
  const clean=String(query||'').trim();
  if(!clean)return {data:[],error:null};
  const loaded=await loadRoomDiscovery('all',1000);
  if(loaded.error)return loaded;
  const lowered=clean.toLowerCase();
  const numeric=/^\d+$/.test(clean);
  return {data:(loaded.data||[]).map(mapDiscoveredRoom).filter(room=>numeric?Number(room.publicId)===Number(clean):String(room.title||'').toLowerCase().includes(lowered)).slice(0,30),error:null};
};

export const startDirectConversation=(otherUserId)=>supabase.rpc('start_direct_conversation',{p_other:otherUserId});
export const loadInbox=()=>supabase.rpc('load_my_inbox_v2');
export const loadPendingFriendRequests=()=>supabase.rpc('load_pending_friend_requests_v2');
export const respondFriendRequest=(requestId,accept)=>supabase.rpc('respond_friend_request',{p_request:requestId,p_accept:Boolean(accept)});
export const markConversationRead=(conversationId)=>supabase.rpc('mark_conversation_read',{p_conversation:conversationId});

export const loadDirectMessages=(conversationId)=>supabase
  .from('direct_messages')
  .select('id,sender_id,body,media_path,media_type,media_name,media_size,created_at,delivered_at,read_at,edited_at')
  .eq('conversation_id',conversationId)
  .is('deleted_at',null)
  .order('created_at')
  .limit(100);

export const sendDirectMessage=(conversationId,userId,body,media=null)=>supabase
  .from('direct_messages')
  .insert({
    conversation_id:conversationId,
    sender_id:userId,
    body:String(body||'').trim(),
    media_path:media?.path||null,
    media_type:media?.type||null,
    media_name:media?.name||null,
    media_size:media?.size||null,
  })
  .select('id,sender_id,body,media_path,media_type,media_name,media_size,created_at,delivered_at,read_at')
  .single();

const mediaExtension=(asset)=>{
  const mime=String(asset?.mimeType||'').toLowerCase();
  if(mime.includes('png'))return 'png';
  if(mime.includes('webp'))return 'webp';
  if(mime.includes('quicktime'))return 'mov';
  if(mime.includes('video'))return 'mp4';
  if(mime.includes('mpeg'))return 'mp3';
  if(mime.includes('aac'))return 'aac';
  if(mime.includes('audio'))return 'm4a';
  return 'jpg';
};

export const uploadDirectMedia=async(conversationId,userId,asset)=>{
  if(!conversationId||!userId||!asset?.uri)return {data:null,error:new Error('Media is missing')};
  try{
    const bytes=/^(file|content):/.test(asset.uri)?await new File(asset.uri).arrayBuffer():await(await fetch(asset.uri)).arrayBuffer();
    if(!bytes.byteLength)throw new Error('This attachment is empty. Choose it again.');
    if(bytes.byteLength>50*1024*1024)throw new Error('Attachments must be 50 MB or smaller.');
    const ext=mediaExtension(asset);
    const path=`${conversationId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const {error}=await supabase.storage.from('message-media').upload(path,bytes,{contentType:asset.mimeType||({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp4:'video/mp4',mov:'video/quicktime',m4a:'audio/mp4',mp3:'audio/mpeg',aac:'audio/aac'}[ext]),upsert:false});
    if(error)return {data:null,error};
    return {data:{path,type:asset.type||String(asset.mimeType||'').split('/')[0]||'file',name:asset.fileName||`attachment.${ext}`,size:asset.fileSize||bytes.byteLength},error:null};
  }catch(error){return {data:null,error};}
};

export const resolveDirectMediaUrl=async(mediaPath,expiresIn=600)=>{
  if(!mediaPath)return {data:null,error:null};
  return supabase.storage.from('message-media').createSignedUrl(mediaPath,expiresIn);
};

export const requestFriend=(_requesterId,addresseeId)=>supabase.rpc('request_friend',{p_other:addresseeId});
export const removeFriend=async(a,b)=>supabase.from('friend_requests').delete().or(`and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`);
export const blockUser=(blockerId,blockedId)=>supabase.from('user_blocks').upsert(
  {blocker_id:blockerId,blocked_id:blockedId},
  {onConflict:'blocker_id,blocked_id',ignoreDuplicates:true},
);
export const unblockUser=(blockerId,blockedId)=>supabase.from('user_blocks').delete().eq('blocker_id',blockerId).eq('blocked_id',blockedId);
export const loadBlockedUsers=(userId)=>supabase.from('user_blocks').select('blocked_id,created_at,profiles!user_blocks_blocked_id_fkey(id,public_id,display_name,avatar_url,is_verified,level,vip_level,frame_code,badge_code,medal_code)').eq('blocker_id',userId).order('created_at',{ascending:false});
export const canDirectMessage=(otherUserId)=>supabase.rpc('can_direct_message',{p_other:otherUserId});
export const leaveRealtimeRoom=(roomId)=>supabase.rpc('leave_room',{p_room:roomId});
export const loadOwnerRoleSummary=()=>supabase.rpc('owner_role_summary');
export const loadOwnerRoleMembers=(role)=>supabase.rpc('owner_role_members',{p_role:role});
export const ownerSetUserStatus=(userId,status,reason)=>supabase.rpc('admin_set_user_status',{p_user:userId,p_status:status,p_reason:reason||'Owner moderation'});
export const loadOwnerUserActiveRoles=(userId)=>supabase.rpc('owner_user_active_roles',{p_user:userId});
export const createMyFamily=(name)=>supabase.rpc('create_my_family',{p_name:String(name||'').trim()});
export const loadMyFamily=()=>supabase.rpc('load_my_family');
export const addFamilyMember=(publicId,role='member')=>supabase.rpc('manage_my_family_member',{p_public_id:Number(publicId),p_action:'add',p_role:role});
export const removeFamilyMember=(publicId)=>supabase.rpc('manage_my_family_member',{p_public_id:Number(publicId),p_action:'remove',p_role:'member'});

export const loadMoments=()=>supabase.from('moments').select('id,author_id,body,media_url,media_type,created_at,profiles!moments_author_id_fkey(public_id,display_name,avatar_url,is_verified,level,vip_level,frame_code,badge_code,medal_code),moment_likes(count)').eq('status','active').order('created_at',{ascending:false}).limit(50);
export const createMoment=(userId,body,media=null)=>supabase.from('moments').insert({author_id:userId,body:String(body||'').trim(),media_url:media?.url||null,media_type:media?.type||'text'}).select().single();
export const likeMoment=(momentId,userId)=>supabase.from('moment_likes').upsert(
  {moment_id:momentId,user_id:userId},
  {onConflict:'moment_id,user_id',ignoreDuplicates:true},
);
export const unlikeMoment=(momentId,userId)=>supabase.from('moment_likes').delete().eq('moment_id',momentId).eq('user_id',userId);
export const loadMomentComments=(momentId)=>supabase.from('moment_comments').select('id,author_id,parent_comment_id,body,created_at,profiles!moment_comments_author_id_fkey(public_id,display_name,avatar_url,is_verified,level,vip_level,frame_code,badge_code,medal_code)').eq('moment_id',momentId).eq('status','active').order('created_at').limit(250);
export const addMomentComment=(momentId,userId,body,parentCommentId=null)=>supabase.from('moment_comments').insert({moment_id:momentId,author_id:userId,parent_comment_id:parentCommentId||null,body:String(body).trim()}).select().single();

export const trackProfileVisit=(userId)=>supabase.rpc('track_profile_visit',{p_visited:userId});
export const loadMyVisitors=(days=10)=>supabase.rpc('load_my_visitors',{p_days:days});

export const loadPublicProfile=async(userId,currentUserId)=>{
  if(currentUserId&&currentUserId!==userId)supabase.rpc('track_profile_visit',{p_visited:userId}).then(()=>{});
  const [profile,followers,following,friends,room,blocked,presence,cosmetics,premiumStatus,levels,posts]=await Promise.all([
    supabase.from('profiles').select('id,public_id,display_name,bio,avatar_url,cover_url,cover_gallery,level,vip_level,is_verified,official_title,official_badge,country_code,profile_audio_url,gender,date_of_birth,birthday_banner_url,frame_code,entry_code,bubble_code,badge_code,medal_code,points,created_at').eq('id',userId).single(),
    supabase.from('follows').select('*',{count:'exact',head:true}).eq('followed_id',userId),
    supabase.from('follows').select('*',{count:'exact',head:true}).eq('follower_id',userId),
    supabase.from('friend_requests').select('*',{count:'exact',head:true}).or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).eq('status','accepted'),
    supabase.from('rooms').select('id,public_id,name,cover_url,avatar_url,background_url,room_audio_url,is_live,visibility,country_code').eq('owner_id',userId).limit(1).maybeSingle(),
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id',currentUserId).eq('blocked_id',userId).maybeSingle(),
    supabase.rpc('get_public_presence',{p_target:userId}),
    supabase.rpc('get_active_cosmetics',{target_user:userId}),
    supabase.rpc('load_profile_premium_status',{p_target:userId}),
    supabase.rpc('load_public_profile_levels',{p_target:userId}),
    supabase.rpc('load_public_profile_posts_v1',{p_target:userId}),
  ]);
  return {data:profile.data?{...profile.data,...(presence.data||{}),public_posts:posts.error?[]:posts.data||[],profile_levels:levels.error?null:levels.data,profile_levels_state:levels.error?'unavailable':'ready',premium_status:premiumStatus.error?null:premiumStatus.data||null,premium_status_state:premiumStatus.error?'unavailable':'ready',cosmetics:cosmetics.data||[],followers:followers.count||0,following:following.count||0,friends:friends.count||0,room:room.data,blocked:Boolean(blocked.data)}:null,error:profile.error||presence.error||cosmetics.error};
};

export const saveConversationPreference=(conversationId,userId,changes)=>supabase.from('conversation_preferences').upsert({conversation_id:conversationId,user_id:userId,...changes,updated_at:new Date().toISOString()});
export const loadConversationPreferences=(userId)=>supabase.from('conversation_preferences').select('*').eq('user_id',userId);
export const ownerCreateAccessBan=(values)=>supabase.rpc('owner_create_access_ban',{p_target_type:values.targetType,p_target_value:String(values.targetValue),p_duration_hours:values.durationHours||null,p_reason:values.reason||'Owner moderation'});
export const loadNotifications=(userId)=>supabase.from('user_notifications').select('*').eq('user_id',userId).is('dismissed_at',null).order('created_at',{ascending:false}).limit(100);
export const loadSystemNotices=(roomId=null)=>supabase.rpc('load_notice_feed_v85',{p_room:roomId||null});
export const createSupportTicket=(userId,subject,message)=>supabase.from('support_tickets').insert({user_id:userId,subject:String(subject).trim(),message:String(message).trim()}).select().single();

export const updateMyCountry=(countryCode)=>supabase.rpc('update_my_country',{p_country_code:String(countryCode||'').toUpperCase()});
export const claimReferral=(inviter)=>supabase.rpc('claim_referral',{p_inviter:String(inviter||'').trim()});

export const heartbeatMyPresence=async(online=true)=>{
  const result=await supabase.rpc('heartbeat_my_presence',{p_online:Boolean(online)});
  if(result.data?.became_online) supabase.functions.invoke('dispatch-push',{body:{mode:'presence'}}).catch(()=>{});
  return result;
};
export const publishOfficialNotice=({title,body,countryCode=null,expiresAt=null})=>supabase.functions.invoke('dispatch-push',{body:{mode:'official_notice',title,body,countryCode,expiresAt}});
export const loadMyPresencePrivacy=()=>supabase.rpc('get_my_presence_privacy');
export const saveMyPresencePrivacy=(values)=>supabase.rpc('set_my_presence_privacy',{p_show_online:Boolean(values.showOnline),p_show_last_seen:Boolean(values.showLastSeen),p_allow_online_alerts:Boolean(values.allowOnlineAlerts)});
export const setPresenceAlert=(targetId,active)=>supabase.rpc('set_presence_alert',{p_target:targetId,p_active:Boolean(active)});

