# Research: collision (the Battlefront world's follow-up, 2026-10-10)

# Collision with buildings for the Battlefront world: research report

All of this was read-only. Nothing tracked was edited (`git status` is clean). The fetches went into `lab/`: `lab/assets/bf2017/web/physics.jsonl` (18.3 MB) and 432 physics GLBs (6.0 MB) under `lab/assets/bf2017/web/physics/`. The experiments ran from the scratchpad, `/tmp/claude-0/-home-user-new-portfolio-website/6e998b99-030e-5906-90ac-5cbe2b0cc2ff/scratchpad/exp/`, against a copy of the pack in `scratchpad/hoth/`.

**Main finding:** feeding `shapeSolids`' boxes straight into `buildNav`, as the computed task proposed, breaks Hoth's navigation. Paths from the spawns to the objective volumes drop from 22 of 22 to 5 of 22 for team 2 and 0 of 22 for team 1. The fix that measured clean is a blocked mask built offline by asking Rapier whether a soldier's capsule fits at each cell. That gives 22 of 22 for both teams. The design already plans for this as `nav.bin` (spec decision 15; lane 5 plan lines 67–74).

## 1. What the game files hold

### `web/physics.jsonl` in the bucket
- 18,272,085 bytes, 10,530 records, all with `status: "ok"`.
- Fields: `name`, `res`, `resBytes`, `havok` (`hk_2013.3.0-r1`), `partCount`, `materials[{slot, packed, index, flags}]`, `roots[{index, class, leaves, triangles, kinds, min, max}]`, `shapeClasses`, `leaves`, `uniqueShapes`, `triangles`, `vertices`, `min`, `max`, `partsWithShapes`, `materialSlotsUsed`, `maxConvexRadius`, `parts`, `partBoxCheck`, `glb`, `meshKeyCountMismatch`.
- A record's key is `res`. `scripts/lib/bf2017-physics.mjs:258` `physicsKey(modelFile)` maps a pack mesh's `name` to it.

### Hoth's 432 meshes that have shapes
- Raw Havok resources total 13,523,568 bytes (sum of `resBytes`).
- Shape classes: `hknpConvexPolytopeShape` 3,539, `hknpCompressedMeshShape` 431, `hknpConvexShape` 4, `hknpSphereShape` 23, `hknpCapsuleShape` 3, `hknpTriangleShape` 2.
- Material `flags` seen include `0x00000800` (515), `0x21000800` (338), `0x08800800` (292) and others. What the flags mean is not in the data.
- Example, `Objects/Nature/Arctic/_ArcticBase/ArcticBase_RockWall_Large_03/ArcticBase_RockWall_Large_03_Physics_Win32`:
  - `resBytes` 93,052; `leaves` 31; `shapeClasses` {ConvexPolytope 30, CompressedMesh 1}.
  - `min` [-20.3, -0.9, -10.79], `max` [18.66, 9.94, 3.94].
  - Materials indices 91 / 28 / 0, with flags `0x08800800` / `0x21000800` / `0x00000800`.
  - GLB at `physics/Objects/Nature/Arctic/_ArcticBase/ArcticBase_RockWall_Large_03/ArcticBase_RockWall_Large_03_Physics_Win32.glb`.

### Running the packer on the committed Hoth pack
- `public/models/galaxy/bf2017/levels/hoth/level.json` currently has `"physics": {}`, i.e. empty.
- Dry run: `NODE_USE_ENV_PROXY=1 node scripts/bf2017-physics.mjs public/models/galaxy/bf2017/levels/hoth --dry` took 92 s cold. With the GLBs now cached in `lab/`, later runs are fast.
- Result: 432 meshes with shapes, 3,539 hulls, 236,905 mesh triangles, 3 capsules, 23 spheres, 0 dropped, 5,249,252 bytes. This matches the handoff's 5.2 MB.
- Heaviest cells (colliders / triangles): `-3,0` 2,019 / 51,276; `-1,2` 1,832; `-1,1` 1,828.
- The real write on a scratch copy produced:
  - 432 files in `physics/` (6.2 MB on disk).
  - A `physics` section `{ cells (153), materials (17 indices: 0, 14, 15, 16, 17, 18, 19, 21, 28, 29, 45, 66, 91, 107, 141, 144, 208, each {tag}), meshes (432, keyed by mesh index, e.g. "1": {file: "physics/droidgonk_01.bin", hulls 1, meshTriangles 383, colliders 2, …}), version: 1 }`.

**The frame is right as it is.** The bins sit in each mesh's own frame, and `physics.cells` uses the pack's cell keys, which is exactly what `levelPhysics` reads. So no map-frame rebuild is needed. The pack's `origin` is [205, 362.296875, -1540] and its `yaw` is 0, so export = pack + origin. Bodies built from the cell bins are in the pack frame, and queries have to be converted.

**One format problem.** `scripts/bf2017-physics.mjs:185` writes `JSON.stringify(sorted(pack), null, 1)`. That grows `level.json` from 273,044 to 707,689 bytes. Written compactly it would be 448,105 bytes (the physics section itself is 175,064: meshes 139,813, cells 34,927). The sort also moves `ground` from last place.

### Records for the camera and the soldier (exact values)
From `Gameplay/Characters/StormTrooperShared`, fetched to `lab/assets/bf2017/data/Gameplay/Characters/StormTrooperShared.json.gz`:
- `SoldierThirdPersonCameraData`: `CollisionWidthPadding` 0.17, `CollisionBlendIn` 5, `CollisionBlendOut` 3, `MaxReducedArmLength` 0.5, `ReduceMinPitch` 5, `ReduceMaxPitch` 70, `MaxPitch` 55, `OcclusionRayOffset` {0, 0, 0}.
- `SoldierCameraComponentData`: `ThirdPersonCameraArmLength` 1.2, `CameraCullSphereRadius` 0.15.

From `src/data/bf2017/physics/soldier.json` (`DefaultSoldierPhysics`):
- `radius` 0.3 (`CharacterPhysicsData.PhysicalRadius`).
- Stand `height` 1.7 (`Poses[0].Height`), stand `step` 0.4 (`Poses[0].StepHeight`); crouch height 1.15, crouch step 0.3.

From `src/data/bf2017/ai.json` (`AI/BattleAI/Cover/CoverConstants#CoverConstantData`):
- `SlotSpacing` 2.2, `CrouchHeight` 0.94, `StandHeight` 1.7, `CrouchCoverOcclusionSettings.OcclusionCheckDist` 0.7, `TerrainHeightSamplingStep` 0.25, `MaxStepHeightOverride` 0.35.

## 2. What the repo already has to reuse

**`src/components/battlefront/module.js`**
- `:32-33` `ARM_STEP` 0.2 and `ARM_CLEAR` 0.25 (hand values).
- `:84-92` `castArm(from, dir, len)` marches only `level.heightAt`.
- `:61` `createBattle({ …, heightAt })`.
- `:165` `soldierPose(…, { castArm })`.
- `:166` and `:170` `level.update(at)`.
- `:224` `level.dispose()`.

**`src/components/battlefront/camera.js:54`** computes `target = min(want, hit - s.collision.padding)`, so the padding (0.17) is subtracted from whatever `castArm` returns.

**`src/components/battlefront/map/level.js`**
- `:23` `toPack(pack, [x, , z]) → [px, pz]`.
- `:59` `fetchBytes`.
- `:70` `createLevelStream({ …, onCell: () => {}, onDrop: () => {} })`: both callbacks are stubs today.
- `:95` `heightAt`.
- The group sits at `pack.origin` with rotation `-yaw`.

**`src/components/battlefront/battle.js`**
- `:59` `createBattle({ rulebook, level, mode, heightAt, bots, seed, cell = NAV_CELL, nav = null })`.
- `:63` `buildNav({ heightAt, bounds, cell, cover })`, currently with no solids.

**`src/lib/battlefront/nav.js`** (500 lines)
- `:44` `buildNav({ heightAt, bounds, cell = 2, solids = [], maxSlope = 0.9, cover = {}, radius = 0.3 })`.
  - The solid format is `{ at: [x, y, z], half: [hx, hy, hz], yaw }`, with local coordinates `lx = dx·c − dz·s`, `lz = dx·s + dz·c` (the same yaw convention as `havok.solidsOf` and lane L's `colliderOf`).
  - A cell is solid when the footprint grown by cell/2 touches it and `bottom <= h + 0.5`. **There is no top test**, so buried boxes block.
- `:146` `walkable`, which uses the exact box test `inSolid`.
- `:310` `findPath`, which string-pulls with `gridClear`.
- `:405` `firstSolid(nav, a, b)`, the box slab test used for bolts and line of sight.
- `findSlots` puts slots on box faces.
- Nobody reads nav internals outside `nav.js`, so additive options are safe.

**`src/lib/battlefront/soldier.js:147`** `move(s, dir, dt, nav)` steps only where `walkable(nav)` allows. The player and the bots are both sim soldiers, so the nav alone stops them. `sim.js:144` deploys via `nearestMainland`/`nearestWalkable`. `bolts.js:47` uses `firstSolid`.

**`src/components/galaxy/surface/level/levelPhysics.js`**
- `wantsEngine({ pack, small, tier })`.
- `createLevelPhysics({ physics, pack, loadBin, tier, budget, cellSize, terrainCell })` → `{ add(key, bin), drop(key), update(ms), setTerrain, stats(), dispose() }`.
- `instancesOf(draws, bin)`.
- `BUDGETS`: mid 400 / 30k, high 1,000 / 60k, ultra 2,000 / 100k.
- It works in the pack frame.

**`src/lib/physics/havok.js`**: `readShapes`, `collidersOf(shapes, { statics, materials })`, `instanceBody`, `cellBodies(instances, collidersByMesh)`, `budgetCell`, `solidsOf(shapes, inst) → [{ type: 'box', x, z, hw, hd, yaw, top, base } | { type: 'circle', … }]`.

**`src/lib/level/shapeSolids.js`**: `shapeSolids(draws, bin, shapesByMesh) → { floors, boxes, circles, without }` and `shapeReader(pack, loadBin)`. Note that this file in `src/lib` already imports from `components`, which breaks the layer rule. Don't build on that.

**`src/lib/physics/world.js:198`** `createPhysics({ gravity, … })` → `{ RAPIER, world, step, add, remove, … }`, plus `preload()`.
- Its `:84` `import { GROUPS } from './groups'` has no `.js`, so plain Node can't import `world.js`. Vitest can.

**`src/lib/physics/queries.js`**: `createQueries(phys).ray(from, dir, max)` and `.sweep({ shape: 'ball', args: [r] }, from, to)`, both budgeted.

**`src/lib/physics/blast.js`**: `segmentRay(physics)`.

**`src/components/galaxy/shared/level.js`** is the only way the Battlefront world may import galaxy code. It doesn't export `levelPhysics` yet. `shared.test.js:15` pins the exported names.

**Reading files:**
- `src/lib/level/png16.js`: `decodePng16` and its `DecompressionStream('deflate')` inflate, reusable for a deflated `nav.bin`.
- `src/lib/land/layers.js`: `imageLayerFrom` and `LAYERS.image`.

**Fixtures:** `scripts/fixtures/bf2017/physics/pack/` has 5 meshes. Instances: cell `0,0` has snow piles at (10, 0, 10), (20, 0, 10) and a mirrored one at (30, 0, 10); cell `1,0` has mesh 3 at (140, 0, 10); cell `-1,0` has the beam at (-60, 0, 10) at scale 2. `levelPhysics.test.js` shows how to load them.

## 3. Measurements on Hoth

The grid is `map.bounds` (-1015.08 … 905.04 × -2455.34 … -464.24) at 2 m: 961 × 996 cells. The test is the 219 Galactic Assault spawns plus paths from one enabled spawn per team to all 22 GA volumes.

| nav source | solid cells | spawns not walkable | paths t2 / t1 | build time |
|---|---|---|---|---|
| ground only (today) | 0 | 8 | 22 / 22 | 249 ms |
| `shapeSolids` boxes, raw (47,051 boxes, 1 circle, 946 floors) | 164,497 | 83 | 4 / 22 (one spawn only) | 1,217 ms (plus 604 ms for `shapeSolids`) |
| boxes plus a top ≥ ground + 0.4 rule | 127,731 | 35 | 5 / 0 | 1,110 ms |
| boxes plus the top rule, half-extent ≤ 15 or ≤ 30 | 116k–120k | 34–35 | 5 / 0 | about 1 s |
| boxes from a merged Rapier mask, 1 m / 0.5 m | 74k / 83k | 13 / 15 | 21 / 20 | 0.8 / 1.5 s; 0.77 / 2.0 MB deflated |
| **Rapier capsule mask, r 0.3** | 57,278 | 16 | **22 / 22** | 4.1 s offline |
| **Rapier capsule mask, r 0.6** | 62,012 | 16 | **22 / 22** | 4.8 s offline |
| Rapier capsule mask, r 1.0 | 82,660 | 60 | 3 / 11 | 3.1 s |

Why the boxes fail:
- 12,968 of the 47,052 solids have their top under the ground, and `nav.js` has no top test, so they still block.
- The rock walls dominate. `rockwall_large_03` alone covers 390,734 m² of box area; `_05` 321k; `_01` 245k. Each convex hull boxed by the instance's yaw covers the trench floors.
- Images of the result are in the scratchpad: `exp/nav_solids.png` and `exp/nav_none.png`.

**The capsule mask.** A cell is blocked if Rapier's `intersectionWithShape` finds a shape meeting a capsule at the cell centre. The capsule spans ground + 0.4 (StepHeight) to ground + 1.7 (Height), with r 0.3 (PhysicalRadius).
- Loading the whole level into Rapier takes 11–16 s in Node: 5,728 bodies, 51,143 colliders.
- With hulls only, a 2 m mask blocks 56,944 cells. The coarse bitset is 119,645 bytes raw and 21,827 deflated.
- A 0.5 m fine mask over the whole grid (3,841 × 3,983) takes 49 s, blocks 913,913 cells, and is 1,912,338 bytes raw / 155,704 deflated.
- Obstacle tops above ground (a down ray from ground + 60 m): p10 0.49 m, median 1.58, p90 5.52, max 57.4.

**At runtime** (Node, `createLevelPhysics` on the near band, which is always 3 × 3 since `nearRing` = ceil(70/128) = 1):
- Team-1 spawn, high tier: 1,943 bodies, 8,934 colliders, 26,226 triangles; 145 frames of `update(4)`, the worst frame 15.7 ms; the first `world.step()` 95 ms.
- Same spawn, mid tier: 533 bodies, 3,600 colliders; worst frame 20.9 ms; first step 52 ms.
- The team-2 spawn is at the pack's edge, with 1 cell and 62 colliders.
- A ball sweep of r 0.17 costs 5–9 µs; 1,000 rays cost 3.8 ms.

## 4. Implementation plan

### Data
1. Change `scripts/bf2017-physics.mjs:185` to write compactly: `JSON.stringify(sorted(pack)) + '\n'`.
2. Run `NODE_USE_ENV_PROXY=1 node scripts/bf2017-physics.mjs public/models/galaxy/bf2017/levels/hoth`. This uses the GLBs already cached in `lab/`. It fills `level.json`'s `physics` section, adds `physics/*.bin` (432 files, 5,249,252 bytes) and the README block.
3. Change `src/lib/physics/world.js:84` to `'./groups.js'` so a Node script can use `createPhysics`.

### Pure mask module, new: `src/lib/battlefront/navMask.js`
- `buildMask({ bounds, cell = 2, fine = 0.5, heightAt, blockedAt(x, y, z) → bool, topAt(x, z, ground) → m, fineNear = 1 }) → { version, cell, cols, rows, origin, blocked: Uint8Array, top: Uint8Array /* decimetres, 0 = open */, fine: { cell, cols, rows, bits: Uint8Array } }`.
  - Only fine cells inside or next to blocked coarse cells are sampled, which cuts the 15.3M queries to about 2M.
- `encodeMask(mask) → Uint8Array` and `decodeMask(bytes) → mask`.
  - Header: magic `BFNV`, version, cell, fine, cols, rows, origin x/z, the capsule's (step, height, radius) with their sources.
  - Deflate is done by the caller: `node:zlib` in the script, `DecompressionStream` on the page, the same way as `png16.js`.
- `fineBlocked(mask, x, z) → bool`.

### Builder, new: `scripts/lib/bf2017-nav.mjs` and `scripts/bf2017-nav.mjs <pack dir> --map hoth [--radius 0.3] [--fine 0.5]`
- Read `level.json`, the cell bins (`instancesOf`), `physics/*.bin` (`readShapes` → `collidersOf` → `cellBodies`), and the terrain PNGs (`decodePng16` plus `imageLayerFrom`).
- Shift each body by `fromPack(pack, p)` into the export frame. For Hoth this means `position += origin`; a non-zero yaw should be refused or rotated.
- Use `createPhysics` to answer `blockedAt` (a capsule from the soldier.json rows) and `topAt` (a down ray from ground + 4 m, hand cap).
- Bounds come from `src/data/bf2017/maps/hoth.json` `rows.bounds`, read as JSON, not through the rulebook (whose JSON imports fail in plain Node).
- Write `public/models/galaxy/bf2017/levels/hoth/nav.bin`. Estimated about 200 KB: 22 KB coarse, about 156 KB fine, plus tops (not measured).
- Print the table above.

### Changes to `src/lib/battlefront/nav.js` (lane 1, additive)
- `buildNav({ …, mask = null })`: `solid[i] |= mask.blocked[i]` when the grids match. Keep the boxes, and add the missing top test `b.top >= height[i] + STEP` (0.4, `CharacterPhysicsData.Poses[0].StepHeight`) at `:72` and in `inSolid`.
- `walkable`: also refuse when `fineBlocked(nav.mask, x, z)`.
- `firstSolid`: at each sample, a mask cell hits when `y < height[i] + top[i]/10`. Return `solid: -2`.
- `findSlots`: add a slot on each open cell next to a blocked one where `top − ground ≥ CrouchHeight` 0.94, set back by `OcclusionCheckDist` 0.7. It is `stand` when the top is at or above `StandHeight` 1.7.

### `battle.js`
`createBattle({ …, mask })` → `buildNav({ …, mask })`. If the header's bounds differ from `map.bounds`, warn and fall back to ground only.

### `map/level.js`
- New options `createLevel({ …, onCell, onDrop })`, forwarded to the stream at `:70`.
- Expose `pack` (a getter) and `loadBin: fetchBytes`.
- Add `navOf: () => fetchBytes('nav.bin').then(inflate).then(decodeMask).catch(() => null)`, which `deps` can override.

### Level collision, new: `src/components/battlefront/map/collision.js`
- `createLevelCollision({ pack, loadBin, tier, physics }) → { add(key, bin, band), drop(key), update(ms = 4), sweep(from, dir, len, r) → dist | null, stats(), dispose() }`.
  - `add` passes on only when `band === 'near'` and drops when a cell leaves near.
  - After `update` adds bodies, run one `physics.world.step()`, otherwise rays can't see the new bodies.
  - `sweep` converts export → pack with `toPack3(pack, p)` (`[toPack…, y − origin[1]]`) and turns the direction by the yaw.
- `armCaster({ heightAt, collision, nav, clear = ARM_CLEAR, step = ARM_STEP }) → castArm`: the lower of the ground march and `collision.sweep(…, CameraCullSphereRadius 0.15)`, falling back to `firstSolid(nav, …)` when there is no engine.
- Export `createLevelPhysics` and `wantsEngine` from `galaxy/shared/level.js` and add them to `shared.test.js` FACE.

### `module.js`
1. `const mask = await level.navOf()`, then `createBattle({ …, mask })`.
2. `if (wantsEngine({ pack: level.pack, tier }))`: `const { createPhysics, preload } = await import('../../lib/physics/world.js')`, `await preload()` during the load to absorb the 50–107 ms first step, `physics = await createPhysics({ gravity: -15.5 })`, then create the collision.
3. Pass `onCell: (k, b, band) => collision?.add(k, b, band)` and `onDrop`.
4. `castArm = armCaster({ … })`.
5. Each step: `collision?.update(4)`. `snapshot().level.physics = collision?.stats()`. Dispose both.

### Tests to write first
- **`src/lib/battlefront/navMask.test.js`**: a fake 4 × 4 m `blockedAt` gives exactly the right coarse cells, tops and fine bits; encode/decode round-trips; a version mismatch is refused.
- **`nav.test.js` additions**:
  - A box buried under the ground no longer blocks.
  - A mask wall makes `findPath` detour.
  - `walkable` is false on a fine-blocked spot inside an open coarse cell.
  - `firstSolid` stops below a mask cell's top and passes above it.
  - A crouch slot appears on a mask edge 0.94 m high.
- **`scripts/lib/bf2017-nav.test.mjs`** on P0's fixture pack with flat ground:
  - The cell at (10, 10) is blocked, because the 0.9 m pile is above the 0.4 m step; the cell at (10, 30) is open.
  - With an origin of [100, 0, 0], the block moves to (110, 10).
  - Two runs give identical bytes.
- **`map/collision.test.js`**:
  - With `createPhysics` plus the fixture: `add('0,0', bin, 'near')`, then `update(Infinity)`, then a sweep in the export frame (origin offset applied) hits the pile.
  - A `'mid'` band is ignored; `drop` clears it; yaw π/2 converts correctly.
  - `armCaster` takes the lower of ground and shape, and uses the nav with no engine.
- **`battle.test.js`**: with a mask wall in front, a player stepping forward stops.
- **`level.test.js`**: `onCell` is forwarded, and `navOf` uses `deps`.

## 5. Risks and gaps
- Raw box solids are not viable for the nav (table above). The mask needs the additive `nav.js` changes in lane 1's file, which stays under 800 lines.
- Coarse r 1.0 closes the trenches. The mask radius should be 0.3 (from the data) or 0.6 (hand); both measured 22 / 22. Walls thinner than about 1.4 m can slip between 2 m cell centres, which the 0.5 m fine mask covers. The fine resolution is a hand value: the game's own `TerrainHeightSamplingStep` is 0.25.
- There are no shapes beyond the pack's ±1024 m arena (x < -819, the west strip of the map's bounds). The 14,535 Echo Base interior instances under the glacier were left out of the pack.
- Runtime hitches: the first Rapier step takes 50–107 ms, so use `preload`. One `update(4)` call can take 10–21 ms because of a large trimesh body. Start the engine before deploy.
- The mask tops come from a down ray capped at 4 m (hand). A cell under an arch reads as blocked up to the cap for line of sight. The Rapier camera sweep is exact in 3D.
- `nav.bin` depends on the terrain PNGs and must be rebuilt if they change. Put their byte sizes in the header.
- Mask-edge cover slots are hand placement: the game's `CoverZones` and occlusion voxelisation are not exported. Bot balance (lane 2's tables) was measured on `hothFlat` and will shift on the real nav.
- Not found:
  - The game's navmesh (`PathfindingBlobAsset` is opaque, as the spec says).
  - What the material `flags` bits mean (for example, which shapes the camera should ignore).
  - Any camera collision radius in the records beyond `CollisionWidthPadding` 0.17 and `CameraCullSphereRadius` 0.15. Reading 0.15 as the sweep radius is hand.
- Rewriting `level.json` reorders its keys, and P0's indent-1 writer nearly triples the file. Fix line 185 before running.
