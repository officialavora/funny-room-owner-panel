import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const db=new PGlite();
const owner='11111111-1111-4111-8111-111111111111';
const user='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';
const tests=[];
async function test(name,fn){await fn();tests.push(name)}
await db.exec(`CREATE SCHEMA private;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,public_id bigint UNIQUE NOT NULL,
 display_name text,bio text,date_of_birth date,avatar_url text,cover_url text,
 country_code text,gender text,level integer,points bigint,vip_level integer,
 frame_code text,entry_code text,bubble_code text,badge_code text,medal_code text,updated_at timestamptz);
CREATE TABLE private.admin_roles(user_id uuid,role text,protected boolean);
CREATE TABLE private.role_assignments(user_id uuid,role_key text,status text);
CREATE TABLE private.owner_protected_targets(target_type text,target_id text,active boolean);
CREATE FUNCTION private.is_founder(u uuid) RETURNS boolean LANGUAGE sql AS
 'select exists(select 1 from private.admin_roles where user_id=u and role=''owner'' and protected)';
CREATE TABLE public.cosmetic_catalog(code text PRIMARY KEY,active boolean);
CREATE TABLE private.cosmetic_grants(id uuid PRIMARY KEY,user_id uuid REFERENCES public.profiles,
 cosmetic_code text REFERENCES public.cosmetic_catalog,source text NOT NULL,
 status text NOT NULL CHECK(status IN ('active','suspended','revoked','expired')),
 starts_at timestamptz,expires_at timestamptz,reason text,updated_at timestamptz);
CREATE TABLE private.cosmetic_equipped_v142(user_id uuid REFERENCES public.profiles,
 kind text CHECK(kind IN ('room_frame','room_theme','nameplate','noble')),
 cosmetic_code text REFERENCES public.cosmetic_catalog,PRIMARY KEY(user_id,kind));
-- Eligibility fixture intentionally exercises NULL rejection in the deployed
-- BEFORE INSERT/UPDATE trigger. Full role/cross-system eligibility is not mocked as proof.
CREATE FUNCTION private.cosmetic_role_eligible_v1(u uuid,c text) RETURNS boolean LANGUAGE sql AS
 'select exists(select 1 from public.cosmetic_catalog where code=c and active)';
CREATE FUNCTION private.enforce_cosmetic_post_v1() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT private.cosmetic_role_eligible_v1(new.user_id,new.cosmetic_code)
 THEN RAISE EXCEPTION 'Required official post not active'; END IF;
 RETURN new;
END $$;
CREATE TRIGGER cosmetic_post_guard_v1 BEFORE INSERT OR UPDATE ON private.cosmetic_equipped_v142
FOR EACH ROW EXECUTE FUNCTION private.enforce_cosmetic_post_v1();
CREATE TABLE public.wallets(user_id uuid PRIMARY KEY,coin_balance bigint,earned_balance bigint);
CREATE TABLE public.cp_relationships(user_a uuid,user_b uuid,status text);
CREATE TABLE public.organization_members(user_id uuid,organization_id uuid);
CREATE TABLE public.rooms(id uuid,owner_id uuid,background_url text);
CREATE TABLE public.reward_grants(id uuid,user_id uuid,state text);
CREATE TABLE private.financial_ledger(id uuid,user_id uuid,delta bigint);
`);
for(const [id,pub] of [[owner,1],[user,2],[other,3]]){
 await db.query(`INSERT INTO public.profiles VALUES($1,$2,'identity','bio','1990-01-01',
 'avatar','cover','IN','female',8,999,6,'frame','frame','frame','frame','frame',now())`,[id,pub]);
 await db.query('INSERT INTO public.wallets VALUES($1,123,456)',[id]);
}
await db.query("INSERT INTO private.admin_roles VALUES($1,'owner',true)",[owner]);
await db.exec("INSERT INTO public.cosmetic_catalog VALUES('frame',true),('future',true)");
for(const [i,source,status,permanent,future] of [
 [1,'purchase','active',false,false],[2,'event','suspended',true,false],
 [3,'manual','active',false,true],[4,'role','revoked',true,false],[5,'vip','expired',false,false]]){
 const gid=`aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12,'0')}`;
 await db.query(`INSERT INTO private.cosmetic_grants VALUES($1,$2,'frame',$3,$4,
 now()+($5::int*interval '1 day'),CASE WHEN $6 THEN NULL ELSE now()+interval '2 days' END,'provenance',now())`,
 [gid,user,source,status,future?1:-1,permanent]);
}
await db.query("INSERT INTO private.cosmetic_grants VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',$1,'frame','purchase','active',now(),null,'owner keep',now())",[owner]);
for(const id of [owner,user,other])for(const kind of ['nameplate','noble','room_frame','room_theme'])
 await db.query("INSERT INTO private.cosmetic_equipped_v142 VALUES($1,$2,'frame')",[id,kind]);
await db.query("INSERT INTO public.cp_relationships VALUES($1,$2,'active')",[owner,user]);
await db.query('INSERT INTO public.organization_members VALUES($1,$2)',[user,owner]);
await db.query("INSERT INTO public.rooms VALUES($1,$2,'background')",[other,user]);
await db.query("INSERT INTO public.reward_grants VALUES($1,$2,'active')",[other,user]);
await db.query('INSERT INTO private.financial_ledger VALUES($1,$2,10)',[other,user]);
await db.exec(readFileSync(new URL('./candidate.sql',import.meta.url),'utf8'));
const snap=async(id=user)=>(await db.query('SELECT pg_temp.cosmetic_reset_snapshot($1) AS s',[id])).rows[0].s;
const apply=async(s,id=user)=>(await db.query('SELECT pg_temp.cosmetic_reset_apply($1,$2) AS s',[id,s])).rows[0].s;
const protectedState=async()=>{
 const result={};
 for(const table of ['public.wallets','public.cp_relationships','public.organization_members','public.rooms','public.reward_grants','private.financial_ledger','private.admin_roles','private.role_assignments','public.cosmetic_catalog'])
 result[table]=(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') AS s FROM ${table} x`)).rows[0].s;
 result.owner=(await db.query(`SELECT to_jsonb(p) AS s FROM public.profiles p WHERE id=$1`,[owner])).rows[0].s;
 result.other=(await db.query(`SELECT to_jsonb(p) AS s FROM public.profiles p WHERE id=$1`,[other])).rows[0].s;
 result.otherGrants=(await db.query(`SELECT jsonb_agg(to_jsonb(g) ORDER BY id) AS s FROM private.cosmetic_grants g WHERE user_id<>$1`,[user])).rows[0].s;
 result.otherEquips=(await db.query(`SELECT jsonb_agg(to_jsonb(g) ORDER BY user_id,kind) AS s FROM private.cosmetic_equipped_v142 g WHERE user_id<>$1`,[user])).rows[0].s;
 return result;
};
const initial=await snap();
await test('cannot apply without explicit isolated fixture marker',async()=>await assert.rejects(()=>apply(initial),/isolated_review_only/));
await db.exec("SET funnyroom.isolated_fixture='true'");
await test('null target rejected',async()=>await assert.rejects(()=>snap(null),/target_required/));
await test('missing target rejected',async()=>await assert.rejects(()=>snap('99999999-9999-4999-8999-999999999999'),/target_missing/));
await test('Owner rejected before any mutations',async()=>await assert.rejects(()=>snap(owner),/protected_target/));
await test('public-ID protected alias excluded',async()=>{
 await db.exec("INSERT INTO private.owner_protected_targets VALUES('account','2',true)");
 await assert.rejects(()=>snap(),/protected_target/);
 await db.exec('DELETE FROM private.owner_protected_targets');
});
await test('UUID protected alias excluded',async()=>{
 await db.query("INSERT INTO private.owner_protected_targets VALUES('profile',$1,true)",[user]);
 await assert.rejects(()=>snap(),/protected_target/);
 await db.exec('DELETE FROM private.owner_protected_targets');
});
await test('historical founder assignment conservatively excluded',async()=>{
 await db.query("INSERT INTO private.role_assignments VALUES($1,'root_founder','revoked')",[user]);
 await assert.rejects(()=>snap(),/protected_target/);
 await db.exec('DELETE FROM private.role_assignments');
});
await test('unknown protection kind blocks entire scoped candidate',async()=>{
 await db.exec("INSERT INTO private.owner_protected_targets VALUES('room','unknown',true)");
 await assert.rejects(()=>snap(),/unresolved_protection_scope/);
 await db.exec('DELETE FROM private.owner_protected_targets');
});
await test('missing resolved Owner blocks changes',async()=>{
 await db.exec('UPDATE private.admin_roles SET protected=false');
 await assert.rejects(()=>snap(),/owner_unresolved/);
 await db.exec('UPDATE private.admin_roles SET protected=true');
});
await test('null snapshot rejected',async()=>await assert.rejects(()=>apply(null),/snapshot_required/));
await test('snapshot from another account rejected',async()=>await assert.rejects(async()=>apply(await snap(other)),/stale_snapshot/));
await test('stale preview after new grant rejected',async()=>{
 const s=await snap();
 await db.query("INSERT INTO private.cosmetic_grants VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc',$1,'frame','event','active',now(),null,'new',now())",[user]);
 await assert.rejects(()=>apply(s),/stale_snapshot/);
 await db.exec("DELETE FROM private.cosmetic_grants WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'");
});
await test('deployed trigger behavior rejects UPDATE-to-NULL unequip',async()=>{
 await assert.rejects(()=>db.query('UPDATE private.cosmetic_equipped_v142 SET cosmetic_code=NULL WHERE user_id=$1',[user]),/Required official post not active/);
});
const beforeProtected=await protectedState();
const before=await snap();
await db.exec('BEGIN');
const result=await apply(before);
await test('purchase, permanent and future grants revoked together',async()=>{
 assert.equal(result.revoked_grants,3);
 assert(result.after.grants.every(x=>!['active','suspended'].includes(x.status)));
});
await test('all four authoritative equipped kinds removed',async()=>{
 assert.equal(result.removed_selections,4);assert.deepEqual(result.after.equipped,[]);
});
await test('five profile selections cleared',async()=>{
 for(const k of ['frame_code','entry_code','bubble_code','badge_code','medal_code'])assert.equal(result.after.profile[k],null);
});
await test('historical grant rows, provenance and terminal states retained',async()=>{
 assert.equal(result.before.grants.length,result.after.grants.length);
 for(const b of result.before.grants){
 const a=result.after.grants.find(x=>x.id===b.id);
 for(const k of Object.keys(b).filter(k=>!['status','updated_at'].includes(k)))assert.deepEqual(a[k],b[k]);
 if(['revoked','expired'].includes(b.status))assert.deepEqual(a,b);
 }
});
await test('Owner, other account, money, ledger, relationships, membership and catalog preserved',async()=>assert.deepEqual(await protectedState(),beforeProtected));
await test('profile identity, media, DOB and progression untouched by cosmetic module',async()=>{
 const omit=x=>Object.fromEntries(Object.entries(x).filter(([k])=>!['frame_code','entry_code','bubble_code','badge_code','medal_code','updated_at'].includes(k)));
 assert.deepEqual(omit(result.before.profile),omit(result.after.profile));
});
await test('replaying old payload rejected',async()=>{
 await db.exec('SAVEPOINT rejected_replay');
 await assert.rejects(()=>apply(before),/stale_snapshot/);
 await db.exec('ROLLBACK TO SAVEPOINT rejected_replay');
});
await test('fresh empty cosmetic snapshot makes no new revocations',async()=>{
 const r=await apply(await snap());assert.equal(r.revoked_grants,0);assert.equal(r.removed_selections,0);
});
await db.exec('ROLLBACK');
await test('rollback restores exact scoped rows and protected state',async()=>{
 assert.deepEqual(await snap(),before);assert.deepEqual(await protectedState(),beforeProtected);
});
await test('missing required column fails closed',async()=>{
 await db.exec('ALTER TABLE private.cosmetic_grants DROP COLUMN status');
 await assert.rejects(async()=>apply(await snap()),/status/);
});
const receipt={status:'PASS_SYNTHETIC_COSMETIC_MODULE_ONLY',engine:(await db.query('select version() as v')).rows[0].v,
 check_count:tests.length,checks:tests,live_reset_executed:false,live_reset_ready:false,
 limitations:['PGlite fixture only; no live writes','no writer/role phantom or multi-connection guarantee',
 'no durable actor authorization or operation audit yet','no DB/media backup or restore',
 'SVIP/reward records/wallet/progression/room/family/CP resets not implemented by this module',
 'full deployed triggers and renderer fallback acceptance remain open']};
await db.close();
writeFileSync(new URL('./test-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
