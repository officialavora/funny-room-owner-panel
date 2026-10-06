import React,{useEffect,useRef,useState} from 'react';
import {Switch,Text,View} from 'react-native';
import {AiPressable as Pressable} from './AiChrome';
import TextInput from './DraftTextInput';
import {supabase} from '../lib/supabase';
import {boundedRpc} from './boundedRpc';

// Uses the installed SDK54 Switch; no native dependency/runtime change.
export default function OwnerRoomLocks({roomId,compact=false,onChanged}){
 const [policy,setPolicy]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[password,setPassword]=useState('');
 const epoch=useRef(0),alive=useRef(true),saving=useRef(false);
 const refresh=async()=>{const token=++epoch.current;setBusy(true);setError('');try{
  const result=await boundedRpc(supabase,'load_owner_room_controls_v149',{p_room:roomId},{label:'Room controls'});
  if(!alive.current||token!==epoch.current)return;if(result.error)throw result.error;setPolicy(result.data);
 }catch(e){if(alive.current&&token===epoch.current)setError(e.message||'Could not load room controls.');}
 finally{if(alive.current&&token===epoch.current)setBusy(false);}};
 useEffect(()=>{alive.current=true;setPolicy(null);setPassword('');refresh();return()=>{alive.current=false;++epoch.current;};},[roomId]);
 const save=async(change)=>{if(saving.current||busy||!policy?.can_manage)return;
  saving.current=true;const token=++epoch.current;setBusy(true);setError('');try{
   const result=await boundedRpc(supabase,'owner_set_room_controls_v149',{
    p_room:roomId,p_frozen:policy.frozen,p_expected_revision:policy.revision,
    p_reason:'App Owner room entry and exit control',...change},{label:'Save room controls'});
   if(!alive.current||token!==epoch.current)return;if(result.error)throw result.error;
   setPolicy(result.data);setPassword('');await onChanged?.();
  }catch(e){if(alive.current&&token===epoch.current)setError(e.message||'Could not save. Reload to check the saved state.');}
  finally{saving.current=false;if(alive.current&&token===epoch.current)setBusy(false);}};
 if(policy&&!policy.can_manage)return null;
 const text={color:'#F8F9FF',fontSize:12,lineHeight:18};
 if(!policy)return <View><Text style={text}>{error||'Loading Owner controls…'}</Text>{error?<Pressable disabled={busy} onPress={refresh}><Text style={text}>RETRY</Text></Pressable>:null}</View>;
 return <View style={{gap:10,marginTop:12,flex:compact?1:undefined}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
   <Switch accessibilityLabel="Owner freeze room entry and exit" disabled={busy} value={Boolean(policy.frozen)} onValueChange={value=>save({p_frozen:value})}/>
   <Text style={[text,{flex:1}]}>Freeze entry / exit</Text>
  </View>
  {error?<Text accessibilityRole="alert" style={{...text,color:'#FFB4C6'}}>{error}</Text>:null}
  {!compact?<><Text style={{...text,color:'#A9B2C4'}}>Only App Owner can change these controls. Offline sessions still expire safely.</Text>
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={[text,{flex:1}]}>Show password entry</Text><Switch accessibilityLabel="Owner show password entry" disabled={busy||!policy.locked} value={Boolean(policy.show_password_entry)} onValueChange={value=>save({p_show_password_entry:value})}/></View>
   <TextInput secureTextEntry keyboardType="number-pad" value={password} maxLength={8} onChangeText={v=>setPassword(v.replace(/\D/g,''))} placeholder="4–8 digit room password" placeholderTextColor="#A9B2C4" style={{...text,borderColor:'#684974',borderWidth:1,borderRadius:12,minHeight:46,padding:10}}/>
   <Pressable disabled={busy||!/^\d{4,8}$/.test(password)} onPress={()=>save({p_locked:true,p_password:password,p_show_password_entry:false})}><Text style={text}>SET OWNER PASSWORD LOCK</Text></Pressable>
   <Pressable disabled={busy||!policy.locked} onPress={()=>save({p_locked:false})}><Text style={text}>REMOVE PASSWORD LOCK</Text></Pressable>
  </>:null}
  <Pressable disabled={busy} onPress={refresh}><Text style={text}>{busy?'SAVING / CHECKING…':'RELOAD SAVED STATE'}</Text></Pressable>
 </View>;
}

