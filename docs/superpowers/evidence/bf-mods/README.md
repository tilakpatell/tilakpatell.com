# The mods’ minds: the Instant Action Overhaul V2 on a bot (lane A3)

The Battlefront-by-default design’s decision 8, measured 2026-10-21 on the owner’s desktop. The mod’s records are read by `node scripts/bf2017-mods.mjs iao-v2 --root C:/Users/tilak/source/repos/bf2-re/data/mods` into `src/data/bf2017/mods/iao-v2.json` (every number with `<record>#<object>.<field>`; NOTES.md, “The Overhaul’s records”), and `src/lib/battlefront/ai/botLogicOverhaul.js` and `adaptive.js` read that rulebook. Numbers only; nothing of the mod’s binaries is in the repository.

## What the rulebook holds

| | read | kept |
| --- | --- | --- |
| records | 3,427 under the extraction’s `ebx/` | the rows below, 43 sequel-era names refused |
| AutoPlayer records (an AutoPlayer’s settings or its manager) | 34 | 28 listed; Jakku’s two, Starkiller, Takodana, the First Order’s Star Destroyer and the Raddus refused |
| AI options | 8 of the mod’s (`IAIAI*`) | 6 five-step tables, the adaptive difficulty, the squads |
| hub settings | 50 | the squad-spawn probability, 1 |
| server settings | the container against the game’s | 3 renamed away (the AutoPlayer counts), 9 changed (two players start a mode) |
| AI kits | 127 | 103 (24 of the new trilogy refused) |
| the deal | 9 addresses and the table | each read back to the number the logic was read with |

## The steps (`steps`)

| option | setting | very easy | easy | medium | hard | very hard |
| --- | --- | --- | --- | --- | --- | --- |
| aim (`IAIAIDifficulty`) | `AimNoiseScale` | 100 | 5 | 1 | 0.5 | 0.125 |
| | `TargetTrackerFieldOfViewDegrees` | 40 | 80 | 110 | (none fires) | 180 |
| reaction (`IAIAIReactionTimes`) | `LofReactionTimeS` | 0.5 | 0.3 | 0.1 | 0.05 | 0 |
| dodging (`IAIAIDodging`) | `EvasiveManeuversDodgeRollProbability` | 0 | 0.01 | 0.05 | 0.1 | 1 |
| jumping (`IAIAIJumping`) | `EvasiveManeuversJumpProbability` | 0 | 0.01 | 0.05 | 0.1 | 1 |
| abilities (`IAIAIAbilities`) | `AttackingAbility{Left,Middle,Right}Probability` | 0 | 0.03 | 0.1 | 0.25 | 1 |
| lightsaber (`IAIAILightsaberAggression`) | `HeroStrafeProbabilityPerFrame` | 0.001 | 0.002 | 0.003 | 0.004 | 0.005 |

The middle step is each option’s default. The sim acts on the aim, reaction, dodging and jumping steps (`tuned`: the jump is drawn and not acted on, the brain does not jump); the abilities’ and the lightsaber’s are carried.

## The adaptive difficulty (`adaptive`)

Each team’s `AimNoiseScaleTeam<n>` drawn evenly (`UniformDistribution`) from 0.15, 0.3, 0.6, 0.8, 1, 1.1, 1.35, 1.55, 1.95, 2.5, every 15 s, set 0.1 s after the draw; on by default. `src/lib/battlefront/ai/adaptive.js` is the driver: the sim’s Overhaul round steps it, and a battle whose bots take a difficulty row takes `adaptiveDifficulty` (the row’s aim widened by the side’s scale).

## The kits (`kits`, `kitTemplates`)

Each AI kit binds its faction, a gameplay asset named for its class, the body a player wears and the body the game spawns it with as an AI soldier. Each of the 102 troopers’ kits binds the Skirmish soldier (`StormTrooperAI_Skirmish`, the Separatists’ B1 `StormTrooperAI_B1_Skirmish`), whose template is its class’s Skirmish one (as the game’s own Skirmish spawners pair them). Before this lane an Overhaul round’s bots thought with the multiplayer templates by class (in brackets: rifleman, heavy, officer, sniper); now they play these. The 103rd, a Boba Fett hero kit, binds no AI body and plays no template.

| era | side | class | kits | AI body | template | tactics | target lost, s | engage, m | suppression fades, s | fire height, m |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Orig | dark | assault | 2 | `StormTrooperAI_Skirmish` | `assault` | `Assault_PvE_Tactics` | 999 (10) | 999 (40) | 999 (10) | 0 (0) |
| Orig | dark | heavy | 3 | `StormTrooperAI_Skirmish` | `heavy` | `Heavy_PvE_Tactics` | 999 (10) | 999 (40) | 999 (10) | 0 (-0.5) |
| Orig | dark | officer | 15 | `StormTrooperAI_Skirmish` | `officer` | `Officer_PvE_Tactics` | 999 (10) | 999 (40) | 999 (1) | 0 (0) |
| Orig | dark | specialist | 2 | `StormTrooperAI_Skirmish` | `specialist` | `Specialist_PvE_Tactics` | 999 (10) | 999 (40) | 999 (1) | 0 (0) |
| Orig | light | assault | 14 | `StormTrooperAI_Skirmish` | `assault` | `Assault_PvE_Tactics` | 999 (10) | 999 (40) | 999 (10) | 0 (0) |
| Orig | light | heavy | 21 | `StormTrooperAI_Skirmish` | `heavy` | `Heavy_PvE_Tactics` | 999 (10) | 999 (40) | 999 (10) | 0 (-0.5) |
| Orig | light | officer | 21 | `StormTrooperAI_Skirmish` | `officer` | `Officer_PvE_Tactics` | 999 (10) | 999 (40) | 999 (1) | 0 (0) |
| Orig | light | specialist | 7 | `StormTrooperAI_Skirmish` | `specialist` | `Specialist_PvE_Tactics` | 999 (10) | 999 (40) | 999 (1) | 0 (0) |
| Preq | dark | assault | 2 | `StormTrooperAI_B1_Skirmish` | `assault_separatist` | `Assault_PvE_Tactics` | 999 (10) | 999 (40) | 999 (10) | 0 (0) |
| Preq | dark | heavy | 3 | `StormTrooperAI_B1_Skirmish` | `heavy_separatist` | `Heavy_PvE_Tactics` | 999 (10) | 999 (40) | 999 (10) | 0 (-0.5) |
| Preq | dark | officer | 9 | `StormTrooperAI_B1_Skirmish` | `officer_separatist` | `Officer_PvE_Tactics` | 999 (10) | 999 (40) | 999 (1) | 0 (0) |
| Preq | dark | specialist | 3 | `StormTrooperAI_B1_Skirmish` | `specialist_separatist` | `Specialist_PvE_Tactics` | 999 (10) | 999 (40) | 999 (1) | 0 (0) |


## Twelve Supremacy seeds at 20 a side, before and after

The method is NOTES.md’s measured rows (“The AutoPlayers”, “A round with the narrowing and without”), headless: `node scripts/battlefront-balance.mjs --instant overhaul --runs 12 --seconds 300 --seed 2 --jobs 4`, Instant Action rounds of Supremacy on Hoth’s second level (`hoth_02`) over the arena navgrid (`fixtures/hothFlat.js`), 20 bots a side, the round’s defaults (the rookie row, the medium length, the Overhaul’s middle steps and its spread on), seeds 2 to 13, five minutes or the round’s end. A post is held when either side owned it at some time; a target and firing are sampled once a second over the living bots as the page’s `bots` reads them (a shot within the last fifth of a second). Before is `main` with the rulebook (#1194), after is this change.

| | before | after |
| --- | --- | --- |
| kills a round | 107.9 ± 22.5 (Rebels 40.6, Empire 67.3) | 113.7 ± 29.6 (Rebels 43.8, Empire 69.9) |
| a seed’s difference in kills | | +5.8 ± 14.7 |
| posts held at some time (of 5) | 3.2 and 4.8 | 3.3 and 4.5 |
| a target, firing | 47.2 %, 22.5 % | 47.0 %, 22.5 % |
| rounds ended on reinforcements before 300 s | 11 of 12 | 11 of 12 (7.5 ± 14.5 s sooner) |
| stuck, off the navgrid | 0, 0 | 0, 0 |

What moved is the kits’ templates: the bots now think with the Skirmish templates and PvE tactics (their rows remember a lost target 999 s where the multiplayer rows remember it 10, engage at 999 m where those engage at 40, and hold no hide and no close combat), and they press their abilities by the Skirmish ability logic. Every other number the round reads was already the mod’s by hand and is now its records’, the same to the number; the spread is the same driver, drawing the same scales from the same generator. Nothing a round counts moved by more than the spread between seeds, and no bot was stuck.

The game’s own logic (`--instant game`) is unchanged, seed for seed (34.8 ± 4.1 kills a round, Rebels 15.3, Empire 19.5; posts 3.0 and 3.6; a target 70.7 %, firing 26.2 %; stuck 0), before and after.

| seed | kills before (Rebels–Empire) | after | posts held before (Rebels, Empire) | after | a target before, % | after | firing before, % | after | ended before, s | after | stuck before, after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 125 (55–70) | 145 (71–74) | 4, 5 | 4, 3 | 55.8 | 50.9 | 26.1 | 25.1 | 280 | 243 | 0, 0 |
| 3 | 125 (62–63) | 98 (32–66) | 2, 5 | 2, 5 | 48 | 50.2 | 23.8 | 24.3 | 237 | 222 | 0, 0 |
| 4 | 96 (31–65) | 96 (29–67) | 3, 5 | 4, 5 | 48.6 | 43.9 | 23.2 | 21.9 | 227 | 216 | 0, 0 |
| 5 | 98 (36–62) | 96 (30–66) | 3, 5 | 4, 5 | 45.7 | 41.6 | 21.4 | 19.2 | 252 | 230 | 0, 0 |
| 6 | 95 (25–70) | 120 (49–71) | 4, 5 | 3, 5 | 44.3 | 47.4 | 22.1 | 22.5 | 243 | 232 | 0, 0 |
| 7 | 99 (39–60) | 101 (39–62) | 3, 5 | 3, 5 | 49.3 | 47.6 | 22.4 | 22.1 | 267 | 254 | 0, 0 |
| 8 | 130 (52–78) | 150 (74–76) | 3, 4 | 5, 3 | 49.7 | 53.9 | 24.6 | 26.9 | 249 | 268 | 0, 0 |
| 9 | 81 (21–60) | 82 (20–62) | 2, 5 | 2, 5 | 44 | 44.7 | 20.7 | 21.2 | 253 | 244 | 0, 0 |
| 10 | 146 (60–86) | 161 (78–83) | 4, 4 | 4, 3 | 44.3 | 48.1 | 21.9 | 23.6 | 284 | 282 | 0, 0 |
| 11 | 108 (37–71) | 104 (38–66) | 4, 5 | 2, 5 | 47.7 | 48.8 | 22.1 | 21.4 | 220 | 224 | 0, 0 |
| 12 | 124 (62–62) | 143 (57–86) | 4, 5 | 4, 5 | 51.6 | 48.5 | 24.3 | 23.3 | 300 | 300 | 0, 0 |
| 13 | 68 (7–61) | 68 (8–60) | 2, 5 | 2, 5 | 37.6 | 38.1 | 17.9 | 18 | 245 | 252 | 0, 0 |

