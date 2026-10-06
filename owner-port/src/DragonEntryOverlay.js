import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,AppState,Easing,Image,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {usePlaybackEffectPreferences} from './effectPreferences';
import {startDragonEntrySound} from './dragonEntryAudio';
import {DRAGON_ENTRY_VARIANTS,dragonEntryVariant} from './dragonEntryVariants';
export const DRAGON_ENTRY_DURATION=8100;
export function dragonRoomSessionReady(room,realtime,joiningRoom){return ['live','degraded'].includes(realtime?.realtimeStatus)&&(room?.chatSessionStartedAt?room.chatSessionStartedAt===realtime.sessionStartedAt:joiningRoom===room?.id);}
export function ownDragonEntryIdentity(room,user,members,visible,sessionReady=false){return sessionReady&&room?.real&&visible&&room.id&&user?.id&&members?.some(member=>member.userId===user.id)?`${room.id}:${user.id}`:null;}
// Original AI artwork with native cinematic motion; this is not an AI video.
export default function DragonEntryOverlay({profile,visible,onDone,variant='ivory',soundUrl=null,durationMs=8100}){
 const {width}=useWindowDimensions(),{prefs}=usePlaybackEffectPreferences();
 const variantKey=dragonEntryVariant(variant),dragon=DRAGON_ENTRY_VARIANTS[variantKey];
 const progress=useRef(new Animated.Value(0)).current,done=useRef(onDone),sound=useRef(null);
 done.current=onDone;
 const [active,setActive]=useState(AppState.currentState==='active'),[reduced,setReduced]=useState(null);
 useEffect(()=>{let live=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(live)setReduced(value)}).catch(()=>{if(live)setReduced(true)});const a=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced),b=AppState.addEventListener('change',state=>setActive(state==='active'));return()=>{live=false;a.remove();b.remove()};},[]);
 useEffect(()=>{if(prefs.entrySounds===false)sound.current?.stop();},[prefs.entrySounds]);
 useEffect(()=>{
  if(!visible||!profile||reduced===null)return;
  if(!active){done.current?.();return;}
  let live=true;
  const still=reduced||prefs.reduceMotion||!prefs.animations,duration=Math.max(5000,Math.min(10000,Number(durationMs)||DRAGON_ENTRY_DURATION));
  progress.setValue(0);
  sound.current=startDragonEntrySound(variantKey,{url:soundUrl,durationMs:duration});
  const animation=Animated.timing(progress,{toValue:1,duration,easing:Easing.linear,useNativeDriver:true,isInteraction:false});
  animation.start(({finished})=>{if(live&&finished){sound.current?.stop();done.current?.();}});
  return()=>{live=false;animation.stop();sound.current?.stop();sound.current=null;};
 },[visible,profile?.id,profile?.entryIdentity,active,reduced,prefs.animations,prefs.reduceMotion,progress,variantKey,soundUrl,durationMs]);
 if(!visible||!profile||!active||reduced===null)return null;
 const still=reduced||prefs.reduceMotion||!prefs.animations;
 const artWidth=width*.98,artHeight=artWidth/dragon.ratio;
 return <View testID="ai-dragon-room-entry" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill,{zIndex:40,elevation:40,justifyContent:'center',alignItems:'center'}]}>
  <Animated.View style={{width:'100%',alignItems:'center',opacity:progress.interpolate({inputRange:[0,.12,.83,1],outputRange:[0,1,1,0]}),transform:still?[]:[{translateX:progress.interpolate({inputRange:[0,.2,.75,1],outputRange:[-width*.7,-width*.08,width*.02,width*.65]})},{translateY:progress.interpolate({inputRange:[0,.25,.5,.75,1],outputRange:[26,-4,4,-5,-30]})},{scale:progress.interpolate({inputRange:[0,.3,.75,1],outputRange:[.8,1,1.03,.92]})}]}}>
   <View style={{width:artWidth,height:artHeight,overflow:'hidden'}}>{[0,1,2,3].map(index=><Animated.View key={index} testID={'dragon-pose-'+index} style={{position:'absolute',width:artWidth,height:artHeight,overflow:'hidden',opacity:still?(index===2?1:0):progress.interpolate({inputRange:index===0?[0,.18,.32,1]:index===1?[0,.16,.30,.48,.60,1]:index===2?[0,.42,.56,.72,.86,1]:[0,.70,.84,1],outputRange:index===0?[1,1,0,0]:index===3?[0,0,1,1]:[0,0,1,1,0,0],extrapolate:'clamp'})}}><Image source={dragon.source} resizeMode="stretch" style={{position:'absolute',left:-(index%2)*artWidth,top:-Math.floor(index/2)*artHeight,width:artWidth*2,height:artHeight*2}}/></Animated.View>)}</View>
   <View style={{flexDirection:'row',gap:8,alignItems:'center',backgroundColor:'#170E19EE',borderRadius:24,paddingHorizontal:16,paddingVertical:8,borderWidth:1,borderColor:'#DAA447'}}>{(profile.avatar_url||profile.avatarUrl)?<Image source={{uri:profile.avatar_url||profile.avatarUrl}} style={{width:30,height:30,borderRadius:15}}/>:null}<Text numberOfLines={1} style={{maxWidth:width*.68,color:'#FFE6AF',fontSize:16,fontWeight:'900'}}>{profile.display_name||profile.displayName||profile.name||'Member'} entered</Text></View>
  </Animated.View>
 </View>;
}

