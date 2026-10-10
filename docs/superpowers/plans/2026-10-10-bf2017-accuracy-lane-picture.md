# Battlefront 2017, lane picture: the whole stack under the game's world, proven on a GPU. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** The Battlefront world (`/battlefront/...`) and the Starfighter Assault scenes draw with everything the fidelity, surfaces and engine lanes landed after lane 5 wrote the world: the game material and recipes (Q1), the ground's layers (Q2), weathering and the placed decals (Q4), the emitters' particles on the pack's effect spawns (X), the sun's PCSS, cloud shadows and the far cache (S), volumetrics, media fog, god rays and flares (V), the cameras (C), and the colour lane's variations when they land; the record's exposure and grade stay the last word; and a gallery of shots on a real GPU at ultra, on both backends, shows it beside the game's own frames.

**Architecture:** No new rendering: `module.js` and `map/level.js` call what exists (`createLevelLoader` with `recipes`/`materialFor`, `ground.json`, `createDecals`, `createEffects`, the light stack's options), each behind the tier's rows and the entry's fields as the galaxy's surface already does; `look.js` unchanged in intent. One shot script for the laptop and one gallery page. Q6, N and U run beside this lane from their own plans; this lane merges after them and takes their passes the same way.

**Tech Stack:** `src/components/battlefront/` (lane 5), `src/components/galaxy/surface/level/` (L, Q1, Q2, Q4, P0), `src/lib/three/surface/gameMaterial.js`, `src/lib/three/decals/`, `src/lib/three/light/` (R, S, V), `src/components/galaxy/surface/effects/` or where X put `createEffects`, `src/components/galaxy/surface/cameras/` (C), `scripts/battlefront-check.mjs`, `scripts/surface-shot.mjs`, `scripts/landing-check.mjs`; the laptop: `ANGLE=d3d11 CHROME=<path to msedge.exe>` (an RTX 5090; `PLAYWRIGHT_BROWSERS_PATH` unset); the cloud's SwiftShader for the WebGL 2 leg's counts only.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-accuracy-design.md` (§1.6, §3 "Lane picture", §5).

## Global Constraints

- `look.js`'s rule stands: the record's exposure and grading LUT through the stack's output, no house tone mapper or bloom over them.
- No budget rows for the game's world (the owner's rule), but each pass is behind the tier: low draws what lane 5 drew; mid adds the material and decals; high adds the effects, volumetrics and cloud shadows; ultra everything.
- Nothing in `src/components/galaxy/` changes but a read; the galaxy's surface is the reference for how each pass is wired (`scene.js`, `litWorld.js`).
- A pass whose input the pack lacks (no `effects.json`, no `ground.json`) is skipped with one log line, never an error.
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines.

## Review Focus

1. **The low tier after this lane**: `scripts/battlefront-check.mjs` at low must report the same calls and triangles as lane 5's row within 5 % (task 1's gate).
2. **A pack without `recipes.json`** (an old pack): the loader draws the GLB materials as before (task 1's test).
3. **The record's grade applied twice** (the stack's LUT and Q6's): one application, checked by the fixture's mean luminance against lane S's column (task 4).
4. **A background tab**: the effects and volumetrics must not stall the deploy (lane F's `nextFrame` rule; task 5 runs the hidden-tab case once).

---

### Task 1: The material, the ground and the decals

**Files:**
- Modify: `src/components/battlefront/map/level.js` (`createLevel` loads `recipes.json`, `ground.json` and `decals.json` beside the pack and passes `recipes`, `materialFor` (from `gameMaterial.js`), `mapKeys` by tier (`TIER_MAPS`) to `createLevelLoader`; the ground through Q2's layer material; `createDecals({ scene, pack, loader, tier })` fed each cell's rows as `level/index.js` does for the galaxy; lane colour's `variations.json` through `levelVariations.js` when the file and the module exist (a guarded import)), `src/components/battlefront/module.js` (the renderer options the game material needs on the node renderer)
- Test: `src/components/battlefront/map/level.test.js` (Review Focus 2; with a recipes file the loader is made with `materialFor`; decals asked for each cell)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `node scripts/battlefront-check.mjs` at low and high: the rows beside lane 5's (Review Focus 1).
- [ ] **Step 5: Commit** `The game's world draws its level in the game material, on its ground layers, with its decals`.

### Task 2: The effects, the shadows and the air

**Files:**
- Modify: `src/components/battlefront/module.js` (X's `createEffects` on the pack's `effects.json` at high and ultra, culled by X's distances; S's options on the sun: PCSS, the cloud-shadow layers, the far cache from the pack's `shadowCache`; V's volumetrics, media fog and god rays from the record's `FogComponentData` and the placed light cones; V's flares from `flares.json`; all through the stack's entry fields as `litWorld.js` sets them for the galaxy), `src/components/battlefront/weather.js` (each weather entry carries the fields the stack reads: the Hoth records' sunny and cloudy rows)
- Test: `src/components/battlefront/weather.test.js` (the entries carry the fields; the lamp-to-sun ratio test of #871 still holds), `module` smoke test (the world creates with effects on a fixture pack)

- [ ] **Step 1: Failing tests.** **Step 2** → FAIL. **Step 3: Implement.** **Step 4** → PASS; `battlefront-check` at high on SwiftShader: no console error, the pass list printed.
- [ ] **Step 5: Commit** `The game's world has its effects, its soft and cloud shadows, its fog and its flares`.

### Task 3: The cameras and the fighters' scenes

**Files:**
- Modify: `src/components/battlefront/cameraRig.js` (takes lane C's stack: the arm against walls, the shoulder swap, the aim FOV from `cameras.json` as C reads it; lane 5's ray march retired when C's is in), `src/components/galaxy/surface/missions/starfighterScene.js` (or where lane A draws): V's flares on the sun and the engines, X's engine exhaust and bolt effects from `fx/` for the fighters (the TIE and X-wing exhaust rows are in `src/data/bf2017/fx/`), the lightning and rain of Kamino's area untouched
- Test: `src/components/battlefront/cameraRig.test.js`, the starfighter scene's test

- [ ] **Step 1: Failing tests.** **Step 2** → FAIL. **Step 3: Implement.** **Step 4** → PASS.
- [ ] **Step 5: Commit** `The game's camera stack under the game's world; the fighters trail the game's exhaust`.

### Task 4: After Q6, N and U

- [ ] When `surfaces-laneQ6-picture`, `bf-fidelity-laneN-scatter` and `bf-fidelity-laneU-headroom` merge (watch `origin/main`; they were spawned with this lane): the LUT after the linear tonemap and the five-Gaussian bloom through the same output pass (Review Focus 3), the HBAO numbers, the painted sky; the scatter on the pack's `scatter.json`; the upscaling as the pace's first step, the statics as `BatchedMesh`. One commit each, each a read of their entry fields, nothing re-implemented. If one has not merged within the session, say so in the hand-off and leave the hook.
- [ ] **Commit** `The game's world takes the picture lanes' passes`.

### Task 5: The gallery on the laptop

**Files:**
- Create: `scripts/battlefront-shots.mjs` (the game world at ultra and high, the WebGPU and WebGL 2 legs, twelve spots (lane 5's check spots and five more: the hangar mouth at dawn, the trench under the AT-AT, the base inside if E0's interior is on `main`, the Endor space battle's MC80 from a TIE, Kamino's storm), each a shot and a row: calls, triangles, texture MB, the frame time over 60 frames, the pass list; `--hidden` once for Review Focus 4), `docs/superpowers/evidence/bf2017-picture/README.md` (the gallery: each shot beside the game's frame when the owner has given one (`docs/superpowers/evidence/bf2017-picture/game/<spot>.png`), else beside lane M's poster for the level; the table)
- Run on the owner's laptop (`ANGLE=d3d11 CHROME=<msedge>`): the session that lacks a GPU runs the WebGL 2 leg on SwiftShader for the counts and says the frame times wait for the laptop.

- [ ] **Step 1**: the script runs on SwiftShader (counts, no times). **Step 2**: the gallery page with what the session has; the laptop rows left as a table to fill, named in the hand-off.
- [ ] **Commit** `The game's world, shot at ultra on both backends, beside the game's own frames`.

### Task 6: The hand-off and the PR

- [ ] `HANDOFF-battlefront.md`, lane 5's row gains "the sixth design: the picture" (the passes on, per tier; the check's rows; the gallery; what waits for the laptop); `HANDOFF-bf2017.md`'s table row.
- [ ] `npm run lint`, `npx vitest run src/components/battlefront src/components/galaxy/surface/missions`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/battlefront-check.mjs` (low and high).
- [ ] Merge `origin/main` (lane 5 and the screens lane are live in the same folder: keep both sides), push, open the PR; merge it yourself when CI is green.
