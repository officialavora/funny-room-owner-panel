import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const [installerPath,clientPath,seedPath]=process.argv.slice(2);
assert.ok(installerPath&&clientPath&&seedPath,'Provide synthetic installer, pinned client and synthetic seed paths');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(installerPath,'utf8');
// Refuse stale fixture review when the current draft validator changes.
assert.equal(hash(fs.readFileSync(new URL('../../backend/review/coin-seller-catalog-validator.DRAFT.sql',import.meta.url))),'fd91e16bb254e420f7ff3d17e7e65567107c90f3f291cab0c1ca7a5f1c48e8e9','Exact reviewed IPv6 successor validator required');
assert.equal(hash(source),'031d1f8ff7dc513f8f5c89cd5d0874a2e66684e45dcee21806e5065ff756ed29','Only exact sanitized synthetic installer may execute');
assert.equal(hash(fs.readFileSync(clientPath)),'e34e21c35d63973df4af3a273f8f775cf98781927e2f6717854a5640a2090d37');
const {validateCatalog}=await import(pathToFileURL(path.resolve(clientPath)).href);
const seed=JSON.parse(fs.readFileSync(seedPath));validateCatalog(seed);
assert.equal(seed.version,1);assert.equal(seed.checkoutOpen,false);
const owner='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222';
const ownerSid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',memberSid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const db=new PGlite();const checks=[];
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);};
const one=async(q,args=[])=> (await db.query(q,args)).rows[0]?.value;
async function actor(uid,sid){await db.query("select set_config('fixture.actor',$1,false),set_config('fixture.session',$2,false)",[uid,sid]);}
async function rejects(q,args,code){let failure;try{await db.query(q,args);}catch(e){failure=e;}assert.ok(failure,'Expected SQL rejection '+code);assert.equal(failure.code,code,failure.message);}
const loadOwner=()=>one('select public.owner_load_coin_seller_catalog_v1() as value');
const save=(c,v,id,reason='Synthetic integration review')=>one('select public.owner_save_coin_seller_catalog_v1($1::jsonb,$2::integer,$3::uuid,$4::text) as value',[JSON.stringify(c),v,id,reason]);
const counts=()=>one("select jsonb_build_object('edits',(select count(*)::int from private.coin_seller_catalog_edits_v1),'audit',(select count(*)::int from public.audit_log),'quotes',(select count(*)::int from private.coin_seller_quotes_v1),'proofs',(select count(*)::int from private.coin_seller_proofs_v1),'deposits',(select count(*)::int from private.coin_seller_deposits_v1)) as value");
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create table auth.users(id uuid primary key);
 create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
 create table public.profiles(id uuid primary key,status text,country_code text);
 create table public.role_applications(id uuid default gen_random_uuid(),role_key text);
 create table public.audit_log(actor_id uuid,action text,target_type text,target_id text,metadata jsonb);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('fixture.actor',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select jsonb_build_object('session_id',nullif(current_setting('fixture.session',true),''))$$;
 create function private.is_founder(x uuid)returns boolean language sql stable as $$select x='${owner}'::uuid$$;
 create function public.apply_for_role(text,text,text,text)returns jsonb language plpgsql as $$begin raise exception 'Synthetic application prerequisite is deliberately not implemented';end$$;
 insert into auth.users values('${owner}'),('${member}');
 insert into public.profiles values('${owner}','active','SA'),('${member}','active','SA');
 insert into auth.sessions values('${ownerSid}','${owner}',now()+interval '1 day'),('${memberSid}','${member}',now()+interval '1 day');`);
 await actor(owner,ownerSid);
 await db.exec(source); // complete installer, only embedded catalogue seed sanitized
 const engine=await one('select version() as value');assert.match(engine,/PostgreSQL 17\./);
 check('complete integrated synthetic installer commits',await one("select to_regprocedure('public.owner_save_coin_seller_catalog_v1(jsonb,integer,uuid,text)') is not null as value"));
 assert.deepEqual(await loadOwner(),seed);check('Owner load exact synthetic seed',true);
 let publicDoc=await one('select public.load_coin_seller_catalog_v1() as value');
 check('public load excludes channel private destinations',publicDoc.catalogKind==='public'&&publicDoc.channels.every(c=>!['address','recipient','memo','paymentUrl'].some(k=>k in c)));
 check('all payment rails remain unadmitted',await one('select count(*)=0 as value from private.coin_seller_rails_v1 where admitted'));

 const suffixCases=[
  ['plain explicit port',String.raw`https://example.invalid:443\path`,true],
  ['uppercase explicit port',String.raw`HTTPS://example.invalid:443\path`,true],
  ['max port',String.raw`https://example.invalid:65535\path`,true],
  ['zero port',String.raw`https://example.invalid:0\path`,true],
  ['empty port',String.raw`https://example.invalid:\path`,true],
  ['oversized port',String.raw`https://example.invalid:65536\path`,false],
  ['credentials',String.raw`https://user@example.invalid:443\path`,false],
  ['invalid IPv4',String.raw`https://999.999.999.999:443\path`,false]
 ];
 for(const [name,url,want] of suffixCases){
  const sample=structuredClone(seed);sample.channels[1].paymentUrl=url;
  let clientAccept=true;try{validateCatalog(sample);}catch{clientAccept=false;}
  assert.equal(clientAccept,want,'explicit client expectation: '+name);
  let sqlAccept=true;try{await db.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(sample)]);}catch{sqlAccept=false;}
  check('installed successor backslash validation: '+name,sqlAccept===want);
 }
 const backslashDoc=structuredClone(seed);backslashDoc.channels[1].paymentUrl=String.raw`https://example.invalid:443\raw path`;
 validateCatalog(backslashDoc);
 await db.exec('set role authenticated');await db.exec('BEGIN');
 try{
  const got=await save(backslashDoc,1,'99999999-9999-4999-8999-999999999999','Synthetic backslash successor');
  assert.deepEqual(got,{...backslashDoc,version:2});assert.deepEqual(await loadOwner(),got);
  check('successor Owner save/load preserves raw backslash destination',got.channels[1].paymentUrl===backslashDoc.channels[1].paymentUrl);
 }finally{await db.exec('ROLLBACK');await db.exec('reset role');}
 assert.deepEqual(await loadOwner(),seed);assert.deepEqual(await counts(),{edits:0,audit:0,quotes:0,proofs:0,deposits:0});
 check('successor transaction rollback restores seed and all fixture counts',true);

 const ipv6InstalledCases=[
  ['compressed port','https://[2001:db8::1]:443/',true],
  ['uppercase empty port','HTTPS://[::1]:?x=y',true],
  ['IPv4 mapped','https://[::ffff:192.0.2.1]:65535/',true],
  ['backslash path',String.raw`https://[::1]:443\raw path`,true],
  ['zone identifier','https://[fe80::1%25eth0]/',false],
  ['credentials','https://user@[::1]/',false],
  ['oversized port','https://[::1]:65536/',false],
  ['malformed groups','https://[1::2::3]/',false]
 ];
 for(const [name,url,want]of ipv6InstalledCases){
  const sample=structuredClone(seed);sample.channels[1].paymentUrl=url;
  let client=true,sql=true;try{validateCatalog(sample);}catch{client=false;}
  try{await db.query('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(sample)]);}catch{sql=false;}
  assert.equal(client,want);check('installed IPv6 authority: '+name,sql===want);
 }
 const ipv6Doc=structuredClone(seed);ipv6Doc.channels[1].paymentUrl=String.raw`https://[2001:DB8::1]:000443\raw path?x=%zz`;
 validateCatalog(ipv6Doc);await db.exec('set role authenticated');await db.exec('BEGIN');
 try{
  const got=await save(ipv6Doc,1,'abababab-abab-4bab-8bab-abababababab','Synthetic IPv6 successor');
  assert.deepEqual(got,{...ipv6Doc,version:2});assert.deepEqual(await loadOwner(),got);
  check('installed Owner IPv6 save/load preserves raw destination',got.channels[1].paymentUrl===ipv6Doc.channels[1].paymentUrl);
 }finally{await db.exec('ROLLBACK');await db.exec('reset role');}
 assert.deepEqual(await loadOwner(),seed);assert.deepEqual(await counts(),{edits:0,audit:0,quotes:0,proofs:0,deposits:0});
 check('IPv6 transaction rollback restores catalogue/audit/financial rows',true);

 const c=structuredClone(seed);c.applicationOpen=false;c.rules[0].text='Synthetic integrated catalogue review';c.channels[1].paymentUrl='https://example.invalid/path space\u0085';validateCatalog(c);
 await db.exec('set role authenticated');
 const id='33333333-3333-4333-8333-333333333333';const after=await save(c,1,id);const expected={...c,version:2};assert.deepEqual(after,expected);
 check('authenticated Owner save invokes integrated validator/helper',true);
 assert.deepEqual(await loadOwner(),expected);check('exact Owner load/readback after save',true);
 assert.deepEqual(await save(c,1,id),expected);check('idempotent same-body replay returns same result',true);
 await rejects('select public.owner_save_coin_seller_catalog_v1($1::jsonb,1,$2::uuid,$3)',[JSON.stringify({...c,supportEmail:'different-fixture@example.invalid'}),id,'Synthetic integration review'],'P0001');check('same request changed body rejected',true);
 await rejects('select public.owner_save_coin_seller_catalog_v1($1::jsonb,1,$2::uuid,$3)',[JSON.stringify(c),'44444444-4444-4444-8444-444444444444','Synthetic stale revision'],'40001');check('stale revision rejected',true);
 const invalid={...expected,supportEmail:123};
 await rejects('select public.owner_save_coin_seller_catalog_v1($1::jsonb,2,$2::uuid,$3)',[JSON.stringify(invalid),'55555555-5555-4555-8555-555555555555','Synthetic invalid type'],'P0001');check('new type guard reached through real save wrapper',true);
 await rejects('select public.owner_save_coin_seller_catalog_v1($1::jsonb,2,$2::uuid,$3)',[JSON.stringify({...expected,checkoutOpen:true}),'66666666-6666-4666-8666-666666666666','Synthetic activation attempt'],'P0001');check('checkout activation remains a separate denied operation',true);
 await rejects("select coin_seller_api_v1.client_catalog_text_valid_v1('x',10,false)",[],'42501');check('new text helper direct execute denied to authenticated',true);
 await rejects('select coin_seller_api_v1.validate_coin_seller_catalog_v1($1::jsonb)',[JSON.stringify(c)],'42501');check('validator direct execute denied to authenticated',true);
 await rejects('select * from private.coin_seller_catalog_v1',[],'42501');check('private catalogue table read denied to authenticated',true);
 await db.exec('reset role');assert.deepEqual(await counts(),{edits:1,audit:1,quotes:0,proofs:0,deposits:0});check('rejections/replay do not create extra edit/audit/financial rows',true);
 await actor(member,memberSid);await db.exec('set role authenticated');
 await rejects('select public.owner_load_coin_seller_catalog_v1()',[],'42501');
 await rejects('select public.owner_save_coin_seller_catalog_v1($1::jsonb,2,$2::uuid,$3)',[JSON.stringify(expected),'77777777-7777-4777-8777-777777777777','Synthetic member denial'],'42501');check('member Owner load/save denied',true);
 publicDoc=await one('select public.load_coin_seller_catalog_v1() as value');check('member public read remains available with redacted channels',publicDoc.version===2&&publicDoc.channels.every(c=>!('address'in c)&&!('paymentUrl'in c)));
 await db.exec('reset role');await actor(owner,'');await rejects('select public.owner_load_coin_seller_catalog_v1()',[],'42501');check('missing session claim denied',true);
 await actor(owner,memberSid);await rejects('select public.owner_load_coin_seller_catalog_v1()',[],'42501');check('session actor mismatch denied',true);
 await db.query('update auth.sessions set not_after=now()-interval \'1 second\' where id=$1',[ownerSid]);await actor(owner,ownerSid);await rejects('select public.owner_load_coin_seller_catalog_v1()',[],'42501');check('expired synthetic session denied',true);
 await db.query('update auth.sessions set not_after=now()+interval \'1 day\' where id=$1',[ownerSid]);
 await rejects('select public.create_coin_seller_quote_v1($1::uuid,$2,$3,2)',['88888888-8888-4888-8888-888888888888',seed.packages[0].id,seed.channels[0].id],'P0001');check('closed checkout denies quote without credit or proof rows',true);
 await rejects("insert into public.role_applications(role_key)values('coin_seller')",[],'42501');check('closed applications enforced by actual installed trigger',true);
 await db.exec('set role anon');await rejects('select public.load_coin_seller_catalog_v1()',[],'42501');check('anon wrapper execute denied',true);await db.exec('reset role');
 check('helper revoke effective through PUBLIC inheritance',await one("select not has_function_privilege('authenticated','coin_seller_api_v1.client_catalog_text_valid_v1(text,integer,boolean)','execute') and not has_function_privilege('anon','coin_seller_api_v1.client_catalog_text_valid_v1(text,integer,boolean)','execute') as value"));
 assert.deepEqual(await loadOwner(),expected);assert.deepEqual(await counts(),{edits:1,audit:1,quotes:0,proofs:0,deposits:0});check('final catalogue/audit/receipt/financial integrity',true);
 assert.equal(checks.length,45,'Retain35 plus8 installed IPv6 cases and2 save/rollback checks');
 const receipt={result:'PASS',engine,dependency:'@electric-sql/pglite@0.3.16',synthetic_installer_sha256:hash(source),check_count:checks.length,checks,private_seed_executed:false,production_connections:0,native_reset_34_cases:'NOT RUN',scope:'Complete exact integrated installer with synthetic seed, auth.uid/jwt/is_founder/apply prerequisites and small auth/profile/session/audit tables. Not genuine JWT/PostgREST/target role defaults/RLS, writer/concurrency, live install/payment/backup/reset/device acceptance.'};
 fs.writeFileSync(new URL('full-installer-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{await db.close();}
