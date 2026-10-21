# The Rick and Morty adventure, P6: The Jerry problem

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Episode 7, *The Jerry problem*, is built and played: the Jerryboree becomes a game on the new `find` kind (talk to the Jerrys, take ours by what only he'd do, a wrong pick costs time) and St. Gloopy Noops becomes a hunt from the existing keys (past the doctors to the theatre, take back Jerry's things, out through the portal on the clock).

**Architecture:** `find` is a pure, import-free rule in `world/games/find.js`, taken by `place()` as a key and stepped by `dimensions/stage.js` inside the place's own update with a queue of presses, as P5's `deal` is; it wins and fails through `done` (with its achievement) and `caught`, which RmWorld already handles, so RmWorld changes by no line. Its HUD is the one meter (`games/meter.js`) under a fourth title. St. Gloopy Noops is data plus a few builder lines on Anatomy Park's pattern (P3).

**Tech Stack:** React 19, three.js, Vitest (node), Playwright-core on SwiftShader.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md` §4 (episode 7: `task jerryboree` · `task gloopynoops`), §5 (the Jerryboree: "find your Jerry among the Jerrys by what only he'd do; a wrong pick costs time", new `find`; St. Gloopy Noops: "get past the doctors to the theatre, take back what's Jerry's, get out", `hunt` + `collect` + `escape`; "every game has a goal, a way to fail with a quick retry, and a win that ticks the place's task as today; failing puts Morty back at the place's way in, as `caught` does; nothing done is undone; the hotspots' lines stay as the place's colour; each new kind takes `perks` with everything at zero"). Index: P6. What landed before: P0 #1089, P1 #1097, P2 #1099, P3 #1109, P4 #1113, P5 #1118 (`d0851468`). Research: four readers and a critic (scratch `p6/*.md`, its drafts verified against the whole Rick and Morty suite).

## Global Constraints

- `READY` is 7 at the end; episode 7's data in `episodes.js` stays as written.
- `RmWorld.jsx` is not touched (every path it needs exists); no new `requestAnimationFrame` (loops 57/58); no `eslint-disable` (54/54); no file past 800 lines (`guide/pages.js` 791 → 793, `scripts/rm-story-check.mjs` 674 → about 757).
- No new models: the candidates are the Jerrys the room already stands (four standing crowd figures become people); the doctors are glip-glop copies (rigged, with a run clip); the theatre's sign is a decal, as the gloop sign is.
- The HUD meter is the one meter (`games/meter.js`), its numbers through refs.
- The kind takes `perks` and reads none; no earn deed; `economy.js`, `earn.js` untouched.
- Copy: British, curly quotes, no `!`, no Oxford comma, one sentence a toast; a line said in a doctor's voice (`caught`, `spotted`) never starts "A doctor" (the toast names the speaker); a tell is 36 characters or fewer with no `:`, `.` or `!`; the places' existing lines stay word for word.
- Every moved test assertion as strict, a sentence each in its commit. New ids unique across the dimensions.

## Review Focus

1. **A returner with `jerryboree` done** (the old talk ticked it, with its achievement): the find stays idle, no meter shows, talking only says the lines. Pinned in Task 4 (the stage skips a done task) and Task 6 (the `returner` scenario).
2. **A returner with `gloopynoops` done**: the doctors hunt as they do for anyone, and the way out earns 'Visiting hours'. Pinned in Task 5 (no `until` on the hunt).
3. **Two presses in one frame, and a wrong Jerry pressed again**: both presses count (the queue); a repeat on a wrong Jerry costs nothing more and says so. Pinned in Task 2 (`again`) and Task 6.
4. **Leaving mid-find**: the place calms, ours is dealt afresh and the clock is full. Pinned in Task 4 (the composite `calm`) and Task 6.
5. **Ours never given away**: the stage's snapshot leaves out `ours`, and the map's marker points at the desk, never at a Jerry. Pinned in Task 4 (the goal is a hotspot, not an item).

---

### Task 1: The story at READY 7

**Files:** Modify `src/components/rickmorty/adventure/episodes.js` (`READY = 7`). Test: the adventure's tests.

- [ ] **Step 1: Move the tests** with `scratchpad/p6research/fix7.py` (each substitution asserts its old text occurs once): READY 7; 'goes on with The Jerry problem'; the real story through episode 7; a task of episode 7 done early; the dial after episode 6 and 'Opens after episode 7, “The Jerry problem”.'; `jump(6)`, `jump(7)`, `intro()` for a P5 finisher → 6; StoryList's seven ticks; 'names episode 7 too'.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure` — Expected: FAIL (13, at READY 6).
- [ ] **Step 3:** `export const READY = 7;`
- [ ] **Step 4: Run** the same — Expected: PASS (82).
- [ ] **Step 5: Commit** — "The adventure at READY 7: episode 7 is built", naming each moved assertion.

### Task 2: The find kind's rules

**Files:** Create `src/components/rickmorty/world/games/find.js`, `find.test.js`.

**Interfaces:** Produces (import-free):
- `TUNING = Object.freeze({ s: 45, cost: 15, low: 0.25 })`; `WORDS = Object.freeze({ heard: (tell) => \`${tell}: once more to take him\`, wrong: 'Not ours: that cost you time', again: 'Not ours: leave him be', ours: 'He does what only ours would', other: 'He does what any of them would' })`.
- `newFind({ items, ours, s = TUNING.s, cost = TUNING.cost, perks } = {}) → { phase: 'idle', items, ours, left: s, len: s, cost, heard: [], wrong: [], last: null, lastId: null, told: false, events: [] }` — `perks` taken, none read.
- `stepFind(prev, { use = null } = {}, dt = 1/60) → next` — over: nothing. A `use` that isn't a candidate is ignored (the clock still runs). A candidate's first use starts the run (`start`). A Jerry already wrong: `last = 'again'`, nothing more. Not yet heard: `heard` gains him, `last = 'heard'`, `lastId` him, event `{ type: 'talk', id }`. Heard and ours: `won` (`{ type: 'won', id }`). Heard and not ours: `wrong` gains him, `left = max(0, left − cost)`, `last = 'wrong'`, event `{ type: 'wrong', id }`. While running, `left -= min(dt, 0.1)`; at none `lost` (`{ type: 'lost', why: 'time' }`), in the same step as a wrong pick that empties it.
- `pickOurs(items, rand) → items[min(n − 1, floor(rand() · n))]`.
- `findNews(g, { done, fading })` — as `dealNews`.
- `findReadout(g, tells = {}, words = WORDS) → { on, vitals: { value: round(left / len · 100), max: 100, low: left / len < low }, line }` — on only while running; after a talk `words.heard(tells.ours ?? words.ours)` if it was ours, else `words.heard(tells[lastId] ?? words.other)`; else `words[last]`. Null → off.

- [ ] **Step 1: Write the tests**: idle with the clock still; a non-candidate ignored; talk then take wins, with its events; a wrong pick costs once and `again` adds nothing; the clock run out loses; the third wrong pick at 45/15 loses in the same step; `dt` capped at 0.1; nothing changes once over; perks unread; `pickOurs` for rand 0, 0.4, 0.999999 and 1; `findNews` in four cases; the readout (heard ours and other, wrong at 67, again, low under 25%, the defaults, null and undefined off); every `WORDS` line one sentence with no `!`.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/find.test.js` — Expected: FAIL (no module).
- [ ] **Step 3: Implement** in `deal.js`'s shape.
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** — "The find kind's rules: talk to the Jerrys, take ours, a wrong pick costs time"

### Task 3: The one meter takes the find

**Files:** Modify `games/meter.js` (`KINDS` gains `'find'`; `METER.find = { title: 'Pick-up time', label: 'Time' }`), `games/meter.test.js`, `world/RmHud.jsx` (`RiTimerLine` in `METER_ICON`), `world/world.css` (the find's percent hidden).

- [ ] **Step 1: Write the tests**: `METER_OFF` equals `findReadout(null)`; `METER.find` is `{ title: 'Pick-up time', label: 'Time' }`; the titles stay distinct.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/meter.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS.
- [ ] **Step 5: Commit** — "The one meter takes the find: pick-up time"

### Task 4: The Jerryboree on a find

**Files:** Modify `dimensions/place.js` (the `find` key: `acts[id] = 'find-<id>'`; documented), `dimensions/stage.js` (the find stepped: presses at `dt` 0, then the clock; `done` with `unlock`; `calm` deals ours afresh; actions `find-<id>`, `find` (no `ours`), `meter`, DEV `setFind`), `dimensions/rows1.js` (the row), `dimensions/jerryboree.js` (its header comment), `world/voicelines.js` (the four new Jerrys in Jerry's voice). Test: `dimensions/destinations.test.js`, `games/meter.test.js` (`kindOf(jerryboree)` is `'find'`).

**Interfaces:** the row (only what changes):
- People added after `jerrytv`: `{ id: 'jerrygown', who: 'jerry-gown', dx: -8.4, dz: -0.6, face: -0.4 }`, `{ id: 'jerrytux', who: 'jerry-tux', dx: -4.4, dz: -6.2, face: -1.2 }`, `{ id: 'jerrytrack', who: 'jerry-track', dx: 1.6, dz: -6.4, face: 1.2 }`, `{ id: 'jerryrobe', who: 'jerry-robe', dx: 8.6, dz: -6.4, face: 2.6 }`; the same four standing extras removed (the wanderers and the golf Jerry by the way in stay crowd).
- Spots at their people, verb 'Talk': 'A Jerry in a hospital gown', 'A Jerry in a bow tie', 'A Jerry in a tracksuit', 'A Jerry in a bathrobe'; lines (`who: 'A Jerry'`): 'They said it was a check-up, and I’ve been in this gown since March.', 'My Rick said we were going somewhere fancy, so I’ve been ready since Tuesday.', 'I’m training for something, and they’ll tell me what when I’m ready.', 'Every day’s a robe day in here, and nobody judges you for it.'
- `find: { task: 'jerryboree', items: ['jerryreal', 'jerrytv', 'jerrygown', 'jerrytux', 'jerrytrack', 'jerryrobe'], tells: { ours: 'He asks if you’re hungry for apples', jerryreal: 'He asks if Beth’s here', jerrytv: 'He shushes you for his programme', jerrygown: 'He asks if you’re the doctor', jerrytux: 'He asks when his Rick’s coming', jerrytrack: 'He asks if you’re hungry for pears', jerryrobe: 'He asks if you’re his Morty' }, s: 45, cost: 15, who: 'receptionist', lost: 'Pick-up’s closed: back to the door, and find the right one this time.', unlock: 'jerryboree' }`; `goal: 'receptionist'`; `done` and `unlock` maps emptied (the win carries the achievement); hint 'Dial the Jerryboree and talk to the Jerrys: ours asks if you’re hungry for apples, as he does at home, and a wrong pick costs time.'

- [ ] **Step 1: Write the tests** — 'a place that runs on a find': only the Jerryboree; every item a person and a hotspot with a line, `acts[id] === 'find-' + id`, verb 'Talk'; each item a tell, distinct, 36 characters or fewer, no `!:.`; the task its own; the goal a hotspot and not an item; no `done` ticks the task and the `unlock` map doesn't name it; `lost` one sentence, no `!`, no 'Rick'; the pinned key (`ours` undefined), goal, `done {}`, `unlock {}`. `meter.test.js`: `kindOf(destinationById('jerryboree'))` is `'find'`.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/dimensions/destinations.test.js src/components/rickmorty/world/games/meter.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS (the walk-to, nearest and no-link checks include the new spots).
- [ ] **Step 5: Commit** — "The Jerryboree is a find: talk to the Jerrys, take ours, a wrong pick costs time"

### Task 5: St. Gloopy Noops' doctors

**Files:** Modify `dimensions/rows2.js` (the row), `dimensions/gloopynoops.js` (the theatre's sign; `collected` sets every doctor going). Test: `dimensions/destinations.test.js`.

**Interfaces:** the row (only what changes): three doctors after `gjerry`, each `who: 'glipglop'` — `gdoctor-a` (-14, -4, E; wander `[[-14,-4],[-16,-12],[-8,-12],[-8,-2]]`, 1.1, pause 1.5; hunt speed 3.0), `gdoctor-b` (-14, -7, E; `[[-14,-7],[14,-7]]`, 0.9, 2; 2.8), `gdoctor-c` (14, -4, W; `[[14,-4],[18,-12],[10,-14],[10,-2]]`, 1.2, 1.2; 3.2), each hunt `catchR: 1.3, near: 4.5, lose: 8`, no `until`; a spot `{ id: 'jerrysthings', dx: 2.6, dz: -13.2, label: 'Jerry’s things', verb: 'Take back' }` with its line 'A bag by the bed tagged SMITH, J., with Rick’s chip still sewn into the lining of Jerry’s wallet.'; `say` entries naming the doctors for a catch's speaker (`who: 'A doctor'`; texts 'A doctor on his rounds, looking for a Jerry.', 'A doctor between the beds, his clipboard out.', 'A doctor by the doors, scrubbed and waiting.', never shown as a toast); `collect: { task: 'gloopynoops', spots: ['shrimply', 'jerrysthings'], escape: { s: 30 } }`; `goal: 'jerrysthings'`; `spotted` 'His eyes swing round on their stalks, and he’s coming for you.'; `caught` 'He takes you kindly by the elbow and walks you back to the portal, and Jerry’s things go back by the bed.'; the task 'Take back what’s Jerry’s', hint 'Dial St. Gloopy Noops, get past the doctors to the theatre at the end of the ward, visit Shrimply Pibbles and take back Jerry’s things, then get back through the portal before the clock runs out.'

- [ ] **Step 1: Write the tests** — 'St. Gloopy Noops is a hunt': its collect, goal; its hunters exactly the three doctors, each a glip-glop that roams, none a hotspot, each with a `say` name; no `done` and no `unlock`; `caught`, `spotted` and the new line one sentence each with no `!`; the new spot's verb isn't 'Look'.
- [ ] **Step 2: Run** the destinations test — Expected: FAIL.
- [ ] **Step 3: Implement** (the builder: the sign a decal over the bed's bay; `area.actions.collected = () => S.hunt(true)`).
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS.
- [ ] **Step 5: Commit** — "St. Gloopy Noops is a hunt: past the doctors to the theatre, Jerry's things back, out on the clock"

### Task 6: Episode 7 in the browser check

**Files:** Modify `scripts/rm-story-check.mjs`, `scripts/rm-story/helpers.mjs` (`JERRY = EPISODES[6]`).

- [ ] **Step 1: Write the scenarios.** `episode-6`'s tail at READY 7 (Morty's line, `cardFor(page, 6)`, at 6.0, DEALS.unlocks open, JERRY.unlocks shut, the objective `JERRY.steps[0].text`); its old last checks move to `episode-7`. **`episode-7`**: `playTo(page, 6, …)`; the Jerryboree: idle; `setFind({ ours: 'jerryreal' })`; talk to the TV Jerry (heard, the meter 'Pick-up time' on), take him (wrong, 15 s gone, not done); the clock run out → caught at z 1703.4, idle, not done; `setFind({ ours: 'jerryreal' })` again, Jerry by the door talked to and taken → the task's toast and 'The right Jerry', at 6.1; home. St. Gloopy Noops: caught by a doctor once (z 3112.4); then Shrimply and Jerry's things in a bounded retry till the clock runs; out through the portal; the episode's closing line, 'Visiting hours', at 7.0, every place open, no card, the cable hint. **`returner`**: the seed gains `jerryboree`; at the Jerryboree two presses on a Jerry leave the find idle with no meter.
- [ ] **Step 2: Run** `node scripts/rm-story-check.mjs episode-6 episode-7` on `main` (5198) — Expected: FAIL.
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` on the branch — Expected: all thirteen ok.
- [ ] **Step 4: Commit** — "Episode 7 plays through in the browser check: the Jerryboree and St. Gloopy Noops"

### Task 7: The guide

**Files:** Modify `src/components/guide/pages.js` (two tips on the end of `/c-137`'s list).

- [ ] **Step 1: Add** `['The Jerryboree', 'A daycare for Jerrys, and one of them is ours. Talk to them: ours asks if you’re hungry for apples, as he does at home, and talking to him again takes him. A wrong pick costs time, and when the clock runs out you’re back at the door.']` and `['St. Gloopy Noops', 'The hospital in space, where the doctors want something of Jerry’s. Get past them to the theatre at the end of the ward, visit Shrimply Pibbles and take back Jerry’s things, then get out through the portal before the clock runs out; caught, you’re back at the door.']`.
- [ ] **Step 2: Run** `npx vitest run src/components/guide src/lib/words.test.js` — Expected: PASS.
- [ ] **Step 3: Commit** — "The guide has the Jerryboree and St. Gloopy Noops"

### Task 8: Prove it and hand it over

**Files:** Modify `docs/superpowers/HANDOFF-worlds.md` (the find kind; St. Gloopy Noops' hunt; P6 in, P7 next; follow-ups: the find's clock runs while Things to do is open, the find can start before the Jerrys' models are in, Jerry by the door still barks "Tell them I’m your Jerry" when he isn't ours, the marker stays on the desk and on Jerry's things, the four new Jerrys' lines wait for a voices run, St. Gloopy Noops' clock run out only stops the clock, the doctors hunt returners too, the check near 760 lines so P7 moves the episode scenarios out first, `pages.js` at 793 so the C-137 tips move to their own file before any phase passes 800, the stage's news block now four copies to extract before P7 or P8; St. Gloopy Noops now earns its achievement), `docs/superpowers/plans/2026-10-19-rm-adventure.md` (line 3 names P6's plan). Delete `docs/superpowers/plans/2026-10-19-rm-adventure-p5-bad-deals.md`.

- [ ] **Step 1: Shoot before and after**: `HUD=1 scripts/c137-shots.mjs jerryboree gloopynoops` on `main` (5198) and the branch (5197); the check's game shots; a phone-width shot of the find's longest line.
- [ ] **Step 2: Run the four** — Expected: green, budgets as above.
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` on the dev server and a DEV-flavoured build — Expected: every scenario ok.
- [ ] **Step 4: Commit** the hand-off — "The worlds' hand-off: episode 7, and P5's plan goes"
- [ ] **Step 5: One fresh reviewer on the whole branch; push; the pull request** ("The Rick and Morty adventure, P6: The Jerry problem"), merged once CI is green.
