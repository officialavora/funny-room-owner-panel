const cleanUri=value=>{
  if(typeof value!=='string')return null;
  const uri=value.trim();
  return uri||null;
};

export const canonicalRoomId=room=>String(room?.room_id??room?.id??'').trim()||null;

// rooms.avatar_url is the product-owned room-card DP. A cover/background or
// owner profile avatar is intentionally not promoted into this slot.
export const resolveRoomCardImage=room=>cleanUri(room?.avatar_url??room?.avatarUrl);

export const indexCanonicalRoomCards=rows=>new Map((rows||[]).map(row=>[
  canonicalRoomId(row),
  {avatar_url:resolveRoomCardImage(row)},
]).filter(([roomId])=>Boolean(roomId)));

export const mergeCanonicalRoomCardImage=(room,canonicalById)=>{
  const roomId=canonicalRoomId(room);
  const canonical=roomId?canonicalById?.get(roomId):null;
  if(!canonical)return room;
  const avatarUrl=resolveRoomCardImage(canonical);
  return {...room,avatar_url:avatarUrl,avatarUrl};
};

export function CanonicalRoomCardImage({room,style,fallback=null}){
  const roomId=canonicalRoomId(room);
  const uri=resolveRoomCardImage(room);
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[roomId,uri]);
  return <>{uri&&!failed?<Image key={`${roomId}:${uri}`} source={{uri}} style={[StyleSheet.absoluteFill,style]} onError={()=>setFailed(true)}/>:fallback}</>;
}
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';

