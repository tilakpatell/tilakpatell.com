# NPC and player rigging: hands, fingers, a crouch, and a figure’s own proportions. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, in the current session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every figure on the Meshy skeleton gets finger bones by its own geometry and a hand layer that closes them round a grip, into a fist, open in a wave and relaxed at rest; the Universal Animation Library’s finger motion rides along; the player and the NPCs crouch and crouch-walk in eight directions; toy and show bodies play clips scaled to their proportions with a reach guard; the game-rip figures join the library by role; and a script and a sheet measure all of it.

**Architecture:** Offline scripts write bones, weights and clips into the model files (gltf-transform, three.js in Node); the run-time additions are one new module (`lib/three/hands.js` with `handPoses.js`), one data module (`lib/three/figureStyles.js`), a stance in `locomotion.js`, a mask and two lists in `animator.js`, a scale in `clipLibrary.js`’s `forFigure`, a crouch in each walking world’s rules, and flags in `anim-check.mjs`. Nothing loads differently: a figure with finger bones is a figure with more bones.

**Tech Stack:** Node 22 ESM scripts, `@gltf-transform/core|functions|extensions`, `meshoptimizer`, three.js r186 in Node, vitest, headless Edge on Windows (`CHROME=` Edge) for the sheets and `anim-check`.

**Spec:** `docs/superpowers/specs/2026-10-08-npc-player-rigging-design.md`. **The hand-off:** `docs/superpowers/HANDOFF-npc-player-rigging.md`.

## Global Constraints

- No paid service: no `MESHY_API_KEY`, no `SKETCHFAB_API_TOKEN`, no Tripo. A step that would need one stops and says so.
- `src/lib` imports no React and no DOM; `src/lib/three` knows no world; files under 800 lines (`docs/health/RULES.md`); every new module has its test beside it; `node scripts/health.mjs --check --skip build` green.
- A figure file grows by under 12 KB from the extension; a re-baked `ual-*.glb` stays under 80 KB; nothing under `lab/` is committed.
- Byte identity where the spec says: the body tracks of every `ual-*.glb`; every `real` figure’s posed bones under `forFigure`.
- Nothing a visitor can do is lost: every key, save, achievement, sound and ghost works after as before; `KeyC` is the only key added.
- One phase per branch (`claude/rigging-p<N>`), from `main`; merge `origin/main` before opening and before merging; before each push: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`. Commits end with the harness’s attribution lines; no model names in code, docs or commits. British spelling, curly quotes, plain sentences; comments say why.
- Keep output terse.

## Review Focus

1. A hand the clustering misreads (a thumb taken for a finger, two fingers as one): the extension must list it, not write it; Task 3’s synthetic hands cover a mitten, a hand with a thumb, one without, and a glove with no gaps.
2. Weights that no longer sum to one, or a fifth influence: the mesh tears at the wrist. Task 3’s test asserts both on every vertex the script touches.
3. A finger turned after the mixer and not put back: it winds up frame on frame. Task 5 adds the finger bones to `animator.js`’s `posed`/`saved` lists and tests that two updates with no layer leave a finger at rest.
4. A `real` figure that moves differently after Phase 4: Task 13’s identity test on the fixture.
5. A crouch clip missing on a figure (its own clips only, no library): the stance’s weight hands on to the idle and walk as a missing run does today; Task 10 tests every subset.

---

## Phase 0: the audit

### Task 1: `scripts/rig-audit.mjs`

**Files:**
- Create: `scripts/rig-audit.mjs`, `scripts/rig-audit.test.mjs`
- Create: `docs/superpowers/evidence/rigging/audit-before.md`
- Modify: `src/lib/three/meshyRig.fixture.js` (a `fingers: true` option that adds the canonical finger bones in the canonical frame under each hand, for every later test)

**Interfaces:**
- `familyOf(names) → 'meshy24' | 'meshy54' | 'mixamo' | 'unreal' | 'rigify' | 'highmoon' | 'prime' | 'none'` (pure; `prime` the Transformers: Prime game’s rig, `Humerus.l`, `Index1_Finger.l`; `meshy54` when the Meshy twelve and any `LeftHandIndex1`/`LeftHandFingers1` are present)
- `profileOf(rest) → { height, hips, leg, arm, hand, headR, shoulders }` in metres from a rest skeleton’s world joint positions and the skinned box (pure over `{ joints: { name: [x, y, z] }, box: { min, max } }`)
- `readRig(doc) → { file, family, joints, fingers, twists, clips, tris, textures, profile }` over a gltf-transform `Document`
- `audit(rows) → rows sorted by family then file`; `table(rows) → Markdown`; `EXPECTED: { file: family }` (empty at first)
- CLI: `node scripts/rig-audit.mjs [--json out.json] [--write-profile]` (`--write-profile` writes `extras.profile` into each figure GLB that lacks one, through the same meshopt round trip `scripts/meshy-import.mjs` uses)

- [ ] **Step 1: Write the failing tests**: `familyOf` on the fixture’s names (24 → `meshy24`; with fingers → `meshy54`; `mixamorig:Hips_52` … → `mixamo`; `pelvis`, `upperarm_l` → `unreal`; `f_index01L` → `rigify`; `L_Arm02_Shoulder_XB` → `highmoon`); `profileOf` on the fixture’s rest (height 1.72 ± 0.02, leg = hip to foot, headR from `Head` to `head_end`); `table` on two rows.
- [ ] **Step 2: Run** `npx vitest run scripts/rig-audit.test.mjs`; expect FAIL.
- [ ] **Step 3: Implement**, reading files with `NodeIO` + `ALL_EXTENSIONS` + `MeshoptDecoder` as `scripts/ual-bake.mjs` does; joints from `listSkins()`, the rest positions by walking node transforms; the skinned box from the mesh positions (unskinned, at rest, which is the bind pose for a Meshy file).
- [ ] **Step 4: Run the tests**; expect PASS. Run the CLI over `public/models/**/*.glb` and `public/games/meshy/*.glb`; save the table as `audit-before.md`; run `--write-profile`.
- [ ] **Step 5: Commit** (the script, its test, the fixture change, the evidence, the profiled GLBs).

---

## Phase 1: fingers on five figures, and the hand layer

### Task 2: the hand geometry, pure (`scripts/lib/hand-geometry.mjs`)

**Files:**
- Create: `scripts/lib/hand-geometry.mjs`, `scripts/lib/hand-geometry.test.mjs`

**Interfaces:**
- `fingerGroups(points, shape, { k = 4 }) → { fingers: [[idx…]…], thumb: [idx…] | null, kind: 'fingers' | 'mitten' }`: `points` the hand’s vertices in the bone’s space, `shape` from `grip.js`’s `handShape` (imported through a relative path into `src/components/universe/grip.js`, which is pure three.js math; if the lint’s layer rule objects, move `handShape` and `bendFinger` to `src/lib/three/handShape.js` and have `grip.js` import from there, same names); k-means along `shape.across` from four evenly spaced seeds, ten rounds; `mitten` when the smallest gap between neighbouring clusters along `across` is under a tenth of the hand’s width
- `fingerChain(points, { joints = 3 }) → [{ at: [x, y, z], axis: [x, y, z] }…]`: the principal line through the cluster, joints at 0, ⅓, ⅔ of its length from the knuckle end
- `canonicalFrame(along, normal) → quaternion [x, y, z, w]`: +y along, +z normal, +x their cross
- `fingerWeights(points, hand, chains, { band }) → { joints: Uint16Array, weights: Float32Array }` (four a vertex), the hand bone’s share re-split as the spec says, sums to one, never more than four

- [ ] **Step 1: Write the failing tests** on synthetic hands (points laid out in code: four cylinders past a knuckle line with a thumb → four groups and a thumb; one slab → `mitten`; weights sum to 1 ± 1e-6, at most four non-zero, the palm’s points keep the hand bone whole, a fingertip is wholly on the last joint).
- [ ] **Step 2: Run**; expect FAIL. **Step 3: Implement.** **Step 4: Run**; expect PASS. **Step 5: Commit.**

### Task 3: `scripts/hands-extend.mjs`

**Files:**
- Create: `scripts/hands-extend.mjs`, `scripts/hands-extend.test.mjs`

**Interfaces:**
- `extendHands(doc, { names = CANON }) → { L, R, forearm: bool, changed: bool }`: on a gltf-transform document, adds the finger nodes (and `LeftForeArmTwist`/`RightForeArmTwist`, Task 8) under each hand, their inverse bind matrices, extends every skin’s joint list, rewrites `JOINTS_0`/`WEIGHTS_0` on the touched vertices, writes `extras.hands`; a document already extended returns `changed: false` and writes nothing
- CLI: `node scripts/hands-extend.mjs <file.glb> [<file.glb> …] [--dry] [--list]`; `--list` prints what each hand was read as and why one was skipped

- [ ] **Step 1: Write the failing tests**: on a document built from `meshyRig.fixture.js` plus a synthetic skinned hand mesh (the fixture gains `withHandMesh()` returning positions and skin attributes for both hands): the output has 24 + 28 + 2 joints (a thumb has two), every new bone named as `CANON` names it, every new bone’s rest quaternion is the canonical frame to within 1e-4, weights sum to one on every vertex, a second `extendHands` on the result changes nothing (`changed: false`, bytes equal after `io.writeBinary`), and the body clips’ tracks are untouched.
- [ ] **Step 2: Run**; expect FAIL. **Step 3: Implement.** Meshopt: decode on read, re-encode on write as `scripts/meshy-actions.mjs` does. **Step 4: Run**; expect PASS.
- [ ] **Step 5: Run the CLI** on `public/models/galaxy/crew/luke.glb`, `public/models/galaxy/troops/stormtrooper.glb`, `public/models/middleearth/cast/aragorn.glb`, `public/games/meshy/rick.glb`, `public/models/invincible/mark.glb` with `--list` first, then for real. Quote each file’s size before and after in the commit.
- [ ] **Step 6: Commit** (the script, its test, the five files).

### Task 4: `src/lib/three/handPoses.js` and `hands.js`

**Files:**
- Create: `src/lib/three/handPoses.js`, `src/lib/three/hands.js`, `src/lib/three/hands.test.js`

**Interfaces:**
- `handPoses.js`: `POSES: { open, relaxed, fist, grip, trigger, point, thumbs, flat, spread }`, each `{ thumb: [c1, c2], index: [c1, c2, c3], middle, ring, pinky, spread }` in radians; `gripFor(radius, hand) → pose` (the curl a cylinder of that radius wants, from the finger’s length); `mix(a, b, k) → pose`
- `hands.js`: `HAND_ROLES` (canonical, Mixamo, Unreal, Rigify, High Moon names by finger and joint); `createHands(model, { bones = null, palm = null }) → { has, set(side, pose | { from, to, k }, { rate = 14 } = {}), hold(side, radius), release(side), after(dt), curl(side) → { index: [...], … } (read back, for the check), dispose }`; `NO_HANDS`; `after` is called once a frame after the animator’s `after` (or after `rig.js`’s `tick` on a posed figure) and lays the eased pose on in the canonical frame; the per-bone canonical turn is found once from the bone’s line to its child and the hand’s palm normal (`ik.js`’s `palmFrame` on the hand bone’s vertices when `palm` is not given)

- [ ] **Step 1: Write the failing tests** on the fixture with fingers: `fist` closes every joint by the table; `open` straightens them; a mitten (fixture `fingers: 'mitten'`) takes the four fingers’ mean curl; `set` with `rate` eases (half-way after `ln 2 / rate` seconds); `NO_HANDS` on a figure without fingers is returned and does nothing; a Mixamo-named fixture finds its bones through `HAND_ROLES`.
- [ ] **Step 2: Run**; expect FAIL. **Step 3: Implement.** **Step 4: Run**; expect PASS. **Step 5: Commit.**

### Task 5: the layer under the animator and `rig.js`

**Files:**
- Modify: `src/lib/three/animator.js` (`MESHY_MASKS.upper` gains the canonical finger names; `posed`/`saved` take them in; `createAnimator` takes `hands` and calls `hands.after(step)` at the end of `after`; `idles` drifts `relaxed`↔`open` by seed when still), `src/lib/three/rig.js` (`figure()` makes `createHands` on its model and exposes `hands`; `POSES.punch`/`windup`/`guard` carry `hands`; `tick` calls `hands.after` last), `src/lib/three/figureCalls.js` (`react` passes a reaction’s `hand` to the hands: `hit` → `fist`, `wave`/`cheer` → `open`), `src/lib/ai/react.js` (the table gains `hand` per row where it fits), `src/lib/emote.js` (each emote names a hand pose), `src/components/rickmorty/portal/meshyCast.js` and `src/components/universe/footScene.js` and `src/components/galaxy/surface/crew.js` (each adapter exposes `hands` from its animator, nothing else)
- Test: `animator.test.js` (a finger at rest after two updates with no layer; an upper clip with a finger track lays it), `rig.test.js` (`punch` makes a fist), `figureCalls.test.js`

- [ ] **Step 1: Write the failing tests.** **Step 2: Run**; expect FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/lib`; expect PASS.
- [ ] **Step 5: Browser**: `#/galaxy/tatooine/surface` and `#/c-137`: `anim-check` as today, unchanged numbers. **Step 6: Commit.**

### Task 6: the grips

**Files:**
- Modify: `src/components/universe/gunplay.js` (`createGunplay` takes `fig.hands`; when `hands.has`, `hold('R', grip radius)` and `trigger` on fire, `hold('L', foregrip radius)` under `holdLeft`, `release` on `drop`; the `gripMorphs` path only when `!hands.has`), `src/components/galaxy/surface/saber.js` and `heldBlade.js` (both hands `hold` on the hilt’s radius; `release` on throw)
- Test: `gunplay.test.js` / `saber.test.js` (a figure with hands never builds a morph; one without still does)

- [ ] **Step 1: Write the failing tests.** **Step 2–4** as above.
- [ ] **Step 5: Browser**: the galaxy surface with a pistol, a rifle and a saber on Luke; the universe on foot with the blaster; shots at the hands.

### Task 7: `scripts/hands-sheet.mjs`

**Files:**
- Create: `scripts/hands-sheet.mjs`, `scripts/preview/hands.html`
- Create: `docs/superpowers/evidence/rigging/hands-real.png`, `hands-toy.png`, `hands-show.png`

**Interfaces:**
- `scripts/preview/hands.html?figure=<url>&poses=open,relaxed,fist,grip,trigger,point,thumbs&held=pistol,rifle,saber`: the figure on `rig.js`, each pose a frame, the camera close on both hands; `window.__hands` exposes `curl` for the check
- CLI: `node scripts/hands-sheet.mjs <family> <figure.glb> [--out png]` (Vite on 5188 as `scripts/surface-shot.mjs` does; `CHROME=` Edge on Windows)

- [ ] **Step 1–3**: the page, the script, the three sheets (Luke; Aragorn; Rick). Look at each: fingers close round the grip, the thumb on top, no tear at the wrist; the fist is a fist; `relaxed` reads as a hand at rest.
- [ ] **Step 4: Commit** the sheets and open the Phase 1 PR with them.

### Task 8: the forearm twist

**Files:**
- Modify: `scripts/hands-extend.mjs` (the twist bone and its linear weights, Task 3’s interface already names it), `src/lib/three/hands.js` (`after` reads the hand’s roll about the forearm axis, turns the twist bone by half; a rig with `lowerarm_twist_01_l` is driven the same)
- Test: `hands.test.js` (a hand rolled π/2 turns the twist π/4; no roll, no turn), `hands-extend.test.mjs` (the twist’s weights linear from elbow to wrist)

- [ ] **Steps 1–4** as above; re-run Task 3’s CLI on the five figures (idempotent on the fingers, adds the twist); the saber sheet before and after in the PR.

---

## Phase 2: every figure, and the library’s fingers

### Task 9: the batch

- [ ] Run `node scripts/hands-extend.mjs --list` over every `meshy24` row of the audit; record the skipped hands and why in `docs/superpowers/evidence/rigging/extend-skipped.md`.
- [ ] Run it for real; `node scripts/rig-audit.mjs` must now show every Meshy figure as `meshy54` or in the skipped list; set `EXPECTED` for them; `audit-after-p2.md`.
- [ ] Measure the Citadel (`#/c-137` and `#/citadel`) and Edoras at `quality=high`: `renderer.info` and the frame time over 10 s, before and after, in the PR.
- [ ] Commit in groups by folder (the galaxy, Middle-earth, Rick and Morty, the rest) so a review can read each.

### Task 10: `ual-bake` carries the fingers

**Files:**
- Modify: `scripts/preview/ualRetarget.js` (`UAL_MAP` + 30 finger rows, `UE_NAMES` + 30, `AIM` + the chains, `ORDER` + the names after each hand; `targetMap` finds fingers by `HAND_ROLES`), `scripts/ual-bake.mjs` (the `life`/`pro`/`ual2`/`sword`/`core` sets write finger tracks when the target has them)
- Test: `ual-bake.test.mjs` (against the unextended fixture every set’s bytes are what they were; against the extended fixture each clip gains exactly the finger tracks and its body tracks are byte-identical), `ualRetarget` tests on the fixture with fingers (a closed UAL fist lands as a closed canonical fist within 0.05 rad)

- [ ] **Steps 1–4** as above. Fetch the packs: `node scripts/assets-fetch.mjs ual1 ual2` (the release zips), or `--repo` from the assets repo; the free Godot pack is still needed for the `life` set (`scripts/preview/.ual/ual.glb`, the owner has it; ask if not).
- [ ] Re-bake every set against the extended Luke; `ls -l public/games/meshy/ual-*.glb` before and after, the total in the PR (under 5.5 MB).
- [ ] Browser: a talk on Tatooine’s cantina, a sit on the Citadel: the hands move. The hand sheet for `talk` and `sit.idle` frames.

---

## Phase 3: the crouch

### Task 11: the stance in `locomotion.js`

**Files:**
- Modify: `src/lib/three/locomotion.js` (`createLocomotion` takes `act.crouch`, `act['crouch.walk']` …; `update` reads `m.crouch`, blends the stance set by heading, measures its strides, hands a missing clip’s weight on, scales `drop` by the clip’s hips and clamps it by `legLen × dropK`; weights still sum to one), `src/lib/three/animator.js` (the stance clips fetched from the library on first `m.crouch > 0`, as a base state’s are), `src/lib/three/clipLibrary.js` (the seven crouch rows gain `stance: 'crouch'` and a `heading`), `src/lib/ai/body.js` (`cover: { crouch: 1 }`; `rise` to a stance change), `src/components/galaxy/surface/hostiles.js` (reads `crouch` from the body, keeps `STILL`/`SETTLE`)
- Test: `locomotion.test.js` (weights sum to one for every subset of the seven; a crouch ahead paces its stride; a diagonal turns the hips; `drop` clamped), `body.test.js`, `hostiles.test.js`

- [ ] **Steps 1–4** as above.

### Task 12: the player’s crouch, world by world

**Files:**
- Modify: `src/components/galaxy/surface/walker.js` (`WALK.crouch = 1.6`, `crouchH = 1.15`, `crouchEyes = 1.0`; `walk()` takes `input.crouch`, shortens the capsule, stands only with headroom) and `scene.js` (bind `crouch: ['KeyC']`, a pad’s right-stick press, the HUD kit’s touch button; the camera’s eye by `crouchEyes`; `motion.crouch` to the figure; the packet’s bit in `peers.js`), `src/components/universe/footScene.js` (the same three numbers and key), `src/components/rickmorty/world/scene.js` and its rules, `src/components/invincible/world/scene.js` (on the ground only), `src/components/middleearth/towns/*` through `cast3d.js`’s `want.crouch` (now the stance), `src/components/guide/pages.js` (one line: C Crouch)
- Test: each world’s `rules.test.js` (crouched height, speed, standing waits for headroom), `peers.test.js`

- [ ] **Steps 1–4** as above, a world at a time, a commit each.
- [ ] **Browser**: `anim-check --crouch --do 'key:KeyC'` on each world’s route; shots crouched behind a crate on Tatooine, crouch-walking sideways in the Citadel, under a table in the Shire.

---

## Phase 4: the families

### Task 13: `src/lib/three/figureStyles.js` and the retarget’s scale

**Files:**
- Create: `src/lib/three/figureStyles.js`, `figureStyles.test.js`
- Modify: `src/lib/three/clipLibrary.js` (`forFigure` takes `profile`/`family`; `exaggerate` about each track’s rest; `snap` on one-shots), `src/lib/three/rig.js` and `footScene.js`’s `rigScene` and `crew.js` (read `userData.profile`, pass the family), `src/lib/debugPanel.js` (a `figures` group with the family numbers)
- Test: `figureStyles.test.js` (`familyOf`: Luke’s profile → `real`, Aragorn’s → `toy`; `real` is the identity: `forFigure` on the fixture under `real` equals today’s `retarget` byte for byte), `clipLibrary.test.js`

- [ ] **Steps 1–4** as above.

### Task 14: the reach guard

**Files:**
- Modify: `src/lib/three/animator.js` (`after` ends with the guard when the family’s `reach` says so: each hand against the head sphere and chest capsule from the profile, pushed out by `ik.js`’s `reach`, eased)
- Test: `animator.test.js` (a hand put inside the head is outside after `after`; one outside is untouched; `real` runs no guard)

- [ ] **Steps 1–4**; the hand sheet for `toy` with `wave` and `phone` before and after; `anim-check --reach` on the Shire, Bree and Edoras.

---

## Phase 5: the game rips

### Task 15: the core set by role, with fingers

- [ ] `node scripts/ual-bake.mjs --rig public/models/sketchfab/avengers/thor.glb --into … --set core` (and the Hulk, Spider-Man, Mario), each with its finger tracks on its own names; `people.js` and `mario-hd.js` play them through an animator as `modelFigureOf` does, `rig.js`’s poses over them; `HAND_ROLES` covers each; Cybertron’s robots get `createHands` alone.
- [ ] Sheets: `hands-game.png`; `anim-check` on `#/avengers`, `#/dot-matrix/64`, `#/cybertron`.

---

## Checks (every phase)

- [ ] `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.
- [ ] `node scripts/rig-audit.mjs` before and after, saved under `docs/superpowers/evidence/rigging/`.
- [ ] `anim-check` on every route the phase touches, with the phase’s flag; the sheets in the PR.
- [ ] The hand-off’s status table updated; findings under it.
