import React from 'react';
import {Image,Pressable as NativePressable,StyleSheet,View} from 'react-native';
export const AI_CHROME_TEXTURE=require('../assets/backgrounds/app-satin-ai-v1.png');
export function AiBackdrop({opacity=.55,offsetX=0}){return <Image pointerEvents="none" accessible={false} source={AI_CHROME_TEXTURE} resizeMode="cover" style={[StyleSheet.absoluteFill,{width:'100%',height:'100%',opacity,transform:[{translateX:offsetX}]}]}/>;}
// Keep native event, disabled, accessibility and pressed-child contracts intact.
export function AiPressable({children,style,...props}){
 return <NativePressable {...props} style={state=>[typeof style==='function'?style(state):style,state.pressed&&!props.disabled&&{opacity:.78}]}>{state=><><View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill,{overflow:'hidden',borderRadius:StyleSheet.flatten(typeof style==='function'?style(state):style)?.borderRadius||16}]}><Image source={AI_CHROME_TEXTURE} style={{width:'100%',height:'100%',opacity:.16}} resizeMode="cover"/></View>{typeof children==='function'?children(state):children}</>}</NativePressable>;
}

