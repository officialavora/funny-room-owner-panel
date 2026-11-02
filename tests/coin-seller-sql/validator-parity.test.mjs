import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {validateCatalog} from '../../coin-seller-catalog.mjs';
const read = n => fs.readFileSync(new URL(n, import.meta.url),'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const pins = {
 '../../coin-seller-catalog.mjs':'e34e21c35d63973df4af3a273f8f775cf98781927e2f6717854a5640a2090d37',
 'fixtures/validator.after.sql':'309263e586d03a7fa4723e47cfb8e71ecb1fcc1493e5e939d34eb044d2185e30',
 'fixtures/validator.pre-port.sql':'2fb090281512d18906c7f7c7b4b65d01a58c7204847af09a3cfb28209a70b64c',
 'fixtures/validator.pre-url-grammar.sql':'86e1357b14853959595760c71878602ebe0744e8c652a8727eaf62b6a3a793ca',
 'fixtures/validator.pre-host-guards.sql':'afdf9f798330e75bddfb3a9e09094cbaa35b6895b97e5833f50e1226d1abf8e2',
 'fixtures/validator.pre-ipv4-guard.sql':'60158b677125074ef4f2d6afe87e05ed97e1f675673d95c5565a79b606d7d46b',
 'fixtures/validator.pre-ipv4-dot.sql':'3e8370bba75074e9b2320b171126394b67be116bbd2cd86d08a35ead6fdef55e',
 '../../backend/review/coin-seller-catalog-validator.DRAFT.sql':'2d4788a2e7bcbcecf229448742e926ba8c646de285873bc64d5323cd58645f66'
};
for(const [n,h] of Object.entries(pins)) assert.equal(hash(read(n)),h,n);
const seed = JSON.parse(read('fixtures/synthetic-seed.json'));
const country = seed.countries[0].code;
const fresh = () => {const c=structuredClone(seed);c.countryOverrides[country]={note:'Synthetic note'};return c;};
const set = (c,path,value) => {let p=c;for(const k of path.slice(0,-1))p=p[k];p[path.at(-1)]=value;};
const cases = [];
const add = (name,change) => {const c=fresh();change(c);let client='accept';try{validateCatalog(c);}catch{client='reject';}cases.push({name,c,client});};
add('valid catalogue',()=>{});
const inventory=JSON.parse(read('fixtures/CLIENT-TYPE-INVENTORY.json'));
assert.equal(inventory.strict_rows.length,36);
for(const r of inventory.strict_rows){
 const values={number:['1',null,false,[],{}],string:[123,null,false,[],{}],boolean:[1,'true',null,[],{}],array:[1,'[]',null,false,{}],object:[1,'{}',null,false,[]],'enum-string':[1,null,false,[],{}]}[r.type];
 for(const [i,v] of values.entries())add('type:'+r.path.join('.')+':'+i,c=>set(c,r.path,v));
}
for(const v of [0,1,2147483646,2147483647,2147483648,9999999999,1.5,'1',null,true])add('version:'+JSON.stringify(v),c=>{c.version=v;});
const a=seed.countries[0].code,b=seed.countries[1].code;
for(const [name,codes] of [['empty',[]],['single',[a]],['distinct',[a,b]],['adjacent',[a,a]],['nonadjacent',[a,b,a]],['allrepeat',[a,a,a]],['unknown',['ZZ']],['null',[null]]])add('eligibility:'+name,c=>{c.allowedCountries=codes;});
for(const [path,v] of [[['packages',0,'id'],123],[['channels',0,'railId'],123],[['channels',0,'assetUnitsPerUsd'],1]])add('coercive:'+path.join('.'),c=>set(c,path,v));
add('coercive:regional',c=>{c.countryOverrides[country]={currency:'USD',localAmount:2,coins:3,note:''};});

const textRows=[
 [['supportEmail'],200],
 ...Object.entries({provider:100,label:200,asset:200,network:200,address:200,recipient:200,memo:200,paymentUrl:1500,instructions:800}).map(([k,max])=>[['channels',1,k],max]),
 [['countries',0,'name'],100],[['rules',0,'title'],100],[['rules',0,'text'],1500],[['countryOverrides',country,'note'],500]
];
assert.equal(textRows.length,14);
for(const [path,max] of textRows){
 const values=['',' ','\u00a0','\ufeff','\n','a\nb','\u007f','\u200b','😀'.repeat(Math.floor(max/2)),'😀'.repeat(Math.floor(max/2)+1),'x'.repeat(max),'x'.repeat(max+1)];
 for(const [i,value]of values.entries())add('text:'+path.join('.')+':'+i,c=>set(c,path,value));
}
const whitespace=[0x09,0x0a,0x0b,0x0c,0x0d,0x20,0xa0,0x1680,...Array.from({length:11},(_,i)=>0x2000+i),0x2028,0x2029,0x202f,0x205f,0x3000,0xfeff];
for(const code of whitespace){
 for(const path of [['supportEmail'],['countryOverrides',country,'note']])add('trim:'+path.join('.')+':'+code,c=>set(c,path,String.fromCodePoint(code)));
}
for(let code=0;code<32;code++)add('control:'+code,c=>{c.supportEmail='a'+String.fromCodePoint(code)+'b';});
add('optional:missing-note',c=>{delete c.countryOverrides[country].note;});
const prefix='https://example.invalid/';
for(const units of [1499,1500,1501])add('url-ascii-length:'+units,c=>{c.channels[1].paymentUrl=prefix+'x'.repeat(units-prefix.length);});
for(const count of [738,739])add('url-emoji-length:'+count,c=>{c.channels[1].paymentUrl=prefix+'😀'.repeat(count);});

assert.equal(cases.length,459,'Finite corpus must remain complete');
const ports=['0','1','80','443','65534','65535','65536','65537','99999','2147483647','00000','00080','00065535','00065536','9'.repeat(64),'9'.repeat(512)];
for(const [i,port] of ports.entries())add('url-port:'+i,c=>{c.channels[1].paymentUrl='https://example.invalid:'+port+'/';});
assert.equal(cases.length,475,'Retain 459 cases plus 16 port boundaries');
// Bounded additive syntax only: original 475 cases remain above unchanged.
// Legacy parser residuals below are explicit known mismatches, never counted as parity passes.
const urlGrammarImproved = ["https://example.invalid:/", "HTTPS://example.invalid/", "https://example.invalid:443?x=y", "https://example.invalid:?x=y", "https://example.invalid:443#x", "https://example.invalid:#x", "https://example.invalid:65535?x=y", "https://example.invalid:65535#x", "https://example.invalid:00065535?x=y", "https://example.invalid:00065535#x", "HTTPS://example.invalid?x=y", "HTTPS://example.invalid#x", "HTTPS://example.invalid:/", "HTTPS://example.invalid:?x=y", "HTTPS://example.invalid:#x", "HTTPS://example.invalid:443/", "HTTPS://example.invalid:443?x=y", "HTTPS://example.invalid:443#x", "HTTPS://example.invalid:65535/", "HTTPS://example.invalid:65535?x=y", "HTTPS://example.invalid:65535#x", "HTTPS://example.invalid:00065535/", "HTTPS://example.invalid:00065535?x=y", "HTTPS://example.invalid:00065535#x", "hTtPs://example.invalid/", "hTtPs://example.invalid?x=y", "hTtPs://example.invalid#x", "hTtPs://example.invalid:/", "hTtPs://example.invalid:?x=y", "hTtPs://example.invalid:#x", "hTtPs://example.invalid:443/", "hTtPs://example.invalid:443?x=y", "hTtPs://example.invalid:443#x", "hTtPs://example.invalid:65535/", "hTtPs://example.invalid:65535?x=y", "hTtPs://example.invalid:65535#x", "hTtPs://example.invalid:00065535/", "hTtPs://example.invalid:00065535?x=y", "hTtPs://example.invalid:00065535#x", "https://example.invalid?next=https://a.invalid:99999/"];
const urlGrammarGuards = ["https://user:pass@example.invalid/", "https://user@example.invalid/", "https://example.invalid/\n", "https://example.invalid:65536?x=y", "https://[::1]:65536/", "HTTPS://exa%mple.invalid/", "HTTPS://[broken]/", "HTTPS://example.123:443?x=y", "HTTPS://example.0x12:443?x=y", "HTTPS://example.08:443?x=y", "HTTPS://example.invalid:00065536#x", "https://example.invalid:99999#x"];
const knownUrlResiduals = [{"url": "https://[::1]:443/", "client": "accept", "sql": "reject"}, {"url": "https://exa%mple.invalid/", "client": "reject", "sql": "accept"}, {"url": "https://[broken]/", "client": "reject", "sql": "accept"}, {"url": "https://999.999.999.999/", "client": "reject", "sql": "accept"}, {"url": "https://example.invalid/space here", "client": "accept", "sql": "reject"}, {"url": "https://example.invalid/\u0085", "client": "accept", "sql": "reject"}, {"url": "https://example.invalid:443\\path", "client": "accept", "sql": "reject"}];
assert.equal(urlGrammarImproved.length,40);
assert.equal(urlGrammarGuards.length,12);
assert.equal(knownUrlResiduals.length,7);
for(const [i,url] of urlGrammarImproved.entries())add('url-grammar-improved:'+i,c=>{c.channels[1].paymentUrl=url;});
for(const [i,url] of urlGrammarGuards.entries())add('url-grammar-guard:'+i,c=>{c.channels[1].paymentUrl=url;});
assert.ok(cases.slice(-12).every(row=>row.client==='reject'),'All URL guards must remain client rejections');
assert.equal(cases.length,527,'Retain 475 and add 40 syntax improvements plus 12 rejection guards');
const fixedHostResiduals=knownUrlResiduals.filter(x=>['https://exa%mple.invalid/','https://[broken]/'].includes(x.url));
const unresolvedUrlResiduals=knownUrlResiduals.filter(x=>!fixedHostResiduals.includes(x));
assert.equal(fixedHostResiduals.length,2);assert.equal(unresolvedUrlResiduals.length,5);
const hostGuardCases=[
 ...fixedHostResiduals.map(x=>[x.url,'reject']),
 ['https://foo%/','reject'],['https://foo%0/','reject'],['https://foo%gg/','reject'],
 ['https://foo[bar].invalid/','reject'],['https://foo]bar.invalid/','reject'],
 ['https://%65xample.invalid/','accept'],['https://example.invalid/path%zz','accept'],
 ['https://example.invalid/?next=%zz','accept'],['https://example.invalid/#%zz','accept'],
 ['https://example.invalid/path[brackets]','accept'],
 ['https://example.invalid\\path%zz','accept'],['https://example.invalid\\[brackets]','accept']
];
assert.equal(hostGuardCases.length,14);
for(const [i,[url,expected]]of hostGuardCases.entries()){
 add('url-host-guard:'+i,c=>{c.channels[1].paymentUrl=url;});
 assert.equal(cases.at(-1).client,expected,'Explicit host/path client expectation');
}
assert.equal(cases.length,541,'Retain 527 plus 14 bounded host/path checks');
// Keep the original541 generation unchanged. Bounded four-part decimalIPv4 only;
// legacy/octal/hex/encoded forms are deliberately not reinterpreted by this guard.
const ipv4Cases = [{"url": "https://999.999.999.999/", "client": "reject"}, {"url": "https://256.1.2.3/", "client": "reject"}, {"url": "https://1.256.2.3/", "client": "reject"}, {"url": "https://1.2.256.3/", "client": "reject"}, {"url": "https://1.2.3.256/", "client": "reject"}, {"url": "https://0.0.0.0/", "client": "accept"}, {"url": "https://255.255.255.255/", "client": "accept"}, {"url": "https://1.2.3.4/", "client": "accept"}, {"url": "https://0377.0.0.1/", "client": "accept"}, {"url": "https://0x7f.0.0.1/", "client": "accept"}, {"url": "https://127.1/", "client": "accept"}, {"url": "https://2130706433/", "client": "accept"}, {"url": "https://01.2.3.4/", "client": "accept"}, {"url": "https://1.2.3.999.example/", "client": "accept"}, {"url": "https://example.invalid/", "client": "accept"}, {"url": "https://999.999.999.999%2eexample/", "client": "accept"}, {"url": "https://999.999.999.999:443/?x=y", "client": "reject"}, {"url": "https://999.999.999.999?x=y", "client": "reject"}, {"url": "https://example.invalid/?u=999.999.999.999", "client": "accept"}, {"url": "https://example.invalid/#999.999.999.999", "client": "accept"}, {"url": "https://example.invalid/999.999.999.999", "client": "accept"}, {"url": "https://example.invalid\\999.999.999.999", "client": "accept"}, {"url": "https://user@999.999.999.999/", "client": "reject"}, {"url": "https://99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999.1.2.3/", "client": "reject"}];
const ipv4PreimageUrls = ["https://999.999.999.999/", "https://256.1.2.3/", "https://1.256.2.3/", "https://1.2.256.3/", "https://1.2.3.256/", "https://999.999.999.999:443/?x=y", "https://999.999.999.999?x=y", "https://99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999.1.2.3/"];
assert.equal(ipv4Cases.length,24);assert.equal(ipv4PreimageUrls.length,8);
for(const [i,{url,client}] of ipv4Cases.entries()){
 add('url-ipv4-guard:'+i,c=>{c.channels[1].paymentUrl=url;});
 assert.equal(cases.at(-1).client,client,'Explicit IPv4/path client expectation');
}
assert.equal(cases.length,565,'Retain541 plus24 bounded IPv4/path comparisons');
const ipv4KnownResiduals=unresolvedUrlResiduals.filter(r=>r.url!=='https://999.999.999.999/');
assert.equal(ipv4KnownResiduals.length,4,'Four prior URL residuals remain unresolved');
ipv4KnownResiduals.push({url:'https://1.2.3.999./',client:'reject',sql:'accept'});
// Optional single terminal dot only. Double/encoded dots remain outside this guard.
const ipv4DotCases = [{"url": "https://1.2.3.999./", "client": "reject"}, {"url": "https://999.999.999.999./", "client": "reject"}, {"url": "https://256.1.2.3./", "client": "reject"}, {"url": "https://1.256.2.3./", "client": "reject"}, {"url": "https://1.2.256.3./", "client": "reject"}, {"url": "https://0.0.0.0./", "client": "accept"}, {"url": "https://255.255.255.255./", "client": "accept"}, {"url": "https://1.2.3.4./", "client": "accept"}, {"url": "https://1.2.3.4/", "client": "accept"}, {"url": "https://0377.0.0.1./", "client": "accept"}, {"url": "https://0x7f.0.0.1./", "client": "accept"}, {"url": "https://127.1./", "client": "accept"}, {"url": "https://2130706433./", "client": "accept"}, {"url": "https://01.2.3.4./", "client": "accept"}, {"url": "https://1.2.3.999../", "client": "accept"}, {"url": "https://1.2.3.999.example./", "client": "accept"}, {"url": "https://1.2.3.999.:443/?x=y", "client": "reject"}, {"url": "https://1.2.3.999.:/?x=y", "client": "reject"}, {"url": "https://1.2.3.999.?x=y", "client": "reject"}, {"url": "https://1.2.3.999.#x", "client": "reject"}, {"url": "https://example.invalid/?u=1.2.3.999.", "client": "accept"}, {"url": "https://example.invalid/#1.2.3.999.", "client": "accept"}, {"url": "https://example.invalid/1.2.3.999.", "client": "accept"}, {"url": "https://example.invalid\\1.2.3.999.", "client": "accept"}, {"url": "https://user@1.2.3.999./", "client": "reject"}];
const ipv4DotPreimageUrls = ["https://1.2.3.999./", "https://999.999.999.999./", "https://256.1.2.3./", "https://1.256.2.3./", "https://1.2.256.3./", "https://1.2.3.999.:443/?x=y", "https://1.2.3.999.?x=y", "https://1.2.3.999.#x"];
assert.equal(ipv4DotCases.length,25);assert.equal(ipv4DotPreimageUrls.length,8);
for(const [i,{url,client}] of ipv4DotCases.entries()){
 add('url-ipv4-single-dot:'+i,c=>{c.channels[1].paymentUrl=url;});
 assert.equal(cases.at(-1).client,client,'Explicit single-dot IPv4/path client expectation');
}
assert.equal(cases.length,590,'Retain565 plus25 single-dot IPv4/path comparisons');
const dotKnownResiduals=ipv4KnownResiduals.filter(r=>r.url!=='https://1.2.3.999./');
assert.equal(dotKnownResiduals.length,4,'Four prior URL residuals remain');
dotKnownResiduals.push({url:'https://1.2.3.999%2e/',client:'reject',sql:'accept'});
const pg = new PGlite(); // ephemeral in-process engine; no URL, socket or persisted data directory
const receipt={package:'@electric-sql/pglite@0.3.16',source_pins:pins,engine:null,preimage_counterexamples:[],url_grammar_preimage:[],known_url_residuals:[],cases:[],mismatches:[],native_reset_34_cases:'NOT RUN',production_connections:0,jwt_rls_concurrency:'NOT RUN'};
try{
 receipt.engine=(await pg.query('select version() as version')).rows[0].version;
 assert.match(receipt.engine,/^PostgreSQL 17\./,'Require PostgreSQL17 WASM engine');
 await pg.exec('create schema coin_seller_api_v1;');
 await pg.exec(read('fixtures/validator.after.sql'));
 for(const v of [2147483648,9999999999]){
  const c=fresh();c.version=v;await pg.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(c)]);
  assert.throws(()=>validateCatalog(c));receipt.preimage_counterexamples.push({version:v,sql:'accept',client:'reject'});
 }
 const duplicate=fresh();duplicate.allowedCountries=[a,a];
 await pg.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(duplicate)]);
 assert.throws(()=>validateCatalog(duplicate));receipt.preimage_counterexamples.push({case:'duplicate eligibility',sql:'accept',client:'reject'});
 await pg.exec('drop function coin_seller_api_v1.validate_coin_seller_catalog_v1(jsonb);');
 await pg.exec(read('fixtures/validator.pre-port.sql'));
 for(const port of ['65536','99999','00065536']){
  const c=fresh();c.channels[1].paymentUrl='https://example.invalid:'+port+'/';
  await pg.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(c)]);
  assert.throws(()=>validateCatalog(c));receipt.preimage_counterexamples.push({case:'URL port '+port,sql:'accept',client:'reject'});
 }
 await pg.exec('drop function coin_seller_api_v1.validate_coin_seller_catalog_v1(jsonb);');
 await pg.exec('drop function coin_seller_api_v1.client_catalog_text_valid_v1(text,integer,boolean);');
 await pg.exec(read('fixtures/validator.pre-url-grammar.sql'));
 for(const url of urlGrammarImproved){
  const c=fresh();c.channels[1].paymentUrl=url;validateCatalog(c);
  let rejected=false;try{await pg.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(c)]);}catch{rejected=true;}
  assert.equal(rejected,true,'Pinned preimage must reject newly admitted syntax');
  receipt.url_grammar_preimage.push({url,sql:'reject',client:'accept'});
 }
 await pg.exec('drop function coin_seller_api_v1.validate_coin_seller_catalog_v1(jsonb);');
 await pg.exec('drop function coin_seller_api_v1.client_catalog_text_valid_v1(text,integer,boolean);');
 await pg.exec(read('fixtures/validator.pre-host-guards.sql'));
 receipt.host_guard_preimage=[];
 for(const [url,expected]of hostGuardCases.filter(x=>x[1]==='reject')){
  const c=fresh();c.channels[1].paymentUrl=url;
  await pg.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(c)]);
  assert.throws(()=>validateCatalog(c));
  receipt.host_guard_preimage.push({url,client:expected,sql:'accept'});
 }
 await pg.exec('drop function coin_seller_api_v1.validate_coin_seller_catalog_v1(jsonb);');
 await pg.exec('drop function coin_seller_api_v1.client_catalog_text_valid_v1(text,integer,boolean);');
 await pg.exec(read('fixtures/validator.pre-ipv4-guard.sql'));
 receipt.ipv4_guard_preimage=[];
 for(const url of ipv4PreimageUrls){
  const c=fresh();c.channels[1].paymentUrl=url;assert.throws(()=>validateCatalog(c));
  await pg.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(c)]);
  receipt.ipv4_guard_preimage.push({url,client:'reject',sql:'accept'});
 }
 await pg.exec('drop function coin_seller_api_v1.validate_coin_seller_catalog_v1(jsonb);');
 await pg.exec('drop function coin_seller_api_v1.client_catalog_text_valid_v1(text,integer,boolean);');
 await pg.exec(read('fixtures/validator.pre-ipv4-dot.sql'));
 receipt.ipv4_dot_preimage=[];
 for(const url of ipv4DotPreimageUrls){
  const c=fresh();c.channels[1].paymentUrl=url;assert.throws(()=>validateCatalog(c));
  await pg.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(c)]);
  receipt.ipv4_dot_preimage.push({url,client:'reject',sql:'accept'});
 }
 await pg.exec('drop function coin_seller_api_v1.validate_coin_seller_catalog_v1(jsonb);');
 await pg.exec('drop function coin_seller_api_v1.client_catalog_text_valid_v1(text,integer,boolean);');
 await pg.exec(read('../../backend/review/coin-seller-catalog-validator.DRAFT.sql'));
 for(const {name,c,client} of cases){
  let sql='accept',sqlstate=null;
  try{await pg.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(c)]);}catch(e){sql='reject';sqlstate=e.code??'unknown';}
  const row={name,client,sql,sqlstate,match:client===sql};receipt.cases.push(row);
  if(!row.match)receipt.mismatches.push(row);
 }
 for(const expected of dotKnownResiduals){
  const c=fresh();c.channels[1].paymentUrl=expected.url;
  let client='accept',sql='accept';try{validateCatalog(c);}catch{client='reject';}
  try{await pg.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(c)]);}catch{sql='reject';}
  assert.equal(client,expected.client,'Known residual client expectation');
  assert.equal(sql,expected.sql,'Known residual SQL expectation');
  assert.notEqual(client,sql,'Residual must not be mislabeled parity success');
  receipt.known_url_residuals.push({...expected,status:'UNRESOLVED'});
 }
 receipt.full_whatwg_parity='NOT ESTABLISHED: 4 prior URL residuals plus explicitly documented encoded-dot IPv4 residual';
 receipt.case_count=receipt.cases.length;
 receipt.result=receipt.mismatches.length?'FAIL':'PASS';
 fs.writeFileSync(new URL('./text-runtime-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({engine:receipt.engine,cases:receipt.case_count,result:receipt.result,mismatches:receipt.mismatches,preimage_counterexamples:receipt.preimage_counterexamples,url_grammar_preimage_count:receipt.url_grammar_preimage.length,ipv4_guard_preimage_count:receipt.ipv4_guard_preimage.length,ipv4_dot_preimage_count:receipt.ipv4_dot_preimage.length,known_url_residuals:receipt.known_url_residuals,full_whatwg_parity:receipt.full_whatwg_parity,native_reset_34_cases:'NOT RUN'}));
 assert.equal(receipt.mismatches.length,0,'Client/SQL acceptance mismatch; receipt retained');
} finally {await pg.close();}
