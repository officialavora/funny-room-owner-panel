const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const{JSDOM}=require('jsdom');
const stage='https://supaxsiylqysvzutwjrw.supabase.co',live='https://zspcgyhchaqpiyujyxqp.supabase.co';
(async()=>{
 const dom=new JSDOM(fs.readFileSync('../preview.html','utf8'),{url:'https://officialavora.github.io/funny-room-owner-panel/preview.html'});
 const calls=[],clients=[];let session=null;const client={auth:{getSession:async()=>({data:{session}}),setSession:async s=>{session={...s,user:{email:'officialavora7@gmail.com'}};return{}},signOut:async()=>{session=null},onAuthStateChange:()=>{},resetPasswordForEmail:async()=>({})},rpc:async(name)=>{calls.push({rpc:name});return{data:name==='current_staff_access'?{role:'owner',is_staff:true}:name==='current_authority_contexts'?{is_founder:true,primary_role:'root_founder'}:{}}}};
 const context=vm.createContext({document:dom.window.document,location:dom.window.location,console,crypto:{randomUUID:()=> 'fixture'},setTimeout:()=>0,createClient:(url,key,options)=>{clients.push({url,key,options});return client},fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({session:{access_token:url.startsWith(live)?'live-fixture':'stage-fixture',refresh_token:'refresh-fixture'}})}}});
 const source=fs.readFileSync('../preview-app.js','utf8').replace(/^import[^\n]+\n/,'');vm.runInContext(source,context);await new Promise(r=>setImmediate(r));
 assert.equal(clients[0].url,stage);assert.equal(clients[0].options.auth.storageKey,'funnyroom.cp156.panel.preview');assert.equal(calls.length,0);
 const form=dom.window.document.querySelector('#loginForm'),button=form.querySelector('button');dom.window.document.querySelector('#password').value='fixture';
 await form.onsubmit({preventDefault(){},submitter:button});
 const requests=calls.filter(x=>x.url);assert.equal(requests.length,2);assert.equal(requests[0].url,live+'/functions/v1/panel-login');assert.equal(requests[1].url,stage+'/functions/v1/preview-owner-session');assert.equal(requests[1].options.headers.Authorization,'Bearer live-fixture');assert.equal(session.access_token,'stage-fixture');assert.equal(dom.window.document.querySelector('#password').value,'');assert(calls.some(x=>x.rpc==='staff_dashboard_counts'));assert(!dom.window.document.querySelector('#app').classList.contains('hidden'));
 await dom.window.document.querySelector('#logout').onclick();calls.length=0;dom.window.document.querySelector('#email').value='staff-fixture';dom.window.document.querySelector('#password').value='fixture';
 await form.onsubmit({preventDefault(){},submitter:button});const staff=calls.filter(x=>x.url);assert.equal(staff.length,1);assert.equal(staff[0].url,stage+'/functions/v1/panel-login');
 assert(source.includes(stage+'/functions/v1/panel-admin'));assert(source.includes("'./preview-full-controls.js'"));assert(!source.includes(live+'/functions/v1/panel-admin'));
 console.log('PASS CP156 Owner preview: protected Root live authentication only, staged SSO/business/staff, separate storage, no automatic calls/password retention, original control mount.');
})().catch(e=>{console.error(e);process.exit(1)});
