# Lane G1: the landing is the game, free roam is its own area. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (one session, task by task; no review loops). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Landing on a Star Wars world that the 2017 game has a level for puts you in the Battlefront world (`src/components/battlefront/`) on that level, in a lobby with the game's mode menu over it, and picking a mode starts that mode's sim there. The site's own surface becomes **free roam** at `/galaxy/:system/roam`, untouched inside. The menu's data is the game's own front-end records (`frontend.json`), with a level picker where a planet has several levels.

**Architecture:** `pages/Galaxy.jsx`'s `land` hands the runtime over to `battlefrontModule` (through `src/components/battlefront/index.js`) for a system with a level, else to `surfaceModule` as today. A new, thin `pages/GalaxySurface.jsx` hosts the game world over the planet (the title card, lane F's `ModeMenu`, lane 5's deploy screen and HUD, take-off); today's `GalaxySurface.jsx` becomes `pages/GalaxyRoam.jsx` with its module id `galaxy-roam`. `surface/modes.js` reads `src/data/bf2017/frontend.json`, written by the extractor's new `frontend` command from `UI/Data/GameModes/**` and each level's `GameModes.json` inclusion options.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-galaxy-on-the-game-design.md`, decisions 1, 2, 3, 6, 11; the "mode catalogue" for ids.

## Global constraints

- Start from `main`. Own: `src/pages/{Galaxy.jsx,GalaxySurface.jsx,GalaxyRoam.jsx,GalaxyMission.jsx}`, `src/App.jsx` (routes only), `src/components/galaxy/surface/{modes.js,modes.test.js,useModeMenu.js,ModeMenu.jsx,module.js}`, `src/components/galaxy/systems.js` (the `game.to` rows only), `src/components/battlefront/{index.js,module.js,BattlefrontWorld.jsx}` (module: props, the lobby state and `do`; lane 5's running session keeps `figures/`, `fx/`, `input.js`, `camera*.js`, `weather.js`, its HUD parts), `scripts/bf2017-data.mjs` (`frontend` only) and `scripts/lib/bf2017-frontend.mjs` (new), `src/data/bf2017/{frontend.json,modes.json}`, `scripts/landing-check.mjs`.
- The islands rule: the galaxy imports the game only from `src/components/battlefront/index.js`; the game imports the galaxy only from `galaxy/shared/`.
- Free roam changes nothing but its route and module id; `galaxy-check surface hoth` on `/roam` with `BUDGET=1` must print the same counts as before.
- No sequel level, mode or planet in `frontend.json` (`isSequel`). Files under 800 lines; the usual gates.

## Tasks

### Task 1: `frontend.json` from the game's front end

- [ ] `scripts/lib/bf2017-frontend.mjs` (pure, tested on fixtures cut from the export under `scripts/fixtures/bf2017/data/UI/Data/GameModes/` and one level's `GameModes.json`): read `UI/Data/GameModes/GameModes.json` for the order; each `GameModeInformationAsset` (ours and `Addons/*/UI/Data/GameModes/*`) for id, `GameModeName`, `AurebeshGameModeName`, `Description` (a `LocalizedStringId` hash → `web_opt/strings/English.json` by `'%08X' % (hash & 0xFFFFFFFF)`, or a `LocalizedString`), `NumberOfPlayers`, `HasVehicles`, `HasHeroes`, `Levels[]`; each `LevelInformationAsset` for `Key`, `Planet`, `LevelName`, `LevelAurebesh`, `LevelDescription`, `LevelDescriptionOverrides[]`, `LevelId`; each `PlanetInformationAsset`; each level's `Levels/**/GameModes.json`: `SubWorldReferenceObjectData.BundleName` → its `SubWorldInclusionSetting.EnabledOptions`.
- [ ] The option → mode-id table of the spec (`PlanetaryBattles` → `galacticAssault`, `HeroesVersusVillains` → `hvv`, `Blast` → `blast`, `Domination` → `strike`, `Mode6` → `showdown`, `Mode9|ModeDefend` → `coop`, `Mode1` → `supremacy`, `Mode2|Mode5` → `extraction`, `Mode3` → `ewokHunt`, `ModeC` → `jetpackCargo`, `SkirmishBlast|SkirmishOnslaught|SkirmishDuel` → `arcade`, `SpaceBattle` → `starfighter`, `Mode7` → `heroStarfighters`; `Mode8`, `ModeE`, `ModeF`, `ModeS` fold into their parents; `PlanetaryMissions` alone is Arcade's instant-action layer, not a card); the game's `system → levels` join (`hoth: [hoth_01, hoth_02]`, `endor: [endor_01, endor_02, endor_04]`, `tatooine: [tatooine_01, tatooine_02, jabbaspalace_01]`, `yavin`, `naboo: [naboo_01, naboo_02, naboo_03]`, `kamino: [kamino_01, kamino_03, sb_kamino_01]`, `kashyyyk: [kashyyyk_01, kashyyyk_02]`, `geonosis: [geonosis_01, geonosis_02]`, `bespin: [cloudcity_01]`, `scarif: [scarif_02]`, `deathstar: [deathstar02_01]`, `felucia`, `kessel`, `fondor: [sb_fondor_01]`, `ryloth: [sb_droidbattleship_01]`), as a table in the module.
- [ ] `node scripts/bf2017-data.mjs frontend --root <web dir>` → `src/data/bf2017/frontend.json` `{ _from, modes: [{ id, gameId, name, aurebesh, about, players, vehicles, heroes }], levels: { [key]: { level, planet, name, aurebesh, about, aboutBy: { [modeId]: text }, modes: [ids], system } }, planets: { [id]: { name, index } }, systems: { [system]: [keys] } }`; the same command rewrites `modes.json` from it (lane F's tests keep passing). Sizes in the PR.
- [ ] `frontend.test.js` (in `src/data/bf2017/`): every level's `modes` equals its inclusion options mapped; no key `isSequel` refuses; every system in `systems` is a galaxy system or the Death Star.

### Task 2: free roam moves to `/roam`

- [ ] `git mv src/pages/GalaxySurface.jsx src/pages/GalaxyRoam.jsx`; the component `GalaxyRoam`; `surface/module.js`'s id `galaxy-roam` (grep every `galaxy-surface` reader: `runtime`, `worlds/looks.js`'s routes, the checks); `App.jsx`: `/galaxy/:system/roam` → `GalaxyRoam`; `/galaxy/:system/surface` → the new `GalaxySurface` (task 4); `?mode=free` on `/surface` and any `/surface?mission=` → `<Navigate to="/roam?…" replace />`.
- [ ] Free roam's Menu: "Change mode" opens the mode menu (it already does); the mode menu's Free roam card is `to: /galaxy/<system>/roam`; its game cards navigate to `/surface?level=&mode=`. The site's three skirmishes (`assault`, `hvv`, `blast` rows of `missions/index.js`) are listed in free roam's Menu under "The site's skirmishes" (a `MenuItem` each), no longer on the cards (`modes.js`'s `KIND_MODE` drops them; `story` keeps chases and quests).
- [ ] `pages/Galaxy.jsx`: `land(id)` → the game for `levelsOf(id).length > 0` (task 3), else the roam as today; the Land button's line (`surface/landLine.js`) names the game's level ("OUTPOST DELTA · Galactic Assault, Blast, Heroes vs Villains…"). `GalaxyMission.jsx`'s cards and `systems.js`'s `game.also` rows take the new routes.
- [ ] `galaxy-check surface hoth` runs against `/roam` (its `--route` or default) and prints the same counts as on `main`; `scripts/*-check.mjs` that open `/surface` for the roam (hvv-check, assault-check, landing-check) read `/roam`.

### Task 3: the game world's face and the lobby

- [ ] `src/components/battlefront/index.js`: `LEVELS` from `frontend.json`'s keys; `levelsOf(system)`, `firstLevel(system, mode)`; `routeFor(level, mode)`; export `battlefrontModule`.
- [ ] `module.js`: props `{ system = null, level, mode }` where `mode` may be `'lobby'`; in the lobby the level streams whole (what the pack is today), the camera holds the level's first mode's deploy camera (`maps/<level>.json`'s `cameras`, by `layer`), the light is the level's default weather, no sim runs; `do('mode', id, { level })` builds the battle (`createBattle` with `mode`) and opens the deploy screen; `do('level', key)` rebuilds on another level (the page's `rebuild` key); `do('takeOff')` emits `takeOff` for the page; `do('explore')` builds the sim with no bots and no mode (the stage line reads "Exploring OUTPOST DELTA"). A mode G4 has not built yet answers `{ ok: false, why: 'soon' }` and the page's card says so.
- [ ] `BattlefrontWorld.jsx`: title from `frontend.json` (`OUTPOST DELTA · HOTH · GALACTIC ASSAULT`), a `children` slot for the page's menu over the HUD, `onTakeOff`.
- [ ] `module.test.js` for the lobby's `do` table (fake runtime, as lane 5's tests do).

### Task 4: the game over the planet (`pages/GalaxySurface.jsx`, new)

- [ ] The handover: `pages/Galaxy.jsx`'s `land` calls `runtime().handover(battlefrontModule, { system, level: firstLevel(system), mode: 'lobby' }, host, { fade: 900, held: true, after, onBuilt })`, the dive and veil as today (`usePrepareProgress(battlefrontModule)`); the page adopts it (`useWorld` with `adopt`, as the roam page does).
- [ ] The title card (the roam's, shared through `surface/TitleCard.jsx` or by lifting it to `src/runtime/hud`), then `ModeMenu` with `modesFor(system, { level })`: the cards in the game's order; a card for a mode the level has and G4 has built → `do('mode')`; built nowhere yet → `soon` ("the game's level has it; the site's rules for it are not in yet"); the level has none → `none` with the game's reason; Free roam → `/roam`; Starfighter Assault → lane A's route; the **level picker** (a row of the planet's levels by the game's names when there are two or more; `?level=` follows it).
- [ ] The deploy screen and HUD are lane 5's (`BattlefrontHud`), untouched; Esc never leaves the world (the house rule); Menu → Change mode (reopen the menu, the battle stood aside and disposed on a new pick), Free roam, Take off (the roam's `takeOff` lifted to `src/components/galaxy/shared/takeOff.js`: the climb-out veil and the handover back to `galaxyModule`).
- [ ] `?mode=<id>` goes straight into the mode (the deploy screen open); `?level=<key>`; `?gizmos=1` passes through to the module (lane G6 draws it).
- [ ] `scripts/landing-check.mjs --surface hoth` lands in the game: asserts the lobby's level streamed, the menu shown, `do('mode', 'galacticAssault')` deploys; `--limit 30` at high with the bucket base (SwiftShader compares steps; the owner runs `ANGLE=d3d11`).

### Task 5: `modes.js` on the game's front end

- [ ] `modes.js`: `MODES` from `frontend.json` in the game's order (`galacticAssault, starfighter, hvv, strike, blast, arcade, jetpackCargo, ewokHunt, heroStarfighters, showdown, extraction, supremacy, coop`, then `explore` and `free`), names and abouts the game's; `levelsFor(system)`; `modesFor(system, { level, built })` where `built` is `src/components/battlefront/index.js`'s `BUILT` set (G4 adds ids as it lands); `missionForMode` keeps only `story`; the sequel refusal re-checked.
- [ ] `modes.test.js`: every landable system's cards; Hoth's `strike` card is `soon` (not `none`: lane F's reading missed it); Alderaan's game cards `none` with the planet's name; Tatooine shows three levels; `?mode=free` redirects.

### Task 6: docs, checks, PR

- [ ] `HANDOFF-battlefront.md`, "The sixth design": G1's row with the numbers (landing time, bundle delta for `/galaxy`); the spec's Departures; `docs/architecture.md`'s routes; `guide/pages.js` tips for `/roam` and the lobby.
- [ ] Gates: lint, test, build, health; `landing-check`; `galaxy-check surface hoth` on `/roam` with `BUDGET=1`; `battlefront-check`.
- [ ] PR `Battlefront G1: landing is the game, free roam its own area`; merge `origin/main` first (lane 5's `module.js` lines: keep both; lane F's `modes.js` tests: keep the names).
