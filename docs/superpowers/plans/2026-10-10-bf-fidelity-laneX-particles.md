# Fidelity lane X: particles from the game's emitters. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** The game's effects play on the site from the game's own emitter definitions: Hoth's snow falls from the hangar's ceiling where the level says, the steam rises, the smoke hangs in the corridors, the engines of the GR-75s breathe, the TIEs leave their contrails, and an explosion is the game's explosion; each effect one draw, simulated on the GPU where the browser has WebGPU and on the CPU into instanced sprites elsewhere, with the record's tier variants, cull distances and instance caps.

**Architecture:** A pure reader (`scripts/lib/bf2017-emitters.mjs`) turns an `EffectBlueprint` and its `ScalableEmitterDocument`s into one JSON per effect under `src/data/bf2017/fx/`; `src/lib/three/particles/` runs them: `emitter.js` (pure step), `gpu.js` (the TSL compute twin), `sprites.js` (the quad material), `effects.js` (the pools and the API). `scripts/bf2017-effects.mjs` writes a level's `effects.json` beside lane L's pack. The textures go through phase 0's import as sprite sheets.

**Tech Stack:** three `^0.186.1`: `three/webgpu` (`StorageInstancedBufferAttribute`, `SpriteNodeMaterial`, `InstancedMesh`), `three/tsl` (`Fn`, `storage`, `instanceIndex`, `uniform`, `texture`, `hash`, `compute`), the merged light stack (`applyGameLight`'s `wind` uniform and `sunShadowNode` once lane S exports it, `fogNode`); the export (`web/data/FX/**` and `web/data/**/emitters/**` on the desktop, or the bucket's `data/` by key), `web_opt/textures/fx/` (292 KTX2) and `web/textures/fx/` (558 masters); `scripts/bf2017-import.mjs` (phase 0) for the sheets; Vitest; `scripts/light-fixture.mjs --particles`.

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-fidelity-design.md` ("Lane X"; "Where the light stands", item 5). The emitter's object types and fields are listed there; `scripts/fixtures/bf2017/fx/` holds three trimmed emitters this plan names.

## Global Constraints

- **Files this lane owns**: `scripts/bf2017-emitters.mjs`, `scripts/lib/bf2017-emitters.mjs` (+ test), `scripts/bf2017-effects.mjs` (+ lib, test), `scripts/fixtures/bf2017/fx/*` (three effects, under 30 KB together), `src/data/bf2017/fx/*.json`, `src/lib/three/particles/*` (+ tests), `public/models/galaxy/bf2017/fx/` (the sheets and `fx.json`), `public/models/galaxy/bf2017/levels/<world>/effects.json`, the evidence folder `galaxy-engine/X/`, the hand-off's row. Not `src/lib/three/fx/` (lane F's planned folder on #802's branch) and not `surface/weather.js`.
- **One draw per effect kind**, never per particle; the pools' sizes from `MaxCount × MaxActiveInstanceCount` per variant; nothing allocated per frame.
- **The variant by tier**: the blueprint's `Ultra` on ultra, `High` on high, `Medium` on mid, `Low` on low; a blueprint without variants scales `MaxCount` by 1, 0.75, 0.5, 0.25.
- **Every number from the emitter** (`_source` on every leaf); the alignment, stretch, light wrap, gravity, curves as stored. A field the reader does not understand is kept under `raw` and listed in the PR.
- **Textures**: WebP sheets, 1024 on high, 2048 on ultra, 512 below, additive where the emitter's blend says; every sheet under 256 KB; the set a level needs under 6 MB, loaded once per visit through `assetBase.js`.
- The key for the bucket from `.env.local` if the export is not on the machine; never committed. Files under 800 lines; tests beside; the gates. The WebGPU leg on the owner's laptop (B5).

## Review Focus

1. **The curves**: `PolynomialData` is a cubic in `EfNormTime` (`Coefficients.x…w`, `ScaleValue`); `UpdateColorData` is HDR (12.7 on Hoth's powder) so the sheet's colour is scaled, not clamped, and blooms as the game's does. The test evaluates a fixture's colour curve at 0, 0.5 and 1 and pins the numbers; the fixture shot shows the powder's fade.
2. **`MotionStretchScreen`**: a quad stretched along its screen-space velocity by `MotionStretchMultiplier` with the length clamps; falling snow streaks when the camera pans. The test on the pure stretch; the shot during a pan.
3. **GPU and CPU agree**: the same emitter stepped 120 frames by `emitter.js` and by `gpu.js` (read back on the fixture) ends with positions within 1 cm for a seeded spawn; the parity on both backend kinds at `--particles`.
4. **Culling**: `MaxSpawnDistance` 55 and `ParticleCullingFactor` 0.8 from the template; an effect past its blueprint's `CullDistance` costs nothing (no update, no draw): the stats say so; a `NearbyRadius` cap keeps 90 ceiling-snow spawns to `MaxNearbyInstanceCount`.
5. **The light on a sprite**: `LightWrapAroundFactor` 0.5 wraps the sun's term; the sun's shadow (lane S's `sunShadowNode`, when on `main`) and the fog node apply; a sprite in a dark corridor is dark. The shot in the hangar.

---

### Task 1: The reader
- Create the reader and the CLI; three fixtures (`FX_Snow_FallingSnow_01_Hoth` trimmed, an exhaust, an impact); the JSON shape the spec gives.
- [ ] Failing tests (the template's fields, the spawn block, the curves, the variants, the texture list, `graph: true` for an `EmitterGraph`); implement; `node scripts/bf2017-emitters.mjs --level hoth` on the desktop export (or the bucket); commit `The game's emitters read into the site's effect tables`.

### Task 2: The simulation and the sprites
- Create `particles/emitter.js` (pure step), `particles/sprites.js` (the quad material: alignment, stretch, light wrap, soft depth, fog, the shadow term when given), `particles/gpu.js` (the compute twin; the CPU buffer path on `'nodes-webgl'`).
- [ ] Tests (review focus 1–3); the fixture with `--particles` on one effect; commit `Particles stepped on the GPU, or on the CPU into instanced sprites, from the emitter tables`.

### Task 3: Effects, pools and the level's spawns
- Create `particles/effects.js` (`createEffects`); `scripts/bf2017-effects.mjs` (the extras' `effects[]` rebased per cell to `effects.json`); the sheets through phase 0's import to `public/models/galaxy/bf2017/fx/`.
- [ ] Tests (the pools' caps, the variant by tier, the cull, `NearbyRadius`); Hoth's `effects.json` when lane L's pack is readable (its branch) else the fixture level; the shot of the hangar's snow and steam on the fixture; commit `A level's effects spawn with its cells: Hoth's snow, steam, smoke and exhaust from the game's tables`.

### Task 4: Ribbons and meshes, the ships' trails
- `EmittableType_Mesh` and the ribbon emittables (contrails, the saber's trail is lane X of #810's, not this) as a second path in `sprites.js`; `spawn(name, { parent })` for exhaust and contrails on a ship.
- [ ] Tests; the fixture with a moving parent; commit `Mesh and ribbon emitters; trails that follow their ship`.

### Task 5: Docs and the PR
- [ ] `docs/stack/webgpu-tsl.md` (the compute path), `docs/assets/` page for the sheets; the hand-off's row; the gates; `assets-upload.mjs --dry` for the sheets; merge `origin/main`; push; PR `Fidelity lane X: the game's particles from its emitters, on both backends` with the shots, the parity, the frame table, B3 answered and the `graph: true` list.
