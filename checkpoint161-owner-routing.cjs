'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
assert(source.includes("createClient('https://zspcgyhchaqpiyujyxqp.supabase.co'"));
assert(!source.includes('supaxsiylqysvzutwjrw'));
assert(source.includes("['appControls','✦','Application AI controls']"));
const fn=name=>{const start=source.indexOf((['go'].includes(name)?'async ':'')+'function '+name+'(');assert(start>=0);let end=source.indexOf('\n',start);return source.slice(start,end<0?source.length:end);};
const mount=source.split(' appControls:async()=>{')[1].split('\n overview:')[0];assert(mount);
const controlBody=('async()=>{'+mount).replace(/},\s*$/,'}').replace("import('./preview-full-controls.js')",'loadControls()');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(){const nodes=new Map(),calls=[],client={identity:'original-live'},load=deferred(),mountReady=deferred();let disposals=0;
 const get=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',classList:{add(){},remove(){}}});return nodes.get(s);};
 const context={supabase:client,$:get,renderNav(){},titles:{appControls:'Application AI controls',overview:'Overview'},hero:()=>'',esc:x=>x,toast:m=>calls.push(m),loadControls:()=>load.promise};
 vm.createContext(context);vm.runInContext("let page='overview',routeEpoch=0,disposeOwnerControls=null;const PAGES={overview:async()=>{},appControls:"+controlBody+"};"+fn('showLogin')+';'+fn('go')+';'+fn('openAction')+';globalThis.api={go,showLogin,openAction};',context);
 return{...context.api,nodes,calls,client,load,mountReady,get,ready(){load.resolve({mountOwnerControls:async(root,usedClient)=>{assert.equal(root,get('#application-owner-root'));assert.equal(usedClient,client);await mountReady.promise;return()=>disposals++;}});},disposals:()=>disposals};
}
(async()=>{
 for(const action of ['gift','cosmetic','gamePolicy']){const f=fixture();const task=f.openAction(action);f.ready();f.mountReady.resolve();await task;assert(f.get('#content').innerHTML.includes('application-owner-root'));await f.go('overview');assert.equal(f.disposals(),1);f.showLogin();assert.equal(f.disposals(),1);}
 const staleImport=fixture();const first=staleImport.go('appControls');await staleImport.go('overview');staleImport.load.resolve({mountOwnerControls:()=>{throw Error('Stale module must not mount');}});await first;assert(!staleImport.get('#content').innerHTML.includes('application-owner-root'));
 const staleMount=fixture();const pending=staleMount.go('appControls');staleMount.ready();await tick();staleMount.showLogin();staleMount.mountReady.resolve();await pending;assert.equal(staleMount.disposals(),1,'Late mount must be disposed after logout');
 const staleError=fixture();const old=staleError.go('appControls');await staleError.go('overview');staleError.load.reject(Error('old route'));await old;assert.deepEqual(staleError.calls,[],'Old route errors must not overwrite the current screen');
 console.log('CP161 Owner routing PASS: three formerly dangling controls, original LIVE client, route/import races, logout and mount cleanup. Backend permissions/device/deployment NOT TESTED.');
})().catch(e=>{console.error(e);process.exitCode=1;});
