# Fidelity lane S: the sun's shadows, robust. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Under the game's sun a level reads as the game reads: the exposure calibrated once so Hoth is Hoth's white and not blown, four cascades to the record's distance with soft edges from the sun's angular radius, the shadow cast from the record's shadow sun, cloud shadows drifting over the snow, a contact shadow under every figure, the far ground shaded by the baked cache, and the snow in a shaft lit while the snow beside it is not.

**Architecture:** `src/lib/three/light/` gains `calibrate.js` (pure: the game's units to the site's), `shadows.js` (the PCSS filter on `ShadowNode`, VSM fallback), `clouds.js` (the cloud shadow node), `contact.js` (the top-down pass); `sun.js` gains `CSMShadowNode` on a `DirectionalLight` for four cascades and the shadow-sun rotation; `apply.js` wires them. `scripts/light-fixture.mjs` gains `--hoth` (the fixture under Hoth's entry and `lights.json`) and `--shadows` (a figure, a wall, a long ground).

**Tech Stack:** three `^0.186.1`: `three/webgpu` (`ShadowNode`, `DirectionalLight`, `VSMShadowMap`), `three/addons/csm/CSMShadowNode.js`, `three/tsl`; the merged stack (`light/sun.js`, `entry.js`, `apply.js`, `passes.js`); lane G's `src/lib/three/shadowMask.js` and `gameLight.js` (merged, #833); `src/data/bf2017/maps/hoth.lighting.json` (the record's shadow, PCSS and cloud fields under `rows.weathers.<w>.sun.raw` and `.shadows`); Vitest; `scripts/light-fixture.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-fidelity-design.md` ("Lane S"; "Where the light stands", items 1 and 2).

## Global Constraints

- **Files this lane owns**: `src/lib/three/light/{calibrate,shadows,clouds,contact}.js` (+ tests), `light/sun.js` and `light/apply.js` (additive), `scripts/light-fixture.mjs` (flags), `docs/superpowers/evidence/galaxy-engine/S/`, the hand-off's lane S row. Nothing under `src/components/`.
- **One calibration**: `GAME_TO_SITE` is lane G's merged factor (read `src/lib/three/gameLight.js` on `main` and PR #833's text); `calibrate.js` imports it, never a second number. The node stack and the classic one must give the same sun intensity for Hoth Sunny: the test asserts it against `gameLight.js`'s output.
- **Every number from the record** (`hoth.lighting.json`'s `shadows`, `sun.raw`), the site's own named with a comment (`ULTRA_SHADOW_FAR = 140`, `PCSS_SAMPLES = { ultra: 256, high: 32 }`, `CONTACT_SIZE = 2`).
- Addon imports dynamic, in `light/` only; files under 800 lines; tests beside; no network in tests; the gates (`npm run lint`, `npm test`).
- The cloud's WebGPU device dies on the fixture (B5): run the WebGL 2 leg; leave the WebGPU column for the owner's laptop and say so.

## Review Focus

1. **The washed picture** (`evidence/galaxy-engine/R/post-ultra-webgl.png`): after calibration the fixture under Hoth's entry has a mean luminance within 10 % of lane G's calibrated classic shot of Hoth (`evidence/bf2017-G/`), and the snow is white, not clipped. Task 1's shot pair in the PR.
2. **Peter-panning and acne** on four cascades: the bias per cascade scales with its texel size; a figure's feet touch its shadow at 2 m and at 60 m in the `--shadows` fixture; the test on `splitsFor` and `biasFor` pins the numbers.
3. **The seam** between the last cascade and the shadow cache: a 15 % blend, no visible line on the long ground at the cascade's far; the fixture's shot at the seam.
4. **PCSS cost**: 256 samples on ultra is for the penumbra search only after the blocker search finds a penumbra; a fully lit or fully shadowed texel exits after the initial 8 (the record's `FilterErrorThresholdPct` 0.05 is the early-out). The frame table shows the shadow pass's cost on high and ultra.
5. **The shadow sun**: the light's direction and the shadow's differ (`SunRotation` vs `ShadowSunRotation`); the test asserts the shadow camera looks along the shadow rotation and the light's colour along the light's; the fixture's shot shows the longer shadows.

---

### Task 1: Calibration
- Create `light/calibrate.js` (+ test): `luminanceScale(tonemap) → k` (`2^EV × 1.2 / 2^ExposureCompensation`), `sunIntensity(record, k)`, `skyScale(record, k)`, `bloomThreshold(grading)`; `apply.js` reads them in place of `entry.js`'s inline formula (additive: `entry.js` calls `calibrate.js`).
- [ ] Failing tests pinned to Hoth Sunny against `gameLight.js`'s classic numbers; implement; pass.
- [ ] `node scripts/light-fixture.mjs --hoth --tier ultra --post on` (WebGL 2 leg); the shot beside lane G's; commit `The node stack's exposure calibrated to the game's Hoth, as the classic stack is`.

### Task 2: Four cascades and the shadow sun
- Modify `light/sun.js`: `cascades` 4 on ultra and high through `CSMShadowNode` on a `DirectionalLight`, 2 on mid, 0 on low; `far` from the record's `SunShadowmapViewDistance` per tier (`ULTRA_SHADOW_FAR` on ultra); the shadow rotation; `biasFor(cascade)`; the blend into lane G's `shadowMask.js` over the last 15 %.
- [ ] Tests: splits, bias, the shadow direction, the far per tier; the `--shadows` fixture (a figure at 2, 20, 60 m, a wall, 200 m of ground); commit `Four cascades to the record's distance, cast from the record's shadow sun, blended into the baked far shadow`.

### Task 3: Soft
- Create `light/shadows.js`: `pcssFilter(shadowNode, { initial, max, radiusDeg, threshold })` through `ShadowNode`'s filter hook (B1); `vsmFallback(light, samples)` when the hook is absent; `apply.js` picks by tier.
- [ ] Tests on the pure kernel's sample layout and early-out; the fixture's penumbra widening with distance from the blocker (two shots, 1 m and 10 m); commit `Soft sun shadows: PCSS from the sun's angular radius and the record's sample counts`.

### Task 4: Cloud and contact shadows, particles in shadow
- Create `light/clouds.js` (`cloudShadowNode(record, wind)`: the two layers' coverage, exponent, size and drift, multiplied into the sun's shadow term) and `light/contact.js` (`createContactShadows(scene, renderer, { size: CONTACT_SIZE, blur }) → { track(object), update(camera), dispose }`); export `sunShadowNode` from `apply.js` for lane X's sprites.
- [ ] Tests: the cloud term's range and drift, the contact pass's target size per tier; the fixture with `--shadows --clouds`; commit `Cloud shadows drift over the ground; a contact shadow under every figure; the shadow term shared with the particles`.

### Task 5: Docs and the PR
- [ ] `docs/stack/webgpu-tsl.md` ("Where it is used": CSMShadowNode, the filter hook); the hand-off's lane S row and Done/Left; the gates; merge `origin/main`; push; PR `Fidelity lane S: the sun's shadows, robust` with the calibration pair, the cascade and penumbra shots, the frame table (WebGL 2 leg; the WebGPU column marked for the laptop), B1 answered.
