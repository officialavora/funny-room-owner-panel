# Coin Seller validator review tests

Run `npm ci --prefix tests/coin-seller-sql --ignore-scripts --no-audit --no-fund`
and `node tests/coin-seller-sql/validator-parity.test.mjs` from the repository root.

This adds 541 finite client/SQL acceptance comparisons using the actual root
`coin-seller-catalog.mjs` and a pinned, ephemeral PGlite PostgreSQL 17.5 engine.
The draft SQL lives in `backend/review/coin-seller-catalog-validator.DRAFT.sql`.
It is a pure validator and text helper, not a backend installer. The old SQL
fixture reproduces the duplicate-country and oversized-version discrepancies.
All catalogue inputs are synthetic; no real payment destinations or personal
database exports are included. Both the original 203 cases and the additional
text cases remain in the corpus. The script requires PostgreSQL major 17 and
asserts the client and SQL source pins.

The original 459 cases are retained with a separate corpus-length assertion.
Sixteen added HTTPS port cases cover 0..65535, out-of-range ports, leading zeros
and long numeric strings. The pinned pre-port SQL fixture reproduces acceptance
of 65536, 99999 and 00065536 while the actual client rejects them. A single SQL
guard now rejects numeric ports above 65535. Other WHATWG URL/SQL regex behavior
is not established as equivalent; this bounded fix is not full URL parity.

The existing workflow's steps are retained. These additional steps have no
Supabase credentials, URLs, production calls, deployment or reset instructions.
No reset harness is run here. No native PostgreSQL server or target database is
used. JWT/session/RLS/ACL/CAS/concurrent saves, full installer dependencies,
settlement, checkout, physical-device behavior and restore/reset acceptance
remain separate gates. The new text helper must be admitted with the full
backend before any installation. The feature remains draft and unactivated.

Prior evidence: Library `libfile_2e9c78c6697c8191bb527cfd43abf87f` (PG17 WASM)
and `libfile_c9f3bfa220a081918a0a997e39dc2bb0` (PG18 WASM). These are the same
459 cases on two engines, not 918 distinct cases or full application coverage.

Rollback of this source-only addition removes this test directory and the draft
SQL file and restores the two appended workflow steps. No database rollback is
needed because this source change installs nothing on a real backend.

The existing guarded URL syntax extension adds 40 compatibility cases and 12
rejection guards to the original 475, giving the retained 527-case corpus.
Malformed-host follow-up: 14 explicit host/path cases extend those 527 to 541.
The pinned pre-host fixture reproduces seven client-rejected SQL accepts. Two prior
residual examples now pass rejection parity; five known URL differences remain
asserted UNRESOLVED (including invalid IPv4 false acceptance). New guard checks
malformed percent escapes/brackets only in authority, stopping before backslash
paths. This is not universal host validation or full WHATWG parity/admission.
