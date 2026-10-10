# Battlefront 2017, lane E3: Kashyyyk, Geonosis and Endor's districts. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. **Starts when lane E0 is on `main`.**

**Goal:** Kashyyyk stands on Kashyyyk_01 with Kashyyyk_02 as a district; Geonosis on Geonosis_01 with Geonosis_02 as a district; Endor (E0's Endor_01) gains the Ewok village (Endor_02), Endor_04 and the bunker's inside, and the campaign's M1END and M0LIB rooms where they add what the MP maps lack.

**Architecture:** Lane E0's factory run per map; `sites/forest.js` (Kashyyyk, Endor) and the Geonosis site in `sites/edge.js` or `outer.js` (whichever holds it: `grep -n geonosis src/components/galaxy/surface/sites/*.js`) gain `level` and `districts`.

**Tech Stack:** as E1's.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` (§3 lane E, E3).

## Global Constraints

- E0's constraints. Kashyyyk's and Endor's trees: the pack's trees are the game's; the site's `flora` rows for those worlds go unless `galaxy-check` shows bare ground beyond the arena (say which).
- Endor's light JSON (lane G: no daytime probe) stays as it is.
- One world a PR; `origin/main` merged before each.

## Review Focus

1. **The Ewok village's walkways** (Endor_02, floors in the air): the walk must take the pack's floors (P0's shapes, E0's collision solids) at their height, and `fall` must be set for the village district (task 3's test: a `fall` on the district).
2. **Geonosis's arena** (`sites/*`'s Petranaki rows and the clone-wars battle): the battle's spawn rows must land on the pack's ground (task 2's height test, as E1's).
3. **Kashyyyk's beach landing** (`sites/forest.js`'s `land`) on the pack's shore, with `water.level` agreeing with the pack's sea (task 1).

---

### Task 1: Kashyyyk on Kashyyyk_01 and Kashyyyk_02

- Create: `node scripts/bf2017-level.mjs levels/mp/kashyyyk_01 --world kashyyyk --spawn`; `… s7/levels/kashyyyk_02 --world kashyyyk --district tree --spawn`; `docs/superpowers/evidence/bf2017-levels/kashyyyk/`
- Modify: `sites/forest.js` (Kashyyyk: `level`, `districts`; the built village and walkways go)
- Test: `sites/sites.test.js` (Review Focus 3)
- [ ] Failing test → FAIL → build and wire → PASS; gates at four tiers; `anim-check`; shots. Commit `Kashyyyk on the game's maps: the beach and the great tree`.

### Task 2: Geonosis on Geonosis_01 and Geonosis_02

- Create: `… s5_1/levels/mp/geonosis_01 --world geonosis --spawn`; `… s6_2/geonosis_02/levels/geonosis_02 --world geonosis --district trippa --spawn`
- Modify: the Geonosis site file (`level`, `districts`; the built spires and the factory go; the Petranaki rows keep their ids on the pack's spots)
- Test: `sites/sites.test.js` (Review Focus 2)
- [ ] Failing test → FAIL → build and wire → PASS; gates; shots. Commit `Geonosis on the game's maps`.

### Task 3: Endor's village, Endor_04, the bunker and the campaign's rooms

- Create: `… s2_1/levels/endor_02 --world endor --district village --spawn`; `… s8_1/endor_04 --world endor --district research --spawn`; `… levels/mp/endor_01 --world endor --district bunker --inside --subs <the bunker's sub-levels>`; `… levels/sp/a1/m1end/ds02 --dry`, `ds04 --dry`, `levels/sp/a1/m0lib/ds02 --dry`: a map with rooms the MP maps lack becomes an `--inside` district, else the library's (the README says which)
- Modify: `sites/forest.js` (Endor's `districts`, the village's `fall`; the bunker zone's door `to: { district: 'bunker' }`)
- Test: `sites/validity.test.js` (Review Focus 1)
- [ ] Failing test → FAIL → build and wire → PASS; gates per district; shots. Commit `Endor's Ewok village, the research station and the bunker's inside, as the game built them`.

### Task 4: The hand-off and the PRs

- [ ] `HANDOFF-bf2017.md`'s fifth-design table: E3's rows; the ledger refreshed. PRs: `Kashyyyk on the game's maps`; `Geonosis on the game's maps`; `Endor's districts`.
