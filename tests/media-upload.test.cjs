const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {JSDOM}=require('./media-upload/node_modules/jsdom');
const root=path.resolve(__dirname,'..');
const dataURL=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const mediaSource=fs.readFileSync(path.join(root,'props-media-upload.js'),'utf8');
const mediaURL=dataURL(mediaSource);
const sectionsURL=dataURL(fs.readFileSync(path.join(root,'gift-sections.js'),'utf8'));
const MP4=Buffer.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
const mp4=()=>new File([MP4],'entry.mp4',{type:'video/mp4'}),audio=()=>new File(['ID3original soundtrack'],'track.mp3',{type:'audio/mpeg'});
const actor='11111111-1111-1111-1111-111111111111';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
(async()=>{
 const mod=await import(mediaURL);let groups=0;
 const signatures={png:[137,80,78,71],jpg:[255,216,255],jpeg:[255,216,255],webp:Buffer.from('RIFF0000WEBP'),gif:Buffer.from('GIF89a'),mp4:MP4,mp3:Buffer.from('ID3'),m4a:MP4,aac:[255,241],ogg:Buffer.from('OggS'),wav:Buffer.from('RIFF0000WAVE')};
 const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',wav:'audio/wav'};
 for(const [ext,bytes]of Object.entries(signatures))assert.equal((await mod.validatePropMedia(new File([Buffer.from(bytes)],'file.'+ext,{type:types[ext]}),types[ext].startsWith('audio')?'sound':'artwork')).contentType,types[ext]);groups++;
 for(const file of [new File(['<svg/>'],'a.svg',{type:'image/svg+xml'}),new File(['<html>'],'a.mp4',{type:'video/mp4'}),new File([MP4],'a.mp4',{type:'image/png'}),new File([],'a.mp4',{type:'video/mp4'}),{name:'large.mp4',type:'video/mp4',size:51*1024*1024}])await assert.rejects(mod.validatePropMedia(file,'artwork'));await assert.rejects(mod.validatePropMedia(mp4(),'sound'));groups++;
 function client({deny=false,drift=false}={}){const uploads=[];let n=0;return{uploads,auth:{getUser:async()=>({data:{user:{id:drift&&n++?actor.replace(/^1/,'2'):actor}}})},storage:{from:bucket=>({upload:async(p,f,o)=>{uploads.push({bucket,path:p,file:f,options:o});return deny?{error:{message:'Storage denied'}}:{data:{path:p}};},getPublicUrl:p=>({data:{publicUrl:'https://example.supabase.co/storage/v1/object/public/'+bucket+'/'+p}})})}};}
 let c=client();const u=await mod.uploadPropMedia({client:c,file:mp4(),slot:'artwork',isCurrent:()=>true});assert.equal(c.uploads.length,1);assert.equal(c.uploads[0].options.upsert,false);assert(c.uploads[0].path.startsWith(actor+'/props/'));assert(u.url.endsWith('.mp4'));groups++;
 for(const options of [{deny:true},{drift:true}]){c=client(options);await assert.rejects(mod.uploadPropMedia({client:c,file:mp4(),slot:'artwork',isCurrent:()=>true}));}c=client();await assert.rejects(mod.uploadPropMedia({client:c,file:mp4(),slot:'artwork',isCurrent:()=>false}));assert.equal(c.uploads.length,0);groups++;
 async function editor(kind,{deny=false,propKind='entry',nullPrice=false}={}){
  const dom=new JSDOM('<div id="root"></div>');dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  const holder=dom.window.document.getElementById('root'),calls=[],toasts=[],c=client({deny}),saveGate=deferred();let holdSave=false,current=true;
  const item=kind==='prop'?{code:'entry167_14',name:'Crystal Dragon',kind:propKind,tier:'standard',visual:{original:true},asset_url:'https://old.example/old.mp4',sound_url:'https://old.example/old.mp3',sound_key:'',price_exact:'0',duration_days:30,sort_order:16714,purchasable:false,active:true,revision:'r1'}:{id:'gift-id',slug:'old-gift',name:'Old gift',category:'standard',asset_key:'old-key',effect_kind:'standard',effect_asset_url:'https://old.example/old.mp4',sound_url:'https://old.example/old.mp3',coin_price:50,diamond_value:50,effect_duration_ms:5000,combo_quantities:[1,10],custom_combo_max:99,sort_order:4,min_vip_level:0,active:true,featured:false,allow_custom_combo:true,policy_version:3};
  if(nullPrice)Object.assign(item,{price_exact:null,price_coins:null});
  const rpc=async(name,args)=>{calls.push({name,args});if(name==='owner_load_props_v169')return{items:[item],sets:[]};if(holdSave)await saveGate.promise;return item;};
  const chain={select(){return this},order(){return this},range(){return Promise.resolve({data:[item]})}};c.from=()=>chain;
  let source=fs.readFileSync(path.join(root,kind==='prop'?'props-control.js':'gift-control.js'),'utf8').replace('./props-media-upload.js?v=20261027',mediaURL).replace('./gift-sections.js?v=20261028',sectionsURL);
  const module=await import(dataURL(source));
  await module[kind==='prop'?'showPropsControl':'showGiftControl']({root:holder,client:c,rpc,isCurrent:()=>current,toast:(...args)=>toasts.push(args)});
  holder.querySelector(kind==='prop'?'[data-edit-item]':'[data-edit]').click();const form=holder.querySelector(kind==='prop'?'#itemForm':'#giftForm');
  if(kind==='prop')form.elements.reason.value='Owner requested watermark removal';
  function choose(slot,file){const input=form.elements.namedItem(slot+'_file');Object.defineProperty(input,'files',{value:[file],configurable:true});input.dispatchEvent(new dom.window.Event('change'));}
  return{dom,holder,form,calls,c,toasts,item,choose,stop:()=>current=false,hold:()=>holdSave=true,release:()=>saveGate.resolve()};
 }
 for(const kind of ['prop','gift']){
  let e=await editor(kind);e.choose('artwork',mp4());assert.equal(e.form.elements.video_embedded_sound.checked,true);assert.equal(e.c.uploads.length,0);await e.form.onsubmit({preventDefault(){}});assert.equal(e.c.uploads.length,1);const save=e.calls.find(x=>x.name.startsWith('owner_save'));const payload=save.args[kind==='prop'?'p_item':'p_values'];assert(payload[kind==='prop'?'asset_url':'effect_asset_url'].includes('/owner-catalog/'));assert.equal(payload.sound_url,null);if(kind==='gift')assert.equal(payload.effect_kind,'video','embedded video audio requires video effect kind');assert.equal(kind==='prop'?payload.code:payload.id,kind==='prop'?e.item.code:e.item.id);assert.equal(payload.price_coins??payload.coin_price,kind==='prop'?0:50);groups++;
  e=await editor(kind);e.choose('artwork',mp4());e.choose('sound',audio());assert.equal(e.form.elements.video_embedded_sound.checked,false);await e.form.onsubmit({preventDefault(){}});assert.equal(e.c.uploads.length,2);const p=e.calls.find(x=>x.name.startsWith('owner_save')).args[kind==='prop'?'p_item':'p_values'];assert(p.sound_url.includes('/owner-catalog-audio/'));groups++;
  e=await editor(kind,{deny:true});e.choose('artwork',mp4());await e.form.onsubmit({preventDefault(){}});assert.equal(e.calls.filter(x=>x.name.startsWith('owner_save')).length,0);assert.equal(e.form.elements.namedItem(kind==='prop'?'asset_url':'effect_asset_url').value,'https://old.example/old.mp4');assert.equal(e.form.querySelector('[type="submit"]')?.disabled??e.form.querySelector('button').disabled,false);groups++;
  e=await editor(kind);e.choose('artwork',mp4());e.choose('sound',new File(['invalid'],'bad.mp3',{type:'audio/mpeg'}));await e.form.onsubmit({preventDefault(){}});assert.equal(e.c.uploads.length,0,'validate every selected file before any upload');assert.equal(e.calls.filter(x=>x.name.startsWith('owner_save')).length,0);groups++;
  e=await editor(kind);e.hold();e.choose('artwork',mp4());const pending=e.form.onsubmit({preventDefault(){}});await e.form.onsubmit({preventDefault(){}});for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));assert.equal(e.c.uploads.length,1);assert.equal(e.calls.filter(x=>x.name.startsWith('owner_save')).length,1);e.release();await pending;groups++;
  e=await editor(kind);e.choose('sound',audio());await e.form.onsubmit({preventDefault(){}});const soundOnly=e.calls.find(x=>x.name.startsWith('owner_save')).args[kind==='prop'?'p_item':'p_values'];assert.equal(soundOnly[kind==='prop'?'asset_url':'effect_asset_url'],'https://old.example/old.mp4');assert(soundOnly.sound_url.includes('/owner-catalog-audio/'));groups++;
 }
 for(const propKind of ['frame','room_frame','emoji_pack']){
  const image=()=>new File([Buffer.from('GIF89a original art')],'art.gif',{type:'image/gif'});
  let e=await editor('prop',{propKind});e.choose('artwork',image());await e.form.onsubmit({preventDefault(){}});let call=e.calls.find(x=>x.name==='owner_save_prop_v169');assert.equal(call.args.p_item.kind,propKind);assert.equal(call.args.p_revision,'r1');assert(call.args.p_item.asset_url.endsWith('.gif'));assert.equal(call.args.p_item.sound_url,'https://old.example/old.mp3');groups++;
  e=await editor('prop',{propKind});e.choose('artwork',image());e.choose('sound',audio());await e.form.onsubmit({preventDefault(){}});call=e.calls.find(x=>x.name==='owner_save_prop_v169');assert.equal(e.c.uploads.length,2);assert.equal(call.args.p_item.kind,propKind);assert(call.args.p_item.sound_url.endsWith('.mp3'));groups++;
  e=await editor('prop',{propKind});e.choose('artwork',mp4());await e.form.onsubmit({preventDefault(){}});assert.equal(e.c.uploads.length,0);assert(!e.calls.some(x=>x.name==='owner_save_prop_v169'));groups++;
  e=await editor('prop',{propKind});e.choose('sound',audio());await e.form.onsubmit({preventDefault(){}});call=e.calls.find(x=>x.name==='owner_save_prop_v169');assert.equal(call.args.p_item.asset_url,'https://old.example/old.mp4');assert.equal(call.args.p_item.kind,propKind);groups++;
 }
 let nullFrame=await editor('prop',{propKind:'frame',nullPrice:true});assert.equal(nullFrame.form.elements.price_coins.value,'0');nullFrame.choose('artwork',new File(['GIF89a original'],'frame.gif',{type:'image/gif'}));await nullFrame.form.onsubmit({preventDefault(){}});const nullFrameSave=nullFrame.calls.find(x=>x.name==='owner_save_prop_v169').args.p_item;assert.equal(nullFrameSave.price_coins,0);assert.equal(nullFrameSave.purchasable,false);groups++;
 console.log('PASS '+groups+' groups: signatures, limits, immutable actor paths, denial/account drift, both editors choose+Save, embedded sound, optional separate audio, sound-only, validation-before-upload, duplicate Save and preserved IDs/prices. Storage/native APIs mocked; real E2E remains separate.');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
