# The Rick and Morty adventure, P3: Small problems

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Episode 4, *Small problems*, is built and played: the Microverse becomes a game (Zeep's cells carried to the gooble boxes before the world's charge runs down, the new `power` kind) and Anatomy Park becomes one (the park map's pieces found while the diseases hunt, then out through the portal, from the existing keys).

**Architecture:** `power` is a pure rule (`world/games/power.js`) taken by `place()` as one more key and stepped by the stage inside the place's own update, with no new animation loop. It wins and fails through the render state's existing events (`done`, `caught`), which RmWorld already turns into `complete()` and the reset at the way in. The meter is the HUD kit's cluster, written through a ref. Anatomy Park is data on the Frundles precedent (collect + hunt + escape) plus a few builder lines on the simulation's (`collected` sets every hunter going).

**Tech Stack:** React 19, three.js, Vitest (node), Playwright-core on SwiftShader.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md` §5 ("The dull places made into games": the Microverse and Anatomy Park rows; "a new kind is a pure rule in `world/games/<kind>.js` with its test, taken by `place()` as one more key and drawn by the stage"; "every game has a goal, a way to fail with a quick retry, and a win that ticks the place's task as today; failing puts Morty back at the place's way in, as `caught` does; nothing done is undone"). Index: P3. What landed before: P0 #1089, P1 #1097, P2 #1099 (`cb61e8d`).

## Global Constraints

- `READY` is 4 at the end; episode 4's data in `episodes.js` stays as written.
- `RmWorld.jsx` gets call sites only (2,269 lines, counted in big-files); no new `requestAnimationFrame` (loops 57/58); no `eslint-disable` (54/54); no key-cap CSS (kbd-styles 68/70); big-files 28/30; no file past 800 lines (`guide/pages.js` is 775, `interiors/shell.js` 784: don't add there beyond the two guide lines).
- No new models and nothing drawn in code that a model should be: the cells and the map pieces are hotspots, not props; the stompers are the gooble boxes; the diseases are the cast's own.
- The HUD's meter is the kit's (`runtime/hud`: `Cluster`, `Vitals`, `createFlightCluster`), its numbers written through refs (RULES: numbers through refs).
- Each new kind takes `perks` and reads none (Schmeckles waits); no earn deed; `economy.js`, `earn.js` untouched.
- Copy: British, curly quotes, no `!`, no Oxford comma, one sentence a toast; the places' existing lines stay as their colour.
- Every moved test assertion as strict, a sentence each in its commit.
- New rows on the end of their lists; new hotspot and people ids unique across the dimensions.

## Review Focus

1. **A returner who met Zeep, or rode to the Pancreas, before P3** (the task already done): the Microverse's game stays idle (no meter, Take and give do nothing), Anatomy Park's diseases still roam but nothing new is owed; the story catches up past the step. Pinned in Task 3 (`powerNews` with the task done) and Task 2.
2. **The charge runs out mid-carry, or Morty's caught during a fade**: one reset, at the way in, with the cells back on the console; never two catches, never a task undone. Pinned in Task 2 (`powerNews` holds the catch while fading and after it's told) and the browser scenario.
3. **Leaving the Microverse mid-run** (the portal home, the dial): the run is reset, and coming back starts idle with full charge. Pinned in Task 3 (the stage's `calm` resets it) and the scenario.
4. **Caught in Anatomy Park with some pieces found**: the pieces are lost and Morty is at the way in; a clock run out keeps them and one E restarts it (as every collect place does). Pinned in the scenario.
5. **Things to do open while the charge drains**: it drains, as every escape's clock does; a hidden tab stops the world's frame and the drain with it. Named in the hand-off.

---

### Task 1: The story at READY 4

**Files:**
- Modify: `src/components/rickmorty/adventure/episodes.js` (`READY = 4`)
- Test: the adventure's `episodes`, `story`, `hud`, `adventure`, `StoryList`, `EpisodeCard` tests

**Interfaces:** Produces `READY === 4`; no API change.

- [ ] **Step 1: Move the tests to the new frontier** (values confirmed by running the code at `ready: 4`):
  - `episodes.test.js`: 'the first four ready' (`READY` 4); new 'goes on with Small problems: the Microverse, then Anatomy Park' — title 'Small problems', step ids `['microverse', 'anatomy']`, places `microverse` and `anatomy`, unlocks `['gromflomites', 'fortress']`.
  - `story.test.js` real story: 'opens episode 4’s places after episode 3, and every place once episode 4, the last built, is done' — the sewer's out is `[{ done: 2 }, { episode: 3 }]`; open microverse, anatomy, storytrain (and the earlier five); shut gromflomites, fortress, vat, citadel, squanch, evilrick; the objective walks episode 4's two steps; anatomy ends it with `[{ type: 'done', episode: 3 }]`; every place open; objective null. 'Keeps a cabinet won early': unchanged types (it stops at episode 3's first step, which isn't known). 'Crosses into episode 3 past the tasks already done': with the sewer known too, episode 3's closing line now comes with card 3 (episode 4 is built); and with microverse and anatomy known as well it lands at 4.0 saying episode 4's line with card null.
  - `hud.test.js`: past the last ready is episode 4; the marker at 3.0 and 3.1 is `{ id: 'microverse' }`, `{ id: 'anatomy' }`; after episode 3 the dial opens exactly `annex, customs, microverse, anatomy, simulation, storytrain, agency, meeseeksgolf` (8 of 32) and gromflomites' note is 'Opens after episode 4, “Small problems”.'; the lead at 3 reads 8 of 32, at 4 reads 32 of 32.
  - `adventure.test.js`: `jump(3)` opens microverse and anatomy with gromflomites and the vat shut; `jump(4)` opens the vat; `jump(99)` stays at 4. `intro()`: `{ 3, 0 }` → 3; `{ 4, 0 }` → null; a P2 finisher (`{ 3, 0 }`) with microverse done is caught up to 3.1 and still → 3; with both done lands at 4.0 → null.
  - `StoryList.test.jsx`: every built episode done is four ticks. `EpisodeCard.test.jsx`: 'names episode 4 too' (Rick speaks).
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure` — Expected: FAIL on READY 3.
- [ ] **Step 3:** `export const READY = 4;`
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty/adventure` — Expected: PASS.
- [ ] **Step 5: Commit** — "The adventure at READY 4: episode 4 is built", naming each moved assertion.

### Task 2: The power kind's rules

**Files:**
- Create: `src/components/rickmorty/world/games/power.js`, `src/components/rickmorty/world/games/power.test.js`

**Interfaces:**
- Produces:
  - `TUNING = Object.freeze({ need: 4, charge: 25, low: 0.25 })` (seconds of charge from the first cell taken; `low` a fraction).
  - `newPower({ need, charge, perks } = {}) → { phase: 'idle', need, delivered: 0, carrying: false, charge, max: charge, told: false, events: [] }` — `perks` taken, none read.
  - `stepPower(prev, { take, give } = {}, dt = 1/60) → next` — `dt` clamped to 0.1. `idle`: no drain; `take` → carrying, phase `run`. `run`: the charge drains by `dt`; `take` with nothing in hand → carrying (event `take`); `give` with a cell → `delivered + 1`, not carrying (event `give`), at `need` → `won` (event `won`); charge at 0 → `lost` (event `lost`). `give` with nothing in hand, or `take` with a cell, does nothing. Once `won` or `lost`, nothing changes (events empty).
  - `powerNews(game, { done, fading }) → 'done' | 'caught' | null` — `won` and the task not `done` → `'done'` (each frame until it is); `lost`, not `fading` and not `told` → `'caught'`; else null. (The stage sets `told` once it has said so.)
  - `powerReadout(snapshot) → { on, vitals: { value, max: 100, low }, line }` — `on` only while `run`; `value` the charge as a percent; `low` below `TUNING.low`; `line` 'Cells n of N', with ', one in hand' while carrying. A null snapshot → `{ on: false, vitals: null, line: '' }`.

- [ ] **Step 1: Write the tests**: idle doesn't drain; the first take starts the run; one cell at a time; a give with nothing in hand is nothing; won at the fourth give; lost when the charge runs out, mid-carry too; nothing changes once over; `dt` clamped; perks taken and unread (equal state with and without); `powerNews` for won/done, lost/fading, lost/told; `powerReadout` while running, carrying, low, idle and null.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/power.test.js` — Expected: FAIL (no module).
- [ ] **Step 3: Implement** in `power.js`, in `cabinet.js`'s shape (a header comment saying what it is and who steps it).
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** — "The power kind's rules: carry the cells before the charge runs down"

### Task 3: `place()` takes `power`; the stage steps it; the Microverse plays it

**Files:**
- Modify: `dimensions/place.js` (the `power` key, folding its two spots into `acts` as `power-take` and `power-give`; its doc comment), `dimensions/stage.js` (when `d.power`: the rule made, stepped in `done()`'s update wrapper, its news emitted, its actions, a composite `calm`; `S.power({ glow })`), `dimensions/microverse.js` (the battery's glow in its own mesh, handed to the stage), `dimensions/rows1.js` (the Microverse row), `world/RmHud.jsx` (a `Cluster` with `Vitals` 'Charge' and a line), `world/RmWorld.jsx` (call sites: the cluster, two refs, three lines in the every-third-frame block, props to the HUD)
- Test: `dimensions/destinations.test.js`

**Interfaces:**
- Consumes: Task 2.
- Produces: a destination's `power: { task, from, to, need, s, who, lost }`; area actions `power-take`, `power-give`, `power` (the snapshot `{ phase, charge, max, need, delivered, carrying }` or null when there's no run), and in DEV `setPower(patch)`; `calm` resets the run. The stage, each frame: skip while `state.fading` or once `state.done` holds the task (idle, nothing shown); step with the queued take/give; emit `state.emit('done', { area, task })` or `state.emit('caught', { area, who, text: lost })` per `powerNews`, setting `told`; tint the handed glow with the charge and blink it when low.
- The Microverse row: a new spot `{ id: 'zeepcells', dx: -4.2, dz: -5.6, label: 'Zeep’s cells', verb: 'Take' }` and its line (no speaker); `power: { task: 'microverse', from: 'zeepcells', to: 'gooble', need: 4, s: 25, who: 'zeep', lost: 'The world’s gone dark. Zeep wants you back at his console.' }`; `goal: 'zeepcells'`; `done` removed, `unlock: { zeep }` kept; the task 'Power Zeep’s world', hint 'Dial the Microverse. Carry Zeep’s cells from his console to the gooble boxes, one at a time, before the world’s charge runs down.'

- [ ] **Step 1: Write the tests** in `destinations.test.js`: 'a power place carries its cells between its own spots' — every destination with `power` has `from` and `to` among its hotspots, its task among its tasks, a `goal` among its hotspots, `acts[from] === 'power-take'` and `acts[to] === 'power-give'`, and no `done` that would tick the task by a talk; the Microverse is one.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/dimensions/destinations.test.js` — Expected: FAIL (no power place).
- [ ] **Step 3: Implement** the files above. The HUD's cluster mirrors the cruiser's (`clusterRef`, RmWorld's `cluster.place` in the frame loop): `powerReadout(api.current?.act(s.area, 'power'))` placed every third frame, its `line` written to its own ref.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS (the rules test's walk-to checks include the new spot).
- [ ] **Step 5: Commit** — "The Microverse is a game: Zeep's cells to the gooble boxes before the charge runs down"

### Task 4: Anatomy Park's chase

**Files:**
- Modify: `dimensions/rows1.js` (the Anatomy Park row), `dimensions/anatomy.js` (the pens skip the loose diseases; `collected` sets every hunter going; a composite `calm`)
- Test: `dimensions/destinations.test.js` (the collect places' test already covers it; add the Anatomy pins)

**Interfaces:**
- Produces the row (only what changes): four people appended — `loose-hepatitis` (who `hepatitis`, dx -12, dz -6, wander `[[-12,-6],[-16,-1],[-11,2],[-5,-6]]`, speed 1.2, pause 1, hunt speed 3.0, catchR 1.3, near 4.5, lose 8), `loose-tuberculosis` (`tuberculosis`, 2, -6, `[[2,-6],[-3,-2],[5,-2],[9,-6]]`, 1.1, 1.5, hunt 2.8/1.4/4.5/8), `loose-gonorrhoea` (`gonorrhoea`, -6, -2, `[[-6,-2],[10,-2],[10,0],[-6,0]]`, 1.0, 1, hunt 2.7/1.5/4.5/8), `loose-ecoli` (`ecoli`, 13, -5, `[[13,-5],[18,-8.5],[18,-2],[12,1]]`, 1.6, 0.6, hunt 3.4/1.0/4/7); four spots appended — `mapkiosk` (-14, 3.6), `mapspleen` (-3.5, -5.4), `maprib` (17.8, -11.4), `mapboat` (18.4, 0.2), each 'A piece of the park map', verb 'Take', each with an unnumbered line; the pens' solids deepened to the back wall (dz -10.6, d 4.8); `collect: { task: 'anatomy', spots: [the four], escape: { s: 40 } }`; `goal: 'mapkiosk'`; `say` entries for the four loose diseases (so a catch names 'Hepatitis A' and the rest, not an id); `caught` (the map's pieces blow back where they were) and `spotted` lines; `done` removed, `unlock: { pancreas }` kept; the task 'Get the park map out of Ruben', hint 'Dial Anatomy Park on the portal gun. Find the four pieces of the park map while the diseases hunt you, then get back through the portal before the clock runs out.'

- [ ] **Step 1: Write the test** 'Anatomy Park is a chase': its collect is the four map spots with an escape clock, four of its people hunt and none of their ids is a hotspot's, every hunter has a `say` name, and nothing ticks `anatomy` by a talk.
- [ ] **Step 2: Run** the destinations test — Expected: FAIL.
- [ ] **Step 3: Implement** the row and the builder lines (the pens loop skips the kinds that roam, read from `S.d.people`; `collected` and `calm` as `simulation.js` has them).
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS.
- [ ] **Step 5: Commit** — "Anatomy Park is a chase: the park map's pieces while the diseases hunt"

### Task 5: Episode 4 in the browser check

**Files:**
- Modify: `scripts/rm-story-check.mjs`

**Interfaces:**
- Consumes: Tasks 1–4; `__C137__` (`warp`, `api`, `dial`, `sim`, `complete`), `api.act('microverse', 'power' | 'setPower')`.
- Produces: `SMALL = EPISODES[3]`; header naming `warp` and `api`; `episode-3`'s tail at READY 4; an `episode-4` scenario.

- [ ] **Step 1: Write the scenarios.**
  - `episode-3`'s tail: after Rick's closing line, `cardFor(page, 3)`; at 3.0; microverse, anatomy and storytrain open, gromflomites, fortress and the vat shut; the objective reads `SMALL.steps[0].text`. Its old last checks (every place open, the cable hint, no card) move to the end of `episode-4`.
  - `episode-4` (new, fresh profile): to 3.0 through `complete` (episodes 1–3, the cabinet win fed first), each card checked. **The Microverse:** `dial('microverse')`, through the portal; warp to the cells, use, the snapshot reads `run`; `setPower({ charge: 0.1 })` → Morty back at the way in, the run idle and `microverse` not done; then four carries (warp, use `zeepcells`, warp, use `gooble`), the task's toast, at 3.1, the objective `SMALL.steps[1].text`; home through the portal. **Anatomy Park:** dial, through; warp onto a hunting disease and see the reset (at the way in, nothing used, no clock, not done); then the four pieces (a bounded retry absorbing a catch, each catch checked as a reset), through the portal inside the clock; Morty's closing line; at 4.0; gromflomites, fortress and the vat open; no card after 1.5 s; the cable hint. With `OUT`, shots mid-run in each.
- [ ] **Step 2: Run** them against `main` on 5198 — Expected: FAIL (`episode-3` on Episode 4's card).
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` on the branch — Expected: all eleven ok.
- [ ] **Step 4: Commit** — "Episode 4 plays through in the browser check: the Microverse and Anatomy Park"

### Task 6: The guide

**Files:** Modify `src/components/guide/pages.js` (two tips on the end of `/c-137`'s list).

- [ ] **Step 1: Add** `['The Microverse', 'Inside the car’s battery. Carry Zeep’s cells from his console to the gooble boxes, one at a time, before the world’s charge runs down; it runs from the first cell you take.']` and `['Anatomy Park', 'Inside Ruben. Find the four pieces of the park map while the diseases hunt you, then get back through the portal before the clock runs out; caught, the pieces blow back where they were.']`.
- [ ] **Step 2: Run** `npx vitest run src/components/guide src/lib/words.test.js` — Expected: PASS.
- [ ] **Step 3: Commit** — "The guide has the Microverse and Anatomy Park"

### Task 7: Prove it and hand it over

**Files:** Modify `docs/superpowers/HANDOFF-worlds.md` (the power kind and its hooks; P3 in, P4 next; follow-ups: the marker stays on the cell source while carrying and on the first piece while the clock runs; the meter drains while the list is open), `docs/superpowers/plans/2026-10-19-rm-adventure.md` (line 3 names P3's plan). Delete `docs/superpowers/plans/2026-10-19-rm-adventure-p2-house-guests.md`.

- [ ] **Step 1: Shoot before and after**: `HUD=1 scripts/c137-shots.mjs microverse anatomy` on `main` (5198) and the branch (5197); mid-run shots from the check.
- [ ] **Step 2: Run the four** — Expected: green, budgets as above.
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` on the dev server and a DEV-flavoured build — Expected: every scenario ok.
- [ ] **Step 4: Commit** the hand-off — "The worlds' hand-off: episode 4, and P2's plan goes"
- [ ] **Step 5: One fresh reviewer on the whole branch; push; the pull request** ("The Rick and Morty adventure, P3: Small problems"), merged once CI is green.
