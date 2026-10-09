const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/gift-control.js','utf8');
const app=fs.readFileSync(__dirname+'/app.js','utf8');
const events={preventDefault(){}};
class Node {
 constructor(){this.isConnected=true;this.nodes={};this.value='';this.disabled=false;}
 set innerHTML(s){this.html=s;this.nodes={};if(s.includes('giftSearch')){this.nodes['#giftSearch']=new Node();this.nodes['#giftSearch'].elements={search:{value:''}};for(const k of ['[data-new]','[data-prev]','[data-next]','#giftEditor'])this.nodes[k]=new Node();this.edits=(s.match(/data-edit="\d+"/g)||[]).map((_,i)=>Object.assign(new Node(),{dataset:{edit:String(i)}}));}if(s.includes('giftForm')){const form=new Node(),vals={};for(const m of s.matchAll(/<input name="([^"]+)"[^>]*value="([^"]*)"/g))vals[m[1]]={value:m[2]};for(const m of s.matchAll(/<select name="([^"]+)">([\s\S]*?)<\/select>/g)){const selected=[...m[2].matchAll(/<option value="([^"]+)" ([^>]*)>/g)].find(x=>x[2].includes('selected'));vals[m[1]]={value:selected?.[1]||'false'};}form.elements={namedItem:n=>vals[n]};form.nodes.button=new Node();this.nodes.form=form;}}
 get innerHTML(){return this.html;}
 querySelector(q){return this.nodes[q];}querySelectorAll(){return this.edits||[];}scrollIntoView(){}
}
const {showGiftControl}=vm.runInNewContext(source.replace(/export /g,'')+';({showGiftControl})',{URL,Number,Set,Error});
(async()=>{let active=true,fail=true,calls=[],toast=[],resolve,queries=0;const root=new Node(),gift={id:'id-1',slug:'coffee-sip',name:'Coffee',category:'standard',asset_key:'brand:coffee-sip',coin_price:500,diamond_value:500,effect_duration_ms:4000,combo_quantities:[1,10,99],custom_combo_max:9999,sort_order:20,min_vip_level:0,active:true,policy_version:7};
 const chain={select(){return this},order(){return this},range(){queries++;return this},ilike(){return this},then(fn){return Promise.resolve({data:Array.from({length:100},(_,i)=>({...gift,id:i===0?gift.id:"id-"+(i+1)}))}).then(fn)}};
 await showGiftControl({root,client:{from:()=>chain},isCurrent:()=>active,toast:(m,b)=>toast.push([m,b]),rpc:(name,args)=>{calls.push({name,args});return new Promise((ok,bad)=>resolve=()=>fail?bad(Error('conflict')):ok(gift))}});
 root.edits[0].onclick();const form=root.querySelector('#giftEditor').querySelector('form');form.elements.namedItem('name').value='Coffee updated';
 const first=form.onsubmit(events),second=form.onsubmit(events);await second;assert.equal(calls.length,1);assert.equal(calls[0].args.p_gift,'id-1');assert.equal(calls[0].args.p_expected_version,7);assert.equal(calls[0].args.p_values.slug,'coffee-sip');assert.equal(form.querySelector('button').disabled,true);const beforeNext=queries;root.querySelector('[data-next]').onclick();await Promise.resolve();assert.equal(queries,beforeNext,'next-page navigation must not reload or replace a pending gift draft');resolve();await first;assert.equal(form.elements.namedItem('name').value,'Coffee updated');assert.equal(form.querySelector('button').disabled,false);assert.equal(toast.at(-1)[0],'conflict');
 fail=false;const retry=form.onsubmit(events);assert.equal(calls.length,2);resolve();await retry;assert(toast.some(x=>x[0]==='Gift saved with server audit'));
 active=false;const count=calls.length;await form.onsubmit(events);assert.equal(calls.length,count,'navigation invalidates mutation');
 assert(app.includes("if(key==='gift')return go('gifts')"));assert(app.includes('if(!authority.is_founder)throw Error("Founder permission required")'));assert(app.includes('isCurrent:()=>token===navigationRevision'));
 console.log('PASS actual gift editor list/edit handlers, exact IDs/version, duplicate submission, failed draft/retry, stale navigation and Founder route boundary; no LIVE save.');
})().catch(e=>{console.error(e);process.exitCode=1});
