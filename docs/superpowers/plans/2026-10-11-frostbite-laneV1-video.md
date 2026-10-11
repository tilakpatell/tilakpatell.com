# Lane V1: the video settings, and the clean picture by default. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Branch `claude/frostbite-v1-video` from `origin/main`. One PR, the first slice: the schema, the readers that exist on `main`, the panel, TRAA on high. N2’s knobs (upscaler, sharpening, frame rate) and the geometry and effects groups are the second slice, after N2 and N5 land.

**Goal:** A visitor turns the picture’s controls one by one under the presets, each a knob the code already has, and the high tier stops being grainy by default.

**Architecture:** `src/lib/video.js` is the schema and the store: every control with its kind, values, default per preset, whether a change is live, and the device ceiling it may not pass; `resolve()` gives the values a world reads. The readers take resolved values as one more argument (`passesFor`’s `refs.video`, `applyGameLight`’s `video`, `createSun`’s `video`, `filterFor`’s `samples`, `budget()`’s overlay for MSAA and anisotropy, `texSizeFor`’s tier from `textureTier`). The runtime hears `tp:video` and hands the world the new values (`revideo`, beside `requality`); the Battlefront world rebuilds its chain through `light.setVideo`. `Video.jsx` is the panel’s section under the Quality row.

**Tech Stack:** React 19 (the panel), Vitest 5, the node light stack under `src/lib/three/light/`, `src/components/settings/`’s store and parts.

**Spec:** `docs/superpowers/specs/2026-10-11-frostbite-gaps-design.md` §6 (on #927).

## Global Constraints

- Every control’s default per preset is the value the code draws today, so a visitor who never opens the menu sees what the preset drew before, except `aa` on high (`traa` where the backend has it: decision 1).
- A control never raises a budget row (`lib/budgets.js`, `BUDGETS`) above the device’s ceiling: `resolve` clamps a value whose cost rank is above the ceiling’s and says so (`held`).
- The readers open no store: each takes `video` as data; `src/lib/three/light/*` and `src/runtime/*` import nothing from `src/components`.
- The store is `tp-video` `{ v: 1, preset, ...overrides }`; `tp-quality` stays the preset’s key and `settings.js` is untouched but for reading the preset.
- Copy: British spelling, curly quotes, sentence case; a hint is one sentence (`docs/health/RULES.md`, UI 7).
- `src/data/health/latest.json` is not committed.

## Review Focus

1. A stored override for a control the device cannot afford (a phone with `gi: 'high'` saved from a laptop, or the same browser profile synced): `resolve` clamps it to the ceiling and the panel greys the values above, with the reason. Test: Task 1.
2. The Quality preset changed while overrides exist: the overrides are dropped (a preset is a whole row), the panel shows the preset’s values, `tp:video` fires once. Test: Task 1 (`write({ preset })` clears overrides).
3. A chain that loses its temporal pass (aa set to `smaa` or `off`): SSGI must fall to its plain preset and gain the denoiser; AO gains the denoiser (`arrange()` already does the first; the test pins both for a video override). Test: Task 2.
4. `nodes-webgl` with `aa: 'traa'` asked: the backend cannot; the chain takes SMAA as today and the panel says TRAA needs WebGPU. Test: Task 2 (CANNOT still wins).
5. A world without `revideo` (the galaxy surface on `main`, the classic worlds): a live change does nothing until the next mount; the panel offers the reload button as it does for quality. Test: Task 4 (`revideo` returns `'reload'` when the world has no hook).

---

### Task 1: the schema and the store

**Files:**
- Create: `src/lib/video.js`, `src/lib/video.test.js`

**Interfaces:**
- Produces:
  - `PRESETS = ['low', 'mid', 'high', 'ultra']`.
  - `CONTROLS`: an array of `{ id, group, label, hint, kind: 'choice' | 'range', values: [[value, label], …] | { min, max, step, show }, defaults: { low, mid, high, ultra }, live: boolean, cost: (value) => number, reader }`. The ids and their values:
    - `aa`: `off`, `smaa`, `traa`; defaults low `off`, mid `smaa`, high `traa`, ultra `traa`; live.
    - `msaa`: `0`, `2`, `4`, `8`; defaults `0`, `2`, `4`, `8`; reload (the classic renderer’s canvas).
    - `shadows`: `off`, `low` (2 at 1,024, PCF), `medium` (4 at 2,048, PCSS 32), `high` (4 at 2,048, PCSS 128), `ultra` (4 at 4,096, PCSS 256); defaults `off`, `low`, `medium`, `ultra`; reload.
    - `shadowDistance`: range 30 to 140 m step 10; defaults 30, 30, 30, 140; reload.
    - `contactShadows`, `cloudShadows`: `on`/`off`; defaults off, off, on, on and off, on, on, on; reload.
    - `gi`: `off`, `ssao`, `low`, `medium`, `high`; defaults `off`, `ssao`, `medium`, `high`; live.
    - `reflections`: `probes`, `half`, `full`; defaults `probes`, `probes`, `half`, `half`; live.
    - `volumetric`: `off`, `low`, `high`; defaults `off`, `off`, `low`, `high`; live.
    - `fogQuality`: `low`, `high`; defaults `low`, `low`, `low`, `high`; live.
    - `localLights`: `nearest`, `all`; defaults `nearest`, `nearest`, `all`, `all`; reload.
    - `bloom`, `lensFlare`, `godRays`, `depthOfField`: `on`/`off`; bloom on everywhere; flare and rays off, off, off, on; dof on everywhere (it draws only when a camera asks); live.
    - `motionBlur`: `off`, `camera`, `full`; defaults `off`, `off`, `full`, `full` (today the record decides on high and ultra; `camera` is the record’s scale with no per-object velocity, N2’s to add; until then `camera` draws as `full`); live.
    - `filmGrain`: `off`, `low`, `full`; defaults `full` everywhere but low (`off`); live.
    - `aberration`: `on`/`off`; defaults off, on, on, on; live.
    - `textures`: `low`, `mid`, `high`, `ultra` (the `texSizeFor` tiers); defaults by preset; reload.
    - `anisotropy`: `1`, `4`, `8`, `16`; defaults `1`, `4`, `16`, `16`; reload.
  - `presetValues(preset) → { [id]: value }`.
  - `resolve({ preset, overrides }, { ceiling = 'ultra' } = {}) → { values, custom: boolean, held: { [id]: value } }`: the preset’s values under the overrides, each clamped to the ceiling preset’s value where `cost(value) > cost(ceilingDefault)`; `held` names the ones clamped.
  - `read(store) → { preset, overrides }` (the preset from `tp-quality`’s level or `'auto'` → `null`; overrides from `tp-video`), `write(patch, store)` (a `preset` in the patch clears the overrides; returns the stored shape), `subscribe(fn)`, `EVENT = 'tp:video'`.
  - `textureTier(level, values) → 'low' | 'mid' | 'high' | 'ultra'`; `samplesFor(values) → number`; `anisotropyOf(values) → number`.

- [ ] **Step 1: failing tests** (`video.test.js`): every control has a default for every preset and the default is among its values (a `for` over `CONTROLS`); `presetValues('high').aa === 'traa'` and `presetValues('mid').aa === 'smaa'`; `resolve` with an override above the ceiling clamps and names it (Review Focus 1: `{ preset: 'mid', overrides: { gi: 'high' } }` at ceiling `mid` → `values.gi === 'ssao'`, `held.gi === 'high'`); `resolve` marks `custom` when an override differs from the preset and not when it equals it; `write({ preset: 'high' })` on a store holding overrides leaves `tp-video` with none (Review Focus 2); `read` on an empty store gives `{ preset: null, overrides: {} }`; `textureTier('high', { textures: 'mid' }) === 'mid'`.
- [ ] **Step 2: run** `npx vitest run src/lib/video.test.js`: FAIL.
- [ ] **Step 3: implement** `src/lib/video.js`. The store helpers (`get`, `set`, `json`) as `settings.js` has them; `write` dispatches `EVENT` on `window` when there is one, with `{ detail: resolve(read(store)).values }`.
- [ ] **Step 4: run**: PASS. `npm run lint`.
- [ ] **Step 5: commit** `The video settings’ schema and store: every control with its preset defaults, its ceiling and whether it is live`.

### Task 2: the chain reads the video

**Files:**
- Modify: `src/lib/three/light/post.js` (`TIERS.high` gains `traa` in `smaa`’s place; `passesFor(tier, entry, backend, refs)` reads `refs.video` through a new pure `applyVideo(chain, video, { tier })` exported for the test), `src/lib/three/light/post.test.js`

**Interfaces:**
- Produces: `applyVideo(passes, video, { tier }) → passes`: `aa` (`off` drops `traa` and `smaa`; `smaa` swaps `traa` for `smaa`; `traa` adds `traa`), `gi` (`off` drops `ssgi` and `ao`; `ssao` drops `ssgi` and keeps `ao`; `low|medium|high` sets the SSGI preset, adding the pass where the tier lacked it), `reflections` (`probes` drops `ssr`; `half` sets `resolutionScale: 0.5`; `full` sets `1`), `volumetric` (`off` drops `volumes`; `low|high` sets `steps` from `VOLUME_STEPS` and `max` cones from `CONES_LIT`), `fogQuality` (`steps` from `FOG_STEPS`), `bloom|lensFlare|godRays|depthOfField` off drops the kind, `motionBlur` (`off` sets `scale: 0`), then `arrange()`.
- Consumes: nothing new; `video` is Task 1’s `values` shape, every field optional (a missing field changes nothing).

- [ ] **Step 1: failing tests**: `the high tier’s chain ends in traa on WebGPU and smaa on nodes-webgl` (the existing tiers test updated); `applyVideo: aa off drops both, smaa swaps, and SSGI falls to plain with a denoiser` (Review Focus 3); `gi ssao keeps ao and drops ssgi; gi off drops both`; `reflections probes drops ssr; half and full set the scale`; `every field missing changes nothing` (deep equality with the chain given); `CANNOT still wins over aa traa on nodes-webgl` (Review Focus 4).
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run** `npx vitest run src/lib/three/light`: PASS.
- [ ] **Step 5: commit** `TRAA on high; the post chain reads the video settings`.

### Task 3: the sun, the shadows, the contact and cloud shadows, the volumetrics, the placed lights and the budget read the video

**Files:**
- Modify: `src/lib/three/light/sun.js` (`cascadesFor(tier, viewDistance, video)` honours `video.shadows` → `{ n, map }` from a `SHADOWS` table `{ off: { n: 0, map: 0 }, low: { n: 2, map: 1024 }, medium: { n: 4, map: 2048 }, high: { n: 4, map: 2048 }, ultra: { n: 4, map: 4096 } }` and `video.shadowDistance` → `far`; `createSun(entry, { …, video })`), `src/lib/three/light/shadows.js` (`filterFor(tier, pcss, { hook, video })`: `shadows` `low` → `pcf`, `medium` → PCSS 32, `high` → 128, `ultra` → 256, `off` → `none`), `src/lib/three/light/contact.js` (`contactFor(tier, video)`: `contactShadows` on/off), `src/lib/three/light/apply.js` (`applyGameLight(…, { video })` passes it to each, `cloudShadows` gates `cloudShadowNode`, `localLights` gives `createPlacedLights` `points: 64` for `nearest`, `volumetric` gates `createVolumetrics`; returns `setVideo(values)` that rebuilds the chain through `chainFor` and calls `onChain`), `src/lib/device.js` (`budget(tier, video)`: `samples` from `video.msaa`, `aniso` from `video.anisotropy`; the device’s own row is the ceiling), `src/lib/level/lod.js` (callers of `texSizeFor` pass `textureTier(tier, video)`: `levelGltf.js`, `levelPack.js`), their tests.

- [ ] **Step 1: failing tests**: `cascadesFor('high', VIEW, { shadows: 'low' })` → `{ n: 2, map: 1024 }`; `{ shadowDistance: 100 }` → `far: 100`; `filterFor('high', HOTH, { video: { shadows: 'ultra' } }).max === 256`; `contactFor('ultra', { contactShadows: 'off' }).on === false`; `budget('high', { msaa: 2, anisotropy: 4 })` → `samples 2, aniso 4`, and `budget('mid', { msaa: 8 })` → `samples 2` (the ceiling holds); `textureTier` through `texSizeFor`.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run** `npx vitest run src/lib/three/light src/lib/device.test.js src/lib/level`: PASS.
- [ ] **Step 5: commit** `The sun, the shadows, the lights and the budget read the video settings`.

### Task 4: the runtime and the Battlefront world hear a change

**Files:**
- Modify: `src/runtime/runtime.js` (`revideo(values) → 'tuned' | 'reload' | 'idle'`, the shape of `requality`: the world’s `onVideo(values)` or the module’s `onVideo(values, world, rt)`), `src/runtime/index.js` (`tp:video` → `instance.revideo(e.detail)`, `'reload'` → `tp:quality-reload` with `{ video: true }`), `src/runtime/runtime.test.js`, `src/components/battlefront/module.js` (reads `resolve(read()).values` once at mount through a `video` prop the runtime passes in `rt.video`, hands it to `applyGameLight`, implements `onVideo` by `light.setVideo(values)` then `swapPost(light.passes)`), `src/runtime/fixtures/litWorld.js` (the same, so the fixture shows the controls)

- [ ] **Step 1: failing tests**: `revideo` returns `'reload'` for a world without the hook (Review Focus 5), `'tuned'` when it has one and the hook was called with the values, `'idle'` with no world.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run** `npx vitest run src/runtime src/components/battlefront`: PASS.
- [ ] **Step 5: commit** `A video change reaches the world that is up: revideo beside requality; the Battlefront rebuilds its chain`.

### Task 5: the panel

**Files:**
- Create: `src/components/settings/Video.jsx` (the groups as `<Row>`s of `Segmented` and `Slider`, the control’s hint, a value above the ceiling disabled with the ceiling’s reason, “Custom” shown beside the Quality row when `resolve().custom`, a reload note for a non-live change as the Quality row has it), `src/components/settings/video.test.js` (the pure helpers the panel uses: `optionsFor(control, ceiling)` marks disabled values; `groupsOf(CONTROLS)`)
- Modify: `src/components/settings/Settings.jsx` (renders `<Video>` after the Quality row; the Sharpness row is renamed “Render resolution” and shows per cent: `${Math.round(v × 100)}%`, the same key), `src/styles/lazy/settings.css` (a `.settings-group` heading and a disabled option’s face, from the tokens), `src/components/guide/pages.js` only if it names the settings’ rows (check)

- [ ] **Step 1: failing tests**: `optionsFor` disables values above the ceiling and keeps the preset’s; `groupsOf` returns the groups in the schema’s order.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4**: `npm run lint`; `npx vitest run src/components/settings src/styles`; `npx vite build`; `node scripts/autopilot-check.mjs --only smoke` if it covers the settings panel (else a dev-server shot of the panel open at each preset into the evidence folder).
- [ ] **Step 5: commit** `The video menu under the presets: every control a knob the code has, Custom when a visitor turns one`.

### Task 6: the docs, the gates, the PR

- [ ] **Step 1**: `docs/architecture.md`’s settings line names `lib/video.js` and the menu; `docs/stack/webgpu-tsl.md` “How the site uses it” names `refs.video`; `docs/superpowers/evidence/frostbite-gaps/v1/README.md` with the panel’s shots and the high tier’s chain before and after.
- [ ] **Step 2**: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && npm run coverage:bf2017 && npm run maps:bf2017`; `git checkout -- src/data/health/latest.json`.
- [ ] **Step 3**: merge `origin/main`; push; draft PR `Lane V1: the video settings, and the clean picture by default`; the design’s row on #927.
