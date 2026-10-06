import React,{useEffect,useRef} from 'react';
import {Animated,Image} from 'react-native';
export const RELATIONSHIP_GIFT_ART={
 cp:require('../assets/gifts/cp146/relation-cp.webp'),
 sister:require('../assets/gifts/cp146/relation-sister.webp'),
 brother:require('../assets/gifts/cp146/relation-brother.webp'),
 friend:require('../assets/gifts/cp146/relation-friend.webp'),
 bestie:require('../assets/gifts/cp146/relation-bestie.webp'),
};
export default function RelationshipGiftArtwork({gift,size,style,moving}){
 const progress=useRef(new Animated.Value(0)).current;
 useEffect(()=>{if(!moving){progress.setValue(0);return;}const loop=Animated.loop(Animated.sequence([Animated.timing(progress,{toValue:1,duration:1100,useNativeDriver:true}),Animated.timing(progress,{toValue:0,duration:1100,useNativeDriver:true})]));loop.start();return()=>{loop.stop();progress.stopAnimation();progress.setValue(0);};},[moving,progress]);
 return <Animated.View style={[{width:size,height:size,transform:[{scale:progress.interpolate({inputRange:[0,1],outputRange:[1,1.035]})}]},style]}><Image accessibilityLabel={gift?.name||'Relationship request gift'} source={RELATIONSHIP_GIFT_ART[gift.proposal_relationship]} resizeMode="contain" style={{width:'100%',height:'100%'}}/></Animated.View>;
}

