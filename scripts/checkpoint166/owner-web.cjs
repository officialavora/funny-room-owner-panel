const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),parser=require('@babel/parser');let checks=0;const check=(x,m)=>{assert.ok(x,m);checks++;};
let source=fs.readFileSync(require('node:path').join(process.env.OWNER_PANEL_AUDIT_ROOT||require('node:path').join(__dirname,'../..'),'app.js'),'utf8');parser.parse(source,{sourceType:'module'});checks++;
source=source.split('\n').slice(2).join('\n');const nodes=new Map();const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',disabled:false,style:{},classList:{add(){},remove(){},toggle(){}},close(){this.closed=true},showModal(){this.closed=false}});return nodes.get(s);};let fields=[],calls=[],overviewResolve;const mock={rpc:async(name,args)=>{calls.push({name,args});if(name==='staff_dashboard_counts')return new Promise(r=>overviewResolve=r);return {data:[],error:null}},auth:{getSession:()=>new Promise(()=>{}),onAuthStateChange(){},signOut:async()=>({})}};const ctx=vm.createContext({supabase:mock,document:{querySelector:node,querySelectorAll:s=>s==='[data-field]'?fields:[]},setTimeout:()=>1,console,crypto:{randomUUID:()=> 'mock'},fetch:()=>{throw Error('No network allowed')},location:{origin:'https://example.test',pathname:'/'}});vm.runInContext(source,ctx);
(async()=>{const get=e=>vm.runInContext(e,ctx);check(get("exactInteger('-12','Amount')")===-12,'signed input');for(const v of ['1e3','1.5','9007199254740993','']){assert.throws(()=>get('exactInteger('+JSON.stringify(v)+',"Amount")'));checks++;}check(get("fmt('9007199254740993')").replace(/\D/g,'')==='9007199254740993','exact display');check(get('fmt(null)')==='—','unknown not zero');
const older=get("go('overview')");await get("go('rooms')");const current=node('#content').innerHTML;overviewResolve({data:{users:123},error:null});await older;check(node('#content').innerHTML===current,'old page cannot replace current page');
const stale=get("go('overview')");get('showLogin()');overviewResolve({data:{users:123},error:null});await stale;check(node('#content').innerHTML==='','logout clears and fences stale data');
await get("go('rooms')");fields=[['p_public_id','1000','number'],['p_asset','coins','select'],['p_amount','1e3','number'],['p_note','audit','text']].map(([field,value,type])=>({dataset:{field},value,type}));get("openAction('walletAdjust')");const before=calls.length;await node('#dialogSubmit').onclick();check(calls.length===before,'invalid wallet numeric input makes no RPC');fields[2].value='-25';await Promise.all([node('#dialogSubmit').onclick(),node('#dialogSubmit').onclick()]);check(calls.filter(c=>c.name==='owner_adjust_wallet_asset').length===1,'double wallet submit sends one RPC');check(calls.find(c=>c.name==='owner_adjust_wallet_asset').args.p_amount===-25,'signed wallet preserved');
const originalPages=['gifts','props','overview','hierarchy','users','rooms','organizations','moderation','finance','commerce','premium','recovery','audit','settings'];
function finitePages(candidate){
 const ast=parser.parse(candidate,{sourceType:'module'});let definition;
 function visit(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id?.name==='PAGES')definition=n.init;for(const value of Object.values(n)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value)}}visit(ast);
 assert.ok(definition?.type==='ObjectExpression','PAGES definition exists');
 const routes=new Map(definition.properties.map(p=>[p.key.name,p.value]));
 assert.deepEqual([...routes.keys()].sort(),[...originalPages,'contact','roomRewardAppearance'].sort(),'exact original14 plus two approved Owner modules');
 for(const name of originalPages){const handler=routes.get(name);assert.ok(handler.async&&handler.params.length===1&&handler.params[0].name==='token',name+' preserves navigation token');}
 for(const [name,module,renderer] of [['contact','./official-contact.js','showOfficialContact'],['roomRewardAppearance','./room-reward-appearance.js','showRoomRewardAppearance']]){
  const handler=routes.get(name),body=candidate.slice(handler.body.start,handler.body.end);
  assert.ok(handler.async&&handler.params.length===1&&handler.params[0].name==='token',name+' token');
  assert.ok(body.includes("if(!authority.is_founder&&access.role!=='co_owner')throw Error('Owner access required')"),name+' explicit authority guard');
  const imported=body.indexOf("await import('"+module+"')"),fenced=body.indexOf('if(token!==navigationRevision)return'),shown=body.indexOf('await '+renderer+'(');
  assert.ok(imported>=0&&fenced>imported&&shown>fenced,name+' import completion fenced before render');
  assert.ok(body.includes('isCurrent:()=>token===navigationRevision'),name+' child lifecycle fence');
 }
 assert.equal((candidate.match(/:async\(token\)=>/g)||[]).length,16,'all 16 exact pages use navigation revision');
}
finitePages(source);checks++;
for(const [before,after] of [["contact:async(token)","missingContact:async(token)"],["gifts:async(token)","removedGift:async(token)"],["if(token!==navigationRevision)return;await showRoomRewardAppearance","await showRoomRewardAppearance"],["isCurrent:()=>token===navigationRevision","isCurrent:()=>true"]]){assert.ok(source.includes(before));assert.throws(()=>finitePages(source.replace(before,after)));checks++;}
console.log(JSON.stringify({checks,result:'PASS',scope:'Mocked approved-host Owner web source only; no publish or live operations'},null,2));})().catch(e=>{console.error(e);process.exitCode=1});



