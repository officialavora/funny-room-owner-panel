import React,{useRef} from 'react';
import {Pressable,Text} from 'react-native';
export function eraseLastCharacter(value){
 const text=String(value||'');
 if(typeof Intl.Segmenter==='function'){const chunks=Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text),x=>x.segment);chunks.pop();return chunks.join('');}
 const chunks=[];
 for(const character of Array.from(text)){
  if(chunks.length&&(/^[\p{Mark}\uFE0F\uFE0E\u200D\u{1F3FB}-\u{1F3FF}]$/u.test(character)||chunks[chunks.length-1].endsWith('\u200D')))chunks[chunks.length-1]+=character;
  else chunks.push(character);
 }
 chunks.pop();return chunks.join('');
}
export default function DraftEraseButton({value,onChangeText,disabled=false,onClear}){
 const held=useRef(false);
 if(!value)return null;
 return <Pressable accessibilityRole="button" accessibilityLabel="Delete character; hold to clear draft" accessibilityHint="Tap deletes the last character. Hold clears this draft." disabled={disabled} delayLongPress={450} onPressIn={()=>{held.current=false;}} onPress={()=>{if(!held.current)onChangeText?.(eraseLastCharacter(value));}} onLongPress={()=>{held.current=true;if(onClear)onClear();else onChangeText?.('');}} hitSlop={4} style={{width:28,height:34,alignItems:'center',justifyContent:'center',opacity:disabled?0.45:1}}><Text style={{color:'#69DAF0',fontSize:20}}>⌫</Text></Pressable>;
}

