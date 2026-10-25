# Endless universe, lane 4c: The first minute and saves. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new visitor with a ship arrives parked on the day side of one of four fandom worlds, the world filling a good part of the frame, a hand-placed supergiant rising behind it, a column of traffic crossing between, a gentle event coming and one line saying where they are. A returning pilot resumes where they left off, the nav map's Home flies them back to the core, `/universe/<id>` behaves as today, and the no-3D mini-map shows the saved ship. Then the endless check starts at the arrival and runs the spec's whole route once, every tier measured, with the contact sheet put in front of the owner.

**Architecture:**
- **One giant, four worlds.** Lane 4a holds the core to one arrival gargantuan (`ARRIVAL_MAX = 1`). So this lane hand-places one supergiant, Tempest, far out to the west of the core, and picks the four worlds it stands behind when seen from their sunlit side: Marvel's, Travel's, Music's and Harry Potter's. The row goes in lane 4a's `ARRIVAL_GARGANTUANS`. From then on lane 4a draws it, lane 3 cards and parks it and lane 6b charts it.
  - The core's generated content keeps eleven reaches off the four worlds, and off each world's line of sight to the giant (a chain of spheres along it, Task 1). So nothing generated sits near the world or between a park and the giant's disc, 27,650 to 46,240 away. Past the giant, and round the edges of the frame, the view holds what the core generates, as any view does.
- **Pure first** (PR group 4c.1), in a new folder `src/components/universe/arrival/`:
  - `parks.js`: where each arrival park is, for the screen the visitor arrives on, and what the chase camera sees from it. The scene's view is centred in the part of the canvas the panel, the phone's sheet, the thumbs' grid and the site's bar leave open (`flight.js`'s `cover`, `scene.js`'s `measure`). So the park is made for that open part: the world fills its share of it, low in it, whatever the shape.
  - `where.js`: the saved position, `tp-universe-where`, read and written through `rt.saves`. "Start over" (`lib/restart.js`) forgets it with the visit's other keys.
  - `start.js`: where a new ship starts. A link or a pick wins, then the save, then the arrival, then `ship.js`'s `startAt` as the fallback.
  - None of them reaches three.js. `flight.js`, which they take `FOV`, `CHASE` and `cover` from, imported `easeOut` from `lib/three/renderer.js`. Task 2 moves `easeOut` to `lib/ease.js`, and the renderer lends it on.
- **Wired** (PR group 4c.2):
  - `arrival/firstMinute.js` holds the scene's side. It does:
    - the start, and a resume's settle: the pilot's offset from a moving place kept, and a generated body that has moved onto the spot parked off
    - the line, from the first frame the canvas is shown
    - the giant marked as named, once its sector is at hand
    - the crossing, tried again until it flies (no crew yet, or a change of crew that cleared it), and never at a held pose
    - the gentle minute (lane 4b's `events.arrive()`)
    - the saves, on a cadence and as the page goes, and none once the site is starting over
    - the cockpit's portal arrival, which moves out of `scene.js` with it
  - `scene.js` gets wiring only and ends 20 lines shorter. The first minute is made near `:1100`, above the scene's `state` (`:1174`) and its `wall` (`:1766`), so making it calls none of its thunks.
  - The flat map reads the save for its ship, and the nav map gains one press for Home.
- **The route** (PR group 4c.3): `scripts/universe-endless-check.mjs` starts at the arrival, on a desktop and a phone, and gains `resume` (with Start over), `home` and `mini` steps, beside Task 6's `portal`. A pure route table (`scripts/lib/endless-route.mjs`) runs every lane's steps in the spec's order and prints the spec's checklist. The last task measures every tier once and writes the hand-off.
- **Three PR groups on the one branch.** The coordinator merges every lane, so this plan opens no pull request. Its tasks end in commits.
  - 4c.1 (Tasks 1–4): the giant appears on the sky (Task 1). Nothing else on screen changes. "Start over" forgets the saved position, which nothing writes yet.
  - 4c.2 (Tasks 5–9): the arrival, the resume, the mini-map's ship and Home. From Task 6 every fresh page with a ship, and so every `universe-check` pose, starts at the arrival. A held pose ends the crossing, so what a pose measures doesn't hang on how long the page took to draw.
  - 4c.3 (Tasks 10–12): the check, the route, the measure and the hand-off.

**Tech Stack:**
- React 19
- three.js 0.186 (only through lanes 2 and 4a's drawing; this lane adds no material, shader or mesh)
- Vitest (Node; `renderToStaticMarkup` for the components, as lane 6a's tests do)
- the Playwright check scripts under `scripts/`

**Spec:** `docs/superpowers/specs/2026-10-18-endless-universe-design.md`. This lane is:
- section C's "The first minute", whole
- section G, the saved position (the known-places table is lane 6b's Task 2; this lane consumes it)
- done item 8, and the arrival's and the saves' share of done item 9
- lane 6a's hand-on: the mini-map's `ship` from the saved position
- the index plan's "the arrival (4c)" step of the whole-route check, and, as the last lane, the run of the spec's whole checklist and the contact sheet

The index plan is `docs/superpowers/plans/2026-10-18-endless-universe.md`. Every earlier lane's "What later lanes consume" table is this lane's input, lanes 4a, 4b, 5b and 6b's hand-on to 4c above all.

**Depends on:** lanes 1, 2 (all five PRs), 3, 4a, 4b, 5a, 5b, 6a and 6b merged on the branch. This lane is the last. Line numbers are from `main` at `cc5e2eaf`; every lane before this one moves them, so find the code again by the quoted text. Where this plan changes another lane's file, it names the function, and the behaviour it asks for wins over its guess at that file's code.

## Global Constraints

**Process (HANDOFF-universe's owner's rules and the index's Global Constraints, all of them):**
- Nothing a visitor can do is lost. Every key, save, route, dev hook and test works after as before, and no test is loosened.
  - One assertion of lane 4a's describes the empty table this lane is told to fill: `gargantuans.test.js`'s `expect(fullSector(UNIVERSE, 0, 0, 0, { lattice: false }).extras.arrival).toEqual([])` (4a's Task 10). Task 1 replaces it with a test of the row that fills it, and its commit names both.
  - **A second, only if lane 4a's code needs it.** If lane 4a's `things/clear.test.js` holds `extras.arrival` to its generated giants' `GARGANTUAN.far + size` from every baseline pose, Task 1 narrows that one `it` to `extras.gargantuan`. The arrival's row is then held to the bound's purpose (no mesh built at a baseline pose) by Task 2's "never builds the giant at a baseline pose" test, which replaces it. Task 1's commit names the change if it's made, and done item 9's list of replaced assertions carries it.
  - `ship.test.js`'s `STARTS` and `startAt` tests (`ship.test.js:680-790`) stay as they are. `startAt` is the arrival's fallback, unchanged.
  - Every other existing test stays as it is. New tests go in new files, new `describe`s or new `it`s: `restart.test.js` (Task 3), `ease.test.js` (Task 2) and lane 3's `places/weight.test.js` (Tasks 1–4 and 8) each gain new ones beside what they hold.
- **Pure first.** `arrival/{parks,where,start}.js` and `expanse/gen/arrivalGiant.js` reach no React, no DOM and no three.js, directly or through anything they import. `scripts/lib/endless-route.mjs` imports nothing. Each has its Node test before its drawing half.
  - `flight.js` (for `FOV`, `CHASE` and `cover`) reached three.js through `lib/three/renderer.js`'s `easeOut`. Task 2 moves `easeOut` to `lib/ease.js`.
  - A new `describe` in `places/weight.test.js` walks the four files' static imports and finds no `three` and no `react` package (Tasks 1–4).
- **A changed picture is on purpose.** Task 1's Step 0 takes the before at every tier (`high`, `mid` and `low`), before any code of this lane, for the fourteen baseline poses and the endless poses alike.
- **Draw calls and triangles** are no higher than this lane's own before (`before-4c/<tier>` and `before-4c/endless-<tier>`, Task 1's Step 0) at every tier and every pose of both lists, with one named exception. The giant's impostor is the core's second landmark extra, so it adds two triangles at every pose in the core sector or the next one (finding 2). Calls are equal. Say the numbers.
- Before the lane is done: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, and `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`.
- Every commit is one plain sentence in the repo's voice. Its body says why and gives the numbers, and it ends with the attribution lines the session's harness gives. This plan writes the first line only, with no model names.
- The hand-off goes in `docs/superpowers/evidence/endless-universe-lane-4c/HANDOFF-NOTES.md`, not `HANDOFF-universe.md`, which the coordinator folds. Evidence goes in that folder too, each picture under 1 MB (element shots, or JPEG at 80). `lab/universe/*` is ignored but for `baseline/` (`.gitignore:31-35`), so measured JSON is copied into the evidence folder, as lane 5b does.

**Code shape:**
- `src/components/universe/scene.js` doesn't grow. Task 6 adds 7 lines and moves out 27: the spawn block's folded lines, the cockpit's portal arrival and its `takeArrival` import line. Every task that touches it says its `wc -l` before and after.
- New files stay under 800 lines. `NavMap.jsx`, `FlatMap.jsx` and `traffic.js` stay under it.
- **Islands.** The universe reaches the generator only through lane 3's `expanse/shared/space.js`, and the generator reaches the universe only through `universe/shared/space.js`. `boundary-breaks` and `cycles` don't rise: each task's last run step is `node scripts/health.mjs --only boundary-breaks,cycles`, with both numbers equal to Task 1's Step 0.
- **Weight.** `FlatMap.jsx` and `NavMap.jsx` load with pages, so `arrival/where.js` imports only `lib/space/address.js`, lane 3's `places/ids.js`, `layout.js`, `maw.js`, `ship.js` and `runtime/saves.js`, and nothing from the generator, `places/resolve.js` or `places/cards.js`.
  - Lane 3's `places/weight.test.js` holds it with a new `it.each` that walks `arrival/where.js` (Task 3) and `FlatMap.jsx` (Task 8) and finds no `GENERATOR` file.
  - It is a new `it.each`, not two more lines in lane 3's, because that one also asserts that each entry reaches `nav.js`, and `where.js` doesn't.
- No `requestAnimationFrame`, no `onBeforeCompile`, no GLSL, no new dependency, no new asset. `WORLD_MB['/universe']` stays.
- **Generated content is never stored.** `tp-universe-where` holds a sector, a place in it, a heading, an id and a time on the shared clock, nothing more.

**Words and UI (`docs/health/RULES.md`, "UI"):**
- Every new on-screen word goes into `src/components/universe/words.js` first: `ARRIVAL_WORDS` (new) and four keys added to `NAV`.
- British spelling, sentence case, curly quotes, no Oxford comma, no retired word (`src/lib/words.js`'s `RETIRED`: "world", never "fandom").
- The Home button is the house `.btn`, with no new CSS rule. The nav map's stylesheet is words only.

**Numbers the spec pins:**
- **The arrival:**
  - for a new visitor with a ship: no link, no pick and no saved position
  - parked on the day side of one of three or four chosen fandom worlds, near enough that it fills a good part of the frame
  - a gargantuan placed by hand behind it, beyond 20,000, big enough to own the sky
  - traffic crossing between, a gentle event (lane 4b's: never an ambush) and one line naming where they are
- `startAt`'s other starts stay as the arrival's fallback.
- **A returning pilot** resumes where they left off: `tp-universe-where` in `rt.saves`, holding the sector, the position, the heading and the place they were at.
- **The map's Home** takes them back to the core.
- **`/universe/<id>`** behaves as today.
- **The known places** are ids only, a few thousand at most, oldest dropped: lane 6b's table (`KNOWN.cap` 2,000).
- **Gargantuans:** 20 to 200 times a planet's size, world-anchored, an impostor far and a mesh near, with a name, a card and a parking spot. The core holds at most one (lane 4a's rule, and spec C's "at most one a sector").

**Numbers this plan picks (each pinned by a test, so it can be tuned):**
- **The giant,** `ARRIVAL_GIANT`, lane 4a's `giant` form:

  | field | value |
  |---|---|
  | `name` | `'Tempest'` |
  | `at` | `[-50000, -3500, -20000]` (53,965 from home; whole inside the core's cube) |
  | `size`, `body` | 5,000 (92.5 planets across; `nearOf` 19,750, so the mesh is built within 23,700) |
  | `axis` | unit `[0.2, 1, 0.15]` |
  | `light` | `[0.798, 0.301, -0.522]`: the home sun's way turned 55° and lifted, so each park sees a terminator |
  | `colors` | `[hexOf(tint('sun', 0.1)), hexOf(tint('shot', 0.3))]`: amber bands, a red storm |
  | `seed` | `hash64(UNIVERSE, 'arrival')` |
- **The worlds,** `ARRIVAL_WORLDS = ['marvel', 'travel', 'music', 'potter']`. Each is lit by its own star from the park's side (the sun's dot with the park's way out is 0.38 to 0.97), and the giant is 27,650 to 46,240 from each park. The six worlds of the baseline poses are left out, so their pictures don't change.
- **The clearing,** `ARRIVAL_CLEAR = 11`: the core's generated systems, lattice and lists keep eleven reaches off each arrival world. The furthest park sits at 8.9 reaches (a phone held upright, Task 2).
- **The sight,** `ARRIVAL_SIGHT = { from: 0.8, widen: 0.01745, pad: 600 }`. Along each world's line to the giant's middle, from 0.8 of its clearing out, a sphere every half radius, the one `s` out of radius `s × tan(asin(size / D) + widen) + pad` (`D` is the world's distance to the giant). The core's generated systems, lattice and lists keep off them as off the clearings, so nothing generated stands between a park and the giant's disc. That is 22 to 36 spheres a world, 109 in all.
- **The view,** `ARRIVAL_VIEW = { fill: 0.42, low: 0.66, open: 0.5, turn: 0.3491, near: [0.92, 1.08], day: 0.35, lane: { at: 0.2, span: 1.1, lift: 0.5, speed: 6 } }`, and `ARRIVAL_FRAME = { w: 1280, h: 720, rect: cover({ w: 1280, h: 720, top: 76 }) }`, a desktop under the site's bar, for a park made before the scene has measured its canvas and for the `arrival` pose:
  - `fill`: the world's disc is 0.42 of the open part's height
  - `low`: its middle is 0.66 of the way down the open part. The giant's place on screen isn't a number this plan picks. It is where the giant is and the chase camera's 12° tilt. The park is a few hundred units off the world and the giant 28,000 to 46,000 away, so where the ship parks can't move it, and the world is put under it by turning the ship's line to the world down from the giant's (`sep`, worked out per screen: 11.6° to 13.0° on a desktop, 9.5° to 11.0° on a phone held upright).
  - `open`: the least share of the canvas's height a park is made for. A phone held upright with its sheet up leaves 0.54. An open part under half the canvas's height parks as for half, so no park leaves its clearing.
  - `turn` and `near`: each arrival is turned up to 20° round the world-to-giant line and moved 8% nearer or further, so pilots arriving together seldom share a spot
  - `day`: the least dot of the world's sun with the park's way out
  - `lane`: the crossing column flies 0.2 of the way to the world, from just off one side of the open part to just off the other, half the world's radius above its middle. Its speed is at the ship's pace, as every traffic speed is: 6 × `PACE` (0.6), 3.6 units a second. Lane 4b's convoy flies at `3.6 * PACE`, 2.16.
    - At 0.2 the column's ships are 9 to 41 px long on a desktop (a freighter to a corvette) and 6 to 28 px on a phone. It crosses in about 31 s on a desktop (21 s with the panel open) and 14 s on a phone.
    - At 0.45 they would be specks of 4 to 18 px on a desktop, taking 70 s to cross.
- **The saves,** `WHERE = { key: 'tp-universe-where', version: 1, every: 5, moved: 20, settle: 10, air: 1.25, maw: 20, far: 54000, sectors: 8000 }`:
  - a write at most every 5 s of wall clock, and only after 20 units of flight or a change of place
  - a resume by a generated place settled within 10 s of the scene's clock, if the stick hasn't been touched
  - never saved or resumed inside 1.25 radii of a solid, or within the Maw's reach plus 20
  - Home offered past 54,000 from home (`SECTORS.main.edge`)
  - a save's sector at most 8,000 out on each axis: 9.6 × 10^8 units, inside lane 2's pinned 10^9 (its "draws a body 10^9 out within a pixel")
- **The first minute,** `FIRST = { line: 6, cross: 1, crossBy: 20, name: 60 }`:
  - the line shows for 6 s of wall clock from the first frame the canvas is shown (the host's `data-gl` is `'on'`), not from the spawn: in software GL, and on a slow phone, the canvas is held behind the loading veil for seconds to a minute after the scene starts
  - the crossing is asked for 1 s of the scene's clock after the spawn, and never at a held pose. Until it is halfway across, it is asked again whenever none of it flies, up to 20 s: `traffic.cross` had no lane, or a change of crew (`setCrew`, which clears every group) took it away.
  - the giant is marked named as soon as its sector is at hand, tried each frame for up to 60 s of the scene's clock

**Browser checks:**
- Headless Chromium draws in software here at a frame or two a second, and `universe-check` takes 2 to 4 minutes a pose and tier. A task's browser check runs at `--quality mid` only, on the poses or steps it changes. Task 12 runs the full all-tier measure once.
- Every browser command runs with `CHROME=/opt/pw-browsers/chromium CHROMIUM=/opt/pw-browsers/chromium` in front of it (lane 3's plan says why).
- `BASE` below is the fourteen baseline poses, `overview,falcon-sun,middleearth-limb,rickmorty,gaming,caribbean,middleearth,breakingbad,office,belt,maw,landing-middleearth,station,far-rim`. By this lane, `universe-check`'s default `POSES` also holds lanes 1, 2, 3 and 4a's endless poses, so every run names its poses with `--poses`, and no pose is measured twice.
- `universe-check`, `universe-endless-check`, `autopilot-check` and `perf-probe` start their own server. `navmap-check`, `sector-check`, `flyto-check`, `links-check` and `wonders-check` need one first:
  1. Start `npx vite --port 5173 --strictPort` in the background.
  2. Wait until `curl --noproxy '*' -sf -o /dev/null http://localhost:5173/` succeeds, in an until-loop on that condition, giving up after 60 s.
  3. Run the checks, then stop the server.
- Every wait is on a condition, never a sleep. A wait for game time reads the scene's own clock (`__universeDebug.state.clock`) and is capped at 30 s of it and 120 s of wall, whichever comes first. A wait for wall time (the line, a jump) is capped at 120 s.
- **Frame time is noisy here.** Each `perf-probe` measure is three runs, before and after alike. The after passes when, for every phase but `load`, its median p50 is at most the before's median p50 plus the larger of 2% and the before's spread (lane 6b's rule).

## Review Focus

1. **A save that can't be trusted.** An older or hand-edited `tp-universe-where`, or one written in a private window that then failed. That covers junk, a string, `NaN`, a sector 10^8 out or just past 8,000 (where lane 2 pins no drawing), a place in the cube past its walls, an unknown place id, a wrapper with no data, a position inside the Maw's pull or inside a planet's air. Expected:
   - it never throws
   - the ship resumes only where it's safe, else arrives, else takes `startAt`
   - a bad place id is dropped and the position kept

   Pinned in Task 3 (`readWhere`, `clearToResume`, `readSaved` over a broken store) and Task 4 (`startPlan` on each).
2. **A link with a save behind it.** `/universe/marvel` (a pick), `/universe/aurelia` (a wonder), `/universe/E:…` (lane 3, and lane 5b's take-off back) each start where the link says, even with a save. `/universe` alone resumes. Pinned in Task 4 and Task 10's `link` re-run with a save present.
3. **Saving where it shouldn't.** A held pose (`universe-check`), a dive, on foot, a crash, the jump's flash, the Shipyard over the map, a ship in a planet's air or the Maw's pull.
   - None of these writes. The next visit never starts inside an air, which would swap at once to that world's page, or in the Maw.
   - A write an event asks for (a dock, an arrival) skips the 5 s cadence but keeps every one of these guards.
   - A dive into a generated planet writes that planet as the place, with the ship where the dive began (lane 5b's hand-on). That is the one write from `lastShip`, the last ship that passed the guards.
   - A storage event from another tab after the spawn moves nothing.
   - **Start over gives the arrival.** "Start over" (`restartSite`, from the panel, the bar, ⌘K, the footer or the terminal) forgets `tp-universe-where` with the visit's other keys. On the universe page, the reload it makes fires `pagehide`, which would write the save straight back. So `restartSite` says it is starting over (`RESTARTING`, a window event) before it forgets anything, and the first minute writes nothing after hearing it, not as the page goes and not in `dispose`. The next visit is a first visit's arrival.

   Pinned in Task 3 (`restart.test.js`), Task 6 and Task 10's `resume`, round 3.
4. **A first visit on a phone held upright, a desktop with its panel open, and many at once.** The scene's view is centred in the open part, the canvas less the panel down the right side, the phone's sheet or the thumbs' grid over the foot, and the site's bar along the top (`scene.js`'s `measure`, `flight.js`'s `cover`). So every share below is of the open part, never of the bare canvas:
   - The open parts: a desktop at 1280 × 720 under its 76 px bar, with the 400 px panel open (412 px with its margin) and put away; a phone at 390 × 844 under its 68 px bar, with its sheet resting (38svh, 321 px) and, once it has flown, put away with the thumbs' grid over the foot (336 px).
   - The park is made for the open part at the spawn. It is then checked under the other open part of its screen too, since the visitor opens or puts away the panel after arriving.
   - At every extreme of the jitter:
     - the world fills its share of the open part, low in it, its whole disc clear of the panel, the sheet, the buttons and the bar
     - the giant's middle is in the open part above it, and the world doesn't hide it
     - the crossing passes in front of the world, from off one side of the open part to off the other
   - On a phone held upright the giant is bigger than the open part, 0.66 to 1.14 of its height. Its middle sits in the open part's top sixth, its lower limb arches over the world, and its top is past the bar. Its place on screen is the giant's own and the chase camera's tilt, so no park can lower it (finding 22).
   - Two visitors seldom share a spot.

   Pinned in Task 2 (every open part, every extreme, a park made for one seen at the other, the spread), Task 5 (the lane in front of the world on every open part) and Task 10's `start` (one shot at 390 × 844 with touch, the scene's own `state.rect` read against Task 2's).
5. **A returning pilot far out, with 3D off.** The mini-map shows the saved ship pinned to its edge, or none with no save. The nav map offers Home only when the ship can fly (not on foot, not in a crash) and is far. Home always jumps: pressed while the jump charges or is jammed, it waits for it and says so, never falling back to hours of super speed. It leaves the drive the visitor picked as it was. In a pocket universe nothing is read or written. Pinned in Tasks 3, 8 and 9.
6. **A resume by a generated place.** Lane 3's `here()` names the system whenever the ship is in the system's zone and near none of its planets, and that zone reaches out to its park ring, past the planets' bands. So a pilot who saved between the planets has the system as the place. Expected:
   - a place that stays put (a system, a station, a fixed thing) resumes exactly at the saved spot and is never moved
   - a planet or a moon, which has gone on round its orbit, takes the ship with it: the pilot's offset from the body at the save is put back on the body where it is now
   - a generated body that has moved onto the saved spot, which `startPlan` can't see (it knows only the hand-made `SOLIDS`), has the ship parked off it once the body is built
   - none of it once the stick is taken or after 10 s of the scene's clock

   Pinned in Task 3 (`inTheWay`), Task 6 and Task 10's `resume`, at a system and at a planet.
7. **The first minute on a slow first frame, and at a held pose.**
   - The line runs its 6 s from the first frame the visitor can see, so a phone that shows the canvas seconds late still reads it.
   - A held pose (`universe-check`) ends the arrival's crossing and starts none. The poses' calls, triangles and pictures don't hang on how long the page took to draw, and the `arrival` pose is measured without its crossing.

   Pinned in Task 6 (`shown`, `debug.line()`, `state.held`), Task 7 (`crossing: null` at every pose) and Task 10's `start`.

8. **The first minute is made before the scene's clock is.** `createFirstMinute` is made near `:1100`, after lane 4b's events, above `const state` (`:1174`), `emit` (`:1719`) and `const wall` (`:1766`). A thunk called while it's made throws a `ReferenceError` (a `const` in its temporal dead zone), and the universe scene doesn't build.
   - Making it calls none of its thunks. It reads `takeArrival` (lib/arrival.js's), adds its own listeners, and nothing more.
   - The portal's 12 s are stamped on the first `update` or `portalDue` after it. The flow at risk is the cockpit's launch of Rick's cruiser through his portal, whose `tp-arrive-sector` is fresh as the scene is made.

   Pinned in Task 6 (a test whose thunks all throw until it allows them, and the `portal` step in the browser, the key seeded before the page loads).

Also pinned, beside these:
- Rick's cruiser out of the cockpit's portal still comes out in his dimension; the arrival gives way (Task 6, and its `portal` step).
- The giant's mesh is never built at a baseline pose, and the three baseline pictures that show it are named (Task 2).
- Nothing generated sits within eleven reaches of an arrival world (Task 1), and no generated system, planet, thing or list row stands between any park and the giant's disc (Task 2, over the seeded core).
- Every park meets lane 2's density targets: three places within 9,000 and the nearest within 6,000, counted as lane 2's `density.test.js` counts (Task 2). So the route's `start` row, judged on them (Task 11), doesn't fail there hours into Task 12.
- The giant is known by name once the core's sector lands, however late (Task 6).

## Files

| File | Responsibility | Task |
|---|---|---|
| `src/components/expanse/gen/arrivalGiant.js` (new), test | the giant's row, the four worlds, the clearings and the sight | 1 |
| `src/components/expanse/gen/gargantuans.js`, test (lane 4a's) | `ARRIVAL_GARGANTUANS = [ARRIVAL_GIANT]`; the one replaced assertion | 1 |
| `src/components/universe/things/clear.test.js` (lane 4a's), only if it reads `extras.arrival` | its one `it` narrowed to `extras.gargantuan` | 1 |
| `src/components/expanse/gen/space.js` (lanes 2 and 4a's) | `fullSector`'s `clearings` option | 1 |
| `src/components/expanse/shared/space.js`, `shared.test.js` (lane 3's face) | lends the five names | 1 |
| `src/components/universe/places/weight.test.js` (lane 3's) | new: the arrival's pure half reaches no three.js or React; `where.js` and `FlatMap.jsx` reach no generator | 1, 2, 3, 4, 8 |
| `src/lib/ease.js`, `ease.test.js`; `src/lib/three/renderer.js`; `src/components/universe/flight.js` | `easeOut` moved to `lib/ease.js` and lent on by the renderer, so `flight.js` reaches no three.js | 2 |
| `src/components/universe/arrival/parks.js` (new), test | the arrival's parks for the visitor's screen, what the camera sees, the crossing's lane | 2, 5 |
| `src/components/universe/words.js` | `ARRIVAL_WORDS`; `NAV.home`, `NAV.homeTitle`, `NAV.homeWait`, `NAV.homeJammed` | 2 |
| `src/components/universe/arrival/where.js` (new), test | `tp-universe-where`: read, write, check, resume, far from home | 3 |
| `src/lib/restart.js`, `restart.test.js` | "Start over" forgets `tp-universe-where`, and says it is starting over (`RESTARTING`) first | 3 |
| `src/components/universe/arrival/start.js` (new), test | where a new ship starts | 4 |
| `src/components/universe/traffic.js`, `traffic.test.js` (lane 4b's) | `cross(pts, …)`: a column on a given lane; `progress(id)`: how far a group is; `end(id)`: one group ended | 5 |
| `src/components/universe/arrival/firstMinute.js` (new), test | the scene's first minute and saves; the cockpit's portal arrival | 6 |
| `src/components/universe/scene.js` | wiring only, smaller after | 6 |
| `src/components/universe/poses.js`, `poses.test.js`; `scripts/universe-check.mjs` | the `arrival` pose; each pose's `crossing` recorded | 7 |
| `src/components/universe/FlatMap.jsx` (lane 6a's), `FlatMap.test.jsx` (new); `MiniMap.jsx`'s header (lane 6a's) | the saved ship on the flat map | 8 |
| `src/components/universe/chart/home.js` (new), test; `chart/HomeOffer.jsx` (new), test; `NavMap.jsx`; `src/pages/Universe.jsx` (`travel`'s `keep`) | one press for Home, always the jump | 9 |
| `scripts/navmap-check.mjs` | the flat map's ship; Home from far out | 8, 9 |
| `scripts/universe-endless-check.mjs` | the arrival at `start`, and its phone shot; `portal`; `resume` (with Start over), `home`, `mini`; `link` with a save; `--route`; the `page`, `frameMs` and `next` columns; lane 1's `nebula` step if it isn't there | 6, 10, 11 |
| `scripts/lib/endless-route.mjs` (new), test | the spec's route and checklist, as data | 11 |
| a repo check whose own steps assumed where a fresh ship starts, if any | a start seeded in its init script | 12 |
| `docs/superpowers/evidence/endless-universe-lane-4c/` (new) | README, before and after, the contact sheet, HANDOFF-NOTES | 1, 12 |

---

## PR 4c.1: The pure half

### Task 1: The arrival's giant in the core, and room round its worlds

**Files:**
- Create: `src/components/expanse/gen/arrivalGiant.js`, `src/components/expanse/gen/arrivalGiant.test.js`
- Modify: lane 4a's `src/components/expanse/gen/gargantuans.js`: `ARRIVAL_GARGANTUANS = [ARRIVAL_GIANT]`, imported from `./arrivalGiant`. `arrivalGiant.js` imports nothing from `gargantuans.js`, so there's no cycle.
- Modify: lane 4a's `src/components/expanse/gen/gargantuans.test.js`, the one assertion named in Global Constraints
- Modify, only if Step 4 finds it reads `extras.arrival`: lane 4a's `src/components/universe/things/clear.test.js`, its one `it`, as Global Constraints says
- Modify: `src/components/expanse/gen/space.js` (`fullSector`). It gains the option `clearings`, which defaults to `arrivalClearings()` in the shared universe's core sector and `[]` everywhere else, under the same condition as lane 4a's `arrivals`. Every clearing row, a world's and the sight's alike, joins:
  - the spheres appended systems keep out of, by their reach, beside lane 4a's `big`
  - `ctx.keeps`: the lattice by `(THING_NEAR + 1) × size`, the lists by size and extent, through lane 4a's `roomFor`
- Modify: lane 3's `src/components/expanse/shared/space.js` and `shared.test.js`. The face lends `ARRIVAL_GIANT`, `ARRIVAL_WORLDS`, `ARRIVAL_CLEAR`, `ARRIVAL_SIGHT` and `arrivalClearings`, and the test's pinned list gains the five names.
- Modify: lane 3's `src/components/universe/places/weight.test.js`: a `packages(entry)` helper beside its `reach`, and a new `describe` for the arrival's pure half, with `arrivalGiant.js` its first entry (Step 1)
- Create: `docs/superpowers/evidence/endless-universe-lane-4c/README.md`

**Interfaces:**
- Consumes:
  - lane 4a's `checkGargantuan`, `gargantuanKeeps`, `ARRIVAL_BASE`, `GARGANTUAN` (`home`), `PLANET_SIZE` and `CUBE_HALF` (`gen/cube.js`)
  - `universe/shared/space.js`'s `PLACES`, `tint` and lane 4a's `hexOf`
  - `gen/seed.js`'s `hash64` and `UNIVERSE`
  - lane 2's `KEEP_OUTS`, `clearOfKeepOuts` and `fullSector`
  - in `weight.test.js` only: lane 3's `reach` and `scripts/health/graph.mjs`'s `FROM`, `SIDE_EFFECT` and `uncomment`
- Produces:
  - **`ARRIVAL_GIANT`**: the row in Global Constraints' table, with `kind: 'giant'` and `gargantuan: true`, frozen
  - **`ARRIVAL_WORLDS = ['marvel', 'travel', 'music', 'potter']`**, frozen
  - **`ARRIVAL_CLEAR = 11`** and **`ARRIVAL_SIGHT = { from: 0.8, widen: 0.01745, pad: 600 }`**
  - **`arrivalClearings(places = PLACES) → [{ id, at, r }]`**, made once and frozen for the default `places`:
    - first one row a world, in `ARRIVAL_WORLDS`' order: `{ id: 'arrival:<world>', at, r: ARRIVAL_CLEAR × reach }`, `at` and `reach` the world's own
    - then each world's sight, in the same order, each row `{ id: 'arrival:<world>:sight', at, r }`. With `D` the world's distance to the giant's middle, `u` the unit towards it and `θ = asin(ARRIVAL_GIANT.size / D) + ARRIVAL_SIGHT.widen`, the rows are centred at `world + u × s`. The first `s` is `ARRIVAL_SIGHT.from × ARRIVAL_CLEAR × reach`. Each `r = s × tan(θ) + ARRIVAL_SIGHT.pad`, and the next `s` is half that `r` further, while `s < D`.
  - **`fullSector(universe, sx, sy, sz, { …, clearings })`**: lane 4a's, with the option above
  - The core's `E:0,0:w4` is the giant (lane 4a's `arrival` list), so lane 3 resolves, cards and parks it, lane 4a draws it and lane 6b charts it, with no code of this lane's.

- [ ] **Step 0: Take the before, on the branch as it stands, at every tier.** Run these with no code of this lane's in yet, each in the background, waiting on its exit:
  - **The fourteen baseline poses,** one run a tier, for `<tier>` each of `high`, `mid` and `low`: `node scripts/universe-check.mjs --quality <tier> --poses "$BASE" --out lab/universe/before-4c/<tier>`.
  - **The endless poses,** one run a tier, all of them in that one run (lane 3 found that a shorter list drops the others from `<out>.json`):
    - `poses=$(node -e "const b=new Set(process.argv[1].split(','));console.log(Object.keys(require(process.argv[2]).poses).filter((p)=>!b.has(p)).join(','))" "$BASE" ./lab/universe/endless/mid.json)`. Read lane 5b's committed copy (`./docs/superpowers/evidence/endless-universe-lane-5b/endless/mid.json`) when `lab/universe/endless/` is empty in this checkout.
    - then `node scripts/universe-check.mjs --quality <tier> --poses "$poses" --out lab/universe/before-4c/endless-<tier>`, for each tier
  - `node scripts/universe-check.mjs --quality mid --poses station --t 30 --png --out lab/universe/before-4c/t30`: `station` at a held clock, as a lossless PNG (lane 4a's `--t` and `--png`, its Task 18), for Step 5's byte-for-byte compare.
  - **Frame time,** three runs a tier: `OUT=lab/perf/4c-before-<tier>-<n> QUALITY=<tier> node scripts/perf-probe.mjs universe`, for `<tier>` `mid` and `low` and `<n>` 1, 2 and 3.
  - `node scripts/health.mjs --only boundary-breaks,cycles`. Write both numbers down.

  Copy the six universe-check JSONs and the six perf-probe reports into `docs/superpowers/evidence/endless-universe-lane-4c/before/`, keeping their tier in the name. Copy the shots of `falcon-sun`, `belt`, `far-rim` and `station` there too, as JPEG at 80. Start the README with the date, the branch's commit, the commands and these numbers. Task 12 compares its after with these files, tier by tier.
- [ ] **Step 1: Write the failing tests** in `arrivalGiant.test.js`, the core sector made once in a `beforeAll`:

```js
import { beforeAll, describe, expect, it } from 'vitest';
import { spaceId } from '../../../lib/space/address.js';
import { PLACES } from '../../universe/shared/space';
import { clearOfKeepOuts } from './keepOuts';
import { CUBE_HALF } from './cube';
import { PLANET_SIZE } from './catalogue';
import { ARRIVAL_BASE, GARGANTUAN, checkGargantuan, gargantuanKeeps } from './gargantuans';
import { UNIVERSE, universeOf } from './seed';
import { fullSector } from './space';
import { ARRIVAL_CLEAR, ARRIVAL_GIANT, ARRIVAL_SIGHT, ARRIVAL_WORLDS, arrivalClearings } from './arrivalGiant';

const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (a, b = [0, 0, 0]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
let core;
beforeAll(() => {
  core = fullSector(UNIVERSE, 0, 0, 0);
});

describe('the arrival’s giant', () => {
  it('is one hand-placed supergiant the gargantuan rules take', () => {
    expect(checkGargantuan(ARRIVAL_GIANT)).toBe(ARRIVAL_GIANT);
    expect(ARRIVAL_GIANT).toMatchObject({ kind: 'giant', gargantuan: true, name: 'Tempest', at: [-50000, -3500, -20000], size: 5000 });
    expect(ARRIVAL_GIANT.size / PLANET_SIZE).toBeGreaterThanOrEqual(20);
    expect(ARRIVAL_GIANT.size / PLANET_SIZE).toBeLessThanOrEqual(200);
    for (const v of [ARRIVAL_GIANT.axis, ARRIVAL_GIANT.light]) expect(len(v)).toBeCloseTo(1, 9);
    expect(typeof ARRIVAL_GIANT.seed).toBe('bigint');
  });
  it('sits whole inside the core’s cube, clear of every hand-made place, far from home', () => {
    for (let a = 0; a < 3; a++) expect(Math.abs(ARRIVAL_GIANT.at[a]) + ARRIVAL_GIANT.size).toBeLessThanOrEqual(CUBE_HALF);
    for (const k of gargantuanKeeps(ARRIVAL_GIANT)) expect(clearOfKeepOuts(k.at, k.r)).toBe(true);
    expect(len(ARRIVAL_GIANT.at)).toBeGreaterThan(GARGANTUAN.home);
  });
  it('is the core’s w4 in the shared universe, and in no pocket’s', () => {
    expect(fullSector(UNIVERSE, 0, 0, 0, { lattice: false }).extras.arrival).toEqual([
      expect.objectContaining({ id: spaceId([0, 0, 0], { wonder: ARRIVAL_BASE }), name: 'Tempest', at: ARRIVAL_GIANT.at }),
    ]);
    expect(fullSector(universeOf('marble'), 0, 0, 0, { lattice: false }).extras.arrival).toEqual([]);
  });
  it('clears eleven reaches round each of its four worlds', () => {
    expect(ARRIVAL_WORLDS).toEqual(['marvel', 'travel', 'music', 'potter']);
    const clear = arrivalClearings().filter((c) => !c.id.endsWith(':sight'));
    expect(clear.map((c) => c.id)).toEqual(ARRIVAL_WORLDS.map((id) => `arrival:${id}`));
    for (const c of clear) {
      const p = PLACES.find((q) => `arrival:${q.id}` === c.id && q.kind !== 'station');
      expect(c).toEqual({ id: c.id, at: p.at, r: ARRIVAL_CLEAR * p.reach });
    }
  });
  it('keeps each world’s line of sight to the giant clear, from inside its clearing to the giant’s middle', () => {
    const all = arrivalClearings();
    for (const id of ARRIVAL_WORLDS) {
      const world = all.find((c) => c.id === `arrival:${id}`);
      const sight = all.filter((c) => c.id === `arrival:${id}:sight`);
      const D = len(ARRIVAL_GIANT.at, world.at);
      const u = sub(ARRIVAL_GIANT.at, world.at).map((v) => v / D);
      const theta = Math.asin(ARRIVAL_GIANT.size / D) + ARRIVAL_SIGHT.widen;
      expect(sight.length, id).toBeGreaterThan(10);
      let last = null;
      for (const c of sight) {
        const s = dot(sub(c.at, world.at), u);
        expect(len(sub(c.at, world.at).map((v, k) => v - u[k] * s)), id).toBeLessThan(1e-4); // (on the line)
        expect(c.r, id).toBeCloseTo(s * Math.tan(theta) + ARRIVAL_SIGHT.pad, 3);
        if (last) expect(s - last.s, id).toBeCloseTo(last.r / 2, 3); // (each half a radius on from the one before)
        else expect(s, id).toBeCloseTo(ARRIVAL_SIGHT.from * world.r, 3); // (the first inside the world's clearing)
        last = { s, r: c.r };
      }
      expect(last.s, id).toBeLessThan(D);
      expect(last.s + last.r / 2, id).toBeGreaterThanOrEqual(D); // (the next would be past the giant's middle)
    }
  });
  it('keeps the core’s generated places out of every clearing and every sphere of the sight', () => {
    const clear = arrivalClearings();
    const bad = []; // (gathered, then one expect: 113 rows against every system and thing)
    for (const s of core.systems) for (const c of clear) if (len(s.at, c.at) < c.r + s.reach) bad.push(`${s.id} in ${c.id}`);
    for (let i = 0; i < core.things.count; i++) {
      const at = [0, 1, 2].map((k) => core.origin[k] + core.things.at[3 * i + k]);
      for (const c of clear) if (len(at, c.at) < c.r + 9 * core.things.size[i]) bad.push(`thing ${i} in ${c.id}`);
    }
    // (a list row by its size and its extent, as lane 4a's roomFor keeps them: a comet's whole path, a storm's loop.
    // A mover is measured from its path's middle, as lane 4a's own clearance test does: its extent is its reach from there)
    for (const [list, rows] of Object.entries(core.extras)) {
      if (list === 'arrival') continue;
      for (const row of rows) {
        const mid = row.path?.focus ?? row.path?.centre ?? row.at;
        for (const c of clear) if (len(mid, c.at) < c.r + row.size + (row.extent ?? 0)) bad.push(`${row.id} in ${c.id}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('changes no other sector, nor a pocket’s core', () => {
    for (const [u, c] of [[UNIVERSE, [1, 0, 0]], [UNIVERSE, [0, 1, 0]], [universeOf('marble'), [0, 0, 0]]]) {
      expect(fullSector(u, ...c)).toEqual(fullSector(u, ...c, { clearings: [] }));
    }
  });
});
```

  In lane 4a's `gargantuans.test.js`, its "holds the arrival’s at w4…" `it`, the line `expect(fullSector(UNIVERSE, 0, 0, 0, { lattice: false }).extras.arrival).toEqual([]);` becomes `expect(fullSector(UNIVERSE, 0, 0, 0, { lattice: false }).extras.arrival.map((r) => r.name)).toEqual([ARRIVAL_GIANT.name]);`. Its other lines pass `arrivals` explicitly and stay as they are.

  In lane 3's `places/weight.test.js`, beside its `reach` and `GENERATOR`, a helper and a new `describe`. It reads files and imports none, as the file's own test does:

```js
// the packages a source reaches by static imports ('three' for 'three/examples/…', '@scope/name' whole)
async function packages(entry) {
  const out = new Set();
  for (const f of await reach(entry)) {
    const text = uncomment(readFileSync(ROOT + f, 'utf8'));
    for (const m of [...text.matchAll(FROM), ...text.matchAll(SIDE_EFFECT)]) {
      const spec = m[2];
      if (spec.startsWith('.') || spec.startsWith('/')) continue;
      out.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
    }
  }
  return [...out];
}

describe('the arrival’s pure half reaches no three.js and no React', () => {
  // (lane 4c: each runs in Node, and its test runs before its drawing half)
  it.each([
    'src/components/expanse/gen/arrivalGiant.js',
  ])('%s', async (entry) => {
    expect((await packages(entry)).filter((p) => p === 'three' || p === 'react' || p.startsWith('react-'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/arrivalGiant.test.js src/components/expanse/gen/gargantuans.test.js src/components/universe/places/weight.test.js`. Expected: FAIL (`arrivalGiant` not found, so the new `it.each` fails to read it too; the replaced line fails on today's empty table).
- [ ] **Step 3: Implement.**
  - The row, the clearings, the sight and the face's names.
  - `arrivalGiant.js`'s header says:
    - why there is one giant for four worlds: lane 4a's `ARRIVAL_MAX`, and spec C's "at most one a sector"
    - why the worlds are these four: each is lit from the park's side with the giant behind it, and none is a baseline pose
    - why the clearing is eleven reaches: a phone held upright parks up to 8.9 reaches out (Task 2), as its view is half the height of a desktop's
    - why the sight: the giant is the frame's backdrop, and anything generated between a park and it would stand on its disc
- [ ] **Step 4: Run them and see them pass.** Run `npm test` (the whole suite: the core's appended systems may move, below), then `node scripts/health.mjs --only boundary-breaks,cycles`. Expected: PASS.
  - Lane 2's fingerprint, density and speed tests are unchanged and pass, and so does every test of lanes 3 and 4a but the one line replaced. The two numbers are Step 0's.
  - **The core's appended systems may move as a whole.** `appendSystems` (`expanse/gen/space.js:77-107` at `cc5e2eaf`) throws every system's darts from one `rng` (`rngOf(hash64(seed, 'more'))`, in turn). A dart that the giant's keep (`size + GARGANTUAN.systems`, lane 4a's), a clearing or a sphere of the sight now turns away moves every later dart of the core, and with it every later system's place and index.
    - At `main`'s generator, none of the core's 113 appended systems sat in any of them. Only 24 of its 7,959 lattice things did, and a lattice thing is its own cell's, so nothing else moved.
    - On the branch, after lanes 3 and 4a, count again: the core's appended systems and lattice things with and without `clearings: []` and lane 4a's `arrivals: []`, and how many of the systems are where they were. Write the numbers in the README.
  - **If lane 4a's `things/clear.test.js`** (the gargantuans of the 27 sectors held `GARGANTUAN.far + size` from every baseline pose's point) reads `extras.arrival` too, it fails here. The giant is 46,316 from the `rickmorty` pose, under that test's 50,000. The bound's purpose is lane 4a's own: no mesh built at a baseline pose (`1.2 × nearOf`, 23,700). So that `it` keeps its bound for `extras.gargantuan`. The arrival's row is held to the purpose by Task 2's pose test, which replaces it (Global Constraints' second changed assertion, finding 3).
- [ ] **Step 5: See it on the sky.** Run `node scripts/universe-check.mjs --quality mid --poses falcon-sun,belt,far-rim,station --out lab/universe/after-4c-1/mid`. Expected:
  - Tempest on the sky at `falcon-sun` (upper left), `belt` (left) and `far-rim` (left edge)
  - calls equal to Step 0's `mid` at all four, and triangles two over (the core's second landmark extra)
  - `station`'s picture identical at a held clock: run `node scripts/universe-check.mjs --quality mid --poses station --t 30 --png --out lab/universe/after-4c-1/t30`, then `node scripts/same-pixels.mjs lab/universe/before-4c/t30/station.png lab/universe/after-4c-1/t30/station.png` (lane 4a's). Expected: exit 0, `same: true`.

  Put the three pairs, before and after, in the README.
- [ ] **Step 6: Commit.** `git commit -m "The arrival's giant, Tempest, in the core: one supergiant behind four worlds, room kept round them and their line of sight to it clear"`. The body:
  - gives the four poses' numbers
  - names lane 4a's replaced line, and its `clear.test.js` `it` if Step 4 narrowed it
  - says the core's appended layout may shift as a whole, why (one `rng` for all the darts) and whether it did, with Step 4's counts. Nothing stored names a core system: every lane ships together.

### Task 2: The arrival's parks, and what the camera sees from them

**Files:**
- Create: `src/components/universe/arrival/parks.js`, `src/components/universe/arrival/parks.test.js`
- Modify: `src/components/universe/words.js` (`ARRIVAL_WORDS`; `NAV.home`, `NAV.homeTitle`, `NAV.homeWait`, `NAV.homeJammed`), and its test if it lists the exports
- Modify: `src/lib/ease.js` (`easeOut`, moved here unchanged), `src/lib/ease.test.js` (a new `it`)
- Modify: `src/lib/three/renderer.js`: `export const easeOut = …` (`renderer.js:282` at `cc5e2eaf`) becomes `export { easeOut } from '../ease';` under the same comment (0). Its twelve importers are unchanged.
- Modify: `src/components/universe/flight.js`: `import { easeOut } from '../../lib/three/renderer';` (`flight.js:15`) becomes `import { easeOut } from '../../lib/ease';` (0)
- Modify: lane 3's `src/components/universe/places/weight.test.js`: `parks.js` joins Task 1's pure `it.each`, as a new line

**Interfaces:**
- Consumes:
  - through lane 3's face: `ARRIVAL_GIANT`, `ARRIVAL_WORLDS`, `arrivalClearings` and lane 4a's `ARRIVAL_BASE`; in the test only, `fullSector`, `UNIVERSE` and `orbitAt`
  - `POSITIONS` (`layout.js`), `byId` (`universes.js`), `sunFor` (`lighting.js`), `SOLIDS` and `headingTo` (`ship.js`), `MAW` (`maw.js`), `destinationById` (`nav.js`)
  - `FOV`, `CHASE`, `cover` and `project` (`flight.js`)
  - Task 0's `spaceId`
  - in the test only: lane 4a's `nearOf` (`gargantuans/rules.js`), `poseFor` (`poses.js`) and `PLACES` (`deep.js`)
- Produces:
  - **`ARRIVAL_VIEW`**, as in Global Constraints
  - **`ARRIVAL_FRAME = { w: 1280, h: 720, rect: cover({ w: 1280, h: 720, top: 76 }) }`**: a desktop under the site's bar, the panel put away
  - **`View = { w, h, rect }`**: the canvas's size in CSS px and `cover`'s open part, as `scene.js`'s `measure` makes `state.rect`. A view with no `rect`, or `w` or `h` under 2 (the canvas not measured yet), is `ARRIVAL_FRAME`.
  - **`ARRIVAL_ID = spaceId([0, 0, 0], { wonder: ARRIVAL_BASE })`**, which is `'E:0,0:w4'`
  - **`arrivalPark(id, { turn = 0, near = 1, view = ARRIVAL_FRAME } = {}) → { id, world: [x, y, z], r, dist, sep, toWorld: [x, y, z], ship: { x, y, z, heading } } | null`**. It is null for an id not in `ARRIVAL_WORLDS`. With `T = tan(FOV / 2)`:
    - `k = max(ARRIVAL_VIEW.open, rect.h / h)`, the open part's share of the canvas's height. The open part is centred on the camera's axis (the lens shift `cover` gives does that), so it spans `±k` of the half-height either way.
    - `dist = near × r / sin(atan(fill × k × T))`, where `r` is the world's `byId(id).size`: the world's disc is `fill` of the open part's height at `near` 1.
    - `g` is the unit from the world to the giant, and `side = unit(g × [0, 1, 0])`.
    - `sep = (asin(g.y) + CHASE.tilt) − atan(k × (1 − 2 × low) × T)`: from the giant's angle above the axis, which the ship can't change (Global Constraints), down to where the world's middle should be, `low` of the way down the open part.
    - `toWorld` (from the ship to the world) is `g` rotated by `−sep` about `side`, then by `turn` about `g` (Rodrigues' formula both times).
    - `ship = world − toWorld × dist`, level, with `heading = headingTo(toWorld[0], toWorld[2])`.
  - **`arrivalAt(rand = Math.random, view = ARRIVAL_FRAME) → { ...arrivalPark(id, { turn, near, view }), name, giant: ARRIVAL_ID }`**: three draws, the world, then `turn` in `±ARRIVAL_VIEW.turn`, then `near` in `ARRIVAL_VIEW.near`. `name` is the world's nav name (`destinationById(id).name`).
  - **`arrivalShot(park, view = ARRIVAL_FRAME) → { world: { x, y, r }, giant: { x, y, r }, open: rect }`**, in CSS px on the whole canvas, y down, as the chase camera sees `park.world` (radius `park.r`) and the giant from `park.ship`:
    - The camera sits at the ship, turned to `heading`, looking `CHASE.tilt` down, with a vertical `FOV` on a `w × h` canvas, and the lens shift `{ sx: rect.sx, sy: rect.sy }` (flight.js's `project` maths). Its real place, `CHASE.dist` (1.1) behind, is under three parts in a thousand of the park's distance.
    - A sphere's disc has `r = h / 2 · tan(asin(min(1, R / d))) / tan(FOV / 2)`.
    - The test reads every share against `open`: `(x − open.x) / open.w`, `(y − open.y) / open.h`.
  - **`ARRIVAL_WORDS`**, one line a world, built by hand so each reads well (a world's nav name alone gives "You’re off Music room"):

    ```js
    export const ARRIVAL_WORDS = {
      giant: 'Tempest', // (the arrival's supergiant: expanse/gen/arrivalGiant.js's row says the same)
      // (where a new pilot arrives, one line a world: arrival/parks.js's ARRIVAL_WORLDS)
      here: {
        marvel: 'Avengers HQ, Marvel’s world, with Tempest rising behind it',
        travel: 'Earth, the travel world, with Tempest rising behind it',
        music: 'The Music room, Indian classical music’s world, with Tempest rising behind it',
        potter: 'Hogwarts, Harry Potter’s world, with Tempest rising behind it',
      },
      back: (name) => (name ? `Back where you left off: ${name}` : 'Back where you left off'),
    };
    ```

    `NAV` gains four keys, for Task 9's one press, which is always the jump:
    - `home: 'Fly home'`
    - `homeTitle: 'Jump back to the home system'`
    - `homeWait: (s) => \`Jumping home in ${s} s\``, pressed while the jump charges
    - `homeJammed: 'Jumping home once you’re clear of the jammer'`, pressed while it's jammed
  - **`easeOut`** in `lib/ease.js`, the same function, lent on by `lib/three/renderer.js`

- [ ] **Step 1: Write the failing tests.** In `parks.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { ARRIVAL_GIANT, ARRIVAL_WORLDS, UNIVERSE, arrivalClearings, fullSector, orbitAt } from '../../expanse/shared/space';
import { PLACES } from '../deep';
import { FOV, cover } from '../flight';
import { nearOf } from '../gargantuans/rules';
import { sunFor } from '../lighting';
import { MAW } from '../maw';
import { poseFor } from '../poses';
import { SOLIDS } from '../ship';
import { byId } from '../universes';
import { ARRIVAL_WORDS } from '../words';
import { ARRIVAL_FRAME, ARRIVAL_ID, ARRIVAL_VIEW, arrivalAt, arrivalPark, arrivalShot } from './parks';

// The open parts the scene centres its view in (scene.js's measure, flight.js's cover), on the screens a first visit comes on:
// a desktop under its 76 px bar, the 400 px panel open (412 with its margin: side = box.right − panel.left) and put away;
// a phone held upright under its 68 px bar, the sheet resting (universe.css's 38svh: 321 px) and, once flown, put away
// (Universe.jsx tucks it at the launch) with the thumbs' grid over the foot. Upright the grid has four rows (thumbs.css:
// 52 + 52 + 52 + 76 and three gaps of 8: 256), 12 over the 56 px bar, and measure() adds 12 more: 336.
// (A pick's card makes the sheet 46svh; the arrival has no pick, so no card.)
const VIEWS = {
  desk: { w: 1280, h: 720, rect: cover({ w: 1280, h: 720, top: 76, panel: 412 }) },
  wide: { w: 1280, h: 720, rect: cover({ w: 1280, h: 720, top: 76 }) },
  phone: { w: 390, h: 844, rect: cover({ w: 390, h: 844, top: 68, sheet: 321 }) },
  thumbs: { w: 390, h: 844, rect: cover({ w: 390, h: 844, top: 68, sheet: 336 }) },
};
const SCREENS = [['desk', 'wide'], ['phone', 'thumbs']];
const BASELINE = ['overview', 'falcon-sun', 'middleearth-limb', 'rickmorty', 'gaming', 'caribbean', 'middleearth', 'breakingbad', 'office', 'belt', 'maw', 'landing-middleearth', 'station', 'far-rim'];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (a) => Math.hypot(...a);
const unit = (a) => a.map((v) => v / len(a));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const at = (s) => [s.x, s.y, s.z];
// every extreme of the jitter, at every world, made for one view; and for them all
const edges = (view) => ARRIVAL_WORLDS.flatMap((id) => [-1, 0, 1].flatMap((k) => ARRIVAL_VIEW.near.map((near) => arrivalPark(id, { turn: k * ARRIVAL_VIEW.turn, near, view }))));
const EDGES = Object.values(VIEWS).flatMap(edges);
// a disc's middle and radius as shares of the open part
const inOpen = ({ x, y, r }, rect) => ({ x: (x - rect.x) / rect.w, y: (y - rect.y) / rect.h, rw: r / rect.w, rh: r / rect.h });
// a pose's eye, looking at its look with y up (flight.js's project), sees the giant's disc in a 1280 × 720 frame
const sees = (p, w = 1280, h = 720) => {
  if (!p.eye) return false; // (the overview: no eye, judged by its shot)
  const f = unit(sub(p.look, p.eye));
  const r = unit(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const d = sub(ARRIVAL_GIANT.at, p.eye);
  const z = dot(d, f);
  if (z <= 0) return false;
  const t = Math.tan((FOV * Math.PI) / 360);
  const rad = Math.tan(Math.asin(Math.min(1, ARRIVAL_GIANT.size / len(d)))) / t;
  return Math.abs(dot(d, r) / (z * t * (w / h))) < 1 + (rad * h) / w && Math.abs(dot(d, u) / (z * t)) < 1 + rad;
};
// the seeded core: what lane 2's density.test.js counts (every system and its planets at t 0, every thing, every
// list row, every hand-made place and wonder), and what could stand on the giant's disc (a system by its reach, which
// holds its planets' whole orbits; a list row by its size and extent, from a mover's path's middle; a thing by its size)
const CORE = fullSector(UNIVERSE, 0, 0, 0);
const THINGS = Array.from({ length: CORE.things.count }, (_, i) => ({ id: `thing ${CORE.things.slot[i]}`, at: [0, 1, 2].map((k) => CORE.origin[k] + CORE.things.at[3 * i + k]), r: CORE.things.size[i] }));
const ROWS = Object.entries(CORE.extras).filter(([list]) => list !== 'arrival').flatMap(([, rows]) => rows.map((row) => ({ id: row.id, at: row.path?.focus ?? row.path?.centre ?? row.at, r: row.size + (row.extent ?? 0) })));
const COUNTED = [...PLACES.map((p) => p.at), ...CORE.systems.flatMap((s) => [s.at, ...s.planets.map((p) => orbitAt(p, 0))]), ...THINGS.map((t) => t.at), ...Object.values(CORE.extras).flatMap((rows) => rows.map((r) => r.at))];
const SOLID_ROWS = [...CORE.systems.map((s) => ({ id: s.id, at: s.at, r: s.reach })), ...ROWS, ...THINGS];

describe('the arrival', () => {
  it('frames the world low in the open part, the giant above and behind it, on the screen it arrives on and as the panel opens or goes away', () => {
    for (const pair of SCREENS) for (const made of pair) for (const p of edges(VIEWS[made])) for (const seen of pair) {
      const v = VIEWS[seen];
      const shot = arrivalShot(p, v);
      expect(shot.open).toEqual(v.rect);
      const w = inOpen(shot.world, v.rect);
      const g = inOpen(shot.giant, v.rect);
      const where = `${p.id} made for ${made}, seen at ${seen}`;
      expect(2 * w.rh, where).toBeGreaterThanOrEqual(0.35); // (a good part of the frame)
      expect(2 * w.rh, where).toBeLessThanOrEqual(0.55);
      expect(w.y, where).toBeGreaterThanOrEqual(0.55); // (low in it)
      expect(w.y, where).toBeLessThanOrEqual(0.75);
      expect(w.y - w.rh, where).toBeGreaterThanOrEqual(0.05); // (its whole disc in the open part: not under the bar, the sheet, the buttons or the panel)
      expect(w.y + w.rh, where).toBeLessThanOrEqual(0.95);
      expect(w.x - w.rw, where).toBeGreaterThanOrEqual(0.02);
      expect(w.x + w.rw, where).toBeLessThanOrEqual(0.98);
      expect(g.x, where).toBeGreaterThanOrEqual(0.15); // (the giant's middle in the open part, above the world)
      expect(g.x, where).toBeLessThanOrEqual(0.85);
      expect(g.y, where).toBeGreaterThanOrEqual(0.05);
      expect(g.y, where).toBeLessThanOrEqual(0.45);
      expect(2 * g.rh, where).toBeGreaterThanOrEqual(0.35); // (it owns the sky)
      expect(Math.hypot(shot.giant.x - shot.world.x, shot.giant.y - shot.world.y), where).toBeGreaterThanOrEqual(shot.world.r + 0.3 * shot.giant.r); // (behind it, not hidden by it)
    }
  });
  it('parks as for half the height on a shorter view, and as for a desktop before the canvas is measured', () => {
    const half = { w: 390, h: 844, rect: { ...cover({ w: 390, h: 844 }), h: 422 } };
    const short = { w: 390, h: 844, rect: cover({ w: 390, h: 844, top: 68, sheet: 600 }) };
    expect(arrivalPark('marvel', { view: short }).dist).toBeCloseTo(arrivalPark('marvel', { view: half }).dist, 9);
    expect(arrivalPark('marvel', { view: { w: 1, h: 1 } })).toEqual(arrivalPark('marvel'));
    expect(arrivalPark('marvel', { view: { w: 1280, h: 720 } })).toEqual(arrivalPark('marvel', { view: ARRIVAL_FRAME }));
  });
  it('parks on the day side, where the world is in its air’s clear and nothing else is near', () => {
    for (const p of [...EDGES, ...edges({ w: 390, h: 844, rect: { ...cover({ w: 390, h: 844 }), h: 422 } })]) {
      const out = sub(at(p.ship), p.world);
      expect(dot(unit(out), sunFor(p.id))).toBeGreaterThanOrEqual(ARRIVAL_VIEW.day);
      expect(len(out)).toBeGreaterThan(p.r * 1.25);
      expect(len(sub(at(p.ship), MAW.at))).toBeGreaterThan(MAW.reach + 20);
      for (const o of SOLIDS) if (o.id !== p.id) expect(len(sub(at(p.ship), o.at)), o.id).toBeGreaterThan(o.reach + 14);
      const c = arrivalClearings().find((x) => x.id === `arrival:${p.id}`);
      expect(len(sub(at(p.ship), c.at))).toBeLessThanOrEqual(c.r - 100); // (inside its clearing by 100 or more, on the shortest view too)
    }
  });
  it('arrives somewhere populated: lane 2’s three within 9,000 and the nearest within 6,000, at every park', () => {
    for (const p of EDGES) {
      const d = COUNTED.map((a) => len(sub(a, at(p.ship))));
      expect(d.filter((x) => x <= 9000).length, p.id).toBeGreaterThanOrEqual(3);
      expect(Math.min(...d), p.id).toBeLessThanOrEqual(6000);
    }
  });
  it('sees the giant clear: nothing generated stands between a park and its disc', () => {
    for (const p of EDGES) {
      const toG = sub(ARRIVAL_GIANT.at, at(p.ship));
      const dg = len(toG);
      const rho = Math.asin(ARRIVAL_GIANT.size / dg);
      const over = (o) => {
        const to = sub(o.at, at(p.ship));
        const d = len(to);
        return d < dg && Math.acos(Math.min(1, dot(to, toG) / (d * dg))) < rho + Math.asin(Math.min(1, o.r / d));
      };
      expect(SOLID_ROWS.filter(over).map((o) => o.id), p.id).toEqual([]);
    }
  });
  it('keeps the giant past 20,000 and past where its mesh is built, a terminator in view', () => {
    const mesh = 1.2 * nearOf(ARRIVAL_GIANT);
    for (const p of EDGES) {
      const d = len(sub(ARRIVAL_GIANT.at, at(p.ship)));
      expect(d).toBeGreaterThan(20000);
      expect(d).toBeGreaterThan(mesh + 2000);
      const phase = (Math.acos(dot(ARRIVAL_GIANT.light, unit(sub(at(p.ship), ARRIVAL_GIANT.at)))) * 180) / Math.PI;
      expect(phase).toBeGreaterThanOrEqual(20);
      expect(phase).toBeLessThanOrEqual(100);
    }
  });
  it('never builds the giant at a baseline pose, and shows it in three of their pictures', () => {
    const mesh = 1.2 * nearOf(ARRIVAL_GIANT);
    for (const name of BASELINE) {
      const p = poseFor(name);
      for (const q of [p.at, p.eye].filter(Boolean)) expect(len(sub(ARRIVAL_GIANT.at, q)), name).toBeGreaterThan(mesh + 2000);
    }
    expect(BASELINE.filter((name) => sees(poseFor(name)))).toEqual(['falcon-sun', 'belt', 'far-rim']);
  });
  it('spreads visitors: every world comes up, and two seldom share a spot', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const got = Array.from({ length: 400 }, () => arrivalAt(rand));
    expect(new Set(got.map((g) => g.id))).toEqual(new Set(ARRIVAL_WORLDS));
    let close = 0, pairs = 0;
    for (let i = 0; i < got.length; i++) for (let j = i + 1; j < got.length; j++) if (got[i].id === got[j].id) {
      pairs++;
      if (len(sub(at(got[i].ship), at(got[j].ship))) < 2) close++;
    }
    expect(close / pairs).toBeLessThan(0.01);
    expect(got[0]).toMatchObject({ giant: ARRIVAL_ID, name: expect.any(String) });
    expect(ARRIVAL_ID).toBe('E:0,0:w4');
  });
  it('names where you are, world by world, and the giant as the generator does', () => {
    expect(ARRIVAL_WORDS.giant).toBe(ARRIVAL_GIANT.name);
    expect(Object.keys(ARRIVAL_WORDS.here).sort()).toEqual([...ARRIVAL_WORLDS].sort());
    for (const id of ARRIVAL_WORLDS) {
      expect(ARRIVAL_WORDS.here[id], id).toContain(byId(id).world);
      expect(ARRIVAL_WORDS.here[id], id).toContain(ARRIVAL_GIANT.name);
    }
    expect(ARRIVAL_WORDS.here.music).toBe('The Music room, Indian classical music’s world, with Tempest rising behind it');
    expect(ARRIVAL_WORDS.back('Hogwarts')).toBe('Back where you left off: Hogwarts');
    expect(ARRIVAL_WORDS.back(null)).toBe('Back where you left off');
    expect(arrivalPark('gaming')).toBeNull();
  });
});
```

  In `ease.test.js`, a new `it`:

```js
  it('eases out as the site’s CSS does, from nought to one', () => {
    expect([easeOut(-1), easeOut(0), easeOut(0.5), easeOut(1), easeOut(2)]).toEqual([0, 0, 1 - 2 ** -5, 1, 1]);
  });
```

  (with `easeOut` added to the file's import line). In `places/weight.test.js`'s pure `it.each`, the line `'src/components/universe/arrival/parks.js',`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/arrival/parks.test.js src/lib/ease.test.js src/lib/words.test.js src/components/universe/places/weight.test.js`. Expected: FAIL (module not found; `easeOut` is not exported by `ease.js`; `parks.js` can't be read).
- [ ] **Step 3: Implement.**
  - Move `easeOut` (its body unchanged) and lend it on from the renderer, then point `flight.js` at `lib/ease.js`. `ease.js`'s header list gains its line.
  - `parks.js`'s header says:
    - the composition: the world low in the open part, the giant above and behind it, both on the nose's line
    - why the park is made for the open part: the scene centres its view there, so a park made for the bare canvas puts a phone's world under its sheet
    - why the giant's place on screen isn't the park's to choose, and why on a phone held upright its middle is in the top sixth
    - why the ship sits 14° to 17° above the world's middle as seen: the chase camera looks 12° down
  - If a world fails the day, the giant's or the sight's rule, change the world in `ARRIVAL_WORLDS` (Task 1's list, the four from the twelve that aren't baseline poses) and its line in `ARRIVAL_WORDS.here`, never a bound. Say which in the commit.
  - If the sight test names a row, Task 1's `ARRIVAL_SIGHT` (`pad`, `widen`) is too thin for that park: widen it, re-run Task 1's test and say so in the commit.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, and in `weight.test.js` `parks.js` reaches no `three`. At Task 1's numbers, over every extreme of the jitter, as shares of the open part:
  - **a desktop, panel open or away:** the world 0.39–0.46 of the height across, its middle 0.63–0.66 down, its disc from 0.41 to 0.89 down; the giant's middle 0.25–0.30 down and 0.39–0.61 across, 0.40–0.67 of the height across; `sep` 11.6°–13.0°; the park 4.2–5.0 reaches out
  - **a phone held upright, sheet up or put away:** the world 0.38–0.47 across, its middle 0.62–0.67 down, its disc from 0.39 to 0.90 down and 0.23 to 0.77 across; the giant's middle 0.07–0.16 down and 0.26–0.74 across, 0.66–1.14 of the height across; `sep` 9.5°–11.0°; the park 7.0–8.5 reaches out (8.9 on the shortest view)
  - the day dot 0.38–0.97; the giant 27,650 to 46,240 away; the phase 22°–80°; 13 to 20 places within 9,000, the nearest the world itself
  - `boundary-breaks` and `cycles` at Task 1's numbers (`node scripts/health.mjs --only boundary-breaks,cycles`)

  Write each screen's ranges in the README, measured from the test's own numbers, not copied from here.
- [ ] **Step 5: Commit.** `git commit -m "The arrival's four parks, made for the part of the screen the view is drawn in: each world low on its day side, Tempest rising behind it, on a phone as on a desktop"`. The body says that `easeOut` moved to `lib/ease.js` so `flight.js` reaches no three.js, and gives the two screens' ranges.

### Task 3: Where you were: `tp-universe-where`

**Files:**
- Create: `src/components/universe/arrival/where.js`, `src/components/universe/arrival/where.test.js`
- Modify: `src/lib/restart.js` and `src/lib/restart.test.js` (a new `it`; its three are unchanged)
- Modify: lane 3's `src/components/universe/places/weight.test.js`: `where.js` joins Task 1's pure `it.each`, as a new line, and a new `it.each` holds it off the generator

**Interfaces:**
- Consumes:
  - Task 0's `SECTOR`, `sectorAt`, `sectorCentre` and `sectorKey`
  - lane 3's `canonicalPlace` and `isPlaceId` (`places/ids.js`, light: no generator behind it)
  - `isGoal`, `SOLIDS` and `SHIP` (`ship.js`), `MAW` (`maw.js`), `SECTORS` and `mapSectorOf` (`layout.js`)
  - `runtime/saves.js`'s `register`, `get` and `set`. `rt.saves` writes the key as it is (`saves.js`'s `write`: `store.setItem(key, …)`), so "Start over"'s `removeItem('tp-universe-where')` forgets it.
  - in `weight.test.js` only: lane 3's `reach` and `GENERATOR`
- Produces:
  - **In `lib/restart.js`:**
    - `VISIT_KEYS` gains `'tp-universe-where', // where the ship was left on the map (universe/arrival/where.js)`, after `'tp-universe-ship'`
    - **`RESTARTING = 'tp:restart'`**: the window event `restartSite` sends before it forgets anything, so a page that saves as it goes (Task 6's first minute, on `pagehide`) can stop first. `restartSite` gains `window.dispatchEvent(new Event(RESTARTING));` as its first line (a listener that throws is reported, never thrown on).
    - The header says why: the reload fires `pagehide` after the keys are gone, and a save written then would resume the pilot deep in the Expanse after the welcome, the crawl and the cockpit.
  - **In `arrival/where.js`:**
  - **`WHERE`**, as in Global Constraints
  - **`Where = { sector: [sx, sy, sz], at: [x, y, z], heading, place: string | null, t }`**
    - `at` is from the sector's centre, rounded to hundredths.
    - `heading` is wrapped to (−π, π].
    - `place` is a hand-made goal's id (`isGoal`) or a canonical place id (`canonicalPlace`), else null.
    - `t` is the shared clock's seconds at the save: the scene's `state.spaceT`, which is lane 2's `spaceTime(Date.now())` (`Date.now() / 1000`), or 0 under reduced motion. It is the clock the place was drawn at, so Task 6 can find where a moving place was then. It is never the page's `wall()`, which starts again on each page.
  - **`whereOf(ship, { place = null, t }) → Where | null`**: null for a missing or non-finite ship
  - **`readWhere(value) → Where | null`**. It gives null for:
    - anything that isn't a plain object
    - a `sector` that isn't three integers within ±`WHERE.sectors` (8,000)
    - an `at` that isn't three finite numbers within `SECTOR / 2 + 1000` of the centre
    - a non-finite `heading`

    A bad `place` becomes null and the rest is kept. Unknown keys are dropped. A non-finite `t` becomes 0.
  - **`shipOfWhere(where) → { x, y, z, heading }`**: the absolute position, in doubles
  - **`inTheWay({ x, y, z }, ...lists) → { id, at, r } | null`**: what a ship there would sit in. That is the Maw's row, within `MAW.reach + WHERE.maw` of it, or the first solid of `SOLIDS` or of any further list (each `[{ id, at, r }]`) with the ship within `WHERE.air × r + SHIP.radius` of its middle (in its air). Else null.
  - **`clearToResume(p, ...lists) → boolean`**: `inTheWay(p, ...lists) === null`. With no lists it knows the hand-made `SOLIDS` and the Maw. Task 6 passes the generated bodies (lane 2's `expanse.solids()`) and the stations (lane 3's `places.solids()`).
  - **`readSaved(saves) → Where | null`**: registers `{ key: WHERE.key, version: WHERE.version }` (idempotent: `register` only sets a map entry), then gives `readWhere(saves.get(WHERE.key))`. It never throws.
  - **`writeSaved(saves, where) → boolean`**: `saves.set(WHERE.key, where)` after the same `register`. False for a null `where`.
  - **`farFromHome(ship) → boolean`**: past `WHERE.far` from home in 3D, and not in the Rick and Morty pocket (`mapSectorOf(...) === 'rickmorty'` gives false; the pocket's way home is its portal)

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { POSITIONS, SECTORS } from '../layout';
import { MAW } from '../maw';
import { parkFor } from '../nav';
import { byId } from '../universes';
import { WHERE, clearToResume, farFromHome, inTheWay, readSaved, readWhere, shipOfWhere, whereOf, writeSaved } from './where';

const store = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('where you were', () => {
  it('keeps the sector, where in it, the heading and the place, and gives the ship back', () => {
    const w = whereOf({ x: 125000.456, y: -70000, z: 3.2, heading: 7 }, { place: 'e:1,0,-1:3:2', t: 1.76e9 });
    expect(w).toEqual({ sector: [1, -1, 0], at: [5000.46, 50000, 3.2], heading: expect.closeTo(7 - 2 * Math.PI, 9), place: 'E:1,0,-1:3:2', t: 1.76e9 });
    const back = shipOfWhere(w);
    expect([back.x, back.y, back.z]).toEqual([expect.closeTo(125000.46, 6), -70000, expect.closeTo(3.2, 9)]);
    expect(back.heading).toBe(w.heading);
    const far = shipOfWhere(whereOf({ x: 9.6e6 + 0.37, y: 2, z: -3, heading: 0 }, { t: 0 }));
    expect(far.x).toBeCloseTo(9.6e6 + 0.37, 2);
    expect(whereOf({ x: NaN, y: 0, z: 0, heading: 0 }, { t: 0 })).toBeNull();
    expect(whereOf(null, { t: 0 })).toBeNull();
  });
  it('keeps a hand-made place, and drops one it can’t read', () => {
    expect(whereOf({ x: 0, y: 0, z: 0, heading: 0 }, { place: 'marvel', t: 1 }).place).toBe('marvel');
    expect(readWhere({ sector: [0, 0, 0], at: [1, 2, 3], heading: 0, place: 'nonsense', t: 1 })).toMatchObject({ at: [1, 2, 3], place: null });
  });
  it('reads nothing it can’t trust, and never throws', () => {
    for (const bad of [null, 'x', 7, [], {}, { sector: [1, 0], at: [0, 0, 0], heading: 0 }, { sector: [1e8, 0, 0], at: [0, 0, 0], heading: 0 }, { sector: [0, 0, WHERE.sectors + 1], at: [0, 0, 0], heading: 0 }, { sector: [0, 0, 0], at: [NaN, 0, 0], heading: 0 }, { sector: [0, 0, 0], at: [70000, 0, 0], heading: 0 }, { sector: [0, 0, 0], at: [0, 0, 0], heading: 'n' }]) {
      expect(readWhere(bad), JSON.stringify(bad)).toBeNull();
    }
    // (the furthest sector lane 2 pins drawing for: 8,000 × 120,000 = 9.6e8, inside its 10^9)
    expect(readWhere({ sector: [-WHERE.sectors, 0, WHERE.sectors], at: [0, 0, 0], heading: 0 })).not.toBeNull();
  });
  it('lasts between visits through rt.saves, whoever reads it first, and survives a broken store', () => {
    const local = store();
    const w = whereOf({ x: 10, y: 20, z: 30, heading: 1 }, { place: null, t: 5 });
    expect(writeSaved(createSaves({ local }), w)).toBe(true);
    expect(JSON.parse(local.m.get(WHERE.key))).toEqual({ v: 1, data: w });
    expect(readSaved(createSaves({ local }))).toEqual(w); // (a fresh page, the flat map's, reading first)
    local.m.set(WHERE.key, JSON.stringify(w)); // (an unwrapped value, written by hand)
    expect(readSaved(createSaves({ local }))).toEqual(w);
    local.m.set(WHERE.key, '{oops');
    expect(readSaved(createSaves({ local }))).toBeNull();
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() {} };
    expect(readSaved(createSaves({ local: broken }))).toBeNull();
    expect(() => writeSaved(createSaves({ local: broken }), w)).not.toThrow();
    expect(writeSaved(createSaves({ local }), null)).toBe(false);
  });
  it('resumes only where it’s safe: never in the Maw’s pull or a planet’s air', () => {
    const k = parkFor('marvel', [0, 0]);
    expect(clearToResume(k)).toBe(true);
    const [x, y, z] = POSITIONS.marvel;
    expect(clearToResume({ x: x + byId('marvel').size * 1.1, y, z })).toBe(false);
    expect(clearToResume({ x: MAW.at[0] + MAW.reach, y: MAW.at[1], z: MAW.at[2] })).toBe(false);
    expect(clearToResume({ x: 0, y: 50000, z: 0 })).toBe(true);
    // (a generated body that has come round onto the spot: only a list passed in knows it)
    const body = { id: 'E:1,0:3:2', at: [130000, 0, 0], r: 40 };
    const on = { x: 130000 + 45, y: 0, z: 0 };
    expect(clearToResume(on)).toBe(true);
    expect(inTheWay(on, [], [body])).toBe(body);
    expect(clearToResume(on, [body])).toBe(false);
    expect(clearToResume({ x: 130000 + 60, y: 0, z: 0 }, [body])).toBe(true);
    expect(inTheWay({ x: x + byId('marvel').size * 1.1, y, z })?.id).toBe('marvel');
  });
  it('says when the ship is far enough from home to offer the way back', () => {
    expect(farFromHome({ x: 0, y: 0, z: 0 })).toBe(false);
    expect(farFromHome({ x: 0, y: 50000, z: 0 })).toBe(false);
    expect(farFromHome({ x: 60000, y: 0, z: 0 })).toBe(true);
    expect(farFromHome({ x: 9.6e6, y: 0, z: 0 })).toBe(true);
    const o = SECTORS.rickmorty.origin;
    expect(farFromHome({ x: o[0], y: o[1], z: o[2] })).toBe(false);
  });
});
```

  In `src/lib/restart.test.js`, a new `it` in its `describe`, with `RESTARTING` and `restartSite` added to the import line and `vi` to vitest's:

```js
  it('forgets where the ship was left, and says it is starting over before it forgets anything', () => {
    const s = storage({ 'tp-universe-where': '{"v":1,"data":{}}', 'tp-universe-ship': '"cruiser"', 'tp-achievements': '["konami"]' });
    forgetVisit(s);
    expect(s.keys()).toEqual(['tp-achievements']);
    expect(VISIT_KEYS).toContain('tp-universe-where');
    const log = [];
    const local = { removeItem: (k) => log.push(`forget ${k}`) };
    vi.stubGlobal('window', {
      localStorage: local,
      dispatchEvent: (e) => log.push(`said ${e.type}`),
      history: { replaceState: () => log.push('home') },
      location: { pathname: '/', search: '', reload: () => log.push('reload') },
    });
    vi.stubGlobal('document', { documentElement: { dataset: {} } });
    try {
      restartSite();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(RESTARTING).toBe('tp:restart');
    expect(log[0]).toBe('said tp:restart');
    expect(log).toContain('forget tp-universe-where');
    expect(log.at(-1)).toBe('reload');
  });
```

  In `places/weight.test.js`: the line `'src/components/universe/arrival/where.js',` in Task 1's pure `it.each`, and a new `describe`:

```js
describe('the saved position reaches no generator, so the pages that read it load none', () => {
  // (lane 4c: the flat map and the nav map's Home read where the ship was left. Not lane 3's it.each above,
  // which also holds that each entry reaches nav.js: where.js doesn't)
  it.each([
    'src/components/universe/arrival/where.js',
  ])('%s reaches none of it', async (entry) => {
    expect((await reach(entry)).filter((f) => GENERATOR.test(f))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/arrival/where.test.js src/lib/restart.test.js src/components/universe/places/weight.test.js`. Expected: FAIL (module not found; `RESTARTING` isn't exported; `where.js` can't be read). `restart.test.js`'s three old `it`s pass.
- [ ] **Step 3: Implement.** `where.js`'s header says:
  - what's kept and why only that (spec G: seeds and deltas only)
  - why a place and the shared clock's `t` are kept beside the position: a generated planet or moon goes on round its orbit while you're away, so the resume finds where it was at `t` and puts the pilot back at the same offset from where it is now (Task 6). A place that stays put needs neither, and is never moved.
  - why the sector is bounded at 8,000: past that, nothing of lane 2's pins the drawing
  - that the scene writes and the flat map only reads, and that "Start over" forgets it (`lib/restart.js`)
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS: `where.js` reaches no generator file and no `three` or `react`, and `restart.test.js`'s four `it`s pass.
- [ ] **Step 5: Commit.** `git commit -m "Where you were, kept between visits: the sector, the place in it, the heading and where you were at, read only where it's safe, and forgotten when you start over"`. The body says why `t` is on the shared clock, why the sector stops at 8,000, and why `restartSite` says it is starting over before it forgets.

### Task 4: Where a new ship starts

**Files:**
- Create: `src/components/universe/arrival/start.js`, `src/components/universe/arrival/start.test.js`
- Modify: lane 3's `src/components/universe/places/weight.test.js`: `start.js` joins Task 1's pure `it.each`, as a new line

**Interfaces:**
- Consumes: Task 2's `arrivalAt` and `View`; Task 3's `shipOfWhere` and `clearToResume`; `ship.js`'s `startAt` and `isGoal`; `nav.js`'s `parkFor`; `MAW` (`maw.js`); lane 3's `isPlaceId` (`places/ids.js`).
- Produces: **`startPlan({ sel, link, saved, shared, view, rand = Math.random, places }) → Plan`**, pure. `view` is Task 2's `View`, the canvas and its open part at the spawn (or none yet: Task 2 parks as for `ARRIVAL_FRAME`). `places` is `{ park(id, from) → Park | null, missing(id) → boolean }` (lane 3's `scenePlaces`; a fake in the test). The rules, in order:

  | When | `kind` | `ship` | also |
  |---|---|---|---|
  | `sel` (the page's pick) | `'sel'` | `startAt(rand)`, what today passes: `spawn` parks at the pick when it's a planet and ignores this | |
  | `link`, not the Maw, a hand-made goal | `'link'` | `parkFor(link, [0, 0])` | |
  | `link`, a place id | `'link'` | `places.park(link, [0, 0]) ?? startAt(rand)` | `travel: places.missing(link)`, lane 3's jump once its sector lands |
  | `link` the Maw, or any other link | `'link'` | `startAt(rand)`, as today | |
  | `saved` and `shared` | `'resume'` | `shipOfWhere(saved)` when `clearToResume` (the hand-made `SOLIDS` and the Maw: nothing generated is known yet), else `parkFor(saved.place, …)` for a hand-made place | `saved`, `place: saved.place`, and `settle: isPlaceId(saved.place)` (Task 6 settles a generated place once its sector is at hand) |
  | `shared` | `'arrival'` | `arrivalAt(rand, view).ship` | `arrival` (Task 2's object) |
  | otherwise (a pocket universe) | `'fallback'` | `startAt(rand)` | |

  - A saved position that isn't clear, with no hand-made place to fall back on, goes on to the arrival.
  - `Park` and `Start` are `{ x, y, z, heading }`, the shape `spawn(id, start)` takes.
  - `Plan` is `{ kind, ship, place?, settle?, saved?, travel?, arrival? }`, with each optional field only on the rows above that name it.

- [ ] **Step 1: Write the failing tests** in `start.test.js`, with a fake `places` whose `park` and `missing` answer from a table:
  - A pick wins over a link, a save and the arrival: `kind: 'sel'`, its `ship` `startAt`'s for the same `rand` stream, and the save isn't read.
  - `link: 'aurelia'` gives `parkFor('aurelia', [0, 0])` with a save present. `link: 'maw'` gives `startAt`'s answer for the same `rand`.
  - `link: 'E:1,0:3'`:
    - with `park` answering, it is that park and `travel: false`
    - with `park` null and `missing` true, it is `startAt`'s answer and `travel: true`
  - A clear save resumes at `shipOfWhere`'s position, even with an arrival to be had, and the plan carries `saved` as read. With `place: 'E:1,0:3'` it has `settle: true`; with `place: 'marvel'` it has `settle: false`.
  - A save inside marvel's air with `place: 'marvel'` resumes at `parkFor('marvel', …)`. One in the Maw's pull with no place gives `'arrival'`.
  - No save in the shared universe gives `'arrival'`, its ship within 1 of `arrivalAt(rand, view)`'s for the same `rand` stream and view, at Task 2's `phone` view and with no view (`ARRIVAL_FRAME`'s); the two parks differ. In a pocket (`shared: false`), it gives `'fallback'`, and a save there is never read (`saved` passed but `shared: false` gives `'fallback'`).
  - Every `ship` it gives has finite `x`, `y`, `z` and `heading`.
  - In `places/weight.test.js`'s pure `it.each`, the line `'src/components/universe/arrival/start.js',`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/arrival/start.test.js src/components/universe/places/weight.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command, then `npx vitest run src/components/universe/ship.test.js`. Expected: PASS, with `ship.test.js` unchanged, and `start.js` reaching no `three` or `react`.
- [ ] **Step 5: Commit.** `git commit -m "Where a new ship starts: a link or a pick, then where you left off, then the arrival, then anywhere as before"`

---

## PR 4c.2: The first minute, wired

### Task 5: Traffic crossing the arrival

**Files:**
- Modify: `src/components/universe/arrival/parks.js`, `parks.test.js` (`arrivalLane`)
- Modify: lane 4b's `src/components/universe/traffic.js` (`cross` beside `convoy`, `traffic.js:525-540` on `main`; `progress` and `end` beside `groups`, `:589`), `src/components/universe/traffic.test.js` (a new `describe`)

**Interfaces:**
- Consumes: `lanes.js`'s `clearance(pts, solids = SOLIDS)`; Task 2's `arrivalPark`, `View`, `ARRIVAL_FRAME` and `arrivalShot`'s camera; `ship.js`'s `PACE` (in the test); `sides.js`'s `SIDES` and `sideFor`.
- Produces:
  - **`arrivalLane(park, view = ARRIVAL_FRAME) → [p0, p1, p2] | null`**, in `parks.js`. `park` is Task 2's object, and `view` the one it was made for.
    - The middle point `q` is on the line to the world at `lane.at × dist`, raised by `lane.lift × r × lane.at`, so it passes in front of the world's upper half.
    - `p0` and `p2` are `q` moved along the camera's right (level) to where they project `lane.span` times the open part's half-width off its middle, one each side. With `z` the depth of `q`, that is `lane.span × (rect.w / h) × tan(FOV / 2) × z` each way.
    - `p1 = (p0 + p2) / 2`, pushed 10 along the nose.
    - It is null when `clearance(pts) ≤ 2` against `SOLIDS`.
  - **`traffic.cross(pts, { kinds = null, speed, event = 'arrival' } = {}) → group id | null`**, a column on the given lane, at `speed` units a second as given, as `escort(path, speed)` takes it. The first minute passes `ARRIVAL_VIEW.lane.speed × PACE` (3.6), so `traffic.js` imports nothing of the arrival's.
    - With no `kinds`, it flies three of the crew's side's `civil` and its `convoy.escort` in the middle, as `convoy` picks them.
    - With no side (no crew yet, or a ship of no side), four of every side's `civil` ships, drawn as `convoy` draws (`Object.values(SIDES).flatMap((s) => s.civil)`), with no escort. So it never waits on the crew.
    - It takes a slot past `MAX`, as lane 4b's convoy does.
    - It is null only for no `pts`.
    - Its group is listed by `traffic.groups` with `event: 'arrival'`.
  - **`traffic.progress(id) → number | null`**: the live group's `t`, 0 to 1 along its lane, or null when no group with that id flies (ended, run its course, or cleared by `setCrew`). It reads one group, not `groups`, which maps every group's ships each call.
  - **`traffic.end(id) → boolean`**: ends the live group with that id, through the file's own `end(group)` (`traffic.js`'s, which `clear()` loops over at `:575-577` on `main`), so its members go back to the pool and its slot is freed. False for an id that isn't flying. Task 6 ends the crossing with it at a held pose, and leaves every other group as it was.

- [ ] **Step 1: Write the failing tests.**
  - In `parks.test.js`, a new `it`, for every view of `VIEWS` and every park of `edges(view)`, with `arrivalLane(park, view)`:
    - the lane is not null
    - `q` projects inside the world's disc, within 0.6 of its radius of its middle
    - `p0` and `p2` project off the open part's sides, past them by 0.03 of its width or more
    - `q`'s depth is under `dist`
    - the lane is 40 to 130 long, so at `ARRIVAL_VIEW.lane.speed × PACE` it crosses in 10 to 40 s
  - In `traffic.test.js`, a new `describe('a column across the arrival')`, with the file's own `fakeFleet()` and seeded `Math.random`, and a level lane `pts` 100 long:
    - `cross(pts, { speed: 3.6 })` with the Star Wars crew spawns one group on `pts`, with `event: 'arrival'`, four members and its escort in the middle, at 3.6, even with `MAX` groups already flying
    - with no crew it spawns four of every side's `civil` kinds (each member's kind is one of them) and no escort, and gives its id
    - `cross(null)` gives null and spawns nothing
    - `progress(id)` is 0 at the spawn, grows over updates, and is null once the group has ended; it is null for an unknown id
    - `setCrew` to another side clears it: `progress(id)` is then null
    - `end(id)` of the crossing's group gives true and drops it from `groups`, leaving a convoy flying beside it in `groups` as it was; a second `end(id)` and an unknown id give false
    - the existing `describe('a convoy')` is unchanged
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/arrival/parks.test.js src/components/universe/traffic.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** `traffic.js`'s header's interface line gains `cross(pts, { kinds, speed, event })`, `progress(id)` and `end(id)`.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, every existing traffic test unchanged. At Task 1's numbers the lane is 43 to 128 long: 12 to 35 s at 3.6.
- [ ] **Step 5: Commit.** `git commit -m "A column of traffic crosses in front of the arrival's world, on a lane laid across the open part of the view, whoever the crew, and can be followed and ended on its own"`

### Task 6: The scene's first minute, and its saves

**Files:**
- Create: `src/components/universe/arrival/firstMinute.js`, `src/components/universe/arrival/firstMinute.test.js`
- Modify `src/components/universe/scene.js`, in place. Each change says its lines:
  - **The imports.** `import { createFirstMinute } from './arrival/firstMinute';` (+1).
    - `startAt` leaves the `./ship` import line (`:128`), which stays for its other names (0).
    - `import { takeArrival } from '../../lib/arrival';` (`:100`) goes whole: `takeArrive` (`:733`) is its only reader on `main` (−1). If a lane before this one gave it another reader, the line stays and the count says so; lint's `no-unused-vars` decides.
  - **The cockpit's portal arrival moves out** (−21, +1):
    - the comment, `let arriving` and `takeArrive` (`:728-737`, 10 lines)
    - `window.addEventListener('tp:arrive', takeArrive);` and `takeArrive();` (`:5624-5625`), and the removal (`:6339`)
    - in `fly()`, the block from `// out of the cockpit through Rick's portal` to its closing brace (`:4320-4327`, 8 lines), which becomes `if (first.portalDue(state)) gunThrough();` (+1)
  - **Created.** `const first = createFirstMinute({ … })` (+1), its deps on one line, on the line after the last of its values to be made: lane 4b's `const events = createSceneEvents(…)` (after `:1099`) or lane 6b's `const charted = createSceneChart(…)` (before `createScenePlaces`, about `:780`), whichever comes later.
    - That is above `const state` (`:1174`), `emit` (`:1719`) and `const wall` (`:1766`), each a `const` in its temporal dead zone while the line runs. So every dep made below the line is a thunk, and **making it calls none of its thunks**: it reads `takeArrival` (lib/arrival.js's own) and adds its own listeners, nothing more.
    - Calling `wall()` there would throw a `ReferenceError` and the universe scene wouldn't build. That happens whenever `tp-arrive-sector` is fresh, which is the cockpit's launch of Rick's cruiser through his portal (finding 25).
    - `emit` is made below the line and calls `first.heard`, so nothing emits before `first` exists.
  - **The spawn** (`if (!state.ship) {` at `:2211`, with lane 3's start expression and its `places.missing` line, and lane 4b's `if (!props.startAt) events.arrive();`). It becomes:

    ```js
    if (!state.ship) {
      state.ship = spawn(state.sel, first.start({ sel: state.sel, link: props.startAt, view: { w: size.w, h: size.h, rect: state.rect } }));
      camQOn = false;
      state.at = state.sel && orbiting(state.ship, null) === state.sel ? state.sel : null;
      state.yaw = -state.ship.heading;
      first.started(state.ship);
    }
    ```

    The four comment lines, lane 3's `travel` line and lane 4b's `arrive` line go into `firstMinute.js`, and `first.started` comes in: 12 lines become 7 (−5).
  - **Every frame.** In `render()`, on the line after lane 3's `places.update(…)`: `first.update(dt, state);` (+1).
  - **Heard.** In `emit` (`:1719`), first line: `first.heard(e);` (+1).
  - **The first frame's camera.** `if (!state.cam && !state.sel && !reduced && state.overview)` (`:5169`) gains `&& !first.straightIn()` (0). The arrival and a resume start straight in behind the ship, as a pick does. A wonder's or a place's link keeps today's swoop in from the overview.
  - **Gone.** In `dispose()` (`:6316`), after `disposed = true;`: `first.dispose();` (+1). It saves first.
  - **Dev hooks.** `__universeDebug` (`:5911`) gains `first: first.debug,` on its line (0). `__universe()` gains `start: first.debug.plan()?.kind ?? null,` beside lane 3's `place:` (+1).

  That is +7 (the import, the creation, the portal's line, `update`, `heard`, `dispose` and `start`) and −27 (21 of the portal arrival, 1 of the `takeArrival` import, 5 of the spawn): −20 in all, by `wc -l` before and after. `holdPose` (`:5857`) isn't touched: the first minute reads `state.held` itself.
- Modify: `scripts/universe-endless-check.mjs`. Lane 2's `start` step prints `__universeDebug.first.plan()` in its row, and a new step, `portal`, launches Rick's cruiser through his portal into a fresh page (Step 5).

**Interfaces:**
- Consumes:
  - Tasks 2–5 (`View` and `arrivalLane` from Tasks 2 and 5; `inTheWay` and `clearToResume` from Task 3; `traffic.cross`, `traffic.progress` and `traffic.end` from Task 5)
  - Task 3's `RESTARTING` (`lib/restart.js`), and `ship.js`'s `PACE`
  - `nav.js`'s `destinationById`, for a hand-made place's name
  - lane 3's `places` (`park`, `find`, `fetch`, `missing`, `here`, `resolve`, `solids`) and its light `atTime` and `isPlaceId` (`places/ids.js`)
  - Task 0's `parseSpaceId` (`lib/space/address.js`)
  - lane 2's `expanse.solids()`: the built generated bodies, `[{ id, at, r }]`, one array reused every frame (its Task 17)
  - lane 4b's `events.arrive()`
  - lane 6b's `createSceneChart(…).named(ids)`
  - `lib/arrival.js`'s `takeArrival`
  - `MAX_DT`'s scene clock (`state.clock`), lane 3's shared clock (`state.spaceT`) and `wall()`
- Produces: **`createFirstMinute(deps) → FirstMinute`**.
  - `deps`:
    - values, each made above the creation line and never reassigned: `saves` (`ctx.rt.saves`), `shared` (`universe === UNIVERSE`), `places`, `traffic` (null under reduced motion, `:858`), `events`, `charted`
    - thunks, each declared below the creation line or reassigned, and none called while it's made:
      - `note(text, seconds)`: the scene's `state.note` with `wall()`
      - `invalidate()`: `ctx.invalidate()`, as today's `takeArrive` asks for a frame when the flash's sector comes in
      - `travel(id, drive)`
      - `bodies()`: `expanse.solids()`
      - `onFoot()`, `frozen()` (`props.frozen`)
      - `here()`: `places.here()?.id ?? null`
      - `shown()`: `canvas.parentElement?.dataset.gl === 'on'`. `canvas` is `create(canvas, ctx)`'s own (`scene.js:489`), the renderer's `domElement`. Its host is the box `runtime/useWorld.js:231` marks `'on'` at the world's first frame drawn and shown; until then the runtime holds the canvas at opacity 0 behind the loading veil (`universe-check.mjs:169-174` says why it waits on the same thing).
      - `wall()`: the page's clock, for the cadence, the line and the portal's 12 s
      - `now()`: `state.spaceT`, the shared clock a save's `t` is on (Task 3)
    - optional, for the test: `rand = Math.random`, `win = window`, `doc = document`, and `takeArrival = takeArrival` (`lib/arrival.js` reads the global `window.sessionStorage`, so a Node test passes its own rather than mocking the module)

    ```
    FirstMinute = {
      start({ sel, link, view }) → Start | undefined, // spawn's second argument: Task 4's plan's ship
      started(ship),                              // after the spawn: the plan's follow-ups
      update(dt, state),                          // every frame
      heard(e),                                   // every event the scene emits
      straightIn() → boolean,                     // the camera starts behind the ship, no swoop from the overview
      portalDue(state) → boolean,                 // the cockpit's portal arrival, once, for the cruiser
      save(reason) → boolean,                     // write now, if every guard lets it
      debug: { plan(), arrival(), saved(), lane(), line(), offset(), save(reason) },
      dispose(),
    }
    ```

    - `debug.plan()` is Task 4's `Plan` with `settled` added, or null before the spawn. `settled` is null until a resume by a generated place has resolved it, then:
      - `'kept'`: the place stays put, and the ship wasn't moved
      - `'moved'`: a planet, a moon or a moving thing, and the ship was moved with it
      - `'parked'`: a generated body was in the way, and the ship was parked off it

      A resume by a hand-made place, or none, keeps `settled: null`.
    - `arrival()` is Task 2's object or null.
    - `saved()` is `readSaved(saves)`.
    - `lane()` is the crossing group's id while it flies (`traffic.progress(id) !== null`), else null.
    - `line()` is `{ text, from, until }` on `wall()`'s clock once the line has been noted, else null.
    - `offset()` is the ship less the current place's position now (`atTime(places.resolve(id), now())`, or the hand-made place's `at`), or null with no place or one not at hand. Task 10's `resume` compares it across a reload.

  - **`start`:** reads `readSaved(saves)` (only when `shared`) and gives `startPlan({ sel, link, saved, shared, view, rand, places })`'s `ship`. It keeps `view` for the crossing's lane: the park was made for it.
    - For a resumed generated place, it also asks `places.fetch(place)` straight away (one worker build), so the sector is at hand soon.
  - **`started`:**
    - `link` with `travel`: `travel(link, 'hyper')` (lane 3's line)
    - no link: `events.arrive()` (lane 4b's line), for a resume and the arrival alike
    - `'arrival'`, unless a portal arrival is pending (`portalDue` below):
      - the giant's naming armed (below)
      - the crossing armed for `FIRST.cross` s of the scene's clock on
      - the line armed
  - **`update`:**
    - **The line.** On the first update with `shown()` true: `note(ARRIVAL_WORDS.here[arrival.id], FIRST.line)`, or for a resume `note(ARRIVAL_WORDS.back(name), FIRST.line)`, `name` the place's (`destinationById(place)?.name` for a hand-made one, `places.resolve(place)?.name` for a generated one, else none). Once. `debug.line()` is then `{ text, from: wall(), until: wall() + FIRST.line }`. Not for a link, a pick or the portal.
    - **The giant named.** For an arrival, each update until `places.resolve(ARRIVAL_ID)` answers: then `charted.named([ARRIVAL_ID])`, once. `named` resolves through `places().resolve` with `build: false` (lane 6b), so a call before `E:0,0` is at hand would do nothing. The tries stop after `FIRST.name` s of the scene's clock past the spawn; a miss costs one `Map` lookup.
    - **The crossing.** From `FIRST.cross` to `FIRST.crossBy` s of the scene's clock past the spawn, at most once an update: when none of it flies (`lane` null, or `traffic.progress(lane)` null) and it hasn't yet been seen halfway across, `lane = traffic?.cross(arrivalLane(park, view), { speed: ARRIVAL_VIEW.lane.speed * PACE }) ?? null`.
      - So a crossing that a change of crew took away (`setCrew` clears every group, `traffic.js:342-353`) is asked for again. One that has passed in front of the world (`traffic.progress(lane) ≥ 0.5`, seen on any update) is done, and its end isn't followed by another.
      - `cross` no longer waits on the crew (Task 5), so a ship with no side still gets its column.
      - None, then or later, if `state.held` (a pose is held), if the stick was taken first (`state.flown`), if the ship has moved over 200 from the park, or if a portal arrival is pending.
    - **A held pose.** While `state.held`, if the crossing's group still flies (`traffic.progress(lane) !== null`), `traffic.end(lane)`, once. No crossing starts after. `state.held` is never cleared (`scene.js:5892`), so a held page never has one again.
    - **The resume's settle.** For a generated place (`settle`), before `WHERE.settle` s of the scene's clock and while `!state.flown`:
      1. **The shift, once.** When `d = places.find(place)` first answers: if the place moves, `shift = atTime(d, now()) − atTime(d, saved.t)` is added to the ship's `x`, `y` and `z`, heading kept, and `settled` is `'moved'`. Else the ship isn't touched, and `settled` is `'kept'`.
         - A place moves when its id has a planet part (`parseSpaceId(place).planet !== undefined`, a planet or a moon) or its row carries a `move` (lane 4a's comets).
         - A system, a station or a fixed thing never moves the ship. That is the case lane 3's `here()` gives most often: a pilot between the planets is in the system's zone, which reaches out to the park ring past the planets' bands. Parking them at `places.park(system)` would take them back out to that ring.
         - A place its sector, once at hand, doesn't hold (`find` null and `!places.missing(place)`) leaves the ship where it is, `'kept'`.
      2. **What's in the way, every update of the window.** `const hit = inTheWay(ship, bodies(), places.solids())`. A generated `hit` (`isPlaceId(hit.id)`): `state.ship = { ...state.ship, ...places.park(hit.id, [x, z]) }`, once, and `settled` is `'parked'`. `startPlan` could only see the hand-made `SOLIDS`; a planet or a moon that has come round onto the saved spot is known here from the frame its system is built.

      After the window, or once flown, nothing more. A parked ship that a body reaches meanwhile is pushed to its surface by `ship.js`'s `step` (`:613-641`), with no crash at no speed, and is then parked off by step 2.
    - **The cadence.** Not while any guard holds:
      - `state.held`, `state.dive`, `onFoot()`, `state.crash`, `state.jump` or `frozen()`
      - `!clearToResume(ship, bodies(), places.solids())`

      Then it writes `whereOf(ship, { place: here() ?? state.at, t: now() })` when `here() ?? state.at` differs from the last write's place, or when `WHERE.every` s of `wall()` have passed since it and the ship has moved `WHERE.moved` or more.
    - It keeps the last ship that passed every guard (`lastShip`) for the dive's write.
  - **`heard`.** A write an event asks for skips the cadence's time and distance, never its guards:
    - `{ type: 'land', what: 'hand', id }` (lane 5b's hand-off to the flight): writes `whereOf(lastShip, { place: id, t: now() })` at once. It is the one write from `lastShip`: by then `state.dive` is set and the ship is in the air, so the ship as it is can't pass.
    - `{ type: 'place', what: 'arrive' | 'dock' }` (lane 3): writes the ship as it is at once, if every guard passes, else nothing. A ship docked inside a station's air is not written.
  - **The page going.** It listens itself (removed in `dispose`) for `pagehide` on `win` and `visibilitychange` on `doc` (when `doc.hidden`), and calls `save('hidden')`. `dispose` saves, then removes them. `save` keeps every guard too.
  - **Starting over.** It listens on `win` for `RESTARTING` (Task 3's `restartSite` sends it before it forgets the visit's keys). From then on nothing is written: not by the cadence, an event, `save`, `pagehide`, `visibilitychange` or `dispose`. The reload `restartSite` makes fires `pagehide` after the key is gone, and a write then would undo "Start over".
  - **`portalDue(state)`:** the cockpit's portal arrival, as today's `takeArrive` and `fly()`'s block have it:
    - At creation it calls the `takeArrival` dep and keeps the sector as `{ sector, until: null }`: no `wall()`, which is in its dead zone then. The first `update` or `portalDue` after stamps `until = wall() + 12`.
    - Its own `tp:arrive` listener on `win` reads `takeArrival` again, stamps `until = wall() + 12` at once (the scene is made by then) and calls `invalidate()`.
    - True once when `state.kind === 'cruiser'`, with a ship, not jumping and not held, and the ship isn't in that sector already. The sector is dropped then either way, or once `wall()` passes `until`.
    - It says nothing and arms nothing of the arrival's while it's pending at the spawn: the arrival gives way to Rick's portal.
  - **`straightIn()`:** true for `'resume'` and `'arrival'` plans, and false otherwise, so every link frames as today.

- [ ] **Step 1: Write the failing tests** in `firstMinute.test.js`, over fakes:
  - `saves`: `createSaves({ local })` over a `Map`
  - `places`: `park`, `find`, `fetch`, `missing`, `here`, `resolve` and `solids` from a table. For the settle's tests, `find` and `resolve` answer real Destinations from lane 3's `resolvePlace(id, { t })` (`places/resolve.js`, in the test only), so `atTime` reads a real orbit.
  - `traffic` records `cross` and `end`, and answers `progress(id)` from a table the test sets; `events` records `arrive`; `charted` records `named`
  - `bodies` and `shown` as `vi.fn`s the test sets; `now` and `wall` as counters the test moves; `invalidate` as a `vi.fn`
  - a `note` spy; `win` and `doc` as `EventTarget`s; `takeArrival` as a `vi.fn`
  - `state` as a plain object, with a `clock`

  The tests:
  - **Made before the scene's clock.** Every thunk dep (`note`, `invalidate`, `travel`, `bodies`, `onFoot`, `frozen`, `here`, `shown`, `wall` and `now`) is a `vi.fn` that throws a `ReferenceError` until the test sets `allowed`. `takeArrival` answers `'rickmorty'`. Then:
    - `createFirstMinute(deps)` doesn't throw, and none of the thunks was called
    - once allowed, the first `update` stamps the sector's 12 s from that update's `wall()`. With the cruiser flying 11.9 s of `wall()` after it, `portalDue` is true. In a second run, where the cruiser first flies 12.1 s after it, `portalDue` is false.
  - **The arrival.** With no save, `start({ view })` at Task 2's `phone` view gives `arrivalPark`'s park for that view, and `started` calls `events.arrive()` once. One `cross` comes once the clock passes `FIRST.cross`, with `arrivalLane(park, view)`'s points and `{ speed: ARRIVAL_VIEW.lane.speed * PACE }`, and no second while `progress` answers.
  - **The crossing, asked for again.**
    - With `progress(id)` answering 0.1, then null from the third update (a change of crew cleared it), a second `cross` comes on that update, and `debug.lane()` is the new id.
    - With `progress` answering 0.6 before it goes null (it passed in front of the world), no second `cross` comes.
    - With every `cross` answering null, it is asked once an update until `FIRST.crossBy` s of the clock past the spawn, and never after.
  - **The line waits for the canvas.** With `shown()` false over 40 updates and 30 s of `wall()`, nothing is noted and `debug.line()` is null. On the first update with `shown()` true, `note(ARRIVAL_WORDS.here[id], FIRST.line)` once, `id` the arrival's world, and `debug.line()` is `{ text: ARRIVAL_WORDS.here[id], from: w, until: w + FIRST.line }` with `w` that update's `wall()`. Later updates note nothing.
  - **The giant named, once its sector lands.** With `places.resolve('E:0,0:w4')` null for two updates and answering on the third, `charted.named` isn't called on the first two and is called once with `['E:0,0:w4']` on the third, and never again. With `resolve` never answering, the tries stop after `FIRST.name` s of the clock: a spy on `resolve` counts no call after that.
  - **No crossing after the stick.** With `state.flown` set before `FIRST.cross`, there is no `cross`.
  - **No crossing at a held pose.**
    - With `state.held` set before `FIRST.cross`, there is no `cross`, then or after.
    - With the crossing flying (`debug.lane()` is its id), `state.held` set makes the next update call `traffic.end(id)` once. `debug.lane()` is then null (`progress` answers null after the `end`), and no second `cross` comes over 60 s of the clock.
  - **A resume.**
    - With a save written by `writeSaved`, `start({})` gives `shipOfWhere`'s position. There's no `named` and no `cross`. `arrive` is called, and the line is `ARRIVAL_WORDS.back('Avengers HQ')` for `place: 'marvel'` once `shown()` is true.
    - With `place: 'E:1,0:3'`, `fetch` is asked at `start`.
  - **A resume between the planets stays put.** A save inside `E:1,0:3`'s zone, between its planets, with `place: 'E:1,0:3'` (the system, as lane 3's `here()` gives it there). `find` answers on the third update. Over 40 updates and the whole `WHERE.settle`, the ship stays at `shipOfWhere`'s position to 1e-9, `places.park` is never called, and `debug.plan().settled` is `'kept'`.
  - **A resume by a planet keeps the pilot's offset.** A save 300 units off `E:1,0:3:2` (its `atTime` at `t0 = 1.76e9`, the shared clock), with `place: 'E:1,0:3:2'`, `t: t0`, and `now()` at `t0 + 600`. When `find` answers on the third update, the ship is `atTime(d, t0 + 600)` plus the saved offset, to 1e-6, once. `settled` is `'moved'`, and `debug.offset()` equals the saved offset to 1e-6. With `state.flown` before that, or the clock past `WHERE.settle`, the ship isn't moved.
  - **A generated body in the way.** A save with `place: 'E:1,0:3'` where, from the fourth update, `bodies()` holds `{ id: 'E:1,0:3:1', at: <beside the ship>, r: 40 }` with the ship inside 1.25 of its radius. The ship is set to `places.park('E:1,0:3:1', [x, z])`'s answer once, and `settled` is `'parked'`. The same body appearing after `WHERE.settle` moves nothing.
  - **A link wins.** With a save and `link: 'aurelia'`, the ship is parked at `aurelia`. There's no line, no `cross`, no `arrive` (lane 4b's rule), and the save is unchanged until the cadence writes.
  - **A pocket** (`shared: false`): nothing is read or written over a whole flight of updates, and the start is `startAt`'s.
  - **The cadence.**
    - Flying 25 units over 6 s writes once, with `t` the `now()` of that update. 10 units over 60 s writes nothing.
    - A new `here()` writes at once.
    - Each of `state.held`, `state.dive`, `onFoot()`, `state.crash`, `state.jump` and `frozen()` writes nothing over 30 s of moving.
    - So does a ship inside a generated body's air (`bodies()`), inside a station's (`places.solids()`) and in the Maw's pull.
  - **An event's write keeps the guards.**
    - `heard({ type: 'place', what: 'dock' })` writes at once, inside the 5 s, with the ship clear.
    - The same with `state.held` set, with `frozen()` true, or with the ship inside a fake station's 1.25 radii (`places.solids()`), writes nothing.
    - `'arrive'` does the same.
  - **The dive.** Updates flying to `P`, then `state.dive` set and the ship moved on, then `heard({ type: 'land', what: 'hand', id: 'E:1,0:3:2' })`: the save is at `P`, with `place: 'E:1,0:3:2'`.
  - **The page going.** A `pagehide` writes; `dispose()` writes and then removes its listeners (a later `pagehide` writes nothing). A `visibilitychange` with `doc.hidden` true writes. A `pagehide` with `state.held` set writes nothing.
  - **Starting over.** After `win.dispatchEvent(new Event(RESTARTING))`, nothing writes: 30 s of flying 25 units every 6 s, `heard({ type: 'place', what: 'dock' })`, `save('check')`, a `pagehide`, a `visibilitychange` with `doc.hidden`, and `dispose()`. The store's `tp-universe-where`, removed by the test as `forgetVisit` would, stays gone.
  - **Another tab.** A `storage` event or a `saves.set` from elsewhere after `start` changes nothing of the ship's.
  - **The cockpit's portal** (moved, so its behaviour is pinned here). With the `takeArrival` dep answering `'rickmorty'` once, then null, `portalDue` is false until the ship exists and `kind` is `'cruiser'`, then true once, and false after 12 s of wall. A `tp:arrive` on `win` reads `takeArrival` again, stamps its 12 s from that `wall()` and calls `invalidate` once. For any other kind it's never true. With the ship already in that sector it's false, and the sector is dropped. When pending at the spawn, `started` notes no line and arms no crossing.
  - **`straightIn`:** true for an arrival and a resume; false for `'sel'`, `'link'` and `'fallback'`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/arrival/firstMinute.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement and wire.**
  - Count `scene.js`'s lines before and after.
  - Then run `grep -n "let arriving\|arriving &&\|takeArrive\b\|takeArrival\|startAt()" src/components/universe/scene.js`. Expected: nothing. (The word `arriving` stays in four comments, `:942`, `:1926`, `:4230` and `:4496`, and in the remover's `'arriving'` phase at `:1090`, none of which is this.)
- [ ] **Step 4: Run them and see them pass.** Run `npm test` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: See it in the browser.** First add the `portal` step to `scripts/universe-endless-check.mjs`, in a context of its own:
  - Its init script sets `localStorage['tp-universe-ship']` to `"cruiser"` and `sessionStorage['tp-arrive-sector']` to `JSON.stringify({ sector: 'rickmorty', at: Date.now() + 600000 })`. `lib/arrival.js` keeps the sector 20 s (`FRESH`), and in software GL the scene is made a minute or more after the page starts. An `at` ten minutes ahead keeps it fresh however long that takes, so the scene reads it as it's made, the path at risk.
  - It opens `#/universe` and waits for the ship and its model, as lane 2's `start` does. Then `__universeDebug.first.plan().kind` is `'arrival'` (no link, no save).
  - It waits (wall, 120 s at most) until the ship is in Rick's dimension: `(await import('/src/components/universe/layout.js')).mapSectorOf(x, y, z) === 'rickmorty'`, read in the page (the check's dev server serves the source).
  - `first.debug.line()` and `first.debug.lane()` stay null throughout: the arrival gave way.
  - The page had no errors. A `ReferenceError` as the scene is made shows as one, and as no `__universeDebug` at all: the wait for the ship fails, naming it.
  - It shoots `portal.jpg`.

  Then run `node scripts/universe-endless-check.mjs --quality mid --only start,portal`. Expected:
  - exit 0. The `start` row's plan reads `arrival` and one of the four worlds, and the `portal` row is in Rick's dimension.
  - no console errors on either row
  - shoot `arrival-first.jpg` into the evidence folder, with `portal.jpg`
- [ ] **Step 6: Commit.** `git commit -m "A new pilot arrives by one of four worlds with the giant behind it, a returning one resumes where they were, and both are saved as they fly"`. The body:
  - has `scene.js`'s two counts
  - says lane 3's link line and lane 4b's gentle-minute line moved into the first minute unchanged
  - says why the line waits for the canvas, why the crossing ends at a held pose and is asked for again until it has crossed, why a resume by a system is never moved, why making it calls no thunk, and why nothing is written once the site is starting over

### Task 7: The arrival as a pose

**Files:**
- Modify: `src/components/universe/poses.js` (`POSES.arrival`, a marker row `{ arrival: 'marvel' }`, built in `poseFor`'s own branch), `src/components/universe/poses.test.js`
- Modify: `scripts/universe-check.mjs`:
  - `POSES` gains `'arrival'`
  - each pose's record gains `crossing`: `window.__universeDebug.first?.lane?.() ?? null`. It is read in the `numbers` evaluate (`const numbers = await page.evaluate(async (n) => {`) after the frames are counted, and returned beside its other numbers (`return { calls, triangles, shipPx, drawn, frameMs: …, frameMsMedian: …, memory: … }`). A pose with a crossing still flying fails, naming it.

**Interfaces:**
- Consumes: Task 2's `arrivalPark`, `arrivalShot` and `ARRIVAL_FRAME`; `FOV` and `CHASE` (`flight.js`); Task 6's `first.debug.lane()`.
- Produces: **`poseFor('arrival')`**:
  - `{ name, planet: 'marvel', at, heading }` from `arrivalPark('marvel', { view: ARRIVAL_FRAME })` (no turn, `near` 1): a desktop's park, as `universe-check` runs at 1280 × 720
  - `eye = at + (−f · cos(tilt) + up · sin(tilt)) × CHASE.dist` and `look = eye + (f · cos(tilt) − up · sin(tilt)) × 40`, where `f` is the heading's forward and `tilt` is `CHASE.tilt`
  - so `holdPose` frames it as the chase camera does. Nothing is made at `poses.js`'s top level.
- **Measured without its crossing.** From Task 6 every pose's page starts at the arrival, and it draws for a minute or more in software GL before `universe-check` holds the pose. By then the crossing (1 s of the scene's clock in) is flying. The hold ends it (Task 6), so every pose, `arrival` included, is measured with no crossing. Its place and its framing are fixed by `arrivalPark('marvel')`, so the picture is the same however long the page took. The crossing's own picture is Task 10's `start` step's (`arrival.jpg`), flown, not held.

- [ ] **Step 1: Write the failing test.**
  - `poseFor('arrival').at` is within 1e-9 of `arrivalPark('marvel', { view: ARRIVAL_FRAME }).ship`.
  - Projected from its `eye` toward its `look` (flight.js's `project` maths, at `ARRIVAL_FRAME`'s 1280 × 720 and with its lens shift), the world's and the giant's centres are within 2% of the open part of `arrivalShot(arrivalPark('marvel', { view: ARRIVAL_FRAME }), ARRIVAL_FRAME)`'s.
  - `POSES.arrival` holds no array or object of rows.
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/poses.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, and add the name to `universe-check.mjs`'s `POSES`.
- [ ] **Step 4: Run it and see it pass.** Same command. Expected: PASS.
- [ ] **Step 5: Measure it.** Run `node scripts/universe-check.mjs --quality mid --poses arrival,overview,falcon-sun --out lab/universe/after-4c-7/mid` (the arrival, and the two baseline poses the crossing would most likely have shown in). Expected:
  - the shot shows Marvel's world low in the frame, lit, with Tempest above and behind it, and no column crossing it
  - `crossing: null` at all three
  - `overview`'s and `falcon-sun`'s calls and triangles equal to Task 1's Step 5 (`falcon-sun`) and Step 0 (`overview`, plus the giant's two triangles)
  - no errors
  - `frameMsMedian` at most 1.15 times the median of the six planet poses' in Task 1's Step 0 (`middleearth-limb`, `rickmorty`, `gaming`, `caribbean`, `middleearth`, `breakingbad`), at mid

  Copy the shot and JSON to the evidence folder.
- [ ] **Step 6: Commit.** `git commit -m "The arrival as a pose, measured as the chase camera frames it, with no crossing at any held pose"`

### Task 8: The flat map shows the saved ship

**Files:**
- Modify: lane 6a's `src/components/universe/FlatMap.jsx`
- Modify: lane 6a's `src/components/universe/MiniMap.jsx`, its header comment only. Its `ship` paragraph says "nothing passes one yet: with 3D off nothing knows where the ship is until its place is saved" (`MiniMap.jsx:26-28` on `eu/lane-6a`).
- Create: `src/components/universe/FlatMap.test.jsx`
- Modify: lane 3's `src/components/universe/places/weight.test.js`: `FlatMap.jsx` joins Task 3's "the saved position reaches no generator" `it.each`, as a new line
- Modify: `scripts/navmap-check.mjs` (its `minimap` mode)

**Interfaces:**
- Consumes: Task 3's `readSaved` and `shipOfWhere`; `runtime/local.js`'s `localSaves`; lane 6a's `MiniMap` (`ship`) and `useChartView` (`ship`).
- Produces: **`FlatMap({ selected, startAt, onSelect, saves = localSaves() })`**.
  - It reads `readSaved(saves)` once (a `useState` initialiser) and hands `shipOfWhere(…)` (or null) to `MiniMap`'s `ship` and `useChartView`'s `ship`.
  - So "Back to the ship" (lane 6a's tool) works with 3D off.
  - Home's teaser (`MiniMap kind="fandom"`, `Interests.jsx`) is untouched, and shows no ship.

- [ ] **Step 1: Write the failing test** (`renderToStaticMarkup`, a fake `saves` over `createSaves`):
  - With a save at `[1, 2, 3]` from home, the markup has a `g.minimap-ship` without `data-edge`.
  - With a save 9.6 million out, it has `data-edge`.
  - With no save, a broken one, or a store that throws, there's no `minimap-ship`.
  - Lane 6a's `MiniMap.test.jsx` is unchanged and passes.
  - In `places/weight.test.js`, the line `'src/components/universe/FlatMap.jsx',` in Task 3's `it.each`. It passes before the change too: it pins that reading the save brings no generator into the flat map's chunk.
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/FlatMap.test.jsx src/components/universe/places/weight.test.js`. Expected: `FlatMap.test.jsx` FAILS (no `minimap-ship`); `weight.test.js` passes.
- [ ] **Step 3: Implement.**
  - `MiniMap.jsx`'s header: its `ship` paragraph's "nothing passes one yet: with 3D off nothing knows where the ship is until its place is saved" becomes "FlatMap passes the ship where it was left (`tp-universe-where`, arrival/where.js), so it shows with 3D off; the teaser passes none".
  - `FlatMap.jsx`'s header says where its ship comes from, and that it reads the save once.
- [ ] **Step 4: Run it and see it pass.** Run `npx vitest run src/components/universe`. Expected: PASS, and `FlatMap.jsx` reaches no `GENERATOR` file.
- [ ] **Step 5: Check it in the browser.** The `minimap` mode gains a step:
  - An init script sets `tp-3d` to `off` (raw) and `tp-universe-where` to `{"v":1,"data":{"sector":[80,0,0],"at":[10,0,0],"heading":0,"place":null,"t":1}}`.
  - Open `#/universe`, wait for `.universe-flat .minimap-ship[data-edge]`, and shoot `18-minimap-saved-ship`.

  Run `OUT=docs/superpowers/evidence/endless-universe-lane-4c/navmap CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs minimap` (dev server per Global Constraints). Expected: `all ok`.
- [ ] **Step 6: Commit.** `git commit -m "With 3D off, the flat map shows where you left your ship"`

### Task 9: One press for Home

Home is always the jump. From 9.6 million out, the drive the visitor picked would be hours: super speed (900 units a second) is about 3 h, and cruise about 9 h. The scene's `travel(id, 'hyper')` falls back to super speed at once when the jump isn't ready (`scene.js:1811-1830`: charging for 5 s after a jump, `HYPER.recharge` at `nav.js:66`, or jammed). So a press while it isn't ready waits for it, in the open nav map, and says so.

**Files:**
- Create: `src/components/universe/chart/home.js`, `src/components/universe/chart/home.test.js` (the rule, pure)
- Create: `src/components/universe/chart/HomeOffer.jsx`, `src/components/universe/chart/HomeOffer.test.jsx`
- Modify: `src/components/universe/NavMap.jsx` (the status block, `navmap-status`, `NavMap.jsx:347` on lane 6a's branch, after lane 6b's holder line), `src/lib/words.test.js` only if its `FILES` doesn't already read `chart/*.jsx` (lane 6a's Task 8 added it)
- Modify: `src/pages/Universe.jsx`, three lines in place, so Home leaves the drive picked as it was:
  - `travel`'s options (`:449`): `{ tour: onTour = false } = {}` becomes `{ tour: onTour = false, keep = false } = {}` (0)
  - `setDrive(d);` (`:450`) becomes `if (!keep) setDrive(d);` (0)
  - NavMap's `onTravel={(id, d) => travel(id, d)}` (`:610`) becomes `onTravel={(id, d, o) => travel(id, d, o)}` (0). NavMap's other calls pass no third argument, so they set the drive as today.
- Modify: `scripts/navmap-check.mjs` (its `far` mode)

**Interfaces:**
- Consumes: Task 3's `farFromHome`; `NAV.home`, `NAV.homeTitle`, `NAV.homeWait` and `NAV.homeJammed`; NavMap's own `hyper` (`now?.hyper ?? { ready: true, wait: 0, why: null }`) and `canFly` (`flying && !now?.foot && !now?.crashed`), both at `NavMap.jsx:150-152` on lane 6a's branch.
- Produces:
  - **`homeOffer({ ship, canFly, hyper, asked }) → { show, label, title, disabled, go }`**, in `chart/home.js`, pure:
    - `show`: `canFly && ship && farFromHome(ship)`. Not on foot, not in a crash, not near home, not in the Curve.
    - not `asked`: `label: NAV.home`, `title: NAV.homeTitle`, `disabled: false`, `go: false`
    - `asked` and `hyper.ready`: `go: true`, so the jump is asked now
    - `asked` and charging: `label: NAV.homeWait(Math.ceil(hyper.wait))`, `disabled: true`, `go: false`
    - `asked` and jammed (`hyper.why === 'interdicted'`): `label: NAV.homeJammed`, `disabled: true`, `go: false`
  - **`HomeOffer({ ship, canFly, hyper, onHome })`**: a `button.btn.navmap-home` from `homeOffer`, or null when `!show`.
    - A press with the jump ready calls `onHome()` at once, inside the press, so the jump can sound (the page's `audioContext()`).
    - A press otherwise sets `asked` (`useState`). An effect calls `onHome()` once `homeOffer(…).go`, then clears `asked`.
    - Closing the map (the offer unmounts) drops a waiting press. A press again does it again.
  - **In `NavMap`:** `<HomeOffer ship={now?.ship ?? null} canFly={canFly} hyper={hyper} onHome={() => onTravel('home', 'hyper', { keep: true })} />`. The trip is lane 3's, to the Home station, by the jump, at any distance.

- [ ] **Step 1: Write the failing tests.**
  - In `home.test.js`:
    - a ship 9.6 million out, `canFly`, the jump ready: shown, `Fly home`, titled `Jump back to the home system`, not disabled, no `go`
    - the same `asked`: `go`
    - **The jump charging** (`{ ready: false, wait: 3.2, why: 'charging' }`) and `asked`: `Jumping home in 4 s`, disabled, no `go`. The same with `ready: true` next: `go`. Not asked while charging, it reads `Fly home`, enabled: the press is what waits.
    - jammed and `asked`: `NAV.homeJammed`, disabled, no `go`
    - not shown: a ship at home, one 50,000 above it, one in the Curve, no ship, and a far ship with `canFly` false (on foot, or crashed)
  - In `HomeOffer.test.jsx` (`renderToStaticMarkup`): a far ship with `canFly` gives one `button.btn.navmap-home` reading `Fly home` with that title; `canFly` false gives `''`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/home.test.js src/components/universe/chart/HomeOffer.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implement**, render it in `NavMap`, and give the page's `travel` its `keep`.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe src/lib/words.test.js src/pages`. Expected: PASS.
- [ ] **Step 5: Check it in the browser.** The `far` mode, after its pinned-ship shot:
  1. Pick cruise (`.navmap-drive[data-drive="cruise"]`).
  2. **Charging.** `__universeDebug.state.hyperAt = performance.now() / 1000` (the jump just used). Wait for `.navmap-home`, click it, and check it reads `Jumping home in` and is disabled.
  3. Wait (wall, 120 s at most) until `window.__universe().at === 'home'`. The trip was the jump: `__universeDebug.state.jump` was set on the way, polled with the wait.
  4. `.navmap-drive[aria-checked="true"]` is still cruise.
  5. Check `.navmap` closed or the chart re-centred on home, and shoot `19-home-from-far`.

  Run `… node scripts/navmap-check.mjs far`. Expected: `all ok`.
- [ ] **Step 6: Commit.** `git commit -m "The nav map jumps you home in one press when you're far out, waiting out the charge, and leaves your drive as it was"`

---

## PR 4c.3: The route

### Task 10: The endless check starts at the arrival, resumes, and goes home

**Files:**
- Modify: `scripts/universe-endless-check.mjs` (lane 2's, with lanes 1, 3, 4a, 4b, 5b, 6a and 6b's steps)

**Interfaces:**
- Consumes:
  - `__universeDebug.first` (Task 6), `.gargantuans.debug` (lane 4a: `rows()`, `screen(id)`), `.traffic.groups`, `.charted.known()` (lane 6b's rows, `{ id, how }`), `.teleport` (lane 2), `.state.rect` (`scene.js`'s `measure`)
  - Task 2's `arrivalShot`, imported in the page from the check's dev server (`await import('/src/components/universe/arrival/parks.js')`)
  - `__universe().start` (Task 6)
  - lane 6a's `shipOnChart`
  - Task 2's `ARRIVAL_WORDS`, read as text from `words.js` (the check is Node; it imports `src/components/universe/words.js` directly, which imports nothing)
- Produces: the steps below, each recording lane 2's columns (pops, `workMs`, calls and triangles, things within 9,000, the nearest, errors) and lane 6b's `map` column.

- [ ] **Step 1: Extend lane 2's `start` step.** It opens a fresh context (no `tp-universe-where`, so it holds whether `start` runs first or alone). Once the ship and its model are there (`__universe().ship` and `__universeDebug.state.model`), as lane 2's step waits for them:
  - **Hands off.** The step touches no key, control or stick until item 5 has seen the crossing. Any input before `FIRST.cross` sets `state.flown`, which calls the crossing off.
  1. `__universeDebug.first.plan().kind` is `'arrival'`, and its world is one of the four.
  2. The ship is within 1 of `first.debug.arrival().ship`.
  3. Wait until `gargantuans.debug.rows()` lists `'E:0,0:w4'`. Then `screen('E:0,0:w4')` is inside the open part (`__universeDebug.state.rect`), in its upper half.
  4. **The line, from when it could be seen.** From the page's load, the step polls the host's `data-gl` (`__universeDebug.renderer.domElement.parentElement.dataset.gl`) every 250 ms, keeping the page's `performance.now() / 1000` at the last poll that found it not yet `'on'` (`tOff`). Wait (wall, 120 s at most) until `first.debug.line()` isn't null. Then:
     - its `text` is `ARRIVAL_WORDS.here[id]`, `id` the arrival's world (`first.debug.arrival().id`), and `until − from` is 6 (`FIRST.line`)
     - its `from` is at or after `tOff`: the line began only once the canvas could be seen
     - if `performance.now() / 1000 < until` when read, `.universe-prompt`'s text is that `text`. The DOM is checked while the line is live, never raced for after.
  5. Wait (the scene's clock, 30 s at most) until `traffic.groups` has a group with `event: 'arrival'` and a member alive, and `first.debug.lane()` is its id.
  6. Wait (the scene's clock, 30 s at most) until `charted.known().some((k) => k.id === 'E:0,0:w4')`.
  7. Shoot `arrival.jpg`.
  8. **On a phone held upright.** In a context of its own at 390 × 844 with touch (`{ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 1 }`, as `entry-check.mjs`'s phone is), at mid, with no save, wait for the ship, its model and `data-gl` `'on'`. Then:
     - `__universeDebug.state.rect` is Task 2's `phone` rect (the sheet up) within 8 px on each of `y`, `h` and `sy`, or its `thumbs` rect if the sheet is already put away. If it is neither, Task 2's `VIEWS` take the measured rect, Task 2's test runs again with it, and the commit says so.
     - `arrivalShot(first.debug.arrival(), { w: innerWidth, h: innerHeight, rect: state.rect })`, run in the page, puts the world's whole disc and the giant's middle inside the open part
     - shoot `arrival-phone.jpg`, and copy `state.rect` into the README

  Lane 4b's `arrival` step, the gentle event in the first 60 s, stays as it is, after this one.
- [ ] **Step 2: Add the `resume` step.** Two rounds, each a save, a reload in the same context (so the save stays) and checks.
  - **Round 1, between the planets.** Where the ship is after `system`, or, run alone, `teleport` into `E:1,0`'s first system's zone, between its star's park and its first planet's band, and wait until its bodies are built.
    1. `__universe().place` is the system's id (lane 3's `here()` there), not a planet's. If the system's bands leave no gap, take the next system, up to five, as lane 5b's `dive` does.
    2. Read `first.debug.offset()` (`off0`) and the ship's position. Call `first.debug.save('check')` and read `localStorage['tp-universe-where']`.
    3. Reload. Once the ship and its model are there, `plan().kind` is `'resume'`, and the ship is within 1 of `shipOfWhere(saved)`.
    4. Wait (the scene's clock, 30 s at most) until `plan().settled` isn't null. It is `'kept'`, and the ship is still within 1 of where it resumed: it was never moved, not to the system's park ring nor anywhere else.
    5. No `traffic.groups` entry has `event: 'arrival'`.
    6. `first.debug.line().text` is `ARRIVAL_WORDS.back(name)`, `name` the system's (with the same live-DOM rule as Step 1's line).
    7. Shoot `resume.jpg`.
  - **Round 2, at a planet.** `travel('<the system's first planet>', 'hyper')` and wait for `__universe().place` to be its id. Then:
    1. Read `off0 = first.debug.offset()`, the ship less the planet now. Save, and reload.
    2. Wait (the scene's clock, 30 s at most) until `plan().settled` isn't null. It is `'moved'` (the planet has gone on round its orbit over the reload's minute), and `first.debug.offset()` is within 1 of `off0`: the pilot is where they were, by the planet.
    3. Shoot `resume-planet.jpg`.
  - **Round 3, starting over.** With round 2's save in `localStorage`:
    1. Press the panel's "Start over" (`UniversePanel.jsx:137`, the `button.universe-back` reading "Start over"), and wait for the reload's `load`.
    2. `localStorage.getItem('tp-universe-where')` is null. The reload's `pagehide` wrote nothing back (Task 6).
    3. Open `#/universe` again (the context's init script sets the ship and the intro seen again on every page, as it did at the first) and wait for the ship. `plan().kind` is `'arrival'`.
    4. Shoot `start-over.jpg`.
- [ ] **Step 3: Add the `home` step.**
  1. `teleport` to `[3 × 120000, 0, 0]`.
  2. Open the nav map (`m`), click `.navmap-home`, and wait (wall, 120 s) until `__universe().at === 'home'`. The trip was the jump (`__universeDebug.state.jump` seen set on the way).
  3. Shoot `home.jpg`.
- [ ] **Step 4: Add the `mini` step.**
  1. In a context of its own with `tp-3d` off and Task 8's far save, open `#/universe` and wait for `.universe-flat .minimap-ship[data-edge]`.
  2. Again with a save at `[0, 0, 0]`'s `[100, 0, 100]`: `.minimap-ship` without `data-edge`.
  3. Shoot `mini.jpg`.

  It has no scene, so it skips the per-step `shipOnChart` call, and its `map` reads `'—'`. Task 11 makes that one rule for every step off the universe's page.
- [ ] **Step 5: Re-run lane 3's `link` step with a save behind it.**
  - Seed `tp-universe-where` with Step 2's value.
  - `#/universe/marvel`: the ship parks at Marvel (`__universe().at === 'marvel'`), and `start` is `'sel'`.
  - `#/universe/aurelia`: `start` is `'link'`, and the ship is within `reach + 20` of Aurelia.
  - `#/universe/E:1,0:0:0`: `start` is `'link'`, and lane 3's own checks hold.
  - No resume happens in any of them.
- [ ] **Step 6: Run them.** Run `node scripts/universe-endless-check.mjs --quality mid --only start,system,resume,home,mini,link`. Expected:
  - exit 0, and every row `map: ok` but `mini`'s `—`
  - no console errors
  - the shots named above in the evidence folder: `arrival`, `arrival-phone`, `resume`, `resume-planet`, `start-over`, `home` and `mini`
- [ ] **Step 7: Commit.** `git commit -m "The endless check starts at the arrival on a desktop and a phone, resumes after a reload by a system and by a planet, starts over as a first visit, jumps home in one press, and finds the saved ship with 3D off"`

### Task 11: The whole route, in the spec's order, and its checklist

**Files:**
- Create: `scripts/lib/endless-route.mjs`, `scripts/lib/endless-route.test.mjs`
- Modify: `scripts/universe-endless-check.mjs`:
  - `--route`, and the checklist printed at the end of any run
  - the recorder's `page`, `frameMs` and `next` columns, and `workBudget` beside lane 2's `workMs`
  - lane 6a's per-step `shipOnChart` call, made on the universe's page alone
  - lane 1's `nebula` step, only if no lane has added it (Step 3)

**Interfaces:**
- Consumes: lane 2's recorder (`pops`, `workMs` against `budget.expanseMs`, calls and triangles, `within9`, `nearest`, errors); lane 6b's `map` column; lane 1's `scripts/lib/nebula-measure.mjs` (`diffMask`, `centroid`, `bestRotation`) and its poses `veil-side` and `in-nebula`; `__universe().frames(n)`; `ship.js`'s `SHIP.pulse`, in the test only.
- Produces, in `endless-route.mjs`, which imports nothing:
  - **`ROUTE`**: the spec's nine legs in order, each `{ leg, says, steps }`. `says` quotes the spec's words. Every name in `steps` is a step of the script.

    | leg | the spec's words | steps |
    |---|---|---|
    | `arrival` | "starts at the arrival" | `start`, `arrival` |
    | `rim` | "crosses the old rim" | `old-rim` |
    | `boundary` | "crosses a sector boundary" | `boundary` |
    | `system` | "enters a generated system" | `system` |
    | `nebula` | "flies into a nebula" | `nebula` |
    | `gargantuan` | "reaches a gargantuan" | `gargantuan` |
    | `climb` | "climbs 50,000 units straight up" | `climb` |
    | `land` | "lands on a generated planet" | `dive`, `ground` |
    | `return` | "returns" | `back` |
  - **`SWEEPS`**: `[{ leg: 'things', says: 'forces every kind of thing … once', steps: ['things'] }, { leg: 'events', says: '… and every event once', steps: ['events'] }]`
  - **`EXTRAS`**: every other step, run after, in this order: `portal`, `resume`, `home`, `mini`, `link`, `flat`, `travel`, `dock`, `pick`, `terminal`, `life`, `fights`, `ore`, `hazards`, `wormhole`, `gas`, `map`. `weigh` runs only when named. The checklist judges them as one more leg, `extras`, after the spec's.
  - **`PAGE`** and **`pageOf(step) → 'universe' | 'fly' | 'flat' | 'terminal'`**: where a step's row is recorded. `PAGE = { dive: 'fly', ground: 'fly', weigh: 'fly', mini: 'flat', flat: 'flat', terminal: 'terminal' }`, and every other step is `'universe'`.
    - `dive` ends on `/fly` (lane 5b's step 3 waits for `#/fly/e:…`), and `ground` walks there. Neither has `__universeDebug.expanse` or a nav map.
    - `back` is on the universe's page again, at the planet's park, and carries every universe measure.
    - `mini` and `flat` run with `tp-3d` off: no scene. `terminal` is its own page.
  - **`NEXT_SPEED = 300`**: `SHIP.pulse`, the speed the time to the next place is measured at. The test pins it to `ship.js`'s, so the script (Node, which can't load `ship.js`'s extensionless imports) needn't import it.
  - **`MEASURES`**: what a row carries, where it's judged, and the bound each fails on. A measure is judged only on the pages it names; elsewhere it's left unjudged and the table prints `—`.

    | measure | bound | judged on |
    |---|---|---|
    | `errors` | 0 | every page |
    | `pops` | ≤ 4 px | `universe` |
    | `workMs` | ≤ the row's `workBudget` (lane 2's `budget.expanseMs` at the step's tier and quality step) | `universe` |
    | `map` | `'ok'` | `universe` |
    | `frameMs` | a finite number, recorded | `universe` |
    | `within9` | ≥ 3 | `universe` |
    | `nearest` | ≤ 6,000 | `universe` |
    | `next` | a finite number, recorded: `nearest / NEXT_SPEED`, in seconds | `universe` |
    | `parallax` | `{ predicted, measured }`: `predicted ≥ 100` px and `|measured − predicted| ≤ max(8, 0.1 × predicted)` (lane 1's) | the `nebula` step |
    | `roll` | `{ stars, cloud }`: `|stars − 30| ≤ 3`° and `|cloud − stars| ≤ 3`° (lane 1's) | the `nebula` step |
    | `inside` | ≥ 0.6 of the frame (lane 1's) | the `nebula` step |

    So `ground` and `dive` carry `errors` alone, as do `mini`, `flat` and `terminal`.
  - **`order(only = null) → string[]`**: the route, then the sweeps, then the extras, cut to `only` when given, in this order whatever `only`'s.
  - **`checklist(rows, { only = null } = {}) → { legs: [{ leg, says, ok, why }], ok }`**. `rows` is `{ step, ok, ...measures }[]`. For each leg of `ROUTE`, `SWEEPS` and `extras`:
    - **Cut.** Its steps that `only` names (all of them with no `only`) are the ones judged. With none, the leg is `{ ok: null, why: 'not run' }`. It doesn't fail, and the table prints `not run`.
    - **Judged.** It fails when a judged step has no row, has `ok: false`, or breaks a bound of a measure judged on its page, a missing measure included. Its `why` names the step and the measure, with the value. A step `only` cut from a leg that ran is named in `why` as `not run`, and doesn't fail it.
    - **Overall,** `ok` is true when at least one leg ran and every leg that ran is ok.
- **`--route`** runs `order()` in one context where the steps allow. The steps that need their own open theirs: `start`, `arrival`, `portal`, `mini`, `link`, `flat`, `terminal`, and `nebula` (it holds poses, and a held pose stays held: `scene.js:5892`). At the end it prints `checklist(rows, { only })` as a table under the per-step table, and exits 1 unless `ok`. Every other run prints the checklist too, cut the same way, and exits as it did.

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { SHIP } from '../../src/components/universe/ship';
import { EXTRAS, MEASURES, NEXT_SPEED, ROUTE, SWEEPS, checklist, order, pageOf } from './endless-route.mjs';

const nebula = { parallax: { predicted: 140, measured: 133 }, roll: { stars: 30.4, cloud: 29.1 }, inside: 0.82 };
const row = (step, more = {}) => {
  if (pageOf(step) !== 'universe') return { step, ok: true, errors: 0, ...more };
  return { step, ok: true, pops: 0, workMs: 0.6, workBudget: 1.5, errors: 0, map: 'ok', frameMs: 900, within9: 5, nearest: 2000, next: 6.7, ...(step === 'nebula' ? nebula : {}), ...more };
};
const all = () => order().map((s) => row(s));
const leg = (out, name) => out.legs.find((l) => l.leg === name);

describe('the spec’s route', () => {
  it('is the nine legs in the spec’s order, then every thing and event', () => {
    expect(ROUTE.map((r) => r.leg)).toEqual(['arrival', 'rim', 'boundary', 'system', 'nebula', 'gargantuan', 'climb', 'land', 'return']);
    expect(SWEEPS.map((r) => r.leg)).toEqual(['things', 'events']);
    for (const r of [...ROUTE, ...SWEEPS]) expect(r.steps.length, r.leg).toBeGreaterThan(0);
    expect(order().slice(0, 2)).toEqual(['start', 'arrival']);
    expect(order(['map', 'start'])).toEqual(['start', 'map']);
    expect(new Set(order()).size).toBe(order().length);
    expect(order()).not.toContain('weigh');
    expect(EXTRAS.slice(0, 2)).toEqual(['portal', 'resume']);
  });
  it('passes a clean run, and says which leg failed and why', () => {
    expect(checklist(all()).ok).toBe(true);
    const missing = all().filter((r) => r.step !== 'nebula');
    expect(leg(checklist(missing), 'nebula')).toMatchObject({ ok: false, why: expect.stringContaining('nebula') });
    expect(checklist(missing).ok).toBe(false);
    const popped = all().map((r) => (r.step === 'boundary' ? { ...r, pops: 6 } : r));
    expect(leg(checklist(popped), 'boundary').why).toMatch(/pops/);
    const lost = all().map((r) => (r.step === 'climb' ? { ...r, map: 'FAIL' } : r));
    expect(checklist(lost).ok).toBe(false);
    const sparse = all().map((r) => (r.step === 'system' ? { ...r, nearest: 6500 } : r));
    expect(leg(checklist(sparse), 'system').ok).toBe(false);
    const slow = all().map((r) => (r.step === 'old-rim' ? { ...r, workMs: 2.1 } : r));
    expect(leg(checklist(slow), 'rim').why).toMatch(/workMs/);
    const untimed = all().map((r) => (r.step === 'climb' ? { ...r, frameMs: undefined } : r));
    expect(leg(checklist(untimed), 'climb').why).toMatch(/frameMs/);
    const flat = all().map((r) => (r.step === 'nebula' ? { ...r, parallax: { predicted: 140, measured: 60 } } : r));
    expect(leg(checklist(flat), 'nebula').why).toMatch(/parallax/);
    const extra = all().map((r) => (r.step === 'home' ? { ...r, errors: 1 } : r));
    expect(leg(checklist(extra), 'extras')).toMatchObject({ ok: false, why: expect.stringContaining('home') });
  });
  it('tells a step cut by --only from a missing one', () => {
    const only = order().filter((s) => s !== 'nebula');
    const cut = checklist(all().filter((r) => r.step !== 'nebula'), { only });
    expect(leg(cut, 'nebula')).toMatchObject({ ok: null, why: 'not run' });
    expect(cut.ok).toBe(true);
    const short = ['start', 'old-rim', 'boundary'];
    const run = checklist(short.map((s) => row(s)), { only: short });
    expect(run.ok).toBe(true);
    expect(run.legs.filter((l) => l.ok === true).map((l) => l.leg)).toEqual(['arrival', 'rim', 'boundary']);
    expect(leg(run, 'arrival')).toMatchObject({ ok: true, why: expect.stringContaining('arrival not run') });
    expect(leg(run, 'climb')).toMatchObject({ ok: null, why: 'not run' });
    expect(checklist(short.slice(1).map((s) => row(s)), { only: short }).ok).toBe(false); // (start was asked for and has no row)
    expect(checklist([], { only: [] }).ok).toBe(false); // (nothing ran)
  });
  it('judges a step only on what its page can carry', () => {
    expect(['dive', 'ground', 'mini', 'flat', 'terminal'].map(pageOf)).toEqual(['fly', 'fly', 'flat', 'flat', 'terminal']);
    expect(pageOf('back')).toBe('universe');
    const ground = all().map((r) => (r.step === 'ground' ? { step: 'ground', ok: true, errors: 0 } : r));
    expect(leg(checklist(ground), 'land').ok).toBe(true);
    const broke = all().map((r) => (r.step === 'ground' ? { ...r, errors: 2 } : r));
    expect(leg(checklist(broke), 'land').why).toMatch(/ground.*errors/);
    expect(MEASURES.pops.on).toEqual(['universe']);
    expect(MEASURES.errors.on).toEqual(['universe', 'fly', 'flat', 'terminal']);
  });
  it('names a bound for every measure, and the time to the next place at the pulse drive', () => {
    for (const m of ['errors', 'pops', 'workMs', 'map', 'frameMs', 'within9', 'nearest', 'next', 'parallax', 'roll', 'inside']) expect(MEASURES[m], m).toBeDefined();
    expect(NEXT_SPEED).toBe(SHIP.pulse);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run scripts/lib/endless-route.test.mjs`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement**, and wire the script.
  - **`--route` and the checklist**, as above.
  - **Every name in `order()` must be a step the script knows.** The script exits 1 at start, naming any that isn't, so a step a lane renamed is found before the run, not hours into it.
  - **A route step no lane added is added here**, from that lane's own measure, and named in the commit. `nebula` is the one at risk: lane 1's Task 10 Step 6 adds it only "if `scripts/universe-endless-check.mjs` is on `main`", else leaves it to "whichever lane merges second", and lane 2's plan doesn't add it. If it isn't there:
    - in a context of its own (it holds poses), open `#/universe` as `scripts/nebula-check.mjs` does, with the same storage keys and its two waits
    - run nebula-check's three measures through `scripts/lib/nebula-measure.mjs`: parallax and roll at `veil-side`, inside at `in-nebula`
    - record them on the row as `parallax: { predicted, measured }`, `roll: { stars, cloud }` and `inside`, with lane 2's columns beside them
    - shoot `nebula.jpg`

    Any other missing route step stops the run at start (above), naming the lane whose plan owns it.
  - **The recorder's new columns**, after each step, beside lane 2's:
    - `page`: `pageOf(step)`
    - `frameMs`, on the universe's page: the median of 10 frames' wall time, each `performance.now()` taken either side of `await __universe().frames(1)` in the page. That is `universe-check`'s own measure (its `numbers` evaluate, `const numbers = await page.evaluate(async (n) => {`, returning `frameMsMedian: r1(sorted[Math.floor(n / 2)])`), over 10 frames, not 20: the step's end isn't a held pose, and in software GL each frame is half a second to a second.
    - `next`, on the universe's page: `nearest / NEXT_SPEED`, to 0.1 s
    - `workBudget`: lane 2's `budget.expanseMs`, the figure its recorder already checks `workMs` against. If lane 2's recorder keeps it under another name, the route reads that name.
  - **The map's column where there's no map.** Lane 6a's per-step `shipOnChart` call (kept by lane 6b) runs only where `pageOf(step)` is `'universe'`. Elsewhere `map` is `'—'`, and the checklist doesn't judge it there. If a lane already skipped the call on its own steps, that skip becomes this one rule.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run scripts/lib/endless-route.test.mjs`, then `node scripts/universe-endless-check.mjs --quality mid --route --only start,old-rim,boundary`. Expected:
  - PASS
  - the short run exits 0
  - it prints `rim` and `boundary` `ok`, `arrival` `ok` with `arrival not run` in its `why`, and every other leg `not run`
  - its three rows carry `page`, `frameMs` and `next`
- [ ] **Step 5: Commit.** `git commit -m "The endless check runs the spec's route in its order and prints the spec's checklist, leg by leg, judging each step on what its page can carry"`. The body names the `nebula` step if it was added here.

### Task 12: The full measure, the whole route, the contact sheet, and the hand-off notes

**Files:**
- Create: `docs/superpowers/evidence/endless-universe-lane-4c/HANDOFF-NOTES.md`
- Modify: `docs/superpowers/evidence/endless-universe-lane-4c/README.md`; add `after/`, `endless/`, `contact/`

- [ ] **Step 1: The scene's numbers, every tier, once.** Run these in the background and wait on their exits:
  - **The fourteen baseline poses,** `node scripts/universe-check.mjs --quality <tier> --poses "$BASE" --out lab/universe/after-4c/<tier>`, for each of `high`, `mid` and `low` (three runs: `--out` is ignored when more than one tier runs)
  - **The endless poses with the arrival**, one run a tier: the same list as Task 1's Step 0 (`poses` there, the endless poses less `BASE`) with `arrival` added, `--quality <tier> --poses "$poses,arrival" --out lab/universe/endless/<tier>`. Copy each to the evidence folder's `endless/<tier>.json` for the next reader.

  Expected, each tier against its own before (`before/<tier>.json` and `before/endless-<tier>.json` in the evidence folder, Task 1's Step 0):
  - `crossing: null` at every pose of both lists (Task 7): no pose measures the arrival's crossing, whatever the page's start took.
  - Calls equal to the before at every pose of both lists, at every tier.
  - Triangles exactly two higher at every pose in the core sector or the next one (where the giant's impostor is drawn), and equal at the rest. Say the numbers.
  - `arrival` new, its own baseline, measured without its crossing.
  - The pictures changed only at `falcon-sun`, `belt` and `far-rim` (the giant), and at the endless poses whose sky shows it. Name those.
- [ ] **Step 2: Frame time, three runs each.** `OUT=lab/perf/4c-after-<tier>-<n> QUALITY=<tier> node scripts/perf-probe.mjs universe`, for `<tier>` `mid` and `low` and `<n>` 1, 2 and 3, against Task 1's Step 0 (`before/` in the evidence folder), by Global Constraints' noise rule. The `universe` journey now starts at the arrival every time; on `main` it started anywhere. So also give the arrival pose's `frameMsMedian` at `low` and `mid`, each at most 1.15 times the six planet poses' median at that tier (done item 10).
- [ ] **Step 3: The whole route, at mid and at low.** Run `node scripts/universe-endless-check.mjs --quality mid --route`, then `--quality low --route`. This is every lane's steps in the spec's order. Expected:
  - exit 0 both times
  - every leg of the checklist `ok`, `extras` included
  - on every universe row: `map: ok`, pops at most 4 px, `workMs` within its budget, `within9` and `nearest` inside the spec's numbers, `frameMs` and `next` recorded
  - no console errors on any row
  - lane 1's parallax, roll and inside within their bounds
  - lane 4a's every kind and lane 4b's every event forced and shot

  Copy both tables and the checklist into the README. In software GL this takes hours: run it in the background and wait on its exit.
- [ ] **Step 4: The repo's checks.** With the dev server up:
  - `navmap-check.mjs` (all modes), `sector-check.mjs`, `flyto-check.mjs --fake`, `links-check.mjs`, `wonders-check.mjs`, `events-check.mjs rv`, `flare-check.mjs xwing`, `entry-check.mjs`, `landing-check.mjs`, `tour-check.mjs` and `online-check.mjs --fake`
  - then, without it, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe,/fly`

  Expected: each as before Task 1. One that failed then is noted, not fixed here.

  Each that loads `#/universe` in a fresh context now starts at the arrival. The owner's rule is that every check works after as before. So a check that fails now because its own steps assumed where the ship starts (by a planet `startAt` could pick, with no gentle event, with no column crossing) is fixed here, not left as a finding:
  - give it the start it assumed in its own init script, as the checks already set `tp-universe-ship`: a link (`#/universe/<id>`, which starts as today) or a `tp-universe-where` save at the spot it needs
  - never loosen what it checks
  - name each one, and why, in a commit of its own, `git commit -m "<check> starts where it always assumed, now a new pilot arrives by a world"`, before Step 8's
- [ ] **Step 5: The contact sheet, in front of the owner.**
  - Run `node scripts/planet-contact-sheet.mjs` (lane 5a's). Expected: `lab/planets/contact: 24 planets`.
  - Copy `sheet.png` as JPEG at 80, under 1 MB, to `contact/sheet.jpg`.
  - Look at it as lane 5a's Task 13 says: no two neighbours alike, land and sea where the type has them, no flat plane, the orbit's colours the ground's. Write what you see in the README in a sentence.
- [ ] **Step 6: The spec's ten, checked.** The README gets a table, one row per "What done looks like" item. Each row says where it's checked: the pure test by file, the route's leg, the repo's check, or the shot for the owner to judge. It says pass, fail or for the owner:
  - 1, no end, no edge, no ceiling: `climb`, `old-rim`, `boundary`; lane 2's no-ceiling test
  - 2, populated: lane 2's `density.test.js`; every row's `within9` and `nearest`; lane 4b's `life`
  - 3, more than planets: lane 4a's catalogue test (32 kinds) and `things`; lane 4b's pacing test (30 events, three in ten minutes) and `events`
  - 4, every place you see: lane 3's tests and `travel`, `pick`, `dock`
  - 5, nebulae stay put: lane 1's `nebula` (parallax, roll, inside); lane 4a's gargantuan parallax
  - 6, unique and landed: lane 5a's tests, `dive`, `ground`, `back`, and the contact sheet
  - 7, the map: lanes 6a and 6b's tests, `map` and `mini`
  - 8, the first minute: Tasks 1–6 here, `start` (a desktop and a phone held upright), `portal` and `arrival`, and `arrival.jpg` and `arrival-phone.jpg` for the owner
  - 9, nothing lost: `npm test`, the repo's checks in Step 4, the replaced assertions listed by each lane (this lane's: `gargantuans.test.js`'s one line, and `things/clear.test.js`'s one `it` if Task 1 narrowed it), and "Start over" giving a first visit again (`resume`'s round 3)
  - 10, phones fly: the `low` route and Step 2

  Every row that isn't a pass says why, in a sentence.
- [ ] **Step 7: The hand-off notes.**
  - **"Landed":**
    - every module above by path, with its interface in one line
    - `tp-universe-where`'s shape, its `t` on the shared clock and its sector bound, and that "Start over" forgets it (`VISIT_KEYS`) after saying so (`RESTARTING`)
    - `easeOut`'s move to `lib/ease.js` (the renderer lends it on), so `flight.js` reaches no three.js
    - the arrival's parks made for the open part of the visitor's screen, the clearing at eleven reaches and the sight to the giant
    - the arrival's four worlds and Tempest
    - the `arrival` pose, measured without its crossing, and `universe-check`'s new `crossing` field
    - the steps `start` (the arrival), `resume`, `home`, `mini` and `--route`, `endless-route.mjs` with its `page` rule, and the `nebula` step if this lane added it
    - any repo check given a start in Step 4, and why
    - where the endless baselines are now (`endless/<tier>.json` here)
  - **"Left":**
    - **For the owner:** `arrival.jpg` and the contact sheet, to judge "a wow" and "unique" by eye; the giant on the home system's sky in three hero pictures (finding 2); one giant for four worlds (finding 1).
    - **For the coordinator's PR body:** the README's ten-row table, the full route's checklist, and the before and after of `falcon-sun`, `belt`, `far-rim` and `arrival`.
    - **`HANDOFF-universe.md`, when folded:** the save key `tp-universe-where` joins the owner's list of keys that must never be lost or reshaped, and `lib/restart.js`'s `VISIT_KEYS` holds it. `tp-universe` is lane 6b's database, which "Start over" leaves as it is (finding 24).
    - **For the owner, on a phone held upright:** `arrival-phone.jpg`. The giant is bigger than the open part, its middle in the top sixth (finding 22).
    - Any finding from the measure.
- [ ] **Step 8: Run the gates and commit.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, within budget, with `boundary-breaks` and `cycles` at Task 1's numbers. Then `git add docs/superpowers/evidence/endless-universe-lane-4c && git commit -m "Lane 4c measured at every tier, the whole route run in the spec's order, the contact sheet, and the hand-off notes"`. Nothing under `lab/` is added (it's ignored).

---

## What later lanes consume

This is the last lane. These are what the coordinator's PR, and any later work, reads.

| Name | From | For |
|---|---|---|
| `ARRIVAL_GIANT`, `ARRIVAL_WORLDS`, `ARRIVAL_CLEAR`, `ARRIVAL_SIGHT`, `arrivalClearings(places = PLACES)` (the worlds' rows, then their sight); `fullSector(universe, sx, sy, sz, { clearings })` | `expanse/gen/arrivalGiant.js`, via `expanse/shared/space.js` | a change to the arrival's giant or worlds |
| `ARRIVAL_VIEW`, `ARRIVAL_FRAME`, `View = { w, h, rect }`, `ARRIVAL_ID`, `arrivalPark(id, { turn, near, view })`, `arrivalAt(rand, view)`, `arrivalShot(park, view)`, `arrivalLane(park, view)` | `universe/arrival/parks.js` | anything that frames or moves the arrival |
| `WHERE`, `whereOf`, `readWhere`, `shipOfWhere`, `inTheWay`, `clearToResume`, `readSaved`, `writeSaved`, `farFromHome` | `universe/arrival/where.js` | anything that reads where the pilot left their ship (the flat map, a future "continue" button) |
| `RESTARTING` (`'tp:restart'`, sent by `restartSite` before it forgets); `VISIT_KEYS` with `tp-universe-where` | `lib/restart.js` | anything that saves as the page goes, which must stop when the site starts over |
| `easeOut` | `lib/ease.js` (the renderer lends it on) | a pure module that needs it without three.js |
| `startPlan({ sel, link, saved, shared, view, rand, places })` | `universe/arrival/start.js` | any new way into the map |
| `createFirstMinute`: `start({ sel, link, view })`, `started`, `update`, `heard`, `straightIn`, `portalDue`, `save`, `debug` (`plan`, `arrival`, `saved`, `lane`, `line`, `offset`, `save`), `dispose`; `__universeDebug.first`; `__universe().start` | `universe/arrival/firstMinute.js`, `scene.js` | the checks |
| `traffic.cross(pts, { kinds, speed, event })`, `traffic.progress(id)`, `traffic.end(id)` | `traffic.js` | a column on any lane, following one group and ending it |
| `ARRIVAL_WORDS` (`giant`, `here[world]`, `back(name)`); `NAV.home`, `NAV.homeTitle`, `NAV.homeWait`, `NAV.homeJammed` | `words.js` | |
| `homeOffer`, `HomeOffer`; the page's `travel(id, drive, { keep })` | `chart/home.js`, `chart/HomeOffer.jsx`, `pages/Universe.jsx` | any press that shouldn't change the drive picked |
| `poseFor('arrival')`; `universe-check`'s per-pose `crossing` | `poses.js`, `scripts/universe-check.mjs` | every later measure |
| `ROUTE`, `SWEEPS`, `EXTRAS`, `PAGE`, `pageOf`, `NEXT_SPEED`, `MEASURES`, `order`, `checklist(rows, { only })`; `--route`; the `page`, `frameMs`, `next` and `workBudget` columns; the steps `start` (the arrival, and its phone shot), `portal`, `resume` (with Start over), `home`, `mini` | `scripts/lib/endless-route.mjs`, `scripts/universe-endless-check.mjs` | every later lane's whole-route run |
| `packages(entry)` and the arrival's two `describe`s | `universe/places/weight.test.js` | any later pure module of the arrival's, or page that reads the save |

## Assumptions about unmerged work

Each can be checked once the lane named has merged (`git log`, then read the file). Where one is false, follow the code and keep the behaviour this plan asks for.

1. **Lane 4a's `gargantuans.js`** exports `ARRIVAL_BASE` (4), `ARRIVAL_MAX` (1), `ARRIVAL_GARGANTUANS`, `checkGargantuan`, `gargantuanKeeps` and `GARGANTUAN` (`home`, `far`). `fullSector`'s `arrivals` defaults to `ARRIVAL_GARGANTUANS` in the shared universe's core alone (its Task 10). The `giant` form's row carries `size`, `axis`, `light` and `colors`, and its keep is one sphere of `size × 1.05`.
2. **Lane 4a's `fullSector`** keeps appended systems off a list of spheres by their reach and passes `ctx.keeps` to the lattice and `roomFor`. Task 1's `clearings` join both. A list row carries what `roomFor` measures it by as `extent` (0 for a row that stays put, a comet's path or a storm's loop otherwise); if the field has another name, Task 1's test reads that one.
3. **Lane 4a's `gargantuans/rules.js`** exports `nearOf(row) = max(2 × size, 0.55 × FAR − size)`. `createGargantuans(…).debug` has `rows()` and `screen(id)`; this plan reads `screen` as `{ x, y }` in CSS px, or null off screen. The impostor of a row in the camera's sector or the next is drawn as a landmark extra, the first in the main sector free and each further one two triangles.
4. **Lane 4a's `things/clear.test.js`** reads the generated gargantuans (`extras.gargantuan`), not `extras.arrival`. If it reads both, Task 1's Step 4 says what changes.
5. **Lane 4a's `hexOf`** and `universe/shared/space.js`'s `tint` and `PALETTE` exist (its Task 1). If `hexOf` lives elsewhere, `arrivalGiant.js` takes it from there through the same face.
6. **Lane 3's face** `expanse/shared/space.js` has a test pinning its names (`shared.test.js`). `places/ids.js` has `canonicalPlace`, `isPlaceId` and `atTime(place, t)` (a planet's `orbitAt`, a moon's `moonAt`, a row's `move`, else its `at`). `scenePlaces` has `park(id, from)`, `find`, `fetch` (it never rejects), `missing`, `here()`, `resolve(id)` (`build: false`) and `solids()` (the drawn stations, `[{ id, at, r, reach }]`). `here()` gives a system's id between its planets, its zone being its park in the gap past the planets' bands (its Task 8). Its start expression and `places.missing(props.startAt)` line sit in the spawn block (its Task 12), and `/universe/<E: id>` starts parked at the place. The scene keeps `state.spaceT` = `spaceTime(Date.now())`, or 0 when held or under reduced motion (its Task 11).
7. **Lane 4b's `createSceneEvents`** has `arrive()`, and its spawn line `if (!props.startAt) events.arrive();` is in the spawn block (its Task 10). `traffic.js` is lane 4b's, with `convoy(ship, side, { ports, solids })` and `MAX`, `sideFor(crew)`'s `civil` and `convoy.escort`, and still the file's own `end(group)` that `clear()` uses. Its `arrival` step is in the endless check. The director still holds its events while `state.held` (`scene.js:3989`'s `busy`), so a held pose has none.
8. **Lane 5b's landing** emits `{ type: 'land', what: 'hand', id }` through the scene's `emit` as the route changes to `/fly`, and `state.dive` is set from the dive's start. A take-off returns to `/universe/E:…`.
9. **Lane 6b's `createSceneChart`** returns `named(ids)`, which records knowable ids as named; a gargantuan row (chart priority 80) is knowable. It resolves each id through `places().resolve`, which never builds, so it does nothing for an id whose sector isn't at hand yet: Task 6 waits for `places.resolve(ARRIVAL_ID)` before calling it. `__universeDebug.charted.known()` lists the known ids. `where()` lives in `whereNow.js`, and NavMap's status has the holder's line.
10. **Lane 6a's `FlatMap.jsx`** takes `{ selected, startAt, onSelect }` and renders `MiniMap` with `view`, `boxRef`, `handlers` and its tools. `MiniMap`'s `ship` draws `g.minimap-ship`, with `data-edge` when pinned. `useChartView` takes `ship`. `scripts/lib/navmap.mjs` has `shipOnChart`, and `navmap-check.mjs` has `minimap` and `far` modes. `NavMap.jsx` keeps `hyper` and `canFly` as on lane 6a's branch today (`:150-152`) and its status block (`:347`).
11. **Lane 2's `scripts/universe-endless-check.mjs`** has named steps, `--only` (lane 3's), a per-step recorder (`pops`, `workMs` checked against `budget.expanseMs`, calls and triangles, `within9`, `nearest`, errors), `__universeDebug.teleport(x, y, z, heading, pitch)`, and a `start` step that loads `#/universe` with `tp-universe-ship` set to `"falcon"`. It records no `frameMs` and no `next`; Task 11 adds them. The other lanes' steps are named as lane 4c's `ROUTE` and `EXTRAS` list them: lane 4a's `things` and `gargantuan`, lane 4b's `events` and `arrival`, lane 5b's `dive`, `ground` and `back`. Where a lane named one differently, the route table takes its real name, and the commit says so.
    - **Lane 1's `nebula` step may be missing.** Lane 1 is built right after lane 2 in the same worktree, and its Task 10 Step 6 adds the step only if the endless check is on `main` then, else leaves it to "whichever lane merges second". Lane 2's plan doesn't add it. Task 11 adds it from `scripts/lib/nebula-measure.mjs` if it isn't there, and names it in the commit.
12. **The scene** still has the spawn block (`if (!state.ship) {` with `spawn(state.sel, …)`), `takeArrive` and `let arriving`, `fly()`'s portal block reading `arriving` and calling `gunThrough()`, `emit`, `render()`'s first-frame camera blend testing `!state.sel`, `onHidden`, `dispose()` and the two dev hooks, as quoted. `create(canvas, ctx)` (`:489`) still takes the runtime's canvas, whose parent carries `data-gl`. `holdPose` (`:5857`) still clears hunters, meteors and mines but not traffic, and sets `state.held` for good. Lanes 2, 3, 4a, 4b, 5b and 6b don't move `takeArrive` or the portal block (none of their plans names them).
13. **`ctx.rt.saves`** is `runtime/local.js`'s `localSaves()` (`runtime/index.js:99`), the same object the flat map gets from `localSaves()`, so a key registered by one reads unwrapped for both.
14. **`universe` in the scene** is the bigint `ctx.universe` or `UNIVERSE` (`scene.js:773`), and a pocket universe's differs from `UNIVERSE`.
15. **No lane before this one** wrote `tp-universe-where`, or changed `ship.js`'s `startAt`, `STARTS` or `spawn`.
16. **Lane 2's `expanse.solids()`** (its Task 17) gives the built generated bodies, `[{ id, at, r }]` with `id` their `E:` id and `at` moved each update, in one array reused every frame. A body is in it from the frame its system is built.
17. **Lane 4a's `--t` and `--png`** on `universe-check.mjs`, and `scripts/same-pixels.mjs` (its Task 18), are there for Task 1's Step 0 and Step 5.
18. **`src/pages/Universe.jsx`**'s `travel(id, d, { tour })` still starts with `setDrive(d)` (`:449-450` on `main`), and NavMap's `onTravel` is still `(id, d) => travel(id, d)` (`:610`).
19. **Lane 4a's `ctx.keeps`** is a list of plain `{ at, r }` spheres (as `gargantuanKeeps` gives), which the lattice keeps clear of by `(THING_NEAR + 1) × size` and `roomFor` by a row's size and extent, and appended systems keep off the same spheres as `big`'s by their reach. Task 1's 113 clearing rows (4 worlds' and 109 of the sight) join both. If lane 4a takes keeps in another shape, Task 1 hands them over in that shape.
20. **The universe page's layout at a first visit** is as `index.css`, `universe.css`, `thumbs.css` and `UniversePanel.jsx` have it at `cc5e2eaf`:
    - On a desktop (768 px wide and up), `--nav-h` is 76 and the 400 px panel is open down the right, 412 px with its margin.
    - On a phone held upright (`pointer: coarse`, 767 px wide at most, 501 px tall at least), `--nav-h` is 68 and the sheet is 38svh. The thumbs' grid is four rows (52, 52, 52 and 76, gaps of 8), hidden until the sheet is put away, which the launch does (`Universe.jsx:366`).
    - The panel's "Start over" is `UniversePanel.jsx:137`'s `button.universe-back`.
    - Task 10's phone shot reads the scene's real `state.rect` against Task 2's numbers.
21. **`measure()` has run before the spawn**, so `size` and `state.rect` are the canvas's. If not, `first.start` is handed a view with `w` under 2 and the park is `ARRIVAL_FRAME`'s (Task 2 pins that).
22. **The endless check runs on Vite's dev server**, as `universe-check` does (`scripts/universe-check.mjs:55-71`), so a step can `import('/src/…')` in the page. `__universeDebug.state` is the scene's `state` (it is at `cc5e2eaf`).
23. **`easeOut`** is defined only in `lib/three/renderer.js` (`:282` at `cc5e2eaf`), and nothing takes it from `flight.js`.
24. **Lane 3's `places/weight.test.js`** has `reach`, `GENERATOR` and `ROOT`, and imports `readFileSync`, `FROM`, `SIDE_EFFECT` and `uncomment`, as its plan writes them (lane 3's Task 7).
25. **Lane 4b's traffic** keeps a group's `t` running 0 to 1 along its lane, its `id` from `nextGroup`, and `setCrew`'s clear of every group on a change of side (`traffic.js:342-353`), as on `main`.

## Findings for the coordinator (spec against code)

1. **One gargantuan for four worlds.** Spec C has each of "three or four chosen fandom worlds" with "a gargantuan placed by hand behind it". Lane 4a holds the core to one arrival row (`ARRIVAL_MAX = 1`, from spec C's "at most one a sector").
   - So one supergiant, Tempest, is placed so that it is behind each chosen world from its park, and the worlds were chosen by that: Marvel's, Travel's, Music's and Harry Potter's.
   - Each is lit from the park's side, and none is a baseline pose.
   - If the owner wants a giant behind each world, the core breaks "at most one a sector": their call. `w5`–`w7` are kept free for it.
2. **The giant costs two triangles at every core pose, and shows on three hero pictures.** It is the core's second landmark extra after the home block's generated gargantuan, so the landmark draw holds one instance more wherever the core is in view: two triangles, no call.
   - Its impostor is on the sky at `falcon-sun`, `belt` and `far-rim`.
   - "Draw calls and triangles no higher" can't hold with spec C's giant in the core, and the pictures change on purpose.
   - Calls are equal. The numbers are in the README. The owner decides.
3. **Lane 4a's clearance for generated giants is stricter than its purpose.** It keeps a generated giant `FAR + size` (50,000 here) from every baseline pose's point so its mesh is never built there. The mesh is built within `1.2 × nearOf` (23,700). Tempest is 46,316 from the `rickmorty` pose, and is held to the purpose (Task 2), not the stricter bound.
4. **"Generated traffic crossing between."** The arrival is in the hand-made core, where lane 4b's traffic is the crew side's, as today. The crossing is a column from the traffic system laid across the view (`traffic.cross`), so "generated" is read as "the traffic system's", not a generated system's.
5. **Spec G's "`rt.store` table `universe-known`"** is lane 6b's table in a database of its own (`tp-universe`, lane 6b's finding 2). This lane only marks the giant named at the arrival. Spec G's other row, `tp-universe-where`, is in `rt.saves`, as the spec says.
6. **Pocket universes neither arrive nor resume.** There is no giant in a pocket's core, and the save is the shared universe's. A pocket starts by `startAt`, as today, which is the spec's "fallback".
7. **A returning pilot gets a line too** ("Back where you left off: …"). The spec asks a line only of the arrival; a pilot resumed 9 million out is helped by one. My call.
8. **"The map's Home"** is read as one press that flies you to the Home station (lane 6b's finding 13 left it to this lane). The chart's "Home system" chip still only moves the chart.
9. **The core's generated content keeps eleven reaches off the four worlds, and off each one's line of sight to the giant.** A phone held upright parks up to 8.9 reaches out, so six reaches (this plan's first number) would have had a phone's park outside its own clearing. The sight is 109 spheres along the four lines (Task 1). It keeps every generated system, planet, thing and list row off the giant's disc from every park, which Task 2 pins over the seeded core.
   - At `main`'s generator, that takes 24 of the core's 7,959 lattice things and none of its 113 appended systems.
   - On the branch the count may differ: one `rng` throws all the core's darts, so a system turned away moves every later one. Nothing stored names a core system, since every lane ships together.
10. **The first frame's camera** for the arrival and a resume is straight in behind the ship, as for a pick, not the 1.8 s swoop from the home overview. From 9.6 million out that swoop would cross the universe in a blur. Links keep today's framing.
11. **The cockpit's portal arrival moved** into the first minute's module, its behaviour pinned by a test. It was the only other code deciding where a new ship comes out.
12. **"A wow" isn't a test.** Composition is pinned: the world's share, the giant's place and size and the crossing, on a desktop with its panel open and put away and on a phone held upright with its sheet up and put away. Whether it is a wow is the owner's eye on `arrival.jpg` and `arrival-phone.jpg`.
13. **`perf-probe`'s `universe` journey** started anywhere on `main` (`startAt` with `Math.random`). It now starts at the arrival. Its before and after aren't the same picture, so the arrival pose's own frame time is the measure of done item 10 here (Task 12, Step 2).
14. **Lane 3's `here()` names the system between its planets.** A system's zone is its park in the gap past its planets' bands (lane 3's `hereZone`), so a pilot exploring between the planets is "at" the system. A resume that re-parked at the save's place would carry them out to the system's park ring, often. So the resume never parks by place: it keeps the pilot's offset from the place, which moves the ship only for a planet, a moon or a moving thing (Task 6).
15. **The saved spot can't be checked against generated bodies at the start.** `startPlan` runs before any generated sector is at hand, so it knows only the hand-made `SOLIDS`. A planet or a moon that has come round onto the saved spot is found by the settle once its system is built (lane 2's `expanse.solids()`), and the ship is parked off it. Until then a parked ship it reaches is pushed to its surface by `step`, with no crash at no speed.
16. **The canvas is shown long after the scene starts in software GL** (a minute or more here; `universe-check.mjs:169-174`), and seconds later on a slow phone. A line timed from the spawn could be over before anyone sees it. The line runs from the first frame the host's `data-gl` is `'on'`.
17. **`holdPose` clears hunters, meteors and mines, but not traffic** (`scene.js:5857-5893`). From this lane every pose's page starts at the arrival, and the crossing has started by the time a pose is held. The first minute ends its own crossing at a held pose and starts none; other traffic at a pose is as it was before this lane. `universe-check` records `crossing` at every pose and fails on one.
18. **The endless check's rows aren't all on the universe's page.** `dive` ends on `/fly`, `ground` walks there, and `mini`, `flat` and `terminal` have no scene. The spec's records (pop-ins, the places in view, the map's marker) can't be read there. Each row is judged on what its page can carry (Task 11), and no measure is dropped where it can be read. Lane 2's recorder had no frame time and no time to the next place; Task 11 adds both.
19. **The page's `travel` sets the drive picked** (`Universe.jsx:450`). Home always jumps, so a press would otherwise change a pilot's chosen drive to the jump for every later trip. Home passes `{ keep: true }`, a new option of the page's `travel`; every other press sets the drive as today.
20. **Home always jumps, at any distance.** From 9.6 million out, the drive picked could be hours (super speed about 3 h, cruise about 9 h), and `travel(id, 'hyper')` falls back to super speed at once while the jump charges or is jammed. Home waits for the jump in the open map and says so. Closing the map drops the wait.
21. **`tp-universe-where`'s `t` is the shared clock** (`state.spaceT`, `Date.now() / 1000`, or 0 under reduced motion), not the page's `wall()`, which starts again on each page. The settle needs where the place was when the pilot left it.
22. **On a phone held upright the giant can't be lowered by the park.** Its place on screen is where it is and the chase camera's 12° tilt. The park is a few hundred units off its world and the giant 28,000 to 46,000 away, so where the ship parks moves the giant by under a degree.
   - A phone's open part is 18.7° tall, under its 68 px bar and over its 321 px sheet. The giant is 12.5° to 21° across. So on a phone its middle is in the open part's top sixth (0.07 to 0.16 down), its lower limb arches over the world, and its top is past the bar. On a desktop it sits 0.25 to 0.30 down, whole.
   - Lowering Tempest by about 2,500 would bring a phone's giant to a third of the way down. But a desktop's world would then sit at the foot of its open part to keep clear of the giant's middle.
   - The owner's call, on `arrival-phone.jpg`.
23. **The open part, against review finding 1's numbers.** The review was right that the view is centred in the open part (`measure()`, `cover()`) and that a park made for the bare canvas puts a phone's world under the sheet. Two of its numbers are off, and its fix can't hold:
    - Upright, the thumbs' grid has four rows (`thumbs.css`'s upright block: 52, 52, 52 and 76), so it reads as a 336 px sheet, not 212.
    - The grid is hidden while the sheet is up, and a first visit has the sheet up (321 px) until the launch tucks it.
    - A fixed park can't fill both a phone's open part (0.54 of the canvas's height) and a desktop's (0.89) within 0.35 to 0.55: the ratio is 1.65, the range's 1.57. So "tune `fill` and `sep`" can't pass on both.
    - Instead, the park is made for the open part at the spawn (Task 2): `fill` and `low` are shares of it, and `sep` is worked out from it.
24. **"Start over" and the saved position.** "Start over" (`restartSite`) forgets the visit's keys and reloads, and on the universe page the reload fires `pagehide`, which saved the position straight back. `VISIT_KEYS` now holds `tp-universe-where`, and `restartSite` sends `RESTARTING` first, after which the first minute writes nothing.
    - Lane 6b's known places (`tp-universe`, IndexedDB) aren't in `VISIT_KEYS`, which reads `localStorage` only. A pilot who starts over keeps the places they had come to know: the owner's call whether that is part of "as on a first visit".
25. **The first minute is made where the scene's clock doesn't exist yet.** It is made after lane 4b's events (about `:1100`), above `const state` (`:1174`) and `const wall` (`:1766`), so a thunk called while it's made throws. Making it calls none of them, and the portal's 12 s are stamped on its first `update` (Task 6). The first wiring this plan wrote stamped them as it was made, which would have thrown on every launch of Rick's cruiser through his portal.
26. **The portal arrival's key is fresh for 20 s only** (`lib/arrival.js`'s `FRESH`), and in software GL the scene is made a minute or more after the page starts. So the `portal` step seeds it with an `at` ten minutes ahead. On a real phone the cockpit's launch hands over within a second or two.
27. **`flight.js` reached three.js** through `lib/three/renderer.js`'s `easeOut`, so anything pure that took `FOV` or `cover` from it did too. `easeOut` moved to `lib/ease.js`, and the renderer lends it on unchanged to its twelve importers.
28. **The crossing's lane is nearer than this plan first had it.** At 0.45 of the way to the world, the column's ships would be 4 to 18 px on a desktop, and at the convoy's pace (`3.6 × PACE`) it would take two minutes to cross. At 0.2 they are 9 to 41 px, crossing in about 31 s at `6 × PACE`. `traffic.cross` takes its speed as given, as `escort` does.

## Spec coverage

- **Done item 8, "The first minute is a wow":**
  - beside one of the site's worlds, on its day side, filling a good part of the frame: Task 2, measured in the part of the screen the view is drawn in, on a desktop and a phone held upright
  - a gargantuan placed by hand behind it, beyond 20,000, big enough to own the sky: Tasks 1 and 2
  - traffic moving through: Task 5
  - a gentle event: lane 4b's rule, called from Task 6, checked by lane 4b's `arrival` step
  - one line naming where they are: Tasks 2 and 6, shown from the first frame the visitor can see it
  - all of it in the browser: Task 10's `start`, at 1280 × 720 and at 390 × 844 with touch, and `arrival.jpg` and `arrival-phone.jpg` for the owner (Task 12)
  - nothing generated between the park and the giant, and the park in a populated place: Tasks 1 and 2
- **Section C, the first minute:**
  - "a new visitor with a ship (`startAt` with no saved position)": Task 4
  - "`startAt`'s other starts stay for the arrival's fallback": Task 4 (`'fallback'`), with `ship.js` untouched
  - "a returning pilot resumes where they left off": Tasks 3, 4, 6, and Task 10's `resume`, between the planets (never moved) and by a planet (the offset kept). "Start over" makes them a new visitor again (Tasks 3 and 6, `resume`'s round 3).
  - "the map's Home takes them back to the core": Task 9 (always the jump, waiting out a charge), and Task 10's `home`
  - "`/universe/<id>` behaves as today": Task 4's order, and Task 10's `link` with a save
- **Section G:**
  - `tp-universe-where` (sector, position, heading, the place) in `rt.saves`: Task 3, written by Task 6, with the shared clock's `t` beside them for a moving place
  - the known-places table (ids only, 2,000 at most, oldest dropped): lane 6b's Task 2. This lane marks the giant named (Task 6).
- **Lane 6a's hand-on:** the mini-map's `ship` from the saved position: Task 8, and Task 10's `mini`.
- **The whole-route check** (the index's "the arrival (4c)", and this lane's ownership of the run):
  - the route's start: Task 10
  - the spec's order, its nine legs and two sweeps, and its records (pop-ins, frame time, places in view and the time to the next, the nebula's parallax and roll, the map's marker, console errors): Task 11, each judged on the pages that can carry it, with frame time and the time to the next added to the recorder, and lane 1's step added if it isn't there
  - one run at `mid` and `low`: Task 12
- **The contact sheet in front of the owner:** Task 12, Step 5.
- **Done item 9:**
  - every existing test unchanged but lane 4a's one line, which this lane fills, and its `things/clear.test.js` `it` if it reads the arrival's row (Task 1)
  - "Start over" replays the site as on a first visit, the arrival included (Tasks 3 and 6)
  - the cockpit's portal launch of Rick's cruiser, moved, still comes out in his dimension (Task 6's test and `portal` step)
  - `startAt`, `STARTS` and their tests as they were
  - every route as before (Tasks 4 and 10)
  - every dev hook kept, `__universeDebug.director` included (Task 6 touches none)
  - the repo's checks rerun, and any the arrival broke given back the start it assumed (Task 12)
  - the drive a pilot picked kept through Home (Task 9)
- **Done item 10:**
  - the arrival measured at `low` and `mid` against the planet poses (Tasks 7 and 12)
  - no material, shader or mesh added by this lane
  - one traffic group at the arrival, in a slot of its own, and none at a held pose
  - writes at most every 5 s
- **The spec's counts:**
  - at least 20 kinds of thing (lane 4a's 32) and 15 kinds of event (lane 4b's 30) are pinned by their lanes, and swept once in Task 12's route
  - the density targets (three within 9,000, the nearest within 6,000) are lane 2's test. Every arrival park meets them (Task 2, over the seeded core), and this lane's route fails a row that breaks them (Task 11)
  - the pacing (three different events in ten minutes, never two big ones together, the gentle first minute) is lane 4b's, checked in Task 12

## Self-review

- **Types:**
  - `Where` is defined in Task 3. `startPlan` (Task 4) reads it, and `firstMinute` (Task 6) writes it and reads it back.
  - `Plan.kind`'s five values match Task 6's `straightIn` and the check's `start` column.
  - `arrivalPark`'s object is what `arrivalShot` (`world`, `r`, `ship`), `arrivalLane` (Task 5), `poseFor('arrival')` (Task 7) and `arrivalAt` (Task 4's `'arrival'` row) take.
  - `View = { w, h, rect }` is defined in Task 2. `startPlan` (Task 4), `first.start` (Task 6, from `size` and `state.rect`), `arrivalLane` (Task 5) and Task 10's phone check pass it. `ARRIVAL_FRAME` stands in where there is none, and for the `arrival` pose (Task 7).
  - `ARRIVAL_WORDS.here` is keyed by the world's id in Task 2, read with the arrival's `id` in Tasks 6 and 10.
  - `ARRIVAL_ID` is `'E:0,0:w4'`, lane 4a's `ARRIVAL_BASE` in the core, everywhere it's named.
  - `Where.t` is the shared clock in Task 3's definition, Task 6's writes (`now()`) and Task 6's settle (`atTime(d, saved.t)`).
  - `inTheWay` and `clearToResume` (Task 3) take further lists of `{ id, at, r }`. Task 6 passes `bodies()` and `places.solids()`, and parks off a `hit` by its `id`.
  - `debug.plan().settled` (`'kept'`, `'moved'`, `'parked'` or null), `debug.line()` and `debug.offset()` are defined in Task 6 and read by Task 10's `start` and `resume`. `debug.lane()` is read by Task 7's `crossing` and Task 10's `start`.
  - `homeOffer`'s `hyper` is NavMap's own `hyper` object, `{ ready, wait, why }` (`nav.js`'s `hyperState`).
  - `pageOf` and `MEASURES[m].on` use the same four page names.
  - `traffic.progress(id)` (Task 5) is what Task 6's `lane()`, its retry and its held-pose end read. `traffic.cross` takes `speed` as given, and Task 6 passes `ARRIVAL_VIEW.lane.speed * PACE`.
  - `RESTARTING` is defined in Task 3 and heard in Task 6.
- **Line counts:** `scene.js` gains 7 lines and loses 27 (Task 6), −20 in all; the spawn's `view` rides on its one line. No other task touches it. `Universe.jsx` changes three lines in place (Task 9). `renderer.js` and `flight.js` change one line each in place (Task 2), and `restart.js` gains three (Task 3).
- **Review Focus lines and their tests:**
  - 1: Tasks 3 and 4
  - 2: Tasks 4 and 10
  - 3: Tasks 3, 6 and 10
  - 4: Tasks 2, 5 and 10
  - 5: Tasks 3, 8 and 9
  - 6: Tasks 3, 6 and 10
  - 7: Tasks 6, 7 and 10
  - 8: Task 6
