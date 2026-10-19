# The Rick and Morty adventure, P4: Heat

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Episode 5, *Heat*, is built and played: the cruiser shakes the Federation ship by flying through six rings over the street under its laser (the new `chase` kind), the `fly` task ticks on the first chase won instead of the first take-off, and the Gromflomite base (already a stealth game from the existing keys) closes the episode.

**Architecture:** `chase` is a pure, import-free rule (`world/games/chase.js`) stepped in RmWorld's tick right after the street fight, since the street isn't a dial place and `place()` and `dimensions/stage.js` only carry destinations (a departure from spec §5's "taken by `place()`", named here). Its hits are the patrol's real laser: at the first ring the chase turns the street fight's patrol on the cruiser through a new `chase(on, now)` on the fight, and counts the fight's `hurt` events. The rings are glow markers built by `street.js` (`world/chaseRings.js`), in its `noInk` at build time and see-through so the ground bake skips them. The meter is a second `Vitals` inside the cruiser's cluster, written through refs.

**Tech Stack:** React 19, three.js, Vitest (node), Playwright-core on SwiftShader.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md` §4 (episode 5: `win chase` ↑ · `task gromflomites`), §5 (the cruiser row: "shake the Federation ship: through rings over the neighbourhood, a hit meter, the ship on your tail"; "every game has a goal, a way to fail with a quick retry, and a win"), §8 ("the cruiser when its first `chase` is won (the `fly` task's hint says so)"). Index: P4. What landed before: P0 #1089, P1 #1097, P2 #1099, P3 #1109 (`66b003f`).

## Global Constraints

- `READY` is 5 at the end; episode 5's data in `episodes.js` stays as written (its "without a guard seeing you" is the house idiom the prison and the agency use too: being seen starts a hunt).
- `RmWorld.jsx` gets call sites only (2,279 lines, in big-files 28/30); no new `requestAnimationFrame` (loops 57/58); no `eslint-disable` (54/54); no key-cap CSS (kbd-styles 68/70); no file past 800 lines (`guide/pages.js` is 787: one line more at most).
- No new models: the rings are glow markers like the door rings (`fx.js`) and the patrol's searchlight, not props.
- The HUD's meter is the kit's (`runtime/hud`: `Vitals`, `createFlightCluster`), its numbers written through refs.
- The kind takes `perks` and reads none (Schmeckles waits); no earn deed; `economy.js`, `earn.js` untouched.
- Copy: British, curly quotes, no `!`, no Oxford comma, one sentence a toast; the cruiser's lines in its own manner (polite, literal, quietly menacing).
- Every moved test assertion as strict, a sentence each in its commit.

## Review Focus

1. **A returner, or a visitor before episode 5, flies through the rings**: the chase runs whenever Morty flies in C-137 (Free roam sits at episode 0), `fly` ticks on the first win, and the win is kept for the story's step when it comes (story.js keeps wins). Pinned in Task 1 ('keeps a chase won early') and Task 5's scenario (`fly` not done by a take-off).
2. **The patrol already shot down when Morty reaches the first ring**: no run starts and a word says the next one is a minute off; mid-run the patrol can't be downed (hits flash, nothing taken), so a heavy round isn't a two-second shortcut. Pinned in Task 2 (`wait`) and Task 3 (a held patrol takes no damage).
3. **Landing, warp, goto or the engines cut mid-run**: landing or a jump quietly ends the run (no word, the patrol calmed); grounded at no deflectors is a loss with the quick retry. Pinned in Task 2 (`off` and `lost` on `grounded`, a jump isn't a pass).
4. **The run lost**: one reset (a fade, the cruiser hovering before the first ring facing it, the patrol calmed, its bolts cleared), never a task undone and never two losses at once. Pinned in Task 2 (`lost` once, then idle) and Task 5's scenario.
5. **The patrol after a win**: it goes back round its loop for a rest (`shaken`) instead of re-tailing at once, and the cruiser says so. Pinned in Task 2 (`shaken` for `rest` seconds after `won`) and Task 5's scenario.

---

### Task 1: The story at READY 5

**Files:** Modify `src/components/rickmorty/adventure/episodes.js` (`READY = 5`). Test: the adventure's `episodes`, `story`, `hud`, `adventure`, `StoryList`, `EpisodeCard` tests.

**Interfaces:** Produces `READY === 5`; no API change.

- [ ] **Step 1: Move the tests to the new frontier** with `scratchpad/p4research/fix.py` (each substitution asserts its old text occurs exactly once): `READY` 5; 'goes on with Heat' (step ids `['chase', 'gromflomites']`, the chase step with no place, unlocks `['needful', 'vat', 'nimbus']`); the real story walks episode 5 (anatomy now says `[{ done: 3 }, { episode: 4 }]`, the chase win is `{ step: 4, 1 }`, the base ends it with no card); a chase won early is kept and episode 5 opens at the base; the dial after episode 4 opens 10 of 32 and needful, vat and nimbus read 'Opens after episode 5, “Heat”.'; `markedTask` at 4.0 is `{ id: 'chase' }`; `jump(4)`, `jump(5)`, `intro()` for a P3 finisher → 4; StoryList's five ticks and a chase won ahead; 'names episode 5 too'.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure` — Expected: FAIL (9 tests, on READY 4).
- [ ] **Step 3:** `export const READY = 5;`
- [ ] **Step 4: Run** the same — Expected: PASS (72).
- [ ] **Step 5: Commit** — "The adventure at READY 5: episode 5 is built", naming each moved assertion.

### Task 2: The chase kind's rules

**Files:** Create `src/components/rickmorty/world/games/chase.js`, `src/components/rickmorty/world/games/chase.test.js`.

**Interfaces:**
- Produces (chase.js imports nothing, so the browser check can import it in plain Node):
  - `TUNING = Object.freeze({ hits: 3, r: 5, jump: 6, rest: 10 })` — hits that lose a run; a ring's radius (m); a move longer than `jump` in one step is not a pass; seconds the patrol keeps off after a win.
  - `COURSE` (frozen; `yaw` the way through, the cruiser's nose `(sin yaw, cos yaw)`; E = π/2): `(-5, 9, 0) E`, `(46, 15, -20) E`, `(118, 18, 0) 0`, `(40, 22, 42) -E`, `(-7, 32, 44) -E`, `(-62, 12, 0) -E`.
  - `newChase({ rings = COURSE, hits = TUNING.hits, perks } = {}) → { phase: 'idle', rings, max: hits, next: 0, hits: 0, t: 0, rest: 0, at: null, events: [] }` — `perks` taken, none read.
  - `stepChase(prev, { at, flying, hit = 0, down = false, grounded = false } = {}, dt = 1/60) → next` — `at` the cruiser's `{ x, y, z }`; `hit` the patrol's hits on it this step. A pass is the segment from the last `at` to this one crossing the next ring's plane inside `r`, either way, and no longer than `jump`. `won`/`lost` step to `idle` (next 0, hits 0, t 0: the quick retry). `rest` counts down by `dt`. Not `flying` (or no `at`): a run goes `idle` with `{ type: 'off' }`. `idle`, flying, a pass of ring 0: with `down` → `{ type: 'wait' }` and stays idle; else `run`, `rest` 0, events `start`, `{ type: 'ring', n: 0 }`. `run`: `down` → idle, `off`; `grounded` or hits reaching `max` → `lost` (event `lost`, once); each hit → `{ type: 'hit', left }`; a pass of `next` → `ring`, and past the last → `won` (`{ type: 'won', t }`), `rest = TUNING.rest`. `t` counts the run's seconds.
  - `shaken(g) → boolean` — `g.rest > 0`.
  - `chaseReadout(g) → { on, vitals: { value: left, max, low: left === 1 }, line }` — on only while `run`; line `Ring n of N, k hits left` (`1 hit left`). Null → `{ on: false, vitals: null, line: '' }`.
  - `chaseGoal(g) → { x, z } | null` — the next ring (ring 0 when idle), for the minimap while flying.
  - `chaseStart(g) → { x, y, z, yaw }` — where a lost run's retry starts: 12 m before ring 0, facing through it.
  - `SAYS = { lost, wait }` — 'Three hits: the Federation ship had you. Back to the first ring.' and 'No Federation ship to shake: the next one’s round in a minute.'

- [ ] **Step 1: Write the tests**: a run starts on ring 0 only while flying and with a patrol up (`wait` with one down); the rings go in order (a later ring first is nothing); a pass either way counts, a jump past doesn't; the last ring wins with its time and `shaken` holds for `rest`; three hits lose once, then idle at ring 0; grounded loses; landing or the patrol down mid-run is `off`, quietly; `chaseReadout` while running, at one hit left, idle and null; `chaseGoal` idle, mid-run and null; `chaseStart` 12 m before ring 0 on its way through; perks unread; and the course pinned against the street (tests only import `../rules` and `../ship`): every ring inside the patrol's clamp (`AREAS.street` less 4 m), its bottom (`y - r`) above `floorAt(x, z)` and its top under `CRUISER.ceiling`, the lowest at 8 m or more (the patrol's own floor).
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/chase.test.js` — Expected: FAIL (no module).
- [ ] **Step 3: Implement** in `power.js`'s shape (a header saying what it is and who steps it).
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** — "The chase kind's rules: six rings over the street under the patrol's laser"

### Task 3: The fight and the cruiser's voice in a chase

**Files:** Modify `world/streetFight.js` (`chase(on, now)`; its header), `world/ship.js` (two `SHIP_LINES` kinds and their `COOLDOWN`). Test: `world/streetFight.test.js`, `world/ship.test.js`.

**Interfaces:**
- Produces: `fight.chase(true, now)` — the patrol turned on the cruiser (patrolRules' `provoke`, no `provoked` event) and held: while held, a hit on it flashes and takes nothing, so it can't go down. `fight.chase(false)` — let go, and calmed (patrolRules' `calm`). `SHIP_LINES.chase` (a run started) and `SHIP_LINES.shaken` (won), two lines each, under 110 characters, with `COOLDOWN.chase` 20 and `COOLDOWN.shaken` 20.

- [ ] **Step 1: Write the tests**: 'turns the patrol on the cruiser for a chase, without a word, and lets it go' (mode `fight` after `chase(true)`, no `provoked` in the step's events, `calm` after `chase(false)`); 'holds a patrol in a chase: a hit takes nothing' (a heavy round at a held patrol leaves `hp` at `PATROL.hp`, mode `fight`, no `down`; let go, the same round takes it). In `ship.test.js`, the pinned kinds become `['board', 'ceiling', 'chase', 'fast', 'hello', 'idle', 'land', 'leave', 'refuse', 'shaken', 'tail', 'takeoff']`.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/streetFight.test.js src/components/rickmorty/world/ship.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement**: a `held` flag that `land()` reads before `hitPatrol`; the lines, e.g. chase 'The Federation has locked on, Morty. The rings, please. Quickly, if you value the paintwork.' and shaken 'Shaken. They’ve gone back to circling. I’d like that on the record.'
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty/world` — Expected: PASS (voicelines follows `SHIP_LINES`).
- [ ] **Step 5: Commit** — "The street fight holds its patrol for a chase, and the cruiser has its lines", naming the moved key list.

### Task 4: The rings drawn

**Files:** Create `src/components/rickmorty/world/chaseRings.js`, `chaseRings.test.js`. Modify `world/street.js` (build it, add its group, its meshes to `noInk`, its `update` in `update`, its `dispose`).

**Interfaces:**
- Consumes: Task 2's `COURSE`, `TUNING.r`; `hot` from `../stage`.
- Produces: `createChaseRings(rings = COURSE) → { group, noInk, update(t, chase, flying), dispose() }` — one shared `TorusGeometry(TUNING.r, 0.22, 8, 48)`, each ring its own `MeshBasicMaterial({ color: hot(0x9dff5a, 1.6), transparent: true, depthWrite: false, blending: AdditiveBlending })` turned to its `yaw`. `update`: all hidden unless `flying`; flown rings (index < `next` while running) hidden; the next ring at opacity 0.9 pulsing (`0.75 + 0.25 sin(6t)`), the rest at 0.25.

- [ ] **Step 1: Write the tests**: every ring a mesh at its place, see-through and in `noInk`; hidden on foot; idle and flying, ring 0 lit and the rest faint; mid-run at ring 2, rings 0 and 1 hidden; `dispose` frees the geometry once.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/chaseRings.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** both files (`update` reads `state.chase` and `state.flying` from street's own update).
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty/world` — Expected: PASS.
- [ ] **Step 5: Commit** — "The chase's rings over the street, lit while the cruiser flies"

### Task 5: Episode 5 in C-137, and in the browser check

**Files:** Modify `scripts/rm-story-check.mjs`; `world/RmWorld.jsx` (call sites); `world/RmHud.jsx` (the chase block in the cruiser's cluster); `world/world.css` (its rules); `world/rules.js` (the fly hint). Test: `world/rules.test.js`.

**Interfaces:**
- Consumes: Tasks 1–4; `__C137__` (`goto`, `board`, `fight`, `sim`, `complete`, `dial`), `__RMSTORY__`.
- Produces in RmWorld: `chase: newChase()` in `newSim`; after `s.fed.down` is set, `s.chase = stepChase(s.chase, { at: s.c, flying: s.flying && !s.landing, hit: hurt, down: s.fed.down, grounded: fight.grounded(s.t) }, dt)` with `hurt` counted from the fight's `hurt` events, then its events: `start` → `fight.chase(true, s.t)`, `shipTalk('chase')`; `won` → `fight.chase(false)`, `shipTalk('shaken')`, `complete('fly')`, `tell({ type: 'win', game: 'chase' })`; `lost` → `fight.chase(false)`, `fight.clear()`, a door fade with the cruiser at `chaseStart(s.chase)` at speed 0, `say({ kind: 'note', bad: true, text: SAYS.lost })`; `wait` → that note with `SAYS.wait`; `off` → `fight.chase(false)`. `stepFedShip(s.fed, s.c, s.flying && !shaken(s.chase), …)`. The take-off tick and `boardAt` go. `GOAL.chase = ['street', 'cruiser']`; `drawMap(…, goalOf(…) ?? (s.flying ? chaseGoal(s.chase) : null), …)`. `chase: s.chase` in the render state. A second `createFlightCluster` places `chaseReadout(s.chase)` in the every-third-frame block, its line through a ref. RmHud: `<div ref={chaseRef} className="rm-chase">` with `<Vitals label="Hits" …><span ref={chaseLine} className="hud-line" /></Vitals>` after the Deflectors. world.css: `.rm-chase:not([data-on])` hidden, its percent hidden, and on touch or narrow its block above the deflectors'. The hint: 'Board Rick’s space cruiser in the driveway, then fly it through the rings over the street with the Federation ship on your tail.'

- [ ] **Step 1: Write the tests.** `rules.test.js`: 'the fly task’s hint names the rings'. `rm-story-check.mjs`: `HEAT = EPISODES[4]`; `episode-4`'s tail at READY 5 (Morty's line, `cardFor(page, 4)`, at 4.0, gromflomites and fortress open, needful, vat and nimbus shut, the objective `HEAT.steps[0].text`); its old last checks (every place open, no card, the cable hint) move to the end of a new `episode-5`: to 4.0 through `complete` with each card; to the street, board; take off and `fly` isn't done; wait for `fight()`; the cruiser 1 m before ring 0 facing it → `run`, the patrol fighting, `.rm-chase[data-on]`; hits at max → idle, no win, no `fly`, the cruiser back before ring 0; through ring 0 again, then `next` at the last and through it → `wins` has `chase`, the 'Fly the cruiser' toast, at 4.1, `HEAT.steps[1].text`, the patrol `loop`ing; set down; dial the Gromflomite base, through the portal; caught by a guard once (the reset checked); the cell opened in a bounded retry; Rick's line; at 5.0; every place open; no card; home and the cable hint. Shots mid-run with `OUT`.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/rules.test.js` and `node scripts/rm-story-check.mjs episode-4 episode-5` on the branch's dev server — Expected: FAIL (the hint; no chase in the world).
- [ ] **Step 3: Implement** the wiring above.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty scripts/rm-story-check.mjs` and `node scripts/rm-story-check.mjs` — Expected: PASS, all twelve scenarios ok.
- [ ] **Step 5: Commit** — "Episode 5 plays: the cruiser's chase over the street, and the fly task ticks on its first win"

### Task 6: The guide

**Files:** Modify `src/components/guide/pages.js` (one tip on the end of `/c-137`'s list).

- [ ] **Step 1: Add** `['The cruiser’s chase', 'Fly through the six rings over the street, in order, with the Federation ship shooting at you: three hits and it’s back to the first ring, and it can’t be shot down while it chases you.']`.
- [ ] **Step 2: Run** `npx vitest run src/components/guide src/lib/words.test.js` — Expected: PASS.
- [ ] **Step 3: Commit** — "The guide has the cruiser's chase"

### Task 7: Prove it and hand it over

**Files:** Modify `scripts/c137-shots.mjs` (a view's optional `fly: [x, y, z, yaw]`: after `goto`, board and place the cruiser; a `chase` view over the course), `docs/superpowers/HANDOFF-worlds.md` (the chase kind and how it's stepped; P4 in, P5 next; follow-ups: the chase runs while Things to do is open, Hangar upgrades make it easier), `docs/superpowers/plans/2026-10-19-rm-adventure.md` (line 3 names P4's plan). Delete `docs/superpowers/plans/2026-10-19-rm-adventure-p3-small-problems.md`.

- [ ] **Step 1: Shoot before and after**: `HUD=1 scripts/c137-shots.mjs chase gromflomites` on `main` (5198, with the view added there by hand and not committed) and the branch (5197); mid-run shots from the check.
- [ ] **Step 2: Run the four** — Expected: green, budgets as above.
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` on the dev server and a DEV-flavoured build — Expected: every scenario ok.
- [ ] **Step 4: Commit** the hand-off — "The worlds' hand-off: episode 5, and P3's plan goes"
- [ ] **Step 5: One fresh reviewer on the whole branch; push; the pull request** ("The Rick and Morty adventure, P4: Heat"), merged once CI is green.
