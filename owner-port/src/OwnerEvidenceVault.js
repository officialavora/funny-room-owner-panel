import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{useState} from 'react';
import {Image,StyleSheet,View} from 'react-native';
import {supabase} from '../lib/supabase';
import { PREMIUM } from './designSystem';

const C={panel:PREMIUM.colors.panel,panel2:PREMIUM.colors.panelSoft,line:PREMIUM.colors.line,text:PREMIUM.colors.text,muted:PREMIUM.colors.muted,purple:PREMIUM.colors.violet,cyan:PREMIUM.colors.cyan,gold:PREMIUM.colors.gold,danger:PREMIUM.colors.rose};
const collectUrls=value=>{
  const found=[];
  const walk=x=>{
    if(Array.isArray(x))return x.forEach(walk);
    if(x&&typeof x==='object')return Object.values(x).forEach(walk);
    if(typeof x==='string'&&/^https?:\/\//i.test(x)&&/\.(jpg|jpeg|png|webp|gif|mp4|mov)(\?|$)/i.test(x))found.push(x);
  };
  walk(value);return [...new Set(found)].slice(0,9);
};
const pretty=v=>{const text=JSON.stringify(v||{},null,2);return text.length>1800?text.slice(0,1800)+'…':text};

export default function OwnerEvidenceVault({onNotice}){
 const [open,setOpen]=useState(false),[source,setSource]=useState('all'),[query,setQuery]=useState(''),[rows,setRows]=useState([]),[busy,setBusy]=useState(false);
 const load=async()=>{setBusy(true);const {data,error}=await supabase.rpc('owner_evidence_search',{p_source:source,p_query:query.trim()||null,p_limit:200});setBusy(false);if(error)return onNotice?.(error.message);setRows(data||[]);onNotice?.(`Evidence Vault • ${data?.length||0} records`)};
 return <View style={s.wrap}><AiBackdrop opacity={.22}/>
  <Pressable onPress={()=>setOpen(x=>!x)} style={s.head}><View><Text style={s.title}>Owner Evidence Vault</Text><Text style={s.help}>Deleted or changed Moments, comments, room/inbox messages, profiles and rooms • Owner only</Text></View><Text style={s.arrow}>{open?'▲':'▼'}</Text></Pressable>
  {open?<><View style={s.sources}>{['all','moments','moment_comments','room_messages','direct_messages','profiles','rooms'].map(x=><Pressable key={x} onPress={()=>setSource(x)} style={[s.source,source===x&&s.sourceOn]}><Text style={s.sourceText}>{x.replaceAll('_',' ').toUpperCase()}</Text></Pressable>)}</View><View style={s.search}><TextInput value={query} onChangeText={setQuery} placeholder="Content ID / user ID / text" placeholderTextColor="#737B8E" style={s.input}/><Pressable disabled={busy} onPress={load} style={s.go}><Text style={s.goText}>{busy?'…':'SEARCH'}</Text></Pressable></View>{rows.map(row=>{const media=collectUrls(row.before_data);return <View key={row.evidence_id} style={s.card}><View style={s.cardHead}><Text style={s.cardTitle}>{row.operation} • {String(row.source_table).replaceAll('_',' ').toUpperCase()}</Text><Text style={s.time}>{new Date(row.created_at).toLocaleString()}</Text></View><Text style={s.meta}>Content {row.source_id||'—'} • Subject ID {row.subject_public_id||'—'} • Action by {row.actor_name||'System'}{row.actor_public_id?` (ID ${row.actor_public_id})`:''}</Text>{media.length?<View style={s.media}>{media.map(url=>/\.(mp4|mov)(\?|$)/i.test(url)?<View key={url} style={s.video}><Text style={s.videoText}>VIDEO FILE RETAINED</Text></View>:<Image key={url} source={{uri:url}} style={s.image}/>)}</View>:null}<Text selectable style={s.json}>{pretty(row.before_data)}</Text></View>})}{!rows.length?<Text style={s.empty}>Search to open retained content history and media references.</Text>:null}</>:null}
 </View>;
}
const s=StyleSheet.create({wrap:{marginTop:12,borderRadius:19,backgroundColor:'#10141E',borderWidth:1,borderColor:'#684974',padding:10},head:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:C.text,fontSize:15,fontWeight:'900'},help:{color:C.muted,fontSize:7,lineHeight:12,marginTop:3,maxWidth:280},arrow:{color:C.gold,fontSize:10,fontWeight:'900'},sources:{flexDirection:'row',flexWrap:'wrap',gap:5,marginTop:7},source:{minHeight:31,borderRadius:9,backgroundColor:'#281B35',paddingHorizontal:8,alignItems:'center',justifyContent:'center'},sourceOn:{backgroundColor:'#4E38B8',borderWidth:1,borderColor:C.gold},sourceText:{color:C.text,fontSize:6,fontWeight:'900'},search:{flexDirection:'row',gap:6,marginTop:8},input:{flex:1,minHeight:41,borderRadius:11,backgroundColor:'#0D1019',borderWidth:1,borderColor:'#684974',color:C.text,paddingHorizontal:10},go:{minWidth:70,borderRadius:11,backgroundColor:'#67407C',alignItems:'center',justifyContent:'center'},goText:{color:'#fff',fontSize:7,fontWeight:'900'},card:{borderRadius:15,backgroundColor:'#180F25',borderWidth:1,borderColor:'#684974',padding:9,marginTop:7},cardHead:{flexDirection:'row',justifyContent:'space-between',gap:7},cardTitle:{color:C.danger,fontSize:8,fontWeight:'900'},time:{color:C.muted,fontSize:6},meta:{color:C.gold,fontSize:7,lineHeight:12,marginTop:4},media:{flexDirection:'row',flexWrap:'wrap',gap:4,marginTop:7},image:{width:72,height:72,borderRadius:9,backgroundColor:'#090B12'},video:{width:100,height:72,borderRadius:9,backgroundColor:'#11182A',alignItems:'center',justifyContent:'center'},videoText:{color:C.cyan,fontSize:6,fontWeight:'900'},json:{color:'#B8C0D0',fontSize:6,lineHeight:10,marginTop:7},empty:{color:C.muted,fontSize:8,textAlign:'center',paddingVertical:16}});

