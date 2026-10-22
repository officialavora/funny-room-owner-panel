const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function svipPolicyInput(row){
 return {title:row.title,price_minor:row.price_minor,duration_days:row.duration_days,enabled:row.enabled,
 daily_enabled:row.daily_enabled,daily_bps:row.daily_bps,media:row.media||{},benefits:row.benefits||{}};
}
export async function showSvipClub({root,client,isCurrent,toast}){
 let busy=false,unknown=false,selected=1,rows=[],history=[],actor=null,capabilities=[];
 const call=async(name,args={})=>{const a=await client.auth.getUser();if(a.error||!a.data?.user?.id||!isCurrent()||(actor&&actor!==a.data.user.id))throw Error('Account or page changed. Reopen SVIP Club.');actor=a.data.user.id;const r=await client.rpc(name,args);if(r.error)throw r.error;const after=await client.auth.getUser();if(!isCurrent()||after.error||after.data?.user?.id!==actor)throw Error('Account or page changed. Reopen SVIP Club.');return r.data;};
 const render=()=>{
  if(!isCurrent())return;const row=rows.find(x=>x.tier===selected)||rows[0];if(!row)throw Error('SVIP configuration is unavailable.');selected=row.tier;
  root.innerHTML=`<div class="hero"><p class="kicker">SVIP CLUB · OWNER CONTROL</p><h3>SVIP 1–10</h3><p>Prices use $1 = 1,000,000 coins. Daily bonus is separate from the activation package. Daily reset: UTC.</p></div>
  <div class="card"><label>Membership</label><select id="svip-tier">${rows.map(x=>`<option value="${x.tier}" ${x.tier===selected?'selected':''}>SVIP ${x.tier}</option>`).join('')}</select>
  <div aria-label="SVIP tier artwork" role="img" style="width:120px;height:120px;overflow:hidden;position:relative"><img alt="" src="./media/svip-club-crests-v1.webp" style="position:absolute;width:600px;height:240px;max-width:none;left:${-((selected-1)%5)*120}px;top:${-Math.floor((selected-1)/5)*120}px"></div><p>Current price: ${esc(Number(row.coin_price).toLocaleString('en-US'))} coins · revision ${esc(row.version)}</p>
  <label for="svip-policy">Membership settings</label><textarea id="svip-policy" rows="24" style="width:100%;font-family:monospace">${esc(JSON.stringify(svipPolicyInput(row),null,2))}</textarea>
  <p>price_minor is US cents; daily_bps 275 = 2.75%. Use HTTPS media URLs. nickname/chat_font text_color accepts a six-digit hex color such as #FFD166. Null badge_url/frame_url restores bundled art. Set hidden:true to remove a benefit from the customer grid. Disabled tiers cannot be purchased. History is retained.</p>
  <p>Available consumers: ${esc(capabilities.join(', ')||'badge, frame, daily_bonus')}. Other benefit designs/settings can be prepared, but enabling their unimplemented consumers is rejected by the server.</p>
  <label for="svip-reason">Reason</label><input id="svip-reason" maxlength="500"><button id="svip-review">Review changes</button><div id="svip-preview"></div><p id="svip-notice" role="status">${unknown?'Previous save outcome is unknown. Reopen this page and inspect the revision/history before another change.':''}</p></div>
  <div class="card"><h3>Recent configuration history</h3>${history.map(x=>`<p>SVIP ${esc(x.tier)} · revision ${esc(x.version)} · ${esc(x.created_at)}<br>${esc(x.reason)}<br><small>${esc(x.request_id)}</small></p>`).join('')||'<p>No configuration edits recorded.</p>'}</div>`;
  const q=s=>root.querySelector(s);q('#svip-tier').onchange=()=>{if(busy||unknown)return;q('#svip-preview').textContent='';selected=Number(q('#svip-tier').value);render();};
  q('#svip-review').disabled=unknown;
  q('#svip-review').onclick=()=>{
   if(busy||unknown||!isCurrent())return;
   try{
    const value=JSON.parse(q('#svip-policy').value),reason=q('#svip-reason').value.trim();if(reason.length<3)throw Error('Enter a reason.');
    if(!value||Array.isArray(value)||typeof value!=='object')throw Error('Use a settings object.');
    const preview=q('#svip-preview');preview.replaceChildren();const pre=document.createElement('pre');pre.textContent=JSON.stringify({before:svipPolicyInput(row),after:value},null,2);preview.append(pre);
    const button=document.createElement('button');button.textContent='Confirm SVIP settings';preview.append(button);const request=crypto.randomUUID(),frozen=JSON.stringify(value),version=row.version,tier=selected;
    button.onclick=async()=>{
     if(busy||unknown||!isCurrent())return;
     try{if(q('#svip-policy').value.trim()!==JSON.stringify(value,null,2).trim()&&JSON.stringify(JSON.parse(q('#svip-policy').value))!==frozen){preview.replaceChildren();toast('Settings changed. Review again.',true);return;}
     if(q('#svip-reason').value.trim()!==reason){preview.replaceChildren();toast('Reason changed. Review again.',true);return;}}catch{preview.replaceChildren();toast('Settings changed or are invalid. Review again.',true);return;}
     busy=true;unknown=true;button.disabled=true;q('#svip-review').disabled=true;q('#svip-tier').disabled=true;
     try{
      const result=await call('owner_save_svip_club_v1',{p_tier:tier,p_expected_version:version,p_value:value,p_reason:reason,p_request_id:request});
      if(result?.saved!==true||result.tier!==tier||result.version!==version+1||result.request_id!==request)throw Error('Save result could not be verified.');
      unknown=false;const data=await call('load_owner_svip_club_v1');rows=data.tiers;history=data.history||[];capabilities=Array.isArray(data.capabilities)?data.capabilities.filter(x=>typeof x==='string'):[];busy=false;render();toast('SVIP settings saved.');
     }catch(e){busy=false;if(isCurrent()){q('#svip-notice').textContent=unknown?'Save result is not confirmed. Inspect current settings and audit before another save.':e.message;toast(e.message,true);}}
    };
   }catch(e){toast(e.message,true);}
  };
 };
 const data=await call('load_owner_svip_club_v1');if(data?.contract!=='svip_club_v1'||!Array.isArray(data.tiers))throw Error('SVIP configuration could not be verified.');rows=data.tiers;history=data.history||[];capabilities=Array.isArray(data.capabilities)?data.capabilities.filter(x=>typeof x==='string'):[];render();
}
