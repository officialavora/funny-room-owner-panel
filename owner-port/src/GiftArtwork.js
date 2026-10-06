import {useVisualActivity} from './VisualActivity';
import React,{useEffect,useRef,useState} from 'react';
import {Animated,Image,Text} from 'react-native';
import {giftArtwork,httpsMedia} from './catalogMedia';
import {aiSymbolSource} from './aiSymbolAssets';
import AiSymbolArt from './AiSymbolArt';
import {useCatalogMotion,useCatalogMotionSlot} from './catalogMotion';
import {funnyGiftAsset} from './funnyGiftAssets';
import RelationshipGiftArtwork from './RelationshipGiftArtwork';
import {relationshipProposalLabel} from './relationshipGiftProposal';

export const isGifMedia=uri=>/\.gif(?:[?#]|$)/i.test(String(uri||''));
export function resolveGiftMotionArtwork(gift,moving){
  const {uri,emoji}=giftArtwork(gift),effect=httpsMedia(gift?.effect_asset_url);
  const poster=uri&&!isGifMedia(uri)?uri:null;
  return {emoji,poster,uri:moving?(effect||uri):(poster||null)};
}
function BrandedGiftImage({source,size,style,moving,label}){
 const phase=useRef(new Animated.Value(0)).current;
 useEffect(()=>{phase.setValue(0);if(!moving)return undefined;const loop=Animated.loop(Animated.sequence([Animated.timing(phase,{toValue:1,duration:1600,useNativeDriver:true,isInteraction:false}),Animated.timing(phase,{toValue:0,duration:1600,useNativeDriver:true,isInteraction:false})]));loop.start();return()=>{loop.stop();phase.stopAnimation();};},[moving,phase]);
 return <Animated.Image source={source} resizeMode="contain" fadeDuration={0} accessibilityLabel={label} style={[{width:size,height:size,transform:moving?[{scale:phase.interpolate({inputRange:[0,1],outputRange:[.9,.96]})},{rotate:phase.interpolate({inputRange:[0,1],outputRange:['-2deg','2deg']})}]:[]},style]}/>;
}
export default function GiftArtwork({gift,size=48,style,animate=false,priority=0}){
  const visible=useVisualActivity(),motion=useCatalogMotion()&&visible;
  const moving=useCatalogMotionSlot(Boolean(animate&&motion),priority);
  const art=resolveGiftMotionArtwork(gift,moving);
  const [failed,setFailed]=useState([]);
  useEffect(()=>setFailed([]),[gift?.asset_key,gift?.effect_asset_url]);
  const uri=[art.uri,art.poster].find(value=>value&&!failed.includes(value));
  const local=funnyGiftAsset(gift);
  if(uri)return <Image source={{uri}} resizeMode="contain" fadeDuration={0}
    accessibilityLabel={gift?.name||'Gift'} onError={()=>setFailed(values=>[...values,uri])} style={[{width:size,height:size},style]}/>;
  const relation=relationshipProposalLabel(gift)||relationshipProposalLabel({slug:gift?.gift_slug})||({'CP Promise':'cp','Sister Promise':'sister','Brother Promise':'brother','Friend Handshake':'friend','Bestie Promise':'bestie'}[gift?.name||gift?.gift_name]);
  if(relation)return <RelationshipGiftArtwork gift={{...gift,proposal_relationship:relation}} size={size} style={style}/>;
  if(local&&/^brand:/.test(String(gift?.asset_key||'')))return <BrandedGiftImage source={local.poster} size={size} style={style} moving={moving} label={gift?.name||'Gift'}/>;
  if(local)return <Image source={moving?local.motion:local.poster} resizeMode="contain" fadeDuration={0}
    accessibilityLabel={gift?.name||'Gift'} style={[{width:size,height:size},style]}/>;
  if(aiSymbolSource(art.emoji))return <AiSymbolArt emoji={art.emoji} label={gift?.name||'Gift'} size={size} animate={moving} managed style={style}/>;
  return <Text numberOfLines={1} accessibilityLabel={gift?.name||'Gift'} style={[{fontSize:size*.76,lineHeight:size,textAlign:'center'},style]}>{art.emoji}</Text>;
}

