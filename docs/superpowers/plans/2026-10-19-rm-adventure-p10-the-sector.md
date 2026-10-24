# The Rick and Morty adventure, P10: The sector

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Episode 11, *The sector*, is built and played: one `all` step over Bird World, Gear World, Pluto and Planet Squanch, the first three made games. Bird World: pick up five crystals, two of them on the clay towers' tops, up drum flights where the clay crumbles. Gear World: wind the city's cogs in the dealt order before it runs down, while the gear police hunt. Pluto: tell the king only the claims on his palace that are true, with two checks. Squanch stays the 60-second escape it is.

**Architecture:** Bird World's climb takes things to pick up (`climb.picks`): the climb kind owns the win (every pick), the loss (a crumbling stair's bite), the count and the meter. Its ledges come from a pure generator, `dimensions/claytowers.js`, as Fantasy World's from `beanstalk.js`. Gear World's `sequence` runs with no start spot (the first cog starts the clock) and a generic `sequence.hunt` that sets the place's hunters on while the clock runs. Pluto's `deal` takes a fixed `bad` list and its own words. Each place names its own meter (`meterOf`), and the climb's and sequence's readouts take the place's words. The story's objective line and the map's marker follow the sector planet Morty is on (`here`). A planet page waits for the episode's closing line before it leaves (`leaveHold`). No new models, no audio.

**Tech Stack:** React 19, three.js, Vitest (node), Playwright-core on SwiftShader, Vite's `ssrLoadModule` for the check's data.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md`:
- §4: episode 11 is `all`: `task birdworld` ↑ · `task gearworld` ↑ · `task pluto` ↑ · `task squanch`.
- §5: Bird World "the crystals in the grass, some on the clay towers' tops" (`climb` + `collect`); Gear World "wind the city's cogs in order while the gear police hunt" (`sequence` + `hunt`); Pluto "tell the king what he wants to hear, and only the true parts" (`deal`). Every game: a goal, a way to fail with a quick retry back at the way in, a win that ticks the place's task; nothing done is undone; the hotspots' lines stay; `perks` taken, all zero.

**Index:** P10. What landed before: P0 #1089 to P9 #1240.

**Research:** four readers and a critic (scratch `p10/r-*.md`), then a design panel of three stances and a judge (scratch `p10/d-*.md`; this plan follows `d-judged.md`).

## Global Constraints

- `READY` is 11 at the end, and never lands before the three games (the old knock, hello and podium would pass their parts).
- `RmWorld.jsx` gets call sites and derived constants only (2416 → at most 2430). `rows1.js` stays under 700, `stage.js` under 540, `climb.js` under 200; new files under 250 (`claytowers.js` imports nothing).
- No new `requestAnimationFrame` (58/58), `eslint-disable` (54/54), cycle (5/5), model, audio file, library or light. `interiors/shell.js` (794 lines) is not touched.
- The frame at low stays under the 0.8M-triangle cap on each of the three planets (measured with `INFO=1`).
- Squanch's game, Gazorpazorp, `BIG`, `rickmorty/planets/` and `galaxy/surface/` are untouched. Achievements stay on their talks (`Achievements.jsx` untouched).
- Copy: British, curly quotes, no `!`, no Oxford comma, one sentence a toast. The planets' existing lines stay word for word; the three task names, their hints and the four part texts change. The hints keep "Land on".
- Every moved test assertion stays as strict, with a sentence each in its commit.

## Review Focus

1. **A picked crystal is gone** (its mesh and its prompt) and comes back with the climb after a catch; a crystal can't be picked from off its tower's top. Pinned in Task 4 (claytowers reach), Task 5 (`gone`) and Task 11.
2. **Gear World's police** start only with the first cog, stop on a win, on a catch and when the clock runs out, and never hunt once the task is done. Pinned in Task 3 (`sequence.hunt`) and Task 11.
3. **Pluto's loss** comes only from telling a false claim; a true one told, or a claim weighed, never loses; the podium no longer ticks the task. Pinned in Task 7 and Task 11.
4. **The objective line and marker in the sector**: in C-137, the `all` text and the garage portal; on a planet, that planet's part and its game; once its part is done, its portal. Pinned in Task 8 and Task 11.
5. **The closing line on a planet page**: the escape that ends episode 11 on Squanch's page holds 4 s for Morty's line before the page leaves. Pinned in Task 9 and Task 11.

---

### Task 1: The rules test walks each area's spots in a test of its own

**Files:** `src/components/rickmorty/world/rules.test.js` (the 'lets Morty stand close enough to every hotspot' test, about :1426-1434).

The test takes 4.2 s of its 5 s today; P10 adds spots. One generated `it` per area, the same body, the same assertions.

- [ ] **Step 1:** split it; run `npx vitest run src/components/rickmorty/world/rules.test.js`. Expected: PASS, every area under a second.
- [ ] **Step 2: Commit**: "The rules test walks each place's spots in a test of its own".

### Task 2: The climb takes things to pick up, and a climb with nothing to win is never won

**Files:** `world/games/climb.js` and `climb.test.js`; `dimensions/gameGoal.js` and its test; `dimensions/place.js` (`climb-pick-<id>` acts, the docs for `picks`, `meter`, `words`, `sequence.hunt`).

**Interfaces:**
- `newClimb({ ledges, stairs, top, foot, picks = [], perks })`: the state gains `picks`, `picked: []`.
- `stepClimb(game, { morty, pick = null }, dt)`: a pick that's one of `picks` and not yet picked is pushed onto `picked` with `{ type: 'pick', id }`; idle becomes run on `g.on || took`.
- The win: `(g.top != null || g.picks.length > 0) && (g.top == null || g.on === g.top) && g.picks.every((id) => g.picked.includes(id))`. A climb with neither a top nor picks is never won (the null === null trap).
- `WORDS.found(n, of)`; `climbReadout(g, words)` with picks: on while idle or running, the bar `round(100·picked/picks)`, the line the mood of the stair underfoot, else `words.found`; without picks, exactly today's.
- `gameGoal`: with picks, the first pick not picked.

- [ ] **Step 1: Write the tests** (a topless climb with no picks never wins; picks: the event, a start by a pick, a repeat pick ignored, the win on the last; the picks readout; the gameGoal branch). **Step 2:** run, FAIL. **Step 3:** implement. **Step 4:** run `npx vitest run src/components/rickmorty/world`, PASS. **Step 5: Commit.**

### Task 3: A place names its own meter, its words reach it, and a sequence with no start shows it from the first

**Files:** `games/meter.js` and test (`meterOf(d) → { kind, ...METER[kind], ...d[kind].meter }`; `METER` untouched); `games/sequence.js` and test (`sequenceReadout` on while idle when the game has no `start`; it takes words: `next`, `dark`, `again`); `dimensions/stage.js` (the picks: one pick a frame from the `climb-pick-*` actions, `picked` in the climb snapshot, `S.picked()`; the words passed to both readouts; `woundUp` so a finished sequence shows no meter; `sq.hunt`: `N.hunt(on)` while the clock runs and a `spotted` emit on `start`); `world/RmHud.jsx` (the meter from `meterOf`; icons `gem`, `cog`, `crown` from `react-icons/ri`).

- [ ] **Step 1: Write the tests** (`meterOf`, every game place's title its own; the idle readout with no start; the words). **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5: Commit.**

### Task 4: The clay towers' flights

**Files:** create `dimensions/claytowers.js` and `claytowers.test.js` (on `beanstalk.test.js`'s pattern).

**Interfaces:** `TOWERS` (tower-a at (−22, −15), r 2.0, 9 drums, ring 2.85, step 33°, from 40°, turn +1, stair `crumble-a`; tower-b at (20, −17), r 2.2, 11 drums, ring 3.05, step 30°, from 130°, turn −1, stair `crumble-b`); `RISE` 0.8, `DRUM` 0.9, `TRUNK` 0.4, `OFF` 1.0, `CRUMBLE` drums [3, 4, 5]; `claytowers() → { solids, stairs: [{ id, steps }], paths, spots: { 'bcrystal-west': { dx, dz, y: 8 }, 'bcrystal-east': { dx, dz, y: 9.6 } } }`; `CLAY_TOWERS`.

- [ ] **Step 1: Write the tests:** made once; each drum a circle ledge from the ground, tops 0.8 apart; only drum 1 in reach from the ground; each drum touches the next with no hop skipped; no top without its crumbling stair; each flight under one turn, inside the box, clear of the house and trees; each top crystal 1.0 m off its tower's centre and out of reach from off its top. **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5: Commit.**

### Task 5: Bird World plays its crystals

**Files:** `dimensions/rows1.js` (Bird World's row: `climb`, `goal: 'bcrystal-path'`, `done` removed, `unlock: { door: 'birdworld' }` kept, the five pick spots with `until: 'birdworld'`, the task name and hint, `...CLAY_TOWERS.solids` for the old tower posts); `dimensions/birdworld.js` (towers straight at their tops' radius and height, trunks r 0.4 rising 6 m, the canopy at top + 6; static drums in the `'solid'` list; the two crumbling groups posed by the stage; five pickable crystal meshes, hidden when picked or the task is done; the three decorative clusters the picks replace removed); `world/rules.js` (`nearHotspot(area, x, z, done, gone = null)`) and its test; `RmWorld.jsx` (`PICKS`, passed at the `nearHotspot` call); `destinations.test.js` (climb places `['birdworld', 'fantasy']`; the climb test's two branches; ledge places; Bird World's own test; every task's map spot one of its place's spots); `scripts/rm-story/places.test.mjs` (`USED`, the ledge `tower-b` at 9.6).

The crystals, in pick order (verb "Pick up", `who: null`):

| id | where | label | r | line |
| --- | --- | --- | --- | --- |
| `bcrystal-path` | (6, 9) | A crystal by the path | 1.4 | It hums in your hand and goes quiet in your pocket. |
| `bcrystal-trees` | (24, 14) | A crystal by the trees | 1.4 | A crystal the size of your fist, buzzing like a phone on silent. |
| `bcrystal-east` | tower-b's top, y 9.6 | The crystal on the east tower | 1.0 | The highest crystal on Bird World, still warm from the clay. |
| `bcrystal-west` | tower-a's top, y 8.0 | The crystal on the west tower | 1.0 | Grown right out of the clay up here, and it comes away clean. |
| `bcrystal-grass` | (−24, 8) | A crystal in the long grass | 1.4 | It sings one note as you lift it, and the grass leans after it. |

The climb: `{ task: 'birdworld', top: null, foot: null, spot: null, picks: [the five], stairs: CLAY_TOWERS.stairs, who: null, lost: 'The clay crumbled under you: a drum that cracks is about to go.', fell: 'A long way down, but the grass is soft.', words: { still: 'The clay’s holding: up you go', shiver: 'It’s cracking: off it before it crumbles', bite: 'It’s crumbling: wait till it holds', up: (m) => \`${m} m up the clay\`, found: (n, of) => \`${n} of ${of} crystals found\` }, meter: { title: 'Bird World’s crystals', label: 'Crystals', icon: 'gem' } }`. The task: 'Pick up Bird World’s crystals'; its hint: 'Land on Bird World in the Rick and Morty sector, and pick up the crystals round Birdperson’s house: three in the grass, and one up each clay tower, where the clay crumbles.'

- [ ] **Step 1: Write and move the tests.** **Step 2:** FAIL. **Step 3:** implement. **Step 4:** `npx vitest run src/components/rickmorty scripts/rm-story`, PASS. **Step 5: Commit.**

### Task 6: Gear World winds its cogs while the gear police hunt

**Files:** `dimensions/rows1.js` (Gear World's row), `dimensions/gearworld.js` (its turning meshes grouped by cog; only the cogs lit by the sequence turn; everything turns once done; Gearhead's sign always), `destinations.test.js` (sequence places `['gearworld', 'cablestudio']`; a place's sets share one verb, never 'Look', 'Switch on' pinned in the studio's test and 'Wind' in Gear World's; the start branches; the route from `sq.start ?? d.arrive`; Gear World's own test; the police), `places.test.mjs`.

The cogs (verb "Wind"; `need: 4`, `s: 45`, the order dealt each run): `cogs` (the great wheel, (9, −8), r 2.5, its line kept); `gcog-nw` The north-west cogs (−16, −9) 'A brass crank as tall as you, at the foot of a tower of gears.'; `gcog-ne` The north-east cogs (15.5, −10) 'The tallest tower’s crank, worn smooth by gear people’s hands.'; `gcog-se` The south-east cogs (17.5, 5) 'It clanks round once and the whole stack wakes up.'; `gcog-sw` The south-west cogs (−17.5, 6) 'The shortest tower’s crank, and the stiffest in the city.'

The police: `gpolice-a` (−12, 1) and `gpolice-b` (12, 0), `who: 'gromflomite'`, wandering short beats, `hunt: { speed: 2.6 | 2.8, catchR: 1.2, until: 'gearworld' }`, no `near`; their `say`: 'A gear cop' — 'A gear cop on his beat, in Federation blue.' / 'A gear cop by the square, watching who touches the cogs.' `gromflomite` joins the row's `kinds`. The sequence: `{ task: 'gearworld', items, need: 4, s: 45, hunt: true, who: null, lost: 'The city ran down before every cog was wound: back to the portal, and wind them again.', caught: 'He clamps a hand on your shoulder and marches you back to the portal, and every cog stops.', spotted: 'The gear police heard the city turn, and they’re coming for you.', words: { next, dark, again } (lower-casing the label), meter: { title: 'The city’s cogs', label: 'Time', icon: 'cog' } }`. `goal: 'cogs'`; `done` removed; `unlock: { gearhead: 'gearworld' }` kept. The task: 'Wind Gear World’s cogs'; its hint: 'Land on Gear World in the Rick and Morty sector, and wind the city’s cogs in the order the meter gives before the city runs down, with the gear police after you.'

- [ ] Steps 1–5 as Task 5.

### Task 7: Pluto tells the king only what's true

**Files:** `dimensions/rows1.js` (Pluto's row), `dimensions/pluto.js` (the two crest banners become four claim banners drawn with `fitText`; the king cheers and the rally hops as a claim is told), `destinations.test.js` (deal places `['needful', 'pluto']`; a fixed `bad` array: every id an item, none repeated, `bad.length < items.length`, `items − bad ≥ need`; Pluto's own test), `places.test.mjs`.

The claims (verb "Weigh up", r 1.2, at dz −13.2, `who: null`), west to east: `claim-growing` 'Pluto is growing' (false) 'Scroopy’s sign across the plain says otherwise, in red.'; `claim-moons` 'Pluto has two moons' (true) 'Two moons hang low over the palace, and the king has them counted every night.'; `claim-mines` 'Pluto has no mines' (false) 'Out past the plain the mine wheels are turning, all night long.'; `claim-planet` 'Pluto is a planet' (true) 'The king’s favourite, and the crowd mouths along before you’ve said it.' The deal: `bad: ['claim-growing', 'claim-mines']`, `need: 2`, `looks: 2`, `who: 'scroopy'`, `lost: 'That’s a lie, kid, and the whole plain heard it: back to the portal with you.'`, `words: { good: 'True: once more to tell the king', bad: 'Not true: leave it out', blind: 'No checks left: once more to chance it', taken: (n, need) => \`Told the king ${n} of ${need}\` }`, `meter: { title: 'The king’s ear', label: 'Checks', icon: 'crown' }`. `goal: 'claim-growing'`; `done` removed; `unlock: { podium: 'pluto' }` kept. The task: 'Tell the king what’s true'; its hint: 'Land on Pluto in the Rick and Morty sector, and tell the king only the claims on his palace that are true: weigh up two at most, and Scroopy calls out a lie.'

- [ ] Steps 1–5 as Task 5.

### Task 8: The story's line and marker follow the sector

**Files:** `adventure/hud.js` and test (`objectiveLine(story, prog, { planet, here, state, ...opts })`: an `all` part still to do at `planet?.id ?? here` reads that part's text, no link; `markedTask(state, next, { here, ...opts })`: the open part placed `here`, else the first open part); `episodes.js`'s four part texts (Bird World: pick up the crystals in the grass and on the clay towers’ tops. / Gear World: wind the city’s cogs in order while the gear police hunt you. / Pluto: tell the king what he wants to hear, and only the true parts. / Planet Squanch: raise a glass at the wedding, then get back to the portal in time.); `RmWorld.jsx` (`here: hud.area` passed; `DIALLED`; `toDest` and the `goalOf` guard admit dialled planets; `s.goal` kept for the check).

- [ ] Steps 1–5 as Task 2 (`hud.test.js:36` moves to the part's text, as strict).

### Task 9: A planet page holds for the episode's closing line

**Files:** `adventure/hud.js` and test (`SAID_MS = 4000`, `leaveHold(out) → SAID_MS | 0`); `RmWorld.jsx` (`tell` and `complete` return the out; the planet branch of `go()` waits `leaveHold(out)` before the fade).

- [ ] Steps 1–5 as Task 2.

### Task 10: The adventure at READY 11

**Files:** `episodes.js:21`; the frontier's tests (`episodes.test.js`, `story.test.js`, `hud.test.js`, `adventure.test.js`, `StoryList.test.jsx`, `EpisodeCard.test.jsx`); `scripts/rm-story/helpers.mjs` (`SECTOR`; `playTo` flattens `all` parts and seeds the Citadel's episode: `tp-citadel-done` with `citadelout`, the `enter` fed, a reload, the card), `late.mjs`'s episode-10 tail (card 11 straight after Morty's line, the sector's places, the sector's line with no link), `citadel.mjs` (card 11 after the closing line in `citadel-early` and `citadel-leave`).

- [ ] Steps 1–5 as P9's Task 2: the frontier's tests move as strict (after episode 10, 28 of 32 open; Heist-Con and the Vindicators on episode 11's note).

### Task 11: The story check plays episode 11

**Files:** create `scripts/rm-story/sector.mjs` (`episode-11` on a fresh save: each planet dialled and its game played, a loss and a retry in each; `sector-page`: a returner's old ticks pass their parts and their games rest; Squanch's page holds for Morty's line); `scripts/rm-story-check.mjs` (the import and the header).

- [ ] **Step 1: Write them.** **Step 2:** run against the dev server: PASS. Each scenario's first new assertion is checked to fail on the branch before Task 5 (the stash of Tasks 5–9), or by mutation where that's quicker.
- [ ] **Step 3: Commit.**

### Task 12: The guide tips the sector

**Files:** `guide/c137.js` ("The planets" tip: on the portal gun since episode 10; three tips on the end: 'Bird World', 'Gear World', 'Pluto'), `guide/pages.js` (a planet page's tip, 'The games'), `guide/pages.test.js` (C-137's tips' tail).

- [ ] Steps: test, FAIL, tips, PASS, commit.

### Task 13: Shots and hand-off

**Files:** `scripts/c137-shots.mjs` (stands `claytower` on tower-b's top facing the clearing, `gearsquare`, `palace`), `docs/superpowers/HANDOFF-worlds.md` (episode 11's paragraph; 'P10 in, P11 next'; the debts: code crystals and in-box gears, the touch meter on at arrival, 'Land on' hints for dialled places), the index (`:3`), delete the P9 plan.

- [ ] Shots before (main) and after, `INFO=1` triangles under the cap; hand-off; commit.

### Task 14: Prove it, review, PR, merge on green

- [ ] The four checks, `git checkout public/github.json`; the full story check; a review workflow (five dimensions and a skeptic each); one fix pass red to green; one PR; merge on green.
