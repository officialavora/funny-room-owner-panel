const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=__dirname,html=fs.readFileSync(path.join(root,'index.html'),'utf8'),code=fs.readFileSync(path.join(root,'app.js'),'utf8');
const url='https://officialavora.github.io/funny-room-owner-panel/download/';
assert.ok(html.includes('<html lang="en">'));assert.ok(!/[\u0900-\u097f]/.test(html));
assert.ok(html.includes('strict-origin-when-cross-origin'));
assert.deepEqual([...new Set(html.match(/[\w.+-]+@[\w.-]+\.[a-z]+/g))],['officialavora7@gmail.com']);
assert.ok(html.includes('https://play.google.com/store/apps/details?id=com.funnyroomdev.funnyroom'));
assert.match(html,/<button[^>]*class="ios-pending"[^>]*disabled/);assert.ok(!/apps\.apple\.com|testflight|\.apk(?:["?])/i.test(html));
for(const m of html.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)){if(m[1]==='./')continue;assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);assert.ok(!m[1].includes('..'));}
assert.ok(!/supabase|preview-full-controls|owner-login|iframe|\.\/\.\./i.test(html+code));
const elements=()=>{const result={};for(const key of ['share-button','share-status','copy-fallback','share-url'])result[key]={hidden:true,disabled:false,textContent:'',focus(){this.focused=true},select(){this.selected=true},addEventListener(type,fn){this.click=fn}};return result};
(async()=>{
 for(const mode of ['native','cancel','clipboard','manual','native-failed']){
  const e=elements(),shared=[],copied=[];const navigator={};if(['native','cancel','native-failed'].includes(mode))navigator.share=async x=>{shared.push(x);if(mode==='cancel')throw {name:'AbortError'};if(mode==='native-failed')throw Error('unavailable')};if(['clipboard','native-failed','cancel'].includes(mode))navigator.clipboard={writeText:async x=>copied.push(x)};
  vm.runInNewContext(code,{document:{getElementById:id=>e[id]},navigator});assert.equal(e['share-button'].hidden,false);await e['share-button'].click();assert.equal(e['share-button'].disabled,false);
  if(mode==='native')assert.equal(shared[0].url,url);if(mode==='cancel')assert.equal(copied.length,0);if(['clipboard','native-failed'].includes(mode))assert.deepEqual(copied,[url]);if(mode==='manual'){assert.equal(e['copy-fallback'].hidden,false);assert.equal(e['share-url'].selected,true)}
 }
 vm.runInNewContext(code,{document:{getElementById:()=>null},navigator:{}});
 console.log('Download source/link/isolation and 6 share lifecycle cases PASS. No hosted/browser/device assertion.');
})().catch(e=>{console.error(e);process.exitCode=1});
