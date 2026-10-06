import React,{useEffect,useRef} from 'react';
import {Animated} from 'react-native';
export const FUNNY_FART_ART=require('../assets/props142/fart-ai-142.png');
export default function FunnyRoomReaction({size=48,moving=false,label='Funny puff',style}){
 const phase=useRef(new Animated.Value(0)).current;
 useEffect(()=>{phase.setValue(0);if(!moving)return;const loop=Animated.loop(Animated.sequence([Animated.timing(phase,{toValue:1,duration:450,useNativeDriver:true}),Animated.timing(phase,{toValue:0,duration:650,useNativeDriver:true})]));loop.start();return()=>{loop.stop();phase.setValue(0);};},[moving,phase]);
 return <Animated.Image source={FUNNY_FART_ART} accessibilityLabel={label} resizeMode="contain" fadeDuration={0} style={[{width:size,height:size,transform:[{translateX:phase.interpolate({inputRange:[0,1],outputRange:[0,size*.035]})},{rotate:phase.interpolate({inputRange:[0,1],outputRange:['0deg','-4deg']})},{scale:phase.interpolate({inputRange:[0,1],outputRange:[1,1.06]})}]},style]}/>;
}

