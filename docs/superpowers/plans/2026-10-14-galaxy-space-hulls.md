# Hulls you can hit: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every ship in the galaxy’s space is hit, and is solid, on the game’s own shapes (or shapes made from its model where the game has none), and a hit does the game’s damage.

**Architecture:** a build script writes one hull file a kind (the shapes bin, version 2) in the frame `galaxy/models.js` draws the kind in; the page loads them with the models; a pure module (`src/lib/combat/hulls.js`) answers “where does this bolt meet this ship” and “is this ship inside that one”, a pure pose module (`src/lib/combat/pose.js`) makes the drawing and the hit agree, and a pure damage module (`src/lib/combat/damage.js`) applies the game’s falloff, material grid and hit points from `src/data/bf2017/damage.json`. Spheres stay as the broad phase and as the fallback until a hull has loaded.

**Tech stack:** JavaScript (ES modules), three.js r186 (drawing only), Vitest, `@gltf-transform/core` + `meshoptimizer` in Node scripts (both already dependencies), Ghidra 12.1.4 headless, REA (`rea` MCP server).

**Spec:** `docs/superpowers/specs/2026-10-14-galaxy-space-hulls-design.md`

## Global constraints

- **D: keeps 20 GB free.** Nothing is written to D:. Ghidra runs read-only (`-readOnly`) on projects already there; its output and any project copy go to C: (`$SCRATCH/ghidra/`). Check `Get-PSDrive D` before any step that reads a large file from D: into a C: copy, too (C: has ~57 GB free).
- **`CREDITS.md` is not changed.** Not by `npm run credits`, not by hand.
- Keys never printed or committed; scripts read `SUPABASE_URL`, `SUPA_KEY` / `BF2017_KEY` from the main checkout’s `.env.local` (copy it into the worktree; it is git-ignored).
- Game-derived binaries are published by hash to `site-assets` and never committed (`docs/decisions/2026-10-10-battlefront-2017-assets.md`); a hull made from a model already in git is committed beside it.
- No new library (none is needed). `src/lib/` modules have no three.js and no DOM.
- Units: a galaxy battle unit is 53.3 m (`METRES`, `src/components/galaxy/surface/missions/starfighter.js:44`); the battle’s fixed step is 1/30 s (`BATTLE.step`).
- Every game number carries its `_source` (`Asset#Type.Field`); nothing ships marked *(inferred)*: an unproven rule is proven by data, then Ghidra, then REA (spec §2.5), or it goes to the owner.
- Repo voice in code comments, docs and commits: British spelling, curly quotes in prose, comments say why. Commits end with the two attribution lines this session’s reminder gives.
- Before the pull request: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` (on this Windows machine 50 test files fail on `origin/main` already, Rapier’s `C:\C:\` path and POSIX path tests: compare the failing set with `origin/main`’s, it must not grow).

## Review focus

1. **A hull that has not loaded, or a 404 from the bucket**: the ship is hit as today’s sphere, and the bucket is not marked down for the visit (load with `loadBytes`, which tags a 404 `missing`). Test in Task 8.
2. **The cut drawn is not the cut measured** (light cut on low/mid, ultra on ultra, the Nebulon-B’s different HQ hull on high/ultra): the hull must sit on every cut within 2 %, and the HQ Nebulon-B has its own hull (`hq/nebulon`). Test in Tasks 5 and 6.
3. **Fast things through thin things**: a 2,000 m/s bolt moves 1.25 units a fixed step and a TIE’s wing is a few centimetres thick; your ship at full speed crosses a fighter in a frame. Bolts are segments, contact sweeps each probe from where it was to where it is; nothing tests an end position only. Tests in Tasks 3 and 11.
4. **A capital moved by a set piece** (`warpieces/scarif.js:134,155` turn a ship without `moveHull`, so today’s solids go stale): every query reads the capital’s live `pos`/`fwd`/`up`; there are no copied solids. Test in Task 11.
5. **Arriving inside a hull** (a jump in beside a Star Destroyer, a respawn inside a wingman): the first contact pushes you out without crash damage. Test in Task 11.

---

### Task 1: Prove the damage rules (RE: data, Ghidra, REA)

Not test-driven code: a finding with evidence, which Task 7 turns into data.

**Files:**
- Create: `C:\Users\tilak\source\repos\bf2-re\findings\57-space-hits-and-damage.md` (the next free number; check `ls findings` first)
- Create: `docs/superpowers/evidence/galaxy-hulls/README.md` (what was run, the REA recordings’ names)

**Interfaces:**
- Produces: the finding’s answers, each marked RECORD, CODE, LIVE or NOTE, read by Task 7:
  1. `PackedLayout`: which bits of `Packed` / a shape tag are the property index (finding 39 says 22–31; findings 20, 25 and the site’s `src/data/bf2017/physics/NOTES.md:39` say 12–19 or `>> 22`).
  2. `VehicleHitPair`: whether a bolt on a starfighter takes the vehicle’s `VehicleEntityData.MaterialPair` (p68, 1.25×) or the shape’s tag (p34 on the raycast meshes, no relation, 0×).
  3. `MultiplierRule`: which of `DamageProtectionMultiplier` (+0x20) and `DamagePenetrationMultiplier` (+0x24) scales a bolt, and what `DamageProtectionThreshold` (+0x28) does (the reading so far: damage × multiplier, applied only if it reaches the threshold).
  4. `HealthChain`: how `PartComponentData.HealthStates` (e.g. the CR90’s 500/1/0) is spent: the first state full health, each next state’s `Health` the floor to the next.
  5. `Roots`: RECORD, already proven: `RigidBodyData.CollisionRootShapeIndex 0`, `RaycastRootShapeIndex 1` (`EX\data\Gameplay\Vehicles\Air\XWing_T65\Vehicle_Air_XWing_T65.json`); cite it.

- [ ] **Step 1: Data first.** For each question, read the records (`C:\Users\tilak\Downloads\BF2_Extract\web\data\…`, `physics.jsonl`, the six `materialgrid_win32.json`) and write what they settle, with `Type.Field` and file.
- [ ] **Step 2: Ghidra, read-only.** Copy `D:\bf2-ghidra\abil63\gh.ps1` to `$SCRATCH/ghidra/gh.ps1`, point its output at `$SCRATCH/ghidra/out`, keep `-readOnly` on `D:\bf2-ghidra\render62\proj-live-named`. Run `DecompileAddrs` (depth 1) on: `0x147bb0bd0` (shape-tag codec), `0x146a1ad50` (damage relation reader), `0x141be5a60` (`WSServerVehicleHealthComponent_i` vslot42), `0x141871850` (bullet collision handler), the material getter in `ServerBulletEntity_i` vslot82, `0x1474bf830`, `0x1474bf390`. Expected: `.c` files in `$SCRATCH/ghidra/out` and `log-*.txt` with no `ERROR`. Answer questions 1–4 from them, quoting the lines.
- [ ] **Step 3: REA, native.** Check the `rea` server sees `GHIDRA_INSTALL_DIR` (an HKCU variable, `C:\Users\tilak\tools\ghidra\ghidra_12.1.4_PUBLIC`; findings/30 found it missing). Open the image through `open_binary` / `binary_session` on the named project (or a snapshot exported from it, findings/30:146) and trace the same call paths (`build_call_path` from the bullet collision handler to the health component, `trace_native_values` on the multiplier read). Expected: the same answers as step 2, or the tool’s error recorded verbatim with what was tried (timeouts included) in the finding’s “Tools” section.
- [ ] **Step 4: REA, live.** Record the galaxy’s war on the live site before the change: `capture_browser_scenario` on `https://tilakpatell.com/#/galaxy/hoth` (the war’s system the panel names; any system with a war on) with 60 s of play; save the recording’s id in the evidence README.
- [ ] **Step 5: Anything still open** goes in the finding’s “Open” section and to the owner, with what was tried. Task 7 does not start on an open question.
- [ ] **Step 6: Commit** the finding in `bf2-re` (its own repository, branch `master`) and the evidence README here.

```bash
git -C C:/Users/tilak/source/repos/bf2-re add findings/57-space-hits-and-damage.md
git -C C:/Users/tilak/source/repos/bf2-re commit -m "Finding 57: how a bolt in space meets a ship and what it does"
git add docs/superpowers/evidence/galaxy-hulls/README.md
git commit -m "The hulls’ evidence: what was run to prove the damage rules"
```

---

### Task 2: The shapes bin, version 2

**Files:**
- Modify: `src/lib/physics/shapesBin.js`
- Create: `src/lib/physics/shapesBin.test.js`

**Interfaces:**
- Produces: `packHull({ radius, parts, shapes }) → ArrayBuffer`; `readHull(buffer) → { version, radius, parts: [{ name, property }], shapes }` where `shapes` is `readShapes`’s list. `readShapes(buffer)` reads version 1 and 2 (it skips a version 2 header). `packShapes` still writes version 1.
- Version 2 layout: `'BFPH'`, u32 `2`, u32 shape count, f32 radius, u32 part count, then per part a u8 name length, the name’s UTF-8 bytes, a u8 property, padded to 4; then version 1’s shapes as they are.

- [ ] **Step 1: Write the failing tests**

```js
it('round-trips a hull with its radius and its parts', () => {
  const shapes = [{ kind: 'hull', part: 0, material: 68, root: 0, points: new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,1]) },
    { kind: 'mesh', part: 1, material: 206, root: 1, points: new Float32Array([0,0,0, 1,0,0, 0,1,0]), indices: new Uint32Array([0,1,2]) }];
  const h = readHull(packHull({ radius: 0.62, parts: [{ name: 'body', property: 68 }, { name: 'reactor', property: 206 }], shapes }));
  expect(h.version).toBe(2);
  expect(h.radius).toBeCloseTo(0.62, 6);
  expect(h.parts).toEqual([{ name: 'body', property: 68 }, { name: 'reactor', property: 206 }]);
  expect(Array.from(h.shapes[1].indices)).toEqual([0, 1, 2]);
  expect(h.shapes[0].material).toBe(68);
});
it('still reads a version 1 bin, and readShapes reads a version 2 one', () => {
  const v1 = packShapes([{ kind: 'sphere', part: 0, material: 0, root: 0, centre: [1, 2, 3], radius: 4 }]);
  expect(readShapes(v1)[0].radius).toBe(4);
  expect(readHull(v1).parts).toEqual([]);
  const v2 = packHull({ radius: 1, parts: [], shapes: [{ kind: 'sphere', part: 0, material: 0, root: 0, centre: [0, 0, 0], radius: 2 }] });
  expect(readShapes(v2)[0].radius).toBe(2);
});
it('refuses a name over 255 bytes and a version it does not know', () => { /* packHull throws; a buffer with version 3 throws 'shapes bin: version 3' */ });
```

- [ ] **Step 2: Run** `npx vitest run src/lib/physics/shapesBin.test.js`. Expected: FAIL, `packHull is not a function`.
- [ ] **Step 3: Implement** `packHull` and `readHull` in `shapesBin.js`; `readShapes` branches on the version. Keep every block a multiple of four bytes so the arrays stay views.
- [ ] **Step 4: Run** the new test and `npx vitest run src/lib/physics scripts/lib/bf2017-physics.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "The shapes bin’s second version: a hull’s radius and its parts’ names and properties"`.

---

### Task 3: Bolts and contact against a hull (`src/lib/combat/hulls.js`)

**Files:**
- Create: `src/lib/combat/hulls.js`, `src/lib/combat/hulls.test.js`

**Interfaces:**
- Consumes: `readHull` (Task 2).
- Produces:
  - `hullOf(bin: ArrayBuffer) → Hull` with `Hull = { radius, parts, rays: Bvh (root 1 triangles, or all triangles where there is one root), probes: Float32Array (root 0 hulls’ corners and centres), solids: [{ planes: Float32Array, part }] (root 0 hulls as planes) }`.
  - `hullFromTriangles(positions: Float32Array, indices: Uint32Array, { maxTris = 1500, property = 0, name = 'hull' }) → Hull` (vertex clustering on a grid to keep under `maxTris`, for the player’s and pilots’ ships).
  - `segmentHit(hull, { at0, at1, basis, scale }, a, b) → { t, part, property, point, normal } | null`: `at0`/`at1` the ship’s position at the segment’s start and end (the segment is tested in the ship’s moving frame: `a − at0`, `b − at1`), `basis` a 9-number column-major rotation (x, y, z axes), `scale` the drawn size; `point` and `normal` in world space; `t ∈ [0, 1]` along `a → b`.
  - `hullContact(small, smallPose, big, bigPose) → { normal, depth, at, part } | null`: each of `small`’s probes swept from its place in `smallPose.at0` to `smallPose.at1` against `big`’s solids (and its ray triangles where it has no solids); `depth` the push-out along `normal` (world, pointing out of `big`).
  - Poses are plain objects; no three.js.

- [ ] **Step 1: Write the failing tests** (a unit box hull built with `packHull`, and the X-wing fixture):

```js
it('meets a box where the segment enters it', () => {
  const h = hullOf(boxBin()); // a 1×1×1 box, root 1 mesh, part 0, property 68
  const hit = segmentHit(h, { at0: [0,0,0], at1: [0,0,0], basis: I, scale: 2 }, [-5, 0, 0], [5, 0, 0]);
  expect(hit.t).toBeCloseTo(0.4, 5); expect(hit.point[0]).toBeCloseTo(-1, 5); expect(hit.normal).toEqual([-1, 0, 0]); expect(hit.property).toBe(68);
});
it('misses beside it, and meets it turned', () => { /* a segment at y = 1.2 misses; with the box turned 45° about y the entry is at x = −√2 */ });
it('meets a box moving across the segment (the moving frame)', () => { /* at0 [0,0,-3], at1 [0,0,3], segment x −5→5 at z 0: hit */ });
it('pushes a probe that has crossed a thin wall out the side it came from', () => { /* probe from z −1 to z +1 across a 0.01-thick plate: normal [0,0,-1], depth > 0 */ });
it('hullFromTriangles keeps a 20,000-triangle sphere under 1,500 and its radius within 3 %', () => {});
it('answers 10,000 segment tests against a 1,000-triangle hull in under 50 ms', () => {});
```

(The X-wing’s own tests come in Task 5, which makes its hull.)

- [ ] **Step 2: Run** `npx vitest run src/lib/combat/hulls.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.** The tree: a binary tree of axis-aligned boxes over the triangles, split on the longest axis at the median, leaves of 4 triangles, stored in typed arrays, built once a kind in `hullOf`. Ray–triangle: Möller–Trumbore, the nearest `t` wins. Contact: a probe’s path against each solid’s planes (clip the segment by the planes; the entry plane is the normal), then the deepest wins.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Hulls: a bolt meets a ship on its shapes, and a ship is kept out of another"`.

---

### Task 4: One pose for the drawing and the hit (`src/lib/combat/pose.js`)

**Files:**
- Create: `src/lib/combat/pose.js`, `src/lib/combat/pose.test.js`
- Modify: `src/components/universe/battleScene.js:66-90` (`orient` uses `basisOf`), `:288-290` (the bob from `bobOf`), `:302-304`, `:314`
- Modify: `src/components/universe/glbFleet.js:89-98` (`Box3().setFromObject(turn, true)`, the precise box, as `galaxy/models.js` `normalise` measures)

**Interfaces:**
- Produces:
  - `basisOf(fwd, up, bank = 0) → Float32Array(9)`: the same axes `battleScene.js`’s `orient` builds today (z = fwd, x = up × z, y = z × x, then the roll by `bank`).
  - `bobOf(cap, t, reduced) → number`: `reduced ? 0 : Math.sin(t * 0.3 + cap.id) * 0.15` (the drawing’s, `battleScene.js:289`).
  - `capitalPose(cap, t, reduced) → { at0, at1, basis, scale }` (`at0 = at1 = cap.pos + (0, bob, 0)`, `scale = cap.size`).
  - `fighterPose(f, frame = 0) → pose` (`at0 = f.prev`, `at1 = f.seen ?? f.pos`; `basisOf(f.fwd, UP, f.bank)`); `runnerPose(r)` (no bank).
  - `hunterPose(h) → pose` (nose along `h.vel`, rolled by `−h.bank`, as `hunters.js:180-184` draws it), `scale = h.type.size`.
  - `playerPose(ship, prev) → pose` (the `'YXZ'` Euler of `pitch`, `heading`, `−bank`, nose −z: `galaxy/scene.js:740`), `scale = 1` (the player’s hull is made in its drawn units, Task 10).
- The battle’s clock `t` reaches the simulation through `b.clock` (already on the battle); the scene’s `reduced` flag is passed to `createBattle` as `reduced` so both read the same bob.

- [ ] **Step 1: Write the failing tests**: `basisOf` equals the matrix `orient` made before the change for 20 random `fwd`/`up`/`bank` (build the expected one with three’s `Matrix4.makeBasis` in the test); `bobOf` is 0 when reduced and matches the old expression otherwise; `hunterPose`’s z axis is `normalize(vel)`; `playerPose`’s −z axis is the heading’s forward.
- [ ] **Step 2: Run** `npx vitest run src/lib/combat/pose.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `pose.js`; make `battleScene.js` call `basisOf` and `bobOf` (no change to what is drawn), and the precise box in `glbFleet.js`.
- [ ] **Step 4: Run** `npx vitest run src/lib/combat src/components/universe/battleScene.test.js src/components/universe/glbFleet.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "One pose for the drawing and the hit: the battle’s ships turned and bobbed by one module"`.

---

### Task 5: The fighters’ hulls from the game (`scripts/bf2017-hulls.mjs`)

**Files:**
- Create: `scripts/lib/bf2017-hulls.mjs`, `scripts/lib/bf2017-hulls.test.mjs`, `scripts/bf2017-hulls.mjs`
- Create: `src/data/galaxyHulls.json` (kind → `{ source: 'game' | 'site', bytes, parts, radius, from }`, committed)

**Interfaces:**
- Consumes: `readPhysicsGlb`, `physicsKey` (`scripts/lib/bf2017-physics.mjs:184, :259`), `packHull` (Task 2), `fitScale` (`src/components/universe/shipFit.js:39`, through Vite’s `ssrLoadModule` as `scripts/battlefront-balance.mjs:61-67` does), `MODELS` rows (`src/components/galaxy/models.js:36-123`).
- Produces:
  - `rosterKinds() → string[]`: every kind in `universe/wars.js`’s Star Wars sides, `galaxy/battlesWars.js`, `galaxy/hunted.js`, `models.js`’s `HUNTER_GLB`, `universe/setpieces.js`, `galaxy/interdictor.js`, `galaxy/warpieces/*`.
  - `FIGHTER_PHYSICS`: kind → the flying asset’s path under `web/physics/Gameplay/Vehicles/Air/` (xwing `XWing_T65/Vehicle_Air_XWing_T65_Physics_Win32.glb`, awing `AWing/Vehicle_Air_AWing_Physics_Win32.glb`, ywing `Ywing/Vehicle_Air_YWing_Physics_Win32.glb`, uwing `Uwing/Vehicle_Air_UWing_Gunship_Physics_Win32.glb`, tie `TieFighter/…`, interceptor `TieInterceptor/…`, tiebomber `TieBomber/…`, tieadvanced `TieAdvancedX1/…`, vulture `VultureDroid/…`, trifighter `DroidTriFighter/…`, arc170 `ARC170/…`, n1 `N1Starfighter/…`, slave1 `Slave1/…`, falcon `MillenniumFalcon/Landmark/MillenniumFalcon_01_Landmark_Physics_Win32.glb` (the fleet’s Falcon is the landmark model), xwing65 as xwing, vwing `Vwing/…`, hyena `HyenaBomber/…`).
  - `frameOf(glbDoc, nose, kind) → { nose, centre: [3], k }`: the precise box `normalise` measures (every POSITION element of every primitive through its node’s world matrix, turned by `R_y(nose)`), its centre, `k = fitScale(kind, size)`.
  - `gameToGlb(glbDoc, gameBox) → Matrix4-like [16]`: the game mesh frame to the GLB scene frame: the GLB’s `nose` node matrix where `bf2017-fleet.mjs` wrote one (`:136-141`), else identity; then the translation that puts the game model’s render box (its `models.jsonl` LOD0 `min`/`max`) on the GLB’s box. Throws if the two boxes’ sizes differ by over 1 % (a scale or a turn the import made that this does not know).
  - `fitShapes(shapes, gameToGlb, frame) → shapes`: every point through `gameToGlb`, `R_y(nose)`, `− centre`, `× k`.
  - CLI: `node scripts/bf2017-hulls.mjs [--root <export web dir>] [--only <kind,…>] [--dry]`, default root `C:/Users/tilak/Downloads/BF2_Extract/web`, else `lab/assets/bf2017/web` (fetched with `node scripts/bf2017-fetch.mjs --raw physics/…`); writes `public/models/galaxy/hulls/<kind>.bin` and `src/data/galaxyHulls.json`. The render GLB comes from `public/` or, where it is published only, from the bucket by `galaxyAssets.json`’s hash (as `scripts/bf2017-horizon.mjs:52-80` `packFile` does, cached in `scripts/.cache/`).
- Each shape keeps `root` (0 collision, 1 raycast: the X-wing’s `RigidBodyData.CollisionRootShapeIndex 0`, `RaycastRootShapeIndex 1`), its `part`, and its `material` set to the property index of its palette slot (Task 1’s `PackedLayout`); the parts list names each part `part<N>` with the property of its first shape.

- [ ] **Step 1: Write the failing tests** (`scripts/lib/bf2017-hulls.test.mjs`, with the fixture X-wing physics GLB already in `scripts/fixtures/bf2017/physics/` or added there, and a fixture GLB made in the test with gltf-transform):

```js
it('rosterKinds names every Star Wars kind the galaxy flies', async () => {
  const k = await rosterKinds();
  for (const kind of ['xwing','awing','ywing','bwing','uwing','tie','interceptor','tiebomber','delta7','vulture','ghost','destroyer','moncal','nebulon','corvette','lightcruiser','gozanti','executor','interdictor']) expect(k).toContain(kind);
});
it('frameOf measures as normalise does: turned, centred, one long', () => { /* a 2×1×4 box GLB, nose π/2 → centre after the turn, k = 1/2 (z after the turn is 2) */ });
it('gameToGlb refuses boxes of different sizes', () => {});
it('the X-wing hull sits on its render model within 2 %', async () => { /* frame from the X-wing’s plain cut; the fitted root 1 shapes’ box against the render box after normalise: each side within 2 % */ });
it('the X-wing keeps root 0 for contact and root 1 for bolts, and part 7’s hulls carry property 68', () => {});
it('the X-wing: a bolt through the gap between its S-foils misses, one on a foil hits', () => {
  const x = hullOf(readFixture('xwing-hull.bin')); // Task 3’s hullOf on the fixture this task writes
  expect(segmentHit(x, pose(1), [0, 0, 2], [0, 0, -2])).not.toBeNull();   // down the fuselage
  // the slot between the foils and a point on the upper foil: their x and y read off the fitted shapes
  // when the fixture is made (the foils’ inner edges from root 1’s parts), written into the test as numbers
});
it('answers 10,000 segment tests against the X-wing in under 50 ms', () => {});
```

Write `scripts/fixtures/bf2017/physics/xwing-hull.bin` (the X-wing’s hull, 15 KB; the folder already holds the game’s shapes for tests) in step 4, then run these two.

- [ ] **Step 2: Run** `npx vitest run scripts/lib/bf2017-hulls.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** the library and the CLI. Measure each kind against **every** cut it is drawn in (`LIGHT_CUTS`, `ULTRA`, the plain cut; `models.js:137-199`) and fail the kind if any cut’s box is off by over 2 %.
- [ ] **Step 4: Run** the tests, then `node scripts/bf2017-hulls.mjs --only xwing,tie,awing,ywing,uwing,interceptor,tiebomber,tieadvanced,vulture,trifighter,arc170,n1,slave1,falcon,xwing65,vwing,hyena`. Expected: one `.bin` a kind, each line `<kind> <bytes> B, <parts> parts, radius <r>`, no `off by` errors.
- [ ] **Step 5: Commit** the scripts, tests, fixture and `src/data/galaxyHulls.json` (not the `.bin`s: Task 8 publishes them) `git commit -m "The fighters’ hulls from the game’s own shapes, in the frame each is drawn in"`.

---

### Task 6: The capitals’ hulls, and the hulls of ships the game never had

**Files:**
- Modify: `scripts/lib/bf2017-hulls.mjs`, `scripts/lib/bf2017-hulls.test.mjs`, `scripts/bf2017-hulls.mjs`
- Create: `public/models/galaxy/hulls/<kind>.bin` for the site’s own models (committed): bwing, ghost, executor, gozanti, munificent, acclamator, delta7, interdictor, gunboat, ig2000, houndstooth, punishingone, and any other roster kind with no game physics.

**Interfaces:**
- Consumes: `piecesOf` / the kit table (`scripts/lib/bf2017-space.mjs:46-54, :142-257`, `relative` `:108-112`), `readMap` (`scripts/lib/bf2017-level.mjs:50-65`), Task 5’s `frameOf`, `gameToGlb`, `fitShapes`.
- Produces:
  - `CAPITAL_KITS`: destroyer `endor`/`endor-isd`, moncal `endor`/`endor-mc80`, corvette `endor`/`corvettecr90-01`, venator `kamino`/`kamino-venator`, providence `kamino`/`providenceclassdreadnaught-01`, lucrehulk `naboo`/`naboo-lucrehulk`, lightcruiser `fondor`/`fondor-arquitens` (as `scripts/bf2017-fleet.mjs:44-90` builds them), nebulon `Objects/Props/Landmarks/_RebelAlliance/BD_FrigateNebulonB_01/FrigateNebulonB_01_Physics_Win32`, `hq/nebulon` the same shapes in the HQ model’s frame.
  - `kitShapes(space, kit) → shapes`: each kit part’s Havok asset (`physicsKey(part.file)`), its shapes through the part’s `at`/`quaternion`/`scale`; each part keeps its own index, named after its file’s slug (`stardestroyer_deflectorshield_01`, `mc80_largenodule_03`, …), so a subsystem or turret hit names itself.
  - `siteHull(glbDoc, kind, { maxTris }) → shapes`: the render model’s triangles, simplified with `MeshoptSimplifier.simplify` (as `scripts/bf2017-horizon.mjs:154-155`, falling back to `simplifySloppy`), 600 triangles for a fighter, 4,000 for a capital (a kind is a capital if its `wars.js` role is `flagship` or `escort`), one part `hull`, root 1 and a root 0 of up to 8 convex hulls from a k-means of the vertices (`reduceHull` each, 64 points).
  - `SUBSYSTEM_PARTS`: for the site’s own flagships the war fires at (executor, interdictor): the war’s subsystem ids (`gen-port`, `gen-star`, `bridge`, `reactor`, `universe/wars.js:333-339`) as small parts placed at their `at` shares, so a hit on them names them.

- [ ] **Step 1: Write the failing tests**: the Star Destroyer’s hull has a part named for its deflector shield and its reactor and covers the render box within 2 % (the wing edge included: a point at x = ±0.27 of the length on the widest section is inside a root 0 solid); a site hull of the B-wing has ≤ 600 triangles and its box within 3 % of the model’s; `hq/nebulon` sits on the HQ model; the roster test: every `rosterKinds()` kind except `deathstar` and `deathstar2` (the world’s own sphere stays) has an entry in `galaxyHulls.json`.
- [ ] **Step 2: Run** `npx vitest run scripts/lib/bf2017-hulls.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement**; fetch the space maps the kits need with `node scripts/bf2017-fetch.mjs --folder 'maps/levels/space/sb_endor_01/*'` (and kamino, naboo, fondor) and the capitals’ physics with `web 'physics/Gameplay/Vehicles/Capital/**'`, `'physics/Objects/Props/Landmarks/_GalacticEmpire/StarDestroyer_01/**'`, `'physics/Gameplay/Vehicles/Corvette/**'` into `lab/assets/bf2017/` (C:).
- [ ] **Step 4: Run** the tests, then `node scripts/bf2017-hulls.mjs`. Expected: every roster kind written; the summary’s last line `hulls: <n> kinds, <game> from the game, <site> from the site’s models, 0 missing`.
- [ ] **Step 5: Commit** the scripts, tests, the site hulls and `galaxyHulls.json` `git commit -m "The capitals’ hulls from their modules’ shapes, and hulls for the ships the game never had"`.

---

### Task 7: The game’s damage as data (`src/data/bf2017/damage.json`)

Starts only when Task 1 has no open question.

**Files:**
- Create: `scripts/lib/bf2017-rulebook-damage.mjs`, `scripts/lib/bf2017-rulebook-damage.test.mjs` (fixtures in `scripts/fixtures/bf2017/damage/`)
- Modify: `scripts/bf2017-data.mjs` (a `damage` branch beside `air`, `:331-339`)
- Create: `src/data/bf2017/damage.json`
- Modify: `src/data/bf2017/rulebook.test.js:10` (add `damage` to `FILES`)

**Interfaces:**
- Consumes: the EBX helpers (`scripts/lib/bf2017-ebx.mjs`), `where()` and `checkSources` (`scripts/lib/bf2017-rulebook.mjs:56`), Task 1’s answers.
- Produces `damage.json`:
  - `grid`: `{ [attackerProperty]: { [targetProperty]: { multiplier, threshold, collision, _source } } }` for the properties space uses (attackers 216, 72, 61, 116, 6 and the torpedoes’; targets 68, 129, 130, 131, 132, 206, 34), from `SB_Endor_01`’s grid (the six agree on the values, Task 1), each mapped through that level’s own `MaterialIndexMap`; a missing relation is cell (0, 0)’s.
  - `fighters`: kind → `{ hp, regenDelay, regenRate, property, bolt: { damage, damageFar, falloff: [near, far] (m), speed (m/s), life (s), property }, ram: { angle, glancing, friend, enemy } }`, from `air.json` and the blueprints (`property` the vehicle’s pair or the shape’s, by Task 1’s `VehicleHitPair`).
  - `capitals`: kind → `{ parts: { [partName]: { health: [..], property } }, turrets: { hp, bolt } }` from the records (spec §2.4; the extractor’s table: the ISD’s deflector shield 30000/0, reactor 300/0, the MC80’s nodules 201/200/0, the CR90’s hull 500/1/0, …).
  - `stand`: kind → `{ as: <game kind>, why }` for every kind the game never had (the B-wing as the Y-wing’s class, the Executor as the Star Destroyer, the Munificent as the Providence, …), the choice written beside it.
- `checkSources` passes on it.

- [ ] **Step 1: Write the failing tests**: the fixture grid gives `grid[216][68].multiplier === 1.25`, `grid[216][132].multiplier === 0`, `grid[61][68].multiplier === 4`; the X-wing’s bolt is `{ damage: 75, damageFar: 65, falloff: [400, 600], speed: 2000, life: 0.45 }`; every number has a `_source`; every roster kind is in `fighters`, `capitals` or `stand`.
- [ ] **Step 2: Run** `npx vitest run scripts/lib/bf2017-rulebook-damage.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement**; then `node scripts/bf2017-data.mjs damage --root C:/Users/tilak/Downloads/BF2_Extract/web`.
- [ ] **Step 4: Run** the tests and `npx vitest run src/data/bf2017/rulebook.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "The game’s damage in space as data: the material grid, the fighters’ bolts and the capitals’ parts"`.

---

### Task 8: Publishing the game’s hulls, and loading them on the page

**Files:**
- Modify: `scripts/lib/asset-manifest.mjs` (`gameFiles`, `:101-132`: add every `galaxyHulls.json` entry with `source: 'game'` at `models/galaxy/hulls/<kind>.bin`; not through `PACKS`, which would publish the site’s own)
- Modify: `.gitignore` (through `assets-publish.mjs`’s block)
- Create: `src/components/galaxy/hulls.js`, `src/components/galaxy/hulls.test.js`
- Modify: `src/components/galaxy/models.js` (`want(kinds)` and `prebuild(kinds)` also want the kinds’ hulls)

**Interfaces:**
- Consumes: `loadBytes(path, { priority, signal })` (`src/lib/assetLoad.js:77-89`), `hullOf` (Task 3).
- Produces: `createHulls({ load = loadBytes }) → { want(kinds), get(kind) → Hull | null, dispose() }`; `get` is null until the kind has loaded, and stays null after a failure (its ship stays a sphere; the failure is logged once, not thrown). The `hq/nebulon` key is used where `models.js`’s row for the kind has `hq: true`.

- [ ] **Step 1: Write the failing tests**: `get` is null before the load resolves and a `Hull` after; a load rejecting `{ missing: true }` leaves `get` null and does not reject `want`; a kind wanted twice is fetched once; `hq` rows load `hq/nebulon`.
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/hulls.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**; wire `models.js`.
- [ ] **Step 4: Run** the tests; then publish: `node scripts/assets-publish.mjs --dry` (expected: the game hulls listed, nothing else new), then `node scripts/assets-publish.mjs` and `node scripts/assets-check.mjs` (expected: every entry 206, its size, a year’s cache).
- [ ] **Step 5: Commit** `src/data/galaxyAssets.json`, `.gitignore`, the code and tests `git commit -m "The game’s hulls published by hash, and loaded with their ships"`.

---

### Task 9: The game’s damage applied (`src/lib/combat/damage.js`)

**Files:**
- Create: `src/lib/combat/damage.js`, `src/lib/combat/damage.test.js`

**Interfaces:**
- Consumes: `damage.json` (Task 7).
- Produces:
  - `boltDamage(bolt, metres) → number`: `damage` until `falloff[0]`, linear to `damageFar` at `falloff[1]`, `damageFar` beyond.
  - `multiplier(attackerProperty, targetProperty) → { multiplier, threshold }` (cell (0, 0)’s for a pair with no relation).
  - `hitDamage(bolt, metres, targetProperty) → number`: `boltDamage × multiplier`, or 0 below the threshold (Task 1’s `MultiplierRule`; the test pins whichever it proves).
  - `rammed(health, angleDeg, friend) → number`: `enemy`/`friend` under `angle`, a `glancing`-th of it past.
  - `partsHealth(chain) → { hp, floors }` and `spend(state, dmg) → state` (Task 1’s `HealthChain`).
  - `kindDamage(kind) → the kind’s row`, through `stand` for a kind the game never had.

- [ ] **Step 1: Write the failing tests**: `boltDamage(xwingBolt, 300) === 75`, `(500) === 70`, `(700) === 65`; `hitDamage(xwingBolt, 300, 68) === 93.75`; `hitDamage(xwingBolt, 300, 132) === 0`; a heavy turbolaser on a fighter ×4; the ram under 65° is 25 against an enemy and 25/6 past it; the CR90’s chain spends 500 then floors at 1; `kindDamage('bwing')` is the stand-in’s row.
- [ ] **Step 2: Run** `npx vitest run src/lib/combat/damage.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "The game’s damage: the bolt’s falloff, the material grid and the parts’ health"`.

---

### Task 10: Bolts on hulls through the galaxy’s one chain

*(2026-10-15, part 2: done for the war’s fighters, runners and capitals, the hunters and the set piece’s capital, with `part` and `property` on every hit; another pilot’s ship keeps its sphere and the damage numbers stay the site’s. `docs/superpowers/specs/2026-10-15-galaxy-space-fidelity-design.md`.)*

**Files:**
- Modify: `src/components/universe/battle.js` (`capitalHit` `:224-241`, `moveBolts` `:289-395`, `b.hit` `:520-602`, `createBattle` takes `{ hulls, reduced }`), `src/components/universe/battleCapitals.js` (subs and turrets found by part name; `HULLS` spheres kept as the broad phase only), `src/components/universe/battleKit.js` (`BATTLE.bolts` from `damage.json`: speed in units = m/s ÷ 53.3, life, the shooter’s bolt row), `src/components/universe/wars.js` (`FIGHTERS` hp from `kindDamage`)
- Modify: `src/components/universe/hunterRules.js` (`hit` `:1228`, the shots at you `:1174-1219`), `src/components/universe/online/pilots.js` (`hit` `:495-517`), `src/components/galaxy/scene.js` (`strike` `:1025`: set pieces too, `pieces.hit`; `hurt` takes game damage against your kind’s hp)
- Create: `src/components/galaxy/shipHull.js` (`hullOfObject(object3d) → Hull`: the drawn ship’s triangles in its own frame through `hullFromTriangles`; your ship, your build, another pilot’s)
- Test: `src/components/universe/battle.test.js`, `hunterRules.test.js`, `src/components/galaxy/warfront.test.js`, `src/components/universe/online/pilots.bodies.test.js`, new `src/components/galaxy/shipHull.test.js`

**Interfaces:**
- Consumes: `segmentHit`, `hullOf` (Task 3), the poses (Task 4), `createHulls().get` (Task 8), `hitDamage`, `kindDamage`, `spend` (Task 9).
- Produces: every hit object keeps its shape today (`{ id, kind, at, size, down, … }`, `galaxy/scene.js:1002` reads it) plus `part` and `property`; a ship whose hull is null is tested as today’s sphere.
- Order stays: hunters, then the war (set pieces first, `warfront.js:633`), then pilots; across one target list the nearest `t` wins.

- [ ] **Step 1: Write the failing tests**:
  - `battle.test.js`: “a bolt at a Star Destroyer’s wing edge meets its hull” (a capital `destroyer` with the fixture hull; a segment at 0.27 of its length off the centre line hits, where the spheres missed); “a bolt through the gap beside an X-wing’s foil misses it”; “a hull hit on a capital does the grid’s damage” (0 for a blaster on hull property 132; a turret hit 1×); “a ship with no hull is still hit as a sphere”.
  - `hunterRules.test.js`: “your shot meets a hunter on its hull, turned as it flies”.
  - `pilots.bodies.test.js`: “another pilot is hit on the hull of the ship they fly”.
  - `shipHull.test.js`: “your build’s hull is its drawn geometry, under 1,500 triangles, nose −z”.
  - `warfront.test.js`: “a set piece’s Star Destroyer can be shot in the galaxy” (`strike` reaches `pieces.hit`).
- [ ] **Step 2: Run** `npx vitest run src/components/universe src/components/galaxy src/lib/combat`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement**, file by file, keeping each hit object’s fields.
- [ ] **Step 4: Run** the same command, and the full unit suite of those folders. Expected: PASS; the existing tests that pinned sphere radii are changed only where the hull now decides, each change named in the commit.
- [ ] **Step 5: Commit** `git commit -m "Every bolt in the galaxy’s space meets ships on their hulls and does the game’s damage"`.

---

### Task 11: Solid ships: nobody passes through anybody

*(2026-10-15, part 2: done for a fighter against a capital’s hull and your ship against the war’s and the set piece’s capitals; the small ships keep contact.js’s spheres; the Interdictor its solids.)*

**Files:**
- Modify: `src/components/universe/shipHits.js` (`sweep` asks `hullContact` where both bodies have hulls; the ram damage from `rammed`), `src/lib/combat/contact.js` (unchanged laws; `bodyRadius` stays the broad phase)
- Modify: `src/components/galaxy/scene.js` (`shipsHit` `:1147`, the solids `:500-504`, `:1494`: capital hulls by pose, not `warfront.js`’s copied spheres), `src/components/galaxy/warfront.js` (`hulls()` `:325-330` and `ctx.moveHull`/`setHull` retired; `bodies` gain `pose()` and `hull`), `src/components/universe/battle.js` (an AI fighter kept out of a capital’s hull and out of another fighter: pushed along the contact normal each fixed step), `src/components/universe/setpieces.js` and `src/components/galaxy/interdictor.js` (their ships as hull bodies)
- Test: `shipHits.test.js`, `battle.test.js`, `warfront.test.js`, `src/components/galaxy/interdiction.test.js`

**Interfaces:**
- Consumes: `hullContact` (Task 3), poses (Task 4), `rammed` (Task 9), `hullOfObject` (Task 10).
- Produces: `shipHits.sweep` returns today’s `{ body, k, at, place, touch, normal, into, outcome, push }`, with `normal` and `place` from the hull where there is one.

- [ ] **Step 1: Write the failing tests**:
  - “you cannot fly through a Star Destroyer’s wing” (your ship swept across the wing’s edge at full speed is stopped at its surface: `place` outside every root 0 solid).
  - “an AI fighter flying at a capital is pushed out along its hull, not through it” (100 fixed steps aimed at a Venator: no step ends inside).
  - “a ship turned by a set piece is solid where it is drawn now” (turn a capital with `turnCapitalBy` and no other call; a probe at its new wing is pushed out).
  - “you jump in inside a hull and are put outside it without crash damage” (first contact: `outcome.damage === 0`).
  - “a ram head-on does the game’s 25, a glance a sixth of it”.
- [ ] **Step 2: Run** `npx vitest run src/components/universe src/components/galaxy`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Solid ships: every ship in the galaxy’s space kept out of every other, on their hulls"`.

---

### Task 12: The guard, the browser and the frame time

**Files:**
- Create: `src/components/galaxy/warLength.test.js`
- Modify: `scripts/perf-probe.mjs` (a `galaxyWar` journey: `/galaxy/<the war’s system>`, wait for the battle’s `__galaxy` dev hook to report it on, fly into it 10 s, fire 10 s)
- Modify: `docs/superpowers/evidence/galaxy-hulls/README.md`, `docs/superpowers/HANDOFF-galaxy.md` (what changed, what is left)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: The guard.** Write `warLength.test.js`: every Galactic Civil War battle kind (`galaxy/battles.js`) played by `createBattle` with nobody flying, at the high tier’s 32 a side, fixed steps until `b.over`; assert each ends between 6 and 20 minutes. Run `npx vitest run src/components/galaxy/warLength.test.js`.
- [ ] **Step 2: If a battle falls outside**, stop: write its numbers (which battle, how long, what killed what) in the evidence README and ask the owner; nothing is scaled to make the test pass.
- [ ] **Step 3: The browser.** `npx vite --port 5188` in the background, then with `CHROME` set to Edge (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`): `OUT=$SCRATCH/war-mid node scripts/galaxy-war-check.mjs "" mid` and `OUT=$SCRATCH/war-high node scripts/galaxy-war-check.mjs "" high`. Expected: no `FAIL` and no page error; look at the shots (the hits by part in the console log the check prints).
- [ ] **Step 4: REA, live, after.** Once deployed, the same `capture_browser_scenario` as Task 1 step 4; compare the two recordings (`compare_web_captures`) and note the hits by part and the deaths in the evidence README.
- [ ] **Step 5: The frame time.** `QUALITY=mid node scripts/perf-probe.mjs galaxyWar` on `origin/main` and on the branch, interleaved twice. Expected: the hull and contact queries’ share under 0.5 ms a frame (`PROFILE=1`), the frame no slower past the noise; the numbers in the evidence README.
- [ ] **Step 6: The four checks**, then commit `git commit -m "The war’s length guarded, its hits seen in a browser and its frame time measured"`.

---

## After the plan

Open the pull request (body: what was proven and how, the guard’s numbers, the frame times, the screenshots’ paths, the REA recordings), merge when CI is green, then write the second project’s design (every ship at the game’s full detail on mid and above).
