import {startOriginalEffectAudio} from './originalEffectAudio';
import {DRAGON_ENTRY_VARIANTS,dragonEntryVariant} from './dragonEntryVariants';
export function startDragonEntrySound(variant='ivory',{url=null,durationMs=8100}={}){return startOriginalEffectAudio(DRAGON_ENTRY_VARIANTS[dragonEntryVariant(variant)].sound,{category:'entry',url,durationMs});}

