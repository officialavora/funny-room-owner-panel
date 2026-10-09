export function publicId(value){const s=String(value).trim();if(!/^[1-9][0-9]*$/.test(s)||!Number.isSafeInteger(Number(s)))throw Error('Enter a valid permanent user ID');return Number(s);}
export function grantArgs(id,code,days){const target_public_id=publicId(id),asset_code=String(code).trim();if(!asset_code)throw Error('Select or enter a prop code');const duration_days=String(days).trim()===''?null:publicId(days);if(duration_days!==null&&duration_days>3650)throw Error('Duration must be 1–3650 days');return{target_public_id,asset_code,duration_days,reason_text:'Authorized manual Owner panel prop grant'};}
const escape=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export async function showPropVisibility({root,rpc,isCurrent,toast,kinds}){
 const safe=()=>isCurrent()&&root.isConnected;
 const controls=await rpc('load_my_cosmetic_controls_v1');if(!safe())return;
 root.innerHTML='<section class="card section"><h3>Prop visibility & manual grants</h3><p>Hidden props stay private to ordinary viewers. Grant power does not assign an official post.</p><form><label>Prop category</label><input name="kind" list="visibilityKinds" value="frame" required><datalist id="visibilityKinds">'+kinds.map(x=>'<option value="'+escape(x)+'">').join('')+'</datalist><label>Permanent user ID (target actions)</label><input name="id" inputmode="numeric"><label>Prop code</label><input name="code"><label>Days · blank = permanent</label><input name="days" inputmode="numeric"><div class="actions"><button type="button" data-op="selfShow">Show my prop</button><button type="button" data-op="selfHide">Hide my prop</button>'+(controls.can_grant?'<button type="button" data-op="grant">Grant prop</button>':'')+(controls.founder?'<button type="button" data-op="power">Give grant power</button><button type="button" data-op="revoke">Revoke grant power</button><button type="button" data-op="targetShow">Show target prop</button><button type="button" data-op="targetHide">Hide target prop</button>':'')+'</div></form><p>My hidden categories: '+escape(Object.keys(controls.hidden||{}).filter(k=>controls.hidden[k]).join(', ')||'None')+'</p><details><summary>Recent visibility / grant-power history</summary>'+ (controls.history||[]).map(event=>'<p>'+escape(event.operation)+' · ID '+escape(event.target_public_id)+' · '+escape(event.created_at)+'</p>').join('')+'</details></section>';
 const form=root.querySelector('form');form.onsubmit=e=>e.preventDefault();let busy=false;
 root.querySelectorAll('[data-op]').forEach(button=>button.onclick=async()=>{
  if(busy||!safe())return;busy=true;const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{
   const op=button.dataset.op,kind=form.elements.kind.value.trim();if(!kind)throw Error('Enter a prop category');let name,args;
   if(op==='grant'){name='owner_grant_cosmetic';args=grantArgs(form.elements.id.value,form.elements.code.value,form.elements.days.value);}
   else if(op==='power'||op==='revoke'){name='owner_set_cosmetic_grant_operator_v1';args={p_public_id:publicId(form.elements.id.value),p_enabled:op==='power',p_expires_at:null};}
   else if(op.startsWith('target')){name='owner_set_cosmetic_visibility_v1';args={p_public_id:publicId(form.elements.id.value),p_kind:kind,p_hidden:op==='targetHide'};}
   else{name='set_cosmetic_visibility_v1';args={p_kind:kind,p_hidden:op==='selfHide',p_target:null};}
   if(!window.confirm(button.textContent+'? '+(op.startsWith('self')?kind:'ID '+form.elements.id.value)))return;
   if(!safe())return;await rpc(name,args);if(!safe())return;toast('Prop action saved');await showPropVisibility({root,rpc,isCurrent,toast,kinds});
  }catch(e){if(safe())toast(e.message,true);}finally{busy=false;if(safe())buttons.filter(b=>b.isConnected).forEach(b=>b.disabled=false);}
 });
}
