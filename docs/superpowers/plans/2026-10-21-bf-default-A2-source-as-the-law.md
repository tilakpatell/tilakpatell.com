# Lane A2: the source is the law

Design: `docs/superpowers/specs/2026-10-21-battlefront-by-default-design.md`, decision 7. Branch `claude/bf-default-a2-source`. One PR, or one a module if a correction proves large (each stands alone). Wave 1: A1 reads `src/lib/battlefront/ai/` beside you and edits only `src/components/galaxy/surface/ground/`; **edit only `src/lib/battlefront/ai/`, its tests, `src/data/bf2017/NOTES.md` and the evidence**. The Battlefront world’s own rules (`modes/`, `sim.js`, `assault.js`) are not yours.

## Read first

- The site’s brain: `src/lib/battlefront/ai/soldierBrain.js`, `targeting.js`, `cover.js`, `coverQuery.js`, `squad.js`, `difficulty.js`, `bots.js`, `throw.js`, `heroBrain.js`, `vehicleBrain.js`, `creature.js`, every test beside them; `src/data/bf2017/NOTES.md` (“The bots’ minds”, “Squads”, “The AutoPlayers”, “`trooperKit.json`”: the rows marked by hand); `src/data/bf2017/ai.json`.
- The findings written before the source was in hand: `C:\Users\tilak\source\repos\bf2-re\findings\05-ai.md`, `28-npcs-and-ai.md` (section 9: what the site’s bots do differently), `34-shooting-and-ai-usage.md`.
- The game’s AI source, read-only: `D:\Custom BFEngine\Source Code\Code\Extension\BattleAI\Brain\` — `Reason/Tactics.cpp` and `.h` (`evaluateTactics`, `updateTacticInfo`, the tick limits), `Reason/TargetSelection.cpp` (`selectTargets`), `Reason/CombatReasoning.cpp`, `Reason/CoverEvaluator.cpp`, `Reason/TacticCoverEvaluator.cpp`, `Reason/ShootAtTargetsInfo.cpp`, `Reason/WeaponFiringInfo.cpp`, `Reason/TokenUpdater.cpp`, `Reason/CombatIntensity.cpp`, `Execute/WeaponControl.cpp`, `Execute/MoveControl.cpp`, `Execute/CoverControl.cpp`, `Gather/VisionInfo.cpp`, `Gather/CoverQuery.cpp`, `Gather/TeamManager.cpp`, `Mindcraft/__Generated__/Soldier/SoldierBehavior.inl` (the generated behaviour tree) and `Shared/` for the settings classes. First check the tree is this game’s: the settings classes in `Tactics.h` (`ChargeSettings`, `AttackSettings`, `HideSettings`, `FleeSettings`, `CloseCombatSettings`, `SquadMovementSettings`, `SquadEngageSettings`) must match `ai.json`’s tactics rows’ fields.
- The law: nothing of the source is copied, quoted at length or shipped. A rule is rewritten in the site’s JavaScript, in the site’s words, with a test; the NOTES row cites the file and the function. The owner holds the source.

## Tasks

1. **The sheet.** `docs/superpowers/evidence/bf-ai-source/README.md`: a table of every rule the site’s brain holds (the tactic pick and its order, the tick limits, target selection and the keep-firing time, the aim box and its settle, the pattern’s start and stop, the cover evaluator’s terms and weights, spotting and loss, suppression, the squad’s alert, the throw) with three columns: what the site does, what the source does (file, function, a sentence), same or differs. Write it before changing code; the PR carries it.
2. **The corrections**, one each with a test, in the order the sheet’s “differs” rows fall: the tactic evaluation (`Tactics.cpp`: which tactics are available, how one is chosen, when it is left; `soldierBrain.js`’s utility pick made to match), target selection (`TargetSelection.cpp` against `targeting.js`), the firing pattern and aim (`WeaponControl.cpp` against `act` and `patternStep`), vision (`VisionInfo.cpp` against `createSenses` and the senses’ use), cover (`CoverEvaluator.cpp`, `TacticCoverEvaluator.cpp` against `cover.js` and `coverQuery.js`), tokens (`TokenUpdater.cpp` against the squad’s tokens). Where the source and the records agree with the site, write the row and change nothing.
3. **NOTES.** Each corrected rule’s row: `source: "code"`, the file and function, the number or order it fixed, and the hand reading it replaced.
4. **The balance.** `scripts/battlefront-balance.mjs --skirmish` and `--assault` on `main` and on the branch; `npm run test:ai -- src/lib/battlefront` over the seeds, stuck 0; the tables in the evidence README with a sentence on what moved and why it should have.
5. **Docs.** `HANDOFF-battlefront.md` “The bots”: one line; the findings in `bf2-re` are read-only, do not edit them.

## Done when

- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green; the seeds stuck 0.
- Every rule in the sheet is either matched to the source with a test or marked “same” with its citation; no NOTES row for the bots says “by hand” where the source answers it.
