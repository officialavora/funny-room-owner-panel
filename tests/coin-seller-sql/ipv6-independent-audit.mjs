import {PGlite} from '@electric-sql/pglite';
import {validateCatalog} from '../../coin-seller-catalog.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const pg=new PGlite();
const seed=JSON.parse(fs.readFileSync(new URL('./fixtures/synthetic-seed.json',import.meta.url)));
const hosts=new Set(['::','::1','::ffff:192.0.2.1','2001:db8::192.0.2.1']);
for(let i=0;i<32;i++){
 const words=Array.from({length:8},(_,k)=>((i*7919+k*6553)%65536).toString(16));
 hosts.add(words.join(':'));
 for(let j=0;j<8;j++)hosts.add(words.slice(0,j).join(':')+'::'+words.slice(j+1).join(':'));
}
const mutations=['','%25eth0','%eth0','/128',' ','%2e',':',':ffff',']','@example.invalid'];
const urls=new Set();
for(const h of hosts)for(const m of mutations)for(const p of ['',':443',':65536'])urls.add('https://['+h+m+']'+p+'/audit');
const receipt={scope:'Deterministic bracketed IPv6 differential audit; synthetic ephemeral PG17 WASM only',cases:urls.size,accepted:0,rejected:0,mismatches:[],raw_destination_unchanged:true,native_reset_34:'NOT RUN',production_connections:0};
try{
 await pg.exec('create schema coin_seller_api_v1');
 await pg.exec(fs.readFileSync(new URL('../../backend/review/coin-seller-catalog-validator.DRAFT.sql',import.meta.url),'utf8'));
 for(const url of urls){
  const c=structuredClone(seed);c.channels[1].paymentUrl=url;const before=JSON.stringify(c);
  let client=true,sql=true;
  try{validateCatalog(c);}catch{client=false;}
  try{await pg.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(c)]);}catch{sql=false;}
  assert.equal(JSON.stringify(c),before,'Validator must not rewrite raw destinations');
  receipt[client?'accepted':'rejected']++;
  if(client!==sql)receipt.mismatches.push({url,client,sql});
 }
 fs.writeFileSync(new URL('./ipv6-independent-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt));
 assert.equal(receipt.mismatches.length,0);
}finally{await pg.close();}
