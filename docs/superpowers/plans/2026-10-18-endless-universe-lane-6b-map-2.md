# Endless universe, lane 6b: the map, second half. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The nav map shows the endless universe. It draws the generated places and things round the ship by level of zoom, the events going on, the places you've been or seen named, and other pilots, far fights and traffic at their heights. It searches the hand-made, the known and the in-view places, and it sends you to any of them. Long trips are timed by lane 3's formula, never flown in a simulation.

**Architecture:**
- **The scene's side.** These modules run on the main thread and read only the sectors lane 2 already has. They never make one.
  - `universe/charted/pick.js` says which generated places a view of the chart lists, from lane 2's 3 × 3 × 3.
  - `universe/charted/known.js` keeps the places you've visited or seen named. It uses ids only, in a new `rt.store` table, `universe-known`.
  - `universe/charted/sceneChart.js` does four things:
    - it records each arrival and each name shown
    - it names and places what the chart lists through lane 3's resolver
    - it asks the worker pool itself, under a key of its own, for the sector of a known place in the view's range, or of one of the nearest gargantuans, one sector at a time and nearest first. It keeps light rows from it and lets the sector go, so it never enters lane 3's four fetched sectors (finding 16).
    - it answers the nav map's ask, at most `CHARTED.max` rows in all
  - `universe/whereNow.js` is `where()`, moved out of `scene.js` to pay for the wiring. It gains the pilots' heights and the traffic. The far fights' label comes in as a dep, so it stays free of three.js.
- **The page's side** (no generator behind it):
  - `chart/generated.js` turns a destination into a light row and a row into a mark. It also says each kind's levels and when the chart asks again.
  - `chart/navList.js` holds the nav map's list rules: the first pick, a light pick's card, the groups and the cap, the order of the known, which places the camera goes to, and the holder's line.
  - `chart/useCharted.js` asks the scene at most once a second, and again on a real move.
  - `chart/marks.js`'s `liveMarks` reads the heights, the traffic, the events and the way back.
  - `NavChart.jsx` draws them.
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
- lane 6a's plan, and its code on `eu/lane-6a` (`d04e23c3`)
- lane 3's "What later lanes consume" and "For lane 6b in particular"
- lane 4a's and lane 4b's tables and their hand-on to 6b

**Depends on:** lanes 1, 2 (all five PRs), 3 (both groups), 4a, 4b, 5a and 6a merged on the branch. Lane 5b may run beside it, and 4c comes after.

Line numbers are from `main` at `cc5e2eaf`, and for lane 6a's files from `eu/lane-6a` at `d04e23c3`. (`NavMap.jsx`, `chart/NavChart.jsx`, `chart/marks.js` and `navmap.css` are the same there as at `645ebff0`.) Later lanes move them, so find the code again by the quoted text.

## Global Constraints

**Process (HANDOFF-universe's owner's rules and the index's Global Constraints, all of them):**
- Nothing a visitor can do is lost. Every key, save, route, dev hook and test works after as before, and no test is loosened or deleted.
  - One assertion of lane 6a's describes a bound this lane removes: `chart/marks.test.js`'s `liveMarks({ pilots: … }).map((m) => m.levels)` is `[['system', 'neighbourhood']]` (`marks.test.js:83` at `d04e23c3`). Task 4 replaces it with the three levels, and its commit names it (finding 6).
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
- New files stay under 800 lines. `NavMap.jsx` (442 at `d04e23c3`) stays under 800, and so do `Universe.jsx` and `UniverseMap.jsx`.
- **Islands and weight** (lane 3's rule):
  - The generator is reached only through `expanse/shared/space.js`, and only from `charted/pick.js` and `charted/sceneChart.js`, which only the scene imports.
  - `NavMap.jsx`, `chart/*` and `MiniMap.jsx` take ids from `places/ids.js` and nothing from `places/resolve.js`, `places/cards.js` or `charted/{pick,sceneChart}.js`. Lane 3's `places/weight.test.js` pins it (Task 8).
- No `requestAnimationFrame` (the `loops` metric is at its budget), no `onBeforeCompile`, no GLSL, no new dependency.
- **Generated content is never stored.** The `universe-known` table holds ids, how you know each, and when. A known place's name and position are worked out again from its id each visit, and held in memory only.
- `cycles` (5) and `boundary-breaks` don't rise.

**Ids and space:**
- Ids go through Task 0's `src/lib/space/address.js` and lane 3's `places/ids.js` (`canonicalPlace`, `isPlaceId`). The canonical form is the generator's, upper-case `E:`.
- Every position here is in the map's frame, as lane 3's are. That covers the ship, generated rows, pilots (`pilots.js` keeps them under `map`), traffic (`createTraffic(map, …)`, `scene.js:858`), far fights and events.

**Numbers this plan picks (pinned by tests, so they can be tuned):**
- `CHARTED = { max: 120, systems: 0.6, list: 60, every: 1, near: 0.25, retry: 30, giants: 6, keep: 480, queue: 1e6 }`, in `chart/generated.js`:
  - `max`: at most this many generated rows in the scene's whole answer, so at most this many generated marks a view of the chart, and the pick
  - `systems`: the systems' share of `chartPlaces`' rows at the neighbourhood level, the rest the things out between them
  - `list`: at most this many generated rows in the side panel's list
  - `every`: seconds between asks of the scene for the same view
  - `near`: the ask's grid, a fraction of the range, so a small pan asks nothing new
  - `retry`: seconds before a sector that failed to come from the worker is asked for again
  - `giants`: at the universe level, the nearest this many gargantuans past the loaded sectors are fetched and shown
  - `keep`: the light rows the scene keeps by id for the places in view, so a view asked again resolves nothing again
  - `queue`: the worker pool's priority for the chart's own sector asks, after every other (the pool runs the lowest first)
- `KNOWN = { table: 'universe-known', cap: 2000, slack: 100, least: 20, touch: 3600 }`, in `charted/known.js`:
  - `cap` is the spec's "a few thousand". Past it, the `slack` oldest are dropped together, so the table isn't written one row at a time.
  - `least`: the lowest chart priority a lattice thing or list row needs to be known by name alone. A passing rock isn't worth knowing.
  - `touch`: seconds after which a visit again moves a place's time up.
- The store's database version is 2 (from 1). `TABLES` gains `'universe-known'`.
- **The chart's ask, timed** (each a median, warm, and the task fails above it):
  - `chartPlaces` over the 27 sectors round `E:1,0`: 2 ms at the neighbourhood level (range 250,000) and at the system level (7,000), in Node (Task 5)
  - the scene's `rows(q)` for a neighbourhood asked again after `CHARTED.every`: 2 ms in Node (Task 8)
  - `rows(q)` in the browser at `mid`, from `__universeDebug.charted.ms()`: 4 ms (Task 11)
- Mark priorities: lane 6a's world 60, wonder 50, moon 45, station 40, portal 30 and region 85–90 stay. This lane adds:
  - **Generated places:** a system 55, a station 38, a planet 36, a moon 34, and a thing, list row or legacy wonder 20. A kind's own card `chart.priority` wins (lane 4a; a gargantuan is 80). A visited place gets +2 and a place seen named +1.
  - **Live marks:**
    - an event 48 if `big`, else 36
    - the way back 75
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
- Every new on-screen word goes into `src/components/universe/words.js` first. This lane adds one, `CHART_WORDS.holder`. It reuses lane 3's `PLACE` (`plotting`, `facts.held`, `held`), lane 4a's `THINGS.note.cameFrom` and lane 4b's `EVENT.name`.
- British spelling, sentence case, curly quotes, no Oxford comma, no retired word.
- "The nav map's stylesheet is words only; its pilots' colour and ambers are the owner's call." New rules reuse the nav map's colours:
  - traffic and the way back in its blue, `#9fd8ff`
  - events in the front's amber, `#ffb347`

  No existing part is restyled, and no `z-index` is used.

**Browser checks:**
- Headless Chromium draws in software here at a frame or two a second. A task's `universe-check` and `universe-endless-check` run at `--quality mid` only, on the steps it changes. Task 12 runs the full all-tier measure once.
- `navmap-check` has no tier flag: it loads `?quality=low` (`navmap-check.mjs:24` at `d04e23c3`), so its runs here are at `low` whatever the task.
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
- Every wait is on a condition, never a sleep. A wait for game time reads the scene's own clock (`__universeDebug.state.clock`). Each such wait is capped at 30 s of the scene's clock and 120 s of the wall's.

## Review Focus

1. **A known place far off, picked from the list or searched.** Its sector isn't round the ship. The card shows its name and type and "Plotting a course…" while lane 3's `find` fetches it, its times read "—", and it never throws or shows a blank card. The jump waits for the sector (lane 3) and goes. A known id that turns out to be nothing is let go. The chart's own fetches never push the picked place's sector out of lane 3's four. Pinned in Task 8 (only the known in range are fetched, through the chart's own pool asks, a sector at a time, nearest first, retried later; lane 3's `fetch` is never called, and a place picked and fetched through it is still found after the chart has fetched four more), Task 10's `navList.test.js` (a light pick's card and its times) and Task 10's browser check (search and jump to a known system).
2. **A crowded neighbourhood.** There are about 7,400 systems in the 3 × 3 × 3 and thousands of things, and up to 2,000 known places. The chart draws at most 120 generated marks and the pick, and the list at most 60. The scene is asked at most once a second and on a real move, and its answer is timed. No sector is made on the main thread to answer, and the names never turn to mush. Pinned in Task 3 (`capGenerated`, `nextAsk`), Task 5 (`chartPlaces`' share, and its time), Task 8 (the whole answer capped at `CHARTED.max` with `KNOWN.cap` known systems in range, gargantuans then priority then recency; a view asked again resolves nothing; the scene never builds; its time) and Task 11 (the time in the browser). Task 10 checks the names in the browser (no two meet).
3. **The table in every kind of browser.** These must all work:
   - a returning visitor's version-1 database, upgraded with nothing lost
   - no IndexedDB at all (memory, and never mirrored into `localStorage`)
   - a broken row
   - a table at its cap
   - adds made before the table has been read

   One case is a known cost, not a bug: a tab of the older build that is already open when this build opens version 2 gets `versionchange`, and `openDb` closes it (`store.js:34`). Until it reloads, that tab's minecraft and `/worlds` writes return false and are lost. It's the first time the store's version moves. Task 2 pins it, its commit says it, and the hand-off puts it to the owner (finding 2).

   Pinned in Task 2.
4. **A pocket universe** (`/universe?seed=marble`). Its ids name other places than the shared universe's, so nothing is recorded or shown from the table there. Its own sectors still list. Pinned in Task 8.
5. **A `where()` from an older pilot, or one missing a field.** A pilot with no `y`, an event with no name, a `NaN`, or a `where()` without lanes 4a's and 4b's fields: each draws nothing `NaN` and throws nothing. A height missing sits level with the ship. Pinned in Task 4 and Task 7.

Also pinned, beside these:
- a far hand-made trip no longer simulated, so the side panel doesn't spend 90–180 ms every two seconds on it (Task 6)
- every one of lane 4a's 32 kinds listed at the system level and carded with its chart (Task 5)
- the phone's chart bar and side panel still fit with whose space it is shown (Task 10)

## Files

| File | Responsibility | Task |
|---|---|---|
| `scripts/navmap-check.mjs` | the `endless` mode: shots (1), then its checks (10) | 1, 10 |
| `docs/superpowers/evidence/endless-universe-lane-6b/` (new) | README, before and after, HANDOFF-NOTES | 1, 12 |
| `src/runtime/store.js`, `store.test.js` | the `universe-known` table; version 2 | 2 |
| `src/components/universe/charted/known.js` (new) | the places you know: ids, how, when; cap; the system of a place | 2 |
| `src/components/universe/chart/generated.js` (new) | `CHARTED`; light rows; marks and levels; when to ask; list caps | 3 |
| `src/components/universe/chart/marks.js` | `liveMarks`: heights, traffic, events, the way back | 4 |
| `src/components/universe/charted/pick.js` (new) | which generated places a view lists, from the sectors at hand; a place's chart from its card | 5 |
| `src/components/universe/nav.js` | `tripTime`: a long trip by the formula, straight off | 6 |
| `src/components/universe/whereNow.js` (new) | `where()`, moved out of `scene.js` | 7 |
| `src/components/universe/online/pilots.js`, `pilotsNodes.js` | a pilot's height on the chart | 7 |
| `src/components/universe/traffic.js` | `chart`: each group's lead | 7 |
| `src/components/universe/charted/sceneChart.js` (new) | records, resolves, fetches through its own pool asks, and answers, capped | 8 |
| `src/components/universe/places/scenePlaces.js` (lane 3's) | the optional `named(ids)` dep | 8 |
| `src/components/universe/scene.js` | wiring only, smaller after | 7, 8 |
| `src/components/universe/UniverseMap.jsx`, `src/pages/Universe.jsx` | the handle's `chart`; NavMap's `chart` and `place` | 8, 10 |
| `src/components/universe/places/weight.test.js` (lane 3's) | `NavMap.jsx` reaches no generator | 8 |
| `src/components/universe/chart/NavChart.jsx`, `navmap.css` | traffic, events, the way back | 9 |
| `src/components/universe/chart/navList.js` (new), `navList.test.js` | the nav map's list rules: first pick, a light pick, groups and cap, the known's order, the camera's places, the holder's line | 10 |
| `src/components/universe/chart/useCharted.js` (new), `useCharted.test.js` | the nav map's asks and answers | 10 |
| `src/components/universe/NavMap.jsx`, `words.js` | wiring: lists, searches, picks and times generated places; whose space, in the status | 10 |
| `scripts/universe-endless-check.mjs` | the `map: ok` column (lane 6a's per-step call kept); the `map` step | 8, 11 |

---

## PR 6b.1: The pure half

### Task 1: The before shots, and the nav map check's `endless` mode

The nav map's picture out among the generated places, taken before any code of this lane. Lane 6a's after shots are this lane's before for the hand-made views.

**Files:**
- Modify: `scripts/navmap-check.mjs`:
  - `MODES` (`:20`) gains `'endless'`, and the header's usage line names it
  - a new `if (run('endless')) { … }` block after `far`'s (`:315` at `d04e23c3`)
- Modify: `scripts/lib/navmap.mjs` (lane 6a's, beside `shipOnChart`): `toSystem`
- Create: `docs/superpowers/evidence/endless-universe-lane-6b/README.md` and `before/*.jpg`

**Interfaces:**
- Consumes:
  - the check's own `open(viewport, ship)`, `shot(page, name, el)`, `painted`, `navOpen`, `check` and `state`
  - lane 2's `__universeDebug.teleport(x, y, z, heading, pitch)`
  - lane 3's `__universeDebug.places.resolve(id)`
- Produces:
  - **`toSystem(page, id, { inside = false } = {}) → { id, name, at, reach, span }`**, in `scripts/lib/navmap.mjs`, so Task 11's endless check uses the same one.
    - It first waits (a `waitForFunction` polling every 500 ms, 60 s at most) until `__universeDebug.places.resolve(id)` is non-null: the sector may still be coming round the ship.
    - It returns only those five fields. A Destination's rows carry `bigint` seeds, which `page.evaluate` can't hand back. `span` is the system's reach (lane 3's card: `span: row.reach`); `reach` is the star's, `star.size × 2`.
    - It teleports to `[at[0], at[1], at[2] + span + 1500]`, as lane 3's `travel` step parks outside a system's zone, heading 0 (facing −z, the star) and pitch 0. With `inside`, to `[at[0], at[1], at[2] + span / 2]`, in the system's zone, where lane 4b's holder is that system's.
    - It waits until `__universe().ship` is within 50 of there.
  - **The `endless` mode.** With the falcon, `toSystem(page, 'E:1,0:0')`, then the nav map opened with `m`, and the shots:
    - `20-endless-system`: the wheel turned in over the chart's middle until `.navmap-chart[data-level="system"]`, twelve turns at most
    - `21-endless-neighbourhood`: `-` pressed until `neighbourhood`
    - `22-endless-universe`: `-` pressed until `universe`
    - `24-endless-phone`: a 390 × 844 context with `hasTouch`, the same teleport and the map opened on its list. If there is a "Star systems" `.navmap-group`, it is scrolled into view.
  - Shot 23 is Task 10's, the search.

- [ ] **Step 1: Start the dev server on the branch as it stands** (Global Constraints, "The dev server").
- [ ] **Step 2: Add `toSystem` and the `endless` mode,** shots only, every wait on a condition.
- [ ] **Step 3: Take the before shots.**
  - Run `OUT=docs/superpowers/evidence/endless-universe-lane-6b/before CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs endless`, then the same with `desktop` and with `far`.
  - Expected: the shots are written. In `20`–`22`, no generated place is on the chart, only the hand-made ones far off and the ship. Write down any check that fails as it stands.
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
  - `:15`: `TABLES` gains `'universe-known'`
  - `:42`: `createStore`'s default `version` becomes `2`
  - the header (`:1-13`) says why there's a fourth table and why it isn't mirrored
- Modify: `src/runtime/store.test.js`: the import gains `TABLES`, and there's a new `describe`
- Create: `src/components/universe/charted/known.js`, `src/components/universe/charted/known.test.js`

**Interfaces:**
- Consumes:
  - the store's `{ ready, get, set, remove, list }`
  - lane 3's `canonicalPlace` (`places/ids.js`)
  - Task 0's `parseSpaceId` and `spaceId`
- Produces:
  - **The `universe-known` table** in `rt.store` (`worldStore()`, `runtime/local.js:25`, which `runtime/index.js:100` hands the runtime).
    - Its key is a canonical place id. Its value is `{ how: 'named' | 'visited', t }`, with `t` in wall seconds.
    - An older database opened at version 2 gets the table from `openDb`'s `onupgradeneeded` loop (`store.js:29-31`), which already makes any table that's missing.
    - It is never mirrored (`MIRRORED`, `:16`, is unchanged). In memory mode, `mirror` rewrites the whole key index on every write (`:56-66`), and a few thousand ids would make that a quadratic cost. A private window keeps its known places for the visit only.
  - **`KNOWN`**, as in Global Constraints. **`HOW = ['named', 'visited']`**, in rising order.
  - **`systemIdOf(id) → string | null`:** the canonical id of the system of a system, planet or moon id (`spaceId(cube, system)`). It is null for a wonder or thing id and for a non-place.
  - **`knowable(dest, chart = null) → boolean`:** whether a place seen only by name is worth keeping.
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
describe('the universe-known table', () => {
  it('is a table of its own, in a fresh database and in memory', async () => {
    expect(TABLES).toContain('universe-known');
    for (const s of [createStore({ indexedDB: new IDBFactory() }), createStore({ indexedDB: undefined })]) {
      await s.ready;
      expect(await s.set('universe-known', 'E:1,0:3', { how: 'visited', t: 5 })).toBe(true);
      expect(await s.get('universe-known', 'E:1,0:3')).toEqual({ how: 'visited', t: 5 });
    }
  });
  it('comes to a returning visitor’s older database with nothing lost', async () => {
    const idb = new IDBFactory();
    await new Promise((ok, fail) => {
      const req = idb.open('tp-store', 1);
      req.onupgradeneeded = () => ['saves', 'worlds', 'blobs'].forEach((t) => req.result.createObjectStore(t));
      req.onsuccess = () => {
        const tx = req.result.transaction('saves', 'readwrite');
        tx.objectStore('saves').put({ seed: 7 }, 'minecraft:7');
        tx.oncomplete = () => (req.result.close(), ok());
      };
      req.onerror = () => fail(req.error);
    });
    const s = createStore({ indexedDB: idb });
    expect(await s.ready).toBe('idb');
    expect(await s.get('saves', 'minecraft:7')).toEqual({ seed: 7 });
    expect(await s.set('universe-known', 'E:2,0:1', { how: 'named', t: 1 })).toBe(true);
  });
  it('is never mirrored to the small keys', async () => {
    const f = fakeSaves();
    const s = createStore({ indexedDB: undefined, fallback: f });
    await s.ready;
    await s.set('universe-known', 'E:1,0:3', { how: 'visited', t: 5 });
    expect([...f.m.keys()].some((k) => k.includes('universe-known') || k.includes('E:1,0:3'))).toBe(false);
  });
  // (a known cost, put to the owner: the first time the store's version moves)
  it('closes an older build’s tab already open, whose writes then fail till it reloads', async () => {
    const idb = new IDBFactory();
    const old = createStore({ indexedDB: idb, version: 1 });
    expect(await old.ready).toBe('idb');
    expect(await old.set('saves', 'minecraft:7', { seed: 7 })).toBe(true);
    const now = createStore({ indexedDB: idb });
    expect(await now.ready).toBe('idb');
    expect(await old.set('saves', 'minecraft:7', { seed: 8 })).toBe(false);
    expect(await now.get('saves', 'minecraft:7')).toEqual({ seed: 7 });
  });
});
```

  `known.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createStore } from '../../../runtime/store';
import { KNOWN, createKnown, knowable, systemIdOf } from './known';

const fresh = () => createStore({ indexedDB: new IDBFactory() });
const keys = async (store) => (await store.list(KNOWN.table)).map(([k]) => k).sort();

describe('the places you know', () => {
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
  it('knows a planet’s or a moon’s system, and what is worth knowing by name alone', () => {
    expect(['E:1,0:3:2:1', 'e:1,0:3:2', 'E:1,0:3', 'E:1,0:w64', 'marvel'].map(systemIdOf)).toEqual(['E:1,0:3', 'E:1,0:3', 'E:1,0:3', null, null]);
    expect(knowable({ place: 'system' })).toBe(true);
    expect(knowable({ place: 'thing' })).toBe(false);
    expect(knowable({ place: 'thing' }, { shape: 'dot', priority: 20 })).toBe(true);
    expect(knowable({ place: 'extra' }, { shape: 'dot', priority: 10 })).toBe(false);
    expect(knowable(null)).toBe(false);
  });
});
```

  `e:1,0:7` is a place, but not in the canonical form, so it's a broken row: rows are written canonical.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/runtime/store.test.js src/components/universe/charted/known.test.js`. Expected: the new `describe` in `store.test.js` FAILS, and `known.test.js` FAILS (module not found).
- [ ] **Step 3: Implement** the table and `known.js`. The module's header says three things:
  - It keeps ids, never what's at them (spec G, "seeds and deltas only").
  - It is spec G's table, built in this lane because the map reads it first (finding 1).
  - Why `slack`: one sweep of a hundred rows, not a write and a remove for every place past the cap.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/runtime src/components/universe/charted src/components/minecraft src/components/worlds`. Expected: PASS. The minecraft and worlds tests share the store and are unchanged.
- [ ] **Step 5: Commit.** `git add src/runtime/store.js src/runtime/store.test.js src/components/universe/charted && git commit -m "The places you've been or seen named, as ids in a table of their own, a few thousand at most"`. The body says that the store's version goes to 2, and what that does to an older build (finding 2): one opened after this build runs in memory, and one already open in another tab is closed and loses its minecraft and `/worlds` writes until it reloads.

---

### Task 3: Generated places as marks, and when the chart asks

**Files:**
- Create: `src/components/universe/chart/generated.js`, `src/components/universe/chart/generated.test.js`

**Interfaces:**
- Consumes:
  - lane 6a's `levelOf` and `CHART` (`chart/projection.js`)
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
  - **`generatedMarks(rows) → Mark[]`**, one a canonical id, the first of a repeat kept. Each is lane 6a's `Mark` shape:

    ```
    { id, kind: row.kind, name, type, at, color, reach, shape: row.chart.shape,
      priority: row.chart.priority + ({ visited: 2, named: 1 }[row.how] ?? 0),
      levels: levelsOf(row), pickable: true }
    ```

  - **`mergeMarks(...lists) → Mark[]`:** the lists in order, with `null` and `undefined` left out and the first of each id kept.
  - **`chartQuery(view) → { focus, range, level, key } | null`**, the scene's ask for a view:
    - `level` is `levelOf(view.range)`.
    - `step = view.range × CHARTED.near`. `focus` is each of the view's snapped to the nearest multiple of `step`, plus 0, so never `-0`.
    - `range = view.range × (1 + CHARTED.near)`, so the snap never leaves the rim short.
    - `key` is `` `${level}|${focus.join(',')}|${Math.round(Math.log2(view.range) * 4)}` ``.
    - It is null for a view with a focus or range that isn't finite.
  - **`nextAsk(last, view, now) → query | null`:** `chartQuery(view)` when `last` is null, its `key` differs, or `now − last.at ≥ CHARTED.every`. Else null. `last` is `{ key, at }`.
  - **`capGenerated(list, n) → list`:** every row without `generated`, and the first `n` with it, in order.
  - **`groupOf(d) → string`:** `'system'` for a `kind` of `'star'`, else `d.kind`. Generated systems go into "Star systems" (lane 3's hand-on).

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { CHARTED, capGenerated, chartQuery, chartRow, generatedMarks, groupOf, levelsOf, mergeMarks, nextAsk } from './generated';

const ALL = ['system', 'neighbourhood', 'universe'];
const dest = (more = {}) => ({ id: 'E:1,0:3', generated: true, place: 'system', kind: 'star', sub: 'G', name: 'Okonkwo', type: 'Yellow star system', about: 'A yellow star…', color: '#ffd27a', reach: 80, at: [120000, 40, -300], cube: [1, 0, 0], sector: 'main', key: 'E:1,0', src: { row: {} }, ...more });

describe('generated places on the chart', () => {
  it('has the numbers the plan picked, to be tuned here', () => {
    expect(CHARTED).toEqual({ max: 120, systems: 0.6, list: 60, every: 1, near: 0.25, retry: 30, giants: 6, keep: 480, queue: 1e6 });
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
    const marks = generatedMarks(rows);
    expect(marks.map((m) => m.id)).toEqual(['E:1,0:3', 'E:1,0:3:0']);
    expect(marks[0]).toMatchObject({ kind: 'star', name: 'Okonkwo', type: 'Yellow star system', shape: 'star', priority: 57, pickable: true, levels: ALL });
    expect(marks[1]).toMatchObject({ shape: 'dot', priority: 36, levels: ['system'] });
    expect(mergeMarks([{ id: 'a', n: 1 }], null, [{ id: 'a', n: 2 }, { id: 'b' }], undefined)).toEqual([{ id: 'a', n: 1 }, { id: 'b' }]);
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
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 6 tests.
- [ ] **Step 5: Commit.** `git commit -m "Generated places as marks on the chart, each at its levels, and asked for once a second or on a real move"`

---

### Task 4: What moves, in 3D: heights, traffic, events and the way back

**Files:**
- Modify: `src/components/universe/chart/marks.js`:
  - `:38-48` (`COLOUR` gains `traffic`, `event` and `came`)
  - `:106-127` (`liveMarks`)
  - the header's `liveMarks` lines (`:26-27`)
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
    const marks = mergeMarks(HAND_MARKS, generatedMarks(rows), liveMarks(now));
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
  - Task 3's `CHARTED`, and in the test `chartRow` and `generatedMarks`
- Produces:
  - **`chartOf(dest) → { shape, priority } | null`:** `THING_CARDS[dest.sub]?.chart ?? null` for a `place` of `'thing'`, `'extra'` or `'wonder'`, else null. Task 8's scene chart passes it to `chartRow`. It lives here because `cards.js` is the generator's side, which the page never imports.
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
import { CHARTED, chartRow, generatedMarks } from '../chart/generated';
import { chartOf, chartPlaces } from './pick';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const no = (id) => parseSpaceId(id);
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
      const chart = chartOf(dest);
      if (kind !== 'system' && kind !== 'station') expect(chart, kind).toEqual(THING_CARDS[kind].chart);
      const row = chartRow(dest, { chart });
      expect(generatedMarks([row])[0], kind).toMatchObject({ id: found.id, pickable: true, shape: row.chart.shape, priority: row.chart.priority });
    }
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
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 5 tests, each under a second. A kind the kinds test fails on is a gap between lane 3's `placesAround` and lane 4a's lists. Fix it at the narrowest place (this module's `system` rule first) and say so in the commit.
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
  - on the line before `const places = createScenePlaces(…)` (+1):

    ```js
    const charted = createSceneChart({ places: () => places, sectors: () => expanse.sectors(), workers: ctx.rt.workers ?? null, universe, shared: universe === UNIVERSE, store: ctx.rt.store ?? null, t: () => state.spaceT });
    ```

    - `places` is a thunk because it is made on the next line.
    - `state` is a thunk because it is declared below (`:1174`).
    - `universe` and `expanse` are lane 3's and lane 2's values, declared above. `UNIVERSE` is imported at `:222`. `ctx.rt.workers` is the pool lane 3's `createScenePlaces` is given.
  - `createScenePlaces`' deps, in place (0):
    - `emit: (e) => emit(e)` becomes `emit: (e) => { charted.heard(e); emit(e); }`
    - the deps gain `named: (ids) => charted.named(ids)`
  - the handle gains `chart: (q) => charted.rows(q),` (+1)
  - `dispose()` gains `charted.dispose();` (+1)
  - the `__universeDebug` object's line (`:5911`) gains `charted: charted.debug,` in place (0)

  That is +4 here. With Task 7's net, `scene.js` ends smaller than it started.
- Modify: `src/components/universe/UniverseMap.jsx`, the handle (`:236-246`): `chart: (q) => view.current?.chart?.(q) ?? null` (+1)
- Modify: `src/pages/Universe.jsx:100`: the `map` ref's stand-in gains `chart: () => null` (in place)
- Modify: lane 3's `src/components/universe/places/weight.test.js`:
  - `GENERATOR` gains `|^src\/components\/universe\/charted\/(pick|sceneChart)\.js$`
  - its `it.each` gains `'src/components/universe/NavMap.jsx'`
- Modify: `scripts/universe-endless-check.mjs` (lane 3's `travel` step: the arrival is known)

**Interfaces:**
- Consumes:
  - Tasks 2, 3 and 5 (`chartPlaces`, `chartOf`)
  - lane 3's `places` (`resolve`, `missing`), its `'place'` events (`what: 'arrive'`) and `resolvePlace` (`places/resolve.js`)
  - lane 2's worker pool name `expanse` and its `'sector'` job (`{ type: 'sector', key, universe, sx, sy, sz }` answered with `{ key, sector }`), and the face's `withMoons` (in the test also `sectorJob`)
  - lane 4a's `gargantuanSectors` (on the face). A gargantuan is its sector's `w3`, as lane 4a's `debug.find` reads it.
  - Task 0's `parseSpaceId`, `sectorAt`, `sectorCentre`, `spaceId` and `SECTOR`
- Produces:
  - **`createSceneChart({ places, sectors, workers = null, universe = UNIVERSE, shared = true, store = null, t = () => 0, clock = () => performance.now() / 1000, giants = CHARTED.giants }) → { ready, heard(e), named(ids), rows(q), debug, dispose() }`:**
    - **`places`** is a thunk for lane 3's scene places, and **`sectors`** a thunk for lane 2's loaded sectors. **`workers`** is the runtime's pool: with none (Node), nothing is fetched. **`universe`** is the scene's.
    - **`shared`** is whether the scene is in the shared universe. With it false (a pocket), there is no table: nothing is read, recorded or shown, and `ready` is resolved. The pocket's own gargantuans still show.
    - **`heard(e)`:** a `{ type: 'place', what: 'arrive', id }` for a place id adds `id` and `systemIdOf(id)` as `'visited'`. Every other event, and a hand-made id, does nothing.
    - **`named(ids)`:** for each id the table doesn't know as well already, `dest = places().resolve(id)`. When `knowable(dest, chartOf(dest))`, it adds `id` and its system as `'named'`.
    - **The light rows.** Two caches by id, in memory only:
      - **The known's:** `chartRow(dest, { chart: chartOf(dest), how })` for each known place found, at hand or fetched, and for each gargantuan fetched (`how` null). Each add keeps one when `dest` was found. It is capped with the table, plus `giants`.
      - **The view's:** the rows of the places `chartPlaces` lists, at most `CHARTED.keep`, the least lately listed dropped first. A row's fields but `at` are the same for its id at any `t`, so a view asked again resolves nothing again: it takes `at` from `chartPlaces` and `how` from the table.
    - **`rows(q) → { rows: ChartRow[], known: ChartRow[] }`**, for `q = { focus, range, level, key }` (Task 3's `chartQuery`):
      - The same `key` within `CHARTED.every` of `clock` gives back the same object.
      - **`rows`**, at most `CHARTED.max` in all (Review Focus 2):
        1. `chartPlaces(sectors(), focus, t(), { level, range })`, each row from the view's cache or resolved by `places().resolve(id)` (never building), with `how` from the table.
        2. Then, only in the room those leave, the known's rows within `range` of `focus` whose `levelsOf` holds `level` and that aren't among them. Gargantuans come first, then the higher mark priority (the chart's plus the `how` bonus), then the newer `t` (a gargantuan you don't know has none, so it comes last), then the id.
      - **`known`** is every one of the known's rows of a known place, newest first. It leaves out the gargantuans you don't know. It is the same array until the cache changes.
      - **Then `want(q)`.** It runs when `rows` works an answer out, not when it gives back the cached one.
        - **At hand.** Known ids not yet cached whose sector is at hand (`!places().missing(id)`) are resolved by `places().resolve(id)`, at most `CHARTED.max` a call. A found one is cached. One not found is no place, and is removed from the table.
        - **In range.** Known ids not yet cached, whose sector isn't at hand and comes within `range` of `focus` (`|sectorCentre − focus| − SECTOR × √3 / 2 ≤ range`). A known place out of range is never fetched: lane 3's "fetch the visited places in view, not the whole list".
        - **Gargantuans,** at the `universe` level only. Each is `spaceId(s, { wonder: 3 })` for an `s` of `gargantuanSectors(universe, sectorAt(...focus), { n: giants })` that isn't at hand, isn't cached and comes within range as above.
        - These are grouped by sector key, and a key that failed less than `CHARTED.retry` ago is skipped. With no ask in flight, it takes the group whose sector's middle is nearest `focus`. It asks the pool itself: `workers.request('expanse', { type: 'sector', key: 'chart|' + key, priority: CHARTED.queue, universe, sx, sy, sz })`.
          - Its key is its own, never lane 3's `place|` or the expanse's.
          - It never calls `places().fetch`. That keeps only the last four sectors fetched, so the chart's asks would push out the one a pick or a trip is waiting on (finding 16).
        - **When it settles**, an answer with a `sector` goes through `withMoons`. Each id of the group is resolved against that sector alone: `resolvePlace(id, { universe, t: t(), sectors: new Map([[key, sector]]), build: false })`.
          - A found one is cached.
          - A known id not found is no place, and is removed from the table. A gargantuan id not found is only dropped.
          - The sector is let go.
        - An answer of null, a rejection or a throw marks the key failed at `clock()`.
        - It makes one ask at a time.
      - A malformed `q` gives `{ rows: [], known }`.
    - **`debug`:**
      - `known()`: the table's list
      - `pending()`: the sector keys `want` would still take, failed ones in their wait left out
      - `asked()`: the key in flight, or null
      - `ms()`: the median time of the last 20 answers worked out, in ms
      - `answers()`: how many answers it has worked out so far
      - `flush()`: the table's flush
    - **`dispose()`:** it cancels the ask in flight (`workers.cancel('expanse', 'chart|' + key)`) and ignores its answer.
  - **`scenePlaces`' `named(ids)`.** It is called from `update`, while tags are shown (not held, flying, with a tags box), with the ids newly in the list handed to `tags.show`: those not in the list before. It is called once a change, and never with an empty list.
  - **The handle's `chart(q)`** is `charted.rows(q)`. **`map.current.chart`** is the page's way to it, null with no scene.

- [ ] **Step 1: Write the failing tests.** In lane 3's `scenePlaces.test.js` (its `make` gains `named`, passed through; Task 13's fake `tags` box):

```js
it('names to `named` the places it newly tags, once each, none while held', () => {
  const named = [];
  const { tick } = make({ named: (ids) => named.push([...ids]) });
  tick({ ...park, speed: 0 });
  expect(named).toHaveLength(1);
  expect(named[0]).toContain(st.id);
  tick({ ...park, speed: 0 });
  tick({ ...park, speed: 0 }, { held: true });
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
import { THING_CARDS } from '../places/cards';
import { CHARTED } from '../chart/generated';
import { chartPlaces } from './pick';
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
const flush = () => new Promise((r) => setTimeout(r, 0));
const s0 = () => loaded.get('E:1,0');
// lane 2's pool, as far as the chart needs it: a far sector as sectorJob
// sends it, a tick later; any other is null, or made on demand with `make`
function fakePool({ fails = false, make = false } = {}) {
  return {
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
function make({ store = createStore({ indexedDB: new IDBFactory() }), shared = true, places = fakePlaces(), workers = fakePool(), giants = 0 } = {}) {
  let now = 0;
  const chart = createSceneChart({ places: () => places, sectors: () => loaded, workers, universe: UNIVERSE, shared, store, t: () => 0, clock: () => now, giants });
  return { chart, places, workers, store, later: (s) => (now += s) };
}
const ask = (focus, level, range) => ({ focus, level, range, key: `${level}|${focus}|${range}` });
// asks, lets the pool answer and moves the clock on, till nothing's waiting
async function settle(chart, q, later) {
  for (let i = 0; i < 40 && (chart.debug.asked() || chart.debug.pending().length || i === 0); i++) {
    chart.rows(q);
    await flush();
    await flush();
    later(CHARTED.every);
  }
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
  it('knows a name it showed you when it’s worth knowing, and not a passing rock', async () => {
    const { chart } = make();
    await chart.ready;
    const s = s0();
    let rock = null; // (a lattice thing its card ranks under KNOWN.least: a rock, as lane 4a ranks them)
    for (let i = 0; i < s.things.count && !rock; i++) if ((THING_CARDS[thingRow(s, i).kind]?.chart?.priority ?? 0) < KNOWN.least) rock = thingRow(s, i);
    expect(rock).not.toBeNull();
    chart.named([s.systems[3].id, rock.id]);
    expect(chart.debug.known().map((k) => k.id)).toEqual([s.systems[3].id]);
  });
  it('lists a view’s places through the scene’s own resolver, systems as stars', () => {
    const { chart } = make();
    const { rows } = chart.rows(ask(mid, 'neighbourhood', 200000));
    expect(rows.map((r) => r.id)).toEqual(chartPlaces(loaded, mid, 0, { level: 'neighbourhood', range: 200000 }).map((r) => r.id));
    for (const r of rows) expect(r.name, r.id).toBe(resolvePlace(r.id, { t: 0, sectors: loaded, build: false }).name);
    expect(rows.filter((r) => r.place === 'system').every((r) => r.chart.shape === 'star')).toBe(true);
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
    const store = createStore({ indexedDB: new IDBFactory() });
    const [a, b] = far.systems;
    const none = `E:5,-3:${far.systems.length}`;
    for (const [id, t] of [[a.id, 1], [b.id, 2], [none, 3]]) await store.set(KNOWN.table, id, { how: 'visited', t });
    const { chart, places, workers, later } = make({ store });
    await chart.ready;
    const there = ask(sectorCentre(5, 0, -3), 'universe', 300000);
    expect(chart.rows(there).rows).toEqual([]);
    expect(workers.request).toHaveBeenCalledTimes(1);
    expect(workers.request.mock.calls[0]).toEqual(['expanse', expect.objectContaining({ type: 'sector', key: 'chart|E:5,-3', priority: CHARTED.queue, sx: 5, sy: 0, sz: -3 })]);
    await workers.request.mock.results[0].value;
    await flush();
    later(CHARTED.every);
    const got = chart.rows(there);
    expect(got.rows.map((r) => [r.id, r.name]).sort()).toEqual([[a.id, a.name], [b.id, b.name]].sort());
    expect(got.known.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
    expect(chart.debug.known().some((k) => k.id === none)).toBe(false);
    expect(workers.request).toHaveBeenCalledTimes(1);
    expect(places.fetch).not.toHaveBeenCalled();
  });
  it('never fetches a known place whose sector is out of the view’s range', async () => {
    const store = createStore({ indexedDB: new IDBFactory() });
    await store.set(KNOWN.table, far.systems[0].id, { how: 'named', t: 1 });
    const { chart, workers, later } = make({ store });
    await chart.ready;
    chart.rows(ask(mid, 'neighbourhood', 200000));
    expect(workers.request).not.toHaveBeenCalled();
    later(CHARTED.every);
    chart.rows(ask(mid, 'universe', 3e6));
    expect(workers.request).toHaveBeenCalledTimes(1);
  });
  it('waits on one ask at a time, and asks again for a sector that failed only later', async () => {
    const store = createStore({ indexedDB: new IDBFactory() });
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
    later(CHARTED.every);
    chart.rows(q);
    expect(workers.request).toHaveBeenCalledTimes(2);
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
    const store = createStore({ indexedDB: new IDBFactory() });
    await store.set(KNOWN.table, 'E:5,-3:0', { how: 'named', t: 1 });
    const bare = make({ store, workers: null });
    await bare.chart.ready;
    expect(bare.chart.rows(ask(mid, 'universe', 3e6)).rows).toEqual([]);
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
    const store = createStore({ indexedDB: new IDBFactory() });
    const others = FAR.slice(1).map((s) => sectorKey(...s)); // (four far sectors of known places)
    let t = 0;
    for (const k of others) for (const s of answers.get(k).sector.systems.slice(0, 2)) await store.set(KNOWN.table, s.id, { how: 'visited', t: ++t });
    const { chart, places, workers, later } = make({ store });
    await chart.ready;
    const pick = far.systems[0].id; // (picked from a link or the search: the nav map's lookup fetched it through lane 3)
    expect((await places.fetch(pick))?.id).toBe(pick);
    await settle(chart, ask(sectorCentre(5, 0, -3), 'universe', 3e6), later);
    expect(workers.request).toHaveBeenCalledTimes(others.length);
    expect(places.fetch).toHaveBeenCalledTimes(1);
    expect(places.resolve(pick)?.id).toBe(pick);
    expect(chart.debug.known()).toHaveLength(others.length * 2);
  });
  it('caps its whole answer with a full table in range: gargantuans first, then the newest', async () => {
    const store = createStore({ indexedDB: undefined }); // (memory: the cap is the point here, not IndexedDB)
    const systems = [...[...loaded.values()].flatMap((s) => s.systems), ...[...answers.values()].flatMap((a) => a.sector.systems)].slice(0, KNOWN.cap);
    expect(systems).toHaveLength(KNOWN.cap);
    for (const [i, s] of systems.entries()) await store.set(KNOWN.table, s.id, { how: 'visited', t: i });
    const { chart, later } = make({ store });
    await chart.ready;
    const q = ask(mid, 'universe', 3.75e6);
    await settle(chart, q, later);
    const { rows, known } = chart.rows(q);
    expect(known).toHaveLength(KNOWN.cap);
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
    await settle(chart, q, later);
    const want = gargantuanSectors(UNIVERSE, [1, 0, 0], { n: 2 }).filter((s) => !loaded.has(sectorKey(...s))).map((s) => spaceId(s, { wonder: 3 }));
    const { rows, known } = chart.rows(q);
    for (const id of want) expect(rows.find((r) => r.id === id), id).toMatchObject({ big: true });
    expect(known).toEqual([]);
    expect(chart.debug.known()).toEqual([]);
  });
  it('keeps no known places in a pocket universe', async () => {
    const store = createStore({ indexedDB: new IDBFactory() });
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

  The `beforeAll` makes eight sectors (the three round the ship and `FAR`'s five), about a second here, once. The five far ones hold enough systems (about 270 a sector) for the cap test's 2,000. If they don't, the cap test's first `expect` says so, and a sixth goes in `FAR`. The gargantuans' test makes its two sectors itself.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/charted src/components/universe/places/scenePlaces.test.js src/components/universe/places/weight.test.js`. Expected:
  - `sceneChart.test.js` FAILS (module not found)
  - the new `scenePlaces` test FAILS
  - `weight.test.js`'s new `NavMap.jsx` case PASSES: `NavMap.jsx` reaches no generator today
- [ ] **Step 3: Implement and wire.**
  - Write `sceneChart.js`, then the `named` dep in `scenePlaces.js`.
  - Wire `scene.js`, `UniverseMap.jsx` and `Universe.jsx` as listed. Count `scene.js`'s lines.
  - `sceneChart.js`'s header says what it never does: make a sector (it reads lane 2's and lane 3's, and asks the pool for the rest), call lane 3's `fetch`, or store a name or a position. It also says why only the known in range are fetched, one sector at a time and nearest first (lane 3's "For lane 6b in particular"), and why the answer is capped whole (Review Focus 2).
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe src/runtime`. Expected: PASS. Then run `node scripts/health.mjs --only boundary-breaks,cycles,big-files`. Expected: as before Task 1.
- [ ] **Step 5: Time the answer against the bound.** In a scratch script (not committed), make the 27 sectors round `E:1,0` once and a scene chart over them, with Step 1's `fakePlaces` resolving from all 27. For each of 20 of `E:1,0`'s systems:
  - ask the neighbourhood round it (range 250,000) once
  - move the clock on by `CHARTED.every`, and time the same ask again

  Expected: the second asks' median is at most 2 ms (Global Constraints). Over it, find where with a profile (`node --cpu-prof`), fix it, and say so in the commit. Don't shorten the list to meet the bound. Write the median into the README under "The chart's ask".
- [ ] **Step 6: Check it in the browser.**
  - Lane 3's `travel` step of `scripts/universe-endless-check.mjs` ends parked at a generated place. Give it two more lines: once it has arrived, it reads `__universeDebug.charted.known()` and `__universeDebug.charted.ms()`.
    - It fails unless the place it arrived at is among the known, as `'visited'`.
    - It prints the time.
  - Run `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-endless-check.mjs --quality mid --only start,travel` (`--only` is lane 3's). Expected: exit 0, no console errors. Write the time into the README.
- [ ] **Step 7: Commit.** `git add src/components/universe/charted src/components/universe/places src/components/universe/scene.js src/components/universe/UniverseMap.jsx src/pages/Universe.jsx scripts/universe-endless-check.mjs docs/superpowers/evidence/endless-universe-lane-6b && git commit -m "The scene keeps the places you've been and seen named, finds the ones in view a sector at a time, and answers the chart, capped"`. The body gives `scene.js`'s count and the answer's median time.

---

### Task 9: The chart draws traffic, events and the way back

**Files:**
- Modify: `src/components/universe/chart/NavChart.jsx` (`d04e23c3`):
  - `:52-53` (`LISTED` gains `'event'` and `'came'`)
  - `:234` (`item()`: an event's label, a point's way back)
  - after `:309` (traffic dots and event rings)
  - the header (`:9-40`)
- Modify: `src/components/universe/navmap.css` (append after `:437`)
- Modify: `src/components/universe/chart/NavChart.test.jsx` (a new `describe`)

**Interfaces:**
- Consumes: Task 4's live marks; Task 3's `generatedMarks` and `chartRow` (in the test).
- Produces, in the SVG and the places list:
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
    - Each rule's comment says whose colour it borrows.

- [ ] **Step 1: Write the failing tests:**

```jsx
describe('what moves, drawn', () => {
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
  it('draws a generated system as the hand-made stars are: a glyph and a place to pick', () => {
    const marks = generatedMarks([chartRow({ id: 'E:1,0:3', place: 'system', kind: 'star', name: 'Okonkwo', type: 'Yellow star system', at: [20000, 0, 0], color: '#ffd27a', reach: 80, cube: [1, 0, 0] })]);
    const html = renderToStaticMarkup(<NavChart view={view} marks={marks} />);
    expect(li(html, 'E:1,0:3')).toContain('data-kind="star"');
    expect(html).toContain('aria-label="Okonkwo, Yellow star system"');
    expect(tags(html, 'navmap-system')).toHaveLength(1);
  });
});
```

  The test file's imports gain `liveMarks` (`./marks`) and `chartRow` and `generatedMarks` (`./generated`).
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/NavChart.test.jsx`. Expected: the new tests FAIL. The last may pass already: lane 6a's chart draws any `star` shape.
- [ ] **Step 3: Implement** the drawing and the rules.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe src/styles/tokens.test.js src/lib/words.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "The nav map's chart draws the traffic, the events going on and the way back"`

---

### Task 10: The nav map lists, searches, picks and times the generated places

**Files:**
- Create: `src/components/universe/chart/navList.js`, `src/components/universe/chart/navList.test.js`. These are the list's rules, out of `NavMap.jsx` so a Node test pins them.
- Create: `src/components/universe/chart/useCharted.js`, `src/components/universe/chart/useCharted.test.js`. The hook is run by hand under a mocked React, as lane 6a's `useChartView.test.js` runs its own.
- Modify: `src/components/universe/NavMap.jsx` (`d04e23c3`), wiring only, each by its quoted line:
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
- Modify: `src/components/universe/words.js` (`CHART_WORDS.holder`)
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
  - lane 6a's `useChartView`'s `show` and `markById`
- Produces:
  - **`` CHART_WORDS.holder = (name) => `${PLACE.facts.held} ${PLACE.held(name)}` ``**: "Held by the Galactic Empire".
  - **`chart/navList.js`**, pure, importing only `../nav`, `../places/ids`, `../words` and `./generated`:
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
  - **`useCharted({ chart, view, ship, clock = () => performance.now() / 1000 }) → { rows, known, marks, more, rowOf }`:**
    - It keeps the scene's last answer, or `{ rows: [], known: [] }` with no `chart`.
    - It asks with `nextAsk(last, viewRef.current, clock())`:
      - in an effect on `[chart, chartQuery(view)?.key]`
      - and on a 250 ms interval while mounted (`setInterval`, never `requestAnimationFrame`). The interval reads the view through `viewRef`, set on every render, so it never asks for a view it had before.
    - `last` is a ref of `{ key, at }`.
    - A new answer is kept only when its `rows` or `known` array is another one.
    - `marks` is `generatedMarks(rows)`, `more` is `moreOf(rows, known, ship)` (the ship as the answer came), and both are memoised on the answer.
    - `rowOf(id)` is the light row of `canonicalPlace(id)` from `rows` or `known`, or null.
  - **`NavMap({ …, chart = null, place = null })`**, wiring over those:
    - **The lookups:**
      - `look = useMemo(() => (place ? { place } : {}), [place])`, the scene's lookup, for anything that parks or times
      - `near = { place: rowOf }`, the light rows, for a distance
      - `dest(id) = destinationById(id, look) ?? rowOf(id)`
    - **The first pick** (`:60`) is `firstPick(selected, { look, now })`.
    - **`picked`** is `pickedOf(pick, { look, rowOf })`.
    - **The list and the search:** `listOf(kind, query, { more, place })`. The groups (`:216-218`) are `groupsOf(list)`.
    - **The marks:**
      - `mergeMarks(HAND_MARKS, marks, liveMarks(now), pickMark)`
      - `pickMark` is `generatedMarks([chartRow(picked)])[0]` for a generated `picked` not among them, so the pick is kept on the chart (lane 6a's `keep`)
      - `dim` covers every pickable mark not in `shown`
    - **A list or search pick** calls `show(markFor(d.via ?? d.id))`, in place of `show(markById(…))` (`:235`, `:314`). `markFor(id)` is `markById(id) ?? merged.find((m) => m.id === canonicalPlace(id)) ?? null`, where `merged` is the marks above.
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
import { CHARTED, chartRow } from './generated';
import { cameraGoes, firstPick, groupsOf, holderLine, listOf, moreOf, pickedOf, timesFor } from './navList';

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
  it('says whose space the ship is in, or nothing', () => {
    expect(holderLine({ id: 'empire', name: 'The Galactic Empire', side: 'starwars' })).toBe(`${PLACE.facts.held} the Galactic Empire`);
    expect(holderLine({ id: 'empire', name: 'The Galactic Empire' })).toBe(CHART_WORDS.holder('The Galactic Empire'));
    for (const none of [null, undefined, {}, { name: 7 }]) expect(holderLine(none)).toBeNull();
  });
});
```

  `useCharted.test.js` copies the mocked React and the `run(opts)` loop of lane 6a's `useChartView.test.js` (`:10-46` and its `run`, at `d04e23c3`). It adds `useMemo` as `useCallback`'s twin that keeps `fn()`'s value. It needs no box. Its `beforeEach` sets `H.hooks = []`, `now = 0` and `vi.useFakeTimers()`. Its `afterEach` runs each hook slot's `undo` and `vi.useRealTimers()`. Then:

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
    expect([out.rows, out.known, out.marks, out.more]).toEqual([[], [], [], []]);
  });
});
```

  Its imports are `vitest`'s, `chartQuery`, `chartRow` and `CHARTED` (`./generated`), and `useCharted as charted` (`./useCharted`), named as lane 6a's file names its hook.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/navList.test.js src/components/universe/chart/useCharted.test.js`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** `navList.js`, `useCharted.js` and `CHART_WORDS.holder`. Run the same command. Expected: PASS, 12 tests.
- [ ] **Step 4: Write the failing browser checks,** in the `endless` mode, after Task 1's shots. Each is a `check(…)` waiting on a condition, with the file's `namesClash` and `pickByName`. Let `sys` be `toSystem(page, 'E:1,0:0')`'s answer. (`navmap-check` runs at `low`, Global Constraints.)
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
     - Wait until `__universe().place` is its id (180 s of the wall's clock at most).
  5. **It's known now.**
     - Open the map again and press `-` until `data-level="universe"`: that system's `li` is there.
     - Type its name into the search: its button shows.
     - Shoot `22-endless-universe` again as the after.
  6. **The phone, with whose space it is.** For each of 390 × 844 and 360 × 640, with `hasTouch`:
     - `toSystem(page, 'E:1,0:0', { inside: true })`, and open the map.
     - Wait (60 s at most) until `.navmap-holder` reads `/^Held by /`.
     - On its chart (`.navmap-modes` button two): `.navmap-bar`'s box is inside `.navmap-frame`'s, and `.navmap-side`'s box is inside the frame and at least 100 px tall.
     - On its list: a `.navmap-group` headed "Star systems" lists `sys.name`, and `.navmap-side` scrolls (`scrollHeight > clientHeight`, or every row is inside its box).
     - Shoot `24-endless-phone` and `25-endless-phone-small`.
  7. No page errors.
- [ ] **Step 5: Run them and see them fail.** Start the dev server. Run `OUT=/tmp/6b CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs endless`. Expected: check 1 FAILS (no generated place on the chart), and check 6's holder never shows.
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
- Consumes: lane 6a's `shipOnChart(page) → { drawn, inside, edge, readout }` and Task 1's `toSystem(page, id)`, both in `scripts/lib/navmap.mjs`.
- Produces:
  - **The ship on the chart at every step.** Lane 6a's Task 11 already calls `shipOnChart(page)` after each step and asserts `drawn && inside`, when the script was there in time. That call stays as it is, and this task doesn't add a second. Only if it isn't there does this task add it, after each step's record.
  - **A `map: ok | FAIL` column** in the printed table, from that same call's answer. This is the index's "the ship marker at every step (6a and 6b)".
  - **A `map` step** (`--only map`, lane 3's flag):
    - `toSystem(page, 'E:1,0:0')`
    - open the nav map
    - wait until `li[data-kind="star"]` are on the chart, and `li[data-id="E:1,0:0"]` at the neighbourhood level
    - check that the readout starts `Sector 1, 0, 0 · `
    - press `-` and `+` in turn, each press waiting (30 s at most) until `__universeDebug.charted.answers()` has grown by one, till it is 20 more than when the step began. Each press changes the ask's key, so each is a new answer.
    - fail when `__universeDebug.charted.ms()` (the median of the last 20) is over 4 ms (Global Constraints), and print it
    - close with Escape

- [ ] **Step 1: Write the check:** the column from lane 6a's call (or the call, if it isn't there), and the `map` step, each failing the run on a miss.
- [ ] **Step 2: Run it.** Run `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-endless-check.mjs --quality mid --only start,old-rim,boundary,system,climb,map`. Expected: exit 0, `map: ok` on every row, no console errors, and the chart's median printed, at most 4 ms. Copy the table into the README.
  - `ms()` times the call itself (`performance.now()` round the work of `rows(q)`), not a frame, so software GL's slow frames aren't in it. A median over 4 ms is the chart's own cost: find it with the browser's profile, fix it, and run the step again. Don't shorten the list to meet the bound.
- [ ] **Step 3: Commit.** `git commit -m "The endless check finds the ship on the nav map at every step, the generated places on it, and times its ask"`

---

### Task 12: The full measure, and the hand-off notes

**Files:**
- Create: `docs/superpowers/evidence/endless-universe-lane-6b/HANDOFF-NOTES.md`
- Modify: `docs/superpowers/evidence/endless-universe-lane-6b/README.md`
- Create: `lab/universe/after-6b/` (the measure's JSON)

- [ ] **Step 1: The scene's numbers, every tier, once.** This lane draws nothing new in 3D, so the calls and triangles must be equal.
  - **The baseline poses,** for each of `low`, `mid`, `high` and `ultra`: `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-check.mjs --quality <tier> --out lab/universe/after-6b/<tier>`.
  - **The endless poses,** in one run a tier (lane 3 found that a shorter list drops the others from `<out>.json`): `… --quality <tier> --poses old-rim,above-core,expanse-system,expanse-station,at-gargantuan,in-field --out lab/universe/after-6b/endless-<tier>`.
  - Expected: calls and triangles equal to `lab/universe/baseline/<tier>.json` and `lab/universe/endless/<tier>.json` at every pose. This lane adds no pose and leaves `lab/universe/endless/` as it is.
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
  - the chart's ask, timed in Node (Tasks 5 and 8) and in the browser (Tasks 8 and 11), each against its bound
  - `scene.js`'s line count at Tasks 7 and 8
  - `boundary-breaks` and `cycles`, before and after
- [ ] **Step 6: The hand-off notes.**
  - **"Landed":** every module above by path, with its interface in one line, and the table, the `endless` mode, and the `map` step and ship marker.
  - **"Left":**
    - **Lane 4c:**
      - the arrival can mark its world visited through `charted.heard`, or the table directly (`createKnown`)
      - its saved position is `tp-universe-where`, in `rt.saves`, apart from this table
      - the mini-map's `ship` prop still waits for it
    - **Retiring the old chart, an owner's call:** `nav.js`'s `chartAt`, `chartRadius`, `onChart`, `viewFor`, `chartHeading` and `chartLabels.js` are read by nothing but their own tests (finding 9).
    - **For the owner:**
      - an ally's diamond on the chart (HANDOFF "Left": `pilots.chart`'s `ally` is passed by nothing yet; its colour is the owner's)
      - events as places to fly to (finding 5)
    - **`rosterWhere.js`** still makes a sector on the main thread (finding 10).
    - **For the owner, a known cost of the store's version 2** (finding 2): a tab of the older build already open when this build opens is closed, and its minecraft and `/worlds` writes are lost until it reloads. Accept it, or say what it should do instead (a notice to reload, say).
    - **Gargantuans past the nearest six** show on the universe level only once known (finding 15).
    - **The phone's readout** is still lane 6a's sector and height alone: whose space it is went in the status, not the readout (finding 17).
    - Any findings from the measure.
- [ ] **Step 7: Run the gates and commit.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, within budget. Then `git add lab/universe/after-6b docs/superpowers/evidence/endless-universe-lane-6b && git commit -m "Lane 6b measured at every tier, the nav map's after shots, and its hand-off notes"`.

---

## What later lanes consume

| Name | From | Used by |
|---|---|---|
| the `universe-known` table (`TABLES`, version 2) | `src/runtime/store.js` | 4c |
| `KNOWN`, `HOW`, `createKnown({ store, clock, cap, slack })` (`ready`, `add`, `how`, `has`, `remove`, `list`, `size`, `flush`), `systemIdOf`, `knowable` | `universe/charted/known.js` | 4c (an arrival's world, visited) |
| `CHARTED` (`max`, `systems`, `list`, `every`, `near`, `retry`, `giants`, `keep`, `queue`), `ChartRow`, `chartRow`, `levelsOf`, `generatedMarks`, `mergeMarks`, `chartQuery`, `nextAsk`, `capGenerated`, `groupOf` | `universe/chart/generated.js` | any later map work |
| `firstPick`, `pickedOf`, `timesFor`, `listOf`, `groupsOf`, `moreOf`, `cameraGoes`, `holderLine` | `universe/chart/navList.js` | any later map work, 4c (`holderLine` for whose space the arrival is in) |
| `useCharted({ chart, view, ship, clock })` → `{ rows, known, marks, more, rowOf }` | `universe/chart/useCharted.js` | any later map work |
| `liveMarks(now)` reading `pilots[].y`, `farFights[].y`, `traffic`, `events`, `cameFrom` | `universe/chart/marks.js` | any later map work |
| `chartPlaces(sectors, focus, t, { level, range, max })`, `chartOf(dest)` | `universe/charted/pick.js` | anything that lists generated places for a view |
| `createSceneChart({ places, sectors, workers, universe, shared, store, t, clock, giants })` (`heard`, `named`, `rows`, `debug`: `known`, `pending`, `asked`, `ms`, `answers`, `flush`; `dispose`); its pool asks under `chart|<sector key>`; `__universeDebug.charted` | `universe/charted/sceneChart.js`, `scene.js` | 4c, the endless check |
| `createWhere(deps)` (with `label` for the far fights) and `Where` | `universe/whereNow.js` | every later lane that adds a key to `where()` adds it here |
| `where().traffic` (`[{ id, kind, x, y, z }]`), `where().pilots[].y`; `traffic.chart`; `pilots.chart[].y` | `whereNow.js`, `traffic.js`, `online/pilots.js` | 4c, any later map work |
| `handle.chart(q)` → `{ rows, known }`; `map.current.chart`; `<NavMap chart place>` | `scene.js`, `UniverseMap.jsx`, `Universe.jsx` | 5b, 4c |
| `scenePlaces`' `named(ids)` dep | lane 3's `places/scenePlaces.js` | anything that wants the names shown |
| `tripTime`'s formula first for a long leg | `nav.js` | everything that times a trip |
| `CHART_WORDS.holder`; `.navmap-holder` in the nav map's status | `words.js`, `NavMap.jsx` | 4c (whose space the arrival is in) |
| the `endless` mode (`toSystem(page, id, { inside })` → `{ id, name, at, reach, span }`); the `map` step, its time bound and the `map: ok` column | `scripts/lib/navmap.mjs`, `scripts/navmap-check.mjs`, `scripts/universe-endless-check.mjs` | every later lane |

## Assumptions about unmerged work

Each of these can be checked once lanes 3, 4a, 4b and 6a have merged. Where one is false, follow the code and keep the behaviour this plan asks for.

1. **Lane 6a merges as `eu/lane-6a` has it at `d04e23c3`, plus its Tasks 10 and 11.**
   - `NavMap.jsx`, `chart/NavChart.jsx` and `chart/marks.js` are as quoted here.
   - `scripts/lib/navmap.mjs`'s `shipOnChart(page) → { drawn, inside, edge, readout }` exists, from its Task 10. It isn't on the branch yet (`scripts/lib/navmap.mjs` is missing at `d04e23c3`).
   - Its Task 11 calls `shipOnChart` after each step of `universe-endless-check.mjs` when the script was there in time. Task 11 here keeps that call, and adds it only if it's missing.
   - `marks.test.js:83` pins the pilots' levels.
   - `useChartView.test.js`'s mocked React (`:10-46`) and `run` are there to copy.
   - `navmap-check.mjs` loads `?quality=low` (`:24`) and its `far` block starts at `:315`.
2. **Lane 3's interfaces are as its plan's "What later lanes consume" gives them:**
   - `places/ids.js`'s `canonicalPlace` and `isPlaceId`
   - `places/resolve.js`'s `resolvePlace(id, { universe, t, sectors, build })`, which with `build: false` reads rows from the sectors it's given. A row whose `kind` a test changed resolves as that kind (Task 5's forced rows).
   - `places/cards.js`'s `THING_CARDS` and `PLACE`. A system's card has `span` (the system's reach) and `reach` (`star.size × 2`).
   - `places/around.js`'s `placesAround` and `AROUND`
   - `scenePlaces`' `resolve`, `fetch` (never rejects, keeps the last four sectors fetched), `missing`, the `'place'` `'arrive'` event, its tags list and `make`'s fake `tags` box in its test, and `__universeDebug.places.resolve`
   - `nav.js`'s `{ place }` option on every destination function, `findDestinations`' `more` (kept in its order), and `tripTime` giving null for a place the lookup doesn't find
   - `places/trip.js`'s `longTrip`
   - the handle's `place`, and `where().place`, `docked` and `t`
   - `__universe().place`
   - `scene.js`'s `const universe` (lane 3's Task 11) and `state.spaceT`; `ctx.rt.workers` handed to `createScenePlaces`
   - `weight.test.js`'s `GENERATOR` and `it.each`
   - the stand-in keys in `Universe.jsx:100`
   - `scripts/universe-endless-check.mjs`'s `--only` (lane 3's Task 11) and its `travel` step
3. **Lane 4a:**
   - every catalogue kind's card in `THING_CARDS` carries `chart: { shape, priority }`
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
   - `__universeDebug.teleport(x, y, z, heading, pitch)` exists
   - `scripts/universe-endless-check.mjs` records a row a step
6. `ctx.rt.store` is `worldStore()` (`runtime/index.js:100`), and is null in Node.
7. No lane before this one has added a table to `runtime/store.js` or raised its version. If one has, the version is that one's plus one.
8. `where()` is still a method of the handle `create()` returns, reading only names declared above the handle (or reassigned: `front`, `holderNow`).

## Findings for the coordinator (spec against code)

1. **The known-places table is lane 4c's in the spec's lanes table,** but the map is its first reader, and wave 3 starts 6b before 4c. This lane builds the table and its recorder. Lane 4c keeps the saved position (`tp-universe-where`) and reads this table if it needs to.
2. **"A `rt.store` table" means a new IndexedDB version.** `createStore`'s object stores are made only on an upgrade (`store.js:29-31`), so the database goes from version 1 to 2. It is the first time the store's version moves.
   - A returning visitor's database upgrades with every row kept (Task 2 pins it).
   - A tab of an older build opened after a newer one gets a `VersionError` and runs in memory, which is the store's documented behaviour.
   - **A tab of the older build already open** when this build opens version 2 gets `versionchange`, and `openDb` closes its database (`db.onversionchange = () => db.close()`, `store.js:34`). From then until it reloads, that tab's `set` returns false (`store.js`'s "a closed database: this write is lost"), so its minecraft and `/worlds` writes are lost. Task 2 pins it. It's for the owner to accept, or to ask for a notice to reload.
   - The minecraft world and `/worlds` share the database, and their tests are unchanged.
3. **"Ids only" against drawing and searching them.** An id names a place, but its name and position need its sector made, 45 to 130 ms a sector (lane 3). So:
   - Known places in the sectors at hand are found at once.
   - Known places elsewhere come from the worker pool while the nav map is open, and only those whose sector comes within the view's range, one sector at a time, nearest first. They are held in memory for the visit as light rows and never stored.
   - Search covers a known place once its sector has come, which is once a view of the chart has reached it. The universe level reaches 3.75 million.
4. **Lane 3's `tripTime` still flies a far hand-made trip before taking its formula:** 4,500 autopilot steps a drive, about 90 ms here, twice every two seconds in the side panel. Spec F says long trips come "from a formula, not the 150 s simulation". Task 6 takes the formula first.
5. **Events are happenings, not places.** The map draws them by name, as lane 6a drew far fights: a label, not a button. Travel has no event goal (lane 3's `trips.js` takes places, pilots and the front). So "nothing on the map is a place you can't go to" holds, because every place mark is pickable and every pickable mark is a place. Flying to an event would need an event goal in `trips.js`, which is the owner's call.
6. **Pilots at every level.** The spec's table lists other pilots at the neighbourhood level, but "Always honest" draws them "at their sector positions", and lane 6a's hand-on says "everywhere". A pilot 10 sectors off is only in range at the universe level. This changes lane 6a's assertion `marks.test.js:83` from two levels to three, as a replacement, named in Task 4's commit.
7. **`pilotsNodes.js` is the node renderer's twin of `pilots.js`.** It is pinned equal by `pilotsNodes.test.js`, so both get the height.
8. **"Seen named" is the name tags lane 3 shows in flight, plus every arrival.** Names on the nav map don't count: opening the map in a neighbourhood would record a hundred systems at a glance and fill the table in a week. A rock or other lattice thing is known by name only when its card ranks it 20 or more (`KNOWN.least`).
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

## Spec coverage

- **Done item 7, "The map is dynamic"** (with lane 6a, whose part is the centring, the zoom and the projection):
  - "It shows generated places and travels to any of them": Tasks 3, 5, 8, 9 and 10, checked in the browser in Tasks 10 and 11.
  - "The no-3D mini-map uses the same projection and the same data": kept as lane 6a left it (Task 4's run; finding 11).
- **Done item 4, "the map lists it",** lane 3's hand-on: Tasks 5, 8 and 10. Task 5's kinds test pins each of lane 4a's 32 kinds:
  - listed at the system level
  - resolved
  - made a pickable mark carrying its card's `chart`
- **Section F:**
  - **Levels by zoom:**
    - System: the star, planets, moons, stations and traffic (Tasks 4 and 5)
    - Neighbourhood: the 3 × 3 × 3's systems, things, gargantuans, nebulae, fights, events going on and other pilots (Tasks 4 and 5)
    - Universe: the systems you've visited or seen named, and the gargantuans: those in the loaded sectors and the nearest six past them (Tasks 3, 5 and 8; finding 15). Lane 6a draws the core's places, the sector outlines and Home.
  - **"Labels thin out by priority":** this lane's priorities, through lane 6a's declutter, checked in Task 10.
  - **"Generated places are destinations":** picked and travelled to through lane 3's `nav.js` (Task 10).
  - **Search over the hand-made, the visited and named, and the in-view places:** Tasks 3, 8 and 10 (`listOf`).
  - **"Trip times for long trips come from a formula":** Task 6, and Task 10's `timesFor`.
  - **"The jump goes to anything on the map":** Task 10's travel check, by lane 3's travel.
  - **"Always honest":**
    - the ship's marker at every step: lane 6a's call, and Task 11's column
    - other pilots at their sector positions, with heights: Tasks 4 and 7
    - nothing on the map a place you can't go to: Task 4's test; finding 5
    - the phone at 390 × 844, and 360 × 640: Task 10
- **Section G, "What you've visited or seen named":** Task 2's table, filled by Task 8 (finding 1).
- **Section B, "shows on the map,"** for every kind: Task 5's kinds test, and Task 8 from lane 4a's cards.
- **Section C's events:** each of `EVENT.name`'s kinds is named on the chart while it runs (Task 4's test).
- **The spec's counts:**
  - At least 20 kinds of thing (lane 4a's 32, pinned at the system level in Task 5) and 15 kinds of event are lanes 4a's and 4b's. This lane draws every one of them.
  - The density and pacing numbers are lanes 2's and 4b's. This lane changes neither.
- **Done item 9, "Nothing is lost":**
  - every existing test but one is unchanged; `marks.test.js:83` is replaced, not loosened (finding 6)
  - the old database upgrades, and the one cost of it is pinned and put to the owner (Task 2, finding 2)
  - the checks are rerun (Task 12)
- **Done item 10, "Phones still fly":**
  - no new draw call (Task 12)
  - frame time within the before's noise, by three runs each side (Task 12)
  - the chart asked once a second at most, its whole answer capped at 120 rows and the list at 60 (Tasks 3, 5 and 8)
  - the ask timed against its bounds, 2 ms in Node and 4 ms in the browser (Tasks 5, 8 and 11)
  - no sector made on the main thread (Tasks 5 and 8)
  - no 150 s simulation for a far pick (Task 6)

## Self-review

- **Types:**
  - `ChartRow` is defined in Task 3. It is made by `chartRow` in Tasks 3, 5, 8 and 10. It is read by `generatedMarks`, `levelsOf`, `capGenerated` and `navList`'s `moreOf`, `groupsOf` and `pickedOf`, and searched as `findDestinations`' `more` (Task 10).
  - `Mark` is lane 6a's. `generatedMarks` and `liveMarks` make it, and `mergeMarks` joins it.
  - `chartQuery`'s `{ focus, range, level, key }` is what `rows(q)` takes (Task 8) and `nextAsk` returns (Task 3).
  - `rows(q)` returns `{ rows, known }` in Task 8, and `useCharted` reads the same two in Task 10.
  - `CHARTED` is defined in Task 3 (all nine keys pinned) and read in Tasks 5, 8 and 10. `KNOWN` is defined in Task 2 and read in Task 8.
  - `chartOf` is defined in Task 5 and used in Task 8's `named`, its light rows and Task 5's kinds test.
  - `heard(e)` reads lane 3's `{ type: 'place', what: 'arrive', id }`. `named(ids)` is called by `scenePlaces` (Task 8).
  - `Where` gains `pilots[].y` and `traffic` in Task 7, which `liveMarks` reads in Task 4. `createWhere`'s `label` is `fightLabel` in `scene.js`.
  - `traffic.chart`'s `{ id, kind, x, y, z }` is the same in Tasks 4 and 7.
  - `systemIdOf` and `knowable` are defined in Task 2 and used in Task 8.
  - `toSystem`'s `{ id, name, at, reach, span }` is made in Task 1 and read in Tasks 10 and 11.
- **Review Focus lines and their tests:**
  - a known place far off: Task 8 (in range only, its own asks, the pick kept in lane 3's four) and Task 10 (`pickedOf`, `timesFor`, the browser)
  - a crowded neighbourhood: Tasks 3, 5 and 8 (the whole answer's cap, a view asked again resolving nothing), and Tasks 10 and 11 (names, time)
  - the table in every browser: Task 2, the open older tab included
  - a pocket universe: Task 8
  - an old or partial `where()`: Tasks 4 and 7
  - the far trip's cost: Task 6
- **Test times.** The heavy tests build their sectors once in a `beforeAll`, as lanes 3 and 4a's do. `pick.test.js` makes four, about 150 to 500 ms here. `sceneChart.test.js` makes eight, about half a second to a second, and the gargantuans' test makes two more itself. Task 6's timing test runs fifty formulas, not fifty flights. The `useCharted` tests run on fake timers.
