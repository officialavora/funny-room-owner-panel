const fs=require('fs'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const {JSDOM}=require('./tests/media-upload/node_modules/jsdom');
const app=fs.readFileSync(__dirname+'/app.js','utf8');
const events={preventDefault(){}};
(async()=>{
 const {showGiftControl}=await import(pathToFileURL(__dirname+'/gift-control.js').href);
 const dom=new JSDOM('<div id="root"></div>');dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 let active=true,fail=true,calls=[],toast=[],resolve,queries=0;const root=dom.window.document.getElementById('root'),gift={id:'id-1',slug:'coffee-sip',name:'Coffee',category:'standard',asset_key:'brand:coffee-sip',coin_price:500,diamond_value:500,effect_duration_ms:4000,combo_quantities:[1,10,99],custom_combo_max:9999,sort_order:20,min_vip_level:0,active:true,policy_version:7};
 const chain={select(){return this},order(){return this},range(){queries++;return this},ilike(){return this},then(fn){return Promise.resolve({data:Array.from({length:100},(_,i)=>({...gift,id:i===0?gift.id:"id-"+(i+1)}))}).then(fn)}};
 await showGiftControl({root,client:{from:()=>chain},isCurrent:()=>active,toast:(m,b)=>toast.push([m,b]),rpc:(name,args)=>{calls.push({name,args});return new Promise((ok,bad)=>resolve=()=>fail?bad(Error('conflict')):ok(gift))}});
 root.querySelector('[data-edit]').click();const form=root.querySelector('#giftEditor').querySelector('form');form.elements.namedItem('name').value='Coffee updated';
 const first=form.onsubmit(events),second=form.onsubmit(events);await second;await Promise.resolve();assert.equal(calls.length,1);assert.equal(calls[0].args.p_gift,'id-1');assert.equal(calls[0].args.p_expected_version,7);assert.equal(calls[0].args.p_values.slug,'coffee-sip');assert.equal(form.querySelector('button').disabled,true);const beforeNext=queries;root.querySelector('[data-next]').onclick();await Promise.resolve();assert.equal(queries,beforeNext,'next-page navigation must not reload or replace a pending gift draft');resolve();await first;assert.equal(form.elements.namedItem('name').value,'Coffee updated');assert.equal(form.querySelector('button').disabled,false);assert.equal(toast.at(-1)[0],'conflict');
 fail=false;const retry=form.onsubmit(events);await Promise.resolve();assert.equal(calls.length,2);resolve();await retry;assert(toast.some(x=>x[0]==='Gift saved with server audit'));
 active=false;const count=calls.length;await form.onsubmit(events);assert.equal(calls.length,count,'navigation invalidates mutation');
 assert(app.includes("if(key==='gift')return go('gifts')"));assert(app.includes('if(!authority.is_founder)throw Error("Founder permission required")'));assert(app.includes('isCurrent:()=>token===navigationRevision'));
 console.log('PASS actual gift editor list/edit handlers, exact IDs/version, duplicate submission, failed draft/retry, stale navigation and Founder route boundary; no LIVE save.');
})().catch(e=>{console.error(e);process.exitCode=1});

