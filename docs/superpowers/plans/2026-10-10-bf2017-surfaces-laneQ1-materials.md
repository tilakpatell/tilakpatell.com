# Battlefront 2017 surfaces, lane Q1: the recipes and the game material. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Every game material on a `'nodes'` world draws with the game's own surface shader features from its recorded parameters: a tiling detail normal, the grunge, breakup, scorch and wear overlays, the paint and metal colours, emissive colour times intensity, parallax, reflectance by orientation, vegetation translucency and hair; proved on the lit fixture on both backend kinds, then on Hoth's level.

**Architecture:** A pure library turns a `materials.jsonl` row into a recipe per material (family by shader name, maps by slot name, numbers by parameter name, `_source` on every leaf). A CLI writes `recipes.json` beside a level pack or a crew pack and names the maps to fetch. `src/lib/three/surface/gameMaterial.js` builds a `MeshPhysicalNodeMaterial` from a recipe and its maps as TSL, with an `overlays` hook that lanes Q2 (terrain blend) and Q4 (weathering) fill. `levelGltf.js` builds that material in place of the GLB's on a node world.

**Tech Stack:** Node 22, three `^0.186.1` (`three/webgpu`, `three/tsl`: `MeshPhysicalNodeMaterial`, `texture`, `uv`, `normalMap`, `positionWorld`, `normalWorld`, `Fn`, `mix`, `smoothstep`, `time`; `three/addons/tsl/...` only through `src/lib/three/light/three.js`'s `loadThree()`), `scripts/bf2017-fetch.mjs` (`--raw materials.jsonl`), phase 0's import (`scripts/bf2017-import.mjs`, `--native` KTX2 by name), lane L's `surface/level/levelGltf.js` and `levelPack.js`, lane R's fixture (`scripts/light-fixture.mjs`, `src/runtime/fixtures/litWorld.js`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md` (§2 "The surface shader", "Q1"). The suffix table and the per-family recipe notes are the export's `research/research_textures.json` (fetch with `--raw research_textures.json` if the desktop uploads it; else the spec's §1 and this plan's Task 1 table are the reading).

## Global Constraints

- Phase 0's Global Constraints: the keys from the environment (`SUPA_KEY` in a cloud session; `.env.local` locally), fetched files under `lab/assets/bf2017/`, the sequel list, the credit text, the gates (`npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`).
- **Files this lane owns**: `scripts/bf2017-materials.mjs`, `scripts/lib/bf2017-materials.mjs` (+ test, fixtures under `scripts/fixtures/bf2017/materials/`), `src/lib/three/surface/{gameMaterial,hair,compose,families}.js` (+ tests), `src/components/galaxy/surface/level/levelGltf.js` (`recipes` and `materialFor` options: additive), `scripts/light-fixture.mjs` (`--materials`: additive), `src/runtime/fixtures/litWorld.js` (the five recipe cubes: additive), `public/models/galaxy/bf2017/levels/hoth/recipes.json`, `docs/superpowers/evidence/bf2017-surfaces/Q1/`. Not `scene.js`, not `crew.js` (the crew's wiring is a follow-up PR after this one merges), not lane R's `light/*` beyond reading `three.js`.
- **Every three import in `src/lib/three/surface/` is dynamic** through `loadThree()`; the pure parts (`families.js`, `compose.js`, the recipe library) import nothing from three.
- **Numbers from the records**: a recipe leaf is the dump's value with `_source: 'materials.jsonl:<mesh>#<material index>.<parameter>'`; a default the dump lacks is a named constant in `families.js` with a comment (`DETAIL_TILING = 20` from the vehicle preset's `DetailTiling`; `DETAIL_STRENGTH = 1`; `PARALLAX_SCALE = 0.02`).
- **The hook contract** (lanes Q2 and Q4 write to it; do not change it after Task 3 lands): `overlays: [(ctx) => ({ color?, roughness?, metalness?, normal?, emissive? })]`, `ctx = { uv, uv1, worldNormal, worldPosition, viewDir, skyVisibility, params, maps }`; each returned node replaces the running value for that channel (a contributor that wants to blend does `mix(ctx.color, mine, k)` itself and returns the mix); `composeOverlays(base, overlays, ctx)` applies them in order.
- Tiers: `ultra` everything; `high` parallax at 8 steps and the detail map a mip under; `mid` detail and emissive only; `low` the three maps (the material equals the GLB's: Task 3's test asserts the same pixel).
- Files under 800 lines; tests beside; no network in tests; the gates.

## Review Focus

1. **The family of an instance shader** (spec C1): `SS_Naboo_Concrete_01`, `SS_MC80WallsPreset_01` and the 19,678 instance shaders take the family their slots match (`_CS` + `_NAM` → `props`; `CS` + `NMR` → `panels`; `BaseColor` + `Normal` + `AOSlice` → `character`; `_CA` + `NS`/`_NTS` → `vegetation`; `HairColorTexture` → `hair`); a row with no match is `glb` and counted. Task 1's test pins each of the five fixtures and one `glb` row.
2. **The detail array's slice** (spec C2): `AOSlice.b` is a stored index in tenths (the research's "discrete k/10 levels"); `slice = round(b × 10)` clamped to `slices − 1`; the array's slices were exported as separate images (`textures.jsonl` `type: 'array'`, `files[]`): the material samples the one slice the mesh's median `b` names (one texture per material; a per-texel slice would need a 2D array texture, which the KTX2 loader does not give). The PR says which characters' slice was taken from the median.
3. **The normal blend**: UDN (`vec3(n.xy + d.xy × s, n.z)` normalised) in tangent space before `normalMap`'s transform; the test renders a flat quad with a detail normal and asserts the shaded gradient's direction matches the detail's (a tilted detail darkens the side it tilts away from the light).
4. **Low tier equals the GLB**: `createGameMaterial` at `tier: 'low'` draws the same pixel as the GLB's `MeshStandardMaterial` on the fixture (within 1/255): a regression guard for the worlds below high.
5. **Memory**: the detail maps are shared by name through `levelGltf.js`'s one texture cache (`textures` map keyed by pack path); the Hoth proof's `renderer.info.memory.textures` before and after is in the evidence, and the delta is the distinct detail and overlay maps the level's recipes name, not per material.

---

### Task 1: The recipe library

**Files:**
- Create: `scripts/lib/bf2017-materials.mjs`, `scripts/lib/bf2017-materials.test.mjs`, `scripts/fixtures/bf2017/materials/{props,vehicle,character,vegetation,emissive,glb}.jsonl` (one dump row each, copied verbatim from `web/materials.jsonl` through `node scripts/bf2017-fetch.mjs --raw materials.jsonl` and `grep`: a `SS_PropsPreset` prop with `_CS`, `_NAM_texcoord0`, `_DetailNormal` and `GlobalTilingDetailmap`; a `SS_VehicleLargePreset_01` with `PaintColour`, `MetalColour`, `GrungeColour_01`, `ScorchTiling`, `ScorchEmberIntensity`, `ESB_VehicleIsWreck`; a `SS_CharactersPreset_WalrusMetallic` body with `NormalDetailTextureArray`, `AOSlice`, `WeatheringMask`; a `SS_VegetationPreset` leaf with `_CA`, `NTS`, `SubsurfaceBackfaceScale`, `AlphaOnOff`; a `SS_PropsNonMetallicPreset_01_EmissiveAlphaTest` with `_E`, `EmissiveIntensity`, `EmissiveColor`; the snow pile `objects/architecture/hoth/corridorsystem_01/new/arctic_corridorsnowpile_01_mesh` with no slots)
- Create: `src/lib/three/surface/families.js` (+ test): the family table (name patterns and slot patterns), the defaults, the slot-to-map names

**Interfaces:**
- `familyOf(shader, slots) → family` (pure).
- `recipeOf(row, materialIndex, { families }) → recipe` as the spec's shape, every leaf `{ value, _source }` flattened to the value with a sibling `_source` map (`recipe._source[path]`).
- `recipesOf(row) → recipe[]`; `mapsWanted(recipes) → [{ name, kind }]` (`kind ∈ detail, overlay, height, mask, emissive, array`).

- [ ] **Step 1: Failing tests**: each fixture row's family; the props recipe's `detail.tiling` equal to its `GlobalTilingDetailmap.x` with `_source`; the vehicle's `scorch.ember 1600` and `wreck: true`; the character's `detailArray` name and `detailSlice: 'median'`; the vegetation's `backface.subsurface` and `alphaTest: true`; the emissive's `emissive.intensity`; the snow pile's `family: 'glb'`; `mapsWanted` over all six names each slot once with its kind.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (`families.js`: `FAMILIES = [{ name, shaderRe, slotRe, maps: { detail: ['_DetailNormal', 'DetailNormal', 'NormalDetail', 'Detail_NM', 'TilingNormal', 'DetailNS'], … }, params: { detailTiling: ['GlobalTilingDetailmap', 'DetailTiling', 'Detail_Tiling', '___DetailTile', 'DetailNormalTiling'], … } }]`, first match wins; the recipe reads each map and parameter through the family's name lists). **Step 4: Run** → PASS.
- [ ] **Step 5**: a count over the real dump in a script-only check (`node scripts/bf2017-materials.mjs --count` after Task 2): families by count, `glb` by count; paste into the hand-off.

### Task 2: The CLI and Hoth's recipes

**Files:**
- Create: `scripts/bf2017-materials.mjs`
- Create: `public/models/galaxy/bf2017/levels/hoth/recipes.json`

**Interfaces:**
- `node scripts/bf2017-materials.mjs --level hoth [--fetch]`: reads the pack's `level.json` (`meshes[].name` is the game mesh's GLB path; the dump's `mesh` is that path without `models/` and `.glb`), the dump (cached under `lab/assets/bf2017/materials.jsonl`), writes `recipes.json` keyed by mesh index then material index (`{ "12": [recipe, recipe] }`), prints the maps wanted and which the bucket has (`bf2017-fetch.mjs --list` by name); with `--fetch`, fetches each wanted KTX2 (`textures/<path>.ktx2`, the colour at the pack's `tex` sizes through `scripts/lib/ktx2-mips.mjs`'s drop, the rest a step under) into the pack's `tex/` and adds its rows to `level.json`'s `tex`.
- `node scripts/bf2017-materials.mjs <mesh>` prints the recipe (for the fixture and for a crew pack later).

- [ ] **Step 1**: the CLI; `--level hoth` on the cloud (the keys are environment variables; `NODE_USE_ENV_PROXY=1`); expected: 602 meshes, recipes for every material, the wanted maps listed with `missing:` for the ones the desktop's encode has not landed (the list `web_opt/_surfaces_list.tsv` is encoding in the order terrain, detail, height, overlay, emissive, mask; check again before the PR and re-run `--fetch`).
- [ ] **Step 2**: `recipes.json` committed (it is small: under 1 MB for Hoth; the maps go through `scripts/assets-upload.mjs` with the pack, as lane L's did).

### Task 3: The game material

**Files:**
- Create: `src/lib/three/surface/compose.js` (+ test: pure: `composeOverlays`, the channel order, a contributor returning nothing leaves the base)
- Create: `src/lib/three/surface/gameMaterial.js` (+ test: with the fixture's fake GPU where the repo has one (`src/lib/three/gpuFake.fixture.js`), else a Node test that builds the material with stub nodes and asserts which features were wired per tier)
- Modify: `src/runtime/fixtures/litWorld.js` (five cubes and a 2 m wall with the five recipes; `--materials` on `scripts/light-fixture.mjs` fetches their maps by name from the bucket into `lab/assets/bf2017/`)

**Interfaces:**
- `createGameMaterial(recipe, maps, { tier, overlays = [], three }) → material` (`maps`: `{ color, normal, orm, detail, grunge, breakup: { color, normal }, scorch, height, wear, weathering, emissive }` as textures or null; `three` the loaded namespace, so the test can pass stubs).
- `ctx` as the Global Constraints say; `material.userData.game = { family, features: [...] }` for the evidence and the tests.

- [ ] **Step 1: Failing tests**: at `tier: 'low'` the features list is `[]`; at `ultra` the props recipe lists `detail`, the vehicle `detail, grunge, scorch, paint, metal, emissive`, the character `detailArray, weathering`, the vegetation `alphaTest, translucency, doubleSided`, the emissive `emissive`; an overlay given is in the list as `overlay:<name>`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the TSL: the base from the three maps (`colorNode`, `normalNode` through `normalMap`, `roughnessNode`/`metalnessNode`/`aoNode` from the ORM); the detail (`texture(detail, uv().mul(tiling))`, UDN blend at `detail.normal`, smoothness `roughness − detailSmooth × strength`); the overlays in the spec's order; emissive; parallax (a TSL `Fn` stepping the view ray in tangent space over the height map: 8 or 16 steps by tier); reflectance by `normalWorld.y`; vegetation's translucency (`MeshPhysicalNodeMaterial` with `sheen` off and a wrapped diffuse term added to `emissiveNode` from the `_nts` map's translucency × the sun's wrapped dot; the sun from the stack's entry when `applyGameLight` ran, else the scene's first directional light); `alphaTest` and `side`. **Step 4: Run** → PASS.
- [ ] **Step 5: The fixture**: `node scripts/light-fixture.mjs --materials` (WebGL 2 leg on the cloud; the WebGPU leg on the owner's laptop, said in the PR) → `docs/superpowers/evidence/bf2017-surfaces/Q1/fixture-{low,ultra}-webgl.png`: the five cubes and the wall; the wall at 2 m shows the metal grain; the low shot equals the GLB's (Review Focus 4).

### Task 4: Hair and heads

**Files:**
- Create: `src/lib/three/surface/hair.js` (+ test: the melanin-to-colour curve pinned at three points; the tip tint by `v`)

- [ ] **Step 1**: `hairMaterial(recipe, maps, { tier })`: base colour from `MelaninXY` (eumelanin x, pheomelanin y) by the approximation `rgb = exp(-(a × x + b × y) × k)` with `a, b, k` named constants from the published fit, times `HairColorTexture`; Kajiya-Kay two lobes along the strand tangent (`HairStrandTexture`'s flow in `rg`), `Smoothness`, `HairNormalScale`; `TintTipColor` mixed by `v` past `TintTipColorMin`. `headMaterial`: the `_rsssao` map's SSS mask into a wrapped diffuse by the record's `Profile0` radii (the SSS pass is lane V's; when it lands, `headMaterial` sets the material's SSS mask node for it: a one-line follow-up).
- [ ] **Step 2**: the fixture gains Luke's head from the crew pack (`public/models/galaxy/bf2017/crew/luke.glb` is on `main`; its recipe from `node scripts/bf2017-materials.mjs characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh`): a shot beside the GLB's.

### Task 5: Hoth's level under the recipes

**Files:**
- Modify: `src/components/galaxy/surface/level/levelGltf.js` (`createLevelLoader({ …, recipes, materialFor })`: when both are given and the renderer is a node renderer, `bind` builds `materialFor(recipe, maps)` with the maps from the one cache (the recipe's extra maps resolved through `level.json`'s `tex` rows), assigns it to the primitive and disposes the GLB's; else the old path)
- Modify: `src/components/galaxy/surface/level/levelScene.js` (passes `recipes` from `level.json`'s sibling `recipes.json` and `materialFor` from `gameMaterial.js` when the world runs `'nodes'`: read `rt.gfx.kind` as lane T's twins do; one call site)

- [ ] **Step 1**: a test on `levelGltf.js` with a stub loader: with `recipes` the material is the stub `materialFor`'s, the GLB's disposed; without, unchanged.
- [ ] **Step 2**: on the cloud, `node scripts/galaxy-check.mjs surface hoth` under `BUDGET=1` per tier with `?gpu=webgl` (`PHASE_WAIT=1500000`): calls and triangles unchanged (the material is per draw, not per instance), `renderer.info.memory.textures` before and after in the evidence; `node scripts/surface-shot.mjs` at the hangar's west mouth facing the wall and at a crate: `hangar-{before,after}.png`, `crate-{before,after}.png`. The WebGPU leg is the owner's.
- [ ] **Step 3**: the hand-off's row (`docs/superpowers/HANDOFF-bf2017-surfaces.md`): families by count on Hoth, maps missing at PR time, the memory delta, what the fixture's WebGPU leg still needs.
