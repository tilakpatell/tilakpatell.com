# The galaxy lands on the game: every Star Wars world's surface is its Battlefront II level, every mode the game's, and free roam its own mode and area. The design

Date: 2026-10-10 (night). Status: **design, by an architecting session for Opus 5.5 implementation sessions, one lane each.** The seventh Battlefront design of the day: the sixth, `2026-10-10-bf2017-accuracy-design.md` (PR #877, "accurate to the game": the colour chain, the bots' records, the screens, the fighters, every map's rulebook and ledger, the other modes), was written in parallel an hour earlier by another session on this account and its lanes were running when this page was finished; the section "Beside the accuracy design" says how the two split the work, and this page's lanes were narrowed to it. It sits on the game design (`2026-10-10-battlefront-game-design.md`: the sim, the rulebooks, lane 5's world), the flow design (`2026-10-10-battlefront-flow-and-mods-design.md`: the mode menu, the deploy screen), the every-asset design (`2026-10-10-bf2017-every-asset-design.md`: lane E0's level factory), the saber design (`2026-10-10-bf2017-saber-mechanics-design.md`: `saber2017.js`) and the physics, fidelity and surfaces designs, and changes one decision of the flow design (its decision 3, below). Plans: `docs/superpowers/plans/2026-10-10-bfg-laneG1-landing.md`, `-laneG2-levels-whole.md`, `-laneG3-rulebooks.md`, `-laneG4a-small-modes.md`, `-laneG4b-big-modes.md`, `-laneG5-heroes-vehicles.md`, `-laneG6-parity.md`. Hand-off: `docs/superpowers/HANDOFF-battlefront.md`, section "The sixth design: the galaxy lands on the game".

## What the owner asked

"Architect to replace all the maps and logic for Star Wars galaxy to use the Star Wars Battlefront 2 maps and then do free roam as a separate mode and area. This makes it so we can make sure all of the Star Wars logic and maps working and compare to the game itself and keep making it as close to it as possible. Look at the game's source code (2017 version) and study it in depth. Then give to Opus to implement."

Read as three things: (1) when you land on a Star Wars world you are in the 2017 game's level for that world, and what you play there is the game's modes on the game's rules; (2) the site's own planet surfaces (the hand-built towns, the quests, the chases, the crews) become **free roam**, a mode of its own with an area of its own, so the game's maps carry nothing of the site's and can be set beside the real game; (3) there is a way to measure "as close to it as possible" and keep closing the gap.

## What was found (measured, 2026-10-10 20:10–21:30 UTC, `origin/main` at `978f1e13`, the export at `C:\Users\tilak\Downloads\BF2_Extract\web`)

### The site today runs two engines, and landing goes to the wrong one

- **The galaxy surface** (`src/components/galaxy/surface/`, `pages/GalaxySurface.jsx`, module `galaxy-surface`): the site's hand-built sites (`sites/*.js`), with a level pack cut round a landing spot in the **site's frame** where a site names one (`level: 'hoth'`; lane E0 adds Endor and districts). Its missions are the site's: `missions/assault.js` on four hand-drawn maps, `hvv.js` and `blast.js` on the level's arenas **moved to open spots of the site** (`arenas.js`'s `ARENA_AT`, because Hoth's arena is inside Echo Base, which the site frame leaves out), chases and quests. Landing (`pages/Galaxy.jsx`'s `land`) hands the runtime over to this module; lane F's mode menu then sends Galactic Assault, Heroes vs Villains and Blast to **these** missions (`surface/modes.js`: `BATTLEFRONT = {}` was never flipped).
- **The Battlefront world** (`src/components/battlefront/`, route `/battlefront/hoth/galacticAssault`, lane 5): Hoth whole in the **export's frame** (lane L's pack in a group at its origin), the game's light, the sim (lanes 1 and 2: soldiers, weapons, bolts, nav, cover, bots, Galactic Assault with Hoth's three stages, Battle Points, the commander), the game's HUD widgets, the trooper's camera. Reached by URL only; nothing in the galaxy links to it. Lanes 3 (heroes), 4 (vehicles), 6 (the other modes) of the game design never started.

So the owner's "all the Star Wars logic and maps" exists in two halves that never meet: the game's rules live under `/battlefront`, the landing lives on the site's maps. This design joins them: **landing is the game**, and the site's surface becomes free roam.

### The game's own front end is data in the export, and it says which modes each level has

Not read by any earlier design:

- `UI/Data/GameModes/GameModes.json` (`GameModesListInformationAsset`): the mode list in the game's order: PlanetaryBattles, SpaceBattles, HeroesVersusVillains, Domination, Blast, SkirmishBlast, TestOfStrength, Duel, ModeC, Mode3, Mode7, SkirmishSpaceBlast, SkirmishSpaceOnSlaught, Mode6, Mode5, Mode1, Mode8, Mode9, DominationExtraction, ModeDefend, ModeE, ModeF.
- One `GameModeInformationAsset` a mode (`UI/Data/GameModes/<Mode>.json`, the add-ons' under `Addons/<Mode>/UI/Data/GameModes/`): `GameModeName` and `AurebeshGameModeName`, `Description`, `GameModeId`, `NumberOfPlayers`, `HasVehicles`, `HasHeroes`, `Complexity`, `Levels[]`. Measured:

| record | `GameModeId` | name | players | vehicles | heroes | levels |
| --- | --- | --- | --: | --- | --- | --: |
| PlanetaryBattles | PlanetaryBattles | GALACTIC ASSAULT | 40 | yes | yes | 13 |
| SpaceBattles | SpaceBattle | STARFIGHTER ASSAULT | 24 | yes | no | 6 |
| HeroesVersusVillains | HeroesVersusVillains | HEROES VS VILLAINS | 8 | no | yes | 25 |
| Domination | PlanetaryMissions | STRIKE | 16 | no | no | 11 |
| DominationExtraction | PlanetaryMissions | STRIKE / EXTRACTION | 16 | no | no | 14 |
| Blast | Blast | BLAST | 16 | no | no | 17 |
| SkirmishBlast, TestOfStrength (ONSLAUGHT), Duel | SkirmishBlast, SkirmishOnslaught, SkirmishDuel | Arcade's three | 20 | no | yes | 17–18 |
| Mode6 | Mode6 | HERO SHOWDOWN | 4 | no | yes | 23 |
| Mode5 | Mode5 | EXTRACTION | 16 | no | no | 2 |
| Mode1, Mode8 | Mode1, Mode8 | SUPREMACY (Mode8: its Instant Action form, 1 player) | 40, 1 | yes | yes | 17, 16 |
| Mode9, ModeDefend, ModeE, ModeF | | CO-OP MISSIONS (attack, defend; ModeE/F the one-player forms) | 4, 4, 1, 1 | yes | yes | 27 |
| ModeC | ModeC | JETPACK CARGO | 16 | no | no | 3 |
| Mode3 | Mode3 | EWOK HUNT | 20 | no | no | 2 |
| Mode7 | Mode7 | HERO STARFIGHTERS | 8 | no | yes | 6 |

- One `LevelInformationAsset` a level (`UI/Data/GameModes/Levels/<Name>.json`): `Key` (`Hoth_01`), `Planet` (a `PlanetInformationAsset`: `PlanetName`, `PlanetIndex`), `LevelName` (the game's name for the map: Hoth_01 is **OUTPOST DELTA**, Endor_01 **RESEARCH STATION 9**, Tatooine_01 **MOS EISLEY**, Yavin_01 **THE GREAT TEMPLE**, DeathStar02_01 **COMMAND SECTOR NORTH**, Kashyyyk_01 **KACHIRHO BEACH**, Kamino_01 **CLONING FACILITY**, Naboo_01 **THEED**, Naboo_02 **PALACE HANGAR**, Geonosis_01 **TRIPPA HIVE**, Geonosis_02 **PIPELINE JUNCTION WEST** and **SEPARATIST DREADNOUGHT**, CloudCity_01 **ADMINISTRATOR'S PALACE**, JabbasPalace_01 **JABBA'S PALACE**, Kessel_01 **COAXIUM MINE**, Felucia_01 **TAGATA**, Scarif_02 **SCARIF BEACH**, Endor_02 **EWOK VILLAGE**, Kamino_03 and Naboo_03 **REPUBLIC ATTACK CRUISER** for their Co-op layer, SB_Endor_01 **DEATH STAR DEBRIS**, SB_Fondor_01 **IMPERIAL SHIPYARD**, SB_Kamino_01 **RESEARCH OUTPOST**, SB_DroidBattleShip_01 **LUCREHULK-CLASS BATTLESHIP**), `LevelAurebesh` (the planet's name), `LevelDescription` and `LevelDescriptionOverrides[]` (a description per `GameModeId`: Hoth's Strike reads "An Imperial Strike team manages to infiltrate the Rebel Base. Their goal is to sabotage the dangerous Ion Cannon…"), `LevelId`. Strings are looked up by the hash the strings file documents (`id = hash of the key`; a `LocalizedStringId.StringHash` as 8 hex digits).
- **Which modes a level has** is in each level's `GameModes.json` (`SubWorldData`): every mode sub-level carries a `SubWorldInclusionSetting` whose `EnabledOptions` name the options of `Gameplay/GameModes/GameModeInclusionSettings` (`WorldPartInclusion`, 25 options). Measured on every multiplayer level:

| sub-level | enabled options | the mode |
| --- | --- | --- |
| `FantasyBattle` | PlanetaryBattles | Galactic Assault |
| `HeroArena` / `HeroesVsVillains` | HeroesVersusVillains | Heroes vs Villains |
| `TeamDeathmatch` / `Blast` | Blast, SkirmishBlast, SkirmishOnslaught, SkirmishDuel | Blast, and Arcade's three |
| `PlanetaryMissions` (`Domination` on Naboo_01) | **Domination**, PlanetaryMissions | **Strike** (Hoth's carries `PF_Strike_Bombs`, 23 spawns, 4 spawn areas, 2 volumes, 8 Hoth doors, 2 cameras) |
| `Mode6` | Mode6 | Hero Showdown |
| `Mode9` | Mode9, ModeDefend, ModeE, ModeF (DeathStar02 also ModeS) | Co-op (Hoth: 8 `PF_CapturePoint_Mode9`, 8 capture areas, 4 tauntaun spawners, OOB per team, `Mode9_Spawns_Team1/2`, `ModeDefend_Spawns_Team1/2`) |
| `Mode1` | Mode1 (DeathStar02, Yavin, Geonosis_02 also Mode8) | Supremacy |
| `Extraction` | Mode2 (CloudCity_01) or Mode5 (JabbasPalace_01, Kessel_01's `Mode5`) | Extraction |
| `Mode3` | Mode3 | Ewok Hunt (Endor_02, Endor_04) |
| `ModeC` | ModeC | Jetpack Cargo (Tatooine_01, Yavin_01, CloudCity_01) |
| `SpaceBattle`, `Mode7`, `SpaceArcade` | SpaceBattle, Mode7, SkirmishSpaceBlast/Onslaught | Starfighter Assault, Hero Starfighters, Arcade in space |

Lane F's `modes.json` read the sub-level **names** and so missed Strike (it lives on the `PlanetaryMissions` sub-level under the `Domination` option) and called Jabba's `Extraction` Mode5 and Cloud City's Mode2 one mode; this design reads the inclusion options and the game's own mode records, so the menu is the game's.

### The mode logic is graphs, readable by a person; the constants are records

- Mode prefabs: `Gameplay/GameModes/FantasyBattles/PF_GameMode_Conquest_Staged`, `HeroArena/PF_HeroesVersusVillains_TDM` (178 nodes, 21 `BattlepointUnitCostEntityData`), `TeamDeathmatch/PF_TeamDeathmatch_Logic` and `_MP`, `Domination/PF_Strike_Bombs` (258 nodes: 35 curves, 24 delays) and `PF_Strike_CTF`, `Mode9/PF_Mode9` (311 nodes: 10 `CombatAreaEntityData`, 14 `GameSettingsEntityData`) with `Prefabs/Mode9_BotLogic_AttackObjectives` (312 nodes), `_DefendObjectives_NEW`, `_OrphansRetreat`, `PvE_BotLogic`, `Mode8/Prefabs/Mode8_BotLogic_AttackObjectives`, `Addons/Mode1/.../PF_GameMode_Mode1` (416 nodes: 7 combat areas, 9 game settings, `PF_Mode1_Ticket_Control`, `PF_Mode1_NT_BoardingShip`, `PF_DestroyableObjective_Venator`), `Addons/Mode3`, `Mode5`, `Mode6`, `Mode7`, `ModeC`, `Skirmish/PF_Skirmish_Logic` with 24 `BattleScenarios` (each a `PlanetDataEntityData` naming two `WSTeamData`: the Arcade's era pairs) and 22 `SkirmishParam_*` (`Team1AISize` 0/2/4/8/10/15/20, score and time limits, difficulty, lives, health and cooldown modifiers: the Arcade's settings screen as data), `Shared/` (`PF_KitLimitations_PlanetaryBattles` (81 kit rows of `MaxCount`/`Price` **by property hash**, not number), `_HeroesVSVillains`, `_TrooperModes`, `_Skirmish`, `PF_CapturePoint*`, `Escort/`, `Interacts/`, `SpawnManager_Shared_MP`, `PF_CombatArea_SmallGamemodes`, `PF_EOR_*`).
- **The Battle Point numbers are a record, not a graph**: `Online/BattlepointCostData` (`BattlepointCostData`): `HeroCostConfig` (22 heroes at 4,000 in PLANETARY_BATTLES), `UnitCostConfig` (per game mode, by `Character` name: Wookiee warrior 1,500, jump troopers 1,000, death trooper 1,500, B2 1,500, flametrooper 1,500, fighters 400, AT-RT 200, speeders 200, …; 58 PLANETARY_BATTLES rows, then per-mode entries for MODE_3, MODE_C, MODE_6, Mode_5, MODE_7, BLAST, HEROES_VERSUS_VILLIANS, PLANETARY_MISSIONS, SPACE_BATTLE, MODE_1, MODE_9, MODE_DEFEND and 69 GLOBAL rows whose small values are the score events). `points.json`'s `source: "hand"` costs go: lane G3 reads this record (the saber lane already reads its `LIGHTSABER_COSTS_*`).

### The levels, the era rule, and the galaxy's systems

Under the standing sequel refusal, 23 ground levels and 4 space levels are usable; the galaxy has 18 systems. Joined:

| system | levels (the game's names) | has a level today |
| --- | --- | --- |
| hoth | Hoth_01 Outpost Delta; Hoth_02 (Supremacy) | yes (site frame; E0's base district) |
| endor | Endor_01 Research Station 9; Endor_02 Ewok Village; Endor_04 (Ewok Hunt) | E0's branch |
| tatooine | Tatooine_01 Mos Eisley; Tatooine_02 (Supremacy); JabbasPalace_01 | E1 (not started) |
| yavin | Yavin_01 The Great Temple | E1 |
| naboo | Naboo_01 Theed; Naboo_02 Palace Hangar; Naboo_03 (Supremacy, Co-op) | E2 |
| kamino | Kamino_01 Cloning Facility; Kamino_03; SB_Kamino_01 | E2; the space pack is on main |
| kashyyyk | Kashyyyk_01 Kachirho Beach; Kashyyyk_02 | E3 |
| geonosis | Geonosis_01 Trippa Hive; Geonosis_02 | E3 |
| bespin | CloudCity_01 Administrator's Palace | E4 |
| scarif | Scarif_02 Scarif Beach | E4 |
| the Death Star (`/deathstar`) | DeathStar02_01 Command Sector North | E4 |
| felucia, kessel, fondor, ryloth | Felucia_01 Tagata; Kessel_01 Coaxium Mine; SB_Fondor_01; SB_DroidBattleShip_01 | E5 (new systems) |
| alderaan, dagobah, mustafar, coruscant, nevarro, mandalore, lothal, sorgan | none in the game | free roam only |

Map sizes (`web_opt/maps/index.json`): Hoth_01 24,532 placed pieces of 602 meshes; Endor_01 18,530; Tatooine_01 20,321; Yavin_01 15,428; DeathStar02_01 21,722; Kashyyyk_01 15,827; Kamino_01 14,330; Naboo_01 18,720; Geonosis_01 9,580; Naboo_03 36,507; Kashyyyk_02 34,010; Kamino_03 32,337; Felucia_01 33,133. Lane 5 draws Hoth from lane L's **site-frame** pack (5,815 pieces at low; the base's halls and the west 200 m are out), so the game world has never drawn a whole level: the whole-map pack of the game design's decision 15 (`--frame map --no-fit`) was never built, and E0's builder has no such flag (it cuts round `--spot`/`--spawn` with an `--arena` horizon).

### What is on its way, and what this design waits for

- **E0** (`claude/bf2017-e0-factory`, running, 968 files, no PR yet): districts (`SITES[id].districts`, `?district=`), every map part beside `level.json` (lights, actors, vehicles, decals in Q4's shape, effects, tracks, probes, far shadow, scatter table, physics), packs out of git (published to `site-assets`; `level.json` and README in git), `--spawn`, `--inside`, `--parts`, `--mode`, `--weather`. E1–E5 wait on it. Lane G2 here builds on it.
- **Lane S** (PR #875, the saber as the game's): `src/lib/combat/saber2017.js` is a pure engine (the records' cone query, the deflect shield, stamina, the dodge) used by the galaxy surface's `saber.js` and lane H's bots. Lane G5 here puts the sim's heroes on it.
- **Lane 5** (`claude/bf-world`, running: weapons in hand, ragdolls, building collision, the squad list). Lanes G1 and G4 touch its files on their own keys (the file split is in the hand-off).
- **Lane A** (merged, #870): Starfighter Assault runs on the galaxy's fleet sim in the galaxy page (`/galaxy/<system>?battle=starfighter`), not in the game world. It stays there (decision 9).
- A desktop session titled "BF2 codebase analysis and site integration" made a worktree `claude/bf2017-accuracy` at 20:08 UTC with nothing on it yet. If it is an architect on this same question, this page is the one that was finished first; it should read this and take a lane.

## Decisions

1. **Landing is the game.** `/galaxy/:system/surface` becomes the Battlefront world for every system that has a level: `pages/Galaxy.jsx`'s `land` hands the runtime over to `battlefrontModule` (through `src/components/battlefront/index.js`, the islands rule) with `{ system, level, mode: 'lobby' }`, the same dive and veil as today. The world comes up in a **lobby**: the level streaming in whole, the camera on the level's Lobby/deploy camera (`maps/<level>.json`'s `cameras`, the `CameraEntityData` of the first mode's layer), the game's light, and the galaxy's **mode menu** over it (lane F's `ModeMenu.jsx`, kept, fed by decision 3's data). Picking a mode starts that mode's sim on that level and opens the game's deploy screen (lane 5's `DeployScreen.jsx`, the game's `SpawnOverlayScreen`). A system with no level (Alderaan, Dagobah, Mustafar, Coruscant, Nevarro, Mandalore, Lothal, Sorgan) lands as it does today: the mode menu over the site's surface with every game card dimmed "the game has no level on <planet>", and Free roam live.
2. **Free roam is its own mode and its own area.** The site's surface moves to `/galaxy/:system/roam` (`pages/GalaxyRoam.jsx`, the file that is `GalaxySurface.jsx` today, renamed; module id `galaxy-roam`; `?district=` and `?mission=` live there). Nothing in it is deleted or rewritten: the sites, quests, chases, crews, places, flora, the site's three skirmishes (`missions/assault.js`, `hvv.js`, `blast.js`) and their HUDs stay, reached from free roam's own Menu under "The site's skirmishes" until the game's modes cover them, when a later design decides their fate. The mode menu's Free roam card goes to `/roam`; free roam's Menu gains "Change mode" back to `/surface`. The galaxy map's Land button, the briefing page's cards and the achievements follow the new routes; `?mode=free` and old `/surface?mission=` links redirect to `/roam`.
3. **The menu is the game's front end, from its own records.** A new extractor command, `node scripts/bf2017-data.mjs frontend`, writes `src/data/bf2017/frontend.json`: the mode list in the game's order with each mode's id, name, Aurebesh name, description, players, `hasVehicles`, `hasHeroes`; every usable level with its key, planet, name, Aurebesh name, description, per-mode descriptions, `LevelId` and its **modes from the inclusion options** (the table above; `Domination` → `strike`, `Mode9|ModeDefend` → `coop`, `Mode6` → `showdown`, `Mode1` → `supremacy`, `Mode2|Mode5` → `extraction`, `Mode3` → `ewokHunt`, `ModeC` → `jetpackCargo`, `SkirmishBlast|Onslaught|Duel` → `arcade`, `SpaceBattle` → `starfighter`, `Mode7` → `heroStarfighters`); the planets; and the galaxy's `system → levels` join (`hoth` → `hoth_01`, `hoth_02`; the Death Star page → `deathstar02_01`). The sequel levels, modes and planets are refused by `isSequel`. `surface/modes.js` reads it (its `MODES` list becomes the game's order, its `BATTLEFRONT` rows become every level's route) and gains a **level picker** where a planet has more than one level, each card titled with the game's level name (OUTPOST DELTA · HOTH) and its description for the mode. `modes.json` is kept only as the names lane F's tests pin, derived from `frontend.json` by the same command.
4. **Every level, whole, in the map's frame.** E0's builder gains `--whole`: the pack is the whole level (no `--spot`, no horizon, origin 0 and yaw 0 so the rulebooks' coordinates are the pack's), fitted to no budget row on desktop tiers (textures capped per tier only; low keeps a far-cut horizon beyond 400 m), with every part E0 writes and a `nav.bin` (the game design's decision 7: a 2 m navgrid from the heightmap and the physics hulls, cover slots, portals), written to `public/models/galaxy/bf2017/levels/<world>/game/<levelKey>/` and published like E0's. The game world's `map/level.js` loads by level key and drops its origin group. The roam packs (E0, E1–E5: cut round a spot, in the site's frame) are untouched: a level exists twice on the bucket, once for each area, and that is fine. Order: Hoth_01, Endor_01, Tatooine_01, Yavin_01, Kashyyyk_01, Kamino_01, Naboo_01, Geonosis_01, DeathStar02_01 (the nine Galactic Assault levels), then the small-mode levels (Naboo_02, CloudCity_01, JabbasPalace_01, Kessel_01, Endor_02, Endor_04), then the Supremacy and Co-op levels (Hoth_02, Tatooine_02, Naboo_03, Kashyyyk_02, Kamino_03, Geonosis_02, Felucia_01, Scarif_02).
5. **Every mode on the sim, from its layer and its graph.** `src/lib/battlefront/modes/` gains one pure module a mode beside `galacticAssault.js`: `blast.js`, `hvv.js`, `showdown.js`, `strike.js` (the small modes, lane G4a), `coop.js`, `supremacy.js`, `extraction.js`, `ewokHunt.js`, `jetpackCargo.js`, `arcade.js`, `explore.js` (lane G4b). Each reads its level's layer from the map rulebook (`MODE_LAYERS` grows: `PlanetaryMissions` → strike, `Mode9` + `ModeDefend` → coop, `Mode6` → showdown, `Mode1` → supremacy, `Extraction`/`Mode5` → extraction, `Mode3` → ewokHunt, `ModeC` → jetpackCargo) and, where the graph decides order or rules, a hand file `maps/<level>.<mode>.json` written from the graph by a person with the node named beside each value (`source: "hand"`, a `NOTES.md` line), as Hoth's `stages.json` is. The game's numbers that are records are read, not hand: the Battle Point costs and score events (`Online/BattlepointCostData`), the kit limits where their property hashes resolve (`PF_KitLimitations_*`; otherwise hand with the hash noted), the Arcade's parameters and scenarios, the capture point's thresholds, the combat areas. Each mode has a no-player arena test, a row in `battlefront-balance.mjs`, its view for the HUD, and the game's HUD widgets for it (lane M's `widget(name)`: `HudScreenMode1`, `TitanPhaseHudWidget`, Mode9's `PF_UI_Mode9_ObjectivePicker`, Strike's, Showdown's). **Explore** is the level with no battle: the sim with no bots and no mode, you as a trooper of either side, every vehicle at its spawn to board, for walking the whole map and comparing it with the game.
6. **The galaxy surface's missions stop being the mode cards' targets.** The flow design's decision 3 ("the modes run on what exists first") is withdrawn: Galactic Assault, Heroes vs Villains and Blast cards go to the game world on the real level (`/galaxy/<system>/surface?level=<key>&mode=<id>`), never to `missions/*`. Until lane G4a lands, the HvV and Blast cards say "soon" (the game's level; the site's version is under free roam).
7. **Heroes and vehicles enter the sim** (the game design's lanes 3 and 4, together): hero entities with their health and armour affectors, abilities from `abilities.json` on channels, saber heroes on `saber2017.js` (the same engine the surface's saber and lane H's bots run; the sim calls its pure step), blaster heroes on their weapon rows, hero bots (`ai/heroBrain.js`: saber heroes close and chain with blocks when a bolt comes, ranged heroes kite, abilities by situation); vehicle entities from `vehicles.json` (AT-ST, AT-RT, speeder bikes, the T-47, tauntauns at their mount spawners, the DF.9 and Atgar turrets, the AT-AT as a true vehicle with its seats) on P3's handling where it exists and a hand kinematic row where not, drawn by the world with lane V's cuts, vehicle bots (walkers hunt, speeders strafe, turrets track); the deploy screen offers heroes, reinforcements and vehicles at the record's prices and the mode's kit limits; the commander buys them. The galaxy's hero pick (`HERO_KEY`) seeds the deploy screen's highlight.
8. **Parity is measured.** `scripts/bf2017-parity.mjs` writes `docs/superpowers/evidence/bf2017-parity/ledger.md` (and `--check` fails on a regression): one row per level × mode with the pack (whole? published? pieces drawn of the map's), the layer read (spawns, areas, volumes, prefabs found of the layer's), the stage or rules file (`game` / `hand` / `missing`), the sim mode (done / missing), the HUD widgets drawn of the mode's widget list, the kits offered of the team record's (classes, heroes, reinforcements, vehicles), the prices (`game` / `hand`), the browser check (green / none). `scripts/bf2017-compare.mjs` takes shots of every level from its own deploy and outro cameras at each tier and lays them beside the owner's screenshots of the real game from the same cameras (the game's deploy screen shows exactly those cameras: the owner drops `docs/superpowers/evidence/bf2017-parity/game/<level>/<camera>.jpg` and the page pairs them), with a pixel difference and a note. In the game world, `?gizmos=1` draws the mode's spawns, spawn areas, volumes, capture points, OOB and vehicle paths from the rulebook, so what the sim thinks the layer is can be seen against the game's. The hand-off's status table is the ledger's summary.
9. **Starfighter Assault stays where lane A put it**: in the galaxy page over the planet (`?battle=starfighter`), reached from the mode menu's card as now. Its move onto the sim is a later design's (the game design's lane 6 names it); this design does not fork the fleet sim.
10. **Nothing of the site's roam moves**: no budget rows change for `/galaxy`'s roam; the game world keeps "no budget rows" (the game design's decision 5), files under 800 lines, `src/lib` imports no React and no world, the galaxy reaches the game only through `src/components/battlefront/index.js` and the game reaches the galaxy only through `galaxy/shared/`. No sequel era. Phones land in the game at the low tier as desktops do (the owner wants the comparison everywhere); a phone that cannot hold the level is offered free roam by the veil's "Go in anyway" rule.
11. **Routes, in full.** `/galaxy/:system/surface` (the game: `?level=<key>` the planet's first Galactic Assault level by default, `?mode=<id>` straight into a mode, `?gizmos=1`); `/galaxy/:system/roam` (free roam: `?district=`, `?mission=`); `/battlefront/:level/:mode` stays as the direct door for the checks and links, mounting the same world with no planet behind it. Taking off from the game (Menu → Take off) hands back to the galaxy as the roam does today (`pages/GalaxySurface.jsx`'s `takeOff` moves to a shared hook both pages use).

## The mode catalogue, from the game's data

What each mode is, where its rules are in the export, what is a record and what a person reads from the graph. Lane G4a/G4b's plans use these names.

| mode | id | the layer (per level) | the prefab | rules read from records | rules read from the graph (hand, with the node named) |
| --- | --- | --- | --- | --- | --- |
| Galactic Assault | `galacticAssault` | `FantasyBattle_*` | `PF_GameMode_Conquest_Staged` | spawns, areas, volumes, waypoints, capture thresholds; costs | the stage order and objective kinds (done for Hoth; eight more levels) |
| Blast | `blast` | `TeamDeathmatch_*` (`_Online` spawns and camera) | `PF_TeamDeathmatch_Logic`, `TeamDeathmatchStateManager` | spawns, the combat area, `MaxKillCount` | the kill limit (the strings: 100) |
| Heroes vs Villains | `hvv` | `HeroArena_*` | `PF_HeroesVersusVillains_TDM` (21 `BattlepointUnitCostEntityData`: `HvV_ENABLE_<HERO>` per mode and map) | the arena, 24 spawns, which heroes are enabled where, `PF_KitLimitations_HeroesVSVillains` | the target rule and 10 points |
| Hero Showdown | `showdown` | `Mode6_*` (4 spawns, 2 areas, 1 volume) | `Addons/Mode6/.../PF_Mode6` | the arena, spawns, costs (MODE_6: 10, 300) | 2 v 2 elimination, rounds to win |
| Strike | `strike` | `PlanetaryMissions_*` (23 spawns, 4 areas, 2 volumes, doors, 2 cameras on Hoth) | `Domination/PF_Strike_Bombs`, `PF_Strike_CTF`, `Pf_FlagDropOff` | spawns, areas, the pickup and delivery volumes, the 35 curves | which variant a level runs (bombs or carry), the timer, one round each way |
| Co-op | `coop` | `Mode9_*`, `ModeDefend_Spawns_*`, `Mode9_Inf_Shapes_*`, `Mode9_OOB*` | `Mode9/PF_Mode9`, `Prefabs/Mode9_BotLogic_*`, `PvE_BotLogic` | 8 capture areas, 8 capture points, spawns per team and phase, OOB, mounts, costs (MODE_9/MODE_DEFEND tables) | the phase order (which posts open when), the attack and defend bot logic's choices |
| Supremacy | `supremacy` | `Mode1_*` | `Addons/Mode1/.../PF_GameMode_Mode1`, `PF_Mode1_Ticket_Control`, `PF_Mode1_NT_BoardingShip`, `PF_DestroyableObjective_Venator` | capture points, combat areas, tickets, costs (MODE_1), the boarding ship, the capital's objectives | the two phases (ground, boarding) and their switch; Mode8 is the same with one player |
| Extraction | `extraction` | `Extraction` (Mode2) or `Mode5` | `Addons/Mode5/...` | the cart's route, the spawns, costs (Mode_5: 300, 1,500) | the cart's checkpoints and the timer |
| Ewok Hunt | `ewokHunt` | `Mode3` (Endor_02, Endor_04) | `Addons/Mode3/.../PF_GameMode_Mode3`, the Ewok kit (`Ability_Ewok_*`, `Affector_Mode3HealthRegen`, the flashlight weapons) | the Ewok's abilities, the night's light record, costs (MODE_3) | the turn rule (a trooper down becomes an Ewok), the dawn timer |
| Jetpack Cargo | `jetpackCargo` | `ModeC` (Tatooine_01, Yavin_01, CloudCity_01) | `Addons/ModeC/...` | the cargo and drop points, the jetpack kit, costs (MODE_C: 8, 600) | the carry rule and the score |
| Arcade | `arcade` | `TeamDeathmatch` (Skirmish options) | `Skirmish/PF_Skirmish_Logic`, 24 `BattleScenarios`, 22 `SkirmishParam_*`, `PF_KitLimitations_Skirmish` | the scenario pairs, every parameter's index values, Onslaught and Duel's limits | nothing: the Arcade is its parameters |
| Explore | `explore` | any | none | the level's vehicle spawns | nothing |

## Architecture

```
src/data/bf2017/frontend.json                      the game's front end: modes, levels, planets, the system join (lane G1)
src/data/bf2017/maps/<level>.json                  one per usable level (lane G3; five exist)
src/data/bf2017/maps/<level>.<mode>.json           the hand files from the graphs (G3 writes the Galactic Assault stages; G4a/b their modes')
src/data/bf2017/points.json                        costs and score events from Online/BattlepointCostData (G3; `hand` only where the record is silent)
src/data/bf2017/arcade.json                        the 24 scenarios and 22 parameters (G3)
src/data/bf2017/kits.json                          the kit limits per mode where the hashes resolve (G3)

src/lib/battlefront/modes/{blast,hvv,showdown,strike}.js            lane G4a
src/lib/battlefront/modes/{coop,supremacy,extraction,ewokHunt,jetpackCargo,arcade,explore}.js   lane G4b
src/lib/battlefront/{heroes,vehicles}.js, ai/{heroBrain,vehicleBrain}.js   lane G5
src/lib/battlefront/rulebook.js                    levelOf keyed by the game's level key (hoth_01); `hoth` stays an alias (G3)

src/components/battlefront/index.js                ROUTE, routeFor(level, mode), LEVELS (from frontend.json), levelsOf(system), battlefrontModule (G1)
src/components/battlefront/module.js               props { system?, level, mode: 'lobby' | id }; the lobby state; do('mode', id), do('level', key), do('takeOff') (G1)
src/components/battlefront/map/level.js            loads levels/<world>/game/<key>/ by key; no origin group (G2)
src/components/battlefront/hud/*                   the per-mode widgets (G4a/b), the deploy screen's heroes, reinforcements and vehicles (G5)
src/components/battlefront/gizmos.js               ?gizmos=1 (G6)

src/pages/GalaxySurface.jsx                        the game over the planet: the handover, the title card, the menu, the deploy, take-off (G1)
src/pages/GalaxyRoam.jsx                           free roam (today's GalaxySurface.jsx, renamed; G1)
src/pages/Galaxy.jsx                               land → the game or the roam; the briefing's cards (G1)
src/components/galaxy/surface/modes.js             reads frontend.json; the level picker; every card's route (G1)

scripts/bf2017-data.mjs frontend | map --level <key> | points | arcade | kits   (G1, G3)
scripts/bf2017-level.mjs --whole                   the game packs (G2)
scripts/bf2017-parity.mjs, scripts/bf2017-compare.mjs, docs/superpowers/evidence/bf2017-parity/   (G6)
```

## Beside the accuracy design (PR #877, written in parallel)

The sixth design's lanes started at 20:15 UTC from `claude/bf2017-accuracy`; this page's at 21:19. Where both name the same work, **#877's lane owns it** and this page's lane consumes it, with two corrections #877's maps lane is told of by message (its plan reads Strike as the `ModeE` layer and Supremacy as `Mode9`'s ground half; the inclusion options say Strike is the `Domination` option on the `PlanetaryMissions` sub-level with `PF_Strike_Bombs`/`PF_Strike_CTF`, `Mode9` and `ModeDefend`/`ModeE`/`ModeF` are Co-op, and `Mode1`/`Mode8` are Supremacy):

| #877's lane | what it owns that this page also named | this page's lane does instead |
| --- | --- | --- |
| screens (`claude/bf2017-screens`) | `info.json` (the 61 mode, level and planet information assets, the mode list's order), the game's screens (Start, Main menu, Play, Loading, Spawn, In-game menu, End of round, Kill screen, Scoreboard), the galaxy's cards named from `info.json` | G1 writes `frontend.json` with only what `info.json` lacks: each level's **modes from the inclusion options** and the `system → levels` join; names, descriptions and order come from `info.json` once it lands (`modes.json`'s until then). G1's landing menu is lane F's `ModeMenu` with the level picker; when the screens lane's `Play.jsx` lands, the landing may draw it over the lobby with the Free roam card added, as a Departure. Both lanes touch `ModeMenu.jsx`, `landLine.js`, `BattlefrontWorld.jsx` and `App.jsx`: additive edits, merge keeping both; the lobby state in `module.js` is G1's, the screens' flow for `/battlefront` with no level is the screens lane's. |
| maps (`claude/bf2017-maps`) | the map rulebook for every usable level, `modes.json` regenerated from the rulebooks, the Galactic Assault stage files by hand, **Strike, Extraction, Ewok Hunt and Supremacy's ground phase** on the sim, the per-map ledger (`scripts/bf2017-map-audit.mjs`, `evidence/bf2017-maps/ledger.md`) and its CI check | G3 keeps `points.json` from `Online/BattlepointCostData`, `kits.json`, `arcade.json`, and `rulebook.js`'s keys and aliases over whatever file names the maps lane chooses; G4a keeps Blast, Heroes vs Villains and Hero Showdown (Strike is the maps lane's; G4a reads its Strike once merged); G4b keeps Co-op (the maps lane's "supremacy ground" is Co-op by the records: G4b takes that module over and renames it, keeping its tests), Supremacy's boarding phase on top of the maps lane's ground phase, Jetpack Cargo, Arcade and Explore; G6's ledger is one table with the maps lane's: G6 adds the mode columns (rules, sim, HUD, kits, prices, check, score) to `bf2017-map-audit`'s rows and page rather than a second ledger, and keeps the compare harness and the gizmo overlay. The maps lane's plan registers the new modes as surface missions (`MISSIONS[world]`): with this page, the cards go to the game world (decision 6), so the ids belong in `battle.js` and `BUILT`, not `missions/index.js`; it is told. |
| bots (`claude/bf2017-bots`) | the AI system's records, cover queries, difficulties, Skirmish tactics, bot names, creature settings, the walkers' gunners | G4b's commander policies read the Co-op bot-logic graphs only (`Mode9_BotLogic_*`, `PvE_BotLogic`); G5's hero and vehicle brains take the bots lane's difficulty rows as one argument, as its plan asks of HvV's. |
| fighters, colour, picture | Starfighter Assault's handling and behaviour trees; the colour chain; the picture | nothing here touches them (decision 9 already left Starfighter Assault alone). |

## Lanes

| lane | what | branch | needs | plan |
| --- | --- | --- | --- | --- |
| **G1** the landing | `/surface` is the game, `/roam` is free roam; the handover to `battlefrontModule`; the lobby state and the menu over the level; `frontend.json` (the inclusion modes and the system join) and `modes.js` on it with the level picker; `explore`; take-off; the briefing's and the map's links; the redirects | `claude/bfg-g1-landing` | nothing (`info.json` from #877's screens lane when it lands) | `2026-10-10-bfg-laneG1-landing.md` |
| **G2** every level, whole | `--whole` on E0's builder with `nav.bin`; the nine Galactic Assault levels first, then the rest; `map/level.js` by key; the parts drawn in the game world (lights, probes, far shadow, actors, vehicles at their spawns) through `galaxy/shared/level.js` | `claude/bfg-g2-levels-whole` | E0 on main (or its branch merged into this one) | `-laneG2-levels-whole.md` |
| **G3** the costs, kits and Arcade | `points.json` from `Online/BattlepointCostData`; `kits.json` from `PF_KitLimitations_*`; `arcade.json`; `rulebook.js` keyed by level key with aliases over the maps lane's file names; the two layer corrections sent to the maps lane (the map rulebooks and the Galactic Assault stage files are #877's maps lane's) | `claude/bfg-g3-rulebooks` | nothing | `-laneG3-rulebooks.md` |
| **G4a** the small modes | Blast, Heroes vs Villains, Hero Showdown on the sim, with their HUD widgets and arena tests, on Hoth first (Strike is #877's maps lane's) | `claude/bfg-g4a-small-modes` | Hoth's rows (now); the maps lane's rulebooks for the rest; G5 for real heroes (hero bodies as soldiers on hero health until then, as lane 2 did) | `-laneG4a-small-modes.md` |
| **G4b** the big modes | Co-op (taking over and renaming the maps lane's `Mode9` module, its bot logic as commander policies), Supremacy's boarding phase over the maps lane's ground phase, Jetpack Cargo, Arcade (scenarios and parameters), Explore's vehicles (Extraction and Ewok Hunt are the maps lane's) | `claude/bfg-g4b-big-modes` | G3 and the maps lane merged; G5 for vehicles | `-laneG4b-big-modes.md` |
| **G5** heroes and vehicles | hero entities on `saber2017.js` and `abilities.json`, hero bots; vehicle entities on `vehicles.json` and P3, vehicle bots; the deploy screen's offers at the record's prices | `claude/bfg-g5-heroes-vehicles` | lane S merged (#875); G3's `points.json` | `-laneG5-heroes-vehicles.md` |
| **G6** parity | the mode columns on the maps lane's ledger and its `--check`, the compare harness and the owner's `game/` folder, the gizmo overlay, the hand-off's table | `claude/bfg-g6-parity` | nothing (on `/battlefront`; the maps lane's ledger when it lands, else its own rows until then) | `-laneG6-parity.md` |

G1, G3, G4a and G6 start at once; G2 when E0 is on main (or from E0's branch, merging it first); G4b after G3; G5 after #875 merges. File ownership (so the four that run together never meet): G1 owns the pages, `App.jsx`'s routes, `surface/modes.js`, `useModeMenu.js`, `ModeMenu.jsx`, `battlefront/index.js`, `battlefront/module.js`'s props and `do`, `BattlefrontWorld.jsx`, `bf2017-data.mjs`'s `frontend`; G3 owns `scripts/lib/bf2017-rulebook-map.mjs`, `bf2017-rulebook.mjs`'s points and kits, `src/data/bf2017/maps/*`, `points.json`, `arcade.json`, `kits.json`, `rulebook.js`; G4a owns `src/lib/battlefront/modes/{blast,hvv,showdown,strike}.js`, `battle.js`'s mode switch (additive rows), `hud/` files it adds; G6 owns the two scripts, `gizmos.js`, the evidence folder. Lane 5's running session keeps `figures/`, `fx/`, `input.js`, `camera*.js`, `weather.js` and the HUD parts it has.

## Testing and gates

- G1: `modes.test.js` (every system's cards; a system with no level dims every game card with the reason; a planet with two levels shows the picker; `?mode=free` and `/surface?mission=` redirect to `/roam`); `frontend.json`'s test (every level's modes equal its inclusion options; no sequel key); `landing-check.mjs --surface hoth` lands in the game under 30 s at high with the bucket base in a fronted headless tab (SwiftShader compares steps); `galaxy-check surface hoth` on `/roam` unchanged with `BUDGET=1`; `battlefront-check` through `__battlefront.do('mode', 'galacticAssault')`.
- G2: each pack's README numbers (pieces, meshes, bytes, cells, the nav's cells and cover slots); `level.test.js` loads a committed `level.json` by key; a check that the rulebook's spawns fall on the pack's ground within 2 m (the frame is right).
- G3: the extractor's fixture tests per new command; `rulebook.test.js` (every level's map has every mode layer the inclusion names; every stage file's volumes and spawns exist in its map; `points.json` carries `_source` on every cost).
- G4a/b: an arena test a mode (a no-player round ends within the mode's time; both sides win across seeds; nobody leaves the navgrid); `battlefront-balance.mjs --mode <id> --level <key>`; the HUD parts' tests; `battlefront-check` driving each mode to its end.
- G5: hero and vehicle unit tests; the arena with heroes and vehicles bought; the deploy screen's offers equal the team record's lists at the record's prices.
- G6: the ledger's `--check` in CI; the compare page built with at least Hoth's cameras; the gizmo overlay's shot.
- Always: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; the WebGPU leg of any fixture on the owner's laptop (the cloud's software device is too slow).

## Open assumptions, marked

1. **The kit-limit hashes** (`PF_KitLimitations_*`'s `MaxCount`/`Price` as property hashes) resolve through the prefab's `PropertyConnections` to `IntEntityData` nodes; if they do not, the limits are hand (the game as played: one hero a team, four reinforcements) and the prices come from `Online/BattlepointCostData`, which is a record.
2. **A whole level fits the browser.** Hoth whole is 24,532 pieces; lane 5's cut drew 5,815 at low. G2 measures each level at high on the laptop; where a level does not hold 60 fps at high, the tier's texture cap and lane U's headroom rules apply before any piece is dropped.
3. **The graphs are read right.** Each hand file names the node it was read from; the parity ledger marks it `hand`; the owner's game screenshots and lane D2's reading of the mods' graphs (the flow design) are how a wrong reading is found.
4. **Lane S's engine is stable** (#875 open): G5 starts when it merges; if it changes shape, G5 wraps it once in `heroes.js`.
5. **E0 merges soon**; if it does not within the day, G2 starts from E0's branch and merges main as E0 would.

## What this design does not do

- Does not delete or rewrite the site's surface, its missions or its sites: free roam keeps all of it.
- Does not move Starfighter Assault onto the sim (decision 9).
- Does not build online, progression or the mods (the flow design's D2 is the mods' lane).
- Does not read the executable; the graphs are read by a person, as every design before it.
- Does not touch the universe, the Death Star's inside, or any other world; the Death Star page gains one link to DeathStar02_01's game world when G2 publishes it.

## Departures

Where a lane goes another way than this page, one line each, added by the lane when it merges.
