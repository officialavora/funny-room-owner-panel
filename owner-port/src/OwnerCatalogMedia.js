import {HomeAIText as Text} from './HomeAIChrome';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,StyleSheet,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {supabase} from '../lib/supabase';
import {CATALOG_IMAGE_TYPES} from './catalogMedia';

const AUDIO_TYPES=['audio/mpeg','audio/mp4','audio/aac','audio/x-m4a','audio/ogg','audio/wav','audio/x-wav'];
const TYPES={image:CATALOG_IMAGE_TYPES,effect:CATALOG_IMAGE_TYPES,poster:CATALOG_IMAGE_TYPES.filter(type=>type!=='image/gif'),audio:AUDIO_TYPES};
const LIMITS={image:5,effect:5,poster:5,audio:20};
const MIME_BY_EXT={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',wav:'audio/wav'};

export async function uploadOwnerCatalogMedia(kind='image'){
  const result=await DocumentPicker.getDocumentAsync({type:TYPES[kind]||TYPES.image,copyToCacheDirectory:true,multiple:false});
  if(result.canceled)return null;
  const asset=result.assets?.[0];
  if(!asset?.uri)return null;
  const limit=LIMITS[kind]||5;
  if(Number(asset.size||0)>limit*1024*1024)throw new Error(`${kind==='audio'?'Audio':'Asset'} must be ${limit} MB or smaller`);
  const {data:userData,error:userError}=await supabase.auth.getUser();
  if(userError||!userData?.user)throw userError||new Error('Sign in again');
  const rawExt=String(asset.name||`${kind}.bin`).split('.').pop()?.toLowerCase()||'bin';
  const ext=rawExt.replace(/[^a-z0-9]/g,'').slice(0,8)||'bin';
  const mime=asset.mimeType||MIME_BY_EXT[ext];
  if(!(TYPES[kind]||TYPES.image).includes(mime))throw new Error('Choose a PNG, JPEG, WebP or GIF image, or a supported audio file.');
  const path=`${userData.user.id}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2,10)}.${ext}`;
  const bytes=await(await fetch(asset.uri)).arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>limit*1024*1024)throw new Error(`Asset must be between 1 byte and ${limit} MB`);
  const bucket=kind==='audio'?'owner-catalog-audio':'owner-catalog';
  const uploaded=await supabase.storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false});
  if(uploaded.error)throw uploaded.error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function OwnerMediaField({label,value,onChange,kind='image',disabled=false,onBusyChange}){
  const [busy,setBusy]=useState(false);
  const lock=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
  const choose=async()=>{if(lock.current||disabled)return;lock.current=true;setBusy(true);onBusyChange?.(true);try{const url=await uploadOwnerCatalogMedia(kind);if(url&&alive.current)onChange(url);}catch(error){if(alive.current)Alert.alert(label,error.message||'Upload failed')}finally{lock.current=false;onBusyChange?.(false);if(alive.current)setBusy(false)}};
  return <View style={s.wrap}><AiBackdrop opacity={.22}/><Text style={s.label}>{label}</Text><Text style={s.value} numberOfLines={2}>{value||'No asset selected'}</Text><View style={s.row}><Pressable disabled={disabled||busy} onPress={choose} style={s.pick}><Text style={s.pickText}>{busy?'UPLOADING…':value?'CHANGE / UPLOAD':'ADD / UPLOAD'}</Text></Pressable>{value?<Pressable disabled={disabled||busy} onPress={()=>onChange('')} style={s.remove}><Text style={s.removeText}>REMOVE</Text></Pressable>:null}</View></View>;
}

const s=StyleSheet.create({wrap:{marginTop:9},label:{color:'#9199AD',fontSize:7,fontWeight:'900',letterSpacing:.7},value:{minHeight:31,borderRadius:10,backgroundColor:'#0D1019',borderWidth:1,borderColor:'#30364A',color:'#B7BED0',fontSize:7,padding:8,marginTop:5},row:{flexDirection:'row',gap:7,marginTop:5},pick:{flex:1,minHeight:38,borderRadius:11,backgroundColor:'#282044',borderWidth:1,borderColor:'#7558FF',alignItems:'center',justifyContent:'center'},pickText:{color:'#5FE2FF',fontSize:7,fontWeight:'900'},remove:{minWidth:72,borderRadius:11,backgroundColor:'#3A1D29',alignItems:'center',justifyContent:'center'},removeText:{color:'#FF9AAC',fontSize:7,fontWeight:'900'}});

