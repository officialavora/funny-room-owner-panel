import {startOriginalEffectAudio} from './originalEffectAudio';
import {emotionalEmojiKey,emotionalGiftKey,emotionalEntryKey} from './emotionalSoundRouting';
import {catalogDuration,giftArtwork} from './catalogMedia';
import {createAudioPlayer,setAudioModeAsync} from 'expo-audio';
import {SUPABASE_URL} from '../lib/supabase';
import {currentPlaybackPreferences} from './effectPreferences';

const FX_BASE=`${SUPABASE_URL}/functions/v1/sound-fx?key=`;
const BUNDLED_FX={clap:require('../assets/audio/clap-neural-ai-cp118.wav')};
const ROCKET_REFERENCE=require('../assets/audio/rocket-reference-launch-blast-cp124.m4a');
const livePlayers=new Set();
let audioModeReady=false;

const ensureAudioMode=async()=>{
  if(audioModeReady)return;
  try{
    await setAudioModeAsync({playsInSilentMode:true});
    audioModeReady=true;
  }catch{}
};

const allowed=new Set(['laugh','cry','sad','ghost','scary','kiss','clap','entry','gift','coin','pop','peacock','eagle','elephant','donkey','slipper','angry','rocket','football','drum']);
const cleanKey=key=>(allowed.has(String(key||'').toLowerCase())||/^flag_[a-z]{2}$/.test(String(key||'').toLowerCase()))?String(key).toLowerCase():'pop';

export async function playSoundEffect(key,{volume=.9,preference=null}={}){
  const prefs=currentPlaybackPreferences();
  if(preference&&prefs?.[preference]===false)return {ok:false,skipped:true};
  const sound=cleanKey(key);
  try{
    await ensureAudioMode();
    const remote=`${FX_BASE}${encodeURIComponent(sound)}&v=cp109`;
    let player;try{player=createAudioPlayer(BUNDLED_FX[sound]??remote,{downloadFirst:true});}catch(error){if(!BUNDLED_FX[sound])throw error;player=createAudioPlayer(remote,{downloadFirst:true});}
    livePlayers.add(player);
    try{player.volume=Math.max(0,Math.min(1,Number(volume)||0));}catch{}
    player.play();
    const cleanup=()=>{
      try{player.pause?.();}catch{}
      try{player.remove?.();}catch{}
      try{player.release?.();}catch{}
      livePlayers.delete(player);
    };
    setTimeout(cleanup,BUNDLED_FX[sound]?3000:['ghost','scary','cry','sad','laugh'].includes(sound)?3200:2200);
    return {ok:true,key:sound};
  }catch(error){return {ok:false,error};}
}

// Exact user-supplied eight-second launch/firework track; not neural-generated.
export async function playRocketBlastSound(){
 if(currentPlaybackPreferences()?.giftSounds===false)return {ok:false,skipped:true,stop(){}};
 await ensureAudioMode();let player,timer,stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;clearTimeout(timer);try{player?.pause?.();}catch{}try{player?.remove?.();}catch{}try{player?.release?.();}catch{}livePlayers.delete(player);};
 try{player=createAudioPlayer(ROCKET_REFERENCE,{downloadFirst:true});livePlayers.add(player);player.volume=.7;player.play();timer=setTimeout(stop,8000);return {ok:true,stop};}catch(error){stop();return {ok:false,error,stop};}
}

export async function playCatalogSound(url,fallbackKey,{volume=.9,preference=null,durationMs=3000}={}){
  const prefs=currentPlaybackPreferences();
  if(preference&&prefs?.[preference]===false)return {ok:false,skipped:true};
  if(!/^https:\/\//i.test(String(url||'')))return playSoundEffect(fallbackKey,{volume,preference});
  try{
    await ensureAudioMode();
    const player=createAudioPlayer(url,{downloadFirst:true});
    livePlayers.add(player);
    try{player.volume=Math.max(0,Math.min(1,Number(volume)||0));}catch{}
    player.play();
    const cleanup=()=>{try{player.pause?.()}catch{}try{player.remove?.()}catch{}try{player.release?.()}catch{}livePlayers.delete(player)};
    setTimeout(cleanup,Math.min(3000,catalogDuration(durationMs,3000)));
    return {ok:true,url};
  }catch(error){return playSoundEffect(fallbackKey,{volume,preference});}
}

export const soundForEmoji=emotionalEmojiKey;
export function playEmojiSound(emoji,media=null){return startOriginalEffectAudio(emotionalEmojiKey(emoji),{category:'emoji',url:media?.sound_url,durationMs:media?.duration_ms});}

export const soundForGift=gift=>{
  const text=`${gift?.slug||''} ${gift?.name||''} ${gift?.effect_kind||''}`.toLowerCase();
  const resolved=giftArtwork(gift).emoji;
  const art=String(gift?.emoji&&gift.emoji!=='🎁'?gift.emoji:resolved||gift?.asset_key||'');
  const flag=Array.from(art).filter(c=>c.codePointAt(0)>=0x1F1E6&&c.codePointAt(0)<=0x1F1FF);
  if(flag.length===2)return 'flag_'+flag.map(c=>String.fromCharCode(97+c.codePointAt(0)-0x1F1E6)).join('');
  if(/peacock/.test(text)||art==='🦚')return 'peacock';
  if(/eagle/.test(text)||art==='🦅')return 'eagle';
  if(/elephant/.test(text)||art==='🐘')return 'elephant';
  if(/donkey/.test(text)||art==='🫏')return 'donkey';
  if(/chappal|slipper/.test(text)||art==='🩴')return 'slipper';
  if(/football/.test(text)||art==='⚽')return 'football';
  if(/dhol|drum/.test(text)||art==='🥁')return 'drum';
  if(/rocket/.test(text)||art==='🚀')return 'rocket';

  if(/kiss|love/.test(text)||['💋','😘'].includes(gift?.asset_key||gift?.emoji))return 'kiss';
  if(/laugh/.test(text)||gift?.asset_key==='😂')return 'laugh';
  if(/cry/.test(text)||gift?.asset_key==='😭')return 'cry';
  if(/sad/.test(text)||gift?.asset_key==='😢')return 'sad';
  if(/ghost/.test(text)||gift?.asset_key==='👻')return 'ghost';
  if(/scary|skull/.test(text)||gift?.asset_key==='💀')return 'scary';
  if(/clap/.test(text)||gift?.asset_key==='👏')return 'clap';
  return 'gift';
};

export function playGiftSound(gift={}){return startOriginalEffectAudio(emotionalGiftKey(gift),{category:'gift',url:gift.sound_url,durationMs:gift.effect_duration_ms});}
export function playEntrySound(item={}){return startOriginalEffectAudio(emotionalEntryKey(item),{category:'entry',url:item.sound_url,durationMs:Math.max(5000,Math.min(10000,Number(item.visual?.duration_ms)||8100))});}
export function playCoinSound(){return playSoundEffect('coin',{volume:.72});}

export function playGameSound(event={}){
  const key=String(event.game_key||event.key||'').toLowerCase();
  if(key==='coin_flip'||key==='lucky_number'||key==='lucky_99')return playSoundEffect('coin',{volume:.78});
  if(key==='emoji_battle')return playEmojiSound(event.icon||event.emoji||'😂');
  if(key==='color_wheel'||key==='elimination_wheel'||key==='room_rally')return playSoundEffect('entry',{volume:.76});
  if(key==='football_shot'||key==='rocket_meter'||key==='fishing_rush')return playSoundEffect('clap',{volume:.82});
  return playSoundEffect('pop',{volume:.74});
}

export function playPKSound(event={}){
  const status=String(event.status||'').toLowerCase();
  const kind=String(event.event_kind||'').toLowerCase();
  if(kind==='result'||status==='completed'||status==='finished')return playSoundEffect('clap',{volume:.9});
  if(kind==='start')return playSoundEffect('entry',{volume:.78});
  if(kind==='score')return playSoundEffect('coin',{volume:.42});
  if(kind==='challenge')return playSoundEffect('pop',{volume:.66});
  return playSoundEffect('pop',{volume:.54});
}

