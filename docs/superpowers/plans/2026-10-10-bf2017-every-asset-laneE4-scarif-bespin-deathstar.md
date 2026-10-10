# Battlefront 2017, lane E4: Scarif, Bespin, Hoth_02 and the Death Star inside. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. **Starts when lane E0 is on `main`.**

**Goal:** Scarif stands on Scarif_02; Bespin on CloudCity_01 with the campaign's M2BES as a district; Hoth gains Hoth_02 as a district; the Death Star inside world's layout is DeathStar02_01's rooms, drawn by the level loader, its cast and windows as they are.

**Architecture:** Lane E0's factory run per map for the three surfaces; for the Death Star, an interior pack (`--inside`) loaded by `deathstar/inside/scene/index.js` in place of `kit.js`'s built rooms, the inside's `layout` (rooms, doors, `rules/`) kept as the data the cast, cameras and quests read, now measured from the pack.

**Tech Stack:** as E1's; `src/components/deathstar/inside/` (`scene/index.js`, `scene/kit.js`, `scene/rooms/`, `pack.js`, `rules/layout` or wherever `layout` is defined: `grep -rn "export const LAYOUT\|layout" src/components/deathstar/inside/rules | head`).

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` (§3 lane E, E4).

## Global Constraints

- E0's constraints. Bespin and Scarif have `fall`; the Death Star inside has its own `fall.js`.
- The inside world's cast (cast-left lane I), cinematics (`cinematics.js`), windows (`views.js`), quests and sounds change nothing here: the pack replaces the kit's geometry, and `layout`'s rooms are re-measured to the pack's rooms (ids kept).
- `pack-check.mjs` (`inside/pack.js`'s `urls`) must list the pack's files through the manifest, as the galaxy's packs do.
- One world a PR; `origin/main` merged before each.

## Review Focus

1. **The inside's rooms by id** (`layout`'s `hangar`, `detention`, `tractor`, `throne`…): every room id the cast, cinematics and quests name must exist after the re-measure (task 4's test over `SCENES`, `cast.js` and the quests' room ids).
2. **The inside's camera `rooms` bounds** keep the visitor's camera in the room they are in: the re-measured `rooms` must enclose each room's door positions (task 4).
3. **Bespin's plaza edge** (`fall`): no collision solid below the platform's underside that would catch a fallen visitor (task 2, as E2's Kamino test).

---

### Task 1: Scarif on Scarif_02

- Create: `node scripts/bf2017-level.mjs s9_3/scarif/levels/mp/scarif_02 --world scarif --spawn`; evidence folder
- Modify: the Scarif site (`grep -n scarif sites/*.js`): `level`; the built beach, bunkers and the citadel go; the shield gate stays the space layer's
- Test: `sites/sites.test.js` (the landing on the pack's shore; `water.level`)
- [ ] Failing test → FAIL → build and wire → PASS; gates; shots. Commit `Scarif on the game's map`.

### Task 2: Bespin on CloudCity_01 and M2BES

- Create: `… s2/levels/cloudcity_01 --world bespin --spawn`; `… levels/sp/a2/m2bes/ds02 --dry` → `--district lower --inside` if it adds rooms
- Modify: `sites/bespin.js` (`level`, `districts`, `fall` kept; the built plaza, towers and the carbon chamber go unless the map lacks the chamber, then the chamber zone stays)
- Test: `sites/sites.test.js` (Review Focus 3)
- [ ] Failing test → FAIL → build and wire → PASS; gates; shots. Commit `Cloud City as the game built it`.

### Task 3: Hoth_02

- Create: `… s9_3/hoth_02 --world hoth --district outpost --spawn`
- Modify: `sites/ice.js` (`districts` gains the outpost)
- Test: `sites/validity.test.js`
- [ ] Failing test → FAIL → build and wire → PASS; gates. Commit `Hoth's outpost, a district`.

### Task 4: The Death Star inside on DeathStar02_01

**Files:**
- Create: `node scripts/bf2017-level.mjs levels/mp/deathstar02_01 --world deathstar --district inside --inside --spawn` (published); `src/components/deathstar/inside/scene/levelRooms.js` (`roomsFromPack(level, ids) → layout.rooms` re-measured: each known room id's bounds from the pack's named sub-level or instance cluster, the mapping table `ROOM_OF` in the file, by hand from `--dry`'s sub-level list)
- Modify: `scene/index.js` (the level loader in place of `kit.js`'s shell: `createLevel({ scene, site: { level: 'deathstar/inside' }, tier, renderer, walk })`; the kit's `mat` roles stay for the built consoles and screens the pack lacks), `scene/kit.js` (unchanged; its callers in `index.js` that built walls and floors are removed), `pack.js` (`urls` gains the pack's manifest rows), `rules/` (`layout` from `roomsFromPack` at build time, written to `src/data/deathstar/layout.json` by a script step so the tests stay synchronous: `scripts/deathstar-layout.mjs`)
- Test: `scene/levelRooms.test.js` (Review Focus 1 and 2), `scene/index.test.js`, `module.test.js`

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Build the pack; implement.** **Step 4: Run** → PASS; `node scripts/pack-check.mjs`; the inside's own checks (`grep -n "deathstar" package.json` for its check scripts); shots of the hangar, the detention block, the throne room beside the old ones in `docs/superpowers/evidence/bf2017-levels/deathstar/`.
- [ ] **Step 5: Commit** `The Death Star's inside is the game's Death Star II, room for room`.

### Task 5: The hand-off and the PRs

- [ ] `HANDOFF-bf2017.md`'s fifth-design table: E4's rows; `HANDOFF-deathstar-inside.md`: the layout now comes from the pack, how to re-measure; the ledger refreshed. PRs: `Scarif on the game's map`; `Cloud City on the game's map`; `The Death Star inside on the game's map`.
