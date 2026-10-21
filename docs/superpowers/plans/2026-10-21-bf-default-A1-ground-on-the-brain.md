# Lane A1: the ground’s soldiers on the game’s brain

Design: `docs/superpowers/specs/2026-10-21-battlefront-by-default-design.md`, decision 6. Branch `claude/bf-default-a1-ground-brain`. One PR for the ground war; the quests’ hostiles, the garrison and the older assault follow one PR each on the same branch name with a suffix (`-quests`, `-garrison`, `-assault`) once the first is merged. Wave 1: A2 corrects `src/lib/battlefront/ai/` beside you; **do not edit files under `src/lib/battlefront/`**; read the brain as it is, and `git merge origin/main` before the PR so the corrected brain is what you ship.

## Read first

- `src/lib/battlefront/ai/soldierBrain.js` (its head: `createBrain`, `think`, `act`, the `world` it expects), `targeting.js`, `cover.js`, `coverQuery.js`, `squad.js`, `difficulty.js`, `bots.js` (how the sim wires brains, senses and events), `src/lib/battlefront/nav.js` (`findPath`, `walkable`, `cellAt`), `soldier.js` (`chestOf`, `move`, `speedAlong`), `weapons.js` (`kickAim`), `core.js` (`clock`, `SENSE`, `THINK`, `STEP`).
- `src/components/galaxy/surface/ground/` (every file and test: `fight.js`, `troops.js`, `population.js`, `director.js`, `groundScene.js`, `groundFigures.js`, `bolts.js`, `standing.js`, `turf.js`, `ground.scenario.test.js`), `hostiles.js`, `weaponRules.js`, `walker.js`, `solids.js`.
- `docs/superpowers/specs/2026-10-08-ground-factions-design.md` (sections 5 to 7, 9), `2026-10-07-ground-sides-kashyyyk-look-ai-design.md` (section 6), `2026-10-10-battlefront-game-design.md` (the bots), `src/data/bf2017/NOTES.md` (“The bots’ minds”, “Squads”, “The AutoPlayers”).
- `src/data/bf2017/ai.json` (`templates`, `tactics`, `difficulties`, `patterns`, `cover*`), `classes.json`, `weapons.json`, `src/lib/battlefront/rulebook.js` (`aiOf`).
- `npm run test:ai -- ground`, `scripts/assault-check.mjs`, `scripts/perf-probe.mjs` (run them on `main` first and keep the numbers).

## Tasks

1. **`ground/brain.js`: the adapter.** `createGroundWorld({ population, turfs, director, solids, seesThrough, bolts, war, you })` → the `world` the brain expects: `nav` (a 2 m grid built from the level’s solids and the walker’s ground, with `findPath`, `walkable`, `cellAt`, `heightAt`, `nearestWalkable` in the sim’s shapes; the population’s cells are the start; cost measured), `lineClear(a, b)` from `seesThrough`, `squad` from the fight’s squads, `objective` and `task` from the director’s posts, raids and hunts, `enemies` and `others` by the war’s sides (`standing.js`), `shoot(s, aim)` into `ground/bolts.js`, `roll(s, dir)` into the body, `who(id)`. `brainFor(soldier, { ai, difficulty, rand })` → `createBrain` with the kind’s template, tactics and role from `troops.js`. Pure, tested with a fixture world.
2. **`troops.js`: the game’s rows.** Each kind gains `template` and `tactics` (`rifleman`, `heavy`, `officer`, `sniper`, `closerange`, `melee`; a droid’s nerve from its template), and `hp` and `weapon` from `classes.json` and `weapons.json` where the game has the kind (the stormtrooper, the rebel, the clone, the B1, the B2, the death trooper, the shoretrooper, the snowtrooper, the hothtrooper, the officer); a kind the game lacks keeps its hand row with `source: 'hand'` and a NOTES line.
3. **`fight.js`: the gates round the brain.** `fightStep` calls `think` and `act` through the adapter and keeps what the brain lacks: the war’s relation and grudge, the shot tokens, the nerve from the squad’s confidence, the beat and the post when nobody is near. `hostiles.js`’s heads (hold, strafe, close, back, cover, flank, look, search) retire from the ground war’s path; the quests keep them until their own PR.
4. **The difficulty** is one Menu setting (`difficulty.js`’s names, `normal` by default) read by the surface and passed to `brainFor`; `?difficulty=` for the checks; the galaxy’s guide page says it.
5. **Prove it.** `ground.scenario.test.js` and `npm run test:ai -- ground` green with the brain; `scripts/assault-check.mjs` on Hoth, Geonosis, Scarif and Endor: stuck 0, a fight within 60 s of landing on a held world; `scripts/perf-probe.mjs` on Hoth’s surface before and after, the brain’s share said in the PR.
6. **Docs.** `HANDOFF-galaxy.md` “The ground war” and the migrations line; `docs/architecture.md`’s galaxy paragraph.

## Done when

- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green; the checks above green and their numbers in the PR.
- Every soldier the ground war fields thinks with `soldierBrain.js`; the hand brain’s files it no longer needs are gone or say what still reads them.
