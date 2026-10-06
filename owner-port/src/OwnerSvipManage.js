import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {supabase} from '../lib/supabase';
const uuid=()=>globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
const actions=['grant','upgrade','downgrade','extend','reduce','set_expiry','make_permanent','remove_permanent','freeze','unfreeze','revoke','restore'];
const tierActions=['grant','upgrade','downgrade','restore'];
const actionRows=[actions.slice(0,3),actions.slice(3,6),actions.slice(6,8),actions.slice(8)];
const dayActions=['grant','upgrade','downgrade','extend','reduce','remove_permanent','restore'];
const Button=({children,onPress,disabled})=><Pressable disabled={disabled} onPress={onPress} style={[s.button,disabled&&{opacity:.4}]}><Text style={s.text}>{children}</Text></Pressable>;
export default function OwnerSvipManage({publicId,onChanged}){
  const lock=useRef(false),request=useRef(null),epochRef=useRef(0);
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[membership,setMembership]=useState(null),[action,setAction]=useState('grant'),[tier,setTier]=useState('1'),[days,setDays]=useState('30'),[expiry,setExpiry]=useState(''),[reason,setReason]=useState(''),[preview,setPreview]=useState(null);
  const rpc=async(name,args)=>{const r=await supabase.rpc(name,args);if(r.error)throw r.error;return r.data;};
  const load=async()=>{const epoch=epochRef.current;const data=await rpc('load_svip_owner_history',{p_public_id:publicId,p_limit:1});if(epoch!==epochRef.current)return;setMembership(data?.membership?.[0]||null);setLoaded(true);};
  const run=async(fn)=>{if(lock.current)return;const epoch=epochRef.current;lock.current=true;setBusy(true);setNotice('');try{await fn();}catch(e){if(epoch===epochRef.current)setNotice(e.message||'Could not complete the action.');}finally{if(epoch===epochRef.current){lock.current=false;setBusy(false);}}};
  useEffect(()=>{epochRef.current+=1;lock.current=false;setLoaded(false);setMembership(null);if(Number.isSafeInteger(publicId)&&publicId>0)void run(load);return()=>{epochRef.current+=1;lock.current=false;};},[publicId]);
  useEffect(()=>{setPreview(null);request.current=null;},[publicId,action,tier,days,expiry,reason]);
  const prepare=async()=>{
    const epoch=epochRef.current;
    if(reason.trim().length<3)throw new Error('Enter a reason for the change.');
    if(tierActions.includes(action)&&(!Number.isInteger(Number(tier))||Number(tier)<1||Number(tier)>10))throw new Error('Choose an SVIP tier from 1 to 10.');
    if(dayActions.includes(action)&&(!Number.isSafeInteger(Number(days))||Number(days)<=0))throw new Error('Enter a positive whole number of days.');
    if(action==='set_expiry'&&(!Number.isFinite(Date.parse(expiry))||Date.parse(expiry)<=Date.now()))throw new Error('Enter a future expiry with timezone, e.g. 2026-12-01T00:00:00+03:00.');
    const args={p_public_id:publicId,p_action:action,p_tier:tierActions.includes(action)?Number(tier):null,p_days:dayActions.includes(action)?Number(days):null,p_exact_expiry:action==='set_expiry'?new Date(expiry).toISOString():null,p_reason:reason.trim(),p_expected_version:membership?.version??0};
    const data=await rpc('owner_mutate_svip',{...args,p_request_id:uuid(),p_preview:true});
    if(epoch!==epochRef.current)return;request.current=uuid();setPreview({args:{...args,p_expected_version:data?.before?.version??0},data});
  };
  const confirm=async()=>{if(!preview)return;const epoch=epochRef.current;await rpc('owner_mutate_svip',{...preview.args,p_request_id:request.current,p_preview:false});if(epoch!==epochRef.current)return;setPreview(null);request.current=null;await load();if(epoch!==epochRef.current)return;setNotice('SVIP updated.');onChanged?.();};
  const summary=value=>value?.tier?`SVIP ${value.tier} • ${value.status} • ${value.permanent?'Permanent':value.ends_at?new Date(value.ends_at).toLocaleString():'No expiry'}`:'No membership';
  return <View style={s.panel}><AiBackdrop opacity={.22}/><Text style={s.title}>SVIP membership</Text><View style={s.statusRow}><Text style={[s.text,s.statusCopy]}>{loaded?summary(membership):busy?'Loading membership…':'Membership unavailable'}</Text><View style={s.progressSlot}>{busy?<ActivityIndicator size="small"/>:null}</View></View>{notice?<Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>:null}<View style={s.actionGrid}>{actionRows.map((row,index)=><View key={index} style={s.actionRow}>{row.map(value=><View key={value} style={s.actionCell}><Button disabled={busy} onPress={()=>setAction(value)}>{action===value?'✓ ':''}{value.replaceAll('_',' ').toUpperCase()}</Button></View>)}</View>)}</View>{tierActions.includes(action)?<><Text style={s.text}>Target tier</Text><TextInput value={tier} onChangeText={setTier} keyboardType="number-pad" style={s.input}/></>:null}{dayActions.includes(action)?<><Text style={s.text}>Days</Text><TextInput value={days} onChangeText={setDays} keyboardType="number-pad" style={s.input}/></>:null}{action==='set_expiry'?<TextInput value={expiry} onChangeText={setExpiry} autoCapitalize="none" placeholder="Expiry date and timezone" placeholderTextColor="#AEBBD0" style={s.input}/>:null}<TextInput value={reason} onChangeText={setReason} placeholder="Reason for change" placeholderTextColor="#AEBBD0" style={s.input}/><Button disabled={busy||!loaded} onPress={()=>run(prepare)}>PREVIEW CHANGE</Button>{preview?<View style={s.panel}><AiBackdrop opacity={.22}/><Text style={s.text}>Before: {summary(preview.data.before)}</Text><Text style={s.text}>After: {summary(preview.data.after)}</Text><View style={s.row}><Button disabled={busy} onPress={()=>run(confirm)}>CONFIRM SVIP CHANGE</Button><Button disabled={busy} onPress={()=>setPreview(null)}>Cancel</Button></View></View>:null}<Button disabled={busy} onPress={()=>run(load)}>REFRESH STATUS</Button></View>;
}
const s=StyleSheet.create({statusRow:{minHeight:28,flexDirection:'row',alignItems:'center',gap:8},statusCopy:{flex:1},progressSlot:{width:22,height:24,justifyContent:'center'},actionGrid:{gap:8},actionRow:{flexDirection:'row',gap:6},actionCell:{flex:1,minWidth:0},panel:{padding:12,borderWidth:1,borderColor:'#43516D',borderRadius:12,gap:10},title:{color:'#FFF',fontSize:17,fontWeight:'800'},text:{color:'#D9E3F5',fontSize:12},notice:{color:'#8BE7E0'},row:{flexDirection:'row',flexWrap:'wrap',gap:8},button:{minHeight:52,justifyContent:'center',padding:8,borderRadius:9,backgroundColor:'#294168'},input:{color:'#FFF',borderWidth:1,borderColor:'#65718C',borderRadius:9,minHeight:44,padding:10}});

