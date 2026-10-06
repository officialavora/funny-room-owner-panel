import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{forwardRef,useCallback,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {ActivityIndicator,Share,StyleSheet,View} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {supabase} from '../lib/supabase';
import { PREMIUM } from './designSystem';

const C={panel:PREMIUM.colors.panel,panel2:PREMIUM.colors.panelSoft,line:PREMIUM.colors.line,text:PREMIUM.colors.text,muted:PREMIUM.colors.muted,purple:PREMIUM.colors.violet,cyan:PREMIUM.colors.cyan,gold:PREMIUM.colors.gold,danger:PREMIUM.colors.rose,green:PREMIUM.colors.green};
const duration=value=>{let s=Math.max(0,Number(value||0));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);return [d&&d+'d',h&&h+'h',m&&m+'m'].filter(Boolean).join(' ')||'<1m'};
const when=value=>value?new Date(value).toLocaleString():'—';
const Stat=({label,value})=><View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>;
const Copy=({value})=><Pressable style={s.copy} onPress={()=>Clipboard.setStringAsync(String(value||''))}><Text style={s.copyText}>⧉</Text></Pressable>;
const isSessionError=error=>error?.status===401||error?.status===403||['PGRST301','PGRST302'].includes(error?.code)||/jwt|session|token.*expired/i.test(String(error?.message||''));

const OwnerUserAnalyticsCenter=forwardRef(function OwnerUserAnalyticsCenter({onNotice,onRefreshStateChange},ref){
  const [overview,setOverview]=useState(null),[publicId,setPublicId]=useState(''),[data,setData]=useState(null),[audit,setAudit]=useState(null),[busy,setBusy]=useState(false);
  const [refreshing,setRefreshing]=useState(false),[refreshError,setRefreshError]=useState('');
  const mountedRef=useRef(false),requestSequenceRef=useRef(0),activeRefreshRef=useRef(null),onNoticeRef=useRef(onNotice),onRefreshStateChangeRef=useRef(onRefreshStateChange);
  onNoticeRef.current=onNotice;
  onRefreshStateChangeRef.current=onRefreshStateChange;
  const notify=useCallback(x=>onNoticeRef.current?.(x),[]);
  const refreshOverview=useCallback(()=>{
    if(activeRefreshRef.current)return activeRefreshRef.current;
    const requestSequence=++requestSequenceRef.current;
    if(mountedRef.current){
      setRefreshing(true);
      setRefreshError('');
      onRefreshStateChangeRef.current?.(true);
    }
    const request=(async()=>{
      try{
        let result=await supabase.rpc('owner_analytics_overview');
        if(result.error&&isSessionError(result.error)){
          const sessionResult=await supabase.auth.refreshSession();
          if(sessionResult.error)throw sessionResult.error;
          result=await supabase.rpc('owner_analytics_overview');
        }
        if(result.error)throw result.error;
        if(mountedRef.current&&requestSequence===requestSequenceRef.current){
          setOverview(result.data);
          setRefreshError('');
        }
        return result.data;
      }catch(error){
        if(mountedRef.current&&requestSequence===requestSequenceRef.current){
          const message=error?.message||'Users analytics could not be refreshed.';
          setRefreshError(message);
          notify(message);
        }
        return null;
      }finally{
        if(requestSequence===requestSequenceRef.current){
          activeRefreshRef.current=null;
          if(mountedRef.current){
            setRefreshing(false);
            onRefreshStateChangeRef.current?.(false);
          }
        }
      }
    })();
    activeRefreshRef.current=request;
    return request;
  },[notify]);
  useImperativeHandle(ref,()=>({refresh:refreshOverview}),[refreshOverview]);
  useEffect(()=>{
    mountedRef.current=true;
    refreshOverview();
    return ()=>{
      mountedRef.current=false;
      requestSequenceRef.current+=1;
      activeRefreshRef.current=null;
      onRefreshStateChangeRef.current?.(false);
    };
  },[refreshOverview]);
  const lookup=async()=>{const id=Number(publicId);if(!id)return notify('Enter a valid permanent ID');setBusy(true);const [profileResult,auditResult]=await Promise.all([supabase.rpc('owner_user_analytics',{p_public_id:id}),supabase.rpc('owner_session_audit',{p_public_id:id})]);setBusy(false);if(profileResult.error)return notify(profileResult.error.message);if(auditResult.error)return notify(auditResult.error.message);setData(profileResult.data);setAudit(auditResult.data);notify('Private analytics opened and audit logged')};
  const setDeviceTrust=async(deviceId,status)=>{setBusy(true);const {error}=await supabase.rpc('owner_set_device_trust',{p_device_id:deviceId,p_status:status});setBusy(false);if(error)return notify(error.message);notify(`Device marked ${status}`);await lookup()};
  const recordRecovery=async(status)=>{const id=Number(publicId);if(!id)return notify('Open a user report first');setBusy(true);const {error}=await supabase.rpc('owner_record_account_security_review',{p_public_id:id,p_status:status,p_note:'Owner Center verified linked account recovery request'});setBusy(false);if(error)return notify(error.message);notify(status==='verified'?'Account ownership verified':'Account marked for security review')};
  const t=data?.totals||{},p=data?.profile||{},q=data?.private||{};
  const exportReport=async()=>{if(!data)return;const lines=[`Funny Room User Analytics`,`ID: ${p.public_id||'—'}`,`Name: ${p.display_name||'—'}`,`Joined: ${when(p.created_at)}`,`Last seen: ${when(q.last_seen_at)}`,`Email: ${q.email||'Not linked'}`,`Mobile: ${q.phone||'Not linked'}`,`App sessions: ${t.app_sessions||0}`,`Online time: ${duration(t.online_seconds)}`,`Room visits: ${t.room_sessions||0}`,`Room time: ${duration(t.room_seconds)}`,`Messages: ${Number(t.room_messages||0)+Number(t.direct_messages||0)}`,`Gifts sent: ${t.gifts_sent||0}`,`Gifts received: ${t.gifts_received||0}`,`Game plays: ${t.game_plays||0}`,`Devices: ${(data.devices||[]).length}`,`Location data: Not collected`];await Share.share({title:`User ${p.public_id||''} analytics`,message:lines.join('\n')})};
  return <View style={s.panel}><AiBackdrop opacity={.22}/>
    <View style={s.heading}><View style={{flex:1}}><Text style={s.eyebrow}>OWNER • USER ANALYTICS</Text><Text style={s.title}>Users, devices and real activity</Text><Text style={s.hint}>No GPS, city, area, IP location or live-location collection. Every private report view is audit logged.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh users analytics" disabled={refreshing} onPress={refreshOverview} style={[s.refresh,refreshing&&s.refreshDisabled]}>{refreshing?<ActivityIndicator color={C.cyan}/>:<Text style={s.refreshText}>↻</Text>}</Pressable></View>
    {refreshError?<View style={s.refreshError}><Text style={s.refreshErrorText}>Could not refresh. Last valid figures are still shown.</Text><Pressable disabled={refreshing} onPress={refreshOverview} style={s.retry}><Text style={s.retryText}>Retry</Text></Pressable></View>:null}
    {overview?<View style={s.grid}>
      <Stat label="TOTAL USERS" value={Number(overview.total_users||0).toLocaleString()}/><Stat label="NEW TODAY" value={Number(overview.new_today||0).toLocaleString()}/>
      <Stat label="ONLINE NOW" value={Number(overview.online_now||0).toLocaleString()}/><Stat label="ACTIVE TODAY" value={Number(overview.active_today||0).toLocaleString()}/><Stat label="ACTIVE 7 DAYS" value={Number(overview.active_7d||0).toLocaleString()}/><Stat label="ACTIVE 30 DAYS" value={Number(overview.active_30d||0).toLocaleString()}/><Stat label="DEVICES" value={Number(overview.total_devices||0).toLocaleString()}/>
      <Stat label="ONLINE TODAY" value={duration(overview.online_seconds_today)}/><Stat label="ROOM TIME TODAY" value={duration(overview.room_seconds_today)}/><Stat label="APP SESSIONS" value={Number(overview.total_app_sessions||0).toLocaleString()}/><Stat label="ROOM SESSIONS" value={Number(overview.total_room_sessions||0).toLocaleString()}/>
    </View>:null}
    {overview?<><Text style={s.tracking}>Tracking started {when(overview.first_tracked_activity)} • Latest activity {when(overview.last_tracked_activity)}</Text><Text style={s.section}>APP VERSION ADOPTION</Text>{(overview.app_versions||[]).map(v=><View key={v.app_version} style={s.versionRow}><Text style={s.versionName}>Version {v.app_version}</Text><Text style={s.versionCount}>{Number(v.users||0).toLocaleString()} users</Text></View>)}</>:null}
    <View style={s.search}><TextInput value={publicId} onChangeText={setPublicId} onSubmitEditing={lookup} keyboardType="number-pad" placeholder="Permanent user ID" placeholderTextColor={C.muted} style={s.input}/><Pressable disabled={busy} onPress={lookup} style={s.button}>{busy?<ActivityIndicator color="#fff"/>:<Text style={s.buttonText}>Open report</Text>}</Pressable></View>
    {data?<View style={s.report}>
      <View style={s.identity}><View style={{flex:1}}><Text style={s.name}>{p.display_name||'Member'}</Text><View style={s.inline}><Text style={s.meta}>ID {p.public_id} • {p.status} • Profile country {p.country_code||'not set'}</Text><Copy value={p.public_id}/></View><Text style={s.meta}>Joined {when(p.created_at)} • Last seen {when(q.last_seen_at)}</Text></View><Pressable onPress={exportReport} style={s.export}><Text style={s.exportText}>Export</Text></Pressable></View>
      <Text style={s.section}>PRIVATE ACCOUNT • RECOVERY SUPPORT</Text><Text style={s.recovery}>Use the linked email and sign-in provider only after verifying the permanent ID owner. Google accounts must be recovered through Google; Funny Room must never ask for the user’s Gmail password.</Text>
      <View style={s.privateRow}><Text style={s.privateLabel}>Email / Gmail</Text><Text style={s.privateValue}>{q.email||'Not linked'}</Text><Copy value={q.email}/></View>
      <View style={s.privateRow}><Text style={s.privateLabel}>Mobile</Text><Text style={s.privateValue}>{q.phone||'Not linked'}</Text><Copy value={q.phone}/></View>
      <View style={s.privateRow}><Text style={s.privateLabel}>Sign-in</Text><Text style={s.privateValue}>{q.signup_provider||'Unknown'} • {when(q.last_sign_in_at)}</Text></View>
      <View style={s.securityActions}><Pressable disabled={busy} onPress={()=>recordRecovery('verified')} style={[s.securityButton,s.trusted]}><Text style={s.securityText}>VERIFY OWNER</Text></Pressable><Pressable disabled={busy} onPress={()=>recordRecovery('review')} style={[s.securityButton,s.untrusted]}><Text style={s.securityText}>FLAG REVIEW</Text></Pressable></View>
      <Text style={s.section}>LIFETIME ACTIVITY</Text>
      <View style={s.grid}>
        <Stat label="APP SESSIONS" value={t.app_sessions||0}/><Stat label="ONLINE TIME" value={duration(t.online_seconds)}/>
        <Stat label="ROOM VISITS" value={t.room_sessions||0}/><Stat label="ROOM TIME" value={duration(t.room_seconds)}/>
        <Stat label="ROOM MESSAGES" value={t.room_messages||0}/><Stat label="INBOX MESSAGES" value={t.direct_messages||0}/>
        <Stat label="GIFTS SENT" value={t.gifts_sent||0}/><Stat label="COINS SENT" value={Number(t.gift_coins_sent||0).toLocaleString()}/>
        <Stat label="GIFTS RECEIVED" value={t.gifts_received||0}/><Stat label="COINS RECEIVED" value={Number(t.gift_coins_received||0).toLocaleString()}/>
        <Stat label="GAME PLAYS" value={t.game_plays||0}/>
      </View>
      <Text style={s.section}>DEVICES</Text>
      {(data.devices||[]).length?(data.devices||[]).map(d=><View key={d.id} style={s.row}><View style={s.deviceHead}><Text style={s.rowTitle}>{String(d.platform||'device').toUpperCase()} • {d.device_name||'Unknown model'}</Text><Text style={[s.trustBadge,d.trust_status==='trusted'?s.trusted:d.trust_status==='untrusted'?s.untrusted:null]}>{String(d.trust_status||'unverified').toUpperCase()}</Text></View><Text style={s.rowMeta}>OS {d.os_version||'—'} • App {d.app_version||'—'} • {d.locale||'—'}</Text><Text style={s.rowMeta}>First {when(d.first_seen_at)} • Last {when(d.last_seen_at)}</Text><View style={s.securityActions}><Pressable disabled={busy} onPress={()=>setDeviceTrust(d.id,'trusted')} style={[s.securityButton,s.trusted]}><Text style={s.securityText}>TRUST</Text></Pressable><Pressable disabled={busy} onPress={()=>setDeviceTrust(d.id,'untrusted')} style={[s.securityButton,s.untrusted]}><Text style={s.securityText}>UNTRUST</Text></Pressable></View></View>):<Text style={s.empty}>No registered device yet.</Text>}
      <Text style={s.section}>RECENT APP SESSIONS</Text>
      {(audit?.app_sessions||data.recent_sessions||[]).slice(0,12).map(x=><View key={x.id} style={s.row}><Text style={s.rowTitle}>{String(x.platform||'app').toUpperCase()} • {duration(x.effective_seconds??x.active_seconds)}</Text><Text style={s.rowMeta}>{when(x.started_at)} → {x.effective_end_at?when(x.effective_end_at):x.ended_at?when(x.ended_at):'Active'}</Text><Text style={s.rowMeta}>End: {x.final_reason||x.end_reason||'open'} • Source: {x.finalization_source||'—'}{x.reconciliation_basis?` • Basis: ${x.reconciliation_basis}`:''}</Text></View>)}
      <Text style={s.section}>RECENT ROOM VISITS</Text>
      {(audit?.room_sessions||data.recent_rooms||[]).slice(0,12).map(x=><View key={x.id} style={s.row}><Text style={s.rowTitle}>{x.room_name||'Room'} • ID {x.room_public_id||'—'} • {duration(x.effective_seconds??x.active_seconds)}</Text><Text style={s.rowMeta}>{when(x.joined_at)} → {x.effective_end_at?when(x.effective_end_at):x.left_at?when(x.left_at):'Active'}</Text><Text style={s.rowMeta}>End: {x.final_reason||x.leave_reason||'open'} • Source: {x.finalization_source||'—'}</Text></View>)}
      <Text style={s.section}>LIFECYCLE EVIDENCE</Text>
      {(audit?.events||[]).slice(0,30).map(x=><View key={x.id} style={s.row}><Text style={s.rowTitle}>{String(x.event_type||'event').replaceAll('_',' ').toUpperCase()}</Text><Text style={s.rowMeta}>{when(x.occurred_at)}{x.room_public_id?` • Room ${x.room_public_id}`:''} • {x.session_kind}</Text></View>)}
    </View>:null}
  </View>;
});
export default OwnerUserAnalyticsCenter;
const s=StyleSheet.create({deviceHead:{flexDirection:'row',alignItems:'center',gap:8},trustBadge:{marginLeft:'auto',color:C.gold,fontSize:7,fontWeight:'900',paddingHorizontal:7,paddingVertical:4,borderRadius:8,backgroundColor:'#282335'},securityActions:{flexDirection:'row',gap:7,marginTop:8},securityButton:{flex:1,minHeight:34,borderRadius:10,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#684974'},trusted:{backgroundColor:'#174932',borderColor:'#2D996A'},untrusted:{backgroundColor:'#512330',borderColor:'#A74761'},securityText:{color:'#fff',fontSize:7,fontWeight:'900'},
 refreshDisabled:{opacity:.7},refreshError:{minHeight:38,borderRadius:11,backgroundColor:'#2D1B28',borderWidth:1,borderColor:C.danger,paddingHorizontal:10,marginTop:9,flexDirection:'row',alignItems:'center',gap:8},refreshErrorText:{flex:1,color:C.text,fontSize:8,lineHeight:12,fontWeight:'700'},retry:{minWidth:56,minHeight:28,borderRadius:9,backgroundColor:'#67407C',alignItems:'center',justifyContent:'center'},retryText:{color:'#fff',fontSize:8,fontWeight:'900'},
 panel:{marginTop:16,borderRadius:22,backgroundColor:'#180F25',borderWidth:1,borderColor:'#684974',padding:14},heading:{flexDirection:'row',alignItems:'flex-start'},eyebrow:{color:C.cyan,fontSize:8,fontWeight:'900',letterSpacing:1},title:{color:C.text,fontSize:17,fontWeight:'900',marginTop:4},hint:{color:C.muted,fontSize:8,lineHeight:12,marginTop:5},refresh:{width:36,height:36,borderRadius:12,backgroundColor:'#281B35',alignItems:'center',justifyContent:'center'},refreshText:{color:C.cyan,fontSize:20,fontWeight:'900'},grid:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10},stat:{width:'31%',minWidth:92,minHeight:63,borderRadius:14,backgroundColor:'#281B35',borderWidth:1,borderColor:'#684974',padding:9},statValue:{color:C.gold,fontSize:14,fontWeight:'900'},statLabel:{color:C.muted,fontSize:6.5,fontWeight:'900',marginTop:5},search:{flexDirection:'row',gap:7,marginTop:13},input:{flex:1,minHeight:44,borderRadius:13,backgroundColor:'#281B35',borderWidth:1,borderColor:'#684974',color:C.text,paddingHorizontal:12},button:{minWidth:104,minHeight:44,borderRadius:13,backgroundColor:'#67407C',alignItems:'center',justifyContent:'center',paddingHorizontal:12},buttonText:{color:'#fff',fontSize:9,fontWeight:'900'},report:{marginTop:14,borderTopWidth:1,borderTopColor:'#684974',paddingTop:12},identity:{flexDirection:'row'},name:{color:C.text,fontSize:16,fontWeight:'900'},inline:{flexDirection:'row',alignItems:'center',gap:7},meta:{color:C.muted,fontSize:8,lineHeight:13,marginTop:3},copy:{width:27,height:25,borderRadius:8,backgroundColor:'#242B3C',alignItems:'center',justifyContent:'center'},copyText:{color:C.cyan,fontWeight:'900'},export:{minWidth:68,height:34,borderRadius:11,backgroundColor:'#2B2350',alignItems:'center',justifyContent:'center'},exportText:{color:C.gold,fontSize:8,fontWeight:'900'},section:{color:C.gold,fontSize:8,fontWeight:'900',letterSpacing:1,marginTop:16,marginBottom:6},privateRow:{borderRadius:12,backgroundColor:'#281B35',padding:10,marginTop:5},privateLabel:{color:C.muted,fontSize:7,fontWeight:'900'},privateValue:{color:C.text,fontSize:10,fontWeight:'800',marginTop:4},row:{borderRadius:12,backgroundColor:'#281B35',borderWidth:1,borderColor:'#684974',padding:10,marginTop:6},rowTitle:{color:C.text,fontSize:9,fontWeight:'900'},rowMeta:{color:C.muted,fontSize:7,lineHeight:11,marginTop:3},tracking:{color:C.muted,fontSize:7,lineHeight:11,marginTop:9},versionRow:{minHeight:38,borderRadius:11,backgroundColor:'#281B35',paddingHorizontal:10,marginTop:5,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},versionName:{color:C.text,fontSize:8,fontWeight:'900'},versionCount:{color:C.cyan,fontSize:8,fontWeight:'900'},recovery:{color:C.muted,fontSize:7.5,lineHeight:12,marginBottom:7},empty:{color:C.muted,fontSize:8,paddingVertical:9}
});

