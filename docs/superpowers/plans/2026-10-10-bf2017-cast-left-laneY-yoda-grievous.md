# Battlefront 2017, lane Y: phase 10, Yoda and Grievous on their own rigs. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Yoda and General Grievous join the hero roster as the game's bodies on their own skeletons, fencing from their stroke tables with their own 101 and 161 clips, Grievous's second blade in the game's `Wep2_Root` socket, their kits' powers on G and V.

**Architecture:** The own-rig body loader learns sockets (`Wep_Root`, `Wep2_Root`, `Wep_Aim`, the hands) so a hero on a rig of its own holds a saber the way a walrus hero does; `OWN_RIGS.yoda` and `.grievous` carry hero sets built from `HERO_SET` restricted to what each skeleton has plus their own clips; the roster, the duellists and the ability rules read them by id as they read the walrus heroes.

**Tech Stack:** `scripts/bf2017-import.mjs --hero --no-walrus-check`, `bf2017-clips.mjs`, `src/lib/three/ownRig.js`, `walrusClips.js`, `surface/heldBlade.js`, `duellists.js`, `stanceFromTable.js`, `abilityRules.js`, `galaxy/heroes.js`, Vitest, `rig-shot.mjs`, `anim-check.mjs`, lane X's duel shot script.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-cast-left-design.md` (§1.4, §3 lane Y).

## Global Constraints

- Phases 0 to 2's and lane X's Global Constraints; the rig whole; the game's clips only; `--native`; the caps.
- Yoda: `characters/hero/yoda/yoda_01/yoda_01_mesh` with `--parts 'characters/hero/yoda/yoda_01/yoda_01_robe_skinned_mesh'`, `--metres 0.66`, pack `yoda`; Grievous: `characters/hero/generalgrievous/generalgrievous_01/generalgrievous_01_mesh`, `--metres 2.16`, pack `grievous`; both `--rig --hero --crew --full --join --no-walrus-check`.
- The stroke tables are `src/data/bf2017/strokes/yoda.json` and `grievous.json` (on main, lane X): this lane does not rewrite them.
- Numbers for the abilities come from `src/data/bf2017/heroes.json`'s kits where they exist; where not, the hand-off's stand-in rule (`abilityRules.js` names each).
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines; merge commits.

## Review Focus

1. **Grievous has no `IK_Joint_RightHand`**: `socketsOf` for an own rig falls back to `RightHand`/`LeftHand`; the test on his committed light cut asserts `sockets.handR` is a bone.
2. **A `HERO_SET` name his skeleton cannot play** (`sword.light.*`'s `AttackLoop_Strike1..6`: Grievous has four strikes): the pack builder prints it as "nothing for" and the loader falls back (`CLIP_FALLBACK`), never a frozen pose; `anim-check` on a duel asserts no bind pose.
3. **Yoda's height** (0.66 m): the camera, the walker's eye height and the saber's reach read `tall`; the duel's contact window from his table must still land on Luke's capsules: lane X's duel shot script with Yoda against Luke lands a hit in 20 s.
4. **Two blades**: `bladeInHand` with `sockets.weapon2` puts the second hilt there; a hero with `stance: 'dual'` and no `weapon2` (Ahsoka) keeps the `LeftHand` hilt.
5. **A duellist spawn of `yoda` or `grievous`** (`duellists.js` by kind): the own-rig body's `skeleton` reaches `boltPlay.js`, so Yoda is hit by his game set and Grievous by lane H's fitted set or the one capsule.

---

### Task 1: Sockets on an own rig

**Files:**
- Modify: `src/lib/three/ownRig.js` (`loadOwnRigBody` returns `sockets: { weapon, weapon2, muzzle, aim, handL, handR }` by `walrusRig.js`'s `SOCKETS` names plus `weapon2: 'Wep2_Root'`, the hands falling back to `LeftHand`/`RightHand`; null for a rig with no `Wep_Root`), `src/lib/three/walrusRig.js` (`SOCKETS.weapon2`)
- Test: `src/lib/three/ownRig.test.js`

- [ ] **Step 1: Failing tests**: a fake tree with `Wep_Root`, `Wep2_Root`, `RightHand` and no `IK_Joint_*` → `sockets.weapon2` and `sockets.handR` set (Review Focus 1); a tree with no `Wep_Root` → `sockets: null`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `An own-rig body says where its weapons hang`.

### Task 2: The two rigs, the bodies, the packs

**Files:**
- Modify: `src/lib/three/walrusClips.js` (`OWN_RIGS.yoda = { skeleton: 'Yoda_01_Ske', body: 'yoda', hero: true, set: { ...HERO_SET('Yoda'), 'force.absorb': 'A_Yoda_ForceAbsorb_Loop_01', 'force.barrier': 'A_Yoda_Air_ForceBarrier_01', 'sword.dash.a': 'A_Yoda_DashAttack_Strike1', 'sword.dash.b': …2, 'sword.dash.c': …3, die: 'A_Yoda_Defeated_01', 'die.land': 'A_Yoda_Defeated_Land_01' } }`; `OWN_RIGS.grievous` likewise with `HERO_SET('Grievous')` and `'sword.a': 'A_Grievous_AttackLoop_Strike1_01'` … `'sword.d'`, their `.rec` `_BackToIdle`, `'sword.blocked.left': ['A_Grievous_Stand_LightAttack_Blocked_Left_01', …]`, `'force.rush': 'A_Grievous_ClawRush_Fwd_Loop'`, `'force.rush.start'`/`.end`, `'force.surge': 'A_Grievous_ThrustSurge_Attack'`, `advance: 'A_Grievous_UnrelentingAdvance_Run_Loop'`, `'getup.belly': 'T_Grievous_GetUp_Belly_Fwd_01'`, `'getup.back': 'T_Grievous_GetUp_Back_Fwd_01'`, `'hit.chest': 'Add_Grievous_Stand_HitReact_Front_01'` (additive) …; `PACKS` takes them as it takes the other own rigs), `scripts/bf2017-clips.mjs` (an own rig with `hero: true` also measures `contact` and `root` on its strikes as a hero pack does; `skeletonsFor` matches the full skeleton path), `src/components/galaxy/surface/crewList.js` (`yoda`, `grievous`: `rig: 'own'`, `ownRig`, `pack`, `lod: true, full: true, fullMB, fullDL`)
- Create: the bodies and packs; sheets in `docs/superpowers/evidence/bf2017-phase10/`
- Test: `src/lib/three/walrusClips.test.js`, `scripts/bf2017-clips.test.mjs`

- [ ] **Step 1: Failing tests**: `RIG_SET('yoda')` has `idle`, `walk`, `run`, `sword.block`, `sword.light.a`, `die`; `RIG_SET('grievous')` has `sword.a`..`sword.d`, `force.rush`, `advance`; `skeletonsFor('yoda')` matches `Characters/Hero/Yoda/Yoda_01/Yoda_01_Ske` and not the humanoid's.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; import both (the Global Constraints' lines); `node scripts/bf2017-clips.mjs yoda` and `grievous` (print what each had nothing for into the PR); publish the full cuts. **Step 4: Run** → PASS.
- [ ] **Step 5: Look**: `rig-shot.mjs` on each light cut with `idle,walk,sword.a,die` (Yoda `sword.light.a`); sheets into the evidence.
- [ ] **Step 6: Commit** `Yoda and Grievous, the game's bodies on their own skeletons and clips`.

### Task 3: The roster, the hilts, the second blade

**Files:**
- Modify: `src/components/galaxy/heroes.js` (two `HEROES` rows as the spec §3 lane Y gives them; `HILTS` gains `grievous` with `model: 'hiltgrievous'`), `src/components/galaxy/surface/catalog/bf2017.js` (`hiltgrievous` from `gameplay/equipment/heroes/lightsabergrievous/lightsabergrievous_02_mesh`, imported as phase 1's hilts were), `src/components/galaxy/surface/heldBlade.js` (`bladeInHand`: the second hilt in `sockets.weapon2` when the figure has it, else `LeftHand`), `src/components/galaxy/surface/crew.js` (a crew row with `rig: 'own'` and a `pack` loads its own pack as a hero's, through `loadOwnRigBody`'s `packs`), `src/components/galaxy/surface/duellists.js` and `stanceFromTable.js` (nothing new if the table lookup is by hero id; the lane checks and says so)
- Test: `src/components/galaxy/heroes.test.js`, `heldBlade.test.js`

- [ ] **Step 1: Failing tests**: `readHero({ id: 'yoda' })` → a hero with `saber.hilt === 'yoda'`; `readHero({ id: 'grievous' })` → `saber.stance === 'dual'`; `bladeInHand` on a fake figure with `sockets.weapon2` parents the second hilt there (Review Focus 4).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Look**: lane X's duel script (`docs/superpowers/HANDOFF-bf2017.md`, lane X's "Checking it") with Yoda against Luke and Grievous against Obi-Wan on Dagobah's or Kashyyyk's surface; both land a hit within 20 s (Review Focus 3); the two sockets of Grievous within 0.2 m of his front hands at the idle, measured in the console and said in the PR.
- [ ] **Step 6: Commit** `Yoda and Grievous in the roster, Grievous's second blade in the game's socket`.

### Task 4: The powers

**Files:**
- Modify: `src/components/galaxy/surface/abilityRules.js` (`yodaAbsorb`: a held guard that takes bolts for its clip's loop, numbers from the kit's `Ability_Yoda_ForceAbsorb` where `heroes.json` has them; `yodaDash`: `sword.dash.a..c` as a rush of the clip's root travel; `grievousSurge`: `force.surge`, a lunge by root travel; `grievousRush`: `force.rush` for its loop's seconds; `CLIPS_OF` rows for the four)
- Test: `src/components/galaxy/surface/abilityRules.test.js`

- [ ] **Step 1: Failing tests**: each of the four kinds has a `CLIPS_OF` row naming a clip the rig's set has; `yodaDash`'s distance equals the clip's `root` travel from the pack (read by the test from the committed pack's `userData`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Yoda's absorb and dash, Grievous's thrust surge and claw rush`.

### Task 5: The checks, the PR, the hand-off

- [ ] `anim-check.mjs --route '#/galaxy/dagobah/surface' --limit 0.15 --strict --quality high` with Yoda picked (`?hero=yoda`) and Kashyyyk's with Grievous; `galaxy-check.mjs surface dagobah` with `BUDGET=1` before and after (no world's counts should move: the heroes load only when picked; say so with the numbers).
- [ ] `scripts/galaxy-figures-audit.mjs`: `EXPECTED` `yoda`, `grievous` → `own-rig`.
- [ ] Gates; the hand-off's lane Y row (Done; Left: Yoda's hood outfit `yoda_hood_01`, Grievous's `_02` and `_03` outfits as `SKINS`, lane H's set for Grievous); merge `origin/main`, push, PR `Phase 10: Yoda and Grievous from the game, on their own rigs`. Merge per the slot.
