# Far soldiers as rows: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A round of 24 soldiers a side on Hoth costs the frame little more than a round of 8 does today, because a soldier far from the eye is a row in a buffer and not a figure.

**Architecture:** Past the distance at which the game puts a character on its last mesh LOD, a soldier's parts are no longer drawn as its own skinned meshes. Each body part of each kind is one instanced draw; an instance's pose comes from a bone texture, one row an instance, written once a frame. Near soldiers stay figures exactly as now (ragdolls, cloth, sockets, the cut swap). Stage 1 keeps a far soldier's bones and mixer on the main thread and moves only its drawing; stage 2 takes the far soldiers' poses from a small shared table and removes their bones from the graph.

**Tech Stack:** three r186.1's node renderer and TSL (`three/webgpu`, `three/tsl`), `DataTexture` in RGBA32F, the existing `src/lib/three/skinPrune.js`, vitest for the pure parts, a Playwright switch test for the page.

**Spec:** `docs/superpowers/specs/2026-10-13-gpu-site-and-guest-heroes-design.md`, section 3, lane A4, and section 2's numbers. Evidence: `docs/superpowers/evidence/far-soldiers-rows/README.md`.

## Where it stands (2026-10-15)

Stage 1 (Tasks 1 to 4, and Task 5’s numbers) is merged with #982, **off by default by the owner’s ruling**: a page draws rows only with `?rows=on` in its address, and only on WebGPU (`figures/band.js`’s `wantsRows`; `rows.js`’s `canDrawRows` is false on the node renderer’s WebGL 2 backend). A visitor sees no change. It went in after the performance lanes’ P4 (`figures/lod.js`): a row’s body keeps P4’s animation rate, and its rows are placed every frame from the bones as P4 last left them (`figures.test.js`). The numbers: `docs/superpowers/evidence/far-soldiers-rows/README.md`, none of them taken with P4 in.

Accepted with `?rows=on`, for now: a row casts no shadow (a loss at low and mid, where the game’s own shadow distance is past the band), and a soldier’s look steps at the band’s edge with the post chain on.

Open, each needing the owner’s RTX 5090 on WebGPU (a cloud container has none):

- **Task 5’s picture fault.** With the post chain on, a row is not the figure’s picture. The cause found so far is on `main`, not in the rows: skinned figures write tens of thousands of texels of spurious velocity in the scene pass while standing still (26,915 on a page that never made a row), and rows write the frame’s own. Find why the figures do (the skinned mesh’s previous pose in the node renderer’s velocity is the first suspect), fix it, then take the rows and figures pair again with `chain2` (`rows-shots.mjs`) and the edge pair at 84 m. Done when the pair is within the temporal filter’s noise and the look no longer steps at the edge.
- **Task 6’s decision.** Stage 2 is not built. Decide from Task 5’s numbers taken again on current `main` with P4 in (P4 already takes part of what stage 2 would: a far body’s mixer runs every fourth frame and its bones rest between), and write the decision and its numbers in the evidence.
- **The goal.** 24 a side costing little more than 8 a side does today, in the switch test (`soldiers-ab.mjs`, `frames-rows.mjs`) on the built site (`vite build --mode bucketcheck`, `vite preview`), in a round with bots near as well as far: the spawn’s view, where every bot is past the band, is the most favourable there is.
- **The unexplained drop-out.** In one run on the built site no soldier was a row at 15 s, though twenty had been at 10 s and 14 of the 15 parts read as ready. Run `rows-arrive.mjs` and `rows-dip.mjs` again and read `figures.js`’s hand-over (`partsOf`, `part.ready`) and `rows.js` against them; and rule out a row ready in one pass but held out of the picture’s own (“drawn by exactly one path” is bookkeeping, not pixels).
- Then the owner rules whether rows go on for visitors. Until then nothing changes for one.

The scripts named are the desk’s, in its worktree’s `.scratch-check/` (git-excluded), as the evidence says.

## Global Constraints

- The band: a soldier is a row past `ROWS_FROM` metres from the eye and a figure again inside nine tenths of it. `ROWS_FROM = { low: 22, mid: 39, high: 62, ultra: 91 }`: the character LOD group's last distance, 52 m (`LodGroups/LodGroupCharacters.json`, `Lod6Distance`), times `Mesh.GlobalLodScale` 0.425 / 0.75 / 1.2 / 1.75. That the scale multiplies the table is read in code (the spec's section 2, decision 1), but a trooper's mesh has five LODs and is on its last from 42 m at Ultra, drawn skinned to about 500 m, so 91 m is the site's own choice and not the game's last LOD; the table is one constant with its source beside it, so it is one line to change.
- A row casts no shadow: the game's character `ShadowDistance` is 80 m and every `ROWS_FROM` at high and ultra is past it; at low and mid the game's own distance (80 × 0.425 and 80 × 0.65) is past `ROWS_FROM` too, so rows casting none is a loss there and is written in the pull request as one.
- The picture of a soldier as a row is the picture of the same soldier as a figure: same mesh (the cut the figure would wear at that distance), same pose, same materials. Rows are drawn only with `?rows=on` in the address (the owner’s ruling, 2026-10-15; before it they were on unless `?rows=off`); without it every soldier is a figure, the check’s other side.
- A soldier that dies, is thrown, or is handed to the ragdolls is a figure for that: rows hold only the living on their feet.
- `figures/figures.js`'s `BODIES` table and `kindOf` belong to the UI lane this week: read them, do not edit them.
- Nothing here runs on a device whose backend cannot do it: where the node renderer is on WebGL 2 and the row path fails to build, every soldier stays a figure, by a capability test and not by a user agent.
- The numbers are taken as the design's section 5 says: one page, the thing switched every four seconds for five rounds; no CPU profiler on a timed page; the dev server started with `--mode bucketcheck`; a note of whether the game was open.
- Before the branch is done: `npm run lint`, `npx vitest run src/components/battlefront src/lib/three`, `npx vite build`, `node scripts/health.mjs --check --skip build`. Files stay under 800 lines; a new library file has its test beside it.

## Review Focus

- A soldier crossing the band's edge back and forth: no flicker, no frame with it drawn twice or not at all.
- A soldier that dies while a row: it falls as a figure from the pose it had, not from a rest pose.
- A kind's body swapped to another cut while some of that kind are rows: the rows redraw on the new cut, and the old one's materials are freed once.
- More soldiers of a kind than the row buffer was made for: it grows; nothing is silently not drawn.
- The round swapped in place (`world.do('round')` empties the figures): every row is gone with it.

---

### Task 1: The number to beat

**Files:**
- Create: `.scratch-check/soldiers-ab.mjs` (git-excluded)

**Interfaces:**
- Produces: one JSON line `{ soldiers, parts, modes: { base, nofigures, rowsOff }, cost: { soldiersP50, soldiersMean } }`.

- [x] Read how a round is started (`src/components/battlefront/module.js`'s `do('round', …)`, `src/lib/battlefront/instantAction.js`'s `SIDE_BY_DETAIL`). Start Hoth's Instant Action at ultra's 24 a side in the probe; wait until at least 40 soldiers are drawn.
- [x] The switch test: `figures` hidden and shown every 4 s, five rounds; the soldiers' cost is base minus hidden, p50 and mean. Run it twice; record both. Record how many soldiers stand past `ROWS_FROM.ultra`.

### Task 2: A pose as a row (pure)

**Files:**
- Create: `src/lib/three/figureRows/pose.js`
- Test: `src/lib/three/figureRows/pose.test.js`

**Interfaces:**
- Produces: `rowLayout(joints) → { texelsARow, floatsARow }` (four texels a joint); `writeRow(array, row, layout, boneMatrices, rootInverse) → void` (each joint's skin matrix, `rootInverse × bone.matrixWorld × boneInverse`, as three.js's own `Skeleton.boneMatrices` holds it, re-based on the instance's root so the instance matrix places it); `growRows(array, layout, rows) → Float32Array`.

- [x] Tests first: a two-joint rig posed by hand writes the sixteen floats three's own `skeleton.update()` leaves in `boneMatrices`; a second row does not touch the first; growing keeps what was written.
- [x] Implement; run; commit.

### Task 3: The instanced skin (the draw)

**Files:**
- Create: `src/lib/three/figureRows/rows.js`, `src/lib/three/figureRows/skinNode.js`
- Test: `src/lib/three/figureRows/rows.test.js` (the bookkeeping; the shader is checked on the page)

**Interfaces:**
- Consumes: Task 2's `rowLayout`, `writeRow`, `growRows`.
- Produces: `createFigureRows({ scene, capacity = 64 }) → { group, part(key, geometry, material) → part, place(part, i, skeleton, rootMatrixWorld), count(part, n), drop(key), stats() → { parts, rows, draws }, dispose() }`. A `part` is one instanced mesh whose vertex stage reads `skinIndex` and `skinWeight` and four joint matrices from the bone texture by `instanceIndex`; position and normal are skinned as three's `SkinningNode` skins them.

- [x] `skinNode.js`: the TSL position and normal for a row. Read three's own `node_modules/three/src/nodes/accessors/SkinningNode.js` first and keep its arithmetic.
- [x] `rows.js`: one mesh a `(kind, cut, part)`, `frustumCulled = false` with one bounding sphere for the group, `castShadow = false`, the material a clone of the part's own with the row's position and normal nodes; the texture uploaded once a frame, only the rows in use.
- [x] Tests for `part`, `place`, `count`, `drop`, growth past `capacity`, `dispose` freeing every material and texture it made.
- [x] Commit.

### Task 4: The hand-over

**Files:**
- Modify: `src/components/battlefront/figures/figures.js` (not `BODIES`, not `kindOf`), `src/components/battlefront/module.js` (the flag, the one call a frame)
- Create: `src/components/battlefront/figures/band.js`
- Test: `src/components/battlefront/figures/band.test.js`, and cases in `figures.test.js`

**Interfaces:**
- Consumes: Task 3's `createFigureRows`.
- Produces: `rowsFrom(level) → metres`; `bandOf(distance, was, from) → 'figure' | 'row'` (in at `from`, out at `0.9 × from`); `createFigures({ …, rows = null })`: with `rows`, a living soldier in the row band has its skinned parts and its gun's meshes hidden and its pose placed in the rows after its mixer has run; `module.js` passes `rows` unless the address says `?rows=off` or the capability test fails.

- [x] Tests first for `bandOf` (the edge, the hysteresis) and for the five lines of Review Focus against a fake `rows`.
- [x] Implement. The gun a soldier holds is a part like any other, placed by its socket's world matrix.
- [x] Run the figures' tests whole; commit.

### Task 5: Stage 1 on the page

- [x] `soldiers-ab.mjs` with a third mode, rows off and on (a page each, interleaved, twice). Record the soldiers' cost, the draws from soldiers, and a pair of pictures of the same seeded moment with rows on and off at 2,560 × 1,440, looked at where the far soldiers stand.
- [ ] If the pictures differ in anything but the temporal filter's noise, that is a fault: find it before going on.
- [x] Write the numbers into `docs/superpowers/evidence/far-soldiers-rows/README.md` (first a section of `gpu-first/N1/README.md`, which the docs audit removed), each with its `_source`. Commit.

### Task 6: Stage 2, the shared poses (only if Task 5 shows the mixers and bones are what is left)

**Files:**
- Create: `src/lib/three/figureRows/poseTable.js` and its test
- Modify: `src/components/battlefront/figures/figures.js`

**Interfaces:**
- Produces: `createPoseTable({ body, clips, steps = 16 }) → { poseFor(state, phase) → row index, update(dt), rows }`: one hidden rig a kind, each locomotion clip the far band plays sampled at `steps` phases; a far soldier's row is copied from the nearest phase, and its own bones and mixer are taken out of the scene graph until it is a figure again, then seated at the phase it had.

- [ ] Decide from Task 5's numbers whether this task is done at all; write the decision and its numbers in the report. The game itself runs only locomotion and the weapon pose on a soldier past 57.5 m (`ant/layers/3P.Soldier.Layer.json`), which is what the table holds.
- [ ] If done: tests first (a soldier's row equals its own rig's pose at that phase within a tolerance the test states; re-entry seats the mixer at the same phase), implement, measure as Task 5, record.

### Task 7: Done

- [x] Global Constraints' checks. Push the branch; open a draft pull request with the before and after and what is not fixed; do not merge. (Superseded on 2026-10-15: the owner ruled stage 1 merges off by default, on only with `?rows=on`.)
