# Coin Seller validator review tests

From repository root:
`npm ci --prefix tests/coin-seller-sql --ignore-scripts --no-audit --no-fund`
then `node tests/coin-seller-sql/validator-parity.test.mjs`.

The actual unchanged root client is compared with review-only SQL/helper on pinned
PGlite0.3.16/PostgreSQL17.5WASM. All input data is synthetic. Both the client and
every SQL preimage/candidate have exact source hash assertions.

The finite corpus retains each prior length assertion:459 original type/text and
version/eligibility cases;16 port cases to475;52 guarded syntax cases to527;14
malformed-host cases to541;24 decimal IPv4 cases to565;25 single-dot cases to590;
20 encoded-dot cases to610;26 path-whitespace/authority/control cases to636.
Case counts are not full application coverage or distinct user features.

The current whitespace guard checks authority only, stopping at slash/query/
fragment/backslash. Twenty actual client-valid path/query/fragment inputs reproduce
old SQL rejection before the candidate; six authority/credentials/ASCII-control
negatives remain rejected. Literal path text remains unchanged, matching the
existing client contract; no financial policy, admission host list or authorization
changes. Earlier numeric-port, malformed-host and bounded IPv4 checks remain.

Two known differences remain separately asserted UNRESOLVED, outside the parity
count: client-valid IPv6 and explicit-port backslash paths. Other encoded-digit,
Unicode/WHATWG host/parser forms are unproven. This does not establish universal
URL safety, full parser equivalence or payment readiness.

The existing workflow and prior tests remain intact. This runs only ephemeral
in-process synthetic pure SQL; no Supabase URLs/credentials, production data,
reset harness, live writes or deployment. Original34 native reset cases NOT RUN.
Native target17.6/JWT/auth.sessions/roles/RLS/ACL/CAS/concurrency, complete installer
dependencies/helper permissions, settlement/checkout, actual full backup+Storage
isolated restore/wholeOwner/content/writer/rollback and APK/device remain gates.

This is draft source, unactivated. Rollback the particular source diff to its
pinned preimage; no database rollback is needed for this uninstalled source work.
