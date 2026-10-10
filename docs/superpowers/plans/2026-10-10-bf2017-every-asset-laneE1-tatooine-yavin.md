# Battlefront 2017, lane E1: Tatooine and Yavin on the game's maps. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. **Starts when lane E0 is on `main`.**

**Goal:** Tatooine stands on Tatooine_01 (Mos Eisley) with Tatooine_02 and Jabba's palace as districts, the palace's inside as an interior pack; Yavin stands on Yavin_01 with the temple's inside where the map has one.

**Architecture:** Lane E0's factory run per map; each world's `sites/` file gains `level` and `districts` and loses the built rows the pack replaces; the gates are lane L's.

**Tech Stack:** `scripts/bf2017-level.mjs` (E0), `sites/desert.js`, `sites/yavin.js`, `galaxy-check.mjs`, `anim-check.mjs`, `surface-shot.mjs`, `assets-publish.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` (§3 lane E, E1).

## Global Constraints

- E0's constraints; Tatooine is over the MB row at low already (27.9 against 20, phase 3's note): this lane brings it within the row by dropping the built rows the pack replaces and by `--arena` sizing, said in the PR with before and after.
- The cantina's band is lane A's: the site's `wants` row for the cantina stays; the Bith arrive with A.
- One world a PR; `origin/main` merged before each.

## Review Focus

1. **Mos Eisley's quests** (`sites/quests.js` and `desert.js` spots) must still resolve on the new ground: every quest spot's `at` lands on the pack's terrain within 2 m of its old height (task 1's test prints the deltas).
2. **The palace district's door** from Mos Eisley: a visitor at the `to: { district: 'jabba' }` zone lands in the palace's `land`, and the palace's exit returns to Mos Eisley's spot (task 2's validity test).
3. **Yavin's temple landing** (`sites/yavin.js`'s `land`) must be on the pack's ground, not the old built platform (task 3).

---

### Task 1: Tatooine on Tatooine_01

**Files:**
- Create: the pack `node scripts/bf2017-level.mjs levels/mp/tatooine_01 --world tatooine --spawn` (published), `docs/superpowers/evidence/bf2017-levels/tatooine/`
- Modify: `src/components/galaxy/surface/sites/desert.js` (`level: 'tatooine'`; the Mos Eisley built rows (streets, the cantina shell, the docking bays) go; `places`, `quests`, `wants`, `zones` keep their ids with `at` moved onto the pack's spots where the game's building stands)
- Test: `src/components/galaxy/surface/sites/sites.test.js` (the quest spots' heights against the pack's terrain, through `levelGround`)

- [ ] **Step 1: Failing test** (Review Focus 1). **Step 2: Run** → FAIL. **Step 3: Build and wire.** **Step 4: Run** → PASS; `BUDGET=1 QUALITY=low|mid|high|ultra node scripts/galaxy-check.mjs surface tatooine`; `anim-check`; shots.
- [ ] **Step 5: Commit** `Tatooine on Mos Eisley as the game built it`.

### Task 2: Tatooine_02 and Jabba's palace as districts

**Files:**
- Create: `node scripts/bf2017-level.mjs s9_3/tatooine_02 --world tatooine --district dunes --spawn`; `node scripts/bf2017-level.mjs s2_2/levels/jabbaspalace_01 --world tatooine --district jabba --spawn`; `… --district jabba-inside --inside --subs <the palace's interior sub-levels>`
- Modify: `sites/desert.js` (`districts: [{ id: 'dunes', … }, { id: 'jabba', name: 'Jabba's Palace', … }]`; the `jabba` district's zone `inside` is the interior pack; the Hutt's `reach` row moves into it; the Gamorrean guards are lane A's kind, listed in `actors.json`'s `unplaced` until then)
- Test: `sites/validity.test.js` (Review Focus 2)

- [ ] **Step 1: Failing test.** **Step 2: Run** → FAIL. **Step 3: Build and wire.** **Step 4: Run** → PASS; gates per district (`galaxy-check surface tatooine --district jabba`, a flag E0's check gains if it has not).
- [ ] **Step 5: Commit** `Jabba's palace and the dunes, districts of Tatooine`.

### Task 3: Yavin on Yavin_01

**Files:**
- Create: `node scripts/bf2017-level.mjs levels/mp/yavin_01 --world yavin --spawn`; the temple's interior pack if `--dry` lists interior sub-levels (`--district temple --inside`)
- Modify: `src/components/galaxy/surface/sites/yavin.js` (`level: 'yavin'`; the built temple and the Sketchfab trees go; `flora` stays for the pack's gaps only if `galaxy-check` shows bare ground beyond the arena)
- Test: `sites/sites.test.js` (Review Focus 3)

- [ ] **Step 1: Failing test.** **Step 2: Run** → FAIL. **Step 3: Build and wire.** **Step 4: Run** → PASS; gates; shots.
- [ ] **Step 5: Commit** `Yavin 4 on the game's temple grounds`.

### Task 4: The hand-off and the PRs

- [ ] `HANDOFF-bf2017.md`'s fifth-design table: E1's rows, each pack's weight and what `fitCull` dropped, the spots chosen by hand; the ledger refreshed.
- [ ] One PR per world: `Tatooine on the game's maps: Mos Eisley, the dunes and Jabba's palace`; `Yavin 4 on the game's map`.
