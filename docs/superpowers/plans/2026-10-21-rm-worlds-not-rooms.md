# Rick and Morty: worlds, not rooms — the plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every dial destination and map planet box reads as a place in a world: an edge that belongs to it, buildings and a skyline beyond it, a forecourt for the first frame, an instanced crowd from the existing cast and traffic overhead. A room that's a room by story gets real openings onto a world outside.

**Architecture:** One record a place (`dimensions/worlds.js`) is laid out by a pure planner (`outskirts.js`, `crowdPose.js`) and drawn by shared code (`lots.js`, `crowd.js`, `surround.js`) that `stage()` calls before the room kit builds. A place's games, people, hotspots and coordinates don't move. New solids come only from a tiny pure `blocks.js` that `destinations.js` merges.

**Tech Stack:** React 19, three.js r186 (`InstancedMesh`, `SkinnedMesh.applyBoneTransform`), Vitest (node), Playwright-core on SwiftShader.

**Spec:** `docs/superpowers/specs/2026-10-21-rm-worlds-not-rooms-design.md`. Research and critics are in the session's scratchpad `worlds/` (`map-*.md`, `crit-*.md`).

## Global Constraints

- **Models:** no new model files, and no model file touched.
  - Figures and props come from models.
  - A building is drawn in code only where no model of its kind exists.
  - Named landmarks stay unique.
  - A set piece is repeated at most twice a place, at least 40 m apart.
  - No family vehicle as traffic.
- **The crowd:** no line, no shadow, a fresh toon material (never the cast's).
  - Inside a box, no hunter's, lookout's or named person's kind. Those kinds stand only behind glass or beyond the edge (7 m; 30 m for a named person's kind).
- **Fixed:** every place's centre, kind, box, way in, portal home, people, hotspots and existing solids.
- **No new:** shader material, `onBeforeCompile` site, light, `requestAnimationFrame`, renderer, `eslint-disable`, JSON over 64 KB, or import of `lib/three/core`, `lib/cc0`, `galaxy/surface` or `rickmorty/planets/props`.
- **File size:** no file past 800 lines grows except `scene.js`, by its two wiring lines. `RmWorld.jsx` is not touched.
- **Budgets by `kit.fit.tier`:**
  - crowd triangles 360k / 200k / 80k;
  - crowd kinds 6 / 4 / 3;
  - extra set copies 4 / 2 / 0;
  - traffic 3 / 2 / 1;
  - lots 40+34 / 30+24 / 20+14.

  Rooms get half the crowd and traffic. A low room's outside is lots and skyline only.
- **Edges:** solid ≤ 0.9 m, see-through ≤ 1.4 m. Blocks ≤ 1.2 m and axis-aligned.
- **Copy:** British, curly quotes, no `!`.

## Review Focus

1. **A place whose crowd kind is its hunter's or a named person's kind**, inside the box: the player can't tell a threat or a talker. Pinned in Task 9's `worlds.test.js` rule, run over every record.
2. **A block that covers a warp spot the story check uses** (0.8–1.7 m off a hotspot's centre) or a hunter's patrol: `use()` or `caught()` fails, or the patrol stalls. Pinned in Task 4 (`blockProblems`) and Task 9.
3. **A load that fails or a builder that throws** inside `surround`: the place must still build with its people and games. Pinned in Task 8 (`surround.test.js`) and in the try/catch.
4. **A room's outside casting shadows into the room, or its fog fogging the room**: pinned in Task 8 (no caster outside a room; fog near > the room's diagonal).
5. **Low tier, where the checks run**: the ready wait and the frame stay inside budget. Pinned by Task 10's `INFO=1` readout and the `TRIS` sum test (Task 9).

---

### Task 1: The moves that change no pixel

**Files:**
- Create `src/components/rickmorty/portal/crowdPaint.js` and its test. It takes `BREATH`, `breathing` and `standing` out of `citadel/crowd.js`, which re-exports them.
- Create `src/components/rickmorty/world/models.js` and its test. It takes `partsOf`, `instanced` and `stoodOn` out of `world/town/scene.js`, which imports them.

**Interfaces:**
- `standing(geometry, matrix, height) → BufferGeometry`, as today.
- `breathing(mat, clock, tall) → mat`, as today.
- `partsOf(root, { node = null, tall, paint = true }) → [{ geometry, material, local }] | null`, the town's call unchanged. `paint: false` keeps the materials, for cast props that are already painted.
- `instanced(parts, list, { shadows }) → InstancedMesh[]`, as the town's. Each list item is `{ x, z, turn, s, y? }`.
- `stoodOn(model, { x, z, y, h, turn }) → Group`.

**Steps:**
- [ ] **Shoot first:** shots before (street, gotron, lawn, and the Citadel's concourse and rally via `scripts/citadel-shots.mjs`).
- [ ] **Write the tests:**
  - `crowdPaint.test.js`: `standing` puts the feet on 0, centred, at the height; `breathing`'s key is `crowd-breath`.
  - `world/models.test.js`, on a group of two boxes:
    - `partsOf` with `paint: false` keeps the material;
    - `instanced` places each instance;
    - `stoodOn` scales to `h`.
- [ ] **Run:** `npx vitest run src/components/rickmorty/portal/crowdPaint.test.js src/components/rickmorty/world/models.test.js`. Expected: FAIL (no module).
- [ ] **Move the code.** The town imports from `../models`. `citadel/crowd.js` re-exports.
- [ ] **Run** the same, plus `npx vitest run src/components/rickmorty/citadel src/components/rickmorty/world/town`. Expected: PASS.
- [ ] **Shoot after.** The same views must match pixel for pixel (`scratchpad/worlds/diff.py`).
- [ ] **Commit.**

### Task 2: Each place's fog in its own sky, and late arrivals in the house look

**Files:**
- Create `world/houseSky.js` and its test.
- Modify `world/scene.js`: the sky line at 456 calls `houseSky`, and the kit gets `adopt`.
- Modify `dimensions/stage.js`: `area.skyLook` is set in `done()` for an outdoor place, from its sky's merged look.

**Interfaces:** `houseSky(id, area, { outdoor, street, annex }) → look | null`. It returns:
- `street` for `'street'`;
- the area's `skyLook` if it has one;
- `annex` for an outdoor area without one;
- otherwise `null`.

`kit.adopt(root)` calls `house.adopt(root)`.

**Steps:**
- [ ] **Write the test:** the four cases.
- [ ] **Run** and FAIL.
- [ ] **Implement and wire** (`makeSky` gives its look back as `sky.look`).
- [ ] **Run:** PASS.
- [ ] **Shoot** pluto, gearworld and snakeplanet. The horizon is in the place's own colours, with no pink seam.
- [ ] **Commit.**

### Task 3: `bakePose`

**Files:** Create `src/lib/three/bakePose.js` and its test.

**Interfaces:** `bakePose(root, clip, t = 0) → BufferGeometry | null`.
1. Plays the clip at `t` on a mixer of its own (`setTime`, then `root.updateMatrixWorld(true)`).
2. For each `SkinnedMesh` under `root`, skins every vertex: positions with `getVertexPosition`, normals with `applyBoneTransform` on a `Vector4(n, 0)`, normalised.
3. Writes them into new float attributes in `root`'s space, carrying the uv over.
4. Merges the meshes and stops and uncaches the mixer.
5. Returns `null` if there is no skinned mesh.

**Steps:**
- [ ] **Write the test.** A two-bone skinned box, with a clip that turns the second bone 90°:
  - the baked positions equal the skinned ones (`applyBoneTransform`) within 1e-5;
  - a top normal turns with its bone;
  - no clip means the rest pose;
  - a group with no skinned mesh gives `null`.
- [ ] **Run** and FAIL.
- [ ] **Implement.**
- [ ] **Run:** PASS.
- [ ] **Commit.**

### Task 4: Blocks, the only new solids

**Files:**
- Create `dimensions/blocks.js` and its test.
- Modify `dimensions/destinations.js`: `DESTINATIONS` is the rows with `solids: [...d.solids, ...blocksOf(d)]`.

**Interfaces:**
- `BLOCKS: { [id]: [{ id, dx, dz, w, d, h }] }`.
- `blocksOf(d) → [{ id: \`${d.id}-${b.id}\`, x, z, w, d, h, block: true }]`, in world coordinates, as `place()`'s `w()` turns dx and dz.
- `blockProblems(d, blocks) → string[]`. It reports a block that is:
  - taller than 1.2 m;
  - outside the box;
  - within `r + 0.4 + 0.5` of a hotspot's centre;
  - within 1.5 m of the way in or the portal home;
  - within 1 m of a person's or extra's home or wander route (segments).

**Steps:**
- [ ] **Write the tests** on a fixture place:
  - each of the five problems is reported, and a clean block reports none;
  - `blocksOf` turns dx and dz;
  - every real place's blocks report nothing;
  - `rules.test.js`'s flood is untouched.
- [ ] **Run** and FAIL.
- [ ] **Implement.** `BLOCKS` starts empty; the places' tasks add to it.
- [ ] **Run** the test, and `npx vitest run src/components/rickmorty/world/rules.test.js src/components/rickmorty/world/dimensions`. Expected: PASS.
- [ ] **Commit.**

### Task 5: The layout, `outskirtsOf`

**Files:** Create `dimensions/outskirts.js` and its test.

**Interfaces:** `outskirtsOf(d, world, { tier, fogFar }) → laid`, pure and seeded by `d.id`, where `laid` is:

```js
{
  reach,
  edge: [{ kind, x0, z0, x1, z1, h, see }],                          // the box's four sides, none left out
  corners: [{ x, z }],
  lots: [{ side, row, style, x, z, turn, w, d, h, y, model? }],
  skyline: [{ x, z, w, d, h, style }],
  path: [{ x, z }],
  props: [{ model, x, z, turn, s }],
  walkers: [{ kinds, loop: [[x, z]…], n }],
  gathers: [{ kinds, at: [x, z], r, face, n, block, until, after, when }],
  lanes: [{ model, y, from: [x, z], to: [x, z], speed, n }],
  extents: { [key]: { x, y, z, r } },
}
```

Rules:
- The near ring goes per side, starting 8 m past the edge, facing in, rows stepping up on plinths. It stays out of the vista and the way in's axis.
- The skyline runs from 100 m to 0.8 × `fogFar`, its towers at least 2.5 × the ring's tallest.
- `reach = fogFar + 20`.
- The counts come from the level's row.
- Walker loops go round the forecourt and the streets, off solids, people's wander routes and spots.

**Steps:**
- [ ] **Write the tests.** On a fixture outdoor place, a fixture room and every level:
  - nothing in `lots` within 8 m of the edge, and nothing over 1.4 m within 7 m outside;
  - no lot inside the vista;
  - the skyline's radius ≤ 0.8 × fogFar, its towers' heights ≥ 2.5 × the ring's;
  - `reach`;
  - the edge covers the whole perimeter;
  - walker loops at least 1 m off the solids and wander routes, and 2 m off the spots and the way in;
  - the counts at each level;
  - the same id gives the same layout;
  - a side set to `null` gets no lots;
  - a room has no edge and its lots stand outside its walls.
- [ ] **Run** and FAIL.
- [ ] **Implement.**
- [ ] **Run:** PASS.
- [ ] **Commit.**

### Task 6: `crowdPose`

**Files:** Create `dimensions/crowdPose.js` and its test.

**Interfaces:**
- `walkerAt(loop, lengths, total, speed, t, phase, out) → { x, z, yaw, bob, sway }`: on a closed loop, with a step every 0.55 s.
- `gatherAt(at, r, i, n, face, seed) → { x, z, yaw }`: spread in a disc, facing `face`.
- `hopOf(t, since, i) → lift` (0–0.11 m over 0.6 s, rippling).
- `loopLengths(loop) → { lengths, total }`.

**Steps:**
- [ ] **Write the tests:**
  - a walker is on the loop at every t;
  - it goes round in `total / speed`;
  - its heading points along the segment;
  - bob and sway stay small;
  - `gatherAt` stays in the disc, facing;
  - a hop rises and settles.
- [ ] **Run** and FAIL.
- [ ] **Implement.**
- [ ] **Run:** PASS.
- [ ] **Commit.**

### Task 7: The code buildings, `lots.js`

**Files:** Create `dimensions/lots.js` and its test.

**Interfaces:**
- `lot(R, { x, z, turn, w, d, h, y, style }, look, { list, windows })` draws with `R.frame(...).box/cyl/part` (BOX, CYL8, BALL8) and the windows' tiled paint. `windows` is `windowPaints(R, look)`: one tiled paint per wall colour.
- `edgeRun(R, piece, look)` draws a kerb, rail, fence, barrier or wall.
- `opening(f, u, wl, { w, y0, h, mullion, frame })` draws a frame and mullions and no picture.
- Styles: `block`, `tower`, `dome`, `hut`, `tudor`, `stack`, `adobe`, `mushroom`, `spire`, `stand`, `hangar`, `mast`, `berm`, `house`.

**Steps:**
- [ ] **Write the tests.** A fake R records each part's box in world space:
  - each style stays inside its footprint (w × d, turned) and its height;
  - no `BALL` is used;
  - an edge run is no taller than its `h`;
  - an opening draws only frame parts and no decal.
- [ ] **Run** and FAIL.
- [ ] **Implement.**
- [ ] **Run:** PASS.
- [ ] **Commit.**

### Task 8: The crowd, the traffic, and `surround` wired into `stage()`

**Files:**
- Create `dimensions/crowd.js` and its test.
- Create `dimensions/surround.js` and its test.
- Create `dimensions/worlds.js`: `WORLDS = {}` and `TRIS`.
- Modify `dimensions/stage.js`:
  - read `WORLDS[id]`;
  - give the wall lines their openings;
  - size the outdoor ground from `reach`;
  - give a room with an outside its sky, its ground strips outside the walls, and the fog merged into its light;
  - call `surround` in `done()` before `R.build`, inside a try/catch;
  - merge the crowd's actions.
- Modify `customs.js`, `squanch.js` and `purge.js`: spread `area.actions`.

**Interfaces:**
- `createCrowd(kit, R, laid, { tier, room, load }) → { update(t, dt, state, camera), hop(), turn(to), show(key, on), dispose() }`.
  - Each kind is made through `kit.need`, then:
    - an unrigged MESHY kind via `kit.cast.prop` and `standing`;
    - a light copy from `/games/meshy/crowd/<name>.glb` through the loader;
    - a rigged light kind via `kit.cast.make` and `bakePose` on its idle, then `standing`.
  - Walkers are one `InstancedMesh` a kind on a fresh toon. Gatherings are another, on `breathing`.
  - No shadow and no line. The bounding sphere comes from `laid.extents`. Scratch objects are preallocated.
  - Copies of a kind = floor(the level's allowance share ÷ `TRIS[kind]`), capped by the record's n.
- `surround({ R, d, P, kit, load, room }, world, laid) → { actions, update, ready: Promise }`:
  - draws the edge, the lots, the skyline and the forecourt path;
  - stands the sets, props and traffic (fedship from `kit.models`; the rest by path through `kit.need` and `kit.cast.prop`, instanced);
  - makes the crowd;
  - runs every load under `kit.track` and doesn't gate the stage's `cast`;
  - in a room, nothing casts and every outside part goes in `'fixed'`.

**Steps:**
- [ ] **Write the tests** (a fake kit with fake geometry):
  - `crowd.test.js`:
    - counts by level from `TRIS`;
    - nothing casts a shadow, nothing has a line, nothing joins `N.list`;
    - `hop` lifts then settles;
    - `show(key, false)` hides;
    - `dispose` frees what it made and never the cast's.
  - `surround.test.js`:
    - every load goes through `track`;
    - a rejected load leaves the place built;
    - a throw inside `surround` leaves `done()`'s area and actions intact;
    - in a room nothing casts.
  - `stage`:
    - a record's windows give the walls holes;
    - an outdoor ground is `2 × reach` across;
    - a room's light takes the record's fog, with near greater than the room's diagonal.
- [ ] **Run** and FAIL.
- [ ] **Implement.**
- [ ] **Run:** PASS. Also run `npx vitest run src/components/rickmorty`. Expected: PASS.
- [ ] **Commit.**

### Task 9: The records' rules, and `TRIS`

**Files:**
- Create `dimensions/worlds.test.js`.
- Extend `dimensions/models.test.js`.

**Interfaces:**
- `TRIS: { [kindOrPath]: triangles }`.
- `worldProblems(d, world) → string[]`. It reports:
  - a crowd kind or model not in `MESHY` or not on disk at its URL;
  - inside the box, a crowd kind that is a hunter's, a lookout's or a named person's;
  - copies of such a kind closer than 7 m (30 m for a named person's kind) beyond the edge;
  - a crowd entry whose gating names no task;
  - a window off its wall;
  - a family vehicle as traffic;
  - a set piece repeated more than twice, or two copies closer than 40 m;
  - a lot or skyline piece that rises into Get Schwifty's sight lines from the mic to the heads.

**Steps:**
- [ ] **Write the tests:**
  - each problem is caught on a fixture record;
  - `worldProblems` is empty for every real record;
  - `TRIS` matches each GLB's header (index count ÷ 3, ±1%);
  - Σ copies × `TRIS` ≤ the level's allowance for every place and level.
- [ ] **Run** and FAIL.
- [ ] **Implement.**
- [ ] **Run:** PASS.
- [ ] **Commit.**

### Task 10: The frame's cost, read in the browser

**Files:** Modify `scripts/c137-shots.mjs`, adding `INFO=1`.

**Interfaces:**
- For each view it prints `api.info()`'s calls, triangles, textures and geometries, the ready wait in seconds, and the crowd, lots and traffic triangles (`__C137__.worlds?.(area)`, a dev hook from `surround`).
- It exits 1 on a page error, a 400 or above, or a low-level ready wait over 150 s.
- `QUALITY=mid|high` adds `?quality=`.

**Steps:**
- [ ] **Run `INFO=1` at low** on main's views, and keep the readout as the "before" (`scratchpad/worlds/info-before.txt`).
- [ ] **Commit.**

### Task 11: The first eight places

Customs, Get Schwifty, the cable studio, the Meeseeks' golf course, the simulation, the agency, the Microverse and the Gromflomite base. Each place follows the spec's brief and table row.

**Files:**
- Add the records to `worlds.js` and the blocks to `blocks.js`.
- Remove each builder's painted panel where its opening goes:
  - `customs.js:125-141` (the city);
  - `microverse.js:68`;
  - `agency.js:38`;
  - `gromflomites.js:69`;
  - `cable.js:66`.
- Schwifty:
  - remove the 60 glow dots and the walk-through barriers (`schwifty.js:34-36`);
  - add 2–3 more heads as extras placed beyond the box: the row's extras at their end. A crowd entry is a gathering, not a head, so the heads stay rows.

**Steps:**
- [ ] **Shoot first:** before (the views, at low).
- [ ] **Add the records.** `worlds.test.js` and `blocks.test.js` must PASS.
- [ ] **Shoot after.** Look at each view and tune the record until the first frame reads as the brief says. Also turn the camera on each place (`cam: [π, 0.2]`) and check the view behind.
- [ ] **Run** `npx vitest run src/components/rickmorty` and `node scripts/rm-story-check.mjs`. Expected: PASS.
- [ ] **Run `INFO=1` at low.** The extra calls, triangles and ready wait must be within budget.
- [ ] **Commit** each place on its own.

### Task 12: Fantasy World, Froopyland and Dimension 35-C

The same steps as Task 11.

### Task 13: The rest

Squanch, Bird World, Gear World, Pluto, Nimbus, Nuptia, the Resort, Snake Planet, Purge, Cronenberg, the Blood Dome, the Frundles' street, the Jerryboree, St. Gloopy Noops, Heist-Con, the prison, the Vindicators' ship, the fortress, Evil Rick's lair, the dream, Needful Things, the vat, the Story Train and Anatomy Park.

**Changes beyond the records:**
- **Purge:** the cottages, barn, well and siren are drawn as their models (`purge.js:18-34`), at the code ones' places and footprints.
- **Cronenberg:** the house and the car are drawn as their models (`cronenberg.js:21-44`).
- **Squanch:** the suckulents are drawn as `sm/suckulent` instances (`squanch.js:59-75`).
- **The painted panels behind each new opening are removed:**
  - `vindicators.js:106-108`;
  - `evilrick.js:60-62`;
  - `prison.js:68`;
  - `fortress.js:109`;
  - `heistcon.js:31`;
  - `dream.js:75`;
  - the Jerryboree's and Gloopy Noops' north walls.

The same steps as Task 11.

### Task 14: Prove it, hand over, review, PR, merge

**Steps:**
- [ ] **Shoot** every view after, at low (`INFO=1`) and at `QUALITY=high` for the first eight. Make before/after sheets.
- [ ] **Docs:**
  - a decision record (`docs/decisions/2026-10-21-rick-and-morty-worlds-not-rooms.md`) and its README row;
  - the HANDOFF's Rick and Morty paragraph: the rule on code buildings, the records, the follow-up on light copies;
  - the index's line pointing at this plan.
- [ ] **Run the CLAUDE.md four** and `node scripts/rm-story-check.mjs`.
- [ ] **Review:** the review workflow, then one fresh reviewer.
- [ ] **Ship:** a PR, and merge on green.
