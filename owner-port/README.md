# Original application Owner controls on the approved panel

CP153 review candidate. This package ports the application's actual Owner components and original assets to React Native Web, sharing the existing panel's Supabase session. It does not create a second hosting service or database. The approved host remains https://officialavora.github.io/funny-room-owner-panel/.

Source baseline: GitLab project 86955143, CP152 immutable ref 67fdf040f7856ca1058674404ad525ab3cf59319. Includes CP149 Owner controls, CP152 ID protection, the complete original OwnerCenter extracted from App.js, its dependency closure and 364 original media files. The gift policy RPC is corrected in both sources to preserve all AI/effect/sound metadata when saving prices.

## Reproduce

Use an authorized checkout of the native baseline to materialize the exact assets:

```
node materialize-assets.mjs /absolute/path/to/native-checkout
npm ci
npm run build
npm test
node gift-contract-test.cjs
```

The root panel loads full-controls.js and media/ from the build. The checked-in browser fixtures are development tests only. Never deploy browser-harness.html or media-harness.html as product routes. The package excludes credentials, browser binaries and node_modules.

Web adapters implement real file picking/cropping, transparent PNG export, audio playback, clipboard, storage and dialog cancellation. Auth and staff access are checked before mounting; every data operation uses the same server RPC and its existing scopes. Navigation/logout clean up mounted controls, dialogs, media and audio.

## Verification boundaries

31 selectors rendered in DOM fixtures and real Chromium at phone/desktop dimensions without missing local media or browser crashes. Image crop, cancel, multi-select limits and cleanup passed. SQL rollback fixtures passed on staging for hierarchy/exact permissions/role directory and CP149/CP152 regressions. These are not authenticated live mutation tests, physical-device acceptance or full application CI certification.

The live RPC audit has no known literal-argument mismatch after the gift fix; some CP149/CP152 functions are staged only. Opaque/spread call sites and unused shared helpers are identified in the audits. Never turn missing live RPCs into mock success responses. Candidate Edge/SQL is under backend-candidate/, is NOT live and must pass the existing APK-only isolation/integration gates before release.

The review CI can also restore verified assets from committed media/ via restore-assets-from-media.mjs, rebuild deterministically and compare every compiled file. scripts/check-owner-destination.cjs guards accidental rejected Owner URLs/hosting configuration and the recorded official identity; it is not a guarantee against administrator bypass.
