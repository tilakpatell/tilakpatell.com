# Handoff: NPC intelligence

The design is `docs/superpowers/specs/2026-10-07-npc-intelligence-design.md`, the plan `docs/superpowers/plans/2026-10-07-npc-intelligence.md`, the research `docs/research/2026-10-07-game-ai-npcs.md`. Read those first, then `src/lib/ai/index.js` (the toolkit's modules and what each is for).

## Done

- **PR 1** (#428): research, design, plan.
- **PR 2** (#432): `src/lib/ai/`: `vec`, `utility` (considerations through curves, momentum, rank, spread, runtime and cooldown), `tree` (a behaviour tree whose state lives in the blackboard), `perception` (beliefs with a detection timer, intuition, a coast and a fade; stims), `search` (two-phase shared search; the chase flood), `steer` (context steering), `spatial` (position picking with hysteresis), `influence` (grids and working maps), `squad` (squads by reach, confidence, frontline and lanes, halves, flankers, tokens). 62 tests.
- **PR 3** (#439): the universe map. The characters perceive (`npcRules.js`, `npcs/index.js`'s `senses`); the nemeses weigh their moves (bait, break, search, found; the fallback and the fury as ranks; `memory.last` decides the side they open from); the law and the pirate run on trees; the hunters hunt as a pack (tokens, flank and block roles, nerve, beliefs); the wing holds a grudge; the director paces by intensity. `scripts/universe-npc-check.mjs` checks it in Chromium through the dev hook.
- **PR 4** (#444): the galaxy's surface. Every enemy has a head (`surface/hostiles.js`'s `hostileStep`: senses, a belief, hold / strafe / close / back / cover / flank / look / search, shot and melee tokens in `activity.js`, `walker.js`'s `lineClear` as line of sight, your shots heard); the Battlefront armies fight by squads (`missions/assault.js`'s `TACTICS`: nerve, posture, a defending frontline, halves that cover halves, flankers, shot tokens that rotate).
- **PR 5** (#447): the watchers (`middleearth/towns/watchers.js`): a detection timer (`far`), suspicion (`suspicious`), intuition, and a shared search (`search`, over the rounds' corners and a town's `spots`), with every town's table tuned (`NAZGUL`, `HUNT`, `URUKS`, `TROLL`, `SHELOB`, `SCOUTS`, `COPS`; the tower's `ORCS` left instant) and Bree voicing the two new events. A town that gives none of the three keys runs exactly as before.
- **PR 6**: the Decepticons (`cybertron/game/rules.js`'s `stepEnemies`) perceive: a belief each (`ENEMY_SENSES`, with `segmentClear` as line of sight), a hold to scan when they have nothing, a drive at their guess when they only guess, and a shot only at what they can see, three shots in the air at once across them (`sim.js`'s `SHOTS_AT_ONCE` tokens). The Goombas (`mario64/rules/actors/foes.js`) see rather than measure: `GOOMBA_SENSES` and a `raycast`, so one loses Mario round a wall, keeps after him a moment, goes to where it last had him and wanders on. Ratchet's bench moved a truck's width from the berth: the fuzz found a truck wedging between them.

- **The game's clips for the surface's behaviours** (the fifth Battlefront design's lane A, `claude/bf2017-a-clips`): no behaviour changed; the states name the game's clips, which a 2017 soldier with the soldiers' pack plays and anyone else ignores (`hostiles.js`'s `bodyClip`). In cover, crouched: `cover.low.idle` (the game's `Cover_Left_Crouch_Idle_Search`), in and out through `cover.enter` and `cover.exit`; seeing you after a while: `aware.alert` (`ALERT_CLIP`) on the upper body; a ground soldier arriving: `spawn.deploy`; a hit with the side it came in from: the additive `add.hit.<side>`; the battle won: `victory.n`. The rest of `lib/three/walrusSets/npc.js` (high cover, peeks, suppressed, the officer's signals, the patrol's starts and turns) is there for the game's lane 1 bots by the same names.

## Left (the spec's section 5, and loose ends)

- **Bob-omb Ridge's Bob-ombs** (`mario64/rules/actors/foes.js`): still chase by distance; the Goombas' `spot` would serve them too.
- **Cybertron's posture** (`cybertron/game/`): the Decepticons have beliefs and shot tokens; cover and flanking (as the surface's `hostileStep`) are not there yet.
- **The Invincible city** (`invincible/world/npcs.js`): Atom Eve's patrol as a `pick` over patrol, stop and talk, race.
- **The Citadel's crowd and the surface's ambient life**: needs and advertisements (The Sims' way) where a site has things to want; the design's `site.wants`.
- **The chase flood** (`search.flood`) is built and tested but no town gives `newWatchers` a grid yet; Bree's lanes and Moria's halls are the candidates.
- **Context steering** (`steer.js`) and **influence maps** (`influence.js`) are built and tested but not yet wired into a world: the surface's walkers (round props) and the Battlefront armies (where the fight is thickest) are the first uses.
- **The HUD**: the surface's `search` event from `activity.update` isn't shown yet (the design wanted a `?` over a looking enemy's head).
- **Difficulty**: `createTokens`' `scale` is the one knob per world; nothing sets it from `lib/device`'s tier yet.

## The checks

- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.
- `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes <routes>`: software WebGL, a canvas must draw, no console error.
- `node scripts/universe-npc-check.mjs xwing high`: Vader brought in and watched, then a pack of five; green means it orbits and passes, has a word, the pack flanks, one on your tail at most, the director's intensity rose, no errors. Software WebGL runs the scene at a few frames a second, so the script goes by the scene's own clock.
- In dev, `window.__universeDebug.meetNpc('vader')` and `.hunters.packs` (modes, roles, nerve, who sees you); on the surface, `activity.targets[i].belief` and `.mind.mode`.
