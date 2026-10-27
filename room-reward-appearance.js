import {ROOM_REWARD_APPEARANCE_KEY,ROOM_REWARD_APPEARANCE_DEFAULTS,validateRoomRewardAppearance} from './room-reward-appearance-contract.js';
import {validatePropMedia,uploadPropMedia} from './props-media-upload.js?v=20261027-room-banner';
export async function showRoomRewardAppearance({root,client,isCurrent,toast}){
 root.innerHTML='<section class="card"><h3>Room Reward appearance</h3><p>Choose banner / backdrop files, then Save appearance. Original AI artwork is used when URLs are empty. Contribution thresholds, reward rates and balances use their existing controls.</p><div id="roomAppearanceFields"></div><p id="roomAppearanceStatus" role="status">Loading…</p><button id="roomAppearanceSave" class="primary" disabled>Save appearance</button><button id="roomAppearanceRefresh" class="mini">Refresh</button></section>';
 const fields=root.querySelector('#roomAppearanceFields'),status=root.querySelector('#roomAppearanceStatus'),button=root.querySelector('#roomAppearanceSave'),refresh=root.querySelector('#roomAppearanceRefresh');let busy=false,unknown=false,ready=false,revision=0,actor=null;const inputs={},files={};
 const safe=()=>isCurrent()&&root.isConnected;
 for(const key of Object.keys(ROOM_REWARD_APPEARANCE_DEFAULTS)){
  const label=root.ownerDocument.createElement('label'),input=root.ownerDocument.createElement('input');label.textContent=key.replaceAll('_',' ');input.type='text';input.disabled=true;input.setAttribute('aria-label','Room reward '+key);label.appendChild(input);fields.appendChild(label);inputs[key]=input;
  if(key.endsWith('_url')){const label=root.ownerDocument.createElement('label'),file=root.ownerDocument.createElement('input');label.textContent='Choose '+key.replace('_url','')+' image / GIF';file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif';file.disabled=true;file.setAttribute('aria-label','Upload Room reward '+key);label.appendChild(file);fields.appendChild(label);files[key]=file;}
 }
 async function account(){if(!safe())throw Error('Editor changed');const r=await client.auth.getUser();if(r.error||!r.data?.user?.id)throw Error('Sign in again');if(actor&&r.data.user.id!==actor){unknown=true;throw Error('Account changed. Reopen appearance.');}actor=r.data.user.id;if(!safe())throw Error('Editor changed');}
 const read=async()=>{const r=await client.from('feature_flags').select('enabled,config').eq('key',ROOM_REWARD_APPEARANCE_KEY).maybeSingle();if(r.error)throw r.error;return r.data;};
 const disable=on=>{button.disabled=on;refresh.disabled=busy;for(const el of [...Object.values(inputs),...Object.values(files)])el.disabled=on;};
 const reload=async()=>{if(busy||!safe())return;const token=++revision;ready=false;disable(true);try{await account();const row=await read();if(!safe()||token!==revision)return;const cfg={...ROOM_REWARD_APPEARANCE_DEFAULTS,...validateRoomRewardAppearance(row?.config||{})};for(const key of Object.keys(inputs))inputs[key].value=cfg[key];ready=true;status.textContent=unknown?'Save outcome remains unconfirmed. Inspect values and audit history before another write.':'Current appearance loaded.';}catch(e){if(safe())status.textContent=e.message||'Could not load appearance. Refresh to retry.';}finally{if(safe())disable(!ready||unknown);}};
 refresh.onclick=reload;
 button.onclick=async()=>{
  if(busy||unknown||!ready||!safe())return;let patch;try{patch=validateRoomRewardAppearance(Object.fromEntries(Object.entries(inputs).map(([k,input])=>[k,input.value])));}catch(e){status.textContent=e.message;return;}
  if(!globalThis.confirm('Save Room Reward artwork, title and colors? Reward rules will not change.'))return;
  busy=true;disable(true);let dispatched=false;
  try{
   await account();const selected=Object.entries(files).map(([key,input])=>({key,input,file:input.files?.[0]})).filter(x=>x.file);
   for(const x of selected)await validatePropMedia(x.file,'image');
   for(const x of selected){const result=await uploadPropMedia({client,file:x.file,slot:'image',isCurrent:()=>safe()});await account();if(!safe())throw Error('Editor changed');patch[x.key]=result.url;inputs[x.key].value=result.url;x.input.value='';}
   patch=validateRoomRewardAppearance(patch);await account();const s=await client.auth.getSession(),session=s.data?.session;if(s.error||session?.user?.id!==actor||!session.access_token||!safe())throw Error('Session changed');
   dispatched=true;let timer;try{const r=await Promise.race([client.rpc('owner_set_runtime_flag',{p_key:ROOM_REWARD_APPEARANCE_KEY,p_enabled:true,p_config:patch,p_notify:false}).setHeader('Authorization','Bearer '+session.access_token),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Save timed out')),12000);})]);if(r.error)throw r.error;}finally{clearTimeout(timer);}
   await account();const actual=await read();if(actual?.enabled!==true||Object.entries(patch).some(([k,v])=>actual.config?.[k]!==v))throw Error('Readback mismatch');if(safe()){status.textContent='Appearance saved and verified.';toast('Room Reward appearance updated');}
  }catch(e){unknown=unknown||dispatched&&!['42501','22023','P0001'].includes(e.code);if(safe())status.textContent=unknown?'Save outcome unconfirmed. Do not repeat; inspect values and audit history.':e.message;}
  finally{busy=false;if(safe())disable(unknown);}
 };await reload();
}
