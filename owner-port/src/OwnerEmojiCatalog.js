import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{useEffect,useRef,useState} from 'react';
import {Modal,ScrollView,StyleSheet,Switch,View} from 'react-native';
import {supabase} from '../lib/supabase';
import {OwnerMediaField} from './OwnerCatalogMedia';
import RoomReactionArt from './RoomReactionArt';
import {httpsMedia,validateMediaDuration} from './catalogMedia';

const Button=({children,onPress,disabled})=><Pressable disabled={disabled} onPress={onPress} style={[s.button,disabled&&{opacity:.45}]}><Text style={s.text}>{children}</Text></Pressable>;
export default function OwnerEmojiCatalog({onNotice}){
  const [rows,setRows]=useState([]),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const lock=useRef(false),alive=useRef(true),uploadCount=useRef(0);
  const [uploading,setUploading]=useState(false);
  const uploadChanged=value=>{uploadCount.current=Math.max(0,uploadCount.current+(value?1:-1));if(alive.current)setUploading(uploadCount.current>0)};
  const notify=message=>{if(alive.current){setNotice(message);onNotice?.(message)}};
  const load=async()=>{try{const {data,error}=await supabase.rpc('owner_list_room_emoji_catalog_v3');if(error)throw error;if(alive.current)setRows(Array.isArray(data)?data:[]);}catch(error){notify(error.message||'Could not load Emoji Catalog.')}};
  useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false}},[]);
  const open=row=>{setNotice('');setDraft({...row,is_new:!row.reaction_key,draft_key:`${row.reaction_key||'new'}-${Date.now()}`,seconds:String(Number(row.duration_ms||5000)/1000),sort_order:String(row.sort_order||0)});};
  const change=(key,value)=>setDraft(current=>current?{...current,[key]:value}:null);
  const close=()=>{if(!lock.current&&!uploadCount.current)setDraft(null)};
  const save=async()=>{
    if(lock.current||uploadCount.current||!draft)return;
    try{
      const duration=validateMediaDuration(draft.seconds),order=Number(draft.sort_order);
      if(!/^[a-z][a-z0-9_]{1,63}$/.test(draft.reaction_key||''))throw new Error('Key: 2–64 lowercase letters, numbers or underscores; start with a letter.');
      if(!draft.display_label?.trim()||draft.display_label.trim().length>40)throw new Error('Enter a label of 1–40 characters.');
      if(!draft.emoji?.trim()||draft.emoji.trim().length>16)throw new Error('Add a short fallback emoji.');
      if(!Number.isSafeInteger(order)||order<0||order>1000000)throw new Error('Sort order must be between 0 and 1000000.');
      if([draft.media_url,draft.poster_url,draft.sound_url].some(url=>url&&!httpsMedia(url)))throw new Error('Media links must use HTTPS.');
      lock.current=true;setBusy(true);
      const {error}=await supabase.rpc('owner_upsert_room_emoji_catalog_v3',{p_reaction_key:draft.reaction_key,p_display_label:draft.display_label.trim(),p_emoji:draft.emoji.trim(),p_sound_url:draft.sound_url||null,p_sort_order:order,p_active:Boolean(draft.active),p_media_url:draft.media_url||null,p_poster_url:draft.poster_url||null,p_duration_ms:duration,p_expected_updated_at:draft.updated_at||null,p_is_new:Boolean(draft.is_new)});
      if(error)throw error;
      if(alive.current){setDraft(null);notify('Emoji saved. Reopen Room Emoji to see the updated catalog.');await load();}
    }catch(error){notify(error.message||'Could not save Emoji. Your draft is kept.');}finally{lock.current=false;if(alive.current)setBusy(false)}
  };
  return <View style={s.panel}><AiBackdrop opacity={.22}/><Text style={s.title}>Emoji Catalog</Text><View style={s.row}><Button onPress={()=>open({reaction_key:'',display_label:'',emoji:'😊',active:true,sort_order:rows.length+1,media_url:'',poster_url:'',sound_url:'',duration_ms:5000})}>＋ NEW EMOJI</Button><Button onPress={load}>REFRESH</Button></View>{notice?<Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>:null}
    {rows.map(row=><View key={row.reaction_key} style={s.catalogRow}><RoomReactionArt reactionKey={row.reaction_key} emoji={row.emoji} mediaUrl={row.media_url} posterUrl={row.poster_url} label={row.display_label} size={42} animate={false}/><View style={s.flex}><Text style={s.text}>{row.display_label}</Text><Text style={s.muted}>{Number(row.duration_ms||5000)/1000}s • {row.active?'ACTIVE':'OFF'}</Text></View><Button onPress={()=>open(row)}>EDIT</Button></View>)}
    <Modal key={draft?.draft_key||'closed'} visible={Boolean(draft)} transparent animationType="slide" onRequestClose={close}><View style={s.shade}><View style={s.sheet}><AiBackdrop opacity={.22}/><Text style={s.title}>{draft?.is_new?'New Emoji':'Edit Emoji'}</Text><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
      {notice?<Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>:null}
      <RoomReactionArt reactionKey={draft?.reaction_key} emoji={draft?.emoji} mediaUrl={draft?.media_url} posterUrl={draft?.poster_url} size={76} animate={Boolean(draft)}/>
      {[['reaction_key','Unique key'],['display_label','Display name'],['emoji','Fallback emoji'],['seconds','Playback seconds (1–30)'],['sort_order','Sort order']].map(([key,label])=><View key={key}><Text style={s.muted}>{label}</Text><TextInput accessibilityLabel={label} value={draft?.[key]||''} editable={!busy&&(key!=='reaction_key'||Boolean(draft?.is_new))} onChangeText={value=>change(key,value)} autoCapitalize="none" keyboardType={['seconds','sort_order'].includes(key)?'decimal-pad':'default'} style={s.input}/></View>)}
      <OwnerMediaField onBusyChange={uploadChanged} label="EMOJI IMAGE / GIF" kind="image" value={draft?.media_url||''} onChange={value=>change('media_url',value)} disabled={busy||uploading}/>
      <OwnerMediaField onBusyChange={uploadChanged} label="STILL PREVIEW (OPTIONAL PNG / JPEG / WEBP)" kind="poster" value={draft?.poster_url||''} onChange={value=>change('poster_url',value)} disabled={busy||uploading}/>
      <Text style={s.muted}>Add any GIF and optional music, then set its display name and playback time. A still preview or fallback emoji is used when motion is reduced, playback ends or media cannot load.</Text>
      <OwnerMediaField onBusyChange={uploadChanged} label="SOUND (OPTIONAL)" kind="audio" value={draft?.sound_url||''} onChange={value=>change('sound_url',value)} disabled={busy||uploading}/>
      <View style={s.row}><Text style={s.text}>Active / visible</Text><Switch disabled={busy||uploading} value={Boolean(draft?.active)} onValueChange={value=>change('active',value)}/></View>
    </ScrollView><View style={s.row}><Button disabled={busy||uploading} onPress={close}>CANCEL</Button><Button disabled={busy||uploading} onPress={save}>{busy?'SAVING…':'SAVE EMOJI'}</Button></View></View></View></Modal>
  </View>;
}
const s=StyleSheet.create({panel:{padding:12,gap:12,backgroundColor:'#10141E',borderRadius:16},title:{color:'#FFF',fontWeight:'800',fontSize:18},text:{color:'#F8F9FF',fontSize:12},muted:{color:'#A8B3C9',fontSize:11,lineHeight:17},notice:{color:'#88E3DF',fontSize:12},row:{flexDirection:'row',alignItems:'center',gap:10},button:{minHeight:46,padding:12,borderRadius:12,backgroundColor:'#5039BB',justifyContent:'center'},catalogRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#30364A'},flex:{flex:1},shade:{flex:1,backgroundColor:'#000A',justifyContent:'flex-end'},sheet:{maxHeight:'88%',backgroundColor:'#10141E',padding:18,paddingBottom:32,borderTopLeftRadius:22,borderTopRightRadius:22,gap:12},form:{gap:12,paddingBottom:20},input:{minHeight:46,borderWidth:1,borderColor:'#56617C',borderRadius:10,color:'#FFF',padding:10}});

