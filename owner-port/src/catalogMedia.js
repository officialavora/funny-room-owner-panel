// Shared, bounded catalogue media contract. Internal storage keys are never UI text.
export const CATALOG_IMAGE_TYPES=['image/png','image/jpeg','image/webp','image/gif'];
export const CATALOG_IMAGE_LIMIT=5*1024*1024;
export const CATALOG_DURATION_MIN=1000;
export const CATALOG_DURATION_MAX=30000;
export const httpsMedia=value=>{
  const text=String(value||'').trim();
  return text.length<=2000&&/^https:\/\/[^\s/?#]+[^\s]*$/i.test(text)?text:null;
};
export function catalogDuration(value,fallback=5000){
  const n=Number(value);
  return Number.isFinite(n)&&n>0?Math.min(CATALOG_DURATION_MAX,Math.max(CATALOG_DURATION_MIN,Math.round(n))):fallback;
}
const LEGACY_GIFT_ICONS={'flying-chappal':'🩴','tractor-entry':'🚜','funny-baraat':'🎊','nawab-chair':'🪑','comic-money-rain':'💸','masti-rocket':'🚀'};
export function giftArtwork(gift={}){
  const asset=String(gift.asset_key||'').trim();
  const uri=httpsMedia(asset);
  const emoji=!uri&&asset.length<=16&&!/[a-z0-9/\\:]/i.test(asset)?asset:null;
  return {uri,emoji:emoji||LEGACY_GIFT_ICONS[gift.slug]||'🎁'};
}
export function validateMediaDuration(seconds){
  const n=Number(seconds);
  if(!Number.isFinite(n)||n<1||n>30||!Number.isInteger(n*1000))throw new Error('Choose a duration from 1 to 30 seconds.');
  return Math.round(n*1000);
}

