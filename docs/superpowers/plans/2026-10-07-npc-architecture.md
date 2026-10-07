# NPC architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put an action lifecycle, a budgeted fixed-rate clock, a seed and a decision trace under the site's NPC brains, wire them into the universe map and Cybertron, and check every committed rig, without touching the worlds other sessions have open.

**Architecture:** New pure modules in `src/lib/ai/` (`action`, `schedule`, `trace`, `inspect`), `src/lib/sim/fixedStep.js`, `src/lib/three/rigCheck.js` and `lib/seeded`'s `streams`, each tested in Node with no three.js and no `Math.random`. Worlds adopt them where they already build their brains (`universe/npcs.js`, `universe/hunters.js`, `cybertron/game/sim.js`), never in a scene file another PR owns. The body side is the living-characters layer (`lib/ai/body.js`, `lib/three/animator.js`), already on this branch.

**Tech Stack:** three.js r186 (AnimationMixer through `animator.js`), vitest, `@gltf-transform/core` (dev) for the rig check, Playwright's Chromium for the check scripts.

**Spec:** `docs/superpowers/specs/2026-10-07-npc-architecture-design.md`

## Global Constraints

- `src/lib/ai/*` and `src/lib/sim/*` import no three.js and never call `Math.random` or `Date.now`; a `rand` and a `now` are passed in.
- Rules seeded, drawing free: a scene's sparks and sway may keep `Math.random`; a `rules.js`, a brain or anything under `lib/ai` may not.
- No file under `src/components/rickmorty/`, `src/components/galaxy/surface/`, `src/components/invincible/`, `src/components/universe/scene.js`, `src/components/universe/{layout,nav,ship,ride,hyperlanes}.js`, `src/lib/device.js`, `src/lib/budgets.js`, `src/runtime/quality.js` is edited (other sessions' lanes).
- `src/lib/three/{animator,locomotion,clipLibrary}.js` change only where Task 11 says (names from `ROLES`, hips by `hipsOf`, `retarget` by role); their public shapes stay.
- Budgets: the brains together 0.5 ms a frame on `low`, 1.0 on `mid`, 2.0 on `high`; sense 20 Hz, think 10 Hz, ambient 4 Hz.
- British spelling, curly quotes, plain sentences; comments say why. Commit messages one plain sentence, body says why, ending with the attribution trailers the session gives.
- Every task: `npx vitest run <the files>` green before its commit; before every push `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green. Never skip or quieten a test.

## Review Focus

- An action whose `start` throws: expect the actor to end it `'failed'`, run `recover` if named, note the error once in the trace, and keep stepping the agent. (Task 1.)
- A tab hidden for a minute then shown: expect the scheduler to run each agent at most `max` catch-up steps with `dt` clamped, never a minute of thinking in one frame. (Task 2, Task 3.)
- Sixty agents on `mid` with a 1.0 ms budget where each think costs 0.1 ms: expect the frame to think about ten, defer the rest in rank order, and `stats.skipped` to say so; the deferred agents think first next frame. (Task 3.)
- The same seed twice through the universe's brains, hunters and director for 30 simulated seconds: expect identical event logs. (Task 7.)
- A rigged GLB whose root bone is `mixamorig:Hips`: expect `retarget` to keep and scale its translation track and `checkClip` to resolve it, not drop it silently. (Task 11.)

---

### Task 1: `lib/ai/action.js`, the actor

**Files:**
- Create: `src/lib/ai/action.js`, `src/lib/ai/action.test.js`
- Modify: `src/lib/ai/index.js` (export `action`)

**Interfaces:**
- Produces:
  - `createActor({ actions, id, trace = null, now = () => 0 })` → `{ want(id, ctx) → 'started' | string, cut(why = 'cut'), step(ctx, dt) → { id: string | null, phase: 'idle' | 'running' | 'ending', body: object | null }, current() → id | null, since() → seconds }`
  - `Action` shape: `{ can?(ctx) → null | string, start?(ctx) → state, step?(state, ctx, dt) → 'running' | 'done' | 'failed', end?(state, ctx, why), priority = 0, cutBy = 'any' | 'higher' | 'none', replaces = false, body?: object | ((state, ctx) → object), recover?: string, cooldown = 0 }`
  - `clipAction(name, { layer = 'full', hold = false, priority = 0 })` → `Action` whose `start(ctx)` calls `ctx.body.play(name, { layer, hold })` and keeps the promise; `step` returns `'running'` until it resolves (`'done'` → `'done'`, `'cut'` → `'failed'`); `end(…, 'cut' | 'replaced')` calls `ctx.body.stop(layer)`.
  - `goTo(point, { reach = 1, stuck = 2 })` → `Action` whose `step` writes `ctx.me.to = point`, is `'done'` within `reach` of it and `'failed'` after `stuck` seconds without moving `0.05` (reads `ctx.me.pos`).
  - `fromReaction(reaction, { priority })` → `Action` (a `clipAction` with the reaction's `clip`, `layer`, `hold`, and `look` passed to `ctx.body.look` on start, cleared on end).
  - `REACTIONS_PRIORITY = { down: 9, caught: 5, hit: 2, gunfire: 2, fire: 1, alert: 1, win: 0, greet: 0, say: 0 }`.

- [ ] **Step 1: Write the failing tests** (`action.test.js`, a fake `ctx.body` whose `play` returns a promise the test resolves):
  - `want starts an action whose can is null, and refuses with the reason when it is not` (`can: () => 'no target'` → `want` returns `'no target'`, `current()` null).
  - `a higher priority cuts a running action and end hears cut` (`end` spy gets `'cut'`; the new one is current).
  - `cutBy none holds against a higher priority` (`want` returns `'uncuttable'`).
  - `an equal priority replaces only when replaces is true` (false → `'busy'`).
  - `a failed step runs recover` (`step` returns `'failed'` → `current()` is the `recover` id next step).
  - `a cooldown refuses a restart until it has passed` (`cooldown: 1`, `step(ctx, 0.5)` → `'cooling'`, `step(ctx, 0.6)` → `'started'`).
  - `a throw in start ends the action failed and does not throw out` (`current()` null, `trace.note` called once with `why: 'error'`).
  - `clipAction is running until its play resolves done` and `cut resolves it failed`.
  - `goTo is done within reach and failed when stuck` (two steps with the same `pos` past `stuck`).
  - `step returns the running action's body` (`body: { base: 'crouch' }` → `step().body.base === 'crouch'`; idle → `null`).
- [ ] **Step 2: Run** `npx vitest run src/lib/ai/action.test.js` → fails (module missing).
- [ ] **Step 3: Implement** `action.js` as the Interfaces say. `want`'s order: `cooldown` → `can` → cut rule (`'uncuttable'` | `'busy'`) → `end(old, 'replaced' or 'cut')` → `start(new)` inside try/catch → note. `step` ticks the running action inside try/catch; `'done'` → `end(…, 'done')`, remember `endedAt` for the cooldown; `'failed'` → `end(…, 'failed')` then `want(recover)` when named.
- [ ] **Step 4: Run** the file → pass; `npx vitest run src/lib/ai` → no regressions.
- [ ] **Step 5: Commit** `"An actor for every brain: actions with prerequisites, a cut rule, a recovery and a body"`.

### Task 2: `lib/sim/fixedStep.js` and `lib/seeded`'s streams

**Files:**
- Create: `src/lib/sim/fixedStep.js`, `src/lib/sim/fixedStep.test.js`
- Modify: `src/lib/seeded.js` (add `streams`, `hash`), `src/lib/seeded.test.js` (create if absent)

**Interfaces:**
- Produces:
  - `createFixedStep({ hz = 30, max = 4 })` → `{ step(dt, fn) → n, alpha() → 0..1, reset() }`; `fn(stepDt)` is called `n` times with `stepDt = 1 / hz`; the accumulator never exceeds `max / hz` after a step.
  - `hash(seed, label)` → 32-bit int (FNV-1a over the label's chars folded with the seed); `streams(seed)` → `{ fork(label) → rand, seed }` where `fork` returns `seeded(hash(seed, label))`, the same function for the same label twice.

- [ ] **Step 1: Failing tests**:
  - `step runs the fixed step as many times as the time holds` (`hz 10`, `step(0.25)` → 2, `alpha()` 0.5).
  - `a long frame runs at most max steps and drops the rest` (`step(10)` → 4; the next `step(0)` → 0).
  - `reset empties the accumulator`.
  - `fork gives the same stream for the same label, a different one for another` (first three draws equal / differ).
  - `hash is stable` (`hash(7, 'npc:vader')` equals a pinned number computed once).
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/lib/sim src/lib/seeded.test.js` → pass.
- [ ] **Step 5: Commit** `"A fixed step with a clamp, and a seeded stream per name"`.

### Task 3: `lib/ai/schedule.js`, the brains' budget

**Files:**
- Create: `src/lib/ai/schedule.js`, `src/lib/ai/schedule.test.js`
- Modify: `src/lib/ai/index.js` (export `schedule`)

**Interfaces:**
- Consumes: `streams` (Task 2) for the per-agent phase.
- Produces: `createSchedule({ rates = { sense: 20, think: 10, ambient: 4 }, budget = { ms: 1 }, significance = byDistance, tiers = [1, 0.5, 0.25, 0], rank = { every: 0.5, slices: [0.25, 0.5, 0.25] }, seed = 1, now = null })` → `{ add(agent, { lane = 'think', sense = true, id }), drop(agent), frame(dt, view, t) → { due: [{ agent, sense: bool, think: bool, dt }], stats }, done(agent), stats() → { agents, sensed, thought, ms, skipped, worst: { id, ms } | null } }`. `view` is `{ at: { x, y, z }, dir?: { x, y, z }, range }`; `byDistance(agent, view)` → `1 − min(1, dist / view.range)`. `agent` must carry `pos` (`{ x, y, z }`) and `id`.

- [ ] **Step 1: Failing tests** (agents as `{ id, pos }`, `now` a fake clock the test advances inside `done`):
  - `an agent thinks at its lane's rate, with the fixed dt, however the frames fall` (frames of 0.016 for 1 s → `think` true about 10 times, each `dt` 0.1 ± 1e-9).
  - `sense runs at 20 Hz and think at 10 Hz for the same agent`.
  - `a paused agent accrues nothing and thinks once, dt clamped, when it ranks again` (the far agent moved near → next frame one `think` with `dt` 0.1).
  - `ranks spread the rate by tier` (four agents at distances 1, 10, 50, 1000 of range 100 → think counts over 2 s about 20, 10, 5, 0).
  - `a crowd's phases are spread, not in step` (20 agents, same distance → no frame has more than 4 thinking).
  - `the budget defers in rank order and counts the deferrals` (each `done` costs 0.1 ms, budget 1.0, 60 due → first frame thinks ≤ 11, `stats.skipped` ≥ 49; the deferred think first next frame).
  - `stats names the worst agent`.
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement.** Per agent: `{ acc: { sense, think }, phase, tier, sig }`. `frame`: every `rank.every` seconds recompute `sig` for all, sort, assign tiers by the `slices` cumulative fractions; for each agent add `dt × tiers[tier]` to the lane accumulators; due when `acc ≥ 1 / rate` (clamped to one step on return from tier 3); order the due list by `sig` descending, then by `phase`; cut the list where the previous frame's measured ms would pass `budget.ms` (an estimate: last cost per agent, default 0.05 ms), marking the rest `skipped`. `done(agent)` closes the timing `now()` opened when the entry was handed out.
- [ ] **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `"A schedule for the brains: rates by how much you'd notice, a millisecond budget, phases spread"`.

### Task 4: `lib/ai/trace.js` and `lib/ai/inspect.js`

**Files:**
- Create: `src/lib/ai/trace.js`, `src/lib/ai/trace.test.js`, `src/lib/ai/inspect.js`, `src/lib/ai/inspect.test.js`
- Modify: `src/lib/ai/index.js`

**Interfaces:**
- Produces:
  - `createTrace({ size = 600 })` → `{ note(id, t, record), last(id) → record | null, history(id, n = 20) → record[] (newest last), agents() → id[], clear(id?), export() → { size, agents: { [id]: record[] } } }`; a record is any plain object; `t` is stored on it.
  - `inspect.js`: `register(worldId, { trace, schedule, actors = new Map(), agents = () => [] })`, `unregister(worldId)`, `current() → { worldId, … } | null`, `onChange(fn) → off`, `flags()` → `{ ai: bool, seed: number | null }` read once from `location.search` (`?ai=1`, `?seed=N`) and `localStorage 'tp-ai'`; safe where `window` is absent.

- [ ] **Step 1: Failing tests**: `the ring keeps the last size records per agent`; `history returns newest last`; `export is plain JSON` (round-trips through `JSON.parse`); `register replaces and notifies, unregister clears`; `flags reads ?ai and ?seed from a given search string` (`flags({ search: '?ai=1&seed=42' })`).
- [ ] **Step 2: Run** → fails. **Step 3: Implement.** **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `"A trace of every decision, and a registry the inspector reads"`.

### Task 5: `components/debug/AiInspector.jsx`

**Files:**
- Create: `src/components/debug/AiInspector.jsx`, `src/components/debug/aiInspector.css`, `src/components/debug/aiInspector.js` (pure formatting: `rows(stats, agents)`, `bars(scores)`), `src/components/debug/aiInspector.test.js`
- Modify: `src/App.jsx` (one line: `{(import.meta.env.DEV || flags().ai) && <AiInspector />}` beside `Ambience`, lazily imported)

**Interfaces:**
- Consumes: `inspect.current()`, `onChange`, `flags()`; `schedule.stats()`; `trace.history(id)`.
- Produces: `rows(stats, agents)` → `[{ id, kind, mode, action, phase, sig }]` sorted by `sig`; `bars(scores)` → `[{ id, w: 0..1 }]` normalised to the best.

- [ ] **Step 1: Failing tests** for `rows` (sorted by significance, mode and phase from the actor) and `bars` (the best is 1, the rest proportional, zero when all zero).
- [ ] **Step 2: Run** → fails. **Step 3: Implement** the pure file, then the panel: a fixed box bottom-left (`position: fixed; z-index: 60; font: 12px monospace; max-height: 50vh; overflow: auto`), hidden unless `flags().ai`; refreshes `stats` four times a second (`setInterval`, cleared on unmount), the agent list on click, the picked agent's last twenty records with score bars and a range input scrubbing the index. `aria-label="AI inspector"`, `role="region"`.
- [ ] **Step 4: Run** the test → pass; `npm run build` → green.
- [ ] **Step 5: Commit** `"An inspector over every head: the schedule's cost, each agent's mode, action and the scores it weighed"`.

### Task 6: the universe's brains and hunters on the schedule, seeded, traced

**Files:**
- Modify: `src/components/universe/npcs.js:21-73` (`createNpcs` takes `{ rand, schedule, trace }`; `update` asks `schedule.frame` for the due brains and passes `{ due }` to `brains.update`), `src/components/universe/npcRules.js:110-160` (`createBrains({ rand, trace })`; `update(dt, world, { due = null })`: a brain not in `due` keeps its last intent and integrates only; a due one senses with the entry's `dt` and thinks; `pick`'s `scores`, the mode and the belief go to `trace.note(me.id, world.t, …)`), `src/components/universe/hunters.js:56-131` (`createHunters` takes `{ rand, schedule, trace }`, passes `rand` to `createHunt` and the due list to `hunt.update(dt, ship, { due })`), `src/components/universe/hunterRules.js:344, 629` (`update(dt, ship, { due })`: a hunter not due keeps its last steer; `sense` runs for the due with their `dt`), `src/components/universe/wingmen.js:21` (`createWing({ rand, solids })`), `src/components/universe/director.js` (unchanged; the caller passes `rand`)
- Test: `src/components/universe/npcRules.test.js`, `hunterRules.test.js`, `npcs.test.js`

**Interfaces:**
- Consumes: `createSchedule`, `createTrace`, `streams`.
- Produces: `createNpcs(parent, { fleet, rand, memory, schedule, trace })`, `createHunters(parent, { …, rand, schedule, trace })`; `brains.update(dt, world, { due })` and `hunt.update(dt, ship, { due })` where `due` is a `Set` of agent ids or `null` (all, as today).

- [ ] **Step 1: Failing tests**:
  - `npcRules`: `a brain not due keeps its intent and still moves` (two updates, the second with `due: new Set()` → position changed along the kept intent, `pick` not called: spy on the trace's note count); `a due brain notes its scores and mode` (`trace.last(id).scores` has the nemesis's option ids).
  - `hunterRules`: `a hunter not due keeps its steer`; `createHunt with a seeded rand is reproducible` (two hunts, same seed, 200 steps → identical member positions).
  - `npcs`: `createNpcs passes the schedule's due set through` (a fake schedule returning one id → only that brain's `trace.note` fires).
- [ ] **Step 2: Run** → fails. **Step 3: Implement** as the Files say. The scene's existing calls (`scene.js:3141, 3186, 3444`) are not edited: `npcs.js` and `hunters.js` make their own `createSchedule({ significance: byDistance, seed })` when none is given and take the ship's position from `world.you` / `ship` as the view. `trace` and the schedule are registered with `inspect.register('universe', …)` from `npcs.js` (DEV or `flags().ai`), unregistered in `dispose`.
- [ ] **Step 4: Run** `npx vitest run src/components/universe` → pass (including every `brains/*.scenario.test.js` under `npm run test:ai`).
- [ ] **Step 5: Commit** `"The universe's characters and hunters think on the schedule, from the visit's seed, and say why"`.

### Task 7: the universe seeded end to end, and backlog 41's fire cone

**Files:**
- Modify: `src/components/universe/scene.js` is **not** edited. Instead: `src/components/universe/npcs.js`, `hunters.js`, `wingmen.js` default their `rand` to `streams(seedOf()).fork('npcs' | 'hunters' | 'wing')` where `seedOf()` (new, `src/components/universe/seed.js`) reads `flags().seed`, else the visit's seed from `sessionStorage 'tp-visit-seed'` (made once, `Date.now() | 0`). The director and spawns in `scene.js` stay on `Math.random` until PR #551 lands; the handoff names them.
- Modify: `src/components/universe/npcRules.js` (`NPC.cone = 0.5`: a shot only when `dot(me.dir, toTarget) ≥ cone`, the backlog's 171° fix)
- Test: `src/components/universe/seed.test.js` (new), `npcRules.test.js`, `brains/nemesis.scenario.test.js`

- [ ] **Step 1: Failing tests**: `seedOf reads ?seed first, then the visit's, which it keeps`; `a brain fires only inside its forward cone` (target abeam → no `shot` event; ahead → one); the nemesis scenario asserts its first shot comes after it has turned onto you.
- [ ] **Step 2: Run** → fails. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/components/universe` and `npm run test:ai` → pass.
- [ ] **Step 5: Commit** `"The universe's NPCs fire from the nose, and run from one seed a visit"`.

### Task 8: `universe-npc-check.mjs` prints the cost and keeps the trace

**Files:**
- Modify: `scripts/universe-npc-check.mjs` (set `?ai=1&seed=4121` on the URL; after the pack check read `window.__universeDebug.ai.stats()` and print `ai: { ms, thought, skipped, worst }`; on any problem write `lab/ai-trace-<time>.json` from `__universeDebug.ai.trace.export()`; fail if `ms > 2.0`), `src/components/universe/npcs.js` (expose `{ schedule, trace }` as `ai` on the debug object it already feeds)

- [ ] **Step 1:** Run `node scripts/universe-npc-check.mjs xwing high` before the change for the baseline (software WebGL: slow; note the sim seconds).
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** it again → `everything green`, the `ai:` line printed. Paste both runs' lines in the commit body.
- [ ] **Step 4: Commit** `"The universe's NPC check prints what the brains cost and keeps the trace when it fails"`.

### Task 9: Cybertron's Decepticons on actors: cover, flank, search, a clean shot

**Files:**
- Create: `src/components/cybertron/game/tactics.js`, `src/components/cybertron/game/tactics.test.js`
- Modify: `src/components/cybertron/game/rules.js:582-690` (`stepEnemies(enemies, player, dt, world, rand, tokens, { trace } = {})`: the per-enemy block after `sense` becomes `tactics.step(e, b, player, dt, world, rand, tokens, trace)`), `src/components/cybertron/game/sim.js:28` (`createSim({ …, rand = null, seed = 1 })` → `rand ?? streams(seed).fork('sim')`; a `trace` on the sim), `src/components/cybertron/game/GameWorld.jsx:70` (pass `seed: flags().seed ?? visit seed`, register with `inspect` beside `__CY__`)
- Test: `rules.test.js`, `sim.test.js`

**Interfaces:**
- Consumes: `createActor`, `goTo`, `spatial.candidates/pickPlace/cover/nearTo/awayFrom`, `utility.pick`, `createTokens` (`tokens.claim/release/count`), `segmentClear`.
- Produces: `tactics.js`: `ACTIONS = { hold, advance, strafe, cover, flank, search, fire }` (each an `Action`), `OPTIONS` (utility options over the modes with considerations on distance, `b.visible`, `e.hp / k.hp`, `tokens.count('shot') < 3`), `step(e, b, player, dt, world, rand, tokens, trace)` which picks every `RETHINK = 0.4` s, calls `e.actor.want`, steps the actor and writes `e.state` from `actor.current()` and `e.body` from the step's `body`.

- [ ] **Step 1: Failing tests** (`tactics.test.js`, a world from `buildWorld` with one solid between enemy and player):
  - `with no belief it holds and scans` (`e.state === 'hold'`, yaw changes).
  - `hurt below half with cover near, it takes cover behind the solid` (`state 'cover'`, the chosen point fails `segmentClear` to the player).
  - `sure and in range with a free token it fires once the line is clear`.
  - `a blocked line releases the token` (`tokens.count('shot')` is 0 after the step).
  - `the token cap holds across five enemies` (at most 3 `enemyFire` events a step).
  - `a lost belief searches at the guess, then holds` (after `memory` seconds, `state 'hold'`).
  - `flank goes to the player's other side` (the chosen point's dot with the player's facing is negative).
  - `rules.test.js`: `stepEnemies with the same seed is reproducible` (two sims, 300 steps, identical positions).
- [ ] **Step 2: Run** → fails. **Step 3: Implement.** `cover` is `goTo(pickPlace(candidates(e, { ring: 14, n: 12, walkable: inside bounds }), [cover([player], seesThrough), nearTo(player, k.range)], { current: e.cover, hysteresis: 0.15 }))` with `body: { base: 'crouch', rise: true }`, `recover: 'hold'`; `fire`'s `can` is the line clear and a token (`claim` only after `segmentClear`, `release` in `end` when no shot was pushed); `search` is `goTo(b.at)` then a 2 s scan.
- [ ] **Step 4: Run** `npx vitest run src/components/cybertron` → pass (33 + 10 + fuzz still green).
- [ ] **Step 5: Commit** `"The Decepticons take cover, flank and search through actors, and fire only down a clear line"`.

### Task 10: Cybertron's bodies through `bodyFrom`, and a check script

**Files:**
- Modify: `src/components/cybertron/game/scene.js:451-486` (per enemy keep `entry.prev = { x, z, yaw, mode }`; `const b = bodyFrom(entry.prev, { x: e.x, z: e.z, yaw: e.yaw, mode: e.state, aim: player, ...(e.body ?? {}) }, dt, { table: MODE_BODY_CY })`; `f.play` by `b.base ?? (b.motion.speed > 0.2 ? 'walk' : 'idle')` with `speed` from `b.motion.speed`; `f.look?.(b.look)`), `src/components/cybertron/game/bots.js:343-380` (`makeFigure` returns `look(point)` when the figure has a head role via `rig.js`'s `ROLES`, else a no-op)
- Create: `src/components/cybertron/game/bodies.js` (`MODE_BODY_CY = { ...MODE_BODY, advance: { look: 'aim' }, charge: {}, shift: {} }`), `scripts/cybertron-check.mjs` (headless Chromium on the dev server, `#/cybertron/game?ai=1&seed=7`; through `__CY__` spawn a wave, run 20 sim seconds, assert: some enemy reached `cover`, the shot events never exceed 3 in a step, `ai.stats().ms ≤ 2`, no console errors; prints the stats line)
- Test: `src/components/cybertron/game/bodies.test.js` (`MODE_BODY_CY` has a row for every `ACTIONS` id and every `e.state` the rules write).

- [ ] **Step 1: Failing test** → **Step 2: Run** → fails. **Step 3: Implement.** **Step 4: Run** the test; `node scripts/cybertron-check.mjs` → green, stats printed; `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /cybertron` → draws, no errors. A screenshot of a Decepticon crouched behind a solid to `docs/superpowers/shots/2026-10-07-cybertron-cover.webp`.
- [ ] **Step 5: Commit** `"Cybertron's Decepticons are drawn by what they do, and a check watches them fight"`.

### Task 11: the rig check, and one family-aware animation layer

**Files:**
- Create: `src/lib/three/rigCheck.js`, `src/lib/three/rigCheck.test.js`, `scripts/rig-check.mjs`, `scripts/rig-check.test.mjs`
- Modify: `src/lib/three/rig.js` (export `plain`, `familyOf(names)`), `src/lib/three/clipLibrary.js:184-205` (`retarget(clip, hipsY, from)` scales the translation track of the bone `ROLES.hips` resolves to, any family; `hipsOf` used by `take()`), `src/lib/three/locomotion.js:99-103` (`NAMES`/`LEGS` from `rolesFor(family)`), `src/lib/three/animator.js:67-92` (`masksFor(family)` from `ROLES`; `plain` imported from `rig.js`), `src/components/rickmorty/portal/meshyCast.js:36`, `src/components/universe/footScene.js:272`, `src/components/cockpit/crew.js:83`, `src/components/cockpit/vehicles/rv.js:120` (hips through `hipsOf`; `footScene` passes `from: clips.idle.userData.hips`)

**Interfaces:**
- Produces: `checkRig(boneNames) → { family, roles, toes, missing }`, `checkClip(trackNames, boneNames) → { resolved, unresolved, root }`, `hipsOf(clip, hipsNode) → number` (`clip.userData.hips ?? extras.hips ?? node.position.y`), `rolesFor(family) → { [role]: name }`, `masksFor(family) → { upper: string[], lower: string[] }`. `scripts/rig-check.mjs [--check] [paths…]` prints one row per file and exits 1 under `--check` on a missing role or an unresolved track, except paths listed in `scripts/rig-check.allow.json` with a reason.

- [ ] **Step 1: Failing tests**: `checkRig names the Meshy family and finds toes` (the fixture's `MESHY_BONES`); `checkRig names Mixamo and the missing roles`; `checkClip reports a track whose bone the figure lacks`; `retarget scales a mixamorig:Hips translation`; `masksFor('mixamo') lists mixamorig arms in upper`; `rig-check.test.mjs`: `every committed rig and clip passes --check` over the four globs in the spec, allow-list applied.
- [ ] **Step 2: Run** → fails. **Step 3: Implement.** Run the script once without `--check` and put the failing files in the allow list with their reason (expected: the High Moon and Sketchfab figures lacking toes).
- [ ] **Step 4: Run** `npx vitest run src/lib/three scripts/rig-check.test.mjs src/components/rickmorty/portal src/components/universe/locomotion.test.js` → pass.
- [ ] **Step 5: Commit** `"A check on every rig and clip, and an animation layer that knows every bone family"`.

### Task 12: Bob-ombs see, and the towns' watchers are drawn searching

**Files:**
- Modify: `src/components/mario64/rules/actors/foes.js:155-175` (`bobomb.step` uses `spot(a, g, 500)`: lit on `sure`, walks to the guess when not, back to `walk` when the belief is gone), `src/components/middleearth/towns/bree/scene.js:592`, `amonhen/scene.js` (the watcher animate call), `marshes/scene.js:719`, `moria/scene.js:671` (`moving` includes `'search'`; `'suspicious'` is still, `look: 1`), `src/components/middleearth/towns/watchers.js:107` (`createSearch({ rand })` from `newWatchers`' `rand`, default `seeded(11)`)
- Test: `foes.test.js` (`a Bob-omb lights only when it sees Mario, and goes to where it last saw him`), `watchers.test.js` (`the search is seeded: two towns with one seed search the same spots`)

- [ ] **Step 1: Failing tests** → **Step 2: Run** → fails. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/components/mario64 src/components/middleearth` → pass; `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /dot-matrix/64,/middle-earth/bree` → draws.
- [ ] **Step 5: Commit** `"Bob-ombs light when they see Mario, and a searching watcher walks"`.

### Task 13: the docs, the handoff, the gate

**Files:**
- Modify: `docs/architecture.md` (the `lib/ai` line gains `action`, `schedule`, `trace`, `inspect`; `lib/three` gains `rigCheck`; a line for `lib/sim/fixedStep` and one for the inspector under Tests), `docs/superpowers/HANDOFF-npc-intelligence.md` (Done: this design's PR; Left: the optional list from the spec, with where each goes; Checking it: `?ai=1`, `?seed=`, `scripts/cybertron-check.mjs`, `scripts/rig-check.mjs`), `docs/autopilot/backlog.md` (tick item 41; add the four fixed-step loops, the director's and spawns' seed after PR #551, the surface `?` mark after W2)

- [ ] **Step 1: Write** them. **Step 2: Run** the full gate: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /,/cybertron,/dot-matrix/64,/middle-earth/bree,/galaxy/tatooine` → all green.
- [ ] **Step 3: Commit** `"Docs: the actor, the schedule, the trace and the rig check, and what is left"`.
