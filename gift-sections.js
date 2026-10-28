// Same presentation contract as native giftCategories.js; no price/eligibility changes.
export const GIFT_SECTIONS=Object.freeze(['Gift','CP','Lucky','SVIP','Flag','Exclusive','Funny']);
export function giftSection(g={}){
 if(GIFT_SECTIONS.includes(g.catalog_section))return g.catalog_section;
 const c=String(g.category||'').toLowerCase();
 if(c==='lucky')return 'Lucky';
 if(c==='flags'||c==='flag')return 'Flag';
 if(c==='vip'||c==='svip')return 'SVIP';
 if(c==='special')return 'Exclusive';
 if(c==='funny')return 'Funny';
 if(c==='cp')return 'CP';
 if(c==='relationship'&&(!g.proposal_relationship||g.proposal_relationship==='cp')&&(g.proposal_relationship==='cp'||g.audience_scope==='cp'||['cp-love-story','cp-love-courage','cp-romance','cp-wishing-tree','room-proposal-male','room-proposal-female','relationship-cp-promise'].includes(g.slug)))return 'CP';
 return 'Gift';
}
export function giftDisplayId(v){const s=String(v??'').trim();if(s&&!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(s))throw Error('Gift display ID must use 1–32 letters, digits, hyphens or underscores');return s||null;}
