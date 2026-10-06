import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Animated,Image,Text,View} from 'react-native';
import {catalogDuration,httpsMedia} from './catalogMedia';
import {ROOM_REACTION_ART} from './roomReactionAssets';
import AiSymbolArt from './AiSymbolArt';
import FunnyRoomReaction from './FunnyRoomReaction';
import {aiSymbolSource} from './aiSymbolAssets';

import {useCatalogMotion,useCatalogMotionSlot} from './catalogMotion';
export {useCatalogMotion as useRoomReactionMotion,selectMotionSlots,MAX_ANIMATED_REACTIONS} from './catalogMotion';

export function resolveReactionArt(reactionKey,emoji){
  return ROOM_REACTION_ART[reactionKey]||Object.values(ROOM_REACTION_ART).find(item=>item.emoji===emoji)||null;
}
export default function RoomReactionArt({reactionKey,emoji,label,mediaUrl=null,posterUrl=null,size=48,animate=true,priority=2,style}){
  const motion=useCatalogMotion();
  const art=useMemo(()=>httpsMedia(mediaUrl)?{animated:{uri:httpsMedia(mediaUrl)},poster:httpsMedia(posterUrl)?{uri:httpsMedia(posterUrl)}:null}:resolveReactionArt(reactionKey,emoji),[reactionKey,emoji,mediaUrl,posterUrl]);
  const [failed,setFailed]=useState(0);
  useEffect(()=>setFailed(0),[art]);
  const moving=useCatalogMotionSlot(Boolean((reactionKey==='fart'||art||aiSymbolSource(emoji))&&animate&&motion&&failed===0),priority);
  const description=label||art?.label||'Room reaction';
  const isKiss=['kiss','kiss_left','kiss_right'].includes(reactionKey);
  if(reactionKey==='fart'&&!httpsMedia(mediaUrl))return <FunnyRoomReaction size={size} moving={Boolean(moving)} label={description} style={style}/>;
  // Owner media remains authoritative; bundled reactions use original AI art.
  if(!httpsMedia(mediaUrl)&&aiSymbolSource(emoji||art?.emoji))return <View style={[{width:size,height:size,transform:reactionKey==='kiss_left'?[{scaleX:-1}]:[]},style]}><AiSymbolArt emoji={emoji||art?.emoji} label={description} size={size} animate={moving} managed/>{isKiss?<KissBubbles size={size} active={moving}/>:null}</View>;
  if(!art||failed>1||(!moving&&!art.poster))return aiSymbolSource(emoji)?<AiSymbolArt emoji={emoji} label={description} size={size} animate={false} managed style={style}/>:<Text accessibilityLabel={description} style={[{fontSize:size*.72,lineHeight:size},style]}>{emoji||'◇'}</Text>;
  return <Image source={moving?art.animated:art.poster} resizeMode="contain" fadeDuration={0}
    accessibilityLabel={description} style={[{width:size,height:size},style]}
    onError={()=>setFailed(value=>value+1)}/>;
}

// History retains the still image after the configured playback window, including audience reactions.
export function TimedRoomReactionArt({createdAt,durationMs,...props}){
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{const remaining=Date.parse(createdAt||'')+catalogDuration(durationMs)-Date.now();setPlaying(Number.isFinite(remaining)&&remaining>0);if(!Number.isFinite(remaining)||remaining<=0)return undefined;const timer=setTimeout(()=>setPlaying(false),Math.min(remaining,30000));return()=>clearTimeout(timer);},[createdAt,durationMs]);
  return <RoomReactionArt {...props} animate={playing}/>;
}

function KissBubbles({size,active}){
 const phase=useRef(new Animated.Value(0)).current;
 useEffect(()=>{phase.setValue(0);if(!active)return;const loop=Animated.loop(Animated.timing(phase,{toValue:1,duration:1500,useNativeDriver:true}));loop.start();return()=>{loop.stop();phase.setValue(0);};},[active,phase]);
 if(!active)return null;
 return <View pointerEvents="none" style={{position:'absolute',left:0,top:0,width:size,height:size}}>{[0,1,2].map(i=><Animated.View key={i} style={{position:'absolute',left:size*.65,top:size*.35,opacity:phase.interpolate({inputRange:[0,.15,.8,1],outputRange:[0,1,1,0]}),transform:[{translateX:phase.interpolate({inputRange:[0,1],outputRange:[0,size*(.25+i*.16)]})},{translateY:phase.interpolate({inputRange:[0,1],outputRange:[0,-size*(.18+i*.18)]})},{scale:phase.interpolate({inputRange:[0,1],outputRange:[.5,1]})}]}}><AiSymbolArt emoji="❤️" size={size*.2}/></Animated.View>)}</View>;
}

