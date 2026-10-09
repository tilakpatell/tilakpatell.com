# Flight Terrain Implementation Plan (lane A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new world, `/fly/:planet`, where a ship flies over an infinite, seeded, biome-blended planet whose ground streams in as quadtree leaves made in a worker with FastNoiseLite, with POI flats and instanced clutter, at 60 frames a second on mid.

**Architecture:** Pure land modules under `src/lib/land/flight/` (noise wrapper, biomes, field, quadtree, leaf mesh, streamer) run in a worker through `rt.workers`; the page side (`src/components/expanse/flight/`) wraps transferred buffers as geometry under a per-frame cap, pools clutter, and re-anchors on `rt.origin`. The POI flat moves down from the galaxy surface to `src/lib/land/flats.js` first, as a repair that changes no pixel.

**Tech Stack:** three 0.186, `fastnoise-lite@1.1.1` (new), Web Workers through `src/runtime/workers.js`, the world runtime (`fromScene` or a hand `create`), the HUD kit, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (Pillar 1, decisions 1 to 6)

## Global Constraints

- `src/lib/land/**` imports no three.js and no React; every module runs in Node and in a worker.
- A new dependency has its stack page before it is imported (`docs/stack/fastnoise-lite.md` from `_template.md`, a row in `scripts/stack-census.mjs`'s `PAGES`, `node scripts/stack-census.mjs --write`); `node scripts/health.mjs --check --skip build` stays green.
- Constants verbatim: `ROOT = 16384`, `MAX_DEPTH = 6`, `SPLIT = 1.6`, `N = 33` (`65` on high and ultra), `SKIRT = 12`, `IN_FLIGHT = 6`, `UPLOADS_PER_FRAME = { low: 1, mid: 2, high: 3, ultra: 3 }`, `CLUTTER_DEPTHS = [5, 6]`.
- The world is `painted` (`look.js`), its module `shading: 'glsl'`, its `mb` 1 and `WORLD_MB['/fly'] = 1`; it starts from `lib/device`'s tier, lowers itself under `lib/three/pace`, and is disposed on leave.
- British spelling, curly quotes, comments say why. No model names in code, docs or commits. Commits end with the harness's attribution lines.
- Before the PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /fly/hoth,/galaxy/hoth/surface`, `node scripts/perf-probe.mjs --routes /fly/hoth`.

## Review Focus

1. **The ship crosses a leaf boundary where the two sides differ by two depths**: no crack shows (the skirt covers 12 m; a test asserts the skirt's vertices sit `SKIRT` under their edge vertex). Task 5.
2. **A leaf answer arrives after the ship has flown on and the leaf was dropped**: it is discarded, its buffers never become geometry. Task 6's `done` refusal test and Task 8's page test.
3. **The camera sits exactly on a root tile corner** (`x = 16384`): the four root tiles round it split without a gap or a double. Task 4's test at `(ROOT, ROOT)`.
4. **A POI inside a biome boundary**: the flat holds `h` exactly inside `r`, whatever the weights. Task 3.
5. **Low tier**: one upload a frame, `N = 33`, clutter caps halved, no stutter over 33 ms. Task 8's cap test, the perf probe.

---

### Task 1: The flat moves down to `src/lib/land/flats.js`

**Files:**
- Create: `src/lib/land/flats.js`, `src/lib/land/flats.test.js`
- Modify: `src/components/galaxy/surface/terrain.js` (import `flatten` from the lib; `export const levelled = flatten`)

**Interfaces:**
- Produces: `flatten(raw: (x, z) => number, flats: { at: [x, z], r, edge?, h? }[] = []) → (x, z) => number`; a flat's default `edge` is `Math.max(8, r * 0.6)`, its default `h` is `raw(at)`.

- [ ] **Step 1:** Shoot the before: `node scripts/autopilot-check.mjs --skip lint,test --routes /galaxy/hoth/surface --shots flats --before`.
- [ ] **Step 2: Failing test** `flats.test.js`: `flatten(raw, [{ at: [0, 0], r: 10, edge: 5, h: 3 }])(0, 0) === 3`; `(9.9, 0) === 3`; `(15, 0) === raw(15, 0)`; `(12.5, 0)` strictly between; with no flats returns `raw` itself.
- [ ] **Step 3:** Run `npx vitest run src/lib/land/flats.test.js`. Expected: FAIL, module missing.
- [ ] **Step 4:** Move `levelled`'s body from `terrain.js` into `flats.js` as `flatten` (the `smoothstep` it uses comes from `../../components/galaxy/surface/noise.js`, as `layers.js` imports it). In `terrain.js`: `import { flatten } from '../../../lib/land/flats.js'; export const levelled = flatten;`.
- [ ] **Step 5:** Run `npx vitest run src/lib/land src/components/galaxy/surface/terrain.test.js`. Expected: PASS.
- [ ] **Step 6:** Shoot the after: `node scripts/autopilot-check.mjs --skip lint,test --routes /galaxy/hoth/surface --shots flats`; compare the two images (`Read` them): identical.
- [ ] **Step 7: Commit** `The POI flat moves down to lib/land/flats.js, so a world and the flight share it`.

### Task 2: FastNoiseLite behind one wrapper

**Files:**
- Create: `docs/stack/fastnoise-lite.md` (from `docs/stack/_template.md`), `src/lib/land/flight/fnl.js`, `src/lib/land/flight/fnl.test.js`
- Modify: `scripts/stack-census.mjs` (`...group('fastnoise-lite.md', ['fastnoise-lite'])`), `package.json` (`npm install fastnoise-lite@1.1.1 --save-exact`), `docs/stack/README.md` (by `node scripts/stack-census.mjs --write`)

**Interfaces:**
- Produces: `noiseFor(seed, { type, frequency, octaves, lacunarity, gain, fractal, warp }) → (x, z) => number` in `[−1, 1]`; `fold(seed: bigint | number) → int32`. The spec's code block is the body.

- [ ] **Step 1:** Write the stack page (what it is, where used: `src/lib/land/flight/fnl.js` only; rule: nothing else imports the class; upgrading: `npm install fastnoise-lite@<v>`, `npx vitest run src/lib/land/flight`). Add the census row. `npm install fastnoise-lite@1.1.1 --save-exact`. Run `node scripts/stack-census.mjs --write` and `node scripts/health.mjs --check --skip build`. Expected: green.
- [ ] **Step 2: Failing test** `fnl.test.js`: the same seed and point give the same value twice; two seeds differ at `(10, 10)`; `fold(2n ** 40n + 5n)` is an int32 and equals `fold` of itself; 1,000 samples of `noiseFor(1, { type: 'simplex' })` all lie in `[−1, 1]`; `warp: 200` changes the value at `(100, 100)` against `warp: 0`.
- [ ] **Step 3:** Run it. Expected: FAIL.
- [ ] **Step 4:** Write `fnl.js` from the spec.
- [ ] **Step 5:** Run it. Expected: PASS. `npm run lint`.
- [ ] **Step 6: Commit** `FastNoiseLite, behind one wrapper in lib/land/flight`.

### Task 3: Biomes and the planet field

**Files:**
- Create: `src/lib/land/flight/biomes.js`, `biomes.test.js`, `field.js`, `field.test.js`, `planetSpec.js`, `planetSpec.test.js`

**Interfaces:**
- Consumes: `noiseFor` (Task 2), `flatten` (Task 1), `fieldAt` and `LAYERS` from `src/lib/land/layers.js`.
- Produces: `biomeWeights(spec, x, z) → number[]` (summing to 1, one a biome); `planetField(spec) → { heightAt(x, z), biomeAt(x, z) → index of the heaviest }`; `planetSpecOf(planetId) → spec` as the spec's example (`id, seed, type, climate, biomes, pois, palette, clutter`); `PLANETS → { id, name, type, seed }[]` of exactly 50 rows in the roster's order (`docs/research/2026-10-09-planet-geographies.md`, “The roster”): the galaxy's 17, the sector's 10, the fandom 10, then 13 Expanse ids (`E:sx,sz:i:j`) chosen by `makeSector` from `UNIVERSE` for sectors `(1,0), (0,1), (−1,0), (0,−1), (1,1)` in order; each named world's spec (biomes, POIs, palette, clutter, and `step`, `blocks` or `soft` where the row says) from that note's row; `TYPE_BIOMES[type]` the stacks an Expanse planet gets (the note's last section). The tables go in `planetTables.js` beside `planetSpec.js` (they will pass 400 lines), split by group if a file nears 800.

- [ ] **Step 1: Failing tests.** `biomes.test.js`: weights sum to 1 within 1e-6 at 100 random points; a point far from every biome's `at` gives the first biome weight 1. `field.test.js`: `heightAt` is the same at a point twice; on the spec's `hoth` example `heightAt(1200, −800) === 12` and `heightAt(1200 + 219, −800) === 12`, and at `(1200 + 380, −800)` it is not 12 and is finite; `biomeAt` returns an index under `biomes.length`. `planetSpec.test.js`: `PLANETS.length === 50`, ids unique, each matches `/^[A-Za-z0-9:_,-]{1,64}$/` (the Expanse ids start `E:`); `planetSpecOf('hoth').type === 'ice'` with one POI named `Echo Base`; `planetSpecOf(PLANETS[9].id)` builds from `makeSector` and has at least one biome; an unknown id returns `null`.
- [ ] **Step 2:** Run `npx vitest run src/lib/land/flight`. Expected: FAIL.
- [ ] **Step 3:** Write the three modules. `biomeWeights`: two warped noises from `spec.climate` (`seed`, `seed + 1`), each mapped to `[0, 1]`, `w = 1 − smoothstep(reach × 0.6, reach, hypot(t − at[0], m − at[1]))`, normalised. `planetField`: `heightAt = flatten((x, z) => Σ wᵢ (baseᵢ + fieldAt({ seed: seed + i × 101, relief: reliefᵢ }, x, z)), spec.pois)`. `planetSpecOf`: the authored table, else `parseSector`-style parse of `E:sx,sz:i:j`, `makeSector(UNIVERSE, sx, sz).systems[i].planets[j]`, its `type` into `TYPE_BIOMES`, `seed` folded, no POIs; cartoon types (`forest`, `desert`) get `warp` 600 and a `pingpong` fractal in one biome, so they read stylised.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `A planet's field: biomes blended, POIs flat, fifty planets named`.

### Task 4: The quadtree

**Files:**
- Create: `src/lib/land/flight/quadtree.js`, `quadtree.test.js`

**Interfaces:**
- Produces: `ROOT, MAX_DEPTH, SPLIT, keyOf(d, ix, iz), sizeAt(d), leafOf(d, ix, iz) → { key, d, ix, iz, size, x0, z0 }, leavesFor(x, z, { split, maxDepth, view }) → Map<key, leaf>` (the spec's code).

- [ ] **Step 1: Failing test.** `leavesFor(0, 0)` holds a leaf of depth `MAX_DEPTH` whose square contains `(0, 0)`; every leaf's square is disjoint from every other's and their union covers the square `±ROOT` (sum of areas equals the covered area; a 200-point sample finds exactly one leaf containing each point); `leavesFor(ROOT, ROOT)` likewise (the corner case); the Map's first entries are depth 0; with `maxDepth: 0` every leaf is a root tile; the count at `(0, 0)` is under 400.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Write it from the spec. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `The flight's quadtree: leaves by distance`.

### Task 5: The leaf mesh, with normals and a skirt, and the clutter list

**Files:**
- Create: `src/lib/land/flight/leafMesh.js`, `leafMesh.test.js`, `sample.js`, `sample.test.js`

**Interfaces:**
- Consumes: `planetField` (Task 3), `leafOf` (Task 4), `seeded` from `src/lib/seeded.js`.
- Produces: `SKIRT = 12`, `CLUTTER_DEPTHS = [5, 6]`, `DENSITY = { low: 0.4, mid: 0.7, high: 1, ultra: 1 }`, `makeLeaf(spec, leaf, { n, field, tier }) → { key, n, step, positions: Float32Array, normals: Float32Array, indices: Uint32Array, heights: Float32Array(n²), clutter: Float32Array(rows × 6) }`; `heightOn(leaf, heights, n, x, z) → number` (bilinear within the drawn triangles, `NaN` outside the leaf).

- [ ] **Step 1: Failing tests.** `leafMesh.test.js`: on a flat field (`heightAt: () => 5`) every grid normal is `(0, 1, 0)` and every grid `y` is 5, the skirt vertices are at `5 − SKIRT`; on `heightAt: (x) => x` normals are `(−1, 1, 0) / √2` at interior vertices and at the edge vertices too (the padded grid); `positions.length === (n² + 4n) × 3`; `indices.length === (n − 1)² × 6 + (4n − 4) × 6` and every index is under the vertex count; `heights` round-trips `heightOn` at the grid points; a depth-6 leaf on `hoth` has clutter rows, a depth-4 leaf none, none of the rows lies inside Echo Base's `r + edge`, and each row's `y` is within 0.5 of `heightOn` at its `x, z`; the same leaf twice gives identical buffers. `sample.test.js`: `heightOn` of a plane field returns the plane at 50 random points within 1e-6; `NaN` at `x0 − 1`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Write both from the spec. **Step 4:** Run. Expected: PASS; each test under a second (lower `n` in tests to 9 where the field is cheap).
- [ ] **Step 5: Commit** `A leaf's mesh, normals and clutter, made as data`.

### Task 6: The leaf streamer

**Files:**
- Create: `src/lib/land/flight/stream.js`, `stream.test.js`

**Interfaces:**
- Produces: `createLeafStream({ inFlight = 6, keep = 2 }) → { update(leaves: Map) → { ask: key[], drop: key[], cancel: key[] }, began(key, gen), done(key, gen) → boolean, failed(key, gen), reset(), loaded: Set, flying: Map, gen }`.

- [ ] **Step 1: Failing tests**, after `src/runtime/chunkGrid.test.js`'s: asks in the Map's order up to `inFlight`; a second `update` with the same leaves asks nothing new while they fly; `done` of a flying key moves it to `loaded`; `done` with an older gen is refused (`false`) and loads nothing; a loaded key not wanted for `keep` updates is in `drop` on the `keep`th, not before; a flying key no longer wanted is in `cancel` and its later `done` is refused; `reset()` bumps `gen`, empties both sets.
- [ ] **Step 2:** Run. FAIL. **Step 3:** Write it. **Step 4:** Run. PASS.
- [ ] **Step 5: Commit** `The leaf streamer: in flight, kept, refused when late`.

### Task 7: The ship's rules and the world's shell

**Files:**
- Create: `src/components/expanse/flight/flightRules.js`, `flightRules.test.js`, `look.js`, `module.js`, `pack.js`, `scene.js` (the sky, a sun, the ship as a code-built wedge, the camera behind it; no ground yet), `FlightHud.jsx`, `src/pages/Fly.jsx`
- Modify: `src/App.jsx` (route `/fly/:planet`, lazy), `src/components/worlds/worlds.js` (`WORLD_MB['/fly'] = 1`; `WORLDS` gains the entry the registry pattern needs, read `worlds.test.js` first), `src/components/worlds/looks.js` (`{ folder: 'expanse/flight', routes: ['/fly'] }`)

**Interfaces:**
- Produces: `SHIP = { speedMin: 40, speedMax: 320, accel: 60, pitchRate: 1.2, yawRate: 0.9, rollRate: 2.4, clearance: 3 }`; `stepShip(ship, input, dt) → ship` (`ship: { x, y, z, pitch, yaw, roll, speed }`, `input: { pitch, yaw, roll, throttle }` each in `[−1, 1]`); `crashed(ship, groundY) → boolean`.

- [ ] **Step 1: Failing test** `flightRules.test.js`: throttle 1 for 1 s raises speed by `accel` to at most `speedMax`; pitch −1 (nose down) lowers `y` over a second; yaw turns the heading by `yawRate × dt`; `crashed({ y: 10 }, 8)` is false, `crashed({ y: 10 }, 7.5)` is true (`clearance`).
- [ ] **Step 2:** Run. FAIL. **Step 3:** Write `flightRules.js`. **Step 4:** Run. PASS.
- [ ] **Step 5:** The shell: `look.js` (`art: 'painted'`, a palette of eight from the ice world: `#e9f0f7 #ffffff #6b7a8c #9fb7d1 #2b3d55 #ffd37a #ff6b4a #1a1f2b`, `tone: 'house'`, `bloom: false`); `module.js` through `fromScene('flight', ..., { mb: 1 })`; `scene.js` on `lib/three/useScene`'s shape as `galaxy/surface/scene.js` is (read its `create` first), binding W/S pitch, A/D roll, Q/E yaw, Shift/Ctrl throttle through the runtime's input, the HUD from the kit (`Menu`, `Toast`, `Prompt`; `src/runtime/hud/index.js`); `Fly.jsx` as `pages/GalaxySurface.jsx` is, with `useWorld` and `WorldHost`, `planetSpecOf(params.planet)` and a `NotFound` for `null`. `pack.js`: `{ id: '/fly', pages: ['src/pages/Fly.jsx'], src: ['src/components/expanse/flight', 'src/pages/Fly.jsx'], urls: [], globs: [] }`.
- [ ] **Step 6:** `npm run lint && npm test && npm run build`; `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /fly/hoth`. Expected: a canvas, no console error, the ship over a flat blue-white plane (a placeholder `PlaneGeometry` at `y = 0`, removed in Task 8).
- [ ] **Step 7: Commit** `The flight world: a ship, its rules, a sky, the route`.

### Task 8: The ground on the page: worker, geometry under a cap, pools, origin

**Files:**
- Create: `src/components/expanse/flight/terrain.worker.js`, `ground.js`, `ground.test.js` (a fake `rt.workers` and a fake three-less geometry sink; the page module's pure parts in `groundRules.js` if the test needs them apart)
- Modify: `scene.js` (the ground in, the placeholder out; the crash)

**Interfaces:**
- Consumes: `leavesFor`, `createLeafStream`, `makeLeaf`, `heightOn`, `planetField`, `rt.workers`, `rt.origin`, `pool` from `src/lib/three/pool.js`, `GROUND_GLSL` from `src/lib/three/groundmap.js` as `galaxy/surface/ground.js` uses it.
- Produces: `createGround(scene, { rt, spec, tier }) → { update(ship, dt), heightUnder(x, z) → number | NaN, stats() → { leaves, flying, pending, clutter }, dispose() }`; the worker's protocol `{ key, priority, spec, leaf, n }` in, `{ key, n, step, positions, normals, indices, heights, clutter }` out with every buffer transferred, `{ type: 'cancel', key }` honoured for a queued key.

- [ ] **Step 1: Failing test** `ground.test.js` with a fake workers pool that answers synchronously or on command: after `update` at `(0, 0)` the pool was asked for the root tiles first and the finest leaf last; at most `UPLOADS_PER_FRAME[tier]` answers become meshes in one `update`; an answer for a key the ship has left (the stream refused it) makes no mesh; `heightUnder(0, 0)` reads the finest loaded leaf; on an `origin` event every leaf group moved by the shift; `dispose` frees every geometry and cancels every flight.
- [ ] **Step 2:** Run. FAIL. **Step 3:** Write the worker (`planetField` cached by `spec.id`; `onmessage` answers or drops a cancelled key) and `ground.js` per the spec's “page side”. **Step 4:** Run. PASS.
- [ ] **Step 5:** Wire into `scene.js`: `ground.update(ship, dt)` each frame, `crashed(ship, ground.heightUnder(ship.x, ship.z))` → a toast and a respawn 200 m up; `?debug` shows `stats()` through `tune()`.
- [ ] **Step 6:** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`; smoke on `/fly/hoth`; `node scripts/perf-probe.mjs --routes /fly/hoth` on mid: quote the worst frame in the PR (under 33 ms). Fly to Echo Base (`1200, −800`): flat, the land eased round it. Cross a biome boundary: no step.
- [ ] **Step 7: Commit** `The planet's ground streams in as leaves made in a worker, its clutter in pools`.

### Task 9: Docs and the PR

- [ ] One paragraph in `docs/architecture.md` under the Expanse's; `docs/superpowers/HANDOFF-planet-flight.md`'s lane A row updated (Done, Left, Checking it). Merge `origin/main` in, run the checks again, push, PR to `main` with the perf number and the screenshots, CI green, merge commit.
