import {uploadPropMedia,validatePropMedia} from './props-media-upload.js?v=20261027-emoji';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageAccept='image/png,image/jpeg,image/webp,image/gif';
const audioAccept='audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/x-m4a,audio/x-wav';
function https(v){const text=String(v||'').trim();if(!text)return null;let u;try{u=new URL(text);}catch{throw Error('Media links must use HTTPS');}if(u.protocol!=='https:'||u.username||u.password||text.length>2000||/\s/.test(text))throw Error('Media links must use HTTPS');return text;}
export function emojiPayload(form,old=null){
 const v=n=>form.elements.namedItem(n).value,key=old?.reaction_key||v('reaction_key').trim(),label=v('display_label').trim(),emoji=v('emoji').trim();
 const seconds=v('seconds').trim(),order=v('sort_order').trim(),ms=Math.round(Number(seconds)*1000);
 if(!/^[a-z][a-z0-9_]{1,63}$/.test(key))throw Error('Key: 2–64 lowercase letters, numbers or underscores; start with a letter');
 if(!label||label.length>40)throw Error('Enter a display name of 1–40 characters');
 if(!emoji||emoji.length>16)throw Error('Enter a short fallback emoji');
 if(!/^\d+(?:\.\d{1,3})?$/.test(seconds)||!Number.isSafeInteger(ms)||ms<1000||ms>30000)throw Error('Playback duration must be 1–30 seconds');
 if(!/^\d+$/.test(order)||!Number.isSafeInteger(Number(order))||Number(order)>1000000)throw Error('Sort order must be between 0 and 1000000');
 const media=https(v('media_url')),poster=https(v('poster_url'));
 if(media&&/\.mp4(?:[?#]|$)/i.test(media))throw Error('Room Emoji supports images and GIFs; use an image or GIF');
 if(poster&&/\.(gif|mp4)(?:[?#]|$)/i.test(poster))throw Error('Still preview must be PNG, JPEG or WebP');
 return {p_reaction_key:key,p_display_label:label,p_emoji:emoji,p_sound_url:https(v('sound_url')),p_sort_order:Number(order),p_active:v('active')==='true',p_media_url:media,p_poster_url:poster,p_duration_ms:ms,p_expected_updated_at:old?.updated_at||null,p_is_new:!old};
}
export async function showEmojiControl({root,client,isCurrent,toast}){
 let actor=null,rows=[],busy=false,ready=false,closed=false,revision=0;const uncertain=new Map();
 const safe=()=>!closed&&isCurrent()&&root.isConnected;
 const stale=()=>Error('Account or editor changed. Reopen Room Emoji.');
 async function account(){if(!safe())throw stale();const r=await client.auth.getUser();if(r.error||!r.data?.user?.id)throw Error('Sign in again');if(actor&&r.data.user.id!==actor){closed=true;root.innerHTML='<p>Account changed. Reopen Room Emoji.</p>';throw stale();}if(!safe())throw stale();actor=r.data.user.id;return actor;}
 async function request(name,args={}){
  await account();const s=await client.auth.getSession(),session=s.data?.session;
  if(s.error||session?.user?.id!==actor||!session.access_token||!safe())throw stale();
  let timer;try{const result=await Promise.race([client.rpc(name,args).setHeader('Authorization','Bearer '+session.access_token),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Request timed out. Refresh to verify the catalogue.')),12000);})]);await account();if(result.error)throw result.error;return result.data;}finally{clearTimeout(timer);}
 }
 const matches=(row,p)=>['reaction_key','display_label','emoji','sound_url','sort_order','active','media_url','poster_url','duration_ms'].every(k=>(row[k]??null)===(p['p_'+k]??null));
 function buttons(disabled){root.querySelectorAll('[data-emoji-edit],#emojiNew,#emojiRefresh').forEach(el=>{el.disabled=disabled;});}
 async function load(){
  if(busy||!safe())return;busy=true;buttons(true);const token=++revision;ready=false;
  try{const data=await request('owner_list_room_emoji_catalog_v3');if(!safe()||token!==revision)return;if(!Array.isArray(data)||data.some(r=>!r?.reaction_key||!r.updated_at))throw Error('Invalid Emoji catalogue response');rows=data;
   for(const row of rows){const pending=uncertain.get(row.reaction_key);if(pending&&matches(row,pending)&&Date.parse(row.updated_at)>Date.parse(pending.p_expected_updated_at||'1970-01-01'))uncertain.delete(row.reaction_key);}
   ready=true;render();
  }catch(e){if(safe()){toast(e.message,true);root.querySelector('#emojiStatus').textContent=e.message;}}finally{busy=false;if(safe())buttons(!ready);if(safe())root.querySelector('#emojiRefresh').disabled=false;}
 }
 function render(){root.innerHTML='<section class="hero"><p class="kicker">ROOM EMOJI CONTROL</p><h3>Emoji artwork & sound</h3><p>Choose an image or animated GIF and Save. Sound is optional. A still preview or fallback emoji is used when motion is reduced.</p></section><section class="card section"><div class="actions"><button id="emojiNew" class="mini">Add emoji</button><button id="emojiRefresh" class="mini">Refresh</button></div><p id="emojiStatus" role="status"></p><div class="table-wrap"><table><thead><tr><th>Name / stable key</th><th>Duration</th><th>Status</th><th></th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td>'+esc(r.display_label)+'<small style="display:block">'+esc(r.reaction_key)+'</small></td><td>'+esc(r.duration_ms/1000)+' s</td><td>'+esc(r.active?'Active':'Archived')+'</td><td><button class="mini" data-emoji-edit="'+i+'">Edit emoji</button></td></tr>').join('')+'</tbody></table></div></section><div id="emojiEditor"></div>';
 root.querySelector('#emojiNew').onclick=()=>edit(null);root.querySelector('#emojiRefresh').onclick=load;root.querySelectorAll('[data-emoji-edit]').forEach(b=>b.onclick=()=>edit(rows[Number(b.dataset.emojiEdit)]));}
 function edit(old){
  if(busy||!ready||!safe())return;if(old&&uncertain.has(old.reaction_key)){toast('Earlier save is unconfirmed. Refresh until its matching saved row appears before editing this key again.',true);return;}
  const r=old||{reaction_key:'',display_label:'',emoji:'😊',sort_order:rows.length+1,active:false,duration_ms:5000};
  const field=(name,title,value,type='text',readonly=false)=>'<label>'+esc(title)+'<input name="'+name+'" type="'+type+'" '+(name==='seconds'?'step="0.001"':'')+' value="'+esc(value)+'" '+(readonly?'readonly':'')+'></label>';
  const media=(name,title,url,accept)=>field(name,title+' HTTPS URL',url||'')+'<label for="emoji-'+name+'-file">Upload '+esc(title)+'</label><input id="emoji-'+name+'-file" name="'+name+'_file" type="file" accept="'+accept+'"><p data-file-status="'+name+'" role="status"></p>';
  const holder=root.querySelector('#emojiEditor');holder.innerHTML='<form id="emojiForm" class="card section"><h3>'+esc(old?'Edit '+r.display_label:'New emoji')+'</h3>'+field('reaction_key','Stable key',r.reaction_key,'text',!!old)+field('display_label','Display name',r.display_label)+field('emoji','Fallback emoji',r.emoji)+media('media_url','image / GIF',r.media_url,imageAccept)+media('poster_url','still preview (optional)',r.poster_url,'image/png,image/jpeg,image/webp')+media('sound_url','sound (optional)',r.sound_url,audioAccept)+'<p>Choose files, then Save emoji. GIFs have no embedded soundtrack; add sound only when wanted.</p>'+field('seconds','Playback seconds (1–30)',r.duration_ms/1000,'number')+field('sort_order','Sort order',r.sort_order,'number')+'<label>Active<select name="active"><option value="true" '+(r.active?'selected':'')+'>Yes</option><option value="false" '+(!r.active?'selected':'')+'>No</option></select></label><button type="submit" class="primary">Save emoji</button><button type="button" id="emojiClose" class="mini">Close editor</button><p role="status" id="emojiSaveStatus"></p></form>';
  const form=holder.querySelector('form');form.querySelector('#emojiClose').onclick=()=>{if(!busy)holder.innerHTML='';};
  for(const name of ['media_url','poster_url','sound_url']){const input=form.elements.namedItem(name+'_file');input.onchange=()=>{form.querySelector('[data-file-status="'+name+'"]').textContent=input.files?.length?'Selected. Save emoji will upload and apply this file.':'';};}
  form.onsubmit=async e=>{
   e.preventDefault();if(busy||!safe()||!form.isConnected)return;let payload;try{payload=emojiPayload(form,old);if(uncertain.has(payload.p_reaction_key))throw Error('Earlier save is unconfirmed. Refresh before saving this key again.');}catch(error){toast(error.message,true);return;}
   busy=true;buttons(true);let blocked=false,dispatched=false;const fields=[...form.querySelectorAll('input,select,button')].map(el=>[el,el.disabled]);fields.forEach(([el])=>{el.disabled=true;});const current=()=>safe()&&form.isConnected;const status=form.querySelector('#emojiSaveStatus');
   try{
    await account();const selected=[['media_url','image'],['poster_url','poster'],['sound_url','sound']].map(([name,slot])=>({name,slot,input:form.elements.namedItem(name+'_file')})).map(x=>({...x,file:x.input.files?.[0]})).filter(x=>x.file);
    for(const x of selected)await validatePropMedia(x.file,x.slot);
    for(const x of selected){if(!current())throw stale();status.textContent='Uploading '+x.name+'…';const result=await uploadPropMedia({client,file:x.file,slot:x.slot,isCurrent:current});if(!current())throw stale();form.elements.namedItem(x.name).value=result.url;x.input.value='';form.querySelector('[data-file-status="'+x.name+'"]').textContent='Uploaded; saving catalogue…';}
    if(!current())throw stale();payload=emojiPayload(form,old);await account();if(!current())throw stale();status.textContent='Saving emoji…';dispatched=true;
    const receipt=await request('owner_upsert_room_emoji_catalog_v3',payload);
    if(!current())return;if(!receipt||receipt.reaction_key!==payload.p_reaction_key||!Number.isFinite(Date.parse(receipt.updated_at))||!matches(receipt,payload))throw Error('Missing matching Emoji save receipt');
    uncertain.delete(payload.p_reaction_key);toast('Emoji saved with audit history');holder.innerHTML='';busy=false;await load();
   }catch(error){if(current()){if(dispatched&&!['42501','22023','23505','40001','P0001','23514'].includes(error.code)){uncertain.set(payload.p_reaction_key,payload);blocked=true;status.textContent='Save result unconfirmed. Your draft is kept. Close and Refresh to verify before another save.';}else{blocked=error.code==='40001'||error.code==='23505';status.textContent=error.message+(blocked?' Close and reopen the latest record.':'');}toast(status.textContent,true);}}
   finally{busy=false;if(safe()){buttons(!ready);if(form.isConnected){fields.forEach(([el,disabled])=>{el.disabled=blocked||disabled;});form.querySelector('#emojiClose').disabled=false;}}}
  };holder.scrollIntoView({block:'start'});
 }
 render();await load();
}
