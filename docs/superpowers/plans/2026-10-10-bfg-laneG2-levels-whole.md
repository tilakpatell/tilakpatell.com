# Lane G2: every level, whole, in the map's frame. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (one session, task by task; no review loops). Steps use checkbox (`- [ ]`) syntax.

**Goal:** The Battlefront world draws any usable level **whole** and in the export's frame, so every spawn, volume, path and light of the rulebooks lands where the game has it, with the level's parts (lights, probes, far shadow, placed actors, vehicles at their spawns, physics) and a navgrid built at pack time. Nine Galactic Assault levels first, then the fourteen others.

**Architecture:** lane E0's builder (`scripts/bf2017-level.mjs`, `scripts/bf2017-level-parts.mjs`, `bf2017-physics.mjs`) gains `--whole`: no spot, no yaw, no horizon, no budget fit, written to `public/models/galaxy/bf2017/levels/<world>/game/<levelKey>/` and published to `site-assets` like E0's packs (`level.json` and README in git). `nav.bin` is lane 1's `buildNav` run at pack time over the pack's heightmaps and physics hulls. The game world's `map/level.js` loads by level key and drops its origin group; the parts are drawn through the readers E0 wrote (`galaxy/shared/level.js` re-exports them).

**Spec:** `2026-10-10-bf2017-galaxy-on-the-game-design.md`, decision 4; the game design's decisions 7 and 15; E0's hand-off section in `HANDOFF-bf2017.md` ("Lane E0: the level factory").

## Global constraints

- Start from `main` once E0 has merged; if it has not, start from `main` and merge `origin/claude/bf2017-e0-factory` first (E0's session is told). Own: `scripts/bf2017-level.mjs` (`--whole` only), `scripts/lib/bf2017-level.mjs` (additive), `scripts/lib/bf2017-nav.mjs` (new, over `src/lib/battlefront/nav.js`), `src/components/battlefront/map/*`, `src/components/galaxy/shared/level.js` (re-exports only), the packs' `level.json` and READMEs, `docs/superpowers/evidence/bfg-levels/`.
- The roam packs (E0's and E1–E5's, cut round a spot in the site's frame) are not touched or rebuilt.
- No budget rows in the game world; files under 800 lines; the usual gates. Keys as `bf2017-fetch.mjs` takes them, never printed.

## Tasks

### Task 1: `--whole`

- [ ] `bf2017-level.mjs --whole`: `origin [0, 0, 0]`, `yaw 0`, `arena` = the map's bounds (from the manifest's instance extents), no horizon, every sub-level of the level but the mode and lobby layers' own (`Lobby*`, `EOR*`, `Cinematics*`, `Outro_*`, `*_Automation`, the `Mode*`/`FantasyBattle*`/`HeroArena*`/`TeamDeathmatch*`/`PlanetaryMissions*` sub-levels are **kept** for their art but their gameplay-only pieces listed in `level.json`'s `modeOnly: { [sub]: [...] }` so a mode can hide the others' props), the plain cut everywhere on `high` and `ultra`, textures capped per tier (`TIER_MAPS`), `low` keeps `far` cuts beyond 400 m. Written to `levels/<world>/game/<levelKey>/`. The README's table gains "whole: yes".
- [ ] `--parts` runs with it (E0's `writeParts`), and `bf2017-physics.mjs` for the shapes; `nav.bin` (task 2).
- [ ] `bf2017-level.test.mjs`: a whole pack's `level.json` has `origin [0,0,0]`, no `horizon`, `whole: true`, `nav`.

### Task 2: `nav.bin` at pack time

- [ ] `scripts/lib/bf2017-nav.mjs`: `buildNav` from `src/lib/battlefront/nav.js` over the pack's two heightmaps (the `image` layer) and the physics hulls' footprints (blocked cells), cell 2 m, cover slots by the AI cover constants (`ai.json`), coarse regions and portals; written as `nav.bin` (`{ cell, min, max, w, h, cells: Uint8Array (0 open, 1 blocked, 2 cover), slots: Float32Array }`) with `level.json`'s `nav: { file, cell, w, h }`.
- [ ] `src/lib/battlefront/nav.js` gains `fromBin(buffer)`; `battle.js`'s `createBattle` takes `nav` from the pack when present (it already accepts `nav`), else builds as today. A test holds a fixture `nav.bin` to `buildNav`'s result on the same heights.

### Task 3: the game world loads by key

- [ ] `src/components/battlefront/map/level.js`: `createLevel({ level: '<key>' })` reads `levels/<world>/game/<key>/level.json` (world from `frontend.json`'s `levels[key].system`), draws in a group at the origin (no `toPack` rebase when `whole`), keeps `heightAt`, `progress`, `loaded`, `stats`; falls back to the roam pack (today's path) when the whole pack is not published, saying so in the HUD's loading line.
- [ ] The parts drawn: `lights.json` through lane R's `placed.js` (lane 5 draws Hoth's today from the rulebook: switch to the pack's), `probes.json` through E0's `levelProbes.js`, `shadow/far.png` where fidelity S's reader exists, `actors.json` as still figures through the shared `levelPlaced`, `vehicles.json` as boardable vehicles parked at their spawns (lane V's cuts; the sim's vehicle entities are G5's: until then they are scenery), decals through Q4's `createDecals` on the node renderer.
- [ ] `level.test.js`: a committed whole `level.json` loads by key; the fallback path.

### Task 4: the nine, then the rest

- [ ] Build and publish, one line each (`node scripts/bf2017-level.mjs <map> --world <w> --whole --parts`, then `node scripts/assets-publish.mjs --only 'models/galaxy/bf2017/levels/<w>/game/<key>/*'`): `levels/mp/hoth_01`, `levels/mp/endor_01`, `levels/mp/tatooine_01`, `levels/mp/yavin_01`, `levels/mp/kashyyyk_01`, `levels/mp/kamino_01`, `levels/mp/naboo_01`, `s5_1/levels/mp/geonosis_01`, `levels/mp/deathstar02_01`.
- [ ] Then: `levels/mp/naboo_02`, `s2/levels/cloudcity_01`, `s2_2/levels/jabbaspalace_01`, `s3/levels/kessel_01`, `s2_1/levels/endor_02`, `s8_1/endor_04`; then `s9_3/hoth_02`, `s9_3/tatooine_02`, `s7_2/levels/naboo_03`, `s7/levels/kashyyyk_02`, `s7_1/levels/kamino_03`, `s6_2/geonosis_02/levels/geonosis_02`, `s8/felucia/levels/mp/felucia_01`, `s9_3/scarif/levels/mp/scarif_02`.
- [ ] For each: the README's numbers (pieces, meshes, bytes, cells, nav cells and cover slots), and `scripts/battlefront-check.mjs --level <key> --mode explore` (G1's explore when merged; else `galacticAssault` on Hoth and a lobby shot elsewhere) with a shot to `docs/superpowers/evidence/bfg-levels/<key>/`. A frame check: the rulebook's spawns (`maps/<key>.json`, G3's; Hoth's exists) fall within 2 m of the pack's ground.

### Task 5: docs, checks, PR

- [ ] `HANDOFF-battlefront.md`, "The sixth design": G2's row (levels published, sizes, the frame check, frame times at high on the laptop where the owner ran it); the spec's Departures; the ledger refreshed (`npm run coverage:bf2017`: the whole packs consume the maps' rows).
- [ ] Gates: lint, test, build, health; `battlefront-check`; the readme numbers.
- [ ] PR `Battlefront G2: every level whole, in the map's frame`; merge `origin/main` first (E0's and lane 5's `map/level.js`: keep both).
