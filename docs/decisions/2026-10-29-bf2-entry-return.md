# Battlefront entry and return routing

The live HTTP audit on 2026-10-29 at approximately 15:55 UTC found:

| Request | Live response before this change |
| --- | --- |
| `/battlefront` | 404 HTML fallback |
| `/battlefront/` | 404 HTML fallback |
| `/battlefront/engine` | 404 HTML fallback |
| `/battlefront/engine/` | 302 to `r1035-2ecc1d16/` |
| `/battlefront/engine/r1035-2ecc1d16` | 200 HTML without a canonical redirect |
| `/battlefront/engine/r1035-2ecc1d16/` | 200 HTML |

The audit used Node `fetch` with `redirect: 'manual'` against
`https://tilakpatell.com`, reading only status, Location, Cache-Control and
Content-Type. No engine, GPU or retail content was loaded.

Wrangler previously ran the Worker only for `/battlefront/engine/*`, leaving
the three bare addresses to the static 404 handler. They now reach the Worker
and redirect to the current build directory with the query intact. A current
build URL without its final slash also redirects: otherwise relative runtime
module and asset URLs resolve above the build directory. These redirects use
`Cache-Control: no-store` because deployment can change the destination.

The injected `Back to the site` link previously targeted `/#/battlefront`.
`src/pages/Battlefront.jsx` calls `engineOnly` and immediately navigates back
to the engine when supported, so that link could not leave the game. Its
default destination is now `/#/`, the site's home. A validated galaxy `from`
still returns to that galaxy and a completed round's Quit keeps its existing
behavior. No game rules or original frontend behavior are recreated here.

Validation on base `cd911e86ca66eda1599069bdfcd89efef1c50e1e`:

- New entry/return regressions failed before the fix: 3 failed, 25 passed.
- Six focused suites passed after the fix: 58 tests (`play`, `playReturn`,
  `worker`, `engineCache`, `playTimers`, `source`). The entry matrix checks
  the actual Wrangler path list, query preservation, redirect status/cache
  policy, and relative module resolution.
- ESLint passed for all four changed JavaScript source/test files;
  `git diff --check` passed.
- The sparse worktree used a local Vitest configuration selecting these
  suites with one worker and a local cache directory; the full site build,
  GPU execution and deployment were not run. The deployment coordinator
  owns publishing and must verify the live entry URLs after deployment.

The build pointer, upload workflow and engine files are unchanged. This is
navigation evidence, not original-engine or visual-parity acceptance.
