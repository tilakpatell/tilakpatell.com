# Battlefront 2017, lane bots: the minds from the records. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** The bots think with the game's own numbers where the game has them: the AI system's target scores and squad engagement, the cover queries and their scores, the difficulties' curves, the Skirmish (Instant Action) tactics with abilities, the squadron behaviour trees for the starfighters, the living world's creature settings for the placed actors, the walkers' gunners, and a name per bot from the game's lists. Every number carries a `_source`; what the game keeps in a logic graph stays a hand rule and says so.

**Architecture:** The extractor (`scripts/lib/bf2017-rulebook-ai.mjs`, lane 0) grows readers for the unread families and `src/data/bf2017/ai*.json` are regenerated; new pure modules under `src/lib/battlefront/ai/` each take a rulebook row and a sim state and return a decision; `soldierBrain.js` swaps two of its hand pieces for them; `bots.js` names its bots; `squadron.js` is a data-driven behaviour tree the fighters lane drives; `creature.js` is what the galaxy's `actors.js` asks for a placed actor's next move.

**Tech Stack:** `scripts/bf2017-data.mjs` (`--root` on the desktop, the bucket's `data/` in the cloud through `bf2017-fetch.mjs data '<glob>'`); `src/lib/battlefront/` (sim, core, nav, soldier, ai/*), `src/lib/ai/perception.js`, `src/lib/ai/utility.js`; `scripts/battlefront-balance.mjs`; `npm run test:ai`; Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-accuracy-design.md` (§1.2, §3 "Lane bots", §5).

## Global Constraints

- Pure rules in `src/lib/battlefront/`: no three.js, no DOM.
- Every number from the records with `_source`; a hand value is `source: "hand"` and a line in `src/data/bf2017/NOTES.md`.
- The arena's `stuck` and `off` stay 0 over the seeds lane 1 and lane 2 ran; a kill-rate change is reported in the evidence table, not tuned away.
- Lane S's saber engine and `duellists.js` are not touched; the HvV bots take one argument (the difficulty row).
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines.

## Review Focus

1. **A target behind a wall but nearer than the visible one**: the targeting scores must prefer the visible one (`TargetVisibleDistScale` 0.5) and never pick a target the senses have not seen (task 2's test).
2. **A cover query with no spot in range**: the brain falls back to its old `pickCover` and never stands still (task 3's test).
3. **A difficulty row's curve outside its `MinX..MaxX`**: clamped, never extrapolated (task 4's test).
4. **The squadron tree on a flight with no target**: the selector lands in follow-path or fly-forward, never in attack with a null target (task 6's test).
5. **A creature's player influence** when the player is farther than `ConsiderationRange`: no reaction (task 7's test).

---

### Task 1: The extractor reads the unread families

**Files:**
- Modify: `scripts/lib/bf2017-rulebook-ai.mjs` (`aiRulebook(root)` gains `system` (`AI/BattleAI/System/AISystem` and `AISystem_PvE`: every numeric leaf under `Targeting`, `SquadEngageData`, `AreaBookingSettings`, `Shooting`, `AlertnessData`, `TargetDistanceEvaluation`, `BalanceDistribution`), `coverConstants` (both), `coverScores` (the two `CoverScoreAsset`s), `coverQueries` (the 41 `CoverQueryData` by name: their distances, score weights and the score asset they use), `difficulties` (`Gameplay/Settings/GameDifficultySettings`: each `DifficultyData`'s name and curves as `{ points: [[x, y]], min, max }` through lane 0's `FloatCurve` reader), the Skirmish rows (`Tactics/Skirmish/*`, `Templates/Skirmish/*`, `Weapons/Skirmish/*` including the `*_Ability_PvE` rows and the `CustomizeSoldierData` kits), `names` (every `AIPlayerNames` by faction and mode), `creatures` (`CreatureLocoSettings`: states, `WorldEventActionventParameters` (the record's spelling) by `EventType`, the steering settings; `CreatureLocoBindings`), `vehicles` (`ATAT_AI`, `ATST_AI`, `AI/BattleAI/Vehicles/*`)); `scripts/bf2017-data.mjs` writes `ai.json` (system, cover, difficulties, skirmish added), `ai.names.json`, `ai.creatures.json`
- Test: `scripts/lib/bf2017-rulebook-ai.test.mjs` (fixtures under `scripts/fixtures/bf2017/data/AI/BattleAI/System/AISystem.json` (trimmed), one cover query, the difficulty record trimmed to two difficulties, one `AIPlayerNames`, one `CreatureLocoSettings`)

- [ ] **Step 1: Failing tests**: `system.targeting.humanPreferenceScale === 2.5` with its `_source`; a cover query's weights; a difficulty's curve clamps (Review Focus 3); the names list; a creature's `ExternalInfluence_HumanPlayer` row.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; regenerate the JSON files from the bucket (`bf2017-fetch.mjs data 'AI/**' 'Gameplay/Settings/GameDifficultySettings' 'Gameplay/GameModes/**/AINames_*' 'Gameplay/Characters/LivingWorld/**'`), commit them.
- [ ] **Step 5: Commit** `The AI rulebook reads the system, the cover queries, the difficulties, the Skirmish bots, the names and the creatures`.

### Task 2: Targeting

**Files:**
- Create: `src/lib/battlefront/ai/targeting.js` (`scoreTargets(brain, seen, { system, sim }) → [{ id, score }]` (distance with the front/back scales, `HumanPreferenceScale`, `LowHealthPercentage` and its scale, the elevation threshold and scale, `CurrentTargetDistScale` for the current target, `TargetVisibleDistScale` for one seen now, `VisibleTargetLimit`); `coordinate(squad, scores, { balance })` (the target coordinator: spread the squad's picks between `Start` and `End` by `Ideal`))
- Modify: `src/lib/battlefront/ai/soldierBrain.js` (`think` takes its target from `scoreTargets` in place of the nearest-seen pick; `AIM_SETTLE`, `HIDE_HEALTH` keep their rows; `KeepFiringAtPlayerTime`/`AtAITime` replace the hand hold), `ai/squad.js` (calls `coordinate` on its update)
- Test: `src/lib/battlefront/ai/targeting.test.js` (Review Focus 1; a wounded enemy at 30 m outscores a whole one at 25 m by the low-health scale; a human player outscores a bot at equal distance)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npm run test:ai -- src/lib/battlefront` green.
- [ ] **Step 5: Commit** `A bot picks its target by the game's scores: distance, front and back, the human, the wounded, the seen`.

### Task 3: Cover queries

**Files:**
- Create: `src/lib/battlefront/ai/coverQuery.js` (`runQuery(query, scores, brain, spots, sim) → spot | null`: the query's search distance and the score asset's weights over `cover.js`'s spots: distance to the bot, distance to the target, enemies near (`CommonScores_AvoidCoverNearEnemies`), friends near, the line to the target, the direction; `queryFor(state)` maps the brain's states to the game's queries (attack, hide, flee, lost target, protective; the Skirmish set for the PvE tactics))
- Modify: `src/lib/battlefront/ai/soldierBrain.js` (`pickCover` is called only when `runQuery` returns null), `ai/cover.js` (exports the spot fields the query reads)
- Test: `src/lib/battlefront/ai/coverQuery.test.js` (Review Focus 2; the hide query picks the spot out of the target's line; the attack query the one with the line)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A bot's cover is the game's cover query, scored as its score asset scores it`.

### Task 4: Difficulty and the Skirmish bots

**Files:**
- Create: `src/lib/battlefront/ai/difficulty.js` (`difficultyFor(name, ai) → { aim, reaction, damage, health, curves }` with each curve evaluated at the sim's time or the bot's distance as the record keys it; `DEFAULT` the game's multiplayer row), `ai/skirmish.js` (a PvE template's abilities: the `*_Ability_PvE` rows made `abilities.js` uses with their cooldowns; `useAbility(brain, sim)` when the tactics' conditions hold)
- Modify: `src/lib/battlefront/sim.js` (`createSim` takes `difficulty`; `aimScale` from it), `ai/soldierBrain.js` (`createBrain` takes the difficulty's reaction and aim; a Skirmish template's brain calls `useAbility`), `src/components/galaxy/surface/missions/hvv.js` (`newHvv` takes `difficulty` and scales its bots' aim and damage by it; `source: "hand"` stays), `src/data/bf2017/NOTES.md`
- Test: `src/lib/battlefront/ai/difficulty.test.js`, `ai/skirmish.test.js`

- [ ] **Step 1: Failing tests**: Review Focus 3; three named difficulties give three aim scales in order; a Skirmish heavy fires its ability within its cooldown rule.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `node scripts/battlefront-balance.mjs --skirmish --difficulty <name>` for three difficulties, the rows into `docs/superpowers/evidence/battlefront-lane1/skirmish.md`.
- [ ] **Step 5: Commit** `The bots fight at the game's difficulties, and the Skirmish bots use their abilities`.

### Task 5: Names

**Files:**
- Create: `src/lib/battlefront/ai/names.js` (`nameFor(faction, mode, seed, taken) → string` from `ai.names.json`, no repeats in a match, the game's list order shuffled by the seed)
- Modify: `src/lib/battlefront/ai/bots.js` (every brain gets `name`), `sim.js`'s `view` (the name on each soldier row), `src/components/battlefront/hud/KillLog.jsx` and `Scoreboard.jsx` (draw it), `src/components/galaxy/surface/missions/starfighter.js` (the flights' pilots named from the space-battle lists; the view carries it for the fighters lane's HUD)
- Test: `src/lib/battlefront/ai/names.test.js`

- [ ] **Step 1: Failing tests**: twenty Empire names on Endor's space battle are the `TK-*` list, none twice; a faction with no list for the mode takes its multiplayer list.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Every bot has a name from the game's lists`.

### Task 6: The squadron behaviour tree

**Files:**
- Modify: `scripts/lib/bf2017-rulebook-ai.mjs` (`squadron`: the 29 `SquadronAIBehaviourBlueprint`s as trees: each entity's `$type` a node kind, its numeric fields, its children in the order the record links them (lane 0's `$ref` walk); the `AIChannelAsset`s that bind them; written to `src/data/bf2017/ai.squadron.json`)
- Create: `src/lib/battlefront/ai/squadron.js` (`createSquadronMind(tree, flight) → { tick(dt, world) → command }`: `Selector`, `Sequence`, `Loop`, `Random`, `Timed` (`TimeToRun`), `DogfightingAttack` (`MinDistanceForAttack`, `MaxDistanceForAttack`, `AimAheadDistance`, `LookAheadTime`), `DogfightingEvade`, `DogfightingFlyForward`, `SideToSide`, `Turn`, `FollowWaypoints`, `EscapeAreas`, `ProximateAreas`; the cannon rule (`MaxTargeterAngle`, `MinTimeBetweenContinuousFire`, `MaxContinuousFireTime`) and the missile rule (`LockOnDelayTime`); `command` = `{ throttle, pitch, yaw, roll, fire, missile }` for the fighters lane's flight model; the world's queries (`nearestEnemy`, `areas`, `waypoints`) passed in as functions so the module stays pure)
- Test: `src/lib/battlefront/ai/squadron.test.js` (the dogfight tree on a fixture world: Review Focus 4; a target inside 100 m makes the attacker evade or fly forward, never attack; the cannon rule's bursts stop at `MaxContinuousFireTime`)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; a twelve-seed run on a fixture flight reports time-to-first-fire and the share of ticks in each node kind into `docs/superpowers/evidence/battlefront-bots/squadron.md`.
- [ ] **Step 5: Commit** `The starfighter bots fly the game's squadron behaviour trees`.

### Task 7: The living world

**Files:**
- Create: `src/lib/battlefront/ai/creature.js` (`createCreatureMind(settings, actor) → { step(dt, { player, waypoints, rand }) → { to, speed, state } }`: the states from `CreatureLocoSettings` (idle, wander on the steering curve, follow the prefab's waypoints), the world-event reactions by `EventType` (`ExternalInfluence_HumanPlayer`: within `ConsiderationRange`, with `ProbabilityOfAction`, the `ActionType` act/flee/align, `CooldownTime`, `StopDelay`), `FakeMass` for the push)
- Modify: `src/components/galaxy/surface/actors.js` (a placed actor whose pack row names a creature setting (E0's `actors.json` carries the blueprint; the extractor maps blueprint → settings) takes `createCreatureMind` for its wander in place of the site's idle pacing; nothing changes for an actor without one)
- Test: `src/lib/battlefront/ai/creature.test.js` (Review Focus 5; a civilian within 4 m of the player acts on the first tick with probability 1; it returns to its waypoints after the cooldown)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The placed creatures and civilians move on the game's creature settings`.

### Task 8: The walkers' gunners

**Files:**
- Create: `src/lib/battlefront/ai/vehicleBrain.js` (`createGunner(row, vehicle)`: the AT-AT's and AT-ST's `AI_Rifle_ATAT`/`ATST_AI` weapon rows (ranges, bursts, dispersion) aimed by `targeting.js` from the walker's turret; `sim.js`'s walker bodies fire through `shoot` with the row's pattern)
- Modify: `src/lib/battlefront/sim.js` (the walkers' bodies get a gunner when the mode gives them one), `modes/galacticAssault.js` (Hoth's walkers shoot at the uplinks' defenders)
- Test: `src/lib/battlefront/ai/vehicleBrain.test.js`

- [ ] **Step 1: Failing tests**: the AT-AT fires its row's burst at a visible defender inside its range and not beyond. **Step 2** → FAIL. **Step 3: Implement.** **Step 4** → PASS; `node scripts/battlefront-balance.mjs --assault --runs 12` rows into `evidence/battlefront-lane2/balance.md` (the walkers armed).
- [ ] **Step 5: Commit** `The walkers' gunners fire from the game's vehicle AI rows`.

### Task 9: The hand-off and the PR

- [ ] `HANDOFF-battlefront.md`, a "bots" row under "The sixth design" (point at `HANDOFF-bf2017.md`'s table): the numbers from tasks 4, 6 and 8; what stayed hand (the heroes' decisions, HvV); `NOTES.md` updated.
- [ ] `npm run lint`, `npx vitest run src/lib/battlefront scripts/lib/bf2017-rulebook-ai.test.mjs src/components/galaxy/surface/missions/hvv.test.js`, `npm run test:ai -- src/lib/battlefront`, `npm run build`, `node scripts/health.mjs --check --skip build`, `npm run coverage:bf2017` (the AI, difficulty, names and living-world record groups marked used).
- [ ] Merge `origin/main`, push, open the PR; merge it yourself when CI is green.
