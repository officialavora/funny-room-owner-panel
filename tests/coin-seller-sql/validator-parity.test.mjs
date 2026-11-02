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
 '../../backend/review/coin-seller-catalog-validator.DRAFT.sql':'86e1357b14853959595760c71878602ebe0744e8c652a8727eaf62b6a3a793ca'
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
const pg = new PGlite(); // ephemeral in-process engine; no URL, socket or persisted data directory
const receipt={package:'@electric-sql/pglite@0.3.16',source_pins:pins,engine:null,preimage_counterexamples:[],cases:[],mismatches:[],native_reset_34_cases:'NOT RUN',production_connections:0,jwt_rls_concurrency:'NOT RUN'};
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
 await pg.exec(read('../../backend/review/coin-seller-catalog-validator.DRAFT.sql'));
 for(const {name,c,client} of cases){
  let sql='accept',sqlstate=null;
  try{await pg.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(c)]);}catch(e){sql='reject';sqlstate=e.code??'unknown';}
  const row={name,client,sql,sqlstate,match:client===sql};receipt.cases.push(row);
  if(!row.match)receipt.mismatches.push(row);
 }
 receipt.case_count=receipt.cases.length;
 receipt.result=receipt.mismatches.length?'FAIL':'PASS';
 fs.writeFileSync(new URL('./text-runtime-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({engine:receipt.engine,cases:receipt.case_count,result:receipt.result,mismatches:receipt.mismatches,preimage_counterexamples:receipt.preimage_counterexamples,native_reset_34_cases:'NOT RUN'}));
 assert.equal(receipt.mismatches.length,0,'Client/SQL acceptance mismatch; receipt retained');
} finally {await pg.close();}
