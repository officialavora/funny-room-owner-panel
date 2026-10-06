import { AppState } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const CACHE_KEY='funnyroom.runtime.flags.v2';
const CACHE_TTL=5*60*1000;
const CORE_KEYS=['global_maintenance','server_runtime','voice_provider_ready','payments_live','demo_economy','room_rocket','gifts','lucky_gifts','lucky_pocket','premium_cosmetics','emotion_social','reels','audio_rooms','audio_pk','video_live','private_video_calls','video_pk'];

const rowsToMap=rows=>Object.fromEntries((rows||[]).map(row=>[row.key,{enabled:Boolean(row.enabled),config:row.config||{},updatedAt:row.updated_at||null}]));

async function readCache(){
  try{const raw=await AsyncStorage.getItem(CACHE_KEY);if(!raw)return null;const parsed=JSON.parse(raw);return parsed&&parsed.flags?parsed:null;}catch{return null;}
}

async function writeCache(flags){
  try{await AsyncStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),flags}));}catch{}
}

export async function loadRuntimeFlags({force=false}={}){
  const cache=await readCache();
  if(!force&&cache&&Date.now()-Number(cache.savedAt||0)<CACHE_TTL)return {flags:cache.flags,source:'cache',error:null};
  const {data,error}=await supabase.from('feature_flags').select('key,enabled,config,updated_at').in('key',CORE_KEYS);
  if(error)return {flags:cache?.flags||{},source:cache?'stale-cache':'none',error};
  const flags=rowsToMap(data);
  await writeCache(flags);
  return {flags,source:'network',error:null};
}

export const isEnabled=(flags,key,fallback=false)=>flags?.[key]?.enabled??fallback;
export const flagConfig=(flags,key)=>flags?.[key]?.config||{};

export function useRuntimeFlags({refreshMs=CACHE_TTL}={}){
  const [flags,setFlags]=useState({});
  const [ready,setReady]=useState(false);
  const [source,setSource]=useState('none');
  const [error,setError]=useState(null);
  const refresh=useCallback(async(force=false)=>{const result=await loadRuntimeFlags({force});setFlags(result.flags||{});setSource(result.source);setError(result.error||null);setReady(true);return result;},[]);
  useEffect(()=>{let alive=true;let timer=null;const run=async(force=false)=>{if(!alive)return;await refresh(force);if(!alive)return;clearTimeout(timer);timer=setTimeout(()=>{if(AppState.currentState==='active')run(true);},Math.max(120000,refreshMs));};run(false);const sub=AppState.addEventListener('change',state=>{if(state==='active')run(true);else clearTimeout(timer);});return()=>{alive=false;clearTimeout(timer);sub.remove();};},[refresh,refreshMs]);
  return useMemo(()=>({flags,ready,source,error,refresh,isEnabled:(key,fallback=false)=>isEnabled(flags,key,fallback),config:key=>flagConfig(flags,key)}),[flags,ready,source,error,refresh]);
}

export async function ownerSetRuntimeFlag(key,enabled,config={},notify=false){
  const {data,error}=await supabase.rpc('owner_set_runtime_flag',{p_key:key,p_enabled:Boolean(enabled),p_config:config||{},p_notify:Boolean(notify)});
  if(!error)await loadRuntimeFlags({force:true});
  return {data,error};
}


