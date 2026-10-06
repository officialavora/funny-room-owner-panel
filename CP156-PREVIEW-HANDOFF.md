# CP157 — Owner rejected CP156 zero-data regression — urgent rollback in progress

Owner reported on 6 October 2026 that CP156 made the existing app look reset/empty. This is a release regression: CP156 silently substituted a separate empty business backend for preview/runtime0.10.65. Passing isolation/source CI did NOT satisfy preservation of the existing application.
DO NOT publish CP156 staging-routing source again. Preserve the existing account, email, users, rooms, gifts, balances and app appearance; never silently switch the Owner's installed app to a new empty dataset. The requested work is improvement of the existing application. Isolated test tooling must not replace it.
Recovery target: republish verified CP141 Android group 098090dd-7805-488d-8bb4-1d13a5dda807 to the unchanged preview branch/runtime0.10.65. Rollback is NOT yet confirmed; inspection workflow https://github.com/officialavora/funny-room/actions/runs/37499928473 is running. No native build, production release, channel remap, reset, reinstall or business data deletion.
Live read-only check: auth users62, profiles62, gifts83; original business backend remains present. Physical device recovery is not yet verified. Retain newer source/features for corrected integration; do not erase all worker work or declare A–Z done. Latest incident supersedes CP156 shipping acceptance below.

# CP156 final combined test delivery — 6 October 2026

Android preview/runtime0.10.65 published at2026-10-06T16:43:35.124Z from canonical native e7350887f0577852505350a7c5cb1b89d186b58c. Group4bea6096-bb3b-4246-9d93-e8d8abe1b456; update01a11219-5f54-7382-9857-859799dca549. Full canonical publisher37497342397/job112385164968 PASS: all original required guards,73 authentication/isolation cases, Doctor18/18 and1666-module Android export. Normal manifestHTTP200 delivered exact ID/453assets; CP131 production isolation before/after PASS; no native build/Play/production OTA/channel remap. EAS actual installs0 at audit; phone acceptance is NOT TESTED.

Paired Owner preview publication342c1029e51ff839ed9bcb186a90ce813521dedb/Pages37496934775 PASS; public previewHTTP200 verified. Main accepted Owner app/index/styles and prior media unchanged. Whole live Owner backend migration is not claimed: preview uses staged data and main uses existing accepted live backend. Root work identity unchanged. Stage Root email now reserved to exact protected UUID; wrong UUID denial passed. Temporary API probe retired410 and all2 test users/history/room cleaned.

Final complete native WORK_HANDOFF.md and AGENTS.md checkpoint c8718332a348fe42cd11e641a7965fe1504f5d49. Same saved report updated with full prior history. One-shot publisher retired; manual source-only default restored, no documentation push OTA. Worldwide translations, neural entry music, cosmetic integrations, SMS and physical A–Z checks remain explicit; never label source/server delivery full100percent.

Prior checkpoint retained below; this final section supersedes its pending OTA status:

# CP156 isolated Owner preview

Approved host: https://officialavora.github.io/funny-room-owner-panel/preview.html
Existing Root work identity: officialavora7@gmail.com / public ID100000.

The main index, main app.js, main styles and existing media blobs are preserved. Only the isolated preview page/app/bundle and previously absent hashed original media are added. Business operations and staff accounts use staging supaxsiylqysvzutwjrw. Root credentials are verified by the existing live Auth endpoint only, then exchanged by staging preview-owner-session after exact UUID/email/protected Owner authority validation. Staff login uses staging only. No live wallets/users were copied. Preview browser storage is separate.

Paired Owner candidate181d89d34cf4e28bec33e2d10d3e67749c36229d: rebuild37496334856/job112381709983 PASS. Actual preview auth-routing regression, all31 control smoke tests, Chromium390x844/1280x900 and media crop/cancel/multiple/cleanup PASS with local fixtures. These are not authenticated whole-panel device acceptance.
Native candidate36a24c400e7b968b716d6cb2e91005de50b0f8e1, project86955143/checkpoint156-isolated-owner-preview. Full combined native CI and OTA pending at this checkpoint. No native build or Play release.
Staging rollback tests: Root permanent identity/protection; daily sign-in;75-user paginated directory/privacy; exact staff powers and country/team hierarchy; room freeze/password and delegated coin budget;5 relationship gifts consent/retry/refund/acceptance; CP111 wheel and Ludo/Carrom escrow/replay/payout PASS.
Actual hosted Auth API: fixed UUID creation and magiclink session PASS. Actual staged RTC token issuance and denied outside-room access PASS, fr_cp156_ namespace. New dedicated live-hosted preview-rtc-signer reads only staging under verified staging user/RLS, uses existing RTC credentials, and does not touch the live app RTC endpoint or live business data. Staged service records RTC usage. Temporary nonce-protected API check retired410; its2 test users, generated coins/history/room cleaned; staging users/profiles0 after cleanup.
Root live-to-stage positive SSO on the actual phone and whole-app screen/RTC/audio/device acceptance remain NOT TESTED. Source/preview/backend/OTA/native/store status must remain separate. Do not restore ChatGPT Sites Owner panel or introduce another Owner email.
