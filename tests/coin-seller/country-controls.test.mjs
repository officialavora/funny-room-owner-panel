import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {showCoinSellerControl} from '../../coin-seller-control.js';

const seed=JSON.parse(fs.readFileSync(new URL('./seed.json',import.meta.url)));
const before=fs.readFileSync(new URL('./country-control.before.js.txt',import.meta.url));
assert.equal(createHash('sha256').update(before).digest('hex'),'a0f4e3266b59f70d859b379f2fad9d832352a98866a47f6cb3bae70a87a4d254','Frozen country-control preimage');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'seller-country-before-'));
fs.writeFileSync(path.join(temporary,'package.json'),'{"type":"module"}');
fs.writeFileSync(path.join(temporary,'coin-seller-control.js'),before);
for(const n of ['coin-seller-catalog.mjs','coin-seller-qr.mjs'])fs.copyFileSync(new URL('../../'+n,import.meta.url),path.join(temporary,n));
const {showCoinSellerControl:showBefore}=await import(pathToFileURL(path.join(temporary,'coin-seller-control.js')));
test.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
async function fixture(show=showCoinSellerControl,{eligible=['IN','PK'],pendingSave=false}={}){
 const dom=new JSDOM('<main id="root"></main>',{url:'https://fixture.invalid/'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;dom.window.confirm=()=>true;
 let alive=true,catalog=structuredClone(seed),resolveSave;
 catalog.allowedCountries=[...eligible];catalog.countryOverrides.IN={note:'Synthetic country note'};
 const calls=[],toasts=[],errors=[];dom.window.addEventListener('error',e=>{errors.push(e.error);e.preventDefault();});
 const client={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='owner_load_coin_seller_catalog_v1')return {data:structuredClone(catalog)};
  assert.equal(name,'owner_save_coin_seller_catalog_v1');
  assert.equal(args.p_expected_version,catalog.version);
  catalog={...structuredClone(args.p_config),version:catalog.version+1};
  return pendingSave?new Promise(resolve=>resolveSave=()=>resolve({data:structuredClone(catalog)})):{data:structuredClone(catalog)};
 }};
 const root=dom.window.document.querySelector('#root');
 await show({root,client,isCurrent:()=>alive,toast:m=>toasts.push(m)});
 const input=(selector,value)=>{const n=root.querySelector(selector);assert.ok(n,selector);n.value=value;n.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
 return {dom,root,calls,toasts,errors,input,retire(){alive=false;},resolveSave(){resolveSave();},close(){dom.window.close();},save:async()=>{input('#sellerReason','Synthetic country control test');await root.querySelector('#sellerSave').onclick();}};
}

test('frozen original reproduces removed-country eligibility save failure',async()=>{
 const f=await fixture(showBefore);try{
  f.root.querySelector('[data-remove-country="IN"]').click();await f.save();
  assert.equal(f.calls.filter(x=>x.name==='owner_save_coin_seller_catalog_v1').length,0);
  assert.match(f.root.querySelector('#sellerStatus').textContent,/Invalid payment country eligibility/);
 }finally{f.close();}
});
test('removing an eligible country preserves other eligibility and saves exact valid document',async()=>{
 const f=await fixture();try{
  f.root.querySelector('[data-remove-country="IN"]').click();
  assert.deepEqual(JSON.parse(f.root.querySelector('#sellerEligibility').value),['PK']);
  await f.save();const saves=f.calls.filter(x=>x.name==='owner_save_coin_seller_catalog_v1');assert.equal(saves.length,1);
  assert.deepEqual(saves[0].args.p_config.allowedCountries,['PK']);
  assert.equal(saves[0].args.p_config.countries.some(c=>c.code==='IN'),false);
  assert.equal(Object.hasOwn(saves[0].args.p_config.countryOverrides,'IN'),false);
  assert.equal(saves[0].args.p_config.checkoutOpen,false);
  assert.match(f.root.querySelector('#sellerStatus').textContent,/Saved and read back/);
 }finally{f.close();}
});
test('removing the only eligible country never admits a replacement country',async()=>{
 const f=await fixture(showCoinSellerControl,{eligible:['IN']});try{
  f.root.querySelector('[data-remove-country="IN"]').click();await f.save();
  assert.deepEqual(f.calls.find(x=>x.name==='owner_save_coin_seller_catalog_v1').args.p_config.allowedCountries,[]);
 }finally{f.close();}
});
test('removing a noneligible display country retains existing eligibility',async()=>{
 const f=await fixture(showCoinSellerControl,{eligible:['PK']});try{
  f.root.querySelector('[data-remove-country="IN"]').click();await f.save();
  assert.deepEqual(f.calls.find(x=>x.name==='owner_save_coin_seller_catalog_v1').args.p_config.allowedCountries,['PK']);
 }finally{f.close();}
});
for(const selector of ['#sellerAddCountry','#sellerCountrySearch']){
 test('original malformed eligibility throws in '+selector,async()=>{
  const f=await fixture(showBefore);try{f.input('#sellerEligibility','{');const n=f.root.querySelector(selector);assert.throws(()=>selector==='#sellerAddCountry'?n.onclick():n.onchange({target:{value:'India'}}),SyntaxError);}finally{f.close();}
 });
 test('malformed eligibility is shown without uncaught event or save in '+selector,async()=>{
  const f=await fixture();try{
   f.input('#sellerEligibility','{');const n=f.root.querySelector(selector);
   assert.doesNotThrow(()=>selector==='#sellerAddCountry'?n.onclick():n.onchange({target:{value:'India'}}));
   assert.notEqual(f.root.querySelector('#sellerStatus').textContent,'Current server configuration loaded.');
   assert.match(f.root.querySelector('#sellerStatus').textContent,/JSON|property|position/i);
   assert.equal(f.calls.length,1);assert.deepEqual(f.errors,[]);
  }finally{f.close();}
 });
 test('retained '+selector+' callback does not query a retired root',async()=>{
  const f=await fixture();try{
   const n=f.root.querySelector(selector),callback=selector==='#sellerAddCountry'?n.onclick:n.onchange;
   f.retire();f.root.querySelector=()=>{throw Error('Retired DOM must not be touched');};
   assert.doesNotThrow(()=>callback({target:{value:'India'}}));assert.equal(f.calls.length,1);
  }finally{f.close();}
 });
}
test('search callback during a pending save cannot rerender enabled controls',async()=>{
 const f=await fixture(showCoinSellerControl,{pendingSave:true});try{
  const search=f.root.querySelector('#sellerCountrySearch').onchange,button=f.root.querySelector('#sellerSave');
  f.input('#sellerReason','Synthetic pending save');const saving=button.onclick();await flush();assert.equal(button.disabled,true);
  search({target:{value:'India'}});assert.equal(f.root.querySelector('#sellerSave'),button);assert.equal(button.disabled,true);
  f.resolveSave();await saving;assert.equal(f.toasts.length,1);
 }finally{f.close();}
});
test('normal country add and search remain available without granting checkout eligibility',async()=>{
 const f=await fixture();try{
  f.input('[data-key="newCode"]','ZZ');f.input('[data-key="newName"]','Synthetic region');f.root.querySelector('#sellerAddCountry').click();
  assert.ok(f.root.querySelector('[data-country="ZZ"]'));
  assert.deepEqual(JSON.parse(f.root.querySelector('#sellerEligibility').value),['IN','PK']);
  f.root.querySelector('#sellerCountrySearch').onchange({target:{value:'Synthetic region'}});
  assert.equal(f.root.querySelectorAll('[data-country]').length,1);assert.ok(f.root.querySelector('[data-country="ZZ"]'));
  await f.save();assert.equal(f.calls.filter(x=>x.name==='owner_save_coin_seller_catalog_v1').length,1);
 }finally{f.close();}
});
