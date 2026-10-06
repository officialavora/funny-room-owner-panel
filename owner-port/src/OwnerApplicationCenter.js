import TextInput from "./DraftTextInput";
import {AiPressable as Pressable,AiBackdrop} from "./AiChrome";
import React,{useEffect,useRef,useState} from "react";
import {Alert,Image,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import OwnerFinanceCenter from "./OwnerFinanceCenter";
import SellerContactEditor from "./SellerContactEditor";
import OwnerGiftCatalog from "./OwnerGiftCatalog";
import OwnerCaptureCenter from "./OwnerCaptureCenter";
import OwnerEvidenceVault from "./OwnerEvidenceVault";
import OwnerPolicyCenter from "./OwnerPolicyCenter";
import OwnerAuthorityCenter from "./OwnerAuthorityCenter";
import OwnerModerationCenter from "./OwnerModerationCenter";
import OwnerRechargeLimits from "./OwnerRechargeLimits";
import OwnerSalaryDesk from "./OwnerSalaryDesk";
import OwnerIdentityCenter from "./OwnerIdentityCenter";
import OwnerUserAnalyticsCenter from "./OwnerUserAnalyticsCenter";
import OwnerSettlementDesk from "./OwnerSettlementDesk";
import OwnerBanCenter from "./OwnerBanCenter";
import OwnerRoomInspector from "./OwnerRoomInspector";
import {OwnerSupportDesk} from "./SupportCenter";
import {supabase} from "../lib/supabase";
import {loadAuthorityContexts,loadOwnerRoleMembers,loadOwnerRoleSummary,loadOwnerUserActiveRoles,loadStaffAccess,loadStaffDashboard,ownerAdjustCoinsByPublicId,ownerAdjustSellerBalance,ownerAssignMultiRole,ownerCreateAccessBan,ownerSetOfficial,ownerSetRoleState,ownerWalletReport} from "./social";
import {PREMIUM} from './designSystem';
const COLORS = { bg: PREMIUM.colors.bg, panel: PREMIUM.colors.panel, panel2: PREMIUM.colors.panelSoft, line: PREMIUM.colors.line, text: PREMIUM.colors.text, muted: PREMIUM.colors.muted, purple: PREMIUM.colors.violet, cyan: PREMIUM.colors.cyan, gold: PREMIUM.colors.gold, danger: PREMIUM.colors.rose };
const OWNER_BOOTSTRAP_MAX_AGE=30000;
let ownerBootstrapCache=null;
let ownerBootstrapPromise=null;
const readOwnerBootstrap=userId=>ownerBootstrapCache?.userId===String(userId||'')&&Date.now()-ownerBootstrapCache.loadedAt<OWNER_BOOTSTRAP_MAX_AGE?ownerBootstrapCache.value:null;
const preloadOwnerBootstrap=async(userId,{force=false}={})=>{
  const key=String(userId||'');
  if(!key)return null;
  const cached=readOwnerBootstrap(key);
  if(cached&&!force)return cached;
  if(ownerBootstrapPromise?.userId===key)return ownerBootstrapPromise.promise;
  const promise=(async()=>{
    const [staff,authorityResult,summaryResult]=await Promise.all([loadStaffAccess(),loadAuthorityContexts(),loadOwnerRoleSummary()]);
    const dashboard=staff.data?.is_staff?await loadStaffDashboard('','Users'):null;
    const value={staff,authorityResult,summaryResult,dashboard};
    if(!staff.error){ownerBootstrapCache={userId:key,loadedAt:Date.now(),value};}
    return value;
  })().finally(()=>{if(ownerBootstrapPromise?.promise===promise)ownerBootstrapPromise=null;});
  ownerBootstrapPromise={userId:key,promise};
  return promise;
};

export default function OwnerCenter({ onClose, userId }) {
  const initialBootstrap=readOwnerBootstrap(userId);
  const [access,setAccess]=useState(initialBootstrap?.staff?.data||null);
  const [data,setData]=useState(initialBootstrap?.dashboard&&!initialBootstrap.dashboard.error?initialBootstrap.dashboard:{counts:{},users:[],rooms:[],reports:[],organizations:[]});
  const [selectedSection,setSelectedSection]=useState(null),[userControlOpen,setUserControlOpen]=useState(false);
  const ownerAnalyticsRef=useRef(null);
  const directoryEpoch=useRef(0),ownerMounted=useRef(true),moreLock=useRef(false);
  const [directoryBusy,setDirectoryBusy]=useState(false);
  useEffect(()=>{ownerMounted.current=true;moreLock.current=false;setDirectoryBusy(false);return()=>{ownerMounted.current=false;++directoryEpoch.current;}},[userId]);
  const [ownerAnalyticsRefreshing,setOwnerAnalyticsRefreshing]=useState(false);
  const [authority,setAuthority]=useState(initialBootstrap?.authorityResult?.data||{primary_role:'user',roles:[],permissions:[]});
  const [search,setSearch]=useState('');
  const [notice,setNotice]=useState('');
  const [ownerSection,setOwnerSection]=useState('Security');
  const [coinId,setCoinId]=useState('');
  const [coinAmount,setCoinAmount]=useState('');
  const [coinNote,setCoinNote]=useState('');
  const [walletRows,setWalletRows]=useState([]);
  const [sellerId,setSellerId]=useState('');
  const [sellerAmount,setSellerAmount]=useState('');
  const [sellerNote,setSellerNote]=useState('');
  const [roleSummary,setRoleSummary]=useState(initialBootstrap?.summaryResult?.data||[]);
  const [roleMembers,setRoleMembers]=useState([]);
  const [selectedRole,setSelectedRole]=useState('');
  const [roleDuration,setRoleDuration]=useState('permanent');
  const [activeContext,setActiveContext]=useState('');
  const [selectedUserId,setSelectedUserId]=useState(null);
  const [userRoles,setUserRoles]=useState({});
  const mainRoleOrder=['root_founder','co_owner','country_manager','manager','super_admin','admin','bd_leader','bd','agency_owner','host','user'];
  const specialRoleOrder=['cs_leader','cs','event_manager','moderator','merchant','coin_seller'];
  const roleRows=keys=>keys.map(key=>roleSummary.find(x=>x.role_key===key)).filter(Boolean);

  const applyBootstrap=result=>{
    if(!result)return;
    setAccess(result.staff?.data||{is_staff:false,role:null,protected:false});
    if(result.authorityResult?.data)setAuthority(result.authorityResult.data);
    if(result.summaryResult?.data)setRoleSummary(result.summaryResult.data);
    if(result.dashboard){if(result.dashboard.error)setNotice(result.dashboard.error.message);else{setData(result.dashboard);setNotice('');}}
  };
  const refresh=async(query=search,section=selectedSection)=>{
    const token=++directoryEpoch.current;setDirectoryBusy(true);
    try{if(!query&&(section==='Users'||section===null)){const result=await preloadOwnerBootstrap(userId,{force:true});if(ownerMounted.current&&token===directoryEpoch.current)applyBootstrap(result);return;}
    const [staff,authorityResult,summaryResult]=await Promise.all([loadStaffAccess(),loadAuthorityContexts(),loadOwnerRoleSummary()]);if(!ownerMounted.current||token!==directoryEpoch.current)return;
    setAccess(staff.data);if(authorityResult.data)setAuthority(authorityResult.data);if(summaryResult.data)setRoleSummary(summaryResult.data);
    if(staff.data?.is_staff){const dashboard=await loadStaffDashboard(query,section);if(!ownerMounted.current||token!==directoryEpoch.current)return;if(dashboard.error)setNotice(dashboard.error.message);else{setData(dashboard);setNotice('');}}
    }catch(error){if(ownerMounted.current&&token===directoryEpoch.current)setNotice(error.message||'Could not refresh directory');}finally{if(ownerMounted.current&&token===directoryEpoch.current)setDirectoryBusy(false);}
  };
  const openRole=async role=>{setSelectedRole(role);const {data:members,error}=await loadOwnerRoleMembers(role);if(error)return setNotice(error.message);setRoleMembers(members||[]);};
  const roleExpiry=()=>roleDuration==='permanent'?null:new Date(Date.now()+Number(roleDuration)*86400000).toISOString();
  const loadUserRoles=async userId=>{const {data:roles,error}=await loadOwnerUserActiveRoles(userId);if(error)return setNotice(error.message);setUserRoles(current=>({...current,[userId]:roles||[]}));};
  const toggleUser=async userId=>{const opening=selectedUserId!==userId;setSelectedUserId(opening?userId:null);if(opening)await loadUserRoles(userId);};
  const activeRole=(userId,role)=>(userRoles[userId]||[]).find(x=>x.role_key===role);
  const roleOn=(userId,role)=>Boolean(activeRole(userId,role));
  const assignRole=async(user,role,options={})=>{
    const active=activeRole(user.id,role);
    if(active){
      const result=await ownerSetRoleState(active.assignment_id,'revoked',`Owner Center removed ${role.replaceAll('_',' ')}`);
      if(result.error)return setNotice(result.error.message);
      setNotice(`${role.replaceAll('_',' ')} removed from ID ${user.public_id}`);
      await loadUserRoles(user.id);
      return;
    }
    await run(`${role.replaceAll('_',' ')} role`,()=>ownerAssignMultiRole(user.id,role,{...options,expiresAt:roleExpiry(),reason:`Owner Center • ${roleDuration==='permanent'?'permanent':roleDuration+' days'}`}));
    await loadUserRoles(user.id);
  };
  const banAccount=async(user,hours,label)=>{const result=await ownerCreateAccessBan({targetType:'account',targetValue:user.public_id,durationHours:hours,reason:`Owner ${label} account restriction`});if(result.error)return Alert.alert('Ban failed',result.error.message);setNotice(`ID ${user.public_id} • ${label} restriction recorded / updated`);refresh()};
  const openMoreBan=user=>Alert.alert('More temporary durations',`ID ${user.public_id}`,[{text:'3 days',onPress:()=>banAccount(user,72,'3 day')},{text:'30 days',onPress:()=>banAccount(user,720,'30 day')},{text:'Back',style:'cancel',onPress:()=>openBanDuration(user)}]);
  const openBanDuration=user=>Alert.alert('Temporary restriction',`ID ${user.public_id} • choose duration`,[{text:'24 hours',onPress:()=>banAccount(user,24,'24 hour')},{text:'7 days',onPress:()=>banAccount(user,168,'7 day')},{text:'More / Back',onPress:()=>openMoreBan(user)}]);
  const openBan=user=>Alert.alert('Account restriction',`ID ${user.public_id}\nExisting active ban, if any, will be updated instead of creating a broken duplicate.`,[{text:'Temporary',onPress:()=>openBanDuration(user)},{text:'Permanent',style:'destructive',onPress:()=>banAccount(user,null,'permanent')},{text:'Cancel',style:'cancel',onPress:()=>setNotice('Ban cancelled')}]);
  const changeRoleState=async(member,status)=>{await run(`${status} role`,()=>ownerSetRoleState(member.assignment_id,status,`Owner Center ${status}`));await openRole(selectedRole);};
  useEffect(()=>{let alive=true;const token=++directoryEpoch.current;preloadOwnerBootstrap(userId,{force:Boolean(initialBootstrap)}).then(result=>{if(alive&&token===directoryEpoch.current)applyBootstrap(result)}).catch(()=>{if(alive&&token===directoryEpoch.current)setAccess({is_staff:false,role:null,protected:false})});return()=>{alive=false;++directoryEpoch.current;};},[userId]);
  const openOwnerSection=async section=>{const token=++directoryEpoch.current;if(selectedSection===section){setSelectedSection(null);setDirectoryBusy(false);return;}setSelectedSection(section);setDirectoryBusy(true);setNotice('Loading '+section.toLowerCase()+'…');setData(previous=>({...previous,users:[],rooms:[],reports:[],organizations:[],hasMore:false}));
    try{const dashboard=await loadStaffDashboard(search,section);if(!ownerMounted.current||token!==directoryEpoch.current)return;if(dashboard.error)setNotice(dashboard.error.message);else{setData(dashboard);setNotice('');}}catch(error){if(ownerMounted.current&&token===directoryEpoch.current)setNotice(error.message||'Could not load directory');}finally{if(ownerMounted.current&&token===directoryEpoch.current)setDirectoryBusy(false);}};
  const loadMoreDirectory=async()=>{if(moreLock.current||directoryBusy||!data.hasMore||data.section!==selectedSection)return;if(data.search!==search)return setNotice('Search again before loading more records.');moreLock.current=true;const token=++directoryEpoch.current;setDirectoryBusy(true);
    try{const next=await loadStaffDashboard(data.search,data.section,(data.page||0)+1);if(!ownerMounted.current||token!==directoryEpoch.current)return;if(next.error)throw next.error;
      const field=data.section==='Users'?'users':data.section==='Rooms'||data.section==='Live'?'rooms':data.section==='Reports'?'reports':'organizations';setData(previous=>{const existing=previous[field]||[],ids=new Set(existing.map(x=>x.id));return {...next,[field]:[...existing,...next[field].filter(x=>!ids.has(x.id))]};});setNotice('');
    }catch(error){if(ownerMounted.current&&token===directoryEpoch.current)setNotice(error.message||'Could not load more records. Retry.');}finally{moreLock.current=false;if(ownerMounted.current&&token===directoryEpoch.current)setDirectoryBusy(false);}};

  const run=async(label,task)=>{
    setNotice(label+'…');
    const {error}=await task();
    setNotice(error?error.message:label+' done');
    if(!error)refresh(search,selectedSection);
  };

  const adjustCoins=async()=>{
    if(!/^\d{4,}$/.test(coinId.trim()))return setNotice('Valid permanent ID required');
    const amount=Number(coinAmount);
    if(!Number.isSafeInteger(amount)||amount===0)return setNotice('Enter a non-zero whole number such as +1000 or -1000');
    if(coinNote.trim().length<3)return setNotice('Adjustment reason required');
    setNotice(amount>0?'Adding coins…':'Removing coins…');
    const {data:result,error}=await ownerAdjustCoinsByPublicId(coinId,amount,coinNote.trim());
    if(error)return setNotice(error.message);
    setNotice(`Wallet updated • ID ${result.public_id} • Balance ${result.balance}`);
    setCoinAmount('');setCoinNote('');
    const report=await ownerWalletReport(coinId,50);
    setWalletRows(report.data||[]);
  };

  const viewWallet=async()=>{
    if(!/^\d{4,}$/.test(coinId.trim()))return setNotice('Valid permanent ID required');
    const {data:rows,error}=await ownerWalletReport(coinId,50);
    if(error)return setNotice(error.message);
    setWalletRows(rows||[]);setNotice(`ID ${coinId} wallet history loaded`);
  };

  const adjustSellerBalance=async()=>{
    if(!/^\d{4,}$/.test(sellerId.trim()))return setNotice('Valid seller permanent ID required');
    const amount=Number(sellerAmount);
    if(!Number.isSafeInteger(amount)||amount===0)return setNotice('Seller balance amount must be a non-zero whole number');
    if(sellerNote.trim().length<3)return setNotice('Seller balance reason required');
    setNotice(amount>0?'Funding seller balance…':'Reducing seller balance…');
    const {data:result,error}=await ownerAdjustSellerBalance(sellerId,amount,sellerNote.trim());
    if(error)return setNotice(error.message);
    setNotice(`Seller balance updated • ID ${result.public_id} • Balance ${result.balance}`);
    setSellerAmount('');setSellerNote('');
  };

  if(access===null)return <View style={styles.ownerCenter}><Text style={styles.ownerLoading}>Checking protected access…</Text></View>;
  if(!access.is_staff)return <View style={styles.ownerCenter}><AiBackdrop/><View style={styles.ownerHeader}><Pressable onPress={onClose} style={styles.iconButton}><Text style={styles.iconButtonText}>‹</Text></Pressable><Text style={styles.ownerTitle}>Owner Center</Text></View><View style={styles.ownerLocked}><Text style={styles.ownerShield}>🛡️</Text><Text style={styles.ownerLockedTitle}>Protected staff only</Text><Text style={styles.caption}>This account is not yet linked to an Owner or staff role.</Text></View></View>;

  return <View style={styles.ownerCenter}><AiBackdrop/>
    <View style={styles.ownerHeader}><Pressable onPress={onClose} style={styles.iconButton}><Text style={styles.iconButtonText}>‹</Text></Pressable><View style={styles.flex}><Text style={styles.ownerEyebrow}>PROTECTED • {String(access.role||'STAFF').toUpperCase()}</Text><Text style={styles.ownerTitle}>Control Center</Text></View><Text style={styles.ownerShield}>🛡️</Text></View>
    {notice?<Pressable onPress={()=>setNotice('')} style={{position:'absolute',top:76,left:12,right:12,zIndex:1000,elevation:24,minHeight:48,borderRadius:14,backgroundColor:'#17132F',borderWidth:1,borderColor:COLORS.gold,paddingHorizontal:12,paddingVertical:10,justifyContent:'center'}}><Text style={{color:COLORS.text,fontSize:9,fontWeight:'900',lineHeight:14}}>{notice}  ×</Text></Pressable>:null}
    <ScrollView contentContainerStyle={styles.ownerScroll} refreshControl={ownerSection==='Users'?<RefreshControl refreshing={ownerAnalyticsRefreshing} onRefresh={()=>ownerAnalyticsRef.current?.refresh()} tintColor={COLORS.cyan} colors={[COLORS.cyan]} progressBackgroundColor={COLORS.panel}/>:undefined}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ownerSectionTabs}>{['Security','Overview','Operations','Finance','Moderation','Roles','Users'].map(section=><Pressable key={section} onPress={()=>setOwnerSection(section)} style={[styles.ownerSectionTab,ownerSection===section&&styles.ownerSectionTabOn]}><Text style={[styles.ownerSectionTabText,ownerSection===section&&styles.ownerSectionTabTextOn]}>{section}</Text></Pressable>)}</ScrollView>
      {ownerSection==='Overview'?<>
      <View style={styles.authorityCard}><Text style={styles.ownerEyebrow}>ACTIVE AUTHORITY • TAP TO SWITCH CONTEXT</Text><Text style={styles.authorityPrimary}>{String(authority.primary_role||'user').replaceAll('_',' ').toUpperCase()}</Text><View style={styles.authorityRoles}>{(authority.roles||[]).map(role=><Pressable onPress={()=>setActiveContext(role.id)} key={role.id} style={[styles.authorityRole,activeContext===role.id&&styles.authorityRoleOn]}><Text style={styles.authorityRoleText}>{role.title} • {role.context_type}{role.context_id!=='*'?`:${role.context_id}`:''}{role.expires_at?' • temporary':''}</Text></Pressable>)}</View></View>
      <View style={styles.ownerStats}>{[['Users',data.counts.users??'—'],['Rooms',data.counts.rooms??'—'],['Live',data.counts.live_rooms??'—'],['Reports',data.counts.open_reports??'—']].map(([label,value])=><Pressable key={label} onPress={()=>openOwnerSection(label)} style={[styles.ownerStat,selectedSection===label&&{borderColor:COLORS.cyan,backgroundColor:'#112638'}]}><Text style={styles.ownerStatValue}>{value}</Text><Text style={styles.ownerStatLabel}>{label}</Text></Pressable>)}</View>
      <View style={{flexDirection:'row',gap:8,marginTop:10}}>{[['Families','👪'],['Agencies','🏢']].map(([label,icon])=><Pressable key={label} onPress={()=>openOwnerSection(label)} style={{flex:1,borderWidth:1,borderColor:selectedSection===label?COLORS.cyan:'#30384B',backgroundColor:selectedSection===label?'#12283A':'#151A28',borderRadius:14,paddingVertical:10,alignItems:'center'}}><Text style={{fontSize:18}}>{icon}</Text><Text style={{color:COLORS.text,fontWeight:'800',fontSize:10,marginTop:3}}>{label}</Text></Pressable>)}</View>
      {selectedSection?<View style={{marginTop:14,borderWidth:1,borderColor:'#2B3244',borderRadius:16,padding:12,backgroundColor:'#111623'}}>
        <Text style={styles.ownerEyebrow}>{selectedSection.toUpperCase()} • LIVE CONTROL DATA</Text>{selectedSection==='Users'?<Text style={styles.ownerMeta}>Showing {data.users.length} of {data.counts.users??'—'} permitted users. Permanent IDs are identifiers, not user counts. Search a name or exact ID to find users outside this list.</Text>:null}
        {selectedSection==='Users'?(data.users.length?data.users.map(user=><Pressable key={user.id} onPress={()=>toggleUser(user.id)} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#252C3C'}}>{user.avatar_url?<Image source={{uri:user.avatar_url}} style={{width:42,height:42,borderRadius:21}}/>:<View style={{width:42,height:42,borderRadius:21,backgroundColor:'#273147',alignItems:'center',justifyContent:'center'}}><Text>👤</Text></View>}<View style={styles.flex}><Text style={styles.ownerUserName}>{user.display_name||'Unnamed'} • ID {user.public_id}</Text><Text style={styles.caption}>{user.is_online?'● ONLINE':'○ Offline'}{user.active_room_public_id?' • Room '+user.active_room_public_id:''} • {user.country_code||'Global'}</Text></View></Pressable>):<Text style={styles.caption}>No users match this search.</Text>):null}
        {(selectedSection==='Rooms'||selectedSection==='Live')?(data.rooms.length?data.rooms.map(room=><View key={room.id} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#252C3C'}}>{room.avatar_url?<Image source={{uri:room.avatar_url}} style={{width:46,height:46,borderRadius:12}}/>:<View style={{width:46,height:46,borderRadius:12,backgroundColor:'#273147',alignItems:'center',justifyContent:'center'}}><Text>🎙️</Text></View>}<View style={styles.flex}><Text style={styles.ownerUserName}>{room.name||'Unnamed room'} • ID {room.public_id}</Text><Text style={styles.caption}>{room.is_live?'🔴 LIVE':'Offline'} • {room.member_count||0} active • {room.seated_count||0}/{room.seat_count||0} seats</Text><Text style={styles.caption}>Owner {room.owner_name||'Unknown'} • ID {room.owner_public_id}</Text></View></View>):<Text style={styles.caption}>{selectedSection==='Live'?'No rooms are live now.':'No rooms match this search.'}</Text>):null}
        {selectedSection==='Reports'?(data.reports.length?data.reports.map(report=><View key={report.id} style={{paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#252C3C'}}><Text style={styles.ownerUserName}>{report.reason||'Report'} • {report.target_type}</Text><Text style={styles.caption}>From {report.reporter_name||'User'} • ID {report.reporter_public_id} • {new Date(report.created_at).toLocaleString()}</Text></View>):<Text style={styles.caption}>No open reports.</Text>):null}
        {(selectedSection==='Families'||selectedSection==='Agencies')?(data.organizations.length?data.organizations.map(org=><View key={org.id} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#252C3C'}}>{org.avatar_url?<Image source={{uri:org.avatar_url}} style={{width:46,height:46,borderRadius:12}}/>:<View style={{width:46,height:46,borderRadius:12,backgroundColor:'#273147',alignItems:'center',justifyContent:'center'}}><Text>{selectedSection==='Families'?'👪':'🏢'}</Text></View>}<View style={styles.flex}><Text style={styles.ownerUserName}>{org.name} • {String(org.status).toUpperCase()}</Text><Text style={styles.caption}>{org.member_count||0} members • {org.host_count||0} hosts • Week {org.week_score||0}</Text><Text style={styles.caption}>Owner {org.owner_name||'Unknown'} • ID {org.owner_public_id}</Text></View></View>):<Text style={styles.caption}>No {selectedSection.toLowerCase()} found.</Text>):null}
        {data.pagingUnavailable?<Text style={styles.caption}>More records are temporarily unavailable. Search by exact ID.</Text>:null}{data.hasMore?<Pressable disabled={directoryBusy} onPress={loadMoreDirectory} style={styles.ownerMiniGold}><Text style={styles.ownerMiniGoldText}>{directoryBusy?'Loading…':'LOAD MORE RECORDS'}</Text></Pressable>:null}
      </View>:null}
      <Text style={styles.ownerSection}>Main authority hierarchy</Text><Text style={styles.caption}>Founder → Co-Owner → Country Manager → Manager → Super Admin → Admin → BD Leader → BD → Agency Owner → Host → User. Zero-count roles stay visible.</Text>
      <View style={styles.roleSummaryGrid}>{roleRows(mainRoleOrder).map(x=><Pressable key={x.role_key} onPress={()=>openRole(x.role_key)} style={[styles.roleSummaryCard,selectedRole===x.role_key&&styles.roleSummaryCardOn]}><Text style={styles.roleSummaryCount}>{x.member_count}</Text><Text style={styles.roleSummaryLabel}>{x.display_name}</Text></Pressable>)}</View>
      <Text style={styles.ownerSection}>Specialist network</Text><Text style={styles.caption}>Parallel scoped functions, not promotion ranks.</Text>
      <View style={styles.roleSummaryGrid}>{roleRows(specialRoleOrder).map(x=><Pressable key={x.role_key} onPress={()=>openRole(x.role_key)} style={[styles.roleSummaryCard,selectedRole===x.role_key&&styles.roleSummaryCardOn]}><Text style={styles.roleSummaryCount}>{x.member_count}</Text><Text style={styles.roleSummaryLabel}>{x.display_name}</Text></Pressable>)}</View>
      {selectedRole?<View style={styles.roleMemberPanel}><Text style={styles.ownerEyebrow}>{selectedRole.replaceAll('_',' ').toUpperCase()} MEMBERS</Text>{roleMembers.length?roleMembers.map(x=><View key={x.assignment_id} style={styles.roleMemberRow}><View style={styles.flex}><Text style={styles.ownerUserName}>{x.display_name||'Unnamed'} • ID {x.public_id}</Text><Text style={styles.caption}>{x.context_type}:{x.context_id} • {x.status}{x.expires_at?' • expires '+new Date(x.expires_at).toLocaleDateString():''}</Text></View>{selectedRole!=='root_founder'?<View style={styles.roleStateActions}>{x.status==='suspended'?<Pressable style={styles.ownerMiniGold} onPress={()=>changeRoleState(x,'active')}><Text style={styles.ownerMiniGoldText}>Restore</Text></Pressable>:<Pressable style={styles.ownerMini} onPress={()=>changeRoleState(x,'suspended')}><Text style={styles.ownerMiniText}>Suspend</Text></Pressable>}<Pressable style={styles.ownerMini} onPress={()=>changeRoleState(x,'revoked')}><Text style={styles.ownerMiniText}>Remove</Text></Pressable></View>:<Text style={styles.founderBadge}>PROTECTED</Text>}</View>):<Text style={styles.caption}>No members assigned yet.</Text>}</View>:null}
      </>:null}
      {ownerSection==='Security'?<><OwnerCaptureCenter/><OwnerSupportDesk/><OwnerEvidenceVault onNotice={setNotice}/></>:null}
      {ownerSection==='Operations'?<OwnerPolicyCenter onNotice={setNotice}/>:null}
      {ownerSection==='Finance'?<><OwnerFinanceCenter onNotice={setNotice}/><OwnerRechargeLimits/><OwnerSalaryDesk onNotice={setNotice}/><OwnerSettlementDesk onNotice={setNotice}/></>:null}
      {ownerSection==='Moderation'?<><OwnerModerationCenter/><OwnerBanCenter onNotice={setNotice}/><OwnerRoomInspector onNotice={setNotice}/></>:null}
      {ownerSection==='Roles'?<><OwnerAuthorityCenter onNotice={setNotice}/><OwnerIdentityCenter onNotice={setNotice}/></>:null}
      {ownerSection==='Users'?<><OwnerUserAnalyticsCenter ref={ownerAnalyticsRef} onNotice={setNotice} onRefreshStateChange={setOwnerAnalyticsRefreshing}/>
      <Pressable onPress={()=>setUserControlOpen(v=>!v)} style={{marginTop:14,minHeight:52,borderRadius:15,borderWidth:1,borderColor:userControlOpen?COLORS.cyan:'#30384B',backgroundColor:'#151A28',paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View><Text style={styles.ownerSection}>User control</Text><Text style={styles.caption}>Search, roles and individual moderation</Text></View><Text style={{color:COLORS.gold,fontWeight:'900'}}>{userControlOpen?'▲':'▼'}</Text></Pressable>
      {userControlOpen?<>
  {ownerSection==='Finance'?<OwnerGiftCatalog onNotice={setNotice}/>:null}
      <View style={styles.durationPicker}><Text style={styles.ownerEyebrow}>NEW ROLE DURATION</Text>{[['permanent','Permanent'],['30','30 days'],['90','90 days']].map(([v,l])=><Pressable key={v} onPress={()=>setRoleDuration(v)} style={[styles.durationChip,roleDuration===v&&styles.durationChipOn]}><Text style={styles.ownerMiniText}>{l}</Text></Pressable>)}</View>
      <View style={styles.ownerSearch}><TextInput value={search} onChangeText={setSearch} onSubmitEditing={()=>refresh(search)} placeholder="Name or permanent ID" placeholderTextColor="#747D91" style={styles.ownerSearchInput}/><Pressable onPress={()=>refresh(search)} style={styles.ownerSearchButton}><Text style={styles.ownerSearchButtonText}>Search</Text></Pressable></View>
      {data.users.map(user=><Pressable key={user.id} style={styles.ownerUserCard} onPress={()=>toggleUser(user.id)}>
        <View style={styles.ownerUserSummary}>
        <View style={styles.ownerAvatar}>{user.avatar_url?<Image source={{uri:user.avatar_url}} style={styles.ownerAvatarImg}/>:<Text style={styles.ownerAvatarText}>{user.is_verified?'✓':'☺'}</Text>}</View>
        <View style={styles.flex}><Text style={styles.ownerUserName}>{user.display_name||'Unnamed'} {user.is_verified?'✓':''}</Text><Text style={styles.caption}>ID {user.public_id} • {user.country_code||'GLOBAL'} • {user.status}</Text><Text style={styles.ownerMeta}>{user.official_title||'Member'} {user.manager_country_code?'• Manager '+user.manager_country_code:''}</Text></View>
        <Text style={styles.ownerExpand}>{selectedUserId===user.id?'▲':'⋮'}</Text></View>
        {selectedUserId===user.id?<View style={styles.ownerExpanded}><View style={styles.ownerActionTitle}><Text style={styles.ownerEyebrow}>PROFILE • MODERATION • ROLES</Text><Text style={styles.caption}>User and Host are separate roles. Sensitive actions are audited.</Text></View><View style={styles.ownerActionsGrid}>
          <Pressable style={styles.ownerMini} onPress={()=>run('Official verification',()=>ownerSetOfficial(user.id,{verified:!user.is_verified,title:user.is_verified?'':'Official',badge:user.is_verified?'':'VERIFIED'}))}><Text style={styles.ownerMiniText}>{user.is_verified?'Unverify':'Verify'}</Text></Pressable>
          {access.role==='owner'?<Pressable style={roleOn(user.id,'user')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'user',{contextType:'user',contextId:String(user.public_id)})}><Text style={roleOn(user.id,'user')?styles.ownerMiniGoldText:styles.ownerMiniText}>User</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'host')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'host',{contextType:'user',contextId:String(user.public_id)})}><Text style={roleOn(user.id,'host')?styles.ownerMiniGoldText:styles.ownerMiniText}>Host</Text></Pressable>:null}
          {Number(user.public_id)!==100000?<Pressable style={styles.ownerMini} onPress={()=>openBan(user)}><Text style={styles.ownerMiniText}>{user.status==='banned'?'Update Ban':'Ban ID'}</Text></Pressable>:null}
          {Number(user.public_id)!==100000&&user.status==='banned'?<Pressable style={styles.ownerMiniGold} onPress={()=>run('Account unban',()=>supabase.rpc('owner_unban_account_by_public_id',{p_public_id:Number(user.public_id),p_reason:'Owner restored account'}))}><Text style={styles.ownerMiniGoldText}>Unban</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'co_owner')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'co_owner')}><Text style={roleOn(user.id,'co_owner')?styles.ownerMiniGoldText:styles.ownerMiniText}>Co-Owner</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'country_manager')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'country_manager',{contextType:'country',contextId:user.country_code||'*'})}><Text style={roleOn(user.id,'country_manager')?styles.ownerMiniGoldText:styles.ownerMiniText}>Country Manager</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'manager')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'manager')}><Text style={roleOn(user.id,'manager')?styles.ownerMiniGoldText:styles.ownerMiniText}>Manager</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'super_admin')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'super_admin')}><Text style={roleOn(user.id,'super_admin')?styles.ownerMiniGoldText:styles.ownerMiniText}>Super Admin</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'admin')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'admin')}><Text style={roleOn(user.id,'admin')?styles.ownerMiniGoldText:styles.ownerMiniText}>Admin</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'bd_leader')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'bd_leader')}><Text style={roleOn(user.id,'bd_leader')?styles.ownerMiniGoldText:styles.ownerMiniText}>BD Leader</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'cs_leader')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'cs_leader')}><Text style={roleOn(user.id,'cs_leader')?styles.ownerMiniGoldText:styles.ownerMiniText}>CS Leader</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'bd')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'bd',{contextType:'country',contextId:user.country_code||'*'})}><Text style={roleOn(user.id,'bd')?styles.ownerMiniGoldText:styles.ownerMiniText}>BD</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'event_manager')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'event_manager')}><Text style={roleOn(user.id,'event_manager')?styles.ownerMiniGoldText:styles.ownerMiniText}>Event Manager</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'moderator')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'moderator')}><Text style={roleOn(user.id,'moderator')?styles.ownerMiniGoldText:styles.ownerMiniText}>Moderator</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'cs')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'cs')}><Text style={roleOn(user.id,'cs')?styles.ownerMiniGoldText:styles.ownerMiniText}>CS</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'merchant')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'merchant',{contextType:'merchant',contextId:String(user.public_id)})}><Text style={roleOn(user.id,'merchant')?styles.ownerMiniGoldText:styles.ownerMiniText}>Merchant</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'coin_seller')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'coin_seller',{contextType:'seller',contextId:String(user.public_id)})}><Text style={roleOn(user.id,'coin_seller')?styles.ownerMiniGoldText:styles.ownerMiniText}>Coin Seller</Text></Pressable>:null}
          {access.role==='owner'?<Pressable style={roleOn(user.id,'agency_owner')?styles.ownerMiniGold:styles.ownerMini} onPress={()=>assignRole(user,'agency_owner',{contextType:'agency',contextId:String(user.public_id)})}><Text style={roleOn(user.id,'agency_owner')?styles.ownerMiniGoldText:styles.ownerMiniText}>Agency Owner</Text></Pressable>:null}
        </View>{access.role==='owner'&&(roleOn(user.id,'merchant')||roleOn(user.id,'coin_seller'))?<SellerContactEditor ownerMode targetPublicId={user.public_id} compact/>:null}</View>:null}
      </Pressable>)}
      {!data.users.length?<View style={styles.ownerEmpty}><Text style={styles.ownerEmptyIcon}>👥</Text><Text style={styles.ownerLockedTitle}>No users yet</Text><Text style={styles.caption}>New signups will appear here with permanent IDs and activity records.</Text></View>:null}</>:null}</>:null}
      <View style={styles.ownerSecurity}><Text style={styles.ownerSecurityTitle}>Protected access active</Text><Text style={styles.ownerSecurityText}>Role changes, verification, medals, frames and point grants are validated by Supabase and written to the audit log.</Text></View>
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({authorityCard:{backgroundColor:'#17132D',borderColor:'#4B3CA0',borderWidth:1,borderRadius:20,padding:14,marginBottom:12},authorityPrimary:{color:COLORS.gold,fontSize:18,fontWeight:'900',marginTop:5},authorityRoles:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:10},authorityRole:{backgroundColor:'#292247',borderRadius:999,paddingHorizontal:9,paddingVertical:6},authorityRoleOn:{backgroundColor:'#5C3BDB',borderWidth:1,borderColor:COLORS.gold},authorityRoleText:{color:'#DDD7FF',fontSize:8,fontWeight:'800'},roleStateActions:{gap:5,marginLeft:8},durationPicker:{backgroundColor:'#151925',borderRadius:16,padding:10,borderWidth:1,borderColor:COLORS.line,flexDirection:'row',alignItems:'center',gap:7,marginBottom:10},durationChip:{backgroundColor:'#22283A',borderRadius:999,paddingHorizontal:10,paddingVertical:7},durationChipOn:{backgroundColor:'#5C3BDB',borderWidth:1,borderColor:COLORS.gold},ownerCenter:{flex:1,backgroundColor:COLORS.bg},ownerLoading:{color:COLORS.muted,textAlign:'center',marginTop:120},ownerHeader:{minHeight:72,paddingHorizontal:16,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:COLORS.line},ownerEyebrow:{color:COLORS.cyan,fontSize:8,fontWeight:'900',letterSpacing:1},ownerTitle:{color:COLORS.text,fontSize:22,fontWeight:'900',marginTop:3},ownerShield:{fontSize:29},ownerScroll:{padding:16,paddingBottom:50},ownerStats:{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#171B28',borderRadius:22,padding:14,borderWidth:1,borderColor:'#2A3042'},ownerStat:{alignItems:'center',width:'24%'},ownerStatValue:{color:COLORS.text,fontSize:19,fontWeight:'900'},ownerStatLabel:{color:COLORS.muted,fontSize:8,marginTop:4},ownerSection:{color:COLORS.text,fontSize:17,fontWeight:'900',marginTop:22,marginBottom:11},ownerSearch:{flexDirection:'row',backgroundColor:'#151925',borderRadius:16,borderWidth:1,borderColor:COLORS.line,padding:5},ownerSearchInput:{flex:1,color:COLORS.text,paddingHorizontal:10,fontSize:12},ownerSearchButton:{backgroundColor:COLORS.purple,borderRadius:12,paddingHorizontal:14,justifyContent:'center'},ownerSearchButtonText:{color:'white',fontSize:10,fontWeight:'900'},ownerUserCard:{backgroundColor:'#131724',borderWidth:1,borderColor:COLORS.line,borderRadius:19,padding:11,marginTop:10},ownerUserSummary:{flexDirection:'row',alignItems:'center'},ownerExpand:{color:COLORS.cyan,fontSize:22,fontWeight:'900',padding:10},ownerExpanded:{borderTopWidth:1,borderTopColor:COLORS.line,marginTop:11,paddingTop:11},ownerActionTitle:{marginBottom:9},ownerActionsGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},ownerAvatar:{width:42,height:42,borderRadius:16,backgroundColor:'#2A2353',alignItems:'center',justifyContent:'center',marginRight:10,overflow:'hidden'},ownerAvatarImg:{width:'100%',height:'100%'},ownerAvatarText:{color:COLORS.gold,fontSize:20,fontWeight:'900'},ownerUserName:{color:COLORS.text,fontSize:13,fontWeight:'900'},ownerMeta:{color:COLORS.cyan,fontSize:8,fontWeight:'800',marginTop:4},ownerMini:{backgroundColor:'#22283A',borderRadius:9,paddingHorizontal:8,paddingVertical:5,alignItems:'center'},ownerMiniText:{color:'#D9DEEA',fontSize:7,fontWeight:'900'},ownerMiniGold:{backgroundColor:'#3C321B',borderRadius:9,paddingHorizontal:8,paddingVertical:5,alignItems:'center'},ownerMiniGoldText:{color:COLORS.gold,fontSize:7,fontWeight:'900'},ownerLocked:{margin:22,marginTop:100,backgroundColor:'#151925',borderRadius:26,padding:25,alignItems:'center',borderWidth:1,borderColor:COLORS.line},ownerLockedTitle:{color:COLORS.text,fontSize:17,fontWeight:'900',marginTop:10,textAlign:'center'},ownerEmpty:{padding:35,alignItems:'center'},ownerEmptyIcon:{fontSize:44},ownerSecurity:{marginTop:20,backgroundColor:'#15313A',borderRadius:18,padding:15},ownerSecurityTitle:{color:COLORS.cyan,fontWeight:'900'},ownerSecurityText:{color:'#AFC3C9',fontSize:10,lineHeight:16,marginTop:6},flex: { flex: 1 },caption: { color: COLORS.muted, fontSize: 12, marginTop: 3 },iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF0E', alignItems: 'center', justifyContent: 'center', marginRight: 10 },iconButtonText: { color: COLORS.text, fontSize: 30, lineHeight: 32 }});
