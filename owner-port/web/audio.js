const players=new Set();
export function stopOwnerAudio(){for(const audio of players){audio.pause();try{audio.currentTime=0}catch{}}}
export async function setAudioModeAsync(){}
export function createAudioPlayer(source){
 const audio=new Audio(typeof source==='string'?source:source?.uri);audio.preload='auto';players.add(audio);const listeners=new Set();
 const update=()=>listeners.forEach(fn=>fn({playing:!audio.paused,didJustFinish:audio.ended,currentTime:audio.currentTime,duration:audio.duration,isLoaded:audio.readyState>=2}));
 ['playing','pause','ended','loadedmetadata','timeupdate'].forEach(event=>audio.addEventListener(event,update));
 return {play:()=>{const promise=audio.play();promise?.catch(error=>{window.dispatchEvent(new CustomEvent('owner-media-error',{detail:error.message}));});},pause:()=>audio.pause(),remove:()=>{audio.pause();audio.removeAttribute('src');audio.load();listeners.clear();players.delete(audio);},seekTo:async t=>{audio.currentTime=t;},get volume(){return audio.volume},set volume(v){audio.volume=v},get loop(){return audio.loop},set loop(v){audio.loop=v},get playing(){return !audio.paused},get currentTime(){return audio.currentTime},get duration(){return audio.duration},addListener:(_,fn)=>{listeners.add(fn);return {remove:()=>listeners.delete(fn)}}};
}
