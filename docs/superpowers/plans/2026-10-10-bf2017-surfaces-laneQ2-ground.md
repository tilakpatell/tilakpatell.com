# Battlefront 2017 surfaces, lane Q2: the ground's own layers. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** A level world's ground on the node renderer draws the game's own terrain layers: per paint layer a stack of tiling detail normals with displacement-style height blending, the snow's sparkle, a macro colour past 300 m, the layers placed by a derived mask until the real masks are decoded; Hoth first, proved at 2 m and 50 m against the flat plane it replaces.

**Architecture:** A pure library reads the terrain's `surfaceShaders` (the export's `maps/terrain_scatter/<terrain>.json`) and the pack's heightmap, derives per-layer masks from slope, height and the placed meshes' density, and writes `ground.json` beside the pack with the layer stacks and a mask PNG per layer at the near map's resolution. `src/lib/three/ground/layeredGround.js` is the TSL material lane L's `image` layer draws with on a `'nodes'` world; the classic worlds keep `groundLook.js`.

**Tech Stack:** Node 22, `sharp` (16-bit PNG in, 8-bit mask PNG out), `scripts/lib/png16.mjs` and `bf2017-level.mjs`'s `terrainFrame`/`heightsLayer`, three `^0.186.1` TSL (`texture`, `triplanarTexture`, `positionWorld`, `normalWorld`, `mix`, `smoothstep`, `pow`), lane R's `three.js` loader, lane L's `levelScene.js`, lane N's plan (`2026-10-10-bf-fidelity-laneN-scatter.md` on `claude/bf-fidelity`: the masks it derives are these), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md` (§4 "The ground", "Q2").

## Global Constraints

- Phase 0's Global Constraints (keys, `lab/assets/bf2017/`, the gates).
- **Files this lane owns**: `scripts/bf2017-ground.mjs`, `scripts/lib/bf2017-ground.mjs` (+ test), `src/lib/three/ground/{layeredGround,masks}.js` (+ tests), `public/models/galaxy/bf2017/levels/hoth/{ground.json,ground/*.png}`, `src/components/galaxy/surface/level/levelScene.js` (the ground material call: one additive site), `docs/superpowers/evidence/bf2017-surfaces/Q2/`. Not `src/lib/land/layers.js` (lane L's), not `groundLook.js`, not lane N's `scatter/`.
- **The mask is one derivation for N and Q2**: `src/lib/three/ground/masks.js` is pure and exported (`maskOf(layer, { heights, slope, density, frame }) → Float32Array`), so lane N's `grid.js` can import it; its rules per world live in `ground.json` (`rules: [{ layer, slope: [min, max], height: [min, max], density: 'low'|'any' }]`) with `mask: 'derived'`. When the desktop decodes the real masks, `ground.json` gains `mask: 'game'` and the PNGs come from the export; the material does not change.
- **Tiling in metres**: the game's terrain detail is 0.5 m per pixel at the finest tile; a 2,048 px detail normal tiles over `TILE_M = 4` m (a named constant per world in `ground.json`, from the layer shader when the desktop reads it; until then 4 m on Hoth, judged on the shot against the game's own ground in the owner's screenshot).
- Numbers with `_source`; constants named; files under 800 lines; tests beside; no network in tests; the gates.

## Review Focus

1. **The derived mask on Hoth** (spec C3): the flat field is `SnowPacked_04`, the ridges over 30° `SnowRockyPacked_04`, the trenches (height under the field by 2 m and slope under 15°) `SnowChunkyWind_01`, the hangar's apron (placed-mesh density high) `SnowRoughPacked_03`. Task 1's test on a synthetic 64 × 64 heightmap (a ridge, a trench, a flat) pins each.
2. **Height blending**: where the normal map's blue carries a height (the `_N` Arctic maps are BC7 with a mask in blue per the research), the blend is `mask × height` sharpened (`pow(x, 4)` normalised across layers); where blue is a constant, the mask alone. The test reads the fixture's blue channel statistics and picks the mode.
3. **The far ground**: past 300 m the detail stack fades to the macro colour (the heightmap's shade: `TerrainColor` from the weather's `EnlightenComponentData` times the sky, until the colour map is decoded); the fade's distance is a named constant and the shot at 50 m and 500 m shows no visible seam.
4. **Triplanar on slopes**: over 35° the detail samples triplanar (`triplanarTexture`), under it by world xz; the transition over 10°; the test asserts the blend weights sum to one.
5. **Budget**: four layers on ultra and high is 4 detail samples + 1 sparkle + 1 macro per fragment; mid two; low the macro; `galaxy-check surface hoth` under `BUDGET=1` passes per tier and the perf probe's frame table (WebGL 2 on the cloud) is in the evidence.

---

### Task 1: The masks and `ground.json`

**Files:**
- Create: `scripts/lib/bf2017-ground.mjs` (+ test), `src/lib/three/ground/masks.js` (+ test), `scripts/bf2017-ground.mjs`

**Interfaces:**
- `layersOf(scatterJson, textureIndex) → [{ id, normals: [names], sparkle, tile }]` (pure: the layer combinations' stacks; the texture index from `web/textures.jsonl` says each map's size and format).
- `maskOf(layer, { heights, slope, density, frame, rules }) → Float32Array` (pure).
- `node scripts/bf2017-ground.mjs hoth [--fetch]`: reads the pack's `terrain/near.png` and `level.json`'s instances (density), the terrain's scatter JSON from the bucket (`--raw maps/terrain_scatter/levels/mp/hoth_01/hoth_01_terrain/hoth_01_terrain.json`), writes `ground.json` and `ground/<layer>.png` (8-bit, the near map's size); `--fetch` fetches the layer maps as KTX2 (`textures/objects/nature/arctic/_arcticbase/_terraintextures/*.ktx2`; the desktop's encode lands them first in its list) into the pack's `tex/` with rows in `level.json`'s `tex`.

- [ ] **Step 1: Failing tests**: `layersOf` on Hoth's JSON gives the stacks the spec names (four to five normals per combination, the sparkle map); `maskOf` on the synthetic heightmap pins Review Focus 1; the masks of all layers sum to 1 per pixel (normalised).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5**: `node scripts/bf2017-ground.mjs hoth --fetch` on the cloud; `ground.json` and the mask PNGs committed (the PNGs are small: 2,561² 8-bit, four of them, under 2 MB together after `sharp`'s palette compression; else through `assets-upload.mjs` with the pack).

### Task 2: The layered ground material

**Files:**
- Create: `src/lib/three/ground/layeredGround.js` (+ test: the TSL built with stubs asserts the sample count per tier and the triplanar weights)

**Interfaces:**
- `createLayeredGround({ ground, heights, maps, tier, three, entry }) → { material, update(camera), dispose }`: `ground` is `ground.json`; `heights` the near and far height textures lane L already uploads (`image` layer); `maps` the layer KTX2s and the mask textures; `entry` the light stack's entry for the macro colour.

- [ ] **Step 1: Failing tests** as above.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the TSL: the surface normal from the heightmap's gradient (`dHdx`, `dHdz` from the near map, the far map past its edge); per layer `texture(normal, positionWorld.xz / tile)` (triplanar over 35°), roughness from the layer (`ROUGHNESS = { packed: 0.55, rocky: 0.7, rough: 0.6, chunky: 0.65 }` named, until the layer shaders are read); the blend by the masks with height sharpening (Review Focus 2); the sparkle: `T_ArcticBase_SnowSparkle_03_RGBM` sampled at a fine tile, its glint `pow(max(0, dot(reflect(-view, n), sun)), 64) × sparkleMask` added to emissive on snow worlds; the macro fade past 300 m. **Step 4: Run** → PASS.

### Task 3: Hoth's ground on the node renderer

**Files:**
- Modify: `src/components/galaxy/surface/level/levelScene.js` (when the world runs `'nodes'` and the pack has `ground.json`, the `image` layer's mesh takes `createLayeredGround`'s material; the classic path unchanged)

- [ ] **Step 1**: a test with a stub renderer kind: `'nodes'` + `ground.json` → the layered material; else the old.
- [ ] **Step 2**: on the cloud, `?gpu=webgl`: `node scripts/surface-shot.mjs` at the field (2 m down at the snow, 50 m across it) and at the ridge; before and after in `docs/superpowers/evidence/bf2017-surfaces/Q2/`; `galaxy-check surface hoth` per tier under `BUDGET=1`; the perf probe's frame table. The WebGPU leg on the owner's laptop, said in the PR.
- [ ] **Step 3**: the hand-off's row: the tile size judged, the masks' rules, what a real mask would change, what lane N should import.
