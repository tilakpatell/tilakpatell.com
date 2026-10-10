# Battlefront 2017, lane W: the walkers' fall, the AT-AT's wreck, the cockpits, the engines and the far fleet instanced. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. W4 (the engines) waits on lane D's exhaust sheets: build its fallback and test now, wire the sheet when the hand-off says it is up.

**Goal:** A snowspeeder's tow cable trips an AT-AT after three laps and it falls on the game's clip into the game's wreck; the space layer's cockpit view is the game's cockpit for the ships that have one; engine glow takes the game's exhaust sheets; the far fleet is one draw a kind.

**Architecture:** Pure rules (`towCable.js`) + a Verlet rope (`lib/three/rope.js`) with the game's `RopeData` numbers driving the game's rope mesh; a wreck module that swaps the walker for the `Leftover_*` skinned pieces on their own rigs; a cockpit adapter in the shape of the built ones; an engine-glow module over `gameLook`; one `InstancedMesh` per kind for the far band of `models.js`.

**Tech Stack:** `surface/missions/*`, `walker.js`'s `ride()`, `quests.js`, `rigSets.js`, `ownRig.js`, `walkers.js`, `gameFx`, `cockpit/vehicles/*`, `galaxy/scene.js`'s `buildCab`, `galaxy/models.js`, `lib/three/fx/gameLook.js`, Vitest, `galaxy-check.mjs`, `anim-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-cast-left-design.md` (§1.7, §3 lane W).

## Global Constraints

- The game's numbers verbatim: attach range **50 m**; rope **100 nodes, spring 200, damping 10, gravity 0.2, wind friction 0.05, max spring length 6 m, release element length 2 m, first skinned joint 6**; the AT-AT's health **40,000**; laps to trip **3** (the film's; the game's count is a logic graph the dump does not express: said in the code's comment and the hand-off).
- No sequel era (the AT-M6 stays out).
- Lane P3 (vehicle physics) is not started: the rope collides with nothing but the walker's leg capsule this lane defines; P3 takes it later (said in the hand-off).
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines; merge commits.

## Review Focus

1. **A lap counted by angle, not by distance**: a speeder that circles at 40 m and one at 10 m both trip at three laps; a speeder that flies straight past never does (`lapsOf` sums signed angle deltas and takes `|sum| / 2π`); the test runs both paths.
2. **The rope lets go**: when any spring stretches past `MaxSpringLength` 6 m (the game's release), `attached` → false and the laps reset; the test stretches one spring.
3. **A walker already down or shielded is not a target** (the game's filter): `attachable` → false for `down`, `shield > 0`.
4. **The wreck's pose**: the `Leftover_*` pieces are placed from the fallen rig's `Hips`, `Neck` and `Head` world matrices at the death clip's last frame, not from the walker's origin; the test on a fake rig with a known hips matrix asserts the body piece's matrix.
5. **An instanced far copy of a tinted slot**: a tint is a material, so tinted slots keep their own copy and never join the instanced mesh; the test asserts `take(kind, slot)` returns null for a tinted slot.

---

### Task 1: The tow cable's rules and rope

**Files:**
- Create: `src/components/galaxy/surface/missions/towCable.js` (pure: `ATTACH_RANGE = 50`, `TRIP_LAPS = 3`, `ROPE = { nodes: 100, spring: 200, damping: 10, gravity: 0.2, wind: 0.05, maxSpring: 6, release: 2, firstJoint: 6 }`; `attachable(speeder: { at }, walker: { at, down, shield }) → bool`; `lapsOf(samples: [[x, z]…], hips: [x, z]) → number`; `tripped(laps) → bool`; `slack(nodes) → bool` (any spring over `maxSpring`)), `src/lib/three/rope.js` (`createRope(ROPE) → { nodes: Float32Array(3n), pin(i, p), step(dt, wind), drive(skinnedMesh) }`: Verlet, the game's constants), `towCable.test.js`, `rope.test.js`
- [ ] **Step 1: Failing tests**: Review Focus 1, 2, 3; a rope pinned at both ends 20 m apart settles with its middle below the ends under gravity 0.2 within 2 s of steps.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The tow cable's rules and rope, the game's numbers`.

### Task 2: Firing it, and the fall

**Files:**
- Create: `public/models/galaxy/bf2017/surface/towcable.glb` (`towcablerope_skinned_mesh`, `--rig --no-walrus-check`, 207 joints)
- Modify: `src/components/galaxy/surface/walker.js` (`ride()` emits `fire` on the ride's fire key), `src/components/galaxy/surface/rides.js` (`airspeeder: { …, cable: true }`), `src/components/galaxy/surface/scene.js` (on `fire` from a `cable` ride: `attachable` over the walkers (`walkers.js`'s figures, `activity.js`'s targets), the rope made and pinned to the ride's tail hardpoint and the nearest leg's `LeftFrontFoot`-side bone at hip height, the mesh driven each frame; `lapsOf` from the ride's path samples (one every 0.2 s); `tripped` → `questEvent({ type: 'trip', tag })` and the walker figure's `react('down', { cable: true, side })`), `src/components/galaxy/surface/missions/assault.js` (the Battle of Hoth's T-47s, where the mission has air units, fire a cable at a walker within range once a minute: `aiCable(units, walkers, time)` pure)
- Test: `scene.towcable.test.js` (the pure pieces), `assault.test.js`

- [ ] **Step 1: Failing tests**: a ride with `cable: true` and a walker at 30 m → the scene's `cableFor(ride, walkers)` names the walker; at 60 m → null; `aiCable` fires at most once a minute per unit.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Look**: Hoth, the airspeeder ride, three laps round the first AT-AT: it plays `die.cable`; `anim-check`'s drift check during the fall; a shot sequence into `docs/superpowers/evidence/bf2017-walkers/`.
- [ ] **Step 6: Commit** `A tow cable round an AT-AT's legs brings it down`.

### Task 3: The wreck

**Files:**
- Create: `public/models/galaxy/bf2017/surface/atatwreck{body,head,neck}.glb` (`--rig --no-walrus-check`), `public/models/galaxy/bf2017/clips-atatwreck{body,head}.glb` (`bf2017-rigclips.mjs --pack atatwreckbody`: `ATAT_Destruction_01_Leftover_Body_Anim01`; head likewise), `public/models/galaxy/bf2017/surface/atatwreck{body,head,neck}.far.glb` (the rigid `Exterior_*` meshes, `--far`), `src/components/galaxy/surface/walkerWreck.js` (`wreckOf(fig) → { pieces: [{ kind, at: Matrix4 }] }` from the fallen rig's `Hips`, `Neck`, `Head` matrices (Review Focus 4); `placeWreck(scene, fig, loadOwnRigFigure)`: the walker's body taken off, the three pieces placed, `Anim01` played once and held, `gameFx.explode(headAt, 'walker')` on its first frame; at `mid` distance the `Exterior_*` far cuts), `walkerWreck.test.js`
- Modify: `src/lib/three/rigSets.js` (`RIGS.atatwreckbody`, `.atatwreckhead`: `root`, `set: { fall: 'ATAT_Destruction_01_Leftover_Body_Anim01' }`), `src/components/galaxy/surface/activity.js` (a walker whose `down` clip ended calls `placeWreck`), `src/components/galaxy/surface/sites/ice.js` (the `walker` zone's fallen AT-AT: `atatwreckbody.far` + `atatwreckhead.far` at the pose `rig-shot.mjs --last-frame` printed, in place of the bind-posed walker on its side), `scripts/rig-shot.mjs` (`--last-frame`: prints the root's and each named bone's final world transform)
- [ ] **Step 1: Failing tests**: Review Focus 4; `RIG_SET('atatwreckbody').fall` named.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; import; pack. **Step 4: Run** → PASS.
- [ ] **Step 5: Look**: the fall from task 2 continues into the wreck; the Hoth `walker` zone's wreck in the game's pose; shots.
- [ ] **Step 6: Commit** `A fallen AT-AT becomes the game's wreck`.

### Task 4: The cockpits on boarding

**Files:**
- Create: `src/components/cockpit/vehicles/game.js` (`hasCab(kind) → bool` by `catalog/bf2017-vehicles.js`'s cockpit rows; `build(kind, { renderer }) → { group, seat, plan }` in `falcon.js`'s shape: the cockpit GLB in its hull frame, the seat at the row's `seat` (lane V measured each), the canopy's glass as imported, the hull's `glow|light|engine` materials' emissive lit), `game.test.js`
- Modify: `src/components/galaxy/scene.js` (`buildCab(kind)`: `hasCab(kind)` → `game.build`, else the built cockpit)
- [ ] **Step 1: Failing tests**: `hasCab('xwing')` true, `hasCab('falcon')` false (the Falcon's is the built one); `build` on the committed snowspeeder cockpit returns a group whose box contains the seat.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Look**: the space layer, `V` for the cockpit in an X-wing and a TIE; shots.
- [ ] **Step 6: Commit** `The cockpit view is the game's cockpit where the game has one`.

### Task 5: Engine glow through the game's look

**Files:**
- Create: `src/lib/three/fx/engines.js` (`thrustersOf(root) → [{ mesh, centre, radius }]` by material name `glow|light|engine` and bounds; `glowFor(kind) → 'engine.xwing' | 'engine.awing' | 'engine.shuttle' | null` by hull family; `attachGlow(root, kind, { level })`: a quad per thruster with the sheet from `loadLook`, additive, sized to the thruster; nothing extra when the sheet is null (the models' own emissive stays)), `engines.test.js`
- Modify: `src/components/galaxy/models.js` (`tune(root)` → also `attachGlow`), `src/components/galaxy/surface/rides.js` (a ride with a hull family gets it)
- [ ] **Step 1: Failing tests**: a fake root with two `engine` materials → two thrusters; `glowFor('tie')` → null until the TIE's sheet is in `WANTED`; `attachGlow` with `loadLook` returning null adds no children.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Engine glow takes the game's exhaust sheet when it is there`. (When lane D lands the sheets: `node scripts/bf2017-fx.mjs` remakes the table; nothing else changes.)

### Task 6: The far fleet instanced

**Files:**
- Create: `src/components/galaxy/lodInstances.js` (`createLodInstances(material) → { take(kind, slot, farGeometry) → index | null (null for a tinted slot), update(slot, matrix, visible), release(slot), meshes(): InstancedMesh[], dispose() }`; one `InstancedMesh` per kind, `count` grown by 32, a hidden instance's matrix scaled to 0), `lodInstances.test.js`
- Modify: `src/components/galaxy/models.js` (`fill()`: for an untinted slot with a far copy, `take` instead of `far.clone(true)`; the `THREE.LOD`'s mid level an empty `Object3D` whose `onBeforeRender`-equivalent (the LOD's current level, read in the scene's tick) toggles the instance; the slot's `update` writes its matrix when in the far band), `src/components/galaxy/models.test.js` (exists)
- [ ] **Step 1: Failing tests**: Review Focus 5; twelve slots of one kind beyond `LOD_NEAR × size` → one `InstancedMesh` with 12 visible instances and the scene's `renderer.info.render.calls` for the far band 1 (the test's headless renderer, as `models.test.js` already draws).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Measure**: the space layer's `galaxy-check` route (a battle with the most ships: Endor's) before and after: calls in the PR.
- [ ] **Step 6: Commit** `The far fleet draws once a kind`.

### Task 7: The PR and the hand-off

- [ ] Gates; `galaxy-check.mjs surface hoth` with `BUDGET=1` before and after (the rope, the wreck pieces); `anim-check` Hoth green; the hand-off's lane W row (Done; Left: lane P3's rope collision; the AT-ST's wreck pieces if wanted; the TIE's exhaust sheet name for `WANTED`; the three-laps number if the owner finds the game's); merge `origin/main`, push, PR `The walkers fall and wreck as the game's, the cockpits are the game's, the far fleet draws once a kind`. Merge per the slot.
