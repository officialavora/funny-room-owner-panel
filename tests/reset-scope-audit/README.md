# Read-only reset scope audit

This SELECT previews selected schema-backed reset categories without calling any reset/mutation RPC. It counts every owned cosmetic grant regardless of purchase/permanent/timed source, authoritative v142 equipped kinds, SVIP pending states, reward grants, birthday sync eligibility, pending settlements, active crons and existing reset jobs. It flags cross-user entitlement links and unresolved protected-target types.

Owner protection conservatively includes all owner admin roles and root-founder assignments, including historical assignments. Active explicit user/profile/account protection also excludes both UUID and public-ID aliases. This is a deliberately overprotective audit definition, not final mutation authorization or full shared-dependency closure.

The result contains counts and SHA-256 fingerprints, not row identities/content/media URLs. Sixteen selected protected surfaces are always emitted, including empty surfaces. Profile identity excludes only enumerated reset fields; the Owner profile is separately hashed in full. Whole Owner grants/security/shared dependencies, all catalogs, actual Storage bytes, Auth and cross-system consistency are NOT certified by these selected fingerprints. A before fingerprint is not a before/after comparison or recoverable backup.

Run only against the reviewed schema with an authorized read-only connection. Missing required schema fails; never weaken the query to silently omit a category. The audit always reports `recoverable_backup:false`, `writer_cutover_verified:false`, `live_reset_ready:false`. It neither modifies production nor makes the old apply helper safe. Candidate counts are not a final execution target manifest.

Synthetic tests: `npm ci --ignore-scripts --no-audit --no-fund` then `node test-reset-scope.mjs` in this directory. PGlite 0.3.16 / PostgreSQL 17.5 WASM checks read-only execution, Owner/alias exclusion, omissions in the old policy, content mutations, empty-surface hashes, malformed entitlement linkage and schema failure. The copied is_founder definition is a pinned source fixture in a synthetic schema; its auth dependencies are synthetic. These checks do not rerun or replace the separate original 34 native PostgreSQL 17.11 admission tests, full reset integration, live backups or device acceptance.

No real backend credentials or live receipt are committed here. No DDL/deployment/migration/reset instructions are provided. Existing source, locks, runtime, Owner controls, payment state and all HOLD/STOP scopes remain unchanged.
