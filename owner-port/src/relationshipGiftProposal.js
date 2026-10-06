export const RELATIONSHIP_PROPOSAL_LABELS=Object.freeze(['cp','sister','brother','friend','bestie']);
export const RELATIONSHIP_PROPOSAL_SLUGS=Object.freeze({cp:'relationship-cp-promise',sister:'relationship-sister-promise',brother:'relationship-brother-promise',friend:'relationship-friend-handshake',bestie:'relationship-bestie-promise'});
export function relationshipProposalLabel(gift){return RELATIONSHIP_PROPOSAL_LABELS.find(label=>RELATIONSHIP_PROPOSAL_SLUGS[label]===String(gift?.slug||''))||null;}
export function isRelationshipProposalGift(gift){return relationshipProposalLabel(gift)!==null;}
export function proposalRequestId(){
 if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 const bytes=new Uint8Array(16);
 if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(bytes);
 else for(let i=0;i<16;i++)bytes[i]=Math.floor(Math.random()*256);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

