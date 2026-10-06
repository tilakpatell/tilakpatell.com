# Galaxy upgrade, Phase 2: space spectacle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the galaxy's space read as Star Wars in active play: every ship's engines glow (a glint even far off), ships blow up into fire and debris, suns flare, Geonosis's ring has dust, and each system has traffic and ships jumping in and out.

**Architecture:** Each effect is a new focused module in `src/components/galaxy/`, pooled and drawn in one or a few instanced draws: `engines.js` (data), `glows.js`, `explosions.js`, `flare.js`, `dust.js`, `lanes.js` (pure) and the traffic piece. `world.js` registers ships through its one `place()` funnel, and `scene.js` owns and updates the pools. Pure logic (anchors, lanes, occlusion, curves) is tested in Node; the drawing is checked with `scripts/galaxy-check.mjs`.

**Tech Stack:** three.js r186 (ShaderMaterial, InstancedMesh, InstancedBufferAttribute), Vitest, playwright-core.

**Spec:** `docs/superpowers/specs/2026-10-05-galaxy-upgrade-design.md` (Phase 2). Integration research: `.superpowers/sdd/phase2-research.md`. It is git-ignored scratch, so its tables are copied here where a task needs them.

## Global Constraints

- All of Phase 1's Global Constraints (the forbidden files, no sequels, code style, tests beside pure modules, DEV hooks, the commit trailer, no secrets).
- **Budgets** (high tier, measured with `scripts/galaxy-check.mjs`, deterministic): the effects together add at most 8 draw calls and 20k triangles to any system's frame. Glows use one draw, explosions at most 4, the flare one, ring dust one, and traffic ships go through `models.slot` like every other ship.
- **Bloom reads linear HDR luminance above 1.7** (`universe/post.js` BLOOM). An effect that should glow must exceed it. Every effect must still read with bloom off (`post.lite()`): a white-hot core plus a wide soft halo.
- `small` (tier ≠ high, or a window under 600 px) halves pool sizes and counts. Under `reduced` motion: no flicker, no screen shake, explosions without debris spin.
- Ship model frame ("normalised"): centred on its box, biggest side 1, nose +z, +y up. A slot's anchor `a` is in world space at `holder.position + holder.quaternion · (holder.scale ∘ (a · size))`.
- Everything the set pieces show moves by the wall clock `t` (seconds), so every pilot sees the same thing. New pieces must be functions of `t` and a seed, not of frame history.

## Review Focus

- **A ship that hides or stretches** (`holder.visible = false`; jump stretch through `holder.scale`; Yavin's stream scaling to 0). Its glows must hide, stretch and shrink with it. Task 2 tests a hidden slot contributing no glow instance.
- **A slot whose model swaps from the built stand-in to the GLB** (`slot.real` flips). The anchors switch tables. Task 1's `enginesOf(kind, real)` is tested for both.
- **A pool running out mid-battle.** The oldest effect is recycled, nothing throws, and there's no unbounded growth. Task 3 tests 100 blasts into a 24-blast pool.
- **A sun behind the planet while you fly in its shadow** (the eclipse). The flare goes to 0 with a soft edge, without popping. Task 4 tests occlusion at the limb.
- **The system switching under a live effect** (a jump). The world's ships untrack, and pools clear on `enter()`. Task 2 and Task 3 test `clear()`.

---

### Task 1: Engine anchors per kind (`engines.js`)

**Files:**
- Create: `src/components/galaxy/engines.js`, `src/components/galaxy/engines.test.js`

**Interfaces:**
- Produces:
  - `ENGINES: { [kind]: { color: [r,g,b], built?: number[][], glb?: number[][] } }`. Each anchor is `[x, y, z, r]` in the normalised frame. The `built` anchors are for the code-built model; the `glb` anchors are for the loaded model where it differs.
  - `enginesOf(kind: string, real: boolean) → { color, anchors: number[][] }`. It uses `glb` when `real` is true and `glb` exists, and `built` otherwise. With no entry, it returns `guessEngines()`.
  - `guessEngines() → { color: [1.6,2.4,4.8], anchors: [[0,0,-0.49,0.03]] }`: one disc at the stern.
  - `NO_ENGINES = ['deathstar','deathstar2','cloudcity','gate']`. `enginesOf` returns `anchors: []` for these.
- The data, as `[x,y,z,r]` in normalised space, with ± meaning mirrored in x. Expand mirrored entries in the data with a local `pair([x,y,z,r])` helper.
  - **Built:**
    - acclamator `[1.5,2.4,5]` ±[.165,-.116,-.497,.02] ±[.073,-.116,-.496,.026]
    - arc170 `[1.6,2.4,4.8]` ±[.103,-.004,-.491,.026]
    - awing `[1.7,2.5,4.6]` ±[.26,-.005,-.495,.037]
    - bwing `[1.7,2.5,4.6]` ±[.024,.336,-.178,.016] ±[.024,.285,-.178,.016]
    - cloudcar `[3,1.4,.5]` ±[.259,-.043,-.5,.054] [0,-.032,-.452,.065]
    - corvette `[2.2,3.4,6.6]` [0,-.04,-.495,.016] ±[.022,.043,-.495,.016] ±[.044,-.04,-.495,.016] ±[.066,.043,-.495,.016] ±[.089,-.04,-.495,.016] ±[.111,.043,-.495,.016]
    - delta7 `[1.6,2.5,4.8]` ±[.03,-.026,-.499,.007] ±[.054,-.02,-.498,.013]
    - destroyer `[1,2.5,6.6]` [0,-.103,-.492,.027] ±[.077,-.109,-.492,.023] ±[.141,-.113,-.492,.013] ±[.04,-.021,-.492,.011]
    - executor `[1.7,2.6,4.6]` y −.028: x 0, ±.02, ±.04, ±.06; y −.012: x ±.01, ±.03, ±.05; all z −.498, r .006
    - freighter `[1.9,2.9,5.6]` seven points on the stern half-ring: x ∈ {−.45,−.3,−.15,0,.15,.3,.45}, y −.03, z −.399, r .02
    - gauntlet `[1.8,2.6,4.6]` ±[.034,.065,-.498,.018] [0,.115,-.497,.028]
    - hammerhead `[1.7,2.5,4.4]` [0,-.013,-.496,.032] ±[.042,-.048,-.491,.021]
    - interceptor `[1.6,.4,.2]` ±[.029,-.017,-.216,.016]
    - lucrehulk `[1.8,2.5,4]` x ∈ {0, ±.029, ±.058, ±.087, ±.116, ±.145, ±.174}, y −.015, z −.46, r .011
    - moncal `[1.5,2.3,4]` [-.007,-.022,-.493,.025] [-.062,0,-.481,.016] [-.062,-.044,-.481,.016] [.048,0,-.481,.016] [.048,-.044,-.481,.016] [-.007,.023,-.478,.016] [-.007,-.066,-.478,.016] [-.102,-.018,-.443,.012] [.087,-.018,-.443,.012]
    - munificent `[1.6,2.4,5]` [0,0,-.497,.022] ±[.023,.047,-.498,.015] ±[.023,-.047,-.498,.015]
    - n1 `[1.8,2.6,4.8]` ±[.245,-.019,-.171,.016]
    - nebulon `[1.7,2.4,4.2]` [0,.058,-.497,.016] ±[.026,.026,-.497,.013] ±[.02,-.006,-.497,.012]
    - nubian `[1.6,2.4,4.6]` ±[.17,0,-.331,.034]
    - razorcrest `[2.2,2.8,4.4]` ±[.205,-.031,-.494,.048]
    - shuttle `[1.5,2.2,3.6]` ±[.047,-.204,-.5,.027]
    - tie `[1.6,.4,.2]` ±[.033,-.02,-.169,.018]
    - tieadvanced `[5.8,1.5,.3]` ±[.039,-.006,-.487,.025]
    - transport `[.7,2.2,6.2]` [0,-.027,-.495,.015] ±[.038,-.027,-.495,.013] ±[.075,-.027,-.495,.013]
    - trifighter `[3.6,1,.4]` [0,-.136,-.309,.029]
    - uwing `[1.7,2.5,4.6]` ±[.104,.033,-.494,.036]
    - vulture `[3.4,1.7,.7]` [0,0,-.251,.013]
    - xwing `[5.2,1.5,.6]` ±[.077,.059,-.486,.019] ±[.077,-.059,-.486,.019]
    - ywing `[1.8,2.6,4.6]` ±[.132,-.002,-.492,.021]
  - **GLB** (where the loaded model differs):
    - xwing ±[.095,.076,-.497,.018] ±[.095,-.076,-.497,.018]
    - interceptor ±[.108,0,-.334,.008]
    - destroyer [0,-.07,-.492,.028] ±[.132,-.07,-.492,.028] ±[.074,-.07,-.462,.017]
    - corvette [0,-.01,-.484,.03] ±[.085,-.01,-.484,.03]
    - venator [0,-.099,-.494,.02] [0,-.054,-.494,.02] [0,-.009,-.494,.02]
    - moncal [-.039,-.037,-.466,.008] [.048,-.037,-.466,.008] [-.039,-.001,-.443,.009] [.048,0,-.443,.009] [.004,-.065,-.438,.014] [-.074,-.027,-.386,.012] [.083,-.027,-.386,.012]
    - nebulon ±[.049,-.016,-.496,.015] [0,-.051,-.496,.015] ±[.052,.054,-.496,.02]
    - awing ±[.025,.012,-.336,.015] ±[.025,-.041,-.336,.015]
    - ywing ±[.2,-.025,-.268,.012]
    - bwing ±[.031,.238,-.172,.012] ±[.031,.177,-.172,.012]
    - uwing ±[.128,.038,-.495,.019] ±[.128,-.038,-.495,.019]
    - lucrehulk [0,-.013,-.497,.026] ±[.098,-.013,-.497,.026] ±[.048,.003,-.449,.015] ±[.146,-.013,-.449,.015]
    - acclamator ±[.047,-.06,-.375,.018] ±[.078,-.066,-.343,.01]
    - executor [0,-.01,-.5,.03] ±[.04,-.01,-.5,.03]
    - vulture [0,0,-.5,.03]
    - trifighter [0,.023,-.49,.04] ±[.089,-.131,-.49,.04]
    - delta7 ±[.025,.012,-.5,.012]
    - arc170 ±[.2,-.08,-.3,.03] ±[.35,-.08,-.3,.03]
    - n1 ±[.245,-.019,-.171,.016] (until checked visually: the research suspects the file faces −z)
    - slave1 ±[.12,-.3,-.25,.05]
    - coreship [0,0,-.45,.12]
- Colours as given in the built list. Every GLB entry reuses its kind's colour.

- [ ] **Step 1: Write the failing tests.**

```js
it('has engines for every kind the systems fly, or none for the stations', () => {
  const kinds = new Set(SYSTEMS.flatMap((s) => [...kindsIn(s), ...(s.traffic ?? [])]));
  for (const k of kinds) { const e = enginesOf(k, false); NO_ENGINES.includes(k) ? expect(e.anchors).toEqual([]) : expect(e.anchors.length).toBeGreaterThan(0); }
});
it('keeps every anchor inside its model', () => { for (const [k, e] of Object.entries(ENGINES)) for (const a of [...(e.built ?? []), ...(e.glb ?? [])]) { expect(Math.abs(a[0])).toBeLessThanOrEqual(0.55); expect(Math.abs(a[1])).toBeLessThanOrEqual(0.55); expect(a[2]).toBeGreaterThanOrEqual(-0.55); expect(a[3]).toBeGreaterThan(0); } });
it('switches to the loaded model's engines once it is here', () => { expect(enginesOf('xwing', true).anchors).not.toEqual(enginesOf('xwing', false).anchors); expect(enginesOf('tie', true).anchors).toEqual(enginesOf('tie', false).anchors); });
it('glows hot enough to bloom', () => { for (const e of Object.values(ENGINES)) { const [r, g, b] = e.color; expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeGreaterThan(0.5); } });
```

`kindsIn` comes from Phase 1's Task 6 (`systems.js`).

- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/components/galaxy/engines.test.js`
- [ ] **Step 3: Implement** the data and the functions.
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit.** "Galaxy: where every ship's engines are"

### Task 2: Engine glows, one draw for the whole system (`glows.js`)

**Files:**
- Create: `src/components/galaxy/glows.js`, `src/components/galaxy/glows.test.js`
- Modify: `src/components/galaxy/world.js` (`buildSystem(sys, { …, glows = null })`; `place()` calls `glows?.track(slot)`; the world's dispose untracks); `src/components/galaxy/scene.js` (create, update and dispose; track the hunters' ships); `src/components/universe/hunters.js` (expose `each(fn(group, kind, size))` over the live hunters).

**Interfaces:**
- Consumes: `enginesOf` (Task 1).
- Produces:
  - `createGlows({ max = 640, small = false, reduced = false }) → { mesh, track(slot), trackObject(obj, kind, size), untrack(slotOrObj), clear(), update(camera, t, dt, viewport: { h, fov }), count, dispose() }`.
  - `mesh` is one `InstancedMesh(PlaneGeometry(1,1), ShaderMaterial)`: additive, `depthWrite: false`, `depthTest: true`, `frustumCulled: false`. It carries an attribute `aGlow` (vec4: size, intensity, seed, unused) and `aTint` (vec3 HDR colour).
  - The vertex shader billboards in view space at least `uMinPx = 2.5` pixels across. The fragment shader draws a hot core `exp(-14 r²)` plus a halo `exp(-3 r²) × 0.35`, flickering by `1 + 0.08 sin(uTime·37 + seed·17)` (no flicker when `reduced`).
  - The glow quad sits `r × size × 0.6` astern of each anchor.
  - Per instance: `size = r × size_of_slot × 3.2`. `intensity` is 1, plus 0.6 × the slot's speed in units/s divided by (40 × slot size), clamped to 1.6.
  - A tracked slot contributes nothing while `!slot.ready`, `!slot.holder.visible`, or the largest axis of its holder's scale is below 0.01.
  - A non-uniform holder scale (the jump stretch) scales the anchors' positions, so the glows stretch with the ship.
- Fighter trails: kinds whose slot size is ≤ 1 and that are within 40 units of the camera get a `createTrail` (from `universe/trail.js`) from a pool of 12 (6 when `small`), assigned to the nearest each frame. Trail width is `0.05 × size` and life 0.35. This lives in `glows.js` as `trails: true`.

- [ ] **Step 1: Write the failing tests.**

```js
const slot = (kind, size, { visible = true, real = false } = {}) => { const holder = new THREE.Group(); holder.visible = visible; return { kind, size, holder, inner: new THREE.Group(), ready: true, real }; };
it('draws one glow per engine of each shown ship', () => {
  const g = createGlows({ max: 64 }); g.track(slot('xwing', 0.3)); g.track(slot('tie', 0.3, { visible: false }));
  g.update(camera, 0, 0.016, { h: 720, fov: 34 }); expect(g.count).toBe(4);
});
it('moves the glows with the ship's stretch', () => { /* holder.scale.set(1,1,10): an anchor at z -0.486·0.3 sits at -0.486·0.3·10 in world z (±1e-6) */ });
it('recycles nothing past its max and throws nothing', () => { const g = createGlows({ max: 8 }); for (let i = 0; i < 20; i++) g.track(slot('corvette', 3)); g.update(camera, 0, 0.016, { h: 720, fov: 34 }); expect(g.count).toBe(8); });
it('forgets the system on clear()', () => { const g = createGlows(); g.track(slot('xwing', 0.3)); g.clear(); g.update(camera, 0, 0.016, { h: 720, fov: 34 }); expect(g.count).toBe(0); });
```

- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/components/galaxy/glows.test.js`
- [ ] **Step 3: Implement**, wire it into `world.js` and `scene.js`, and track the hunters through `hunters.each`.
- [ ] **Step 4: Run the tests.** `npx vitest run src/components/galaxy src/components/universe`
- [ ] **Step 5: Check it in the browser.** `space endor,coruscant,hoth,nevarro`. Engines visibly glow on the capital ships and the fighters, and the far fighters show as glints. At most +1 draw call (+ trails ≤ 12) over Phase 1's end counts.
- [ ] **Step 6: Commit.** "Galaxy: every ship's engines glow, and the fighters near you trail"

### Task 3: Explosions — fire, debris, sparks, shockwaves (`explosions.js`)

**Files:**
- Create: `src/components/galaxy/explosions.js`, `src/components/galaxy/explosions.test.js`
- Modify:
  - `src/components/galaxy/world.js`: `buildSystem(…, { explosions = null })`. A battle fighter's `onHit` explodes at `target.slot.holder.position` (`size: 0.3`), then hides as now. Capital turbolaser hits: 1 in 12 starts a `fire` on the target.
  - `src/components/galaxy/scene.js`: a hunter kill (and `downed`) calls `explosions.at` instead of `pops.hit`; pops stays for the player's crash. Create, update, clear on `enter`, and dispose.
  - `src/components/universe/sounds.js`: `explosionSound(distance, big)`.

**Interfaces:**
- Produces:
  - `createExplosions({ small = false, reduced = false }) → { group, at(point: Vector3, { size = 1, tint = [1,0.55,0.2], debris = true, ring = false, follow = null }), fire(holder: Object3D, local: Vector3, { size, life = 6 }), update(dt, camera), clear(), active, dispose() }`.
  - `fireball(age01) → { scale, color: [r,g,b], alpha }`: pure and exported. Scale grows 0.2 → 1.0 by 0.25 and on to 1.25 at 1. Colour goes white-hot `[6,5,4]` → orange `[3,1.2,0.3]` → smoke `[0.25,0.22,0.2]` (luminance falling monotonically), and alpha falls to 0 at 1.
- Pools (halved when `small`):
  - 24 blasts. Each blast holds 3 fireball billboards (staggered by 0, 0.08 and 0.16 s, offsets ±0.3 × size), 24 debris shards (an instanced `TetrahedronGeometry(1,0)` in `MeshStandardMaterial`, with an emissive edge glow fading over 1.5 s, flung out at 0.4–1.6 × size per second, spinning), 40 sparks (one shared `Points` pool), and, when `ring`, one thin additive ring (`RingGeometry(0.92,1,48)`) in a random plane growing to 6 × size over 0.9 s.
  - A full pool recycles the oldest blast.
- `fire()` keeps a small fireball re-emitting every 0.18 s at the holder's local point for `life` seconds. At most 8 fires live.
- `explosionSound(distance, big)`: gain `1/(1+d/40)²`, skipped below 0.02, at most one every 90 ms. It's built from `sounds.js`'s own `whoosh` and `tones`, a low sine thump (75 Hz, or 55 Hz when big) with a lowpass that closes with distance. It is not routed through `lib/sfx.js`'s reverb bus.

- [ ] **Step 1: Write the failing tests.**

```js
it('burns white, then orange, then to smoke, and gone', () => {
  const a = fireball(0), b = fireball(0.3), c = fireball(0.9), lum = ([r, g, bb]) => 0.2126 * r + 0.7152 * g + 0.0722 * bb;
  expect(lum(a.color)).toBeGreaterThan(lum(b.color)); expect(lum(b.color)).toBeGreaterThan(lum(c.color)); expect(fireball(1).alpha).toBe(0); expect(b.scale).toBeGreaterThan(a.scale);
});
it('never holds more blasts than its pool', () => { const e = createExplosions({}); for (let i = 0; i < 100; i++) e.at(new THREE.Vector3(i, 0, 0), {}); expect(e.active).toBe(24); });
it('lets a fire burn out', () => { const e = createExplosions({}); e.fire(new THREE.Group(), new THREE.Vector3(), { size: 1, life: 1 }); for (let i = 0; i < 80; i++) e.update(0.02, camera); expect(e.active).toBe(0); });
it('clears on a jump', () => { const e = createExplosions({}); e.at(new THREE.Vector3(), {}); e.clear(); expect(e.active).toBe(0); });
```

- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement and wire it in.**
- [ ] **Step 4: Run the tests.** `npx vitest run src/components/galaxy src/components/universe`
- [ ] **Step 5: Check it in the browser.** Endor with `LIVE=1` (the wall clock running) for 20 s. A screenshot catches at least one fighter explosion; it can be driven by `__galaxyDebug` if needed. The battle's counts stay at most +4 draw calls.
- [ ] **Step 6: Commit.** "Galaxy: ships blow up: fire, debris and sparks, and the big ones burn"

### Task 4: Sun flares (`flare.js`)

**Files:**
- Create: `src/components/galaxy/flare.js`, `src/components/galaxy/flare.test.js`
- Modify: `src/components/galaxy/scene.js` (a child of the camera, updated after the camera moves, before render; skipped on low tier).

**Interfaces:**
- Produces:
  - `sunOcclusion(camPos: [x,y,z], sunDir: [x,y,z], solids, sunRadius = 0.0083) → number` in 0…1, where 1 is fully hidden. Solids with `r ≤ 0.05`, `shield`, or `ring` are ignored. For each sphere in front, the angular separation between the sphere's centre direction and the sun direction is compared with `asin(r/d)`. The result is a smooth overlap: 1 when `sep < asin(r/d) − sunRadius`, 0 when `sep > asin(r/d) + sunRadius`, smoothstep between. The maximum over all solids is returned.
  - `flareElements(sunNdc: [x,y]) → Array<{ at: [x,y] (NDC), size: number (share of screen height), kind: 'halo'|'ghost'|'streak', alpha }>`. A halo at the sun (size 0.35), a horizontal streak at the sun (size 0.9, height 0.02), and five ghosts at `sun × k` for k ∈ {0.6, 0.25, −0.2, −0.45, −0.8}, sizes {0.05, 0.08, 0.04, 0.12, 0.07}.
  - `createFlare({ small }) → { group, update(camera, suns: [{dir: Vector3, color: Color}], solids, viewport: {w,h}), dispose() }`.
  - Textures are made once on a 128² canvas each: a halo (radial falloff), a ghost (a soft hexagon with a brighter rim) and a streak (a horizontal gaussian).
  - Overall alpha is `(1 − occlusion) × onScreen`, where `onScreen` fades over 0.15 NDC past the screen's edge.
  - The ghosts tint toward the sun's colour.
  - Everything is additive, `depthTest: false`, `renderOrder: 40`.
  - At most 2 suns, but only the brighter one gets ghosts.

- [ ] **Step 1: Write the failing tests.**

```js
it('hides the sun behind a planet and shows it beside', () => {
  const planet = [{ id: 'planet', at: [0, 0, -100], r: 20 }];
  expect(sunOcclusion([0, 0, 0], [0, 0, -1], planet)).toBe(1);
  expect(sunOcclusion([0, 0, 0], [0.5, 0, -0.866], planet)).toBe(0);
});
it('fades softly at the planet's edge', () => { const a = Math.asin(20 / 100); const d = [Math.sin(a), 0, -Math.cos(a)]; const o = sunOcclusion([0, 0, 0], d, [{ id: 'planet', at: [0, 0, -100], r: 20 }]); expect(o).toBeGreaterThan(0.2); expect(o).toBeLessThan(0.8); });
it('ignores the shields and the gate', () => { expect(sunOcclusion([0, 0, 0], [0, 0, -1], [{ id: 'ds2-shield', at: [0, 0, -100], r: 20, shield: true }])).toBe(0); });
it('puts the ghosts on the line through the middle', () => { for (const e of flareElements([0.5, 0.3]).filter((e) => e.kind === 'ghost')) expect(e.at[0] / 0.5).toBeCloseTo(e.at[1] / 0.3, 6); });
```

- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement and wire it in.**
- [ ] **Step 4: Run the tests.**
- [ ] **Step 5: Check it in the browser.** Tatooine facing its suns (use `__galaxyDebug` to turn the ship toward `sky.sunDirs[0]`), then behind the planet. The flare shows, then fades.
- [ ] **Step 6: Commit.** "Galaxy: the suns flare, and the planets hide them"

### Task 5: Geonosis's ring dust (`dust.js`)

**Files:**
- Create: `src/components/galaxy/dust.js`, `src/components/galaxy/dust.test.js`
- Modify: `src/components/galaxy/world.js` (the `rocks` piece of kind `ring` also adds the dust).

**Interfaces:**
- Produces:
  - `ringDustSpec({ inner, outer, thickness, tilt }) → { r0: inner − 4, r1: outer + 6, rotation: [tilt[0], 0, tilt[1]] }`. The rotation uses the same Euler order as `rocks.js` (`XYZ`).
  - `createRingDust({ inner, outer, thickness, tilt, seed, sunDir: Vector3, small }) → { group, update(t, camera), dispose() }`.
  - One `RingGeometry(r0, r1, 256, 1)`: additive, `depthWrite: false`, `side: DoubleSide`, `renderOrder: -1`.
  - The fragment shader draws radial bands (1D fbm over radius, seeded), thinning at both edges (smoothstep), and a slow angular noise.
  - Lighting: `0.25 + 1.6 × pow(max(0, dot(viewDir, sunDir)), 6)` for forward scattering, darkened inside the planet's shadow. The shadow is a cylinder test in the shader against the planet's radius along `−sunDir`.
  - Peak alpha is 0.35.

- [ ] **Step 1: Write the failing test.**

```js
it('lies under the rocks, a little wider, turned the same way', () => { const s = ringDustSpec({ inner: 54, outer: 88, thickness: 5, tilt: [0.22, 0.08] }); expect(s).toEqual({ r0: 50, r1: 94, rotation: [0.22, 0, 0.08] }); });
```

- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Implement and wire it in.**
- [ ] **Step 4: Run the tests.**
- [ ] **Step 5: Check it in the browser.** `space geonosis`: the dust band is visible under the rocks, brighter toward the sun, with the planet's shadow across it. +1 draw call.
- [ ] **Step 6: Commit.** "Galaxy: Geonosis's ring has its dust"

### Task 6: Traffic, and ships jumping in and out

**Files:**
- Create: `src/components/galaxy/lanes.js`, `src/components/galaxy/lanes.test.js`
- Modify: `src/components/galaxy/world.js` (a `traffic` builder run for every system with `sys.traffic`; a `reinforce` builder for systems with a `battle` piece; both use a shared `jumpScale(k)`).

**Interfaces:**
- Produces:
  - `TRAFFIC_SIZE = { freighter: 0.7, shuttle: 0.55, transport: 1.8, slave1: 0.55, xwing: 0.3, awing: 0.3, ywing: 0.3, uwing: 0.4, n1: 0.3, nubian: 1.4, arc170: 0.3, delta7: 0.3, acclamator: 16, venator: 24, corvette: 3.2, tie: 0.3, razorcrest: 0.7, gauntlet: 1.6 }`.
  - `trafficLanes(sys, { small }) → Array<{ kind, size, from: [x,y,z], to: [x,y,z], period: number, phase: number }>`:
    - It is seeded by `sys.id`.
    - The count is `min(8, 3 + traffic.length)`, halved (rounded up) when `small`.
    - Kinds go round-robin over `sys.traffic`.
    - `from` is on a sphere of radius 700 (the system's edge, inside `EDGE = 900`). `to` is a parking point at `r × 2.2 + 30` from the planet, on the near side to `from`.
    - The period is 70–140 s and the phase 0…1.
    - Every lane's segment stays at least `1.15 × r` from the planet's centre (resampled until it does) and clear of every `fleet` and `battle` capital's sphere.
  - `laneAt(lane, t) → { pos: [x,y,z], dir: [x,y,z], jump: number (−1…1), visible: boolean }`:
    - The cycle runs: arrive (jump in) → cruise in → hold 8 s → cruise out → jump out.
    - `jump` is 0 while cruising, rising to 1 in the 0.7 s before jumping out, and −1 → 0 in the 0.7 s after jumping in.
    - It's invisible between jumping out and the next jump in, for 10% of the period.
  - `jumpScale(k: number) → [sx, sy, sz]`: for |k| > 0, `sz = 1 + 14 k²` and `sx = sy = 1 − 0.6 |k|`.
  - World wiring:
    - A traffic ship's slot holder takes `pos`, faces `dir` with `pointAlong`, and scales by `jumpScale(jump)`.
    - At each jump in or out, a blue-white flash: `flashes.at(pos, { size: size × 6, color: [1.2,1.8,3.2], life: 0.6 })`, fired once per transition (tracked by cycle index).
    - Traffic ships aren't solids, since they never stop in your way.
  - Reinforcements, for each `battle` piece:
    - Every 75 s (wall clock), one capital of the battle's first side (`destroyer` for the Empire, `acclamator` for the Republic, `moncal` for the Rebellion, `lucrehulk` for the Separatists; otherwise none) jumps in 1.2 × the battle's radius from its centre, holds 30 s firing nothing, and jumps out.
    - It isn't a solid, and it's drawn through a `models.slot` of the size of the battle's largest capital × 0.7.

- [ ] **Step 1: Write the failing tests.**

```js
it('gives every system with traffic its lanes, the same for everyone', () => { for (const s of SYSTEMS.filter((s) => s.traffic?.length)) { const a = trafficLanes(s, {}), b = trafficLanes(s, {}); expect(a).toEqual(b); expect(a.length).toBe(Math.min(8, 3 + s.traffic.length)); } });
it('keeps the lanes off the planet', () => { for (const s of SYSTEMS) for (const l of trafficLanes(s, {})) expect(segmentDistance(l.from, l.to, [0, 0, 0])).toBeGreaterThanOrEqual(1.15 * (s.body?.r ?? 10)); });
it('jumps in, cruises, holds, cruises out and jumps out', () => { const l = trafficLanes(systemById('tatooine'), {})[0]; const seen = new Set(); for (let t = 0; t < l.period; t += 0.25) { const a = laneAt(l, t); seen.add(a.jump < 0 ? 'in' : a.jump > 0 ? 'out' : a.visible ? 'cruise' : 'gone'); } expect([...seen].sort()).toEqual(['cruise', 'gone', 'in', 'out']); });
it('stretches a jump along the nose', () => { expect(jumpScale(1)).toEqual([0.4, 0.4, 15]); expect(jumpScale(0)).toEqual([1, 1, 1]); });
```

`segmentDistance` is a local helper in the test file.

- [ ] **Step 2: Run them and see them fail.** `npx vitest run src/components/galaxy/lanes.test.js`
- [ ] **Step 3: Implement**, and wire it into `world.js`.
- [ ] **Step 4: Run the tests.** `npx vitest run src/components/galaxy` (including `world.test.js`'s 300 s run of every system).
- [ ] **Step 5: Check it in the browser.** `space tatooine,coruscant,lothal,sorgan` with `LIVE=1` for 30 s. Traffic is visible, and a jump flash is caught in at least one screenshot.
- [ ] **Step 6: Commit.** "Galaxy: traffic in every system, ships jumping in and out, and reinforcements for the battles"

### Task 7: Phase 2 evidence

- [ ] **Step 1: Run** `npx eslint .`, `npx vitest run` and `npx vite build`. All are clean.
- [ ] **Step 2: Measure.** `JSON=1 node scripts/galaxy-check.mjs space tatooine,hoth,endor,coruscant,geonosis,scarif,nevarro,lothal`. Every system is within the Phase 2 budget over its Phase 1 end count.
- [ ] **Step 3: Score** the space views on the 10-category visual scorecard (`threejs-aaa-graphics-builder/references/visual-scorecard.md`), before (Phase 1 end) and after, in `docs/superpowers/evidence/2026-10-05-galaxy-upgrade.md`.
- [ ] **Step 4: Commit and push.**
