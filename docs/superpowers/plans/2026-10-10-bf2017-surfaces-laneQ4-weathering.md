# Battlefront 2017 surfaces, lane Q4: weathering and decals. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** The world's weather lies on its things as the game lays it: snow, sand or wet on the up-facing, sky-visible faces of every material that allows it, accumulating over the record's seconds; and the maps' placed decals draw on the level's surfaces. Proved on the lit fixture (a crate under Hoth's day whitening over the blizzard's time; ten of Naboo's decals on the wall), then on the first packed world with decals.

**Architecture:** Three pure overlay contributors (`snowOverlay`, `sandOverlay`, `wetOverlay`) written to lane Q1's hook contract (`(ctx) → { color?, roughness?, metalness?, normal? }`), parameterised from the weather record's `GlobalWeatheringParamsEntityData` and the material's gates; wired into Q1's `createGameMaterial` through `overlays` when both merge (this lane tests them against the contract with stub nodes and on the fixture with its own minimal node material). A CLI writes `decals.json` per cell beside a pack; `src/lib/three/decals/` draws projected decals as merged `DecalGeometry` per cell and texture, and volume decals as a depth-sampling box on the node renderer.

**Tech Stack:** Node 22, three `^0.186.1` (`three/tsl`: `normalWorld`, `positionWorld`, `smoothstep`, `mix`, `time`; `three/addons/geometries/DecalGeometry.js`; `three/webgpu` `VolumeNodeMaterial` for the volume decals, `viewportDepthTexture` for the depth), lane L's pack and `levelScene.js`, lane R's `three.js` loader and `entry.js` (`entry.record`), phase 0's import for the decal textures, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md` (§5 "Weathering and decals", "Q4"); Q1's plan's Global Constraints for the hook contract.

## Global Constraints

- Phase 0's Global Constraints (keys, `lab/assets/bf2017/`, the gates).
- **Files this lane owns**: `src/lib/three/surface/weather.js` (+ test), `scripts/bf2017-decals.mjs`, `scripts/lib/bf2017-decals.mjs` (+ test, a fixture of ten decals from `maps/levels/mp/naboo_01/naboo_01.extras.json`), `src/lib/three/decals/{projected,volume,decalScene}.js` (+ tests), `public/models/galaxy/bf2017/levels/<world>/decals.json` for the world shipped, `src/runtime/fixtures/litWorld.js` (the weathering crate and the decal wall: additive), `scripts/light-fixture.mjs` (`--weather`, `--decals`: additive), `docs/superpowers/evidence/bf2017-surfaces/Q4/`. Not `gameMaterial.js` (Q1's; the wiring is one line in Q1's `overlays` when both merge, done by whichever lane merges second), not `scene.js`.
- **The hook contract is Q1's**: `ctx = { uv, uv1, worldNormal, worldPosition, viewDir, skyVisibility, params, maps }`; a contributor returns the channels it changes, already mixed (`mix(ctx.color, snow, k)`), nothing else; `params.weather = { top, sand, rain, use, mask }` is the material's gate from the recipe.
- **Numbers from the record** (`entry.record`'s `GlobalWeatheringParamsEntityData`, `WeatheringSkyVisibilityParam`, `AccumulateOverTimeOp`; the weather's `TargetValue` and `TimeToReachTarget`); named constants for what the record lacks (`UP_MIN = 0.4`, `UP_MAX = 0.9` the up-facing band; `SNOW_ROUGHNESS = 0.35`; `WET_ROUGHNESS = 0.08`; `WET_DARKEN = 0.6`).
- **Sky visibility**: 1 outdoors, the record's `IndoorThreshold` in a site zone flagged `room` (the surface's zones have `inside`), until Q3's atlases give a per-texel value; the contributor reads `ctx.skyVisibility` and does not care which.
- Files under 800 lines; tests beside; no network in tests; the gates.

## Review Focus

1. **The gate**: a material with `weather.use false` (or no weathering feature in its recipe) takes no overlay even on a blizzard world; the test asserts `snowOverlay(ctx)` returns `{}` for it. The vehicles' `SS_VehiclePreset_Snow` and props' `ESB_TopDirt` are the gate on Hoth.
2. **Accumulation**: at the weather's start the overlay is the record's `InitialValue`; at `TimeToReachTarget` it is `TargetValue`; `KeepValueWhenMaterialChanged` keeps it across a weather fade. Pure: `accumulation(t, op) → k` pinned at 0, half and full.
3. **Volume decals on `'nodes-webgl'`**: the depth texture read works over WebGL 2 on the node renderer (`viewportDepthTexture`); if not, the volume decals fall to projected `DecalGeometry` over the box's footprint and the PR says so.
4. **One draw per cell per texture**: projected decals are merged per cell per texture (`BufferGeometryUtils.mergeGeometries`), never one mesh per decal; `galaxy-check`'s calls move by at most the number of decal textures the cells in view hold.
5. **Z-fighting**: `polygonOffset` and a 2 mm push along the decal's normal; the shot at a grazing angle shows no flicker across two frames.

---

### Task 1: The weathering overlays

**Files:**
- Create: `src/lib/three/surface/weather.js`, `src/lib/three/surface/weather.test.js`

**Interfaces:**
- `weatherParams(record, kind) → { range, exponent, indoor, target, initial, seconds, keep, _source }` (pure, from `entry.record`).
- `accumulation(t, params) → k` (pure).
- `snowOverlay(params)`, `sandOverlay(params)`, `wetOverlay(params)` → contributors `(ctx) → {…}`; each built with the loaded TSL namespace passed in (`{ three }`), so the test passes stubs that record which channels were produced and with what mix factor expression.
- `overlaysFor(entry, kind, { three }) → contributor[]` (the one the world's weather kind wants).

- [ ] **Step 1: Failing tests**: `weatherParams` on Hoth Sunny's record (a fixture copied from `web/data/Levels/Lighting/Hoth/Sunny_01/VE_Sky_Arctic_Sunny_01.json`'s weathering objects into `src/lib/three/surface/fixtures/hoth.weather.json`); `accumulation` pinned; the gate (Review Focus 1); `snowOverlay` produces `color`, `roughness`, `normal`; `wetOverlay` produces `color`, `roughness` and `metalness` unchanged; `overlaysFor` picks by kind.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: The fixture**: `litWorld.js` gains a crate with a minimal `MeshStandardNodeMaterial` whose `colorNode`/`roughnessNode` are composed from the snow contributor (this lane's own minimal composition, three lines; Q1's `composeOverlays` replaces it on merge); `node scripts/light-fixture.mjs --weather --seconds 0|30|120` → three shots: the crate bare, half, white on top only.

### Task 2: The decal records

**Files:**
- Create: `scripts/lib/bf2017-decals.mjs` (+ test, fixture `scripts/fixtures/bf2017/decals/naboo.extras.json`: ten decals), `scripts/bf2017-decals.mjs`

**Interfaces:**
- `decalsOf(extras, { origin, yaw, cell }) → { cells: { "<cx>,<cz>": [{ kind: 'projected'|'volume', position, quaternion, size, texture, normal?, opacity? }] }, textures: [names] }` (pure; rebased on the pack's origin like the lights).
- `node scripts/bf2017-decals.mjs <world> [--fetch]` → `decals.json` beside the pack; `--fetch` the decal textures as KTX2 into `tex/` (their names from the extras' `shaderTextures`).

- [ ] **Step 1: Failing tests**: the ten decals land in the right cells after rebase; a decal with no texture is dropped and counted; `textures` is distinct.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5**: Hoth has none (`decals: 0` in `maps/index.json`); write `decals.json` for the first packed world with some when lane L packs it (Endor_01: 23; Kamino_01: 51). Until then the fixture's ten are the proof.

### Task 3: Drawing decals

**Files:**
- Create: `src/lib/three/decals/projected.js` (+ test: the merge per cell per texture count), `volume.js` (+ test: the box's node graph built with stubs), `decalScene.js` (+ test: `createDecals({ scene, pack, loader, tier }) → { cell(cx, cz, instances), drop(cx, cz), dispose }`)

- [ ] **Step 1: Failing tests** as above.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**: projected: `DecalGeometry(targetMesh, position, orientation, size)` per decal over the cell's loaded static instances (the instanced parts' geometry transformed by the instance matrix: use the cell's `draws` from lane L's `packCell`), merged per texture, one `MeshStandardNodeMaterial` per texture with `polygonOffset`, `depthWrite false`, `transparent`; volume: a unit box per decal with a `VolumeNodeMaterial`-style node material that reads `viewportDepthTexture`, reconstructs the world position, tests it against the box, samples the decal's colour and normal by the box's xz, writes colour with the decal's opacity (over WebGL 2 the fallback of Review Focus 3). **Step 4: Run** → PASS.
- [ ] **Step 5: The fixture**: `--decals` draws the ten on the wall and floor; `docs/superpowers/evidence/bf2017-surfaces/Q4/decals-webgl.png`; the grazing-angle pair (Review Focus 5).
- [ ] **Step 6**: the hand-off's row: the contract honoured, which worlds have decals and which are packed, what the volume path did over WebGL 2.
