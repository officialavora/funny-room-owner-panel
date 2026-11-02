# PR28 lifecycle correction — bounded independent receipt

Base/head reviewed: 16b24cb5923add9ffcc34190131a6b7eb8b389e2.

Two actual-module mocked counterexamples were reproduced: retirement during save read-back still emitted a success toast; retained Refresh dispatched an additional load after retirement. Two isCurrent guards correct those paths. No app.js, PR27, login/dialog, catalogue/QR, RPC arguments, version or request-ID changes.

Runtime preimage SHA256 86870149ddb0c737517113addb2b673f39abd6cebe14793e70ac417bb9b8d981; successor a0f4e3266b59f70d859b379f2fad9d832352a98866a47f6cb3bae70a87a4d254. Exact two-insertion inverse independently verified. Candidate three synthetic scenarios pass, baseline both retirement assertions fail, each guard-removal mutant fails. Independent local review SHA256 544c131e3a84da7c12342009c84dd6c31689a7860850e93480cbc0ed144abcfb.

The added test is appended to the existing owner-dom suite; all five earlier tests remain unchanged. It exercises the actual module using synthetic DOM and RPC only. No live backend/payment operation, browser rendering, full catalogue acceptance, merge or deployment is established. Existing run41149192939 covered the old head, not this successor. This remains a Draft PR requiring specific merge confirmation. No GitLab or reset operation is involved.
