import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{useCallback,useEffect,useState} from 'react';
import {Alert,ScrollView,StyleSheet,View} from 'react-native';
import {supabase} from '../lib/supabase';

const secureId=()=>{const value=globalThis.crypto?.randomUUID?.();if(!value)throw new Error('Secure operation ID unavailable');return value;};
const Json=({value})=><Text selectable style={s.json}>{JSON.stringify(value,null,2)}</Text>;

export default function OwnerLuckyGiftReversalCenter(){
  const [requestId,setRequestId]=useState(''),[reason,setReason]=useState(''),[confirmation,setConfirmation]=useState('');
  const [preview,setPreview]=useState(null),[history,setHistory]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[capability,setCapability]=useState(null);
  const refreshHistory=useCallback(async()=>{if(!capability?.can_view)return;const {data,error:e}=await supabase.rpc('owner_lucky_gift_reversal_history_v1',{p_request_id:requestId.trim()||null,p_limit:50});if(!e)setHistory(Array.isArray(data)?data:[]);},[requestId,capability?.can_view]);
  useEffect(()=>{let active=true;(async()=>{const {data}=await supabase.rpc('load_my_lucky_gift_reversal_capability_v1');if(active)setCapability(data||{can_view:false,can_execute:false});})();return()=>{active=false;};},[]);
  useEffect(()=>{refreshHistory();},[refreshHistory]);
  const runPreview=async()=>{setBusy(true);setError('');setPreview(null);try{const previewId=secureId();const {data,error:e}=await supabase.rpc('owner_preview_lucky_gift_reversal_v1',{p_original_request_id:requestId.trim(),p_preview_id:previewId,p_expected_reversal_version:0});if(e)throw e;setPreview(data);setConfirmation('');}catch(e){setError(e?.message||'Preview failed');}finally{setBusy(false);}};
  const execute=async()=>{if(!capability?.can_execute)return Alert.alert('Founder required','Only the Founder can execute a financial Lucky Gift reversal.');if(!preview?.executable)return Alert.alert('Execution blocked','Resolve every conflict/manual-review item first.');setBusy(true);setError('');try{const {data,error:e}=await supabase.rpc('owner_execute_lucky_gift_reversal_v1',{p_reversal_operation_id:secureId(),p_original_request_id:requestId.trim(),p_preview_id:preview.preview_id,p_snapshot_hash:preview.snapshot_hash,p_reason:reason.trim(),p_execution_request_id:secureId(),p_confirmation:confirmation,p_expected_reversal_version:0});if(e)throw e;Alert.alert(data?.status==='reversed'?'Reversal complete':'Manual review',JSON.stringify(data));setPreview(null);await refreshHistory();}catch(e){setError(e?.message||'Execution failed');}finally{setBusy(false);}};
  if(capability===null)return <View style={s.root}><Text style={s.note}>Checking Lucky Gift reversal authority…</Text></View>;
  if(!capability.can_view)return <View style={s.root}><Text style={s.error}>Lucky Gift reversal permission required.</Text></View>;
  return <ScrollView contentContainerStyle={s.root} keyboardShouldPersistTaps="handled"><Text style={s.title}>Lucky Gift Reversal</Text><Text style={s.note}>Founder financial execution only. Preview never mutates balances. Configuration restore is a separate action.</Text>
    <TextInput style={s.input} value={requestId} onChangeText={setRequestId} autoCapitalize="none" placeholder="Lucky request ID" placeholderTextColor="#748096"/>
    <Pressable disabled={busy||!requestId.trim()} style={[s.button,(busy||!requestId.trim())&&s.off]} onPress={runPreview}><Text style={s.buttonText}>{busy?'Checking…':'Preview reversal'}</Text></Pressable>
    {error?<Text style={s.error}>{error}</Text>:null}
    {preview?<View style={s.card}><AiBackdrop opacity={.22}/><Text style={s.heading}>Exact impact</Text><Json value={preview.impact}/><Text style={s.heading}>Conflicts</Text><Json value={preview.conflicts}/><Text style={s.heading}>Manual review</Text><Json value={preview.manual_review_items}/>{capability.can_execute?<><TextInput style={s.input} value={reason} onChangeText={setReason} placeholder="Mandatory detailed reason" placeholderTextColor="#748096"/><TextInput style={s.input} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" placeholder={preview.required_confirmation} placeholderTextColor="#748096"/><Pressable disabled={busy||!preview.executable||reason.trim().length<8||confirmation!==preview.required_confirmation} style={[s.danger,(busy||!preview.executable||reason.trim().length<8||confirmation!==preview.required_confirmation)&&s.off]} onPress={execute}><Text style={s.buttonText}>Execute audited reversal</Text></Pressable></>:<Text style={s.note}>Preview only. Founder authorization is required for financial execution.</Text>}</View>:null}
    <Text style={s.heading}>Reversal history</Text>{history.map(row=><View key={row.operation_id} style={s.card}><Text style={s.item}>{row.status} • {row.request_id}</Text><Text style={s.meta}>{row.reason}</Text><Json value={row.result}/></View>)}
  </ScrollView>;
}

const s=StyleSheet.create({root:{padding:16,backgroundColor:'#0B0E17',minHeight:'100%',gap:10},title:{color:'#fff',fontSize:21,fontWeight:'900'},note:{color:'#AAB3C6',fontSize:12,lineHeight:18},input:{borderWidth:1,borderColor:'#3B4559',borderRadius:10,padding:12,color:'#fff',backgroundColor:'#151B27'},button:{borderRadius:10,padding:13,alignItems:'center',backgroundColor:'#6741E9'},danger:{borderRadius:10,padding:13,alignItems:'center',backgroundColor:'#B3263E'},off:{opacity:.4},buttonText:{color:'#fff',fontWeight:'900'},card:{borderWidth:1,borderColor:'#30394C',borderRadius:12,padding:12,backgroundColor:'#111724',gap:8},heading:{color:'#FFD76D',fontWeight:'900',fontSize:14,marginTop:6},json:{color:'#CAD2E2',fontFamily:'monospace',fontSize:10},error:{color:'#FF667A'},item:{color:'#fff',fontWeight:'800'},meta:{color:'#AAB3C6',fontSize:11}});

