# Battlefront 2017, lane H: hurtboxes for every own rig. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Every figure on a rig of its own is hit where its body is: the game's capsule set where the game has one (the tauntaun's, the Ewok's and the AT-RT's join `bones.json`), and a set fitted from the body's own skin weights where it has none.

**Architecture:** The bone-set extractor scans the whole data tree, not `Gameplay/Characters/` only. A new fitter reads a kind's committed light cut and writes a `bones.json` set in the same row shape from the skinned vertices per bone. `boltPlay.js` already picks a set by the figure's skeleton name; a walker figure learns to carry its skeleton name.

**Tech Stack:** `scripts/bf2017-bolts-data.mjs`, `scripts/lib/bf2017-physics-rules.mjs`, `@gltf-transform/core`, `src/lib/physics/boneCapsules.js`, `surface/boltPlay.js`, Vitest, `scripts/physics-check.mjs` (desktop, `ANGLE=d3d11`).

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-cast-left-design.md` (§1.3, §3 lane H).

## Global Constraints

- The game's set always wins where both exist: `sets` keeps the game's rows first and `boltPlay.js` takes the first match by skeleton suffix.
- No sequel era: `AstromechBBBoneCollision` (BB-8's skeleton) is left out by `isSequel` on its skeleton path.
- A fitted row's every number carries `_source: 'fitted from <file> (<n> vertices)'`; the set's `id` is `fitted_<rig>`; `NOTES.md` says which sets are fitted and the rule.
- The export's `data/` is read locally (`--root <export>/web`) as lane P2 did; survey before any key is in the chat (the classifier's rule).
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines; merge commits.

## Review Focus

1. **A bone with almost no weight** (a finger, a hydraulic): under `minWeight` 0.02 of the skin's total it gets no capsule, else a dewback has 59 capsules and a bolt test costs 59 segment checks a figure; the test counts the tauntaun's fitted set under 20.
2. **A leaf bone** (the head, a tail tip) has no child to run to: its axis is the mean offset of its vertices from the bone, its length that mean's magnitude; the test on a two-bone fixture checks the leaf's capsule points into its vertices.
3. **A quantised cut**: the light cuts are `KHR_mesh_quantization`; the fitter dequantises first, else radii are in quantised units; the test asserts a radius in metres (the tauntaun's head between 0.1 and 0.5).
4. **A walker's skeleton name**: `loadOwnRigFigure` returns `skeleton: RIGS[rig].skeleton.split('/').pop()`, so the AT-RT's game set and the AT-AT's fitted set are found; the test asserts it.
5. **Reactions by name**: `Neck1` → `HRT_Head`? No: the game's tauntaun set says `HRT_Body` for `Neck1`. The rule maps `Head|HeadEnd` → `HRT_Head`, `Neck*` → `HRT_Body`; the test asserts both.

---

### Task 1: The whole tree's sets (done in PR #840, from the design session; read it, then go to task 2)

**Files:**
- Modify: `scripts/bf2017-bolts-data.mjs` (the bone-set pass walks every `data/**/*.json(.gz)` whose raw text contains `"SkeletonCollisionData"`, as the `isBones` check at line 542 does, over the whole tree; sequel skeletons dropped), `src/data/bf2017/physics/bones.json` (regenerated: + `tauntaunbonecollision`, `heroewokbonecollision`, `atrtbonecollision`), `src/data/bf2017/physics/NOTES.md`
- Test: `scripts/lib/bf2017-physics-rules.bolts.test.mjs` (a fixture of `TauntaunBoneCollision` under `scripts/fixtures/bf2017/data/Characters/NPC/Creatures/Tauntaun/Tauntaun_01/`)

- [ ] **Step 1: Failing test**: `boneSetRow` on the tauntaun fixture → 8 bones with `Tail2`; the data pass over the fixture tree finds it outside `Gameplay/Characters/`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; `node scripts/bf2017-bolts-data.mjs --root C:/Users/tilak/Downloads/BF2_Extract/web` regenerates `bones.json` (13 sets). **Step 4: Run** → PASS; `src/data/bf2017/physics/rulebook.test.js` green.
- [ ] **Step 5: Commit** `The game's hurtbox sets for the tauntaun, the Ewok and the AT-RT`.

### Task 2: The fitter

**Files:**
- Create: `scripts/lib/hurtbox-fit.mjs` (`fitCapsules(doc, { skeleton, minWeight = 0.02, percentile = 0.9 }) → { id, skeleton, bones: [row…], _source }`), `scripts/lib/hurtbox-fit.test.mjs`, `scripts/bf2017-hurtboxes.mjs` (`node scripts/bf2017-hurtboxes.mjs <kind>…`: reads `crewList.js`'s row (or `RIGS[rig]` for a walker) for the light cut and the skeleton path, fits, appends or replaces the `fitted_<rig>` set in `bones.json`, prints the capsule count and the biggest radius)
- [ ] **Step 1: Failing tests**: Review Focus 1, 2, 3, 5 (the hilt fixture skinned to two bones in the test, as phase 2 made fixtures; the committed tauntaun light cut for the metres check; the game's tauntaun set from task 1 for the sanity bound: the fitted `Head` radius within 50% of the game's).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (dequantize → per vertex: weights over the four joints, the bone's rest world matrix inverted, the vertex in bone space; per bone: the axis to the heaviest child's rest position (or the leaf rule), the radial distance's `percentile`). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A hurtbox set fitted from a body's own skin`.

### Task 3: The sets written, and the walkers named

**Files:**
- Modify: `src/data/bf2017/physics/bones.json` (fitted sets for: `probe` (`Viper_01_Ske`), `astromech` (`Astromech_01_Ske`), and, as lanes B, Y and I land their bodies: dewback, bantha, eopie, ronto, jawa, aiwha, gonk, interrogation, mouse, dwarfspider, grievous; the walkers `atat`, `atst`, `atte` from their committed light cuts; each kind one line in `NOTES.md`), `src/lib/three/ownRig.js` (`loadOwnRigFigure` returns `skeleton`; Review Focus 4), `src/components/galaxy/surface/walkers.js` (the figure's `skeleton` reaches `boltPlay` through `activity.js`'s target as a crew figure's does)
- Test: `src/lib/three/ownRig.test.js`, `src/components/galaxy/surface/boltPlay.test.js` (a target with `fig.skeleton = 'ATRT_Ske'` picks `atrtbonecollision`; `fig.skeleton = 'Dewback_01_Ske'` picks `fitted_dewback`)

- [ ] **Step 1: Failing tests** as above. **Step 2: Run** → FAIL. **Step 3: Implement**; run the fitter for every kind whose light cut is on main at the time (the rest when their lanes merge: the hand-off's row says which). **Step 4: Run** → PASS.
- [ ] **Step 5: Look** (desktop): `scripts/physics-check.mjs` with a shot at Hoth's tauntaun and probe: the hit's `region` is a bone name; the console's capsule debug draw (`__surface.hurtboxes(true)`, a DEV hook the lane adds if there is none) over the dewback on Tatooine; a shot into `docs/superpowers/evidence/bf2017-hurtboxes/`.
- [ ] **Step 6: Commit** `Every own rig is hit where its body is`.

### Task 4: The PR and the hand-off

- [ ] Gates; the hand-off's lane H row (Done: the sets by name, game's and fitted; Left: the kinds whose bodies were not yet on main when the fitter ran; a `fitted_*` set is replaced by the game's if one turns up); merge `origin/main`, push, PR `Hurtboxes for every own rig: the game's sets where it has them, fitted from the skin where not`. Merge per the slot.
