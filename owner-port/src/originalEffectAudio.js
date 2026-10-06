import {AppState} from 'react-native';
import {createAudioPlayer,setAudioModeAsync} from 'expo-audio';
import {currentPlaybackPreferences,subscribePlaybackEffectPreferences} from './effectPreferences';
import {ORIGINAL_AUDIO,ORIGINAL_AUDIO_DURATION} from './originalAudioAssets';
const active=new Map();
export function startOriginalEffectAudio(key,{category='emoji',url=null,durationMs=null,volume=.75}={}){
 let player=null,statusSub=null,stateSub=null,prefsUnsub=null,timer=null,stopped=false,started=false;
 const permitted=()=>AppState.currentState==='active'&&currentPlaybackPreferences()[category+'Sounds']!==false&&currentPlaybackPreferences()[category+'SoundStyle']!=='off';
 const stop=()=>{if(stopped)return;stopped=true;clearTimeout(timer);statusSub?.remove?.();stateSub?.remove?.();prefsUnsub?.();try{player?.pause?.();}catch{}try{player?.remove?.();}catch{}if(active.get(category)===handle)active.delete(category);};
 const handle={stop,key,ok:true};
 if(!permitted()){handle.ok=false;stop();return handle;}
 active.get(category)?.stop();if(active.size>=3)active.values().next().value?.stop();active.set(category,handle);
 const applyVolume=()=>{if(player)player.volume=Math.max(0,Math.min(1,volume))*(currentPlaybackPreferences()[category+'SoundStyle']==='soft'?.4:1);};
 prefsUnsub=subscribePlaybackEffectPreferences(()=>{if(!permitted())stop();else applyVolume();});
 stateSub=AppState.addEventListener('change',state=>{if(state!=='active')stop();});
 timer=setTimeout(stop,10000);
 const duration=Math.max(1000,Math.min(10000,Math.max(Number(durationMs)||0,ORIGINAL_AUDIO_DURATION[key]||5000)));
 const playing=()=>{if(started||stopped)return;started=true;clearTimeout(timer);timer=setTimeout(stop,duration+150);};
 void setAudioModeAsync({playsInSilentMode:true}).catch(()=>{}).then(()=>{
  if(stopped||!permitted())return stop();
  try{const custom=/^https:\/\//i.test(String(url||''))&&!/\/functions\/v1\/sound-fx/i.test(url);player=createAudioPlayer(custom?url:ORIGINAL_AUDIO[key]||ORIGINAL_AUDIO.happy,{downloadFirst:true,updateInterval:100});applyVolume();statusSub=player.addListener?.('playbackStatusUpdate',status=>{if(status.didJustFinish)stop();else if(status.playing)playing();});player.play();if(!player.addListener)playing();}catch{handle.ok=false;stop();}
 });
 return handle;
}

