# Lane G4a: the small modes on the sim: Blast, Heroes vs Villains, Hero Showdown, Strike. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (one session, task by task; no review loops). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Four of the game's modes run on the sim (`src/lib/battlefront/sim.js`) on the real level, from the level's own layer and the game's rules: **Blast** (two teams, kills to the limit, the team-deathmatch spawns and combat area), **Heroes vs Villains** (4 v 4, a target a team, the hero arena, the record's hero enables), **Hero Showdown** (2 v 2 elimination rounds in the Mode6 arena), **Strike** (attackers carry or arm, defenders hold, one round each way, the PlanetaryMissions layer). Each pure, seeded, with a no-player arena test, a balance row, its view and the game's HUD widgets.

**Architecture:** one module a mode beside `modes/galacticAssault.js`, in its shape (`create<Mode>({ rulebook, level, map })`, `onEvent`, `tick`, `force`, `view`, `spawnSets`, `canRespawn`); `sim.js`'s `mode` hook takes any of them; `battle.js`'s `createBattle` switches on `mode`. The layers come from G3's map rulebooks (`rows.spawns/areas/volumes/prefabs` tagged `mode`); Hoth's rows exist today for all four. Heroes are soldiers on hero health until G5 lands (as lane 2 did), then G5's hero entities. The HUD parts are the game's widgets through lane M's `widget(name)`.

**Spec:** `2026-10-10-bf2017-galaxy-on-the-game-design.md`, decision 5 and the mode catalogue; the game design's section 6; lane H's `hvv.js`/`blast.js` hand rules and numbers (`NOTES.md`) as the first reading, to be replaced by the graphs' where they say otherwise.

**Narrowed beside PR #877 (read the spec's "Beside the accuracy design" first):** #877's maps lane (`claude/bf2017-maps`) owns Strike. **Do not do Task 5**; the `Carry.jsx` HUD part in Task 6 goes with it. Blast, Heroes vs Villains and Hero Showdown are yours. The maps lane also brings the other levels' map rulebooks: build on Hoth's rows now and merge its branch for the rest.

## Global constraints

- Start from `main`. Own: `src/lib/battlefront/modes/{blast,hvv,showdown,strike}.js` and tests, `src/lib/battlefront/arena.test.js` (additive cases), `scripts/battlefront-balance.mjs` (`--mode`), `src/components/battlefront/battle.js` (the mode switch and each mode's view: additive), `src/components/battlefront/hud/{ScoreBar,Targets,Rounds,Carry}.jsx` (new), `src/components/battlefront/index.js`'s `BUILT` set (G1's: add ids; if G1 is not merged, `MODES`).
- Rules pure, seeded, deterministic; every number from the rulebooks; a hand value says so with a `NOTES.md` line naming the graph node.
- No sequel heroes (the record's `HvV_ENABLE_*` filtered by `isSequel`). Files under 800 lines; the usual gates.

## Tasks

### Task 1: the mode seam

- [ ] `sim.js`: a mode object may give `spawnSets(team)`, `canRespawn(team)`, `onEvent`, `tick`, `view`, `result`; `createSim` takes `combatArea` (a polygon or OBB: outside it the OOB count runs) beside `oob`; `battle.js`'s `createBattle({ mode })` builds the right module by id and reads its objectives for the markers. `galacticAssault.js` unchanged.
- [ ] `modes/common.js`: `kills(side)`, `respawnAfter(seconds)`, `roundTimer`, `teamsOf(rulebook, level, mode)` (light/dark by era from `teams.json`).

### Task 2: Blast

- [ ] `blast.js`: the `TeamDeathmatch` layer's spawns (`_Online` for the online spawns, `_Skirmish` for the arcade's) and combat area (`PF_CombatArea_SmallGamemodes`), 10 a side by default (the record's players 16: the bots fill to the mode's `NumberOfPlayers` from `frontend.json` on desktop, the tier caps it), kills to the limit (the strings' 100; `TeamDeathmatchStateManager`'s counters read where they are records), respawn waves, the end when a side reaches it or the round timer (hand, 15 min) runs out; `view`: both counts, the bar.
- [ ] `blast.test.js`: a kill counts once; the limit ends it; a no-player round on Hoth ends under 15 minutes on three seeds; nobody leaves the navgrid.

### Task 3: Heroes vs Villains

- [ ] `hvv.js`: the `HeroArena` layer's arena and spawns; the heroes enabled per level from `PF_HeroesVersusVillains_TDM`'s `BattlepointUnitCostEntityData` (`HvV_ENABLE_<HERO>` by `Map`, `GLOBAL` for all); 4 v 4 by side (`heroes.json`'s `side`; you one of yours), a **target** a team drawn at the start and on each target's death, only a target's death scores, 10 points (hand until the graph is read; the node named), 10 s to come back, OOB 10 s; hero health and regen from `heroes.json`; saber heroes' strikes through `saber2017.js` once G5 lands (until then a melee affector at the saber's damage and delay from `saber.json`); blaster heroes on their weapon rows; `view`: scores, both targets, who is up.
- [ ] `hvv.test.js`: a target's death scores and a non-target's does not; 10 ends it; a no-player round on Hoth ends under 10 minutes on three seeds; a sequel hero never appears.

### Task 4: Hero Showdown

- [ ] `showdown.js`: the `Mode6` layer (4 spawns, 2 areas, 1 volume on Hoth), 2 v 2 from the enabled heroes, no respawn within a round, a round ends when a side is down, the first to the round limit wins (the strings and `PF_Mode6`: read the limit if a record, else hand 3), the intermission's seconds from `PF_Mode6`'s delays; `view`: rounds, who is up.
- [ ] `showdown.test.js`: a round ends on elimination; the limit ends the match; a no-player match ends under 12 minutes on three seeds.

### Task 5: Strike

- [ ] `strike.js`: the `PlanetaryMissions` layer (spawns by team, 4 areas, the two volumes: pickup and delivery, or the bomb sites) and `PF_Strike_Bombs`/`PF_Strike_CTF` (which one the level's prefab is; Hoth's is bombs): attackers arm (hold `INTERACT_REACH` for the prefab's arm seconds, read from its curves/delays where records) or carry (the carrier marked, dropped on death, returned after the prefab's seconds) to the delivery; defenders defuse or hold; the round timer and the attackers' tickets from the records where they are, else hand; **one round each way**, the better round wins; the doors (`PF_Automatic*Door*`) open for anyone near; `view`: the objective's state, the timer, the round.
- [ ] `strike.test.js`: arming completes and can be defused; a carried item drops and returns; both rounds play and the match resolves; a no-player match on Hoth ends under 20 minutes on three seeds.

### Task 6: the HUD and the balance

- [ ] `hud/ScoreBar.jsx` (Blast's two counts, the game's `ScoreLog`/kill-count widget), `Targets.jsx` (HvV's targets: the game's target markers over the heads, the colour of the side; its `InworldMarkers`), `Rounds.jsx` (Showdown's round pips), `Carry.jsx` (Strike's objective state, `ObjectiveBar`'s arm meter): each from lane M's `widget(name)` of the game's widget for it, skinned on the kit; `BattlefrontHud.jsx` mounts them by `view.mode.id`.
- [ ] `battlefront-balance.mjs --mode <id> --level <key> --runs 12`: the rows for the PR (who won, when, kills, stuck 0, off 0); the arena cases for all four under `test:ai`.
- [ ] `index.js`'s `BUILT` (or `MODES`) gains `blast`, `hvv`, `showdown`, `strike`; lane G1's menu lights the cards.

### Task 7: docs, checks, PR

- [ ] `NOTES.md` lines for each hand value; `HANDOFF-battlefront.md`, "The sixth design": G4a's row with the balance tables; the spec's Departures; the parity ledger refreshed if G6 has merged.
- [ ] Gates: lint, test, `test:ai`, build, health; `battlefront-check --mode <id>` for each on Hoth with shots to `docs/superpowers/evidence/bfg-modes/`.
- [ ] PR `Battlefront G4a: Blast, Heroes vs Villains, Hero Showdown and Strike on the sim`; merge `origin/main` first (G3's rulebook keys; G1's `BUILT`: keep both).
