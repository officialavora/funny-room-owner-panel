import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{useEffect,useMemo,useState} from 'react';
import {Alert,Modal,ScrollView,StyleSheet,Switch,View} from 'react-native';
import {supabase} from '../lib/supabase';
import {PREMIUM} from './designSystem';
import OwnerProgressionOperationsCenter from './OwnerProgressionOperationsCenter';

const C={...PREMIUM.colors,purple:PREMIUM.colors.violet};
const compact=value=>Number(value||0).toLocaleString();
const SCOPES=[['id','ONE ID'],['country','COUNTRY'],['all','ALL']];

export default function OwnerUserResetCenter({onNotice}){
  const [scope,setScope]=useState('id');
  const [publicId,setPublicId]=useState('');
  const [country,setCountry]=useState('');
  const [countries,setCountries]=useState([]);
  const [countryOpen,setCountryOpen]=useState(false);
  const [reason,setReason]=useState('');
  const [preview,setPreview]=useState(null);
  const [busy,setBusy]=useState(false);
  const [resetArmed,setResetArmed]=useState(false);
  const [confirmation,setConfirmation]=useState('');

  const cleanId=publicId.replace(/[^0-9]/g,'');
  const expected=useMemo(()=>scope==='id'?`RESET ${cleanId}`:scope==='country'?`RESET COUNTRY ${country}`:'RESET ALL USERS',[scope,cleanId,country]);
  const clearReview=()=>{setPreview(null);setResetArmed(false);setConfirmation('');};
  useEffect(()=>{(async()=>{const {data}=await supabase.rpc('owner_list_user_reset_countries');if(Array.isArray(data))setCountries(data)})()},[]);
  const message=value=>{onNotice?.(value);};
  const inspect=async()=>{
    if(scope==='id'&&!/^\d{4,}$/.test(cleanId))return message('Enter a valid permanent ID');
    if(scope==='country'&&!/^[A-Z]{2}$/.test(country))return message('Select a country first');
    setBusy(true);
    const request=scope==='id'
      ?supabase.rpc('owner_preview_user_test_reset',{p_public_id:Number(cleanId)})
      :supabase.rpc('owner_preview_user_test_reset_scope',{p_scope:scope,p_country_code:scope==='country'?country:null});
    const {data,error}=await request;
    setBusy(false);
    if(error){setPreview(null);return message(error.message)}
    setPreview(data);setResetArmed(false);setConfirmation('');
    message(scope==='id'?`ID ${cleanId} loaded • review before changing anything`:`${compact(data.affected_users)} IDs loaded • review before resetting`);
  };
  const reset=()=>{
    if(!preview)return message('Check the selected scope first');
    if(scope==='id'&&String(preview.public_id)!==cleanId)return message('Check the ID first');
    if(preview.protected_target)return message('Founder identity cannot be reset');
    if(!resetArmed)return message('Arm protected reset first');
    if(confirmation!==expected)return message(`Type ${expected} exactly`);
    if(reason.trim().length<5)return message('A clear reset reason is required');
    const count=scope==='id'?1:Number(preview.affected_users||0);
    if(count<1)return message('No eligible active IDs in this scope');
    const target=scope==='id'?`ID ${cleanId} • ${preview.display_name||'User'}`:scope==='country'?`${count} active IDs in ${country}`:`${count} active IDs across all countries`;
    Alert.alert('Reset selected test data?',`${target}\n\nThis resets coins, diamonds, Level/VIP progress, rewards, roles, Seller and Family/Agency membership. Name, permanent ID, country, DP, bio, login and audit history stay safe. Founder is always excluded.`,[
      {text:'Cancel',style:'cancel'},
      {text:scope==='id'?'RESET THIS ID':'RESET SELECTED IDs',style:'destructive',onPress:async()=>{
        setBusy(true);
        const request=scope==='id'
          ?supabase.rpc('owner_reset_user_test_data',{p_public_id:Number(cleanId),p_confirmation:confirmation,p_reason:reason.trim()})
          :supabase.rpc('owner_reset_user_test_data_scope',{p_scope:scope,p_country_code:scope==='country'?country:null,p_confirmation:confirmation,p_reason:reason.trim()});
        const {data,error}=await request;
        setBusy(false);
        if(error)return message(error.message);
        setPreview(scope==='id'?data:null);setResetArmed(false);setConfirmation('');setReason('');
        message(scope==='id'?`ID ${cleanId} test data reset • identity preserved`:`${compact(data.reset_users)} IDs reset • identity preserved`);
      }},
    ]);
  };

  return <View style={s.shell}>
    <View style={s.glow}/>
    <View style={s.head}><View style={s.orb}><Text style={s.orbText}>↺</Text></View><View style={s.flex}><Text style={s.eyebrow}>OWNER ONLY • AUDITED CONTROL</Text><Text style={s.title}>User Progress & Test Reset</Text><Text style={s.sub}>One protected control for one ID, one country, or the full test application.</Text></View></View>
    <View style={s.scopeRow}>{SCOPES.map(([value,label])=><Pressable key={value} onPress={()=>{setScope(value);clearReview()}} style={[s.scopeTab,scope===value&&s.scopeTabOn]}><Text style={[s.scopeText,scope===value&&s.scopeTextOn]}>{label}</Text></Pressable>)}</View>
    <View style={s.lookup}>
      {scope==='id'?<TextInput value={publicId} onChangeText={value=>{setPublicId(value.replace(/[^0-9]/g,''));clearReview()}} keyboardType="number-pad" placeholder="Permanent ID" placeholderTextColor={C.muted} style={s.input}/>:null}
      {scope==='country'?<Pressable onPress={()=>setCountryOpen(true)} style={[s.input,s.countryPick]}><Text style={country?s.countryValue:s.countryPlaceholder}>{country||'Select country'}</Text><Text style={s.chevron}>⌄</Text></Pressable>:null}
      {scope==='all'?<View style={[s.input,s.allScope]}><Text style={s.allTitle}>ALL ACTIVE TEST IDs</Text><Text style={s.allSub}>Every country • founder excluded</Text></View>:null}
      <Pressable disabled={busy} onPress={inspect} style={s.check}><Text style={s.checkText}>{busy?'…':'CHECK'}</Text></Pressable>
    </View>
    {scope==='id'&&preview?<View style={s.snapshot}><View style={s.identity}><View style={s.avatar}><Text style={s.avatarText}>{String(preview.display_name||'U')[0].toUpperCase()}</Text></View><View style={s.flex}><Text style={s.name}>{preview.display_name||'Member'}</Text><Text style={s.id}>ID {preview.public_id} • LEVEL {preview.level} • VIP {preview.vip_level}</Text></View>{preview.protected_target?<Text style={s.protected}>PROTECTED</Text>:null}</View><View style={s.metrics}>{[['COINS',preview.coin_balance],['DIAMONDS',preview.diamond_balance],['ROLES',preview.active_roles],['FAMILY / AGENCY',preview.organizations]].map(([label,value])=><View key={label} style={s.metric}><Text style={s.metricN}>{compact(value)}</Text><Text style={s.metricL}>{label}</Text></View>)}</View></View>:null}
    {scope!=='id'&&preview?<View style={s.bulkPreview}><Text style={s.bulkCount}>{compact(preview.affected_users)}</Text><View style={s.flex}><Text style={s.bulkTitle}>ELIGIBLE ACTIVE IDs</Text><Text style={s.bulkSub}>{scope==='country'?`${country} country selected`:'All countries selected'} • {compact(preview.countries)} countries • founder excluded</Text></View></View>:null}
    {scope==='id'?<OwnerProgressionOperationsCenter initialPublicId={cleanId} onNotice={message}/>:<TextInput value={reason} onChangeText={setReason} maxLength={500} placeholder="Required reason for bulk audit" placeholderTextColor={C.muted} style={s.reason}/>}
    <View style={s.dangerBox}><View style={s.control}><Text style={[s.controlStep,s.dangerStep]}>{scope==='id'?'02':'01'}</Text><View style={s.flex}><Text style={s.controlTitle}>Testing restart</Text><Text style={s.controlSub}>{scope==='id'?'Level returns to 1; coins, diamonds and current progress return to zero.':'Selected IDs return to baseline in one audited action.'}</Text></View><Switch value={resetArmed} onValueChange={setResetArmed} disabled={!preview||preview?.protected_target} trackColor={{false:'#343A4D',true:'#8A304B'}} thumbColor={resetArmed?'#FF789C':'#A4AABD'}/></View>
      {resetArmed?<><Text style={s.warning}>Identity stays: name, permanent ID, DP, bio and login. Ledgers/payment proof remain as protected history.</Text><TextInput value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" placeholder={`Type ${expected}`} placeholderTextColor="#8F6572" style={[s.reason,s.confirm]}/><Pressable disabled={busy||confirmation!==expected} onPress={reset} style={[s.resetButton,(busy||confirmation!==expected)&&s.disabled]}><Text style={s.resetText}>{busy?'RESETTING…':scope==='id'?'RESET THIS ID TEST DATA':'RESET SELECTED TEST DATA'}</Text></Pressable></>:null}
    </View>
    <Modal visible={countryOpen} transparent animationType="fade" onRequestClose={()=>setCountryOpen(false)}><Pressable style={s.modalShade} onPress={()=>setCountryOpen(false)}><View style={s.modalCard}><Text style={s.modalTitle}>Select country</Text><ScrollView style={s.countryList}>{countries.map(item=><Pressable key={item.country_code} onPress={()=>{setCountry(item.country_code);setCountryOpen(false);clearReview()}} style={s.countryItem}><Text style={s.countryCode}>{item.country_code}</Text><Text style={s.countryUsers}>{compact(item.active_users)} active IDs</Text></Pressable>)}</ScrollView></View></Pressable></Modal>
  </View>;
}

const s=StyleSheet.create({
  shell:{marginTop:14,borderRadius:22,borderWidth:1,borderColor:'#39415B',backgroundColor:'#111724',padding:13,overflow:'hidden'},
  glow:{position:'absolute',width:190,height:190,borderRadius:95,backgroundColor:'#5039BB20',right:-65,top:-80},
  head:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12},orb:{width:46,height:46,borderRadius:16,backgroundColor:'#292250',borderWidth:1,borderColor:'#6656C8',alignItems:'center',justifyContent:'center'},orbText:{color:C.cyan,fontSize:27,fontWeight:'900'},flex:{flex:1},eyebrow:{color:C.cyan,fontSize:7,fontWeight:'900',letterSpacing:1},title:{color:C.text,fontSize:15,fontWeight:'900',marginTop:2},sub:{color:C.muted,fontSize:8,lineHeight:12,marginTop:3},
  scopeRow:{flexDirection:'row',padding:3,borderRadius:14,backgroundColor:'#0B101A',marginBottom:8},scopeTab:{flex:1,minHeight:36,borderRadius:11,alignItems:'center',justifyContent:'center'},scopeTabOn:{backgroundColor:'#5239C6'},scopeText:{color:C.muted,fontSize:7,fontWeight:'900'},scopeTextOn:{color:'#fff'},
  countryPick:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},countryValue:{color:C.text,fontSize:10,fontWeight:'900'},countryPlaceholder:{color:C.muted,fontSize:10},chevron:{color:C.cyan,fontSize:17},allScope:{justifyContent:'center'},allTitle:{color:C.text,fontSize:9,fontWeight:'900'},allSub:{color:C.muted,fontSize:7,marginTop:2},
  lookup:{flexDirection:'row',gap:7},input:{flex:1,minHeight:44,borderRadius:13,borderWidth:1,borderColor:'#343C52',backgroundColor:'#0B101A',color:C.text,paddingHorizontal:11},check:{width:72,borderRadius:13,backgroundColor:'#67407C',alignItems:'center',justifyContent:'center'},checkText:{color:'#fff',fontSize:8,fontWeight:'900'},
  snapshot:{marginTop:10,borderRadius:17,borderWidth:1,borderColor:'#2E4960',backgroundColor:'#0D202A',padding:10},identity:{flexDirection:'row',alignItems:'center',gap:9},avatar:{width:38,height:38,borderRadius:13,backgroundColor:'#31405D',alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontSize:16,fontWeight:'900'},name:{color:C.text,fontSize:11,fontWeight:'900'},id:{color:C.cyan,fontSize:7,fontWeight:'800',marginTop:3},protected:{color:C.gold,fontSize:6,fontWeight:'900'},metrics:{flexDirection:'row',marginTop:10,gap:5},metric:{flex:1,minHeight:49,borderRadius:12,backgroundColor:'#131C29',alignItems:'center',justifyContent:'center',paddingHorizontal:2},metricN:{color:C.text,fontSize:11,fontWeight:'900'},metricL:{color:C.muted,fontSize:5.5,fontWeight:'900',marginTop:3,textAlign:'center'},
  bulkPreview:{marginTop:10,minHeight:70,borderRadius:17,borderWidth:1,borderColor:'#2E4960',backgroundColor:'#0D202A',padding:11,flexDirection:'row',alignItems:'center',gap:11},bulkCount:{color:C.gold,fontSize:25,fontWeight:'900'},bulkTitle:{color:C.text,fontSize:9,fontWeight:'900'},bulkSub:{color:C.cyan,fontSize:7,marginTop:4},
  modalShade:{flex:1,backgroundColor:'#050812D9',justifyContent:'center',padding:24},modalCard:{maxHeight:'70%',borderRadius:22,borderWidth:1,borderColor:'#4B5572',backgroundColor:'#111724',padding:14},modalTitle:{color:C.text,fontSize:15,fontWeight:'900',marginBottom:8},countryList:{maxHeight:360},countryItem:{minHeight:48,borderBottomWidth:1,borderBottomColor:'#272E40',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},countryCode:{color:C.cyan,fontSize:12,fontWeight:'900'},countryUsers:{color:C.muted,fontSize:8},
  control:{flexDirection:'row',alignItems:'center',gap:9,marginTop:13},controlStep:{width:29,height:29,borderRadius:10,textAlign:'center',textAlignVertical:'center',backgroundColor:'#292250',color:C.cyan,fontSize:9,fontWeight:'900'},controlTitle:{color:C.text,fontSize:11,fontWeight:'900'},controlSub:{color:C.muted,fontSize:7,lineHeight:11,marginTop:2},reason:{minHeight:43,borderRadius:13,borderWidth:1,borderColor:'#343C52',backgroundColor:'#0B101A',color:C.text,paddingHorizontal:11,marginTop:8,fontSize:9},
  levelActions:{flexDirection:'row',alignItems:'center',gap:7,marginTop:8},levelButton:{flex:1,minHeight:43,borderRadius:13,alignItems:'center',justifyContent:'center',borderWidth:1},levelDown:{backgroundColor:'#27202E',borderColor:'#72506D'},levelUp:{backgroundColor:'#1B2940',borderColor:'#315D83'},levelButtonText:{color:C.text,fontSize:8,fontWeight:'900'},levelReadout:{width:58,alignItems:'center'},levelN:{color:C.gold,fontSize:19,fontWeight:'900'},levelLabel:{color:C.muted,fontSize:5.5,fontWeight:'900'},
  systemRow:{flexDirection:'row',gap:5,marginTop:10},systemButton:{flex:1,minHeight:36,borderRadius:10,borderWidth:1,borderColor:'#343C52',backgroundColor:'#0B101A',alignItems:'center',justifyContent:'center'},systemButtonOn:{backgroundColor:'#392D83',borderColor:C.cyan},systemText:{color:C.text,fontSize:6.5,fontWeight:'900'},progressAdjust:{flexDirection:'row',gap:7,alignItems:'center'},progressInput:{flex:1}, 
  dangerBox:{marginTop:13,borderRadius:17,borderWidth:1,borderColor:'#603044',backgroundColor:'#25131B',padding:10},dangerStep:{backgroundColor:'#4B2030',color:'#FF8DA8'},warning:{color:'#E9B3C1',fontSize:7.5,lineHeight:12,marginTop:10},confirm:{borderColor:'#603044',backgroundColor:'#150D12'},resetButton:{minHeight:45,borderRadius:13,backgroundColor:'#A22E51',alignItems:'center',justifyContent:'center',marginTop:8},resetText:{color:'#fff',fontSize:8,fontWeight:'900'},disabled:{opacity:.4},
});

