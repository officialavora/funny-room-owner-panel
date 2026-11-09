const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = readFileSync('app.js', 'utf8').split('\n').slice(1).join('\n');
const html = readFileSync('index.html','utf8');
const valid={user:{id:'synthetic-owner'}};

function setup(url, update=async()=>({data:valid})) {
 const nodes=new Map(), attempts=[], redirects=[];
 let observer, options, boots=0, signOutError=null;
 function node(id){
  if(!nodes.has(id)){
   const classes=new Set(id==='#login'?[]:['hidden']);
   nodes.set(id,{value:'',textContent:'',style:{},disabled:id==='#savePassword',focus(){},close(){},classList:{
    add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v),
   }});
  }
  return nodes.get(id);
 }
 const location = new URL(url);
 location.replace = path=>redirects.push(path);
 runInNewContext(source,{
  createClient(_url,_key,opt){options=opt.auth;return {auth:{
   onAuthStateChange:f=>observer=f,
   getSession:async()=>{boots++;return {data:{session:null}}},
   updateUser:p=>{attempts.push(p.password);return update()},
   signOut:async()=>({error:signOutError}),
  }}},
  setupLoginControls:()=>()=>{}, createRememberStorage:()=>({storage:{}}),
  document:{querySelector:node}, location, URL, URLSearchParams, setTimeout(){},
 });
 return {node, attempts, redirects, options, boots, event:observer, setSignOutError:x=>signOutError=x,
  submit:()=>node('#recoveryForm').onsubmit({preventDefault(){}}),
  passwords(a,b=a){node('#newPassword').value=a;node('#confirmPassword').value=b},
 };
}
const base='https://owner.test/panel/';
test('ordinary login uses its existing storage and never opens recovery',()=>{
 const f=setup(base);
 assert.equal(f.options.persistSession,true);
 assert.equal(f.boots,1);
 assert.equal(f.node('#recovery').classList.contains('hidden'),true);
 assert.match(html,/name="password"[^>]*autocomplete="current-password"/);
});
test('recovery URL alone keeps Owner boot and writes disabled',async()=>{
 const f=setup(base+'#type=recovery&access_token=mock');
 assert.equal(f.options.persistSession,false);
 assert.equal(f.options.autoRefreshToken,false);
 assert.equal(f.boots,0);
 f.event('INITIAL_SESSION',valid);
 f.passwords('synthetic-password');
 await f.submit();
 assert.deepEqual(f.attempts,[]);
 assert.match(f.node('#recoveryStatus').textContent,/unavailable/);
 f.node('#exitRecovery').onclick();
 assert.deepEqual(f.redirects,[base]);
 assert.equal(f.node('#newPassword').value,'');
});
test('confirmed recovery requires matching password and submits once',async()=>{
 let complete;
 const f=setup(base+'#type=recovery',()=>new Promise(resolve=>complete=resolve));
 f.event('PASSWORD_RECOVERY',valid);
 f.passwords('one','two');
 await f.submit();
 assert.deepEqual(f.attempts,[]);
 f.passwords('synthetic-password');
 const first=f.submit();
 await f.submit();
 assert.equal(f.attempts.length,1);
 complete({data:valid,error:null});
 await first;
 assert.match(f.node('#recoveryStatus').textContent,/Password updated/);
 assert.equal(f.node('#newPassword').value,'');
 assert.equal(f.node('#savePassword').disabled,true);
 await f.submit();
 assert.equal(f.attempts.length,1);
});
test('server error leaves verified recovery available for retry',async()=>{
 const f=setup(base+'?type=recovery',async()=>({error:{message:'Password policy rejected'}}));
 f.event('PASSWORD_RECOVERY',valid);
 f.passwords('synthetic-password');
 await f.submit();
 assert.match(f.node('#recoveryStatus').textContent,/policy rejected/);
 assert.equal(f.node('#savePassword').disabled,false);
});
test('expired link and lost session never update a password',async()=>{
 const f=setup(base+'#error_code=otp_expired');
 f.event('PASSWORD_RECOVERY',valid);
 f.event('SIGNED_OUT',null);
 f.passwords('synthetic-password');
 await f.submit();
 assert.deepEqual(f.attempts,[]);
 assert.equal(f.node('#savePassword').disabled,true);
});
test('sign-out failure preserves the existing screen and permits retry',async()=>{
 const f=setup(base);
 await new Promise(setImmediate);
 f.node('#app').classList.remove('hidden');
 f.setSignOutError(Error('network failure'));
 await f.node('#logout').onclick();
 assert.match(f.node('#toast').textContent,/Could not sign out/);
 assert.equal(f.node('#app').classList.contains('hidden'),false);
 f.setSignOutError(null);
 await f.node('#logout').onclick();
 assert.match(f.node('#toast').textContent,/Signed out securely/);
 assert.equal(f.node('#app').classList.contains('hidden'),true);
});
