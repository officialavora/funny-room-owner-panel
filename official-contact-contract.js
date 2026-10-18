export const OFFICIAL_CONTACT_KEY='official_contact';
export function normalizeWhatsAppNumber(value){
  if(typeof value!=='string'||!/^\+?[0-9 ()-]+$/.test(value.trim()))throw new Error('Enter a valid international WhatsApp number.');
  const number=value.trim().replace(/[ ()+-]/g,'');
  if(!/^[1-9][0-9]{7,14}$/.test(number))throw new Error('Use country code and 8–15 digits.');
  return number;
}
export async function readOfficialContact(client){
  let timer;
  const {data,error}=await Promise.race([client.from('feature_flags').select('key,enabled,config,updated_at').eq('key',OFFICIAL_CONTACT_KEY).maybeSingle(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Official contact request timed out. Please retry.')),10000);})]).finally(()=>clearTimeout(timer));
  if(error)throw new Error('Could not load the official contact. Please retry.');
  if(!data||data.enabled!==true)throw new Error('Official WhatsApp contact is currently unavailable.');
  return {number:normalizeWhatsAppNumber(data.config?.whatsapp_number),updatedAt:data.updated_at};
}
export async function openOfficialWhatsApp({client,openURL,isCurrent=()=>true}){
  const contact=await readOfficialContact(client);
  if(!isCurrent())return false;
  await openURL('https://wa.me/'+contact.number);
  return true;
}
