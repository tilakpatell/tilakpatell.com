# Avengers HQ PR 1: the splits and the HUD imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `world/rules.js` (2,139 lines) and `world/scene.js` (2,156) under 800 lines each by the barrel recipe, and take the HUD kit by its parts so `/avengers` stops loading the Battlefront screens and their data, with no visible change.

**Architecture:**
- `world/rules.js` becomes a barrel that re-exports its 91 names, each by name, from nine parts in a new folder beside it, `world/rules/` (a file beside a folder of the same name, as `minecraft/scene.js` + `scene/` and `rickmorty/world/interiors.js` + `interiors/`). The old path stays because `scripts/voices/export-lines.mjs:139` loads it by path.
- `world/scene.js` keeps its one export, `createCompoundWorld`, which `world/module.js:8` imports dynamically. It becomes the composer, calling six parts in `world/scene/` in exactly the old statement order, so every object, material and geometry is made in the same order and the picture is pixel-identical.
- `CompoundHud.jsx:3` and `CompoundWorld.jsx:16` import `hud.css` and each kit part from its own file under `src/runtime/hud/`, not `index.js`. Nothing under `src/runtime/hud/` changes (open draft #1028 owns it).

**Tech Stack:** React 19, three.js 0.186 on the site’s world runtime, Vite 8 (its manifest at `dist/.vite/manifest.json`), Vitest 5, playwright-core 1.56 and sharp under the check scripts.

**Spec:** `docs/superpowers/specs/2026-10-18-avengers-hq-fix-and-hub-design.md` (as amended in `30dd1241`): §10 and §11 step 1, checked as §12 says; §3 for the rules every change keeps. The spec wins over this plan. PR 1 of 7; the index is `docs/superpowers/plans/2026-10-18-avengers-hq.md`. This PR consumes nothing from another PR; PR 2 edits `world/rules/progress.js` and `world/scene/doors.js`, which exist only after it, and every later PR imports through the barrel whose 91 names it pins.

## Global Constraints

- §3: “Splits by the barrel recipe (`RULES.md:21-32`): the old path becomes a barrel with the same export names, no caller changes in the same PR, before and after screenshots pixel-identical.”
- §10: pixel-identical before and after shots with `docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs` (“it holds the clock, so it is the pixel gate”); `scripts/hq-world-check.mjs` “runs as the error check and for the eye”.
- The index: the FL2 `compound` target is not pixel-stable against main itself (FL2 README: 64 px; the brief’s scratch run: 83 px), so main is shot twice and a target passes at 0 px against either run (Task 2 Steps 1 and 6, Task 4 Step 2).
- §10: “`CompoundHud.jsx` imports the kit parts it uses from their files, not the barrel. Measure the `/avengers` closure before and after from the build manifest. If the barrel itself should stop re-exporting `Screen`, that is a change to `runtime/hud` and goes through #1028’s owner.”
- `docs/health/RULES.md:73` (a world takes its HUD kit from `index.js` only) is set aside here by spec §10; the PR body names it beside `index.js`’s header for #1028’s owner. Neither file changes.
- §11: “1. The splits and the HUD import (§10). No visible change.” One PR, merged before PR 2, green.
- `RULES.md`, Size: “A file stays under 800 lines; 1,500 is the ceiling the measure counts (`big-files`).” Each part exports what it exported before, with the signature it had.
- §3: “Pure, seeded rules with tests beside them, each under one second, no network. No test is loosened, skipped or deleted.” `rules.test.js` and every other importer of `rules.js` stay byte-identical; `scene.js` changes only by its own split (Task 2) and still reads `./rules`.
- §3: “Worlds are islands … Nothing here adds a cross-world import.” The one there is (`createGhosts` from `middleearth/towns/ghosts`) moves with the cast; `boundary-breaks` stays 487.
- §3: “One runtime renderer, one live 3D view a page. No new renderers or animation loops; the HQ modules stay `'glsl'` until their FL3 port, which is the FL2 session’s.” `glsl-sites` stays 607.
- §3: “Every `tp-hq-*` key keeps its name and shape … every achievement, sound, ghost and dev hook (`__HQWORLD__`, `__HQ__`) keeps working.”
- §3: “No new depictions of Marvel characters, suits or marks, drawn in code or generated.” This PR draws nothing new; moved drawing code stays as it was.
- `RULES.md`, Never: “Reformat lines you aren’t moving. Rename for taste. Raise a budget without a sentence saying why in the commit.” Moved lines keep their text and their (long) lengths; no formatter runs on these files.
- Nothing under `src/runtime/hud/` or `src/components/guide/pages.js` changes (open draft #1028).
- Scratch files live in the session’s scratchpad, `$S`, never under the repo: this PR’s under `$S/pr1/`, and its manifest script once at `$S/closure.mjs`, which every later PR reuses unchanged.
- Copy in comments, commits and the PR: British spelling, curly quotes, sentence case, no Oxford comma. No model names anywhere.
- §12, before the PR is done: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; `git checkout public/github.json` after a build; the screenshots read; the `/avengers` closure’s size stated in the PR.

## Review Focus

1. **Draw order.** A part called out of the old order, or an `await` slipped in between waking the cast and the lawn props, shifts object ids, and the glass doors, beams and gems can draw in a different order: the compound flickers or reads differently. Pinned by `scene.test.js` › “awaits nothing from waking the cast to the lawn props” (Task 2) and by the pixel gate (Task 2 Step 6, Task 4 Step 2).
2. **A figure that arrives late.** On a slow connection Thor, Natasha or the Hulk is swapped in after the floor light is baked; passed `ground` by value (still `null` when the cast wakes), the figure would never be tracked by it and would stand unlit. The 90-frame shots may finish before the swap, so they cannot see it. Pinned by `scene.test.js` › “lends the cast the floor light as a getter” (Task 2).
3. **Leaving while the figures load.** Leaving `/avengers` before the swaps finish must stop them (the old `gone = true` in `dispose`), or a model lands in a disposed scene. Pinned by `scene.test.js` › “stops the cast’s late swaps when the world is disposed” (Task 2).
4. **The HUD’s look.** The barrel was what loaded the kit’s tokens (`hud.css`). Loaded later than before, or not at all, the HUD’s glass, chips and Menu change on desktop and the Stick and touch buttons on a phone. Pinned by `CompoundWorld.test.js` › “loads the kit’s tokens before its parts” (Task 3) and the desktop and phone shots (Task 4 Step 3).
5. **The voice lines.** `scripts/voices/export-lines.mjs` reads the compound’s `CAST` from `world/rules.js` by path; a barrel that dropped or renamed a name would quietly lose lines. Pinned by `rules.barrel.test.js` › the face test and the byte-for-byte compare of the export (Task 1 Step 6).

---

## Files

| Path | Action | Holds |
| --- | --- | --- |
| `src/components/avengers/world/rules.js` | rewrite | the barrel: a header and nine `export { … } from './rules/<part>';` lines |
| `src/components/avengers/world/rules/{plan,bump,tuning,aim,air,hero,camera,tour,progress}.js` | create | the old lines, by concern (Task 1’s table) |
| `src/components/avengers/world/rules.barrel.test.js` | create | the barrel’s face, its shape, the parts’ sizes |
| `src/components/avengers/world/scene.js` | rewrite | the composer of `createCompoundWorld` (about 410 lines) |
| `src/components/avengers/world/scene/{kit,terrain,buildings,doors,fx,cast}.js` | create | the old lines, by concern (Task 2’s table) |
| `src/components/avengers/world/scene.test.js` | create | sizes, the one export, the await-free stretch, the floor light, the stop |
| `src/components/avengers/world/CompoundHud.jsx` | modify line 3 | `hud.css` and seven parts by their files |
| `src/components/avengers/world/CompoundWorld.jsx` | modify line 16 | `fitCanvas` from `runtime/hud/canvas` |
| `src/components/avengers/world/CompoundWorld.test.js` | create | the compound’s static import closure; the tokens’ place |
| `docs/superpowers/evidence/avengers-hq/pr1/` | create | `README.md` (the numbers) and the before and after WebPs the PR shows |

`rules.barrel.test.js` sits beside `rules.js` rather than inside `rules.test.js` because `rules.test.js` is a caller and must not change.

---

### Task 1: Pin `rules.js`’s face, then split it into nine parts behind its barrel

**Files:**
- Modify: `src/components/avengers/world/rules.js:1-2139`
- Create: `src/components/avengers/world/rules/plan.js`, `bump.js`, `tuning.js`, `aim.js`, `air.js`, `hero.js`, `camera.js`, `tour.js`, `progress.js`
- Test: `src/components/avengers/world/rules.barrel.test.js`

**Interfaces:**
- Consumes: `rules.js` at `ddb364bf` (91 exports; imports `createPress` from `../../../lib/press` and `BERM, BRIDGE, CRES, CRES_FOOT, GATE, HANGAR, LAB, LAWN, PROW, RIVER, ROADS, STALLS, TRAINING, TREES, arcPt, inPoly` from `../compound/plan`). Its importers, none of which changes in this task: `world/scene.js:52` (split in Task 2), `lawnProps.js:16`, `grounds.js:13`, `packs.js:12`, `Place.jsx:15`, `CompoundHud.jsx:5`, `map.js:1`, `CompoundWorld.jsx:10`, `grass.js:15`, `thwip/scene.js:23`, `avengers/voicelines.js:13`, the tests `rules.test.js:3-73`, `people.test.js:4`, `lawnProps.test.js:4`, `lawnProps.data.test.js:2`, `castLife.test.js:2`, `voicelines.test.js:7`, and `scripts/voices/export-lines.mjs:139` (by path).
- Produces:
  - `world/rules.js`: exactly the 91 names in `FACE` below, as today. A later PR that adds a name to the barrel adds it to `FACE` in the same commit.
  - `world/rules/progress.js`: `export function progress(earned = [])` → `{ places, next, have, stones, portal, finished, objective, done }`, unchanged. PR 2 edits this file (to `progress(earned = [], unlocked = [])`, so the gate counts once Thwip is won and Things to do reaches 8/8).
  - `world/rules/plan.js`: `PLACES`, `placeById(id)`, `PORTAL`, `START`, `CAST`, `DOOR_R` and the rest of the plan’s names.
  - Inside names, exported by their part for its siblings and kept off the barrel: `plan.js` `EDGE`; `bump.js` `onLawn`, `atHeight`, `wallNormal`, `collide3`; `tuning.js` `turnTo`; `aim.js` `ropeFor`, `clearLine`; `air.js` `stepAir`, `stepWall`.
  - Scratch, not committed (Steps 1-2), for Task 3 Step 5 and Task 4: `$S/closure.mjs`; in `$S/pr1/`, `lines-before.json`, `closure-before.txt`, `avhq-pr1-before.webp`, `avhq-pr1-phone-before.webp`, `world-before/` and `inv-before/`.

- [ ] **Step 1: Branch, and record the voice lines before any edit**

`S` below is the session’s scratchpad directory (never under the repo).

```bash
git fetch origin main && git switch -c claude/avengers-hq-pr1-splits origin/main
mkdir -p $S/pr1 && node scripts/voices/export-lines.mjs --out $S/pr1/lines-before.json
```
Expected: a count of lines without a recording and `-> $S/pr1/lines-before.json` (about 9 s). Keep the file.

- [ ] **Step 2: Take the PR’s before numbers and pictures on the untouched tree**

Write `$S/closure.mjs` (run from the repo root; it walks the page chunk’s static `imports` in the manifest, the app entry left out). This is “PR 1’s manifest script”: PRs 2 to 7 save it unchanged as `$S/closure.mjs` and measure with it.

```js
import { readFileSync as r } from 'node:fs';
import { gzipSync as g } from 'node:zlib';
const m = JSON.parse(r('dist/.vite/manifest.json', 'utf8'));
const seen = new Set(), rows = [];
const v = (k) => { const c = m[k]; if (!c || seen.has(k) || c.isEntry) return; seen.add(k); for (const f of [c.file, ...(c.css ?? [])]) { const b = r(`dist/${f}`); rows.push([c.name ?? k, b.length, g(b).length, f]); } (c.imports ?? []).forEach(v); };
v('src/pages/Avengers.jsx');
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
console.log('/avengers static closure, app entry left out:', rows.length, 'files', kb(rows.reduce((s, x) => s + x[1], 0)), 'raw', kb(rows.reduce((s, x) => s + x[2], 0)), 'gzip');
for (const x of rows.sort((a, b) => b[1] - a[1])) console.log(' ', String(x[0]).padEnd(28), kb(x[1]).padStart(7), kb(x[2]).padStart(7), x[3]);
```

Then, one at a time:

```bash
npx vite build && node $S/closure.mjs | tee $S/pr1/closure-before.txt
node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --shots avhq-pr1 --before
node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --shots avhq-pr1-phone --before --phone
mv public/changes/avhq-pr1-before.webp public/changes/avhq-pr1-phone-before.webp $S/pr1/
npx vite --port 5173 --strictPort &   # leave it up for the two checks below, then stop it
OUT=$S/pr1/world-before node scripts/hq-world-check.mjs
OUT=$S/pr1/inv-before node scripts/inv-world-check.mjs
```
Expected: the closure about `85 files 1422 kB raw 363 kB gzip`, with rows for `shapes` (about 501 kB), the barrel’s `hud` chunk (about 110 kB, plus 16 kB of CSS), `strings` (74 kB), `films` (31 kB) and a bf2017 `layout` (3 kB); zero files means the manifest’s key for the page isn’t `src/pages/Avengers.jsx`, so grep the manifest for it. Each autopilot run ends `ok   everything green`. The world check prints `compound up in N s`, writes nine `hq-*.png` and ends `no page errors`; the Invincible check prints `city up in N s` and ends `no page errors`. `npx vite build` rather than `npm run build`, so `public/github.json` is not rewritten. `git status --short` is empty afterwards.

- [ ] **Step 3: Write the failing test**

```js
// src/components/avengers/world/rules.barrel.test.js
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as rules from './rules';

// rules.js before its split lent exactly these; its barrel lends the same
const FACE = ['ANCHORS', 'ARMOUR', 'BENCHES', 'BODY', 'BUILDINGS', 'CAST', 'CLERESTORY', 'COMMS', 'CORNERS', 'CRATER', 'DOOR_R', 'FLAGS', 'FLAG_H', 'GAIT', 'HERO', 'HERO_R', 'JUMP', 'LAMPS', 'LAP', 'LAWN_PROPS', 'LAWN_TREES', 'LAWN_W', 'MASTS', 'MAST_H', 'PACKS', 'PACK_R', 'PARKED_CARS', 'PARKED_JET', 'PERCHES', 'PHOTO', 'PLACES', 'PLANTERS', 'PORTAL', 'RING_R', 'RIVER_W', 'ROADS_W', 'ROAD_HALF', 'ROOF_LIGHTS', 'ROOF_PLANT', 'ROUND', 'S', 'SETTINGS', 'SETTINGS_DEFAULTS', 'SOLIDS', 'START', 'SUIT', 'SWING', 'TOUR', 'TOUR_GAP', 'TRICK', 'V', 'aimWeb', 'behindYaw', 'camRoom', 'cameraMove', 'collide', 'findPerch', 'floorAt', 'gaitFor', 'inJet', 'jumpPress', 'lapAt', 'linesFor', 'nearArmour', 'nearCast', 'nearPack', 'nearPlace', 'nearestEdge', 'newHero', 'newPhoto', 'newTour', 'outside', 'pastAnchor', 'photoView', 'placeById', 'progress', 'readLap', 'readPhoto', 'readSettings', 'recordLap', 'samplePath', 'solidById', 'stepHero', 'stepTour', 'swingArc', 'swingPose', 'throughRing', 'toWorld', 'treeHeight', 'underPortal', 'walkable'];
const PARTS = ['plan', 'bump', 'tuning', 'aim', 'air', 'hero', 'camera', 'tour', 'progress'];
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('world/rules.js, the barrel', () => {
  it('lends exactly the names rules.js had before its split', () => {
    expect(FACE).toHaveLength(91);
    expect(Object.keys(rules).sort()).toEqual(FACE);
  });

  it('is re-exports from its nine parts and nothing else', () => {
    const code = read('./rules.js').replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ');
    const statements = code.split(';').map((s) => s.trim()).filter(Boolean);
    expect(statements.map((s) => s.match(/^export \{ [\w, ]+ \} from '\.\/rules\/(\w+)'$/)?.[1])).toEqual(PARTS);
  });

  it('keeps each part under 800 lines (docs/health/RULES.md, Size)', () => {
    expect(PARTS.filter((p) => read(`./rules/${p}.js`).split('\n').length >= 800)).toEqual([]);
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run src/components/avengers/world/rules.barrel.test.js`
Expected: `Tests  2 failed | 1 passed (3)`. The face already matches today’s file; the shape test fails on the old statements and the size test on `ENOENT … rules/plan.js`.

- [ ] **Step 5: Split `rules.js` into the nine parts and make it their barrel**

Cut whole line ranges from the old file in their original order; no reformatting, no renames. Each part starts with a two-to-four-line header comment saying what it holds, then its imports (one line each, as the file has them), then the moved lines. The only edits to moved lines are `export ` in front of the ten inside names. Parts import each other directly, never through `../rules` (that would make a cycle through the barrel).

| Part | Old lines, in order | Imports | `export ` added to | Names on the barrel |
| --- | --- | --- | --- | --- |
| `plan.js` | 13-549 (keeps `export { ARMOUR, CRATER };` at old 337) | old line 11 with the path `../../compound/plan` | `EDGE` (old 63) | `ARMOUR, BENCHES, BUILDINGS, CAST, CLERESTORY, COMMS, CRATER, DOOR_R, FLAGS, FLAG_H, HERO_R, LAMPS, LAWN_PROPS, LAWN_TREES, LAWN_W, MASTS, MAST_H, PARKED_CARS, PARKED_JET, PLACES, PLANTERS, PORTAL, RIVER_W, ROADS_W, ROAD_HALF, ROOF_LIGHTS, ROOF_PLANT, ROUND, S, SOLIDS, START, V, linesFor, nearCast, nearestEdge, placeById, samplePath, solidById, toWorld` |
| `bump.js` | 551-730 | `inPoly` from `../../compound/plan`; `EDGE, HERO_R, LAWN_W, ROUND, SOLIDS, nearestEdge` from `./plan` | `onLawn` (579), `atHeight` (608), `wallNormal` (665), `collide3` (685) | `BODY, collide, floorAt, walkable` |
| `tuning.js` | 732-858, a blank line, 970-976 | `ARMOUR` from `./plan` | `turnTo` (971) | `GAIT, HERO, SETTINGS, SETTINGS_DEFAULTS, SUIT, SWING, TRICK, gaitFor, nearArmour, readSettings` |
| `aim.js` | 1045-1051, 1103-1161, 1706-1851 | `inPoly` from `../../compound/plan`; `BUILDINGS, FLAGS, FLAG_H, LAWN_TREES, LAWN_W, MASTS, MAST_H, RIVER_W, SOLIDS, solidById` from `./plan`; `floorAt, wallNormal` from `./bump`; `SWING` from `./tuning` | `ropeFor` (1048), `clearLine` (1772) | `ANCHORS, CORNERS, PERCHES, aimWeb, findPerch, treeHeight` |
| `air.js` | 978-992, 1035-1043, 1053-1101, 1339-1704, 2109-2139 | `inPoly` from `../../compound/plan`; `EDGE, HERO_R, SOLIDS, nearestEdge, solidById` from `./plan`; `atHeight, collide3, floorAt, onLawn, wallNormal` from `./bump`; `HERO, SWING, TRICK, turnTo` from `./tuning`; `CORNERS, aimWeb, clearLine, ropeFor` from `./aim` | `stepAir` (1429), `stepWall` (1628) | `pastAnchor, swingArc, swingPose` |
| `hero.js` | 860-968, 994-1033, 1163-1337, 1929-1945 | `createPress` from `../../../../lib/press`; `DOOR_R, HERO_R, PLACES, PORTAL, START` from `./plan`; `collide, collide3, floorAt` from `./bump`; `HERO, SUIT, SWING, TRICK, nearArmour, turnTo` from `./tuning`; `findPerch` from `./aim`; `stepAir, stepWall` from `./air` | none | `JUMP, jumpPress, nearPlace, newHero, outside, stepHero, underPortal` |
| `camera.js` | 1853-1927 | `inPoly` from `../../compound/plan`; `LAWN_W, PARKED_JET, SOLIDS, nearestEdge` from `./plan`; `floorAt` from `./bump` | none | `PHOTO, behindYaw, camRoom, cameraMove, inJet, newPhoto, photoView, readPhoto` |
| `tour.js` | 1947-2083 | `CRES` from `../../compound/plan`; `FLAGS, FLAG_H, MASTS, MAST_H, S, solidById` from `./plan` | none | `LAP, PACKS, PACK_R, RING_R, TOUR, TOUR_GAP, lapAt, nearPack, newTour, readLap, recordLap, stepTour, throughRing` |
| `progress.js` | 2085-2107 | `PLACES` from `./plan` | none | `progress` |

Why this cut, where it departs from the spec’s five concerns: the hero’s step is about 800 lines alone, so it splits into `hero.js` (the ground, perch, zip, suit and trick modes, where you are) and `air.js` (swing, release, corner, flight, walls, the swing pose); `aim.js` needs `SWING` while `hero.js` needs `findPerch`, so the numbers and `turnTo` go into a leaf, `tuning.js`; collisions and the camera are concerns of their own. `nearestEdge` and `EDGE` stay in `plan.js` because `openAt` (old 404) calls `nearestEdge` while `LAMPS` (old 420) is built at module load. The import graph is `plan ← bump ← tuning ← aim ← air ← hero`, with `camera`, `tour` and `progress` reading only `plan` and `bump`: no cycle, and every value made at load (`CORNERS`, `PERCHES`, `ANCHORS`, `PACKS`, `LAMPS` … `ROUND`) reads only parts that load before it.

`rules.js` becomes: old lines 1-8 as its header, plus a short paragraph naming the nine parts and saying “The names here are the old rules.js’s (rules.barrel.test.js pins them); callers move to the parts later, if ever.”; then nine `export { … } from './rules/<part>';` lines, in the `PARTS` order, each naming the last column above in full. No `export *`: the inside names stay off the face.

- [ ] **Step 6: Run the tests, the lint and the checks**

```bash
npx vitest run src/components/avengers/world/rules.barrel.test.js
npx vitest run src/components/avengers src/components/universe/landings
npx eslint src/components/avengers/world
git status --short
git show HEAD:src/components/avengers/world/rules.js > $S/pr1/rules-old.js && cat src/components/avengers/world/rules/*.js | grep -v '^import\|^//' | grep -vxFf $S/pr1/rules-old.js
node scripts/voices/export-lines.mjs --out $S/pr1/lines-after.json && cmp $S/pr1/lines-before.json $S/pr1/lines-after.json && echo same
node scripts/health.mjs --only big-files,cycles,boundary-breaks
wc -l src/components/avengers/world/rules.js src/components/avengers/world/rules/*.js
```
Expected, in order: `Tests  3 passed (3)`; `Test Files  39 passed (39)`, `Tests  506 passed (506)` (from 38 and 503; `rules.test.js` still 89); no lint output; `git status` lists only ` M …/rules.js`, `?? …/rules/` and `?? …/rules.barrel.test.js`; the moved-line check prints exactly ten lines, the ten inside names’ declarations with `export ` in front (`export const EDGE = 1.4; …` through `export function stepWall(…`); `same`; `big-files 29`, `cycles 5`, `boundary-breaks 487`; every file under 800 lines (the largest `plan.js` about 550, `air.js` about 490). A `no-undef` or `no-unused-vars` error means an import list is wrong; a `cycles` rise means a part imported the barrel.

- [ ] **Step 7: Commit**

```bash
git add src/components/avengers/world/rules.js src/components/avengers/world/rules src/components/avengers/world/rules.barrel.test.js
git commit
```
Subject: `world/rules.js under its 800 lines: nine parts in world/rules/, the old path their barrel`. Body: the nine parts and what each holds (one clause each); that the barrel re-exports the 91 names by name, so no caller changes and the voices export is byte-identical; that every moved line is the old file’s and ten inside names gained an `export` for their siblings and stay off the barrel; no import cycle. End with the session’s attribution lines.

---

### Task 2: Split `scene.js` into six parts, with `scene.js` the composer

**Files:**
- Modify: `src/components/avengers/world/scene.js:1-2156`
- Create: `src/components/avengers/world/scene/kit.js`, `terrain.js`, `buildings.js`, `doors.js`, `fx.js`, `cast.js`
- Test: `src/components/avengers/world/scene.test.js`

**Interfaces:**
- Consumes: the barrel from Task 1 (`../rules` from inside `world/scene/`); `world/module.js:8` `load: () => import('./scene').then((m) => m.createCompoundWorld)`, unchanged.
- Produces (signatures exact; later PRs edit these files):
  - `scene/kit.js`: `SC`, `P3(x, y, z = 0)`, `cloudU`, `cloudy(mat, key = 'cloudy')`, `weathered(mat, { foot, streaks, panel } = {})`, `matte(mat, lo = 0.82)`, `grounded(mat, ao)`, `groundShade(feet, { px, reach } = {})`, `ribbon(points, w, y, tile = 8)`, `waterNormal()`, `targetTexture()`, `blobTexture()`, `signTexture(text)`, `beamMaterial(color)`, `ease(k)`.
  - `scene/terrain.js`: `async buildGround({ scene, engine, small, env })` → `{ grain, flats, grass, waterN }`; `async buildWoods({ scene, small, sunDir })` → `undefined`; `async buildCrater({ scene, small, earth })` → `{ uru }`.
  - `scene/buildings.js`: `async buildBuildings({ scene, env, small, grain, flats })` → `{ earth, apronMat, frameMat }`.
  - `scene/doors.js`: `buildDoors({ scene, env, white })` → `{ frameMat }`; `buildMarkers(scene)` → `placeMarkers(s, clock)`; `buildSpacePortal(scene)` → `{ portal, portalBeam }`. It keeps the module-private `STONE_OF` (old 58) and the `STONES` import that the gem colour (old 1456) reads; PR 2 deletes both and writes the colour as `stoneFor(p)?.color ?? p.accent` from `../labels`. Old 1791 `m.gem.visible = won;` lives here, in `placeMarkers`; PR 2 guards it as `won && Boolean(p.stone)`. This is the one “doors” module; PR 4’s door prefetch is `world/warm.js`.
  - `scene/fx.js`: `buildJets({ scene, env, calm, v3 })` → `{ jet, vfx, placeJet(t, dt) }`; `createEvents({ A, calm, hero, packs, people, squash, swing, vfx, v3, v3b })` → `fx(type, d = {})`.
  - `scene/cast.js`: `async buildCast({ scene, small })` → `{ hero, heroTop, spidey, cap, moves, drive, ghosts, people }`; `wakeCast({ cast, scene, engine, calm, vfx, frameMat, floorLight })` → `{ placeArmour(h, dt), get armour(), stop() }` (synchronous); `createPosing({ cast, life, A, squash })` → `{ R, placeHero(h, dt, say = null, clock), placePeople(s, dt, clock) }`.
  - `createCompoundWorld(rt, { calm })` → `{ engine, ground, scene, render, prepare, fx, screenOf, resize, info, lost, skipIntro, dispose }`, unchanged; `__HQWORLD__` works as before.
  - Scratch, not committed: `$S/pr1/main-a/` and `main-b/` (Step 1), for Step 6 and Task 4 Step 2.

- [ ] **Step 1: Shoot main twice, the pixel references**

```bash
BASE=$(git merge-base HEAD origin/main)
T=compound,repulsor,lawn,ricochet,trickshot,widow,smash,thwip,tesseract,titan,invworld,thinkmark,viewer
node docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs --ref "$BASE" --out $S/pr1/main-a --only $T
node docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs --ref "$BASE" --out $S/pr1/main-b --only $T
node docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs --compare $S/pr1/main-a $S/pr1/main-b
```
Run them one after the other in the background (20 minutes or more each in software); editing meanwhile is fine, but run no build and no other browser check until both finish, or the loading can pass the harness’s settle and make false differences. Expected: each `report.json` shows `ok: true` for all thirteen targets; the compare is main’s own noise floor (in the brief’s scratch run of the ten Avengers targets, 83 px at 1/255 on the compound and Titan’s known second outcome; FL2’s README gives ThinkMark two outcomes too, 887 px apart). `invworld`, `thinkmark` and `viewer` are there because the index’s Review Focus 5 pins Invincible by them in this PR. Task 4 reuses these shots.

- [ ] **Step 2: Write the failing test**

```js
// src/components/avengers/world/scene.test.js
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
const read = (p) => readFileSync(here(p), 'utf8');
const lines = (p) => read(p).split('\n').length;
const code = (p) => read(p).replace(/\/\/.*$/gm, ''); // (comments left out)

describe('world/scene.js and its parts', () => {
  it('keeps scene.js and each of its six parts under 800 lines', () => {
    expect(lines('./scene.js')).toBeLessThan(800);
    const parts = readdirSync(here('./scene/')).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js')).sort();
    expect(parts).toEqual(['buildings.js', 'cast.js', 'doors.js', 'fx.js', 'kit.js', 'terrain.js']);
    expect(parts.filter((f) => lines(`./scene/${f}`) >= 800)).toEqual([]);
  });

  it('still lends createCompoundWorld and nothing else (./module.js imports it)', () => {
    expect(read('./scene.js').match(/^export\b.*$/gm)).toEqual(['export async function createCompoundWorld(rt, { calm = false } = {}) {']);
  });

  it('awaits nothing from waking the cast to the lawn props, as before the split', () => {
    const src = code('./scene.js');
    const from = src.indexOf('wakeCast({');
    const to = src.indexOf('await createLawnProps(');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(src.slice(from, to)).not.toMatch(/\bawait\b/);
  });

  it('lends the cast the floor light as a getter, so a figure that arrives after the bake is still lit', () => {
    expect(code('./scene.js')).toMatch(/floorLight: \(\) => ground\b/);
    expect(code('./scene/cast.js')).toMatch(/floorLight\(\)\?\.track\(/);
  });

  it('stops the cast’s late swaps when the world is disposed', () => {
    expect(code('./scene.js')).toMatch(/life\.stop\(\)/);
    expect(code('./scene.js')).not.toMatch(/\bgone = true/);
    expect(code('./scene/cast.js')).toMatch(/stop\(\) \{\s*gone = true;?\s*\}/);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/components/avengers/world/scene.test.js`
Expected: `Tests  4 failed | 1 passed (5)`, the first with `expected 2157 to be less than 800`; the one-export test passes on today’s file.

- [ ] **Step 4: Split `scene.js` into the six parts and the composer**

The rule for pixel identity: every scene object, material and geometry is made in the same order as today, and nothing is awaited from starting the swaps (old 1354) to `await createLawnProps` (old 2114). So the composer calls the parts in the old statement order, and the cast is an async build (all of its awaits) plus a synchronous wake (the swaps and the armour). Moved lines stay as they were, indentation included, apart from the edits named here. Imports: what each part’s lines use, from the paths `scene.js` used (one more `../` deep); rules names from `../rules`; `STONES` goes with `STONE_OF` to `doors.js`; `createGhosts` (`../../../middleearth/towns/ghosts`) goes to `cast.js` alone; no part imports `../scene`. `no-undef` and `no-unused-vars` prove the lists.

| Part | Body, from old lines | Edits |
| --- | --- | --- |
| `kit.js` | 55-57, 59-399 at module level | `export` on the 14 helpers; add `export const ease = (k) => k * k * (3 - 2 * k);` (old 1054, now at module level). `cloudU` stays one module-level object, so `render`’s `cloudU.value.set` still reaches every material. |
| `terrain.js` | `buildGround`: 437-475, 477-621, `return { grain, flats, grass, waterN };` · `buildWoods`: 942-948, 950-1026 (its own `m4`, `q`, `v3`) · `buildCrater`: 1128-1153, `return { uru };` | old 476 and 949 stay in the composer |
| `buildings.js` | 623-839; `const { frameMat } = buildDoors({ scene, env, white });` where 841-877 was; 879-921; 923-940; `return { earth, apronMat, frameMat };` | the doors are drawn where they always were, between the landing pad and the masts |
| `doors.js` | old 58 (`STONE_OF`, module level) · `buildDoors`: 841-877, `return { frameMat };` · `buildMarkers`: 1441-1464 then 1776-1797, `return placeMarkers;` · `buildSpacePortal`: 1466-1475, `return { portal, portalBeam };` | 1776 `const placeMarkers = (s) => {` → `(s, clock) => {` |
| `fx.js` | `buildJets`: 1028-1053, 1055-1126, `return { jet, vfx, placeJet };` (the vfx pool still made at old 1050) · `createEvents`: 1998-2061, `return fx;` | |
| `cast.js` | `buildCast`: 1155-1308, 1310-1326, returning its eight names · `wakeCast`: `const { people } = cast;`, 1309, 1328-1360, 1362-1439, returning `{ placeArmour, get armour() { return armour; }, stop() { gone = true; } }` · `createPosing`: `const { hero, spidey, cap, moves, drive, people } = cast; const { placeArmour } = life;`, 1498-1741, 1743-1774, `return { R, placeHero, placePeople };` | 1352 `ground?.track(` → `floorLight()?.track(`; 1514 `offPose = (h) =>` → `(h, clock) =>`; 1658 and 1668 `offPose(h)` → `offPose(h, clock)`; 1643 `placeSpidey = (h, dt, say = null) =>` → `(h, dt, say = null, clock) =>`; 1708 `placeHero = (h, dt, say = null) =>` → `(h, dt, say = null, clock) =>`; 1710 `\|\| !armour` → `\|\| !life.armour`; 1713 `placeSpidey(h, dt, say)` → `placeSpidey(h, dt, say, clock)`; 1748 `placePeople = (s, dt) =>` → `(s, dt, clock) =>` |

`clock` becomes a parameter rather than a shared object: only these signature and call lines change, every read inside the bodies stays as it was. `gone` lives in `wakeCast`; `ground` (assigned at the bake) reaches the swaps through the getter.

`scene.js`, the composer, in this order:
1. Old 1-15 as the header, plus a paragraph naming the six parts; the imports cut down to what remains (`THREE`, `createStage`, `preload`, `createFeel`, `feelGroups`, `createSpring`, `springGroups`, `device`, `createDust`, `wireImpacts`, `groundWorld`, `createLawnProps`, `createSwing`, `createFlags`, `createRings`, `createPacks`, `LOOK`, the rules names it reads, and the parts).
2. Old 401-435.
3. `const { grain, flats, grass, waterN } = await buildGround({ scene, engine, small, env });` then `let ground = null;` (old 476).
4. `const { earth, apronMat, frameMat } = await buildBuildings({ scene, env, small, grain, flats });`
5. `await buildWoods({ scene, small, sunDir });` then `const v3 = new THREE.Vector3(); const v3b = new THREE.Vector3();`
6. `const { jet, vfx, placeJet } = buildJets({ scene, env, calm, v3 });`
7. `const { uru } = await buildCrater({ scene, small, earth });`
8. `const cast = await buildCast({ scene, small });` and `const { hero, heroTop, spidey, ghosts, people, moves } = cast;`
9. `const life = wakeCast({ cast, scene, engine, calm, vfx, frameMat, floorLight: () => ground });` with a comment that nothing is awaited from here to the lawn props, as before.
10. `const placeMarkers = buildMarkers(scene);`, `const { portal, portalBeam } = buildSpacePortal(scene);`, `let portalOpen = 0;` (old 1476).
11. Old 1478-1496, then `const { R, placeHero, placePeople } = createPosing({ cast, life, A, squash });`
12. Old 1799-1996 with 1806 → `placeHero(s.hero, dt, s.say, clock);`, 1810 → `placePeople(s, dt, clock);`, 1812 → `placeMarkers(s, clock);`
13. `const fx = createEvents({ A, calm, hero, packs, people, squash, swing, vfx, v3, v3b });`
14. Old 2063-2156 with 2136 `gone = true;` → `life.stop();`

Sizes measured in the brief’s scratch copy, before header comments: `scene.js` 408, `kit` 352, `terrain` 320, `buildings` 299, `doors` 117, `fx` 177, `cast` 602; 17 GLSL sites as today (`kit` 9, `terrain` 8).

- [ ] **Step 5: Run the tests, the lint and the measure**

```bash
npx vitest run src/components/avengers/world/scene.test.js
npx eslint src/components/avengers/world
git status --short
git show HEAD:src/components/avengers/world/scene.js > $S/pr1/scene-old.js && cat src/components/avengers/world/scene.js src/components/avengers/world/scene/*.js | grep -v '^import\|^//' | grep -vxFf $S/pr1/scene-old.js
node scripts/health.mjs --only big-files,cycles,boundary-breaks,glsl-sites,art-mix,hud-kit
npx vitest run src/components/avengers src/components/universe/landings
```
Expected: `Tests  5 passed (5)`; no lint output; `git status` lists only ` M …/scene.js`, `?? …/scene/` and `?? …/scene.test.js`; the moved-line check prints only the new joins (the parts’ `export` keywords and first lines, their destructuring, `return` lines and closing braces, `ease`, the composer’s calls of items 3-13) and the edits in the table and items 12 and 14, nothing else; `big-files 28`, `cycles 5`, `boundary-breaks 487`, `glsl-sites 607`, `art-mix 7`, `hud-kit 1`; `Test Files  40 passed (40)`, `Tests  511 passed (511)`.

- [ ] **Step 6: Check the pictures against main**

```bash
node docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs --out $S/pr1/t2 --only compound,repulsor,titan
for b in main-a main-b; do node docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs --compare $S/pr1/t2 $S/pr1/$b; done   # (t2 first: it holds three of the thirteen)
```
Expected: `report.json` shows `ok: true` and `errors: []` for each target; each of `compound.png`, `repulsor.png` and `titan.png` reads `0 pixels differ` against at least one main run (Titan may instead sit 2 px off one, its known pair of outcomes, FL2’s README). Any other difference means a part ran out of order or something was awaited in the stretch: fix it before committing. If a target is off both main runs by no more than main-a against main-b in the same place, shoot main a third time (`main-c`) before calling it a failure.

- [ ] **Step 7: Commit**

```bash
git add src/components/avengers/world/scene.js src/components/avengers/world/scene src/components/avengers/world/scene.test.js
git commit
```
Subject: `world/scene.js under its 800 lines: the compound drawn by six parts in world/scene/`. Body: `scene.js` stays the composer of its one export and calls the parts in the order the old function ran them; the six parts and what each draws; the cast built in two steps so nothing is awaited between starting the swaps and the lawn props, as before; the clock passed to the posing as a parameter; every other moved line the old file’s; the shots with the clock held 0 px against main. End with the session’s attribution lines.

---

### Task 3: Take the HUD kit by its parts: no Battlefront screens or data in `/avengers`

**Files:**
- Modify: `src/components/avengers/world/CompoundHud.jsx:3`, `src/components/avengers/world/CompoundWorld.jsx:16`
- Test: `src/components/avengers/world/CompoundWorld.test.js`

**Interfaces:**
- Consumes: the kit parts’ files under `src/runtime/hud/`: `Hud.jsx` (default `Hud`), `Menu.jsx` (default `Menu`, named `MenuItem`), `Objective.jsx`, `Toast.jsx`, `Bubble.jsx`, `Stick.jsx`, `TouchButton.jsx` (defaults), `canvas.js` (named `fitCanvas`), `hud.css` (the tokens, which `index.js:4` loaded first). From `scripts/health/graph.mjs`: `FROM`, `SIDE_EFFECT`, `uncomment(text)`, `async resolve(specifier, from)` → absolute paths (a `src` test importing `scripts/` has precedent in `galaxy/battleCrews/voicelines.test.js:4`).
- Produces: the compound’s static import closure holds no `runtime/hud/index.js`, `Screen.jsx`, `ScreenCanvas.jsx`, `Film.jsx` and nothing under `src/lib/bf2017/` or `src/data/bf2017/`, and `CompoundWorld.test.js` holds it there. Later PRs that use more kit parts (the `Toast` of §5, for example) import them the same way, `'../../../runtime/hud/<Part>'`, never the barrel, or this test fails. Scratch, not committed: `$S/pr1/closure-after.txt` (Step 5), for Task 4.

- [ ] **Step 1: Write the failing test**

```js
// src/components/avengers/world/CompoundWorld.test.js
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FROM, SIDE_EFFECT, resolve, uncomment } from '../../../../scripts/health/graph.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

// every file a module brings with it as it loads: its imports and side-effect
// imports, followed (an import() loads later, so it's left out); repo paths
async function loadsWith(entry) {
  const seen = new Set([entry]);
  const todo = [entry];
  while (todo.length) {
    const file = todo.pop();
    if (!/\.(m?js|jsx)$/.test(file)) continue;
    const text = uncomment(await readFile(file, 'utf8'));
    for (const re of [FROM, SIDE_EFFECT]) {
      for (const m of text.matchAll(re)) {
        for (const f of await resolve(m[2], file)) {
          if (!seen.has(f)) {
            seen.add(f);
            todo.push(f);
          }
        }
      }
    }
  }
  return [...seen].map((f) => f.slice(ROOT.length));
}

describe('CompoundWorld, what it loads with it', () => {
  it('takes the HUD kit’s parts and tokens, not its barrel, so no Battlefront screen or data comes with it', async () => {
    const files = await loadsWith(`${ROOT}src/components/avengers/world/CompoundWorld.jsx`);
    expect(files).toEqual(expect.arrayContaining(['src/runtime/hud/hud.css', 'src/runtime/hud/Hud.jsx', 'src/runtime/hud/Menu.jsx', 'src/runtime/hud/canvas.js']));
    expect(files.filter((f) => /^src\/runtime\/hud\/(index\.js|Screen\.jsx|ScreenCanvas\.jsx|Film\.jsx)$/.test(f))).toEqual([]);
    expect(files.filter((f) => /^src\/(lib|data)\/bf2017\//.test(f))).toEqual([]);
  });

  it('loads the kit’s tokens before its parts, where the barrel loaded them', () => {
    const src = readFileSync(new URL('./CompoundHud.jsx', import.meta.url), 'utf8');
    const css = src.indexOf("import '../../../runtime/hud/hud.css';");
    expect(css).toBeGreaterThan(-1);
    expect(src.slice(0, css)).not.toMatch(/runtime\/hud/);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/avengers/world/CompoundWorld.test.js`
Expected: `Tests  2 failed (2)`; the first lists `src/runtime/hud/index.js`, `Film.jsx`, `Screen.jsx` and `ScreenCanvas.jsx` as received.

- [ ] **Step 3: Import the parts by their files**

- `CompoundHud.jsx:3` (`import { Bubble, Hud, Menu, MenuItem, Objective, Stick, Toast, TouchButton } from '../../../runtime/hud';`) becomes, in this order: a comment `// the kit by its parts: its barrel (index.js) brings the Battlefront screens and their data`; `import '../../../runtime/hud/hud.css';`; `import Hud from '../../../runtime/hud/Hud.jsx';` (named in full because `hud.js` sits beside it, as `index.js:6` says); `import Menu, { MenuItem } from '../../../runtime/hud/Menu';`; then `Objective`, `Toast`, `Bubble`, `Stick`, `TouchButton`, each `import X from '../../../runtime/hud/X';`. `hud.css` comes first where the barrel had it, so the tokens still load after `world.css` (`CompoundWorld.jsx:12`).
- `CompoundWorld.jsx:16` → `import { fitCanvas } from '../../../runtime/hud/canvas';`
- `map.js` imports only `./rules` and `./labels` and needs nothing. Nothing under `src/runtime/hud/` changes. #1028 adds parts and lines to `index.js` but renames none of these files, so these imports hold whichever of the two merges first. The CSS that stops loading on `/avengers` (`screen.css`, `film.css`, `screenCanvas.css`) styles only `.hud-screen*`, `.film*` and `@keyframes hud-screen-reveal`, none of which the page uses.

- [ ] **Step 4: Run the tests, the lint and the measure**

```bash
npx vitest run src/components/avengers/world/CompoundWorld.test.js
npx eslint src/components/avengers/world
npx vitest run src/components/avengers src/components/universe/landings
node scripts/health.mjs --only hud-kit,boundary-breaks
git status --short
```
Expected: `Tests  2 passed (2)` in well under a second (about 175 ms); no lint output; `Test Files  41 passed (41)`, `Tests  513 passed (513)`; `hud-kit 1` (the compound still counts as on the kit: `hud-kit.mjs`’s `KIT` accepts `runtime/hud/<part>`) and `boundary-breaks 487`; only the two `.jsx` files modified and the test new.

- [ ] **Step 5: Measure the closure after**

```bash
npx vite build && node $S/closure.mjs | tee $S/pr1/closure-after.txt
```
Expected: about `80 files 707 kB raw 260 kB gzip` against Step 2 of Task 1’s `85 files 1422 kB raw 363 kB gzip`; the `shapes`, `strings`, `films` and barrel `hud` rows and the bf2017 `layout` row are gone, and a `canvas` chunk (about 8 kB of JS, 13 kB of CSS) appears. If any of those rows is still listed, find which chunk’s `imports` brings it (the chunker can merge parts back into a chunk shared with `Screen`) before going on.

- [ ] **Step 6: Commit**

```bash
git add src/components/avengers/world/CompoundHud.jsx src/components/avengers/world/CompoundWorld.jsx src/components/avengers/world/CompoundWorld.test.js
git commit
```
Subject: `The compound takes the HUD kit by its parts: no Battlefront screens or data in /avengers`. Body: the barrel re-exports `Screen` and `ScreenCanvas`, and with them came `lib/bf2017`’s shapes, strings, films and icons; the two files now import `hud.css` first and each part from its file, as `invincible/world/scene.js` and `GalaxySurface.jsx` already do; `CompoundWorld.test.js` holds the closure to it; the closure before and after from the manifest (the two lines of Step 5 and Task 1 Step 2); nothing under `runtime/hud` changes, and whether the barrel should stop lending `Screen` is #1028’s owner’s call. End with the session’s attribution lines.

---

### Task 4: The whole PR through the gates, the pictures proved, and the pull request

**Files:**
- Create: `docs/superpowers/evidence/avengers-hq/pr1/README.md`, `before/avengers.webp`, `before/avengers-phone.webp`, `after/avengers.webp`, `after/invincible.webp`, `after/avengers-phone.webp`, `after/invincible-phone.webp`

**Interfaces:**
- Consumes: Tasks 1-3’s commits; `$S/pr1/main-a` and `main-b` (Task 2 Step 1); `$S/pr1/closure-before.txt` and `closure-after.txt`; the before pictures and world checks in `$S/pr1/` (Task 1 Step 2).
- Produces: the merged PR. For PR 2: `world/rules/progress.js` and `world/scene/doors.js` on `main`.

- [ ] **Step 1: The four gates**

```bash
npm run lint && npm test && npm run build && git checkout public/github.json && node scripts/health.mjs --check --skip build
```
Expected: lint clean; every test file passes; the build green; the health table with `big-files 28` (budget 30, ok) and the rest at their baselines (`cycles 5`, `boundary-breaks 487`, `glsl-sites 607`, `hud-kit 1`, `art-mix 7`), then `within budget` and the flight-island gate passing. No budget is lowered here: the steward ratchets after the merge (`docs/health/README.md`, “The ratchet”).

- [ ] **Step 2: The pixel gate on every `/avengers` target**

```bash
T=compound,repulsor,lawn,ricochet,trickshot,widow,smash,thwip,tesseract,titan,invworld,thinkmark,viewer
node docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs --out $S/pr1/after --only $T
for b in main-a main-b; do node docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs --compare $S/pr1/$b $S/pr1/after; done
```
Expected: `ok: true` for all thirteen; each target `0 pixels differ` against at least one main run (`compound` by the index’s two-run rule, `invworld`, `thinkmark` and `viewer` as they are), Titan allowed its known 2 px against one; the same third-run rule as Task 2 Step 6. Read `after/compound.png` beside `main-a/compound.png`: the HUD’s title, the objective glass, the map, the `0 of 6` and `0 of 12` chips, Menu and the hint pill match. Any other difference blocks the PR.

- [ ] **Step 3: Smoke and phone, and read the pictures**

```bash
node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --shots avhq-pr1
node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --shots avhq-pr1-phone --phone
```
Expected: both end `ok   everything green`. Read `public/changes/avhq-pr1-a.webp` against `$S/pr1/avhq-pr1-before.webp`, and the phone pair (the touch Stick and buttons are now direct imports): the compound’s HUD matches; the clock isn’t held here, so judge by eye. Then move the four new WebPs out of `public/changes/` (this is not a ship’s-log change): `avhq-pr1-a` → `evidence/avengers-hq/pr1/after/avengers.webp`, `-b` → `after/invincible.webp`, the phone `-a` and `-b` → `after/avengers-phone.webp` and `after/invincible-phone.webp`, and the two before pictures from `$S/pr1/` → `before/avengers.webp` and `before/avengers-phone.webp`. `git status --short public/changes` is empty.

- [ ] **Step 4: The world checks, for errors and the eye**

```bash
npx vite --port 5173 --strictPort &   # stop it afterwards
OUT=$S/pr1/world-after node scripts/hq-world-check.mjs
OUT=$S/pr1/inv-after node scripts/inv-world-check.mjs
```
Expected: `compound up in N s`, nine `hq-*.png`, `no page errors`; `city up in N s`, `no page errors`. Compare each pair with Task 1 Step 2’s by eye. `hq/` is not touched by this PR, so the Invincible check is a guard for errors; the index’s Review Focus 5 names this PR, and Step 2’s `invworld`, `thinkmark` and `viewer` shots are its pixel gate.

- [ ] **Step 5: Write the evidence README and commit it with the pictures**

`docs/superpowers/evidence/avengers-hq/pr1/README.md`: what was checked and how (one line each, with the commands’ names); the hq-shots table (target, main-a against main-b, main-a against after, main-b against after); the closure’s total line and the rows that went, before and after; the health numbers (`big-files` 30 → 28, the rest unchanged); the test counts (38 files and 503 tests → 41 and 513 across `avengers` and `universe/landings`; `rules.test.js` 89, untouched); that the voices export is byte-identical. Each WebP stays well under 1 MB (`doc-binaries` counts those over it).

```bash
git add docs/superpowers/evidence/avengers-hq/pr1
git commit
```
Subject: `Avengers HQ PR 1: the evidence, the shots against main and the closure`. End with the session’s attribution lines.

- [ ] **Step 6: Open the pull request and merge it when green**

```bash
git push -u origin claude/avengers-hq-pr1-splits
```
Open the PR against `main` (the GitHub tool, or `gh pr create`). Title: `Avengers HQ 1 of 7: the compound’s rules and scene in parts, and the HUD kit by its parts`. Body:
- one paragraph: no visible change; `rules.js` a barrel over nine parts with the same 91 names, `scene.js` the composer over six, the compound taking the HUD kit by its parts; no caller changed;
- the numbers, before → after: `/avengers` static closure (files, raw, gzip, from `dist/.vite/manifest.json`); `big-files` 30 → 28; tests 503 → 513 in the two folders;
- the pixel table from the README, and the before and after pictures as images from the branch’s raw URL, `https://raw.githubusercontent.com/tilakpatell/tilakpatell.com/claude/avengers-hq-pr1-splits/docs/superpowers/evidence/avengers-hq/pr1/<before|after>/<name>.webp`;
- the checks that ran, each with its result;
- not in this PR: `runtime/hud/index.js` still lends `Screen`, and its header and `docs/health/RULES.md:73` still say a world takes the kit from it only, which spec §10 sets aside here; all three are #1028’s owner’s to change;
- the plan’s path and the PR footer the harness gives.

Expected: CI green. Merge with a merge commit (`merge_method: merge`), never a squash or rebase; never force-push. Then `git fetch origin main`. A red check is fixed with a new commit on the branch.
