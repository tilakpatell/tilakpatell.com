# Galaxy upgrade, Phase 1: performance and fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the galaxy's space scene and its worlds measurably lighter (fewer draw calls, triangles and wasted passes, no per-frame garbage in hot paths), and fix the bugs found in exploration, with nothing visible lost.

**Architecture:** Each change goes at its owner: shared helpers in `src/lib/three/`; the space scene in `src/components/galaxy/`; the worlds in `src/components/galaxy/surface/`. Pure logic gets a pure, tested helper. GPU-side changes are proven by `scripts/galaxy-check.mjs` counts and screenshots.

**Tech Stack:** React 19, Vite 8, three.js r186 (`three/examples/jsm`), Vitest 5 (Node), `@gltf-transform/*` 4, meshoptimizer, sharp, playwright-core (headless Chromium).

**Spec:** `docs/superpowers/specs/2026-10-05-galaxy-upgrade-design.md` (Phase 1)

## Global Constraints

- Don't edit `src/components/universe/{shipModels,hulls,livery,modules,outfit,paint}.js` or `Hangar.jsx`. Don't swap `xwing-hd.glb` or `falcon-hd.glb`. Keep `/models/universe/falcon.glb`.
- No sequel-trilogy (Episodes 7–9) content anywhere.
- Code style: match the surrounding code. Plain ES modules; comments in the codebase's voice (plain prose about what the thing is, no "we"); no TypeScript; 2-space indent; single quotes; Prettier-like formatting with long lines allowed (the codebase uses ~200-column lines).
- Every new pure module has a `*.test.js` beside it, run by `npx vitest run <file>`.
- DEV-only hooks go behind `import.meta.env.DEV`.
- Before each commit: `npx eslint <changed files>` is clean, and the task's tests pass.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Wmw65yyvV2Td5cUTKwLG3j
  ```
- Never print or commit `SKETCHFAB_API_TOKEN`, `MESHY_API_KEY` or `MESHY_KEY`.
- Measuring: the dev server runs on port 5188 (`npx vite --port 5188 --strictPort --host 127.0.0.1`). `OUT=<dir> node scripts/galaxy-check.mjs space|surface <ids>` prints one frame's counts per view. The baseline is in the spec.

## Review Focus

- **A phone or mid tier (`?quality=mid`, `small` true).** The sky bake at 512, LODs, shadow proxies and lamps must all work with `small`. Task 5 and Task 10 tests construct with `small: true`.
- **Leaving the page mid-jump or mid-bake.** `dispose()` must free the cube render target and stop any idle prebuild. Task 5 and Task 6 check a `disposed` guard.
- **Tinted or skinned slots.** These never get an LOD. Task 9 tests that `slot(kind, size, { tint })` holds no `THREE.LOD`.
- **Quests that move you into a zone while a near-shadow caster or hidden outdoor group is active.** Visibility must follow the zone you're in after `putAt`. Task 11 covers it with the `zoneVisibility(inZone)` helper test.
- **Context loss and remount.** Module-level caches (`gltfCache`, the crew cache, the placer cache) must survive a new renderer, since three re-uploads to a new context. Task 1 tests that a cached entry is reused after the first consumer disposes its clone.

---

### Task 1: Shared helpers — glass, the GLTF cache, a lighter post

**Files:**
- Create: `src/lib/three/glass.js`, `src/lib/three/glass.test.js`
- Create: `src/lib/three/gltfCache.js`, `src/lib/three/gltfCache.test.js`
- Modify: `src/components/universe/post.js` (add `lite()` beside `off()`)

**Interfaces:**
- Produces:
  - `dropTransmission(root: Object3D) → number`: for every material with `transmission > 0`, it sets `transmission = 0`, `transparent = true`, `opacity = 0.35`, `depthWrite = false` and `needsUpdate = true`, and returns how many it changed.
  - `loadGLTF(url: string, { loader }?) → Promise<GLTF | null>`: one fetch and parse per URL for the page's life. The loader defaults to a `GLTFLoader` with `MeshoptDecoder`. A failed load resolves `null` and is removed from the cache, so a later call retries.
  - `cloneScene(gltf: GLTF) → Object3D`: a deep copy. It uses `SkeletonUtils.clone` when any mesh is skinned, and `scene.clone(true)` otherwise. Materials are cloned (`material.clone()`), and textures and geometry are shared.
  - `gltfStats() → { requests, parses }`: DEV only.
  - `post.lite()`: turns bloom off and keeps the grade pass. Calling it twice is harmless. `post.on` stays true.

- [ ] **Step 1: Write the failing tests**

```js
// glass.test.js
it('turns transmission into plain see-through glass', () => {
  const root = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ transmission: 0.78 });
  const paint = new THREE.MeshStandardMaterial();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), [glass, paint]));
  expect(dropTransmission(root)).toBe(1);
  expect(glass.transmission).toBe(0);
  expect(glass.transparent).toBe(true);
  expect(glass.opacity).toBeCloseTo(0.35);
  expect(glass.depthWrite).toBe(false);
  expect(paint.transparent).toBe(false);
});
// gltfCache.test.js (a fake loader: { loadAsync: vi.fn(async (url) => ({ scene, animations: [] })) })
it('fetches and parses each url once', async () => { /* two loadGLTF(same url) → loadAsync called once, same object */ });
it('forgets a failure so the next call retries', async () => { /* first rejects → resolves null; second call calls loadAsync again */ });
it('clones with materials of its own and the textures shared', () => { /* clone.material !== src.material; clone.material.map === src.material.map; geometry shared */ });
it('a cached entry still clones after an earlier clone is disposed', () => { /* dispose clone's material → cloneScene(gltf) again works, map still the same Texture */ });
```

- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/lib/three/glass.test.js src/lib/three/gltfCache.test.js`. Expected: FAIL (the modules don't exist).
- [ ] **Step 3: Implement** `glass.js`, `gltfCache.js` and `post.lite()`. In `lite()`, set the bloom pass's `enabled = false` and make `flare()` a no-op while it's off.
- [ ] **Step 4: Run the tests and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/lib/three/glass.* src/lib/three/gltfCache.* src/components/universe/post.js && git commit` with the message "Shared: glass without transmission, one parse per GLB, a lighter post".

### Task 2: Space render settings — no double MSAA, Falcon glass, detail that follows the frame rate

**Files:**
- Modify: `src/components/galaxy/scene.js`: `createRenderer` at about line 162; the HD ship load at about line 397; `lowerQuality()` at about line 1788; the per-frame code after `pace.frame`.
- Modify: `src/components/galaxy/bodies.js`: `setDetail` in the returned object, about line 286.
- Modify: `src/components/galaxy/world.js`: `setDetail(k)` on the built system, passed to every body it made.
- Modify: `src/components/galaxy/sky.js` and `world.js` skylanes: the point size from the live ratio.
- Test: `src/components/galaxy/bodies.test.js`

**Interfaces:**
- Consumes: `dropTransmission` and `post.lite()` (Task 1).
- Produces:
  - `body.setDetail(k: number)`: k is clamped to 0…1, and `uMaxOct = Math.round(4 + (max − 4) * k)`, where `max` is the octave count the body was built with (9 high, 5 small).
  - `world.setDetail(k)`: forwards it to every body.
  - `sky.setRatio(r)`: now called whenever `renderer.getPixelRatio()` changes, checked each frame.
  - Skylanes read `uDpr` from a `setRatio`-style update, not from `window.devicePixelRatio`.

- [ ] **Step 1: Write the failing tests.**

```js
it('drops its noise octaves with the detail asked for, never under 4', () => {
  const b = buildBody('tatooine', { r: 30, small: false });
  b.setDetail(1);   expect(uniformOf(b, 'uMaxOct')).toBe(9);
  b.setDetail(0);   expect(uniformOf(b, 'uMaxOct')).toBe(4);
  b.setDetail(0.5); expect(uniformOf(b, 'uMaxOct')).toBe(7); // round(4 + 5 * 0.5) = round(6.5)
  const s = buildBody('tatooine', { r: 30, small: true });
  s.setDetail(1);   expect(uniformOf(s, 'uMaxOct')).toBe(5);
});
```

`uniformOf` is a local test helper that reads the surface material's uniform. If `bodies.test.js` already has a way in, use that.

- [ ] **Step 2: Run the test and see it fail.** `npx vitest run src/components/galaxy/bodies.test.js`. Expected: FAIL (`setDetail` is not a function).
- [ ] **Step 3: Implement.**
  - Pass `antialias: false` to `createRenderer` in the galaxy scene.
  - Call `dropTransmission` on the player's HD model right after it loads.
  - `lowerQuality()` calls `post.lite()` and sets a `capDetail = 0` flag. Each frame then calls `state.world?.setDetail(capDetail ? 0 : post.sharpness)`, but only when the value changed by 0.05 or more.
  - Each frame, if `renderer.getPixelRatio()` differs from the last one seen, call `sky.setRatio(ratio)` and the skylanes' equivalent.
- [ ] **Step 4: Run the tests and see them pass.** `npx vitest run src/components/galaxy/bodies.test.js src/components/galaxy/world.test.js`. Expected: PASS.
- [ ] **Step 5: Check it in the browser.** `OUT=… node scripts/galaxy-check.mjs space tatooine,endor`, and `SHIP=falcon` for Tatooine. Expected: no errors, and screenshots like the baseline's.
- [ ] **Step 6: Commit.** "Galaxy: one multisample, the Falcon's glass without its extra pass, planet detail that follows the frame rate".

### Task 3: Space fixes — the crash shockwave, hits that cut off explosions, the first-shot hitch, stand-ins

**Files:**
- Modify: `src/components/galaxy/bodies.js` (return `surface`); `src/components/galaxy/scene.js` (the crash at about line 814; `pops` for kills only; `models.want` at about line 307).
- Modify: `src/components/galaxy/fx.js` (`setColorAt(0, white)` when the bolts and flashes meshes are made, then `instanceColor.needsUpdate = true`).
- Modify: `src/components/galaxy/models.js` (`STAND_IN`).
- Test: `bodies.test.js`, `models.test.js`, a new `fx.test.js`.

**Interfaces:**
- Produces:
  - `buildBody(...).surface: THREE.Mesh`.
  - `STAND_IN = { venator: 'destroyer', slave1: 'freighter', falcon: 'freighter' }`, exported from `models.js`. In `fill()`, a kind with no built version of its own uses `template(STAND_IN[kind])` until it loads. Phase 3 replaces these entries with proper code-built kinds.
  - `wantsDeathStar(sys) → boolean` in `systems.js`: true when any piece's type is `deathstar` or its kind is `deathstar`.

- [ ] **Step 1: Write the failing tests.**

```js
// bodies.test.js
it('hands back the mesh a crash can mark', () => { expect(buildBody('hoth', { r: 20 }).surface.isMesh).toBe(true); });
// models.test.js
it('gives every loaded kind with no built version a stand-in that is built', () => {
  for (const k of Object.keys(MODELS)) if (!BUILT_KINDS.includes(k) && !GALAXY_KINDS.includes(k) && k !== 'deathstar') expect(GALAXY_KINDS.concat(BUILT_KINDS)).toContain(STAND_IN[k]);
});
// systems.test.js
it('loads the Death Star only where there is one', () => {
  expect(wantsDeathStar(systemById('yavin'))).toBe(true);
  expect(wantsDeathStar(systemById('hoth'))).toBe(false);
});
// fx.test.js
it('makes its bolts with instance colours from the start', () => { const b = createBolts(/* as scene.js does */); expect(b.mesh.instanceColor).toBeTruthy(); });
```

If `fx.js` doesn't expose the mesh, expose it as `mesh` on the returned object for the test.

- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
  - The crash passes `body.surface`.
  - A non-lethal hit (anything that isn't a kill or a crash) calls `flashes.at(point, { size, life })` instead of `pops.hit`.
  - The scene calls `models.want([...'destroyer','corvette','xwing','interceptor', ...(wantsDeathStar(sys) ? ['deathstar'] : [])])`.
  - `fill()` uses `STAND_IN`.
- [ ] **Step 4: Run them and see them pass.** `npx vitest run src/components/galaxy`.
- [ ] **Step 5: Check it in the browser.** On Geonosis, `window.__galaxyDebug` can drive a crash into the planet. Screenshot the shockwave shell.
- [ ] **Step 6: Commit.** "Galaxy: the crash shockwave plays, hits stop cutting off explosions, no first-shot hitch, stand-ins for the Venator, Slave I and the Falcon".

### Task 4: One parse per GLB in the galaxy

**Files:**
- Modify: `src/components/galaxy/models.js` (`load`), `src/components/universe/glbFleet.js` (its loader at about line 52), `src/components/universe/planets.js` (`loadModel` at about line 1161).

**Interfaces:**
- Consumes: `loadGLTF` and `cloneScene` (Task 1).
- Produces: no change to these modules' exported signatures. `loadModel(url)` still resolves to an Object3D or `null`; it now returns `cloneScene(gltf)`.

- [ ] **Step 1: Change all three loaders** to `loadGLTF(url).then((g) => g && cloneScene(g))`. The existing `tune` and `normalise` steps then run on the clone. `glbFleet` keeps its own roughness clamp, now on its own cloned materials.
- [ ] **Step 2: Run the tests.** `npx vitest run src/components/galaxy src/components/universe`. Expected: PASS; there are no behaviour tests here, and the existing ones must stay green.
- [ ] **Step 3: Check it in the browser.** In DEV on `/galaxy/hoth`, after 10 s, `gltfStats()` (exposed as `window.__gltfStats`) shows `parses` equal to the number of distinct URLs. `star-destroyer.glb` is counted once.
- [ ] **Step 4: Commit.** "Galaxy: one fetch and parse per model, shared between the set pieces and the fleets".

### Task 5: The sky, baked once per system, and richer

**Files:**
- Modify: `src/components/galaxy/sky.js`
- Modify: `src/components/galaxy/scene.js` (`createSky({ small, renderer })`; the bake called from `dress`, Task 6. Until Task 6 lands, call it in `enter`.)
- Test: create `src/components/galaxy/sky.test.js`

**Interfaces:**
- Produces:
  - `nebulaeOf(sys) → Array<{ dir: [x,y,z] (unit), color: '#rrggbb', size: number (radians, 0.18–0.45), warp: number (0.6–1.6) }>`, length 3. It's seeded from `sys.id`: the same for the same system, and different between systems.
  - `sky.bake(renderer)`:
    - Renders the band, lanes, core and nebulae into a `WebGLCubeRenderTarget`: 1024 a face when not `small`, 512 when `small`. `type: UnsignedByteType`, `colorSpace: SRGBColorSpace`, `generateMipmaps: true`, `minFilter: LinearMipmapLinearFilter`.
    - The render uses a `CubeCamera` at the origin and a scene holding only the bake sphere.
    - It saves and restores the renderer's render target, `autoClear` and tone-mapping state.
  - The visible sky sphere's material becomes a cube lookup: `textureCube` on the normalised direction, plus a ±0.5/255 hash dither.
  - Before the first bake, the sphere draws black, with stars and suns as now.
  - `dispose()` frees the cube target.
  - The bake shader keeps the current band, lanes and core, and adds:
    - domain-warped fbm at 7 octaves;
    - three nebulae from `nebulaeOf`, each an emission colour cloud;
    - dark dust that cuts into the band and the nebulae;
    - a faint fine star-cloud glow along the band, above 4 octaves of value noise.

- [ ] **Step 1: Write the failing tests.**

```js
it('gives each system three nebulae of its own, the same every time', () => {
  const a = nebulaeOf(systemById('hoth')), b = nebulaeOf(systemById('hoth')), c = nebulaeOf(systemById('naboo'));
  expect(a).toHaveLength(3); expect(a).toEqual(b); expect(a).not.toEqual(c);
  for (const n of a) { expect(Math.hypot(...n.dir)).toBeCloseTo(1, 5); expect(n.size).toBeGreaterThanOrEqual(0.18); expect(n.size).toBeLessThanOrEqual(0.45); }
});
it('sizes its bake by the tier', () => { expect(bakeSize({ small: false })).toBe(1024); expect(bakeSize({ small: true })).toBe(512); });
```

- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/components/galaxy/sky.test.js`
- [ ] **Step 3: Implement** `nebulaeOf`, `bakeSize`, `bake` and the lookup material.
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Check it in the browser.** `space coruscant,tatooine,hoth,endor`. In the screenshots, the band and core are where they were, with visible nebula structure. The counts show no extra per-frame draws.
- [ ] **Step 6: Commit.** "Galaxy: the sky baked into a cube once per system, with richer nebulae for the same cost".

### Task 6: Smooth jumps

**Files:**
- Modify: `src/components/galaxy/scene.js` (`startJump`, `jumpFrame`'s tunnel phase, `enter`, a new `dress`); `src/components/galaxy/models.js` (`prebuild(kinds)`); `src/components/galaxy/systems.js` (`kindsIn(sys)`).
- Test: `systems.test.js`, `models.test.js`

**Interfaces:**
- Produces:
  - `kindsIn(sys) → string[]`: the unique slot kinds every piece of the system uses. It covers `fleet.ships[].kind`, `battle.sides.*[].kind`, `battle.fighters.*[]`, `chase` kinds, `liftoff.kind`, `patrol` and `escape` kinds, whatever `world.js`'s BUILD reads. It excludes rocks and bodies.
  - `models.prebuild(kinds)`: builds the code-built templates for those kinds, one kind per idle slice. It uses `requestIdleCallback` where it exists and `setTimeout(…, 0)` otherwise, and stops when disposed.
  - `dress(sys)`: does the sky bake and the environment map.
  - `enter(sys)` no longer bakes or makes the environment.
  - The tunnel calls `enter` at `age > 0.12` (as now) and `dress` on the next frame.
  - DEV: `window.__galaxy().longest` is the longest frame, in ms, since the last jump started.

- [ ] **Step 1: Write the failing tests.**

```js
it('lists the kinds a system flies', () => {
  expect(kindsIn(systemById('hoth'))).toEqual(expect.arrayContaining(['executor', 'destroyer']));
  expect(new Set(kindsIn(systemById('endor'))).size).toBe(kindsIn(systemById('endor')).length);
  for (const s of SYSTEMS) for (const k of kindsIn(s)) expect(typeof k).toBe('string');
});
it('prebuilds nothing once disposed', async () => { const m = createModels(); m.dispose(); m.prebuild(['tie']); await new Promise((r) => setTimeout(r, 20)); /* no throw; built map stays empty (expose built count on the object for the test) */ });
```

- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.** `startJump` calls `models.want(kindsIn(dest))` and `models.prebuild(kindsIn(dest))`.
- [ ] **Step 4: Run them and see them pass.** `npx vitest run src/components/galaxy`
- [ ] **Step 5: Check it in the browser.** Jump Tatooine → Hoth with `__galaxyDebug.startJump('hoth','course')`. The system arrives, and `longest` is recorded.
- [ ] **Step 6: Commit.** "Galaxy: the next system made ahead and dressed a frame later, so the jump doesn't stall".

### Task 7: Rocks that tumble on the GPU

**Files:**
- Modify: `src/components/galaxy/rocks.js`
- Test: `src/components/galaxy/bodies.test.js` (where the rock tests live) or a new `rocks.test.js`

**Interfaces:**
- Produces:
  - `createRocks(...)`: the same signature and return.
  - Each instance's matrix is position and scale only, written once.
  - New `InstancedBufferAttribute`s: `aSpinAxis` (vec3) and `aSpin` (vec2: phase, speed).
  - The rock and hot materials take an `onBeforeCompile` that rotates `transformed` and `objectNormal` about `aSpinAxis` by `aSpin.x + uTime * aSpin.y`.
  - `update(t)` sets `uTime` only. It no longer writes matrices and no longer flags `instanceMatrix.needsUpdate`.
  - The smallest half of the rocks by size use a separate geometry bucket, one icosahedron subdivision coarser than their variant had.

- [ ] **Step 1: Write the failing tests.**

```js
it('writes its rocks once and turns them on the GPU', () => {
  const r = createRocks({ kind: 'ring', inner: 54, outer: 88, thickness: 5, count: 300, seed: 11 });
  const meshes = []; r.group.traverse((o) => o.isInstancedMesh && meshes.push(o));
  const versions = meshes.map((m) => m.instanceMatrix.version);
  r.update(10, null);
  expect(meshes.map((m) => m.instanceMatrix.version)).toEqual(versions);
  for (const m of meshes) expect(m.geometry.getAttribute('aSpinAxis')).toBeTruthy();
});
it('gives the small rocks the coarser shape', () => {
  /* the triangle count per instance of the smallest-size bucket < that of the biggest bucket */
});
```

- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.** Put the attributes on per-bucket geometry copies, so the variants' geometries stay shared.
- [ ] **Step 4: Run them and see them pass.** `npx vitest run src/components/galaxy`
- [ ] **Step 5: Check it in the browser.** `space geonosis,hoth,alderaan`. The rocks still tumble: two screenshots 2 s apart differ. Geonosis triangles ≤ 300k.
- [ ] **Step 6: Commit.** "Galaxy: asteroids tumble in the vertex shader, the small ones lighter".

### Task 8: No per-frame garbage in space

**Files:**
- Modify: `src/components/galaxy/scene.js` (about lines 518–533, 920–922, 1076, 1164, 1407, 1454, 1461, 1625); `world.js` (about 203, 756); `fx.js` (about 172–181: skip the upload flags when the count is 0); `space.js` (about 93); `systems.js` (`starAhead`, about 1048).
- Test: `systems.test.js`

**Interfaces:**
- Produces: `starAhead(sys, heading, pitch, …, dirs?)`. It takes an optional precomputed list of `{ id, dir }` (the sky's `beacons`); when that's given, it doesn't call `courseTo`. Its results are identical either way.

- [ ] **Step 1: Write the failing test.**

```js
it('finds the same star ahead from the sky's own bearings', () => {
  const sys = systemById('tatooine');
  const dirs = SYSTEMS.filter((o) => o.id !== sys.id).map((o) => ({ id: o.id, dir: courseTo(sys, o) }));
  for (const [h, p] of [[0, 0], [1.2, 0.1], [-2.5, -0.3]]) expect(starAhead(sys, h, p, undefined, dirs)).toEqual(starAhead(sys, h, p));
});
```

Use the real parameter list of `starAhead`.

- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Implement.** Hoist temporaries to module or closure scope (`const _v = new THREE.Vector3()`, and so on), replace `clone()` in loops with `copy` into those, drain `events` by index instead of `splice(0)`, and replace array spreads in per-frame paths with loops. The scene passes `sky.beacons` to `starAhead`.
- [ ] **Step 4: Run the tests.** `npx vitest run src/components/galaxy src/components/universe`. Expected: PASS.
- [ ] **Step 5: Commit.** "Galaxy: no garbage made every frame in the flying, the camera, the jump or the set pieces".

### Task 8b: The new Sketchfab ships in the galaxy

The network was opened mid-phase. Ten ships came out better from Sketchfab than code-built would: they're processed on branch `claude/galaxy-assets-wip` (commit 6ef170b; report in `lab/assets-report.md`). They're wired in here, before Task 9, so they get LODs too.

**Files:**
- Merge: branch `claude/galaxy-assets-wip`. It adds `public/models/galaxy/{tie,tiebomber,tieadvanced,shuttle,lightcruiser,gozanti,munificent,providence,nubian,ghost}.glb`, their entries in `scripts/sketchfab-galaxy.mjs`, and `galaxy-<kind>` credits in `src/data/modelCredits.json`.
- Modify: `src/components/galaxy/models.js` (`MODELS` and `HUNTER_GLB`); `src/data/modelCredits.json` (`surface-razorcrest`'s `also` gains `'galaxy'`); `src/components/galaxy/models.test.js`.

**Interfaces:**
- `MODELS` gains:
  - `tie: { url: '/models/galaxy/tie.glb', nose: 0 }`
  - `tiebomber: { url: '/models/galaxy/tiebomber.glb', nose: 0 }`
  - `tieadvanced: { url: '/models/galaxy/tieadvanced.glb', nose: 0 }`
  - `shuttle: { url: '/models/galaxy/shuttle.glb', nose: 0 }`
  - `lightcruiser: { url: '/models/galaxy/lightcruiser.glb', nose: -Math.PI / 2 }`
  - `gozanti: { url: '/models/galaxy/gozanti.glb', nose: 0 }`
  - `munificent: { url: '/models/galaxy/munificent.glb', nose: 0 }`
  - `providence: { url: '/models/galaxy/providence.glb', nose: 0 }`
  - `nubian: { url: '/models/galaxy/nubian.glb', nose: 0 }`
  - `ghost: { url: '/models/galaxy/ghost.glb', nose: 0 }`
  - `razorcrest: { url: '/models/galaxy/surface/razorcrest.glb', nose: 0 }`
- `HUNTER_GLB` gains `tie` and `tieadvanced`, from `MODELS` with `built: true`, so the galaxy's Imperial hunters fly the Sketchfab TIEs once they load.
- The header comment lists the new ones.
- `STAND_IN` gains `tiebomber: 'tie'`, `lightcruiser: 'destroyer'`, `gozanti: 'freighter'`, `providence: 'munificent'` and `ghost: 'freighter'`, so none of them is ever invisible. Kinds that have a built version (`tie`, `tieadvanced`, `shuttle`, `munificent`, `nubian`, `razorcrest`) fly it until the GLB loads.

- The branch also carries Luke and Leia (commit 35c9484): Sketchfab figures rigged by Meshy (Meshy's 24 joints, so Rick's borrowed clips drive them), in `public/models/galaxy/crew/{luke,leia}.glb`, with credits `crew-luke` and `crew-leia`. They're wired here too:
  - `universe/footScene.js`'s `PARTY.xwing` Luke takes `src: { url: '/models/galaxy/crew/luke.glb' }`, as Han's does.
  - `galaxy/surface/crew.js` gains `luke`, `leia` and `chewie`. Chewie uses the existing Meshy-rigged `/models/cockpit/chewie.glb`, which `PARTY.falcon` already walks.
  - Each credit's `where` and `also` name every page that shows the figure, so `modelCredits.test.js` passes.
- [ ] **Step 1: Merge** `git merge --no-ff claude/galaxy-assets-wip`. Resolve `modelCredits.json` by keeping both sides' entries.
- [ ] **Step 2: Write the failing test.** `models.test.js`: every new kind is in `MODELS` with an existing file, and every kind in `MODELS` without a built version has a `STAND_IN` that is built. The existing test then covers the new ones too. `src/data/modelCredits.test.js` passes, so every new credit is referenced.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests.** `npx vitest run src/components/galaxy src/data`
- [ ] **Step 5: Check it in the browser.** `space endor,hoth,coruscant,nevarro`. The TIEs, the Munificents and the Razor Crest are the new models, with no errors.
- [ ] **Step 6: Commit.** "Galaxy: ten Sketchfab ships in place of the built ones: TIEs, the Lambda, the Ghost, Gideon's cruiser, the Gozanti, the Munificent, the Invisible Hand, the Naboo royal starship"

### Task 9: Fighter and capital-ship LODs, made offline

**Files:**
- Create: `scripts/galaxy-lod.mjs`
- Create: `public/models/galaxy/lod/<kind>.glb`, one for every kind in `MODELS` except `deathstar`.
- Modify: `src/components/galaxy/models.js` (an `lod` URL per kind, `LOD_NEAR = 45` and `LOD_FAR = 900`, the slot built as a `THREE.LOD`).
- Test: `src/components/galaxy/models.test.js`

**Interfaces:**
- Consumes: `loadGLTF` (Task 1).
- Produces:
  - `lodUrl(kind) → string | null`: `/models/galaxy/lod/${kind}.glb`, or null for `deathstar`.
  - `lodLevels(size) → [[0, 'full'], [LOD_NEAR * size, 'lod'], [LOD_FAR * size, 'none']]`.
  - A slot with no tint and no skin, once both its full model and its LOD have loaded, holds a `THREE.LOD` in `s.inner` with those three levels. The `'none'` level is an empty `Object3D`. Until the LOD loads, the slot is as it is now.
  - All LOD meshes share one `MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 })`.
- The script, `node scripts/galaxy-lod.mjs [kind …]`, for each kind:
  - reads the GLB (meshopt decoder);
  - applies node transforms;
  - for each primitive, bakes COLOR_0 = baseColorFactor × the base-colour texture sampled at the vertex UV (decoded with `sharp(...).raw()`), plus the emissive factor × the emissive texture, clamped to 1;
  - merges all primitives into one (gltf-transform `join` after unifying the material);
  - welds, and simplifies with `meshoptimizer`'s `MeshoptSimplifier`. Targets: fighters (`xwing`, `interceptor`, `awing`, `ywing`, `bwing`, `uwing`, `vulture`, `trifighter`, `delta7`, `arc170`, `n1`, `slave1`) 1,500 triangles; everything else 4,000;
  - drops UVs, normals and textures, then recomputes normals in the browser (`computeVertexNormals` after load);
  - quantizes, compresses with meshopt, and writes `public/models/galaxy/lod/<kind>.glb`.

- [ ] **Step 1: Write the failing tests.**

```js
it('has a small one-piece LOD for every model but the Death Star', () => {
  for (const kind of Object.keys(MODELS)) {
    if (kind === 'deathstar') { expect(lodUrl(kind)).toBe(null); continue; }
    const file = `public${lodUrl(kind)}`;
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(120 * 1024);
    expect(primitiveCount(file)).toBe(1); // read the GLB's JSON chunk: meshes[].primitives
  }
});
it('steps down at 45 and 900 times its size', () => { expect(lodLevels(0.3).map(([d]) => d)).toEqual([0, 13.5, 270]); });
it('never gives a tinted slot an LOD', () => { const m = createModels(); const s = m.slot('xwing', 0.3, { tint: '#888888' }); expect(s.inner.children.some((c) => c.isLOD)).toBe(false); });
```

- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Write and run the script** (`node scripts/galaxy-lod.mjs`). Check its log: one line per kind with the triangle count and bytes.
- [ ] **Step 4: Implement** the LOD slot in `models.js`.
- [ ] **Step 5: Run the tests and see them pass.** `npx vitest run src/components/galaxy`
- [ ] **Step 6: Check it in the browser.** `space endor,coruscant,hoth,naboo`. Endor ≤ 55 calls and ≤ 170k triangles (deterministic baseline 62 / 235,518). In the screenshots, no fighter is visibly blockier at its usual range.
- [ ] **Step 7: Commit** the script, the LOD GLBs and the code: "Galaxy: LOD models for every ship, made offline from the models already here".

### Task 10: Surface render settings — no double MSAA, a real fallback, lamps indoors, steady shadows

**Files:**
- Create: `src/components/galaxy/surface/shadow.js`, `src/components/galaxy/surface/shadow.test.js`
- Modify: `src/components/galaxy/surface/scene.js` (`createRenderer` at about 95; sun shadow at about 97–120 and 1333; lamps at about 193–197; `lighting()` at about 766; the HD ship load at about 332; `warm`; and a new `lowerQuality()` on the returned object).

**Interfaces:**
- Consumes: `dropTransmission` and `post.lite()` (Task 1).
- Produces:
  - `snapToTexel(x, z, extent, mapSize) → [x, z]`: rounds x and z to multiples of `(2 * extent) / mapSize`.
  - `lowerQuality()`: sets `sun.castShadow = false` and calls `post.lite()`.
  - The lamps are `visible = false` outdoors and `true` inside a zone, with `castShadow = false` on the sun while inside.
  - Warm-up compiles with the lamps visible, then again with them hidden.

- [ ] **Step 1: Write the failing test.**

```js
it('snaps the shadow to whole texels', () => {
  const [x, z] = snapToTexel(10.37, -3.21, 42, 2048); const t = 84 / 2048;
  expect(x / t).toBeCloseTo(Math.round(x / t), 6); expect(z / t).toBeCloseTo(Math.round(z / t), 6);
  expect(Math.abs(x - 10.37)).toBeLessThanOrEqual(t / 2);
});
```

- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it and see it pass.**
- [ ] **Step 5: Check it in the browser.** `surface tatooine,hoth`, then walk into the cantina with `__surfaceDo('teleport', …)`. Its lamps light the room, and there are no errors.
- [ ] **Step 6: Commit.** "Galaxy worlds: one multisample, a lighter fallback that works, lamps only indoors, shadows that don't shimmer".

### Task 11: Surface shadows from near scatter only, and zones hide the outdoors

**Files:**
- Modify: `src/components/galaxy/surface/placer.js` (the scatter at about 164–207); `src/components/galaxy/surface/scene.js` (`enterZone` and `leaveZone` at about 797–828, `putAt`, `tick`).
- Create: `src/components/galaxy/surface/near.js`, `src/components/galaxy/surface/near.test.js`

**Interfaces:**
- Produces:
  - `nearInstances(xs: Float32Array, zs: Float32Array, x, z, r) → Int32Array`: the indices within r.
  - `zoneVisibility(inZone: boolean) → { outdoors: boolean, zones: boolean }`: `{ outdoors: !inZone, zones: inZone }`.
  - In `placer`:
    - Each scatter part's main `InstancedMesh` has `castShadow = false`.
    - A sibling caster `InstancedMesh` per part, using the same geometry with `new MeshBasicMaterial({ colorWrite: false, depthWrite: false })` and `castShadow = true`, holds at most 512 instances: those within 48 m.
    - `placer.update(player)` refreshes the casters when the player has moved more than 8 m since the last refresh.
  - Placer groups and actors are tagged `outdoor` or `zone`.
  - `scene.setZone(inZone)` applies `zoneVisibility` to: ground, water, the scatter group, outdoor things, outdoor actors, zone groups and zone actors.

- [ ] **Step 1: Write the failing tests.**

```js
it('finds the scatter near you', () => {
  const xs = Float32Array.from([0, 10, 100, -47]); const zs = Float32Array.from([0, 0, 0, 0]);
  expect([...nearInstances(xs, zs, 0, 0, 48)]).toEqual([0, 1, 3]);
});
it('shows the outdoors or the zones, never both', () => {
  expect(zoneVisibility(true)).toEqual({ outdoors: false, zones: true });
  expect(zoneVisibility(false)).toEqual({ outdoors: true, zones: false });
});
```

- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.** Call `setZone` from `enterZone`, `leaveZone`, and every `putAt` that changes the zone.
- [ ] **Step 4: Run the tests.** `npx vitest run src/components/galaxy/surface`
- [ ] **Step 5: Check it in the browser.** `surface tatooine,endor,naboo`. Endor ≤ 1.0M triangles. Tree shadows still show near the player. Inside the cantina, the counts drop to the room.
- [ ] **Step 6: Commit.** "Galaxy worlds: only the trees near you cast shadows, and indoors and out aren't drawn at once".

### Task 12: Surface sharing — props, figures, crew models, flyovers

**Files:**
- Modify: `src/components/galaxy/surface/placer.js` (built path at about 99: cache by `kind + JSON.stringify(opts)`, clone with shared geometry and materials; skip the cache for props with an `update`); `src/components/galaxy/surface/figures.js` (`kitOf` materials from one module-level cache); `src/components/galaxy/surface/actors.js` (fog cull and mixer rate); `src/components/universe/footScene.js` (`loadModel`'s URL path: parse once per URL, `SkeletonUtils.clone` per figure, smooth normals and material tune done once, `dispose()` leaves shared resources); `src/components/galaxy/surface/scene.js` (flyover kinds built hidden during warm).
- Test: `src/components/galaxy/surface/figures.test.js` (new), `actors` helper test (new)

**Interfaces:**
- Produces:
  - `fogCutoff(density) → metres`: the distance where `1 − exp(−(density·d)²) = 0.97`, which is `sqrt(−ln 0.03) / density`. Exported from `actors.js`.
  - Actors farther than that are hidden and skip their mixer.
  - Actors past 60 m update their mixer every 4th frame, with `dt × 4`.

- [ ] **Step 1: Write the failing tests.**

```js
it('dresses two of the same people in the same materials', () => {
  const a = buildFigure('stormtrooper'), b = buildFigure('stormtrooper');
  const mats = (f) => { const s = new Set(); f.model.traverse((o) => o.isMesh && s.add(o.material)); return s; };
  expect([...mats(a)].every((m) => mats(b).has(m))).toBe(true);
});
it('knows where the fog swallows people', () => { expect(fogCutoff(0.01)).toBeCloseTo(Math.sqrt(-Math.log(0.03)) / 0.01, 3); });
```

- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.** Figure `dispose()` must no longer dispose shared materials.
- [ ] **Step 4: Run the tests.** `npx vitest run src/components/galaxy/surface src/components/universe`
- [ ] **Step 5: Check it in the browser.** `surface tatooine,naboo,kamino,bespin`. Tatooine ≤ 250 calls and ≤ 650k triangles; Naboo ≤ 220 calls. In the screenshots, the people and props are still there.
- [ ] **Step 6: Commit.** "Galaxy worlds: props, people and crew models made once and shared, people in the fog not drawn".

### Task 13: Surface CPU — the ground, the walker, quests, the compass, footprints, leaks

**Files:**
- Modify: `src/components/galaxy/surface/terrain.js` (`heightAt` outside the square: the clamped edge); `walker.js` (one Set reused in `solids.near`); `quests.js` (`feed` returns the same object when unchanged); `actors.js` (hoist the avoider); `scene.js` (`compass()` writes styles only when changed; footprints throttle the `marks` upload to at most 4 per second); `activity.js` (`clearStep` disposes the geometry and materials it made).
- Test: `terrain.test.js` (new), `walker.test.js`, `quests.test.js`

**Interfaces:**
- Produces:
  - `heightAt(x, z)` for |x| or |z| beyond the grid's half-size returns `heightAt(clamp(x), clamp(z))`.
  - `feed(progress, quest, ev)` returns the `progress` argument itself (`===`) when the event changes nothing.

- [ ] **Step 1: Write the failing tests.**

```js
it('holds the edge height outside the land', () => { const g = makeGrid(/* a site */); expect(g.heightAt(5000, -4200)).toBe(g.heightAt(g.half, -g.half)); });
it('leaves progress alone when nothing happened', () => { const p = start(quest); expect(feed(p, quest, { type: 'reach', at: [9999, 9999] })).toBe(p); });
```

Use the existing exports' real names, as `walker.test.js` and `quests.test.js` already use them.

- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests.** `npx vitest run src/components/galaxy/surface`
- [ ] **Step 5: Commit.** "Galaxy worlds: cheap ground under the zones, no garbage in walking and quests, the compass and footprints lighter, quest steps clean up".

### Task 14: Surface bugs

**Files:**
- Modify:
  - `src/components/galaxy/surface/scene.js`: Bespin's ground at `fall − 1`; `putAt` respects `level`; the flyover interval per flyover; the hum only on speeder rides.
  - `actors.js`: `quest` may be a list; hovering actors keep their height.
  - `blaster.js`: a swept hit.
  - `placer.js`: `opts.s` scales GLB things; a `style` falls back to built.
  - `sites/quests.js` and `sites/outer.js`: givers for Dagobah's cave, Geonosis's foundry and Mandalore's reclaim.
  - `sites/core.js`: Coruscant training spots onto floors.
- Test: `blaster.test.js` (new), `sites/sites.test.js`

**Interfaces:**
- Produces:
  - `sweptHit(a: [x,y,z], b: [x,y,z], c: [x,y,z], r) → boolean`: whether the segment a→b passes within r of c.
  - An actor spec's `quest` is `string | string[]`. Talking starts the first id in the list that isn't done, or names the done ones.

- [ ] **Step 1: Write the failing tests.**

```js
it('hits what a fast bolt passed through', () => { expect(sweptHit([0, 1, -2], [0, 1, 2], [0, 1, 0], 0.55)).toBe(true); expect(sweptHit([0, 1, -2], [0, 1, 2], [2, 1, 0], 0.55)).toBe(false); });
it('can start every quest', () => { /* for each site: every quest has no giver and no place, or a place, or an actor whose quest (string or list) includes its id */ });
it('stands every spot on a fall world over something', () => { /* for sites with `fall`: landing, places, actors' at, quest steps' spots and spawns each have a floor under them (site.floors contains the point, or a solid with a top) */ });
```

- [ ] **Step 2: Run them and see them fail** (the quest and floor tests fail on the current data).
- [ ] **Step 3: Implement.** Fix the data until the two site tests pass.
- [ ] **Step 4: Run the tests.** `npx vitest run src/components/galaxy/surface`
- [ ] **Step 5: Check it in the browser.** `surface bespin,coruscant,dagobah`, with no errors. On Bespin, `__surfaceDo('teleport', …)` off a walkway respawns you at the landing.
- [ ] **Step 6: Commit.** "Galaxy worlds: Bespin's falls, the quests no one could start, Coruscant's training on solid ground, bolts that can't pass through you, and smaller fixes".

### Task 15: Phase 1 evidence

**Files:**
- Create: `docs/superpowers/evidence/2026-10-05-galaxy-upgrade.md`

- [ ] **Step 1: Run** `npx eslint .`, `npx vitest run` and `npx vite build`. Expected: no lint errors, all tests pass (re-run any timed-out heavy autopilot file alone), and the build succeeds.
- [ ] **Step 2: Measure.** `JSON=1 node scripts/galaxy-check.mjs space tatooine,hoth,endor,coruscant,geonosis,scarif` and `… surface tatooine,hoth,endor,naboo,kamino,bespin,lothal`.
- [ ] **Step 3: Write up** the before and after tables against the spec's targets, a line per target met or missed with its reason, and the screenshots' paths. The screenshots stay in the scratchpad, not the repo.
- [ ] **Step 4: Commit and push** to `claude/sharp-carson-h9c6mp`.
