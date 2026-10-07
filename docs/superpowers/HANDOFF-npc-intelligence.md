# Handoff: NPC intelligence

The design is `docs/superpowers/specs/2026-10-07-npc-intelligence-design.md`, the plan `docs/superpowers/plans/2026-10-07-npc-intelligence.md`, the research `docs/research/2026-10-07-game-ai-npcs.md`. Read those first, then `src/lib/ai/index.js` (the toolkit's modules and what each is for).

## Done

- **PR 1** (#428): research, design, plan.
- **PR 2** (#432): `src/lib/ai/`: `vec`, `utility` (considerations through curves, momentum, rank, spread, runtime and cooldown), `tree` (a behaviour tree whose state lives in the blackboard), `perception` (beliefs with a detection timer, intuition, a coast and a fade; stims), `search` (two-phase shared search; the chase flood), `steer` (context steering), `spatial` (position picking with hysteresis), `influence` (grids and working maps), `squad` (squads by reach, confidence, frontline and lanes, halves, flankers, tokens). 62 tests.
- **PR 3** (#439): the universe map. The characters perceive (`npcRules.js`, `npcs/index.js`'s `senses`); the nemeses weigh their moves (bait, break, search, found; the fallback and the fury as ranks; `memory.last` decides the side they open from); the law and the pirate run on trees; the hunters hunt as a pack (tokens, flank and block roles, nerve, beliefs); the wing holds a grudge; the director paces by intensity. `scripts/universe-npc-check.mjs` checks it in Chromium through the dev hook.
- **PR 4** (#444): the galaxy's surface. Every enemy has a head (`surface/hostiles.js`'s `hostileStep`: senses, a belief, hold / strafe / close / back / cover / flank / look / search, shot and melee tokens in `activity.js`, `walker.js`'s `lineClear` as line of sight, your shots heard); the Battlefront armies fight by squads (`missions/assault.js`'s `TACTICS`: nerve, posture, a defending frontline, halves that cover halves, flankers, shot tokens that rotate).
- **PR 5** (#447): the watchers (`middleearth/towns/watchers.js`): a detection timer (`far`), suspicion (`suspicious`), intuition, and a shared search (`search`, over the rounds' corners and a town's `spots`), with every town's table tuned (`NAZGUL`, `HUNT`, `URUKS`, `TROLL`, `SHELOB`, `SCOUTS`, `COPS`; the tower's `ORCS` left instant) and Bree voicing the two new events. A town that gives none of the three keys runs exactly as before.
- **PR 6**: the Decepticons (`cybertron/game/rules.js`'s `stepEnemies`) perceive: a belief each (`ENEMY_SENSES`, with `segmentClear` as line of sight), a hold to scan when they have nothing, a drive at their guess when they only guess, and a shot only at what they can see, three shots in the air at once across them (`sim.js`'s `SHOTS_AT_ONCE` tokens). The Goombas (`mario64/rules/actors/foes.js`) see rather than measure: `GOOMBA_SENSES` and a `raycast`, so one loses Mario round a wall, keeps after him a moment, goes to where it last had him and wanders on. Ratchet's bench moved a truck's width from the berth: the fuzz found a truck wedging between them.

- **PR 7** (the NPC architecture, `docs/superpowers/specs/2026-10-07-npc-architecture-design.md`, its plan `plans/2026-10-07-npc-architecture.md`, its research `docs/research/2026-10-07-npc-architecture-research.md`): `lib/ai/action.js` (an actor per brain: actions with prerequisites, a cut rule by priority, a recovery, a cooldown, a body for `bodyFrom`), `lib/ai/schedule.js` (sense 20 Hz, think 10 Hz at the top rank, slower down, a millisecond budget, `stats()`), `lib/ai/trace.js` and `inspect.js` (a ring of every decision; `?ai=1` opens `components/debug/AiInspector.jsx`), `lib/sim/fixedStep.js`, `lib/seeded`'s `streams` (`?seed=N` pins a visit). The universe map's characters, hunters and wing run on the schedule from the visit's seed, fire only inside a forward cone (backlog 41), and trace their scores; Cybertron's Decepticons run on actors (`cybertron/game/tactics.js`: cover behind a solid by `spatial`, flank, search at the guess, a shot token claimed only down a clear line) and are drawn by `bodyFrom` (`bodies.js`), checked by `scripts/cybertron-check.mjs`; the Bob-ombs see (the Goombas' `spot`); the towns draw a searching watcher walking and a suspicious one walking then standing, and the watchers' search is seeded; `lib/three/rigCheck.js` and `scripts/rig-check.mjs` check every committed rig and clip (70 pass), and `retarget` finds the hips by role.

## Left (the spec's section 5, and loose ends)

From PR 7, in order:

- **The director and the spawns** (`universe/scene.js:910, 1036, 3168, 3229`) still run on `Math.random`; once PR #551 lands, pass `streams(seedOf()).fork('director')` and `fork('spawns')` (`universe/seed.js`).
- **The budget from the tier.** `schedule.js` defaults `budget.ms` to 1; the spec wants 0.5 / 1.0 / 2.0 by `lib/device`'s tier, or `lib/budgets.js`'s row once `claude/quality-settings` lands. One line in `npcs.js`, `hunters.js` and Cybertron's sim.
- **The animation layer by family.** `rigCheck.js` has `rolesFor`, `masksFor` and `hipsOf`; `rig.js` should import `ROLES` and `plain` from it (a drift test holds the copies equal until then), `animator.js`'s masks and `locomotion.js`'s leg names should come from `masksFor`/`rolesFor` of the figure's family, and `meshyCast.js:36`, `footScene.js:272` (pass `from`), `cockpit/crew.js:83` and `rv.js:120` should read the hips through `hipsOf`. Owner: the living-characters session (W4 touches `rig.js`'s `figure`).
- **`fromReaction`** ignores a reaction's `then` and `cut`; the actor holds one action and no queue.
- **Cybertron's schedule.** The Decepticons sense at 20 Hz inside the sim; a `createSchedule` over them (as the universe has) would give the inspector their ranks.
- **The four fixed-step loops** (Mario 64 `game.js:20`, Portal panic `rules.js:15`, the Battlefront `assault.js:64`, Minecraft `module.js:52`) onto `lib/sim/fixedStep.js`, a safe refactor each with its tests.
- **`scripts/universe-npc-check.mjs`** cannot finish under software WebGL in a cloud container (3 to 7 sim seconds a run against the 45 it expects, the same before and after PR 7); it passes its AI lines there and needs the owner's GPU for the rest.

From before:


- **Bob-omb Ridge's Bob-ombs** (`mario64/rules/actors/foes.js`): still chase by distance; the Goombas' `spot` would serve them too.
- **Cybertron's posture** (`cybertron/game/`): the Decepticons have beliefs and shot tokens; cover and flanking (as the surface's `hostileStep`) are not there yet.
- **The Invincible city** (`invincible/world/npcs.js`): Atom Eve's patrol as a `pick` over patrol, stop and talk, race.
- **The Citadel's crowd and the surface's ambient life**: needs and advertisements (The Sims' way) where a site has things to want; the design's `site.wants`.
- **The chase flood** (`search.flood`) is built and tested but no town gives `newWatchers` a grid yet; Bree's lanes and Moria's halls are the candidates.
- **Context steering** (`steer.js`) and **influence maps** (`influence.js`) are built and tested but not yet wired into a world: the surface's walkers (round props) and the Battlefront armies (where the fight is thickest) are the first uses.
- **The HUD** (after W2's surface changes): the surface's `search` event from `activity.update` isn't shown yet (the design wanted a `?` over a looking enemy's head).
- **Difficulty**: `createTokens`' `scale` is the one knob per world; nothing sets it from `lib/device`'s tier yet (with the budget line above).

## The checks

- `?ai=1` on any world that registers (the universe map, Cybertron's city game): the inspector, bottom left; `?seed=N` pins the visit.
- `node scripts/cybertron-check.mjs`: a wave of five by the Iacon crates, 20 sim seconds; green means one took cover, never more than three shots in a step, the AI under 2 ms a step, every one traced. `node scripts/rig-check.mjs --check`: every committed rig and clip.
- In dev, `window.__universeDebug.ai.stats()` and `.ai.trace.export()`; `window.__CY__.ai`.

- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.
- `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes <routes>`: software WebGL, a canvas must draw, no console error.
- `node scripts/universe-npc-check.mjs xwing high`: Vader brought in and watched, then a pack of five; green means it orbits and passes, has a word, the pack flanks, one on your tail at most, the director's intensity rose, no errors. Software WebGL runs the scene at a few frames a second, so the script goes by the scene's own clock.
- In dev, `window.__universeDebug.meetNpc('vader')` and `.hunters.packs` (modes, roles, nerve, who sees you); on the surface, `activity.targets[i].belief` and `.mind.mode`.
