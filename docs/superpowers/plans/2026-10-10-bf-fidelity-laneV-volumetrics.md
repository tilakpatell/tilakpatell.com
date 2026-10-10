# Fidelity lane V: volumetrics, fog and the shafts. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** The air in a level is lit the way the game lights it: the hangar's shafts and the placed volumetric cones are ray-marched volumes that a trooper walking through cuts, the fog carries the record's participating media so a blizzard reads as a wall of light at the door, the god rays come off the real sun's shadow, and the sun's flare and the explosions' flares follow the records' curves.

**Architecture:** `src/lib/three/light/volumetrics.js` (the cones: `VolumeNodeMaterial` boxes marched at quarter resolution, dithered and blurred, added before bloom), `light/fog.js` gains the media (`fogMedia(record)` pure; the `fog: 'volume'` pass as `webgpu_postprocessing_fog`'s shape), `light/flare.js` (the record's flare elements to `LensflareNode`; event flares by blueprint name), `post.js` and `passes.js` gain `fog: 'volume'`, `motionBlur` and `dof` as data (lane C drives the last two). `apply.js` wires the cones from `lights.json`'s sibling `volumes.json` (this lane's script writes it from the extras' `SimpleVolumetricsEntityData` and the `FX_*LightCone*` spawns).

**Tech Stack:** three `^0.186.1`: `three/webgpu` (`VolumeNodeMaterial`, `Data3DTexture`, `RenderPipeline`), `three/tsl` (`Fn`, `texture3D`, `screenUV`, `pass`), `three/addons/tsl/display/{GaussianBlurNode,GodraysNode,LensflareNode,MotionBlur,DepthOfFieldNode}.js`, `three/addons/tsl/math/Bayer.js` (`bayer16`); the merged stack; `hoth.lighting.json` (`fog`, `flare`, `motionBlur` rows); the extras (`maps/<level>.extras.json`: `lights[]` with `type` and the `effects[]` named `FX/Lighting/FX_*LightCone*`) on the desktop export or the bucket; Vitest; `scripts/light-fixture.mjs --volume`.

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-fidelity-design.md` ("Lane V"; "Where the light stands", item 4).

## Global Constraints

- **Files this lane owns**: `light/volumetrics.js`, `light/flare.js` (+ tests), `light/fog.js`, `light/post.js`, `light/passes.js`, `light/apply.js` (additive), `scripts/bf2017-volumes.mjs` (+ lib, test), `public/models/galaxy/bf2017/levels/<world>/volumes.json`, `scripts/light-fixture.mjs` (`--volume`), the evidence folder `galaxy-engine/V/`, the hand-off's row.
- **Budgets named**: `CONES_LIT = { ultra: 12, high: 6 }`, `VOLUME_SCALE = 0.25`, `FOG_STEPS = { ultra: 32, high: 16 }`; nothing marched on mid and low.
- **The cones read the lights**: a cone's light is the nearest placed spot in `lights.json` within 1 m of its apex (pure `coneLight(cone, lights)`), so a cone and its spot share colour and the spot's shadow map cuts the volume; a cone with no spot is lit by its own emission only.
- Lane S owns `sun.js`: read its branch (`origin/claude/fidelity-s-shadows`) for the cascade light; until it lands, `godrays` keeps lane R's `rays` helper (B2).
- Addon imports dynamic, in `light/` only; files under 800 lines; tests beside; the gates. The WebGPU leg on the owner's laptop (B5).

## Review Focus

1. **Quarter-resolution edges**: the volume pass upsampled over depth edges (bilateral, as the fog example's joint upsampling) so a shaft does not halo round a trooper; the fixture's shot at a figure's edge inside a cone.
2. **Additive stacking**: twelve overlapping cones in the hangar must not blow out: the sum is tone-mapped with the scene (added before bloom and the output), and each cone's `EmissionScale` is the record's (0.2 on Hoth's).
3. **The blizzard**: Hoth's `Blizzard_01` media (read from the record; lane G's entry has the fog row) over the open snow at noon: the fog pass darkens nothing it should not (no black halo at the horizon under the sky) and the sun's shafts show through it.
4. **The flare's occlusion**: the sun's flare fades by the record's occluder curve as a ridge covers the sun (the depth test over the sun's screen disc), tested pure on the curve and shown in a pan on the fixture.
5. **Cost**: the frame table with `--volume` on high and ultra on WebGL 2; the pass's cost under 2.5 ms at 1600 × 900 on the owner's laptop or the lane says what it is and sheds `FOG_STEPS` first.

---

### Task 1: The volumes file and the cones
- Create `scripts/bf2017-volumes.mjs` (+ `scripts/lib/bf2017-volumes.mjs`, test on a fixture of six entries): the extras' volumetric entities and the `FX_*LightCone*` spawns to `volumes.json` per cell beside the pack (`{ cells: { "cx,cz": [{ kind: 'cone' | 'box', pos, quat, scale, color, exponent, emission, effect? }] } }`), rebased like `lights.json`.
- Create `light/volumetrics.js`: `conesFor(json, cells, camera, { max })` (pure, by screen area), `coneLight(cone, lights)` (pure), `createVolumetrics(scene, renderer, { tier, lights }) → { set(list), update(camera), pass(colorNode), dispose }`.
- [ ] Tests; the fixture with `--volume` (a hangar box, six cones, a figure walking through); commit `The level's volumetric cones and shafts, ray-marched and cut by the spots' shadows`.

### Task 2: Fog with media
- Modify `light/fog.js` (`fogMedia(record)` pure: scattering, albedo, phase, absorption, height falloff from the record's media; the `fog: 'volume'` pass marching the slab under the sun, bilateral-upsampled, blended with the range fog), `post.js` and `passes.js` (`fog: 'volume'` on ultra and high).
- [ ] Tests on the media's conversion and the pass's data; the fixture under Hoth's `Blizzard_01` and `Sunny_01`; commit `Fog with the record's participating media, marched under the sun`.

### Task 3: God rays off the real sun; the flares
- Modify `passes.js` (`godrays` reads lane S's cascade light when its branch is on `main`, else `rays`); create `light/flare.js` (`flareElements(record) → LensflareNode config`, pure; `eventFlare(name)` from the 12 `LensFlareBlueprint`s read by `scripts/bf2017-volumes.mjs --flares` into `src/data/bf2017/flares.json`).
- [ ] Tests on the curves; the fixture's pan; commit `The sun's flare and the explosions' flares from the records; god rays off the sun's own shadow`.

### Task 4: Motion blur and depth of field as data
- Modify `post.js`/`passes.js`: `motionBlur: { scale }` and `dof: { focus, aperture, maxblur }` kinds, built from `MotionBlur` and `DepthOfFieldNode`; `passesFor` takes `motionBlur` from the weather's record (`MotionBlurEnable`, `MotionBlurScale`) on ultra and high and `dof` only when given (lane C's `cinematic.js`).
- [ ] Tests; commit `Motion blur as the record says; depth of field when a cinematic camera asks`.

### Task 5: Docs and the PR
- [ ] `docs/stack/webgpu-tsl.md`; the hand-off; the gates; merge `origin/main`; push; PR `Fidelity lane V: volumetrics, fog with media, god rays off the sun, the flares from the records` with the shots, the frame table, B2 answered.
