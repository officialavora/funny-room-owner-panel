import {useCallback,useEffect,useMemo,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '../lib/supabase';
import {motionBudget} from './designSystem';

const LOCAL_KEY='funnyroom.settings';
const defaults={notifications:true,messageSounds:true,animations:true,dataSaver:false,profileAudio:true,reduceMotion:false,entrySounds:true,giftSounds:true,emojiSounds:true,globalBanners:true};
let memory={...defaults};
let activeRoomOverride=null;
let loaded=false,localLoad=null,serverLoad=null,lastServerLoad=0,preferenceRevision=0;
const listeners=new Set();
const playbackListeners=new Set();
const playbackSnapshot=()=>{
  const room=activeRoomOverride||{};
  return {
    ...memory,
    animations:Boolean(memory.animations)&&room.animations!==false,
    entrySounds:Boolean(memory.entrySounds)&&room.entrySounds!==false,
    giftSounds:Boolean(memory.giftSounds)&&room.giftSounds!==false,
    emojiSounds:Boolean(memory.emojiSounds)&&room.emojiSounds!==false,
  };
};
const emit=()=>{listeners.forEach(fn=>fn({...memory}));playbackListeners.forEach(fn=>fn(playbackSnapshot()));};
const emitPlayback=()=>playbackListeners.forEach(fn=>fn(playbackSnapshot()));

export function setActiveRoomEffectPreferences(next=null){
  activeRoomOverride=next?{
    animations:next.cinematic_effects!==false,
    entrySounds:next.entry_sounds!==false,
    giftSounds:next.gift_sounds!==false,
    emojiSounds:next.emoji_sounds!==false,
  }:null;
  emitPlayback();
}

export async function loadEffectPreferences({syncServer=true,force=false}={}){
 if(!loaded){
  if(!localLoad)localLoad=(async()=>{try{const raw=await AsyncStorage.getItem(LOCAL_KEY);if(raw&&!loaded)memory={...memory,...JSON.parse(raw)};}catch{}finally{loaded=true;localLoad=null;}})();
  await localLoad;
 }
 if(syncServer&&(force||Date.now()-lastServerLoad>=60000)){
  if(!serverLoad){const revision=preferenceRevision;serverLoad=(async()=>{
   try{const {data,error}=await supabase.rpc('load_my_effect_preferences');
    if(!error&&data&&revision===preferenceRevision){memory={...memory,animations:data.cinematicEffects!==false,reduceMotion:Boolean(data.reduceMotion),entrySounds:data.entrySounds!==false,giftSounds:data.giftSounds!==false,emojiSounds:data.emojiSounds!==false};await AsyncStorage.setItem(LOCAL_KEY,JSON.stringify(memory));}
   }catch{}finally{lastServerLoad=Date.now();serverLoad=null;emit();}
  })();}
  await serverLoad;
 }
 return {...memory};
}

export async function saveEffectPreferences(next,{syncServer=true}={}){
  preferenceRevision++;memory={...memory,...next};loaded=true;lastServerLoad=Date.now();
  try{await AsyncStorage.setItem(LOCAL_KEY,JSON.stringify(memory))}catch{}
  if(syncServer){
    try{await supabase.rpc('save_my_effect_preferences',{cinematic:Boolean(memory.animations),entry_sound:Boolean(memory.entrySounds),gift_sound:Boolean(memory.giftSounds),emoji_sound:Boolean(memory.emojiSounds),reduce:Boolean(memory.reduceMotion)});}catch{}
  }
  emit();return {...memory};
}

export function useEffectPreferences(){
  const [prefs,setPrefs]=useState({...memory});
  useEffect(()=>{let live=true;const fn=next=>live&&setPrefs(next);listeners.add(fn);loadEffectPreferences().then(next=>live&&setPrefs(next));return()=>{live=false;listeners.delete(fn)}},[]);
  const update=useCallback(async patch=>saveEffectPreferences(patch),[]);
  const budget=useMemo(()=>motionBudget({dataSaver:Boolean(prefs.dataSaver),reduceMotion:Boolean(prefs.reduceMotion||!prefs.animations),lowPower:false}),[prefs.dataSaver,prefs.reduceMotion,prefs.animations]);
  return {prefs,update,budget};
}

export function usePlaybackEffectPreferences(){
  const [prefs,setPrefs]=useState(playbackSnapshot());
  useEffect(()=>{
    let live=true;
    const fn=next=>live&&setPrefs(next);
    playbackListeners.add(fn);
    loadEffectPreferences().then(()=>live&&setPrefs(playbackSnapshot()));
    return()=>{live=false;playbackListeners.delete(fn)};
  },[]);
  const budget=useMemo(()=>motionBudget({dataSaver:Boolean(prefs.dataSaver),reduceMotion:Boolean(prefs.reduceMotion||!prefs.animations),lowPower:false}),[prefs.dataSaver,prefs.reduceMotion,prefs.animations]);
  return {prefs,budget};
}

export const currentEffectPreferences=()=>({...memory});
export const currentPlaybackPreferences=()=>playbackSnapshot();
export function subscribePlaybackEffectPreferences(fn){playbackListeners.add(fn);return()=>playbackListeners.delete(fn);}

