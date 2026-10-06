export const DRAGON_ENTRY_VARIANTS=Object.freeze({
 ivory:{name:'Ivory Celestial Dragon',source:require('../assets/dragon147/ivory-poses.png'),sound:'dragon_ivory',ratio:1.5},
 crimson:{name:'Crimson Inferno Dragon',source:require('../assets/dragon147/crimson-poses.png'),sound:'dragon_crimson',ratio:1.5},
 emerald:{name:'Emerald Serpent Dragon',source:require('../assets/dragon147/emerald-poses.png'),sound:'dragon_emerald',ratio:1.5},
});
export function dragonEntryVariant(value){return Object.prototype.hasOwnProperty.call(DRAGON_ENTRY_VARIANTS,value)?value:'ivory';}
export function dragonVariantForItem(item){const value=item?.visual?.ai_dragon_variant;return item?.kind==='entry'&&item?.active!==false&&Object.prototype.hasOwnProperty.call(DRAGON_ENTRY_VARIANTS,value)?value:null;}

