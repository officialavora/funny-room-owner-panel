// Shared by the mobile Control Center and the existing Owner panel.
export const MAIN_CONTROL_ROLES=['root_founder','co_owner','country_manager','manager','assistant_manager','super_admin','admin','bd_leader','bd','agency_owner','host','user'];
export const SPECIAL_CONTROL_ROLES=['cs_leader','cs','event_manager','merchant','coin_seller'];
const titles={root_founder:'Root Owner / Founder',co_owner:'Co-Owner',country_manager:'Country Manager',manager:'Manager',assistant_manager:'Assistant Manager',super_admin:'Super Admin',admin:'Admin',bd_leader:'BD Leader',bd:'BD',agency_owner:'Agency Owner',host:'Host',user:'User',cs_leader:'CS Leader',cs:'CS',event_manager:'Event Manager',merchant:'Merchant',coin_seller:'Coin Seller'};
const count=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):null;
export function controlRoleRows(summary,keys=MAIN_CONTROL_ROLES){
 return keys.filter(key=>key!=='moderator').map(key=>{
  const row=Array.isArray(summary)?summary.find(x=>x?.role_key===key):null;
  const n=count(row?.member_count);
  return {...row,role_key:key,display_name:titles[key]||row?.display_name||key,member_count:n,
   count_label:n===null?'—':n.toLocaleString('en-US'),
   readonly:key==='user'||key==='assistant_manager'&&row?.authority_ready!==true,
   can_open:n!==null&&(key!=='assistant_manager'||row?.authority_ready===true)};
 });
}
export async function loadControlDirectory(client){
 const result=await client.rpc('load_owner_control_directory_v1');
 if(result.error){
  const missing=result.error.code==='PGRST202'||result.error.code==='42883'&&String(result.error.message||'').includes('load_owner_control_directory_v1');
  if(!missing)return result;
  const old=await client.rpc('owner_role_summary');
  // The old User row counted explicitly assigned roles, not ordinary users.
  return {...old,data:Array.isArray(old.data)?old.data.filter(x=>x.role_key!=='user'):[],meta:null};
 }
 const value=result.data;
 if(value?.contract!=='owner_control_directory_v1'||!Array.isArray(value.roles)||value.roles.some(x=>!titles[x?.role_key]&&x?.role_key!=='moderator'||count(x?.member_count)===null)||new Set(value.roles.map(x=>x.role_key)).size!==value.roles.length)
  return {data:null,error:{message:'Control Center counts could not be verified.'},meta:null};
 return {data:value.roles,error:null,meta:value};
}
export function identityCountNote(meta){
 const ids=meta?.identity;
 if(!ids||count(ids.total_accounts)===null||count(ids.highest_public_id)===null)return '';
 return `${Number(ids.total_accounts).toLocaleString('en-US')} accounts • Highest profile ID ${Number(ids.highest_public_id).toLocaleString('en-US')}. Permanent IDs do not equal account counts; skipped numbers are not reused.`;
}
export function organizationWeekLabel(org){
 const n=count(org?.week_score);
 return `Weekly gift volume: ${n===null?'Unavailable':n.toLocaleString('en-US')} Coins (UTC)`;
}
