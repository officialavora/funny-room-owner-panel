import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{useEffect,useState} from 'react';
import {Alert,StyleSheet,View} from 'react-native';
import {supabase} from '../lib/supabase';
import {PREMIUM} from './designSystem';

const C={...PREMIUM.colors,purple:PREMIUM.colors.violet};
const compact=value=>Number(value||0).toLocaleString();

export default function OwnerAffinityPolicyCenter({onNotice}){
  const [current,setCurrent]=useState(null),[value,setValue]=useState('5000000'),[reason,setReason]=useState(''),[busy,setBusy]=useState(false);
  const load=async()=>{const {data,error}=await supabase.rpc('load_affinity_restore_policy');if(error)return onNotice?.(error.message);setCurrent(data);setValue(String(data?.coin_cost??5000000));};
  useEffect(()=>{load()},[]);
  const save=()=>{
    const amount=Number(value);
    if(!Number.isSafeInteger(amount)||amount<0||amount>1000000000000)return onNotice?.('Enter a whole coin amount between 0 and 1 trillion');
    if(reason.trim().length<3)return onNotice?.('Restore-price reason required');
    Alert.alert('Change relationship restore price?',`Current: ${compact(current?.coin_cost)} coins\nNew: ${compact(amount)} coins\n\nThis applies to new restore requests only.`,[
      {text:'Cancel',style:'cancel'},
      {text:'SAVE PRICE',onPress:async()=>{setBusy(true);const {data,error}=await supabase.rpc('owner_set_affinity_restore_cost',{p_coin_cost:amount,p_reason:reason.trim()});setBusy(false);if(error)return onNotice?.(error.message);setCurrent({...(current||{}),coin_cost:data.coin_cost});setReason('');onNotice?.(`Relationship restore price set to ${compact(data.coin_cost)} coins`);}},
    ]);
  };
  return <View style={s.shell}><View style={s.head}><View style={s.icon}><Text style={s.iconText}>💞</Text></View><View style={s.flex}><Text style={s.eyebrow}>OWNER • RELATIONSHIP POLICY</Text><Text style={s.title}>Break & Restore Control</Text><Text style={s.sub}>Ending is free. Restoring needs both partners’ consent and preserves the old level and intimacy.</Text></View></View>
    <View style={s.priceCard}><Text style={s.label}>CURRENT RESTORE PRICE</Text><Text style={s.price}>🪙 {compact(current?.coin_cost)}</Text><Text style={s.note}>Charged once from the member who requests restoration, only when the other partner accepts.</Text></View>
    <TextInput value={value} onChangeText={x=>setValue(x.replace(/\D/g,''))} keyboardType="number-pad" placeholder="Restore coin price" placeholderTextColor={C.muted} style={s.input}/>
    <TextInput value={reason} onChangeText={setReason} maxLength={500} placeholder="Required reason for audit" placeholderTextColor={C.muted} style={s.input}/>
    <Pressable disabled={busy} onPress={save} style={[s.save,busy&&s.disabled]}><Text style={s.saveText}>{busy?'SAVING…':'SAVE RESTORE PRICE'}</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({shell:{marginTop:14,borderRadius:22,borderWidth:1,borderColor:'#5B3857',backgroundColor:'#21131F',padding:13,overflow:'hidden'},head:{flexDirection:'row',alignItems:'center',gap:10},icon:{width:46,height:46,borderRadius:16,backgroundColor:'#4A203C',borderWidth:1,borderColor:'#A84D84',alignItems:'center',justifyContent:'center'},iconText:{fontSize:23},flex:{flex:1},eyebrow:{color:C.gold,fontSize:7,fontWeight:'900',letterSpacing:1},title:{color:C.text,fontSize:15,fontWeight:'900',marginTop:2},sub:{color:C.muted,fontSize:8,lineHeight:12,marginTop:3},priceCard:{marginTop:12,borderRadius:16,backgroundColor:'#31192B',borderWidth:1,borderColor:'#6B335A',padding:12},label:{color:'#E6A4CF',fontSize:7,fontWeight:'900'},price:{color:C.gold,fontSize:20,fontWeight:'900',marginTop:5},note:{color:'#C9A9BE',fontSize:7.5,lineHeight:12,marginTop:4},input:{minHeight:44,borderRadius:13,borderWidth:1,borderColor:'#513249',backgroundColor:'#130D13',color:C.text,paddingHorizontal:11,marginTop:8,fontSize:10},save:{minHeight:45,borderRadius:13,backgroundColor:'#8E3D73',alignItems:'center',justifyContent:'center',marginTop:8},saveText:{color:'#fff',fontSize:8,fontWeight:'900'},disabled:{opacity:.45}});


