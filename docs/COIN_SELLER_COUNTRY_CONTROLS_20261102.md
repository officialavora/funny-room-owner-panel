# Coin Seller country controls — 2 November 2026

Removing an eligible display country previously retained its eligibility code,
so the existing catalog validator refused Save. Removal now deletes that code
and its override while preserving all other countries and eligibility. Adding
or searching countries now reports malformed JSON through the existing status
field and refuses retained callbacks after navigation or while Save is pending.

Twelve focused synthetic DOM regression cases include frozen-original failure
reproductions, exact save arguments, empty eligibility, normal add/search,
retired callbacks and pending-save behavior. The six existing DOM cases and all
other workflow steps remain intact. Frozen preimage SHA256:
a0f4e3266b59f70d859b379f2fad9d832352a98866a47f6cb3bae70a87a4d254.

Local Node24 syntax checks pass. Local DOM execution was unavailable because
offline npm lacked xmlchars2.2.0 (ENOTCACHED); hosted PR CI is pending at commit
preparation. Review the actual check result before accepting the change.

This is source-only on Draft PR28. Shared validators, financial RPC contracts,
SQL, checkout admission, native builds and live databases are unchanged. No
publication, merge or payment activation is included. Backend JWT/RLS/ACL/CAS,
concurrency, isolated restore and device acceptance gates remain pending.
