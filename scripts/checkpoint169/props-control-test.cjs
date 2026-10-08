const fs=require('fs'),assert=require('node:assert/strict'),path=require('path');
(async()=>{
 const source=fs.readFileSync(path.join(process.env.OWNER_PANEL_AUDIT_ROOT||path.join(__dirname,'../..'),'props-control.js'),'utf8');
 const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));let checks=0;
 for(const v of ['1e3','1.5','-1','9007199254740993','']){assert.throws(()=>mod.integer(v,'test'));checks++;}
 assert.equal(mod.integer('500','test'),500);checks++;
 assert.equal(mod.KINDS.length,11);assert.equal(mod.CATEGORIES.length,18);checks+=2;
 const fields={code:'new_frame',name:'Original frame',kind:'frame',tier:'standard',visual:'{"artwork":"original"}',asset_url:'https://example.invalid/art.png',sound_url:'',sound_key:'',price_coins:'120',duration_days:'7',sort_order:'1',active:'false',purchasable:'true'};
 const form={elements:{namedItem:k=>({value:fields[k]})}};
 let payload=mod.itemPayload(form);assert.equal(payload.price_coins,120);assert.equal(payload.active,false);assert.equal(payload.purchasable,true);assert.equal(payload.sound_url,null);checks+=4;
 payload=mod.itemPayload(form,{code:'existing_frame',kind:'room_frame'});assert.equal(payload.code,'existing_frame');assert.equal(payload.kind,'room_frame');checks+=2;
 fields.visual='[]';assert.throws(()=>mod.itemPayload(form));fields.visual='{broken';assert.throws(()=>mod.itemPayload(form));checks+=2;
 let current=true,resolve,calls=0;const root={isConnected:true,innerHTML:'current page'};
 const pending=mod.showPropsControl({root,rpc:()=>{calls++;return new Promise(r=>resolve=r)},isCurrent:()=>current,toast:()=>{}});
 current=false;resolve({items:[],sets:[]});await pending;assert.equal(root.innerHTML,'current page');assert.equal(calls,1);checks+=2;
 current=true;root.isConnected=false;const removed=mod.showPropsControl({root,rpc:async()=>({items:[],sets:[]}),isCurrent:()=>current,toast:()=>{}});await removed;assert.equal(root.innerHTML,'current page');checks++;
 console.log(JSON.stringify({checks,result:'PASS',scope:'Prop payload validation, stable identity, nine My Props plus two legacy kinds, stale navigation/unmount fencing; no real mutations'}));
})().catch(e=>{console.error(e);process.exitCode=1});
