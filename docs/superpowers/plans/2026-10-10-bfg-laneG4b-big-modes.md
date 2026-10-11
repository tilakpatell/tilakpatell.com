# Lane G4b: the big modes on the sim: Co-op, Supremacy, Extraction, Ewok Hunt, Jetpack Cargo, Arcade, Explore. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (one session, task by task; no review loops). Steps use checkbox (`- [ ]`) syntax.

**Goal:** The rest of the game's ground modes run on the sim on the real levels: **Co-op** (four against a bot army over the Mode9 capture points, attack and defend, its bot logic as a commander policy), **Supremacy** (the ground phase over Mode1's capture points with its ticket control, then the boarding phase on the capital's objectives), **Extraction** (the cart and its checkpoints), **Ewok Hunt** (troopers against Ewoks in the night; a trooper down turns), **Jetpack Cargo** (the carry race in jetpacks), **Arcade** (the 24 scenarios and 22 parameters as the game's settings screen; Team Battle, Onslaught, Duel), **Explore** (the level with no battle and every vehicle to board).

**Architecture:** as lane G4a's: one pure module a mode under `src/lib/battlefront/modes/`, the layer from G3's map rulebook, the rules from the records where they are records and from a hand file (`maps/<key>.<mode>.json`, the graph node named) where the graph decides. Co-op's and Supremacy's bot behaviour reads `Mode9_BotLogic_AttackObjectives`/`_DefendObjectives_NEW`/`_OrphansRetreat`/`PvE_BotLogic` and `Mode8_BotLogic_AttackObjectives` as **policies** for lane 2's commander (`ai/commander.js`: which post to go for, when to retreat, how many to send), written by a person from the graphs. Arcade is `arcade.json` (G3) driving Blast's and HvV's modules with the parameters.

**Spec:** `2026-10-10-bf2017-galaxy-on-the-game-design.md`, decision 5 and the mode catalogue; the game design's section 6 and 7.

## Global constraints

- Start from `main` after G3 has merged. Own: `src/lib/battlefront/modes/{coop,supremacy,extraction,ewokHunt,jetpackCargo,arcade,explore}.js` and tests, `src/lib/battlefront/ai/policies.js` (new), `src/data/bf2017/maps/<key>.{coop,supremacy,extraction,ewokHunt,jetpackCargo}.json` (hand files), `src/components/battlefront/hud/{Posts,Phase,Cart,Night,Cargo,ArcadeSettings}.jsx` (new), `battle.js`'s switch (additive), `index.js`'s `BUILT`.
- Pure, seeded, deterministic; numbers from the rulebooks; hand values named. No sequel. Files under 800 lines; the usual gates.
- Vehicles in Supremacy and Co-op (the AT-RT, the AAT, the tauntaun mounts at `PF_MountSpawner_*`) are G5's entities; until G5 lands, the modes run on foot and say so in `NOTES.md`.

## Tasks

### Task 1: Co-op

- [ ] `coop.js`: the `Mode9` layer (8 capture points `PF_CapturePoint_Mode9` with their areas, `Mode9_Spawns_Team1/2`, `ModeDefend_Spawns_*`, the OOB per team, the mounts); the **phases** from the hand file `<key>.coop.json` (which posts are live in each phase, read from `PF_Mode9`'s `CombatAreaEntityData`s and inclusion settings: the attacking squad captures one of the live posts to open the next phase; the defenders hold until the timer); attack (Mode9) and defend (ModeDefend) as the player's side; the bot army's size from `frontend.json`'s players and the Skirmish AI size parameter; `PvE_BotLogic`'s and `Mode9_BotLogic_*`'s choices as `ai/policies.js`'s `coopAttack`, `coopDefend`, `orphansRetreat` (named policies the commander consults: the post to press, when to pull back, the reinforcement cadence), each line of the policy naming its graph node; `view`: the live posts and their meters, the phase, the timer.
- [ ] `coop.test.js`: a captured post opens the next phase; the last phase's capture wins the attackers; the timer wins the defenders; a no-player round on Hoth ends under 20 minutes on three seeds.

### Task 2: Supremacy

- [ ] `supremacy.js`: the `Mode1` layer (capture points `PF_CapturePoint_Mode1`, the combat areas, the spawns); the **ground phase**: both sides hold posts, the ticket control (`PF_Mode1_Ticket_Control`: tickets flow to the side holding more; read its ints where records, else hand) fills a side's bar, which calls the **boarding phase**: the side with the full bar boards the other's capital (`PF_Mode1_NT_BoardingShip`, the transport's seconds), the capital's objectives (`PF_DestroyableObjective_Venator`/the dreadnought's: the two objectives then the core, from the level's own `Venator`/`Dreadnaught` sub-levels G3's map reads) with the boarding timer; a failed boarding returns both to the ground; the first capital destroyed wins; Mode8 is the same with one player and its bot logic policy (`Mode8_BotLogic_AttackObjectives` → `policies.supremacyAttack`); `view`: posts, bars, the phase, the capital's objectives.
- [ ] `supremacy.test.js`: tickets flow to the holder of more posts; a full bar boards; the boarding timer returns; a no-player match on Naboo_03 (or Hoth_02, G2's pack) ends under 30 minutes on three seeds.

### Task 3: Extraction, Ewok Hunt, Jetpack Cargo

- [ ] `extraction.js`: the `Extraction`/`Mode5` layer (Cloud City, Jabba's Palace, Kessel): the cart's route and checkpoints from the hand file (read from the level's `Mode5_*`/`Extraction_*` layers and `Addons/Mode5`'s prefabs), the cart moves while an attacker is near and no defender is, the checkpoint timer, one round each way; costs from `points.json`'s `Mode_5` table.
- [ ] `ewokHunt.js`: the `Mode3` layer (Endor_02, Endor_04): troopers against Ewoks in the night's light record (the level's `Night` weather), a trooper down comes back as an Ewok (the game's turn rule; hand, named), the Ewok's kit (`Ability_Ewok_*`: Wistie pouch, the horn, the hunter's vision, the nest; `Affector_Mode3HealthRegen`), the flashlight weapons (`Ability_Mode3_*_Flashlight`), the dawn timer (the strings and `PF_GameMode_Mode3`'s delays; the troopers win if any survive to the transport), costs from `MODE_3`.
- [ ] `jetpackCargo.js`: the `ModeC` layer (Tatooine_01, Yavin_01, CloudCity_01): the cargo and the drop points, everyone with the jetpack kit (`Addons/ModeC`'s `Ability_*` rows), a carried cargo scores at the drop, the first to the limit (`MODE_C`: 8, 600 read as the limit and a cost; check against the strings).
- [ ] A test each: the rule's core (the cart moves and stops; a trooper down turns; cargo scores at the drop) and a no-player round ending within its time on three seeds.

### Task 4: Arcade and Explore

- [ ] `arcade.js`: `arcade.json`'s scenarios (the two teams of each; the galaxy's system from its planets) and parameters (`Team1AISize`, `Team2AISize`, `Difficulty`, `TimeLimit`, `Team1/2ScoreLimit`, `PlayerLives`, `PlayerHealthModifier`, `AIHealthModifier`, `CooldownModifier`, `SupplyMode`, `AIClassesAllowed`, `GameModePreset`): Team Battle runs Blast's module with the parameters, Onslaught the elimination variant (no respawn; wipe the other team within the time), Duel one against one (the hero pair) on HvV's module; the bots' names from `AINames_*`; `view` carries the settings. `hud/ArcadeSettings.jsx`: the settings screen as the game's `SkirmishSettingsScreen` widget (lane M's), each parameter a row of its index values.
- [ ] `explore.js`: no bots, no objectives, you as a trooper of either side at the level's first spawn, every vehicle at its spawn boardable (G5's entities; until then parked scenery through G2), the stage line "Exploring <LEVEL NAME>", `view` the level's name and your place; a `teleport` input for the checks (`do('teleport', [x, y, z])`).

### Task 5: the HUD, the balance, the ids

- [ ] `hud/Posts.jsx` (Co-op's and Supremacy's posts: the game's `PF_UI_Mode9_ObjectivePicker` and `HudScreenMode1`'s `GroundPhaseHudWidget`), `Phase.jsx` (`TitanPhaseHudWidget`, `BoardingPhaseHudWidget`, `Mode1OvertimeHudWidget`, `TimeWidgetMode1`), `Cart.jsx`, `Night.jsx` (Ewok Hunt's dawn and the turn count), `Cargo.jsx`: each from the game's widget through lane M's `widget(name)`.
- [ ] `battlefront-balance.mjs --mode <id>` rows for each; the arena cases under `test:ai`.
- [ ] `index.js`'s `BUILT` gains the seven ids.

### Task 6: docs, checks, PR

- [ ] `NOTES.md` lines; `HANDOFF-battlefront.md`, "The sixth design": G4b's row with the tables; the spec's Departures; the parity ledger refreshed.
- [ ] Gates: lint, test, `test:ai`, build, health; `battlefront-check --mode <id>` for each on a level that has it, with shots.
- [ ] PR `Battlefront G4b: Co-op, Supremacy, Extraction, Ewok Hunt, Jetpack Cargo, Arcade and Explore on the sim`; merge `origin/main` first.
