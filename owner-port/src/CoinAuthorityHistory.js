import React,{useEffect,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {AiPressable as Pressable} from './AiChrome';
import {supabase} from '../lib/supabase';
import {boundedRpc} from './boundedRpc';

export default function CoinAuthorityHistory({publicId=null}){
 const [rows,setRows]=useState([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false),[denied,setDenied]=useState(false);
 const alive=useRef(true),epoch=useRef(0),pending=useRef(false);
 const load=async(append=false)=>{if(pending.current)return;pending.current=true;const token=++epoch.current;setBusy(true);setError('');const cursor=append?rows[rows.length-1]:null;
  try{const result=await boundedRpc(supabase,'load_coin_authority_history_v149',{p_public_id:publicId==null?null:Number(publicId),p_limit:51,p_before_created_at:cursor?.created_at||null,p_before_id:cursor?.id||null},{label:'Coin authority history'});
   if(!alive.current||token!==epoch.current)return;if(result.error)throw result.error;const page=(result.data||[]).slice(0,50);
   setRows(previous=>append?[...previous,...page.filter(item=>!previous.some(old=>old.id===item.id))]:page);setMore((result.data||[]).length>50);setLoaded(true);setDenied(false);
  }catch(e){if(alive.current&&token===epoch.current){setDenied(String(e.message).includes('Only App Owner'));setError(e.message||'Could not load history.');}}
  finally{pending.current=false;if(alive.current&&token===epoch.current)setBusy(false);}};
 useEffect(()=>{alive.current=true;pending.current=false;setRows([]);setLoaded(false);setMore(false);setDenied(false);load();return()=>{alive.current=false;++epoch.current;};},[publicId]);
 if(denied)return null;
 const text={color:'#F8F9FF',fontSize:12,lineHeight:19};
 return <View style={{gap:9,padding:12,marginTop:12,borderColor:'#684974',borderWidth:1,borderRadius:16}}>
  <Text style={{...text,fontWeight:'900'}}>Coin authority history{publicId===0?' • Owner • all':''}</Text>
  {error?<Text accessibilityRole="alert" style={{...text,color:'#FFB4C6'}}>{error}</Text>:null}
  {!loaded?<Text style={text}>{busy?'Loading history…':'History unavailable. Reload to retry.'}</Text>:!rows.length?<Text style={text}>No coin authority transactions yet.</Text>:rows.map(row=><View key={row.id} style={{borderTopWidth:1,borderColor:'#684974',paddingTop:9}}>
   <Text selectable style={text}>{row.event_type==='coin_adjustment'?`${Number(row.amount)>0?'+':''}${Number(row.amount).toLocaleString()} coins • ID ${row.actor_public_id||'Owner'} → ID ${row.target_public_id}`:`Authority ${row.details?.authority_action||'updated'} • ID ${row.target_public_id}`}</Text>
   <Text selectable style={{...text,color:'#A9B2C4'}}>{new Date(row.created_at).toLocaleString()} • {row.details?.note||row.details?.reason||''}</Text>
   <Text selectable style={{...text,color:'#A9B2C4'}}>Record {row.id}</Text>
  </View>)}
  <Pressable disabled={busy} onPress={()=>load(false)}><Text style={text}>{busy?'CHECKING…':'RELOAD HISTORY'}</Text></Pressable>
  {more?<Pressable disabled={busy} onPress={()=>load(true)}><Text style={text}>LOAD MORE TRANSACTIONS</Text></Pressable>:null}
 </View>;
}

