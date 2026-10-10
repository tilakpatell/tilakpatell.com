# Battlefront 2017, lane E5: the drop's worlds the galaxy lacks. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. **Starts when lane E0 is on `main`.**

**Goal:** Felucia, Kessel, Sullust, Pillio, Vardos and Fondor are systems on the galaxy map, each with a planet wearing its game skin from orbit, a surface on its game map, and a landing spot; Athulla joins as Pillio's neighbour if its map stands alone.

**Architecture:** One `SYSTEMS` row per world placed by canon region (`systems.js`'s `REGIONS` and grid), a `sites/` entry with `level`, lane K's `UNPLACED` skin promoted to a `SKINS` row and converted (`bf2017-planets.mjs`), a galaxy-map disc from the front end's globe where the drop has one (`PICTURES`), E0's factory for the map.

**Tech Stack:** `src/components/galaxy/systems.js`, `sites/outer.js` (or a new `sites/drop.js` if `outer.js` nears 800 lines), `scripts/lib/bf2017-planets.mjs` + `scripts/bf2017-planets.mjs`, `src/data/planetSkins.json`, `bodies.js`, `scripts/bf2017-level.mjs`, `galaxy-check.mjs space` and `surface`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` (§3 lane E, E5).

## Global Constraints

- E0's and lane K's constraints (a skin never larger than the game drew it; the tiers' sizes).
- Canon placement: Felucia (Outer Rim, Thanium sector), Kessel (Outer Rim, near Kessel Run), Sullust (Outer Rim, Brema), Pillio (Outer Rim, Jinata), Vardos (Outer Rim, Jinata), Fondor (Colonies); a row's `at` within its `REGIONS` band; the galaxy map's tests on overlap (`systems.test.js`) hold.
- A new system has no `war` rows and no `battles` entries unless a site's quest needs one: it is a place to land, not a front.
- The era rule: Athulla and Pillio are the Resurrection DLC's but set in the OT era; Starkiller (A3 M5STA) is not.
- One world a PR; `origin/main` merged before each.

## Review Focus

1. **Every page that lists systems** (`GalaxyPanel`, `HoloMap`, `UniverseMap`, the mission page, `LANDABLE`) must show the new rows without a layout break at 21 columns (task 1's snapshot tests, where they exist, updated with the rows).
2. **A new system's planet from orbit** must draw its skin on mid and up and the procedural body on low (lane K's `bodies.js` rule; task 2's test on `planFor`).
3. **A landing on a new world** with no `life` rows must not crash `actors.js` (task 3: a site with `life: []`).

---

### Task 1: Six systems on the map

- Modify: `systems.js` (six rows: `id`, `name`, `at`, `region`, `era`, `about`, `film` (the campaign's), `size`, `color`), `src/components/galaxy/surface/sites/index.js` (nothing: `LANDABLE` reads `SITES`), the map's label placement if `labelPlace.test.js` reports an overlap
- Test: `systems.test.js` (each row inside its region band; ids unique; `LANDABLE` includes them once their sites exist)
- [ ] Failing test → FAIL → implement → PASS. Commit `Felucia, Kessel, Sullust, Pillio, Vardos and Fondor on the galaxy map`.

### Task 2: Their planets' skins

- Modify: `scripts/lib/bf2017-planets.mjs` (`SKINS` rows for the six from `UNPLACED`'s names: colour, normal, clouds, atmo where the bucket has them; Kessel and Felucia from their globes as `PICTURES` if whole-planet maps are absent), `src/data/planetSkins.json` (run `node scripts/bf2017-planets.mjs`), `bodies.js` (nothing: a skinned id draws)
- Test: `scripts/lib/bf2017-planets.test.mjs` (`planFor` on the six against a listing fixture)
- [ ] Failing test → FAIL → implement, run the script, publish (`assets-upload.mjs` for `textures/galaxy/planets`) → PASS; `QUALITY=high OUT=/tmp/s node scripts/galaxy-check.mjs space felucia,kessel,sullust,pillio,vardos,fondor`; shots in `docs/superpowers/evidence/bf2017-planets/`. Commit `The six new worlds wear the game's skins from orbit`.

### Task 3: Their surfaces

- Create: `node scripts/bf2017-level.mjs s8/felucia/levels/mp/felucia_01 --world felucia --spawn`; `… s3/levels/kessel_01 --world kessel --spawn`; `… levels/sp/a2/m3sul/ds02 --world sullust --spawn`; `… levels/sp/a1/m3pil/ds02 --world pillio --spawn` (A3 M1PIL/M2PIL as districts if `--dry` shows other ground); `… levels/sp/a1/m4var/ds02 --world vardos --spawn` (A3 M4VAR a district); `… levels/sp/a1/m2fon/ds02 --world fondor --spawn --inside` if the mission is the Star Destroyer's inside (then the site's "surface" is the hangar deck; its windows show SB_Fondor's dry dock, lane Q's); `… a3/levels/sp/m3ath/ds02 --dry` → Athulla as a seventh system if its map stands alone
- Create: `sites/drop.js` (six `SITE` entries: `place`, `line`, `sky` from lane G's reader run on each map's VE record (`node scripts/bf2017-light.mjs <world> --map <level>`), `land` from the spot, `level`, `fall` where the map has drops, `life: []` until lanes A and O dress them), wired in `sites/index.js`
- Test: `sites/sites.test.js` (Review Focus 3), `validity.test.js`
- [ ] Failing test → FAIL → build and wire → PASS; gates at four tiers per world; `anim-check`; shots. Commit one a world.

### Task 4: The hand-off and the PRs

- [ ] `HANDOFF-bf2017.md`'s fifth-design table: E5's rows; `HANDOFF-galaxy-phases.md` or the galaxy map's hand-off: the six systems; the ledger refreshed. One PR per world.
