import {useCatalogMotion,useCatalogMotionSlot} from './catalogMotion';
import {useVisualActivity} from './VisualActivity';
import React,{useEffect,useRef} from 'react';
import {Animated,Image,View} from 'react-native';
import {usePlaybackEffectPreferences} from './effectPreferences';
// Clip outer wing regions; portrait and centre remain still. Existing native driver,
// no new native dependency or gesture engine required by this source-only change.
export default function FrameWingMotion({source,size,animate=true}){
 const phase=useRef(new Animated.Value(0)).current,{budget}=usePlaybackEffectPreferences();
 const visible=useVisualActivity(),allowed=useCatalogMotion();
 const granted=useCatalogMotionSlot(Boolean(animate&&visible&&allowed&&budget.level==='full'),0);
 const moving=animate&&visible&&allowed&&granted&&budget.level==='full';
 useEffect(()=>{phase.setValue(0);if(!moving)return;const loop=Animated.loop(Animated.sequence([Animated.timing(phase,{toValue:1,duration:1700,useNativeDriver:true,isInteraction:false}),Animated.timing(phase,{toValue:0,duration:1700,useNativeDriver:true,isInteraction:false})]));loop.start();return()=>{loop.stop();phase.stopAnimation();};},[moving,phase]);
 return <View pointerEvents="none" style={{position:'absolute',width:size,height:size}}>{[[0,.25],[.25,.5],[.75,.25]].map(([start,width],index)=><Animated.View key={index} style={{position:'absolute',left:size*start,width:size*width,height:size,overflow:'hidden',transform:index===1||!moving?[]:[{perspective:600},{rotateY:phase.interpolate({inputRange:[0,1],outputRange:['0deg',index===0?'14deg':'-14deg']})},{translateY:phase.interpolate({inputRange:[0,1],outputRange:[0,-size*.018]})}]}}><Image source={source} resizeMode="contain" style={{position:'absolute',left:-size*start,width:size,height:size}}/></Animated.View>)}</View>;
}

