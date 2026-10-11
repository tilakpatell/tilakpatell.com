# GPU-first lane N3: three distances of light. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. **Starts now from `origin/main`** on the lit fixture (`--hoth`) and the `battlefront` world; when T2 and G1 land, merge `origin/main` and wire `stack.js` (Task 4, Step 2). Branch `claude/gpu-n3-light` from `origin/main`. One PR.

**Goal:** Lumen’s shape on WebGPU: the game’s own baked radiosity (the Enlighten atlases) as the far and indoor bounce, a probe grid updated by a budget of probes a frame for the mid field, SSGI near, SSR with the probes as its miss; and Virtual Shadow Maps’ gain as cached far cascades fading into the export’s distant shadow cache.

**Architecture:** `src/lib/three/light/baked.js` samples a level’s irradiance atlas on `TEXCOORD_1` as the game material’s diffuse indirect term; `probes.js`’s grid becomes a budgeted, two-cascade DDGI-style update; `sun.js` gains a cascade cadence and `shadows.js` a `farCache`; the pack gains `enlighten` and `farShadow` rows written by `scripts/bf2017-level.mjs`; `stack.js` (lane T2’s) wires each by one call.

**Tech Stack:** three r186 `LightProbeGrid` (SH L2), `CSMShadowNode`, `SSGINode`, `SSRNode` with its denoiser, TSL; the export’s `StaticEnlightenData` (an HDR irradiance atlas, three direction maps, a sky-visibility map per level, RGBA16F KTX2 through lane W’s `atlases` job) and `textures/levels/` distant shadow caches (2,048², 16-bit PNG); Vitest; `scripts/light-fixture.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md` (§4 “N3”, §7, §8).

## Global Constraints

- The picture is the game’s: the atlas is Enlighten’s own output; no constant is hand-tuned where the record has one; `_source` on every number.
- The grid’s frame budget is `probes.js`’s `FRAME_BUDGET` (0.5 ms) read against G1’s GPU time: N probes a frame, N adapted so the budget holds; two cascades at 8 m and 32 m spacing round the player (`_source`: the research note’s DDGI section and Lumen’s radiance-cache spacing).
- The cadence: the two far cascades every fourth frame or when a tracked caster crosses them; the two near every frame; `BLEND` (0.15) fades the last cascade into the far cache as it fades into the record’s distant shadow today.
- SSR for roughness under 0.4 (Lumen’s cut); above it the probe or atlas.
- **The two roads** (the spec’s §11): the game’s charts where Q3’s spike reads them, else the site’s own path-traced bake (a lane W desktop job); the sampler and the pack rows take either. `three-gpu-pathtracer` is a desktop-script dependency with its own stack page, never shipped to a visitor.
- Until the atlases are in the bucket, the lane works on Hoth’s atlas from the desktop export (lane Q3’s probe of `EN_Hoth_01_Static_Sunset_*`) and the lit fixture; every other level lights up as lane W uploads: the loader treats a missing `enlighten` row as “none” and keeps today’s probes.
- The rules and the gates of the spec’s §10.

## Review Focus

1. A mesh without `TEXCOORD_1` (a prop the kit added, not the game’s): the material takes the probe term, never a garbage atlas lookup. Test: Task 1.
2. The atlas is HDR irradiance in the record’s exposure: `baked.js` applies lane S’s calibration (`light/calibrate.js`) so the mean luminance stays within the band. Test: Task 1’s luminance check on the fixture.
3. A probe re-rendered while the player stands inside its cell: the crossfade (`FADE`, 0.5 s) hides the update; no popping in 60 frames of the fixture at a fixed camera (pixel variance under 1/255 after convergence). Test: Task 2.
4. A caster entering a cached cascade between redraws leaves a frame without its shadow: the cadence redraws at once when a tracked body’s bounds enter the cascade (`track(object)` from `stack.js`). Test: Task 3.
5. A level whose far shadow cache is missing (the bucket lacks the row): the last cascade fades into the record’s distant shadow term as today. Test: Task 3.

---

### Task 1: the baked bounce (two roads, one sampler)

**The correction (the spec’s §11).** The game’s atlases are of no use without each instance’s chart, and the charts live in an Enlighten `DatabaseResource` the exporter never read; Hoth’s props carry one UV set. So the sampler takes either road: the game’s charts (if lane Q3’s desktop spike reads them: a per-instance `uvRect` and a per-mesh chart UV in the pack) or the site’s own bake (lane W’s `lightmaps` job: `three-gpu-pathtracer` on the owner’s GPU over a level’s static instances under the record’s sun, sky and `EnlightenComponentData` bounce numbers, into charts unwrapped per instance with `watlas`, written as RGBA16F KTX2 irradiance, three direction maps and a sky-visibility map, the same five-texture shape). This lane: `baked.js` reads `{ irradiance, dirX, dirY, dirZ, skyVisibility, charts: 'game' | 'site', rects }`; `scripts/desktop/bf2017-lightmaps.mjs` (the bake, run on the desktop; a `--dry` in the cloud on the fixture’s pillars at 64² proves the pipeline) and its stack page `docs/stack/pathtracer.md` written before the import; the fixture’s 256² cut is baked by the dry run, not cut from the game’s atlas. The row writer takes both shapes; a level with neither keeps today’s probes.

**Files:**
- Create: `src/lib/three/light/baked.js`, `baked.test.js`
- Modify: `scripts/lib/bf2017-level.mjs` (`enlighten` rows: `{ irradiance, dirX, dirY, dirZ, skyVisibility, uvSet: 1 }` per level, from `StaticEnlightenData`), `scripts/bf2017-level.test.mjs`
- Modify: `src/components/galaxy/surface/level/levelGltf.js` (binds the atlas set per pack once; hands `baked` to `createGameMaterial`), `src/lib/three/surface/compose.js` (the `indirectDiffuse` term: `baked ? atlas : probe`)

**Interfaces:**
- Produces: `createBaked(renderer, rows, { loadTexture, calibrate }) → Promise<{ node(uv1) → vec3 irradiance (directional through the three direction maps), skyVisibility(uv1) → float, dispose() } | null>`; `hasUv1(geometry) → boolean` (pure).
- Consumes: lane S’s `calibrate.js` exposure scale; T2’s `stack.js` calls `createBaked` and passes it to the level loader.

- [ ] **Step 1: failing tests**: the row writer on a fixture record; `hasUv1`; `createBaked` with a fake loader resolves `null` on no rows and a sampler otherwise; the TSL twin’s CPU function (`directionalIrradiance(irr, dirs, n)`) on known inputs.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5: the fixture**: `node scripts/light-fixture.mjs --hoth --baked --legs webgl` with Hoth’s atlas (a 256² cut committed as a fixture under `src/runtime/fixtures/`); the mean luminance within lane S’s band; shots to `docs/superpowers/evidence/gpu-first/N3/`.
- [ ] **Step 6: commit** `The game’s own baked bounce: the Enlighten atlas as the material’s indirect light`.

### Task 2: the budgeted probe grid

**Files:**
- Modify: `src/lib/three/light/probes.js` (`createProbeGrid(scene, renderer, bounds, res, { cubemapSize, far, budget: { ms = FRAME_BUDGET, gpuTime }, cascades = [8, 32] })`: `update(camera, dt)` re-renders the N stalest probes nearest the camera within the budget, two grids re-centred on the player by whole probe spacings, each probe’s SH written into the grid’s 3D target by compute; `stats() → { probesPerFrame, ms }`), `probes.test.js`

**Interfaces:**
- Produces: `scheduleProbes(stale: { age, distance }[], n) → indices` (pure, tested: oldest first, nearest among equals); `probesPerFrame(lastMs, budgetMs, current) → n` (pure: halves over budget, adds one under half the budget).
- Consumes: G1’s `gpuTime`.

- [ ] **Step 1: failing tests** for the two pure rules and the re-centring (a move of 9 m shifts the 8 m cascade by one spacing).
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5: the fixture**: 60 frames at a fixed camera on `--grid`: pixel variance under 1/255 after frame 20 (Review Focus 3).
- [ ] **Step 6: commit** `The probe grid updated by a budget of probes a frame, two cascades round the player`.

### Task 3: cached cascades and the far shadow cache

**Files:**
- Modify: `src/lib/three/light/sun.js` (`createSun(entry, { ..., cadence = { near: 1, far: 4 }, farCache = null })`; `SunCSM`’s `updateBefore` redraws cascade `i` when `frame % cadence[i] === 0` or a tracked bounds entered it since its last draw; `track(object)`, `untrack(object)`), `src/lib/three/light/shadows.js` (`farCache`: the record’s 2,048² distant shadow cache sampled in world space where the last cascade ends; `farTerm(worldPos) → float`), `sun.test.js`, `shadows.test.js`
- Modify: `scripts/lib/bf2017-level.mjs` (`farShadow` rows from `textures/levels/<level>/` caches), `src/components/galaxy/surface/level/levelGltf.js` (binds it)

**Interfaces:**
- Produces: `cascadeDue(i, frame, cadence, entered) → boolean` (pure); `farTerm`.

- [ ] **Step 1: failing tests**: `cascadeDue` on the table (near every frame; far every fourth; entered → true); a missing `farShadow` row → `farCache` `null` and `farTerm` returns the record’s distant term (Review Focus 5).
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5: the fixture**: `--shadows --cadence` draws the figures walking out of the near cascades: no frame without a shadow (a per-frame check that each figure’s foot pixel is darker than its neighbour’s unshadowed value).
- [ ] **Step 6: commit** `The far cascades cached and redrawn on a cadence, fading into the level’s distant shadow cache`.

### Task 4: SSR’s cut, the wiring, the laptop, the PR

- [ ] **Step 1**: `post.js`’s `ssr` row gains `roughnessCutoff: 0.4` (passed to `SSRNode`’s `roughnessCutoff` or `maxRoughness`, whichever r186 names: read the source and record it in `docs/stack/webgpu-tsl.md`); the probe fallback is the material’s own environment.
- [ ] **Step 2**: `src/components/galaxy/surface/nodes/stack.js` (lane T2’s): one call each for `createBaked`, the grid’s budget and `createSun`’s cadence and `farCache`; `track` on the figures and vehicles.
- [ ] **Step 3**, on the laptop: Hoth’s hangar and Endor’s village at ultra on WebGPU: FLIP against G1’s reference before and after (`scripts/frame-score.mjs`); GPU ms with and without the atlas and the grid (under 1.5 ms added); the cascade cadence’s saving (the two far cascades’ draw time, from `renderer.info` on the fixture); luminance within lane S’s band. The README with `_source`.
- [ ] **Step 4**: `docs/stack/webgpu-tsl.md` (the atlas, the grid, the cadence under “Where it is used”; `LightProbeGrid`’s compute write and `CSMShadowNode`’s `updateBefore` in Upgrading), the hand-off’s row and the desktop ask (lane W: the atlases and far caches for every level).
- [ ] **Step 5**: merge `origin/main`; the gates; push; PR `GPU-first lane N3: three distances of light`.
