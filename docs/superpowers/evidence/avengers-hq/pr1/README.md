# Avengers HQ PR 1: the splits and the HUD imports

The evidence for PR 1 of the fix, frame and hub plan (`docs/superpowers/plans/2026-10-18-avengers-hq-pr1-splits.md`). No visible change was intended; this is what was checked and what came out. Measured in the container under SwiftShader on 2026-10-19, against the branch point `c7d51fb86` (main at `a486bd86e` with the design docs).

## What was checked

- **Pixels**, with FL2’s held-clock shots (`docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs`), on the two targets whose code imports the changed files: `compound` (`world/scene.js`, `world/rules.js`) and `thwip` (`thwip/scene.js` takes `GAIT` and `gaitFor` from `world/rules.js`). Main was shot twice.
- **Smoke and pictures**, `scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible`, desktop and `--phone`, before and after (`before/`, `after/`). `/` fails before and after alike under SwiftShader (“no canvas: the 3D never started”); the two routes this PR touches pass.
- **The compound**, `scripts/hq-world-check.mjs` before and after: up in 47.9 s and 52.5 s, nine shots each, no page errors; the same frame-guard warnings (shaders compiled as the credited models stream in) in both.
- **Invincible**, `scripts/inv-world-check.mjs` before: city up in 44.5 s, no page errors. It imports none of the changed files.
- **The voices export**, `scripts/voices/export-lines.mjs`, before and after the rules split: byte-identical.

## Pixels

| target | main-a against main-b | main-a against after | main-b against after |
| --- | --- | --- | --- |
| `compound` | 0 px | 2 px (16/255) | 2 px (16/255) |
| `thwip` | 0 px | 0 px | 0 px |

The compound’s two pixels are at x 7, y 789 and 794 of 1280 × 800: the anti-aliased edge of the site’s own pill at the bottom left (`App.jsx`), HTML outside the compound’s canvas and HUD, the edge FL2’s README records as main-against-main noise. The stylesheets this PR stops loading on `/avengers` (`film.css`, `screen.css`, `screenCanvas.css`, `cluster.css`) style only `.film`, `.hud-screen` and the flight cluster, none of which the page uses.

## The `/avengers` closure

From `dist/.vite/manifest.json`, the page’s static imports with the app entry left out:

| | files | raw | gzip |
| --- | --- | --- | --- |
| before | 88 | 1,449 kB | 371 kB |
| after | 82 | 721 kB | 265 kB |

Gone: `shapes` (501 kB), the barrel’s `hud` chunk (113 kB and 26 kB of CSS), `strings` (74 kB) and `films` (31 kB), the Battlefront screens’ data.

## The measure and the tests

- `big-files` 29 → 28 (budget 30); `cycles` 5, `boundary-breaks` 482, `glsl-sites` 607, `art-mix` 7, `hud-kit` 0: unchanged.
- `world/rules.js` 2,139 → 26 lines (a barrel over nine parts, the largest 543); `world/scene.js` 2,156 → 1,397 lines (four parts, the largest 354). The cast, Mjolnir’s crater, the Quinjets and the buildings with the roof mark stay in `scene.js` as they were.
- Tests in `src/components/avengers` and `src/components/universe/landings`: 38 files and 503 tests → 41 and 511 (`rules.barrel.test.js` 3, `scene.test.js` 4, `CompoundWorld.test.js` 2; `rules.test.js` untouched).
- `npm test`: 18,032 passed; two Star Wars tests (`scripts/lib/bf2017-hulls.test.mjs`, `galaxy/surface/missions/blast.test.js`) failed under the full run’s load and pass alone; this PR touches nothing they import.
