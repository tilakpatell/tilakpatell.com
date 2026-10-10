# Battlefront 2017, lane E0: the level factory. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** `scripts/bf2017-level.mjs` makes a pack for any usable map with everything the map holds beside `level.json` (lights, decals, actors, vehicle spawns, effect spawns, tracks, probes, the far shadow, the scatter table, the shapes, the collision meshes), the packs live in `site-assets` and not in git, a world can hold several maps as districts and interiors, and Endor stands on Endor_01 with Hoth's base interior as the first interior pack.

**Architecture:** Lane L's script and loader (`scripts/lib/bf2017-level.mjs`, `src/components/galaxy/surface/level/`) extended, not replaced: each new part is one pure writer in `scripts/lib/` and one reader in `src/lib/` or `level/`, keyed by a file beside `level.json`. Districts are rows on a site; an interior is a pack with `inside: true` loaded by the zone. Hosting moves to `assets-publish.mjs`.

**Tech Stack:** the lane L modules above; `scripts/bf2017-lights.mjs` (exists); `src/lib/three/light/placed.js` (exists, lane R); `src/components/galaxy/surface/level/levelPhysics.js` (P0); `scripts/assets-publish.mjs`, `scripts/lib/asset-manifest.mjs`; `scripts/galaxy-check.mjs`, `anim-check.mjs`, `surface-shot.mjs`; Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` (§3 lane E, E0; §7 items 1, 2, 4, 5; §8 A1 to A3).

## Global Constraints

- Lane L's and P0's constraints: the native rule (the game's KTX2, mips dropped per tier by `TEX`), the per-tier texture bytes in the README, cells of 128 m, `BUDGET=1` gates at low, mid, high, ultra; the era rule.
- A part a map lacks is an empty file (`[]` or `{}`), never a missing one; a loader that finds no file logs once and draws nothing.
- Nothing raw reaches a visitor: every file is cut and published; `level.json` and `README.md` stay committed.
- A pack's new parts are read by the loader they belong to and by no other (`lights.json` by `placed.js`, `effects.json` by fidelity X's `createEffects` when it exists, else nothing).
- Files under 800 lines (`bf2017-level.mjs` the lib is near it: new parts go in new modules); British spelling and curly quotes; commits one plain sentence with the attribution lines.

## Review Focus

1. **Hoth after the move out of git**: a checkout with no pack bytes must still pass `sites/ice.test.js`, `levelPack.test.js` and `crew.budget.test.js` (they read `level.json` and the manifest's `bytes`); task 1's test reads a published row's bytes through `galaxyAssets.json`.
2. **A district route with an unknown id** (`?district=nowhere`) lands at the default district, never a blank world (task 3's test on `districtOf(site, id)`).
3. **A placed actor whose kind the site lacks** (a `kullbee` before lane A) is listed in `actors.json`'s `unplaced` and never spawned (task 4's test).
4. **A decal whose texture is missing from the bucket** is skipped and counted (task 5's test on `decalsJson` with a listing that lacks it).
5. **A track that names an instance the arena cut dropped** does nothing and says so once (task 6's test).

---

### Task 1: The packs leave git

**Files:**
- Modify: `scripts/lib/asset-manifest.mjs` (`gameFiles` also walks `public/models/galaxy/bf2017/levels/**` except `level.json` and `README.md`; `KEPT` unchanged), `scripts/assets-upload.mjs` (`REMOTE` loses `models/galaxy/bf2017`: the published files are not mirrored twice), `src/components/galaxy/surface/level/levelPack.js` (`packUrl(world, path, manifest = GALAXY)` returns the published URL when the manifest names `models/galaxy/bf2017/levels/<world>/<path>`, else the site path), `src/components/galaxy/surface/level/index.js` (`bytesOf` uses the new `packUrl`), `.gitignore` (the block), `src/data/galaxyAssets.json`
- Test: `src/components/galaxy/surface/level/levelPack.test.js`, `scripts/lib/asset-manifest.test.mjs`

- [ ] **Step 1: Failing tests**: `packUrl('hoth', 'cells/0,0.glb', { 'models/galaxy/bf2017/levels/hoth/cells/0,0.glb': { hash: 'abc', bytes: 1 } })` → the `site-assets` URL `publishedPath` makes; without the row → `/models/galaxy/bf2017/levels/hoth/cells/0,0.glb`; `gameFiles` on a temp public dir with a pack lists its cells and not `level.json`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** `node scripts/assets-publish.mjs --only 'models/galaxy/bf2017/levels/hoth/*'`; `node scripts/assets-check.mjs`; `git rm --cached` the published files (the ignore block does it on the next publish; check `git status` shows the 896 deletions and the two kept). **Step 4: Run** → PASS; `npx vitest run src/components/galaxy/surface/sites src/components/galaxy/surface/level src/components/galaxy/surface/crew.budget.test.js` green with no pack bytes on disk (`mv` the folder aside to prove it).
- [ ] **Step 5: Commit** `Level packs are published, not committed; Hoth's leaves git`.

### Task 2: One command, any map

**Files:**
- Modify: `scripts/bf2017-level.mjs` (flags `--district <id>` (the pack folder is `levels/<world>/<district>/`; default `main` writes `levels/<world>/` as today), `--inside` (no terrain; `inside: true`, `bounds` from the extent, `origin` the sub-level's door from `--spot`), `--spawn` (the spot from the map's first spawn area via `scripts/bf2017-data.mjs`'s map rulebook when `--spot` is absent)), `scripts/lib/bf2017-level.mjs` (`buildPack` takes `{ inside, bounds }`), `scripts/lib/bf2017-level-spots.mjs` (new: `spotFrom(mapRulebook) → { spot: [x, z], yaw }` from the first team's first spawn area)
- Test: `scripts/lib/bf2017-level.test.mjs`, `scripts/lib/bf2017-level-spots.test.mjs`

- [ ] **Step 1: Failing tests**: `buildPack({ inside: true, … })` on the fixture → `json.terrain` null, `json.inside` true, `json.bounds` the extent; `spotFrom` on a trimmed Hoth map rulebook (`src/data/bf2017/maps/hoth.json`) → the Rebel first spawn's `[x, z]`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The level script takes any map, a district and an interior`.

### Task 3: Districts

**Files:**
- Modify: `src/components/galaxy/surface/sites/index.js` (header: `districts: [{ id, name, level, land: { at, yaw }, line }]`; `districtOf(site, id) → district` (the default `{ id: 'main', level: site.level, land: site.land }` when id is absent or unknown)), `src/pages/GalaxySurface.jsx` (`?district=` read into the scene's site: `level` and `land` from `districtOf`), `src/components/galaxy/GalaxyPanel.jsx` (a "Land at" row per district when the site has any), `src/components/galaxy/surface/scene.js` (a zone with `to: { district }` leaves for `?district=<id>` the way the ship's leave does)
- Test: `src/components/galaxy/surface/sites/sites.test.js` (`districtOf`), `src/components/galaxy/surface/sites/validity.test.js` (every district's `level` pack has a committed `level.json`)

- [ ] **Step 1: Failing tests**: Review Focus 2; a site with two districts → `districtOf(site, 'jabba').level === 'tatooine/jabba'`; validity on a fixture site with a district naming a missing pack → an error naming it.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A world may hold several of the game's maps, as districts`.

### Task 4: Actors and vehicle spawns from the map

**Files:**
- Create: `scripts/lib/bf2017-level-actors.mjs` (`actorsJson(extras, pack, { kinds }) → { life: [{ kind, at: [x, z], yaw, y }], unplaced: [{ blueprint, count }] }`: the extras' `actor` rows mapped by `KIND_OF` (the game's blueprint name → `crewList.js` kind: `Actor_Creature_Tauntaun` → `tauntaun`, the stormtrooper, officer, civilians, droids as phase 2 named them; rebased as lights are); `vehiclesJson(extras, pack) → { rides: [{ kind, at, yaw }], walkers: [...] }` by `catalog/bf2017-vehicles.js`'s kinds)
- Modify: `scripts/bf2017-level.mjs` (writes `actors.json`, `vehicles.json`), `src/components/galaxy/surface/scene.js` (a site with `level` reads the pack's `actors.json` into its `life` rows and `vehicles.json` into `rides`/`walkers` after the site's own; `sites/*.js` rows that duplicate a placed one go in E1 to E5)
- Test: `scripts/lib/bf2017-level-actors.test.mjs`, fixture `scripts/fixtures/bf2017/web/maps/levels/mp/hoth_01/hoth_01.extras.json` trimmed to twenty actors and five vehicles

- [ ] **Step 1: Failing tests**: Review Focus 3; a `Actor_Creature_Tauntaun` at a game position → `{ kind: 'tauntaun', at }` in the pack frame; an AT-AT spawn → `walkers: [{ kind: 'atat' }]`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The map's placed creatures, droids, civilians and vehicles stand where the game put them`.

### Task 5: Decals

**Files:**
- Create: `scripts/lib/bf2017-level-decals.mjs` (`decalsJson(extras, pack, { listing }) → { decals: [{ kind: 'volume' | 'projected', position, quaternion, scale, tex, cell }], skipped }`; its textures through lane L's `tierTexture` sizes into the pack's `tex`), `src/lib/three/decals.js` (`createDecals(scene, { loadTexture, tier }) → { set(list), update(camera), dispose }`: a box-projected decal on the node renderer (`three/addons` `DecalGeometry` against the cell's meshes is too heavy for 13,984; a unit box with the projection in the material's node), a planar quad with the texture on GLSL; `DECAL_POOL` 64 by tier `{ low: 0, mid: 24, high: 64, ultra: 128 }`, the nearest by cell as `placed.js` ranks lights)
- Modify: `scripts/bf2017-level.mjs` (writes `decals.json`), `src/components/galaxy/surface/level/index.js` (the stream's `onCell` hands the cell's decals to `createDecals`)
- Test: `scripts/lib/bf2017-level-decals.test.mjs`, `src/lib/three/decals.test.js` (pure: the pool pick by distance)

- [ ] **Step 1: Failing tests**: Review Focus 4; a volume decal's box from the extras' transform; `pick(list, cells, max)` → the nearest `max`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The game's placed decals, by cell, in a pool`.

### Task 6: Tracks, probes, the far shadow and the scatter table

**Files:**
- Create: `scripts/lib/bf2017-level-tracks.mjs` (`tracksJson(animtracks, pack) → [{ instance, channel, keys: [[t, v, inX, inY, outX, outY]] }]` for the tracks whose owner object is placed in the arena), `src/lib/three/tracks.js` (`evalTrack(keys, t) → v` Hermite; `createTracks(level, list) → { update(t), dispose }` driving the instance's node by channel: `rotation.y`, `position.y`, as the key names say), `scripts/lib/bf2017-level-probes.mjs` (`probesJson(level, listing) → [{ id, variant, bounds, faces: [path×6] }]`, the faces cut to 64² into `tex/probes/`), `src/components/galaxy/surface/level/levelProbes.js` (the nearest probe into `probeEnv.js`'s slot as the visitor moves; lane R's grid takes the list when present)
- Modify: `scripts/bf2017-level.mjs` (writes `tracks.json`, `probes.json`, `scatter.json` (the terrain's row from `maps/terrain_scatter/` copied as is), `shadowCache` in `level.json` (the cache's path and the sun frame from the VE record, lane S reads it)), `src/components/galaxy/surface/level/index.js`
- Test: `scripts/lib/bf2017-level-tracks.test.mjs`, `src/lib/three/tracks.test.js` (the fixture asteroid track: `evalTrack` at 0 → 0, at 30 → 360, mid-way between), `scripts/lib/bf2017-level-probes.test.mjs`

- [ ] **Step 1: Failing tests**: Review Focus 5; the Hermite values above; probes on a fixture listing → the ids and bounds.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A pack carries its tracks, probes, far shadow and scatter table`.

### Task 7: Lights and effects beside every pack; the collision meshes

**Files:**
- Modify: `scripts/bf2017-level.mjs` (runs `bf2017-lights.mjs`'s `lightsJson` and writes `lights.json`; writes `effects.json` as `[{ name, position, quaternion, cell }]`; for a mesh with no row in `physics.jsonl`, fetches its `web/collision/` GLB and packs it as the cell's solid (`shapesBin` format P0 reads, `kind: 'collision'`)), `src/components/galaxy/surface/level/index.js` (`createPlacedLights` fed from the pack's `lights.json` when the renderer is the node renderer, as lane R's entry says; on GLSL the three nearest as point lights), `src/components/galaxy/surface/level/colliders.js` (on the tiers without the engine, the near cells' collision meshes as the walker's solids through `shapeSolids`, in place of the derived boxes where a mesh has one)
- Test: `src/components/galaxy/surface/level/colliders.test.js`, `scripts/lib/bf2017-level.test.mjs`

- [ ] **Step 1: Failing tests**: a pack cell with a `collision` solid → `createColliders` adds it as a mesh solid, not a box; the Hoth fixture's extras → `effects.json` rows with cells.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Every pack carries its lights, effect spawns and collision solids`.

### Task 8: Endor on Endor_01; Hoth's base inside; the detail maps

**Files:**
- Create: the packs: `node scripts/bf2017-level.mjs levels/mp/endor_01 --world endor --spawn`; `node scripts/bf2017-level.mjs levels/mp/hoth_01 --world hoth --district base --inside --subs <the base's sub-levels from the README>`; both published
- Modify: `src/components/galaxy/surface/sites/forest.js` (Endor's site: `level: 'endor'`; its built kit rows for the bunker, the platform and the trees go; its `life` keeps what the pack's `actors.json` lacks), `src/components/galaxy/surface/sites/ice.js` (`districts: [{ id: 'base', name: 'Echo Base', level: 'hoth/base', land, line }]`; the `echoinside` zone's door leads `to: { district: 'base' }`), `src/components/galaxy/surface/level/levelScene.js` (the detail normal: a material family's `DetailNS` map from the preset, applied as a second normal at the preset's tiling on high and ultra; `scripts/lib/bf2017-level-detail.mjs` maps a material's `extras.shader` to the preset's detail map name), `scripts/bf2017-level.mjs`
- Test: `src/components/galaxy/surface/sites/sites.test.js`, `scripts/lib/bf2017-level-detail.test.mjs`

- [ ] **Step 1: Failing tests**: `detailFor('SS_Hoth_Snow')` → the preset's `DetailNS` map name; Endor's site has `level: 'endor'`; Hoth's district validity.
- [ ] **Step 2: Run** → FAIL. **Step 3: Build the packs; implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Gates**: `BUDGET=1 QUALITY=<each> node scripts/galaxy-check.mjs surface endor` at low, mid, high, ultra; `hoth` again; `anim-check.mjs --route '#/galaxy/endor/surface'`; shots to `docs/superpowers/evidence/bf2017-levels/endor/` and `hoth/base/`; the README tables.
- [ ] **Step 6: Commit** `Endor on the game's level; Echo Base's inside as the game built it`.

### Task 9: The hand-off and the PR

- [ ] `HANDOFF-bf2017.md` section "The fifth design": E0 done, the command lines for E1 to E5 (one per map, with the `--spawn` default and where a spot was chosen by hand), what the packs weigh; the ledger refreshed (`node scripts/bf2017-coverage.mjs`) when lane Z is on `main`.
- [ ] `npm run lint`, `npm test`, `npx vite build`; merge `origin/main`; PR titled `The level factory: any of the game's maps as a world, a district or an interior, with everything the map holds`.
