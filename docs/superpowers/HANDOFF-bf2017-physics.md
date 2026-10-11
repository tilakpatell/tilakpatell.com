# Hand-off: the galaxy’s physics from the Battlefront II (2017) data

The design: `docs/superpowers/specs/2026-10-10-bf2017-physics-design.md`. The plans: `docs/superpowers/plans/2026-10-10-bf2017-phaseP0-shapes.md`, `-phaseP1-body.md`, `-phaseP2-bolts-ragdolls.md`, `-phaseP3-vehicles.md`, `-phaseP4-surfaces.md`. Beside it: the asset pipeline (`HANDOFF-bf2017.md`: lanes 1, L, G, K, X, S, V), the game (`HANDOFF-battlefront.md`: lanes 0 to 7), and the Rapier library’s own hand-off on the closed branch `claude/wizardly-franklin-ws9uza` (`HANDOFF-rapier-body.md` there; PR #781, closed 2026-10-10 so the galaxy surface would take its physics from the drop, which is what these lanes do).

## What was found (2026-10-10, the desktop export)

- 10,530 Havok shape sets, 114,377 shapes (102,604 convex, 10,444 trimesh, 977 capsules, 198 spheres), 9.05 M triangles, 123 MB of quantised meshopt GLB, one node per shape with its class, part, instance and material index in the node’s extras; the map’s static instances were read out of the same Havok resources, so a model’s shapes at its instance transform are the game’s collision exactly.
- `CharacterPhysicsData` (13): the soldier’s capsule r 0.3, stand 1.7 / crouch 1.15, step 0.4 / 0.3, 45° to climb and to slide, walk 5.0, sprint 7.5, back 0.8, crouch 3.0, the gains, the slide’s gravity 0.34, the ground rays.
- `SkeletonCollisionData`: capsules per bone (the head r 0.16); `WSEACharacterPhysicsComponentData`: 15 ragdoll bodies, `MaxImpulse` 1000; `ProjectileBlueprint` (114): speed, gravity, drag, life, impulse, blast radii; `VehicleBlueprint` (159): masses, thresholds, crashed parts; `MaterialGridData` (44): per-pair damage, effects by speed, sounds, decals, footprints.
- Not there: material names, cloth (an EA binary), the solver itself, audio, props’ destruction graphs (not surveyed).

## The lanes

| lane | plan | what | starts from | blocked by |
| --- | --- | --- | --- | --- |
| P0 | `-phaseP0-shapes.md` | the shapes read, packed with the level, streamed as colliders by cell, the heightfield, the walker’s boxes | `main` | nothing (a fixture pack until lane L is on `main`) |
| P1 | `-phaseP1-body.md` | the #781 library back; the soldier rulebook; the player on the controller | `main` | P0 for task 4 |
| P2 | `-phaseP2-bolts-ragdolls.md` | ballistics, blasts, bone capsules, the ragdoll | `main` | P0 for the ray; lane 1 for a figure on the game’s bones |
| P3 | `-phaseP3-vehicles.md` | vehicle bodies, feet, debris, the rides on the walls | `main` after P0 and lane V | P0, lane V |
| P4 | `-phaseP4-surfaces.md` | the material grid; effects and prints by material | `main` | P0 for task 3 |

One lane per session. P0, P1, P2 and P4 run at once (no shared file: P1 creates `scripts/lib/bf2017-physics-rules.mjs` and P2 adds named exports to it; whoever lands second merges). P3 waits.

## For lane L (PR #810’s session on `claude/bf2017-l-hoth`)

Your task 4’s `src/lib/level/collision.js` is split: you keep `solidsOf(pack, cells)` for the walker and the one call site in `scene.js`; lane P0 writes `createLevelCollision` (the engine’s side) and `havok.js`’s per-instance `solidsOf` that yours calls, plus the pack’s `physics` section and `physics/*.bin` through `scripts/bf2017-physics.mjs` (call it from `bf2017-level.mjs` after the meshes, or leave it to P0 to call on your pack). Your `levelStream.js`’s cell callbacks get two mirrored calls into `levelPhysics` when it exists. Whoever merges second takes the other’s file.

**Lane L’s answer (PR #831, 2026-10-10), the interfaces as built, which P0 builds against:** `src/lib/level/collision.js` exports `solidsOf(pack, draws, bin) → { floors, boxes }`, per cell and pure, with boxes over 15 m skipped until the Havok shapes land; the scene side is `src/components/galaxy/surface/level/colliders.js`, which switches a cell’s shapes `off` when the cell goes; `createLevelStream`’s callbacks are `onCell(key, bin, band)` and `onDrop(key)`, wired in `level/index.js`; `level.json`’s `physics` section exists and is empty; the pack format moved off the design’s (`meshes[].lods`, `glb[]` per LOD, a cull per tier, texture sizes), built by `scripts/lib/bf2017-level.mjs`.

As built (PR #831 and lane P0): lane L’s `src/lib/level/collision.js` and `level/colliders.js` stay lane L’s; lane P0 adds `levelPhysics.js` beside `colliders.js` (the same `add`/`drop`), `lib/level/shapeSolids.js` (the walker’s boxes from the shapes, in `collision.js`’s `{ floors, boxes }` form) and the pack’s `physics` section through `scripts/bf2017-physics.mjs`. The joins (`level/index.js`’s `onCell`/`onDrop`, `scene.js`’s engine, `colliders.js` taking the shapes) are in P0’s Left below; whoever merges second makes them.

## For the game (PR #812’s lanes)

`loadPhysics(name)` is lane P0’s `readShapes` over the bucket’s GLB through `readPhysicsGlb` (`scripts/lib/bf2017-physics.mjs`) or, in the browser, over a pack’s `physics/<mesh>.bin`; the hulls and trimeshes are `havok.js`’s `collidersOf`. The soldier’s movement rows are `src/data/bf2017/physics/soldier.json`; the projectiles’ `projectiles.json` and `lib/combat/ballistics.js`’s `flight`; the capsules `boneCapsules.js`; the ragdoll `ragdoll2017.js`; the vehicles `vehicleBody.js`; the surfaces `materials.js`. Build on them; add a row to the Departures in the spec if one does not fit.

## What P0 built (2026-10-10, against #831)

No `collision.js` of its own: lane L’s stays. `levelPhysics.js` sits beside `colliders.js` with `add(key, bin)` / `drop(key)`, reads the 32-byte records with `cells[key].draws` and honours `pack.cull[tier]`; `src/lib/level/shapeSolids.js` gives the walker’s side from the Havok shapes in `collision.js`’s `{ floors, boxes }` form, plus the draws `without` shapes for lane L’s bounds rule; the packer reads `meshes[].name` and fills the empty `physics` section. On a scratch copy of #831’s Hoth pack: 432 meshes, 5.2 MB of bins; the near 3 × 3 at high is 6,160 colliders and 0.47 ms a step, added over 29 frames at under 5 ms each. The `index.js`/`scene.js`/`colliders.js` joins and P2’s `world.physicsRay` are in P0’s Left section for whoever merges second.

## Checking it

- Pure: `npx vitest run src/lib/physics src/lib/combat src/lib/three/ragdoll2017.test.js scripts/lib/bf2017-physics.test.mjs scripts/lib/bf2017-physics-rules.test.mjs scripts/lib/bf2017-materials.test.mjs src/data/bf2017/physics`.
- In a browser: `node scripts/physics-check.mjs hoth` (P1 writes it; P3 and P4 add steps), `node scripts/galaxy-check.mjs surface hoth` under `BUDGET=1` at every tier (the physics row), `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.
- The keys: `SUPABASE_URL` and `SUPA_KEY` (or `BF2017_KEY`) in the environment (the cloud sessions have them; locally `.env.local`, never committed).

## Status

| lane | session | branch | PR | merged |
| --- | --- | --- | --- | --- |
| design | the architecting session | `claude/bf2017-physics` | #817 | |
| P0 | `session_018E4MP2mx7j6iFer89w3nFw` (Opus 5.5, started 2026-10-10 05:22) | `claude/bf2017-p0-shapes` | #834, opened by the design session on the owner’s instruction (the P0 session’s permission check blocked it) | |
| P1 | the P1 session (`session_01NysT4m6BJEr2MtsRWJtgje`, Opus 5.5, the desktop) | `claude/bf2017-p1-body` | #822 | 2026-10-10 |
| P2 | a desktop session (the export read locally) | `claude/bf2017-p2-bolts` | #820 | 2026-10-10 |
| P3 | not started: waits for lane V’s first model and P0 | `claude/bf2017-p3-vehicles` | | |
| P4 | `session_01HTPJgq2Dagy8xghto1YbTV` | `claude/bf2017-p4-surfaces` | #821 | |

Each lane adds its Done and Left here when it merges: the pack’s physics bytes per world, what the budget dropped per cell, the jump row’s source, which material indices were named by hand and from which effect, what the handling layer did not hold.

## P0, the shapes: Done and Left

**Done.**

- `scripts/lib/bf2017-physics.mjs` reads a physics GLB (the node matrices undo the quantisation; the snow pile’s hull lands on its record’s box within 1 cm), cuts a hull to 64 points, and packs a mesh’s shapes into `physics/<mesh>.bin` (`src/lib/physics/shapesBin.js`, pure, shared by the build and the page). `scripts/bf2017-physics.mjs <pack dir>` writes the bins and `level.json`’s `physics` section ({ version, materials, meshes by the pack’s mesh index, cells }); `--map levels/mp/hoth_01 --from <web_opt>` gives the table for a map before there is a pack. Fixtures: four GLBs under 4 KB and a five-mesh pack in `scripts/fixtures/bf2017/physics/`.
- `src/lib/physics/havok.js`: `collidersOf` (the material index as each collider’s `tag`; a hull over 64 points refused), `instanceBody` (a scale put into the points, kept per mesh and scale; a mirrored trimesh’s triangles turned round, tested by a ray’s normal), `cellBodies` (instances of one mesh share its arrays), `budgetCell`, `solidsOf` (the walker’s boxes and circles).
- `src/components/galaxy/surface/level/levelPhysics.js`, beside lane L’s `colliders.js` and in its pattern: `add(key, bin)` (the cell’s own bin, lane L’s 32-byte records, read with `pack.cells[key].draws`) and `drop(key)` (removed, not switched off: a body costs memory), a mesh the tier culls (`pack.cull[tier]`) left out, `update(ms)` putting bodies in a slice a frame, `setTerrain(heightAt)` (a heightfield per 64 m under every loaded cell), `stats()`, a drop from inside a substep deferred by `world.js`, and `wantsEngine` (the one rule: not a phone, not low, a pack with shapes).
- `src/lib/level/shapeSolids.js`: the walker’s side from the shapes, in lane L’s form (`{ floors, boxes }`, plus `circles` and the draws `without` shapes): each hull of each placed piece a box turned by its yaw, a thin wide one a floor at its top. `galaxy-check.mjs` prints a physics row when `__surfaceScene.physics` exists.
- Hoth, measured (`docs/superpowers/evidence/bf2017-physics/p0/hoth.md`), on the map and on lane L’s pack from PR #831 (a scratch copy): 432 of 602 meshes have shapes, 3,539 hulls and 236,905 trimesh triangles, **5.2 MB** of bins; the near 3 × 3 round the spot at high is 1,123 bodies and 6,160 colliders, in over 29 frames at under 5 ms each, 0.47 ms a step. Echo Base’s densest cell is 6,492 pieces and 12,796 shapes: 923 ms to add and 2.1 ms a step unbudgeted; at 1,000 colliders it keeps 97% of its hulls’ volume for 21 ms and 0.15 ms a step.

**What the survey changed (the spec’s Departures 10 to 13).**

- The mesh roots’ user data `0xFFFF00NN` is an index (NN runs 00 to 42 over Hoth), not a visual-only tag: every one of Hoth’s 240 `0xFFFF0000` mesh roots sits beside a convex root over the same piece. Both are kept (statics take both); the budget drops such a trimesh first, as the instance’s detail. `readPhysicsGlb(…, { dropVisual: true })` keeps the first reading for whoever wants it.
- The budget is 400 / 30,000 on mid, **1,000 / 60,000 on high, 2,000 / 100,000 on ultra** (the design said 400 for high and ultra): the table above.
- No `physics/cells/*.bin`: a cell’s draws already name their meshes, so `levelPhysics` reads the cell’s own bin (the map’s layout) and the pack’s `physics.cells` keeps only the counts.
- The 64-point guard is in `havok.js`, not `world.js`: the universe’s hulls come from models uncut and a throw there would be a new failure for them.
- A `convex_flat` leaf (4 on Hoth: the Falcon landmark, a bacta-tank wall) is read as a trimesh; Rapier builds no hull through points in a plane.

**Left.**

- **Done by P1’s follow-up (the joins, 2026-10-10)**: steps 1 to 4 below and P2’s ask; see “P1: the joins” under P1’s section. Kept for the record:
- **When both are on `main`** (lane L’s PR #831 and this; whoever merges second does it):
  1. Run `node scripts/bf2017-physics.mjs public/models/galaxy/bf2017/levels/hoth --from <web_opt>` (or with the keys) to fill `level.json`’s empty `physics` and write `physics/*.bin` (it reads `meshes[].name` and `cells[key].draws`); `bf2017-level.mjs` can call it after the meshes. Then `assets-upload.mjs` as lane L does.
  2. `level/index.js`: `createLevel({ …, physics })` takes the engine (`wantsEngine({ pack, small, tier }) ? await createPhysics({ gravity: -15.5 }) : null`, made in `scene.js` beside `createLevel`); once the pack is in, `const body = physics ? createLevelPhysics({ physics, pack, loadBin: fetchBytes, tier }) : null`; the stream’s `onCell: (key, bin) => { colliders?.add(key, pack, bin); body?.add(key, bin); }` and `onDrop: (key) => { colliders?.drop(key); body?.drop(key); }`; `update()` calls `body?.update(4)`; `dispose()` `body?.dispose()`; `stats()` gains `physics: body?.stats()`. `body.setTerrain((x, z) => LAYERS.image(x, z, layer))` with the layer `levelGround` decoded, so the floor is the ground drawn.
  3. `scene.js` (P1’s seam, on `main` since #822): where `createLevel` is made, the engine goes to the player with `api.usePhysics(physics, { drive: true })` (the body steps the world once a frame) and to the level (step 2’s `createLevelPhysics`); `body.update(4)` each frame from the level’s `update`; `__surfaceScene.physics = () => gameLevel?.stats().physics`. With an engine the walk world keeps lane L’s boxes until the crowds and the crewmate move to the body (P1’s Left): they still walk on `walker.js`.
  4. `colliders.js` without an engine: for the draws whose mesh has shapes, `shapeSolids(draws, bin, shapesByMesh)` (shapes read ahead with `shapeReader(pack, loadBin)`), and lane L’s bounds rule (`solidsOf`) only for `without`; the 15 m skip goes, since a glacier’s hulls are its own.
- The walker’s fallback has no floors from trimeshes (a hangar’s shell isn’t a box): on a phone you walk on the heightmap and stop at hulls. Steep-triangle walls from the trimeshes are a later step if a mesh-only piece matters.
- In the browser on Hoth (`galaxy-check.mjs surface hoth` under `BUDGET=1` with the physics row) waits for lane L’s pack and the scene.js lines.
- Material friction and restitution: `physics.materials` lists each index used (`{ tag }`); P4 fills them and `collidersOf` already takes `materials[i].friction`/`restitution`.
- **P2’s ask** (`world.physicsRay`): with an engine, `scene.js` sets `world.physicsRay = segmentRay(physics)` (P2’s `blast.js`) beside step 3 above, so bolts meet the level’s shapes; a budgeted `queries.ray` replaces it when P1’s library lands.

### P1: the body

**Done.**

- **The library is back** from the closed `claude/wizardly-franklin-ws9uza`, as it was: `character.js`, `queries.js`, `groups.js`, `budget.js`, `zones.js` with their tests, and the branch’s `world.js` (sensors, tags, `onEnter`/`onLeave`, `Body.attach`/`detach`, `tagOf`; main’s `world.js` had not moved since). `hurtbox.js` and `cost.scenario.test.js` (which needs it) are left for P2. `docs/stack/physics-rapier.md` lists the pieces and the controller’s four gotchas.
- **The soldier’s rulebook**: `src/data/bf2017/physics/soldier.json`, the 13 `CharacterPhysicsData` records (`scripts/bf2017-physics-rules.mjs soldier --root <export>`, builder `soldierRow`/`soldierRulebook` in `scripts/lib/bf2017-physics-rules.mjs` beside P2’s, on its shared `loadAsset`/`deref`/`refused`/`checkSources`). 341 KB, a row a line, every number with its `<asset>#<Type>.<path>` source; a lazy chunk of 13.8 KB gzipped, loaded only when a level hands over an engine. `rulebook.test.js` walks every file in the folder (P2, P3, P4 add theirs there).
- **A correction to the spec’s survey**: the soldier walks at **3.8 m/s** (back × 0.8, strafe × 0.9, sprint × 1.57 = 5.97 m/s; crouch 2.5, no sprint), `OnGroundStateData`’s rows. The spec’s 5.0 / 7.5 / 3.0 are `AnimationControlledStateData`’s. **The jump row exists**: `JumpStateData.JumpHeight` 1.1 m for the soldier, 1.6 for Yoda and the Ewok, 0 for the heroes (their jump is an ability’s); a height jumps to it under the site’s 15.5 gravity, a 0 or a missing state (the Pillio creature) takes the walker’s 5.4 m/s as `source: "hand"`. The gains’ unit is not in the data: read as the fraction of the gap closed per 30 Hz frame (−15 is a stop within a substep). All in `NOTES.md`.
- **`src/lib/physics/soldier.js`**: `controllerOptions` (stand half-height 0.55, crouch 0.275, step 0.4 / 0.3, slopes 45, snap 0.8 from `FallWithGravityDistanceFromGround`), `speedFor`, `accelFor`, `poseFor` (the transition times), `slideOn`, `eyeFor`, `jumpSpeed`; tested against the engine (a crouch passes under a 1.3 m beam, a stand does not).
- **`playerBody.js`**: the player on the controller with the soldier’s row; every key `walk()` writes is written back, plus `pose`; anything that writes the state straight (the scene’s teleport, a respawn, a shove) is followed; a rejected engine leaves you on `walk()` with no gap. **Rapier’s autostep never climbs higher than the capsule’s radius** (the soldier’s 0.3 stops at a 0.35 kerb; measured), so the body takes the record’s 0.4 step itself when the controller reports a wall: lift, along, down, measured by two rays from the ground under you to the top past your front, so a 0.5 m edge never ratchets up. Crouch is **Z** (C is block, Ctrl is filtered by the scene’s keys and closes a tab) and the kit’s `crouch` press (no button drawn yet).
- **`scene.js`**: one branch in `stepWalk`, the crouch input, `usePhysics(physics, { drive = true })` on the handle (`__surfaceDo('usePhysics', …)` in dev), the body in `debug()`; and `debug()`’s `lockStagger` no longer throws on a lock with no stagger.
- **Seen in the browser** (`node scripts/physics-check.mjs hoth`, `ANGLE=d3d11`, the desktop’s graphics chip; in software GL Hoth draws one frame in 2.5 s, too few to walk on): on Hoth’s real surface, a course built beside you in the page, all five pass: a 0.5 m wall holds you, a 0.4 m step is climbed, a jump lands on a 0.9 m crate, a 1.3 m beam stops a stand and lets a crouch through. `docs/superpowers/evidence/bf2017-physics/p1/` (the JSON and four shots, the course drawn in orange). No console errors (on the merge with main).

**Left.**

- ~~The call site~~: made (see “P1: the joins” below).
- **The figures on the body** (`bodyFor` for lane 1’s walrus figures and #812’s lane 5); the crewmate still walks on the walker and sinks into what only the engine knows (seen in the step shot).
- **The crouch’s clip** (the legs read `state.pose`; nothing plays a crouch yet) and its HUD button (the kit’s `crouch` press is wired, no button drawn).
- **The sprint ability** (abilityRules’ multiplier) is not applied on the body; the jump penalty (`JumpPenaltyTime` 0.1 × 0.2), the uphill/downhill speed modifiers and the slide state’s gravity scale are in the row and not yet used.
- **The Windows-only test failures** seen on the desktop (`health.test`, `shadingClosure.test`, `bf2017-paths.test`: path separators; `supabase-seed.test`: CRLF; `supabase-check.test`: the desktop’s keys) are as on main; CI is the gate.

### P1: the joins (lane L’s pack, P0’s stream, P1’s body, P2’s ray)

**Done.**

- **Hoth’s pack has its shapes**: `node scripts/bf2017-physics.mjs public/models/galaxy/bf2017/levels/hoth --from <web_opt>` filled `level.json`’s `physics` and wrote `physics/*.bin`: 432 meshes, 3,539 hulls, 236,905 trimesh triangles, 5.2 MB (P0’s numbers exactly), committed with the pack as lane L’s files are.
- **`level/index.js`**: `createLevel({ …, small, heightAt, onPhysics })` makes its own Rapier world when `wantsEngine` says so (not a phone, not low, a pack with shapes; Rapier still a lazy import), streams `createLevelPhysics`’s cells beside lane L’s colliders (cells the stream brought before the engine was up are added once it is), sets the terrain from the scene’s `world.heightAt` (the ground drawn), `update(4)` each frame, `stats().physics`, `physics()` the engine, disposes both.
- **`scene.js`**: `onPhysics` parks the engine until the body’s code has run (it can come during one of `create()`’s awaits), then puts the player on the soldier’s body (`attachPhysics`, the handle’s `usePhysics` the same function) and sets `world.physicsRay` to P2’s `segmentRay`, your own capsule left out; `__surfaceScene.physics()` (galaxy-check’s row) and `engine()` (the QA scripts’ rays) in dev.
- **`blaster.js`** reads `world.physicsRay` at each shot, not at its making (the engine comes after the blaster).
- **`colliders.js`** (the walker’s walls, on every device): with the pack’s shapes and a loader, a cell’s pieces stop you at their hulls (`shapeSolids`), lane L’s bounds only for the pieces without shapes; that add is a promise, and a cell dropped while it reads comes in off.
- **`playerBody.js`**: a fall out of the engine’s world (past the streamed cells) is caught: falling faster than 10 m/s and 2 m under the walker’s ground, you’re set on it. A tunnel under a ridge, walked, never trips it.
- **`vite.config.js`**: `optimizeDeps.entries: ['index.html']`. The dev server’s dependency scan read the tool pages under `scripts/` and `.claude/` (`scripts/twin-parity` imports an `@src` alias), failed, and left `react-dom` bundled twice: the page was blank in dev.
- **Seen on Hoth’s own engine** (`node scripts/physics-check.mjs hoth`, `ANGLE=d3d11`, `source: level`): walking 12 m of snow the feet stay within 1 cm of the ground drawn; the nearest upright face rays find (a ridge’s rock) stops you 0.46 m short of it; 22 cells, 1,717 bodies, 10,853 colliders, 88 heightfields, the budget dropping Echo Base’s detail first. `docs/superpowers/evidence/bf2017-physics/p1/hoth-level.json` and two shots.

**Left.** The hangar’s own spots in the check (its ramp, a crate, a beam by name; `--spot`); the crowds and the crewmate on the body (they walk on `walker.js`, now over the hulls’ boxes); `world.physicsRay` as P1’s budgeted `queries.ray`; the frame cost of the stream at every tier under `galaxy-check.mjs surface hoth` with `BUDGET=1`.

### Lane P2: bolts, blasts, hit zones, ragdolls (2026-10-10)

**Done.**
- `scripts/lib/bf2017-physics-rules.mjs` (created here, P1 not yet on `main`: P1 merges its soldier builder in beside these and keeps the file’s `loadAsset`/`deref`/`checkSources`, or swaps all of them for lane 0’s `bf2017-ebx.mjs`): `projectileRow`, `projectileRulebook`, `boneSetRow`, `ragdollRow`, `shareBodies`, `physicsRulebooks`, `refused`; its tests are `bf2017-physics-rules.bolts.test.mjs` so P1’s `bf2017-physics-rules.test.mjs` does not collide. `scripts/bf2017-bolts-data.mjs --root <export>/web` writes the three files.
- `src/data/bf2017/physics/projectiles.json` (333 rows: the 114 blueprints less 14 refused, and 233 bolts, which are `WSBulletEntityData` containers, not blueprints; 397 KB, imported by no page), `bones.json` (10 sets, 112 KB; the surface fetches it as its own 3.9 KB-gzip chunk the first time a figure on the game’s skeleton is in the way), `ragdoll.json` (48 rows, 144 KB: 39 heroes share the human’s bodies through `bodiesOf`); `NOTES.md` says what the records hold and do not (grenades have no `RigidBodyData`; two components give one body to two bones).
- `src/lib/combat/ballistics.js`: `flight` (the exact solution of `dv/dt = g − k·v`, so a flight lands within millimetres at 1/30 and 1/120; with no gravity and no drag the same positions as `bolt.js` to 1e-9), `launch`, `arc`. `bolt.js` takes an optional `ballistic` row (its own tests untouched and green).
- `src/lib/physics/blast.js`: `applyBlast` (falloff from `inner` to `radius`, the line of sight on the world’s ray, the shockwave’s kick to ragdolls) and `segmentRay(physics)`, a segment ray in `bolt.js`’s solids form over any `world.js` world.
- `src/lib/physics/boneCapsules.js` (`capsulesOf`, `regionsOf`, `figureCapsules`, `isGameSkeleton`, `regionOf`) and `hurtbox.js` back from #781’s branch as it was (its engine tests need P1’s `character.js`; the test here uses a stand-in body until then).
- `src/lib/three/ragdoll2017.js`: `rig2017` over `ragdollPhysics.js` (which gained an optional `table`, Meshy’s by default), the impulse allowance (`maxImpulse` spent and restored over `impulseLifetime`), `ragdollOf`, `floorCollide`.
- The surface: `blaster.js` flies against `world.physicsRay` when a world has one (P0’s level world sets it; `segmentRay` is one) and takes a `ballistic` row for your bolts; `boltPlay.js` hits a figure on the game’s skeleton by the game’s capsules and names the bone and the reaction on the hit.

**Left.**
- P0: set `world.physicsRay` (a budgeted `queries.ray` in `bolt.js`’s solids form) on a level world; `blaster.js` picks it up.
- Lane 1: its figures through `boltPlay.js` (automatic once `fig.bones` carries `Head`, `Spine`, `Spine1`/`Neck`) and `rig2017` where the surface makes a ragdoll today (`ground/groundFigures.js`: `rig2017(bones, ragdollOf(book, 'stormtroopershared'), …)` for a figure on the game’s skeleton, `rigRagdoll` otherwise; a blast’s `kicked` list wants `rag.kick`).
- No surface page passes a row yet: the rifle’s (`blasterprojectile_blasterrifle_a295`: gravity 0, drag 0, ttl 3) would fly exactly as today, so the first row that shows is a thrown grenade, which wants a throw (the game’s grenade `InitialSpeed` is a placeholder 350; the throw is the weapon’s) and a body (the world’s mass: the record has none).
- The Battlefront game (#812’s lane 5): `flight` for its sim’s projectiles, `applyBlast` for grenades, `capsulesOf` for hits, `rig2017` for the dead.

### P4: surfaces (2026-10-10)

**Done.** `scripts/lib/bf2017-materials.mjs` reads a level’s `MaterialGridData` (a tag is a row through `MaterialIndexMap`; a pair is the striker’s row of `InteractionGrid`, else its transpose) into `src/data/bf2017/physics/materials.json`, built by `scripts/bf2017-materials.mjs` from Hoth’s grid and the 17 material indices Hoth’s meshes declare in `web/physics.jsonl`: 17 materials, 156 pairs, 95 KB, every number with its `_source`; the fixture is a 22.5 KB cut of the grid (`scripts/fixtures/bf2017/data/hoth_materialgrid.cut.json`). `src/lib/physics/materials.js` answers `materialOf`, `impactOf` (the pair, else the default’s pair, else `generic`; the speed band that holds the speed), `footprintOf`, `frictionOf`, `familyOf`, `tagOf`, `loadMaterials`. On the surface, `solids.js` says what a bolt struck (`surface: { ground } | { solid, tag }`), `bolt.js` carries it on the `solid` event, and `scene.js` picks the landing’s look by `impactOf` through `impactLook.js` (snow puffs of dust, metal a spray of sparks, rock chips and a wisp, sand a kick, wood smoke, the old sparks and burn elsewhere) and the footprint’s dab by `footprintOf`. `scripts/surfaces-check.mjs hoth` fires at the snow and at an Echo Base box: snow → `FX_Impact_Blaster_Snow`, the box (a snowspeeder’s hull) → `FX_Impact_Blaster_Metal` (`docs/superpowers/evidence/bf2017-physics/p4/`).

**What the data said.** Material names are not in the grid; the `name` column is by hand from the blaster’s effect on each surface, the strikers (`by`) from their pairs’ effects (blaster 5, heavy 37, strong 119, ion 146, fast 197, bowcaster 202, thermal detonator 145, impact grenade 149, saber throw 126, the soldier’s foot 3, a walker’s foot 82); `src/data/bf2017/physics/NOTES.md` lists them. Index 14 (the survey’s most used after 0) is **metal**, not snow: snow is 28 and 29, and only 28 prints (`FX_FootStep_Soldier_Snow_Decal_01`). Every effect pair on Hoth has one band, 0 to 10,000 m/s: a grenade differs from a bolt by its material (149 against 5), not its speed. Four materials carry physics properties, and of Hoth’s shapes only 141 (restitution 1).

**Left.** Lane P0’s numeric collider tags replace Hoth’s walker stand-in (`sites/ice.js`’s `materials`: ground 28, a box 14, a circle 91) once a level pack loads; `tagOf` already prefers a numeric `tag`. The terrain’s own material per layer (the README’s layer masks) for the ground’s tag. P1’s `physics-check.mjs` takes in `surfaces-check.mjs`’s two shots. The other levels’ grids as their worlds land (`--level <name>` appends to the same file). P2’s `projectiles.json` confirming the strikers’ material indices, and a grenade’s landing (`by: 'thermal'`) when grenades fly. The game’s own effect blueprints (sound and decal names are in the rulebook, unused) when lane F ships them.
