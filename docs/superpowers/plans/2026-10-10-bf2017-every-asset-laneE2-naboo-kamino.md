# Battlefront 2017, lane E2: Naboo and Kamino on the game's maps. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. **Starts when lane E0 is on `main`.**

**Goal:** Naboo stands on Naboo_01 (Theed) with Naboo_02 and Naboo_03 as districts and the palace's inside as an interior pack; Kamino stands on Kamino_01 with Kamino_03 as a district and the cloning facility's interiors as interior packs; the campaign's M5NAB rooms are districts of Naboo where the MP maps lack them.

**Architecture:** Lane E0's factory run per map; `sites/core.js` gains `level` and `districts` for both worlds; lane G's Naboo light JSON (written, not wired: dusk under the one calibration reads 62 % darker) is wired now that the placed lights draw.

**Tech Stack:** `scripts/bf2017-level.mjs` (E0), `sites/core.js`, `src/data/bf2017/light/naboo.json` + `gameLit.js`, `galaxy-check.mjs`, `anim-check.mjs`, `assets-publish.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` (§3 lane E, E2).

## Global Constraints

- E0's constraints. Kamino has `fall` (nothing under its floors): the pack's floors are the walk's floors (P0's shapes and E0's collision solids), and `fall` keeps its height.
- Naboo's light: `gameLight` wired with the placed lights on; the field's mean luminance within 15 % of the site's own at the landing spot, measured by `surface-shot.mjs`'s luminance line, said in the PR; if it cannot be, the record stays unwired and the PR says why.
- One world a PR; `origin/main` merged before each.

## Review Focus

1. **Theed's canals** (`water` in `sites/core.js`): the pack's water planes and the site's `water.level` must agree within 0.2 m (task 1's test against the pack's terrain record).
2. **Kamino's platforms over the sea**: a visitor stepping off a platform must fall into the sea and respawn (the site's `fall`), not stand on a collision solid under the water (task 3's test: no solid below `water.level`).
3. **The palace interior's doors** between Theed's streets and the palace (task 2's validity test, as E1's).

---

### Task 1: Naboo on Naboo_01, under the game's dusk

**Files:**
- Create: `node scripts/bf2017-level.mjs levels/mp/naboo_01 --world naboo --spawn` (published); `docs/superpowers/evidence/bf2017-levels/naboo/`
- Modify: `sites/core.js` (Naboo: `level: 'naboo'`, `gameLight: true`; the built Theed rows go), `src/components/galaxy/surface/gameLit.js` (Naboo's entry wired)
- Test: `sites/sites.test.js` (Review Focus 1), `gameLit.test.js` (Naboo now in the wired list)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Build and wire.** **Step 4: Run** → PASS; gates at four tiers; the luminance line before and after; shots.
- [ ] **Step 5: Commit** `Theed on the game's map, at the game's dusk, under its lanterns`.

### Task 2: Naboo_02, Naboo_03, the palace inside, M5NAB

**Files:**
- Create: `… levels/mp/naboo_02 --world naboo --district hangar --spawn`; `… s7_2/levels/naboo_03 --world naboo --district plains --spawn`; `… levels/mp/naboo_01 --world naboo --district palace --inside --subs <palace sub-levels>`; `… levels/sp/a1/m5nab/ds02 --dry` and `ds05 --dry` first: a mission map that adds rooms the MP maps lack becomes `--district royal --inside`, else its meshes stay the library's (say which in the README)
- Modify: `sites/core.js` (`districts`; the palace zone's door `to: { district: 'palace' }`)
- Test: `sites/validity.test.js` (Review Focus 3)

- [ ] **Step 1: Failing test.** **Step 2: Run** → FAIL. **Step 3: Build and wire.** **Step 4: Run** → PASS; gates per district.
- [ ] **Step 5: Commit** `Naboo's hangar, plains and palace, districts of Theed`.

### Task 3: Kamino on Kamino_01 and Kamino_03

**Files:**
- Create: `… levels/mp/kamino_01 --world kamino --spawn`; `… s7_1/levels/kamino_03 --world kamino --district platforms --spawn`; the facility's interiors `--district inside --inside --subs <…>`
- Modify: `sites/core.js` (Kamino: `level: 'kamino'`, `districts`, `fall` kept; the built domes and walkways go; the aiwha's `path`/`dive` life rows stay (lane B's kind))
- Test: `sites/sites.test.js` (Review Focus 2)

- [ ] **Step 1: Failing test.** **Step 2: Run** → FAIL. **Step 3: Build and wire.** **Step 4: Run** → PASS; gates; shots.
- [ ] **Step 5: Commit** `Kamino's cloning facility as the game built it, over its sea`.

### Task 4: The hand-off and the PRs

- [ ] `HANDOFF-bf2017.md`'s fifth-design table: E2's rows; the ledger refreshed. PRs: `Naboo on the game's maps: Theed, its hangar, plains and palace`; `Kamino on the game's maps`.
