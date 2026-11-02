# Cosmetic module preservation review

This is an isolated, synthetic SQL review, not a deployable full reset. The
temporary SECURITY INVOKER functions are not a production RPC and their session
marker is not authorization. No new public API, grant, role, credential or
production migration is added.

The snapshot and apply share policy `cosmetic-coverage-review-v2`. They protect
Owner/admin/root-founder and explicit UUID/public-ID aliases, revoke every
active/suspended owned cosmetic grant regardless of purchase/permanent/future
source, retain provenance/history, remove four authoritative equip kinds and
clear five profile selection codes. The deployed v142 update trigger rejects
NULL, so unequip deletes only the selection row without disabling that trigger.
Rendering when the selection row is absent still needs acceptance testing.

The peer b944 protected-incoming grant/membership guard is retained. An incoming SVIP entitlement can reference a target-owned cosmetic grant.
Checking only the target's identity or its outgoing references misses this
dependency. The candidate now rejects any cross-user or unknown-user incoming
reference before both preview and mutation. It never changes the other user's
entitlement or "repairs" its owner. Missing dependency tables fail closed. A
reference created after preview is rechecked; this is not proof against
multi-connection phantom inserts or a complete writer fence.

Local fixture checks: 26 peer read-only audit controls, 36 combined cosmetic-module
controls and one pinned old-SQL failure control. The old SQL copied exactly from
788f478f214617b41ce205130d49dbaf146d0614 must fail specifically at the incoming
Owner dependency invariant. Its SHA256 is pinned in the negative runner; a
missing module, timeout, different SQL error or changed baseline cannot pass.
The tests use PGlite 0.3.16 / PostgreSQL 17.5 WASM, not a live/native/device gate.

Production read-only inspection on 3 November Saudi found no current cross-user
cosmetic entitlement links. A current zero count does not replace a guard or
prove future producer closure. A separate grouped inspection found coin reward
records point to `public.wallet_entries`, VIP records to progression, and art
records to cosmetic grants. `state='active'` on a financial history record must
not be interpreted as a second spendable balance. Preserve claim, request,
idempotency, ledger and payout evidence; do not delete history to make counts
look zero or mark a financial record reversed without the corresponding
canonical operation and reconciliation.

Still open: durable operation/actor/ACL integration, wallet/progression/SVIP and
all other reset categories, replay/epoch and every writer fence, pending
settlement reconciliation, real recoverable DB backup, all private media bytes,
isolated compatible restore, full Owner/dependency/Auth/content comparisons,
rollback rehearsal and app/Owner rendering acceptance. LiveResetReady=false.

Integration policy change: the peer test allowed an unprotected incoming grant link. Because this fixture module approves exactly one target, the integrated policy now rejects that link too. Its fixture and exact rollback check are retained with the stronger rejection expectation. The four peer protected incoming grant/membership checks, both old-SQL false-accept controls, all existing protection and history checks remain. The old baseline file is deduplicated to candidate.pre-incoming.sql with the same pinned hash.
