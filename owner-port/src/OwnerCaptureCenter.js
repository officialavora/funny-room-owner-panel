import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{useCallback,useEffect,useState} from 'react';
import {Alert,StyleSheet,View} from 'react-native';
import {supabase} from '../lib/supabase';
import { PREMIUM } from './designSystem';

const C={panel:PREMIUM.colors.panel,panel2:PREMIUM.colors.panelSoft,line:PREMIUM.colors.line,text:PREMIUM.colors.text,muted:PREMIUM.colors.muted,purple:PREMIUM.colors.violet,cyan:PREMIUM.colors.cyan,gold:PREMIUM.colors.gold,danger:PREMIUM.colors.rose,green:PREMIUM.colors.green};
const left=v=>{if(!v)return 'UNTIL CHANGED';const ms=new Date(v).getTime()-Date.now();if(ms<=0)return 'EXPIRED';const m=Math.ceil(ms/60000);if(m<60)return `${m}m left`;const h=Math.ceil(m/60);return h<48?`${h}h left`:`${Math.ceil(h/24)}d left`;};

export default function OwnerCaptureCenter(){
  const [kind,setKind]=useState('screen');
  const [scope,setScope]=useState('user');
  const [value,setValue]=useState('');
  const [duration,setDuration]=useState(120);
  const [rows,setRows]=useState([]);
  const [busy,setBusy]=useState(false);
  const [accessState,setAccessState]=useState('loading');
  const [loadError,setLoadError]=useState('');

  const refresh=useCallback(async()=>{
    setLoadError('');
    const access=await supabase.rpc('current_staff_access');
    if(access.error||access.data?.role!=='owner'){setAccessState('unauthorized');setRows([]);return;}
    setAccessState('loading');
    const {data,error}=await supabase.rpc('owner_capture_overrides',{p_capture_type:kind});
    if(error){setAccessState('error');setLoadError(error.message||'Capture rules could not be loaded.');setRows([]);return;}
    setAccessState('ready');setRows(data||[]);
  },[kind]);
  useEffect(()=>{refresh();},[refresh]);

  const apply=async(allow,row=null)=>{
    const targetScope=row?.scope_type||scope;
    const targetValue=row?.scope_value||(targetScope==='all'?'*':value.trim());
    if(targetScope!=='all'&&!/^\d{4,}$/.test(targetValue))return Alert.alert(targetScope==='room'?'Room ID required':'Permanent ID required');
    const run=async()=>{
      setBusy(true);
      const {data,error}=await supabase.rpc('owner_set_capture_override',{p_capture_type:kind,p_scope_type:targetScope,p_scope_value:targetValue,p_enabled:allow,p_duration_minutes:duration});
      setBusy(false);
      if(error)return Alert.alert(kind==='audio'?'Audio capture control':'Screen capture control',error.message);
      if(targetScope!=='all')setValue('');
      await refresh();
      const noun=kind==='audio'?'internal audio recording':'screenshot/screen recording';
      Alert.alert(allow?'Recording ON':'Recording OFF',allow?`${data?.target_name||targetValue} can use ${noun} while this rule is active.`:`${data?.target_name||targetValue} is protected from ${noun} while this rule is active.`);
    };
    if(targetScope==='all')return Alert.alert(allow?'Allow recording for ALL?':'Block recording for ALL?',allow?`This temporarily allows ${kind==='audio'?'internal audio':'screen'} capture for every authenticated account.`:`This blocks ${kind==='audio'?'internal audio':'screen'} capture for every authenticated account.`,[{text:'Cancel',style:'cancel'},{text:allow?'RECORD ON':'RECORD OFF',style:allow?'default':'destructive',onPress:run}]);
    return run();
  };

  if(accessState==='unauthorized')return null;
  if(accessState==='loading')return <View style={s.wrap}><AiBackdrop opacity={.22}/><Text style={s.title}>Owner Capture Control</Text><Text style={s.help}>Loading capture policy…</Text></View>;
  if(accessState==='error')return <View style={s.wrap}><AiBackdrop opacity={.22}/><Text style={s.title}>Owner Capture Control</Text><Text style={s.errorText}>Capture policy unavailable: {loadError}</Text><Pressable onPress={refresh} style={s.retry}><Text style={s.retryText}>RETRY</Text></Pressable></View>;
  const active=rows.filter(x=>x.expires_at==null||new Date(x.expires_at)>new Date());
  return <View style={s.wrap}><AiBackdrop opacity={.22}/>
    <View style={s.head}><View style={s.flex}><Text style={s.title}>Owner Capture Control</Text><Text style={s.help}>Screen and internal-audio recording are separate audited rules. Choose a protection, then apply it to ALL, one permanent ID, or one room. Internal-audio blocking is supported on Android 10+.</Text></View><Text style={s.icon}>{kind==='audio'?'🔇':'🎥'}</Text></View>
    <View style={s.kindRow}>{[['screen','SCREEN'],['audio','INTERNAL AUDIO']].map(([key,label])=><Pressable key={key} onPress={()=>setKind(key)} style={[s.kind,kind===key&&s.kindOn]}><Text style={[s.kindText,kind===key&&s.kindTextOn]}>{label}</Text></Pressable>)}</View>
    <View style={s.scopeRow}>{[['all','ALL'],['user','USER ID'],['room','ROOM ID']].map(([key,label])=><Pressable key={key} onPress={()=>setScope(key)} style={[s.scope,scope===key&&s.scopeOn]}><Text style={[s.scopeText,scope===key&&s.scopeTextOn]}>{label}</Text></Pressable>)}</View>
    {scope!=='all'?<TextInput value={value} onChangeText={setValue} keyboardType="number-pad" placeholder={scope==='room'?'Room permanent ID':'User permanent ID'} placeholderTextColor="#737B8E" style={s.input}/>:null}
    <View style={s.durationRow}>{[[30,'30m'],[120,'2h'],[1440,'24h'],[0,'UNTIL CHANGED']].map(([mins,label])=><Pressable key={label} onPress={()=>setDuration(mins)} style={[s.duration,duration===mins&&s.durationOn]}><Text style={s.durationText}>{label}</Text></Pressable>)}</View>
    <View style={s.switchRow}><Pressable disabled={busy} onPress={()=>apply(true)} style={[s.on,busy&&s.disabled]}><Text style={s.onText}>{busy?'WORKING…':kind==='audio'?'AUDIO RECORD ON':'SCREEN RECORD ON'}</Text></Pressable><Pressable disabled={busy} onPress={()=>apply(false)} style={[s.block,busy&&s.disabled]}><Text style={s.blockText}>{kind==='audio'?'AUDIO RECORD OFF':'SCREEN RECORD OFF'}</Text></Pressable></View>
    {active.length?<><Text style={s.sub}>Active capture rules</Text>{active.map(row=><View key={`${row.scope_type}:${row.scope_value}`} style={s.row}><View style={s.flex}><Text style={s.rowTitle}>{String(row.scope_type).toUpperCase()} • {row.target_name}</Text><Text style={[s.decision,{color:row.enabled?C.green:C.danger}]}>{row.enabled?'RECORDING ON':'RECORDING OFF'} • {left(row.expires_at)}</Text></View><View style={s.rowActions}><Pressable disabled={busy} onPress={()=>apply(true,row)} style={s.miniOn}><Text style={s.miniOnText}>ON</Text></Pressable><Pressable disabled={busy} onPress={()=>apply(false,row)} style={s.miniOff}><Text style={s.miniOffText}>OFF</Text></Pressable></View></View>)}</>:null}
  </View>;
}

const s=StyleSheet.create({errorText:{color:C.danger,fontSize:9,lineHeight:14,marginTop:7},retry:{alignSelf:'flex-start',minHeight:34,borderRadius:10,backgroundColor:'#2C2357',borderWidth:1,borderColor:C.cyan,paddingHorizontal:14,alignItems:'center',justifyContent:'center',marginTop:9},retryText:{color:C.text,fontSize:8,fontWeight:'900'},kindRow:{flexDirection:'row',gap:7,marginTop:10},kind:{flex:1,minHeight:40,borderRadius:12,backgroundColor:'#181D2B',borderWidth:1,borderColor:'#2A3042',alignItems:'center',justifyContent:'center'},kindOn:{backgroundColor:'#32266D',borderColor:'#5FE2FF'},kindText:{color:'#9199AD',fontSize:8,fontWeight:'900'},kindTextOn:{color:'#F8F9FF'},wrap:{backgroundColor:'#10141E',borderWidth:1,borderColor:'#684974',borderRadius:20,padding:12,marginTop:14},head:{flexDirection:'row',alignItems:'flex-start',gap:10},flex:{flex:1},title:{color:C.text,fontSize:17,fontWeight:'900'},help:{color:C.muted,fontSize:9,lineHeight:14,marginTop:4},icon:{fontSize:26},scopeRow:{flexDirection:'row',gap:6,marginTop:10},scope:{flex:1,minHeight:38,borderRadius:12,backgroundColor:'#281B35',borderWidth:1,borderColor:'#684974',alignItems:'center',justifyContent:'center'},scopeOn:{backgroundColor:'#4B35B3',borderColor:C.gold},scopeText:{color:C.muted,fontSize:8,fontWeight:'900'},scopeTextOn:{color:'#fff'},input:{minHeight:45,borderRadius:12,backgroundColor:'#0D1019',borderWidth:1,borderColor:'#30364A',color:C.text,paddingHorizontal:12,marginTop:9},durationRow:{flexDirection:'row',gap:5,marginTop:8},duration:{flex:1,minHeight:34,borderRadius:10,backgroundColor:'#281B35',alignItems:'center',justifyContent:'center'},durationOn:{backgroundColor:'#2C2357',borderWidth:1,borderColor:C.cyan},durationText:{color:C.text,fontSize:7,fontWeight:'900'},switchRow:{flexDirection:'row',gap:7,marginTop:9},on:{flex:1,minHeight:44,borderRadius:12,backgroundColor:'#1C5A43',alignItems:'center',justifyContent:'center'},onText:{color:'#B9FFD9',fontSize:9,fontWeight:'900'},block:{flex:1,minHeight:44,borderRadius:12,backgroundColor:'#4A1F2B',alignItems:'center',justifyContent:'center'},blockText:{color:'#FFB3C1',fontSize:9,fontWeight:'900'},disabled:{opacity:.55},sub:{color:C.text,fontSize:13,fontWeight:'900',marginTop:15,marginBottom:6},row:{minHeight:62,borderRadius:14,backgroundColor:'#180F25',borderWidth:1,borderColor:'#684974',padding:9,marginBottom:6,flexDirection:'row',alignItems:'center',gap:8},rowTitle:{color:C.text,fontSize:9,fontWeight:'900'},decision:{fontSize:8,fontWeight:'900',marginTop:4},rowActions:{flexDirection:'row',gap:5},miniOn:{minWidth:36,minHeight:32,borderRadius:9,backgroundColor:'#17392D',alignItems:'center',justifyContent:'center'},miniOnText:{color:C.green,fontSize:7,fontWeight:'900'},miniOff:{minWidth:36,minHeight:32,borderRadius:9,backgroundColor:'#3A1E29',alignItems:'center',justifyContent:'center'},miniOffText:{color:C.danger,fontSize:7,fontWeight:'900'}});

