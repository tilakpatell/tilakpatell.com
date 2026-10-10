# Battlefront 2017, lane B: phase 3, the beasts and their riders. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** The dewback, bantha, eopie, ronto, Jawa and aiwha the worlds place are the game's bodies on the game's skeletons playing the game's clips, the tauntaun's rider rides on the game's rider clips with hands on the reins and feet in the stirrups the skeleton names, and the ronto carries its Jawa.

**Architecture:** Phase 2's own-rig path, six more rigs: `OWN_RIGS` rows name each rig's clips under the site's names, `bf2017-clips.mjs <rig>` packs them from the body's light cut, `crewList.js` rows with `rig: 'own'` take the kinds over by name. Riders gain `seatFromBones` (the beast's `Reins`/`Stirrups`/`Saddle` bones) and a `ride.<beast>.*` clip set on the humanoid pack chosen by the beast's gait.

**Tech Stack:** `scripts/bf2017-import.mjs`, `scripts/bf2017-clips.mjs`, `src/lib/three/ownRig.js`, `walrusClips.js`, `surface/riders.js`, `rides.js`, `actors.js`, Vitest, `galaxy-check.mjs`, `anim-check.mjs`, `rig-shot.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-cast-left-design.md` (§1.4, §3 lane B).

## Global Constraints

- Phases 0 to 2's Global Constraints (the rig whole, the game's clips only, no sequel era, the caps: plain 16 MB, light 5 MB; `--native`; the budgets' rows unmoved).
- Every kind: `--rig --crew --full --join --no-walrus-check --metres <tall>`; the dewback and the eopie `--parts '*_saddle_mesh'`; the bantha `--cuts plain=1`; all six `--lod1-tex 512 --lod1-maps 256` (Tatooine is over on MB at low already: 27.9 against 20; this lane adds nothing to it).
- The kind names do not change: `dewback`, `bantha`, `eopie`, `ronto`, `jawa`, `aiwha` as the sites place them; their Sketchfab/Meshy catalogue rows go in the same commit as their crew rows arrive.
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines; merge commits.

## Review Focus

1. **The eopie has no walk**: a site row with `roam > 0` must not slide it about; `actors.js` reads the row's `still: 'fidgets'` and holds it (task 2's test: `motionFor(row, spec)` → `{ roam: 0 }`).
2. **A beast with no `die` clip** (all but the tauntaun): `react('down')` must resolve to `hit.chest` and `activity.js`'s tip, never a silent bind pose (task 1's test on `clipFor`/`CLIP_FALLBACK`).
3. **The aiwha's path climbs**: `pickBase({ speed: 8, climb: 3 }, 0, set)` → `fly.up`; `climb: -3` → `fly.down`; `speed: 0` → `idle`.
4. **A rider on a beast whose bones are missing** (a world's kaadu, a Meshy model): `seatFromBones` → null and `SEATS[kind]` applies, as today.
5. **Two rigs, one skeleton name suffix**: `Ewok_01_Ske` exists under `Characters/Hero/Ewok` and `Characters/NPC/Creatures/Ewok`; `skeletonsFor(pack)` matches the full path for the new rigs (`OWN_RIGS[rig].skeleton` holds the suffix today; the test asserts the dewback's pack takes clips from `Dewback_01_Ske` only).

---

### Task 1: Six rigs named

**Files:**
- Modify: `src/lib/three/walrusClips.js` (`OWN_RIGS.dewback`, `.bantha`, `.eopie`, `.ronto`, `.jawa`, `.aiwha` with the sets in the spec §3 lane B), `src/lib/three/walrusRig.js` (`CLIP_FALLBACK`: `die` → `hit.chest` when a rig has no `die`; `fly` family: `fly.up`/`fly.down`/`fly.start`/`fly.end` → `fly` → `walk`)
- Test: `src/lib/three/walrusClips.test.js`

- [ ] **Step 1: Failing tests**: each new rig's set has `idle` and `hit.chest`; dewback, bantha, ronto, jawa have `walk` and `run`; eopie has no `walk`; aiwha has `fly`, `fly.up`, `fly.down`; `resolveClip('die', has)` on a set without `die` → `'hit.chest'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Six beasts' rigs named under the site's clip names`.

### Task 2: The bodies, the packs, the rows

**Files:**
- Create: `public/models/galaxy/bf2017/crew/{dewback,bantha,eopie,ronto,jawa,aiwha}.lod1.glb` (+ the plain cuts to `site-assets`), `public/models/galaxy/bf2017/clips-{dewback,bantha,eopie,ronto,jawa,aiwha}.glb`, `docs/superpowers/evidence/bf2017-phase3/sheets/*.webp`
- Modify: `src/components/galaxy/surface/crewList.js` (six rows: `rig: 'own'`, `ownRig`, `tall` from the manifest box, `lod: true, full: true, fullMB, fullDL`; the eopie `still: 'fidgets'`; the aiwha `walk: 'fly'`), `src/components/galaxy/surface/actors.js` (`motionFor`: a crew row with `still: 'fidgets'` → `roam: 0`; the path follower sets `motion.climb`), `src/lib/three/ownRig.js` (`pickBase` reads `set.walk === 'fly'` → by `motion.climb`: above 0.5 m/s `fly.up`, below −0.5 `fly.down`, else `fly`), `src/components/galaxy/surface/catalog/desert.js`, `fill.js`, `library.js` (the six old rows removed), `scripts/galaxy-figures-audit.mjs` (`EXPECTED`: six `own-rig`)
- Test: `src/lib/three/ownRig.test.js`, `src/components/galaxy/surface/actors.test.js`

- [ ] **Step 1: Failing tests**: Review Focus 1 and 3; `figureLoaderFor({ rig: 'own' })` → `'own'` for each row.
- [ ] **Step 2: Run** → FAIL. **Step 3: Import** (one line a kind, from `cast.md`'s names in the spec table; the body's manifest name first, parts after); `node scripts/bf2017-clips.mjs <rig>` × 6; `node scripts/assets-publish.mjs --only 'models/galaxy/bf2017/crew/<kind>.glb'` × 6; `assets-check`. **Step 4: Run** → PASS; `node scripts/galaxy-figures-audit.mjs` green.
- [ ] **Step 5: Look**: `rig-shot.mjs public/models/galaxy/bf2017/crew/<kind>.lod1.glb <kind> /tmp/<kind>.png idle,walk,hit.chest` × 6 (the aiwha `idle,fly,fly.up`); the sheets into the evidence folder beside the old figure's.
- [ ] **Step 6: Commit** `The beasts of Tatooine and Kamino from the game, on their own rigs`.

### Task 3: The rider on the game's seat and clips

**Files:**
- Modify: `src/components/galaxy/surface/riders.js` (`seatFromBones(fig, frame) → seat | null`: hands at `Reins`, feet at `LeftStirrups`/`RightStirrups`, hips at `Saddle` else 0.35 m over `Spine2`'s world position, the lean 0.18, the bend directions `SEATS.tauntaun`'s; in the ride's frame given by `frame` (the beast model's inverse world matrix); `poseRider` accepts a `seat` per call), `src/lib/three/walrusClips.js` (`HUMANOID_SET`: `ride.tauntaun.idle/walk/run/sprint/jump/brake/hit` as the spec names them, `hit` additive), `src/components/galaxy/surface/rides.js` (`riderClipFor(beastBase) → 'ride.tauntaun.<idle|walk|run|sprint>'`; the scene plays it on the rider's `full` layer when the beast's `baseName` changes; the ride's `seat` from `seatFromBones` when it answers), `scripts/bf2017-clips.mjs` (nothing: the humanoid pack is rebuilt with `node scripts/bf2017-clips.mjs humanoid`; its size stays under 3 MB, said in the PR)
- Test: `src/components/galaxy/surface/riders.test.js`, `rides.test.js`

- [ ] **Step 1: Failing tests**: `seatFromBones` on a fake tree with the three bones at known world positions → the seat's `hands[0]`, `feet[0]`, `hips` in the ride's frame; without `Reins` → null (Review Focus 4); `riderClipFor('run')` → `'ride.tauntaun.run'`, `riderClipFor('idle')` → `'ride.tauntaun.idle'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; rebuild the humanoid pack. **Step 4: Run** → PASS.
- [ ] **Step 5: Look**: `anim-check.mjs --route '#/galaxy/hoth/surface'` mounted on the tauntaun (`--do "__surface.mount('tauntaun')"`, a hook the scene exposes in DEV) at walk and run: the rider's hands within 0.1 m of `Reins`, printed by the check; a shot in the evidence folder.
- [ ] **Step 6: Commit** `The tauntaun's rider rides on the game's clips, hands on the reins`.

### Task 4: The ronto's Jawa

**Files:**
- Modify: `src/components/galaxy/surface/actors.js` (a life row's `rider: 'jawa'` on a beast kind makes a second figure of that kind, played `seat.ronto`, parented at the beast's `Saddle` bone with `poseRider` off: the clip is the game's seated pose), `src/components/galaxy/surface/sites/desert.js` (Tatooine's ronto at `[330, -250]`: `rider: 'jawa'`)
- Test: `src/components/galaxy/surface/actors.test.js`

- [ ] **Step 1: Failing test**: `ridersOf(life)` → `[{ host: 'ronto', kind: 'jawa', clip: 'seat.ronto' }]` for that row.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `anim-check` on Tatooine: the Jawa at 0 m/s drift against the saddle.
- [ ] **Step 5: Commit** `A Jawa drives the ronto, as the game sits one`.

### Task 5: The cost, the PR, the hand-off

- [ ] `galaxy-check.mjs surface tatooine` and `kamino` with `BUDGET=1` at `QUALITY=high` and `low`, before (main) and after; both tables in the PR; Tatooine's MB at low not above 27.9.
- [ ] `anim-check.mjs --route '#/galaxy/tatooine/surface' --limit 0.15 --strict --quality high` and Kamino's; green.
- [ ] Gates (`npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; restore the regenerated files); the hand-off's lane B row (Done; Left: the dwarf spider's walk, the Ewok's hood after lane D, the bantha's saddle the drop lacks); merge `origin/main`, push, PR `Phase 3: the beasts and their riders from Battlefront II (2017)`. Merge per the slot.
