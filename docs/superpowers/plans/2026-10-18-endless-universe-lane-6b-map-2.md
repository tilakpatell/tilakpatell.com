# Endless universe, lane 6b: the map, second half. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The nav map shows the endless universe. It draws the generated places and things round the ship by level of zoom, the events going on, the places you've been or seen named, and other pilots, far fights and traffic at their heights. It searches the hand-made, the known and the in-view places, and it sends you to any of them. Long trips are timed by lane 3's formula, never flown in a simulation.

**Architecture:**
- **The scene's side.** These modules run on the main thread and read only the sectors lane 2 already has. They never make one.
  - `universe/charted/pick.js` says which generated places a view of the chart lists, from lane 2's 3 × 3 × 3.
  - `universe/charted/known.js` keeps the places you've visited or seen named. It uses ids only, in a new table, `universe-known`, in a database of its own (`tp-universe`, from `universeStore()` beside `worldStore()`), so `tp-store`'s version and its open tabs are untouched (finding 2).
  - `universe/charted/sceneChart.js` does four things:
    - it records each arrival and each name shown
    - it names and places what the chart lists through lane 3's resolver
    - it asks the worker pool itself, under a key of its own, for the sector of a known place in the view's range, of one of the nearest gargantuans, or, at the universe level, of the nearest known places past the range (to pin to the rim). It asks one sector at a time and nearest first, each as soon as the last has landed, last in the pool's queue and only while the pool's `expanse` workers have nothing else. While the search box holds a query, it takes the known places outside the range too. It keeps light rows from it and lets the sector go, so it never enters lane 3's four fetched sectors (finding 16). Its work off an answer goes in chunks, each timed.
    - it answers the nav map's ask, at most `CHARTED.max` rows in all
  - `universe/whereNow.js` is `where()`, moved out of `scene.js` to pay for the wiring. It gains the pilots' heights and the traffic. The far fights' label comes in as a dep, so it stays free of three.js.
- **The page's side** (no generator behind it):
  - `chart/generated.js` turns a destination into a light row and a row into a mark. It also says each kind's levels and when the chart asks again.
  - `chart/navList.js` holds the nav map's list rules: the first pick, a light pick's card and its mark, the groups and the cap, the order of the known, which places the camera goes to, and the holder's line.
  - `chart/useCharted.js` asks the scene at most once a second, and again on a real move or when a search begins. It lets go of an answer that isn't one.
  - `chart/marks.js`'s `liveMarks` reads the heights, the traffic, the events and the way back.
  - `NavChart.jsx` draws them. Every generated mark ranks under every hand-made place and gives way to it (lane 6a's `place.js` gains `yields`), so the portfolio's names read first. The way back, and the nearest places you know past the widest range, are pinned to the rim however far off they are (`pin`).
  - `NavMap.jsx` lists, searches, picks and times generated places through lane 3's `{ place }` lookup.
- **`nav.js`'s `tripTime`** takes lane 3's formula straight away for a trip the 150 s simulation can't finish.
- **The no-3D mini-map** keeps lane 6a's projection and its hand-made marks. With 3D off no scene runs, and the page never makes a sector (finding 11).
- **Two PR groups on the one branch.** The coordinator merges every lane, so this plan opens no pull request.
  - **6b.1, the pure half** (Tasks 1–6). Nothing on screen changes.
  - **6b.2, wired and drawn** (Tasks 7–12). The nav map's picture changes. The 3D scene's doesn't.

**Tech Stack:**
- React 19
- Vitest (`renderToStaticMarkup` for the chart; `fake-indexeddb` for the store, as `src/runtime/store.test.js` uses it)
- the Playwright check scripts under `scripts/`

**Spec:** `docs/superpowers/specs/2026-10-18-endless-universe-design.md`. This lane is:
- section F's levels by zoom for generated content, "Generated places are destinations" on the map, search, "Trip times for long trips come from a formula", and "Always honest"
- section G's known-places table (finding 1)
- done item 7, with lane 6a, and done item 4's "the map lists it", which lane 3 left here

The index plan is `docs/superpowers/plans/2026-10-18-endless-universe.md`. These are this lane's inputs:
- lane 6a's plan, and its code on `eu/lane-6a` (`c41652d3`)
- lane 3's "What later lanes consume" and "For lane 6b in particular"
- lane 4a's and lane 4b's tables and their hand-on to 6b

**Depends on:** lanes 1, 2 (all five PRs), 3 (both groups), 4a, 4b, 5a and 6a merged on the branch. Lane 5b may run beside it, and 4c comes after.

Line numbers are from `main` at `cc5e2eaf`, and for lane 6a's files from `eu/lane-6a` at `c41652d3`, as committed (`git show c41652d3:<path>`; the worktree's uncommitted Tasks 10 and 11 have moved `scripts/navmap-check.mjs` since). (`NavMap.jsx`, `chart/NavChart.jsx`, `chart/marks.js`, `chart/marks.test.js` and `navmap.css` are the same there as at `645ebff0` and `d04e23c3`. `chart/place.js`, `chart/declutter.js` and `scripts/navmap-check.mjs` moved in `c41652d3`, which added `placeMarks`' `ranked`.) Later lanes move them, so find the code again by the quoted text.

## Global Constraints

**Process (HANDOFF-universe's owner's rules and the index's Global Constraints, all of them):**
- Nothing a visitor can do is lost. Every key, save, route, dev hook and test works after as before, and no test is loosened or deleted.
  - One assertion of lane 6a's describes a bound this lane removes: `chart/marks.test.js`'s `liveMarks({ pilots: … }).map((m) => m.levels)` is `[['system', 'neighbourhood']]` (`marks.test.js:83` at `c41652d3`). Task 4 replaces it with the three levels, and its commit names it (finding 6).
  - Every other existing test stays as it is. New tests go in new `describe`s or new `it`s.
- Pure first. These import no React, no DOM and no three.js, and each has its Node test before its drawing half:
  - `charted/{known,pick,sceneChart}.js`
  - `chart/{generated,navList}.js`
  - `whereNow.js`. It takes the far fights' `label` as a dep, because `fightLabel` lives in `farFights.js`, which imports three (`farFights.js:25`). Its test pins that it imports neither.
- A hook has its test as lane 6a's `useChartView.test.js` has: run by hand under a mocked React.
- A changed picture is on purpose. The nav map's before shots come first (Task 1).
- Draw calls and triangles are no higher at any pose. This lane draws nothing new in 3D, so they're equal. Task 12 shows it.
- Before the lane is done, run these:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `node scripts/health.mjs --check --skip build`
  - `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`
- Every commit is one plain sentence in the repo's voice. The body says why and gives the numbers, and it ends with the attribution lines the session's harness gives (`.claude/skills/autopilot/SKILL.md`, "Commit"). This plan writes the first line only, with no model names.
- The hand-off goes in `docs/superpowers/evidence/endless-universe-lane-6b/HANDOFF-NOTES.md`, not in `HANDOFF-universe.md`, which the coordinator folds. Evidence goes in the same folder, each picture under 1 MB (element shots, or JPEG at 80).

**Code shape:**
- `scene.js` doesn't grow. Task 7 moves `where()` out (about −20). Task 8 adds at most 5. Each task says its count, by `wc -l` before and after.
- New files stay under 800 lines. `NavMap.jsx` (442 at `c41652d3`) stays under 800, and so do `Universe.jsx` and `UniverseMap.jsx`.
- **Islands and weight** (lane 3's rule):
  - The generator is reached only through `expanse/shared/space.js`, and only from `charted/pick.js` and `charted/sceneChart.js`, which only the scene imports.
  - `NavMap.jsx`, `chart/*` and `MiniMap.jsx` take ids from `places/ids.js` and nothing from `places/resolve.js`, `places/cards.js` or `charted/{pick,sceneChart}.js`. Lane 3's `places/weight.test.js` pins it (Task 8).
  - `charted/known.js` imports only `places/ids.js` and `lib/space/address.js`, so lane 4c can take it from anywhere. It knows a station's number range itself (Task 2), and its test pins that against the generator's stations.
- No `requestAnimationFrame` (the `loops` metric is at its budget), no `onBeforeCompile`, no GLSL, no new dependency.
- **Generated content is never stored.** The `universe-known` table holds ids, how you know each, and when. A known place's name and position are worked out again from its id each visit, and held in memory only.
- `cycles` (5) and `boundary-breaks` don't rise.

**Ids and space:**
- Ids go through Task 0's `src/lib/space/address.js` and lane 3's `places/ids.js` (`canonicalPlace`, `isPlaceId`). The canonical form is the generator's, upper-case `E:`.
- Every position here is in the map's frame, as lane 3's are. That covers the ship, generated rows, pilots (`pilots.js` keeps them under `map`), traffic (`createTraffic(map, …)`, `scene.js:858`), far fights and events.

**Numbers this plan picks (pinned by tests, so they can be tuned):**
- `CHARTED = { max: 120, systems: 0.6, list: 60, every: 1, near: 0.25, retry: 30, giants: 6, keep: 480, queue: Infinity, below: 30, rim: 3 }`, in `chart/generated.js`:
  - `max`: at most this many generated rows in the scene's whole answer, so at most this many generated marks a view of the chart, and the pick. It is also the most ids one chunk of the scene's work off an answer resolves (Task 8).
  - `systems`: the systems' share of `chartPlaces`' rows at the neighbourhood level, the rest the things out between them
  - `list`: at most this many generated rows in the side panel's list
  - `every`: seconds between asks of the scene for the same view
  - `near`: the ask's grid, a fraction of the range, so a small pan asks nothing new
  - `retry`: seconds before a sector that failed to come from the worker is asked for again
  - `giants`: at the universe level, the nearest this many gargantuans past the loaded sectors are fetched and shown
  - `keep`: the light rows the scene keeps by id for the places in view, so a view asked again resolves nothing again
  - `queue`: the worker pool's priority for the chart's own sector asks. The pool runs the lowest first and puts a job before the first queued one whose priority is higher (`findIndex((j) => j.priority > priority)`, `runtime/workers.js:110`), so `Infinity` goes after every other job whatever scale lane 2's sector grid uses. On top of that, the chart asks only while `workers.stats().expanse` shows nothing busy and nothing queued.
  - `below`: the lowest hand-made pickable mark's priority (a portal's, `PORTAL` in `chart/marks.js`). Every generated mark ranks under it.
  - `rim`: at the universe level, the nearest this many places you know past the view's range are fetched and pinned to the chart's rim (done item 7, "out to everything you know"; finding 22).
- `KNOWN = { table: 'universe-known', cap: 2000, slack: 100, least: 20, touch: 3600 }`, in `charted/known.js`:
  - `cap` is the spec's "a few thousand". Past it, the `slack` oldest are dropped together, so the table isn't written one row at a time.
  - `least`: the lowest chart priority a lattice thing or list row needs to be known by name alone, read from the chart the row is drawn with. A passing rock (15) isn't worth knowing; a rogue planet (20) is.
  - `touch`: seconds after which a visit again moves a place's time up.
- **The table's database is its own:** `tp-universe`, at version 1, with the one table `universe-known`, made by `universeStore()` beside `worldStore()` in `runtime/local.js`. `createStore` gains a `tables` option (default `TABLES`). `tp-store`'s version (1), `TABLES` and `MIRRORED` are unchanged, so no tab of an older build is closed (finding 2).
- **The chart's ask, timed** (each a median, warm, and the task fails above it):
  - `chartPlaces` over the 27 sectors round `E:1,0`: 2 ms at the neighbourhood level (range 250,000) and at the system level (7,000), in Node (Task 5)
  - the scene's `rows(q)` asked again after `CHARTED.every`, in Node (Task 8): 2 ms for a neighbourhood, and 2 ms at the universe level (range 3,000,000) with `KNOWN.cap` known systems found, every one in range, filtered and sorted on each answer
  - `rows(q)` in the browser at `mid`, from `__universeDebug.charted.ms()`, for the neighbourhood and again at the universe level with `KNOWN.cap` known systems: 4 ms each (Task 11)
  - **each chunk of the scene's work off an answer** (`CHARTED.max` known ids resolved at hand, or a fetched sector's group, its first chunk with `withMoons`), from `debug.settleMs()`: 4 ms in Node (Task 8) and in the browser at `mid` (Task 11). The chunks run one to a `setTimeout(0)` and never inside `rows(q)`, so a frame gets its turn between them.
  - **the nav map's own render** with about 170 marks (the hand-made, 120 generated, 20 live) at the home spawn's open view, in Node: `placeMarks` with `yields` and `pin` 2 ms, and `renderToStaticMarkup(<NavChart>)` 4 ms (Task 9). It runs on every `where()` tick (four a second, `NavMap.jsx:113`) and every drag and pinch move, and a phone is about four times slower.
- Mark priorities: lane 6a's world 60, wonder 50, moon 45, station 40, portal 30 and region 85–90 stay. This lane adds:
  - **Generated places,** two numbers each:
    - **The place's own rank,** `ChartRow.chart.priority`, on lane 4a's scale: a system 55, a station 38, a planet 36, a moon 34, and a thing, list row or legacy wonder 20. A kind's own card `chart.priority` wins (lane 4a; a gargantuan is 80). Lane 3's six cards have none, so they take Task 5's `SPARE_CHARTS`, each lane 4a's number for its nearest kind: `rock`, `ice` and `derelict` a dot of 15 (as `field` and `debris`), `rogue` a dot of 20 (as `outpost`), a `nebula` a cloud of 35 (as `pocket`), a `pulsar` a star of 30 (as `magnetar`). `KNOWN.least` reads this one.
    - **The mark's priority,** `markPriority(row)`: that rank less `CHARTED.below`, plus 2 for a visited place and 1 for a place seen named, and at most `CHARTED.below − 1` (29). So a system is 25 (26 named, 27 visited), a station 8, a planet 6, a moon 4, a thing −10 (a rock −15) and a gargantuan 29. The scene's order of the known reads this one.
    - **Every generated mark ranks under every hand-made pickable mark,** and on the nav map it gives way to them too (Task 9's `yields`). This is the spec's "the hand-made core buried under generated clutter" (Review Focus 1). The map opens at the neighbourhood level, where up to 120 generated marks sit over the core's places, and lane 6a's declutter puts names down greedily, highest first, each clear of every other place's dot.
  - **Live marks:**
    - an event 48 if `big`, else 36
    - the way back 75, pinned to the rim when it's past the range (Task 9's `pin`). The nearest known places past the range at the universe level keep their generated priorities, and are pinned the same way.
    - traffic 10, unlabelled
  - Lane 6a's live marks keep theirs: pilots 70, unlabelled, and far fights 35.
- Levels:
  - a generated system: `system` and `neighbourhood`, and `universe` too once known
  - a planet, moon, station or lattice thing: `system`
  - a list row or legacy wonder: `system` and `neighbourhood`
  - a gargantuan: all three
  - pilots: all three (finding 6)
  - far fights and events: `system` and `neighbourhood`
  - traffic: `system`
  - the way back: all three

**Words and UI (`docs/health/RULES.md`, "UI"):**
- Every new on-screen word goes into `src/components/universe/words.js` first. This lane adds two: `CHART_WORDS.holder` and `CHART_WORDS.looking`. It reuses lane 3's `PLACE` (`plotting`, `facts.held`, `held`), lane 4a's `THINGS.note.cameFrom` and lane 4b's `EVENT.name`.
- British spelling, sentence case, curly quotes, no Oxford comma, no retired word.
- "The nav map's stylesheet is words only; its pilots' colour and ambers are the owner's call." New rules reuse the nav map's colours:
  - traffic and the way back in its blue, `#9fd8ff`
  - events in the front's amber, `#ffb347`

  No existing part is restyled, and no `z-index` is used.

**Browser checks:**
- Headless Chromium draws in software here at a frame or two a second. A task's `universe-check` and `universe-endless-check` run at `--quality mid` only, on the steps it changes. Task 12 runs the full all-tier measure once.
- `navmap-check` has no tier flag: it loads `?quality=low` (`navmap-check.mjs:26` at `c41652d3`), so its runs here are at `low` whatever the task.
- Every browser command runs with `CHROME=/opt/pw-browsers/chromium CHROMIUM=/opt/pw-browsers/chromium` in front of it, as lane 3's plan found:
  - `navmap-check`, `links-check` and `perf-probe` read `CHROME`. The first two default to `/opt/google/chrome/chrome`, which this container lacks.
  - `universe-check` and `autopilot-check` read `CHROMIUM`, and look for a Chromium path this container doesn't have.
- **Frame time is noisy here.** Each `perf-probe` measure is three runs, before and after alike. The after passes when, for every phase but `load`, its median p50 is no more than the before's median p50 plus the larger of 2 % and the before's own spread (its three p50s' highest less lowest). The three runs go in the README.
- **The dev server.** `navmap-check`, `sector-check`, `flyto-check`, `links-check` and `wonders-check` don't start one. Before them:
  1. Start `npx vite --port 5173 --strictPort` in the background (the Bash tool's `run_in_background`).
  2. Wait in an until-loop until `curl --noproxy '*' -sf -o /dev/null http://localhost:5173/` succeeds, giving up after 60 s.
  3. Run the checks.
  4. Stop the server after.

  `universe-check`, `universe-endless-check`, `autopilot-check` and `perf-probe` start their own.
- Every wait is on a condition, never a sleep. A wait for game time reads the scene's own clock (`__universeDebug.state.clock`). Each such wait is capped at 30 s of the scene's clock and 120 s of the wall's, whichever comes first, with no exception. (A jump keeps to the wall's clock, `HYPER.flash + HYPER.length` = 3.65 s, `nav.js:66` and `scene.js:1763-1766`, so a jump's arrival comes well inside both.)

## Review Focus

1. **The hand-made core under the generated places.** The map opens at the neighbourhood level (range 120,000), and the generator fills the core (spec call 2). So the first open at home puts up to 120 generated marks over the portfolio's places, and at the system level a generated system sits beside the hand-made stations. Expected:
   - every hand-made name the chart shows without them, it still shows, on the same side
   - a generated dot under a hand-made name or dot gives way: hidden under it, its button out of the click's way
   - every generated mark ranks under every hand-made place, so a crowded system view names the stations first

   Pinned in Task 3 (every generated mark's priority under the lowest hand-made pickable one, 30), Task 9 (`placeMarks`' `yields`; NavChart at the home spawn's open view with 120 generated marks, every hand-made name kept on its side) and Task 10's browser check (the core's names at the open view from home, the generated places held off and then let in, in the same run, compared only when no live mark came or went between the two).
2. **A known place far off, picked from the list or searched.** Its sector isn't round the ship. Expected:
   - The card shows its name and type and "Plotting a course…" while lane 3's `find` fetches it. Its times read "—", and it never throws or shows a blank card.
   - The jump waits for the sector (lane 3) and goes.
   - A known id that turns out to be nothing is let go.
   - The chart's own fetches never push the picked place's sector out of lane 3's four.
   - Typed into the search, a place you visited five sectors off, or a wormhole's throw away, is found. While the box holds a query, the chart also fetches the known places outside the view's range, a sector at a time, nearest first, each as soon as the last has landed (not once a second), and the list says it's still looking until they're all in. With a full table over a few hundred sectors that is the sum of their builds, one after another: about 15 to 40 s on a desktop here (45–130 ms a build), several times that on a phone (finding 3).

   Pinned in Task 8 (in range only, but every known sector while searching; the chart's own pool asks, a sector at a time, nearest first, the next as one lands with the clock standing still, retried later; lane 3's `fetch` never called, and a place picked and fetched through it still found after the chart has fetched four more), Task 10's `navList.test.js` (a light pick's card, its times, its mark), `useCharted.test.js` (the search flag, a null answer) and Task 10's browser check (search and jump to a known system, and find a visited one from four sectors off after a reload, Task 1's `toSystem` taking the ship there first).
3. **A crowded neighbourhood, and the workers it shares.** There are about 7,400 systems in the 3 × 3 × 3 and thousands of things, and up to 2,000 known places. Expected:
   - The chart draws at most 120 generated marks and the pick, and the list at most 60.
   - The scene is asked at most once a second and on a real move, and its answer is timed, the worst case (a full table at the universe level) included.
   - No sector is made on the main thread to answer, and the names never turn to mush.
   - The chart's sector asks go last in the pool's queue and start only while it has no other `expanse` job. One already in flight can still hold a newly queued sector load or a pick's fetch for one build (45–130 ms here, several times that on a phone) on a tier with one `expanse` worker. That is the most it costs.
   - The main thread's share of the work off an answer is chunked and timed: `CHARTED.max` ids resolved a chunk, one chunk to a `setTimeout(0)`, each at most 4 ms (`settleMs`). It goes on only while the nav map is asking. One cost is not timed here: the structured clone of a whole sector as it arrives from the worker, which the pool pays before the chart's handler runs. It is the same as one of lane 2's own sector loads, one a sector, one sector at a time.
   - The nav map's own render, with up to 120 generated marks, the hand-made and the live ones and two declutter passes, runs on every `where()` tick and drag. It is timed in Node against a bound (Task 9).

   Pinned in Task 3 (`capGenerated`, `nextAsk`), Task 5 (`chartPlaces`' share, and its time), Task 8 (the whole answer capped at `CHARTED.max` with `KNOWN.cap` known systems in range, gargantuans then priority then recency; a view asked again resolves nothing; the scene never builds; no ask while the pool is busy; the work stopping once the map stops asking; the answer's and the chunks' times), Task 9 (the render's time) and Task 11 (the answer's and the chunks' times in the browser). Task 10 checks the names in the browser (no two meet).
4. **The table in every kind of browser.** It lives in a database of its own, `tp-universe`, so these must all work:
   - a fresh database, and one opened again on the next visit with nothing lost
   - no IndexedDB at all (memory, and never mirrored into `localStorage`, even handed a fallback)
   - a broken row
   - a table at its cap
   - adds made before the table has been read
   - **`tp-store` untouched.** A returning visitor's minecraft and `/worlds` database keeps its version (1) and its three tables, and a tab of the older build open beside this one goes on writing. A fourth table in `tp-store` would have needed version 2, whose `versionchange` closes every older tab's connection (`store.js:34`) and loses its writes till it reloads: a long-lived minecraft tab, then a new tab of the site (finding 2).

   Pinned in Task 2.
5. **A `where()` from an older pilot, or one missing a field.** A pilot with no `y`, an event with no name, a `NaN`, or a `where()` without lanes 4a's and 4b's fields: each draws nothing `NaN` and throws nothing. A height missing sits level with the ship. Pinned in Task 4 and Task 7.

Also pinned, beside these:
- a pocket universe (`/universe?seed=marble`): its ids name other places than the shared universe's, so nothing is recorded or shown from the table there, and its own sectors still list (Task 8)
- the way back after a wormhole's throw, 3.6 to 9.6 million off and past the chart's widest range, pinned to the rim, and the nearest three places you know beside it (Tasks 8, 9 and 10)
- a station you arrive or dock at marks its system visited too (Task 2's `systemIdOf`, Task 8)
- a far hand-made trip no longer simulated, so the side panel doesn't spend 90–180 ms every two seconds on it (Task 6)
- every one of lane 4a's 32 kinds listed at the system level and carded with its chart, or the default where its card has none (Task 5)
- the phone's chart bar and side panel still fit with whose space it is shown (Task 10)

## Files

| File | Responsibility | Task |
|---|---|---|
| `scripts/navmap-check.mjs` | the `endless` mode: shots (1), then its checks (10) | 1, 10 |
| `docs/superpowers/evidence/endless-universe-lane-6b/` (new) | README, before and after, HANDOFF-NOTES | 1, 12 |
| `src/runtime/store.js`, `store.test.js` | `createStore`'s `tables` option; `tp-store` untouched | 2 |
| `src/runtime/local.js`, `local.test.js` (new) | `universeStore()`: the `tp-universe` database, holding `universe-known` | 2 |
| `src/components/universe/charted/known.js` (new) | the places you know: ids, how, when; cap; the system of a place, a station's included | 2 |
| `src/components/universe/chart/generated.js` (new) | `CHARTED`; light rows; marks, their priorities under the hand-made, and levels; when to ask, searching or not; list caps | 3 |
| `src/components/universe/chart/marks.js` | `liveMarks`: heights, traffic, events, the way back | 4 |
| `src/components/universe/charted/pick.js` (new) | which generated places a view lists, from the sectors at hand; a place's chart from its card, or a spare for lane 3's six | 5 |
| `src/components/universe/nav.js` | `tripTime`: a long trip by the formula, straight off | 6 |
| `src/components/universe/whereNow.js` (new) | `where()`, moved out of `scene.js` | 7 |
| `src/components/universe/online/pilots.js`, `pilotsNodes.js` | a pilot's height on the chart | 7 |
| `src/components/universe/traffic.js` | `chart`: each group's lead | 7 |
| `src/components/universe/charted/sceneChart.js` (new) | records, resolves in timed chunks, fetches through its own pool asks (last, only while the pool is idle, each as the last lands; every known sector while searching; the nearest past the rim), and answers, capped | 8 |
| `src/components/universe/places/scenePlaces.js` (lane 3's) | the optional `named(ids)` dep | 8 |
| `src/components/universe/scene.js` | wiring only, smaller after | 7, 8 |
| `src/components/universe/UniverseMap.jsx`, `src/pages/Universe.jsx` | the handle's `chart`; NavMap's `chart` and `place` | 8, 10 |
| `src/components/universe/places/weight.test.js` (lane 3's) | `NavMap.jsx` reaches no generator | 8 |
| `src/components/universe/chart/place.js`, `place.test.js` (lane 6a's) | `placeMarks`' `pin` and `yields`: a mark always on at the rim; marks that give way to the rest | 9 |
| `src/components/universe/chart/NavChart.jsx`, `navmap.css` | traffic, events, the way back and the nearest known past the rim pinned; generated marks giving way to the hand-made | 9 |
| `src/components/universe/chart/navList.js` (new), `navList.test.js` | the nav map's list rules: first pick, a light pick, the mark a pick shows, groups and cap, the known's order, the camera's places, the holder's line | 10 |
| `src/components/universe/chart/useCharted.js` (new), `useCharted.test.js` | the nav map's asks (searching or not) and answers (a null one let go); the rim's pinned marks | 10 |
| `src/components/universe/NavMap.jsx`, `words.js` | wiring: lists, searches, picks and times generated places; still looking; whose space, in the status | 10 |
| `scripts/universe-endless-check.mjs` | the `map: ok` column (lane 6a's per-step call kept); the `map` step | 8, 11 |

---

## PR 6b.1: The pure half

### Task 1: The before shots, and the nav map check's `endless` mode

The nav map's picture out among the generated places, taken before any code of this lane. Lane 6a's after shots are this lane's before for the hand-made views.

**Files:**
- Modify: `scripts/navmap-check.mjs`:
  - `MODES` (`:22`) gains `'endless'`, and the header's usage line names it
  - a new `if (run('endless')) { … }` block after `far`'s (`:351` at `c41652d3`)
- Modify: `scripts/lib/navmap.mjs` (lane 6a's, beside `shipOnChart`): `toSystem`
- Create: `docs/superpowers/evidence/endless-universe-lane-6b/README.md` and `before/*.jpg`

**Interfaces:**
- Consumes:
  - the check's own `open(viewport, ship)`, `shot(page, name, el)`, `painted`, `navOpen`, `check` and `state`. `open`'s `waitForTimeout(2000)` (`navmap-check.mjs:60`) is lane 6a's and stays; this lane's own waits are all on conditions.
  - lane 2's `__universeDebug.teleport(x, y, z, heading, pitch)` and `__universeDebug.expanse.sectors()` (a `Map` by sector key)
  - lane 3's `__universeDebug.places.resolve(id)` (`places.debug` is `{ resolve, parkAt, stations, screen }`). It reads only the loaded and fetched sectors and never fetches, so it answers only once the id's sector is round the ship.
  - Task 0's `parseSpaceId`, `sectorCentre` and `SECTOR`, imported in Node from `../../src/lib/space/address.js` (it imports nothing, so a script can take it, as other scripts take `src/lib` modules)
- Produces:
  - **`toSystem(page, id, { inside = false } = {}) → { id, name, at, reach, span }`**, in `scripts/lib/navmap.mjs`, so Task 11's endless check uses the same one.
    1. **To the sector first.** It works out the id's sector in Node: `{ sx, sy, sz, key } = parseSpaceId(id)`. When `__universeDebug.expanse.sectors().has(key)` is false, it teleports to `sectorCentre(sx, sy, sz)` raised by `SECTOR / 4` on y (inside the sector, clear of its middle), heading 0 and pitch 0, and waits until `__universe().ship` is within 50 of there.
    2. **Then the system.** It waits (a `waitForFunction` polling every 500 ms, 60 s at most) until `expanse.sectors().has(key)` and `__universeDebug.places.resolve(id)` is non-null: lane 2 loads the ship's sector, and lane 3's resolver then has it to read.
    3. It returns only those five fields. A Destination's rows carry `bigint` seeds, which `page.evaluate` can't hand back. `span` is the system's reach (lane 3's card: `span: row.reach`); `reach` is the star's, `star.size × 2`.
    4. It teleports to `[at[0], at[1], at[2] + span + 1500]`, as lane 3's `travel` step parks outside a system's zone, heading 0 (facing −z, the star) and pitch 0. With `inside`, to `[at[0], at[1], at[2] + span / 2]`, in the system's zone, where lane 4b's holder is that system's.
    5. It waits until `__universe().ship` is within 50 of there.

    So it reaches a system anywhere, four sectors off or a wormhole's throw away, not only one round the spawn (Task 10's check 5b).
  - **The `endless` mode.** First, with the falcon where it starts (no teleport), the nav map opened with `m` at its open view, and the shot `19-endless-home`: the core as the map opens on it. Then `toSystem(page, 'E:1,0:0')`, the nav map opened with `m`, and the shots:
    - `20-endless-system`: the wheel turned in over the chart's middle until `.navmap-chart[data-level="system"]`, twelve turns at most
    - `21-endless-neighbourhood`: `-` pressed until `neighbourhood`
    - `22-endless-universe`: `-` pressed until `universe`
    - `24-endless-phone`: a 390 × 844 context with `hasTouch`, the same teleport and the map opened on its list. If there is a "Star systems" `.navmap-group`, it is scrolled into view.
  - Shot 23 is Task 10's, the search.

- [ ] **Step 1: Start the dev server on the branch as it stands** (Global Constraints, "The dev server").
- [ ] **Step 2: Add `toSystem` and the `endless` mode,** shots only, every wait on a condition. Before the shots, try `toSystem(page, 'E:6,0:0')` once from the spawn and see it return (its first step's teleport, then the sector loading): the mode doesn't shoot it, but Task 10's check 5b leans on it.
- [ ] **Step 3: Take the before shots.**
  - Run `OUT=docs/superpowers/evidence/endless-universe-lane-6b/before CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs endless`, then the same with `desktop` and with `far`.
  - Expected: the shots are written. In `19`, the hand-made core as lane 6a left it. In `20`–`22`, no generated place is on the chart, only the hand-made ones far off and the ship. Write down any check that fails as it stands.
- [ ] **Step 4: Take the frame times before, three runs each.** Stop the dev server first (`perf-probe` starts its own, on 5294). Run `QUALITY=mid CHROME=/opt/pw-browsers/chromium OUT=lab/perf/6b-before-mid-<n> node scripts/perf-probe.mjs universe` for `n` of 1, 2 and 3, then the same with `QUALITY=low`. Each in the background, waiting on its exit.
- [ ] **Step 5: Write the README.** It records:
  - the date and the branch's commit
  - the commands
  - the before shots
  - the frame times: each phase's p50 for the three runs, their median and their spread
  - an empty "after" column
- [ ] **Step 6: Commit.**
  ```bash
  git add scripts/navmap-check.mjs scripts/lib/navmap.mjs docs/superpowers/evidence/endless-universe-lane-6b
  git commit -m "Nav map check: an endless mode beside a generated system, and the before shots and frame times"
  ```

---

### Task 2: The places you know, in a table of their own

**Files:**
- Modify: `src/runtime/store.js`:
  - `createStore` (`:42`) takes `tables = TABLES`, and uses it for its memory maps (`:43`) and for `openDb`'s upgrade loop (`openDb(idb, name, version, tables)`, `:26-31`)
  - the header (`:9-12`) names the option, and says why a database of its own is how a table is added: a new table in an existing database means a new version, and `onversionchange` (`:34`) closes every older tab's connection to it
  - `TABLES`, `MIRRORED`, the default `name` and the default `version` are unchanged
- Modify: `src/runtime/local.js`: **`universeStore()`** after `worldStore()` (`:25-33`), and the header (`:1-4`) names it
- Modify: `src/runtime/store.test.js`: the import gains `TABLES`, and there's a new `describe`
- Create: `src/runtime/local.test.js`
- Create: `src/components/universe/charted/known.js`, `src/components/universe/charted/known.test.js`

**Interfaces:**
- Consumes:
  - the store's `{ ready, get, set, remove, list }`
  - lane 3's `canonicalPlace` (`places/ids.js`)
  - Task 0's `parseSpaceId` and `spaceId`
  - in `known.test.js` only: the face's `UNIVERSE` and `fullSector` (lane 3's `stations` on each sector)
- Produces:
  - **`createStore({ indexedDB, name, version, fallback, tables = TABLES })`**, `store.js`'s, with one option more: the object stores this database holds. A table not in `tables` is not this store's: `set` gives false, `get` null and `list` `[]`, as for an unknown table today.
  - **`universeStore() → Store`**, in `runtime/local.js`, made the first time anything asks, as `worldStore()` is: `createStore({ indexedDB, name: 'tp-universe', tables: ['universe-known'] })`.
    - Its own database, at version 1. So `tp-store`, which holds the minecraft world and `/worlds`, keeps its version and its three tables, and a tab of an older build with `tp-store` open is never sent `versionchange` (finding 2).
    - It has no `fallback`, so it is never mirrored into `localStorage`. In memory mode, `mirror` rewrites the whole key index on every write (`store.js:56-66`), and a few thousand ids would make that a quadratic cost. A private window keeps its known places for the visit only.
    - Under Node (no `window`) it is a store in memory.
  - **The `universe-known` table.** Its key is a canonical place id. Its value is `{ how: 'named' | 'visited', t }`, with `t` in wall seconds. The scene takes it from `universeStore()` (Task 8), not from `rt.store`.
  - **`KNOWN`**, as in Global Constraints. **`HOW = ['named', 'visited']`**, in rising order.
  - **`systemIdOf(id) → string | null`:** the canonical id of the system a place belongs to:
    - for a system, planet or moon id, `spaceId(cube, system)`
    - for a station, `w(10000 + i)` (lane 3's `STATION_BASE`; lane 4a's high lists start at `w20000`), system `i`: `spaceId(cube, n − 10000)`
    - null for any other wonder or thing id, and for a non-place

    `known.js` keeps the station range itself (`10000 ≤ n < 20000`), because `STATION_BASE` is on the generator's face, which this module may not import. Its test pins it against every station of a real sector.
  - **`knowable(dest, chart = null) → boolean`:** whether a place seen only by name is worth keeping. `chart` is the chart the place is drawn with (Task 8 passes the light row's).
    - It is true for a `place` of `'system'`, `'planet'`, `'moon'`, `'station'` or `'wonder'`.
    - It is true for `'thing'` or `'extra'` when `chart?.priority >= KNOWN.least`.
    - It is false for null.
  - **`createKnown({ store = null, clock = () => Date.now() / 1000, cap = KNOWN.cap, slack = KNOWN.slack } = {}) → { ready, add(id, how), how(id), has(id), remove(id), list(), size, flush() }`:**
    - **`ready`** reads the table once, with `store.list(KNOWN.table)`.
      - It keeps rows whose key is its own `canonicalPlace` and whose value is `{ how ∈ HOW, t: finite }`.
      - It removes every other row from the table.
      - Adds made before it has finished are applied after the read, each with the `t` of its call, so the read never overwrites them.
    - **`add(id, how) → boolean`** is true when it wrote. It writes when:
      - the place is new
      - `how` is above the one kept (`named` → `visited`)
      - the place is visited again more than `KNOWN.touch` after its `t`

      It never lowers `how`. It is false for a non-place id or a `how` not in `HOW`. Past `cap`, it drops the `slack` oldest (by `t`, then by id) from memory and the table.
    - **`list()`** is `[{ id, how, t }]`, newest first, then by id. It is the same array until something changes.
    - **`flush() → Promise`** settles when every write so far has landed. It is for tests and `dispose`.
    - With `store` null, the places are kept in memory only.

- [ ] **Step 1: Write the failing tests.** In `store.test.js`:

```js
describe('a database of its own tables (the universe’s known places)', () => {
  const own = (idb, more = {}) => createStore({ indexedDB: idb, name: 'tp-universe', tables: ['universe-known'], ...more });
  it('holds its own tables and no other, in a fresh database and in memory', async () => {
    for (const s of [own(new IDBFactory()), own(undefined)]) {
      await s.ready;
      expect(await s.set('universe-known', 'E:1,0:3', { how: 'visited', t: 5 })).toBe(true);
      expect(await s.get('universe-known', 'E:1,0:3')).toEqual({ how: 'visited', t: 5 });
      expect(await s.set('saves', 'minecraft:7', { seed: 7 })).toBe(false);
      expect(await s.list('worlds')).toEqual([]);
    }
    expect(TABLES).toEqual(['saves', 'worlds', 'blobs']);
  });
  it('keeps what it holds across a second open, as tp-store does', async () => {
    const idb = new IDBFactory();
    await own(idb).set('universe-known', 'E:2,0:1', { how: 'named', t: 1 });
    expect(await own(idb).get('universe-known', 'E:2,0:1')).toEqual({ how: 'named', t: 1 });
  });
  // (finding 2: a fourth table in tp-store would mean version 2, whose
  // versionchange closes an older build's open tab and loses its writes)
  it('leaves tp-store as it is: its version, its tables, and an older build’s open tab still writing', async () => {
    const idb = new IDBFactory();
    const old = createStore({ indexedDB: idb }); // (a minecraft tab of the build before, open all along)
    expect(await old.ready).toBe('idb');
    expect(await old.set('saves', 'minecraft:7', { seed: 7 })).toBe(true);
    const mine = own(idb);
    expect(await mine.ready).toBe('idb');
    expect(await mine.set('universe-known', 'E:2,0:1', { how: 'named', t: 1 })).toBe(true);
    expect(await old.set('saves', 'minecraft:7', { seed: 8 })).toBe(true);
    expect(await old.get('saves', 'minecraft:7')).toEqual({ seed: 8 });
    const db = await new Promise((ok, fail) => {
      const req = idb.open('tp-store');
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
    expect([db.version, [...db.objectStoreNames].sort()]).toEqual([1, ['blobs', 'saves', 'worlds']]);
    db.close();
  });
  it('is never mirrored to the small keys, even handed a fallback', async () => {
    const f = fakeSaves();
    const s = own(undefined, { fallback: f });
    await s.ready;
    await s.set('universe-known', 'E:1,0:3', { how: 'visited', t: 5 });
    expect([...f.m.keys()].some((k) => k.includes('universe-known') || k.includes('E:1,0:3'))).toBe(false);
  });
});
```

  `local.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { universeStore, worldStore } from './local';

describe('the universe’s own store', () => {
  it('is one store, made once, apart from the world store, holding the known places and no saves', async () => {
    const s = universeStore();
    expect(universeStore()).toBe(s);
    expect(s).not.toBe(worldStore());
    expect(await s.ready).toBe('memory'); // (no window under Node)
    expect(await s.set('universe-known', 'E:1,0:3', { how: 'named', t: 1 })).toBe(true);
    expect(await s.set('saves', 'minecraft:7', { seed: 7 })).toBe(false);
  });
});
```

  `known.test.js`:

```js
import { beforeAll, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createStore } from '../../../runtime/store';
import { universeStore } from '../../../runtime/local';
import { UNIVERSE, fullSector } from '../../expanse/shared/space';
import { KNOWN, createKnown, knowable, systemIdOf } from './known';

const fresh = () => createStore({ indexedDB: new IDBFactory(), name: 'tp-universe', tables: [KNOWN.table] });
const keys = async (store) => (await store.list(KNOWN.table)).map(([k]) => k).sort();
let s;
beforeAll(() => {
  s = fullSector(UNIVERSE, 1, 0, 0);
});

describe('the places you know', () => {
  it('is the table the universe’s own store holds', async () => {
    expect(await universeStore().set(KNOWN.table, 'E:1,0:3', { how: 'named', t: 1 })).toBe(true);
  });
  it('keeps ids in the generator’s form and what you did there, never lowered', async () => {
    let now = 100;
    const k = createKnown({ store: fresh(), clock: () => now });
    await k.ready;
    expect(k.add('e:1,0:3', 'named')).toBe(true);
    expect([k.has('E:1,0,0:3'), k.how('E:1,0:3')]).toEqual([true, 'named']);
    for (const bad of ['marvel', 'nonsense', '', null]) expect(k.add(bad, 'visited')).toBe(false);
    expect(k.add('E:1,0:3', 'bogus')).toBe(false);
    now = 200;
    expect(k.add('E:1,0:3', 'visited')).toBe(true);
    expect(k.add('E:1,0:3', 'named')).toBe(false);
    expect(k.how('E:1,0:3')).toBe('visited');
  });
  it('lasts: the next visit reads what this one wrote, adds before the read included', async () => {
    const store = fresh();
    let n = 0;
    const a = createKnown({ store, clock: () => ++n });
    a.add('E:1,0:3', 'visited');
    await a.ready;
    a.add('E:2,0:5:1', 'named');
    await a.flush();
    const b = createKnown({ store });
    await b.ready;
    expect(b.list().map((r) => [r.id, r.how])).toEqual([['E:2,0:5:1', 'named'], ['E:1,0:3', 'visited']]);
  });
  it('drops the oldest past its cap, from memory and the table alike', async () => {
    const store = fresh();
    let n = 0;
    const k = createKnown({ store, clock: () => ++n, cap: 5, slack: 2 });
    await k.ready;
    for (let i = 0; i < 6; i++) k.add(`E:1,0:${i}`, 'named');
    await k.flush();
    expect(k.size).toBe(4);
    expect([k.has('E:1,0:0'), k.has('E:1,0:1'), k.has('E:1,0:5')]).toEqual([false, false, true]);
    expect(await keys(store)).toEqual(k.list().map((r) => r.id).sort());
  });
  it('moves a place up when it is visited again after an hour, and no sooner', async () => {
    let now = 0;
    const k = createKnown({ store: fresh(), clock: () => now });
    await k.ready;
    k.add('E:1,0:3', 'visited');
    now = KNOWN.touch - 1;
    expect(k.add('E:1,0:3', 'visited')).toBe(false);
    now = KNOWN.touch + 1;
    expect(k.add('E:1,0:3', 'visited')).toBe(true);
  });
  it('lets go of a broken row, and works with no store at all', async () => {
    const store = fresh();
    await store.set(KNOWN.table, 'junk', { how: 'visited', t: 1 });
    await store.set(KNOWN.table, 'E:1,0:2', 'x');
    await store.set(KNOWN.table, 'e:1,0:7', { how: 'named', t: 2 });
    await store.set(KNOWN.table, 'E:1,0:4', { how: 'named', t: 3 });
    const k = createKnown({ store });
    await k.ready;
    await k.flush();
    expect(k.list().map((r) => r.id)).toEqual(['E:1,0:4']);
    expect(await keys(store)).toEqual(['E:1,0:4']);
    const bare = createKnown();
    await bare.ready;
    expect(bare.add('E:1,0:3', 'named')).toBe(true);
  });
  it('knows the system of a planet, a moon or a station, and what is worth knowing by name alone', () => {
    expect(['E:1,0:3:2:1', 'e:1,0:3:2', 'E:1,0:3', 'E:1,0:w10003', 'E:1,0:w64', 'E:1,0:w20000', 'marvel'].map(systemIdOf)).toEqual(['E:1,0:3', 'E:1,0:3', 'E:1,0:3', 'E:1,0:3', null, null, null]);
    expect(s.stations.length).toBeGreaterThan(0);
    for (const st of s.stations) expect(systemIdOf(st.id), st.id).toBe(st.system); // (lane 3's numbers, read from a real sector)
    expect(knowable({ place: 'system' })).toBe(true);
    expect(knowable({ place: 'thing' })).toBe(false);
    expect(knowable({ place: 'thing' }, { shape: 'dot', priority: 20 })).toBe(true);
    expect(knowable({ place: 'extra' }, { shape: 'dot', priority: 15 })).toBe(false);
    expect(knowable(null)).toBe(false);
  });
});
```

  `e:1,0:7` is a place, but not in the canonical form, so it's a broken row: rows are written canonical.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/runtime/store.test.js src/runtime/local.test.js src/components/universe/charted/known.test.js`. Expected: the new `describe` in `store.test.js` FAILS (`tables` isn't an option yet, so `universe-known` isn't a table), `local.test.js` FAILS (`universeStore` isn't exported), and `known.test.js` FAILS (module not found).
- [ ] **Step 3: Implement** `createStore`'s `tables`, `universeStore()` and `known.js`. The module's header says four things:
  - It keeps ids, never what's at them (spec G, "seeds and deltas only").
  - It is spec G's table, built in this lane because the map reads it first (finding 1), in a database of its own so that no tab of an older build loses a write (finding 2).
  - Why `slack`: one sweep of a hundred rows, not a write and a remove for every place past the cap.
  - Why it knows the station range itself: the generator's face is the scene's side.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/runtime src/components/universe/charted src/components/minecraft src/components/worlds`. Expected: PASS. Every existing store test, and the minecraft and worlds tests that share `tp-store`, are unchanged and pass.
- [ ] **Step 5: Commit.** `git add src/runtime/store.js src/runtime/store.test.js src/runtime/local.js src/runtime/local.test.js src/components/universe/charted && git commit -m "The places you've been or seen named, as ids in a database of their own, a few thousand at most"`. The body says why the table isn't a fourth in `tp-store` (finding 2): that would take its version to 2, and a minecraft or `/worlds` tab of the older build left open would be closed and lose its writes till it reloaded. Here `tp-store` keeps version 1, and the test pins an older tab still writing.

---

### Task 3: Generated places as marks, and when the chart asks

**Files:**
- Create: `src/components/universe/chart/generated.js`, `src/components/universe/chart/generated.test.js`

**Interfaces:**
- Consumes:
  - lane 6a's `levelOf` and `CHART` (`chart/projection.js`), and in the test its `HAND_MARKS` (`chart/marks.js`)
  - Task 0's address
- Imports: `chart/projection.js` and `lib/space/address.js` only. The scene imports this module too, but it carries no generator.
- Produces:
  - **`CHARTED`**, as in Global Constraints.
  - **`ChartRow`**: a destination made light for the page.

    ```
    { id, place, kind, sub, name, type, at: [x, y, z], color, reach, cube, sector: 'main',
      generated: true, big: boolean, how: 'named' | 'visited' | null, chart: { shape, priority } }
    ```

    It has no `about` and no `src`, so it holds no sector in memory. It is a destination row as lane 3's `findDestinations`' `more` takes it, and enough for `distanceTo` and `legOf`.
  - **`chartRow(dest, { chart = dest?.chart ?? null, how = dest?.how ?? null } = {}) → ChartRow | null`:**
    - `at` is a copy.
    - `big` is `dest.big ?? dest.src?.row?.gargantuan === true`.
    - `chart` defaults by `place`: `system` `{ shape: 'star', priority: 55 }`, `station` 38, `planet` 36, `moon` 34, anything else 20, all `dot` but the system. A `chart` given without a `shape` takes the default's.
    - It is null for no `dest`, no `id` or an `at` that isn't finite.
    - `chartRow(chartRow(d))` equals `chartRow(d)`.
  - **`levelsOf(row) → string[]`**, by Global Constraints' "Levels".
  - **`markPriority(row) → number`:** `Math.min(CHARTED.below − 1, row.chart.priority − CHARTED.below + ({ visited: 2, named: 1 }[row.how] ?? 0))`, by Global Constraints' "Mark priorities". Every generated mark's is under 30, the lowest hand-made pickable mark's.
  - **`generatedMarks(rows, { pinned = false } = {}) → Mark[]`**, one a canonical id, the first of a repeat kept, a `null` or `undefined` row left out. Each is lane 6a's `Mark` shape, with `generated: true`, which Task 9's chart reads to make it give way:

    ```
    { id, kind: row.kind, name, type, at, color, reach, shape: row.chart.shape,
      priority: markPriority(row), levels: levelsOf(row), pickable: true, generated: true }
    ```

    With `pinned`, each also has `pinned: true`, which Task 9's chart reads to pin it to the rim (the nearest known places past the range, Task 10's `useCharted`).

  - **`mergeMarks(...lists) → Mark[]`:** the lists in order, with `null` and `undefined` left out and the first of each id kept.
  - **`chartQuery(view, { search = false } = {}) → { focus, range, level, search, key } | null`**, the scene's ask for a view:
    - `level` is `levelOf(view.range)`.
    - `step = view.range × CHARTED.near`. `focus` is each of the view's snapped to the nearest multiple of `step`, plus 0, so never `-0`.
    - `range = view.range × (1 + CHARTED.near)`, so the snap never leaves the rim short.
    - `search` is `search === true`: the search box holds a query, so the scene fetches the known places outside the range too (Task 8).
    - `key` is `` `${level}|${focus.join(',')}|${Math.round(Math.log2(view.range) * 4)}` ``, with `|search` after it while searching, so typing the first letter asks at once.
    - It is null for a view with a focus or range that isn't finite.
  - **`nextAsk(last, view, now, { search = false } = {}) → query | null`:** `chartQuery(view, { search })` when `last` is null, its `key` differs, or `now − last.at ≥ CHARTED.every`. Else null. `last` is `{ key, at }`.
  - **`capGenerated(list, n) → list`:** every row without `generated`, and the first `n` with it, in order.
  - **`groupOf(d) → string`:** `'system'` for a `kind` of `'star'`, else `d.kind`. Generated systems go into "Star systems" (lane 3's hand-on).

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { HAND_MARKS } from './marks';
import { CHARTED, capGenerated, chartQuery, chartRow, generatedMarks, groupOf, levelsOf, markPriority, mergeMarks, nextAsk } from './generated';

const ALL = ['system', 'neighbourhood', 'universe'];
const dest = (more = {}) => ({ id: 'E:1,0:3', generated: true, place: 'system', kind: 'star', sub: 'G', name: 'Okonkwo', type: 'Yellow star system', about: 'A yellow star…', color: '#ffd27a', reach: 80, at: [120000, 40, -300], cube: [1, 0, 0], sector: 'main', key: 'E:1,0', src: { row: {} }, ...more });

describe('generated places on the chart', () => {
  it('has the numbers the plan picked, to be tuned here', () => {
    expect(CHARTED).toEqual({ max: 120, systems: 0.6, list: 60, every: 1, near: 0.25, retry: 30, giants: 6, keep: 480, queue: Infinity, below: 30, rim: 3 });
  });
  it('makes a light row of a destination, holding none of the generator’s rows', () => {
    const d = dest();
    const r = chartRow(d, { how: 'visited' });
    expect(r).toEqual({ id: 'E:1,0:3', place: 'system', kind: 'star', sub: 'G', name: 'Okonkwo', type: 'Yellow star system', at: [120000, 40, -300], color: '#ffd27a', reach: 80, cube: [1, 0, 0], sector: 'main', generated: true, big: false, how: 'visited', chart: { shape: 'star', priority: 55 } });
    expect(r.at).not.toBe(d.at);
    expect(chartRow(r)).toEqual(r);
    expect(chartRow(dest({ place: 'extra', kind: 'wonder', src: { row: { gargantuan: true } } }), { chart: { shape: 'hole', priority: 80 } })).toMatchObject({ big: true, chart: { shape: 'hole', priority: 80 } });
    expect(chartRow(dest({ place: 'planet' }), { chart: { priority: 9 } }).chart).toEqual({ shape: 'dot', priority: 9 });
    for (const bad of [null, dest({ id: undefined }), dest({ at: [NaN, 0, 0] })]) expect(chartRow(bad)).toBeNull();
  });
  it('shows each kind at its levels: a system near, everywhere once known; bodies close; a gargantuan always', () => {
    const lv = (more, how = null) => levelsOf(chartRow(dest(more), { how }));
    expect(lv({})).toEqual(['system', 'neighbourhood']);
    expect(lv({}, 'named')).toEqual(ALL);
    for (const place of ['planet', 'moon', 'station', 'thing']) expect(lv({ place }, 'visited')).toEqual(['system']);
    expect(lv({ place: 'extra' })).toEqual(['system', 'neighbourhood']);
    expect(lv({ place: 'extra', src: { row: { gargantuan: true } } })).toEqual(ALL);
  });
  it('makes pickable marks, one an id, ranked by what each is and whether you know it', () => {
    const rows = [chartRow(dest(), { how: 'visited' }), chartRow(dest()), chartRow(dest({ id: 'E:1,0:3:0', place: 'planet', kind: 'world', name: 'Okonkwo I' }))];
    const marks = generatedMarks([...rows, null, undefined]);
    expect(marks.map((m) => m.id)).toEqual(['E:1,0:3', 'E:1,0:3:0']);
    expect(marks[0]).toMatchObject({ kind: 'star', name: 'Okonkwo', type: 'Yellow star system', shape: 'star', priority: 27, pickable: true, generated: true, levels: ALL });
    expect(marks[1]).toMatchObject({ shape: 'dot', priority: 6, levels: ['system'] });
    expect(marks.some((m) => 'pinned' in m)).toBe(false);
    expect(generatedMarks(rows, { pinned: true }).map((m) => m.pinned)).toEqual([true, true]);
    expect(mergeMarks([{ id: 'a', n: 1 }], null, [{ id: 'a', n: 2 }, { id: 'b' }], undefined)).toEqual([{ id: 'a', n: 1 }, { id: 'b' }]);
  });
  // (spec F's failure "the hand-made core buried under generated clutter": the
  // map opens over the core at the neighbourhood level, and names go down highest first)
  it('ranks every generated place under every hand-made one, known or not, a gargantuan at the top of them', () => {
    const lowest = Math.min(...HAND_MARKS.filter((m) => m.pickable).map((m) => m.priority));
    expect(lowest).toBe(CHARTED.below);
    const kinds = [{}, { place: 'station' }, { place: 'planet' }, { place: 'moon' }, { place: 'thing' }, { place: 'extra' }];
    const cards = [undefined, { shape: 'hole', priority: 40 }, { shape: 'cloud', priority: 35 }];
    const rows = kinds.flatMap((more, i) => cards.flatMap((chart, j) => ['visited', 'named', null].map((how, k) => chartRow(dest({ id: `E:1,0:${i * 9 + j * 3 + k}`, ...more }), { how, chart }))));
    const giant = chartRow(dest({ id: 'E:1,0:w3', place: 'extra', src: { row: { gargantuan: true } } }), { how: 'visited', chart: { shape: 'hole', priority: 80 } });
    const marks = generatedMarks([...rows, giant]);
    for (const m of marks) expect(m.priority, m.id).toBeLessThan(lowest);
    expect(markPriority(giant)).toBe(CHARTED.below - 1);
    expect(Math.max(...marks.map((m) => m.priority))).toBe(markPriority(giant));
    const sys = (how) => markPriority(chartRow(dest(), { how }));
    expect([sys(null), sys('named'), sys('visited')]).toEqual([25, 26, 27]);
  });
  it('asks the scene again only for a real move, a new zoom or a second gone by', () => {
    const v = { focus: [1000, 0, 2000], range: 100000, yaw: 0, pitch: 0, follow: true };
    const q = chartQuery(v);
    expect(q).toMatchObject({ level: 'neighbourhood', focus: [0, 0, 0], range: 125000 });
    expect(chartQuery({ ...v, focus: [1500, 0, 2000] }).key).toBe(q.key);
    expect(chartQuery({ ...v, focus: [40000, 0, 2000] }).key).not.toBe(q.key);
    expect(chartQuery({ ...v, range: 5000 }).key).not.toBe(q.key);
    expect(nextAsk(null, v, 0)).toMatchObject({ key: q.key });
    expect(nextAsk({ key: q.key, at: 0 }, v, 0.5)).toBeNull();
    expect(nextAsk({ key: q.key, at: 0 }, v, CHARTED.every)).toMatchObject({ key: q.key });
    expect(chartQuery({ ...v, focus: [NaN, 0, 0] })).toBeNull();
    expect(nextAsk(null, { ...v, range: Infinity }, 0)).toBeNull();
  });
  it('asks again at once when a search begins, and says so in the ask', () => {
    const v = { focus: [1000, 0, 2000], range: 100000, yaw: 0, pitch: 0, follow: true };
    const q = chartQuery(v);
    const s = chartQuery(v, { search: true });
    expect([q.search, s.search]).toEqual([false, true]);
    expect(s.key).toBe(`${q.key}|search`);
    expect(nextAsk({ key: q.key, at: 0 }, v, 0.1, { search: true })).toMatchObject({ key: s.key, search: true });
    expect(nextAsk({ key: s.key, at: 0 }, v, 0.1, { search: true })).toBeNull();
  });
  it('lists every hand-made place and the first of the generated, and files generated systems with the star systems', () => {
    const list = [{ id: 'marvel' }, ...Array.from({ length: 80 }, (_, i) => ({ id: `E:1,0:${i}`, generated: true })), { id: 'veil' }];
    const capped = capGenerated(list, CHARTED.list);
    expect(capped.filter((d) => !d.generated).map((d) => d.id)).toEqual(['marvel', 'veil']);
    expect(capped.filter((d) => d.generated).map((d) => d.id)).toEqual(list.slice(1, 1 + CHARTED.list).map((d) => d.id));
    expect([{ kind: 'star' }, { kind: 'system' }, { kind: 'world' }].map(groupOf)).toEqual(['system', 'system', 'world']);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/generated.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `generated.js`.** Its header gives `ChartRow`'s shape and says why a row is light: a known place's row is kept for the whole visit, and a Destination's `src` would keep its whole sector alive.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 8 tests.
- [ ] **Step 5: Commit.** `git commit -m "Generated places as marks on the chart, each at its levels and under every hand-made place, and asked for once a second or on a real move"`

---

### Task 4: What moves, in 3D: heights, traffic, events and the way back

**Files:**
- Modify: `src/components/universe/chart/marks.js`:
  - `:44-47` (`COLOUR` at `:47` and the comment over it: it gains `traffic`, `event` and `came`)
  - `:107-127` (`liveMarks` at `:110` and the comment over it)
  - the header's `liveMarks` lines (`:23-24`)
- Modify: `src/components/universe/chart/marks.test.js`. `:83`'s expected levels become all three, and the commit names it. There's a new `describe`.

**Interfaces:**
- Consumes:
  - lane 3's `canonicalPlace` (`places/ids.js`; light, as lane 3's weight test allows)
  - lane 4a's `THINGS.note.cameFrom` and lane 4b's `EVENT.name` (`words.js`)
  - Task 3's `generatedMarks`, `mergeMarks` and `chartRow` (in the test)
  - `nav.js`'s `destinationById` (in the test)
- Produces: **`liveMarks(now) → Mark[]`**, from `where()`, in this order: pilots, far fights, traffic, events, the way back.
  - **Pilots:**
    - `at: [x, finite(e.y) ? e.y : shipY, z]`
    - levels all three
    - otherwise as lane 6a has them
  - **Far fights:** the same height rule. The rest is as lane 6a has them.
  - **Traffic,** from `now.traffic` (`[{ id, kind, x, y, z }]`, Task 7):
    - `traffic:<id>`, kind and shape `traffic`, name `''`
    - priority 10, levels `['system']`, colour `#9fd8ff`
    - not pickable
  - **Events,** from `now.events` (lane 4b's `[{ id, kind, name, x, y, z, big }]`):
    - `event:<id>`, kind and shape `event`
    - name `e.name` when it's a string, else `''`
    - priority 48 when `big`, else 36
    - levels `system` and `neighbourhood`, colour `#ffb347`
    - not pickable
  - **The way back,** from `now.cameFrom` (lane 4a's `{ id, name, at, key }`):
    - one mark, kind `came`, shape `portal`, name `THINGS.note.cameFrom`
    - at `at`, priority 75, levels all three, colour `#9fd8ff`
    - When `canonicalPlace(id)` reads it (a wormhole thing), the mark's id is that and it is pickable: travel takes it.
    - Else (lane 4b's wormhole event, `wormhole:<n>`) the id is `came:<id>` and it isn't pickable, because a point is no place.
  - Each list keeps lane 6a's rules:
    - an entry with no id, or a non-finite x or z, is left out
    - a second with the same id is left out
    - a list that isn't an array is nothing
    - a way back whose `at` isn't finite is left out

- [ ] **Step 1: Write the failing tests.** Change `:83` to `.toEqual([['system', 'neighbourhood', 'universe']])`, then add:

```js
describe('what moves, in 3D', () => {
  const ship = { x: 0, y: 250, z: 0 };
  it('stands pilots and far fights at their own heights, and shows pilots at every level', () => {
    const m = liveMarks({ ship, pilots: [{ id: 'a', x: 10, y: 3000, z: 20 }, { id: 'b', x: 1, z: 2 }], farFights: [{ id: 'f', x: 5, y: -800, z: 5, label: 'Fighting near Okonkwo' }] });
    expect(m.map((x) => [x.id, x.at])).toEqual([['pilot:a', [10, 3000, 20]], ['pilot:b', [1, 250, 2]], ['fight:f', [5, -800, 5]]]);
    expect(m[0].levels).toEqual(['system', 'neighbourhood', 'universe']);
  });
  it('draws traffic close in and unnamed, and events going on by their names', () => {
    const m = liveMarks({ ship, traffic: [{ id: 7, kind: 'freighter', x: 40, y: 260, z: -40 }], events: [{ id: 'flare:1', kind: 'flare', name: EVENT.name.flare, x: 900, y: 0, z: 0, big: true }, { id: 'distress:2', kind: 'distress', name: EVENT.name.distress, x: 1, y: 2, z: 3, big: false }] });
    expect(m.find((x) => x.id === 'traffic:7')).toMatchObject({ kind: 'traffic', shape: 'traffic', name: '', at: [40, 260, -40], levels: ['system'], pickable: false });
    expect(m.find((x) => x.id === 'event:flare:1')).toMatchObject({ kind: 'event', shape: 'event', name: EVENT.name.flare, levels: ['system', 'neighbourhood'], pickable: false, priority: 48 });
    expect(m.find((x) => x.id === 'event:distress:2').priority).toBe(36);
  });
  it('names an event of every kind the director has', () => {
    const events = Object.entries(EVENT.name).map(([kind, name], i) => ({ id: `${kind}:${i}`, kind, name, x: i, y: 0, z: 0, big: false }));
    expect(liveMarks({ ship, events }).map((m) => m.name)).toEqual(Object.values(EVENT.name));
  });
  it('marks the way back: a place travel takes you to, or a point that is only a mark', () => {
    expect(liveMarks({ ship, cameFrom: { id: 'e:40,-3:w12', name: 'Wormhole', at: [4.8e6, 0, -3.6e5], key: 'E:40,-3' } })[0]).toMatchObject({ id: 'E:40,-3:w12', kind: 'came', name: THINGS.note.cameFrom, pickable: true, levels: ['system', 'neighbourhood', 'universe'] });
    expect(liveMarks({ ship, cameFrom: { id: 'wormhole:3', name: 'A wormhole', at: [1, 2, 3], key: 'E:0,0' } })[0]).toMatchObject({ id: 'came:wormhole:3', pickable: false });
  });
  it('reads a where() from before any of this, or a broken one, as nothing new', () => {
    expect(liveMarks({ ship, traffic: 'x', events: [null, { id: 'e', x: NaN, y: 0, z: 0 }], cameFrom: { id: 'x', at: [NaN, 0, 0] } })).toEqual([]);
    expect(liveMarks({ ship: null, pilots: [{ id: 'c', x: 1, y: Infinity, z: 1 }] })[0].at).toEqual([1, 0, 1]);
  });
  it('puts nothing on the chart you can’t go to: everything you can pick, travel takes', () => {
    const rows = [chartRow({ id: 'E:1,0:3', place: 'system', kind: 'star', name: 'Okonkwo', type: 'Yellow star system', at: [1, 2, 3], color: '#fff', reach: 80, cube: [1, 0, 0] })];
    const now = { ship, pilots: [{ id: 'p', x: 1, z: 1 }], farFights: [{ id: 'f', x: 2, z: 2 }], traffic: [{ id: 1, x: 3, y: 0, z: 3 }], events: [{ id: 'flare:1', name: 'x', x: 4, y: 0, z: 4 }], cameFrom: { id: 'E:40,-3:w12', at: [5, 0, 5] } };
    const marks = mergeMarks(HAND_MARKS, liveMarks(now), generatedMarks(rows)); // (the nav map's order, Task 10)
    for (const m of marks.filter((x) => x.pickable)) expect(Boolean(destinationById(m.id)) || canonicalPlace(m.id) === m.id, m.id).toBe(true);
    expect(new Set(marks.map((m) => m.id)).size).toBe(marks.length);
  });
});
```

  The file's imports gain these:
  - `EVENT` and `THINGS` (`../words`)
  - `chartRow`, `generatedMarks` and `mergeMarks` (`./generated`)
  - `destinationById` (`../nav`)
  - `canonicalPlace` (`../places/ids`)
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/marks.test.js`. Expected: the new tests and `:83` FAIL.
- [ ] **Step 3: Implement.** The header's lines say that a height missing sits level with the ship, as before (an older pilot's pose, a `where()` without lane 4b).
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe/chart src/components/universe/MiniMap.test.jsx src/components/universe/places/weight.test.js`. Expected: PASS.
  - The mini-map's tests are unchanged and pass, so its projection and data are as lane 6a left them.
  - Lane 3's weight test still finds no generator behind `Interests.jsx`.
- [ ] **Step 5: Commit.** `git commit -m "The chart's live marks at their own heights: pilots everywhere, fights, traffic, events going on and the way back"`. The body names `marks.test.js:83` as replaced and why (finding 6).

---

### Task 5: What a view of the chart lists, from the sectors at hand

**Files:**
- Create: `src/components/universe/charted/pick.js`, `src/components/universe/charted/pick.test.js`
- Modify, only if the face doesn't lend `rowAt` yet: lane 3's `src/components/expanse/shared/space.js` and `shared.test.js` (one name, from lane 4a's `gen/paths.js`)

**Interfaces:**
- Consumes:
  - lane 3's `placesAround` and `AROUND` (`places/around.js`, with lane 4a's change)
  - lane 3's `THING_CARDS` (`places/cards.js`, with lane 4a's `chart` on each kind)
  - the face's `THING_BASE` and `rowAt`; in the test also lane 4a's `KINDS` and `nearestOfKind`, and lane 3's `resolvePlace`
  - Task 0's `parseSpaceId`
  - Task 3's `CHARTED`, and in the test `chartRow` and `generatedMarks`; Task 2's `KNOWN` (in the test)
- Produces:
  - **`chartOf(dest) → { shape, priority } | null`:** `THING_CARDS[dest.sub]?.chart ?? SPARE_CHARTS[dest.sub] ?? null` for a `place` of `'thing'`, `'extra'` or `'wonder'`, else null (and null for no `dest`). Task 8's scene chart passes it to `chartRow`. It lives here because `cards.js` is the generator's side, which the page never imports.
  - **`SPARE_CHARTS`**, frozen: a chart for each of lane 3's six cards, which carry none in lane 4a's plan (lane 4a spreads `rogue`'s row and adds `land`, and reuses `pulsar`'s for generated pulsars). Each borrows lane 4a's number for its nearest kind:

    ```
    { rock: { shape: 'dot', priority: 15 }, ice: { shape: 'dot', priority: 15 },     // (as field and icefield)
      derelict: { shape: 'dot', priority: 15 },                                       // (as debris)
      rogue: { shape: 'dot', priority: 20 },                                          // (as an outpost: a planet adrift)
      nebula: { shape: 'cloud', priority: 35 },                                       // (as pocket and remnant)
      pulsar: { shape: 'star', priority: 30 } }                                       // (as magnetar)
    ```

    - A chart lane 4a has given one of the six since wins.
    - So what's drawn and what's known agree: a rock, an ice ball or a derelict seen by name (15, under `KNOWN.least`) isn't kept, a rogue planet (20) is, and none of them falls back to `chartRow`'s default dot of 20 (finding 21). Derelicts are a tenth of the lattice, hundreds a sector, so keeping each one named would fill the table with them.
  - **`chartPlaces(sectors, focus, t, { level, range, max = CHARTED.max } = {}) → [{ id, at, dist }]`**, nearest first, ids unique. `sectors` is a `Map` or any iterable of sectors, lane 2's `expanse.sectors()`, and `focus` is a map-frame point.
  - **`system`:**
    - It is `placesAround(sectors, focus, t, { ...AROUND, far: range, max })`, kept to rows with `dist ≤ range`, then the first `max`.
    - That's every star, planet (at `orbitAt`), moon, station, lattice thing and list row near the focus, by lane 3's own rule.
    - `dist` is the row's.
  - **`neighbourhood`:** lane 2's 3 × 3 × 3, where the spec's table puts systems, things in space, gargantuans and nebulae. From each sector whose cube comes within `range` of `focus`:
    - **big:** each list row with `gargantuan === true` (lane 4a's gargantuan and arrival lists), with `dist = max(0, |at − focus| − size) ≤ range`
    - **systems:** `sector.systems`, with `dist = |at − focus| ≤ range`
    - **things:**
      - the legacy wonders (`sector.wonders`)
      - every list row whose wonder number is under `THING_BASE`: lane 4a's lists out between the systems, not the lattice, the stations or the rows round a system
      - each `at` is `rowAt(row, t)`, and `dist = max(0, |at − focus| − size) ≤ range`
    - **Kept:**
      - every big one
      - then of `room = max − big`:
        - the nearest `min(systems, ⌈room × CHARTED.systems⌉)` systems
        - the nearest things up to `room` less those
        - then more systems, if the things left room
      - The nearest are chosen by a partial selection when a full sort of the candidates is over Step 5's bound.
  - **`universe`:** the big ones within range in the sectors at hand, and nothing else. Known systems, and the nearest gargantuans past the loaded sectors, come from Task 8 (finding 15).
  - It is `[]` for a focus that isn't three finite numbers, a `range` that isn't over 0, or an unknown level. It reads the sectors and builds nothing.

- [ ] **Step 1: Write the failing tests:**

```js
import { beforeAll, describe, expect, it } from 'vitest';
import { KINDS, THING_BASE, UNIVERSE, fullSector, gargantuanSectors, nearestOfKind, orbitAt } from '../../expanse/shared/space';
import { parseSpaceId, sectorCentre, sectorKey } from '../../../lib/space/address';
import { resolvePlace } from '../places/resolve';
import { THING_CARDS } from '../places/cards';
import { CHARTED, chartRow, generatedMarks, markPriority } from '../chart/generated';
import { KNOWN } from './known';
import { SPARE_CHARTS, chartOf, chartPlaces } from './pick';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const no = (id) => parseSpaceId(id);
// lane 3's cards, which lane 4a's plan gives no chart: chartOf's spares stand for them
const UNCHARTED = ['rock', 'ice', 'derelict', 'rogue', 'nebula', 'pulsar'];
const mid = sectorCentre(1, 0, 0);
let sectors;
let withHole;
let byKind; // kind → { ss, found }: sectors holding a row of it, and that row
// (a gargantuan of the test's own, so the rule holds whichever sector has the real one)
const hole = { id: 'E:1,0:w3', kind: 'hole', gargantuan: true, name: 'Test hole', at: [mid[0] + 150000, mid[1], mid[2]], size: 9000 };
const big = (ss) => [...ss.values()].flatMap((s) => Object.values(s.extras ?? {}).flat()).filter((r) => r.gargantuan);
beforeAll(() => {
  sectors = new Map([[1, 0, 0], [2, 0, 0], [1, 1, 0]].map(([x, y, z]) => fullSector(UNIVERSE, x, y, z)).map((s) => [s.id, s]));
  const s = sectors.get('E:1,0');
  withHole = new Map([...sectors, ['E:1,0', { ...s, extras: { ...s.extras, gargantuan: [hole] } }]]);
  const g = gargantuanSectors(UNIVERSE, [1, 0, 0], { n: 1 })[0];
  const all = sectors.has(sectorKey(...g)) ? sectors : new Map([...sectors, [sectorKey(...g), fullSector(UNIVERSE, ...g)]]);
  byKind = new Map(Object.keys(KINDS).map((kind) => {
    const ss = withKind(all, kind);
    return [kind, { ss, found: nearestOfKind(ss.values(), kind, mid, 0) }];
  }));
});

describe('what a view of the chart lists', () => {
  it('in a neighbourhood: every gargantuan, the nearest systems, the things between them, and never the lattice, a station or a body', () => {
    const got = chartPlaces(withHole, mid, 0, { level: 'neighbourhood', range: 200000 });
    expect(got).toHaveLength(CHARTED.max);
    expect(got.map((r) => r.dist)).toEqual([...got.map((r) => r.dist)].sort((a, b) => a - b));
    for (const g of big(withHole).filter((r) => len(r.at, mid) - r.size <= 200000)) expect(got.some((r) => r.id === g.id), g.id).toBe(true);
    const systems = got.filter((r) => no(r.id).system !== undefined);
    const room = CHARTED.max - big(withHole).filter((r) => len(r.at, mid) - r.size <= 200000).length;
    expect(systems.length).toBeGreaterThanOrEqual(Math.ceil(room * CHARTED.systems));
    const furthest = Math.max(...systems.map((r) => r.dist));
    for (const x of [...sectors.values()].flatMap((s) => s.systems)) if (!systems.some((r) => r.id === x.id)) expect(len(x.at, mid)).toBeGreaterThanOrEqual(furthest);
    for (const r of got) {
      expect(no(r.id).planet, r.id).toBeUndefined();
      if (no(r.id).wonder !== undefined) expect(no(r.id).wonder, r.id).toBeLessThan(THING_BASE);
      expect(r.dist, r.id).toBeLessThanOrEqual(200000);
    }
    expect(got.some((r) => no(r.id).wonder !== undefined && r.id !== hole.id)).toBe(true);
  });
  it('at a system: its star and its planets where they are now, nothing past the range', () => {
    const sys = sectors.get('E:1,0').systems.find((x) => x.planets.length > 2);
    const got = chartPlaces(sectors, sys.at, 500, { level: 'system', range: 7000 });
    expect(got.map((r) => r.id)).toContain(sys.id);
    const planets = got.filter((r) => r.id.startsWith(`${sys.id}:`) && no(r.id).moon === undefined);
    expect(planets.length).toBeGreaterThan(0);
    for (const r of planets) expect(r.at).toEqual(orbitAt(sys.planets[no(r.id).planet], 500));
    for (const r of got) expect(r.dist, r.id).toBeLessThanOrEqual(7000);
  });
  it('across the universe: only the gargantuans', () => {
    const ids = chartPlaces(withHole, mid, 0, { level: 'universe', range: 2e6 }).map((r) => r.id);
    expect(new Set(ids)).toEqual(new Set(big(withHole).map((r) => r.id)));
  });
  it('is nothing off in empty space or for a broken view, and the same every time', () => {
    expect(chartPlaces(sectors, [1e9, 0, 0], 0, { level: 'neighbourhood', range: 200000 })).toEqual([]);
    for (const bad of [[NaN, 0, 0], null]) expect(chartPlaces(sectors, bad, 0, { level: 'system', range: 5000 })).toEqual([]);
    expect(chartPlaces(sectors, mid, 0, { level: 'neighbourhood', range: 0 })).toEqual([]);
    expect(chartPlaces(sectors, mid, 0, { level: 'nowhere', range: 5000 })).toEqual([]);
    expect(chartPlaces(sectors, mid, 0, { level: 'neighbourhood', range: 200000 })).toEqual(chartPlaces(sectors, mid, 0, { level: 'neighbourhood', range: 200000 }));
  });
  // (spec B's "shows on the map", for every kind lane 4a draws: the neighbourhood
  // leaves out the lattice and the lists round systems, so the system level is
  // where each must come, by lane 3's placesAround)
  it('lists every kind of thing at the system level, each a mark carrying its card’s chart', () => {
    expect(byKind.size).toBe(32);
    for (const [kind, { ss, found }] of byKind) {
      expect(found, kind).not.toBeNull();
      expect(chartPlaces(ss, found.at, 0, { level: 'system', range: 7000 }).map((r) => r.id), kind).toContain(found.id);
      const dest = resolvePlace(found.id, { t: 0, sectors: ss, build: false });
      expect(dest?.id, kind).toBe(found.id);
      const own = kind === 'system' || kind === 'station'; // (chartRow's own chart, by place: a star, a station)
      const card = own ? null : (THING_CARDS[kind]?.chart ?? null);
      if (!own && !UNCHARTED.includes(kind)) expect(card, kind).not.toBeNull(); // (lane 4a's kinds each carry one)
      const chart = chartOf(dest);
      expect(chart, kind).toEqual(own ? null : (card ?? SPARE_CHARTS[kind]));
      const row = chartRow(dest, { chart });
      if (!own) expect(row.chart, kind).toEqual(chart);
      expect(generatedMarks([row])[0], kind).toMatchObject({ id: found.id, pickable: true, shape: row.chart.shape, priority: markPriority(row) });
    }
  });
  // (finding 21: what's drawn and what's known by name agree, a passing rock under KNOWN.least, a rogue planet at it)
  it('gives lane 3’s six cards a chart of their own, borrowed from lane 4a’s nearest kinds, and lets a card’s own win', () => {
    expect(Object.keys(SPARE_CHARTS).sort()).toEqual([...UNCHARTED].sort());
    for (const k of UNCHARTED) expect(chartOf({ place: 'thing', sub: k }), k).toEqual(THING_CARDS[k]?.chart ?? SPARE_CHARTS[k]);
    if (!THING_CARDS.rock?.chart) expect(chartOf({ place: 'thing', sub: 'rock' }).priority).toBeLessThan(KNOWN.least);
    if (!THING_CARDS.rogue?.chart) expect(chartOf({ place: 'thing', sub: 'rogue' }).priority).toBeGreaterThanOrEqual(KNOWN.least);
    expect([chartOf({ place: 'system', sub: 'G' }), chartOf(null)]).toEqual([null, null]);
  });
});
```

  `withKind(ss, kind)`, a helper in the test file, gives `ss` itself when `nearestOfKind(ss.values(), kind, mid, 0)` finds a row. Otherwise it forces one: a copy of `ss` in which one real row has only its `kind` changed, its sector and that list copied and nothing else.
  - **A gargantuan form:** the `w3` row of the sector `gargantuanSectors` gave, which the `beforeAll` adds beside the three. Forcing it lets every form be checked from one real row, since a 3 × 3 × 3 holds about one.
  - **A legacy `nebula`:** the first legacy wonder of the sectors (`sector.wonders`).
  - **Any other kind:** the first row of another kind of the same catalogue entry (`KINDS[k].n`), which lane 4a keeps in the same list: a pulsar for a magnetar, a field for an icefield.
  - A kind with none of these is left unforced, and the test fails on it by name.

  The rows are found in the `beforeAll`, so the test itself stays under a second.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/charted/pick.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `pick.js`.** Its header says why the neighbourhood doesn't list the lattice: thousands of rocks a sector, and the spec's level names things in space, not every rock. It also says why it reads lane 2's sectors and makes none.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 6 tests, each under a second. A kind the kinds test fails on is one of two gaps. Fix it at the narrowest place and say so in the commit:
  - **Not listed, or not resolved:** a gap between lane 3's `placesAround` and lane 4a's lists. This module's `system` rule is the place to look first.
  - **No chart on its card:** for one of lane 4a's kinds (not in `UNCHARTED`), add the `chart` its plan gives it to its card in `things/cards.js`, one line. One of `UNCHARTED` has its spare unless lane 4a has given its card a chart since, which the test reads first, so a failure there is `chartOf`'s order.
- [ ] **Step 5: Time it against the bound.** In a scratch script (not committed), build the 27 sectors round `E:1,0` once and call each level 5 times to warm up. Then time 20 `neighbourhood` calls at a range of 250,000 and 20 `system` calls at 7,000, each focused on a different one of `E:1,0`'s systems.
  - Expected: both medians at most 2 ms (Global Constraints).
  - Over it: choose the nearest by a partial selection (a bounded heap of `max`) in place of sorting every candidate, and time again.
  - Still over: stop and report the numbers. Don't shorten the list to meet the bound.
  - Write the medians into the README under "The chart's ask". The scene asks at most once a second.
- [ ] **Step 6: Commit.** `git commit -m "What a view of the chart lists, from the sectors round the ship: systems, things and gargantuans by zoom"`

---

### Task 6: A long trip, timed without flying it

**Files:**
- Modify: `src/components/universe/nav.js`. Lane 3 rewrote `tripTime` (`:304-343` at `cc5e2eaf`).
- Modify: `src/components/universe/nav.test.js` (a new `describe` at the end)

**Interfaces:**
- Consumes: lane 3's `longTrip` (`places/trip.js`, already imported by `nav.js`), `parkFor` and `transit`.
- Produces: **`tripTime(ship, id, drive, { limit = 150, dt, place })`**, the same signature, with one change.
  - **A leg by super speed or cruise** first works out `est = longTrip(ship, park, drive)`. When `est > limit`, the leg's time is `est`, and the simulation isn't run.
  - **A portal leg so long** takes `first = est` and comes out as the jump's branch does: `transit({ …ship at the portal, speed: 0 }, leg)?.ship`.
  - Lane 3 simulated first, and took the formula only when the simulation didn't arrive. That was 4,500 steps of the autopilot (about 90 ms here) a drive, twice every two seconds, for any far pick on the nav map (finding 4). A trip the formula puts within `limit` is flown as before.

- [ ] **Step 1: Write the failing tests:**

```js
describe('a long trip, timed without flying it', () => {
  const out = () => ({ ...spawn(null), x: 600000, y: 0, z: 0, heading: 0 });
  it('is the formula’s, straight off, for a hand-made place past the simulation’s reach', () => {
    for (const drive of ['super', 'cruise']) expect(tripTime(out(), 'marvel', drive)).toBeCloseTo(longTrip(out(), parkFor('marvel', [600000, 0]), drive), 9);
  });
  it('costs no flight: fifty of them in under a second', () => {
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) tripTime(out(), 'marvel', 'super');
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
```

  The imports gain `spawn` (`./ship`) and `longTrip` (`./places/trip`), if lane 3's `describe` hasn't already added them.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/nav.test.js -t "without flying"`. Expected: the second FAILS (about 4.5 s for fifty). The first passes already, through lane 3's fallback.
- [ ] **Step 3: Implement.** `tripTime`'s comment says why the formula comes first: spec F's "not the 150 s simulation", and the side panel's two-second refresh.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS, with every existing `nav.test.js` test unchanged.
- [ ] **Step 5: Run PR 6b.1's gate.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, within budget.
- [ ] **Step 6: Commit.** `git commit -m "A long trip's time is the formula's, straight off, never 150 s of flying"`

---

## PR 6b.2: Wired and drawn

### Task 7: `where()` moves out, with the pilots' heights and the traffic

**Files:**
- Create: `src/components/universe/whereNow.js`, `src/components/universe/whereNow.test.js`
- Modify: `src/components/universe/scene.js`:
  - the handle's `where() { … }` (`:6277-6294` at `cc5e2eaf`, with lanes 3, 4a and 4b's lines added since) becomes `where: whereNow,`
  - `const whereNow = createWhere({ … });` on the line before the handle's `return {` (`:6090`)
  - the import
- Modify: `src/components/universe/online/pilots.js`:
  - `:208` (`seen: { x: 0, y: 0, z: 0 }`)
  - after `:339` (`sh.seen.y = s.y;`)
  - `:583` (the chart's `y: sh.seen.y`)
- Modify: `src/components/universe/online/pilotsNodes.js`, the same three lines (`:215`, after `:346`, `:590`). It is the node renderer's twin, and `pilotsNodes.test.js` pins the two charts equal.
- Modify: `src/components/universe/online/pilotsNodes.test.js` (a new `describe`)
- Modify: `src/components/universe/traffic.js`:
  - a `chart` getter after `groups` (`:589-591`)
  - the header's interface line (`:39-42`)
- Modify: `src/components/universe/traffic.test.js` (a new `describe`)

**Interfaces:**
- Consumes: what `where()` reads today, every name by the line it's declared on.
  - **Values,** declared above the handle and never reassigned:
    - `state` (`:1174`), `pilots` (`:1122`), `traffic` (`:858`; null with reduced motion)
    - lane 3's `places`, lane 4a's `things`, lane 4b's `events`
    - `wall`, `onFoot`
  - **Thunks,** reassigned:
    - `front` (`let`, `:1053`)
    - lane 4b's `holderNow`
  - `hyperState` and `HYPER` are imported by `whereNow.js` itself from `nav.js`, which imports no three.js.
  - **`fightLabel`** (`farFights.js:73`, with lane 4b's `near`) is passed in as the `label` dep, never imported: `farFights.js` imports three (`:25`), and this module is on the pure list.
- Produces:
  - **`createWhere({ state, wall, onFoot, pilots, traffic = null, front, places = null, events = null, things = null, holder = () => null, label = () => '' }) → () => Where`.**
    - `Where` is the body's object exactly as it stands on the branch, with three changes:
      - `pilots` maps `{ id, name, x, y, z }`, so each pilot's `y` is passed on
      - `traffic: traffic?.chart ?? []` is added
      - where the body calls `fightLabel(f.at)` (lane 4b's `f.label ?? fightLabel(f.at)`), it calls `label(f.at)`
    - Every other key is as the branch has it. Lane 3's plan gives `place`, `docked` and `t`. Lane 4b's gives `farFights` with `y`, `events` and `holder`. Lane 4a's gives `cameFrom`.
  - **`pilots.chart`** entries gain `y`: the last pose's height, as `x` and `z` are.
  - **`traffic.chart` → `[{ id, kind, x, y, z }]`:** each live group's first ship still flying (`members.find((m) => m.alive)`), at its `model.group.position`, in the map's frame. A group with none is left out. It is light: no arrays a member, unlike `groups`.

- [ ] **Step 1: Read `where()` as it stands,** and write `whereNow.test.js` against it.
  - Before writing, quote the body from `scene.js` and list every key it returns.
  - Where the merged code differs from the field list below (a lane named a key otherwise), the test follows the code. Note it in the commit.

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createWhere } from './whereNow';

const label = (at) => `Fighting at ${at.join(', ')}`; // (the scene passes farFights.js's fightLabel)
const fakes = (more = {}) => ({
  state: { ship: { x: 1, y: 2, z: 3, heading: 0.5, speed: 4, pitch: 0.1 }, at: 'marvel', jump: null, auto: null, then: null, crash: null, interdicted: false, hyperAt: null, stats: {}, fights: [{ id: 'f1', at: [10, 20, 30], label: 'Fighting near Okonkwo' }, { id: 'f2', at: [0, 0, 0] }], spaceT: 1234 },
  wall: () => 100,
  onFoot: () => false,
  pilots: { chart: [{ id: 'p', name: 'Ace', x: 5, y: 600, z: 7, mode: 'blip', ally: false }] },
  traffic: { chart: [{ id: 3, kind: 'freighter', x: 1, y: 2, z: 3 }] },
  front: () => null,
  places: { here: () => ({ id: 'E:1,0:3', place: 'system' }), docked: () => null },
  events: { running: () => [{ id: 'flare:1', kind: 'flare', name: 'Solar flare', at: [7, 8, 9], big: true, from: [0, 0, 0] }] },
  things: { cameFrom: () => null },
  holder: () => ({ id: 'empire', name: 'The Galactic Empire', side: 'starwars', since: 4 }),
  label,
  ...more,
});

describe('where(), for the nav map', () => {
  it('says where the ship is and what is round it, every field as the scene had it, pilots and traffic in 3D', () => {
    expect(createWhere(fakes())()).toEqual({
      ship: { x: 1, y: 2, z: 3, heading: 0.5, speed: 4 },
      at: 'marvel', going: null, foot: false, crashed: false, interdicted: false,
      hyper: { ready: true, wait: 0, why: null },
      pilots: [{ id: 'p', name: 'Ace', x: 5, y: 600, z: 7 }],
      farFights: [{ id: 'f1', x: 10, y: 20, z: 30, label: 'Fighting near Okonkwo' }, { id: 'f2', x: 0, y: 0, z: 0, label: 'Fighting at 0, 0, 0' }],
      front: null, place: 'E:1,0:3', docked: null, t: 1234,
      events: [{ id: 'flare:1', kind: 'flare', name: 'Solar flare', x: 7, y: 8, z: 9, big: true }],
      holder: { id: 'empire', name: 'The Galactic Empire', side: 'starwars' },
      cameFrom: null,
      traffic: [{ id: 3, kind: 'freighter', x: 1, y: 2, z: 3 }],
    });
  });
  it('says where it’s going and how: a jump, super speed, or on through a portal', () => {
    const w = (s) => createWhere(fakes({ state: { ...fakes().state, ...s } }))().going;
    expect(w({ jump: { id: 'veil' } })).toEqual({ id: 'veil', drive: 'hyper' });
    expect(w({ auto: { id: 'veil', od: 3 } })).toEqual({ id: 'veil', drive: 'super' });
    expect(w({ auto: { id: 'rmportal', od: 1 }, then: { id: 'squanch' } })).toEqual({ id: 'squanch', drive: 'cruise', via: 'rmportal' });
  });
  it('has no ship, traffic or holder when there are none, and reads the front and the holder as they are now', () => {
    let front = null;
    let holder = null;
    const where = createWhere(fakes({ state: { ...fakes().state, ship: null }, traffic: null, front: () => front, holder: () => holder }));
    expect(where()).toMatchObject({ ship: null, traffic: [], holder: null, front: null });
    front = { where: () => ({ name: 'Hoth' }) };
    holder = { id: 'rebels', name: 'The Rebellion', side: 'starwars' };
    expect(where()).toMatchObject({ front: { name: 'Hoth' }, holder: { id: 'rebels' } });
  });
  it('labels a fight with no label of its own by the dep, and is empty without one', () => {
    expect(createWhere(fakes({ label: undefined }))().farFights[1].label).toBe('');
  });
  it('stays on the pure side: no three.js, and not farFights.js, which imports it', () => {
    expect(readFileSync(new URL('./whereNow.js', import.meta.url), 'utf8')).not.toMatch(/from ['"](three|\.\/farFights)['"]/);
  });
});
```

  In `pilotsNodes.test.js`, a new `describe('a pilot’s height, for the chart')`. A local helper runs each twin as the file's `make` does, but with one peer, `peer('hi', { snaps: [0, 100].map((at) => ({ ...snaps(0)[0], at, y: 2500 })) })`. For both `glsl` and `nodes`, `pilots.chart.find((p) => p.id === 'hi').y` is 2500.

  In `traffic.test.js`, a new `describe('the chart’s traffic')`, with the file's `setup()`, `parked` and `DT`:
  - After `traffic.soon()` and 60 updates of `DT` at `parked`, every entry of `traffic.chart` matches a live group of `traffic.groups`: the same `id` and `kind`, and its `x`, `y` and `z` to two places equal to that group's `lead`. There's one entry for each group with a ship alive.
  - A fresh `setup()`'s `traffic.chart` is `[]`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/whereNow.test.js src/components/universe/online/pilotsNodes.test.js src/components/universe/traffic.test.js`. Expected: FAIL (module not found; no `y`; no `chart`).
- [ ] **Step 3: Implement and move.**
  - Write `whereNow.js` from the body, and the two getters' changes.
  - In `scene.js`, put `const whereNow = createWhere({ state, wall, onFoot, pilots, traffic, front: () => front, places, events, things, holder: () => holderNow, label: fightLabel });` on the line before the handle's `return {`. `scene.js` keeps its `fightLabel` import (`:159`).
  - Replace the method with `where: whereNow,`, and add the import.
  - Count `scene.js`'s lines before and after.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS. The twins' `answers the same for the guns, the hits and the chart` still passes.
- [ ] **Step 5: Check it in the browser.** Start the dev server and run these, then stop it:
  - `CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs desktop`
  - `CHROME=/opt/pw-browsers/chromium node scripts/flyto-check.mjs --fake` (its pilot's pose reaches the chart through `where()`)

  Expected: each passes as it did before Task 7.
- [ ] **Step 6: Commit.** `git add src/components/universe/whereNow.js src/components/universe/whereNow.test.js src/components/universe/scene.js src/components/universe/online/pilots.js src/components/universe/online/pilotsNodes.js src/components/universe/online/pilotsNodes.test.js src/components/universe/traffic.js src/components/universe/traffic.test.js && git commit -m "where() moves out of the scene, and tells the map the pilots' heights and the traffic"`. The body gives `scene.js`'s two counts.

---

### Task 8: The scene's chart: known places recorded, found, and asked for

**Files:**
- Create: `src/components/universe/charted/sceneChart.js`, `src/components/universe/charted/sceneChart.test.js`
- Modify: lane 3's `src/components/universe/places/scenePlaces.js`:
  - `createScenePlaces` takes an optional `named = null`
  - its `update` calls it (below)
- Modify: lane 3's `scenePlaces.test.js` (its `make` passes `named` through; one new `it`)
- Modify `src/components/universe/scene.js`. Each change says the lines it adds:
  - `import { createSceneChart } from './charted/sceneChart';` (+1)
  - `import { universeStore } from '../../runtime/local';` (+1), as `footScene.js:124` takes `localSaves` from there
  - on the line before `const places = createScenePlaces(…)` (+1):

    ```js
    const charted = createSceneChart({ places: () => places, sectors: () => expanse.sectors(), workers: ctx.rt.workers ?? null, universe, shared: universe === UNIVERSE, store: universeStore(), t: () => state.spaceT });
    ```

    - `places` is a thunk because it is made on the next line.
    - `state` is a thunk because it is declared below (`:1174`).
    - `universe` and `expanse` are lane 3's and lane 2's values, declared above. `UNIVERSE` is imported at `:222`. `ctx.rt.workers` is the pool lane 3's `createScenePlaces` is given.
    - `universeStore()` is Task 2's: the table's own database, in memory under Node. In a pocket the chart reads nothing from it.
  - `createScenePlaces`' deps, in place (0):
    - `emit: (e) => emit(e)` becomes `emit: (e) => { charted.heard(e); emit(e); }`
    - the deps gain `named: (ids) => charted.named(ids)`
  - the handle gains `chart: (q) => charted.rows(q),` (+1)
  - `dispose()` gains `charted.dispose();` (+1)
  - the `__universeDebug` object's line (`:5911`) gains `charted: charted.debug,` in place (0)

  That is +5 here. With Task 7's net, `scene.js` ends smaller than it started.
- Modify: `src/components/universe/UniverseMap.jsx`, the handle (`:236-246`): `chart: (q) => view.current?.chart?.(q) ?? null` (+1)
- Modify: `src/pages/Universe.jsx:100`: the `map` ref's stand-in gains `chart: () => null` (in place)
- Modify: lane 3's `src/components/universe/places/weight.test.js`:
  - `GENERATOR` gains `|^src\/components\/universe\/charted\/(pick|sceneChart)\.js$`
  - its `it.each` gains `'src/components/universe/NavMap.jsx'`
- Modify: `scripts/universe-endless-check.mjs` (lane 3's `travel` step: the arrival is known)

**Interfaces:**
- Consumes:
  - Task 2's `createKnown`, `KNOWN`, `systemIdOf` and `knowable`; Task 3's `CHARTED`, `chartRow`, `levelsOf` and `markPriority`; Task 5's `chartPlaces` and `chartOf`
  - lane 3's `places` (`resolve`, `missing`), its `'place'` events (`what: 'arrive'`) and `resolvePlace` (`places/resolve.js`)
  - lane 2's worker pool name `expanse` and its `'sector'` job (`{ type: 'sector', key, universe, sx, sy, sz }` answered with `{ key, sector }`), and the face's `withMoons` (a lazy getter over `moonsOf`, lane 2's plan; in the test also `sectorJob`)
  - the pool's `stats() → { [name]: { workers, busy, queued } }` (`runtime/workers.js:122-127`), which lists a name only once it has had a job. A finished job's worker is freed and handed the next queued job (`pump`) before the job's `then` runs (the worker's `onmessage`, `:49-55`), so `stats` read in the chart's settle shows whether anything else has the worker.
  - lane 4a's `gargantuanSectors` (on the face). A gargantuan is its sector's `w3`, as lane 4a's `debug.find` reads it.
  - Task 0's `parseSpaceId`, `sectorAt`, `sectorCentre`, `spaceId` and `SECTOR`
- Produces:
  - **`createSceneChart({ places, sectors, workers = null, universe = UNIVERSE, shared = true, store = null, t = () => 0, clock = () => performance.now() / 1000, giants = CHARTED.giants, rim = CHARTED.rim }) → { ready, heard(e), named(ids), rows(q), debug, dispose() }`:**
    - **`places`** is a thunk for lane 3's scene places, and **`sectors`** a thunk for lane 2's loaded sectors. **`workers`** is the runtime's pool: with none (Node), nothing is fetched. **`universe`** is the scene's. **`store`** is the table's (Task 2's `universeStore()` in the scene).
    - **`shared`** is whether the scene is in the shared universe. With it false (a pocket), there is no table: nothing is read, recorded or shown, and `ready` is resolved. The pocket's own gargantuans still show.
    - **`heard(e)`:** a `{ type: 'place', what: 'arrive', id }` for a place id adds `id` and `systemIdOf(id)` as `'visited'`: a planet's, a moon's and a station's system too. Every other event, and a hand-made id, does nothing.
    - **`named(ids)`:** for each id the table doesn't know as well already, `dest = places().resolve(id)`, and `row = chartRow(dest, { chart: chartOf(dest) })`, its light row. When `knowable(dest, row?.chart)`, it adds `id` and its system as `'named'`. So a place is known by name alone just when the chart it's drawn with ranks it `KNOWN.least` or more (finding 21).
    - **The light rows.** Two caches by id, in memory only:
      - **The known's:** `chartRow(dest, { chart: chartOf(dest), how })` for each known place found, at hand or fetched, and for each gargantuan fetched (`how` null). Each add keeps one when `dest` was found. It is capped with the table, plus `giants`.
      - **The view's:** the rows of the places `chartPlaces` lists, at most `CHARTED.keep`, the least lately listed dropped first. A row's fields but `at` are the same for its id at any `t`, so a view asked again resolves nothing again: it takes `at` from `chartPlaces` and `how` from the table.
    - **`rows(q) → { rows: ChartRow[], known: ChartRow[], rim: ChartRow[], left: number }`**, for `q = { focus, range, level, search, key }` (Task 3's `chartQuery`):
      - The same `key` within `CHARTED.every` of `clock` gives back the same object.
      - **`rows`**, at most `CHARTED.max` in all (Review Focus 3):
        1. `chartPlaces(sectors(), focus, t(), { level, range })`, each row from the view's cache or resolved by `places().resolve(id)` (never building), with `how` from the table.
        2. Then, only in the room those leave, the known's rows within `range` of `focus` whose `levelsOf` holds `level` and that aren't among them. Gargantuans come first, then the higher `markPriority`, then the newer `t` (a gargantuan you don't know has none, so it comes last), then the id.
      - **`known`** is every one of the known's rows of a known place, newest first. It leaves out the gargantuans you don't know. It is the same array until the cache changes.
      - **`rim`**, at the `universe` level only: the `rim` known places' rows nearest `focus` whose `at` is past `range`, nearest first. Task 10 pins their marks to the chart's rim. At any other level it is `[]`.
      - **`left`** is how many of the table's ids are neither cached nor given up yet: the known places the search can't find by name until their sectors come. It is 0 in a pocket.
      - The answer is worked out from what is cached. No known place is resolved inside `rows`: that is `want`'s, in chunks of its own. Then `rows` runs `want(q)`, and keeps `q` as the last asked and `clock()` as when.
      - A malformed `q` gives `{ rows: [], known, rim: [], left }`.
    - **`want(q)`**, the chart's work for the last `q`:
      - **What it wants:** the known ids not yet cached, in four kinds.
        - **At hand:** whose sector is at hand (`!places().missing(id)`).
        - **In range:** whose sector isn't at hand and comes within `range` of `focus` (`|sectorCentre − focus| − SECTOR × √3 / 2 ≤ range`). Without a search, a known place out of range is never fetched but for the rim's: lane 3's "fetch the visited places in view, not the whole list".
        - **The rim's,** at the `universe` level only: those in the `rim` sectors out of range nearest `focus` (by their middles) that hold a known id, cached or not. Counting the cached keeps the rim's sectors the same once they're in, so it never creeps on to the next. That is `rim` sectors at most, so the chart can pin the nearest places you know past its widest range (done item 7; finding 22).
        - **Searched:** with `q.search`, those whose sector is out of range too, so spec F's search covers every visited and named place (finding 3). Searching is the visitor's own ask for the list, so the rule stands: nothing is fetched for a place nobody asked to see.
        - And **gargantuans,** at the `universe` level only. Each is `spaceId(s, { wonder: 3 })` for an `s` of `gargantuanSectors(universe, sectorAt(...focus), { n: giants })` that isn't at hand, isn't cached and comes within range as above.
      - **At hand, in chunks.** The at-hand ids are resolved by `places().resolve(id)`, at most `CHARTED.max` a chunk, each chunk on a `setTimeout(0)` of its own and never inside `rows`, so a frame gets its turn between them. A found one is cached. One not found is no place, and is removed from the table.
      - **Fetched, one sector at a time.** The rest are grouped by sector key, and a key that failed less than `CHARTED.retry` ago is skipped. With no ask in flight, it takes the group whose sector's middle is nearest `focus` (the ship's, while the view follows it), in this order: in range, the rim's, the gargantuans', then the searched.
      - **Only on an idle pool.** It asks only when `workers.stats?.()?.expanse` is missing (the name has had no job yet) or shows `busy` and `queued` both 0. So lane 2's sector loads and lane 3's pick and trip fetches never queue behind it; one of them asked while the chart's build is in flight still waits for that one build (Review Focus 3).
      - It asks the pool itself: `workers.request('expanse', { type: 'sector', key: 'chart|' + key, priority: CHARTED.queue, universe, sx, sy, sz })`.
        - Its key is its own, never lane 3's `place|` or the expanse's.
        - `CHARTED.queue` is `Infinity`, so it goes after every queued job, whatever lane 2's priorities are.
        - It never calls `places().fetch`. That keeps only the last four sectors fetched, so the chart's asks would push out the one a pick or a trip is waiting on (finding 16).
      - **When it settles**, an answer with a `sector` goes through `withMoons`. The group's ids are resolved against that sector alone, `resolvePlace(id, { universe, t: t(), sectors: new Map([[key, sector]]), build: false })`, at most `CHARTED.max` a chunk: the first in the settle, the rest each on a `setTimeout(0)`, the sector held till the last.
        - A found one is cached.
        - A known id not found is no place, and is removed from the table. A gargantuan id not found is only dropped.
        - Then the sector is let go.
      - An answer of null, a rejection or a throw marks the key failed at `clock()`.
      - It makes one ask, and runs one chunk, at a time.
      - **It goes on by itself** (finding 3). It doesn't wait for the nav map's next ask, which comes at most once a second:
        - Once an ask has settled (found or failed) and its sector is let go, `want` runs again for the last `q` and asks for the next group, if the pool still shows nothing busy and nothing queued.
        - A chunk at hand that leaves more puts the next on the next `setTimeout(0)`.
        - It stops when nothing is left to want, or only keys that failed less than `CHARTED.retry` ago. It stops when the pool is busy, and the next `rows` starts it again. And it stops once the nav map has stopped asking, with no `rows` for `3 × CHARTED.every` of `clock`, so nothing goes on after the map is closed.
        - So a full table at hand is about 17 chunks back to back, with the main thread's turn between each. A search's fetches come one after another, each as soon as the last lands: a few hundred sectors at 45–130 ms a build is about 15 to 40 s on a desktop here, and several times that on a phone.
    - **`debug`:**
      - `known()`: the table's list
      - `cap`: the table's cap, `KNOWN.cap`, for the checks
      - `pending()`: every sector key holding a known id (or, at the `universe` level, a gargantuan's) that the last ask's `want` would still resolve, the at-hand ones included, as a sorted list. A sector whose key failed less than `CHARTED.retry` ago is left out. A sector at hand, or fetched and held, stays in it until all its ids are resolved, so a loop that waits on it waits for those chunks too.
      - `asked()`: the key in flight, or null
      - `ms()`: the median time of the last 20 answers worked out, in ms (`performance.now()` round `rows`' own work)
      - `settleMs()`: the median time of the last 20 chunks of `want`'s work, in ms: a chunk at hand, or one of a fetched sector's, its first with `withMoons`. The structured clone of a sector coming from the worker is the pool's, before the chart's handler, and isn't in it (Review Focus 3).
      - `answers()`: how many answers it has worked out so far
      - `flush()`: the table's flush
      - `hold(on)`: dev only. While held, `rows(q)` gives one frozen `{ rows: [], known: [], rim: [], left: 0 }`, runs no `want`, stops the one going on and keeps nothing as its last answer, so a browser check can see the chart without the generated places in the same run (Task 10).
      - `know(ids, how = 'named') → number`: dev only. Adds each place id through the table's `add` and gives how many were written, so a check can fill the table (Task 11).
    - **`dispose()`:** it cancels the ask in flight (`workers.cancel('expanse', 'chart|' + key)`), clears the chunk's timer, and ignores whatever comes after.
  - **`scenePlaces`' `named(ids)`.** It is called from `update`, while tags are shown (not held, flying, with a tags box), with the ids newly in the list handed to `tags.show`: those not in the list before. It is called once a change, and never with an empty list.
  - **The handle's `chart(q)`** is `charted.rows(q)`. **`map.current.chart`** is the page's way to it, null with no scene.

- [ ] **Step 1: Write the failing tests.** In lane 3's `scenePlaces.test.js`, its `make` gains `named`, passed through to `createScenePlaces`.
  - **The tags box.** `named` is only called while tags are shown. Lane 3's `make` (`make({ sectors, universe, workers, startAt, turn, device })`, its Task 12) passes none. Its Task 13 test hands one in: "a fake `tags` box records `show` calls. After an update facing the station, the list's first entry is the station". Read that test first, and hand the box in the same way. Below, `withTags()` stands for it: `make`'s option holding a fresh box of that test's kind. If Task 13 added no option to `make`, add `tags`, passed through to `createScenePlaces` as its `tags` dep.
  - **The heading.** The ship faces the station, as lane 3's far-thing test faces its row. `park` is 2,000 off the station on +x, so the station is on −x: `heading: headingTo(-1, 0)` and `nose: [-1, 0, 0]`. So the station is tagged by the name cone, and by being where the ship is, either way.

```js
it('names to `named` the places it newly tags, once each, none while held', () => {
  const named = [];
  const { tick } = make({ named: (ids) => named.push([...ids]), ...withTags() });
  const ship = { ...park, speed: 0, heading: headingTo(-1, 0) };
  const facing = { nose: [-1, 0, 0] };
  tick(ship, facing);
  expect(named).toHaveLength(1);
  expect(named[0]).toContain(st.id);
  tick(ship, facing);
  tick(ship, { ...facing, held: true });
  expect(named).toHaveLength(1);
});
```

  `sceneChart.test.js`:

```js
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createStore } from '../../../runtime/store';
import { UNIVERSE, fullSector, gargantuanSectors, sectorJob, thingRow, withMoons } from '../../expanse/shared/space';
import { parseSpaceId, sectorCentre, sectorKey, spaceId } from '../../../lib/space/address';
import { resolvePlace } from '../places/resolve';
import { CHARTED } from '../chart/generated';
import { chartOf, chartPlaces } from './pick';
import { KNOWN } from './known';
import { createSceneChart } from './sceneChart';

const FAR = [[5, 0, -3], [6, 0, -3], [5, 0, -2], [6, 0, -2], [5, 1, -3]];
let loaded; // what lane 2 has round the ship
let answers; // sector key → what the pool sends for it: lane 2's sectorJob, run once
let far; // E:5,-3, a sector it hasn't, as the scene would hold it
beforeAll(() => {
  loaded = new Map([[1, 0, 0], [2, 0, 0], [1, 1, 0]].map(([x, y, z]) => fullSector(UNIVERSE, x, y, z)).map((s) => [s.id, s]));
  answers = new Map(FAR.map(([sx, sy, sz]) => [sectorKey(sx, sy, sz), sectorJob({ type: 'sector', key: 'test', universe: UNIVERSE, sx, sy, sz }).answer]));
  far = withMoons({ ...answers.get('E:5,-3').sector });
});
const mid = sectorCentre(1, 0, 0);
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const flush = () => new Promise((r) => setTimeout(r, 0));
const s0 = () => loaded.get('E:1,0');
// the table's own database, as Task 2's universeStore() makes it
const fresh = () => createStore({ indexedDB: new IDBFactory(), name: 'tp-universe', tables: [KNOWN.table] });
// lane 2's pool, as far as the chart needs it: a far sector as sectorJob
// sends it, a tick later; any other is null, or made on demand with `make`;
// `busy` is how many other expanse jobs it holds (lane 2's loads, a pick's fetch)
function fakePool({ fails = false, make = false, busy = () => 0 } = {}) {
  return {
    stats: () => ({ expanse: { workers: 1, busy: busy(), queued: 0 } }),
    request: vi.fn(async (name, msg) => {
      await flush();
      const key = sectorKey(msg.sx, msg.sy, msg.sz);
      if (make && !answers.has(key)) answers.set(key, sectorJob({ ...msg, universe: UNIVERSE }).answer);
      const a = answers.get(key);
      return fails || !a ? null : { key: msg.key, sector: { ...a.sector } };
    }),
    cancel: vi.fn(),
  };
}
// lane 3's scene places, as far as the chart needs them: what's at hand
// resolves, and its fetch keeps the last four sectors it fetched, as lane 3's does
function fakePlaces() {
  const fetched = new Map();
  const hand = () => new Map([...loaded, ...fetched]);
  const resolve = (id) => resolvePlace(id, { t: 0, sectors: hand(), build: false });
  return {
    resolve,
    missing: (id) => Boolean(parseSpaceId(id)) && !hand().has(parseSpaceId(id).key),
    fetch: vi.fn(async (id) => {
      const key = parseSpaceId(id)?.key;
      if (key && !hand().has(key) && answers.has(key)) fetched.set(key, withMoons({ ...answers.get(key).sector }));
      while (fetched.size > 4) fetched.delete(fetched.keys().next().value);
      return resolve(id);
    }),
  };
}
function make({ store = fresh(), shared = true, places = fakePlaces(), workers = fakePool(), giants = 0, rim = 0 } = {}) {
  let now = 0;
  const chart = createSceneChart({ places: () => places, sectors: () => loaded, workers, universe: UNIVERSE, shared, store, t: () => 0, clock: () => now, giants, rim });
  return { chart, places, workers, store, later: (s) => (now += s) };
}
const ask = (focus, level, range, search = false) => ({ focus, level, range, search, key: `${level}|${focus}|${range}${search ? '|search' : ''}` });
// asks once, then lets the pool answer and the chart go on by itself, the
// clock standing still, till nothing's waiting (a later read moves the clock
// on by CHARTED.every for a fresh answer)
async function settle(chart, q) {
  chart.rows(q);
  for (let i = 0; i < 400 && (chart.debug.asked() || chart.debug.pending().length); i++) await flush();
}

describe('the scene’s chart', () => {
  it('remembers where you arrive and its system, out among the generated places only', async () => {
    const { chart, store, later } = make();
    await chart.ready;
    const sys = s0().systems[0];
    chart.heard({ type: 'place', what: 'arrive', id: sys.planets[0].id, name: sys.planets[0].name });
    for (const e of [{ type: 'place', what: 'leave', id: s0().systems[1].id }, { type: 'place', what: 'arrive', id: 'marvel' }, { type: 'jumped', id: s0().systems[2].id }]) chart.heard(e);
    expect(chart.debug.known().map((k) => [k.id, k.how]).sort()).toEqual([[sys.id, 'visited'], [sys.planets[0].id, 'visited']].sort());
    await chart.debug.flush();
    expect((await store.list(KNOWN.table)).map(([k]) => k).sort()).toEqual([sys.id, sys.planets[0].id].sort());
    later(CHARTED.every);
    expect(chart.rows(ask(sys.at, 'neighbourhood', 50000)).rows.find((r) => r.id === sys.id).how).toBe('visited');
  });
  it('remembers a station’s system when you arrive at the station', async () => {
    const { chart } = make();
    await chart.ready;
    const st = s0().stations[0];
    chart.heard({ type: 'place', what: 'arrive', id: st.id, name: st.name });
    expect(chart.debug.known().map((k) => [k.id, k.how]).sort()).toEqual([[st.id, 'visited'], [st.system, 'visited']].sort());
  });
  it('knows a name it showed you when it’s worth knowing, and not a passing rock', async () => {
    const { chart } = make();
    await chart.ready;
    const s = s0();
    // (lattice things by the chart they're drawn with: a rock's under KNOWN.least, a rogue planet's at it)
    const ranked = (keep) => {
      for (let i = 0; i < s.things.count; i++) {
        const r = thingRow(s, i);
        if (keep(chartOf({ place: 'thing', sub: r.kind })?.priority ?? 20)) return r;
      }
      return null;
    };
    const rock = ranked((p) => p < KNOWN.least);
    const notable = ranked((p) => p >= KNOWN.least);
    expect([Boolean(rock), Boolean(notable)]).toEqual([true, true]);
    chart.named([s.systems[3].id, rock.id, notable.id]);
    expect(chart.debug.known().map((k) => k.id).sort()).toEqual([s.systems[3].id, notable.id].sort());
    expect(chart.debug.know([s.systems[5].id, 'marvel'])).toBe(1); // (the checks' way to fill the table)
  });
  it('lists a view’s places through the scene’s own resolver, systems as stars', () => {
    const { chart } = make();
    const { rows } = chart.rows(ask(mid, 'neighbourhood', 200000));
    expect(rows.map((r) => r.id)).toEqual(chartPlaces(loaded, mid, 0, { level: 'neighbourhood', range: 200000 }).map((r) => r.id));
    for (const r of rows) expect(r.name, r.id).toBe(resolvePlace(r.id, { t: 0, sectors: loaded, build: false }).name);
    expect(rows.filter((r) => r.place === 'system').every((r) => r.chart.shape === 'star')).toBe(true);
    chart.debug.hold(true); // (a check's way to see the chart without them, in the same run)
    expect(chart.rows(ask(mid, 'neighbourhood', 150000))).toEqual({ rows: [], known: [], rim: [], left: 0 });
    chart.debug.hold(false);
    expect(chart.rows(ask(mid, 'neighbourhood', 150000)).rows.length).toBeGreaterThan(0);
  });
  it('answers the same view from what it had for a second, and after that resolves nothing again', () => {
    const places = fakePlaces();
    places.resolve = vi.fn(places.resolve);
    const { chart, later } = make({ places });
    const a = chart.rows(ask(mid, 'neighbourhood', 200000));
    expect(chart.rows(ask(mid, 'neighbourhood', 200000))).toBe(a);
    const resolved = places.resolve.mock.calls.length;
    later(CHARTED.every);
    const b = chart.rows(ask(mid, 'neighbourhood', 200000));
    expect(b).not.toBe(a);
    expect(b.rows.map((r) => r.id)).toEqual(a.rows.map((r) => r.id));
    expect(places.resolve.mock.calls.length).toBe(resolved);
  });
  it('finds known places in range a sector at a time by its own asks, and lets go of one that isn’t there', async () => {
    const store = fresh();
    const [a, b] = far.systems;
    const none = `E:5,-3:${far.systems.length}`;
    for (const [id, t] of [[a.id, 1], [b.id, 2], [none, 3]]) await store.set(KNOWN.table, id, { how: 'visited', t });
    const { chart, places, workers, later } = make({ store });
    await chart.ready;
    const there = ask(sectorCentre(5, 0, -3), 'universe', 300000);
    expect(chart.rows(there)).toMatchObject({ rows: [], left: 3 });
    expect(workers.request).toHaveBeenCalledTimes(1);
    expect(workers.request.mock.calls[0]).toEqual(['expanse', expect.objectContaining({ type: 'sector', key: 'chart|E:5,-3', priority: CHARTED.queue, sx: 5, sy: 0, sz: -3 })]);
    await workers.request.mock.results[0].value;
    await flush();
    later(CHARTED.every);
    const got = chart.rows(there);
    expect(got.rows.map((r) => [r.id, r.name]).sort()).toEqual([[a.id, a.name], [b.id, b.name]].sort());
    expect(got.known.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
    expect(got.left).toBe(0);
    expect(chart.debug.known().some((k) => k.id === none)).toBe(false);
    expect(workers.request).toHaveBeenCalledTimes(1);
    expect(places.fetch).not.toHaveBeenCalled();
  });
  it('never fetches a known place whose sector is out of the view’s range', async () => {
    const store = fresh();
    await store.set(KNOWN.table, far.systems[0].id, { how: 'named', t: 1 });
    const { chart, workers, later } = make({ store });
    await chart.ready;
    chart.rows(ask(mid, 'neighbourhood', 200000));
    expect(workers.request).not.toHaveBeenCalled();
    later(CHARTED.every);
    chart.rows(ask(mid, 'universe', 3e6));
    expect(workers.request).toHaveBeenCalledTimes(1);
  });
  // (spec F: search covers every visited and named place, not only those a view has reached)
  it('finds a known place outside the range by name once a searching ask settles, and draws it only in range', async () => {
    const store = fresh();
    const [a] = far.systems; // (E:5,-3, about 600,000 off: past the open view's reach)
    await store.set(KNOWN.table, a.id, { how: 'visited', t: 1 });
    const { chart, workers, later } = make({ store });
    await chart.ready;
    expect(chart.rows(ask(mid, 'neighbourhood', 150000)).left).toBe(1);
    expect(workers.request).not.toHaveBeenCalled();
    later(CHARTED.every);
    const q = ask(mid, 'neighbourhood', 150000, true);
    await settle(chart, q);
    expect(workers.request).toHaveBeenCalledTimes(1);
    later(CHARTED.every);
    const got = chart.rows(q);
    expect(got.known.map((r) => [r.id, r.name])).toEqual([[a.id, a.name]]);
    expect(got.left).toBe(0);
    expect(got.rows.some((r) => r.id === a.id)).toBe(false);
  });
  // (finding 3: a search's fetches come one after another, not once a second;
  // the clock never moves here, so no second answer is worked out)
  it('goes on by itself while the map asks: a search’s sectors one after another, and every place at hand', async () => {
    const store = fresh();
    const far2 = ['E:5,-3', 'E:6,-3'].map((k) => answers.get(k).sector.systems[0]);
    const hand = s0().systems.slice(0, CHARTED.max + 5); // (two chunks at hand)
    for (const [i, x] of [...far2, ...hand].entries()) await store.set(KNOWN.table, x.id, { how: 'named', t: i + 1 });
    const { chart, workers } = make({ store });
    await chart.ready;
    const q = ask(mid, 'neighbourhood', 150000, true);
    await settle(chart, q);
    expect(chart.debug.answers()).toBe(1);
    expect(workers.request.mock.calls.map(([, m]) => m.key)).toEqual(['chart|E:5,-3', 'chart|E:6,-3']);
    expect(chart.debug.pending()).toEqual([]);
    const { known, left } = chart.rows({ ...q, key: 'again' }); // (another key: a fresh answer, the clock still standing)
    expect(left).toBe(0);
    expect(known.map((r) => r.id).sort()).toEqual([...far2, ...hand].map((x) => x.id).sort());
  });
  it('stops going on once the map stops asking', async () => {
    const store = fresh();
    for (const [i, k] of ['E:5,-3', 'E:6,-3'].entries()) await store.set(KNOWN.table, answers.get(k).sector.systems[0].id, { how: 'named', t: i + 1 });
    const { chart, workers, later } = make({ store });
    await chart.ready;
    chart.rows(ask(mid, 'neighbourhood', 150000, true));
    later(3 * CHARTED.every + 0.1); // (the map closed while the first was in flight)
    for (let i = 0; i < 10; i++) await flush();
    expect(workers.request).toHaveBeenCalledTimes(1);
    expect(chart.debug.pending()).toEqual(['E:6,-3']);
  });
  it('asks only while the pool has nothing else to do, and last in its queue', async () => {
    const store = fresh();
    await store.set(KNOWN.table, far.systems[0].id, { how: 'named', t: 1 });
    let others = 1;
    const workers = fakePool({ busy: () => others });
    const { chart, later } = make({ store, workers });
    await chart.ready;
    const q = ask(mid, 'universe', 3e6);
    chart.rows(q);
    expect(workers.request).not.toHaveBeenCalled();
    expect(chart.debug.pending()).toEqual(['E:5,-3']);
    others = 0;
    later(CHARTED.every);
    chart.rows(q);
    expect(workers.request).toHaveBeenCalledTimes(1);
    expect(workers.request.mock.calls[0][1].priority).toBe(Infinity);
  });
  it('waits on one ask at a time, goes on to the next as one settles, and asks again for a failed sector only later', async () => {
    const store = fresh();
    await store.set(KNOWN.table, 'E:5,-3:0', { how: 'named', t: 1 });
    await store.set(KNOWN.table, 'E:-4,2:0', { how: 'named', t: 2 });
    const { chart, workers, later } = make({ store, workers: fakePool({ fails: true }) });
    await chart.ready;
    const q = ask(mid, 'universe', 3e6);
    chart.rows(q);
    chart.rows({ ...q, key: 'another' });
    expect(workers.request).toHaveBeenCalledTimes(1);
    await workers.request.mock.results[0].value;
    await flush();
    expect(workers.request).toHaveBeenCalledTimes(2); // (the next sector at once, with no new ask of the chart)
    await workers.request.mock.results[1].value;
    await flush();
    later(CHARTED.every);
    chart.rows(q);
    expect(workers.request).toHaveBeenCalledTimes(2);
    expect(chart.debug.known().map((k) => k.id).sort()).toEqual(['E:-4,2:0', 'E:5,-3:0']);
    later(CHARTED.retry);
    chart.rows(q);
    expect(workers.request).toHaveBeenCalledTimes(3);
  });
  it('asks nothing with no pool, and takes a pool that throws as an ask that failed', async () => {
    const store = fresh();
    await store.set(KNOWN.table, 'E:5,-3:0', { how: 'named', t: 1 });
    const bare = make({ store, workers: null });
    await bare.chart.ready;
    const got = bare.chart.rows(ask(mid, 'universe', 3e6));
    expect(got.rows.filter((r) => !r.big)).toEqual([]); // (a real gargantuan of the three at hand may show: lane 4a has one in every 3 × 3 × 3)
    expect([got.left, bare.chart.debug.asked()]).toEqual([1, null]);
    const workers = { request: vi.fn(() => Promise.reject(new Error('no worker defined for expanse'))), cancel: vi.fn() };
    const { chart, later } = make({ store, workers });
    await chart.ready;
    chart.rows(ask(mid, 'universe', 3e6));
    await flush();
    later(CHARTED.every);
    chart.rows(ask(mid, 'universe', 3e6));
    expect(workers.request).toHaveBeenCalledTimes(1);
    expect(chart.debug.pending()).toEqual([]);
  });
  it('never pushes a picked place’s sector out of lane 3’s fetched four', async () => {
    const store = fresh();
    const others = FAR.slice(1).map((s) => sectorKey(...s)); // (four far sectors of known places)
    let t = 0;
    for (const k of others) for (const s of answers.get(k).sector.systems.slice(0, 2)) await store.set(KNOWN.table, s.id, { how: 'visited', t: ++t });
    const { chart, places, workers } = make({ store });
    await chart.ready;
    const pick = far.systems[0].id; // (picked from a link or the search: the nav map's lookup fetched it through lane 3)
    expect((await places.fetch(pick))?.id).toBe(pick);
    await settle(chart, ask(sectorCentre(5, 0, -3), 'universe', 3e6));
    expect(workers.request).toHaveBeenCalledTimes(others.length);
    expect(places.fetch).toHaveBeenCalledTimes(1);
    expect(places.resolve(pick)?.id).toBe(pick);
    expect(chart.debug.known()).toHaveLength(others.length * 2);
  });
  it('caps its whole answer with a full table in range: gargantuans first, then the newest', async () => {
    const store = createStore({ indexedDB: undefined, name: 'tp-universe', tables: [KNOWN.table] }); // (memory: the cap is the point here, not IndexedDB)
    const systems = [...[...loaded.values()].flatMap((s) => s.systems), ...[...answers.values()].flatMap((a) => a.sector.systems)].slice(0, KNOWN.cap);
    expect(systems).toHaveLength(KNOWN.cap);
    for (const [i, s] of systems.entries()) await store.set(KNOWN.table, s.id, { how: 'visited', t: i });
    const { chart, later } = make({ store });
    await chart.ready;
    const q = ask(mid, 'universe', 3.75e6);
    await settle(chart, q);
    later(CHARTED.every);
    const { rows, known, left } = chart.rows(q);
    expect(known).toHaveLength(KNOWN.cap);
    expect(left).toBe(0);
    expect(rows).toHaveLength(CHARTED.max);
    const big = rows.filter((r) => r.big);
    expect(rows.slice(0, big.length)).toEqual(big);
    expect(rows.filter((r) => !r.big).map((r) => r.id).sort()).toEqual(systems.slice(-(CHARTED.max - big.length)).map((s) => s.id).sort());
  });
  it('shows the nearest gargantuans past the sectors at hand, at the universe level only, and never records them', async () => {
    const workers = fakePool({ make: true });
    const { chart, later } = make({ workers, giants: 2 });
    await chart.ready;
    chart.rows(ask(mid, 'neighbourhood', 200000));
    expect(workers.request).not.toHaveBeenCalled();
    later(CHARTED.every);
    const q = ask(mid, 'universe', 3e6);
    await settle(chart, q);
    later(CHARTED.every);
    const want = gargantuanSectors(UNIVERSE, [1, 0, 0], { n: 2 }).filter((s) => !loaded.has(sectorKey(...s))).map((s) => spaceId(s, { wonder: 3 }));
    const { rows, known } = chart.rows(q);
    for (const id of want) expect(rows.find((r) => r.id === id), id).toMatchObject({ big: true });
    expect(known).toEqual([]);
    expect(chart.debug.known()).toEqual([]);
  });
  // (done item 7, "out to everything you know": past the widest range, the nearest you know go to the rim)
  it('at the universe level, finds the nearest places you know past the range for the rim, and no further', async () => {
    const store = fresh();
    const firsts = FAR.map((s) => answers.get(sectorKey(...s)).sector.systems[0]);
    for (const [i, x] of firsts.entries()) await store.set(KNOWN.table, x.id, { how: 'visited', t: i + 1 });
    const { chart, workers, later } = make({ store, rim: 2 });
    await chart.ready;
    const q = ask(mid, 'universe', 200000); // (every one of them past it)
    await settle(chart, q);
    expect(workers.request.mock.calls.map(([, m]) => m.key)).toEqual(['chart|E:5,-2', 'chart|E:5,-3']); // (the two nearest sectors holding one)
    later(CHARTED.every);
    const { rim, known } = chart.rows(q);
    expect(known).toHaveLength(2);
    expect(rim.map((r) => r.id)).toEqual([...known].sort((a, b) => len(a.at, mid) - len(b.at, mid)).map((r) => r.id));
    for (const r of rim) expect(len(r.at, mid), r.id).toBeGreaterThan(200000);
    later(CHARTED.every);
    expect(chart.rows(ask(mid, 'neighbourhood', 200000)).rim).toEqual([]);
  });
  it('keeps no known places in a pocket universe', async () => {
    const store = fresh();
    await store.set(KNOWN.table, 'E:1,0:0', { how: 'visited', t: 1 });
    const { chart } = make({ store, shared: false });
    await chart.ready;
    chart.heard({ type: 'place', what: 'arrive', id: s0().systems[2].id });
    chart.named([s0().systems[1].id]);
    expect(chart.debug.known()).toEqual([]);
    expect((await store.list(KNOWN.table)).map(([k]) => k)).toEqual(['E:1,0:0']);
    expect(chart.rows(ask(mid, 'neighbourhood', 200000)).known).toEqual([]);
  });
});
```

  The `beforeAll` makes eight sectors (the three round the ship and `FAR`'s five), about a second here, once. The five far ones hold enough systems (about 270 a sector) for the cap test's 2,000. If they don't, the cap test's first `expect` says so, and a sixth goes in `FAR`. The gargantuans' test makes its two sectors itself. `settle` never moves the clock, so every test that settles proves the chart goes on by itself. A test reads the settled answer after moving the clock on by `CHARTED.every`, or with another key.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/charted src/components/universe/places/scenePlaces.test.js src/components/universe/places/weight.test.js`. Expected:
  - `sceneChart.test.js` FAILS (module not found)
  - the new `scenePlaces` test FAILS
  - `weight.test.js`'s new `NavMap.jsx` case PASSES: `NavMap.jsx` reaches no generator today
- [ ] **Step 3: Implement and wire.**
  - Write `sceneChart.js`, then the `named` dep in `scenePlaces.js`.
  - Wire `scene.js`, `UniverseMap.jsx` and `Universe.jsx` as listed. Count `scene.js`'s lines.
  - `sceneChart.js`'s header says what it never does: make a sector (it reads lane 2's and lane 3's, and asks the pool for the rest), call lane 3's `fetch`, resolve inside `rows`, or store a name or a position. It also says:
    - why only the known in range (and the rim's nearest) are fetched unless the visitor is searching, one sector at a time, nearest first, last and on an idle pool (lane 3's "For lane 6b in particular", spec F's search, Review Focus 2 and 3)
    - why it goes on by itself as each lands, and stops once the map stops asking (finding 3)
    - why its work goes in chunks of `CHARTED.max`, one to a `setTimeout(0)`, timed
    - why the answer is capped whole (Review Focus 3)
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe src/runtime`. Expected: PASS. Then run `node scripts/health.mjs --only boundary-breaks,cycles,big-files`. Expected: as before Task 1.
- [ ] **Step 5: Time the answer and the chunks against their bounds.** In a scratch script (not committed), make the 27 sectors round `E:1,0` once and a scene chart over them, with Step 1's `fakePlaces` resolving from all 27 and `fakePool` answering for any sector (`make: true`).
  - **A neighbourhood.** For each of 20 of `E:1,0`'s systems, ask the neighbourhood round it (range 250,000) once, then move the clock on by `CHARTED.every` and time the same ask again.
  - **The worst case: a full table at the universe level.** Fill the table with `KNOWN.cap` of the 27 sectors' systems (`debug.know`), all at hand. Ask the universe level round `E:1,0` (range 3,000,000) once, and let the chart go on by itself (flushing timers) till `debug.pending()` is empty: about 17 chunks, with no new ask. Then time 20 asks of the same view, the clock moved on by `CHARTED.every` before each, so each is worked out afresh. Every one of the 2,000 known rows is in range, so each answer filters and sorts them all.
  - **The chunks.** Read `debug.settleMs()` after the worst case's fill, for its chunks at hand. Then, on a fresh chart, know every system of `FAR`'s five sectors (about 1,350, so each sector's group runs to three chunks), ask a search round `E:1,0`, let it go on till `pending()` is empty, and read `settleMs()` again, for the fetched sectors' chunks.

  Expected: the two answers' medians at most 2 ms, and both `settleMs()` at most 4 ms (Global Constraints). Over a bound, find where with a profile (`node --cpu-prof`), fix it, and say so in the commit. For the worst case, keep the known's rows sorted once as the cache changes, not on every answer. For a chunk, resolve fewer ids a chunk (a number of its own beside `CHARTED`). Don't shorten the list to meet a bound. Write the four numbers into the README under "The chart's ask".
- [ ] **Step 6: Check it in the browser.**
  - Lane 3's `travel` step of `scripts/universe-endless-check.mjs` ends parked at a generated place. Give it one more check: once it has arrived, it reads `__universeDebug.charted.known()`, and fails unless the place it arrived at is among the known, as `'visited'`.
  - The step never opens the nav map, so the chart has worked out no answer to time here. Task 11's `map` step times it.
  - Run `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-endless-check.mjs --quality mid --only start,travel` (`--only` is lane 3's). Expected: exit 0, no console errors.
- [ ] **Step 7: Commit.** `git add src/components/universe/charted src/components/universe/places src/components/universe/scene.js src/components/universe/UniverseMap.jsx src/pages/Universe.jsx scripts/universe-endless-check.mjs docs/superpowers/evidence/endless-universe-lane-6b && git commit -m "The scene keeps the places you've been and seen named, finds the ones in view or searched for one sector after another, and answers the chart, capped"`. The body gives `scene.js`'s count and Step 5's four numbers.

---

### Task 9: The chart draws traffic, events and the way back, and keeps the core's names over the generated places

**Files:**
- Modify: lane 6a's `src/components/universe/chart/place.js` (`c41652d3`), `placeMarks` (`:112-145`):
  - its opts (`:113`) gain `pin` and `yields`
  - its level-and-range filter (`:119`) lets a pinned mark through
  - its one `declutter` (`:138-139`) becomes two when there's a `yields`
  - the header's opts and `Placed` lines (`:25-40`)
- Modify: lane 6a's `src/components/universe/chart/place.test.js` (a new `describe`; its imports gain `boxOf` from `./declutter`, and it gets a local `meet`, as `NavChart.test.jsx` has)
- Modify: `src/components/universe/chart/NavChart.jsx` (`c41652d3`):
  - `:53` (`LISTED` gains `'event'` and `'came'`)
  - `:199-204` (`placeMarks`' opts gain `pin` and `yields`)
  - `:234` (`item()`: an event's label, a point's way back)
  - after `:309` (traffic dots and event rings)
  - `:320-331` (the `li` gains `data-under`)
  - the header (`:9-40`)
- Modify: `src/components/universe/navmap.css` (append after `:437`)
- Modify: `src/components/universe/chart/NavChart.test.jsx` (a new `describe`)
- Modify: `docs/superpowers/evidence/endless-universe-lane-6b/README.md` (the render's time)

**Interfaces:**
- Consumes:
  - Task 4's live marks
  - Task 3's `generatedMarks` (with `generated: true` on each, and `pinned: true` when asked), `chartRow` and `mergeMarks` (in the test)
  - lane 6a's `declutter`, `boxOf`, `labelSize`, `PIN`, `openView` and `HAND_MARKS`; `spawn` (`ship.js`, in the test)
- Produces:
  - **`placeMarks(view, marks, frame, { …, pin = [], yields = null })`**, lane 6a's, with two options more:
    - **`pin`:** ids drawn whatever the level and the range, pinned to the rim past it as a kept mark is. Unlike a kept one, a pinned mark's name goes down at its own priority and isn't firm, so it never takes the pick's room.
    - **`yields(mark) → boolean`:** the marks that give way to the rest. A kept mark never yields.
      1. Every other mark's name goes down first, through a `declutter` given only the other marks' dots (and `hard`). So they come out side for side as they would with the yielding marks left out.
      2. Then the yielding marks' names go down, through a second `declutter` given every dot, with the first's names (`boxOf(side, label)`) added to `hard`, so none meets a name already down.
      - `ranked` and `spare` work within each stage as before.
    - **`Placed` gains `under: boolean`:** true for a yielding mark whose dot's 16 px box meets a name box or a dot box of the rest, else false. It is false for every mark when there's no `yields`.
    - With neither option, it is as before, and every existing `place.test.js` test passes unchanged.
    - Why not lane 6a's `ranked`: its second pass runs after every first-pass name is down, generated ones included, so a generated name could still take a hand-made name's room. And with each mark's priority as its rank, a hand-made name could lie over a lesser hand-made dot, which changes lane 6a's picture of the core (finding 18).
  - **`NavChart`'s placement** passes `pin: all.filter((m) => m.kind === 'came' || m.pinned === true).map((m) => m.id)` and `yields: (m) => m.generated === true`, beside lane 6a's `keep`. A wormhole throws you 3.6 to 9.6 million units, past `CHART.range.max` (3,000,000), so the way back is pinned at the rim, pointing home, and so are the nearest places you know past the range (Task 3's `pinned`, from Task 10's `useCharted`). A pinned generated mark still yields. The `li` gains `data-under={p.under || undefined}`.
  - **In the SVG and the places list:**
    - **`shape: 'traffic'`:** `<circle class="navmap-traffic" r="2.5">` at the mark, drawn after the pilots, with no `li`.
    - **`shape: 'event'`:** `<g class="navmap-event">`, a dashed `circle.navmap-event-ring` of r 10 and a dot of r 3, drawn after the fights. Its `li[data-kind="event"]` holds `<span class="navmap-place navmap-eventname">` with its name: a label, not a button.
    - **`kind: 'came'`:**
      - pickable: the portal glyph and a place button, as any pickable mark, under its E: id
      - not pickable: the glyph and a label as an event's, in the map's blue
  - **`navmap.css`:**
    - `.navmap-traffic { fill: #9fd8ff; fill-opacity: 0.55 }`
    - `.navmap-event { fill: none; stroke: #ffb347; stroke-width: 2 }`
    - `.navmap-event-ring { stroke-dasharray: 4 3; opacity: 0.8 }`
    - `.navmap-event > circle:last-child { fill: #ffb347 }`
    - `.navmap-places > li[data-kind='event'], .navmap-places > li[data-kind='came'] { pointer-events: none }`
    - `.navmap-places > li[data-kind='came'] button { pointer-events: auto }`
    - `li[data-kind='event'] .navmap-place { color: #ffb347 }`
    - `li[data-kind='came'] .navmap-place { color: #9fd8ff }`
    - `.navmap-places > li[data-under]:not([data-hover]) { visibility: hidden }`: a generated place under a hand-made name or dot isn't drawn over it, and its button is out of that click's way. A generated system's glyph is in the SVG, under every name, and stays. A hover from the side panel's list still shows it.
    - Each rule's comment says whose colour it borrows, or why it hides.

- [ ] **Step 1: Write the failing tests.** In `place.test.js`, with the file's `M`, `view` and `drawnAt`:

```js
describe('marks that give way to the rest', () => {
  const yields = (m) => m.generated === true;
  // three generated marks round a place, on its right, left and under sides
  const round = (x, y, i) => [[x + 40, y], [x - 40, y], [x, y + 30]].map(([u, v], k) => M(`g${i}${k}`, drawnAt(u, v), { name: `G${i}${k}`, priority: -10, generated: true }));
  // (names long enough that each side's box reaches the crowd's dot on that side)
  const rest = [M('a', drawnAt(600, 500), { name: 'Alderaan Station' }), M('b', drawnAt(400, 420), { name: 'Bespin Cloud City', priority: 40 })];
  const crowd = [...round(600, 500, 0), ...round(400, 420, 1)];
  it('names the rest side for side as if the yielding marks weren’t there', () => {
    const alone = placeMarks(view, rest, FRAMES.nav).map((p) => [p.id, p.side]);
    expect(alone.every(([, side]) => side !== null)).toBe(true);
    expect(placeMarks(view, [...rest, ...crowd], FRAMES.nav).find((p) => p.id === 'a').side).toBeNull(); // (without it, the crowd's dots take every side)
    const both = placeMarks(view, [...rest, ...crowd], FRAMES.nav, { yields });
    expect(both.filter((p) => !yields(p.mark)).map((p) => [p.id, p.side])).toEqual(alone);
  });
  it('puts the yielding names clear of the rest’s, and marks a yielding dot under one of theirs', () => {
    const both = placeMarks(view, [...rest, ...crowd], FRAMES.nav, { yields });
    expect(both.find((p) => p.id === 'g00').under).toBe(true);
    expect(both.filter((p) => !yields(p.mark)).every((p) => p.under === false)).toBe(true);
    const box = (p) => boxOf(p.side, { x: p.x, y: p.y, w: labelSize(p.mark.name, 11)[0], h: labelSize(p.mark.name, 11)[1] });
    const named = both.filter((p) => p.side);
    for (const g of named.filter((p) => yields(p.mark))) for (const r of named.filter((p) => !yields(p.mark))) expect(meet(box(g), box(r)), `${g.id} ${r.id}`).toBe(false);
  });
  it('never lets the pick give way, and is as it was without it', () => {
    const picked = placeMarks(view, [...rest, ...crowd], FRAMES.nav, { yields, keep: ['g00'] }).find((p) => p.id === 'g00');
    expect(picked.under).toBe(false);
    expect(picked.side).not.toBeNull();
    expect(placeMarks(view, marks, FRAMES.nav).every((p) => p.under === false)).toBe(true);
  });
  it('draws a pinned mark past the range at the rim, named at its own priority, never over the pick', () => {
    const way = M('way', [5e6, 0, 0], { priority: 75 });
    expect(placeMarks(view, [way], FRAMES.nav)).toEqual([]);
    const [far] = placeMarks(view, [way], FRAMES.nav, { pin: ['way'] });
    expect(far.edge).toBe(true);
    expect(Math.hypot(far.x - 500, far.y - 500)).toBeLessThanOrEqual(470);
    const both = placeMarks(view, [way, M('pick', [5e6, 0, 200], { priority: 10 })], FRAMES.nav, { pin: ['way'], keep: ['pick'] });
    expect(both.find((p) => p.id === 'pick').side).not.toBeNull();
  });
});
```

  In `NavChart.test.jsx`:

```jsx
describe('what moves, drawn, and the core over the generated places', () => {
  const ship = { x: 0, y: 0, z: 0 };
  const close = createView({ range: 5000 });
  it('draws traffic as dots close in, with no name and no button', () => {
    const marks = liveMarks({ ship, traffic: [{ id: 1, kind: 'freighter', x: 300, y: 0, z: 0 }] });
    expect(tags(renderToStaticMarkup(<NavChart view={close} marks={marks} />), 'navmap-traffic')).toHaveLength(1);
    expect(renderToStaticMarkup(<NavChart view={close} marks={marks} />)).not.toContain('data-id="traffic:1"');
    expect(tags(renderToStaticMarkup(<NavChart view={view} marks={marks} />), 'navmap-traffic')).toHaveLength(0);
  });
  it('names an event going on, but it is no place to pick', () => {
    const html = renderToStaticMarkup(<NavChart view={view} marks={liveMarks({ ship, events: [{ id: 'flare:1', kind: 'flare', name: 'Solar flare', x: 3000, y: 0, z: 0, big: true }] })} />);
    expect(li(html, 'event:flare:1')).toContain('data-kind="event"');
    expect(html).toMatch(/data-id="event:flare:1"[^>]*><span class="navmap-place navmap-eventname"><span class="navmap-name">Solar flare/);
    expect(tags(html, 'navmap-event')).toHaveLength(1);
  });
  it('makes the way back a button when it is a place, and only a mark when it isn’t', () => {
    const place = renderToStaticMarkup(<NavChart view={view} marks={liveMarks({ ship, cameFrom: { id: 'E:1,0:w12', at: [9000, 0, 0] } })} />);
    expect(place).toMatch(/data-id="E:1,0:w12"[^>]*><button type="button" class="navmap-place"/);
    const point = renderToStaticMarkup(<NavChart view={view} marks={liveMarks({ ship, cameFrom: { id: 'wormhole:3', at: [9000, 0, 0] } })} />);
    expect(point).toMatch(/data-id="came:wormhole:3"[^>]*><span class="navmap-place navmap-eventname"/);
  });
  // (a wormhole throws you 30 to 80 sectors: past the chart's widest range)
  it('pins the way back to the rim after a throw, and the pick keeps its name beside it', () => {
    for (const range of [CHART.range.open, CHART.range.max]) {
      const html = renderToStaticMarkup(<NavChart view={createView({ range })} marks={[...HAND_MARKS, ...liveMarks({ ship, cameFrom: { id: 'E:40,-3:w12', at: [5e6, 0, -3.6e5] } })]} pick="marvel" />);
      const [x, y] = at(html, 'E:40,-3:w12');
      expect(Math.hypot(x - 50, y - 50), String(range)).toBeCloseTo(47 * PIN, 0);
      expect(li(html, 'marvel')).toContain('data-pick');
      expect(li(html, 'marvel')).not.toContain('data-quiet');
    }
  });
  // (done item 7: past the widest range, the nearest places you know are pinned to the rim, as the way back is)
  it('pins a place you know past the widest range to the rim, and the pick keeps its name', () => {
    const known = chartRow({ id: 'E:40,-3:0', place: 'system', kind: 'star', name: 'Okonkwo', type: 'Yellow star system', at: [4.8e6, 0, -3.6e5], color: '#ffd27a', reach: 80, cube: [40, 0, -3] }, { how: 'visited' });
    const wide = createView({ range: CHART.range.max });
    expect(renderToStaticMarkup(<NavChart view={wide} marks={generatedMarks([known])} />)).not.toContain('data-id="E:40,-3:0"');
    const html = renderToStaticMarkup(<NavChart view={wide} marks={[...HAND_MARKS, ...generatedMarks([known], { pinned: true })]} pick="marvel" />);
    const [x, y] = at(html, 'E:40,-3:0');
    expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(47 * PIN, 0);
    expect(li(html, 'marvel')).toContain('data-pick');
  });
  it('draws a generated system as the hand-made stars are: a glyph and a place to pick', () => {
    const marks = generatedMarks([chartRow({ id: 'E:1,0:3', place: 'system', kind: 'star', name: 'Okonkwo', type: 'Yellow star system', at: [20000, 0, 0], color: '#ffd27a', reach: 80, cube: [1, 0, 0] })]);
    const html = renderToStaticMarkup(<NavChart view={view} marks={marks} />);
    expect(li(html, 'E:1,0:3')).toContain('data-kind="star"');
    expect(html).toContain('aria-label="Okonkwo, Yellow star system"');
    expect(tags(html, 'navmap-system')).toHaveLength(1);
  });
  // (spec F's failure "the hand-made core buried under generated clutter")
  it('keeps every name the core shows at the home spawn’s open view, on its side, with 120 generated places crowding it', () => {
    const home = spawn(null);
    const open = openView(home);
    const sys = (i, at) => chartRow({ id: `E:0,0:${i}`, place: 'system', kind: 'star', name: `Star ${i}`, type: 'Yellow star system', at, color: '#ffd27a', reach: 80, cube: [0, 0, 0] });
    const handy = HAND_MARKS.filter((m) => m.pickable);
    const beside = handy.flatMap((m, i) => [[600, 0], [-600, 0], [0, 600]].map(([dx, dz], k) => sys(i * 3 + k, [m.at[0] + dx, m.at[1], m.at[2] + dz])));
    const ring = Array.from({ length: 120 }, (_, i) => sys(500 + i, [home.x + 30000 * Math.cos(i), home.y, home.z + 30000 * Math.sin(i)]));
    const rows = [...beside, ...ring].slice(0, 120);
    const paint = (marks) => renderToStaticMarkup(<NavChart view={open} marks={marks} ship={home} />);
    const alone = paint(HAND_MARKS);
    const crowded = paint(mergeMarks(HAND_MARKS, generatedMarks(rows)));
    const side = (html, id) => li(html, id).match(/data-side="(\w+)"/)?.[1];
    const named = handy.filter((m) => li(alone, m.id) && !li(alone, m.id).includes('data-quiet'));
    expect(named.length).toBeGreaterThan(10);
    for (const m of named) {
      expect(li(crowded, m.id), m.id).not.toContain('data-quiet');
      expect(side(crowded, m.id), m.id).toBe(side(alone, m.id));
    }
    expect(crowded).toContain('data-under');
    expect(tags(crowded, 'navmap-system').length).toBeGreaterThan(10);
  });
});
```

  The test file's imports gain `liveMarks` and `openView` (`./marks`), `chartRow`, `generatedMarks` and `mergeMarks` (`./generated`), `PIN` (`./projection`) and `spawn` (`../ship`).
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/place.test.js src/components/universe/chart/NavChart.test.jsx`. Expected: the new tests FAIL. "Draws a generated system" may pass already: lane 6a's chart draws any `star` shape.
- [ ] **Step 3: Implement** the two options, the drawing and the rules. `place.js`'s header says what each option is for: `pin` for the way back, `yields` for the generated places under the hand-made core.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe src/styles/tokens.test.js src/lib/words.test.js`. Expected: PASS, with every existing test of lane 6a's `place.test.js`, `declutter.test.js`, `NavChart.test.jsx` and `MiniMap.test.jsx` unchanged.
- [ ] **Step 5: Time the nav map's own render against its bound** (Global Constraints; done item 10). It runs on every `where()` tick, four a second, and on every drag and pinch move.
  - In a scratch test file, not committed (`src/components/universe/chart/navchart.time.test.jsx`, run once with `npx vitest run` on it, then deleted), build the crowded test's marks at the home spawn's open view: `HAND_MARKS`, its 120 generated rows, and about 20 live marks from `liveMarks` (8 pilots, 4 far fights, 6 events, a traffic group and the way back), some 170 in all.
  - Warm up 5 times, then time 50 calls each of `placeMarks(open, marks, FRAMES.nav, { yields, pin })` and `renderToStaticMarkup(<NavChart view={open} marks={marks} ship={home} />)`.
  - Expected: medians at most 2 ms and 4 ms. A phone is about four times slower, so the render stays within a 60 Hz frame there.
  - Over a bound: find where with a profile, and fix it. For a `where()` tick that moved nothing on the chart, `NavChart` can keep its placement (a `useMemo` on the view, the marks, the pick and the ship's point). For the second stage, the first stage's name boxes can go in a grid, not a list. Don't drop marks to meet it. Write both medians into the README.
- [ ] **Step 6: Commit.** `git commit -m "The nav map's chart draws the traffic, the events going on and the way back, and the core's names stay over the generated places"`. The body says why `place.js` gains `yields` rather than the chart taking lane 6a's `ranked` (finding 18), and gives Step 5's two medians.

---

### Task 10: The nav map lists, searches, picks and times the generated places

**Files:**
- Create: `src/components/universe/chart/navList.js`, `src/components/universe/chart/navList.test.js`. These are the list's rules, out of `NavMap.jsx` so a Node test pins them.
- Create: `src/components/universe/chart/useCharted.js`, `src/components/universe/chart/useCharted.test.js`. The hook is run by hand under a mocked React, as lane 6a's `useChartView.test.js` runs its own.
- Modify: `src/components/universe/NavMap.jsx` (`c41652d3`), wiring only, each by its quoted line:
  - `:4`, `:10`, `:13` (imports)
  - `:52` (props)
  - `:56-77` (the chart's answer, the lookups, the first pick, `picked`, marks, list, dim)
  - `:120-131` (times)
  - `:133-144` (here)
  - `:157-171` (goable, go, going, course)
  - `:181-183` (the verb without a ship)
  - `:216-218` (groups)
  - `:235`, `:314` (show)
  - `:247`, `:351`, `:394`, `:399` (a generated place's distance, name and about)
  - after `:351` (`.navmap-where`): whose space it is
  - `:428` (the search's "Nothing by that name"): still looking through the places you know
- Modify: `src/components/universe/words.js` (`CHART_WORDS.holder`, `CHART_WORDS.looking`)
- Modify: `src/pages/Universe.jsx:604-618` (`<NavMap>` gains `chart` and `place`)
- Modify: `scripts/navmap-check.mjs` (the `endless` mode's checks)
- Modify: `docs/superpowers/evidence/endless-universe-lane-6b/README.md`, and add `after/*.jpg`

**Interfaces:**
- Consumes:
  - Tasks 3, 4, 8 and 9
  - lane 3's `nav.js`:
    - `destinationById(id, { place })`
    - `distanceTo(ship, id, { place })`
    - `tripTime(ship, id, drive, { place })`
    - `findDestinations(kind, query, { more, place })`
    - `legOf`
    - `DESTINATIONS`, `DRIVES` and `KINDS` (`KINDS`' `system` is "Star systems")
  - lane 3's `isPlaceId` and `canonicalPlace` (`places/ids.js`)
  - lane 3's `PLACE` (`plotting`, `facts.held`, `held`)
  - lane 6a's `useChartView`'s `show`, and `markById` (`chart/marks.js`)
- Produces:
  - **`` CHART_WORDS.holder = (name) => `${PLACE.facts.held} ${PLACE.held(name)}` ``**: "Held by the Galactic Empire".
  - **`CHART_WORDS.looking = 'Still looking through the places you know…'`**, the search's line while the scene is still fetching known places it hasn't found (`left > 0`).
  - **`chart/navList.js`**, pure, importing only `../nav`, `../places/ids`, `../words`, `./marks` and `./generated`:
    - **`firstPick(selected, { look = {}, now = null } = {}) → string | null`:** `selected` when `destinationById(selected, look)` finds it or `isPlaceId(selected)`, and its canonical id isn't `now?.at` or `now?.place`. Else null.
    - **`pickedOf(id, { look = {}, rowOf = () => null } = {}) → Destination | ChartRow | null`:**
      - `destinationById(id, look)` when the scene has the place
      - else `rowOf(id)` with `about: PLACE.plotting` and `pending: true`: a light row's card, its name and type and "Plotting a course…"
      - else null. The side panel keeps its list until lane 3's `find` lands, never a blank card.
    - **`timesFor(ship, id, place) → { [drive]: number | null }`:** for each of `DRIVES`, `tripTime(ship, id, drive.id, { place })`, which is null for a place the lookup doesn't find (shown "—"). It is `{}` with no ship.
    - **`listOf(kind, query, { more = [], place } = {}) → { found, list, shown }`:** `found` is `findDestinations(kind, query, { more, place })`, `list` is `capGenerated(found, CHARTED.list)`, and `shown` is the `Set` of `found`'s ids.
    - **`groupsOf(list) → [{ id, name, places }]`:** `KINDS` but `all`, each with `list.filter((d) => groupOf(d) === g.id)`, and the empty ones left out. Generated systems go under "Star systems".
    - **`moreOf(rows, known, ship) → ChartRow[]`:** `rows` nearest the ship first (as given with no ship), then the `known` not among them, in their order.
    - **`cameraGoes(d) → boolean`:** true for a hand-made place the camera takes you to without a ship, a `kind` other than `wonder` and not `generated`. False for null.
    - **`holderLine(holder) → string | null`:** `CHART_WORDS.holder(holder.name)` when `holder?.name` is a string, else null.
    - **`markFor(id, { merged = [], rowOf = () => null } = {}) → Mark | null`:** the mark a list or search pick reveals on the chart:
      - `markById(id)`, a hand-made one
      - else the mark in `merged` (the chart's marks) whose id is `canonicalPlace(id)`
      - else, for a known place not in the scene's answer (the known half of `moreOf`), `generatedMarks([rowOf(id)])[0]` when `rowOf(id)` has its light row
      - else null
  - **`useCharted({ chart, view, ship, search = false, clock = () => performance.now() / 1000 }) → { rows, known, rim, left, marks, more, rowOf }`:**
    - It keeps the scene's last answer, or `{ rows: [], known: [], rim: [], left: 0 }` with no `chart`.
    - It asks with `nextAsk(last, viewRef.current, clock(), { search })`:
      - in an effect on `[chart, chartQuery(view, { search })?.key]`, so a search begun or cleared asks at once
      - and on a 250 ms interval while mounted (`setInterval`, never `requestAnimationFrame`). The interval reads the view and `search` through refs set on every render, so it never asks for a view it had before.
    - `last` is a ref of `{ key, at }`.
    - **An answer that isn't one is let go:** `chart(q)` may give null (the handle's `view.current?.chart?.(q) ?? null`, while the scene is torn down or lost), or something without `rows` and `known` arrays. The last answer is kept, and nothing throws. A `rim` that isn't an array reads as `[]`.
    - A new answer is kept only when its `rows`, `known` or `rim` array is another one, or its `left` differs.
    - `marks` is `mergeMarks(generatedMarks(rows), generatedMarks(rim, { pinned: true }))`: the places in view, then the nearest places you know past the range, pinned to the rim (Task 9). `more` is `moreOf(rows, known, ship)` (the ship as the answer came). Both are memoised on the answer.
    - `rowOf(id)` is the light row of `canonicalPlace(id)` from `rows` or `known`, or null.
  - **`NavMap({ …, chart = null, place = null })`**, wiring over those:
    - **The lookups:**
      - `look = useMemo(() => (place ? { place } : {}), [place])`, the scene's lookup, for anything that parks or times
      - `near = { place: rowOf }`, the light rows, for a distance
      - `dest(id) = destinationById(id, look) ?? rowOf(id)`
    - **The first pick** (`:60`) is `firstPick(selected, { look, now })`.
    - **`picked`** is `pickedOf(pick, { look, rowOf })`.
    - **The list and the search:** `listOf(kind, query, { more, place })`. The groups (`:216-218`) are `groupsOf(list)`. `useCharted` gets `search: query.trim() !== ''`.
    - **Still looking:** while searching and `left > 0`, a `p.navmap-meta.navmap-looking` reads `CHART_WORDS.looking`, above the list's places or in place of `:428`'s "Nothing by that name". That line shows only once `left` is 0, so a known place still being fetched is never called nothing.
    - **The marks:**
      - `mergeMarks(HAND_MARKS, liveMarks(now), marks, pickMark)`. The live marks come before the generated ones, so a wormhole that is both the way back and a place in view is drawn as the way back.
      - `pickMark` is `generatedMarks([chartRow(picked)])[0]` for a generated `picked` not among them, so the pick is kept on the chart (lane 6a's `keep`)
      - `dim` covers every pickable mark not in `shown`
    - **A list or search pick** calls `show(markFor(d.via ?? d.id, { merged, rowOf }))`, in place of `show(markById(…))` (`:235`, `:314`), where `merged` is the marks above. So a known place far off, picked from the list, is revealed on the chart, not left where it was.
    - **Times:** `timesFor(shipRef.current, pick, lookRef.current.place)`. `lookRef` is a ref, so the two-second refresh keeps its deps.
    - **Where you are:**
      - `here` runs over `[...DESTINATIONS, ...rows]` with `distanceTo(s, d.id, near)`
      - `atId = now?.at ?? now?.place ?? (here && here.gap < 40 ? here.d.id : null)`
      - the status line's name is `dest(atId)?.name`
    - **Without a ship,** `goable(d)`'s clause is `!flying && cameraGoes(d)`, and `verb(d)` says `PICK_A_SHIP` when `!cameraGoes(d)`. So the camera goes only to a hand-made station or world, and a generated place asks for a ship.
    - **`goingTo`, `course` and the stats' distance** go through `dest`, `look` and `near`.
    - **Whose space it is** (lane 4b's `now.holder`) is a `p.navmap-meta.navmap-holder` reading `holderLine(now.holder)`, under `.navmap-where` in the status, when flying and there is one. It isn't in the chart's readout. Lane 6a found that line already runs to three or four lines on a phone, with the side panel giving way, and a desktop's readout is held to two.
  - **`<NavMap>` in `Universe.jsx`** gets these, so with no scene there is neither:
    - `chart={map.current.live ? map.current.chart : null}`
    - `place={map.current.live ? map.current.place : null}`

- [ ] **Step 1: Write the failing unit tests.** `navList.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { DESTINATIONS, DRIVES } from '../nav';
import { CHART_WORDS, PLACE } from '../words';
import { CHARTED, chartRow, generatedMarks } from './generated';
import { cameraGoes, firstPick, groupsOf, holderLine, listOf, markFor, moreOf, pickedOf, timesFor } from './navList';

const row = (i, more = {}) => chartRow({ id: `E:1,0:${i}`, place: 'system', kind: 'star', name: `Star ${i}`, type: 'Yellow star system', at: [i * 1000, 0, 0], color: '#ffd27a', reach: 80, cube: [1, 0, 0], ...more });
const ship = { x: 0, y: 0, z: 0, heading: 0, speed: 0 };

describe('the nav map’s list', () => {
  it('picks first what the page picked, a hand-made place or any place id, unless the ship is there', () => {
    expect([firstPick('marvel'), firstPick('E:9,0:4'), firstPick('nowhere'), firstPick(null)]).toEqual(['marvel', 'E:9,0:4', null, null]);
    expect(firstPick('marvel', { now: { at: 'marvel' } })).toBeNull();
    expect(firstPick('e:9,0:4', { now: { place: 'E:9,0:4' } })).toBeNull();
  });
  it('shows a known place far off by its light row, plotting a course, till the scene has it', () => {
    const r = row(3);
    expect(pickedOf(r.id, { rowOf: (id) => (id === r.id ? r : null) })).toMatchObject({ id: r.id, name: 'Star 3', type: 'Yellow star system', about: PLACE.plotting, pending: true });
    const found = { ...r, about: 'A yellow star…' };
    expect(pickedOf(r.id, { look: { place: (id) => (id === r.id ? found : null) }, rowOf: () => r })).toBe(found);
    expect(pickedOf('marvel').name).toBe(DESTINATIONS.find((d) => d.id === 'marvel').name);
    expect(pickedOf('E:9,0:4')).toBeNull();
  });
  it('times a place the scene hasn’t found as nothing yet, by every drive, and throws nothing', () => {
    const t = timesFor(ship, 'E:9,0:4', () => null);
    expect(Object.keys(t).sort()).toEqual(DRIVES.map((d) => d.id).sort());
    expect(Object.values(t).every((v) => v === null)).toBe(true);
    expect(timesFor(null, 'marvel', () => null)).toEqual({});
  });
  it('lists every hand-made place and the first of the generated, generated systems under Star systems', () => {
    const more = Array.from({ length: 80 }, (_, i) => row(i));
    const { found, list, shown } = listOf('all', '', { more });
    expect(found.filter((d) => d.generated)).toHaveLength(80);
    expect(list.filter((d) => d.generated).map((d) => d.id)).toEqual(more.slice(0, CHARTED.list).map((d) => d.id));
    expect(list.filter((d) => !d.generated)).toHaveLength(found.filter((d) => !d.generated).length);
    expect(shown.size).toBe(found.length);
    const groups = groupsOf(list);
    expect(groups.every((g) => g.places.length > 0)).toBe(true);
    const systems = groups.find((g) => g.id === 'system');
    expect(systems.name).toBe('Star systems');
    expect(systems.places.filter((d) => d.generated)).toHaveLength(CHARTED.list);
    expect(listOf('all', 'Star 7', { more }).found.map((d) => d.id)).toContain('E:1,0:7');
  });
  it('puts the known after the places in view, those nearest the ship first', () => {
    const rows = [row(5), row(1), row(3)];
    const known = [row(1), row(9), row(2)];
    expect(moreOf(rows, known, ship).map((d) => d.id)).toEqual(['E:1,0:1', 'E:1,0:3', 'E:1,0:5', 'E:1,0:9', 'E:1,0:2']);
    expect(moreOf(rows, known, null).map((d) => d.id)).toEqual(['E:1,0:5', 'E:1,0:1', 'E:1,0:3', 'E:1,0:9', 'E:1,0:2']);
  });
  it('sends the camera only to a hand-made station or world: a generated place asks for a ship', () => {
    expect(cameraGoes(DESTINATIONS.find((d) => d.kind === 'station'))).toBe(true);
    expect(cameraGoes(DESTINATIONS.find((d) => d.kind === 'wonder'))).toBe(false);
    for (const d of [row(1), row(1, { place: 'station', kind: 'station' }), null]) expect(cameraGoes(d)).toBe(false);
  });
  it('finds the mark a pick reveals: hand-made, on the chart, or a known place’s light row', () => {
    const r = row(4);
    expect(markFor('marvel')?.id).toBe('marvel');
    expect(markFor('e:1,0:4', { merged: generatedMarks([r]) })?.id).toBe('E:1,0:4');
    expect(markFor(r.id, { rowOf: (id) => (id === r.id ? r : null) })).toMatchObject({ id: r.id, pickable: true, generated: true });
    expect(markFor('E:9,0:4', { rowOf: () => null })).toBeNull();
  });
  it('says whose space the ship is in, or nothing', () => {
    expect(holderLine({ id: 'empire', name: 'The Galactic Empire', side: 'starwars' })).toBe(`${PLACE.facts.held} the Galactic Empire`);
    expect(holderLine({ id: 'empire', name: 'The Galactic Empire' })).toBe(CHART_WORDS.holder('The Galactic Empire'));
    for (const none of [null, undefined, {}, { name: 7 }]) expect(holderLine(none)).toBeNull();
  });
});
```

  `useCharted.test.js` copies the mocked React and the `run(opts)` loop of lane 6a's `useChartView.test.js` (`:10-46` and its `run`, at `c41652d3`). It adds `useMemo` as `useCallback`'s twin that keeps `fn()`'s value. It needs no box. Its `beforeEach` sets `H.hooks = []`, `now = 0` and `vi.useFakeTimers()`. Its `afterEach` runs each hook slot's `undo` and `vi.useRealTimers()`. Then:

```js
let now = 0;
const clock = () => now;
const view = (x, range = 100000) => ({ focus: [x, 0, 0], range, yaw: 0, pitch: 0, follow: true });
const ship = { x: 0, y: 0, z: 0 };
const r1 = chartRow({ id: 'E:1,0:3', place: 'system', kind: 'star', name: 'Okonkwo', type: 'Yellow star system', at: [100, 0, 0], color: '#fff', reach: 80, cube: [1, 0, 0] });
const nothing = () => ({ rows: [], known: [] });

describe('the nav map’s asks of the scene', () => {
  it('asks for the view it has now, from the interval too, never one it had before', () => {
    const chart = vi.fn(nothing);
    run({ chart, view: view(0), ship, clock });
    run({ chart, view: view(90000), ship, clock }); // (a real move: another key)
    expect(chart.mock.calls.map(([q]) => q.key)).toEqual([chartQuery(view(0)).key, chartQuery(view(90000)).key]);
    now = CHARTED.every;
    vi.advanceTimersByTime(250);
    expect(chart).toHaveBeenCalledTimes(3);
    expect(chart.mock.calls[2][0].key).toBe(chartQuery(view(90000)).key);
  });
  it('asks for the same view no more than once a second', () => {
    const chart = vi.fn(nothing);
    run({ chart, view: view(0), ship, clock });
    now = 0.5;
    vi.advanceTimersByTime(500);
    expect(chart).toHaveBeenCalledTimes(1);
    now = CHARTED.every;
    vi.advanceTimersByTime(250);
    expect(chart).toHaveBeenCalledTimes(2);
  });
  it('keeps an answer only when the scene hands back another array', () => {
    const rows = [r1];
    const known = [];
    const a = run({ chart: () => ({ rows, known }), view: view(0), ship, clock });
    expect(a.rows).toBe(rows);
    now = CHARTED.every;
    vi.advanceTimersByTime(250); // (a new answer round the same two arrays)
    expect(H.dirty).toBe(false);
    const b = run({ chart: () => ({ rows, known }), view: view(0), ship, clock });
    expect(b.rows).toBe(rows);
    expect(b.marks).toBe(a.marks);
  });
  it('finds a light row by any spelling of its id, among the view’s and the known', () => {
    const k = chartRow({ ...r1, id: 'E:2,0:1', name: 'Vega' });
    const out = run({ chart: () => ({ rows: [r1], known: [k] }), view: view(0), ship, clock });
    expect([out.rowOf('e:1,0,0:3'), out.rowOf('E:2,0:1'), out.rowOf('marvel')]).toEqual([r1, k, null]);
    expect(out.more.map((d) => d.id)).toEqual(['E:1,0:3', 'E:2,0:1']);
    expect(out.marks.map((m) => m.id)).toEqual(['E:1,0:3']);
  });
  it('with no scene, asks nothing and has nothing', () => {
    const out = run({ chart: null, view: view(0), ship, clock });
    vi.advanceTimersByTime(1000);
    expect([out.rows, out.known, out.rim, out.marks, out.more, out.left]).toEqual([[], [], [], [], [], 0]);
  });
  it('lets go of an answer that isn’t one, the scene torn down or lost, and keeps the last', () => {
    let answer = { rows: [r1], known: [], left: 0 };
    const chart = vi.fn(() => answer);
    run({ chart, view: view(0), ship, clock });
    for (const bad of [null, undefined, { rows: 'x', known: [] }, { rows: [] }]) {
      answer = bad;
      now += CHARTED.every;
      vi.advanceTimersByTime(250);
      const out = run({ chart, view: view(0), ship, clock });
      expect(out.rows, String(bad)).toEqual([r1]);
    }
  });
  it('pins the nearest places you know past the range, and reads a rim that isn’t one as none', () => {
    const k = chartRow({ ...r1, id: 'E:40,-3:0', name: 'Vega', at: [4.8e6, 0, 0] }, { how: 'visited' });
    let answer = { rows: [r1], known: [k], rim: [k], left: 0 };
    const chart = vi.fn(() => answer);
    const out = run({ chart, view: view(0, 3e6), ship, clock });
    expect(out.marks.map((m) => [m.id, m.pinned === true])).toEqual([['E:1,0:3', false], ['E:40,-3:0', true]]);
    expect(out.rim).toEqual([k]);
    answer = { rows: [r1], known: [k], rim: 'x', left: 0 }; // (an older scene's answer, or a broken one)
    now += CHARTED.every;
    vi.advanceTimersByTime(250);
    const after = run({ chart, view: view(0, 3e6), ship, clock });
    expect([after.rim, after.marks.map((m) => m.id)]).toEqual([[], ['E:1,0:3']]);
  });
  it('asks with the search when the box holds a query, at once, and keeps how many it’s still looking for', () => {
    const chart = vi.fn(() => ({ rows: [], known: [], left: 3 }));
    run({ chart, view: view(0), ship, clock });
    const out = run({ chart, view: view(0), ship, search: true, clock });
    expect(chart.mock.calls.map(([q]) => q.search)).toEqual([false, true]);
    expect(chart.mock.calls[1][0].key).toBe(chartQuery(view(0), { search: true }).key);
    expect(out.left).toBe(3);
  });
});
```

  Its imports are `vitest`'s, `chartQuery`, `chartRow` and `CHARTED` (`./generated`), and `useCharted as charted` (`./useCharted`), named as lane 6a's file names its hook.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/navList.test.js src/components/universe/chart/useCharted.test.js`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** `navList.js`, `useCharted.js`, `CHART_WORDS.holder` and `CHART_WORDS.looking`. Run the same command. Expected: PASS, 16 tests.
- [ ] **Step 4: Write the failing browser checks,** in the `endless` mode, after Task 1's shots. Each is a `check(…)` waiting on a condition, with the file's `namesClash` and `pickByName`. Let `sys` be `toSystem(page, 'E:1,0:0')`'s answer. (`navmap-check` runs at `low`, Global Constraints.)
  0. **The core keeps its names** (Review Focus 1). Before any teleport, with the falcon where it starts. Each snapshot records two things:
     - **the names:** each hand-made `li` that is named (a `data-id` not starting `E:`, a `button` inside it and no `data-quiet`), with its `data-side`
     - **the live set:** the `data-id`s of the `li` whose `data-kind` is `fight`, `front`, `event` or `came`, and how many `rect.navmap-pilot` there are. These are lane 6a's and this lane's live marks. They aren't generated, so they go down in the first stage with the hand-made names, and one that comes or goes between the snapshots can move a hand-made name's side.

     Then:
     - **Without the generated places.** `__universeDebug.charted.hold(true)`, open the map with `m` at its open view, and wait until no `li[data-id^="E:"]` is on the chart. Take snapshot A. It names more than 10.
     - **With them.** `hold(false)`, then wait (60 s at most) until at least 10 `li[data-id^="E:"]` are on the chart. Take snapshot B.
     - **Compared only while nothing else moved.** When A's and B's live sets are the same, each of A's names is in B, not `data-quiet`, with the same `data-side`. When they differ (a director event, a far fight or a pilot came or went), take both again: `hold(true)`, wait until no `li[data-id^="E:"]` is left, A, then `hold(false)`, wait as before, B. Three tries at most. Three with no matching pair fail the check, as "the chart never held still".
     - No two visible names meet.
     - Shoot `19-endless-home` as the after. Close the map.
  1. **Generated places on the chart.**
     - With the map open at the system level, at least one `.navmap-places li[data-id^="E:1,0:0:"]` (a planet) appears within 60 s.
     - At the neighbourhood level, `li[data-id="E:1,0:0"]` is there, and `li[data-kind="star"]` number more than 10 and no more than `CHARTED.max` (120). No two visible names meet.
  2. **Traffic and events.**
     - At the system level, after `__universeDebug.traffic.soon()`, a `.navmap-traffic` appears.
     - At the neighbourhood level, after `__universeDebug.happen('flare')`, an `li[data-kind="event"]` appears.
  3. **Search.**
     - Type `sys.name` into `.navmap-search input`: a `.navmap-list button` holding `sys.name` shows, under the "Star systems" heading.
     - Press Enter: `.navmap-place-name` reads `sys.name`, and `li[data-id="E:1,0:0"]` has `data-pick`.
     - The super speed drive's `.navmap-drive-time` reads as `formatTime` writes a time, matching `/^(\d+\.\d s|\d+ s|\d+ min( \d+ s)?)$/`, and has no `×` and no `—`.
     - Shoot `23-endless-search`.
  4. **Travel to a generated place.**
     - Clear the search and choose the jump (`.navmap-drive[data-drive="hyper"]`).
     - At the neighbourhood level, take the first `li[data-kind="star"]` whose id isn't `E:1,0:0`, and click its button twice.
     - Wait until `__universe().place` is its id, giving up at 30 s of the scene's clock or 120 s of the wall's, whichever comes first (Global Constraints: the jump keeps the wall's clock, 3.65 s).
     - Keep its id and name as `went`.
  5. **It's known now.**
     - Open the map again and press `-` until `data-level="universe"`: `went`'s `li` is there.
     - Type `went.name` into the search: its button shows.
     - Shoot `22-endless-universe` again as the after.
  5b. **Found by name from four sectors off** (Review Focus 2). `went` is within one sector of `E:1,0`.
     - `page.reload()`, then wait on the two conditions `open` waits on (`navmap-check.mjs:58-59` at `c41652d3`): `__universe().ship`, then `.universe-navmap-btn`. Not `open`'s `waitForTimeout(2000)` (`:60`): every wait here is on a condition. The context's init script sets the falcon again, at home. The table is this context's IndexedDB (`tp-universe`), so it lasts, but the scene's light rows don't.
     - `toSystem(page, 'E:6,0:0')`: four sectors or more from `went`'s, past the open view's reach (about 254,000) and out of the 3 × 3 × 3 round home. Task 1's `toSystem` teleports to `E:6,0`'s middle first and waits for lane 2 to load it, since lane 3's `places.resolve` never fetches.
     - Open the map at its open view, and type `went.name` into the search. Wait (60 s at most) until a `.navmap-list button` holding `went.name` shows. While it doesn't, the list's `.navmap-looking` reads `CHART_WORDS.looking`, and "Nothing by that name" is never shown.
     - Press Enter: `.navmap-place-name` reads `went.name`, `li[data-id="<went.id>"]` has `data-pick` (revealed on the chart), and the super speed drive's `.navmap-drive-time` reads as a time, as in check 3.
  6. **The phone, with whose space it is.** For each of 390 × 844 and 360 × 640, with `hasTouch`:
     - `toSystem(page, 'E:1,0:0', { inside: true })`, and open the map.
     - Wait (60 s at most) until `.navmap-holder` reads `/^Held by /`.
     - On its chart (`.navmap-modes` button two): `.navmap-bar`'s box is inside `.navmap-frame`'s, and `.navmap-side`'s box is inside the frame and at least 100 px tall.
     - On its list: a `.navmap-group` headed "Star systems" lists `sys.name`, and `.navmap-side` scrolls (`scrollHeight > clientHeight`, or every row is inside its box).
     - Shoot `24-endless-phone` and `25-endless-phone-small`.
  7. No page errors.
- [ ] **Step 5: Run them and see them fail.** Start the dev server. Run `OUT=/tmp/6b CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs endless`. Expected: check 0 FAILS (Task 8's `charted` holds and lets go, but the nav map doesn't ask it yet, so no generated place comes), check 1 FAILS (no generated place on the chart), and check 6's holder never shows.
- [ ] **Step 6: Wire `NavMap.jsx` and `Universe.jsx`** as above. `NavMap.jsx` stays under 800 lines. Its header gains a paragraph on generated places: asked of the scene, light until found, listed in view and known, and timed by the formula.
- [ ] **Step 7: Run them and see them pass.**
  - Run `OUT=docs/superpowers/evidence/endless-universe-lane-6b/after CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs`, all five modes. Expected: `all ok`, no page errors. Lane 6a's `desktop`, `phone`, `minimap` and `far` checks pass as before.
  - Then run `npx vitest run src/components/universe src/lib/words.test.js`. Expected: PASS.
  - Stop the dev server.
- [ ] **Step 8: Lint.** Run `npm run lint`. Expected: no new problems.
- [ ] **Step 9: Commit.** `git add src/components/universe/chart src/components/universe/NavMap.jsx src/components/universe/words.js src/pages/Universe.jsx scripts/navmap-check.mjs docs/superpowers/evidence/endless-universe-lane-6b && git commit -m "The nav map lists, finds and sends you to the generated places round you and the ones you know, timed by the formula"`

---

### Task 11: The endless check: the ship on the chart at every step, and a map step

**Files:**
- Modify: `scripts/universe-endless-check.mjs` (lane 2's, with lanes 3, 4a, 4b and 6a's steps)

**Interfaces:**
- Consumes: lane 6a's `shipOnChart(page) → { drawn, inside, edge, readout }` and Task 1's `toSystem(page, id)`, both in `scripts/lib/navmap.mjs`; Task 8's `__universeDebug.charted` (`answers`, `ms`, `settleMs`, `pending`, `known`, `cap`, `know`); lane 2's `__universeDebug.expanse.sectors()`.
- Produces:
  - **The ship on the chart at every step.** Lane 6a's Task 11 already calls `shipOnChart(page)` after each step and asserts `drawn && inside`, when the script was there in time. That call stays as it is, and this task doesn't add a second. Only if it isn't there does this task add it, after each step's record.
  - **A `map: ok | FAIL` column** in the printed table, from that same call's answer. This is the index's "the ship marker at every step (6a and 6b)".
  - **A `map` step** (`--only map`, lane 3's flag):
    - `toSystem(page, 'E:1,0:0')`
    - open the nav map
    - wait until `li[data-kind="star"]` are on the chart, and `li[data-id="E:1,0:0"]` at the neighbourhood level
    - check that the readout starts `Sector 1, 0, 0 · `
    - press `-` and `+` in turn, each press waiting (30 s at most) until `__universeDebug.charted.answers()` has grown by one, till it is 20 more than when the step began. Each press changes the ask's key, so each is a new answer.
    - fail when `__universeDebug.charted.ms()` (the median of the last 20) is over 4 ms (Global Constraints), and print it as the neighbourhood's time
    - **then the worst case, a full table at the universe level:**
      - **Fill the table to its cap, with nothing dropped.** The run's `system` step and the name tags shown in flight have made some places known already, and a fill past the cap would drop `KNOWN.slack` of them. So, with `n = charted.cap − charted.known().length`:
        - `ids` is the first `n − 20` system ids of `__universeDebug.expanse.sectors()` (the 3 × 3 × 3 round `E:1,0`, about 7,400 systems, all at hand) that aren't already in `known()`
        - then `E:5,-3:0` to `E:5,-3:19`, twenty systems of a sector four sectors off, out of the 3 × 3 × 3, so that one sector is fetched and settled too
        - `charted.know(ids)` must give `ids.length`, and `known().length` must then be `charted.cap`
      - press `-` ten times with no wait between (the range stops at `CHART.range.max`, 3,000,000, after eight at `ZOOM_STEP` 1.5), then wait (30 s at most) until `answers()` has grown
      - **Let it go on by itself.** With no more presses, wait (30 s at most, polling every 500 ms) until `__universeDebug.charted.pending()` is empty: the ids at hand resolved in about 17 chunks back to back, and `E:5,-3` fetched and settled. The nav map's own ask, once a second while it's open, keeps the chart going.
      - then press `+` and `-` in turn, each waiting (30 s at most) until `answers()` has grown by one, 20 presses. Between 2,000,000 and 3,000,000 each press stays at the universe level and changes the key.
      - fail when `ms()` is over 4 ms, and print it as the universe level's time with the table full
      - fail when `settleMs()` is over 4 ms, and print it as the chunks' time: the last 20 of them, at hand and `E:5,-3`'s
    - close with Escape

- [ ] **Step 1: Write the check:** the column from lane 6a's call (or the call, if it isn't there), and the `map` step, each failing the run on a miss.
- [ ] **Step 2: Run it.** Run `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-endless-check.mjs --quality mid --only start,old-rim,boundary,system,climb,map`. Expected: exit 0, `map: ok` on every row, no console errors, and the chart's three medians printed (the neighbourhood's answer, the full table's answer and the chunks), each at most 4 ms. Copy the table and the three into the README.
  - `ms()` and `settleMs()` time the work itself (`performance.now()` round `rows(q)`'s work, and round each chunk), not a frame, so software GL's slow frames aren't in them. A median over 4 ms is the chart's own cost: find it with the browser's profile, fix it, and run the step again. Don't shorten the list to meet the bound.
- [ ] **Step 3: Commit.** `git commit -m "The endless check finds the ship on the nav map at every step, the generated places on it, and times its ask and its work"`

---

### Task 12: The full measure, and the hand-off notes

**Files:**
- Create: `docs/superpowers/evidence/endless-universe-lane-6b/HANDOFF-NOTES.md`
- Modify: `docs/superpowers/evidence/endless-universe-lane-6b/README.md`
- Create: `lab/universe/after-6b/` (the measure's JSON)

- [ ] **Step 1: The scene's numbers, every tier, once.** This lane draws nothing new in 3D, so the calls and triangles must be equal.
  - The tiers are `high`, `mid` and `low`, as lanes 3, 4a, 4b and 5b measure them. `universe-check.mjs` knows no other (`TIERS = ['high', 'mid', 'low']`, `:34`), and `lab/universe/baseline/` holds only those three.
  - **The baseline poses,** for each tier: `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-check.mjs --quality <tier> --out lab/universe/after-6b/<tier>`.
  - **The endless poses,** in one run a tier (lane 3 found that a shorter list drops the others from `<out>.json`). The list is read from the file, never written out here, so a pose a later-merged lane added (5b's) is measured too:
    - `poses=$(node -e "console.log(Object.keys(require('./lab/universe/endless/<tier>.json').poses).join(','))")`
    - `… --quality <tier> --poses "$poses" --out lab/universe/after-6b/endless-<tier>`
  - Expected: calls and triangles equal to `lab/universe/baseline/<tier>.json` and `lab/universe/endless/<tier>.json` at every pose the file holds, none of them missing from the after. This lane adds no pose and leaves `lab/universe/endless/` as it is.
- [ ] **Step 2: Frame time, three runs each.** As Task 1's Step 4, to `lab/perf/6b-after-<tier>-<n>`, with no dev server up. Expected: by Global Constraints' noise-aware rule against Task 1's three. For every phase but `load`, at `mid` and at `low`, the after's median p50 is at most the before's median p50 plus the larger of 2 % and the before's spread. If a phase is over, run that tier three more times, each side, before calling it a regression: the chart draws nothing in 3D and asks the scene only while the map is open.
- [ ] **Step 3: The whole route.** Run `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-endless-check.mjs --quality mid`, every lane's steps. Expected: exit 0, the ship on the chart at every step.
- [ ] **Step 4: The checks that read the nav map and the scene's handle.** Start the dev server, run these, then stop it:
  - `navmap-check.mjs` (all modes)
  - `sector-check.mjs` ("The Curve" pressed)
  - `flyto-check.mjs --fake`
  - `links-check.mjs`
  - `wonders-check.mjs`

  Each runs with `CHROME=/opt/pw-browsers/chromium`. Then run `CHROMIUM=/opt/pw-browsers/chromium node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`. Expected: each passes as before Task 1. One that failed then is noted, not fixed here.
- [ ] **Step 5: The README.** It holds:
  - before and after, side by side
  - the calls and triangles per pose and tier, equal
  - the frame times: every run, the medians and the spreads, before and after
  - the chart's ask, timed in Node (Tasks 5 and 8) and in the browser (Task 11), the full table at the universe level among them, the chunks of its work (`settleMs`, Tasks 8 and 11) and the nav map's render (Task 9), each against its bound
  - `scene.js`'s line count at Tasks 7 and 8
  - `boundary-breaks` and `cycles`, before and after
- [ ] **Step 6: The hand-off notes.**
  - **"Landed":** every module above by path, with its interface in one line, and the table, the `endless` mode, and the `map` step and ship marker.
  - **"Left":**
    - **Lane 4c:**
      - the arrival can mark its world visited through `charted.heard`, or the table directly (`createKnown` over `universeStore()`)
      - its saved position is `tp-universe-where`, in `rt.saves`, apart from this table
      - a second table in `tp-universe` takes that database to version 2, which closes an older build's universe tab's connection to it (its known places' writes, ids that come again). `tp-store` is never touched by it (finding 2)
      - the mini-map's `ship` prop still waits for it
    - **Retiring the old chart, an owner's call:** `nav.js`'s `chartAt`, `chartRadius`, `onChart`, `viewFor`, `chartHeading` and `chartLabels.js` are read by nothing but their own tests (finding 9).
    - **For the owner:**
      - an ally's diamond on the chart (HANDOFF "Left": `pilots.chart`'s `ally` is passed by nothing yet; its colour is the owner's)
      - events as places to fly to (finding 5)
    - **`rosterWhere.js`** still makes a sector on the main thread (finding 10).
    - **Gargantuans past the nearest six** show on the universe level only once known (finding 15).
    - **Search over the known, for the owner:** with the box holding a query, the chart fetches every known place's sector it hasn't found, one at a time, nearest first, each as soon as the last has landed, while the pool is idle. With the table full (2,000 places over a few hundred sectors), that is the sum of their builds: about 15 to 40 s on a desktop here (45–130 ms a build), several times that on a phone. The list says "Still looking through the places you know…" till then. Storing each known place's name beside its id would make it instant, against spec G's "ids only". That's the owner's call (finding 3).
    - **One cost not timed:** the structured clone of a whole sector as it comes from the worker, paid on the main thread before the chart's handler runs, once for each sector the chart fetches. It is the same as one of lane 2's own sector loads, and the chart fetches one sector at a time, only while the map is open (Review Focus 3).
    - **Everything you know, past the widest range:** the chart pins the nearest three to its rim, and lists and finds the rest. Drawing them all where they are would need a wider `CHART.range.max` (lane 6a's, 3,000,000), the owner's or a later map lane's call (finding 22).
    - **The chart's builds and lane 2's loads share the `expanse` workers.** The chart asks only on an idle pool and goes last, but one of its builds already in flight holds a sector load or a pick's fetch asked behind it for that one build on a tier with one worker (Review Focus 3, finding 19).
    - **Lane 3's six cards with no `chart`** (`rock`, `ice`, `derelict`, `rogue`, `nebula`, `pulsar`) take `pick.js`'s `SPARE_CHARTS`, each borrowed from lane 4a's nearest kind. A rock, an ice ball or a derelict seen by name isn't kept; a rogue planet is. Moving the six onto their cards (`places/cards.js`) is lane 4a's or the owner's call, and `chartOf` takes a card's own first (finding 21).
    - **The phone's readout** is still lane 6a's sector and height alone: whose space it is went in the status, not the readout (finding 17).
    - Any findings from the measure.
- [ ] **Step 7: Run the gates and commit.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, within budget. Then `git add lab/universe/after-6b docs/superpowers/evidence/endless-universe-lane-6b && git commit -m "Lane 6b measured at every tier, the nav map's after shots, and its hand-off notes"`.

---

## What later lanes consume

| Name | From | Used by |
|---|---|---|
| `universeStore()` → the store of the `tp-universe` database (version 1), holding the `universe-known` table; `createStore`'s `tables` option (`TABLES` and `tp-store` unchanged) | `src/runtime/local.js`, `src/runtime/store.js` | 4c |
| `KNOWN`, `HOW`, `createKnown({ store, clock, cap, slack })` (`ready`, `add`, `how`, `has`, `remove`, `list`, `size`, `flush`), `systemIdOf` (a station's system too), `knowable(dest, chart)` | `universe/charted/known.js` | 4c (an arrival's world, visited) |
| `CHARTED` (`max`, `systems`, `list`, `every`, `near`, `retry`, `giants`, `keep`, `queue`, `below`, `rim`), `ChartRow`, `chartRow`, `levelsOf`, `markPriority`, `generatedMarks(rows, { pinned })` (each mark `generated: true`, and `pinned: true` when asked), `mergeMarks`, `chartQuery(view, { search })`, `nextAsk(last, view, now, { search })`, `capGenerated`, `groupOf` | `universe/chart/generated.js` | any later map work |
| `placeMarks`' `pin` and `yields` options, and `Placed.under`; `NavChart` pins a mark of `kind: 'came'` or `pinned: true` | lane 6a's `universe/chart/place.js`, `NavChart.jsx` | any later chart that draws lesser marks over the core, or pins one to the rim |
| `firstPick`, `pickedOf`, `timesFor`, `listOf`, `groupsOf`, `moreOf`, `cameraGoes`, `holderLine`, `markFor(id, { merged, rowOf })` | `universe/chart/navList.js` | any later map work, 4c (`holderLine` for whose space the arrival is in) |
| `useCharted({ chart, view, ship, search, clock })` → `{ rows, known, rim, left, marks, more, rowOf }` | `universe/chart/useCharted.js` | any later map work |
| `liveMarks(now)` reading `pilots[].y`, `farFights[].y`, `traffic`, `events`, `cameFrom` | `universe/chart/marks.js` | any later map work |
| `chartPlaces(sectors, focus, t, { level, range, max })`, `chartOf(dest)`, `SPARE_CHARTS` | `universe/charted/pick.js` | anything that lists generated places for a view |
| `createSceneChart({ places, sectors, workers, universe, shared, store, t, clock, giants, rim })` (`heard`, `named`, `rows(q)` → `{ rows, known, rim, left }`, `debug`: `known`, `cap`, `pending`, `asked`, `ms`, `settleMs`, `answers`, `flush`, `hold`, `know`; `dispose`); its pool asks under `chart|<sector key>` at priority `Infinity`, only on an idle `expanse` pool, each as the last lands while the map asks; its work in chunks of `CHARTED.max`, one to a `setTimeout(0)`; `__universeDebug.charted` | `universe/charted/sceneChart.js`, `scene.js` | 4c, the endless check |
| `createWhere(deps)` (with `label` for the far fights) and `Where` | `universe/whereNow.js` | every later lane that adds a key to `where()` adds it here |
| `where().traffic` (`[{ id, kind, x, y, z }]`), `where().pilots[].y`; `traffic.chart`; `pilots.chart[].y` | `whereNow.js`, `traffic.js`, `online/pilots.js` | 4c, any later map work |
| `handle.chart(q)` → `{ rows, known, rim, left }` (or null with no scene); `map.current.chart`; `<NavMap chart place>` | `scene.js`, `UniverseMap.jsx`, `Universe.jsx` | 5b, 4c |
| `scenePlaces`' `named(ids)` dep | lane 3's `places/scenePlaces.js` | anything that wants the names shown |
| `tripTime`'s formula first for a long leg | `nav.js` | everything that times a trip |
| `CHART_WORDS.holder`, `CHART_WORDS.looking`; `.navmap-holder` in the nav map's status, `.navmap-looking` in its search | `words.js`, `NavMap.jsx` | 4c (whose space the arrival is in) |
| the `endless` mode (`toSystem(page, id, { inside })` → `{ id, name, at, reach, span }`, reaching a system anywhere: it teleports to the sector first when it isn't round the ship); the `map` step, its time bounds and the `map: ok` column | `scripts/lib/navmap.mjs`, `scripts/navmap-check.mjs`, `scripts/universe-endless-check.mjs` | every later lane |

## Assumptions about unmerged work

Each of these can be checked once lanes 3, 4a, 4b and 6a have merged. Where one is false, follow the code and keep the behaviour this plan asks for.

1. **Lane 6a merges as `eu/lane-6a` has it at `c41652d3`, plus its Tasks 10 and 11.**
   - `NavMap.jsx`, `chart/NavChart.jsx` and `chart/marks.js` are as quoted here. `HAND_MARKS`' lowest pickable priority is `PORTAL`, 30, and `marks.js` exports `openView`.
   - `chart/place.js`'s `placeMarks` is `c41652d3`'s: one `declutter` over every label, with `keep` and `ranked`, and no `pin` or `yields` yet (Task 9 adds them). `NavChart` passes it `keep` and no `ranked`.
   - `scripts/lib/navmap.mjs`'s `shipOnChart(page) → { drawn, inside, edge, readout }` exists, from its Task 10. It isn't on the branch yet (`scripts/lib/navmap.mjs` is missing at `c41652d3`).
   - Its Task 11 calls `shipOnChart` after each step of `universe-endless-check.mjs` when the script was there in time. Task 11 here keeps that call, and adds it only if it's missing.
   - `marks.test.js:83` pins the pilots' levels.
   - `useChartView.test.js`'s mocked React (`:10-46`) and `run` are there to copy.
   - `navmap-check.mjs` loads `?quality=low` (`:26`), its `open` waits at `:57-60` (`__universe().ship`, `.universe-navmap-btn`, then a `waitForTimeout(2000)`), and its `far` block starts at `:351`. These are `c41652d3` as committed; the worktree's uncommitted Tasks 10 and 11 move them.
   - `NavChart.jsx`'s `LISTED` is at `:53`, its `placeMarks` call at `:199-204`, and live marks' `data-kind`s are `pilot` (a `rect.navmap-pilot`, no `li`), `fight`, `front` and `region`. `marks.js`'s `COLOUR` is at `:47` under its comment (`:44-46`), and `liveMarks` at `:110`.
   - `chart/input.js`'s `ZOOM_STEP` is 1.5, and `CHART.range` is `{ min: 300, open: 120000, max: 3000000 }`.
2. **Lane 3's interfaces are as its plan's "What later lanes consume" gives them:**
   - `places/ids.js`'s `canonicalPlace` and `isPlaceId`
   - `places/resolve.js`'s `resolvePlace(id, { universe, t, sectors, build })`, which with `build: false` reads rows from the sectors it's given. A row whose `kind` a test changed resolves as that kind (Task 5's forced rows).
   - `places/cards.js`'s `THING_CARDS` and `PLACE`. A system's card has `span` (the system's reach) and `reach` (`star.size × 2`).
   - `places/around.js`'s `placesAround` and `AROUND`
   - `scenePlaces`' `resolve`, `fetch` (never rejects, keeps the last four sectors fetched), `missing`, the `'place'` `'arrive'` event (for a station too), its tags list, and `places.debug` as `__universeDebug.places`: `{ resolve, parkAt, stations, screen }`, whose `resolve` reads only the loaded and fetched sectors and never fetches (so Task 1's `toSystem` takes the ship to a far sector first)
   - a lattice thing's Destination has `place: 'thing'` and its row's kind as `sub`, as `chartOf` reads it (Tasks 5 and 8)
   - `scenePlaces.test.js`'s `make` is `make({ sectors, universe, workers, startAt, turn, device })` (its Task 12) and passes no tags box. Its Task 13 test hands in a fake `tags` box that records `show` calls; Task 8 here hands one in the same way (`withTags()`), adding a `tags` option to `make` only if Task 13 added none
   - a station's row has `system`, its system's id, and its id is `w(10000 + i)` (`STATION_BASE`), under lane 4a's `EXTRA_HIGH` (20000); Task 2's test reads the stations of a real sector
   - `nav.js`'s `{ place }` option on every destination function, `findDestinations`' `more` (kept in its order), and `tripTime` giving null for a place the lookup doesn't find
   - `places/trip.js`'s `longTrip`
   - the handle's `place`, and `where().place`, `docked` and `t`
   - `__universe().place`
   - `scene.js`'s `const universe` (lane 3's Task 11) and `state.spaceT`; `ctx.rt.workers` handed to `createScenePlaces`
   - `weight.test.js`'s `GENERATOR` and `it.each`
   - the stand-in keys in `Universe.jsx:100`
   - `scripts/universe-endless-check.mjs`'s `--only` (lane 3's Task 11) and its `travel` step
3. **Lane 4a:**
   - every kind it adds has a card in `THING_CARDS` carrying `chart: { shape, priority }`, its plan's numbers (15 to 40, a gargantuan 80)
   - lane 3's six cards, `rock`, `ice`, `derelict`, `rogue` (lattice) and `nebula`, `pulsar` (legacy wonders, and `pulsar` reused for generated pulsars), carry no `chart`: lane 4a's plan spreads `rogue`'s row and adds only `land`. Task 5's kinds test lets `chartRow`'s default dot of 20 stand for those six and reads the card's when one has been added since
   - `KINDS` has the 32 kinds, and `nearestOfKind` takes each of them, `system`, `station` and `nebula` included, over any iterable of sectors
   - `gargantuanSectors(universe, from, { n })` is on the face, and a gargantuan sector's row is its `w3`
   - a gargantuan row has `gargantuan: true` and sits in a low list (`w3`), as does the arrival's (`w4`)
   - list rows under `THING_BASE` are the ones out between the systems, and two kinds of one catalogue entry (`pulsar` and `magnetar`, `field` and `icefield`, the five forms) share a list
   - `THINGS.note.cameFrom` and `where().cameFrom` (`{ id, name, at, key }`) exist
   - the face lends `rowAt`; if not, Task 5 adds it
4. **Lane 4b:**
   - `where().events` (`[{ id, kind, name, x, y, z, big }]`), `where().holder` (`{ id, name, side }`) and `where().farFights` with `y` exist
   - `where()`'s far fights read `f.label ?? fightLabel(f.at)`, and `fightLabel(at, near)` stays in `farFights.js`
   - inside a generated system's zone outside the core, `where().holder` is that system's (its Task 10), so Task 10's phone check finds one
   - `EVENT.name` has every kind
   - `__universeDebug.happen(id)` still forces an event
   - `traffic.js`'s live groups keep `members` with `alive` and `model.group.position`
   - lane 4b's `holderNow` is a `let` in `scene.js`
5. **Lane 2:**
   - `expanse.sectors()` is a `Map` of the 3 × 3 × 3's whole sectors, the lattice and lists among them
   - the pool's `expanse` name answers `{ type: 'sector', key, universe, sx, sy, sz }` with `{ key, sector }` (its Task 19's `sectorJob`), takes a `priority`, and `sectorJob` and `withMoons` are on the face
   - nothing is assumed about the scale of lane 2's sector-load priorities (its grid isn't on `eu/lane-2` yet): the chart's `Infinity` goes after any number, and it asks only when `workers.stats().expanse` shows nothing busy or queued
   - `__universeDebug.expanse.sectors()` is the same `Map`, for Task 11's fill
   - `__universeDebug.teleport(x, y, z, heading, pitch)` exists
   - `scripts/universe-endless-check.mjs` records a row a step
6. Nothing here reads `ctx.rt.store` (`worldStore()`, `runtime/index.js:100`). The scene imports `universeStore()` from `runtime/local.js`, as `footScene.js:124` imports `localSaves`; under Node it is a store in memory.
7. No lane before this one has made a `tp-universe` IndexedDB database or given `createStore` a `tables` option. If one has, this table joins that database at its version plus one, which closes only that database's older tabs, never `tp-store`'s.
8. `where()` is still a method of the handle `create()` returns, reading only names declared above the handle (or reassigned: `front`, `holderNow`).
9. Lane 2's `withMoons` is a lazy, memoised getter over `moonsOf` (its plan), so a settled sector's first chunk is mostly resolving. A sector of about 270 systems has 20 of them (Task 11 knows `E:5,-3:0` to `:19`).

## Findings for the coordinator (spec against code)

1. **The known-places table is lane 4c's in the spec's lanes table,** but the map is its first reader, and wave 3 starts 6b before 4c. This lane builds the table and its recorder. Lane 4c keeps the saved position (`tp-universe-where`) and reads this table if it needs to.
2. **Spec G's "`rt.store` table `universe-known`" is a table of that name in a database of its own.** Spec G says the table is in `rt.store`, and also that "nothing existing changes shape". `createStore`'s object stores are made only on an upgrade (`store.js:29-31`), so a fourth table in `tp-store` would take it from version 1 to 2:
   - A tab of the older build already open (a long-lived minecraft tab, then a new tab of the site: the common way a deploy meets a visitor) gets `versionchange`, and `openDb` closes its database (`db.onversionchange = () => db.close()`, `store.js:34`). Until it reloads, its `set` returns false ("a closed database: this write is lost"), so its minecraft and `/worlds` writes are lost. That breaks the owner's rule that nothing a visitor does is lost (done item 9).
   - So the table is `universe-known` in `tp-universe`, at version 1, made by the same `createStore` (which gains a `tables` option) through `universeStore()` beside `worldStore()` in `runtime/local.js`. It is never mirrored, as spec G's "ids only, a few thousand, oldest dropped" needs.
   - `tp-store` keeps its version, its tables and its open tabs (Task 2 pins an older tab still writing). The minecraft world and `/worlds` tests are unchanged.
   - The spec's words are kept but for which database holds the table. The coordinator may want spec G's row to say `universeStore()`, and the owner may say otherwise (a bump with a notice to reload, say). This lane's code takes either: only `universeStore()` would change.
3. **"Ids only" against drawing and searching them.** An id names a place, but its name and position need its sector made, 45 to 130 ms a sector (lane 3). So:
   - Known places in the sectors at hand are found at once.
   - Known places elsewhere come from the worker pool while the nav map is open, one sector at a time, nearest first. They are held in memory for the visit as light rows and never stored.
   - Drawn, only those whose sector comes within the view's range are fetched (lane 3's "the visited places in view, not the whole list").
   - Searched, spec F covers every visited and named place. So while the search box holds a query, the chart fetches the known places outside the range too, nearest first, each as soon as the last has landed, and the list says it's still looking until they're in. A place you visited five sectors off, or a wormhole's throw away, is found by name.
   - With a full table over a few hundred sectors, that is the sum of their builds one after another: about 15 to 40 s on a desktop here (45–130 ms a build), several times that on a phone. (An earlier draft of this plan asked once a second, which would have been several minutes.) A stored name would make it instant, against spec G's "ids only". The hand-off puts it to the owner.
4. **Lane 3's `tripTime` still flies a far hand-made trip before taking its formula:** 4,500 autopilot steps a drive, about 90 ms here, twice every two seconds in the side panel. Spec F says long trips come "from a formula, not the 150 s simulation". Task 6 takes the formula first.
5. **Events are happenings, not places.** The map draws them by name, as lane 6a drew far fights: a label, not a button. Travel has no event goal (lane 3's `trips.js` takes places, pilots and the front). So "nothing on the map is a place you can't go to" holds, because every place mark is pickable and every pickable mark is a place. Flying to an event would need an event goal in `trips.js`, which is the owner's call.
6. **Pilots at every level.** The spec's table lists other pilots at the neighbourhood level, but "Always honest" draws them "at their sector positions", and lane 6a's hand-on says "everywhere". A pilot 10 sectors off is only in range at the universe level. This changes lane 6a's assertion `marks.test.js:83` from two levels to three, as a replacement, named in Task 4's commit.
7. **`pilotsNodes.js` is the node renderer's twin of `pilots.js`.** It is pinned equal by `pilotsNodes.test.js`, so both get the height.
8. **"Seen named" is the name tags lane 3 shows in flight, plus every arrival.** Names on the nav map don't count: opening the map in a neighbourhood would record a hundred systems at a glance and fill the table in a week. A rock or other lattice thing is known by name only when the chart it's drawn with ranks it 20 or more (`KNOWN.least`). An arrival at a station marks its system visited too (`systemIdOf`).
9. **Lane 6a's leftovers stay.** `nav.js`'s `chartAt`, `chartRadius`, `onChart`, `viewFor` and `chartHeading`, and `chartLabels.js`, are read by nothing but their tests (`nav.test.js:174-198`, `:417-424`; `chartLabels.test.js`). Lane 6a offered them to this lane to retire. Retiring them deletes those tests, which the owner's rules don't allow without the owner's word, so they're left and named in the hand-off.
10. **`online/rosterWhere.js` makes a sector on the main thread** to name where a pilot is (lane 3's finding 21). That's the roster's, not the map's. It is left for the owner of `online/`.
11. **Spec F's "the no-3D mini-map uses the projection and data above."** With 3D off no scene runs, so there are no loaded sectors, no worker pool and nothing to resolve a known id with. The page never makes a sector (lane 3's rule). So the mini-map keeps lane 6a's projection and hand-made marks unchanged (Task 4's run of its tests), and shows no generated or known place.
12. **`where()` is no longer in `scene.js`.** Its body moved to `whereNow.js` to pay for this lane's wiring. A later lane that adds a key to `where()` adds it there, as a dep or a read. `fightLabel` reaches it as the `label` dep, because `farFights.js` imports three.
13. **Spec C's "the map's Home takes them back to the core"** is the returning pilot's, lane 4c's. Today the Home station is a destination, and "Home system" is a chip. A one-press Home is 4c's call.
14. **Lane 4b's `where().farFights` heights and lane 6a's hand-on overlap.** Lane 6a handed "heights for other pilots and far fights, and traffic" to this lane. Lane 4b's Task 13 already gives far fights their `y`, so this lane adds the pilots' and the traffic, and reads 4b's for the fights.
15. **Spec F's universe level shows "the gargantuans", but a gargantuan's place needs its sector.** Lane 4a places one by darts clear of its sector's legacy systems, wonders and beacons. Lane 3 measured those at about 2 ms (`makeSector` and `addBodies`), but spec A keeps `makeSector` off the main thread. `gargantuanSectors` gives which sectors hold one, cheaply, but not where in them.
    - So the universe level shows the gargantuans in the loaded 3 × 3 × 3, and the nearest `CHARTED.giants` (6) past it, each a whole sector built in the worker.
    - The rest show only once known: visited, or seen named in flight.
    - A worker job that makes only a sector's legacy part and its gargantuan would make more of them cheap. That's lane 4a's or lane 2's call.
16. **Lane 3's `places.fetch` keeps only the last four sectors it fetched.** The chart's background fetches through it would push out the sector a pick's card, its times or a waiting trip needs, and each would then be fetched again. So the scene's chart asks the pool itself under its own key (`chart|<sector key>`), at the lowest priority, keeps light rows and lets the sector go. Lane 3's fetched list is left to the picks and the trips.
17. **Lane 6a's phone readout already runs to three or four lines** at 390 and 360 wide, and the side panel gives way (its hand-off, Task 8's "Left"). A desktop's readout is held to two lines. So whose space it is (lane 4b's holder) goes in the status, under where the ship is, not in the chart's readout. Task 10 checks that the bar and the side panel still fit at both phone sizes.
18. **The hand-made core against the generated places** (spec F's failure "the hand-made core buried under generated clutter"). The map opens at the neighbourhood level, 120,000 round the ship, and the generator fills the core (spec call 2), so the first open at home draws up to 120 generated marks over the portfolio's places. Lane 6a's declutter puts names down greedily, highest first, each clear of every other place's dot. So the generated marks rank under every hand-made pickable one (30, a portal's) and give way to them: lane 6a's `placeMarks` gains a `yields` option (Task 9).
    - Lane 6a's own `ranked` (`c41652d3`) doesn't hold it. Its second pass runs after every first-pass name is down, generated ones included, so a generated name can still take a hand-made name's room. And with each mark's priority as its rank, a hand-made name could lie over a lesser hand-made dot, which changes lane 6a's picture of the core.
    - Lane 6a's `navmap-check` desktop mode only checks that no two names meet, and a quiet name passes it. So Task 10 checks the core's names, held off and let in within the same run.
19. **The chart's builds and lane 2's loads share the `expanse` workers.** Lane 2's sector grid isn't on its branch yet, so its priorities' scale is unknown. The chart's asks go at `Infinity`, which the pool's `findIndex(j.priority > p)` (`runtime/workers.js:110`) always puts last, and only while the pool is idle. One build already in flight (45–130 ms here, several times that on a phone) can still hold a newly queued sector load or pick fetch on a tier with one worker. The pool can't stop a held job mid-build (a cancel reaches the worker after it). That one build's wait is the cost.
20. **The way back after a wormhole's throw is past the chart's widest range.** Lane 4a's wormhole throws you 30 to 80 sectors (3.6 to 9.6 million), and lane 4b's wormhole event uses the same rule. Lane 6a's `CHART.range.max` is 3,000,000, and `placeMarks` leaves out a mark past the range unless it's kept. So the way back is pinned to the rim by a new `pin` option, which names it at its own priority and never takes the pick's room (Task 9).
21. **Lane 3's six cards carry no `chart`.** Lane 4a's plan gives `chart` to the kinds it adds, but not to lane 3's `rock`, `ice`, `derelict`, `rogue`, `nebula` and `pulsar`.
    - With `chartRow`'s default (a dot of 20, which is `KNOWN.least`), the chart and the table would disagree. Read by the card's chart (null), a rogue planet or a derelict shown by name would never be known, though drawn at 20. Read by the row's chart, every rock and ice ball tagged in flight would be known, and the table would fill with them.
    - So `pick.js`'s `SPARE_CHARTS` gives each a chart borrowed from lane 4a's nearest kind: `rock`, `ice` and `derelict` a dot of 15 (as `field` and `debris`), `rogue` a dot of 20 (as `outpost`), a legacy `nebula` a cloud of 35 (as `pocket`), a `pulsar` a star of 30 (as `magnetar`). `knowable` reads the row's chart (Task 8). A rogue planet seen by name is known. A rock, an ice ball or a derelict isn't: derelicts are a tenth of the lattice, hundreds a sector.
    - A card's own `chart` wins over its spare. Moving the six onto `places/cards.js` is lane 4a's or the owner's call.
22. **Done item 7's "out to everything you know" against the chart's widest range.** Lane 6a's `CHART.range.max` is 3,000,000, and a wormhole throws you 3.6 to 9.6 million. After a throw, nothing you know is in the widest view. This lane pins the way back and the nearest `CHARTED.rim` (3) places you know to the rim, fetching those sectors at the universe level (Tasks 8 to 10), and every place you know is in the list and the search. Drawing every known place where it is would need a wider `CHART.range.max`, or a universe level that widens to what you know: lane 6a's projection, the owner's or a later map lane's call.

## Spec coverage

- **Done item 7, "The map is dynamic"** (with lane 6a, whose part is the centring, the zoom and the projection):
  - "It zooms from a single system out to everything you know": from the system level's bodies to the universe level's known systems (Tasks 3, 5 and 8). Past the widest range (3,000,000, lane 6a's), the nearest three places you know are fetched and pinned to the rim beside the way back, and every one is in the list and the search (Tasks 8, 9 and 10). Drawing them all where they are is left to a wider range (finding 22).
  - "It shows generated places and travels to any of them": Tasks 3, 5, 8, 9 and 10, checked in the browser in Tasks 10 and 11.
  - "The no-3D mini-map uses the same projection and the same data": kept as lane 6a left it (Task 4's run; finding 11).
- **Done item 4, "the map lists it",** lane 3's hand-on: Tasks 5, 8 and 10. Task 5's kinds test pins each of lane 4a's 32 kinds:
  - listed at the system level
  - resolved
  - made a pickable mark carrying its card's `chart`, or `SPARE_CHARTS`' for lane 3's six cards that have none (finding 21)
- **Section F:**
  - **Levels by zoom:**
    - System: the star, planets, moons, stations and traffic (Tasks 4 and 5)
    - Neighbourhood: the 3 × 3 × 3's systems, things, gargantuans, nebulae, fights, events going on and other pilots (Tasks 4 and 5)
    - Universe: the systems you've visited or seen named, and the gargantuans: those in the loaded sectors and the nearest six past them (Tasks 3, 5 and 8; finding 15). Lane 6a draws the core's places, the sector outlines and Home.
  - **"Labels thin out by priority":** this lane's priorities, every generated one under every hand-made one, through lane 6a's declutter and Task 9's `yields`, checked in Tasks 9 and 10.
  - **"Generated places are destinations":** picked and travelled to through lane 3's `nav.js` (Task 10).
  - **Search over the hand-made, the visited and named, and the in-view places:** Tasks 3 (`chartQuery`'s `search`), 8 (every known sector fetched while searching, nearest first), and 10 (`listOf`, `useCharted`'s `search` and `left`, the "still looking" line, and the browser check that finds a visited place from four sectors off). Every visited and named place is found, not only those a view has reached. Each sector is fetched as soon as the last lands, so with a full table the last come in 15 to 40 s on a desktop (finding 3, put to the owner in the hand-off).
  - **"Trip times for long trips come from a formula":** Task 6, and Task 10's `timesFor`.
  - **"The jump goes to anything on the map":** Task 10's travel check, by lane 3's travel.
  - **"Always honest":**
    - the ship's marker at every step: lane 6a's call, and Task 11's column
    - other pilots at their sector positions, with heights: Tasks 4 and 7
    - nothing on the map a place you can't go to: Task 4's test; finding 5
    - the way back on the chart however far a wormhole threw you, pinned to the rim, and the nearest places you know beside it: Tasks 8 to 10 (findings 20 and 22)
    - the phone at 390 × 844, and 360 × 640: Task 10
  - **The failure "the hand-made core buried under generated clutter, so the portfolio's stations stop reading as the site's":** Task 3 (every generated mark under the lowest hand-made pickable one), Task 9 (`yields`: every name the core shows alone is still shown, on its side, with 120 generated marks round it) and Task 10's browser check at the open view from home (finding 18).
- **Section G, "What you've visited or seen named":** Task 2's table, ids only, capped at 2,000 with the oldest dropped, filled by Task 8 (finding 1). It is `universe-known` in a database of its own rather than in `tp-store`, so nothing existing changes shape (finding 2).
- **Section B, "shows on the map,"** for every kind: Task 5's kinds test, and Task 8 from lane 4a's cards.
- **Section C's events:** each of `EVENT.name`'s kinds is named on the chart while it runs (Task 4's test).
- **The spec's counts:**
  - At least 20 kinds of thing (lane 4a's 32, pinned at the system level in Task 5) and 15 kinds of event are lanes 4a's and 4b's. This lane draws every one of them.
  - The density and pacing numbers are lanes 2's and 4b's. This lane changes neither.
- **Done item 9, "Nothing is lost":**
  - every existing test but one is unchanged; `marks.test.js:83` is replaced, not loosened (finding 6)
  - `tp-store` is untouched: its version, its tables, and an older build's open tab still writing (Task 2, finding 2)
  - the checks are rerun (Task 12)
- **Done item 10, "Phones still fly":**
  - no new draw call (Task 12)
  - frame time within the before's noise, by three runs each side (Task 12)
  - the chart asked once a second at most, its whole answer capped at 120 rows and the list at 60 (Tasks 3, 5 and 8)
  - the ask timed against its bounds, 2 ms in Node and 4 ms in the browser, a full table at the universe level among them (Tasks 5, 8 and 11)
  - the chart's work off an answer in chunks of 120 ids, one to a `setTimeout(0)`, each at most 4 ms, and only while the map is asking (Tasks 8 and 11)
  - the nav map's own render with some 170 marks at 2 ms (placement) and 4 ms (the whole chart) in Node (Task 9)
  - the chart's sector builds last in the worker queue, and only while the `expanse` pool is idle (Task 8; finding 19)
  - no sector made on the main thread (Tasks 5 and 8)
  - no 150 s simulation for a far pick (Task 6)

## Self-review

- **Types:**
  - `ChartRow` is defined in Task 3. It is made by `chartRow` in Tasks 3, 5, 8 and 10. It is read by `generatedMarks`, `levelsOf`, `capGenerated` and `navList`'s `moreOf`, `groupsOf` and `pickedOf`, and searched as `findDestinations`' `more` (Task 10).
  - `Mark` is lane 6a's. `generatedMarks` and `liveMarks` make it, and `mergeMarks` joins it. `pinned: true` is set by `generatedMarks(rows, { pinned })` (Task 3), from `useCharted`'s `rim` (Task 10), and read by `NavChart`'s `pin` (Task 9).
  - `chartQuery`'s `{ focus, range, level, search, key }` is what `rows(q)` takes (Task 8) and `nextAsk` returns (Task 3). `useCharted` passes `search` (Task 10).
  - `rows(q)` returns `{ rows, known, rim, left }` in Task 8, and `useCharted` reads the same four in Task 10, letting go of anything without `rows` and `known` arrays and reading a `rim` that isn't an array as `[]`.
  - `CHARTED` is defined in Task 3 (all eleven keys pinned) and read in Tasks 5, 8 and 10. `KNOWN` is defined in Task 2 and read in Tasks 5 (its test) and 8.
  - `createStore`'s `tables` and `universeStore()` are defined in Task 2, and `universeStore()` is the scene's `store` in Task 8.
  - `markPriority` is defined in Task 3 and read by `generatedMarks`, Task 5's kinds test and Task 8's order of the known. `generated: true` on a Mark is set in Task 3 and read by Task 9's `yields`.
  - `placeMarks`' `pin` and `yields`, and `Placed.under`, are defined in Task 9 and used by `NavChart` there (`data-under`).
  - `markFor(id, { merged, rowOf })` is defined in Task 10's `navList.js` and called by `NavMap.jsx` there.
  - `debug.hold`, `debug.know`, `debug.cap`, `debug.settleMs` and `debug.known` are defined in Task 8 and used by Task 10's and Task 11's browser checks.
  - `chartOf` and `SPARE_CHARTS` are defined in Task 5 and used in Task 8's `named` (through the row's chart), its light rows, its test's rock and rogue, and Task 5's kinds test.
  - `heard(e)` reads lane 3's `{ type: 'place', what: 'arrive', id }`. `named(ids)` is called by `scenePlaces` (Task 8).
  - `Where` gains `pilots[].y` and `traffic` in Task 7, which `liveMarks` reads in Task 4. `createWhere`'s `label` is `fightLabel` in `scene.js`.
  - `traffic.chart`'s `{ id, kind, x, y, z }` is the same in Tasks 4 and 7.
  - `systemIdOf` (a station's system too) and `knowable(dest, chart)` are defined in Task 2 and used in Task 8.
  - `toSystem`'s `{ id, name, at, reach, span }` is made in Task 1 and read in Tasks 10 and 11. It reaches a sector that isn't round the ship by teleporting there first, which Task 10's check 5b needs.
- **Review Focus lines and their tests:**
  - the hand-made core under the generated places: Task 3 (the band), Task 9 (`yields`, the home spawn's open view) and Task 10 (the browser, held and let in)
  - a known place far off: Task 8 (in range, or every known sector while searching; its own asks, one after another with the clock standing still; the pick kept in lane 3's four) and Task 10 (`pickedOf`, `timesFor`, `markFor`, `useCharted`'s search and a null answer, the browser's far search)
  - a crowded neighbourhood and the shared workers: Tasks 3, 5 and 8 (the whole answer's cap, a view asked again resolving nothing, no ask while the pool is busy, the work stopping once the map stops asking, the answer's and the chunks' times), Task 9 (the render's time), and Tasks 10 and 11 (names, the times in the browser)
  - the table in every browser: Task 2, `tp-store` untouched with an older tab open beside it
  - an old or partial `where()`: Tasks 4 and 7
  - also pinned: a pocket universe (Task 8), the way back and the nearest known places past the chart's reach (Tasks 8 to 10), a station's system (Tasks 2 and 8), the far trip's cost (Task 6)
- **Test times.** The heavy tests build their sectors once in a `beforeAll`, as lanes 3 and 4a's do. `pick.test.js` makes four, about 150 to 500 ms here. `sceneChart.test.js` makes eight, about half a second to a second, and the gargantuans' test makes two more itself. Task 6's timing test runs fifty formulas, not fifty flights. The `useCharted` tests run on fake timers. `sceneChart.test.js`'s `settle` flushes real `setTimeout(0)`s and never moves the clock, at most 400 a test (a full table is about 30).
