# Fidelity lane C: the cameras from the game. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** The camera is the game's camera, robust: the soldier's third-person arm with its pitch limits, reduced arm, shoulder side and wall collision blend; the aim zoom at the weapon's FOV and speeds; every vehicle seat's chain with its inertia and velocity redirect; the deploy and outro cameras from their lenses; recoil and shake on one rig; motion blur as the record says and depth of field when a cinematic camera asks; and the galaxy's walker on Hoth takes it behind `site.level` on day one. Nothing clips a wall, flips at the pole, jitters in a corner or snaps on a seat change.

**Architecture:** `src/lib/three/camera/`: pure poses (`soldier.js`, `aim.js`, `vehicle.js`, `overview.js`, `cinematic.js`) from `src/data/bf2017/cameras.json`'s rows, one rig (`rig.js`) that applies a pose with recoil and shake and feeds the post's `dof`/`motionBlur` data and the audio listener. The galaxy's surface calls `soldierPose` for the walker where `site.level` is set, with the arm's cast through the physics world's ray (P0, `claude/bf2017-p0-shapes`) or a height-only cast until it lands.

**Tech Stack:** three `^0.186.1` (`PerspectiveCamera`, `Quaternion`, `Spherical`); `src/data/bf2017/cameras.json` (merged: `rows.soldier`, `rows.aim`, `rows.vehicles`, `rows.overview`, `rows.cinematic`), `src/lib/spring.js` (the site's damped spring), `src/runtime/look.js` (`createLook`: the pointer), the merged light stack's `passesFor` (`motionBlur`, `dof` as data: lane V adds the kinds; read its branch), `src/lib/physics/` (P0's `queries.ray` when on `main`); Vitest; `scripts/light-fixture.mjs --camera`; `scripts/galaxy-check.mjs surface hoth`.

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-fidelity-design.md` ("Lane C"; "Where the light stands", item 6). Lane 5's plan Task 4 (`docs/superpowers/plans/2026-10-10-battlefront-lane5-world.md`) specified `soldierPose` and the others; this lane writes them under `src/lib/three/camera/` and lane 5 imports them.

## Global Constraints

- **Files this lane owns**: `src/lib/three/camera/*` (+ tests), `src/components/galaxy/surface/scene.js` (the walker's camera call site, behind `site.level`: additive, the smallest diff), `scripts/light-fixture.mjs` (`--camera`), the evidence folder `galaxy-engine/C/`, the hand-off's row. Not `src/runtime/look.js`.
- **Every number from `cameras.json`** (`_source` already on each); a number the rows lack is named with a comment (`FOV_DEFAULT = 70`, `SHAKE_DECAY = 6`, `RECOIL_SPRING = { k, c }`).
- **Pure poses**: no three.js in `soldier.js`, `aim.js`, `vehicle.js`, `overview.js`, `cinematic.js`; plain vectors in, `{ at, lookAt, fov, roll }` out; `rig.js` is the one file that touches a `PerspectiveCamera`.
- **The walker's feel does not change** on a world without `site.level`; the test asserts the surface's camera setup is byte-identical in that case (the call site is behind the field).
- Files under 800 lines; tests beside; the gates.

## Review Focus

1. **A wall at 0.6 m**: the arm shortens to `0.6 − 0.17` at `blendIn 5` per second (after 0.1 s about half the gap), never clips (the cast each frame), and returns at `blendOut 3`; tested pure with a scripted cast and shown on the fixture (a wall behind the figure, a 3 s orbit).
2. **The pole**: pitch clamped at ±55 with no roll drift; a 720° yaw sweep at pitch 55 keeps `up` within 0.001 of the world's up.
3. **A corner for 10 s**: a scripted walker pressed into a 90° corner with the camera orbiting shows no frame-to-frame pose jump over 2 cm (the blend, not a snap); the test asserts the maximum step.
4. **The seat change** mid-inertia (AT-AT driver to gunner): the yaw and pitch carry their velocity through the change and settle under the new limits within 1 s; no snap.
5. **The zoom during a zoom**: aim pressed and released at 0.1 s eases back from wherever the FOV was, at `zoomOut`, never from the target; the test on the eased FOV curve.

---

### Task 1: The soldier and the aim
- Create `camera/soldier.js`, `camera/aim.js` (+ tests): `soldierPose`, `armFor`, `cullFor(stance)`, `aimFov(state, row, dt)`.
- [ ] Failing tests (review focus 1, 2, 5); implement; commit `The soldier's camera and the aim zoom from the game's rows`.

### Task 2: The vehicles and the overview
- Create `camera/vehicle.js`, `camera/overview.js` (+ tests): the transformer chain, the velocity redirect, `overviewPose`.
- [ ] Tests (review focus 4; the overview faces the objective); commit `Every vehicle seat's camera chain; the deploy and outro cameras`.

### Task 3: The rig, the shake, the cinematic lens
- Create `camera/rig.js` (`createCameraRig(camera, { recoil, shake, listener })`: `set(pose)`, `kick(rad)`, `shake(amount, at)`, `update(dt)`), `camera/cinematic.js` (`lensToDof(row) → { focus, aperture, maxblur }`, `lensToFov(focalLength, frame = 36)`), the post data (`motionBlur` from the weather, `dof` from a cinematic pose) handed to `passesFor`.
- [ ] Tests (the spring's settle, the shake's decay, the lens maths); the fixture with `--camera` (a figure, a wall, a scripted orbit; the shot sequence in the evidence folder); commit `One rig: recoil, shake, the listener; the cinematic lens to depth of field`.

### Task 4: Hoth's walker on it
- Modify `surface/scene.js`: where the walker's camera is placed, `site.level ? soldierPose(...) : as today`, the cast through P0's ray when on `main` else the ground's height; `scripts/galaxy-check.mjs surface hoth` and a 10 s scripted walk into the hangar's corner.
- [ ] The surface's test for the untouched case; the shots before and after on Hoth (lane L's pack from its branch if #831 is not merged); commit `Hoth's walker is seen through the game's camera`.

### Task 5: Docs and the PR
- [ ] The hand-off's row (and a note on lane 5's Task 4: done here); the gates; merge `origin/main`; push; PR `Fidelity lane C: the game's cameras, robust against walls, poles, corners and seat changes` with the tests' numbers and the shots.
