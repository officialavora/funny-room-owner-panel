export const ROOM_REWARD_APPEARANCE_KEY='room_reward_appearance';
export const ROOM_REWARD_APPEARANCE_DEFAULTS=Object.freeze({title:'Room Reward Event',banner_url:'',backdrop_url:'',background_color:'#10091B',card_color:'#21102E',accent_color:'#FFD86B'});
export function validateRoomRewardAppearance(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Appearance must be an object.');
 const result={};for(const[key,value]of Object.entries(input)){
  if(!Object.prototype.hasOwnProperty.call(ROOM_REWARD_APPEARANCE_DEFAULTS,key)||typeof value!=='string')throw Error('Invalid appearance field.');
  if(key.endsWith('_url')){if(value){let url;try{url=new URL(value);}catch{throw Error('Artwork must use an HTTPS URL.');}if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error('Artwork must use an HTTPS URL.');}}
  else if(key.endsWith('_color')){if(!/^#[a-f0-9]{6}$/i.test(value))throw Error('Use a six-digit hex color.');}
  else if(!value.trim()||value.length>80)throw Error('Title must have 1–80 characters.');
  result[key]=value;
 }return result;
}
export function roomRewardAppearance(row){
 if(!row?.enabled)return ROOM_REWARD_APPEARANCE_DEFAULTS;
 try{return {...ROOM_REWARD_APPEARANCE_DEFAULTS,...validateRoomRewardAppearance(row.config||{})};}catch{return ROOM_REWARD_APPEARANCE_DEFAULTS;}
}
