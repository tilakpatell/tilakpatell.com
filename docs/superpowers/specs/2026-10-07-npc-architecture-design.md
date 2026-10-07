# NPC architecture: actions with a lifecycle, a budgeted clock, a seed under everything, and a window into every head

The site's characters are decided by `src/lib/ai/` (nine pure modules: utility, trees, perception, search, steering, places, influence, squads; the design `2026-10-07-npc-intelligence-design.md`) and, since the living-characters wave (`2026-10-07-living-characters-design.md`, branch `claude/living-npcs`), moved by `src/lib/three/animator.js` through the seam `lib/ai/body.js` and `lib/ai/react.js`. Both designs are sound and both are half-wired: the toolkit is under four of a dozen NPC systems, the seam is under none on the pushed branch, and what sits between a brain's `mode` and its body's clip is written by hand in every world.

An audit on 2026-10-07 (four readers over every NPC system, the runtime and the pipeline, on `claude/living-npcs` at e5a159e9) found, most costly first:

- **Nothing between the mode and the body has a contract.** A brain writes `me.mode`; a scene maps it to one number (`activity.js:578`, `assaultScene.js:256`, `cybertron/game/scene.js:484`, `rickmorty/world/npc.js:164`, the Middle-earth towns' scenes). A mode has no prerequisites, no completion, no interruption rule and no failure path: a Cybertron shot token is claimed before the line of sight is checked and held for its full second when the shot isn't taken (`rules.js:665-681`); Bree, Amon Hen and the Marshes leave `suspicious` and `search` out of their `moving` sets, so a watcher that searches stands still while its brain walks (`bree/scene.js:592`, `amonhen/scene.js:543`, `marshes/scene.js:719`); the surface's `search` event has no consumer; a reaction (`react.js`) and a mode never meet, so a hit while aiming is whichever one wrote the bones last.
- **Everything thinks every frame.** Every universe brain, hunter and wingman senses and steers each frame (`scene.js:3141, 3186, 3444`); so do the watchers, Cybertron's Decepticons and the Rick and Morty walkers. Only the choice is throttled, and only in two places (the nemesis's 0.5 s, the surface's 0.4 s). There is no AI budget anywhere, and no number anyone can read that says what the AI costs.
- **Random is unseeded where it matters.** The universe's NPCs, hunters, wing, director and spawns, the watchers' search, Cybertron's sim and the surface's parry all run on `Math.random` (`npcs.js:21`, `hunters.js:57`, `wingRules.js:76`, `director.js:94`, `scene.js:3168`, `watchers.js:107`, `sim.js:28`, `activity.js:388`). A bug seen once can't be seen twice. Three seeded generators exist (`lib/seeded`, the daycare's `rng`, Portal panic's).
- **Four fixed-step loops, four ways.** Mario 64 (30 Hz, `game.js:20`), Portal panic (120 Hz, `rules.js:15`), the Battlefront (0.1 s substeps, `assault.js:64`), Minecraft (20 Hz, `module.js:52`). The runtime itself has none (`runtime.js:83`: variable `dt`, capped at 50 ms), so a long frame moves a Decepticon a different distance from a short one.
- **No one can see a decision.** The dev hooks (`__universeDebug`, `__CY__`, `__surface`, the towns' `sim`) expose state, not reasons: never the scores a `pick` weighed, the belief a shot went at, or the action a reaction cut. `?debug` is sliders in two worlds. The nemesis's scores die with the frame.
- **The pipeline has no validator.** Nothing checks that a rigged GLB carries a skin, the Meshy joints or toe bones, or that a clip's tracks resolve on the figure it's played on; `clipLibrary.test.js:80` checks that the files exist and `office/people.test.js:30` checks one set's joints. The animator's masks and locomotion's leg names are Meshy's only (`animator.js:67`, `locomotion.js:99`), so a Mixamo or High Moon figure gets no layers and no stride, silently. `retarget` drops a root translation track not named exactly `Hips` (`clipLibrary.js:189`). Hips height is read four ways. The rigged troopers in `public/models/galaxy/troops/` are referenced by nothing.
- **The handoff's "Left" is still left**, apart from the surface's needs: Bob-ombs chase by distance (`foes.js:161`), Cybertron has no cover or flank (`rules.js:643-657`), Eve is a timer, the chase flood and influence maps are imported by nothing, `createTokens`' `scale` is set by no world.

This is the design for the layer between a brain and its body, the clock and budget the brains share, the seed under all of them, the window into each head, and a check on every rig. It builds on the living-characters layer and never beside it: `action.js` sits over `body.js` and `react.js` and drives the animator; `schedule.js` is `animBudget.js`'s twin for the brains. The research is `docs/research/2026-10-07-npc-architecture-research.md`.

## What it is not

- **Not a rewrite of any brain.** Every brain keeps its intent shape and its tests. A brain gains a seed, a cadence and an actor; what it decides is unchanged.
- **Not a new animation layer.** The animator, the clip library, locomotion, `body.js` and `react.js` are the living-characters design's and stay as they are. This design adds the thing that calls them in one order.
- **Not a worker, not compute, not a model.** The AI stays in JS on the main thread, measured. The research says why; the scheduler's `stats()` is the number that would reopen the question (over 4 ms on the mid tier). WebGPU stays PR #371's lane. A language model stays an experiment, below.
- **Not a change to any world another session has open.** The Rick and Morty worlds and the galaxy's surface (living-characters W2, local on the owner's desktop), Invincible (part 2, Task 7), the universe map's layout and flight (PR #551), the quality settings (`claude/quality-settings`) and the Middle-earth cast are not touched. Where this design names them it names the integration point for their next wave.

## The lifecycle: `src/lib/ai/action.js`

An action is what a brain's mode becomes once it has a body: a thing with prerequisites, a start, a run, an end, a cut and a failure. Unreal's abilities (activate, commit, end or cancel; tags that block, tags that cancel), Unity's interruption sources and Anguelov's start / execute / stop are the three sources; this is the smallest shape that holds all three on the site's pure-rules pattern.

```js
// an action in a world's table: { [id]: Action }
Action = {
  can(ctx) → null | string,          // null: may start; else why not (shown in the inspector)
  start(ctx) → state,                // its own state, kept by the actor; may play a clip through ctx.body
  step(state, ctx, dt) → 'running' | 'done' | 'failed',
  end(state, ctx, why),              // why: 'done' | 'failed' | 'cut' | 'replaced'; always called once
  priority = 0,                      // a higher one cuts a lower one; an equal one replaces it unless its cutBy is 'higher' or 'none'
  cutBy = 'any' | 'higher' | 'none', // Unity's interruption source, as a word
  replaces = false,                  // may the same action restart itself (a punch chain); also lets an equal one replace a 'higher'
  body: { base?, clip?, layer?, hold? } | (state, ctx) → that,  // what body.js should see while it runs
  recover: null | string,            // the action to run when this one fails (cover's "hold")
  cooldown = 0,                      // seconds before it can start again (utility's cooldown), counted from any end, so a cut one can't restart in a loop
};
```

- `createActor({ actions, trace?, id })` → `{ want(id, ctx) → 'started' | reason, cut(why), step(ctx, dt) → { id, phase, body }, current(), since() }`. One actor per agent, holding one running action and one queued. `want` runs `can`, then the cut rule against the running action, then `end(…, 'replaced' | 'cut')` on the old and `start` on the new. `step` ticks the running action, and on `'failed'` ends it and starts `recover` if named, else idles; on `'done'` ends it, clears it and notes the cooldown.
- **The body sees the action, not the mode.** `step` returns `body`, which the scene passes to `bodyFrom` as the step's `base`, `action` and `hold` ahead of the `MODE_BODY` row. So a world's `MODE_BODY` table stays what it is for a brain that has no actor yet, and an actor overrides it where it runs. This is the one order in which mode, action and reaction reach the animator: reaction (a cut with `priority`) over action over mode.
- **Reactions are actions.** `fromReaction(reaction, { priority })` wraps what `react.js`'s `on` returns into an `Action` whose `start` plays the clip, whose `step` is done when the animator's `play` promise resolves, and whose `end` on `'cut'` stops the layer. A `hit` is `priority 2, cutBy 'higher'`; a `down` is `priority 9, cutBy 'none'`; a `greet` is `priority 0`. A world's reaction table says the priorities; the defaults are in `REACTIONS_PRIORITY`.
- **The clip is the clock for a one-shot.** An action with a `clip` and no `step` of its own is `'running'` until the animator says `'done'` or `'cut'`; an action that walks somewhere is `'done'` when it arrives and `'failed'` when its target is gone or it hasn't moved for `stuck` seconds. Those two are the two standard actions every world gets: `clipAction(name, { layer, hold })` and `goTo(point, { reach, stuck = 2 })`.
- **Failure is a value.** `end` gets `why`; `trace` records it; the inspector shows it. Nothing throws out of an action: a throw in `start` or `step` is caught, the action ended `'failed'`, and the error noted once.

The handoff's Cybertron posture (cover, flank), the surface's `search` HUD mark and every world's `MODE_BODY` omission are the same bug, and the actor is the one fix: the mode picks the action; the action knows its body; the body never has to guess.

## The clock and the budget: `src/lib/sim/fixedStep.js` and `src/lib/ai/schedule.js`

### `fixedStep.js`

`createFixedStep({ hz, max = 4 })` → `{ step(dt, fn) → n, alpha, reset() }`: Fiedler's accumulator, clamped at `max` steps a frame (the rest dropped, never fast-forwarded: a tab coming back runs `max` steps and no more), `alpha` the fraction into the next step for a drawing layer that interpolates. `reset()` on `visibilitychange`. It replaces nothing yet and has no user yet: `schedule.js` keeps its own per-lane accumulators (a step per lane per agent, not one clock), and Mario 64's, Portal panic's, the Battlefront's and Minecraft's loops are the optional migration below.

### `schedule.js`

The brains' twin of `animBudget.js`, built on the LOD Trader and Unreal's Significance Manager: a score per agent for how much a visitor would notice it, a rank, and a millisecond budget spent from the top.

```js
createSchedule({
  rates: { sense: 20, think: 10, ambient: 4 },   // Hz, by lane
  budget: { ms: 1.0 },                           // the frame's share for every brain together
  significance(agent, view) → 0..1,              // the world's: on screen × size × recently met; default by distance
  tiers: [1, 0.5, 0.25, 0],                      // the rate multiplier by rank: the top quarter full, the next half, the next quarter, the rest paused
  seed,
}) → {
  add(agent, { lane = 'think', sense = true }), drop(agent),
  frame(dt, view, now) → { due: [{ agent, sense, think, dt }], stats },
  stats() → { agents, sensed, thought, ms, skipped, worst: { id, ms } },
}
```

- `frame` ranks the agents by significance once every 0.5 s (the LOD Trader's cadence), gives each a tier, and for each lane keeps a per-agent accumulator so an agent due to think gets the real time its lane has waited (0.1 s at the top tier, 0.2 at half rate, 0.4 at a quarter: a slow-tier brain's timers run at real speed, not a quarter of it; a paused agent accrues nothing and thinks once with one step's `dt` when it returns). Tiers go by each agent's share of the total significance ranked above it, not by head count, so a crowd at one distance still splits 25 / 50 / 25 and a far crowd doesn't fill the top tier. Agents due in the same frame are spread: a lane's phase is seeded per agent so a crowd of twenty doesn't all think on the same frame.
- The budget is enforced by measurement, not by guess: `frame` times each `think` the world runs (the world calls `done(agent)` after its step; the scheduler reads `performance.now()` where it exists, else nothing) and, when the running total passes `budget.ms`, defers the rest of the frame's due agents to the next, in rank order. `stats.skipped` counts the deferrals; the inspector shows it, and `scripts/universe-npc-check.mjs` prints it.
- A brain that senses at 20 Hz and thinks at 10 Hz is the design's default; perception at 20 Hz keeps the detection timer's feel (a 50 ms step against a 0.3 s `far`), and a 10 Hz choice is above anything a visitor can see. The universe's hunters keep sensing at 20 Hz; their `nerve` already runs at 1 Hz.
- The tier that reaches a world's brain is the scheduler's, which reads `lib/device`'s tier for `budget.ms` (`low` 0.5, `mid` 1.0, `high` 2.0) until the quality-settings branch lands its `budgets.js` rows, when `budget.ms` is read from there (one line in `schedule.js`'s default; the branch owner is told).

## The seed: one stream per world, one per agent

`lib/seeded.js` stays the generator (it's the Shire's; splitmix-style, fine for this). What changes is where the seeds come from and that nothing in `lib/ai` or a `rules.js` reaches `Math.random`:

- `lib/seeded.js` gains `streams(seed)` → `{ fork(label) → rand }`: a stream per subsystem and per agent, named (`'hunters'`, `'npc:vader'`, `'director'`), each a `seeded(hash(seed, label))`, so an agent's randomness is the same whatever order it spawned in.
- A world's seed is its visit's (`saves`' visit key, or the URL's `?seed=` in dev), kept on the scene; every `createX({ rand })` on the site that defaults to `Math.random` gets the world's fork. The audit's list: `universe/npcs.js:21`, `hunters.js:57` (`createHunt`'s `rand`), `wingmen.js:21`, `scene.js:910` (the director), `scene.js:3168` (spawns), `watchers.js:107` (the search), `cybertron/game/GameWorld.jsx:70` (`createSim`), `search.js:24`'s default.
- `?seed=` and `?ai=` are read by `lib/ai/inspect.js` (below) and shown, so a report is "seed 4121, 00:38, the nemesis" and the check scripts set the seed.
- Not changed: the scenes' cosmetic `Math.random` (sparks, clip start offsets, sway phases) stays where it only draws. The rule is the handoff's: rules seeded, drawing free.

## The window: `src/lib/ai/trace.js`, `lib/ai/inspect.js` and `components/debug/AiInspector.jsx`

Treyarch's recorder, small: record after every step, fixed memory, no effect on the outcome.

- `createTrace({ size = 600 })` → `{ note(id, t, record), last(id), history(id, n), agents(), clear(), export() }`: a ring buffer per agent of `{ t, mode, action, phase, why?, belief: { at, confidence, visible }?, scores?: { id: score }, event? }`, 600 records at 10 Hz is a minute. `utility.pick` already returns `scores`; a brain notes them in one line. `export()` is JSON for a bug report; `scripts/universe-npc-check.mjs` saves one on failure.
- `inspect.js` is the registry the overlay reads: `register(worldId, { trace, schedule, actors, agents() → [{ id, kind, at, mode }] })` and `unregister(worldId)`, called by a world's scene beside its existing `window.__X__` hook (DEV only, as those are). `?ai=1` turns the overlay on; `?seed=` is read here too.
- `AiInspector.jsx` is mounted once in `App.jsx` (one line, behind `import.meta.env.DEV || ?ai`), a fixed panel over whichever world is registered: the scheduler's `stats` (agents, thought this frame, ms, skipped, the worst agent), a list of agents by significance with mode, action and phase, and for the one picked, its last twenty records (scores as bars, the belief's confidence, the reason an action was refused or cut) and a scrub over the ring. It draws nothing in 3D; a world that wants its beliefs drawn in the scene adds that to its own `?debug`.

## The check: `src/lib/three/rigCheck.js` and `scripts/rig-check.mjs`

A rig or a clip that doesn't fit is found when it's committed, not when a visitor sees a T-pose.

- `rigCheck.js` (pure, on names): `checkRig(boneNames)` → `{ family: 'meshy' | 'mixamo' | 'unreal' | 'cc' | 'highmoon' | null, roles: { [role]: name | null }, toes: bool, missing: [role] }` by `rig.js`'s `ROLES`; `checkClip(trackNames, boneNames)` → `{ resolved, unresolved: [track], root: name | null }`; `hipsOf(clip, node)` → the one authority for the hips height: the file's `extras.hips` when written by the bake, else the `Hips` node's rest `y`, with `userData.hips` set from it so `retarget` and every caller read one number.
- `scripts/rig-check.mjs [paths…]` parses GLBs with `@gltf-transform/core` (already a dev dependency, used by the bake) and prints a table: file, family, joints, toes, clips and their unresolved tracks, hips. `--check` exits 1 on a rigged figure with a missing role or a clip with an unresolved track, and the test `scripts/rig-check.test.mjs` runs it over `public/games/meshy/rick-*.glb`, `clips-*.glb`, `ual-*.glb` and `public/models/galaxy/troops/*.glb`, so CI catches a bad bake.
- `clipLibrary.js`'s `retarget` takes the root translation by role (`ROLES.hips`), not by the literal `Hips`, so a Mixamo clip's `mixamorig:Hips.position` is scaled and kept. `locomotion.js`'s `NAMES` and `animator.js`'s `MESHY_MASKS` are built from `ROLES` for the figure's family, so a High Moon or Character Creator figure gets its stride and its layers, and `plain()` lives once in `rig.js`.

## How it all connects

```
brain (rules.js, 10 Hz by schedule)        reactions (react.js, on events)
   │ mode, aim, look, events                   │ { clip, layer, hold, priority }
   ▼                                           ▼
actor (action.js)  ◄───────────── fromReaction ──┘
   │ { id, phase, body }  + trace.note(scores, belief, why)
   ▼
bodyFrom (body.js): step + action.body → { motion, look, base, action, scan }
   ▼
animator (lib/three/animator.js, rate by animBudget): locomote, base, play, look
   ▼
figure (meshyCast / footScene / rig.js figure)
```

A world's scene owns the actor and the schedule as it owns its brains: `schedule.frame(dt, view)` gives it the agents due; it senses and thinks those; every agent's actor steps every frame (cheap: one running action) so a one-shot ends on time; `bodyFrom` runs each frame for figures on an animator. The runtime's `step(dt, input, now)` and a `useScene`'s frame are both frames; nothing here needs the runtime.

The living-characters seam is the body's side of this. Its W2 (the showcase worlds) is being built on the owner's desktop against `MODE_BODY`; it needs no change to land, and its scenes adopt an actor in W3 by passing `actor.step(…).body` into `bodyFrom`, the two-line change this design's Cybertron wave shows.

## Performance budgets, profiling, compatibility, fallback

- **Budget.** The brains together: 0.5 ms a frame on `low`, 1.0 on `mid`, 2.0 on `high`, measured by the scheduler and shown by the inspector; the mixers stay under `animBudget`. Perception 20 Hz, thinking 10 Hz, ambient 4 Hz, paused off screen. A world with sixty agents on `mid` thinks about six a frame.
- **Profiling.** `schedule.stats()` in the inspector and printed by `universe-npc-check.mjs` and a new `cybertron-check.mjs`; `renderer.info` as today. No `performance.measure` in production.
- **Compatibility.** Plain JS, no new API: `performance.now()` where it exists, else the budget is a count. No worker, no `SharedArrayBuffer` (GitHub Pages can't set the headers), no WebGPU.
- **Fallback.** A brain without an actor runs as today (`MODE_BODY` alone). A world without a schedule steps its brains every frame as today. A figure whose family `rigCheck` can't name gets locomotion's `clipSpeed` pace and no layers, as now, and the check says so.

## Migration, in waves

Each is one pull request on this branch's lane, mergeable on its own, with the gate green (`npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`) and the world checked in a browser where it draws.

- **M1, the modules**: `action.js`, `fixedStep.js`, `schedule.js`, `trace.js`, `inspect.js`, `seeded.streams`, `rigCheck.js`, with their tests. No world changes.
- **M2, the universe map**: the brains, hunters, wing, director and spawns on the visit's streams; the brains and hunters on the schedule (sense 20 Hz, think 10 Hz; the universe's `npcRules.update` and `hunterRules.update` take the due list); the nemesis's `pick` scores and every brain's mode into the trace; the inspector registered; backlog item 41 (a forward fire cone in `npcRules.js`, with the nemesis scenario). `universe-npc-check.mjs` prints the scheduler's stats and saves the trace on failure.
- **M3, Cybertron**: `stepEnemies` on actors (the sim steps every Decepticon, sensing at 20 Hz inside it, and times itself for the inspector; a `createSchedule` over them is in the handoff's Left): `hold`, `advance`, `strafe`, `cover` (a `spatial.pickPlace` over `candidates` round the enemy, `cover(you)` by `segmentClear`, `nearTo` the player's range), `flank` (the other side of him from his last shot), `search` (the belief's guess, then a sweep), `fire` (the token claimed only with the line clear and released on a miss); the sim seeded; `scene.js:484` through `bodyFrom` with the actor's body (`rig.js`'s `figure` gaining `locomote` from the animator, as living-characters W4 planned); tests for belief loss, the guess, cover picked behind a solid, a token released on a blocked shot, and the token cap; a `cybertron-check.mjs` in headless Chromium through `__CY__`.
- **M4, the pipeline check**: `rigCheck.js`, `scripts/rig-check.mjs` and its test over the committed rigs; `retarget` by role; `NAMES` and `MESHY_MASKS` from `ROLES`; `hipsOf` as the one hips reading in `clipLibrary`, `meshyCast`, `footScene`, `crew.js` and `rv.js`. The orphan troopers in `public/models/galaxy/troops/` are reported by the script and left for the living-characters session's catalog switch.
- **M5, Mario and the watchers' bodies**: Bob-ombs on the Goombas' `spot` (`foes.js`); the Middle-earth town scenes' `moving` sets gaining `suspicious` and `search` and the watchers' search seeded (the towns' scenes, not their cast: the cast is the living-characters session's).
- **M6, docs**: `docs/architecture.md`'s `lib/ai` and `lib/three` lines, `HANDOFF-npc-intelligence.md`'s Done and Left, the backlog.

Optional, after, each its own PR: the four fixed-step loops onto `fixedStep.js` (a safe refactor with their tests); `search.flood` under Bree's lanes; `influence` under the Battlefront; `createTokens`' `scale` from the tier (with the quality branch's rows); the talk experiment (PR #371's Talk 1, with the research's contract: schema-constrained `{ say, mood, action }`, validated by the game, a 800 ms timeout to the baked line, player text treated as untrusted); the surface's `?` HUD mark when W2 lands.

## Risks

- **Two sessions, one animator.** The living-characters session is changing the showcase worlds now and will change `rig.js`'s `figure` in W4. M3 touches `figure` only to add `locomote`; M4 touches `clipLibrary`, `locomotion`, `animator` for names and hips only. Both are told, and both PRs merge `origin/claude/living-npcs` before `main`.
- **A budget that defers the wrong agent.** The significance default is distance; a world whose drama is far away (the director's events) scores it itself. Deferral never pauses the actor, so a running action always ends on time.
- **A seeded stream that changes a feel.** A brain that used `Math.random` ten times a frame used ten draws; a seeded stream gives the same ten. The scenario tests (`brains/*.scenario.test.js`) run on the fixed seeds and prove nothing moved.
- **The check finds rigs that are wrong today.** It will: the audit expects the Mixamo and High Moon figures to fail `checkRig`. The test lists known exceptions by path with the reason, and the exception list shrinks as they are fixed.

## Done when

- `src/lib/ai/{action,schedule,trace,inspect}.js`, `src/lib/sim/fixedStep.js`, `src/lib/three/rigCheck.js` and `scripts/rig-check.mjs` exist with tests; `lib/seeded` has `streams`.
- The universe map and Cybertron run their brains on the schedule, seeded, traced, inspectable with `?ai=1`, and Cybertron's Decepticons take cover and flank through actors; `universe-npc-check.mjs` and `cybertron-check.mjs` are green and print the AI's cost.
- `scripts/rig-check.test.mjs` passes over every committed rig and clip, and a figure of any of `ROLES`' families gets locomotion and layers.
- `HANDOFF-npc-intelligence.md` names this design, what landed, and the optional list.
