// Founder-only controls for the same versioned salary backend used by the app.
export async function showSalaryPolicy({root,client,isCurrent,toast}){
 const initial=await client.auth.getSession(),actorId=initial.data?.session?.user?.id;
 if(initial.error||!actorId||!isCurrent())return;
 const live=()=>isCurrent()&&root.isConnected!==false;
 const rpc=async(name,args={})=>{
  const before=await client.auth.getSession(),session=before.data?.session;
  if(before.error||session?.user?.id!==actorId||!session?.access_token||!live())throw Error('Session changed. Reopen salary controls.');
  const result=await client.rpc(name,args).setHeader('Authorization',`Bearer ${session.access_token}`);
  const after=await client.auth.getSession();
  if(after.error||after.data?.session?.user?.id!==actorId||after.data?.session?.access_token!==session.access_token||!live())throw Error('Result unconfirmed after session change. Reopen this control.');
  if(result.error)throw result.error;return result.data;
 };
 root.innerHTML='<section class="card"><h3>Host &amp; Agency Salary</h3><p>Normal gifts count 100%; Lucky gifts count 10%. Salary uses the highest fully completed target. Paid records are retained.</p><p id="salaryStatus" role="status">Loading policy…</p><div class="actions"><button id="salaryReload" class="mini">Refresh</button><button id="salaryAuto" class="mini" disabled>Automatic release</button><button id="salaryPause" class="mini" disabled>Salary operations</button></div><h4>Schedule a future policy</h4><p>Global monthly is the current launch policy. Country, daily and weekly rules can be scheduled for future periods. Editing never rewrites paid history.</p><label>Existing program template<select id="salaryTemplate" disabled></select></label><label>Country code (* = global)<input id="salaryCountry" value="*" disabled></label><label>Cycle<select id="salaryCycle" disabled><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="daily">Daily</option></select></label><label>Timezone<input id="salaryZone" value="Asia/Riyadh" disabled></label><label>Future effective date<input id="salaryDate" type="date" disabled></label><label>Country rule active<select id="salaryActive" disabled><option value="true">Active</option><option value="false">Inactive: inherit global</option></select></label><button id="salaryCommission100" disabled>Use $100 earned agency commission minimum</button><p>This condition uses earned agency shares from completed host targets, not gift value or host salary. It applies on the selected future policy date.</p><label>Policy: targets, salaries and optional future conditions<textarea id="salaryJson" rows="18" spellcheck="false" disabled></textarea></label><div class="actions"><button id="salarySave" class="primary" disabled>Save future policy</button><button id="salaryRemove" class="mini" disabled>Remove selected future program</button></div></section>';
 const q=id=>root.querySelector('#'+id),status=q('salaryStatus');let busy=false,uncertain=false,programs=[],auto=null,ops=null;
 const ids=['salaryCommission100','salaryAuto','salaryPause','salaryTemplate','salaryCountry','salaryCycle','salaryZone','salaryDate','salaryActive','salaryJson','salarySave','salaryRemove'];
 const disable=()=>{ids.forEach(id=>{q(id).disabled=busy||uncertain||!auto;});q('salaryReload').disabled=busy;q('salaryRemove').disabled=busy||uncertain||!programs.some(p=>p.id===q('salaryTemplate').value&&Date.parse(p.effective_at)>Date.now());};
 const template=()=>{const p=programs.find(x=>x.id===q('salaryTemplate').value);if(!p)return;q('salaryCountry').value=p.country_scope;q('salaryCycle').value=p.cycle;q('salaryZone').value=p.timezone;q('salaryActive').value=String(p.active);q('salaryJson').value=JSON.stringify(p.policy,null,2);disable();};
 const load=async()=>{if(busy||!live())return;busy=true;disable();try{
  const [p,a,o]=await Promise.all([rpc('owner_salary_programs_v1'),rpc('owner_salary_auto_release_v1'),rpc('owner_host_agency_salary_policy_v1')]);if(!live())return;
  if(!Array.isArray(p)||typeof a?.enabled!=='boolean'||typeof o?.enabled!=='boolean')throw Error('Policy response unavailable');
  programs=p;auto=a;ops=o;uncertain=false;
  const select=q('salaryTemplate');select.replaceChildren();for(const item of p){const option=document.createElement('option');option.value=item.id;option.textContent=`${item.country_scope} / ${item.cycle} / ${item.effective_at}`;select.append(option);}if(p[0])select.value=p[0].id;
  template();q('salaryAuto').textContent=`Automatic release: ${a.enabled?'ON':'OFF'}`;q('salaryPause').textContent=`Salary operations: ${o.enabled?'ON':'PAUSED'}`;status.textContent=`Processing every ${a.interval_minutes} minutes after period close. Completed batches: ${a.completed}; errors: ${a.errors}.`;
 }catch(e){if(live()){auto=null;status.textContent=e.message;}}finally{busy=false;if(live())disable();}};
 const write=async(name,args)=>{if(busy||uncertain||!auto||!live())return;busy=true;disable();try{await rpc(name,args);if(!live())return;status.textContent='Saved. Reloading authoritative state.';toast('Salary policy saved');}catch(e){if(live()){uncertain=true;status.textContent='Save outcome unconfirmed: '+e.message+' Refresh and verify before another change.';}}finally{busy=false;if(live()){disable();if(!uncertain)await load();}}};
 q('salaryReload').onclick=load;q('salaryTemplate').onchange=template;
 q('salaryAuto').onclick=()=>write('owner_salary_auto_release_v1',{p_enabled:!auto.enabled});
 q('salaryPause').onclick=()=>write('owner_host_agency_salary_policy_v1',{p_enabled:!ops.enabled});
 q('salaryCommission100').onclick=()=>{try{const policy=JSON.parse(q('salaryJson').value);Object.assign(policy,{agency_qualification_mode:'volume_usd',agency_volume_basis:'agency_commission',minimum_agency_volume_usd:100,minimum_hosts_enabled:false});q('salaryJson').value=JSON.stringify(policy,null,2);status.textContent='Draft minimum: $100 earned agency commission. Save the selected future policy to schedule it.';}catch(e){status.textContent=e.message;}};
 q('salarySave').onclick=()=>{try{
  const country=q('salaryCountry').value.trim().toUpperCase(),cycle=q('salaryCycle').value,zone=q('salaryZone').value.trim(),date=q('salaryDate').value,policy=JSON.parse(q('salaryJson').value);
  if(!/^(\*|[A-Z]{2})$/.test(country)||!['daily','weekly','monthly'].includes(cycle)||!/^20\d{2}-\d{2}-\d{2}$/.test(date)||!zone||!policy||Array.isArray(policy)||!Array.isArray(policy.tiers))throw Error('Check country, cycle, future date, timezone and policy.');
  const last=policy.tiers.at(-1);if(!last)throw Error('Salary tiers required');policy.extension_step=last.target;policy.extension_host_usd=last.host_usd;policy.extension_agent_usd=last.agent_usd;
  return write('owner_salary_programs_v1',{p_country:country,p_cycle:cycle,p_effective_date:date,p_timezone:zone,p_policy:policy,p_active:country==='*'||q('salaryActive').value==='true'});
 }catch(e){status.textContent=e.message;}};
 q('salaryRemove').onclick=()=>{const p=programs.find(x=>x.id===q('salaryTemplate').value);if(!p||Date.parse(p.effective_at)<=Date.now()){status.textContent='Only future programs can be removed. Current and historical records are retained.';return;}return write('owner_remove_future_salary_program_v1',{p_program:p.id});};
 await load();
}

