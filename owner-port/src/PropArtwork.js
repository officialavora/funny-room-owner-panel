import React,{useEffect,useRef} from 'react';
import {Animated,Image,StyleSheet,Text,View} from 'react-native';
import {propSource,propScene,propSceneKey,propHalo} from './generatedProps';

export function GeneratedEntryScene({item,profile,size=300,duration=6000,animate=true}){
 const frames=propScene(item),key=propSceneKey(item),halo=propHalo(key);
 const phase=useRef(new Animated.Value(animate?0:1)).current;
 useEffect(()=>{phase.setValue(animate?0:1);if(!animate)return;const run=Animated.timing(phase,{toValue:1,duration:Math.max(300,duration),useNativeDriver:true});run.start();return()=>run.stop();},[animate,duration,item?.code,phase]);
 const avatar=profile?.avatar_url;const showHalo=['horse','orbit','portal','funnyroom-entry'].includes(key);
 const reveal=key==='horse'?1:phase.interpolate({inputRange:[0,.58,.8,1],outputRange:[0,0,1,1],extrapolate:'clamp'});
 return <View pointerEvents="none" style={{width:size,height:size,overflow:'hidden',borderRadius:20,backgroundColor:'#0B0716'}}>{frames?frames.map((source,index)=><Animated.Image key={index} source={source} resizeMode="contain" style={[StyleSheet.absoluteFillObject,{width:size,height:size,opacity:!animate?(index===3?1:0):index===0?phase.interpolate({inputRange:[0,.2,.34,1],outputRange:[1,1,0,0]}):index===3?phase.interpolate({inputRange:[0,.65,.82,1],outputRange:[0,0,1,1]}):phase.interpolate({inputRange:index===1?[0,.18,.35,.5,1]:[0,.42,.6,.76,1],outputRange:[0,0,1,0,0]})}]}/>):<Animated.Image source={propSource(item,{poster:!animate})} resizeMode="contain" style={{width:size,height:size,transform:animate?[{scale:phase.interpolate({inputRange:[0,1],outputRange:[.9,1]})}]:[]}}/>}{showHalo&&(frames||key==='funnyroom-entry')?<Animated.View style={{position:'absolute',left:size*(halo.x-halo.size/2),top:size*(halo.y-halo.size/2),width:size*halo.size,height:size*halo.size,borderRadius:size,overflow:'hidden',opacity:animate?reveal:1,backgroundColor:'#231333',alignItems:'center',justifyContent:'center'}}>{avatar?<Image source={{uri:avatar}} style={{width:'100%',height:'100%',borderRadius:size}}/>:<Text style={{color:'#FFE8AC',fontSize:size*halo.size*.38,fontWeight:'900'}}>{String(profile?.display_name||'F').slice(0,1)}</Text>}</Animated.View>:null}</View>;
}

export default function PropArtwork({item,profile,size=100}){
 const source=propSource(item);if(!source)return <Text style={{fontSize:size*.4}}>{item?.visual?.icon||'✦'}</Text>;
 if(item.kind==='entry')return <GeneratedEntryScene item={item} profile={profile} size={size} animate={false}/>;
 if(item.kind==='frame')return <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>{profile?.avatar_url?<Image source={{uri:profile.avatar_url}} style={{width:size*.56,height:size*.56,borderRadius:size}}/>:<View style={{width:size*.56,height:size*.56,borderRadius:size,backgroundColor:'#282035',alignItems:'center',justifyContent:'center'}}><Text style={{color:'#FFE8AC',fontSize:size*.22,fontWeight:'900'}}>{String(profile?.display_name||'F').slice(0,1)}</Text></View>}<Image source={source} resizeMode="contain" style={{position:'absolute',width:size,height:size}}/></View>;
 return <Image source={source} resizeMode="contain" style={{width:size,height:item.kind==='bubble'?size*.46:size}}/>;
}

