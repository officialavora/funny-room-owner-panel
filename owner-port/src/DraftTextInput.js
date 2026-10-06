import React,{forwardRef,useRef,useState} from 'react';
import {StyleSheet,TextInput as NativeTextInput,View} from 'react-native';
import DraftEraseButton from './DraftEraseButton';
import {eraseDraft} from './draftEditing';
// Keep the native input/ref, handlers, secure entry and keyboard contract.
const LAYOUT=new Set(['flex','flexGrow','flexShrink','flexBasis','alignSelf','width','minWidth','maxWidth','height','minHeight','maxHeight','position','top','right','bottom','left','start','end','zIndex','display','transform','margin','marginHorizontal','marginVertical','marginTop','marginRight','marginBottom','marginLeft','marginStart','marginEnd']);
export function draftInputStyles(style){
 const flat=StyleSheet.flatten(style)||{},outer={position:'relative'},inner={};
 for(const [key,value] of Object.entries(flat))(LAYOUT.has(key)?outer:inner)[key]=value;
 if(flat.height!==undefined)inner.height='100%';
 if(flat.minHeight!==undefined)inner.minHeight=flat.minHeight;
 if(flat.maxHeight!==undefined)inner.maxHeight=flat.maxHeight;
 inner.width='100%';inner.paddingRight=Math.max(42,Number(flat.paddingRight??flat.paddingHorizontal??flat.padding??0));
 return {outer,inner};
}
const DraftTextInput=forwardRef(function DraftTextInput({style,value,defaultValue,onChangeText,onChange,onSelectionChange,selection,editable=true,readOnly=false,draftEraseDisabled=false,draftPrefix='',onErasePrefix,...props},forwardedRef){
 const input=useRef(null),cursor=useRef(null),[local,setLocal]=useState(defaultValue??''),[pendingSelection,setPendingSelection]=useState(null);
 const controlled=value!==undefined,text=String(controlled?value:local),canErase=editable!==false&&!readOnly&&typeof onChangeText==='function';
 const styles=draftInputStyles(style);
 const change=next=>{cursor.current=null;setPendingSelection(null);if(!controlled)setLocal(next);onChangeText?.(next);};
 const erase=clear=>{if(!canErase||draftEraseDisabled)return;if(draftPrefix&&(clear||!text))onErasePrefix?.();const result=clear?{value:'',selection:{start:0,end:0}}:eraseDraft(text,selection??cursor.current);cursor.current=result.selection;setPendingSelection(result.selection);if(!controlled)setLocal(result.value);onChangeText(result.value);input.current?.focus();};
 const assign=node=>{input.current=node;if(typeof forwardedRef==='function')forwardedRef(node);else if(forwardedRef)forwardedRef.current=node;};
 if(!canErase)return <NativeTextInput {...props} ref={assign} style={style} value={value} defaultValue={defaultValue} editable={editable} readOnly={readOnly} onChange={onChange} onChangeText={change} selection={selection} onSelectionChange={onSelectionChange}/>;
 return <View style={styles.outer}><NativeTextInput {...props} ref={assign} style={canErase?styles.inner:style} value={value} defaultValue={defaultValue} editable={editable} readOnly={readOnly} onChange={onChange} onChangeText={change} selection={selection??pendingSelection??undefined} onKeyPress={event=>{if(event.nativeEvent.key==='Backspace'&&!text&&draftPrefix&&!draftEraseDisabled)onErasePrefix?.();props.onKeyPress?.(event);}} onSelectionChange={event=>{cursor.current=event.nativeEvent.selection;setPendingSelection(null);onSelectionChange?.(event);}}/>{canErase&&(text||draftPrefix)?<View style={{position:'absolute',right:6,top:0,bottom:0,justifyContent:'center'}}><DraftEraseButton disabled={draftEraseDisabled} value={text||draftPrefix} onChangeText={()=>erase(false)} onClear={()=>erase(true)}/></View>:null}</View>;
});
export default DraftTextInput;

