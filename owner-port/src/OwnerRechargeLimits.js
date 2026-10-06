import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{useEffect,useState} from 'react';
import {Alert,StyleSheet,View} from 'react-native';
import {supabase} from '../lib/supabase';
import OwnerOpsReferenceCenter from './OwnerOpsReferenceCenter';
import { PREMIUM } from './designSystem';
const C={panel:PREMIUM.colors.panel,panel2:PREMIUM.colors.panelSoft,line:PREMIUM.colors.line,text:PREMIUM.colors.text,muted:PREMIUM.colors.muted,purple:PREMIUM.colors.violet,cyan:PREMIUM.colors.cyan,gold:PREMIUM.colors.gold};
export default function OwnerRechargeLimits(){
 const [seller,setSeller]=useState(''),[merchant,setMerchant]=useState(''),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[locked,setLocked]=useState(false);
 const refresh=async()=>{const {data,error}=await supabase.rpc('load_recharge_limits');if(error){setLocked(true);return;}setLocked(false);setSeller(String(data?.seller_recharge_max||''));setMerchant(String(data?.merchant_inventory_max||''));};useEffect(()=>{refresh()},[]);
 const save=async()=>{const a=Number(seller.replaceAll(',','')),b=Number(merchant.replaceAll(',',''));if(!Number.isSafeInteger(a)||a<1||!Number.isSafeInteger(b)||b<1)return Alert.alert('Limits','Enter positive whole numbers');setBusy(true);const {error}=await supabase.rpc('owner_update_recharge_limits',{p_seller_recharge_max:a,p_merchant_inventory_max:b});setBusy(false);if(error)return Alert.alert('Limits',error.message);Alert.alert('Saved','New recharge safety limits are active immediately.');};
 return <View>{!locked?<View style={s.wrap}><AiBackdrop opacity={.22}/><Pressable onPress={()=>setOpen(x=>!x)} style={s.head}><View><Text style={s.title}>Recharge Safety Limits</Text><Text style={s.meta}>Founder-editable • per transaction</Text></View><Text style={s.arrow}>{open?'▲':'▼'}</Text></Pressable>{open?<><Text style={s.label}>SELLER → USER MAX</Text><TextInput value={seller} onChangeText={setSeller} keyboardType="number-pad" placeholder="Maximum coins" placeholderTextColor="#737B8E" style={s.input}/><Text style={s.label}>MERCHANT → SELLER MAX</Text><TextInput value={merchant} onChangeText={setMerchant} keyboardType="number-pad" placeholder="Maximum inventory" placeholderTextColor="#737B8E" style={s.input}/><Pressable disabled={busy} onPress={save} style={s.save}><Text style={s.saveText}>{busy?'SAVING…':'SAVE LIMITS'}</Text></Pressable></>:null}</View>:null}<OwnerOpsReferenceCenter/></View>;
}
const s=StyleSheet.create({wrap:{backgroundColor:'#10141E',borderWidth:1,borderColor:'#684974',borderRadius:18,padding:10,marginTop:10},head:{minHeight:45,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:C.text,fontSize:14,fontWeight:'900'},meta:{color:C.muted,fontSize:7,marginTop:3},arrow:{color:C.gold,fontSize:9,fontWeight:'900'},label:{color:C.muted,fontSize:7,fontWeight:'900',marginTop:9},input:{minHeight:43,borderRadius:11,backgroundColor:'#0D1019',borderWidth:1,borderColor:'#30364A',color:C.text,paddingHorizontal:10,marginTop:5},save:{minHeight:43,borderRadius:11,backgroundColor:'#67407C',alignItems:'center',justifyContent:'center',marginTop:9},saveText:{color:'#fff',fontSize:8,fontWeight:'900'}});

