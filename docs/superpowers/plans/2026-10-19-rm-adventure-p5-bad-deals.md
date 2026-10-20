# The Rick and Morty adventure, P5: Bad deals

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Episode 6, *Bad deals*, is built and played: Needful Things becomes a game on the new `deal` kind (look the free things over, three looks at most, and take the one with no curse on it), and the vat of acid on the new `freeze` kind (move while the Gromflomites' backs are turned, keep still while they look, jump in behind their backs and play dead).

**Architecture:** Both kinds are pure, import-free rules in `world/games/`, taken by `place()` as keys and stepped by `dimensions/stage.js` inside the place's own update, as P3's `power` is; they win and fail through the render state's `done` and `caught`, which RmWorld already turns into `complete()` and the reset at the way in. A place's game has one HUD meter: the stage's `meter` action returns whichever kind's readout, and RmHud names the cluster by the place's kind (`world/games/meter.js`), so RmWorld's call site stays one line for every kind. The vat's buyers turn by `npc.js`'s new `lookout` switch, driven by the freeze rule; no new models.

**Tech Stack:** React 19, three.js, Vitest (node), Playwright-core on SwiftShader.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md` §4 (episode 6: `task needful` · `task vat`), §5 (Needful Things: "look the free things over and take only the ones with no curse on them", new `deal`: "choose n of m, each with a hidden flag a look reveals"; the vat: "play dead: hold still while the buyers look, move when they turn", new `freeze`; "a new kind is a pure rule in `world/games/<kind>.js` with its test, taken by `place()` as one more key and drawn by the stage"; "every game has a goal, a way to fail with a quick retry, and a win that ticks the place's task as today; failing puts Morty back at the place's way in, as `caught` does; nothing done is undone; the hotspots' lines stay as the place's colour; each new kind takes `perks` with everything at zero"). Index: P5 (and P10 reuses `deal` for Pluto). What landed before: P0 #1089, P1 #1097, P2 #1099, P3 #1109, P4 #1113 (`da2b3e7`). Research: four readers and a critic, scratch `p5/*.md`.

## Global Constraints

- `READY` is 6 at the end; episode 6's data in `episodes.js` stays as written ("Take it, and nothing cursed": one thing to take, so `need: 1`).
- `RmWorld.jsx` gets call sites only (2,304 lines, in big-files); no new `requestAnimationFrame` (loops 57/58); no `eslint-disable` (54/54); no key-cap CSS; no file past 800 lines (`guide/pages.js` 788, `scripts/rm-story-check.mjs` 706).
- No new models and nothing drawn in code that a model should be: the deal's things are hotspots at what the shop already shows; the buyers turn by their existing figures.
- The HUD meter is the kit's (`Cluster`, `Vitals`, `createFlightCluster`), its numbers through refs.
- Each kind takes `perks` and reads none; no earn deed; `economy.js`, `earn.js` untouched.
- Copy: British, curly quotes, no `!`, no Oxford comma, one sentence a toast; the places' existing lines stay word for word.
- Every moved test assertion as strict, a sentence each in its commit. New hotspot ids unique across the dimensions (`shop*`).

## Review Focus

1. **A returner who already has `needful` or `vat` done** (the talk or the old collect ticked it): the game stays idle, no meter shows, using the things or the vat only says their lines; the story catches up past the step. Pinned in Task 5 and Task 6 (the stage skips a kind whose task is done) and Task 1 (a task done early).
2. **Two presses in one frame, or a press on a thing already seen cursed**: the second press still counts (a queue, not a slot), and a seen curse used again does nothing. Pinned in Task 2 (a seen curse is left alone) and Task 5 (the queue).
3. **Leaving mid-game** (the portal home, the dial): the place calms, the deal is dealt afresh and the freeze is idle; nothing done is undone. Pinned in Task 5 and Task 6 (the composite `calm`) and the scenario.
4. **Walking up to the vat and pressing E while still slowing down**: a 0.6 s settle grace in the vat before stillness is judged, so a fair jump isn't an instant catch; jumping in while they're turning or looking is a catch. Pinned in Task 3 (`settle`, a jump during `turn` or `look`).
5. **Things to do open while the beat runs, or the buyers' models still loading**: the beat runs (as the charge does) and the game is fair by its readout; named in the hand-off. Pinned by the readout's tests in Task 3.

---

### Task 1: The story at READY 6

**Files:** Modify `src/components/rickmorty/adventure/episodes.js` (`READY = 6`). Test: the adventure's `episodes`, `story`, `hud`, `adventure`, `StoryList`, `EpisodeCard` tests.

**Interfaces:** Produces `READY === 6`; no API change.

- [ ] **Step 1: Move the tests** with `scratchpad/p5research/fix6.py` (each substitution asserts its old text occurs once): READY 6; 'goes on with Bad deals' (step ids `['needful', 'vat']`, places `needful` and `vat`, unlocks `['jerryboree', 'gloopynoops', 'prison']`); the real story through episode 6 (the base now ends episode 5 with episode 6's card; the vat ends it with no card); a deal's task done early; the dial after episode 5 opens 13 of 32 and jerryboree, gloopynoops and prison read 'Opens after episode 6, “Bad deals”.'; `jump(5)`, `jump(6)`, `intro()` for a P4 finisher → 5; StoryList's six ticks; 'names episode 6 too'.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure` — Expected: FAIL (12, on READY 5).
- [ ] **Step 3:** `export const READY = 6;`
- [ ] **Step 4: Run** the same — Expected: PASS (77).
- [ ] **Step 5: Commit** — "The adventure at READY 6: episode 6 is built", naming each moved assertion.

### Task 2: The deal kind's rules

**Files:** Create `src/components/rickmorty/world/games/deal.js`, `deal.test.js`.

**Interfaces:** Produces (import-free):
- `TUNING = Object.freeze({ need: 1, looks: 3 })`; `WORDS = Object.freeze({ good: 'No curse on that one: once more to take it', bad: 'That one’s cursed: leave it be', blind: 'No looks left: once more to chance it', taken: (n, need) => \`Taken ${n} of ${need}\` })`.
- `newDeal({ items, bad = [], need = TUNING.need, looks = TUNING.looks, perks } = {}) → { phase: 'idle', items, bad, need, looks, left: looks, seen: {}, taken: [], last: null, told: false, events: [] }` — `perks` taken, none read.
- `stepDeal(prev, { use } = {}) → next` — over (won/lost): nothing (events empty). `use` null, not an item, or taken: nothing. An item's first use is a look: phase `run`; with `left > 0` `seen[id]` is `'bad'` (in `bad`) or `'good'` and `left - 1`, else `'blind'`; `last = seen[id]`; event `{ type: 'look', id, saw }`. A later use: seen `'bad'` nothing; `'good'` taken (`{ type: 'take', id }`, `last = 'taken'`), won at `need` (`won`); `'blind'` lost if in `bad` (`{ type: 'lost', id }`), else taken.
- `curse(items, n, rand) → ids` — `n` of `items` (at most `items.length - 1`, none when `n` is 0), chosen by `rand` (a Fisher–Yates draw).
- `dealNews(g, { done, fading })` — as `powerNews`.
- `dealReadout(g, words = WORDS) → { on, vitals: { value: left, max: looks, low: left === 0 }, line }` — on only while `run`; `line` is `words[last]`, or `words.taken(taken.length, need)` after a take. Null/undefined → `{ on: false, vitals: null, line: '' }`.

- [ ] **Step 1: Write the tests**: idle, readout off; a look's three outcomes and the looks left; a good one taken wins; a seen curse used again does nothing, no event; the blind gamble both ways; unknown or taken ids ignored; `need: 2` reads 'Taken 1 of 2'; nothing changes once over; perks unread; `curse` deterministic for a fixed `rand`, clamped, `n` 0 → `[]`; `dealNews` as `power.test.js`'s; each `WORDS` line one sentence with no `!`.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/deal.test.js` — Expected: FAIL (no module).
- [ ] **Step 3: Implement** in `power.js`'s shape (a header saying what it is, who steps it, and that P10's Pluto reuses it with its own `words`).
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** — "The deal kind's rules: look the free things over, take the one with no curse"

### Task 3: The freeze kind's rules

**Files:** Create `src/components/rickmorty/world/games/freeze.js`, `freeze.test.js`.

**Interfaces:** Produces (import-free):
- `TUNING = Object.freeze({ still: 0.4, turn: 1.2, away: [1, 2, 1.4, 2.4], look: [2.4, 3, 2, 2.6], hold: 3, settle: 0.6 })` (seconds; `still` m/s).
- `moving(m) → boolean` — `m` and (`m.speed > still` or `m.air`).
- `newFreeze({ perks } = {}) → { phase: 'idle', eyes: null, beat: 0, left: 0, len: 0, told: false, events: [] }`.
- `stepFreeze(prev, { moving, jumped } = {}, dt = 1/60) → next` — `dt` clamped to 0.1; over: nothing. A jump (`jumped`): while `run` with eyes `away` → phase `in` (eyes `in`, `left = len = hold`, event `in`); otherwise lost (`{ type: 'lost', why: 'jumped' }`). `idle`: the first move starts the run (`start`; eyes `away` for `away[0]`). Moving while eyes `look`, or while `in` after `settle` seconds of it, → lost (`why: 'moved'`). Else the clock: `away` → `turn` (`turn` s) → `look` (`look[beat % 4]`) → `away` (`away[(beat + 1) % 4]`, `beat + 1`); the end of `in` → `won`.
- `freezeNews(g, { done, fading })` — as `powerNews`.
- `freezeEyes(g) → null | 'away' | 'look' | 'seen'` — null idle or won; `'away'` while away; `'look'` while turning, looking or in; `'seen'` once lost.
- `freezeReadout(g) → { on, vitals: { value: round(left / len · 100), max: 100, low: eyes !== 'away' }, line }` — on in `run` and `in`; lines: away 'Their backs are turned: move', turn 'They’re turning round: stop', look 'They’re looking: keep still', in 'In the vat: play dead'.

- [ ] **Step 1: Write the tests**: idle till the first move; the beat sequence away 1 → turn 1.2 → look 2.4 → away 2 → turn 1.2 → look 3; moving while away or turning is fine, while looking is lost once; a jump while away goes in, while idle, turning or looking is lost; the settle grace (moving in the first 0.6 s of `in` is fine, after it lost); `hold` seconds still wins; `moving()` by speed and `air`; `freezeEyes` for each phase; the readout's on, value, low and lines (one sentence, no `!`); perks unread; nothing changes once over.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/freeze.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** in `power.js`'s shape.
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** — "The freeze kind's rules: move while their backs are turned, keep still while they look"

### Task 4: One meter for a place's game

**Files:** Create `src/components/rickmorty/world/games/meter.js`, `meter.test.js`. Modify `dimensions/stage.js` (the `meter` action, power's readout for now), `world/RmWorld.jsx` (the readout call site), `world/RmHud.jsx` (the cluster named by the place's kind), `world/world.css`.

**Interfaces:**
- Produces `KINDS = ['power', 'deal', 'freeze']`; `kindOf(destination) → kind | null`; `METER = { power: { title: 'The world’s charge', label: 'Charge' }, deal: { title: 'The deal', label: 'Looks' }, freeze: { title: 'Who’s looking', label: 'Eyes' } }`; `METER_OFF = { on: false, vitals: null, line: '' }`.
- The stage's area action `meter()` → the running kind's readout (only when the place runs one). RmWorld: `const charge = api.current?.act(s.area, 'meter') ?? METER_OFF;` in place of the power readout (the refs keep their names). RmHud: the cluster `rm-cluster rm-meter rm-meter-<kind>`, `label={METER[kind].title}`, the Vitals label and icon by kind (`RiFlashlightLine`, `RiSearchEyeLine`, `RiEyeLine`). world.css: the deal's and freeze's percent hidden; on touch or narrow, `.rm-cluster.rm-meter .hud-vitals-block` as wide as its line (the chase's 46vw).

- [ ] **Step 1: Write the tests** in `meter.test.js`: `kindOf` gives microverse → power, a place with none → null, null → null; no destination carries two kinds; `METER_OFF` equals `powerReadout(null)`; the titles are distinct.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/meter.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** the four files as above.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` and `node scripts/rm-story-check.mjs episode-4` on the dev server — Expected: PASS (the charge meter still found as 'The world’s charge').
- [ ] **Step 5: Commit** — "One meter for a place's game: the stage's readout, named by the place's kind"

### Task 5: Needful Things on a deal

**Files:** Modify `dimensions/place.js` (the `deal` key: `acts` gets `deal-<id>` per item; documented), `dimensions/stage.js` (the deal stepped, its actions, `calm` deals afresh), `dimensions/rows1.js` (the row). Test: `dimensions/destinations.test.js`.

**Interfaces:**
- Consumes Task 2, Task 4.
- Produces: a destination's `deal: { task, items, bad (a count dealt each run, or fixed ids), need, looks, who, lost, words? }`; area actions `deal-<id>` (each queues a use), `deal` (the snapshot `{ phase, need, looks, left, seen, taken, last }`, no `bad`), DEV `setDeal(patch)`; `meter` returns `dealReadout`. The stage each frame, unless the task's done or the place is fading: every queued use stepped in order, then `done` → `emit('done', { area, task })`, `caught` → `emit('caught', { area, who, text: lost })` and `told`. `calm` deals afresh (`curse(items, bad, Math.random)`).
- The row: the items' verbs 'Look' → 'Look over'; new spots `{ id: 'shopclock', dx: -2.5, dz: -4.4, label: 'A clock', verb: 'Look over' }` and `{ id: 'shopmirror', dx: 2.4, dz: -4.4, label: 'A mirror', verb: 'Look over' }` with lines 'A clock that gains an hour whenever you’re happy and loses two when you’re not.' and 'A mirror that shows you a little better looking and a lot lonelier.' (no speaker); `deal: { task: 'needful', items: ['typewriter', 'aftershave', 'cream', 'shopclock', 'shopmirror'], bad: 4, need: 1, looks: 3, who: 'needful', lost: 'Cursed, I’m afraid: back to the door with you, and choose again.' }`; `goal: 'needful'`; `done` removed, `unlock` kept; hint 'Dial Needful Things. All but one of the free things are cursed: look them over, three looks at most, and take the one that isn’t.'

- [ ] **Step 1: Write the tests** in `destinations.test.js`, 'a place that runs on a deal': only needful; every item a hotspot with a line, `acts[id] === 'deal-' + id` and a verb that isn't 'Look'; the task among its tasks, `goal` among its hotspots; no `done` ticks the task; `bad < items.length`; `lost` one sentence, no `!`, no 'Mr.'; the pinned key, goal and unlock.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/dimensions/destinations.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS (the walk-to checks include the new spots).
- [ ] **Step 5: Commit** — "Needful Things is a deal: look the free things over, take the one with no curse"

### Task 6: The vat on a freeze

**Files:** Modify `world/npc.js` (the `lookout` switch), `dimensions/place.js` (the `freeze` key: `acts[spot] = 'freeze-in'`), `dimensions/stage.js` (the freeze stepped from `state.morty`, its actions, `calm`, `S.freeze({ splash })`), `dimensions/rows3.js` (the row), `dimensions/vat.js` (its splash handed to the stage), `world/RmWorld.jsx` (a `done` event may carry its achievement). Test: `world/npc.test.js`, `dimensions/destinations.test.js`.

**Interfaces:**
- Consumes Task 3, Task 4.
- Produces: npc's `lookout(mode)` (`'away' | 'look' | 'seen' | null`): people with `ai.lookout` turn their backs (`away`, no head look), face Morty with their heads on him (`look`), and alert once (`seen`); no barks or greetings while it's on; `calm` clears it. A destination's `freeze: { task, spot, who, lost, unlock }`; area actions `freeze-in` (the jump, and the splash), `freeze` (`{ phase, eyes, left, len, beat }`), DEV `setFreeze(patch)`; `meter` returns `freezeReadout`. The stage each frame: unless done or fading, `stepFreeze(still, { moving: moving(state.morty), jumped }, dt)`, news emitted as the deal's (the `done` carrying `unlock`); `N.lookout(freezeEyes(still))`. RmWorld's `done` handler: `complete(e.task); if (e.unlock) unlock(e.unlock);`.
- The row: `lookout: true` on both Gromflomites' `ai`; `freeze: { task: 'vat', spot: 'vatrim', who: null, lost: 'A Gromflomite sees you move, and you’re marched back to the door.', unlock: 'vat' }`; `goal: 'vatrim'`; `collect` and `acts` removed; hint 'Dial the vat of acid. Move while the Gromflomites’ backs are turned and keep still while they look; jump in behind their backs, then play dead.'

- [ ] **Step 1: Write the tests**: `npc.test.js` — `'away'` turns the back with no head look, `'look'` faces Morty with the head on him, `'seen'` alerts once, `null` is `watch` as before, `calm` clears it. `destinations.test.js`, 'a place that runs on a freeze': only the vat; its spot a hotspot with a verb that isn't 'Look' and `acts.vatrim === 'freeze-in'`; no `done` or `collect` ticks `vat`; `goal === 'vatrim'`; the lookouts are exactly the two Gromflomites; `lost` one sentence, no `!`; `unlock: 'vat'`.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/npc.test.js src/components/rickmorty/world/dimensions/destinations.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS.
- [ ] **Step 5: Commit** — "The vat of acid is a freeze: move while their backs are turned, play dead in the vat"

### Task 7: Episode 6 in the browser check

**Files:** Modify `scripts/rm-story-check.mjs`.

**Interfaces:** Consumes Tasks 1–6; `__C137__` (`dial`, `warp`, `api.act(area, 'deal' | 'setDeal' | 'freeze' | 'setFreeze')`, `sim`), a held key for a real move.

- [ ] **Step 1: Write the scenarios.** `DEALS = EPISODES[5]`; the header names the deal's and freeze's hooks; a helper `playTo(page, e, wins)` used only by the new scenario. `episode-5`'s tail at READY 6: Rick's line, `cardFor(page, 5)`, at 5.0, HEAT.unlocks open, DEALS.unlocks shut, the objective `DEALS.steps[0].text`; its old last checks move to `episode-6`. **`episode-6`:** to 5.0; Needful Things: idle; `setDeal({ bad: [the first four] })`; look at the typewriter (seen `bad`, the meter 'The deal' on), use it again (nothing taken); look at the aftershave and the cream (no looks left); the clock twice → caught at z 1600.9, idle, not done; `setDeal` again, the mirror twice → the task's toast, at 5.1, `DEALS.steps[1].text`; home. The vat: idle; `setFreeze({ phase: 'run', eyes: 'look', left: 30, len: 30 })`, the meter 'Who’s looking' on; a held W → caught at z 4207.4, idle, not done; `setFreeze({ phase: 'run', eyes: 'away', … })`, warp to the rim and E → `in`; `setFreeze({ left: 0.05 })` → the task's toast; the vat's achievement kept; Morty's closing line; at 6.0; every place open; no card; the cable hint. Shots with `OUT`.
- [ ] **Step 2: Run** `node scripts/rm-story-check.mjs episode-5 episode-6` on `main` (5198) — Expected: FAIL.
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` on the branch — Expected: all thirteen ok.
- [ ] **Step 4: Commit** — "Episode 6 plays through in the browser check: Needful Things and the vat"

### Task 8: The guide

**Files:** Modify `src/components/guide/pages.js` (two tips on the end of `/c-137`'s list).

- [ ] **Step 1: Add** `['Needful Things', 'Everything in Mr. Needful’s shop is free, and all but one of the free things is cursed. Look them over first, three looks at most, then take the one with no curse on it; take a cursed one and you’re back at the door.']` and `['The vat of acid', 'Rick’s fake death, sold to two Gromflomites. Move while their backs are turned and keep still while they look; jump in behind their backs, then play dead while they peer in. Seen moving, you’re back at the door.']`.
- [ ] **Step 2: Run** `npx vitest run src/components/guide src/lib/words.test.js` — Expected: PASS.
- [ ] **Step 3: Commit** — "The guide has Needful Things and the vat"

### Task 9: Prove it and hand it over

**Files:** Modify `docs/superpowers/HANDOFF-worlds.md` (the two kinds, the one meter, the lookout, the achievement on a win; P5 in, P6 next; follow-ups: the shelves' trinkets inside their body, a taken thing stays on show, the vat's game runs while its models load, jumping in while they look flashes the vat's line, a Gromflomite's bark captioned by its id, talk- and collect-ticked places that earn no achievement, the check near 800 lines so P6 splits it first, pages.js at 790), `docs/superpowers/plans/2026-10-19-rm-adventure.md` (line 3 names P5's plan). Delete `docs/superpowers/plans/2026-10-19-rm-adventure-p4-heat.md`.

- [ ] **Step 1: Shoot before and after**: `HUD=1 scripts/c137-shots.mjs needful vat` on `main` (5198) and the branch (5197); the check's game shots; a phone-width shot of the widened meter.
- [ ] **Step 2: Run the four** — Expected: green, budgets as above.
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` on the dev server and a DEV-flavoured build — Expected: every scenario ok.
- [ ] **Step 4: Commit** the hand-off — "The worlds' hand-off: episode 6, and P4's plan goes"
- [ ] **Step 5: One fresh reviewer on the whole branch; push; the pull request** ("The Rick and Morty adventure, P5: Bad deals"), merged once CI is green.
