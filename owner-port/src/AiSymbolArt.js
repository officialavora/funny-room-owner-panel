import {useVisualActivity} from './VisualActivity';
import React,{useEffect,useRef} from 'react';
import {Animated,Image,Text,View} from 'react-native';
import {aiSymbolSource} from './aiSymbolAssets';
import {AI_SYMBOL_BOUNDS} from './aiSymbolBounds';
import {useCatalogMotion,useCatalogMotionSlot} from './catalogMotion';

export function aiMotionProfile(emoji,size){
  const key=String(emoji||'');
  if(['🚀','✈️','👻','💸','🌌'].includes(key))return {lift:-size*.09,turn:5,grow:1.04};
  if(['❤️','💜','💙','💚','💛','🖤','💞','❤️‍🩹','💔','🫶'].includes(key))return {lift:-size*.025,turn:0,grow:1.12};
  if(key.startsWith('🇨')||key.startsWith('🇮')||/^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(key))return {lift:-size*.025,turn:4,grow:1.025};
  return {lift:-size*.055,turn:4,grow:1.06};
}
// Rendering only: original Unicode/reaction keys, sounds and sending are unchanged.
// `managed` is used only by a parent that already holds the shared motion slot.
export default function AiSymbolArt({emoji,label,size=32,animate=false,managed=false,priority=0,style}){
  const visible=useVisualActivity(),motion=useCatalogMotion()&&visible,source=aiSymbolSource(emoji);
  const slot=useCatalogMotionSlot(Boolean(!managed&&source&&animate&&motion),priority);
  const moving=Boolean(source&&animate&&motion&&(managed||slot));
  const phase=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(!moving){phase.setValue(0);return undefined;}
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(phase,{toValue:1,duration:580,useNativeDriver:true}),
      Animated.timing(phase,{toValue:0,duration:580,useNativeDriver:true}),
    ]));
    loop.start();return()=>{loop.stop();phase.setValue(0);};
  },[moving,phase]);
  if(!source)return <Text accessibilityLabel={label||emoji} style={[{fontSize:size*.76,lineHeight:size,textAlign:'center'},style]}>{emoji||'◇'}</Text>;
  const profile=aiMotionProfile(emoji,size);
  const [iw,ih,x1,y1,x2,y2]=AI_SYMBOL_BOUNDS[String(emoji)]||[1,1,0,0,1,1];
  const bw=x2-x1,bh=y2-y1;
  const angle=Math.abs(profile.turn)*Math.PI/180;
  const safeScale=moving?Math.min(.94,(1-2*Math.abs(profile.lift)/size)/(profile.grow*(Math.cos(angle)+Math.sin(angle)))*.98):.94;
  const fit=Math.min(size/bw,size/bh)*safeScale;

  return <Animated.View style={[{width:size,height:size,transform:[
    {translateY:phase.interpolate({inputRange:[0,1],outputRange:[0,profile.lift]})},
    {rotate:phase.interpolate({inputRange:[0,.5,1],outputRange:['0deg',`${profile.turn}deg`,'0deg']})},
    {scale:phase.interpolate({inputRange:[0,1],outputRange:[1,profile.grow]})},
  ]},style]}>
    <View style={{position:'absolute',left:(size-bw*fit)/2,top:(size-bh*fit)/2,width:bw*fit,height:bh*fit,overflow:'hidden'}}><Image source={source} resizeMode="stretch" fadeDuration={0} accessibilityLabel={label||emoji} style={{position:'absolute',left:-x1*fit,top:-y1*fit,width:iw*fit,height:ih*fit}}/></View>
  </Animated.View>;
}

