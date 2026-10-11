# Battlefront 2017, lane S1: the fleet on the game’s hulls. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. Starts from `origin/main`.

**Goal:** every ship the galaxy draws in space, in the war and in the starfighter mode is the game’s where the game has it: the capitals from the space lane’s kits at the fleet’s cut with the game’s 1,024 maps on ultra, the fighters and the Falcon and Slave I on lane V’s native files, the scimitar and the TIE striker imported, the Starfighter Assault’s fallbacks on the kits, the player’s ship and cockpit the game’s, the far copies remade, the credits retired with the files.

**Spec:** `docs/superpowers/specs/2026-10-11-bf2017-galaxy-in-space-design.md`, decisions 1 and 2; the space lane’s section of `docs/superpowers/HANDOFF-bf2017.md` (the kits, `bf2017-space.mjs --fleet`); lane V’s section (the import path, the fleet files, `galaxy-lod.mjs`).

**Tech stack:** `scripts/bf2017-fleet.mjs` and `scripts/lib/bf2017-space.mjs` (`KITS`), `scripts/bf2017-import.mjs`, `scripts/galaxy-lod.mjs`, `src/components/galaxy/models.js` (`MODELS`, `MADE`), `src/components/galaxy/warfront.js` (the fallbacks), `src/components/universe/shipModels.js`, `src/components/galaxy/scene.js` (`buildCab`), `src/data/modelCredits.json`, `public/games/credits.json`, `scripts/lib/bf2017-owners.mjs`.

## Global constraints

- The era rule: the Resurgent, the First Order’s ships and Starkiller stay out (`isSequel`).
- A hull’s file is written by the script, never by hand; the plain, `.lod1` and `.ultra` cuts and the far copy as lane V wrote them; maps are the game’s KTX2, top levels dropped for a smaller cut, never re-encoded.
- The fleet files stay committed where lane V committed them (`galaxy/models.test.js` measures them); the kits’ ultra cuts and 1,024 maps go to the bucket by hash (`assets-publish.mjs --only`), never through git. If your session is refused the bucket write, message the parent session (session_01282C5tuJnxtHN4SCrT1kct) with the branch, the commit and the exact `--only` globs; it publishes and commits the manifest on your branch.
- No model the game lacks is replaced (the Executor, the Acclamator, the Gozanti, the Lambda, the Coreship, the B-wing, the Ghost, the IG-2000, the Delta-7, the Nubian, the Munificent, the Death Stars, the Interdictor, the Razor Crest): they are listed in the hand-off as “not in the drop”.
- One PR for the lane, draft, with `origin/main` merged in before it keeping both sides; the five checks (`npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `npm run coverage:bf2017`); never a test skipped or quieted; a budget row raised only with its reason written beside it.
- British spelling, curly quotes, `_source` on every number in docs and comments. Keys never printed or committed.

## Review focus

1. **Nothing drawn twice.** The space levels’ hulls (`spacePieces.js`) stay scenery; the war’s slots (`models.js`) draw the fleet. A system with a level must not show a kit capital from both (`starfighter-check.mjs`’s hidden-pack box test still proves the pack draws the flagship).
2. **The cut.** Every capital at the fleet’s cut (24,000 triangles, `_source`: lane V’s `bf2017-fleet.mjs`) on mid and high, the ultra cut above it where the row allows; the far copy under 2,000 triangles. `BUDGET=1 galaxy-check space endor,kamino,naboo,hoth,tatooine,yavin` at every tier within its rows, or the breach written as a finding with its numbers.
3. **The credits.** Every row that leaves `modelCredits.json` and `games/credits.json` leaves because its file is gone; a file still drawn anywhere keeps its row (`credits.test.js`, `models.test.js`).

---

### Task 1: The capitals from the kits

- Modify: `scripts/bf2017-fleet.mjs` (`space` rows for `destroyer` ← `endor-isd`’s kit, `moncal` ← `endor-mc80`, `venator` ← `kamino-venator`, `corvette` ← `corvettecr90-01`, `providence` ← `providenceclassdreadnaught-01`; the Nebulon-B’s HQ row from the drop’s native model; each at the fleet’s cut, bow to +z, with its `.ultra` cut and 1,024 maps), `scripts/lib/bf2017-space.mjs` (`KITS` rows the fleet needs that `--fleet` lacks), `src/components/galaxy/models.js` (`MODELS` rows: the game file replaces the third-party one for each; `MADE` loses nothing that isn’t replaced)
- Test: `scripts/bf2017-fleet.test.mjs` (a row per capital: file, triangles under the cut, maps at the tier’s size), `src/components/galaxy/models.test.js` (the rows name the game files; the sizes it measures)
- [ ] Failing test → FAIL → write the rows, run `node scripts/bf2017-fleet.mjs destroyer,moncal,venator,corvette,providence,nebulon` then `node scripts/galaxy-lod.mjs destroyer moncal venator corvette providence nebulon` → PASS. Commit `The war’s capitals on the game’s kits`.

### Task 2: The fighters, the Falcon and Slave I native

- Modify: `src/components/galaxy/models.js` (`xwing` ← `surface/xwing.glb` with `xwing65` as its OT row, `interceptor` ← `surface/tieinterceptor.glb`, `falcon` ← `surface/falcon.glb`, `slave1` ← `surface/slave1.glb`; `MADE`’s gen3d X-wing row retired), `src/components/universe/glbFleet.js` (`GLB.xwing`)
- Test: `models.test.js` (each row’s file exists in the manifest or on disk; the far copy exists)
- [ ] Failing test → FAIL → change the rows, `galaxy-lod.mjs xwing interceptor falcon slave1` → PASS. Commit `The galaxy’s X-wing, interceptor, Falcon and Slave I on the game’s files`.

### Task 3: The scimitar and the TIE striker imported

- Modify: `scripts/bf2017-import.mjs` (two rows the way lane V’s fighters are written: the drop’s model and its maps, three cuts), `scripts/lib/bf2017-owners.mjs` (the two folders move from lane 4 to `space`, with the reason: drawn by the galaxy’s fleet), `models.js` (`scimitar`, `tiestriker` rows)
- Test: `scripts/bf2017-import.vehicles.test.mjs` (the two rows), `scripts/bf2017-coverage.test.mjs` (the ownership moves, coverage stays at 0 unowned)
- [ ] Failing test → FAIL → import, `galaxy-lod.mjs scimitar tiestriker` → PASS; `npm run coverage:bf2017` 0 unowned. Commit `The scimitar and the TIE striker from the drop`.

### Task 4: The Starfighter Assault’s fallbacks

- Modify: `src/components/galaxy/warfront.js` (`unhide`’s fallback kinds resolve to the game rows task 1 wrote; a hull the pack has at the tier is never doubled)
- Test: `warfront.test.js` (Endor’s three CR90s fall to the game corvette on low; on high the pack draws them and the slot is hidden), `node scripts/starfighter-check.mjs endor high` and `kamino high`
- [ ] Failing test → FAIL → implement → PASS. Commit `The space battles’ stand-ins on the game’s hulls`.

### Task 5: The player’s ship and cockpit

- Modify: `src/components/universe/shipModels.js` (`SHIP_MODELS`: the X-wing ← `surface/xwing.glb`, the Falcon ← `surface/falcon.glb`; the RV stays Meshy’s, the cruiser built), `src/components/galaxy/scene.js` (`buildCab`: the game’s cockpit GLB for the kit flown where lane V imported one (`surface/xwingcockpit.glb`, `falconcockpit.glb`, and each kit fighter’s), the procedural cab for the RV and the cruiser; the cockpit’s camera at the game’s eye point read from the GLB’s camera node or its hand-off row)
- Test: `shipModels.test.js` (the rows), `scene`’s cockpit test (the cab loads for xwing and falcon, the built one for rv; no console error), `node scripts/galaxy-check.mjs space tatooine` with `?ship=xwing` and `?cockpit=1` shots at high
- [ ] Failing test → FAIL → implement → PASS. Commit `The player flies the game’s ship from the game’s cockpit`.

### Task 6: The sheet, the credits, the hand-off, the PR

- Modify: `docs/superpowers/evidence/bf2017-space/fleet-2017.webp` (the sheet re-shot: each kit beside the file it replaces, at high, the same camera), `src/data/modelCredits.json` and `public/games/credits.json` (the rows retired with their files; a file still drawn keeps its row), `docs/superpowers/HANDOFF-bf2017.md` (this lane’s section: Done / Where the code and the plan differed / Left (the kinds not in the drop, named) / Checking it; the lanes table row with the PR number and this session’s id)
- Test: `credits.test.js`, `models.test.js`; the five checks; `BUDGET=1 BUDGET_REPORT=1 QUALITY=<tier> node scripts/galaxy-check.mjs space endor,kamino,naboo,hoth,tatooine,yavin,fondor` at low, mid, high and ultra (fondor once E5’s system is on `main`; else named as left)
- [ ] Shots and gate output in `docs/superpowers/evidence/bf2017-space/s1/`; `origin/main` merged keeping both sides; the draft PR with the gates’ table and the sheet; message the parent session with the PR number, the head sha and the gate numbers. Commit `Lane S1: the hand-off and the sheet`.
