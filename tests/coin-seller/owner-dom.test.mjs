import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{JSDOM}from'jsdom';import{showCoinSellerControl}from'../../coin-seller-control.js';
const seed=JSON.parse(fs.readFileSync(new URL('./seed.json',import.meta.url))),flush=async()=>{await new Promise(r=>setTimeout(r,0));};
async function fixture(){const dom=new JSDOM('<main id="root"></main>',{url:'https://fixture.invalid/'});globalThis.window=dom.window;globalThis.document=dom.window.document;dom.window.confirm=()=>true;let catalog=structuredClone(seed),alive=true;const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});if(name==='owner_load_coin_seller_catalog_v1')return{data:structuredClone(catalog)};if(name==='owner_save_coin_seller_catalog_v1'){if(args.p_expected_version!==catalog.version)return{error:Error('Version conflict')};catalog={...structuredClone(args.p_config),version:catalog.version+1};return{data:structuredClone(catalog)};}throw Error('Unexpected RPC '+name);}};const root=dom.window.document.querySelector('#root');await showCoinSellerControl({root,client,isCurrent:()=>alive,toast:()=>{}});return{dom,root,calls,catalog:()=>catalog,retire:()=>{alive=false;},input(selector,value){const el=root.querySelector(selector);assert.ok(el,selector);el.value=value;el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));},click(selector){const el=root.querySelector(selector);assert.ok(el,selector);el.click();}};}
test('actual Owner module renders Binance and disabled empty Epay with edit/remove controls',async()=>{const f=await fixture();assert.equal(f.root.querySelectorAll('[data-package]').length,5);assert.equal(f.root.querySelectorAll('[data-channel]').length,2);assert.equal(f.root.querySelector('[data-channel="1"] [data-key="enabled"]').checked,false);assert.equal(f.root.querySelector('[data-channel="1"] [data-key="recipient"]').value,'');assert.ok(f.root.textContent.includes('Coin Seller Rules'));f.dom.window.close();});
test('bonus reduction updates coin total and server-versioned save/readback',async()=>{const f=await fixture();f.input('[data-package="2"] [data-key="bonus"]','0');assert.match(f.root.querySelector('[data-total="2"]').textContent,/1,000,000,000/);f.input('#sellerReason','Fixture bonus decrease');f.click('#sellerSave');await flush();assert.equal(f.catalog().packages[2].bonusBps,0);assert.equal(f.catalog().version,2);assert.equal(f.calls.filter(x=>x.name==='owner_save_coin_seller_catalog_v1').length,1);assert.match(f.root.querySelector('#sellerStatus').textContent,/Saved and read back/);f.dom.window.close();});
test('package/channel/rule add and remove preserve other draft edits',async()=>{const f=await fixture();f.input('[data-root="checkoutMinutes"]','30');f.click('#sellerAddPackage');assert.equal(f.root.querySelectorAll('[data-package]').length,6);assert.equal(f.root.querySelector('[data-root="checkoutMinutes"]').value,'30');f.click('[data-remove-package="5"]');f.click('#sellerAddChannel');assert.equal(f.root.querySelectorAll('[data-channel]').length,3);f.click('[data-remove-channel="2"]');f.click('#sellerAddRule');assert.equal(f.root.querySelectorAll('[data-rule]').length,10);f.click('[data-remove-rule="9"]');f.dom.window.close();});
test('wallet edit regenerates crypto QR; Epay account remains separate',async()=>{const f=await fixture();const old=f.root.querySelector('[data-qr="0"]').innerHTML;f.input('[data-channel="0"] [data-key="address"]','T'+'2'.repeat(33));assert.notEqual(f.root.querySelector('[data-qr="0"]').innerHTML,old);assert.equal(f.root.querySelector('[data-channel="1"] [data-key="recipient"]').value,'');f.dom.window.close();});
test('invalid link cannot save and retired panel cannot dispatch save',async()=>{const f=await fixture();f.input('[data-channel="1"] [data-key="paymentUrl"]','javascript:alert(1)');f.input('#sellerReason','Fixture invalid URL');f.click('#sellerSave');await flush();assert.equal(f.calls.filter(x=>x.name==='owner_save_coin_seller_catalog_v1').length,0);assert.match(f.root.querySelector('#sellerStatus').textContent,/HTTPS/);f.input('[data-channel="1"] [data-key="paymentUrl"]','');f.retire();f.click('#sellerSave');await flush();assert.equal(f.calls.filter(x=>x.name==='owner_save_coin_seller_catalog_v1').length,0);f.dom.window.close();});

// Actual-module lifetime checks: synthetic DOM/RPC only; no financial operation.
test('retired readback and retained refresh are inert; current save succeeds',async()=>{
 const previousWindow=globalThis.window;
 try {
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};};
async function fixture(){
 let alive=true, reads=0; const toasts=[],calls=[],pending=deferred(),nodes=new Map();
 const node=s=>{if(!nodes.has(s))nodes.set(s,{value:s==='#sellerEligibility'?JSON.stringify(seed.allowedCountries):s==='#sellerReason'?'Synthetic acceptance':'',disabled:false,textContent:'',addEventListener(){},querySelector(){return null;}});return nodes.get(s);};
 const root={innerHTML:'',querySelector:node,querySelectorAll:()=>[]};
 const saved={...structuredClone(seed),version:seed.version+1};
 const client={rpc:async(name,args)=>{calls.push({name,args});if(name==='owner_save_coin_seller_catalog_v1')return {data:saved};if(name==='owner_load_coin_seller_catalog_v1'){reads++;return reads===2?pending.promise:{data:structuredClone(seed)};}throw Error('Unexpected RPC');}};
 globalThis.window={confirm:()=>true};
 await showCoinSellerControl({root,client,isCurrent:()=>alive,toast:m=>toasts.push(m)});
 return {root,node,calls,toasts,pending,saved,retire(){alive=false;}};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
let failures=[];
{
 const f=await fixture();const save=f.node('#sellerSave').onclick();await flush();assert.equal(f.calls.length,3,'load, save, pending readback');f.retire();f.pending.resolve({data:f.saved});await save;
 try{assert.equal(f.toasts.length,0,'retired readback must not show success toast');}catch(e){failures.push(e.message);}
}
{
 const f=await fixture();const refresh=f.node('#sellerRefresh').onclick;f.retire();refresh();await flush();
 try{assert.equal(f.calls.length,1,'retired refresh must not dispatch another RPC');}catch(e){failures.push(e.message);}
 f.pending.resolve({data:f.saved});
}
{
 const f=await fixture();const save=f.node('#sellerSave').onclick();await flush();f.pending.resolve({data:f.saved});await save;assert.equal(f.toasts.length,1,'normal current save remains successful');
}
assert.deepEqual(failures, [], 'retired panel lifetime regressions');
 } finally { globalThis.window=previousWindow; }
});
