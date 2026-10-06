import {startOriginalEffectAudio} from './originalEffectAudio';
import {emotionalEntryKey} from './emotionalSoundRouting';
export function startCatalogEntryAudio(url,durationMs,item={}){return startOriginalEffectAudio(emotionalEntryKey(item),{category:'entry',url,durationMs});}

