// Dedicated Owner control. Backend independently requires private.is_founder.
export function parseRoomIds(value){
 const ids=String(value).split(/[\s,]+/).filter(Boolean);
 if(ids.length>6||new Set(ids).size!==ids.length||ids.some(id=>!/^\d+$/.test(id)||BigInt(id)<=0n||BigInt(id)>9223372036854775807n))throw Error('Enter up to six unique valid Room IDs.');
 const normalized=ids.map(id=>BigInt(id).toString());if(new Set(normalized).size!==normalized.length)throw Error('Room IDs must be unique.');return normalized;
}
export async function showRoomRecommendations({root,client,isCurrent,toast}){
 const initial=await client.auth.getSession();
 const actorId=initial.data?.session?.user?.id;
 if(initial.error||!actorId||!isCurrent())return;
 const rpc=async(name,args={})=>{
  const before=await client.auth.getSession(),session=before.data?.session;
  if(before.error||session?.user?.id!==actorId||!session?.access_token||!isCurrent())throw Object.assign(Error('Session changed. Reopen this control.'),{code:'42501'});
  const result=await client.rpc(name,args).setHeader('Authorization',`Bearer ${session.access_token}`);
  const after=await client.auth.getSession();
  if(after.error||after.data?.session?.user?.id!==actorId||after.data?.session?.access_token!==session.access_token||!isCurrent())throw Error('Session changed before the result could be confirmed.');
  if(result.error)throw result.error;
  return result.data;
 };
 root.innerHTML='<section class="card"><h3>Recommended rooms</h3><p>Only these rooms appear in the room exit screen. Leave the list empty to hide Recommend. Offline, private and locked rooms are not shown.</p><label>Room IDs in display order (maximum 6)<textarea id="recommendIds" rows="3" placeholder="100001, 100002" disabled></textarea></label><label>Reason<input id="recommendReason" maxlength="300" disabled></label><p id="recommendStatus" role="status">Loading configuration…</p><div class="actions"><button id="recommendSave" class="primary" disabled>Save rooms</button><button id="recommendClear" class="mini" disabled>Clear list</button><button id="recommendReload" class="mini">Refresh</button><button id="recommendRetry" class="mini" hidden>Retry same save</button></div></section>';
 const q=id=>root.querySelector('#'+id),ids=q('recommendIds'),reason=q('recommendReason'),status=q('recommendStatus'),save=q('recommendSave'),clear=q('recommendClear'),reload=q('recommendReload'),retry=q('recommendRetry');
 let version=null,busy=false,pending=null,epoch=0;
 const setDisabled=()=>{ids.disabled=reason.disabled=clear.disabled=save.disabled=busy||version===null||Boolean(pending);reload.disabled=busy||Boolean(pending);retry.disabled=busy;retry.hidden=!pending;};
 const load=async()=>{if(busy||pending||!isCurrent())return;busy=true;version=null;setDisabled();const token=++epoch;try{const row=await rpc('owner_load_room_recommendations_v1');if(!isCurrent()||token!==epoch)return;if(row?.schema_version!==1||!/^\d+$/.test(String(row.version))||!Array.isArray(row.room_public_ids))throw Error('Invalid configuration response');version=String(row.version);ids.value=row.room_public_ids.join(', ');status.textContent=ids.value?'Configured rooms loaded.':'No configured rooms. Recommend is hidden.';}catch(e){if(isCurrent())status.textContent='Configuration unavailable: '+e.message;}finally{busy=false;if(isCurrent())setDisabled();}};
 const submit=async()=>{if(busy||!isCurrent())return;if(!pending){if(version===null)return;try{const selected=parseRoomIds(ids.value),text=reason.value.trim();if(text.length<3)throw Error('Enter a reason of at least 3 characters.');pending={p_request_id:crypto.randomUUID(),p_expected_version:version,p_room_public_ids:selected,p_reason:text};}catch(e){status.textContent=e.message;return;}}
 busy=true;setDisabled();try{const result=await rpc('owner_save_room_recommendations_v1',pending);if(!isCurrent())return;if(result?.request_id!==pending.p_request_id||result?.schema_version!==1)throw Error('Save response could not be confirmed');pending=null;status.textContent='Saved. Changes are recorded in the audit history.';toast('Recommended rooms saved');}catch(e){if(!isCurrent())return;if(['22023','40001','42501'].includes(e.code)){pending=null;version=null;status.textContent=e.message+' Refresh before another save.';}else status.textContent='Save outcome unconfirmed. Retry the SAME save to reconcile; do not create a new request.';}finally{busy=false;if(isCurrent()){setDisabled();if(!pending&&version!==null)await load();}}};
 save.onclick=submit;retry.onclick=submit;clear.onclick=()=>{if(!busy&&!pending){ids.value='';status.textContent='List cleared locally. Save to hide Recommend.';}};reload.onclick=load;
 await load();
}
