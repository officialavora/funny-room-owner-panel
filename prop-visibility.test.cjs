const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const source=fs.readFileSync(__dirname+'/prop-visibility.js','utf8');const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const bad of ['',0,-1,'1e3','1.2','9007199254740993'])assert.throws(()=>mod.publicId(bad));
assert.deepEqual(mod.grantArgs('100000',' frame_a ',' '),{target_public_id:100000,asset_code:'frame_a',duration_days:null,reason_text:'Authorized manual Owner panel prop grant'});
assert.equal(mod.grantArgs('100001','a','3650').duration_days,3650);assert.throws(()=>mod.grantArgs('100001','a','3651'));assert.throws(()=>mod.grantArgs('100001',' ','10'));
let resolve,calls=0,current=true;const root={isConnected:true,innerHTML:'New page'};const promise=mod.showPropVisibility({root,rpc:()=>{calls++;return new Promise(r=>resolve=r)},isCurrent:()=>current,toast:()=>{},kinds:['frame']});current=false;resolve({founder:true,can_grant:true,hidden:{}});await promise;assert.equal(root.innerHTML,'New page');assert.equal(calls,1);
await assert.rejects(()=>mod.showPropVisibility({root,rpc:async()=>{throw Error('Denied')},isCurrent:()=>true,toast:()=>{},kinds:[]}),/Denied/);
console.log('Prop grant controls PASS: exact ID/duration, permanent grants, blank codes, stale navigation, backend errors');
})().catch(e=>{console.error(e);process.exitCode=1});
