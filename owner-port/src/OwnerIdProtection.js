import React,{useEffect,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {AiPressable as Pressable} from './AiChrome';
import TextInput from './DraftTextInput';
import {supabase} from '../lib/supabase';
import {boundedRpc} from './boundedRpc';

const options=[['account','Account suspension / deletion'],['profile','Profile changes by others'],['room_kick','Room removal / blocking'],['room_mute','Mic mute by others'],['seat_drop','Seat removal by others']];
export default function OwnerIdProtection({publicId}){
 const [data,setData]=useState(null),[keys,setKeys]=useState([]),[term,setTerm]=useState('permanent'),[months,setMonths]=useState(''),[date,setDate]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const epoch=useRef(0),alive=useRef(true),saving=useRef(false);
 const apply=value=>{setData(value);setKeys(value.policy?.protections||[]);};
 const load=async()=>{const token=++epoch.current;setBusy(true);setError('');try{const r=await boundedRpc(supabase,'owner_load_id_protection_v152',{p_public_id:Number(publicId)},{label:'ID protection'});if(r.error)throw r.error;if(alive.current&&token===epoch.current)apply(r.data);}catch(e){if(alive.current&&token===epoch.current)setError(e.message||'Could not load protection.');}finally{if(alive.current&&token===epoch.current)setBusy(false);}};
 useEffect(()=>{alive.current=true;setData(null);setKeys([]);setReason('');setMonths('');setDate('');setTerm('permanent');load();return()=>{alive.current=false;++epoch.current;};},[publicId]);
 const save=async(action)=>{if(saving.current||busy||!data||data.founder)return;
  if(reason.trim().length<3)return setError('Enter an audit reason.');
  if(action==='save'&&!keys.length)return setError('Choose at least one protection.');
  if(action==='save'&&term==='months'&&(!/^\d+$/.test(months)||Number(months)<1||Number(months)>1200))return setError('Enter 1 to 1200 whole months.');
  if(action==='save'&&term==='date'&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(date)||!Number.isFinite(Date.parse(date))||Date.parse(date)<=Date.now()))return setError('Enter a future UTC expiry, e.g. 2027-01-01T00:00:00Z.');
  saving.current=true;const token=++epoch.current;setBusy(true);setError('');try{const r=await boundedRpc(supabase,'owner_set_id_protection_v152',{p_public_id:Number(publicId),p_protections:keys,p_action:action,p_months:term==='months'?Number(months):null,p_expires_at:term==='date'?date:null,p_expected_revision:data.policy?.revision||0,p_reason:reason.trim()},{label:'Save ID protection'});if(r.error)throw r.error;if(alive.current&&token===epoch.current){apply(r.data);setReason('');}}catch(e){if(alive.current&&token===epoch.current)setError(e.message||'Could not save. Reload to check protection.');}finally{saving.current=false;if(alive.current&&token===epoch.current)setBusy(false);}
 };
 const text={color:'#F8F9FF',fontSize:12,lineHeight:19},field={...text,borderWidth:1,borderColor:'#684974',borderRadius:12,padding:10,minHeight:46};
 return <View style={{gap:10,marginTop:16,borderWidth:1,borderColor:'#684974',borderRadius:16,padding:12}}>
  <Text style={{...text,fontWeight:'900'}}>ID protection • {publicId}</Text>
  {error?<Text accessibilityRole="alert" style={{...text,color:'#FFB4C6'}}>{error}</Text>:null}
  {data?.founder?<Text style={text}>Main Owner protection is fixed.</Text>:data?<>
   <Text style={text}>State: {data.policy?.state||'Not granted'} • Until: {data.policy?.expires_at?new Date(data.policy.expires_at).toLocaleString():'Permanent'}</Text>
   {options.map(([key,label])=><Pressable key={key} disabled={busy} onPress={()=>setKeys(previous=>previous.includes(key)?previous.filter(x=>x!==key):[...previous,key])}><Text style={text}>{keys.includes(key)?'✓ ':'○ '}{label}</Text></Pressable>)}
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{[['permanent','PERMANENT'],['months','MANUAL MONTHS'],['date','EXACT EXPIRY']].map(([key,label])=><Pressable key={key} disabled={busy} onPress={()=>setTerm(key)}><Text style={text}>{term===key?'✓ ':''}{label}</Text></Pressable>)}</View>
   {term==='months'?<TextInput accessibilityLabel="Protection months" value={months} onChangeText={setMonths} editable={!busy} keyboardType="number-pad" placeholder="e.g. 1, 2, 4, 10" placeholderTextColor="#A9B2C4" style={field}/>:null}
   {term==='date'?<TextInput accessibilityLabel="Protection UTC expiry" value={date} onChangeText={setDate} editable={!busy} placeholder="2027-01-01T00:00:00Z" placeholderTextColor="#A9B2C4" style={field}/>:null}
   <TextInput accessibilityLabel="Protection audit reason" value={reason} onChangeText={setReason} editable={!busy} placeholder="Reason" placeholderTextColor="#A9B2C4" style={field}/>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{[['save','GRANT / EDIT'],['freeze','FREEZE'],['resume','RESUME'],['revoke','REVOKE'],['remove','REMOVE']].map(([key,label])=><Pressable key={key} disabled={busy} onPress={()=>save(key)}><Text style={text}>{label}</Text></Pressable>)}</View>
   <Text style={text}>Protection grants no Owner role or coin authority. Self actions and Owner corrections remain available. Freeze keeps the original expiry.</Text>
   {(data.history||[]).map(row=><Text key={row.id} style={text}>{new Date(row.created_at).toLocaleString()} • {row.action} • {row.reason}</Text>)}
  </>:<Text style={text}>{busy?'Loading protection…':'Protection unavailable. Reload to retry.'}</Text>}
  <Pressable disabled={busy} onPress={load}><Text style={text}>{busy?'CHECKING / SAVING…':'RELOAD PROTECTION'}</Text></Pressable>
 </View>;
}

