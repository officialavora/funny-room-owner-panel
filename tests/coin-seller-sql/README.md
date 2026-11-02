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
20 encoded-dot cases to610;26 path-whitespace/authority/control cases to636;30 port/backslash cases to666;372 explicit IPv6 authority/port cases to1038.
Case counts are not full application coverage or distinct user features.

The current whitespace guard checks authority only, stopping at slash/query/
fragment/backslash. Twenty actual client-valid path/query/fragment inputs reproduce
old SQL rejection before the candidate; six authority/credentials/ASCII-control
negatives remain rejected. Literal path text remains unchanged, matching the
existing client contract; no financial policy, admission host list or authorization
changes. Earlier numeric-port, malformed-host and bounded IPv4 checks remain.

The previously tracked valid-IPv6 residual is now covered by a separate strict
bracketed-authority branch. It checks complete bracket/port grammar, restricts
the address to IPv6 literal characters, then uses PostgreSQL inet/family to
validate address structure. Masks, zone identifiers, userinfo, malformed brackets,
invalid address groups and ports above65535 remain rejected. The old unbracketed
URL guards stay byte-identical; raw paymentUrl is never rewritten. All338 new
client-valid inputs reproduce rejection on exact pinned pre-IPv6 SQL before
1038 candidate comparisons pass. Other encoded/Unicode/WHATWG parser forms remain
unproven: closing tracked residuals does not establish universal URL equivalence,
SSRF/network safety, admitted-host policy or payment readiness.

Optional independent local audit (not added to the hosted workflow):
`node tests/coin-seller-sql/ipv6-independent-audit.mjs`.
It checks8760 deterministic bracketed-address/port mutations against the actual
unchanged client and SQL, including raw-destination immutability. These inputs may
overlap the1038 corpus; do not sum them as distinct coverage or reset cases.

The latest bounded fix treats backslash as a path separator only in existing URL
admission/port-check expressions, matching the unchanged HTTPS client parser.
Stored destination text is not rewritten. The existing authority/whitespace,
malformed-host, credentials and decimal IPv4 guards remain intact. Fourteen
pinned old-SQL rejections reproduce;30 explicit client expectations cover scheme
case, empty/zero/max/oversized ports, credentials, bad hosts, IPv4 and path data.
All666 prior comparisons remain asserted; the former IPv6 residual is now part of the explicit IPv6 acceptance corpus.

The existing workflow and prior tests remain intact. This runs only ephemeral
in-process synthetic pure SQL; no Supabase URLs/credentials, production data,
reset harness, live writes or deployment. Original34 native reset cases NOT RUN.
Native target17.6/JWT/auth.sessions/roles/RLS/ACL/CAS/concurrency, complete installer
dependencies/helper permissions, settlement/checkout, actual full backup+Storage
isolated restore/wholeOwner/content/writer/rollback and APK/device remain gates.

This is draft source, unactivated. Rollback the particular source diff to its
pinned preimage; no database rollback is needed for this uninstalled source work.

The concurrent complete synthetic installer is synchronized by one exact validator
replacement, preserving its surrounding functions/ACLs/synthetic seed. Run the
existing full-installer workflow command for45 checks (retained35 plus8 IPv6
validation and2 Owner save/readback/rollback checks). This is synthetic auth/session
fixture execution, not genuine JWT/RLS/concurrency or live-target acceptance.
