const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync(__dirname+'/partner-salary-controls.js','utf8');
 const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 function fixture(){let active=true,hold=null,fail=false;const calls=[],nodes=new Map();const root={isConnected:true,innerHTML:'',querySelector(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false});return nodes.get(id);}};
  let agency={version:4,minimum_usd:100,enabled:true},bd={version:2,enabled:false},ranking={version:1,enabled:false};
  const rpc=async(name,args={})=>{calls.push({name,args});if(args.p_expected_version!==undefined){if(hold)await hold;if(fail)throw Error('Synthetic timeout');}
   if(name==='owner_agency_commission_release_rule_v2'){if(args.p_expected_version!==undefined){assert.equal(args.p_expected_version,agency.version);agency={version:agency.version+1,minimum_usd:args.p_minimum_usd,enabled:args.p_enabled};}return {actor_id:'owner',current:agency};}
   if(name==='owner_bd_salary_release_v1'){if(args.p_expected_version!==undefined){assert.equal(args.p_expected_version,bd.version);bd={version:bd.version+1,enabled:args.p_enabled};}return {actor_id:'owner',...bd};}
   if(name==='owner_agency_ranking_activation_v2'){if(args.p_expected_version!==undefined)ranking={version:ranking.version+1,enabled:args.p_enabled};return ranking;}
   if(name==='owner_bd_commission_policy_v1')return {actor_id:'owner',template:{rate_percent:5,minimum_usd:500,minimum_basis:'agency_commission',commission_source:'agency_payout',enabled:false},versions:[]};
   if(name==='owner_bd_agency_link_v1')return {actor_id:'owner',links:[]};throw Error(name);
  };
  return {root,calls,q:id=>root.querySelector('#'+id),run:()=>mod.showPartnerSalaryControls({root,rpc,isCurrent:()=>active,actorId:'owner'}),setActive:v=>active=v,setHold:v=>hold=v,setFail:v=>fail=v};
 }
 let passed=0,h=fixture();await h.run();assert.equal(h.q('partnerBDRelease').textContent,'Automatic BD settlement: OFF');assert.equal(JSON.parse(h.q('partnerPolicy').value).minimum_basis,'agency_commission');assert.equal(h.calls.length,5);passed++;
 h.q('partnerMinimum').value='137.42';await h.q('partnerAgencySave').onclick();assert(h.calls.some(c=>c.args.p_minimum_usd===137.42&&c.args.p_expected_version===4));assert.equal(h.q('partnerMinimum').value,'137.42');passed++;
 await h.q('partnerBDRelease').onclick();assert.equal(h.q('partnerBDRelease').textContent,'Automatic BD settlement: ON');passed++;
 await h.q('partnerRanking').onclick();assert.equal(h.q('partnerRanking').textContent,'Agency weekly coins: ON');passed++;
 h.q('partnerMinimum').value='1.001';let n=h.calls.length;await h.q('partnerAgencySave').onclick();assert.equal(h.calls.length,n);passed++;
 h.q('partnerPolicy').value=JSON.stringify({rate_percent:5,minimum_usd:500,minimum_basis:'agency_commission',commission_source:'agency_payout',enabled:true});h.q('partnerMonth').value='2026-12-01';await h.q('partnerBDSave').onclick();assert(h.calls.some(c=>c.args.p_policy?.minimum_usd===500&&c.args.p_expected_version===0));passed++;
 h.q('partnerOwnerUid').value='100001';h.q('partnerBDUid').value='100002';await h.q('partnerLinkSave').onclick();assert(h.calls.some(c=>c.args.p_owner_public_id===100001&&c.args.p_bd_public_id===100002));passed++;
 h.q('partnerOwnerUid').value='9007199254740993';n=h.calls.length;await h.q('partnerLinkSave').onclick();assert.equal(h.calls.length,n);passed++;
 h=fixture();await h.run();let release;h.setHold(new Promise(r=>release=r));const a=h.q('partnerBDRelease').onclick(),b=h.q('partnerBDRelease').onclick();release();await Promise.all([a,b]);assert.equal(h.calls.filter(c=>c.args.p_expected_version!==undefined).length,1);passed++;
 h=fixture();await h.run();h.setFail(true);await h.q('partnerBDRelease').onclick();assert(h.q('partnerStatus').textContent.includes('unconfirmed'));n=h.calls.length;await h.q('partnerBDRelease').onclick();assert.equal(h.calls.length,n);h.setFail(false);await h.q('partnerReload').onclick();assert.equal(h.q('partnerBDRelease').disabled,false);passed++;
 h=fixture();await h.run();h.setActive(false);n=h.calls.length;await h.q('partnerBDRelease').onclick();assert.equal(h.calls.length,n);passed++;
 h=fixture();h.setActive(false);await h.run();assert.equal(h.root.innerHTML,'');assert.equal(h.calls.length,0);passed++;
 console.log(JSON.stringify({passed,scope:'Actual Owner partner module handlers with synthetic DOM/transport; no live balance mutation'}));
})().catch(e=>{console.error(e);process.exitCode=1});
