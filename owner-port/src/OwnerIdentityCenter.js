import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React, { useEffect, useRef, useState } from "react";
import {Alert,Image,StyleSheet,View} from 'react-native';
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../lib/supabase";
import { ownerMediaDestination, PROFILE_AUDIO_TYPES } from "./ownerProfileMedia";
const C = {
  panel: "#180F25",
  panel2: "#281B35",
  line: "#684974",
  text: "#F8F9FF",
  muted: "#8F99AF",
  purple: "#67407C",
  cyan: "#5FE5FF",
  gold: "#FFD76D",
};
export default function OwnerIdentityCenter({ onNotice, initialPublicId = "", lockTarget = false, onSaved }) {
  const [kind, setKind] = useState("user"),
    [publicId, setPublicId] = useState(String(initialPublicId || "")),
    [item, setItem] = useState(null),
    [name, setName] = useState(""),
    [bio, setBio] = useState(""),
    [avatar, setAvatar] = useState(null),
    [background, setBackground] = useState(null),
    [audio, setAudio] = useState(null),
    [country, setCountry] = useState(""),
    [busy, setBusy] = useState(false);
  const requestEpoch = useRef(0);
  const saveLock = useRef(false);
  const notify = (x) => onNotice?.(x);
  const lookup = async () => {
    const id = Number(publicId);
    if (!id) { notify("Permanent ID required"); return false; }
    const epoch = ++requestEpoch.current;
    setBusy(true);
    try {
      const res = kind === "user"
        ? await supabase.rpc("owner_authority_dashboard", { p_public_id: id })
        : await supabase.rpc("owner_lookup_room", { p_room_public_id: id });
      if (epoch !== requestEpoch.current) return false;
      if (res.error) throw res.error;
      let d = kind === "user" ? res.data?.profile : res.data;
      if (kind === 'user' && d?.id) {
        const full = await supabase.from('profiles').select('display_name,bio,avatar_url,cover_url,country_code,level,profile_audio_url,updated_at').eq('id',d.id).single();
        if (full.error) throw full.error;
        d = {...d,...full.data};
      }
      if (epoch !== requestEpoch.current) return false;
      if (!d) throw new Error(`${kind} not found`);
      setItem({...d,public_id:id,kind});
      setName(d.display_name || d.name || "");
      setBio(d.bio || d.announcement || "");
      setAvatar(d.avatar_url || null);
      setBackground(d.cover_url || d.background_url || null);
      setAudio(d.profile_audio_url || d.room_audio_url || null);
      setCountry(d.country_code || "");
      notify(`${kind === "user" ? "User" : "Room"} loaded • ID ${id}`);
      return true;
    } catch (error) {
      if (epoch === requestEpoch.current) notify(error.message || 'Could not load this profile. Please retry.');
      return false;
    } finally {
      if (epoch === requestEpoch.current) setBusy(false);
    }
  };
  useEffect(()=>{if(initialPublicId)void lookup();return()=>{requestEpoch.current+=1}},[initialPublicId]);
  const selectMedia = async (type) => {
    if (!item?.id || busy || saveLock.current) return;
    const epoch=requestEpoch.current;
    saveLock.current=true;
    setBusy(true);
    try {
      let r;
      if (type==='audio') {
        r=await DocumentPicker.getDocumentAsync({type:kind==='user'?PROFILE_AUDIO_TYPES:'audio/*',copyToCacheDirectory:true});
      } else {
        const perm=await ImagePicker.requestMediaLibraryPermissionsAsync();
        if(!perm.granted) { Alert.alert("Photo permission required"); return; }
        r=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,aspect:type==='background'?[16,9]:[1,1],quality:0.78});
      }
      if(r.canceled || epoch!==requestEpoch.current) return;
      const asset=r.assets[0];
      const destination=ownerMediaDestination({kind,targetId:item.id,type,asset});
      const bytes=await (await fetch(asset.uri)).arrayBuffer();
      if(bytes.byteLength>destination.limit)throw new Error('This file is too large.');
      if(epoch!==requestEpoch.current)return;
      const {bucket,path}=destination;
      const up=await supabase.storage.from(bucket).upload(path,bytes,{contentType:destination.mime,upsert:false});
      if(up.error)throw up.error;
      if(epoch!==requestEpoch.current)return;
      const url=supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      if(type==='audio')setAudio(url);
      else if(type==='avatar')setAvatar(url);
      else setBackground(url);
      notify('Media selected • Save changes to apply');
    }catch(error){if(epoch===requestEpoch.current)notify(error.message || 'Could not select media.');}
    finally{saveLock.current=false;if(epoch===requestEpoch.current)setBusy(false);}
  };
  const pick=type=>selectMedia(type);
  const pickAudio=()=>selectMedia('audio');
  const save = async () => {
    if(saveLock.current||busy)return;
    if (!item?.id || item.kind!==kind || Number(publicId)!==Number(item.public_id))
      return notify('Load this exact ID before saving.');
    if(name.trim().length<2)return notify('Enter a valid name.');
    const countryCode=country.trim().toUpperCase();
    if(kind==='user'&&countryCode&&!/^[A-Z]{2}$/.test(countryCode))return notify('Use a valid 2-letter country code.');
    saveLock.current=true;setBusy(true);
    try {
      let res;
      if(kind==='user'){
        res=await supabase.rpc('owner_update_user_identity_v1',{
          p_public_id:Number(item.public_id),p_display_name:name.trim(),p_bio:bio.trim(),
          p_avatar_url:avatar,p_cover_url:background,p_country_code:countryCode||null,
          p_audio_url:audio,p_expected_updated_at:item.updated_at||null,
        });
      }else{
        res=await supabase.rpc('owner_update_room_profile',{p_room_public_id:Number(item.public_id),p_name:name.trim(),p_announcement:bio.trim(),p_avatar_url:avatar,p_background_url:background});
        if(!res.error)res=await supabase.rpc('owner_update_room_audio',{p_room_public_id:Number(item.public_id),p_audio_url:audio});
      }
      if(res.error)throw res.error;
      const refreshed=await lookup();
      if(refreshed)notify(`${kind==='user'?'Profile':'Room'} updated • ID ${item.public_id}`);
      onSaved?.(res.data);
    }catch(error){notify(error.message||'Could not save. Your edits are retained.');}
    finally{saveLock.current=false;setBusy(false);}
  };
  const choose = (k) => {
    requestEpoch.current+=1;
    setKind(k);
    setPublicId("");
    setItem(null);
    setName("");
    setBio("");
    setAvatar(null);
    setBackground(null);
    setAudio(null);
  };
  return (
    <View style={s.wrap}><AiBackdrop opacity={.22}/>
      <Text style={s.title}>Edit profile</Text>
      {lockTarget?<Pressable disabled={busy} onPress={lookup} style={[s.check,s.reload]}><Text style={[s.checkText,s.reloadText]}>{busy?"PLEASE WAIT…":"RELOAD PROFILE"}</Text></Pressable>:null}
      <Text style={s.help}>
        Update name, DP, bio, cover, country and background music. Save changes to apply.
      </Text>
      {!lockTarget?<View style={s.tabs}>
        {["user", "room"].map((x) => (
          <Pressable
            key={x}
            disabled={busy}
            onPress={() => choose(x)}
            style={[s.tab, kind === x && s.tabOn]}
          >
            <Text style={s.tabText}>{x.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>:null}
      {!lockTarget?<View style={s.lookup}>
        <TextInput
          value={publicId}
          editable={!busy}
          onChangeText={setPublicId}
          keyboardType="number-pad"
          placeholder={`${kind === "user" ? "User" : "Room"} permanent ID`}
          placeholderTextColor="#737B8E"
          style={[s.input, s.flex]}
        />
        <Pressable disabled={busy} onPress={lookup} style={s.check}>
          <Text style={s.checkText}>{busy ? "…" : "CHECK"}</Text>
        </Pressable>
      </View>:null}
      {item ? (
        <View style={s.editor}>
          <View style={s.hero}>
            {background ? (
              <Image
                source={{ uri: background }}
                style={StyleSheet.absoluteFillObject}
              />
            ) : null}
            <Pressable disabled={busy} onPress={() => pick("background")} style={s.bgBtn}>
              <Text style={s.bgText}>CHANGE BACKGROUND</Text>
            </Pressable>
          </View>
          <Pressable disabled={busy} onPress={() => pick("avatar")} style={s.avatarWrap}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={s.avatar} />
            ) : (
              <View style={s.avatar}>
                <Text style={{ fontSize: 28 }}>☺</Text>
              </View>
            )}
            <Text style={s.photoText}>CHANGE DP</Text>
          </Pressable>
          <Text style={s.meta}>
            ID {publicId}
            {item.country_code ? ` • ${item.country_code}` : ""}
          </Text>
          <TextInput
            value={name}
            editable={!busy}
            onChangeText={setName}
            maxLength={kind === "user" ? 40 : 80}
            placeholder="Name"
            placeholderTextColor="#737B8E"
            style={s.full}
          />
          {kind === "user" ? (
            <TextInput
              value={country}
              editable={!busy}
              onChangeText={(x) =>
                setCountry(
                  x
                    .replace(/[^a-z]/gi, "")
                    .slice(0, 2)
                    .toUpperCase(),
                )
              }
              maxLength={2}
              autoCapitalize="characters"
              placeholder="Country code • SA / IN / PK"
              placeholderTextColor="#737B8E"
              style={s.full}
            />
          ) : null}
          <TextInput
            value={bio}
            editable={!busy}
            onChangeText={setBio}
            maxLength={kind === "user" ? 240 : 500}
            multiline
            placeholder={kind === "user" ? "Bio" : "Room announcement"}
            placeholderTextColor="#737B8E"
            style={[s.full, s.bio]}
          />
          <View style={s.audioRow}>
            <Pressable disabled={busy} onPress={pickAudio} style={s.audioBtn}>
              <Text style={s.audioText}>
                {audio ? "CHANGE BACKGROUND MUSIC" : "ADD BACKGROUND MUSIC"}
              </Text>
            </Pressable>
            {audio ? (
              <Pressable disabled={busy} onPress={() => setAudio(null)} style={s.audioRemove}>
                <Text style={s.audioRemoveText}>REMOVE</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={s.audioMeta}>
            {audio ? "Music selected • Save changes to apply" : "No background music selected"}
          </Text>
          <Pressable disabled={busy} onPress={save} style={s.save}>
            <Text style={s.saveText}>
              {busy ? "PLEASE WAIT…" : "SAVE CHANGES"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  audioRow: { flexDirection: "row", gap: 7, marginTop: 8 },
  audioBtn: { flex: 1, minHeight: 42, borderRadius: 11, backgroundColor: "#262044", borderWidth: 1, borderColor: '#67407C', alignItems: "center", justifyContent: "center" },
  audioText: { color: C.cyan, fontSize: 7, fontWeight: "900" },
  audioRemove: { minWidth: 70, borderRadius: 11, backgroundColor: "#3A1D29", alignItems: "center", justifyContent: "center" },
  audioRemoveText: { color: "#FF9AAC", fontSize: 7, fontWeight: "900" },
  audioMeta: { color: C.muted, fontSize: 7, marginTop: 5 },
  wrap: {
    marginTop: 12,
    borderRadius: 19,
    backgroundColor: "#0E1220",
    borderWidth: 1,
    borderColor: '#684974',
    padding: 11,
  },
  title: { color: C.text, fontSize: 16, fontWeight: "900" },
  help: { color: C.muted, fontSize: 8, lineHeight: 14, marginTop: 4 },
  tabs: { flexDirection: "row", gap: 6, marginTop: 9 },
  tab: {
    flex: 1,
    minHeight: 35,
    borderRadius: 11,
    backgroundColor: '#281B35',
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: "#5039BB", borderWidth: 1, borderColor: C.gold },
  tabText: { color: C.text, fontSize: 8, fontWeight: "900" },
  lookup: { flexDirection: "row", gap: 6 },
  input: {
    minHeight: 43,
    borderRadius: 11,
    backgroundColor: "#0D1019",
    borderWidth: 1,
    borderColor: '#684974',
    color: C.text,
    paddingHorizontal: 10,
    marginTop: 7,
  },
  flex: { flex: 1 },
  check: {
    minWidth: 68,
    borderRadius: 11,
    backgroundColor: '#67407C',
    alignItems: "center",
    justifyContent: "center",
    marginTop: 7,
  },
  reload: { minHeight:44, paddingHorizontal:14, paddingVertical:10, alignSelf:"stretch" },
  reloadText: { fontSize:12, lineHeight:18 },
  checkText: { color: "#fff", fontSize: 7, fontWeight: "900" },
  editor: {
    marginTop: 9,
    borderRadius: 17,
    backgroundColor: '#180F25',
    borderWidth: 1,
    borderColor: '#684974',
    padding: 9,
  },
  hero: {
    height: 84,
    borderRadius: 14,
    backgroundColor: "#201A38",
    overflow: "hidden",
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  bgBtn: {
    backgroundColor: "#121621DD",
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    margin: 6,
  },
  bgText: { color: C.cyan, fontSize: 6, fontWeight: "900" },
  avatarWrap: { alignSelf: "center", alignItems: "center", marginTop: -30 },
  avatar: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: "#29234C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.gold,
  },
  photoText: { color: C.cyan, fontSize: 6, fontWeight: "900", marginTop: 4 },
  meta: { color: C.muted, fontSize: 7, textAlign: "center", marginTop: 4 },
  full: {
    minHeight: 43,
    borderRadius: 11,
    backgroundColor: "#0D1019",
    borderWidth: 1,
    borderColor: '#684974',
    color: C.text,
    paddingHorizontal: 10,
    marginTop: 7,
  },
  bio: { minHeight: 80, textAlignVertical: "top", paddingTop: 10 },
  save: {
    minHeight: 43,
    borderRadius: 11,
    backgroundColor: '#67407C',
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveText: { color: "#fff", fontSize: 8, fontWeight: "900" },
});

