import {useVisualActivity} from './VisualActivity';
import DragonEntryOverlay from './DragonEntryOverlay';
import {dragonVariantForItem} from './dragonEntryVariants';
import {loadCosmeticCatalog} from './cosmeticSets';
import FrameWingMotion from './FrameWingMotion';
import {emotionalGiftKey,originalEffectDuration} from './emotionalSoundRouting';
import {ORIGINAL_AUDIO_DURATION} from './originalAudioAssets';
import {propSource,propScene} from './generatedProps';
import {GeneratedEntryScene} from './PropArtwork';
import {startCatalogEntryAudio} from './catalogEntryAudio';
import React,{memo,useEffect,useMemo,useRef,useState} from 'react';
import {AppState,Animated,Image,StyleSheet,Text,View} from 'react-native';
import {supabase} from '../lib/supabase';
import {PREMIUM} from './designSystem';
import {usePlaybackEffectPreferences} from './effectPreferences';
import {playEntrySound,playGiftSound,playPKSound} from './soundEffects';
import GiftArtwork from './GiftArtwork';
import {catalogDuration,httpsMedia} from './catalogMedia';
import {subscribeRoomEffect} from './roomEffectBus';

const C=PREMIUM.colors;
let catalog=null;
let catalogPromise=null;
let catalogLoadedAt=0;
let catalogFailedAt=0;
const CATALOG_TTL=5*60*1000;
let catalogTimer=null,catalogAppSubscription=null;
const listeners=new Set();

export async function loadPremiumCatalog(force=false){
  if(catalog&&!force&&Date.now()-catalogLoadedAt<CATALOG_TTL)return catalog;
  if(!force&&catalogFailedAt&&Date.now()-catalogFailedAt<30000)return catalog||{};
  if(catalogPromise)return catalogPromise; // Share in-flight paginated fetch across all avatars.
  catalogPromise=loadCosmeticCatalog(supabase).then(data=>{
    catalog=Object.fromEntries((data||[]).map(x=>[x.code,x]));catalogLoadedAt=Date.now();catalogFailedAt=0;
    listeners.forEach(fn=>fn(catalog));
    return catalog;
  }).catch(()=>{catalogFailedAt=Date.now();return catalog||{}}).finally(()=>{catalogPromise=null});
  return catalogPromise;
}

function useCatalog(){
 const [items,setItems]=useState(catalog||{});
 useEffect(()=>{
  let live=true;const fn=next=>live&&setItems(next);listeners.add(fn);
  const refresh=()=>{if(AppState.currentState==='active')void loadPremiumCatalog().catch(()=>{});};
  if(listeners.size===1){catalogTimer=setInterval(refresh,CATALOG_TTL);catalogAppSubscription=AppState.addEventListener('change',state=>{if(state==='active')refresh();});}
  loadPremiumCatalog().then(next=>live&&setItems(next));
  return()=>{live=false;listeners.delete(fn);if(!listeners.size){clearInterval(catalogTimer);catalogTimer=null;catalogAppSubscription?.remove();catalogAppSubscription=null;}};
 },[]);
 return items;
}

export const PremiumAvatar=memo(function PremiumAvatar({uri,fallback='☺',size=48,frameCode=null,verified=false,vipLevel=0,animate=false,style}){
  const items=useCatalog();
  const frame=frameCode?items[frameCode]:null;
  const visual=frame?.visual||{};const frameArt=propSource(frame);const faceSize=frameArt?size*.62:size;
  const scale=useRef(new Animated.Value(animate ? .92 : 1)).current;
  const aura=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    scale.stopAnimation();aura.stopAnimation();scale.setValue(animate ? .92 : 1);aura.setValue(0);
    if(!animate)return undefined;
    const entrance=Animated.spring(scale,{toValue:1,useNativeDriver:true,damping:15,stiffness:160,mass:.7});
    const glow=frameCode?Animated.loop(Animated.sequence([Animated.timing(aura,{toValue:1,duration:900,useNativeDriver:true}),Animated.timing(aura,{toValue:0,duration:900,useNativeDriver:true})]),{iterations:2}):null;
    entrance.start();if(glow)glow.start();return()=>{entrance.stop();glow?.stop();};
  },[animate,scale,aura,frameCode]);
  const border=visual.border||visual.accent||(vipLevel>0?C.gold:C.line);
  const glow=visual.glow||border;
  const radius=Math.round(size*.36);
  const auraScale=aura.interpolate({inputRange:[0,1],outputRange:[1,1.13]});
  const auraOpacity=aura.interpolate({inputRange:[0,1],outputRange:[.18,.58]});
  return <Animated.View style={[{width:size,height:size,borderRadius:radius,borderWidth:frameArt?0:frameCode?3:2,borderColor:border,backgroundColor:'#252A3A',alignItems:'center',justifyContent:'center',shadowColor:glow,shadowOpacity:frameCode ? .36 : .12,shadowRadius:frameCode?10:3,elevation:frameCode?6:1,transform:[{scale}]},style]}>
    {frameCode&&!frameArt?<Animated.View pointerEvents="none" style={{position:'absolute',width:size+10,height:size+10,borderRadius:radius+7,borderWidth:2,borderColor:glow,opacity:animate?auraOpacity:.28,transform:[{scale:animate?auraScale:1}]}}/>:null}
    {frameCode&&!frameArt&&vipLevel>0?<View pointerEvents="none" style={{position:'absolute',width:size+4,height:size+4,borderRadius:radius+4,borderWidth:1,borderColor:(visual.border||C.gold)+'99'}}/>:null}
    {uri?<Image source={{uri}} style={{width:faceSize,height:faceSize,borderRadius:frameArt?size:Math.max(2,radius-3)}}/>:<Text style={{fontSize:Math.round(size*.47)}}>{fallback}</Text>}
    {frameArt?<FrameWingMotion source={frameArt} size={size} animate/>:null}
    {!frameArt&&visual.icon?<View style={[s.frameIcon,{borderColor:border}]}><Text style={s.frameIconText}>{visual.icon}</Text></View>:null}
    {verified?<View style={s.verify}><Text style={s.verifyText}>✦</Text></View>:null}
  </Animated.View>;
});

export function PremiumBadge({code,label,hidePremiumIdentity=false}){
  const items=useCatalog();const item=code?items[code]:null;if(!item&&!label)return null;const v=item?.visual||{};
  if(hidePremiumIdentity&&/^(?:SVIP|VIP|LV[. ]?|LEVEL)\s*\d/i.test(String(v.label||label||item?.name||'')))return null;
  const artwork=propSource(item);return <View style={[s.badge,{borderColor:v.color||C.gold,flexDirection:'row',alignItems:'center',gap:4}]}>{artwork?<Image source={artwork} resizeMode="contain" style={{width:22,height:22}}/>:null}<Text style={s.badgeText}>{artwork?'':v.icon||'✦'} {v.label||label||item?.name}</Text></View>;
}

export function PremiumChatBubble({code,children,style}){
  const items=useCatalog();const item=code?items[code]:null;const v=item?.visual||{};
  if(!item)return <View style={style}>{children}</View>;
  const artwork=propSource(item);return <View style={[s.chatBubble,{backgroundColor:v.background||'#1C2130',borderColor:v.accent||v.glow||C.violet},style]}>{artwork?<Image pointerEvents="none" source={artwork} resizeMode="stretch" style={[StyleSheet.absoluteFillObject,{width:'100%',height:'100%',opacity:.9}]}/>:null}{children}<View style={[s.chatBubbleMark,{backgroundColor:v.accent||v.glow||C.gold}]}/></View>;
}

const ENTRY_SPARKS=[[-124,-118],[-82,-166],[-22,-188],[48,-174],[105,-126],[132,-62],[-136,-42],[-114,48],[-61,124],[12,146],[78,124],[126,62]];
export function PremiumEntryOverlay(props){
 const visualActive=useVisualActivity();
 const items=useCatalog(),item=props.entryCode?items[props.entryCode]:null,variant=dragonVariantForItem(item);
 // Existing server-authorized entry code/catalog; Owner remote visual overrides remain authoritative.
 return variant&&!httpsMedia(item?.asset_url)?<DragonEntryOverlay profile={props.profile} visible={props.visible&&visualActive} onDone={props.onDone} variant={variant} soundUrl={item?.sound_url} durationMs={item?.visual?.duration_ms}/>:<PremiumEntryOverlayCore {...props} visible={props.visible&&visualActive}/>;
}
function PremiumEntryOverlayCore({profile,entryCode,visible,onDone}){
  const items=useCatalog();const {budget,prefs}=usePlaybackEffectPreferences();const item=entryCode?items[entryCode]:null;
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>listener.remove();},[]);
  const opacity=useRef(new Animated.Value(0)).current;const rise=useRef(new Animated.Value(28)).current;const scale=useRef(new Animated.Value(.82)).current;const ring=useRef(new Animated.Value(.65)).current;const scene=useRef(new Animated.Value(0)).current;
  const onDoneRef=useRef(onDone);useEffect(()=>{onDoneRef.current=onDone},[onDone]);
  const duration=useMemo(()=>Math.max(5000,Math.min(10000,Number(item?.visual?.duration_ms)||8100)),[item]);
  useEffect(()=>{if(!visible||!foreground)return undefined;let sound;
    if(item?.sound_url)sound=startCatalogEntryAudio(item.sound_url,duration,item);else sound=playEntrySound(item||{});opacity.setValue(0);rise.setValue(28);scale.setValue(.82);ring.setValue(.65);scene.setValue(0);const enter=Animated.parallel([Animated.timing(opacity,{toValue:1,duration:220,useNativeDriver:true}),Animated.spring(rise,{toValue:0,useNativeDriver:true,damping:16,stiffness:145}),Animated.spring(scale,{toValue:1,useNativeDriver:true,damping:14,stiffness:155}),Animated.timing(ring,{toValue:1.25,duration:Math.min(900,duration),useNativeDriver:true}),Animated.timing(scene,{toValue:1,duration:Math.max(700,Math.min(duration,1900)),useNativeDriver:true})]);const sequence=Animated.sequence([enter,Animated.delay(Math.max(300,duration-650)),Animated.timing(opacity,{toValue:0,duration:350,useNativeDriver:true})]);sequence.start();const finishTimer=setTimeout(()=>onDoneRef.current?.(),duration);return()=>{clearTimeout(finishTimer);sound?.stop?.();sequence.stop();}},[duration,item,opacity,rise,ring,scale,scene,visible,foreground,prefs?.entrySounds]);
  if(!visible||!foreground)return null;
  const v=item?.visual||{};const generatedScene=propScene(item)||(v.ai_asset_key==='funnyroom-entry'&&propSource(item));const motionAllowed=budget.level==='full'||budget.level==='lite';const gradients=Array.isArray(v.gradient)?v.gradient:[];const particleCount=budget.level==='full'?12:budget.level==='lite'?5:0;const sceneKey=String(v.scene||'arrival').replaceAll('_',' ').toUpperCase();
  const sceneX=scene.interpolate({inputRange:[0,1],outputRange:[-190,190]});const sceneTilt=scene.interpolate({inputRange:[0,.5,1],outputRange:['-7deg','2deg','7deg']});
  if(generatedScene)return <Animated.View pointerEvents="none" style={[s.entry,{opacity}]}><GeneratedEntryScene item={item} profile={profile} size={300} duration={duration} animate={motionAllowed}/><Text style={s.entryName}>{profile?.display_name||'Member'}</Text><Text style={s.entryTitle}>{item?.name||'Funny Room Arrival'}</Text><Text style={s.entryMeta}>ID {profile?.public_id||'—'}</Text></Animated.View>;
  return <Animated.View pointerEvents="none" style={[s.entry,{opacity}]}><View style={[s.entryOrbA,{backgroundColor:(gradients[0]||C.violet)+'44'}]}/><View style={[s.entryOrbB,{backgroundColor:(gradients[1]||C.cyan)+'33'}]}/><Animated.View style={[s.entryRing,{borderColor:(gradients[0]||C.gold)+'AA',transform:budget.level==='static'?[]:[{scale:ring}]}]}/>{ENTRY_SPARKS.slice(0,particleCount).map(([x,y],i)=><View key={i} style={[s.entrySpark,{transform:[{translateX:x},{translateY:y}],backgroundColor:i%2?(gradients[1]||C.cyan):(gradients[0]||C.gold)}]}/>)}{item?.asset_url&&(budget.level!=='static'||!/[.]gif(?:[?#]|$)/i.test(item.asset_url)||httpsMedia(v.poster_url))?<Animated.Image source={{uri:budget.level==='static'&&/[.]gif(?:[?#]|$)/i.test(item.asset_url)?v.poster_url:item.asset_url}} resizeMode="contain" style={[{position:'absolute',top:'19%',width:112,height:82,zIndex:2},{transform:budget.level==='static'?[]:[{translateX:sceneX},{rotate:sceneTilt}]}]}/>:budget.level!=='static'&&v.scene?<Animated.View style={[s.sceneRunner,{transform:[{translateX:sceneX},{rotate:sceneTilt}]}]}><Text style={s.sceneEmoji}>{v.icon||'✨'}</Text><View style={[s.sceneTrail,{backgroundColor:(gradients[1]||C.cyan)+'55'}]}/></Animated.View>:null}<Animated.View style={{alignItems:'center',transform:budget.level==='static'?[]:[{translateY:rise},{scale}]}}><Text style={s.entryKicker}>{String(item?.tier||'premium').toUpperCase()} ARRIVAL</Text><PremiumAvatar uri={profile?.avatar_url} fallback={profile?.is_verified?'✦':'☺'} size={96} frameCode={profile?.frame_code} verified={profile?.is_verified} vipLevel={profile?.vip_level} animate/><Text style={s.entryName}>{profile?.display_name||'Member'}</Text><Text style={s.entryTitle}>{v.icon||'✨'} {item?.name||'Funny Room Arrival'}</Text><Text style={s.entryScene}>{sceneKey}</Text><Text style={s.entryMeta}>ID {profile?.public_id||'—'} • VIP {profile?.vip_level||0}</Text><Text style={s.entryMode}>{budget.level==='full'?'CINEMATIC':budget.level==='lite'?'LITE MOTION':'STATIC SAFE MODE'}</Text></Animated.View></Animated.View>;
}

const GIFT_SPARKS=[[-118,-82],[-72,-136],[-6,-155],[65,-138],[119,-86],[-135,-14],[136,-8],[-116,70],[-62,126],[4,148],[70,124],[118,68],[-35,-104],[42,-100],[-88,18],[92,20],[0,105],[0,-120]];
export function PremiumGiftEffect({gift,onDone,currentUserId=null}){
  const visualActive=useVisualActivity();
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  useEffect(()=>{const subscription=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>subscription.remove();},[]);
  const displayActive=visualActive&&foreground,displayActiveRef=useRef(displayActive);displayActiveRef.current=displayActive;
  const {budget}=usePlaybackEffectPreferences();
  const [active,setActive]=useState(null),activeRef=useRef(null);
  const queueRef=useRef([]),onDoneRef=useRef(onDone),seenRef=useRef(new Map());
  const opacity=useRef(new Animated.Value(0)).current,scale=useRef(new Animated.Value(.42)).current,halo=useRef(new Animated.Value(.6)).current;
  useEffect(()=>{onDoneRef.current=onDone;},[onDone]);
  const enqueue=React.useCallback(next=>{
    if(!next)return;
    const key=String(next.transactionId||next.transaction_id||next.request_id||next.round_id||''),now=Date.now();
    for(const [id,at] of seenRef.current){if(now-at<=60000)break;seenRef.current.delete(id);}
    if(key&&seenRef.current.has(key))return;
    if(key){seenRef.current.set(key,now);while(seenRef.current.size>512)seenRef.current.delete(seenRef.current.keys().next().value);}
    if(!displayActiveRef.current)return;
    if(activeRef.current){if(queueRef.current.length>=12)queueRef.current.shift();queueRef.current.push(next);return;}
    activeRef.current=next;setActive(next);
  },[]);
  // Local receipt and broadcast share one queue and transaction deduplication.
  useEffect(()=>{if(!gift)return;enqueue(gift);onDoneRef.current?.();},[gift,enqueue]);
  useEffect(()=>subscribeRoomEffect(event=>{
    if(['gift','pk'].includes(String(event?.type||'')))enqueue({...event.payload,__roomEffectType:event.type});
  }),[enqueue]);
  useEffect(()=>{
    if(!displayActive){queueRef.current=[];activeRef.current=null;setActive(null);return undefined;}
    if(!active)return undefined;
    const activeKey=String(active.transactionId||active.transaction_id||active.request_id||active.round_id||'');if(activeKey){seenRef.current.delete(activeKey);seenRef.current.set(activeKey,Date.now());}
    const kind=String(active.__roomEffectType||'gift');
    let sound;if(kind==='pk')void playPKSound(active);else sound=playGiftSound(active);
    opacity.setValue(0);scale.setValue(.42);halo.setValue(.6);
    const hold=budget.level==='full'?1500:budget.level==='lite'?900:520;
    // Owner-authored media uses an exact bounded lifetime; legacy/PK timing is preserved.
    const mediaDuration=kind==='gift'?originalEffectDuration(emotionalGiftKey(active),ORIGINAL_AUDIO_DURATION,active.effect_duration_ms):null;
    const seq=mediaDuration?Animated.sequence([Animated.parallel([Animated.timing(opacity,{toValue:1,duration:180,useNativeDriver:true}),Animated.timing(scale,{toValue:1,duration:180,useNativeDriver:true}),Animated.timing(halo,{toValue:1.35,duration:180,useNativeDriver:true})]),Animated.delay(mediaDuration-460),Animated.timing(opacity,{toValue:0,duration:280,useNativeDriver:true})]):Animated.sequence([Animated.parallel([Animated.timing(opacity,{toValue:1,duration:180,useNativeDriver:true}),Animated.spring(scale,{toValue:1,useNativeDriver:true,damping:10,stiffness:165}),Animated.timing(halo,{toValue:1.35,duration:750,useNativeDriver:true})]),Animated.delay(hold),Animated.timing(opacity,{toValue:0,duration:280,useNativeDriver:true})]);
    seq.start(({finished})=>{
      if(!finished)return;
      const next=queueRef.current.shift()||null;activeRef.current=next;setActive(next);
    });
    return()=>{seq.stop();sound?.stop?.();};
  },[active,displayActive,budget.level,opacity,scale,halo]);
  if(!active||!displayActive)return null;
  const kind=String(active.__roomEffectType||'gift');
  const emoji=active.emoji||active.icon||(kind==='pk'?'⚔️':'🎁');const assetUrl=httpsMedia(active.effect_asset_url)||httpsMedia(active.asset_key);
  const lucky=kind==='gift'&&(String(active.category||'').toLowerCase()==='lucky'||active.luckyTier);
  const giftCount=Math.max(1,Number(active.combo_count||active.quantity||1));
  const tier=String(active.luckyTier||'').toUpperCase();
  const effect=String(active.effect_kind||'standard').toLowerCase();
  const particleCount=budget.level==='full'?(effect.includes('cinematic')||effect.includes('fullscreen')||lucky||kind!=='gift'?18:12):budget.level==='lite'?6:0;
  const title=kind==='pk'?(String(active.status||'PK').toUpperCase()==='COMPLETED'?'PK RESULT':'PK BATTLE'):(lucky?(tier&&tier!=='NONE'?`${tier} LUCKY HIT!`:'Lucky Gift'):(active.name||'Premium Gift'));
  const sub=kind==='pk'?`${Number(active.score_a||0).toLocaleString()}  ⚔  ${Number(active.score_b||0).toLocaleString()} • ${String(active.status||'LIVE').toUpperCase()}`:lucky?(Number(active.luckyBonus||0)>0?`+${Number(active.luckyBonus).toLocaleString()} Test Coins bonus`:'Gift value delivered • no bonus this time'):`${active.sender_name?active.sender_name+' → '+(active.receiver_name||'Member')+' • ':''}${giftCount>1?`COMBO × ${giftCount}`:'SINGLE GIFT'}`;
  return <Animated.View pointerEvents="none" style={[s.giftEffect,lucky&&s.giftEffectLucky,{opacity}]}><View style={s.giftSenderStrip}><PremiumAvatar uri={active.sender_avatar_url} fallback={String(active.sender_name||'M').slice(0,1)} size={26}/><Text style={s.giftSenderText}>{active.sender_name||'Member'} <Text style={s.giftSenderArrow}>sent to</Text> {active.receiver_name||'Member'}</Text><PremiumAvatar uri={active.receiver_avatar_url} fallback={String(active.receiver_name||'M').slice(0,1)} size={26}/><Text style={s.giftSenderCount}>×{giftCount}</Text></View><Animated.View style={[s.giftHalo,lucky&&s.giftHaloLucky,{transform:[{scale:halo}]}]}/>{GIFT_SPARKS.slice(0,particleCount).map(([x,y],i)=><View key={i} style={[s.giftSpark,{transform:[{translateX:x},{translateY:y}],backgroundColor:lucky?(i%2?'#FFE788':'#77E6A0'):(i%2?C.cyan:C.gold)}]}/>)}{kind==='gift'||assetUrl?<Animated.View style={{transform:[{scale}]}}><GiftArtwork gift={{...active,asset_key:budget.level==='static'?emoji:(assetUrl||active.asset_key)}} size={150} animate={budget.level!=='static'} priority={3}/></Animated.View>:<Animated.Text style={[s.giftEmoji,{transform:[{scale}]}]}>{emoji}</Animated.Text>}<Text style={s.giftTitle}>{title}</Text><Text style={[s.giftCombo,lucky&&s.giftComboLucky]}>{sub}</Text>{lucky?<Text style={s.luckyNote}>TEST COIN BONUS • NORMAL GIFT VALUE GUARANTEED</Text>:kind!=='gift'?<Text style={s.luckyNote}>LIVE ROOM EVENT • SERVER VERIFIED</Text>:null}</Animated.View>;
}

const s=StyleSheet.create({frameIcon:{position:'absolute',left:-7,top:-8,minWidth:22,height:22,borderRadius:11,backgroundColor:'#171221',borderWidth:1,alignItems:'center',justifyContent:'center'},frameIconText:{fontSize:11},verify:{position:'absolute',right:-4,bottom:-3,width:18,height:18,borderRadius:9,backgroundColor:'#3D310E',borderWidth:1,borderColor:C.gold,alignItems:'center',justifyContent:'center'},verifyText:{color:C.gold,fontSize:9,fontWeight:'900'},badge:{alignSelf:'flex-start',borderRadius:999,borderWidth:1,backgroundColor:'#211C30',paddingHorizontal:7,paddingVertical:4},badgeText:{color:C.text,fontSize:6,fontWeight:'900'},chatBubble:{borderWidth:1,borderRadius:16,paddingHorizontal:10,paddingVertical:8,position:'relative',overflow:'hidden'},chatBubbleMark:{position:'absolute',left:0,top:0,bottom:0,width:3},entry:{...StyleSheet.absoluteFillObject,zIndex:95,backgroundColor:'#050710F0',alignItems:'center',justifyContent:'center',overflow:'hidden'},entryOrbA:{position:'absolute',width:360,height:360,borderRadius:180,top:-100,right:-140},entryOrbB:{position:'absolute',width:320,height:320,borderRadius:160,bottom:-100,left:-130},entryRing:{position:'absolute',width:230,height:230,borderRadius:115,borderWidth:2,opacity:.45},entrySpark:{position:'absolute',width:7,height:7,borderRadius:4,opacity:.75},sceneRunner:{position:'absolute',top:'23%',left:'50%',width:70,height:48,alignItems:'center',justifyContent:'center',zIndex:2},sceneEmoji:{fontSize:38,zIndex:2},sceneTrail:{position:'absolute',right:34,width:110,height:9,borderRadius:999,opacity:.7},entryKicker:{color:C.cyan,fontSize:9,fontWeight:'900',letterSpacing:1.5,marginBottom:15},entryName:{color:C.text,fontSize:24,fontWeight:'900',marginTop:17},entryTitle:{color:C.gold,fontSize:13,fontWeight:'900',marginTop:7},entryScene:{color:'#BEB6E8',fontSize:7,fontWeight:'900',letterSpacing:1,marginTop:5},entryMeta:{color:C.muted,fontSize:9,fontWeight:'800',marginTop:7},entryMode:{color:'#6F7890',fontSize:6,fontWeight:'900',letterSpacing:1.1,marginTop:11},giftEffect:{...StyleSheet.absoluteFillObject,zIndex:96,backgroundColor:'#00000022',alignItems:'center',justifyContent:'center',overflow:'hidden'},giftEffectLucky:{backgroundColor:'#0D0905EE'},giftHalo:{position:'absolute',width:250,height:250,borderRadius:125,backgroundColor:'#765BFF33'},giftHaloLucky:{backgroundColor:'#FFD76D28'},giftSpark:{position:'absolute',width:8,height:8,borderRadius:4,opacity:.8},giftEmoji:{fontSize:118},giftTitle:{color:C.text,fontSize:27,fontWeight:'900',marginTop:12,textAlign:'center'},giftCombo:{color:'#1B1606',backgroundColor:C.gold,borderRadius:999,paddingHorizontal:16,paddingVertical:7,fontSize:10,fontWeight:'900',marginTop:12},giftComboLucky:{backgroundColor:'#86D99F'},giftSenderStrip:{position:'absolute',top:'31%',minWidth:230,maxWidth:'86%',minHeight:44,borderRadius:22,backgroundColor:'#168EEA',paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,zIndex:4},giftSenderText:{flex:1,color:'#fff',fontSize:9,fontWeight:'900'},giftSenderArrow:{color:'#D8F2FF',fontWeight:'700'},giftSenderCount:{color:'#fff',fontSize:21,fontWeight:'900'},comboBubble:{position:'absolute',right:18,bottom:26,minWidth:96,borderRadius:48,backgroundColor:'#20A9F4',borderWidth:3,borderColor:'#E8FAFF',paddingHorizontal:14,paddingVertical:11,alignItems:'center'},comboBubbleText:{color:'#fff',fontSize:13,fontWeight:'900'},comboBubbleHint:{color:'#EAF9FF',fontSize:6,fontWeight:'800',marginTop:2},luckyNote:{color:'#D7C989',fontSize:6,fontWeight:'900',letterSpacing:.8,marginTop:8}});


