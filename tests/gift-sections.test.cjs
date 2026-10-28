const fs=require('fs'),assert=require('node:assert/strict');
const {JSDOM}=require('./media-upload/node_modules/jsdom');
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
(async()=>{
 const sectionSource=fs.readFileSync('gift-sections.js','utf8'),sectionURL=url(sectionSource);
 const {GIFT_SECTIONS,giftSection,giftDisplayId}=await import(sectionURL);
 const source=fs.readFileSync('gift-control.js','utf8').replace('./gift-sections.js?v=20261028',sectionURL);
 const {showGiftControl,giftPayload}=await import(url(source));
 assert.equal(giftDisplayId('01'),'01');assert.equal(giftDisplayId('  '),null);
 for(const s of ['x<script>','a b','a'.repeat(33),'💖'])assert.throws(()=>giftDisplayId(s));
 const legacy=[['classic','Gift'],['relationship','CP'],['lucky','Lucky'],['vip','SVIP'],['flags','Flag'],['special','Exclusive'],['funny','Funny']];
 for(const [category,want] of legacy)assert.equal(giftSection({category,slug:'cp-love-story'}),want);
 assert.equal(giftSection({category:'relationship',slug:'relationship-bestie-promise',proposal_relationship:'bestie'}),'Gift');
 let groups=3;
 for(const section of GIFT_SECTIONS){
  const dom=new JSDOM('<div id="root"></div>');dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  const root=dom.window.document.querySelector('#root'),calls=[];
  const chain={select(){return this},order(){return this},range(){return Promise.resolve({data:[]})}};
  await showGiftControl({root,client:{from:()=>chain},isCurrent:()=>true,toast(){},rpc:async(name,args)=>calls.push({name,args})});
  root.querySelector('[data-new]').click();const form=root.querySelector('form#giftForm');
  form.elements.namedItem('name').value='Approved original gift';
  const select=form.elements.namedItem('catalog_section');select.value=section;select.dispatchEvent(new dom.window.Event('change'));
  form.elements.namedItem('display_id').value='01';form.elements.namedItem('coin_price').value='100000';
  await form.onsubmit({preventDefault(){}});
  assert.equal(calls.length,1);assert.equal(calls[0].name,'owner_save_gift_v4');
  assert.equal(calls[0].args.p_values.catalog_section,section);assert.equal(calls[0].args.p_values.display_id,'01');
  assert.equal(calls[0].args.p_values.active,false);assert.equal(calls[0].args.p_values.coin_price,100000);
  assert.equal(calls[0].args.p_gift,null);groups++;
 }
 const base={name:'Existing',category:'classic',catalog_section:'Exclusive',display_id:'A23',coin_price:'200',diamond_value:'200',combo_quantities:'1',custom_combo_max:'99',allow_custom_combo:'true',active:'true',featured:'false',sort_order:'9',min_vip_level:'0',effect_duration_ms:'4000',asset_key:'approved',effect_kind:'standard',effect_asset_url:'',sound_url:''};
 const old={id:'same-uuid',slug:'same-slug',policy_version:8,audience_scope:'cp',required_bond_type:'cp',proposal_relationship:'cp'};
 const p=giftPayload(k=>base[k],old);for(const k of Object.keys(old))assert.equal(p[k],old[k]);
 assert.equal(p.catalog_section,'Exclusive');assert.equal(p.category,'classic');
 assert.throws(()=>giftPayload(k=>k==='catalog_section'?'Lucky':base[k],old));groups++;
 console.log(`PASS ${groups} gift section/ID groups: actual seven-section creation handlers, auto engine category for new drafts, leading zeros, validation, immutable UUID/slug, prices, inactive creation and financial metadata preservation. RPC/storage mocked.`);
})().catch(e=>{console.error(e);process.exitCode=1});
