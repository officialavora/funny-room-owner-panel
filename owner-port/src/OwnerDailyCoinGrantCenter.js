import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,StyleSheet,View} from 'react-native';
import {dailyCoinRpc} from './dailyCoinGrantApi';
import OwnerDailySignInRewards from './OwnerDailySignInRewards';

export default function OwnerDailyCoinGrantCenter(){
 const [policy,setPolicy]=useState(null),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reason,setReason]=useState('');
 const alive=useRef(true),pending=useRef(null);
 const refresh=async()=>{
  if(pending.current)return;const controller=new AbortController();pending.current=controller;setBusy(true);setError('');
  try{const data=await dailyCoinRpc('owner_load_daily_coin_policy_v1',undefined,controller.signal);if(alive.current){setPolicy(data);setDraft(data?{...data,amount:String(data.amount),duration_days:data.duration_days==null?'':String(data.duration_days)}:null);}}
  catch(e){if(alive.current)setError(e.message);}
  finally{if(pending.current===controller)pending.current=null;if(alive.current)setBusy(false);}
 };
 useEffect(()=>{alive.current=true;refresh();return()=>{alive.current=false;pending.current?.abort();};},[]);
 const edit=(key,value)=>setDraft(x=>({...x,[key]:value}));
 const save=()=>{
  if(!policy||!draft||pending.current)return;
  if(!/^\d+$/.test(draft.amount)||Number(draft.amount)>1e12)return setError('Enter a whole coin amount from 0 to 1,000,000,000,000.');
  if(draft.duration_days&&(!/^\d+$/.test(draft.duration_days)||Number(draft.duration_days)<1))return setError('Duration must be a positive number of campaign days, or blank.');
  if(reason.trim().length<5)return setError('Enter an audit reason of at least five characters.');
  for(const field of ['starts_at','cohort_cutoff'])if(!draft[field]||!Number.isFinite(Date.parse(draft[field])))return setError('Enter valid start and cohort cutoff dates.');
  if(draft.ends_at&&(!Number.isFinite(Date.parse(draft.ends_at))||Date.parse(draft.ends_at)<=Date.parse(draft.starts_at)))return setError('End must be after start.');
  const config={enabled:draft.enabled,amount:Number(draft.amount),cohort:draft.cohort,cohort_cutoff:draft.cohort_cutoff,starts_at:draft.starts_at,ends_at:draft.ends_at||null,duration_days:draft.duration_days?Number(draft.duration_days):null,archived:draft.archived};
  Alert.alert('Confirm daily reward policy',`${config.archived?'Archived':config.enabled?'Enabled':'Disabled'} · ${config.amount.toLocaleString()} coins/day · ${config.cohort} users.\nStarts ${config.starts_at}.\nEnd ${config.ends_at||'none'}; campaign duration ${config.duration_days||'unlimited'} days.\nPast credits stay saved.`,[{text:'Cancel'},{text:'Save',onPress:async()=>{
   if(pending.current)return;const controller=new AbortController();pending.current=controller;setBusy(true);setError('');
   try{const data=await dailyCoinRpc('owner_save_daily_coin_policy_v1',{p_config:config,p_expected_updated_at:policy.updated_at,p_reason:reason.trim()},controller.signal);if(alive.current){setPolicy(data);setDraft({...data,amount:String(data.amount),duration_days:data.duration_days==null?'':String(data.duration_days)});setReason('');}}
   catch(e){if(alive.current)setError(e.message);}
   finally{if(pending.current===controller)pending.current=null;if(alive.current)setBusy(false);}
  }}]);
 };
 return <View style={s.card}><AiBackdrop opacity={.22}/><Text style={s.title}>Daily app-open coins</Text><Text style={s.help}>One credit per Riyadh reward-day after authenticated app open. No missed-day arrears. New users are created at or after the cohort cutoff. Duration applies to the whole campaign from its start; an explicit end also limits it.</Text>{error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}<Button label={busy?'Checking…':'Reload policy'} disabled={busy} onPress={refresh}/>{!policy?<Text style={s.help}>{busy?'Loading policy…':error?'Retry to load the policy.':'Daily reward policy is unavailable.'}</Text>:<><Text style={s.help}>Server timezone: {policy.timezone} · Effective end: {policy.effective_ends_at||'none'}</Text><View style={s.row}><Button label={draft.enabled?'Enabled':'Disabled'} disabled={busy} onPress={()=>edit('enabled',!draft.enabled)}/><Button label={draft.archived?'Archived':'Active configuration'} disabled={busy} onPress={()=>edit('archived',!draft.archived)}/></View><Field label="Coins per day" value={draft.amount} onChangeText={v=>edit('amount',v)} disabled={busy}/><View style={s.row}>{['both','new','old'].map(x=><Button key={x} label={`${draft.cohort===x?'✓ ':''}${x}`} disabled={busy} onPress={()=>edit('cohort',x)}/>)}</View>{[['cohort_cutoff','New / old cutoff (ISO date)'],['starts_at','Campaign starts (ISO date)'],['ends_at','Campaign ends (blank: no fixed end)'],['duration_days','Campaign duration days (blank: unlimited)']].map(([key,label])=><Field key={key} label={label} value={draft[key]||''} onChangeText={v=>edit(key,v)} disabled={busy}/>)}<Field label="Mandatory audit reason" value={reason} onChangeText={setReason} disabled={busy}/><Button label="Review and save" disabled={busy} onPress={save}/><Text style={s.help}>Archive stops future daily credits. Wallet entries and reward history remain saved. The existing welcome grant is separate.</Text></>}<OwnerDailySignInRewards/></View>;
}
const Field=({label,value,onChangeText,disabled})=><View><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!disabled} value={value} onChangeText={onChangeText} style={s.input}/></View>;
const Button=({label,onPress,disabled})=><Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button,disabled&&{opacity:.4}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
const s=StyleSheet.create({card:{marginTop:16,padding:14,borderRadius:14,borderWidth:1,borderColor:'#334155',backgroundColor:'#111a33'},title:{color:'#fff',fontSize:18,fontWeight:'900'},help:{color:'#cbd5e1',fontSize:12,lineHeight:18,marginVertical:8},error:{color:'#fda4af',marginVertical:8},row:{flexDirection:'row',flexWrap:'wrap'},label:{color:'#cbd5e1',marginTop:10},input:{color:'#fff',backgroundColor:'#080d1c',borderRadius:8,padding:10,borderWidth:1,borderColor:'#475569'},button:{backgroundColor:'#7c3aed',padding:11,borderRadius:10,marginTop:10,marginRight:6},buttonText:{color:'#fff',fontWeight:'800'}});

