import {currentPlaybackPreferences,subscribePlaybackEffectPreferences} from './effectPreferences';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,AppState} from 'react-native';
// A shared subscription avoids one OS listener for every visible/history emoji.
let motionAllowed=false,reduceMotion=true,appActive=AppState.currentState==='active',generation=0;
let nativeSubscriptions=[],preferenceUnsubscribe=null;
const listeners=new Set();
const publish=()=>{const p=currentPlaybackPreferences();const next=appActive&&!reduceMotion&&p.animations!==false&&!p.reduceMotion&&!p.dataSaver;if(next!==motionAllowed){motionAllowed=next;listeners.forEach(fn=>fn());}};
function subscribe(listener){
  listeners.add(listener);
  if(listeners.size===1){
    const epoch=++generation;
    preferenceUnsubscribe=subscribePlaybackEffectPreferences(publish);
    appActive=AppState.currentState==='active';
    nativeSubscriptions=[
      AppState.addEventListener('change',state=>{appActive=state==='active';publish();}),
      AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{reduceMotion=value;publish();}),
    ];
    AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(epoch===generation){reduceMotion=value;publish();}}).catch(()=>{});
    publish();
  }
  return()=>{listeners.delete(listener);if(!listeners.size){generation++;nativeSubscriptions.forEach(sub=>sub.remove());nativeSubscriptions=[];preferenceUnsubscribe?.();preferenceUnsubscribe=null;}};
}
const snapshot=()=>motionAllowed;
export function useCatalogMotion(){return useSyncExternalStore(subscribe,snapshot,()=>false);}
// Bound simultaneous native GIF decoders in busy 30/50-seat rooms.
export const MAX_ANIMATED_REACTIONS=6;
export function selectMotionSlots(entries){return entries.sort((a,b)=>b.priority-a.priority||b.id-a.id).slice(0,MAX_ANIMATED_REACTIONS).map(entry=>entry.id);}
const motionSlots=new Map();let nextSlot=0;
const refreshSlots=()=>{const granted=new Set(selectMotionSlots([...motionSlots.values()]));motionSlots.forEach(slot=>slot.setGranted(granted.has(slot.id)));};
export function useCatalogMotionSlot(wanted,priority){
  const [granted,setGranted]=useState(false);
  useEffect(()=>{
    if(!wanted){setGranted(false);return undefined;}
    const id=++nextSlot;motionSlots.set(id,{id,priority,setGranted});refreshSlots();
    return()=>{motionSlots.delete(id);refreshSlots();};
  },[wanted,priority]);
  return wanted&&granted;
}

