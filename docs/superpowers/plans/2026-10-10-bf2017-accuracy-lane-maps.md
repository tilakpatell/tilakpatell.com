# Battlefront 2017, lane maps: the accuracy ledger, every map's rulebook, the other modes. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Every usable map has a rulebook of its own records (spawns, spawn areas, capture and objective volumes, vehicle spawns, walker paths, the mode layers), a ledger row that says how much of the map the site draws and plays (sub-levels, instances, lights, decals, effects, actors, vehicle spawns, variations, modes) and a CI check on it; and the game's other modes (Strike, Extraction, Ewok Hunt, and Capital Supremacy's ground half where its records are data) run on the sim as Galactic Assault does. This is the game design's lane 6 with a measure in front of it.

**Architecture:** One pure audit module reads a map's index row and extras, its pack's `level.json` and README, the `galaxy-check` report and the rulebook, and writes a row; the extractor runs for every usable map; each mode is a pure state machine under `src/lib/battlefront/modes/` over `objectives.js`'s pieces, run by `assault.js`'s arena runner with seeds. The E lanes' packs fill the drawn columns as they land; this lane fills the data columns now.

**Tech Stack:** `scripts/bf2017-data.mjs all --level <level> --era Orig` (lane 0; the bucket's `data/` and `web/maps/<level>.json`/`.extras.json` through `bf2017-fetch.mjs`), `scripts/lib/bf2017-rulebook-map.mjs`, `bf2017-arenas.mjs` (lane H); `src/lib/battlefront/` (sim, modes/objectives, modes/galacticAssault, spawn, assault, eor, ai/commander); `scripts/battlefront-balance.mjs`; `scripts/galaxy-check.mjs` (its JSON report); `src/data/bf2017/modes.json` (lane F's `bf2017-data.mjs modes`); `scripts/bf2017-coverage.mjs` (lane Z's ledger); Vitest, `npm run test:ai`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-accuracy-design.md` (§1.5, §3 "Lane maps", §5).

## Global Constraints

- The era rule; the 44 usable maps as the fifth design lists them (§1 of its spec).
- Every number from the records with `_source`; a stage order the game keeps in a logic graph is a hand `stages.json` with `source: "hand"` and a `NOTES.md` line.
- The E lanes own the packs and `sites/`: this lane writes no pack and changes no site; it reads them. E0's README columns are read as they are.
- `stuck` and `off` stay 0 in every seeded run.
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines.

## Review Focus

1. **A map with no pack on `main`**: its ledger row has the data columns and `drawn: none`, and `--check` passes (a missing pack is not a failure; a pack whose README claims a part the audit cannot find is) (task 1's test).
2. **A level whose mode layer names an objective volume the extractor cannot place**: the rulebook lists it under `unplaced` and the mode refuses to start on that map with a plain message (task 2's test).
3. **Strike with the objective carried** (the carrier dies): the objective drops where the carrier fell and the timer rule is the record's (task 3's test).
4. **Ewok Hunt's turn** (the survivors' extraction opens): on the record's time, and a killed survivor joins the Ewoks (task 3's test).
5. **The ledger's check on a map an E lane just landed**: the row updates from the pack's README without a hand edit (task 1's `--refresh`).

---

### Task 1: The ledger

**Files:**
- Create: `scripts/lib/bf2017-map-audit.mjs` (`auditMap({ index, extras, pack, report, rulebook, variations }) → row`: `{ level, kind, world, subLevels: { inMap, inPack }, instances: { inMap, inPack, drawn: { low, mid, high, ultra } }, lights: { inMap, inPack, drawn }, decals, effects, actors, vehicles (each the same three), variations: { applied, rule, default: n } (lane colour's audit when present), modes: { inRecords: [...], inModesJson: [...], withRulebook: [...], withStages: [...] }, terrain: { layers, scatter }, gaps: [...] }`; `checkRows(rows) → errors` (a README part the pack lacks; a mode in `modes.json` with no rulebook; a rulebook with `unplaced` rows beyond its stated count)), `scripts/bf2017-map-audit.mjs` (CLI: `[levels…] | --all`, `--refresh` (reads every pack's README and the latest `galaxy-check` reports under `docs/superpowers/evidence/`), `--check`; writes `docs/superpowers/evidence/bf2017-maps/ledger.md` (one row a map, the 44 in the design's order, the three packs first) and `ledger.json`)
- Modify: `package.json` (`maps:bf2017` → `--check`), `.github/workflows/ci.yml` (the check beside `coverage:bf2017`)
- Test: `scripts/lib/bf2017-map-audit.test.mjs` (fixtures: Hoth's index row and extras counts, its pack's `level.json` and README trimmed, a `galaxy-check` report; a map with no pack; Review Focus 1)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `node scripts/bf2017-map-audit.mjs --all` (the data columns from the bucket's index and extras for every usable map; the drawn columns for Hoth, SB_Endor, SB_Kamino).
- [ ] **Step 5: Commit** `A ledger says, per map, how much of it the site draws and plays`.

### Task 2: Every map's rulebook

**Files:**
- Modify: `scripts/lib/bf2017-rulebook-map.mjs` (reads every mode layer a level holds: `FantasyBattle_Gameplay` (Galactic Assault), `HeroesVsVillains`, `Blast`, `ModeE` (Strike), `DominationExtraction`, `EwokHunt`, `Mode9`, `Mode1`, `Mode8`, `ModeDefend`, `SpaceBattle_Gameplay`; the capture and objective volumes, the spawn areas by team and phase, the vehicle spawns, the walker paths, the `ObjectivesDefinition` rows of the campaign maps; `unplaced` for what it cannot place), `scripts/bf2017-data.mjs` (`--level` accepts the 44; `modes` regenerated from the rulebooks rather than the index)
- Run: the extractor for every usable map without a rulebook (Yavin_01, Kamino_01, Naboo_01/02/03, Kashyyyk_02, Geonosis_02, Endor_02/04, Tatooine_02, JabbasPalace_01, Scarif_02, CloudCity_01, DeathStar02_01, Hoth_02, Felucia_01, Kessel_01, Kamino_03, the campaign's OT-era maps); `src/data/bf2017/maps/<world>[.<n>].json` as lane H named them; `stages.json` by hand where the stage order is a graph (Galactic Assault's maps: the film's and the game's known order, each `source: "hand"`)
- Test: `scripts/lib/bf2017-rulebook-map.test.mjs` (a fixture level with Strike's layer: the objective, the carry volume, the two sides' spawns; Review Focus 2), `src/data/bf2017/rulebook.test.js` (every rulebook on disk loads, its `unplaced` count matches its header, no sequel row)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; the sizes of the new rulebooks in the commit message; `modes.json` regenerated and `src/components/galaxy/surface/ModeMenu.test.jsx` still green.
- [ ] **Step 5: Commit** `Every usable map has a rulebook of its own spawns, volumes and modes`.

### Task 3: The other modes

**Files:**
- Create: `src/lib/battlefront/modes/strike.js` (`ModeE`: one objective, the attackers carry it to the drop, the timer and the carrier rules from the record; two rounds with the sides swapped as the game's), `modes/extraction.js` (`DominationExtraction`: the cargo escorted through the capture points on the record's timings), `modes/ewokHunt.js` (`EwokHunt`: the night, the stormtroopers against Ewoks that grow by every kill, the extraction on the record's time; the Ewok kind from phase 2's `ewok` row), `modes/supremacy.js` (`Mode9`'s ground half: the command posts' capture and the overrun, where the records give the counts and times; the capital-ship boarding left as `gaps`), each `createMode(rulebook, level, { seed }) → { step(sim), view(), ended }` as `galacticAssault.js` is; `modes/index.js` (`modeFor(id)`)
- Modify: `src/lib/battlefront/sim.js` (`mode` may be any of them), `assault.js` (the arena runner takes `--mode`), `scripts/battlefront-balance.mjs` (`--mode strike|extraction|ewokhunt|supremacy --level <world>`), `src/data/bf2017/NOTES.md`
- Test: `src/lib/battlefront/modes/strike.test.js`, `extraction.test.js`, `ewokHunt.test.js`, `supremacy.test.js` (Review Focus 3 and 4; each mode ends within its own time on a fixture level), the arena under `test:ai` (one seed each)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `--runs 12` per mode on a map that has it (Strike on Endor_02 or Tatooine_02; Extraction on Kessel_01 or JabbasPalace_01; Ewok Hunt on Endor_04; Supremacy on Geonosis_02): the tables into `docs/superpowers/evidence/battlefront-lane6/`.
- [ ] **Step 5: Commit** `Strike, Extraction, Ewok Hunt and Supremacy's ground run on the sim from their records`.

### Task 4: The modes reach the menus

**Files:**
- Modify: `src/data/bf2017/modes.json` (the new modes per level), `src/components/galaxy/surface/missions/index.js` (or where lane F and H register `MISSIONS[world]`: the new modes as surface missions on the worlds whose packs exist (Hoth today; the E lanes' worlds as they land: a mode on a world without a pack is listed `coming`)), `src/components/battlefront/battle.js` (the game world's route accepts the new mode ids), `src/components/galaxy/surface/landLine.js`
- Test: `src/components/galaxy/surface/ModeMenu.test.jsx`, `src/components/battlefront/battle.test.js`

- [ ] **Step 1: Failing tests.** **Step 2** → FAIL. **Step 3: Implement.** **Step 4** → PASS.
- [ ] **Step 5: Commit** `The other modes are on the menus where their maps are`.

### Task 5: The hand-off and the PR

- [ ] `HANDOFF-battlefront.md`: lane 6's row filled (the modes, the seeds' tables, what stayed hand); `HANDOFF-bf2017.md`'s sixth-design row for the maps lane: the ledger's first table (how many of 44 have a rulebook, a pack, drawn columns), the E lanes told how a row refreshes (`--refresh`).
- [ ] Message lane E0's hand-off section (a line under "The fifth design": each E lane runs `node scripts/bf2017-map-audit.mjs <level> --refresh` before its PR).
- [ ] `npm run lint`, `npx vitest run scripts/lib/bf2017-map-audit.test.mjs scripts/lib/bf2017-rulebook-map.test.mjs src/data/bf2017 src/lib/battlefront src/components/galaxy/surface/ModeMenu.test.jsx src/components/battlefront/battle.test.js`, `npm run test:ai -- src/lib/battlefront`, `npm run build`, `node scripts/health.mjs --check --skip build`, `npm run coverage:bf2017`, `node scripts/bf2017-map-audit.mjs --check`.
- [ ] Merge `origin/main`, push, open the PR; merge it yourself when CI is green.
