import {normalizeWhatsAppNumber,OFFICIAL_CONTACT_KEY} from './official-contact-contract.js';
export async function showOfficialContact({root,client,rpc,isCurrent,toast}){
 let locked=false,ready=false;
 root.innerHTML='<section class="card"><h3>Contact Official • WhatsApp</h3><p>Tap Contact Official in the app to open this WhatsApp chat.</p><label>International WhatsApp number<input id="officialWhatsApp" type="tel" autocomplete="off" disabled></label><p id="contactStatus" role="status">Loading…</p><button id="contactSave" class="primary" disabled>Save</button><button id="contactRefresh" class="mini">Refresh</button></section>';
 const input=root.querySelector('#officialWhatsApp'),status=root.querySelector('#contactStatus'),save=root.querySelector('#contactSave');
 const read=async()=>{const r=await client.from('feature_flags').select('key,enabled,config,updated_at').eq('key',OFFICIAL_CONTACT_KEY).maybeSingle();if(r.error)throw r.error;return r.data;};
 const load=async()=>{if(locked)return;ready=false;save.disabled=true;try{const row=await read();if(!isCurrent())return;input.value=row?.config?.whatsapp_number||'';input.disabled=false;ready=true;status.textContent=row?.enabled?'Current backend contact loaded.':'No active contact. Save a number to enable it.';save.disabled=false;}catch{if(isCurrent())status.textContent='Could not load contact. Refresh to retry.';}};
 root.querySelector('#contactRefresh').onclick=load;
 save.onclick=async()=>{if(locked||!ready||!isCurrent())return;let number;try{number=normalizeWhatsAppNumber(input.value);}catch(e){status.textContent=e.message;return;}if(!window.confirm('Change official WhatsApp to +'+number+'?'))return;
  locked=true;save.disabled=true;input.disabled=true;status.textContent='Saving…';
  try{await rpc('owner_set_runtime_flag',{p_key:OFFICIAL_CONTACT_KEY,p_enabled:true,p_config:{whatsapp_number:number},p_notify:false});const row=await read();if(row?.enabled!==true||row.config?.whatsapp_number!==number)throw Error('Readback mismatch');if(isCurrent()){status.textContent='Saved and verified.';toast('Official WhatsApp updated');}}
  catch{ready=false;if(isCurrent())status.textContent='Save not confirmed. Refresh and check the current value before retrying.';}
  finally{locked=false;if(isCurrent()){save.disabled=!ready;input.disabled=!ready;}}
 };
 await load();
}
