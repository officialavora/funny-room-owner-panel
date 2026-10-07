const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const helpers=Function(fs.readFileSync('salary-amounts.js','utf8').replaceAll('export function','function')+';return {salaryFormat,salaryRpcInteger,salaryRemaining}')();
const web=fs.readFileSync('preview-full-controls.js','utf8'),part=web.slice(web.indexOf('function Lp('),web.indexOf('var vt=',web.indexOf('function Lp(')));
const start=part.indexOf('f=async()=>')+2,end=part.indexOf(',T=',start);assert(end>start);const save=part.slice(start,end);
(async()=>{
 for(const [id,units,earned] of [['100012','1.5','100'],['100012','1e3','100'],['100012','1,2','100'],['100012','0','9007199254740992'],['9007199254740992','0','100']]){let calls=[],notices=[];const c={...helpers,t:id,a:'host',n:'2026-10',d:units,s:earned,D:'open',m(){},B(){},$:x=>notices.push(x),w:{rpc:async(...x)=>{calls.push(x);return {data:[],error:null}}}};await vm.runInNewContext('('+save+')',c)();assert.equal(calls.length,0);assert.equal(notices.length,1);}
 let calls=[];await vm.runInNewContext('('+save+')',{...helpers,t:'100012',a:'host',n:'2026-10',d:'2,000',s:'3,000',D:'open',m(){},B(){},$(){},w:{rpc:async(...x)=>{calls.push(x);return {data:[],error:null}}}})();assert.equal(calls[0][0],'owner_set_salary_progress');assert.equal(calls[0][1].p_eligible_units,2000);assert.equal(calls[0][1].p_earned_amount,3000);assert.equal(calls[0][1].p_public_id,100012);
 assert.equal(helpers.salaryFormat('9007199254740993'),'9,007,199,254,740,993');assert.equal(helpers.salaryFormat(9007199254740992),'Unavailable');assert.equal(helpers.salaryRemaining({earned_amount:'9007199254740993',advance_used:'9007199254740991',settled_amount:'1'}),1n);
 assert(web.includes('"coffee-sip":{poster:{uri:"./assets/brand162/coffee.webp"},motion:{uri:"./assets/brand162/coffee.webp"}}'));
 console.log('PASS actual Owner salary callback: malformed/unsafe amounts and IDs denied; exact RPC payload/display/remainder; same Coffee asset routing');
})().catch(e=>{console.error(e);process.exitCode=1});
