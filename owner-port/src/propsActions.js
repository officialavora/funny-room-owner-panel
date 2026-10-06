// One mutation per controller; re-use a purchase key after an ambiguous network result.
export function createPropsActions({rpc,makeRequestId}){
 let locked=false;const requests=new Map();
 return {get busy(){return locked;},async run({item,owned,equipped,buy=false}){
  if(locked)return {ignored:true};
  if(!item?.code)throw Error('Select a prop first.');
  if(!buy&&!owned)throw Error('This item is not active on your account.');
  if(buy&&owned)throw Error('This prop is already active on your account.');
  if(buy&&(!item.purchasable||!(Number(item.price_coins)>0)))throw Error('This item is not for sale.');
  locked=true;try{
   let result;
   if(buy){if(!requests.has(item.code))requests.set(item.code,makeRequestId());result=await rpc('purchase_cosmetics_v142',{p_codes:[item.code],p_request_id:requests.get(item.code)});}
   else result=equipped?await rpc('unequip_cosmetic_v142',{p_kind:item.kind}):await rpc('equip_cosmetic_v142',{p_code:item.code});
   if(result.error)throw Error(result.error.message||'Could not save.');
   if(buy)requests.delete(item.code);
   return result.data;
  }finally{locked=false;}
 }};
}
export const propsRequestId=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&3)|8).toString(16);});

