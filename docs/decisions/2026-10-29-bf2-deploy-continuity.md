# Keep an open engine build consistent across deployment

An already-loaded runtime can import `/ui/main.js` after the active build changes. Previously that URL served the new build's UI, while a late import under the old runtime's versioned path returned 404. A synthetic browser control against main `e35e13b44` reproduced both failures: `ui.originalOnly is not a function` and a failed late module import.

Adoption now records the exact previously published site, UI-data and allowed export roots in `retainedBuilds`. The Worker serves manifest-listed files from these explicit records. It does not discover or expose arbitrary builds in the bucket. Public entry addresses, including an older build's index page, continue to redirect to the current build.

Absolute UI, rulebook and allowed export requests with a same-origin engine referrer redirect to that build's qualified URL. The final module URL also keeps relative dependencies in the same build. These redirects use `no-store`; engine pages send `Referrer-Policy: same-origin`. An explicitly retired/unknown engine referrer receives 410 with a reload instruction. Normal requests without an engine referrer retain current-root behavior. The site's `/ui/bf2017/` remains outside this routing.

## Validation

- Four new Worker/adoption regressions failed before the fix; all 38 focused Worker/adoption checks passed after it.
- Final focused run: **89/89 tests across eight suites**, including Worker, return flow, service-worker cache, timers, source, adoption and desktop publisher. ESLint and `git diff --check` passed.
- `node scripts/bf2web-deploy-continuity.mjs` uses real HTTP, module imports, referrers and the production `servePlay` function in headless Edge 156.0.4314.50. GPU, WebGL and software rasterizer are explicitly disabled. It loads the old runtime, adopts a new build, then starts the old runtime and opens a fresh new page.
- Fixed browser result: old UI API, its relative dependency, rulebook, font and late runtime import all remain old; a fresh page receives all five new values. Nineteen HTTP requests were recorded.
- Running the same browser check with `--worker .scratch/control/play.js` from main `e35e13b44` fails both the changed UI API and old late-module fetch. Local reports: `.scratch/deploy-control/report.json` and `.scratch/deploy-continuity/report.json`.
- Unit controls cover unpublished-but-present bucket files, retained manifest allowlisting, same/cross/missing referrers, retired build 410, methods, query strings, index redirects, repeated adoption and rollback.

This is a synthetic deployment contract check. It does not run the game, prove hardware rendering or original behavior, or demonstrate a live deployment. No build pointer, bucket contents, credentials, workflow or existing export changed.

## Publication and limits

This records history starting with the next adoption. It does not backfill previously published builds. The existing current build remains available as usual. Intentional retirement removes the corresponding configuration record and its bucket files; ordinary adoption does not expire older records automatically.

Referrer stripping prevents a legacy absolute URL from identifying its build; such requests keep the pre-existing current-root fallback. Explicitly versioned imports remain pinned. Retained records preserve root paths, not historical bytes overwritten in a shared root. Published version-specific roots must remain intact; shared original export roots must continue to contain compatible data. Rollback records the outgoing build and removes the newly current build from retained history.

PR1272 preserves service-worker caches used by open pages and complements this server-side routing. PR1271 stops speculative downloads when cache writes fail. These changes are reviewed separately and require combined verification before publication. The original root session owns deployment.
