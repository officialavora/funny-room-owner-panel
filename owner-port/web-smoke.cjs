const {JSDOM}=require('jsdom');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
(async()=>{
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://example.test/funny-room-owner-panel/',pretendToBeVisual:true});
for(const k of ['window','document','HTMLElement','Element','Node','MutationObserver','Image','CustomEvent','Event','HTMLDialogElement','ShadowRoot','localStorage'])global[k]=dom.window[k];
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);global.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);window.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});global.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
const errors=[];process.on('unhandledRejection',e=>errors.push(String(e)));window.addEventListener('error',e=>errors.push(e.message));const old=console.error;console.error=(...a)=>{errors.push(a.map(String).join(' '));};
const query=new Proxy(()=>query,{get:(_,key)=>key==='then'?(...args)=>Promise.resolve({data:null,error:{message:'SMOKE: backend unavailable'}}).then(...args):()=>query});
const channel={on(){return this},subscribe(){return this},unsubscribe(){return Promise.resolve()}};
const api={channel:()=>channel,removeChannel:async()=>{},from:()=>query,storage:{from:()=>query},auth:{getUser:async()=>({data:{user:{id:'test-fixture'}},error:null})},rpc:async name=>name==='panel_my_access'?{data:{is_founder:true,rank:100,permissions:[]},error:null}:name==='current_staff_access'?{data:{is_staff:true,role:'owner'},error:null}:{data:null,error:{message:'SMOKE: backend unavailable'}}};
const {mountOwnerControls}=await import(pathToFileURL(require('node:path').resolve('dist/full-controls.js')));await assert.rejects(()=>mountOwnerControls(document.getElementById('root'),{auth:{getUser:async()=>({data:{user:null},error:{message:'expired'}})},rpc:api.rpc}),/Sign in/);await assert.rejects(()=>mountOwnerControls(document.getElementById('root'),{auth:api.auth,rpc:async()=>({data:{is_staff:false}})}),/Protected staff/);assert.equal(document.getElementById('root').childElementCount,0);const dispose=await mountOwnerControls(document.getElementById('root'),api);await new Promise(r=>setTimeout(r,150));
let select=document.querySelector('select');assert(select,'Screen selector rendered');const ids=[...select.options].map(x=>x.value);let checked=0;
for(const id of ids){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,100));assert(!document.body.textContent.includes('Control could not load:'),id+' crashed: '+document.querySelector('[role=alert]')?.textContent);checked++;}
dispose();assert.equal(document.getElementById('root').childElementCount,0);assert.equal(document.querySelectorAll('dialog').length,0);console.error=old;
assert.deepEqual(errors.filter(x=>!x.includes('useNativeDriver')&&!x.includes('textShadow')&&!x.includes('boxShadow')),[]);console.log(JSON.stringify({status:'PASS',screens:checked,coverage:'render and backend-error handling using local fixtures; no authenticated/live mutations tested'}));dom.window.close();process.exit(0);
})().catch(e=>{process.stdout.write(String(e.stack||e)+'\n');process.exit(1)});
