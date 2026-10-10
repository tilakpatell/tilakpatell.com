# Battlefront 2017, lane fighters: Starfighter Assault from the vehicles' records. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Starfighter Assault is flown in the game's fighters, on the game's flight model (each air vehicle's `_Handling`, `_Weapons`, `_Targeting`, `_Camera`, health and abilities), against bots on the game's squadron behaviour trees, on all four Original-era space levels (Endor, Kamino, Fondor, the droid battleship over Ryloth), with the mode's own objective panel, markers and icons, and the pilots named from the game's lists.

**Architecture:** One rulebook (`src/data/bf2017/air.json`) from a new reader; one pure flight model (`src/lib/flight/starfighter.js`) the mission's ships and the bots' commands drive; the game's models through the existing import; the mission (`missions/starfighter.js`, lane A) takes the rulebook for kits, phases and ships and the bots lane's `squadron.js` for the flights (until it lands, the galaxy's `battleAi.js` flies them, behind the same command shape); two more levels as areas of their own as Kamino was given.

**Tech Stack:** `scripts/bf2017-data.mjs`, `scripts/lib/bf2017-rulebook-map.mjs` (lane 0 and A: `spaceBattle`, `placed`, `spawns`); `scripts/bf2017-import.mjs` (`--native`, `--cuts`, the published full cuts; #866's `--textures` and lane colour's `--variations` when it lands); `src/components/galaxy/surface/missions/starfighter.js`, `starfighterMaps.js`, `galaxy/levelArea.js`, `areaLook.js`, `areaWeather.js`, `spaceLevel.js` (lane A); `src/components/universe/battle.js`, `battleDirector.js`, `battleAi.js`; `scripts/bf2017-area.mjs`, `scripts/bf2017-level.mjs` (`--frame map --no-fit`, no ground); `scripts/starfighter-check.mjs`; Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-accuracy-design.md` (§1.4, §3 "Lane fighters", §5).

## Global Constraints

- The era rule: `TieFighterFirstOrder`, `TieFighterSpecialForces`, `TieInterceptor_Hask`, `TieStriker`, `XWing_T70`, `Xwing_T70BlackOne`, `AWingRZ3`, `ResistanceTransport`, `KylorenShip`, `MillenniumFalcon_NT`, the `S1`/`A3` vehicles and `SB_SpaceBear_01`/`SB_Resurgent_01` refused and listed.
- Every number in `air.json` and the flight model from a record with `_source`; the galaxy's own ships keep their own model untouched (the fighters lane changes nothing under `src/components/universe/` but reads).
- The full cuts are published to `site-assets`, the far cuts committed, as lane V's and phase 2's are; `assets-check` green.
- The capitals, docks, asteroids and skies stay the space lane's and lane A's; the war's battles (`galaxy/warfront.js`) unchanged.
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines.

## Review Focus

1. **The flight model at the speed cap**: throttle held at 1 never exceeds `MaxSpeed`, boost never `BoostMaxSpeed`, and the turn rate at top speed is the curve's value there (task 2's test).
2. **A level whose kit limitation refuses a fighter** (the droid battleship's Republic side): the launch points offer only the allowed kinds (task 4's test).
3. **A fighter the import cannot cut** (a missing LOD or texture): the galaxy's old model flies in its place and the README says which (task 3).
4. **Fondor's area and the droid battleship's**: the galaxy's sky, names and markers shut out as Kamino's are; leaving the area puts everything back (task 5's test on `levelArea`).
5. **The squadron command with no bots lane on `main`**: the adapter maps `battleAi.js`'s decisions to the same `{ throttle, pitch, yaw, roll, fire, missile }` so the mission has one path (task 4).

---

### Task 1: The air rulebook

**Files:**
- Create: `scripts/lib/bf2017-rulebook-air.mjs` (`airRulebook(root, { era })`: for each `Gameplay/Vehicles/Air/<Kind>/Vehicle_Air_<Kind>` blueprint: `handling` (every numeric leaf of the `_Handling` layer: `MaxSpeed`, `BoostMaxSpeed`, `EngineAccelerationRate`, `BoostEngineAccelerationRate`, `AxisTurnRates` and the zoomed set, `TurnRateBySpeedCurve` (points), `RollTorque`, `RollRateByRollAngVelCurve`, `TargetFakeRollAngle`, the fake-roll inputs, the self-right factors and timers, `PitchDownScale`, `YawRollDampingTime`, `IsAirspeeder`), `weapons` (the `_Weapons` layer's `WeaponFiringData`: rate of fire, heat per shot, cooling, damage from the bolt's affector, the bolt speed and lifetime from `WSBulletEntityData`), `targeting` (the lock-on cone and time), `camera` (the `_Camera` layer's and the cockpit's `StaticCameraData`), `health` (`StarfighterHealthComponentData`: health, regen delay and rate), `abilities` (the `_Abilities` layer's references into `Gameplay/Vehicles/Abilities/Starfighters/`: the kind, cooldown, duration and effect of each; the passive rows as modifiers), `destruction` (the stages and the explosion), `mesh` (the blueprint's `MeshComponentData` assets: body, cockpit, the clusters), `side` (`Affector_IsHeroAirVehicle` and the kit rows: which team and class it is), `_source` on every leaf); `scripts/bf2017-data.mjs` gains `air` → `src/data/bf2017/air.json`
- Test: `scripts/lib/bf2017-rulebook-air.test.mjs` (fixtures: the X-wing T-65's blueprint trimmed to its physics, health and mesh components, its `_Handling` and `_Weapons` layers, one ability)

- [ ] **Step 1: Failing tests**: `air.xwing_t65.handling.maxSpeed === 100`, `boostMaxSpeed === 115`, `engineAccelerationRate === 32.5`, `rollTorque === -31500`, the curve's points; the weapon's rate; the ability's cooldown; a sequel kind refused.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; generate from the bucket (`bf2017-fetch.mjs data 'Gameplay/Vehicles/Air/**' 'Gameplay/Vehicles/Abilities/Starfighters/**'`), commit `air.json`.
- [ ] **Step 5: Commit** `The air vehicles' handling, weapons, cameras, health and abilities are a rulebook`.

### Task 2: The flight model

**Files:**
- Create: `src/lib/flight/starfighter.js` (`createStarfighter(row) → { state, step(input, dt) → state }`: `input` `{ throttle 0..1, boost, pitch, yaw, roll, zoom }`; speed toward `MaxSpeed` (or `BoostMaxSpeed` on boost) at the engine rates, the turn rates from `AxisTurnRates` (zoomed when `zoom`) scaled by `TurnRateBySpeedCurve` at the speed, the roll from `RollTorque` through `RollRateByRollAngVelCurve` with the deadzone, the fake roll from yaw input (`FakeRollAccFromYawInput`, `FakeRollMaxAngVel`, `TargetFakeRollAngle`), `PitchDownScale`, the self-right toward level when the inputs are under the minimums for the timer, `YawRollDampingTime`; pure, a quaternion and a velocity), `src/lib/flight/fighterWeapons.js` (`createGuns(row) → { fire(dt, held) → shots, heat, overheated }` with the firing table's rate, heat, cooling and overheat; the abilities' timers)
- Test: `src/lib/flight/starfighter.test.js` (Review Focus 1; the X-wing reaches 100 m/s within the acceleration's time; the TIE interceptor's top speed above the X-wing's and the Y-wing's below, from `air.json`; a full yaw input rolls the ship toward the fake-roll angle and no further), `fighterWeapons.test.js`

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A starfighter flies on the game's handling: its speeds, turn curves, roll and self-right`.

### Task 3: The game's fighters

**Files:**
- Run: `scripts/bf2017-import.mjs` for the X-wing T-65 (and Red Five's variation), A-wing, Y-wing, TIE fighter, TIE interceptor, TIE bomber, TIE Advanced x1, the Falcon, Slave I, ARC-170, V-wing, N-1, Vulture droid, Tri-fighter, Hyena bomber, Yoda's starfighter: `--kind <id> --as '<name>' --native --tex 2048 --maps 1024 --cuts plain=0,lod1=2,far=<last>` with the cockpit as its own cut (`--parts <cockpit cluster>` → `<id>.cockpit.glb`) and the engine FX meshes listed, not cut; the full cuts published (`node scripts/assets-publish.mjs --only 'models/galaxy/surface/<ids>*'`), the `.lod1` and `.far` committed; `scripts/bf2017-fleet.mjs` rows where the galaxy already names the kind (`xwing`, `tie`, …: the catalogue's rows take the game's file, the credit to the drop's entry)
- Modify: `src/components/galaxy/surface/catalog/bf2017.js` (the rows), `src/data/modelCredits.json`, the sheet `docs/superpowers/evidence/bf2017-fighters/sheet.md` (each kind: the old model, the game's full cut, light cut, far cut; the sizes)
- Test: `src/components/galaxy/surface/catalog/catalog.test.js` (the rows' sizes through the manifest's bytes)

- [ ] **Step 1**: the imports; Review Focus 3 for any that fail (the README names them). **Step 2**: the sheet with `glb-shot.mjs` (`CHROME=<msedge path>` on the desktop; the cloud's SwiftShader is enough for a sheet).
- [ ] **Step 3: Commit** `The game's starfighters, in three cuts, published`.

### Task 4: The mission on the rulebook

**Files:**
- Modify: `src/components/galaxy/surface/missions/starfighter.js` (the launch points' kits from `air.json`'s sides and the level's `PF_KitLimitations_SpaceBattles` (the map rulebook's `prefabs`: extend `bf2017-rulebook-map.mjs` to read the limitation's allowed kinds per team); each flight's fighter kind drawn from the kit; the phases from the map's `SpaceBattle_Gameplay` objective list as lane A reads them, with the `PhaseGameplayLogic_V03` timings where they are numeric (else the hand stages, marked); the player's ship on `createStarfighter` with the galaxy's input mapped to its `input`; the bots' flights on `squadron.js` from the bots lane when present (`import` guarded by a feature file: `src/lib/battlefront/ai/squadron.js` exists → use it; else the adapter over `battleAi.js`, Review Focus 5); each pilot named by `ai.names.json`'s space-battle list when present, else the galaxy's names), `src/components/galaxy/surface/missions/starfighterMaps.js` (the kinds per level), `src/components/universe/FlightSettings.jsx` is not touched; the galaxy's ship-control input (`src/components/galaxy/…/flyInput` or where lane A reads it) gains `boost` and `zoom`
- Test: `src/components/galaxy/surface/missions/starfighter.test.js` (Review Focus 2; the three seeds still under 12 minutes on Endor; Kamino's Republic side flies ARC-170s and V-wings, the Separatists Vultures and Tri-fighters)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Starfighter Assault is flown in the game's fighters on their handling, by pilots with names`.

### Task 5: Fondor and the droid battleship

**Files:**
- Run: `scripts/bf2017-level.mjs levels/space/sb_fondor_01 --world sb_fondor --frame map --no-fit --spot <the attackers' launch>` and `levels/space/sb_droidbattleship_01 --world sb_droidbattleship …` (lane A's recipe for Kamino: the pack's `README` with its instance and texture counts per tier; the hulls the battle draws left out as `unhide` lists them); `scripts/bf2017-area.mjs` for each (the lamps, beacons, backlit clouds and any weather sub-level); `scripts/bf2017-light.mjs sb_fondor --main Levels/Space/SB_Fondor_01/Lighting/<its VE> --with …` and the droid battleship's (lane G's script; the light JSONs under `src/data/bf2017/light/`)
- Modify: `src/components/galaxy/surface/missions/starfighterMaps.js` (`fondor` and `ryloth` rows: level, pack, origin, name, load), `src/data/bf2017/maps/sb_fondor.stages.json`, `sb_droidbattleship.stages.json` (hand stages where the phase logic is a graph, marked), `src/components/galaxy/battles.js` (`areaSpot` for both: Fondor over its shipyard's planet, the droid battleship over Ryloth; a system row for each if the galaxy lacks it: `places.js`'s `SPACE_LEVELS` already has Fondor's middle (the space lane); Ryloth's added by its canon region), `galaxy/levelArea.js`, `areaLook.js` (the two records), `galaxy/GalaxyPanel.jsx` and the briefing's card (the entry, as Kamino's)
- Test: `src/components/galaxy/levelArea.test.js` (Review Focus 4), `starfighter.test.js` (three seeds each under 12 minutes on Fondor and the droid battleship), `places.test.js`

- [ ] **Step 1: Failing tests.** **Step 2** → FAIL. **Step 3: Implement.** **Step 4** → PASS; `node scripts/starfighter-check.mjs fondor mid` and `droidbattleship mid`: calls, triangles, no console error; shots under `docs/superpowers/evidence/bf2017-fighters/`.
- [ ] **Step 5: Commit** `Fondor's shipyard and the droid battleship over Ryloth are flown, each in an area of its own`.

### Task 6: The mode's HUD

**Files:**
- Modify: `src/components/galaxy/surface/missions/starfighterScene.js` (or where lane A draws its HUD): the objectives panel from `HUD_ObjectivesScreen_SpaceBattles_V05` (through `src/lib/bf2017/ui`'s `widget`, and `Screen.jsx` when the screens lane lands: a guarded import as in task 4), the in-world markers (`UI/InGame/Hud/InworldMarkers`: the shapes' SVG when `shapes.json` exists, else the icons), the 42 `UI/SVG/SPaceBattles` icons for the phases and ship kinds, the pilot's name in the kill feed; the ship's HUD (speed, boost, heat, the lock-on) from the fighter's `_UI` layer's widgets where lane 0's `ui.json` has them (extend `bf2017-data.mjs ui` to `Gameplay/Vehicles/Air/*/…_UI` if not)
- Test: the scene's test renders the panel with the phase's text and the markers' count

- [ ] **Step 1: Failing test.** **Step 2** → FAIL. **Step 3: Implement.** **Step 4** → PASS.
- [ ] **Step 5: Commit** `The mode's objective panel, markers and ship HUD are the game's`.

### Task 7: The hand-off and the PR

- [ ] `HANDOFF-battlefront.md`, lane A's section gains "the sixth design: the fighters" (the kinds imported, their sizes, the speeds table, `starfighter-check` rows for four levels, what stayed hand); `HANDOFF-bf2017.md`'s table row.
- [ ] `npm run lint`, `npx vitest run scripts/lib/bf2017-rulebook-air.test.mjs src/lib/flight src/components/galaxy/surface/missions src/components/galaxy/levelArea.test.js src/components/galaxy/places.test.js src/components/galaxy/surface/catalog`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/assets-check.mjs`, `npm run coverage:bf2017` (the air vehicles' models, the two packs, the space-battle UI rows used).
- [ ] Merge `origin/main`, push, open the PR; merge it yourself when CI is green.
