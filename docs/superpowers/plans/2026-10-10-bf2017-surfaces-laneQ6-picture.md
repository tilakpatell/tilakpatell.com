# Battlefront 2017 surfaces, lane Q6: the picture. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. Starts after #836's lanes S (`claude/fidelity-s-shadows`) and V (`claude/fidelity-v-volumetrics`, PR #841) merge: all three touch `post.js`; read their branches meanwhile.

**Goal:** The final picture is the record's: its HDR grading LUT after a linear tonemap, its bloom as five tinted Gaussians, its HBAO numbers in the ambient occlusion pass, its painted HDR sky panorama behind the scattering with its fog gradient, its cloud-shadow texture; all behind the entry's fields, nothing changing for a world without the record.

**Architecture:** `src/lib/three/light/grade.js` reads `TonemapComponentData`, `ColorCorrectionComponentData` and `DynamicAOComponentData` from `entry.record` into the chain's pass parameters (`post.js`'s `passesFor` takes a `grade` block: additive); `sky.js` gains a `panorama` layer behind the scattering and the gradient as the fog's colour by elevation; lane S's `clouds.js` takes the record's texture where it names one.

**Tech Stack:** three `^0.186.1` (`three/addons/tsl/display/{BloomNode,Lut3DNode,GTAONode}.js`, `three/tsl` `texture`, `equirectUV`, `mix`), lane G's `gameLut.js` (`loadLut`, `lutShape`), lane R's `post.js`, `passes.js`, `sky.js`, `apply.js`, lane S's `calibrate.js` and `clouds.js`, the bucket's `textures/levels/lighting/hoth/sunny_01/t_hoth_sunny_02_c.ktx2` (8,192 × 2,048 BC6U as KTX2) and `t_hoth_sunny_02_fog_c` (512 × 256 float: as PNG16 or the KTX2 the desktop made), `t_arctic_01_cloudshadow_rgbm`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md` (§6 "The picture", "Q6").

## Global Constraints

- **Files this lane owns**: `src/lib/three/light/grade.js` (+ test), `post.js` and `passes.js` (the `grade` block and the five-Gaussian bloom: additive), `sky.js` (`panorama`, `gradient`: additive), `apply.js` (wiring: additive), `light/fixtures/hoth.ve.json` (the three components' values, if absent), `scripts/light-fixture.mjs` (`--picture`: additive), `docs/superpowers/evidence/bf2017-surfaces/Q6/`. Nothing of S's or V's is replaced; merge `origin/main` before and after.
- **The order is the game's**: scene → bloom (five Gaussians) → tonemap (linear) → LUT → the site's output transform; the LUT is HDR (`HdrColorGradingLut`, `ColorGradingMaxHdrValue 1.0` on Hoth: the LUT's input range is 0–1 after the linear tonemap).
- Numbers with `_source`; the bloom's radii as the pyramid's levels (`GAUSSIAN_LEVELS = [1, 2, 3, 4, 5]` mips: a named constant, the record names weights and colours, not radii).
- Files under 800 lines; tests beside; no network in tests; the gates.

## Review Focus

1. **Five Gaussians as one `BloomNode`**: three's `BloomNode` has one radius and strength; five of them at five mip levels is five passes. Measure the frame cost on the fixture; if over 1.5 ms at 1600 × 900 on the WebGL 2 leg, collapse to the two heaviest (`Gaussian4`, `Gaussian5`: weights 0.35 and 0.5) and say so.
2. **The panorama's exposure**: the painted sky is in the record's units (HDR); through `calibrate.js`'s factor it must match the analytic sky's horizon within 10 % luminance where they meet, else the blend shows a band; the test pins the factor's application and the shot at the horizon is in the evidence.
3. **The LUT after tonemap**: a LUT applied before the tonemap crushes Hoth's snow; the chain's order is tested in `post.js`'s order test (the `lut` pass after `tonemap`).

---

### Task 1: `grade.js`

- [x] **Step 1: Failing tests**: `gradeOf(record) → { lut: { name, size }, bloom: { scale, weights[5], colors[5] }, ao: { radius, bias, attenuation, contrast, exponent, blur, sharpness }, tonemap: 'linear', _source }` on Hoth Sunny; `null` without the components.
- [x] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.

### Task 2: In the chain

- [x] **Step 1**: `passesFor` takes `grade`: the bloom's five levels, the LUT through `gameLut.js`'s `loadLut` as a `Data3DTexture` into `Lut3DNode`, the AO numbers into `GTAONode` (radius, the exponent as `distanceExponent`, the blur as the denoise's radius), the tonemap `linear` where the record says so (the site's ACES elsewhere).
- [x] **Step 2**: the order test; `node scripts/light-fixture.mjs --hoth --picture` on WebGL 2: before and after; the frame cost (Review Focus 1).

### Task 3: The sky's panorama and gradient, the cloud texture

- [x] **Step 1**: `sky.js`: `panorama` (the KTX2 HDR equirect through the stack's `loadCube`-like loader: `ktx2Loader`, `equirectUV` of the view direction) drawn behind the scattering with the record's `SkyBoxBlend`; the `SkyGradientTexture` as the fog's colour by view elevation (`fog.js` takes a `gradient` texture: additive); `clouds.js` takes `CloudShadowTexture` where the record names one (the RGBM decode: `rgb × a × 6`, a named constant from the suffix).
- [x] **Step 2**: the fixture's horizon shot (Review Focus 2); `galaxy-check surface hoth` per tier; the hand-off's row.
