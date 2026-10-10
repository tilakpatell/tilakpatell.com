# Battlefront 2017, lane I: the Death Star interior's cast from the game. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Everyone aboard the two Death Stars that the game has is the game's figure: the stormtrooper, the shadowtrooper as the Death Star trooper, the navy crewman as gunner and technician, the officer and the admiral, the personnel, Luke, Han, Leia, Vader and the Emperor, the gonk, the mouse droid, the astromechs and the interrogation droid, each on the game's skeleton and clips, with the station's minds, fights and talks unchanged.

**Architecture:** `scene/figures.js` learns two more skeletons beside Meshy's: a walrus kind through `lib/three/walrus.js` (the humanoid pack once a page, the gun in `Wep_Root`), an own-rig kind through `ownRig.js`'s `loadOwnRigBody`. `rules/cast.js` points its kinds at `/models/galaxy/bf2017/crew/` files with `rig` and `tall`; four kinds the galaxy did not have (shadowtrooper, navycrewman, admiral, personnel) are imported into the galaxy's crew folder so both worlds share one file.

**Tech Stack:** `scripts/bf2017-import.mjs`, `src/lib/three/walrus.js`, `ownRig.js`, `src/components/deathstar/inside/scene/figures.js`, `rules/cast.js`, `pack.js`, `scripts/pack-check.mjs`, Vitest, `anim-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-cast-left-design.md` (§1.5, §3 lane I).

## Global Constraints

- Phases 0 to 2's Global Constraints; the four new kinds imported `--rig --crew --full --join` (`--no-walrus-check` for the personnel on `Civilian_Ske`), `--lod1-tex 512 --lod1-maps 256`; `--far` for shadowtrooper and navycrewman (the station fields them in squads).
- The interior's rules (`rules/*.js`) read `CAST[kind]` and change nothing but `model`, `rig`, `tall`, `ownRig`, and the dropped `dye`/`helmet` of kinds whose game body is its own.
- `scripts/pack-check.mjs` must pass: every file the source names is in `pack.js`.
- Chewbacca (`/models/cockpit/chewie.glb`), old Ben (`/models/deathstar/obiwan.glb`) and C-3PO (`/models/deathstar/c3po.glb`) stay on Meshy's skeleton (the game has no old Ben; Chewbacca's and C-3PO's 2017 bodies are in the crew folder and a later row may take them, but the owner's cockpit Chewie is kept here as it is).
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines; merge commits.

## Review Focus

1. **`personOf` reads bone names**: `RightHand` (the gun), `Hips`, `LeftToeBase`/`RightToeBase` (height), `head_end` (Meshy only): the walrus path takes `Head` for the top and the game's names for the rest; task 2's test on the committed stormtrooper light cut: `tall` within 2% of the row's.
2. **The gun frame**: a walrus figure holds its blaster in `Wep_Root` with `WEAPON_FRAME`, not in the hand's Meshy frame; a Meshy figure as before; the test asserts the gun's parent bone by rig.
3. **A `Civilian_Ske` body plays the humanoid pack by bone name** (no sockets): `loadOwnRigBody` with `packs: [humanoid]` yields `clips.walk`; a gun on it is refused (`hold` → false) since it has no `Wep_Root`; the personnel row has no `gun`.
4. **The gonk's two idles and the mouse droid's none**: a droid row with no `walk` must not slide; the mouse droid's wheels turn by distance (`turnWheels`), the gonk shuffles on `L_Gonk_Stand_Idle_01` at `speed: 0.3` and the scene's walker accepts a figure with no walk clip (today's prop path).
5. **The ragdoll's bodies**: `rigRagdoll(bones, …)` with the game's bone names must find its 15 bodies (`src/data/bf2017/physics/ragdoll.json`'s names) on a walrus figure; the test asserts a fall on a walrus stormtrooper produces 15 bodies, not 0.

---

### Task 1: The four kinds the galaxy did not have

**Files:**
- Create: `public/models/galaxy/bf2017/crew/{shadowtrooper,navycrewman,admiral,personnel}.lod1.glb` (+ `.far.glb` for the first two; the plain cuts to `site-assets`), `public/models/galaxy/bf2017/crew/{gonk,interrogation,mousedroid}.lod1.glb`, `public/models/galaxy/bf2017/clips-{gonk,interrogation}.glb`, sheets in `docs/superpowers/evidence/bf2017-deathstar/`
- Modify: `src/components/galaxy/surface/crewList.js` (seven rows: shadowtrooper `tall 1.83`, navycrewman `1.8` with `--parts 'characters/heads/hair_navycrewman/hair_navycrewman_01_mesh'`, admiral `1.8`, personnel `1.78` with `rig: 'own', ownRig: 'civilian'`; gonk `1.1` `rig: 'own', ownRig: 'gonk'`; interrogation `0.9` `rig: 'own', ownRig: 'interrogation', float: true`; mousedroid `0.25` `rig: 'own', ownRig: 'mouse', wheels: ['LeftWheel', 'RightWheel'…]` by the body's bone names, read at import and written into the row), `src/lib/three/walrusClips.js` (`OWN_RIGS.civilian = { skeleton: 'Civilian_Ske', body: 'personnel', humanoid: true }` (its pack is the humanoid's, by name); `OWN_RIGS.gonk` (`idle: ['L_Gonk_Stand_Idle_01', '_02']`); `OWN_RIGS.interrogation` (its one clip as `idle`); `OWN_RIGS.mouse` (no clips: `set: {}`)), `scripts/galaxy-figures-audit.mjs` (`EXPECTED` for the kinds the galaxy's worlds place: `gonk`, `mousedroid`)
- Test: `src/components/galaxy/surface/crewList.test.js`

- [ ] **Step 1: Failing tests**: the seven rows exist with `rig`; `figureLoaderFor` answers `walrus` for the first three and `own` for the rest; `OWN_RIGS.civilian.humanoid === true` and `ownPackUrl('civilian')` → the humanoid pack.
- [ ] **Step 2: Run** → FAIL. **Step 3: Import** (the manifest names in the spec §1.5), pack the gonk's and the interrogation droid's clips, publish. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The Death Star's crew from the game: the shadowtrooper, the navy, the admiral, the personnel and the droids`.

### Task 2: Three skeletons in `figures.js`

**Files:**
- Modify: `src/components/deathstar/inside/scene/figures.js` (`loadPerson(kind, opts)` reads the row's `rig`: `'walrus'` → `loadWalrusBody(url, { packs: packUrls() })`, bones by name, `anim` the site's `createAnimator` over the pack's clips by site names (as `crew.js` does for a walrus crew figure), the gun under `sockets.weapon` with `WEAPON_FRAME`; `'own'` → `loadOwnRigBody(url, { rig, packs })`, `hold()` → false without `Wep_Root`; else Meshy as today; `personOf` takes `top = y('head_end') ?? y('HeadEnd') ?? y('Head') + 0.1`), `src/components/deathstar/inside/scene/mouse.js` (`turnWheels(bones, metres)`), `float.js` (`floatOf(object, t, seed)`: a 0.05 m bob at 0.4 Hz and a 0.02 rad roll)
- Test: `src/components/deathstar/inside/scene/figures.test.js`

- [ ] **Step 1: Failing tests**: Review Focus 1, 2, 3, 5 (a fake walrus tree built from `walrusRig.js`'s `BODY` + `SOCKETS` names; the ragdoll's 15 names from `ragdoll.json`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Aboard the Death Star a person may stand on the game's skeleton`.

### Task 3: The cast rows

**Files:**
- Modify: `src/components/deathstar/inside/rules/cast.js` (`stormtrooper` → `/models/galaxy/bf2017/crew/stormtrooper.glb`, `rig: 'walrus'`; `dstrooper` → `shadowtrooper.glb`, no `dye`, no `helmet`; `gunner`, `technician` → `navycrewman.glb` (the technician keeps `dye: BLACK`? no: the game's crewman is black already; both drop the dye); `officer`, `tarkin`, `tagge`, `jerjerrod` → `officer.glb` (tints kept); `motti` → `admiral.glb`; `librarian` → `personnel.glb` `rig: 'own', ownRig: 'civilian'`; `luke`, `han`, `leia`, `vader`, `emperor` → the 2017 crew files, `rig: 'walrus'`; `gonk`, `mousedroid`, `r2d2` (→ `astromech.glb`), `r5` → the 2017 bodies `rig: 'own'`; the IT-O: `built: 'ito'` → `model: interrogation.glb`, `rig: 'own'`, `float: true`), `pack.js` (`urls`: the new files; `globs`: `/models/galaxy/bf2017/clips-*.glb`; the old Meshy files of the replaced kinds removed)
- Test: `src/components/deathstar/inside/rules/cast.test.js`

- [ ] **Step 1: Failing tests**: every `CAST` row with a `model` under `/models/galaxy/bf2017/` has a `rig`; no row keeps `helmet: 'dstrooper'`; `scripts/pack-check.mjs` passes (run as a test step).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Look**: the interior at the hangar and the detention block (`#/deathstar/inside`, the scene's DEV teleport); shots before and after into the evidence folder; `renderer.info.render.calls` at both spots before and after, in the PR.
- [ ] **Step 6: Commit** `The Death Star's cast is the game's`.

### Task 4: The checks, the PR, the hand-off

- [ ] `anim-check.mjs --route '#/deathstar/inside' --do "__inside.teleport('hangar')" --limit 0.15 --strict` (the lane adds the route's `--do` hook if `anim-check` lacks one for the interior); green.
- [ ] Gates; `node scripts/galaxy-figures-audit.mjs` green; the hand-off's lane I row (Done; Left: Chewbacca, old Ben and C-3PO on Meshy's skeleton by the owner's choice; the technician's uniform if the owner wants it dyed); merge `origin/main`, push, PR `The Death Star's crew from Battlefront II (2017)`. Merge per the slot.
