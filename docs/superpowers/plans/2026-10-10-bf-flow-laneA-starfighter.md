# Lane A: Starfighter Assault from the game's space levels. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (one session, task by task; no review loops). Steps use checkbox (`- [ ]`) syntax.

**Goal:** From the landing menu (lane F) or the briefing, "Starfighter Assault" takes off into the game's Endor space battle: the `SB_Endor_01` level as the arena (the Death Star II's surface, the fleet), the mode's objective phases from the level's `SpaceBattle` layer, the fighters and capital ships the game's own, fought by the site's Fleet Assault sim; then Kamino, Fondor and the droid battleship as their systems allow.

**Architecture:** A level pack per space level (`scripts/bf2017-level.mjs --frame map --no-fit --no-terrain`, lane L's builder: no heightmap; the instances are the fleet, the station and the debris), a `SpaceBattle` row in lane 0's map rulebook (spawns, objective volumes, `PF_DestroyableObjective_*` prefabs, intro and outro cameras), a `missions/starfighter.js` that binds `universe/battle.js`'s phases to those objectives, and an entry on the galaxy's flight page (`?battle=starfighter`) that lays the pack at the planet in place of the war's own battle.

**Spec:** `2026-10-10-battlefront-flow-and-mods-design.md`, decision 4; the game design's "SpaceBattles" row; `HANDOFF-fleet-war.md` for the sim.

## Global constraints

- Start from `main` (lane L's `bf2017-level.mjs` and `surface/level/*` are merged; lane K's planet skins; the fleet war). Own: `scripts/lib/bf2017-rulebook-map.mjs` (the `SpaceBattle` entry in `MODE_LAYERS`, additive), `src/data/bf2017/maps/sb_endor.json` (+ `.stages.json`), `public/models/galaxy/bf2017/levels/sb_endor/` (the pack; published to the bucket by `assets-publish.mjs` if over the committed size rule, as Hoth's was handled), `src/components/galaxy/surface/missions/starfighter.js` (+ test) and `starfighterMaps.js`, `src/components/galaxy/warfront.js` (the `starfighter` entry, additive), `src/components/galaxy/battles.js` (`layStarfighter`), `src/components/universe/battle.js` (objective binding, additive), `pages/Galaxy.jsx` (`?battle=`), `scripts/bf2017-level.mjs` (`--no-terrain`, additive with its test).
- Sequel space levels refused (`sb_resurgent_01`, `sb_spacebear_01`).
- The galaxy's budgets hold on the flight page (`fly-check`); the pack streams by cells as Hoth's does; the fighters' models are the export's (`gameplay/vehicles/air/*`: the site has `arc170` and `awing` published; import `xwing`, `ywing`, `tie_ln`, `tie_in`, `tie_bomber`, `tie_interceptor`, `a_wing` as needed with `bf2017-import.mjs --kind <id> --as '...' --asis --native`, credited by the import).
- Files under 800 lines; the usual gates; British spelling.

## Tasks

### Task 1: The `SpaceBattle` layer in the rulebook

- [ ] `MODE_LAYERS` gains `starfighter: 'SpaceBattle'`; `mapRow` reads the layer's `AlternateSpawnEntityData` (team, priority: the fighters' launch points), the objective volumes and the `PF_DestroyableObjective_*` and `PF_Objective_*` prefabs (name, transform, health if the record has it), `CameraEntityData` of the `IntroTeam1_NIS`/`OutroTeam*_NIS` layers; fixture: a cut of `sb_endor_01`'s layer under `scripts/fixtures/bf2017/data/Levels/Space/SB_Endor_01/`.
- [ ] `node scripts/bf2017-data.mjs map --root <web dir> --level sb_endor_01` → `src/data/bf2017/maps/sb_endor.json`; a hand `sb_endor.stages.json` (the game's phases: the Death Star's approach, the Star Destroyers' shields and bridges, the station's objective; written from the objective names and the stage strings `ID_SPACEBATTLE_*`, each with `source: "hand"` and a `NOTES.md` line).
- [ ] Tests on the fixture; the rulebook test passes.

### Task 2: The pack

- [ ] `bf2017-level.mjs --no-terrain` (a level with no terrain record builds no ground layer; the pack's README says so); build `levels/space/sb_endor_01/sb_endor_01` with `--frame map --no-fit --world endor-space`; the README's table (instances, meshes, cuts, MB) in the PR.
- [ ] A `level` viewer shot (`galaxy-check` or a scratch page) of the pack from the intro camera: the station, the fleet lines, the debris; the sky from lane K's panorama (`textures/levels/space/sb_endor_01/planet/t_space_endor01_c`) and the skinned Endor.

### Task 3: The mission on the sim

- [ ] `missions/starfighter.js`: `createStarfighter(map, stages, { seed, tier })` → `createBattle` options from the level: the two lines laid where the level's spawns and capital-ship instances stand (not `battles.js`'s synthetic layout), objectives bound to the `PF_DestroyableObjective_*` records in stage order (phase 1 the shields, 2 the bridges, 3 the station's objective; the game's), fighter counts per side from `perSide(tier)`; `stepStarfighter` is `stepBattle`; the end as the sim's.
- [ ] `starfighter.test.js`: the phases follow the stages; a no-player run ends either way under 12 minutes at the mid tier across three seeds; the layout keeps every ship clear of the station's solids.

### Task 4: The entry

- [ ] `pages/Galaxy.jsx` and `warfront.js`: `?battle=starfighter` at a system with a starfighter map lays `createStarfighter` instead of the war's battle (the war's stands aside, as the system's fleets do), draws the pack through the flight scene (lane L's `levelStream` on the flight page: the hand-off says `/fly/hoth` reads the pack's heightmaps when its worker can; here there is no terrain), the sky and the planet; your crew's lines from the fleet war's set; the HUD the war's (`WarHud`) with the stage names from the strings.
- [ ] The surface's take-off (lane F's menu card `starfighter` → `takeOff` → `/galaxy/endor?battle=starfighter`); the briefing page's card.
- [ ] `fly-check` on the route: the pixel of the station in frame; the frame time.

### Task 5: Kamino, then the rest

- [ ] Repeat Tasks 1–3 for `sb_kamino_01` (Kamino's system exists) with its stages; Fondor and the droid battleship (Ryloth) when their systems exist: write their rulebooks now (cheap), their packs later, and say so in the hand-off.

### Task 6: Docs, checks, PR

- [ ] `HANDOFF-battlefront.md` "The flow and the mods": lane A's row with the numbers; the spec's Departures; `docs/architecture.md`.
- [ ] Gates: lint, test, build, health, `fly-check`, `galaxy-check space endor`.
- [ ] PR `Battlefront lane A: Starfighter Assault over Endor`; merge `origin/main` first (lane H touches `missions/index.js` on other keys: keep both).
