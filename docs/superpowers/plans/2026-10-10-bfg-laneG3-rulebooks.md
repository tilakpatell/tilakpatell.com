# Lane G3: the rulebooks for every level and every mode. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (one session, task by task; no review loops). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Every usable level has a map rulebook with every mode layer's spawns, areas, volumes, prefabs, paths, OOB, cameras and locators; the Battle Point costs and score events come from the game's record; the kit limits and the Arcade's scenarios and parameters are rulebooks; the eight other Galactic Assault levels have their stage files read from their graphs and strings; `rulebook.js` is keyed by the game's level key.

**Architecture:** lane 0's extractor (`scripts/bf2017-data.mjs`, `scripts/lib/bf2017-rulebook-map.mjs`, `bf2017-rulebook.mjs`, `bf2017-ebx.mjs`) grows: `MODE_LAYERS` covers every mode's sub-level (found by the level's `GameModes.json` inclusion options, not by name), new commands `points`, `kits`, `arcade`, and `map --level <key>` for every level. The export is read locally (`--root C:/Users/tilak/Downloads/BF2_Extract/web` on the owner's machine) or from the bucket's `data/` through `bf2017-fetch.mjs`.

**Spec:** `2026-10-10-bf2017-galaxy-on-the-game-design.md`, decision 5 and "the mode catalogue"; the game design's section 8 (rulebook formats).

**Narrowed beside PR #877 (read the spec's "Beside the accuracy design" first):** #877's maps lane (`claude/bf2017-maps`, running since 20:15 UTC) owns Task 1 (every map's rulebook and the mode layers) and Task 4 (the Galactic Assault stage files). **Do not do Tasks 1 and 4.** Do Tasks 2, 3, 5 and 6; in Task 5 key `rulebook.js` by the game's level key and add aliases for whatever file names the maps lane chooses (merge its branch or PR first if it has landed; read its hand-off row). Send the maps lane nothing yourself: the architect has told it the two layer corrections.

## Global constraints

- Start from `main`. Own: `scripts/bf2017-data.mjs` (`map`, `points`, `kits`, `arcade`; not `frontend`, which is G1's), `scripts/lib/bf2017-rulebook-map.mjs`, `scripts/lib/bf2017-rulebook.mjs` (points, kits), `scripts/lib/bf2017-arcade.mjs` (new), `scripts/fixtures/bf2017/data/**` (additive), `src/data/bf2017/maps/*.json`, `src/data/bf2017/maps/*.stages.json`, `points.json`, `kits.json`, `arcade.json`, `NOTES.md`, `src/lib/battlefront/rulebook.js`, `rulebook.test.js`.
- Every number carries `_source`; a hand value says `source: "hand"` with the graph node it was read from in `NOTES.md`. No sequel level (`isSequel`).
- Rulebooks stay small: a level's map under 1.5 MB; `points.json`, `kits.json`, `arcade.json` under 200 KB together.

## Tasks

### Task 1: every mode layer, by inclusion

- [ ] `bf2017-rulebook-map.mjs`: read the level's `GameModes.json` (`SubWorldReferenceObjectData.BundleName` → `SubWorldInclusionSetting.EnabledOptions`) and map options to mode ids (the spec's table; `Domination` → `strike`, `Mode9|ModeDefend|ModeE|ModeF|ModeS` → `coop`, `Mode6` → `showdown`, `Mode1|Mode8` → `supremacy`, `Mode2|Mode5` → `extraction`, `Mode3` → `ewokHunt`, `ModeC` → `jetpackCargo`, `Blast` → `blast`, `SkirmishBlast|SkirmishOnslaught|SkirmishDuel` → `arcade`, `HeroesVersusVillains` → `hvv`, `PlanetaryBattles` → `galacticAssault`, `SpaceBattle` → `starfighter`, `Mode7` → `heroStarfighters`); every layer file of that sub-level (`<Sub>*.json` and the folder `<sub>/`) is read for `AlternateSpawnEntityData`, `SpawnLocationFinderShapeData`, `VolumeVectorShapeData`, `OBBData`, `AIWaypointsShapeData`, `CameraEntityData`, `LocatorEntityData`, `SpatialPrefabReferenceObjectData` (prefab name, transform, its `Team`/`Id` where set), `CombatAreaEntityData`, OOB volumes; each row tagged `mode` and `layer`.
- [ ] Prefab readings per mode: `PF_CapturePoint*` (its volume and team), `PF_Strike_Bombs`/`PF_Strike_CTF`/`Pf_FlagDropOff` (pickup and delivery), `PF_MountSpawner_*`, `PF_SecondaryStreaming` (ignored), `PF_Mode6`, `PF_Mode9`, `PF_UI_*` (ignored), Hoth's doors (`PF_Automatic*Door*`: a solid that opens; row `doors`).
- [ ] `node scripts/bf2017-data.mjs map --level <key>` for every usable key: `hoth_01` (rewritten with the new layers), `hoth_02`, `endor_01`, `endor_02`, `endor_04`, `tatooine_01`, `tatooine_02`, `jabbaspalace_01`, `yavin_01`, `naboo_01`, `naboo_02`, `naboo_03`, `kamino_01`, `kamino_03`, `kashyyyk_01`, `kashyyyk_02`, `geonosis_01`, `geonosis_02`, `cloudcity_01`, `kessel_01`, `felucia_01`, `scarif_02`, `deathstar02_01`; the existing `endor.json`, `tatooine.json`, `geonosis.json`, `kashyyyk.json` become `<key>.json` with their old names kept as aliases in `rulebook.js` until lane H's readers move. Row counts per level in the PR.
- [ ] `bf2017-rulebook-map.test.mjs`: a fixture level's inclusion → modes; Hoth's Strike layer found; the Geonosis `HeroesVsVillains` name still found.

### Task 2: the Battle Points from the record

- [ ] `bf2017-rulebook.mjs`: read `Online/BattlepointCostData` (`HeroCostConfig` by game mode: `EraCost`/`NoneEraCost` per hero; `UnitCostConfig` by game mode: `Character` → `Cost`), map `Character` names to `vehicles.json`, `reinforcements.json` and `heroes.json` ids (a table in the module; unknown names kept under `other`), and the small-valued GLOBAL and per-mode entries as the **score events** (name → points). `points.json` becomes `{ cost: { heroes: {…}, units: {…}, byMode: {…} }, earn: {…}, limits: {…}, bpRate }` with `_source` on every value; what the record does not hold (`limits`, `bpRate`) stays hand with its line.
- [ ] `src/lib/battlefront/battlePoints.js` reads the new shape (its tests updated); lane 2's hand costs go.

### Task 3: the kit limits and the Arcade

- [ ] `kits.json`: `PF_KitLimitations_PlanetaryBattles`, `_HeroesVSVillains`, `_TrooperModes`, `_Skirmish`, `_Skirmish_Space`, `PF_HeroKitMaxCount`, `PF_SpecialsKitMaxCount`, `PF_HeroVehicleKitMaxCount`: each `KitLimitationEntityData` row's `KitId`, `MaxCount` and `Price` **resolved through the prefab's `PropertyConnections` to the `IntEntityData`/`SyncedIntEntityData` they bind** (try: the hash is the target property's id); where the chain gives no number, the row keeps the hash and `source: "hand"` with the game-as-played limit (one hero a team, four reinforcements, `PF_HeroKitMaxCount`'s default). Say in `NOTES.md` how many resolved.
- [ ] `scripts/lib/bf2017-arcade.mjs` → `arcade.json`: the 24 `BattleScenarios` (each its two `WSTeamData` names → `teams.json` ids, and its planets), the 22 `SkirmishParam_*` (`ParamName`, `IndexValuesInt`/`Float`, defaults), `SkirmishBaseParameters`, the Skirmish `AINames_*` lists (the bots' names by faction), Onslaught's and Duel's limits from `PF_Skirmish_GameModeText_*` and `PF_Skirmish_Logic` where they are records.

### Task 4: the Galactic Assault stage files

- [ ] For each of `endor_01`, `tatooine_01`, `yavin_01`, `kashyyyk_01`, `kamino_01`, `naboo_01`, `geonosis_01`, `deathstar02_01`: read `FantasyBattle_Logic`'s prefabs and volumes, the stage strings (`ID_FANTASYBATTLES_<LEVEL>_STAGE<n>_TEAM<t>`, the objective strings), `PF_EscortTracker`, `PF_CapturePoint`, `PF_Interact_PlanetaryBattle_*`, the walker and vehicle waypoints, the spawn areas' Z or X bands, and write `maps/<key>.stages.json` in Hoth's shape (`attackers`, `stages[]` with `id`, `name`, `objectives[]` by `type` capture | escort | arm | hold | uplink with their volume ids, `spawns.attack/defend`, `vehicles`), each guess named in `NOTES.md` as Hoth's are (which hangar is east, the fuel order).
- [ ] `rulebook.test.js`: every stage file's volumes, spawns and waypoints exist in its map; every map has a layer for every mode `frontend.json` (G1's; until merged, the inclusion reading here) gives the level.

### Task 5: `rulebook.js` by level key

- [ ] `levelOf(rb, key)` keyed by the game's level key (`hoth_01`); `hoth` → `hoth_01` and the four lane H names kept as aliases; `levelsFor(system)`; `modesOf(rb, key)`; `stagesOf(rb, key, mode)` finds `maps/<key>.<mode>.json` or `.stages.json`; `spawnsFor(map, { mode, team })` reads the tagged rows.
- [ ] The readers on `main` that call `mapOf(rb, 'hoth')` (lane 5's `battle.js`, lane H's `arenas.js`) still work through the alias; a test says so.

### Task 6: docs, checks, PR

- [ ] `NOTES.md`: a line per hand value (the node it was read from); `HANDOFF-battlefront.md`, "The sixth design": G3's row with the counts (levels, layers, rows, costs read, kit rows resolved of 81, scenarios); the spec's Departures.
- [ ] Gates: `npx vitest run scripts/lib/bf2017-*.test.mjs scripts/bf2017-data.test.mjs src/data/bf2017 src/lib/battlefront/rulebook.test.js`; lint, test, build, health.
- [ ] PR `Battlefront G3: the rulebooks for every level and mode`; merge `origin/main` first (G1's `frontend` command in `bf2017-data.mjs`: keep both).
