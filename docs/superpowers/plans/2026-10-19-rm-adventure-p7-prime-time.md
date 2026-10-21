# The Rick and Morty adventure, P7: Prime time

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Episode 8, *Prime time*, is built and played: the cable studio becomes a game on the new `sequence` kind (start the countdown at the control booth, switch the sets on in the running order before the studio goes live; a wrong set turns them all dark), and Get Schwifty becomes a game on the new `rhythm` kind (take the mic: four lanes on the beat in a DOM overlay, the heads' meter kept up to the end of the song), with the audience cheering when it's won.

**Architecture:** `sequence` is a pure, import-free rule in `world/games/sequence.js`, taken by `place()` as a key and stepped by `dimensions/stage.js` inside the place's own update with a queue of presses, as P6's `find` is; it wins and fails through `done` (with its achievement) and `caught`, which RmWorld already handles. Its HUD is the one meter under a fifth title, and the map's marker follows it through `gameGoal`. `rhythm` is a pure rule in `world/games/rhythm.js` drawn by a DOM overlay, `games/Schwifty.jsx`, opened from the mic as the walkway cabinet is (RmWorld's `PLACES`), its win ticking the task through the overlay's `onTask`. A place with a world crowd cheers (its gatherings hop on a beat) when its game's task is done during a visit (`games/cheer.js`). Before any of it, the story check reads its places from the data and its scenarios move into `scripts/rm-story/`, and the guide's C-137 page moves into a file of its own.

**Tech Stack:** React 19, three.js, Vitest (node), Playwright-core on SwiftShader, Vite's `ssrLoadModule` for the check's data.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md` §4 (episode 8: `task cablestudio` ↑ · `task schwifty` ↑), §5 (the cable studio: "switch the channels' sets on in order before the studio goes live", new `sequence`: "spots in order, against a clock"; Get Schwifty: "four lanes on the beat; the heads' meter must stay up to the end", new `rhythm`: "a DOM overlay"; "every game has a goal, a way to fail with a quick retry, and a win that ticks the place's task as today; failing puts Morty back at the place's way in, as `caught` does; nothing done is undone; the hotspots' lines stay as the place's colour; each new kind takes `perks` with everything at zero"). `docs/superpowers/specs/2026-10-21-rm-worlds-not-rooms-design.md` "For P7" (the audience cheers when the overlay closes; the cable studio's floor stays clear, its clock tuned on it; the story check reads its coordinates from `DESTINATIONS`). Index: P7. What landed before: P0 #1089 to P6 #1120, the look change, the worlds pass #1138 (`ada5c478`). Research: five readers (scratch `p7/readers*.md`).

## Global Constraints

- `READY` is 8 at the end; episode 8's data in `episodes.js` stays as written.
- `RmWorld.jsx` gets call sites only: the `gameGoal` call gains `sequence`, and the overlay gets its lazy import, its `PLACES` row and its `Place` body row (2,412 → 2,416 lines).
- No new `requestAnimationFrame` (the overlay runs on `useFrameLoop`; loops stay 57/58), no `eslint-disable` (54/54), no file past 800 lines (`stage.js` 370 → about 440; `guide/pages.js` 804 → under 780; `scripts/rm-story-check.mjs` 757 → under 100; each new scenario file under 450).
- No new models and no new audio files: the sets' on-air lamps are code glows, as the trusses' lights are; the overlay plays the clips the site already carries (`showMe`, `likeWhatYouGot`, `disqualified` in `src/lib/clips.js`) and synthesised notes and kicks (`src/components/games/gameAudio.js`).
- The HUD meter is the one meter (`games/meter.js`), its numbers through refs; the overlay writes its notes' places and the heads' meter through refs too, and React draws only when what it draws changes.
- The kinds take `perks` and read none; no earn deed; `economy.js` and the arsenal's files (draft PR #1028) untouched.
- Copy: British, curly quotes, no `!`, no Oxford comma, one sentence a toast; the Cromulons' lines in capitals as the place's barks already say them (`SHOW ME WHAT YOU GOT.`, `I LIKE WHAT YOU GOT. GOOD JOB.`, `DISQUALIFIED.`); the places' existing lines stay word for word.
- Every moved test assertion as strict, a sentence each in its commit. New ids unique across the dimensions.

## Review Focus

1. **A returner with `cablestudio` or `schwifty` done** (the old collects ticked them, with no achievement): the booth only says its line, no meter shows, every set's lamp is lit, and the achievement is handed over on the visit (as the vat's is); the mic still opens the show, and its win changes nothing but the cards. Pinned in Task 6 and Task 9 (the stage skips a done task and grants once a visit) and Task 10 (the `returner` scenario).
2. **A wrong set before any is on**: the sets stay dark and the line says so, at no cost; a set already on, used again, costs nothing. Pinned in Task 4.
3. **Leaving the studio mid-run, or caught by the clock**: the place calms, the running order is dealt afresh and the clock is full; the booth starts it again. Pinned in Task 4 (`runningOrder`) and Task 10.
4. **The song paused or the tab hidden mid-song**: the song's clock stops (no step while paused), a long frame counts a tenth of a second at most, and the notes are where they were on Play on. Pinned in Task 7 (the clamp) and Task 8 (`keyFor`, the hidden-tab pause).
5. **Two lanes pressed in one frame**: each press is its own step and judges one note at most, the nearest in its own lane. Pinned in Task 7 ('one press hits one note') and Task 8 (the queue, one press a step).

---

### Task 1: The story check reads its places from the data, and its scenarios move out

**Files:** Create `scripts/rm-story/places.mjs`, `scripts/rm-story/places.test.mjs`, `scripts/rm-story/basics.mjs` (`episode-1`, `dial`, `ways`, `free-roam`, `returner`, `citadel`, `planet`, `toys`), `scripts/rm-story/early.mjs` (`episode-2` to `episode-4`), `scripts/rm-story/late.mjs` (`episode-5` to `episode-7`). Modify `scripts/rm-story-check.mjs` (the header, the runner and `SCENARIOS = { ...BASICS, ...EARLY, ...LATE }` in today's order), `scripts/rm-story/helpers.mjs` (`PLACES`, the loaded data; `PRIME = EPISODES[7]`).

**Interfaces:** Produces, in `places.mjs`:
- `stand(spot, face, off = 0.8) → [x, z, face]`: where Morty stands to use a spot facing `face`, `off` metres back along his heading (a figure facing `face` looks along (cos, −sin)): face N → z + off, −N → z − off, π → x + off, 0 → x − off.
- `wayIn(d) → d.arrive.z`; `home(d) → [d.back.x, d.back.z − 0.8, −N]` (the portal home, used facing it).
- `loadPlaces(root) → { dest(id), spot(area, id) }`: `DESTINATIONS` read through Vite (`createServer({ root, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' })`, `ssrLoadModule('/src/components/rickmorty/world/dimensions/destinations.js')`, closed once read), as `scripts/battlefront-balance.mjs` does; `spot` throws naming the place and the spot if either is missing.
- `helpers.mjs`: `export const PLACES = await loadPlaces(ROOT)`, and `at`-style calls become `goto(page, area, ...stand(PLACES.spot(area, id), face))`, `caught(page, wayIn(PLACES.dest(area)))`, `warpUse(page, area, `${area}-portal`, ...home(PLACES.dest(area)))`.

The destinations' coordinates (episodes 4 to 7: ways in, portals home, spots) are read from the data; C-137's own (the cable, the plumbus, the butter, the cabinet, the egg, Dr. Wong's door and couch, the agency's hole, the cruiser) stay as written. Where a spot's offset today isn't 0.8 (`zeepcells` and `gooble` 1.0, `vatrim` 1.4), `stand` takes that `off`.

- [ ] **Step 1: Write the tests** (`places.test.mjs`, importing `destinationById` from the source, which Vitest resolves): 'stands Morty in front of a spot, on the side he faces it from' (`stand({ x: -402, z: 1695 }, N)` ≈ `[-402, 1695.8, N]`; `stand({ x: -406.5, z: 1704.5 }, Math.PI)` ≈ `[-405.7, 1704.5, Math.PI]`; face 0 and −N; `off` 1.4); 'reads a place's way in and its portal home from the data' (`wayIn(destinationById('jerryboree'))` is 1703.4; `home(destinationById('jerryboree'))` ≈ `[-400, 1705.6, -N]`; the vat's way in 4207.4); 'finds every spot the check uses in the data' (each `[area, id]` the scenarios name, episode 8's included: `cablestudio` `cablebooth` and the seven sets, `schwifty` `mic`).
- [ ] **Step 2: Run** `npx vitest run scripts/rm-story` — Expected: FAIL (no `places.mjs`).
- [ ] **Step 3: Implement** `places.mjs`; move the scenarios into the three files unchanged but for the coordinates; the runner keeps its order, its seeds and its output.
- [ ] **Step 4: Run** `npx vitest run scripts/rm-story` — Expected: PASS. Then `node scripts/rm-story-check.mjs` against the branch's dev server — Expected: the same fourteen `ok` lines as on `main` (5199).
- [ ] **Step 5: Commit** — "The story check reads its places from the data, and its scenarios live in scripts/rm-story/"

### Task 2: The guide's C-137 page in a file of its own

**Files:** Create `src/components/guide/c137.js` (`export const C137 = { keys, touch, tips }`, moved word for word, with a header comment as `cybertron.js` has). Modify `src/components/guide/pages.js` (`'/c-137': { about: ABOUT['/c-137'], ...C137 }`), `src/components/guide/pages.test.js`.

- [ ] **Step 1: Write the test** — 'keeps C-137’s keys and tips in a file of their own': `guideFor('/c-137').tips` is `C137.tips`, `.keys` is `C137.keys`, `.touch` is `C137.touch`.
- [ ] **Step 2: Run** `npx vitest run src/components/guide` — Expected: FAIL (no `./c137`).
- [ ] **Step 3: Move** the block.
- [ ] **Step 4: Run** `npx vitest run src/components/guide src/lib/words.test.js` — Expected: PASS; `wc -l src/components/guide/pages.js` under 780.
- [ ] **Step 5: Commit** — "The guide's C-137 page has a file of its own: pages.js was past 800 lines"

### Task 3: The story at READY 8

**Files:** Modify `src/components/rickmorty/adventure/episodes.js` (`READY = 8`). Test: the adventure's tests.

- [ ] **Step 1: Move the tests** one episode on, as `e28b3f13` did for 7: `episodes.test.js` 'has thirteen episodes, the first eight ready' and a new 'goes on with Prime time: the cable studio, then Get Schwifty' (ids `['cablestudio', 'schwifty']`, places the same, unlocks `['fantasy', 'froopyland', 'dim35c']`); `story.test.js` `lockNote('fantasy')` 'Opens after episode 8, “Prime time”.', the long walk through episode 8 ("no card: episode 9 isn't built"), the crossing test's cards, and a new 'counts the cable studio done early, and opens episode 8 at Get Schwifty'; `hud.test.js` `markedTask` and `dialItems` at episode 8, the locked note after episode 7, `dialLead` at 7 and 8; `adventure.test.js` `jump(7)`, `jump(8)`, `jump(99)` stop at 8, `intro()` at 8 null, a P6 finisher gets 7, and a new 'opens episode 8 for a visitor who finished episode 7 before it was built'; `StoryList.test.jsx` eight ticks and a new 'ticks Get Schwifty done before its step comes up'; `EpisodeCard.test.jsx` 'names episode 8 too'.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure` — Expected: FAIL (at READY 7).
- [ ] **Step 3:** `export const READY = 8;`
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** — "The adventure at READY 8: episode 8 is built", naming each moved assertion.

### Task 4: The sequence kind's rules

**Files:** Create `src/components/rickmorty/world/games/sequence.js`, `sequence.test.js`.

**Interfaces:** Produces (import-free):
- `TUNING = Object.freeze({ s: 45, need: 5, low: 0.25 })`.
- `WORDS = Object.freeze({ next: (label, on, n) => \`${on} of ${n} on air: next, ${label}\`, dark: (label) => \`Wrong set, and they’ve all gone dark: start again with ${label}\`, again: (label) => \`That one’s on already: next, ${label}\` })`.
- `runningOrder(items, n, rand) → n distinct items`: a Fisher–Yates shuffle of a copy by `rand`, its first `n`.
- `newSequence({ items, order, s = TUNING.s, start = false } = {}) → { phase: 'idle', items, order, on: 0, start, left: s, len: s, last: null, told: false, events: [] }` (`perks` taken, none read; `start`: the run waits for the start spot).
- `stepSequence(prev, { use = null, start = false } = {}, dt = 1/60) → next` — over: nothing. `start` while idle with a start spot: `run`, event `start`. A `use` not in `items`: ignored. Idle with a start spot: a set's use is ignored. Idle without: a set's use starts the run (`start`) and is judged. Judged: `order[on]` → `on + 1`, `last = 'on'`, event `{ type: 'on', id }`, and at `on === order.length` `won` (`{ type: 'won' }`, no clock that step); one of `order` already on → `last = 'again'`; any other set → `on = 0`, `last = 'dark'`, event `{ type: 'dark', id }`. While running, `left -= min(dt, 0.1)`; at none `lost` (`{ type: 'lost', why: 'time' }`).
- `sequenceNews(g, { done, fading })` — as `findNews`.
- `sequenceReadout(g, labels = {}, words = WORDS) → { on, vitals: { value: round(left / len · 100), max: 100, low: left / len < low }, line }` — on only while running; `dark` → `words.dark(label of order[0])`, `again` → `words.again(label of order[on])`, else `words.next(label of order[on], on, order.length)`; a label missing is its id. Null → off.
- `litSets(g, done) → ids`: every one of `items` once done, else `order.slice(0, on)`.

- [ ] **Step 1: Write the tests**: waits, the clock still, till the countdown's started (a set used first does nothing); a place with no start spot starts at the first set used, and judges it; the sets on in order, won at the last, with its events; a wrong set turns them all dark and the clock runs on; a wrong set before any is on costs nothing but says dark; one already on again costs nothing; a use that isn't a set ignored; the clock run out loses, once; `dt` capped at 0.1; nothing changes once over; perks unread; `runningOrder` for rand 0, 0.5, 0.999999 (n distinct, all from `items`); `sequenceNews` in four cases; the readout (next with the count, dark, again, low under 25%, a missing label, null and undefined off); `litSets` (none idle, the first two after two, all once done); every `WORDS` line one sentence with no `!`.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/sequence.test.js` — Expected: FAIL (no module).
- [ ] **Step 3: Implement** in `find.js`'s shape.
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** — "The sequence kind's rules: the sets on in the running order before the studio goes live"

### Task 5: The one meter takes the sequence

**Files:** Modify `games/meter.js` (`KINDS` gains `'sequence'`; `METER.sequence = { title: 'Going live', label: 'Time' }`), `games/meter.test.js`, `world/RmHud.jsx` (`RiLiveLine` in `METER_ICON`), `world/world.css` (the sequence's percent hidden, as the find's is).

- [ ] **Step 1: Write the tests**: `METER_OFF` equals `sequenceReadout(null)`; `METER.sequence` is `{ title: 'Going live', label: 'Time' }`; the titles stay distinct.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/meter.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS.
- [ ] **Step 5: Commit** — "The one meter takes the sequence: going live"

### Task 6: The cable studio on a sequence

**Files:** Modify `dimensions/place.js` (the `sequence` key: `acts[item] = 'sequence-<item>'`, `acts[start] = 'sequence-start'`; documented), `dimensions/stage.js` (below), `dimensions/gameGoal.js` (the sequence's branch), `world/RmWorld.jsx` (`goalOf` passes `sequence: d.sequence && act(to, 'sequence')`), `dimensions/rows3.js` (the row), `dimensions/cable.js` (the lamps), `src/components/Achievements.jsx` (`cablestudio`'s `desc`). Test: `dimensions/destinations.test.js`, `dimensions/gameGoal.test.js`, `games/meter.test.js`.

**Interfaces:**
- The row (only what changes): the seven sets' verb 'Switch on', the booth's 'Start the countdown'; `collect` gone; `goal: 'cablebooth'`; `sequence: { task: 'cablestudio', start: 'cablebooth', items: ['set-ants', 'set-legs', 'set-sneezy', 'set-field', 'set-doors', 'set-bits', 'set-shmlo'], need: 5, s: 45, who: null, lost: 'The studio went live on dark sets: back to the door, and try the running order again.', unlock: 'cablestudio' }`; the task `{ id: 'cablestudio', name: 'Put the channels on air', hint: 'Dial the cable studio, start the countdown at the control booth, then switch the sets on in the running order before the studio goes live; a wrong set turns them all dark.' }`. `Achievements.jsx`: `cablestudio: { name: 'Between takes', desc: 'Put the channels on air before the cable studio went live' }`.
- `stage.js`: `fresh` deals `newSequence({ items, order: sq.order ?? runningOrder(sq.items, sq.need, Math.random), s: sq.s, start: Boolean(sq.start) })`; each item's spot queues a use, the start spot a start, stepped at no time in the place's own update, then the clock (`dt`); a `dark` heard (`state.emit('miss')`), as the find's wrong pick is; said through `told`; idle once its task's done; dealt afresh when the place calms. A place's achievement handed over once a visit when its task is done (`grant`, the freeze's `granted` moved into it, for the freeze and the sequence). The builder's lamps: `S.sequence({ lamps })`, `lamps` a map of a set's id to its glow mesh, its colour `setScalar(1)` when lit (`litSets`) and 0.15 when not. Actions: `sequence-<id>`, `sequence-start`, `sequence()` → `{ phase, order, on, left, len, last }`, `meter` → `sequenceReadout(g, labels)` (the spots' labels), DEV `setSequence(patch)`.
- `gameGoal(d, { …, sequence })`: not done and not lost: the start spot while idle (if the place has one), else `order[on]`.
- `cable.js`: a red on-air lamp over each set (a glow box, its own mesh a set, as the Microverse's battery is), above the set's solid on the side facing the floor.

- [ ] **Step 1: Write the tests** — 'a place that runs on a sequence': only the cable studio; every item a hotspot with a line, verb 'Switch on', `acts[id] === 'sequence-' + id`; the start a hotspot that isn't an item, `acts[start] === 'sequence-start'`, and the goal; `need` at most the items; the task its own; no collect and no `done` or `unlock` map ticks it; `lost` one sentence, no `!`, no 'Rick'; 'every running order the deal can give is walkable at a run in 60% of the clock' (from the start spot through every ordered `need` of the items, straight lines, at `MORTY.run`). `gameGoal.test.js`: 'walks him to the booth, then set by set in the running order' (idle → `cablebooth`; on 2 → `order[2]`; lost or done → null). `meter.test.js`: `kindOf(destinationById('cablestudio'))` is `'sequence'`.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/dimensions/destinations.test.js src/components/rickmorty/world/dimensions/gameGoal.test.js src/components/rickmorty/world/games/meter.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS.
- [ ] **Step 5: Commit** — "The cable studio is a sequence: the countdown at the booth, the sets on in the running order"

### Task 7: The rhythm kind's rules

**Files:** Create `src/components/rickmorty/world/games/rhythm.js`, `rhythm.test.js`.

**Interfaces:** Produces (import-free):
- `TUNING = Object.freeze({ bpm: 120, lead: 2, fall: 1.6, great: 0.06, good: 0.13, heads: 0.5, gain: { great: 0.05, good: 0.03 }, cost: { miss: 0.08, whiff: 0.03 }, low: 0.25 })`; `LANES = 4`.
- `SONG`: sixteen bars of eight slots (an eighth of a beat each: 0.25 s at 120), a lane's digit or `.`:
  `'0...1...', '2...3...', '0...2...', '1...3...', '0.1.2.3.', '3.2.1.0.', '0.2.1.3.', '0.0.3.3.', '0.11.2..', '3.22.1..', '0.1.2.33', '3.2.1.00', '0.1.2.3.', '01..23..', '0.2.1.3.', '0...3...'` (56 notes, the last at 33 s).
- `chartOf(song = SONG, { bpm, lead } = TUNING) → [{ id, t, lane }]`, sorted by `t`.
- `newRhythm({ song = SONG } = {}) → { phase: 'play', t: 0, notes: [{ id, t, lane, hit: null }], heads: TUNING.heads, streak: 0, hits: 0, misses: 0, beat: 0, last: null, events: [] }` (`perks` taken, none read).
- `stepRhythm(prev, { hit = null } = {}, dt = 1/60) → next` — over: nothing. `t += min(dt, 0.1)`; each beat passed (every 60/bpm s, to the last note) is an event `{ type: 'beat', n }`; a press in a lane hits the unjudged note in that lane nearest `t` within `good` (`great` within `great`): `hit` set, heads up by its grade's gain, `{ type: 'hit', id, lane, grade }`; with none in reach it's a whiff (`{ type: 'whiff', lane }`, heads down by `cost.whiff`); each unjudged note more than `good` past is missed (`hit: 'miss'`, `{ type: 'miss', id, lane }`, heads down by `cost.miss`); heads kept in [0, 1]; at none `lost` (`{ type: 'lost' }`); every note judged with heads left, `won` (`{ type: 'won' }`). `last` is the latest grade or `'miss'`/`'whiff'`.
- `inView(g) → [{ id, lane, y }]`: unjudged notes from `good` past to `fall` ahead, `y = 1 − (note.t − t) / fall` (0 at the top, 1 on the line).

- [ ] **Step 1: Write the tests**: the chart (16 bars, 56 notes on the eighths after the lead, lanes 0 to 3, ids distinct, sorted, the last at 33 s); a press inside the window hits (great close, good a little off), and outside it is a whiff; a note let past is a miss; one press hits one note, the nearest in its own lane; the heads kept between empty and full; won by a careful player and by one who hits two in three; lost by a sleeper, by one who hits half and by mashing every lane every eighth; lost the moment the heads empty, once, and nothing changes after; `dt` capped at 0.1; the beats ticked as they pass; perks unread; `inView` (a note on the line at 1, one `fall` ahead at 0, a judged one gone).
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/rhythm.test.js` — Expected: FAIL (no module).
- [ ] **Step 3: Implement** in `cabinet.js`'s shape.
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** — "The rhythm kind's rules: four lanes on the beat, the heads' meter up to the end"

### Task 8: The Get Schwifty overlay

**Files:** Create `world/games/Schwifty.jsx`, `world/games/schwiftyPlay.js`, `schwiftyPlay.test.js`, `world/games/schwifty.css`, `world/games/Schwifty.test.jsx`. Modify `src/components/games/gameAudio.js` (`schwiftyNote(lane)`: a square note at `[110, 131, 147, 165][lane]` Hz and its octave, as `schwifty` plays them; `kick()`: a short low sine), `world/RmWorld.jsx` (below).

**Interfaces:**
- `<Schwifty onWin={() => …} onLeave={() => …} />` fills its parent: `onWin` once a run, the moment it's won; `onLeave` from every way out; it owns Esc (`data-owns-escape`); stepped at a fixed 1/60 s by `useFrameLoop`, one press a step; the notes' places and the heads' meter written through refs; React draws when `drawn(g)` changes. DEV: `window.__SCHWIFTY__ = { state, phase, set(g), step(input) }`.
- `schwiftyPlay.js`: `LANE_KEYS = [['ArrowLeft', 'd', 'D'], ['ArrowDown', 'f', 'F'], ['ArrowUp', 'j', 'J'], ['ArrowRight', 'k', 'K']]`; `keyFor(phase, key, settling) → { hit: lane } | 'pause' | 'play' | 'leave' | 'hold' | null`, as the cabinet's; `drawn(g) → a string of the phase, the notes in view and the hits and misses`.
- Its cards: the intro ('Get Schwifty'; 'SHOW ME WHAT YOU GOT.'; 'Hit each note as it reaches the line, on the beat, and keep the heads’ meter up to the end of the song.'; the keys, or 'Tap a lane as its note reaches the line.' on a touch screen; Start, Leave), paused (Play on, Leave), won ('I LIKE WHAT YOU GOT. GOOD JOB.', the mic's own line from `SAY.mic`; Again, Leave), lost ('DISQUALIFIED.', 'The heads lost interest before the end of the song.'; Again, Leave). An end card holds keys, pads and taps 600 ms. Hidden, it pauses. A loss is retried from its own card, as the cabinet's is, and Morty is still at the mic when the show closes (the spec's "back at the way in" is for a game played in the world). A controller: the d-pad's four for the lanes, A starts and plays again, B leaves, Start pauses.
- Sounds: a hit plays its lane's note, a whiff `knock`, a miss `clang` (`lib/sfx`), a beat `kick`; Start plays `showMe`, a win `likeWhatYouGot`, a loss `disqualified` (`playClip`).
- Its look: the stage's lights (`--sch-*` tokens on `.schwifty`, a comment saying the colours are the show's stage, as `cabinet.css`'s are the marquee's); four lanes in the light towers' pink, yellow, cyan and green; lane buttons at least 44 px on a coarse pointer; text on glass at 0.84; under reduced motion no flash or bob, the notes still fall.
- `RmWorld.jsx`: `const Schwifty = lazy(() => import('./games/Schwifty.jsx').catch(() => ({ default: placeDown('The show', 'Back to the stage') })));` `PLACES.mic = { title: 'Get Schwifty', where: 'The Get Schwifty show', task: 'schwifty', full: true, wait: 'The heads are tuning in…' }`; the body's `mic: <Schwifty onWin={used} onLeave={onClose} />`.

- [ ] **Step 1: Write the tests**: `Schwifty.test.jsx` 'opens on its card: the show, the heads’ line, what to do and the keys' (the markup has 'Get Schwifty', 'SHOW ME WHAT YOU GOT.', the how line, `data-owns-escape`, a Start and a Leave button, four `class="schwifty-lane"`); `schwiftyPlay.test.js` 'hits a lane and pauses while playing', 'leaves on Esc from every card, the pause card too, where P plays on', 'holds every key on an end card that has only just come up', 'redraws for a hit, a miss and a note coming into view, not for one falling'.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games` — Expected: FAIL.
- [ ] **Step 3: Implement** in `Cabinet.jsx`'s shape.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty src/components/games && npx eslint src/components/rickmorty src/components/games` — Expected: PASS.
- [ ] **Step 5: Commit** — "Get Schwifty's show: four lanes on the beat over the page, the heads' meter up to the end"

### Task 9: Get Schwifty plays the show, and a crowd cheers a game won

**Files:** Create `world/games/cheer.js`, `cheer.test.js`. Modify `dimensions/place.js` (the `rhythm` key, passed through; documented), `dimensions/rows2.js` (the row), `dimensions/stage.js` (the rhythm's achievement through `grant`; the cheer), `src/components/Achievements.jsx` (`schwifty`'s `desc`). Test: `dimensions/destinations.test.js`.

**Interfaces:**
- The row (only what changes): `collect` gone; `goal: 'mic'`; `rhythm: { task: 'schwifty', spot: 'mic', unlock: 'schwifty' }`; the task's hint 'Dial the Get Schwifty show and take the mic: hit the notes on the beat, and keep the heads’ meter up to the end of the song.' `Achievements.jsx`: `schwifty: { name: 'I like what you got', desc: 'Kept the heads’ meter up to the end of the song at the Get Schwifty show' }`.
- `cheer.js` (import-free): `CHEER = Object.freeze({ s: 6, beat: 0.5 })`; `newCheer() → { seen: null, till: -1, next: 0, hop: false }`; `stepCheer(c, { done, t }) → c'` — the first step of a visit only notes `done`; `done` going from false to true starts a cheer till `t + s`; `hop` is true on each beat of it (`t ≥ next`, then `next += beat`).
- `stage.js`: a place with a world crowd and a game (`power`, `deal`, `freeze`, `find`, `sequence` or `rhythm`) steps the cheer each frame on its game's task, hopping its gatherings (`round.actions.hop()`) when it says; calmed, the cheer starts afresh. The rhythm's achievement handed over once a visit when its task is done (`grant`).

- [ ] **Step 1: Write the tests** — `cheer.test.js`: nothing on the first step of a visit, done or not; a cheer on the beat for six seconds from the step the task's done; no second cheer while it stays done; a fresh cheer after `newCheer`. `destinations.test.js` 'a place that plays a rhythm': only Get Schwifty; its spot a hotspot with its line and verb 'Get schwifty', and the goal; its task its own; no collect and no `done` or `unlock` map ticks it.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/cheer.test.js src/components/rickmorty/world/dimensions/destinations.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS.
- [ ] **Step 5: Commit** — "Get Schwifty plays the show at the mic, and a place's crowd cheers its game won"

### Task 10: Episode 8 in the browser check

**Files:** Modify `scripts/rm-story/late.mjs` (`episode-7`'s tail; `episode-8`), `scripts/rm-story/basics.mjs` (`returner`).

- [ ] **Step 1: Write the scenarios.** `episode-7`'s tail at READY 8 (Morty's line, `cardFor(page, 7)`, at 7.0, `JERRY.unlocks` open, `PRIME.unlocks` shut, the objective `PRIME.steps[0].text`); its old last checks move to `episode-8`. **`episode-8`**: `playTo(page, 7, ['cabinet', 'chase'])`; the cable studio: idle; a set used before the booth leaves it idle; the booth starts it, the meter 'Going live' on; the first two of the running order (read from `sequence()`) switched on; a wrong set → none on, not done; `setSequence({ left: 0.05 })` → caught at its way in, idle, not done; the booth again and every set in order → the task's toast and 'Between takes', at 7.1; home. Get Schwifty: the mic opens `.rm-place[data-place="mic"]`, nothing done; a run set one miss from empty and stepped → the lost card, nothing done; Again, a run set at its last note and stepped with the hit → won: the task counted while the show's up, the closing line and no card held till it closes; Leave → the episode's closing line, 'I like what you got', at 8.0, every place open, no card (episode 9 isn't built), the checklist's line. **`returner`**: the seed gains `cablestudio`: at the studio the booth leaves the sequence idle, no meter, and 'Between takes' is handed over.
- [ ] **Step 2: Run** `node scripts/rm-story-check.mjs episode-7 episode-8` on `main` (5199) — Expected: FAIL.
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` on the branch — Expected: all fifteen ok.
- [ ] **Step 4: Commit** — "Episode 8 plays through in the browser check: the cable studio and Get Schwifty"

### Task 11: The guide

**Files:** Modify `src/components/guide/c137.js`.

- [ ] **Step 1: Add** the keys group `{ label: 'Get Schwifty', rows: [['← ↓ ↑ → / D F J K', 'Hit the first, second, third or fourth lane'], ['P / Esc', 'Pause']] }` after Plumbus Smash's, the touch group `{ label: 'Get Schwifty', rows: [['Tap', 'Hit a lane']] }`, and on the end of the tips `['The cable studio', 'Every channel’s set on one floor, and the studio about to go live. Start the countdown at the control booth, then switch the sets on in the running order the meter gives; a wrong set turns them all dark, and when the clock runs out you’re back at the door.']` and `['Get Schwifty', 'Take the mic and the heads want a song. Hit each note as it reaches the line, on the beat; a miss or a wild swing costs the heads’ meter, and if it empties before the end of the song you’re disqualified.']`.
- [ ] **Step 2: Run** `npx vitest run src/components/guide src/lib/words.test.js` — Expected: PASS.
- [ ] **Step 3: Commit** — "The guide has the cable studio and Get Schwifty"

### Task 12: Prove it and hand it over

**Files:** Modify `docs/superpowers/HANDOFF-worlds.md` (the sequence and rhythm kinds; P7 in, P8 next; the check's places from the data and its scenarios in `scripts/rm-story/`; the guide's C-137 page in `guide/c137.js`; follow-ups found on the way), `docs/superpowers/plans/2026-10-19-rm-adventure.md` (line 3: P0's to P6's plans have gone; P7's is this).

- [ ] **Step 1: Shoot before and after**: `HUD=1 INFO=1 BACK=1 scripts/c137-shots.mjs cablestudio schwifty` on `main` (5199, taken) and the branch (5197); the check's game shots (`OUT`); the overlay and the meter's longest line at 390 × 844.
- [ ] **Step 2: Run the four** — Expected: green, budgets as above.
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` on the dev server — Expected: every scenario ok.
- [ ] **Step 4: Commit** the hand-off — "The worlds' hand-off: episode 8"
- [ ] **Step 5: One fresh reviewer on the whole branch; push; the pull request** ("The Rick and Morty adventure, P7: Prime time"), merged once CI is green.
