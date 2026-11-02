import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const old=new URL('./candidate.pre-incoming.sql',import.meta.url);
const oldHash=createHash('sha256').update(readFileSync(old)).digest('hex');
assert.equal(oldHash,'80cdd09e1071468f5bce4aa58b25e2fef8842d6c23d3abe9aa82dd31dc20c8c5');
const r=spawnSync(process.execPath,[fileURLToPath(new URL('./test-candidate.mjs',import.meta.url)),fileURLToPath(old)],{
 encoding:'utf8',timeout:60000,env:{PATH:process.env.PATH}});
assert.equal(r.error,undefined);
assert.notEqual(r.status,0,'old SQL must fail the new preservation invariant');
assert.match(r.stderr,/protected incoming Owner grant blocks apply with exact rollback: Missing expected rejection/);
console.log(JSON.stringify({status:'PASS_EXPECTED_OLD_SQL_FAILURE',old_source:'788f478f214617b41ce205130d49dbaf146d0614',old_sql_sha256:oldHash,
 failure:'incoming Owner SVIP dependency was not rejected',live_reset_ready:false}));
