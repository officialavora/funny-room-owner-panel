import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Image,Modal,SafeAreaView,ScrollView,StyleSheet,Switch,View} from 'react-native';
import {supabase} from '../lib/supabase';
import {OwnerMediaField} from './OwnerCatalogMedia';
import GiftArtwork from './GiftArtwork';
import {isRelationshipProposalGift} from './relationshipGiftProposal';
import {httpsMedia,validateMediaDuration} from './catalogMedia';
import { PREMIUM } from './designSystem';

const C={bg:PREMIUM.colors.bg,panel:PREMIUM.colors.panel,panel2:PREMIUM.colors.panelSoft,line:PREMIUM.colors.line,text:PREMIUM.colors.text,muted:PREMIUM.colors.muted,purple:PREMIUM.colors.violet,cyan:PREMIUM.colors.cyan,gold:PREMIUM.colors.gold,green:PREMIUM.colors.green,danger:PREMIUM.colors.rose};
const n=v=>Number(v||0).toLocaleString();
const isUrl=v=>/^https?:\/\//i.test(String(v||''));
const parseCombo=v=>String(v||'').split(',').map(x=>Number(x.trim())).filter(x=>Number.isSafeInteger(x)&&x>0).slice(0,12);

export default function OwnerGiftCatalog({onNotice}){
  const saveLock=useRef(false),uploadCount=useRef(0),alive=useRef(true),refreshEpoch=useRef(0);
  const [uploading,setUploading]=useState(false);
  const uploadChanged=value=>{uploadCount.current=Math.max(0,uploadCount.current+(value?1:-1));if(alive.current)setUploading(uploadCount.current>0)};
  const [rows,setRows]=useState([]),[edit,setEdit]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[feedback,setFeedback]=useState('');
  const notify=msg=>{if(alive.current){setFeedback(msg);onNotice?.(msg)}};
  const refresh=async()=>{const epoch=++refreshEpoch.current;if(alive.current)setLoading(true);try{const {data,error}=await supabase.from('gift_catalog').select('*').order('sort_order').order('coin_price');if(!alive.current||epoch!==refreshEpoch.current)return;if(error)throw error;setRows(data||[]);}catch(error){if(epoch===refreshEpoch.current)notify(`Gift Catalog: ${error.message||'Could not load gifts'}`);}finally{if(alive.current&&epoch===refreshEpoch.current)setLoading(false);}};
  useEffect(()=>{alive.current=true;void refresh();return()=>{alive.current=false;refreshEpoch.current++}},[]);
  const open=r=>setEdit({...r,draft_key:`${r.id||'new'}-${Date.now()}`,duration_seconds:String(Number(r.effect_duration_ms||5000)/1000),coin_price:String(r.coin_price||0),diamond_value:String(r.diamond_value||0),combo_text:(r.combo_quantities||[]).join(', '),custom_combo_max:String(r.custom_combo_max||100),sort_order:String(r.sort_order||100),min_vip_level:String(r.min_vip_level||0)});
  const createNew=(category='standard')=>open({id:null,slug:'',name:'',coin_price:100,diamond_value:0,asset_key:'🎁',effect_kind:'standard',effect_asset_url:'',sound_url:'',active:true,category,combo_quantities:[9,99,999,9999],allow_custom_combo:true,custom_combo_max:9999,featured:false,sort_order:rows.length+1,min_vip_level:0});
  const close=(cancelled=true)=>{if(saveLock.current||uploadCount.current)return;setEdit(null);if(cancelled)notify('Gift edit cancelled');};
  const save=async()=>{
    if(!edit||saveLock.current||uploadCount.current)return;
    const price=Number(String(edit.coin_price).replaceAll(',','')),diamond=Number(String(edit.diamond_value).replaceAll(',','')),max=Number(edit.custom_combo_max||0),sortOrder=Number(edit.sort_order||0),minVip=Number(edit.min_vip_level||0),combos=parseCombo(edit.combo_text);
    if(edit.name.trim().length<2)return notify('Gift name is required');
    if(!Number.isSafeInteger(price)||price<1||price>10000000)return notify('Gift coin price must be a whole number from 1 to 10000000');
    if(!Number.isSafeInteger(diamond)||diamond<0||diamond>10000000)return notify('Diamond value must be a whole number from 0 to 10000000');
    if(!Number.isSafeInteger(max)||max<1||max>9999)return notify('Custom combo max must be between 1 and 9999');
    if(!Number.isSafeInteger(sortOrder)||sortOrder<0)return notify('Sort order must be zero or higher');
    if(!Number.isSafeInteger(minVip)||minVip<0||minVip>100)return notify('VIP level must be between 0 and 100');
    let duration;
    try{duration=validateMediaDuration(edit.duration_seconds);}catch(error){return notify(error.message);}
    if(!combos.length||combos.some(q=>q>max))return notify('Combo quantities must fit the custom maximum.');
    if([edit.effect_asset_url,edit.sound_url].some(url=>url&&!httpsMedia(url)))return notify('Media links must use HTTPS.');
    if(/^https?:/i.test(edit.asset_key||'')&&!httpsMedia(edit.asset_key))return notify('Image link must use HTTPS.');
    saveLock.current=true;setBusy(true);
    try{
    if(isRelationshipProposalGift(edit)&&price<5000000)return notify('Relationship proposal gifts must cost at least 5000000 coins');
    if(isRelationshipProposalGift(edit)&&(edit.allow_custom_combo||max!==1||combos.length!==1||combos[0]!==1))return notify('Relationship proposals require quantity 1 with custom combos off');
    const common={p_name:edit.name.trim(),p_coin_price:price,p_diamond_value:diamond,p_category:String(edit.category||'standard'),p_asset_key:String(edit.asset_key||'🎁').trim(),p_effect_kind:String(edit.effect_kind||'standard').trim(),p_effect_asset_url:edit.effect_asset_url||null,p_sound_url:edit.sound_url||null,p_combo_quantities:combos,p_allow_custom_combo:Boolean(edit.allow_custom_combo),p_custom_combo_max:max,p_active:Boolean(edit.active),p_featured:Boolean(edit.featured),p_sort_order:sortOrder,p_min_vip_level:minVip};
    const {error}=await supabase.rpc('owner_save_gift_v3',{p_gift:edit.id||null,p_values:{...Object.fromEntries(Object.entries(common).map(([key,value])=>[key.slice(2),value])),effect_duration_ms:duration},p_expected_version:edit.policy_version??null});
    if(error)throw error;
    if(!alive.current)return;const savedName=edit.name.trim();setEdit(null);notify(`${savedName} updated successfully`);await refresh();
    }catch(error){notify(`Gift update failed: ${error.message||'Try again'}`);}finally{saveLock.current=false;if(alive.current)setBusy(false);}
  };
  const activeCount=useMemo(()=>rows.filter(x=>x.active).length,[rows]);
  return <View style={s.wrap}><AiBackdrop opacity={.22}/>
    <View style={s.head}><View style={s.flex}><Text style={s.title}>Gift Catalog</Text><Text style={s.meta}>{rows.length} gifts • {activeCount} active • dynamic catalog</Text></View><Pressable disabled={loading} onPress={()=>createNew()} style={s.refresh}><Text style={s.refreshText}>＋ NEW</Text></Pressable><Pressable disabled={loading} onPress={refresh} style={s.refresh}><Text style={s.refreshText}>{loading?'…':'REFRESH'}</Text></Pressable></View>{feedback?<Text style={s.safe}>{feedback}</Text>:null}
    <View style={s.row}><View style={s.thumb}><GiftArtwork gift={{asset_key:'🎁',name:'Special Gifts'}} size={48}/></View><View style={s.copy}><Text style={s.name}>Special Gifts</Text><Text style={s.meta}>{rows.filter(r=>String(r.category).toLowerCase()==='special').length} gifts • Set name, picture, music and value</Text></View><Pressable disabled={loading||busy||uploading} accessibilityLabel="Add special gift" onPress={()=>createNew('special')} style={s.edit}><Text style={s.editText}>＋ ADD</Text></Pressable></View>
    <View style={s.list}>{rows.map(r=><View key={r.id} style={s.row}>
      <View style={s.thumb}><GiftArtwork gift={r} size={48}/></View>
      <View style={s.copy}><Text style={s.name} numberOfLines={1}>{r.name}</Text><Text style={s.meta} numberOfLines={2}>🪙 {n(r.coin_price)} • ◆ {n(r.diamond_value)} • {String(r.category||'STANDARD').toUpperCase()}</Text><View style={s.flags}><Text style={[s.flag,r.active?s.on:s.off]}>{r.active?'ACTIVE':'OFF'}</Text>{r.featured?<Text style={[s.flag,s.featured]}>FEATURED</Text>:null}{Number(r.min_vip_level||0)>0?<Text style={[s.flag,s.vip]}>VIP {r.min_vip_level}+</Text>:null}</View></View>
      <Pressable onPress={()=>open(r)} style={s.edit}><Text style={s.editText}>EDIT</Text></Pressable>
    </View>)}</View>
    {!rows.length&&!loading?<View style={s.empty}><Text style={s.meta}>No gift catalog rows available.</Text></View>:null}

    <Modal key={edit?.draft_key||'closed'} visible={Boolean(edit)} transparent animationType="slide" onRequestClose={()=>close(true)}>
      <SafeAreaView style={s.modalShade}><View style={s.sheet}><AiBackdrop opacity={.22}/>
        <View style={s.sheetHead}><View style={s.sheetGift}><GiftArtwork gift={edit||{}} size={46} animate={Boolean(edit)} priority={1}/></View><View style={s.flex}><Text style={s.sheetTitle}>{edit?.name||'Edit gift'}</Text><Text style={s.meta} numberOfLines={1}>{edit?.slug||''} • {edit?.effect_kind||'standard'}</Text>{feedback?<Text style={s.safe}>{feedback}</Text>:null}</View><Pressable onPress={()=>close(true)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
        <ScrollView pointerEvents={busy||uploading?'none':'auto'} style={s.formScroll} contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>GIFT NAME</Text><TextInput value={edit?.name||''} onChangeText={x=>setEdit(v=>({...v,name:x}))} maxLength={80} style={s.input}/>
          <Text style={s.label}>ICON / IMAGE / GIF URL</Text><TextInput value={edit?.asset_key||''} onChangeText={x=>setEdit(v=>({...v,asset_key:x}))} maxLength={1000} placeholder="🎁 or https://…" placeholderTextColor="#737B8E" style={s.input}/>
          <OwnerMediaField onBusyChange={uploadChanged} label="UPLOAD ICON / IMAGE / GIF" kind="image" value={isUrl(edit?.asset_key)?edit.asset_key:''} onChange={x=>setEdit(v=>({...v,asset_key:x||'🎁'}))} disabled={busy||uploading}/>
          <Text style={s.label}>EFFECT KIND</Text><TextInput value={edit?.effect_kind||''} onChangeText={x=>setEdit(v=>({...v,effect_kind:x.replace(/[^a-z0-9_-]/gi,'').toLowerCase()}))} maxLength={40} style={s.input}/>
          <OwnerMediaField onBusyChange={uploadChanged} label="ANIMATED GIFT / GIF ASSET" kind="effect" value={edit?.effect_asset_url||''} onChange={x=>setEdit(v=>({...v,effect_asset_url:x}))} disabled={busy||uploading}/>
          <Text style={s.safe}>Use a still picture for the icon and a GIF for Animated Gift. GIFs and music use the configured playback time.</Text>
          <Text style={s.label}>SCREEN PLAYBACK (SECONDS, 1–30)</Text><TextInput accessibilityLabel="Gift playback seconds" value={edit?.duration_seconds||''} onChangeText={x=>setEdit(v=>v?({...v,duration_seconds:x}):null)} keyboardType="decimal-pad" style={s.input}/>
          <OwnerMediaField onBusyChange={uploadChanged} label="GIFT SOUND / MUSIC" kind="audio" value={edit?.sound_url||''} onChange={x=>setEdit(v=>({...v,sound_url:x}))} disabled={busy||uploading}/>
          <View style={s.two}><View style={s.half}><Text style={s.label}>COIN PRICE</Text><TextInput value={edit?.coin_price||''} onChangeText={x=>setEdit(v=>({...v,coin_price:x.replace(/[^0-9]/g,'')}))} keyboardType="number-pad" style={s.input}/></View><View style={s.half}><Text style={s.label}>DIAMOND VALUE</Text><TextInput value={edit?.diamond_value||''} onChangeText={x=>setEdit(v=>({...v,diamond_value:x.replace(/[^0-9]/g,'')}))} keyboardType="number-pad" style={s.input}/></View></View>
          <Text style={s.label}>CATEGORY</Text><TextInput value={edit?.category||''} onChangeText={x=>setEdit(v=>({...v,category:x.replace(/[^a-z0-9_-]/gi,'').toLowerCase()}))} maxLength={30} style={s.input}/>
          <View style={s.two}><View style={s.half}><Text style={s.label}>SORT ORDER</Text><TextInput value={edit?.sort_order||''} onChangeText={x=>setEdit(v=>({...v,sort_order:x.replace(/[^0-9]/g,'')}))} keyboardType="number-pad" style={s.input}/></View><View style={s.half}><Text style={s.label}>MINIMUM VIP LEVEL</Text><TextInput value={edit?.min_vip_level||''} onChangeText={x=>setEdit(v=>({...v,min_vip_level:x.replace(/[^0-9]/g,'')}))} keyboardType="number-pad" style={s.input}/></View></View>
          <Text style={s.label}>COMBO QUANTITIES</Text><TextInput value={edit?.combo_text||''} onChangeText={x=>setEdit(v=>({...v,combo_text:x}))} keyboardType="numbers-and-punctuation" placeholder="9, 99, 999, 9999" placeholderTextColor="#737B8E" style={s.input}/>
          <Text style={s.label}>CUSTOM COMBO MAX</Text><TextInput value={edit?.custom_combo_max||''} onChangeText={x=>setEdit(v=>({...v,custom_combo_max:x.replace(/[^0-9]/g,'')}))} keyboardType="number-pad" style={s.input}/>
          <SwitchLine label="Allow custom combo" value={Boolean(edit?.allow_custom_combo)} onChange={x=>setEdit(v=>({...v,allow_custom_combo:x}))}/>
          <SwitchLine label="Featured gift" value={Boolean(edit?.featured)} onChange={x=>setEdit(v=>({...v,featured:x}))}/>
          <SwitchLine label="Active / visible" value={Boolean(edit?.active)} onChange={x=>setEdit(v=>({...v,active:x}))}/>
          <Text style={s.safe}>Only the selected gift is changed. Save/cancel stays on this screen; no page scroll is required.</Text>
        </ScrollView>
        <View style={s.footer}><Pressable disabled={busy||uploading} onPress={()=>close(true)} style={s.cancel}><Text style={s.cancelText}>CANCEL</Text></Pressable><Pressable disabled={busy||uploading} onPress={save} style={[s.save,busy&&{opacity:.55}]}><Text style={s.saveText}>{busy?'SAVING…':'SAVE GIFT'}</Text></Pressable></View>
      </View></SafeAreaView>
    </Modal>
  </View>;
}

function SwitchLine({label,value,onChange}){return <View style={s.switchLine}><Text style={s.switchText}>{label}</Text><Switch value={Boolean(value)} onValueChange={onChange}/></View>}

const s=StyleSheet.create({wrap:{marginTop:14,borderRadius:19,backgroundColor:'#10141E',borderWidth:1,borderColor:'#684974',padding:11},head:{flexDirection:'row',alignItems:'center',gap:8},flex:{flex:1},title:{color:C.text,fontSize:17,fontWeight:'900'},meta:{color:C.muted,fontSize:8,lineHeight:13,marginTop:3},refresh:{minWidth:69,minHeight:34,borderRadius:11,backgroundColor:'#281B35',alignItems:'center',justifyContent:'center',paddingHorizontal:8},refreshText:{color:C.cyan,fontSize:7,fontWeight:'900'},list:{marginTop:9,gap:7},row:{minHeight:78,borderRadius:16,backgroundColor:'#180F25',borderWidth:1,borderColor:'#684974',padding:8,flexDirection:'row',alignItems:'center',gap:9,overflow:'hidden'},thumb:{width:56,height:56,borderRadius:14,backgroundColor:'#0D1019',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0},thumbImg:{width:48,height:48},emoji:{fontSize:30},copy:{flex:1,minWidth:0},name:{color:C.text,fontSize:11,fontWeight:'900'},flags:{flexDirection:'row',flexWrap:'wrap',gap:4,marginTop:5},flag:{fontSize:6,fontWeight:'900',paddingHorizontal:6,paddingVertical:3,borderRadius:999,overflow:'hidden'},on:{color:C.green,backgroundColor:'#123026'},off:{color:'#FF9AAD',backgroundColor:'#351923'},featured:{color:C.gold,backgroundColor:'#342B12'},vip:{color:'#D8C4FF',backgroundColor:'#2A2143'},edit:{width:55,minHeight:38,borderRadius:11,backgroundColor:'#5039BB',alignItems:'center',justifyContent:'center',flexShrink:0},editText:{color:'#fff',fontSize:8,fontWeight:'900'},empty:{padding:18,alignItems:'center'},modalShade:{flex:1,backgroundColor:'#000A',justifyContent:'flex-end'},sheet:{maxHeight:'88%',minHeight:'68%',backgroundColor:C.bg,borderTopLeftRadius:26,borderTopRightRadius:26,borderWidth:1,borderColor:'#39334F',overflow:'hidden'},sheetHead:{minHeight:78,padding:12,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:'#684974',backgroundColor:'#111521'},sheetGift:{width:52,height:52,borderRadius:14,backgroundColor:'#0D1019',alignItems:'center',justifyContent:'center',overflow:'hidden'},sheetImg:{width:46,height:46},sheetEmoji:{fontSize:29},sheetTitle:{color:C.text,fontSize:15,fontWeight:'900'},close:{width:38,height:38,borderRadius:12,backgroundColor:'#281B35',alignItems:'center',justifyContent:'center'},closeText:{color:C.text,fontSize:22,fontWeight:'500'},formScroll:{flex:1},form:{padding:13,paddingBottom:22},label:{color:C.muted,fontSize:7,fontWeight:'900',letterSpacing:.7,marginTop:8},input:{minHeight:44,borderRadius:12,backgroundColor:'#0D1019',borderWidth:1,borderColor:'#30364A',color:C.text,paddingHorizontal:11,marginTop:5},two:{flexDirection:'row',gap:8},half:{flex:1},switchLine:{minHeight:48,borderRadius:12,backgroundColor:'#180F25',borderWidth:1,borderColor:'#684974',paddingHorizontal:11,marginTop:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},switchText:{color:C.text,fontSize:9,fontWeight:'800'},safe:{color:C.cyan,fontSize:8,lineHeight:13,marginTop:10},footer:{minHeight:70,padding:11,flexDirection:'row',gap:8,borderTopWidth:1,borderTopColor:'#684974',backgroundColor:'#111521'},cancel:{flex:1,borderRadius:13,backgroundColor:'#281B35',borderWidth:1,borderColor:'#684974',alignItems:'center',justifyContent:'center'},cancelText:{color:C.text,fontSize:9,fontWeight:'900'},save:{flex:1.4,borderRadius:13,backgroundColor:'#67407C',alignItems:'center',justifyContent:'center'},saveText:{color:'#fff',fontSize:9,fontWeight:'900'}});

