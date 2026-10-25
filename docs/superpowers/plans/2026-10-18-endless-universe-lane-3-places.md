# Endless universe, lane 3: Places you can go. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every generated place (a star system, a planet, a moon, a station, a thing in space) has a name, a card and a parking spot. You can pick it, aim at it, and get there by the jump, super speed or cruise. A station docks you into the hangar and its shop. Nothing about a place is stored: an `E:` id goes through the pure generator every time it's asked for, and the scene never runs it on the main thread.

**Architecture:**
- **Pure first.** One system in three gets a station from its own seed (`expanse/gen/stations.js`). A new folder `universe/places/` holds the rest:
  - `ids.js` reads an `E:` id in any spelling and says where a place is at a time. It has no generator behind it (only `lib/space/address.js` and the expanse's light face, `expanse/shared/orbits.js`), so `nav.js`, `park.js` and the page can import it without carrying the generator.
  - `resolve.js` turns an `E:` id into a destination row by running the generator. Only the scene's places and the terminal import it.
  - `cards.js` holds the words and the numbers each kind is parked and shown by.
  - `park.js` says where the ship parks, and how far off.
  - `carry.js` carries the ship round with the one planet or moon it's at or going to, and hands over smoothly.
  - `trip.js` is the long-trip formula.
  - `around.js` says what's round the ship and which place it's at.
  - `pick.js` and `dock.js` hold the rules for picking, names and docking.
- **`nav.js`** accepts `E:` ids in every function the nav map and the scene call: `destinationById`, `goalOf`, `canGo`, `legOf`, `parkFor`, `distanceTo`, `tripTime` and `findDestination(s)`. It reaches generated places only through a lookup the caller passes (`{ place(id) }`), and it imports only `ids.js`, `park.js` and `trip.js`. So `nav.js` never reaches the generator, and neither the home page's mini-map nor ⌘K (preloaded on every page) carries it. A Node test walks their static imports to pin it (Task 7).
- **Wiring.**
  - The scene's travel block moves out of `scene.js` into `trips.js`, so `scene.js` shrinks by about 120 lines over the lane.
  - `places/scenePlaces.js` puts it together for the scene: what's near, the stations drawn and solid, the carry, where the ship is, docking, picking and the name tags.
  - The scene resolves only from the sectors it has. A place outside them is fetched from lane 2's worker pool, and a trip to it goes when it lands.
  - The page reads `/universe/<E: id>` and shows the card the scene finds for it. With 3D off, failed or lost, no scene runs, so the page shows a plain card for the id instead of waiting. Docking at the end of a trip opens the Hangar on its shipyard tab.
- **Two PR groups on the one branch** (the coordinator merges every lane; this plan opens no pull request):
  - **3.1 the pure half** (Tasks 1–9). Nothing on screen changes. It builds on `eu/lane-3` as it stands (lane 2 through PR 2.4's Task 16), needing nothing unmerged.
  - **3.2 the wiring** (Tasks 10–15). Pictures change out in generated space only. It waits for lane 2's PR 2.5, and for lanes 1, 5a and 6a, merged: "What PR 3.2 waits on" (after Task 9) says exactly what each task takes from them.

**Tech Stack:**
- React 19
- three.js 0.186 on the GLSL path
- Vitest (`renderToStaticMarkup` for the card)
- the Playwright check scripts under `scripts/`

**Spec:** `docs/superpowers/specs/2026-10-18-endless-universe-design.md`. This lane is:
- section F's "Generated places are destinations", "Trip times for long trips come from a formula" and "The jump goes to anything on the map"
- section B's "every one has a name, a card and a parking spot", its stations ("about one system in three") and its docking
- section C's `/universe/<id>` for generated places
- done item 4, all but "the map lists it" (lane 6b's)

The index plan is `docs/superpowers/plans/2026-10-18-endless-universe.md`. Lane 2's plan (`…-lane-2-one-space.md`) and its "What later lanes consume" table are this lane's inputs.

**Depends on:**
- PR 3.1: lane 2 through PR 2.4's Task 16 (`budget.js`, `levels.js`, the far layer, `discs.js`, `near.js`), which `eu/lane-3` has
- PR 3.2: lane 2 merged, all five PRs; lane 6a merged (`CHART_WORDS` in `words.js`, `chart/declutter.js`, the mini-map on `chart/marks.js`); lanes 1 and 5a merged (no interface of theirs is used)

Line numbers are from `main` at `cc5e2eaf`. Lane 2's PRs 2.3 to 2.5 move them, so find the code again by the quoted text. This revision checked the plan against `eu/lane-3` at `9d927892` and against `eu/lane-2` at `18952195` (PR 2.4's Task 17 in). Every text Tasks 10 to 13 quote is on `eu/lane-2` there, about 50 lines above `main`'s (the travel block at `:1720`, the jump's way out at `:4300`, `expanse.update` at `:5292`, `where()` at `:6229`), and PR 2.5's Task 22 moves them again. `scene.js` is 6,374 lines on `eu/lane-3` and 6,361 on `eu/lane-2`.

## Global Constraints

**Process (HANDOFF-universe's owner's rules and the index's Global Constraints, all of them):**
- Nothing a visitor can do is lost. Every key, save, route, dev hook and test works after as before, and no test is loosened.
  - `nav.test.js`, `ship.test.js`, `space.test.js`, `fingerprint.test.js` and `density.test.js` stay as they are. New tests go in new `describe`s.
- Pure first. `expanse/gen/*`, this lane's two faces (`expanse/shared/gen.js` and `orbits.js`; lane 2's `shared/space.js` is not pure) and `universe/places/{ids,cards,resolve,park,carry,trip,around,pick,dock,pageCard}.js` import no React, no DOM and no three.js. Each has its Node test before its drawing half.
- A changed picture is on purpose. The before shots come first (Task 10), at `--quality mid`.
- Draw calls and triangles are no higher at any pose in `lab/universe/baseline/<tier>.json`. Say the numbers.
- Before the lane is done: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` and `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`.
- Every commit is one plain sentence in the repo's voice. The body says why and gives the numbers, and it ends with the attribution lines the session's harness gives (`.claude/skills/autopilot/SKILL.md`, "Commit"). This plan writes the first line only, with no model names.
- The hand-off goes in `docs/superpowers/evidence/endless-universe-lane-3/HANDOFF-NOTES.md`, not in `HANDOFF-universe.md`, which the coordinator folds.

**Code shape:**
- `src/components/universe/scene.js` doesn't grow. Task 10 moves the travel block out, about 130 lines. Tasks 11 to 13 add at most 40 lines between them, and each says how many lines it moves out and adds, by `wc -l` before and after.
- New files stay under 800 lines. `Universe.jsx` (649) and `UniversePanel.jsx` (350) stay under 800.
- **Islands.** The universe reaches the expanse's generator only through two new faces, as the expanse reaches the universe through `universe/shared/space.js`:
  - `src/components/expanse/shared/gen.js`, the whole generator, for the scene's places, the resolver and the terminal
  - `src/components/expanse/shared/orbits.js`, the light face: `orbitAt`, `moonAt`, `spaceTime` and `extentOf`, from `gen/orbits.js` and `gen/extent.js`, which import nothing. It is all that `ids.js` and `park.js` take, so it is all that `nav.js` brings with it.

  Lane 2's own face, `src/components/expanse/shared/space.js` (its Task 17, on `eu/lane-2` at `18952195`), is the drawn Expanse for `scene.js`: `createExpanse`, `farRoom`, `UNIVERSE`, `makeSector`, `addBodies`, `orbitAt`, `moonAt` and `spaceTime`. This lane adds nothing to it. It reaches three.js (`scene/expanse.js`, and `near.js`, which makes a `SphereGeometry` at load), so a pure module, or the terminal's chunk, that took the generator through it would take three.js with it. A face of this lane's own also leaves lane 2's `space.js` and `shared.test.js` lines alone, so the coordinator's merge has nothing there to settle. `scene.js` and `scenePlaces.js` take `UNIVERSE`, `spaceTime` and `farRoom` from lane 2's face.

  `boundary-breaks` (481 on `eu/lane-3`, 479 on `eu/lane-2` after its Task 17; budget 489) doesn't rise, and neither does `cycles` (5).
- **Declared after, or changed later.** A module made in `scene.js` (`createTrips`, `createScenePlaces`) takes, as a thunk, anything `scene.js` declares below the call (a `const` there is in its temporal dead zone) or reassigns (`props`, `front`). A plain value is only for what is declared above the call and never reassigned. Each task that adds a dep says which it is, by line.
- No `requestAnimationFrame` (the `loops` metric is at its budget), no new `onBeforeCompile`, no new GLSL.

**Ids and space:**
- Ids are Task 0's (`src/lib/space/address.js`). Any spelling is read: `e:` or `E:`, a middle-layer sector with or without its `,0`.
- A generated place's canonical id is the generator's own form, `spaceId(...)` with upper-case `E:`, because the solids' and crash events' ids are that form (lane 2's Task 17). Lane 5b lower-cases it for `/fly`.
- Stations use the wonder numbers above the lattice, `w<STATION_BASE + i>` for system `i`'s station. `THING_BASE + THING_CELLS³ = 8064 < 10000`, so no id that resolved before changes what it names, and `parseSpaceId` is unchanged.
- Generated content is never stored: no `localStorage`, `rt.saves` or `rt.store` row anywhere in this lane.
- **One clock.** A generated place's position at time `t` is `orbitAt` or `moonAt` on the shared clock. The scene's `t` is `spaceTime(state.held || reduced ? 0 : Date.now())`, the same one lane 2's `expanse.update` draws with, and it is kept in `state.spaceT`.
- **One frame.** Every place, row, park, station, solid and ship in this lane is in the map's frame: `map` (`scene.js:503`), the group lane 2's sectors and the hand-made places sit in. The map is turned, `map.rotation.y = state.yaw` (`:5076`, `:5134`), and `state.yaw` becomes `−heading` after an arrival, a spawn or a pose (`:1843`, `:2219`, `:5879`). The three.js camera's `position` is in the scene's frame, so nothing here reads it as a place's. The scene brings it in as `camLocal = map.worldToLocal(camera.position)` (`:5331`, which `aimAt` uses at `:800-803`), and `scenePlaces` does the same with its own `group` (Task 12). `toScreen` (`:1526`) takes map-frame points.

**Numbers the spec pins:**
- About one system in three has a station.
- Docking opens the existing hangar and shop. There is no new economy, no new NPC conversation and no new crew line.
- The jump goes to anything, with `HYPER` as it is (recharge 5 s, held while interdicted).
- Long trips are timed by a formula, not the 150 s simulation.
- Space is 3D: generated places are above, below and level alike.

**Numbers this plan picks (pinned by tests, so they can be tuned):**
- **Stations:**
  - `STATION_BASE = 10000`, `STATION_SHARE = 1/3`, size 18 to 36
  - above or below the star's pole, clear of every planet, ring and moon by 3 × its size, and inside the system's reach
- **Parking** (ship.js's own numbers, exported as `PARK_GAP = { near: 4, deep: 16, in: 8, out: 14 }`):
  - planets, moons and stations park `reach + 4` off
  - systems, things and wonders park `reach + 16` off, a system in a gap between its planets' bands
  - a planet's park keeps clear of each moon's whole circle by `clearOf(moon radius)`, ship.js's `clearPark` margin. Where no way in at `reach + 4` is clear, it parks just past its furthest moon. That is 66 of 2,025 planets with moons in `E:1,0`, `E:2,0` and `E:1,0,1` (cube `[1, 1, 0]`, as Task 8's fixture makes it).
  - **reach by kind:**
    - a system: 2 × its star's size
    - a planet: the greater of 1.9 × its radius and its ring band's outer edge
    - a moon: 1.9 × its radius
    - a station: 1.5 × its size
    - a solid thing or wonder: 1.2 × its size, as lane 2's `nearThings` has it
    - a nebula: 0 (fly into its middle)
- **Where you're at:**
  - Each place's zone is measured from its middle: in at its park distance + 8, out at its park distance + 14.
  - The smallest zone that holds the ship wins.
  - A smaller zone takes over the current place only while the ship is under way (1 unit/s or more), or when a trip ended there.
- **Carry:**
  - One body at a time carries the ship: the trip's goal if it's a planet or moon, else the planet or moon you're at.
  - It gives all of its motion within the greater of 2 reaches and its park distance + 14, easing to none 2 reaches further out.
  - A change of body cross-fades over 2 s.
- **Long trips:**
  - `t = D / (SHIP.pulse × od) + extra + turn × angle / π`
  - `extra = { cruise: 7.1, super: 5.6 }` s and `turn = { cruise: 1.7, super: 0.5 }` s
  - the jump is `HYPER.length`
- **Around the ship.** What's listed follows what's drawn, not what's meshed. A disc on screen with no row could not be picked, named or listed for the map. Lane 2's `discs.js` (`eu/lane-3`, PR 2.4's Task 15) draws, each frame:
  - for every system within `far + 2 × its reach`: its star, its planets at `orbitAt` and their moons at `moonAt`, each within `far + its radius` of the camera, `far` = 45,000 (the far plane)
  - every legacy wonder but a nebula, as its ball (`size × WONDER[kind].r`); a nebula is its cloud, out to the far plane less its size
  - from its Task 21 (PR 2.5), the lattice things and extras too
  - not a system the camera is inside the build reach of (`near.js` meshes it, and it takes none of the budget)
  - the nearest `budget.discs`, with an edge that eases, so while it eases it draws more, up to the far layer's room: `farRoom(device).discs`, 1.5 × the tier's `discs` (600, 1,800, 3,750 and 6,000)

  So the list holds:
  - **near:** every body (star, planets, moons, station) of each system whose `span + 1,000` holds the camera, with the exact parks, and no cap. These are the systems `near.js` builds, which lane 2's budget leaves out: a system's build reach is at most 601 past its reach over the 27 sectors round `E:1,0`.
  - **the rest:** every other system, planet, moon, lattice thing, extra and wonder within `far` + its reach of the camera, the nearest `farRoom(device).discs` of them by distance from the middle. What the disc layer draws is the nearest of a set these hold, never more than that room, so each has a row.
  - refreshed four times a second

  Within the far plane of `E:1,0`'s middle there are 69 systems, 278 planets, 415 moons and 1,746 lattice things. `THING_NEAR × size` stays lane 2's rule for which things are meshes and solids, and this lane doesn't use it. Round any point there are three things within 9,000 (lane 2's density target), and each is listed, so each can be picked from 9,000 off, not only from on top of it.
- **Aim:** a generated star is aimed at by its card's reach (2 × star size), and only from the main sector.
- **Off the main thread:**
  - The scene never builds a sector: it reads `expanse.sectors()` and the few it fetched from the worker pool.
  - The page never resolves an id.
  - Only the terminal's `fly` builds, once, on its own page.
- **Bundle.** `nav.js` loads with three chunks: the home page's `Interests` (the mini-map, after lane 6a), `CommandPalette` (⌘K, preloaded on every page: `App.jsx:392`) and `Front` (the site's root: `pages/Front.jsx` imports `Universe.jsx` statically).
  - Each is measured as its chunk and every chunk it imports statically, gzipped (Task 1's `chunks.mjs`).
  - Task 7 (nav.js's imports) and Task 14 (the page's card) each grow each of the three by at most 2 kB.
  - Neither `Interests` nor `CommandPalette` holds any of the generator (the marker is Task 1's station name `Waystation`).
  - `Front` holds the generator already, through `Universe.jsx` → `online/Online.jsx` → `online/rosterWhere.js` → `fullSector` (finding 21), so it is held to its growth alone.
- **Name tags:**
  - at most `budget.tags`, a new field of lane 2's one tier table (`universe/budget.js`, spec H): 3 on `low`, 6 on `mid`, `high` and `ultra`, lowered with `discs` by the quality steps and never below 1
  - the aimed, picked, gone-to and here places first, then those within aim.js's `NAME_CONE` of the nose, nearest first
- **Docking:**
  - docked within `reach + 4 + 2` at under 1 unit/s
  - undocked past `reach + 4 + 30`
  - a station is drawn only while the camera is inside its system's reach, and grows in from 0 at the reach to full size at 0.85 of it

**Boundaries:**
- **Not touched:**
  - `NavMap.jsx`, `MiniMap.jsx` and `chart/*` (lanes 6a and 6b)
  - `director.js`, `traffic.js`, `hunters.js` and `farFights.js` (4b)
  - `entry.js`, `footScene.js` and `lib/land/*` (5b)
  - `expanse/flight/*` (5b)
  - `expanse/scene/*` (lane 2's; this lane reads `createExpanse(…).sectors()` and `.solids()` and adds nothing there)
  - `online/*`
- **One generator file changes, `expanse/gen/space.js`:** `fullSector` gains `stations`, and `placeOf`'s lookup is exported as `placeIn`. The fingerprint, space, density and job tests stay green unchanged.

**Words and UI (`docs/health/RULES.md`, "UI"):**
- Every new on-screen word goes into `src/components/universe/words.js` first, as `PLACE`.
- British spelling, sentence case, curly quotes, no Oxford comma.
- No retired word (`src/lib/words.js`'s `RETIRED`; mind "hyperdrive").
- Tags reuse the pilot tags' look (`online.css`'s `.universe-tag`), in the nav map's blue `#9fd8ff`. No `z-index`.

**Browser checks:**
- Headless Chromium draws in software here at a frame or two a second, and `universe-check` takes 2 to 4 minutes a pose and tier.
- A task's browser check runs at `--quality mid` only, on the steps or poses it changes. Task 15 runs the full all-tier measure once.
  - `autopilot-check.mjs` takes `--quality mid` in a task's check. The lane's gate above runs it as the index gives it.
  - `navmap-check.mjs`, `sector-check.mjs`, `flyto-check.mjs` and `links-check.mjs` draw no pose and take no quality flag: each loads `?quality=low` itself (`navmap-check.mjs:16`, `sector-check.mjs:26`, `flyto-check.mjs:40`, `links-check.mjs:30`). They run as they are.
- **Chromium.** Every browser command runs with `CHROME=/opt/pw-browsers/chromium CHROMIUM=/opt/pw-browsers/chromium` in front of it (shell state doesn't carry between commands here). That path is a link to `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`, and either spelling works.
  - `navmap-check` and `links-check` default to `/opt/google/chrome/chrome`, which isn't in this container.
  - `universe-check` and `autopilot-check` read `CHROMIUM` (or `--chromium`). Their own search wants `/opt/pw-browsers/chromium-N/chrome-linux/chrome`, but this container's is `chromium-1243/chrome-linux64/chrome`. Playwright's own fallback wants revision 1194, which isn't here either. `autopilot-check` stops with "no Chromium (set CHROMIUM=…)" without it.
- **The dev server.** The four checks above don't start a server. Each opens `http://localhost:5173` (`navmap-check.mjs:16`, `sector-check.mjs:26`, `flyto-check.mjs:39-40` and `links-check.mjs:30`). Before them:
  1. Start `npx vite --port 5173 --strictPort` in the background (the Bash tool's `run_in_background`).
  2. Wait until `curl --noproxy '*' -sf -o /dev/null http://localhost:5173/` succeeds, in an until-loop on that condition, giving up after 60 s.
  3. Run the checks.
  4. Stop the server after.

  `universe-check`, `universe-endless-check`, `autopilot-check` and `perf-probe` start their own.
- Every wait is on a condition, never a sleep.
- Evidence goes in `docs/superpowers/evidence/endless-universe-lane-3/`, each picture under 1 MB (element shots, or JPEG at 80).

## Review Focus

1. **A generated id in another spelling, or one that isn't there.** These must all give the canonical place or nothing, and never throw, a blank card or a trip into nowhere:
   - a link `/universe/e:1,0,0:0:1`
   - a typed `fly E:1,0:0` in the terminal
   - `E:1,0:0:99` (past the planets)
   - `E:1,0:w60` (an empty slot)
   - `E:1,0:w10003` (a system with no station)
   - junk

   With 3D off, failed or lost, no scene runs to find the place, so `/universe/E:1,0:0:0` shows a plain card for the id, its sector and "fly here in 3D", never "Plotting a course…" for ever. That is the index's Review Focus 5 (no 3D).

   Pinned in Task 3 (resolver), Task 7 (`findDestination`, `canGo`) and Task 14 (a link to `E:1,0:0:99` ends in no card, not a stuck wait; `cardRow`'s flat row; the `flat` step with `tp-3d` off).
2. **A moving target.** These must all hold:
   - A trip to a fast planet or moon stops, and the ship stays parked off it for minutes with the stick let go.
   - A planet that parks past its moons is carried and arrived at like any other.
   - A moon going by a ship parked at its planet neither drags it nor becomes where it's at.
   - Handing over from a planet to its moon is no jolt.
   - A jump comes out where the place is at the flash, not where it was when the jump began.

   **Two clocks.** Orbits run on the wall clock (`spaceTime(Date.now())`), while the ship's physics run on the frame's `dt`, held to `MAX_DT = 0.05` s (`runtime.js:62`). At 1 to 2 frames a second, as in software GL here, a planet moves 10 to 20 times further a frame than the ship can, in the ship's own time. `E:1,0:0:0` moves at 0.645 units a second, and the autopilot's stop needs the ship within 0.4 at under 0.25 units a second (`ship.js:775-779`). So without the carry no trip to a moving place ends at a low frame rate. The carry moves the ship by the body's own motion between two space-clock times (`carry(ship, frames, t0, t1)`), whatever the frame's `dt`, which is what makes these trips end on a slow device. Task 11's browser leg goes to fixed places, and Task 12, once the carry is wired, adds the planet.

   Pinned in Task 4 (follow, the moon fallback), Task 5 (carry), Task 8 (where you're at), Task 11 (the jump's park) and Task 12 (a passing moon over ten minutes, and the `travel` step's planet leg at mid in software GL).
3. **A pocket universe** (`/universe/E:1,0:0?seed=marble`). Every resolve the scene makes uses the pocket's universe, not the shared one. That covers the card the page shows from it, the aim's name, travel, a fetch from the worker and the start. Pinned in Task 3 (universe option) and Task 12 (`places.resolve` over the pocket's own loaded sector gives the pocket's name, and a fetch sends the pocket's universe to the job and resolves in it).
4. **Far away, and from inside the Curve.** These must all give a finite time, never a dash, and the portal leg:
   - a trip to a place thousands of sectors off
   - a hand-made place out of the 150 s simulation's range
   - a generated place from the Rick and Morty pocket

   Pinned in Tasks 6 and 7.
5. **Docking, but not by accident.**
   - A trip to a station that the pilot calls off doesn't open the Hangar.
   - Flying in slowly by hand docks without opening it.
   - The Hangar opened by docking closes with Escape and doesn't open again while you sit there.
   - Sitting at the dock's edge doesn't flicker between docked and not.

   Pinned in Task 9 (hysteresis) and Task 12 (open only for the trip's own end, once).
6. **A place outside the loaded sectors.** Each of these needs a sector that isn't built:
   - a far trip
   - a link's start
   - the card for a link
   - the terminal's `fly`
   - lane 6b's visited places

   A sector costs 45 to 130 ms to make in Node here, several times that on a low-tier phone. So:
   - The scene never makes one on the main thread. It fetches it from the worker pool and goes when it lands. A later trip, the stick, a crash or a drop calls off the wait.
   - The page never resolves at all.
   - Only the terminal's `fly` makes one, once, on its own page, and that is timed.

   Pinned in Task 3 (`build: false`), Task 11 (a trip that waits on a fetch, and one superseded), Task 12 (`find` and `fetch` against a fake pool) and Task 14 (the terminal timed at 4× CPU throttling).
7. **The weight of every page that loads `nav.js`.** A module is never split across chunks. So if `nav.js` imported anything from `resolve.js` (whose `resolvePlace` the scene and the terminal use), `resolve.js` and the generator behind it would land in a chunk loaded by every importer of `nav.js`:
   - the home page's `Interests`, through the mini-map
   - `CommandPalette`, preloaded on every page (`App.jsx:392`)
   - `Front`, the site's root, through `Universe.jsx`

   So `nav.js`, `park.js` and `Universe.jsx` import only `places/ids.js` and the light face, and generated places reach `nav.js` only through the lookup its caller passes. Pinned in Task 7 (`weight.test.js` walks the static imports of `nav.js`, `CommandPalette.jsx` and `Interests.jsx` and finds no generator file; the three chunks grow by at most 2 kB gzipped and `Waystation` is in neither `Interests`' nor `CommandPalette`'s) and Task 14 (`Universe.jsx` reaches neither `resolve.js` nor `cards.js`; the three again).
8. **Hand-made trips and links after the move.** Once the travel block lives in `trips.js`, these must all fly as before:
   - every hand-made trip, jump and reduced-motion arrival
   - a pilot follow
   - a portal leg
   - a link to a wonder
   - the grand tour

   The block sits at `scene.js:1769`, above `powers` (`:2338`) and `unique` (`:2340`), and `props` is reassigned on every page update (`:6120`). Passed as values, the first two throw on load and the third keeps a stale `drive` and `frozen`. `front` is a `let` set later (`:1053`, `:1072`), and the block reads it three times: travel's `(id === 'front' && front)`, `frontPark`'s `front?.goal()` and `frontSpace`'s `front.goal()`. Destructured as a value it stays null, so a trip to the war front never goes.

   Pinned in Task 10 (its tests written against today's behaviour before the move; made before `powers` and `unique` exist; the page's props read as they are now; a trip to the front parks inside the fight; then the navmap, sector, flyto and smoke checks after).
9. **A turned map.** After any arrival, spawn or pose, `state.yaw` is `−heading` and the map is turned by it (Global Constraints, "One frame"). A place 10^5 units out, measured from the scene-frame camera, is thousands of units from where it is. These must all hold with the map turned:
   - what's near
   - the stations drawn and docked at
   - where you're at
   - the aim at a generated star

   Pinned in Task 12: `scenePlaces` takes the map-frame camera from its own `group`, and a test turns the group by 1.2 radians and still arrives and docks.
10. **A disc you can see.** Lane 2 draws every star, planet, moon and thing within the far plane as a disc (up to the far layer's room). Each must have a row, so it can be picked, named and handed to lane 6b's map. Pinned in Task 8 (a thing 5,000 and 30,000 off is listed, one past the far plane isn't, and every lattice thing within it is; a moon is listed from 5,000 past its system's reach + 1,000; the cap leaves out none of the systems the camera is in) and Task 13 (a thing 5,000 off is picked at its projected point).

## Files

| File | Responsibility | Task |
|---|---|---|
| `src/components/expanse/gen/stations.js` (new) | a station at one system in three, from its seed | 1 |
| `src/components/expanse/gen/extent.js` (new) | `extentOf`, how far a planet's body, ring and moons reach; imports nothing | 1 |
| `src/components/expanse/gen/space.js` | `fullSector` gains `stations`; `placeIn` | 1 |
| `src/components/expanse/gen/tables.js` | `STATION_NAMES` | 1 |
| `src/components/expanse/shared/gen.js` (new), `gen.test.js` | the expanse's face for the universe: the whole generator (lane 2's `withMoons` and `sectorJob` join in Task 12) | 1, 12 |
| `src/components/expanse/shared/orbits.js` (new) | the light face: orbits and extents, no generator | 1 |
| `src/components/universe/places/ids.js` (new) | ids in any spelling, `atTime`; no generator | 3 |
| `src/components/universe/places/weight.test.js` (new) | what `nav.js`, ⌘K, the home page and the page reach | 7, 14 |
| `src/components/universe/places/pageCard.js` (new) | which card the page shows for a link: found, waiting, flat | 14 |
| `src/components/universe/words.js` | `PLACE` | 2 |
| `src/components/universe/ship.js` | `export const PARK_GAP`, `export const clearOf` | 2 |
| `src/components/universe/places/cards.js` (new) | each kind's card: words, reach, solid, dock, land | 2 |
| `src/components/universe/places/resolve.js` (new) | `E:` id to destination row, by the generator | 3 |
| `src/components/universe/places/park.js` (new) | parking, following a moving park, a trip's space | 4 |
| `src/components/universe/places/carry.js` (new) | a ship near a moving body goes with it | 5 |
| `src/components/universe/places/trip.js` (new) | the long-trip formula | 6 |
| `src/components/universe/nav.js` | `E:` ids in every destination function | 7 |
| `src/components/universe/places/around.js` (new) | what's near the ship; where it's at; stars to aim at | 8 |
| `src/components/universe/places/pick.js`, `dock.js` (new) | picking, which names show, docking | 9 |
| `src/components/universe/budget.js` (lane 2's) | the `tags` field, stepped with `discs` | 9 |
| `src/components/universe/trips.js` (new) | the scene's travel block, moved out, then taught `E:` ids | 10, 11 |
| `src/components/universe/places/scenePlaces.js` (new) | the scene's places: around, stations, carry, here, dock, pick, tags | 12, 13 |
| `src/components/universe/places/stationLook.js` (new) | generated stations drawn, instanced | 12 |
| `src/components/universe/places/placeTags.js` (new), `placeTags.test.js` | the name tags, DOM through a passed-in document | 13 |
| `src/components/universe/places/PlaceCard.jsx` (new) | a generated place's card, or its wait | 14 |
| `src/components/universe/scene.js` | wiring only, smaller after | 10–13 |
| `src/components/universe/UniverseMap.jsx`, `UniversePanel.jsx`, `src/pages/Universe.jsx` | the map says whether it's live, loading or flat; the card, the link, docking opens the Hangar | 14 |
| `src/pages/Terminal.jsx` | `fly E:…` resolves through a lookup | 14 |
| `src/components/universe/poses.js`, `scripts/universe-check.mjs`, `scripts/universe-endless-check.mjs` | a station pose; this lane's steps | 12–15 |

---

## PR 3.1: The pure half

### Task 1: Stations in the generator, and the expanse's face for the universe

**Files:**
- Create: `src/components/expanse/gen/stations.js`, `src/components/expanse/gen/stations.test.js`, `src/components/expanse/gen/extent.js`, `src/components/expanse/shared/gen.js`, `src/components/expanse/shared/orbits.js`, `src/components/expanse/shared/gen.test.js`, `docs/superpowers/evidence/endless-universe-lane-3/README.md` (the bundle before; later the timings and the numbers)
- Modify: `src/components/expanse/gen/space.js` (`fullSector` after `appendSystems(sector, outs)`; `wonderPlace` (`:165-178`) and `placeOf` (`:180-193`) at the file's end), `src/components/expanse/gen/tables.js` (append)
- Not touched: `src/components/expanse/shared/shared.test.js` and `levels.js` (lane 2's, on this branch), and lane 2's `shared/space.js` (on `eu/lane-2`)

**Interfaces:**
- Consumes: `fullSector`, `systemReach`, `addBodies`' planet rows (`orbit`, `radius`, `ringBand`, `moonList`), `rngOf`, `hash64`, `range`, `pick` (`seed.js`), Task 0's `spaceId` and `parseSpaceId`.
- Produces:
  - **Constants:** `STATION_BASE = 10000`, `STATION_SHARE = 1 / 3`, `STATION_SIZE = [18, 36]`, and `STATION_NAMES = ['Station', 'Dock', 'Exchange', 'Port', 'Yards', 'Waystation']` (in `tables.js`).
  - **`extentOf(planet) → number`**, in `gen/extent.js`, a module that imports nothing: how far from its middle a planet's body, ring and moons reach, `max(radius, ringBand?.outer ?? 0, the greatest orbit + radius of any moon)`. It is not `systemReach`'s last moon: by `moonsOf`'s slots, an earlier, bigger moon can reach further. None does in the five test cubes, 0 of 4,581 planets, but the rule allows it. `systemReach` is left as it is, for the fingerprint. It has a file of its own because `park.js` needs it and `nav.js` imports `park.js`: from `stations.js` it would bring `seed.js`, `tables.js` and `stationOf` (which `fullSector` uses) into every chunk that loads `nav.js`.
  - **`poleHeight(system, size) → number | null`.**
    - It is the least `h ≥ star.size + 4·size` with `hypot(p.orbit, h − 40) ≥ extentOf(p) + 3·size` for every planet. Planets stay within ±40 of their star's height on `orbitAt`, so that clearance holds at every `t`.
    - It is null when `h > system.reach − size`.
  - **`stationOf(system, { sx, sy, sz }) → Station | null`.**
    - It draws from `rngOf(hash64(system.seed, 'station'))`, in this order:
      1. `rng() < STATION_SHARE`, or null
      2. the size, `range(rng, ...STATION_SIZE)`
      3. the name's suffix, `pick(rng, STATION_NAMES)`
      4. the side, `rng() < 0.5 ? 1 : -1`
    - It is null when `poleHeight` is.
  - **`Station`** is `{ id: spaceId([sx, sy, sz], { wonder: STATION_BASE + system.i }), kind: 'station', i: system.i, system: system.id, name: '<system name> <suffix>', at: [star x, star y + side · h, star z], size, faction: system.faction, seed }`. A station keeps its place, with no orbit.
  - **`stationsOf(sector) → Station[]`**, ascending by `i`.
  - **`fullSector(...)`** gains `stations: stationsOf(sector)`, with `things: false` too, since stations are cheap.
  - **`placeIn(sector, parsed) → { kind, row, sector } | null`.**
    - It is `placeOf`'s lookup on a sector already made.
    - `kind` gains `'station'`, for a wonder number of `STATION_BASE` or more: a binary search of `stations` by `i`.
    - In `wonderPlace`, the `n >= STATION_BASE` branch comes first, before today's `n >= THING_BASE` lattice branch (`space.js:166`). Every station number is past `THING_BASE` too, so in the lattice branch `w10003` would search `things.slot` for slot `10003 − THING_BASE`, find nothing and give null.
    - `placeOf(universe, id)` becomes `placeIn(sectorFor(universe, p), p)`, with the same behaviour.
  - **`src/components/expanse/shared/gen.js`** lends exactly these names: `UNIVERSE`, `universeOf`, `fullSector`, `placeOf`, `placeIn`, `orbitAt`, `moonAt`, `bodiesAt`, `spaceTime`, `systemReach`, `THING_BASE`, `THING_CELLS`, `THING_NEAR`, `THING_KINDS`, `SECTOR_EXTRAS`, `thingRow`, `WONDER_KINDS`, `STATION_BASE`, `stationsOf` and `extentOf`. Every source is pure, so the face is too. Task 12 adds lane 2's `withMoons` and `sectorJob` (`expanse/gen/job.js`, its PR 2.5's Task 19, not on this branch yet): `withMoons` puts the moons back on a sector that came from the worker, and `sectorJob` is lent so the scene's tests can run the worker's job in process.
  - **`src/components/expanse/shared/orbits.js`**, the light face, lends exactly `orbitAt`, `moonAt` and `spaceTime` (from `gen/orbits.js`) and `extentOf` (from `gen/extent.js`), and imports nothing else. Neither source imports anything. Its header says why it is apart: `nav.js` reaches it through `ids.js` and `park.js`, and so does every page that loads `nav.js`.

- [ ] **Step 0: Record the bundle before**, on the branch as it stands, before any code of this lane. (On `eu/lane-3` that is lane 2 through PR 2.4's Task 16, without lane 6a, so `Interests` doesn't load `nav.js` yet: Task 14 measures it again after the merge.)
  - Write this scratch script to your scratchpad as `chunks.mjs` (not committed). It follows a chunk's static imports, as the browser loads them, and leaves `import()` out:

    ```js
    // node chunks.mjs <dist/assets> <marker> <Name>…: each chunk's static closure, gzipped, and where the marker is
    import { readFileSync, readdirSync } from 'node:fs';
    import { gzipSync } from 'node:zlib';
    import { join } from 'node:path';
    const [dir, marker, ...names] = process.argv.slice(2);
    const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
    const STATIC = /(?:^|[;}\s])(?:import|export)\s*(?:[\w$*{}\s,]+from\s*)?["']\.\/([\w.$-]+\.js)["']/g;
    for (const name of names) {
      const seen = new Set([files.find((f) => f.startsWith(`${name}-`))]);
      for (const f of seen) for (const m of readFileSync(join(dir, f), 'utf8').matchAll(STATIC)) seen.add(m[1]);
      const gz = [...seen].reduce((n, f) => n + gzipSync(readFileSync(join(dir, f))).length, 0);
      const hits = [...seen].filter((f) => readFileSync(join(dir, f), 'utf8').includes(marker));
      console.log(`${name}: ${seen.size} chunks, ${(gz / 1024).toFixed(2)} kB gzipped; ${marker} in ${hits.join(', ') || 'none'}`);
    }
    ```
  - Run `npm run build`, then `node <scratchpad>/chunks.mjs dist/assets Waystation Front CommandPalette Interests Terminal`.
  - Write the four lines into the evidence README under "Bundle". On `eu/lane-2` at PR 2.3 it gave Front 682.8 kB over 144 chunks, CommandPalette 172.5 kB, Interests 150.9 kB and Terminal 169.0 kB, and the generator's `fullSector` sits in the `Online-*.js` chunk, which only `Front` (and the galaxy's pages) load statically.
- [ ] **Step 1: Write the failing tests.** `stations.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { parseSpaceId, spaceId } from '../../../lib/space/address.js';
import { fullSector, placeIn, placeOf } from './space';
import { UNIVERSE, universeOf } from './seed';
import { moonAt, orbitAt } from './orbits';
import { THING_BASE, THING_CELLS, thingRow } from './things';
import { extentOf } from './extent';
import { STATION_BASE, STATION_SHARE, poleHeight, stationsOf } from './stations';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CUBES = [[1, 0, 0], [0, 0, 1], [2, 1, -3], [0, 0, 0], [-3, -1, 2]];

describe('stations', () => {
  it('number above the lattice, so no id that resolved before changes', () => {
    expect(STATION_BASE).toBe(10000);
    expect(THING_BASE + THING_CELLS ** 3).toBeLessThan(STATION_BASE);
    expect(STATION_SHARE).toBeCloseTo(1 / 3, 12);
  });
  it('one system in three has one, numbered by its system, held by its faction', () => {
    let systems = 0;
    let stations = 0;
    for (const [sx, sy, sz] of CUBES) {
      const s = fullSector(UNIVERSE, sx, sy, sz, { things: false });
      systems += s.systems.length;
      stations += s.stations.length;
      expect(s.stations.map((st) => st.i)).toEqual(s.stations.map((st) => st.i).sort((a, b) => a - b));
      for (const st of s.stations) {
        const sys = s.systems[st.i];
        expect(st.id).toBe(spaceId([sx, sy, sz], { wonder: STATION_BASE + st.i }));
        expect(parseSpaceId(st.id).wonder).toBe(STATION_BASE + st.i);
        expect([st.kind, st.system, st.faction]).toEqual(['station', sys.id, sys.faction]);
        expect(st.name.startsWith(`${sys.name} `)).toBe(true);
        expect(st.size).toBeGreaterThanOrEqual(18);
        expect(st.size).toBeLessThanOrEqual(36);
      }
    }
    expect(stations / systems).toBeGreaterThan(0.28);
    expect(stations / systems).toBeLessThan(0.38);
  });
  it('keeps clear of its star, planets, rings and moons whenever you look, and inside its system', () => {
    const s = fullSector(UNIVERSE, 1, 0, 0, { things: false });
    for (const st of s.stations) {
      const sys = s.systems[st.i];
      expect(st.at[0]).toBe(sys.at[0]);
      expect(st.at[2]).toBe(sys.at[2]);
      expect(Math.abs(st.at[1] - sys.at[1])).toBe(poleHeight(sys, st.size));
      expect(len(st.at, sys.at)).toBeGreaterThanOrEqual(sys.star.size + 3 * st.size);
      expect(len(st.at, sys.at)).toBeLessThanOrEqual(sys.reach - st.size + 1e-9);
      for (const t of [0, 1234.5, 40000, 1.7e9]) {
        for (const p of sys.planets) {
          expect(len(st.at, orbitAt(p, t))).toBeGreaterThanOrEqual(extentOf(p) + 3 * st.size - 1e-6);
          for (const m of p.moonList) expect(len(st.at, moonAt(m, p, t)) - m.radius).toBeGreaterThan(2 * st.size);
        }
      }
    }
  });
  it('resolves by its id, and nothing past the lattice or a station that isn’t there does', () => {
    const s = fullSector(UNIVERSE, 1, 0, 0);
    const st = s.stations[0];
    expect(placeOf(UNIVERSE, st.id)).toMatchObject({ kind: 'station', row: st });
    expect(placeOf(UNIVERSE, st.id.toLowerCase()).row).toEqual(st);
    const bare = s.systems.find((sys) => !s.stations.some((x) => x.i === sys.i));
    expect(placeOf(UNIVERSE, `E:1,0:w${STATION_BASE + bare.i}`)).toBeNull();
    for (const id of ['E:1,0:w8064', 'E:1,0:w9999', `E:1,0:w${STATION_BASE + 99999}`]) expect(placeOf(UNIVERSE, id), id).toBeNull();
  });
  it('placeIn finds on a sector in hand what placeOf finds', () => {
    const s = fullSector(UNIVERSE, 1, 0, 0);
    const sys = s.systems[3];
    const moon = s.systems.flatMap((x) => x.planets).find((p) => p.moonList.length).moonList[0];
    const ids = [sys.id, sys.planets[0].id, s.stations[0].id, thingRow(s, 0).id, moon.id];
    for (const id of ids) expect(placeIn(s, parseSpaceId(id))?.row, id).toEqual(placeOf(UNIVERSE, id)?.row);
  });
  it('a pocket universe has stations of its own', () => {
    const a = stationsOf(fullSector(UNIVERSE, 1, 0, 0, { things: false })).map((st) => st.name);
    const b = stationsOf(fullSector(universeOf('marble'), 1, 0, 0, { things: false })).map((st) => st.name);
    expect(b).not.toEqual(a);
  });
  it('measures a planet out to its furthest moon, not its last', () => {
    const moon = (orbit, radius) => ({ orbit, radius });
    expect(extentOf({ radius: 10, ringBand: null, moonList: [moon(40, 9), moon(45, 3)] })).toBe(49);
    expect(extentOf({ radius: 10, ringBand: { inner: 13, outer: 30 }, moonList: [] })).toBe(30);
    expect(extentOf({ radius: 10, ringBand: null, moonList: [] })).toBe(10);
  });
});
```

  `expanse/shared/gen.test.js` pins both faces' names, in a file of its own so lane 2's `shared.test.js` is left as it is. It mirrors that file's `FACE` table (`[module, sources, names]`):
  - each module's sorted keys equal its list above, and each name is its source's own (`toBe`)
  - the light face's own `import … from` lines, read from its source with `scripts/health/graph.mjs`'s `FROM` and `uncomment`, name only `../gen/orbits` and `../gen/extent`, and neither of those names any import at all
  - `gen.js`'s own `import … from` lines, read the same way, name only `../gen/` files, never `../scene/`, `three` or `react`

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/stations.test.js src/components/expanse/shared`. Expected: FAIL, because `./stations`, `./extent`, `./gen` and `./orbits` can't be resolved. Lane 2's `shared.test.js` passes.
- [ ] **Step 3: Implement** `extent.js` and `stations.js` to the Interfaces, append `STATION_NAMES`, wire `stations` into `fullSector`, put the station branch first in `wonderPlace`, export `placeIn`, and write both faces. The header comments are in the repo's voice, listing the exports as `things.js` does. The station header says why the pole: planets keep within ±40 of their star's plane, so a point over the pole is clear at every `t` and needs no orbit of its own. (`orbitAt` turns a planet about the part of up square to where it starts, so its height goes between ±its starting height, which `planetsOf` keeps within ±40.) `gen.js`'s header says why it isn't lane 2's `space.js`: that face lends the drawn Expanse, and so three.js.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse`. Expected: PASS, with `fingerprint.test.js`, `space.test.js`, `density.test.js` and lane 2's `shared.test.js` unchanged and green. (Lane 2's `job.test.js` comes with PR 2.5; Task 12 runs it.)
- [ ] **Step 5: Record the stations' weight.** Run `npm run build` and the Step 0 command again, and add the four lines to the README. `Front` grows by the stations' code (it reaches `fullSector` through `online/rosterWhere.js`, finding 21). The others don't change, and `Waystation` is in none of them but `Front`'s `Online-*.js`.
- [ ] **Step 6: Commit.** `git add src/components/expanse docs/superpowers/evidence/endless-universe-lane-3 && git commit -m "Stations at one system in three, and the expanse's two faces for the universe"`. The body gives the four chunks before and after.

### Task 2: The words and cards for generated places

**Files:**
- Modify: `src/components/universe/words.js` (append `PLACE`)
- Modify `src/components/universe/ship.js`:
  - `:147-149`, the private `ORBIT_IN`, `ORBIT_OUT` and `PARK`: add `export const PARK_GAP` beside them (+1).
  - `:699-705`, `clearPark`: `const need = o.r + SHIP.radius + Math.max(1, o.r * 0.3) + 1;` becomes `const need = clearOf(o.r);`, with `export const clearOf = (r) => r + SHIP.radius + Math.max(1, r * 0.3) + 1;` above the function (+1). It behaves the same; park.js clears moons by it.
- Create: `src/components/universe/places/cards.js`, `src/components/universe/places/cards.test.js`

**Interfaces:**
- Consumes: Task 1's face (`THING_KINDS`, `WONDER_KINDS`).
- Produces:
  - **`PARK_GAP = { near: PARK, deep: PARK * 4, in: ORBIT_IN, out: ORBIT_OUT }`** in `ship.js` (4, 16, 8, 14).
  - **`clearOf(r) → number`** in `ship.js`: how far from a moving solid's middle a stop must be for `clearPark` to leave it be.
  - **`PLACE`** in `words.js`:
    ```js
    export const PLACE = {
      star: { O: 'Blue giant', B: 'Blue giant', A: 'White star', F: 'Yellow-white star', G: 'Yellow star', K: 'Orange star', M: 'Red dwarf', 'white dwarf': 'White dwarf', neutron: 'Neutron star' },
      system: (star) => `${star} system`,
      planet: { rock: 'Rocky world', ice: 'Ice world', gas: 'Gas giant', lava: 'Lava world', ocean: 'Ocean world', desert: 'Desert world', forest: 'Forest world', ringed: 'Ringed giant' },
      moon: { rocky: 'Rocky moon', icy: 'Icy moon' },
      station: 'Station',
      thing: { rock: 'Asteroid', ice: 'Ice shard', derelict: 'Derelict', rogue: 'Rogue planet', nebula: 'Nebula', pulsar: 'Pulsar', default: 'Something in space' },
      about: {
        system: ({ star, planets, station, held }) => `${/^[aeiou]/i.test(star) ? 'An' : 'A'} ${star.toLowerCase()} with ${count(planets, 'planet')}${station ? ' and a station' : ''}, held by ${held}.`,
        planet: ({ type, system, moons, rings }) => `${type} round ${system}, with ${count(moons, 'moon')}${rings ? ' and rings' : ''}.`,
        moon: ({ type, planet, system }) => `${type} of ${planet}, round ${system}.`,
        station: ({ system, held }) => `A station over ${system}’s star, held by ${held}. Dock for the hangar and the shop.`,
        rock: 'A drifting rock, pitted and slow.',
        ice: 'A shard of ice, catching the light.',
        derelict: 'A dead ship, drifting. Nobody aboard answers.',
        rogue: 'A planet with no star of its own, dark and cold.',
        nebula: 'A cloud of gas and dust. Not solid: fly right through it.',
        pulsar: 'A dead star, spinning, its beams sweeping round.',
        default: 'Out here between the stars.',
      },
      held: (name) => name.replace(/^The /, 'the '), // (a faction's name mid-sentence)
      hazard: { storm: 'Ion storms', pirates: 'Pirates', minefield: 'A minefield' },
      traffic: (k) => (k >= 0.66 ? 'Busy' : k >= 0.33 ? 'Some' : 'Quiet'),
      facts: { system: 'System', planet: 'Planet', planets: 'Planets', moons: 'Moons', rings: 'Rings', held: 'Held by', traffic: 'Traffic', hazard: 'Hazard' },
      yes: 'Yes',
      fly: 'Fly here',
      dock: 'Dock here',
      hangar: 'Hangar and shop',
      docked: (name) => `Docked at ${name} · H for the hangar and shop`,
      plotting: 'Plotting a course…', // (a link's card while the scene finds the place)
      flat: 'Out in the endless universe. Fly here in 3D.', // (a link's card with 3D off, failed or lost: no scene runs to find it)
    };
    ```
    `count(n, word)` is a local helper. It gives `no planets` for 0, `1 planet` for 1 and `n planets` otherwise.
  - **`THING_CARDS: { [kind]: { type, about, color, solid = true, far?, move? } }`.**
    - One row for each of `rock`, `ice`, `derelict`, `rogue`, `nebula` (`solid: false`), `pulsar` and `default`.
    - The colours are `THING_KINDS`' `look.color`, and for the legacy wonders `expanse/scene/sectors.js`'s `WONDER` colours: nebula `#b48cff`, pulsar `#b8f4ff`.
    - `far`, in units, is how far off it's listed round the ship. The default is the far plane, 45,000, for every kind, since lane 2 draws them all as discs out to there (Task 8). A kind lane 4a draws further out (an impostor past the far plane) sets its own.
    - `move(row, t) → [x, y, z]` is for a kind that moves on the shared clock (lane 4a's comets and drifters). None of today's kinds has one. It is named `move`, not `at`, because a `Destination`'s `at` is its position at `t` (Task 3), and `cards.js` is the generator's side, which `ids.js` may not import.
    - This is lane 4a's table: a kind it adds gets a row here, or the test below fails.
  - **`placeCard(found) → Card`**, where `found` is `placeIn`'s `{ kind, row, sector }` plus `system` (for a planet, moon or station) and `planet` (for a moon).
  - **`Card`** is `{ kind, sub, name, type, about, facts: [[label, value]], color, r, reach, deep, solid, dock, land, faction, system, span, move }`. `move` is the thing's card's `move`, else null (and null for a system, planet, moon or station, which `ids.js` places by their own orbits):

| `found.kind` | `kind` | `sub` | `r` | `reach` | `deep` | other |
|---|---|---|---|---|---|---|
| `system` | `'star'` | star class | `star.size` | `star.size × 2` | true | `span: row.reach`, `color: star.color` |
| `planet` | `'world'` | its type | radius | `max(1.9 r, ringBand?.outer ?? 0)` | false | `land: type ∉ {gas, ringed}` |
| `moon` | `'world'` | `rocky` or `icy` | radius | `1.9 r` | false | `land: true`; colour `#8a8178` or `#cfe3ee` |
| `station` | `'station'` | `'station'` | size | `1.5 × size` | false | `dock: true`, `color: '#9fd8ff'` |
| `thing`, `extra`, `wonder` | `'wonder'` | `row.kind` | `solid ? size : 0` | `solid ? 1.2 × size : 0` | true | from `THING_CARDS[row.kind] ?? THING_CARDS.default` |

  - **`facts`:**
    - a system has planets, held by, traffic, and a hazard when there is one
    - a planet has its system and moons, and rings when it has them
    - a moon has its planet and system
    - a station has its system, held by and traffic
    - a thing has none

    `faction` is the row's or its system's, else null. `system` is the system's id, else null.

- [ ] **Step 1: Write the failing tests** in `cards.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { PLACE } from '../words';
import { PARK_GAP, clearOf } from '../ship';
import { THING_KINDS, WONDER_KINDS, fullSector, placeIn, thingRow, UNIVERSE } from '../../expanse/shared/gen';
import { parseSpaceId } from '../../../lib/space/address';
import { THING_CARDS, placeCard } from './cards';

const s = fullSector(UNIVERSE, 1, 0, 0);
const found = (id) => {
  const f = placeIn(s, parseSpaceId(id));
  const p = parseSpaceId(id);
  const system = f.kind === 'station' ? s.systems[f.row.i] : s.systems[p.system];
  return { ...f, system, planet: p.moon !== undefined ? system.planets[p.planet] : undefined };
};

describe('a generated place’s card', () => {
  it('parks by ship.js’s own numbers', () => {
    expect(PARK_GAP).toEqual({ near: 4, deep: 16, in: 8, out: 14 });
    expect(clearOf(10)).toBeCloseTo(14.15, 12);
    expect(clearOf(2)).toBeCloseTo(4.15, 12);
  });
  it('has a card for every kind the generator makes, so a new kind needs one', () => {
    for (const k of [...THING_KINDS.map((t) => t.kind), ...WONDER_KINDS]) expect(THING_CARDS[k], k).toBeDefined();
    expect(THING_CARDS.nebula.solid).toBe(false);
    for (const [k, c] of Object.entries(THING_CARDS)) {
      expect(c.move === undefined || typeof c.move === 'function', k).toBe(true);
      expect(c.at, k).toBeUndefined(); // (a mover is `move`: a Destination's `at` is a position)
    }
    expect(placeCard({ kind: 'thing', row: thingRow(s, 0), sector: s }).move).toBeNull();
  });
  it('says a system’s star, its planets, who holds it and how busy it is', () => {
    const sys = s.systems[0];
    const c = placeCard(found(sys.id));
    expect(c).toMatchObject({ kind: 'star', sub: sys.star.class, name: sys.name, type: PLACE.system(PLACE.star[sys.star.class]), r: sys.star.size, reach: sys.star.size * 2, deep: true, span: sys.reach, dock: false, land: false });
    expect(c.about).toMatch(/^An? .+, held by .+\.$/);
    expect(c.facts.map(([k]) => k)).toEqual([PLACE.facts.planets, PLACE.facts.held, PLACE.facts.traffic, ...(sys.hazard ? [PLACE.facts.hazard] : [])]);
  });
  it('sizes a planet by its rings, lands on a rocky one, never on a giant', () => {
    const planets = s.systems.flatMap((x) => x.planets);
    for (const p of planets.slice(0, 200)) {
      const c = placeCard(found(p.id));
      expect(c.reach).toBe(Math.max(1.9 * p.radius, p.ringBand?.outer ?? 0));
      expect(c.land).toBe(!['gas', 'ringed'].includes(p.type));
      expect(c.type).toBe(PLACE.planet[p.type]);
    }
  });
  it('docks at a station, and parks things further off than bodies', () => {
    const st = placeCard(found(s.stations[0].id));
    expect(st).toMatchObject({ kind: 'station', dock: true, reach: s.stations[0].size * 1.5, deep: false, type: PLACE.station });
    const row = thingRow(s, 0);
    expect(placeCard({ kind: 'thing', row, sector: s })).toMatchObject({ kind: 'wonder', sub: row.kind, r: row.size, reach: row.size * 1.2, deep: true, type: PLACE.thing[row.kind] });
  });
  it('writes in the house style', () => {
    const texts = [...s.systems.slice(0, 20).map((x) => placeCard(found(x.id)).about), placeCard(found(s.stations[0].id)).about];
    for (const t of texts) {
      expect(t).not.toMatch(/'|"|\bcolor|\bcenter/);
      expect(t).not.toMatch(/held by The /);
    }
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/cards.test.js`. Expected: FAIL, because `./cards` can't be resolved.
- [ ] **Step 3: Implement** `PARK_GAP`, `PLACE` and `cards.js`.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe/places src/lib/words.test.js src/components/universe/ship.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Words and a card for every generated place, from the glossary"`

### Task 3: Ids, and the resolver

**Files:**
- Create: `src/components/universe/places/ids.js`, `src/components/universe/places/resolve.js`, `src/components/universe/places/resolve.test.js`
- Modify: `docs/superpowers/evidence/endless-universe-lane-3/README.md` (the timings)

**Interfaces:**
- Consumes: Task 1's whole face (`placeIn`, `placeOf`, `spaceTime`, `UNIVERSE`) in `resolve.js`, and its light face (`orbitAt`, `moonAt`) in `ids.js`; Task 2's `placeCard`; Task 0's `parseSpaceId` and `spaceId`.
- **Two modules.** `ids.js` imports only `lib/space/address.js` and `expanse/shared/orbits.js`, so `nav.js`, `park.js`, `carry.js` and the page can take it. `resolve.js` imports `ids.js`, the whole face and `cards.js`, and only the scene's places, the terminal and tests import it. Neither re-exports the other's names.
- Produces, in **`ids.js`**:
  - **`isPlaceId(id) → boolean`**, true when `parseSpaceId` reads it.
  - **`canonicalPlace(id) → string | null`**: the generator's form, `spaceId([sx, sy, sz], ...parts)`.
  - **`atTime(place, t) → [x, y, z]`**, over anything with `{ place, src, move? }` (a `Destination` or Task 8's `Row`):
    - a planet: `orbitAt(src.row, t)`
    - a moon: `moonAt(src.row, src.planet, t)`
    - a row carrying a `move` (its card's, Task 2): `move(src.row, t)`. The mover rides on the row itself, so `ids.js` reaches it without importing `cards.js`, which is on the generator's side.
    - otherwise `src.row.at`
- Produces, in **`resolve.js`**:
  - **`resolvePlace(id, { universe = UNIVERSE, t = spaceTime(Date.now()), sectors = null, build = true } = {}) → Destination | null`.**
    - It looks first among `sectors`, the sectors a scene has: a `Map` by `get(key)`, and, when that misses, by each sector's own `id` (the generator's sector key) among the `Map`'s values or any iterable's. Lane 2's `expanse.sectors()` (its PR 2.5) is a `Map` whose keys its chunk grid names (`cx,cy,cz`), so the lookup can't rest on the keys alone. Some 30 sectors at most, so the scan is cheap.
    - With `build`, a miss goes to `placeOf(universe, id)`, which makes the whole sector on this thread (45 to 130 ms in Node here) and keeps the last eight.
    - With `build: false`, a miss is null. The scene always passes `build: false`.
    - It is null for anything not there, never throws, and stores nothing.
    - It makes the card afresh on every call, which is cheap.
  - **`lookupOf(opts) → { place(id) → Destination | null }`:** `resolvePlace` with those options, in the shape `nav.js` takes (Task 7).
  - **`Destination`** is Task 2's `Card` and:
    ```
    { id (canonical), generated: true, place: 'system' | 'planet' | 'moon' | 'station' | 'thing' | 'extra' | 'wonder',
      at: [x, y, z] (at t), t, move: the card's move or null, moving (planet or moon, or move set), sector: 'main', key: sectorKey,
      cube: [sx, sy, sz], to: null, src: { row, system, planet } (the generator's rows, read-only) }
    ```
    - `sector` is always `'main'`: the keep-outs keep every generated place out of the Rick and Morty pocket, so `legOf` reads it as the main map's.
    - `at` is set after the card is spread in, and the card's mover is `move`, never `at`. So the position can't overwrite the mover, or the mover the position.

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { UNIVERSE, fullSector, moonAt, orbitAt, thingRow, universeOf } from '../../expanse/shared/gen';
import { atTime, canonicalPlace, isPlaceId } from './ids';
import { lookupOf, resolvePlace } from './resolve';

const s = fullSector(UNIVERSE, 1, 0, 0);
const sys = s.systems[0];
const p = sys.planets[0];
const withMoons = s.systems.flatMap((x) => x.planets).find((q) => q.moonList.length);

describe('the resolver', () => {
  it('reads every spelling of a generated id as one place, in the generator’s form', () => {
    expect(canonicalPlace('e:1,0:3:2')).toBe('E:1,0:3:2');
    expect(canonicalPlace('E:1,0,0:3:2')).toBe('E:1,0:3:2');
    expect(canonicalPlace('e:1,0,2:w64')).toBe('E:1,0,2:w64');
    for (const bad of ['marvel', 'beacon:E:1,0:n', 'E:1,0:x', '', null, 42, '__proto__']) {
      expect(canonicalPlace(bad), String(bad)).toBeNull();
      expect(isPlaceId(bad), String(bad)).toBe(false);
    }
  });
  it('makes a system, a planet on its orbit, a moon, a station and a thing into destinations', () => {
    expect(resolvePlace('e:1,0:0', { t: 0 })).toMatchObject({ id: sys.id, generated: true, place: 'system', kind: 'star', name: sys.name, at: sys.at, moving: false, sector: 'main', key: 'E:1,0', cube: [1, 0, 0], to: null });
    expect(resolvePlace(p.id, { t: 1000 })).toMatchObject({ place: 'planet', kind: 'world', at: orbitAt(p, 1000), t: 1000, moving: true, system: sys.id });
    const m = withMoons.moonList[0];
    expect(resolvePlace(m.id, { t: 50 }).at).toEqual(moonAt(m, withMoons, 50));
    expect(resolvePlace(s.stations[0].id, { t: 0 })).toMatchObject({ place: 'station', kind: 'station', dock: true, at: s.stations[0].at });
    const thing = thingRow(s, 0);
    expect(resolvePlace(thing.id, { t: 0 })).toMatchObject({ place: 'thing', name: thing.name, at: thing.at });
  });
  it('is nothing for what isn’t there, and never throws', () => {
    for (const id of [`E:1,0:${s.systems.length}`, `${sys.id}:${sys.planets.length}`, `${p.id}:${p.moonList.length}`, 'E:1,0:w60', 'E:1,0:w9999', 'nonsense', undefined]) {
      expect(resolvePlace(id, { t: 0 }), String(id)).toBeNull();
    }
  });
  it('looks in the sectors it is given before making one, and makes none when told not to', () => {
    const doctored = { ...s, systems: s.systems.map((x, i) => (i === 0 ? { ...x, name: 'Testing' } : x)) };
    expect(resolvePlace('E:1,0:0', { t: 0, sectors: new Map([['E:1,0', doctored]]) }).name).toBe('Testing');
    expect(resolvePlace('E:1,0:0', { t: 0, sectors: new Map(), build: false })).toBeNull();
    expect(resolvePlace('E:1,0:0', { t: 0, sectors: new Map([['E:1,0', doctored]]), build: false }).name).toBe('Testing');
    // (by the sector's own id, whatever the Map calls it: lane 2's chunk grid keys its cells 'cx,cy,cz')
    expect(resolvePlace('E:1,0:0', { t: 0, sectors: new Map([['1,0,0', doctored]]), build: false }).name).toBe('Testing');
    expect(resolvePlace('E:1,0:0', { t: 0, sectors: [doctored], build: false }).name).toBe('Testing');
    expect(lookupOf({ t: 0 }).place('e:1,0:0')).toMatchObject({ id: sys.id, name: sys.name });
    expect(lookupOf({ t: 0, sectors: new Map(), build: false }).place('E:1,0:0')).toBeNull();
  });
  it('resolves in the universe it’s given', () => {
    expect(resolvePlace('E:1,0:0', { t: 0, universe: universeOf('marble') }).name).not.toBe(sys.name);
  });
  it('says where a place is at any time, and reads the shared clock by default', () => {
    const d = resolvePlace(p.id, { t: 0 });
    expect(atTime(d, 9e8)).toEqual(orbitAt(p, 9e8));
    expect(atTime(resolvePlace(sys.id, { t: 0 }), 9e8)).toEqual(sys.at);
    expect(Math.abs(resolvePlace(sys.id).t - Date.now() / 1000)).toBeLessThan(5);
  });
  it('moves a thing by the mover it carries, and a thing with none stays put', () => {
    const thing = resolvePlace(thingRow(s, 0).id, { t: 0 });
    expect([thing.move, thing.moving]).toEqual([null, false]);
    const comet = { ...thing, move: (row, t) => [row.at[0] + t, row.at[1], row.at[2]] }; // (as a lane 4a card's would ride)
    expect(atTime(comet, 10)).toEqual([thing.src.row.at[0] + 10, thing.src.row.at[1], thing.src.row.at[2]]);
    expect(atTime(thing, 10)).toEqual(thing.src.row.at);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/resolve.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `ids.js` and `resolve.js`. The resolver's header says what it never does: store a row. It also says that `build` makes a whole sector on the calling thread, so the scene never passes it. The ids' header says why they're apart: a module is never split across chunks, so anything `nav.js` took from `resolve.js` would bring the generator onto every page that loads `nav.js`.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 7 tests.
- [ ] **Step 5: Time a miss, for the README.** In a scratch script (not committed), time `resolvePlace` for an id in a sector not yet made: first in a fresh Node process, then warm, five each. Write the medians into `docs/superpowers/evidence/endless-universe-lane-3/README.md`, under "A sector made on the main thread". At `cc5e2eaf` in this container, `placeOf` was 75 to 100 ms cold and about 45 ms warm (`{ things: false }`: about 38). Task 14 adds the terminal's number at 4× CPU throttling.
- [ ] **Step 6: Commit.** `git add src/components/universe/places docs/superpowers/evidence/endless-universe-lane-3 && git commit -m "An E: id resolves to a destination by running the generator, nothing stored; its spellings need no generator"`

### Task 4: Parking, a park that moves, and a trip's space

**Files:**
- Create: `src/components/universe/places/park.js`, `src/components/universe/places/park.test.js`

**Interfaces:**
- Consumes: Task 3's `atTime` (from `ids.js`; `resolvePlace` in the tests only); Task 1's `extentOf` (from the light face, `expanse/shared/orbits.js`); `ship.js`'s `SHIP`, `PARK_GAP`, `clearOf`, `headingTo`, `forward`, `OPEN_SPACE`, `SOLIDS`, `autopilot` and `step`.
- **Imports.** `park.js` imports only `../ship`, `./ids` and `../../expanse/shared/orbits`, because `nav.js` imports it (Task 7) and so every page that loads `nav.js` loads it too. Task 7's `weight.test.js` pins that.
- Produces:
  - **`gapRadius(system, least, margin) → number`:** the least `r ≥ least` with `|r − p.orbit| ≥ extentOf(p) + margin` for every planet.
  - **`moonGap(offset, moon) → number`:** the least distance from a point (`offset`, from the planet's middle) to the moon's whole circle, worked out exactly rather than sampled. The circle's normal is `n = [0, cos tilt, sin tilt]`, as `moonAt` lays it. With `q = offset`, `qn = q · n` and `ρ = |q − qn·n|`, the distance is `hypot(ρ − orbit, qn)`.
  - **`parkDistance(dest) → number`:** how far from the place's middle it parks.
    - The usual distance is `d = reach + (deep ? PARK_GAP.deep : PARK_GAP.near)`.
    - A system: `gapRadius(system, d, PARK_GAP.deep + 40)`.
    - A planet with moons, when none of the 32 level directions at `d` has `moonGap ≥ clearOf(moon.radius)` for every moon: `max(d, the greatest moon.orbit + clearOf(moon.radius))`. Every direction is clear out there, since the distance to a circle is at least the distance to its middle less its radius. This is 66 of 2,025 planets with moons in `E:1,0`, `E:2,0` and `E:1,0,1` (cube `[1, 1, 0]`, as Task 8's fixture makes it).
    - `parkPlace` parks at it, and Task 8's zones and Task 5's carry measure from it.
  - **`parkPlace(dest, from: [x, z], t) → Park | null`**, where `Park` is `{ x, y, z, heading, offset: [dx, dy, dz] }` and `offset` is the park less `atTime(dest, t)`.
    - **Distance.** `parkDistance(dest)`.
    - **Direction.** Of 32 level directions, the best score, ties to the lower index, as `ship.js`'s `parkAt` scores. The score is the sum of:
      - the facing toward `from`
      - +3 on a planet's or moon's day side (its star at `src.system.at`)
      - +6 when every moon's `moonGap` is at least `clearOf(moon.radius)`. That is the margin `clearPark` pushes a stop out by, so a moon going by never shoves the autopilot's stop mid-settle.
    - **Height and heading.** `y = at[1] + (deep ? 0 : SHIP.height)`. `heading` faces the place.
  - **`followPark(dest, park, t) → Park`:** the same offset and heading, from `atTime(dest, t)`.
  - **`placeSpace(space, dest) → space`:** `space` with `goals[dest.id] = { id, at: [...dest.at], r: dest.r, reach: dest.reach }`, every other goal as it was. It is `pilotGoal.js`'s `pilotSpace`'s way. The goal's `at` is that space's own array, which the trip moves in place.

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { OPEN_SPACE, PARK_GAP, SOLIDS, autopilot, clearOf, forward, spawn, step } from '../ship';
import { UNIVERSE, extentOf, fullSector, thingRow } from '../../expanse/shared/gen';
import { atTime } from './ids';
import { resolvePlace } from './resolve';
import { followPark, gapRadius, moonGap, parkDistance, parkPlace, placeSpace } from './park';

const s = fullSector(UNIVERSE, 1, 0, 0);
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const at = (k) => [k.x, k.y, k.z];
const faces = (park, c) => {
  const [fx, fz] = forward(park.heading);
  const dx = c[0] - park.x;
  const dz = c[2] - park.z;
  return (fx * dx + fz * dz) / Math.hypot(dx, dz);
};
// a moon's circle round its planet, as moonAt draws it
const circle = (m, a) => {
  const x = m.orbit * Math.cos(a);
  const z = m.orbit * Math.sin(a);
  return [x, -z * Math.sin(m.tilt), z * Math.cos(m.tilt)];
};

describe('parking at a generated place', () => {
  it('parks off a planet facing it, mostly on its day side, and never where a moon goes by', () => {
    const planets = s.systems.slice(0, 40).flatMap((x) => x.planets);
    let day = 0;
    for (const p of planets) {
      const d = resolvePlace(p.id, { t: 0 });
      const park = parkPlace(d, [d.at[0] + 5000, d.at[2]], 0);
      expect(len(at(park), d.at)).toBeGreaterThanOrEqual(d.reach + PARK_GAP.near - 1e-6);
      expect(Math.hypot(park.offset[0], park.offset[2])).toBeCloseTo(parkDistance(d), 6);
      expect(faces(park, d.at)).toBeGreaterThan(0.99);
      expect(park.offset).toEqual([park.x - d.at[0], park.y - d.at[1], park.z - d.at[2]]);
      for (const m of p.moonList) {
        expect(moonGap(park.offset, m)).toBeGreaterThanOrEqual(clearOf(m.radius) - 1e-9);
        for (let i = 0; i < 64; i++) expect(len(park.offset, circle(m, (i / 64) * 2 * Math.PI))).toBeGreaterThanOrEqual(moonGap(park.offset, m) - 1e-9);
      }
      const star = d.src.system.at;
      if ((park.x - d.at[0]) * (star[0] - d.at[0]) + (park.z - d.at[2]) * (star[2] - d.at[2]) >= 0) day++;
    }
    expect(day / planets.length).toBeGreaterThan(0.8);
  });
  it('parks a planet just past its furthest moon when no way in is clear, about one in thirty', () => {
    const mooned = s.systems.flatMap((x) => x.planets).filter((p) => p.moonList.length);
    const past = mooned.filter((p) => {
      const d = resolvePlace(p.id, { t: 0 });
      return parkDistance(d) > d.reach + PARK_GAP.near + 1e-9;
    });
    expect(past.length).toBeGreaterThan(0);
    expect(past.length / mooned.length).toBeLessThan(0.08);
    for (const p of past) {
      const d = resolvePlace(p.id, { t: 0 });
      expect(parkDistance(d)).toBeCloseTo(Math.max(d.reach + PARK_GAP.near, ...p.moonList.map((m) => m.orbit + clearOf(m.radius))), 9);
    }
  });
  it('parks off a system’s star in a gap between its planets’ orbits', () => {
    for (const sys of s.systems.slice(0, 60)) {
      const d = resolvePlace(sys.id, { t: 0 });
      const park = parkPlace(d, [0, 0], 0);
      const r = Math.hypot(park.x - sys.at[0], park.z - sys.at[2]);
      expect(r).toBeCloseTo(gapRadius(sys, d.reach + PARK_GAP.deep, PARK_GAP.deep + 40), 6);
      expect(r).toBeCloseTo(parkDistance(d), 6);
      expect(park.y).toBe(sys.at[1]);
      for (const p of sys.planets) expect(Math.abs(r - p.orbit)).toBeGreaterThanOrEqual(extentOf(p) + PARK_GAP.deep + 40 - 1e-6);
    }
  });
  it('keeps its offset as the place goes round', () => {
    const d = resolvePlace(s.systems[1].planets[0].id, { t: 0 });
    const park = parkPlace(d, [0, 0], 0);
    const later = followPark(d, park, 30000);
    expect(len(at(later), atTime(d, 30000))).toBeCloseTo(len(at(park), d.at), 9);
    expect([later.heading, later.offset]).toEqual([park.heading, park.offset]);
  });
  it('puts the place in a trip’s own space, leaving every other goal as it was', () => {
    const d = resolvePlace(s.stations[0].id, { t: 0 });
    const space = placeSpace(OPEN_SPACE, d);
    expect(space.goals[d.id]).toEqual({ id: d.id, at: d.at, r: d.r, reach: d.reach });
    expect(space.goals[d.id].at).not.toBe(d.at);
    expect(OPEN_SPACE.goals[d.id]).toBeUndefined();
    expect(Object.keys(space.goals).length).toBe(Object.keys(OPEN_SPACE.goals).length + 1);
  });
  it('flies there on the autopilot and stops, out in the open on the pulse drive', () => {
    const row = thingRow(s, 0);
    const d = resolvePlace(row.id, { t: 0 });
    let ship = { ...spawn(null), x: d.at[0] + 3000, y: d.at[1], z: d.at[2] };
    const park = parkPlace(d, [ship.x, ship.z], 0);
    const space = placeSpace(OPEN_SPACE, d);
    let done = false;
    for (let t = 0; t < 60 && !done; t += 1 / 30) {
      const a = autopilot(ship, d.id, park, space, 1);
      done = a.done;
      ship = step(ship, a.input, 1 / 30, SOLIDS, space).ship;
    }
    expect(done).toBe(true);
    expect(len(at(ship), at(park))).toBeLessThan(0.6);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/park.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `park.js`. The header says why a system parks in a gap: a giant on a small star's first orbit can sweep through any fixed ring near the star. It also says why a moon's gap is exact: 64 samples miss up to a tenth of an orbit between them.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 6 tests, under a second each.
- [ ] **Step 5: Commit.** `git commit -m "Parking at a generated place: off its day side, clear of its moons, in a gap at a star"`

### Task 5: The carry, so a parked ship stays a park

A generated planet moves up to about 0.9 units a second (orbit 180, 52 turns a cycle), and a moon a little more. The autopilot's stop needs the ship under 0.25 units a second, and a parked ship drifts off at the planet's speed. So the ship is carried by one body, its frame:
- the trip's goal, if that's a planet or moon
- else the planet or moon it's at

Only ever that one. I surveyed `E:1,0` with the carry given by whichever body had the most weight. A moon going by a ship parked at its planet picked the ship up: 183 of 746 parked ships were dragged over a unit off their park within five minutes, the worst by 252 units.

A change of frame cross-fades over 2 s, so handing over from a planet to its moon is no jolt. One step is left: flying in by hand from open space, the frame comes on whole as the planet's zone takes you, a change of under 1 unit/s while you're under way. A trip has no such step, because its goal is the frame from the start.

**Files:**
- Create: `src/components/universe/places/carry.js`, `src/components/universe/places/carry.test.js`

**Interfaces:**
- Consumes: Task 3's `atTime` (from `ids.js`); Task 4's `parkDistance` (and `parkPlace`, `followPark` and `placeSpace` in the tests); `ship.js`'s `PARK_GAP`.
- Produces:
  - **`CARRY = { inner: 2, outer: 4, fade: 2 }`:** `inner` and `outer` in reaches, `fade` in seconds.
  - **`carryZone(body) → { inner, outer }`:**
    - `inner = max(CARRY.inner × reach, park + PARK_GAP.out)`, with `park = body.park ?? parkDistance(body)`
    - `outer = inner + (CARRY.outer − CARRY.inner) × reach`

    So a planet that parks past its moons is carried as fully as one that parks at reach + 4.
  - **`carryWeight(dist, zone) → 0…1`:** `1 − smoothstep(zone.inner, zone.outer, dist)`.
  - **`frameOf(rows, { here, going }) → Row | null`:**
    - the row whose id is `going`, when it's a planet or moon
    - else the row whose id is `here`, when it's a planet or moon
    - else null
  - **`carryFrames(frames, body, dt) → frames`**, over `frames = [{ body, k }]`. It returns a new array:
    - `body`'s entry (matched by id) rises by `dt / CARRY.fade` up to 1. It joins at 0 when another frame is fading out, and at 1 into an empty list, where there's nothing to fade from. So a ship placed at a park (the start, a jump's flash, a reduced-motion arrival) is carried from its first frame.
    - every other entry falls by as much, and is dropped at 0
    - a null `body` lets them all fall
  - **`carry(ship, frames, t0, t1) → ship`:**
    - It moves the ship by `Σ k × carryWeight(|ship − atTime(b, t0)|, carryZone(b)) × (atTime(b, t1) − atTime(b, t0))`.
    - A moon's motion includes its planet's.
    - It returns the same object when that sum is zero or `t1 === t0`.

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { OPEN_SPACE, PARK_GAP, SHIP, SOLIDS, autopilot, spawn, step } from '../ship';
import { UNIVERSE, fullSector, moonAt, orbitAt } from '../../expanse/shared/gen';
import { atTime } from './ids';
import { resolvePlace } from './resolve';
import { followPark, parkDistance, parkPlace, placeSpace } from './park';
import { CARRY, carry, carryFrames, carryWeight, carryZone, frameOf } from './carry';

const s = fullSector(UNIVERSE, 1, 0, 0, { things: false });
const planets = s.systems.flatMap((x) => x.planets);
const speed = (p) => (2 * Math.PI * p.orbit * p.revs) / 65536;
const fastest = planets.reduce((a, b) => (speed(b) > speed(a) ? b : a));
const mooned = planets.filter((p) => p.moonList.length).reduce((a, b) => (b.moonList[0].revs > a.moonList[0].revs ? b : a));
const dest = (id) => resolvePlace(id, { t: 0 });
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const xyz = (k) => [k.x, k.y, k.z];
const minus = (a, b) => a.map((v, i) => v - b[i]);
const solidsAt = (p, t) => [...SOLIDS, { id: p.id, at: orbitAt(p, t), r: p.radius, reach: p.radius * 1.9 }, ...p.moonList.map((m) => ({ id: m.id, at: moonAt(m, p, t), r: m.radius, reach: m.radius * 1.9 }))];
// parked at a planet, the stick let go, carried by it for `secs`: how far off its park, and what it bumped
const drift = (p, secs, dt = 0.25) => {
  const d = dest(p.id);
  const park = parkPlace(d, [d.at[0] + 5000, d.at[2]], 0);
  let ship = { ...spawn(null), ...park };
  const bumps = [];
  for (let t = 0; t < secs - 1e-9; t += dt) {
    ship = carry(ship, [{ body: d, k: 1 }], t, t + dt);
    const r = step(ship, { throttle: 0 }, dt, solidsAt(p, t + dt), OPEN_SPACE);
    bumps.push(...r.events);
    ship = r.ship;
  }
  return { off: len(xyz(ship), xyz(followPark(d, park, secs))), bumps };
};

describe('the carry', () => {
  it('is all of a body’s motion out to its park and past, none far off, and smooth between', () => {
    expect(CARRY).toEqual({ inner: 2, outer: 4, fade: 2 });
    const z = { inner: 100, outer: 200 };
    expect([carryWeight(0, z), carryWeight(100, z), carryWeight(200, z), carryWeight(1e6, z)]).toEqual([1, 1, 0, 0]);
    for (let d = 100; d < 200; d += 1) expect(Math.abs(carryWeight(d + 1, z) - carryWeight(d, z))).toBeLessThan(0.03);
    for (const p of planets) {
      const d = dest(p.id);
      const zone = carryZone(d);
      expect(zone.inner).toBe(Math.max(2 * d.reach, parkDistance(d) + PARK_GAP.out));
      expect(zone.outer - zone.inner).toBeCloseTo(2 * d.reach, 9);
      expect(carryWeight(parkDistance(d), zone), p.id).toBe(1); // (every park carried in full, a park past the moons too)
    }
  });
  it('moves a ship by its frame’s motion, and by nothing else', () => {
    const d = dest(fastest.id);
    const ship = { ...spawn(null), x: d.at[0] + d.reach + 4, y: d.at[1], z: d.at[2] };
    const dp = minus(atTime(d, 1), atTime(d, 0));
    expect(minus(minus(xyz(carry(ship, [{ body: d, k: 1 }], 0, 1)), xyz(ship)), dp).every((v) => Math.abs(v) < 1e-9)).toBe(true);
    expect(carry(ship, [{ body: d, k: 1 }], 0, 0)).toBe(ship);
    expect(carry(ship, [], 0, 1)).toBe(ship);
    const far = { ...ship, x: d.at[0] + carryZone(d).outer + 1 };
    expect(carry(far, [{ body: d, k: 1 }], 0, 1)).toBe(far);
    expect(carry(ship, [{ body: d, k: 0.5 }], 0, 1).x - ship.x).toBeCloseTo(dp[0] / 2, 9);
  });
  it('takes the trip’s goal for its frame, else where it’s at, and only a planet or a moon', () => {
    const m = mooned.moonList[0];
    const rows = [dest(mooned.id), dest(m.id), dest(s.systems[0].id)];
    expect(frameOf(rows, { here: mooned.id, going: null })?.id).toBe(mooned.id);
    expect(frameOf(rows, { here: mooned.id, going: m.id })?.id).toBe(m.id);
    expect(frameOf(rows, { here: mooned.id, going: 'marvel' })?.id).toBe(mooned.id);
    expect(frameOf(rows, { here: s.systems[0].id, going: null })).toBeNull();
    expect(frameOf(rows, { here: null, going: null })).toBeNull();
  });
  it('fades one frame out as the next comes in', () => {
    const a = dest(mooned.id);
    const b = dest(mooned.moonList[0].id);
    let f = carryFrames([], a, 0);
    expect(f).toEqual([{ body: a, k: 1 }]);
    f = carryFrames(f, b, 0.5);
    expect(f.map((x) => [x.body.id, x.k])).toEqual([[a.id, 0.75], [b.id, 0.25]]);
    f = carryFrames(f, b, 2);
    expect(f).toEqual([{ body: b, k: 1 }]);
    expect(carryFrames(f, null, 2)).toEqual([]);
  });
  it('hands over from a planet to its moon with no jolt', () => {
    // (flown in by hand at cruise from the planet's park to the moon's, here changing as the moon's zone takes it)
    const p = dest(mooned.id);
    const m = dest(mooned.moonList[0].id);
    const pPark = parkPlace(p, [p.at[0] + 5000, p.at[2]], 0);
    const mPark = parkPlace(m, [pPark.x, pPark.z], 0);
    const dt = 1 / 30;
    let ship = { ...spawn(null), ...pPark };
    let frames = [{ body: p, k: 1 }];
    let atMoon = false;
    let last = null;
    for (let t = 0; t < 400; t += dt) {
      const goal = xyz(followPark(m, mPark, t));
      if (len(xyz(ship), goal) < 1) break;
      atMoon ||= len(xyz(ship), atTime(m, t)) < parkDistance(m) + PARK_GAP.in;
      frames = carryFrames(frames, atMoon ? m : p, dt);
      const carried = carry(ship, frames, t, t + dt);
      const v = minus(xyz(carried), xyz(ship)).map((x) => x / dt);
      if (last) expect(len(v, last), `t ${t.toFixed(2)}`).toBeLessThan(0.05);
      last = v;
      const way = minus(goal, xyz(carried));
      const k = (SHIP.cruise * dt) / Math.hypot(...way);
      ship = { ...carried, x: carried.x + way[0] * k, y: carried.y + way[1] * k, z: carried.z + way[2] * k };
    }
    expect(atMoon).toBe(true);
  });
  it('keeps a ship parked where it parked, stick let go, at the fastest planet and every one that parks past its moons', () => {
    const past = planets.filter((p) => parkDistance(dest(p.id)) > dest(p.id).reach + PARK_GAP.near + 1e-9);
    expect(past.length).toBeGreaterThan(0);
    for (const p of [fastest, ...past]) {
      const { off, bumps } = drift(p, p === fastest ? 300 : 60);
      expect(off, p.id).toBeLessThan(1);
      expect(bumps, p.id).toEqual([]);
    }
  });
  it('brings the autopilot to rest at a fast moon, carried by its goal from the start', () => {
    const m = dest(mooned.moonList[0].id);
    let ship = { ...spawn(null), x: m.at[0] + 900, y: m.at[1], z: m.at[2] };
    const park = parkPlace(m, [ship.x, ship.z], 0);
    const space = placeSpace(OPEN_SPACE, m);
    const dt = 1 / 30;
    let frames = [];
    let done = false;
    for (let t = 0; t < 150 && !done; t += dt) {
      space.goals[m.id].at.splice(0, 3, ...atTime(m, t)); // (as trips.js's followPlace moves it)
      frames = carryFrames(frames, m, dt);
      const a = autopilot(ship, m.id, followPark(m, park, t), space, 1, null, solidsAt(mooned, t).slice(SOLIDS.length));
      done = a.done;
      ship = step(carry(ship, frames, t, t + dt), a.input, dt, solidsAt(mooned, t + dt), space).ship;
    }
    expect(done).toBe(true);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/carry.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `carry.js`. The header gives two whys: the speeds above, and the dragged parks that a carry by the nearest body made.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 7 tests, each under a second. If the handover test's 0.05 u/s a frame fails, the fault is in the fade or the ramp. Don't loosen the bound.
- [ ] **Step 5: Commit.** `git commit -m "A ship goes round with the one planet or moon it's at or going to, so a park stays a park"`

### Task 6: The long-trip formula

**Files:**
- Create: `src/components/universe/places/trip.js`, `src/components/universe/places/trip.test.js`

**Interfaces:**
- Consumes: `ship.js`'s `SHIP`, `noseOf` and `OVERDRIVE`. It imports nothing from `nav.js`, which imports it in Task 7, so there's no cycle. The jump's time stays `nav.js`'s `HYPER.length`, applied there.
- Produces:
  - **`TRIP = { extra: { cruise: 7.1, super: 5.6 }, turn: { cruise: 1.7, super: 0.5 } }`**, in seconds, fitted to the autopilot in open space.
  - **`longTrip(ship, park, drive) → seconds`**, for `drive` of `'cruise'` or `'super'` (any other reads as cruise):
    - `D / v + extra[drive] + turn[drive] · angle / π`, where:
      - `D` is the 3D distance from the ship to the park
      - `v = SHIP.pulse · (drive === 'super' ? OVERDRIVE : 1)`
      - `angle` is between `noseOf(ship)` and the way to the park, 0 when `D` is 0
    - finite for any finite input, and never NaN

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { OPEN_SPACE, SOLIDS, autopilot, headingTo, spawn, step } from '../ship';
import { TRIP, longTrip } from './trip';

// flown on the real physics, far out in the open (no place near to close the drive)
const X = 600000;
const sim = (D, drive, heading) => {
  const goal = { id: 'g', at: [X + D + 20, 0, 0], r: 10, reach: 12 };
  const space = { ...OPEN_SPACE, goals: { ...OPEN_SPACE.goals, g: goal } };
  const park = { x: X + D, y: 0, z: 0, heading: headingTo(1, 0) };
  let s = { ...spawn(null), x: X, y: 0, z: 0, heading };
  for (let t = 0; t < 400; t += 1 / 30) {
    const a = autopilot(s, 'g', park, space, drive === 'super' ? 3 : 1);
    if (a.done) return { t, s0: { ...spawn(null), x: X, y: 0, z: 0, heading }, park };
    s = step(s, a.input, 1 / 30, SOLIDS, space).ship;
  }
  return null;
};

describe('a long trip’s time', () => {
  it('is within a tenth, or a second and a half, of flying it, at three headings on both drives', () => {
    expect(TRIP).toEqual({ extra: { cruise: 7.1, super: 5.6 }, turn: { cruise: 1.7, super: 0.5 } });
    for (const drive of ['cruise', 'super']) {
      for (const D of [2000, 10000, 40000]) {
        for (const heading of [headingTo(1, 0), 0, headingTo(-1, 0)]) {
          const flown = sim(D, drive, heading);
          const t = longTrip(flown.s0, flown.park, drive);
          expect(Math.abs(t - flown.t), `${drive} ${D} ${heading}`).toBeLessThanOrEqual(Math.max(1.5, 0.1 * flown.t));
        }
      }
    }
  });
  it('is finite for any trip, and nothing but the overhead for none', () => {
    const s = { ...spawn(null), x: 0, y: 0, z: 0, heading: 0 };
    expect(longTrip(s, { x: 0, y: 0, z: 0 }, 'super')).toBeCloseTo(TRIP.extra.super, 9);
    expect(longTrip(s, { x: 0, y: 0, z: 0 }, 'cruise')).toBeCloseTo(TRIP.extra.cruise, 9);
    const far = longTrip(s, { x: 0, y: 9e8, z: 0 }, 'super');
    expect(Number.isFinite(far)).toBe(true);
    expect(far).toBeCloseTo(9e8 / 900 + TRIP.extra.super + TRIP.turn.super / 2, 6);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/trip.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `trip.js`. If the first test fails, move `TRIP`'s numbers (never the tolerance) and say which ones in the commit. A survey at `cc5e2eaf` flew cruise in `D/300 + 7.07` s and super in `D/900 + 5.6 ± 0.5` s.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 2 tests, under 5 s.
- [ ] **Step 5: Commit.** `git commit -m "Long trips timed by a formula fitted to the autopilot, not a 150 s flight"`

### Task 7: `nav.js` takes `E:` ids everywhere

**Files:**
- Modify: `src/components/universe/nav.js`:
  - `:158-161` (`destinationById`, `goalOf`)
  - `:170-181` (`legOf`)
  - `:198-208` (`findDestinations`, `findDestination`)
  - `:234-241` (`parkFor`)
  - `:284-295` (`distanceTo`)
  - `:304-343` (`tripTime`)
  - and add `canGo`
- Modify: `src/components/universe/nav.test.js` (a new `describe` at the end; nothing above it changes)
- Create: `src/components/universe/places/weight.test.js`
- Modify: `docs/superpowers/evidence/endless-universe-lane-3/README.md` (the bundle numbers)

**Interfaces:**
- Consumes: Task 3's `canonicalPlace` and `isPlaceId` (from `ids.js`) and `lookupOf` (from `resolve.js`, in the tests only); Task 4's `parkPlace`; Task 6's `longTrip`; `scripts/health/graph.mjs`'s `FROM`, `SIDE_EFFECT`, `resolve` and `uncomment` (in `weight.test.js`, as `avengers/world/scene.test.js:4` takes them).
- **Imports.** `nav.js` imports `canonicalPlace` and `isPlaceId` from `places/ids.js`, `parkPlace` from `places/park.js` and `longTrip` from `places/trip.js`, and nothing from `places/resolve.js`. Those three reach only `ship.js`, `lib/space/address.js` and the light face. It never imports `resolvePlace`, `placeOf` or `fullSector`, which are the resolver and the generator. A generated place reaches it only through the caller's lookup, `opts.place(id) → Destination | null`, as `lookupOf` or the scene's `places.look` make it:
  - the scene, the page and lane 6b's map pass the scene's, which never builds a sector
  - the terminal passes one that does, on its own page
  - a call with no lookup finds no generated place
  - the pocket universe's lookup resolves in the pocket
- Produces (every signature keeps its old arguments and adds an `opts = {}` holding at most `{ place }`):
  - **`destinationById(id, { place })`:** a hand-made row as before, else `place(canonicalPlace(id))`, else null.
  - **`goalOf(id)`:** the system's gate, else `canonicalPlace(id)`, else `id`.
  - **`canGo(id, { place }) → boolean`:** `isGoal(goalOf(id))`, or a generated id the lookup finds. A place whose sector the scene hasn't got reads false. The scene's own `travel` fetches it regardless (Task 11).
  - **`legOf(ship, id, pose)`:** a generated goal is in `'main'`, so from the Curve it goes by `'rmportal-back'`, from anywhere else straight.
  - **`parkFor(id, from, { place })`:** a generated id gives `parkPlace(dest, from, dest.t)`.
  - **`distanceTo(ship, id, { place })`:** generated, `max(0, |ship − at| − reach)`, plus the portal leg as for any place.
  - **`tripTime(ship, id, drive, { limit, dt, place })`:**
    - generated, by the jump: `HYPER.length`
    - generated, by any other drive: `longTrip(ship, parkFor(id, [ship.x, ship.z], { place }), drive)`, after a portal leg when there is one
    - hand-made: the simulation as today, and `longTrip` when it doesn't arrive within `limit` (a far trip had `null` before, a dash on the nav map)
    - still `null` for no ship or nowhere
  - **`findDestinations(kind, query, { more = [], place })`:**
    - `more` are destination rows (the places in view, the visited: lane 6b passes them), searched with `DESTINATIONS`, de-duplicated by id
    - a generated row also matches by its id
    - a query that is a generated id in any spelling, not among them, is looked up
    - `kind` matches a row's `kind`, so `'star'` finds generated systems
    - `'system'` (`KINDS`' "Star systems", `nav.js:188`) takes generated systems (`kind: 'star'`) as well as the galaxy's gate systems. With no `more`, `DESTINATIONS` has no `'star'` row, so every call today gives what it gave. Generated systems keep `'star'` because `NavMap.jsx:243` and lane 6a's `marks.js` read `kind === 'system'` as a gate system and leave it off the chart.
  - **`findDestination(query, { place })`:** a generated id in any spelling is looked up before the name search.
- Produces, in **`places/weight.test.js`**:
  - `reach(entry) → string[]`, a local helper: every file `entry` reaches by static imports (`import … from`, `export … from` and bare `import '…'`, read with `graph.mjs`'s `FROM` and `SIDE_EFFECT` over `uncomment(text)`, each resolved with its `resolve`), `.js` and `.jsx` only. `import()` is left out: what it loads is another chunk, loaded later.
  - `GENERATOR`, the files that are the generator or the resolver: `expanse/gen/{space,sector,systems,things,stations,tables,names,keepOuts,grid,job}.js` and `universe/places/{resolve,cards}.js`.

- [ ] **Step 1: Write the failing tests** (appended to `nav.test.js`, with imports added at the top):

```js
describe('generated places', () => {
  const U = lookupOf({ t: 0 });
  const s = fullSector(UNIVERSE, 1, 0, 0);
  const sys = s.systems[0];
  const home = () => ({ ...spawn('home') });
  const curve = () => ({ ...spawn(null), x: RM[0], y: 0, z: RM[2] + 500 });

  it('are destinations by any spelling, through the caller’s lookup, never listed', () => {
    expect(destinationById('e:1,0:0', U)).toMatchObject({ id: sys.id, generated: true, name: sys.name });
    expect(goalOf('e:1,0,0:0')).toBe(sys.id);
    expect([canGo(sys.id, U), canGo(`E:1,0:${s.systems.length}`, U), canGo('marvel'), canGo('nope')]).toEqual([true, false, true, false]);
    expect(DESTINATIONS.some((d) => d.generated)).toBe(false);
  });
  it('are nowhere without a lookup, or with one that hasn’t the sector', () => {
    expect([destinationById(sys.id), canGo(sys.id), tripTime(home(), sys.id, 'super'), parkFor(sys.id, [0, 0])]).toEqual([null, false, null, null]);
    const none = lookupOf({ t: 0, sectors: new Map(), build: false });
    expect([destinationById(sys.id, none), canGo(sys.id, none), findDestination(sys.id, none)]).toEqual([null, false, null]);
  });
  it('are parked at, measured, and reached from the Curve by its portal', () => {
    const d = resolvePlace(sys.id, { t: 0 });
    expect(parkFor('e:1,0:0', [0, 0], U)).toEqual(parkPlace(d, [0, 0], 0));
    expect(distanceTo({ x: d.at[0] + d.reach + 5000, y: d.at[1], z: d.at[2] }, sys.id, U)).toBeCloseTo(5000, 6);
    expect(legOf(home(), sys.id)).toBe(sys.id);
    expect(legOf(curve(), sys.id)).toBe('rmportal-back');
    expect(Number.isFinite(distanceTo(curve(), sys.id, U))).toBe(true);
  });
  it('are timed by the formula, the jump as ever, and never a dash', () => {
    const far = 'E:5,-3:0';
    expect(tripTime(home(), far, 'hyper', U)).toBe(HYPER.length);
    expect(tripTime(home(), far, 'super', U)).toBeCloseTo(longTrip(home(), parkFor(far, [home().x, home().z], U), 'super'), 9);
    expect(tripTime(home(), `E:1,0:${s.systems.length}`, 'super', U)).toBeNull();
    expect(tripTime(curve(), sys.id, 'super', U)).toBeGreaterThan(TRANSIT);
  });
  it('gives a hand-made place out of the simulation’s reach a time, not null', () => {
    const out = { ...spawn(null), x: 600000, y: 0, z: 0, heading: 0 };
    expect(tripTime(out, 'marvel', 'super')).toBeGreaterThan(600000 / 900 - 60);
  });
  it('are searched with the places in view, by name, type or id', () => {
    const more = [resolvePlace(sys.id, { t: 0 }), resolvePlace(sys.planets[0].id, { t: 0 })];
    expect(findDestinations('all', sys.name, { more }).map((x) => x.id)).toContain(sys.id);
    expect(findDestinations('star', '', { more }).map((x) => x.id)).toEqual([sys.id]);
    const gates = DESTINATIONS.filter((d) => d.kind === 'system').map((d) => d.id);
    expect(findDestinations('system', '', { more }).map((x) => x.id).sort()).toEqual([...gates, sys.id].sort());
    expect(findDestinations('system', '').map((x) => x.id)).toEqual(gates);
    expect(findDestinations('all', 'e:1,0:0', { more }).map((x) => x.id)).toContain(sys.id);
    expect(findDestinations('all', 'e:1,0:1', { more, ...U }).map((x) => x.id)).toEqual(['E:1,0:1']);
    expect(findDestinations('all', 'resume', { more }).map((x) => x.id)).toEqual(['resume']);
    expect(findDestinations('all', '', { more: [...more, more[0]] }).filter((x) => x.id === sys.id)).toHaveLength(1);
    expect(findDestination('e:1,0:0', U)?.id).toBe(sys.id);
    expect(findDestination(`E:1,0:${s.systems.length}`, U)).toBeNull();
  });
});
```

  `places/weight.test.js` (it reads files and imports none of them, so it adds no edge to the health graph):

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FROM, SIDE_EFFECT, resolve, uncomment } from '../../../../scripts/health/graph.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
// every file a source reaches by static imports, so loads with it whichever chunk it lands in (import() is another chunk, later)
async function reach(entry) {
  const seen = new Set([ROOT + entry]);
  for (const f of seen) {
    const text = uncomment(readFileSync(f, 'utf8'));
    for (const m of [...text.matchAll(FROM), ...text.matchAll(SIDE_EFFECT)]) for (const to of await resolve(m[2], f)) if (/\.jsx?$/.test(to)) seen.add(to);
  }
  return [...seen].map((f) => f.slice(ROOT.length));
}
const GENERATOR = /^src\/components\/expanse\/gen\/(space|sector|systems|things|stations|tables|names|keepOuts|grid|job)\.js$|^src\/components\/universe\/places\/(resolve|cards)\.js$/;

// (nav.js itself; ⌘K, preloaded on every page; the home page's lower half, which reaches nav.js
// through the mini-map once lane 6a's is merged: Task 14 adds it to LOADS_NAV then)
const LOADS_NAV = ['src/components/universe/nav.js', 'src/components/CommandPalette.jsx'];
describe('the generator stays off every page that loads nav.js', () => {
  it.each([...LOADS_NAV, 'src/components/interests/Interests.jsx'])('%s reaches none of it', async (entry) => {
    expect((await reach(entry)).filter((f) => GENERATOR.test(f))).toEqual([]);
  });
  it.each(LOADS_NAV)('%s loads nav.js, so the check above means something', async (entry) => {
    expect(await reach(entry)).toContain('src/components/universe/nav.js');
  });
});
```

  On `eu/lane-3` at `9d927892`, `nav.js` reaches 15 files, `CommandPalette.jsx` 50 and `Interests.jsx` 42, none of them the generator, so the test passes before and after. `Interests.jsx` doesn't reach `nav.js` there: its mini-map reaches it only through lane 6a's `chart/marks.js` (51 files on `eu/lane-6a` at `3cf60b7c`, `nav.js` among them). So `Interests.jsx` is held to the generator check alone here, and Task 14, after the merge, adds it to `LOADS_NAV`.

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/nav.test.js src/components/universe/places/weight.test.js`. Expected: the new `describe` in `nav.test.js` FAILS (`canGo` is not exported). Every test above it passes, and `weight.test.js` PASSES (it pins what must stay true).
- [ ] **Step 3: Record the bundle before.** Run `npm run build`, then Task 1's `node <scratchpad>/chunks.mjs dist/assets Waystation Front CommandPalette Interests Terminal`, and write the four lines into the README as "before Task 7".
- [ ] **Step 4: Implement** the Interfaces. The file header gains one paragraph on generated places: looked up through the caller's `place`, never listed, parked by `places/park.js`, timed by `places/trip.js`. It says why there is a lookup and why its ids come from `places/ids.js`: the generator stays off ⌘K, the home page and the main thread.
- [ ] **Step 5: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS, with every existing test in `nav.test.js` unchanged, and `weight.test.js` still PASSING.
- [ ] **Step 6: Record the bundle after, and the islands.**
  - Run `npm run build` and the same `chunks.mjs` line, and add "after Task 7" to the README.
  - Expected: `Front`, `CommandPalette` and `Interests` each grow by at most 2 kB gzipped over "before Task 7": the ids, the park, the formula and the light face. `Waystation` is in neither `CommandPalette`'s nor `Interests`' closure. (Without lane 6a, `Interests` doesn't load `nav.js` and shouldn't move; Task 14 measures it with the mini-map merged.)
    - `Waystation` in one of them means something on `nav.js`'s imports reaches the generator, which `weight.test.js` should have caught. Find the import and cut it.
    - Over 2 kB with no `Waystation` means `park.js` is the weight. Then `nav.js` stops importing it, and takes the park from the lookup instead: `{ place(id), park(id, from) }`, which `lookupOf` and `places.look` (Task 12) supply from `parkPlace`. `parkFor` and `tripTime` call `opts.park`. Re-run, and say so in the commit.
    - Don't raise the ceiling.
  - Run `node scripts/health.mjs --check --skip build`. Expected: `boundary-breaks` and `cycles` as on the branch before Task 1 (481 and 5 on `eu/lane-3` at `9d927892`).
- [ ] **Step 7: Commit.** `git add src/components/universe/nav.js src/components/universe/nav.test.js src/components/universe/places/weight.test.js docs/superpowers/evidence/endless-universe-lane-3 && git commit -m "The nav map's places take E: ids: parked, measured, timed and found, and the generator stays off the pages that load it"`. The body gives the three chunks before and after.

### Task 8: What's round the ship, and which place it's at

**Files:**
- Create: `src/components/universe/places/around.js`, `src/components/universe/places/around.test.js`

**Interfaces:**
- Consumes: Task 1's face; Tasks 2 and 3 (`atTime` for every row's `at`); Task 4's `parkDistance`; `ship.js`'s `PARK_GAP`; Task 0's `SECTOR` and `sectorCentre`.
- **What's listed follows what's drawn** (Global Constraints, "Around the ship"). Lane 2's `discs.js` draws every star, planet and moon of a system within the far plane, and every legacy wonder but a nebula, as a disc, and its Task 21 adds the lattice things and extras. It gives way to `near.js` within a system's build reach, and keeps the nearest of the rest, up to the far layer's room. Any of those could be on screen, so each needs a row to be picked, named and listed. `THING_NEAR` is lane 2's rule for meshes and solids, and isn't used here.
- Produces:
  - **`AROUND = { far: 45000, inside: 1000, max: 600, underWay: 1 }`.** `max` is only the default, low's far-layer room (`farRoom`: 1.5 × its 400 discs). The scene passes its own device's room (Task 12), which no set the disc layer draws can outnumber. `inside` is past every build reach `near.js` makes (at most 601 past a system's reach round `E:1,0`).
  - **`Row`** is `{ id, place, kind, name, at, r, reach, deep, color, move, dist, park, src }`, where `at = atTime(row, t)`, `dist = max(0, |cam − at| − reach)` and `park = parkDistance(row)`. `move` is its card's (Task 2), else null.
    - A planet of a system whose `span + inside` doesn't hold the camera has `park: null`. One that far off can't be where you're at, and finding a park past its moons costs 32 directions × its moons.
    - A Row is a light destination: `resolvePlace(row.id)` gives the card.
  - **`placesAround(sectors, cam, t, { far, inside, max } = AROUND) → Row[]`**, nearest `dist` first. `sectors` is a `Map` or any iterable of sectors, and `cam` is the map-frame camera (Global Constraints, "One frame"). It lists:
    1. **Near: the systems you're in.** Every body of each system whose `span + inside` holds `cam`: its star, its planets (at `orbitAt(p, t)`), their moons (at `moonAt`) and its station, outside the cap, with their parks. These are what `near.js` builds and the disc layer gives way to, so they take none of its budget, and none of this cap: a few dozen at most.
    2. **The rest: the disc kinds.** Every other system, planet (of a system within `far + span`, each at `orbitAt(p, t)`), moon (at `moonAt`), lattice thing, extra and legacy wonder whose `dist` is within `far` (or its card's own `far`). Of those it keeps the nearest `max` by distance from the middle, the disc layer's own rule. What that layer draws is the nearest of the same set at most its room, so each disc it draws has a row.
       - **Lattice things** are found by sweeping each sector's `things` typed arrays (`at` from the sector's `origin`, `size`), for the sectors whose box comes within `far` of `cam`: at most 8, about 1,750 things within the far plane round any point. It's a squared-distance test a thing, into a reused scratch of index and distance, with no object for a thing it rejects. `thingRow(sector, i)` is called only for the kept ones.
       - Planets and moons go into the same scratch, so a moon makes no object either unless it's kept: 278 planets and 415 moons lie within the far plane of `E:1,0`'s middle.
  - **`hereZone(row) → { in, out }`:** `row.park + PARK_GAP.in` and `row.park + PARK_GAP.out`, measured from the row's middle.
    - A planet that parks past its moons is arrived at its own park.
    - A system's zone is its park in the gap past its planets' bands, so a trip to a system arrives too.
  - **`orbitingPlace(ship, current, rows, prefer = null) → id | null`**, over the rows with a `park`. `ship` carries its `speed`.
    1. **The trip's own end.** When `prefer`'s row holds the ship within its `in`, it is `prefer`. The scene passes the id of a trip that has just ended, so a jump that comes out beside a passing moon is still at the planet it went to.
    2. **Staying.** `current` stays while the ship is within its `out`, unless the ship is under way (`|speed| ≥ AROUND.underWay`) and a row with a smaller `in` holds it within that `in`. Then it is that row.
       - So flying in, a station over a big star's pole takes you from the star.
       - A moon going by a ship parked at its planet doesn't. A planet's park keeps only `clearOf` from its moons' circles, which is inside their zones.
    3. **Otherwise** it is the row with the smallest `in` that holds the ship within it, or null.

    It mirrors `ship.js`'s `orbiting`, with a zone per place.
  - **`aimStars(sectors, cam, { max = 2000 }) → [{ id, at, reach }]`:** every system of the sectors, nearest first, with `reach = 2 × star.size`, its card's, for `aim.js`'s `aimFrom`. With the system's `span` as the reach, `realAt` (20 reaches, at least 1,500) is 10,000 to 62,000 out, and most stars in view couldn't be aimed at.

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { PARK_GAP } from '../ship';
import { UNIVERSE, fullSector, moonAt, orbitAt, thingRow } from '../../expanse/shared/gen';
import { resolvePlace } from './resolve';
import { parkDistance, parkPlace } from './park';
import { AROUND, aimStars, hereZone, orbitingPlace, placesAround } from './around';

const sectors = new Map([[1, 0, 0], [2, 0, 0], [1, 1, 0]].map(([x, y, z]) => fullSector(UNIVERSE, x, y, z)).map((s) => [s.id, s]));
const s = sectors.get('E:1,0');
const one = new Map([['E:1,0', s]]);
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const xyz = (k) => [k.x, k.y, k.z];
const still = (k) => ({ x: k.x, y: k.y, z: k.z, speed: 0 });
const all = { ...AROUND, max: Infinity };

describe('what’s round the ship', () => {
  it('lists every star within the far plane, nearest first, and stops at its cap', () => {
    const cam = [s.systems[5].at[0] + s.systems[5].reach + 500, s.systems[5].at[1], s.systems[5].at[2]]; // (in system 5's span + inside)
    const rows = placesAround(sectors, cam, 0, all);
    const want = [...sectors.values()].flatMap((x) => x.systems).filter((x) => len(x.at, cam) - x.star.size * 2 <= AROUND.far).map((x) => x.id);
    expect(rows.filter((r) => r.place === 'system').map((r) => r.id).sort()).toEqual(want.sort());
    for (let i = 1; i < rows.length; i++) expect(rows[i].dist).toBeGreaterThanOrEqual(rows[i - 1].dist);
    // (the cap keeps the nearest by distance from the middle, as the disc layer does; every body of a
    // system the camera is in, which near.js builds and the disc layer gives way to, rides outside it)
    const home = (r) => (r.place === 'system' ? r.src.row : r.src.system);
    const inside = (r) => Boolean(home(r)) && len(home(r).at, cam) <= home(r).reach + AROUND.inside;
    const mid = (r) => len(r.at, cam);
    expect(rows.some(inside)).toBe(true);
    const capped = placesAround(sectors, cam, 0, { ...AROUND, max: 10 });
    expect(capped.filter(inside).map((r) => r.id).sort()).toEqual(rows.filter(inside).map((r) => r.id).sort());
    const rest = rows.filter((r) => !inside(r)).sort((a, b) => mid(a) - mid(b));
    expect(capped.filter((r) => !inside(r)).map((r) => r.id).sort()).toEqual(rest.slice(0, 10).map((r) => r.id).sort());
  });
  it('puts planets and moons where their orbits have them, as discs from far off, and the station and the parks only once near the system', () => {
    const sys = s.systems.find((x) => s.stations.some((st) => st.i === x.i) && x.planets.some((p) => p.moonList.length));
    const p = sys.planets.find((q) => q.moonList.length);
    const inside = placesAround(sectors, [sys.at[0] + sys.reach * 0.5, sys.at[1], sys.at[2]], 777, all);
    expect(inside.find((r) => r.id === p.id)).toMatchObject({ at: orbitAt(p, 777), park: parkDistance(resolvePlace(p.id, { t: 777 })) });
    expect(inside.find((r) => r.id === p.moonList[0].id).at).toEqual(moonAt(p.moonList[0], p, 777));
    expect(inside.some((r) => r.place === 'station' && r.src.row.i === sys.i)).toBe(true);
    const outside = placesAround(sectors, [sys.at[0] + sys.reach + AROUND.inside + 5000, sys.at[1], sys.at[2]], 777, all);
    expect(outside.find((r) => r.id === p.id).park).toBeNull();
    expect(outside.find((r) => r.id === sys.id).park).toBe(parkDistance(resolvePlace(sys.id, { t: 777 })));
    // (discs.js draws a moon as a disc wherever its system's are, so out here it has a row, with no park)
    expect(outside.find((r) => r.id === p.moonList[0].id)).toMatchObject({ place: 'moon', at: moonAt(p.moonList[0], p, 777), park: null });
    expect(outside.some((r) => r.place === 'station' && r.src.row.i === sys.i)).toBe(false);
    // (a planet and its moon 30,000 off are discs on screen, so they have rows too)
    const far = placesAround(sectors, [sys.at[0] + 30000, sys.at[1], sys.at[2]], 777, all);
    expect(far.find((r) => r.id === p.id)).toMatchObject({ at: orbitAt(p, 777), park: null });
    expect(far.some((r) => r.id === p.moonList[0].id)).toBe(true);
  });
  it('lists every lattice thing out to the far plane, as lane 2 draws them, and none past it', () => {
    const row = thingRow(s, 40);
    for (const off of [5000, 30000]) {
      const got = placesAround(sectors, [row.at[0] + off, row.at[1], row.at[2]], 0, all).find((r) => r.id === row.id);
      expect(got, String(off)).toMatchObject({ place: 'thing', name: row.name, at: row.at, move: null });
    }
    // (today's lattice kinds are all solid, so a thing's reach is 1.2 × its size)
    expect(placesAround(sectors, [row.at[0] + AROUND.far + 1.2 * row.size + 1, row.at[1], row.at[2]], 0, all).some((r) => r.id === row.id)).toBe(false);
    // (every one within the far plane of a point, counted straight from the sectors' own arrays)
    const cam = [s.origin[0] + 7000, s.origin[1] + 3000, s.origin[2] - 2000];
    const want = [];
    for (const x of sectors.values()) {
      for (let i = 0; i < x.things.count; i++) {
        const at = [0, 1, 2].map((k) => x.origin[k] + x.things.at[3 * i + k]);
        if (len(at, cam) - 1.2 * x.things.size[i] <= AROUND.far) want.push(thingRow(x, i).id);
      }
    }
    expect(want.length).toBeGreaterThan(1000);
    expect(placesAround(sectors, cam, 0, all).filter((r) => r.place === 'thing').map((r) => r.id).sort()).toEqual(want.sort());
  });
  it('says which station the ship is at, and gives it back to the system once it has clearly left', () => {
    const st = s.stations[0];
    const rows = placesAround(sectors, st.at, 0, all);
    const row = rows.find((r) => r.id === st.id);
    const sys = rows.find((r) => r.id === st.system);
    expect(hereZone(row)).toEqual({ in: row.reach + PARK_GAP.near + PARK_GAP.in, out: row.reach + PARK_GAP.near + PARK_GAP.out });
    const at = (d) => ({ x: st.at[0] + d, y: st.at[1], z: st.at[2], speed: 0 });
    // (the system, where its own zone holds you: every station of E:1,0 sits inside its system's)
    const sysOr = (d) => (len(xyz(at(d)), sys.at) < hereZone(sys).in ? sys.id : null);
    expect(orbitingPlace(at(row.reach + PARK_GAP.near), null, rows)).toBe(st.id);
    expect(orbitingPlace(at(row.reach + PARK_GAP.near + PARK_GAP.out - 1), st.id, rows)).toBe(st.id);
    const gone = row.reach + PARK_GAP.near + PARK_GAP.out + 1;
    expect(orbitingPlace(at(gone), st.id, rows)).not.toBe(st.id);
    expect(orbitingPlace(at(gone), st.id, rows)).toBe(sysOr(gone));
    expect(orbitingPlace(at(row.reach + PARK_GAP.near + PARK_GAP.in + 1), null, rows)).toBe(sysOr(row.reach + PARK_GAP.near + PARK_GAP.in + 1));
    for (const x of s.stations) {
      const park = parkPlace(resolvePlace(x.id, { t: 0 }), [x.at[0], x.at[2] + 1000], 0);
      const near = placesAround(sectors, x.at, 0, all);
      const home = near.find((r) => r.id === x.system);
      expect(orbitingPlace(still(park), null, near), x.id).toBe(x.id);
      expect(len(xyz(park), home.at), x.id).toBeLessThan(hereZone(home).in);
    }
  });
  it('counts a ship parked at a system, or at a planet, even one that parks past its moons, as there', () => {
    for (const sys of s.systems.slice(0, 60)) {
      const park = parkPlace(resolvePlace(sys.id, { t: 0 }), [sys.at[0] + 9000, sys.at[2]], 0);
      expect(orbitingPlace(still(park), null, placesAround(one, xyz(park), 0, all)), sys.id).toBe(sys.id);
    }
    const planets = s.systems.flatMap((x) => x.planets);
    const past = planets.filter((p) => {
      const d = resolvePlace(p.id, { t: 0 });
      return parkDistance(d) > d.reach + PARK_GAP.near + 1e-9;
    });
    expect(past.length).toBeGreaterThan(0);
    for (const p of [...s.systems.slice(0, 60).flatMap((x) => x.planets), ...past]) {
      const d = resolvePlace(p.id, { t: 0 });
      const park = parkPlace(d, [d.at[0] + 5000, d.at[2]], 0);
      expect(orbitingPlace(still(park), null, placesAround(one, xyz(park), 0, all), p.id), p.id).toBe(p.id);
    }
  });
  it('keeps a parked ship at its planet as a moon goes by, and gives it to the moon when it flies in', () => {
    const planet = { id: 'P', place: 'planet', at: [0, 0, 0], reach: 100, park: 104 };
    const moon = { id: 'M', place: 'moon', at: [104, 10, 0], reach: 19, park: 23 };
    const ship = (speed) => ({ x: 104, y: 0.3, z: 0, speed });
    expect(orbitingPlace(ship(0), 'P', [planet, moon])).toBe('P');
    expect(orbitingPlace(ship(AROUND.underWay), 'P', [planet, moon])).toBe('M');
    expect(orbitingPlace(ship(0), null, [planet, moon], 'P')).toBe('P');
    expect(orbitingPlace(ship(0), null, [planet, moon])).toBe('M');
    expect(orbitingPlace(ship(0), 'P', [planet, { ...moon, park: null }])).toBe('P');
  });
  it('names the stars to aim at, nearest first, each by its card’s reach', () => {
    const cam = s.systems[0].at;
    const stars = aimStars(sectors, cam, { max: 50 });
    expect(stars).toHaveLength(50);
    for (let i = 1; i < 50; i++) expect(len(stars[i].at, cam)).toBeGreaterThanOrEqual(len(stars[i - 1].at, cam));
    expect(stars[0]).toEqual({ id: s.systems[0].id, at: s.systems[0].at, reach: s.systems[0].star.size * 2 });
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/around.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `around.js`. It allocates no object for a system, planet, moon or thing it rejects, and works out a planet's park only for the systems near enough. Measure `placesAround` over 27 sectors on a warmed run, with `max` at mid's room, 1,800, and at ultra's, 6,000 (69 systems, 278 planets, 415 moons and 1,746 things lie within the far plane of `E:1,0`'s middle, measured on `eu/lane-3`), and say both times in the commit. Under 4 ms at mid is the target, a sixtieth of the quarter second between refreshes (Task 12). If it's over, say by how much, and don't shorten the list to meet it.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 7 tests, each under a second.
- [ ] **Step 5: Commit.** `git commit -m "What's round the ship and which place it's at, each place's zone measured from its park"`

### Task 9: Picking, which names show, and docking, as rules

**Files:**
- Create: `src/components/universe/places/pick.js`, `pick.test.js`, `src/components/universe/places/dock.js`, `dock.test.js`
- Modify: `src/components/universe/budget.js` and `budget.test.js` (lane 2's Task 12): the `tags` field, and a new `describe`

**Interfaces:**
- Consumes: Task 8's `Row`; `ship.js`'s `PARK_GAP`; lane 2's `BUDGET` and `universeBudget({ tier, detail }, step = 0, floor = false)`. The tests import `aim.js`'s `NAME_CONE`; the modules don't.
- Produces:
  - **`pickPlace(rows, project, px, py, { tanHalf, height }) → id | null`.**
    - `project(x, y, z, out)` is the scene's `toScreen`.
    - A row's radius on screen is `reach / (z · tanHalf) · height / 2`, held between 24 px and 160 px.
    - The nearest depth under the point wins. Nothing at a depth of 0.3 or less is picked.
    - This is `scene.js`'s `pickWonder` (`:1662-1667`), over rows.
  - **`BUDGET`'s `tags` field**, read by lane 3: 3 on `low`, 6 on `mid`, `high` and `ultra`.
    - It is in lane 2's one tier table, as spec H asks, not a table of this lane's.
    - The quality steps lower it as they lower `discs`, `thingsNear` and `traffic`: `tags` joins the list that steps 0 to 3 multiply by `[1, 0.75, 0.5, 0.35]` and `floor` by 0.25, rounded. Unlike the others, it never goes below 1, since the aimed or picked place keeps its name.
    - The list's own cap needs no field: it is the far layer's room, lane 2's `farRoom(device).discs`, 1.5 × the row's `discs` (Tasks 8 and 12).
  - **`tagsFor(rows, { ship, nose, focus = [], here = null, max, cone }) → Row[]`**, chosen in this order, each row once, and capped at `max`. `focus` is a list of ids, and `here` is an id; an id with no row, or a null, is skipped. `cone` has no default: the caller passes `aim.js`'s `NAME_CONE`, because `aim.js` reaches three.js through `farStars.js` and `pick.js` stays pure.
    1. the rows whose ids are in `focus`, in that order
    2. the row whose id is `here`
    3. rows within `cone` of the nose, ahead of the ship, nearest first
  - **`DOCK = { speed: 1, in: 2, out: 30 }`.**
  - **`dockState(ship, station, was) → boolean`**, where `d` is the distance from the ship to the station's `at`:
    - with `was` false: `d ≤ reach + PARK_GAP.near + DOCK.in` and `|speed| < DOCK.speed`
    - with `was` true: `d ≤ reach + PARK_GAP.near + DOCK.out`
    - false for a row that isn't a station

- [ ] **Step 1: Write the failing tests.** `pick.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { NAME_CONE } from '../aim';
import { pickPlace, tagsFor } from './pick';

// a camera at z = 1000 looking down -z, a unit to a pixel
const project = (x, y, z, out) => Object.assign(out, { x: 640 + x, y: 360 - y, z: 1000 - z });
const view = { tanHalf: 1, height: 720 };
const R = (id, at, reach = 10) => ({ id, at, reach, place: 'thing', dist: 0 });

describe('picking a generated place', () => {
  it('takes the nearest under the point, at least 24 px round a small one, at most 160 round a big one', () => {
    const rows = [R('far', [0, 0, 0]), R('near', [5, 0, 500]), R('behind', [300, 0, 1200]), R('huge', [-400, 0, 900], 1000)];
    expect(pickPlace(rows, project, 643, 360, view)).toBe('near');
    expect(pickPlace(rows, project, 640 + 30, 360, view)).toBeNull();
    expect(pickPlace(rows, project, 940, 360, view)).toBeNull();
    expect(pickPlace(rows, project, 240 + 150, 360, view)).toBe('huge');
    expect(pickPlace(rows, project, 240 + 170, 360, view)).toBeNull();
    expect(pickPlace([], project, 640, 360, view)).toBeNull();
  });
});

describe('which places are named', () => {
  const ship = { x: 0, y: 0, z: 0 };
  const nose = [0, 0, -1];
  const rows = [
    { id: 'ahead', at: [0, 0, -1000], dist: 1000 },
    { id: 'aheadFar', at: [100, 0, -5000], dist: 5000 },
    { id: 'side', at: [3000, 0, 0], dist: 3000 },
    { id: 'behind', at: [0, 0, 4000], dist: 4000 },
    { id: 'picked', at: [20000, 0, 0], dist: 20000 },
  ];
  it('names what you picked, then where you are, then what’s on the nose, nearest first', () => {
    const cone = NAME_CONE;
    expect(tagsFor(rows, { ship, nose, focus: ['picked'], max: 6, cone }).map((r) => r.id)).toEqual(['picked', 'ahead', 'aheadFar']);
    expect(tagsFor(rows, { ship, nose, focus: ['picked'], here: 'side', max: 6, cone }).map((r) => r.id)).toEqual(['picked', 'side', 'ahead', 'aheadFar']);
    expect(tagsFor(rows, { ship, nose, focus: ['picked'], max: 2, cone }).map((r) => r.id)).toEqual(['picked', 'ahead']);
    expect(tagsFor(rows, { ship, nose: [1, 0, 0], max: 6, cone }).map((r) => r.id)).toEqual(['side', 'picked']);
    expect(tagsFor(rows, { ship, nose, focus: [null, 'gone', 'picked', 'picked'], here: 'picked', max: 6, cone }).map((r) => r.id)).toEqual(['picked', 'ahead', 'aheadFar']);
  });
});
```

  `budget.test.js` gains, in a new `describe`, the test below. Lane 2's table test pins whole rows with `toEqual` (`budget.test.js:13-28` on this branch), so each of its four expected rows gains its `tags` too, which adds to the test and loosens nothing. Its other tests (no level gives less of any count than the one below it, the rows are frozen) take `tags` as they are. `budget.js`'s header gains the field's line, "`tags` the generated places' names shown at once (lane 3)":

```js
describe('name tags (lane 3)', () => {
  it('are 3 on low and 6 above, lowered with the discs by the quality steps, never below one', () => {
    expect(['low', 'mid', 'high'].map((tier) => universeBudget({ tier }).tags)).toEqual([3, 6, 6]);
    expect(universeBudget({ tier: 'high', detail: 'ultra' }).tags).toBe(6);
    expect(universeBudget({ tier: 'mid' }, 2).tags).toBe(3);
    for (const tier of ['low', 'mid', 'high']) {
      for (let step = 0; step <= 3; step++) {
        for (const floor of [false, true]) {
          const n = universeBudget({ tier }, step, floor).tags;
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(universeBudget({ tier }).tags);
        }
      }
    }
  });
});
```

  `dock.test.js`, with a station row `{ id: 'E:1,0:w10003', place: 'station', at: [0, 0, 0], reach: 30 }`:
  - `dockState` at `30 + 4 + 2` and speed 0.5 is true, and at speed 1.5 is false.
  - At `30 + 4 + 3` from false it is false.
  - From true it is true at `30 + 4 + 29` and false at `30 + 4 + 31`.
  - A `place: 'planet'` row is false at any distance.
  - A docked ship drifting back and forth between `30 + 4 + 29` and `30 + 4 + 30` for 100 steps, at speeds up to 3, stays docked every step.

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/pick.test.js src/components/universe/places/dock.test.js src/components/universe/budget.test.js`. Expected: `pick` and `dock` FAIL (modules not found), and the new budget `describe` FAILS (`tags` is undefined). Lane 2's budget tests pass.
- [ ] **Step 3: Implement** `pick.js` and `dock.js`, and add `tags` to `BUDGET` and to the stepped fields in `universeBudget`.
- [ ] **Step 4: Run them and see them pass.** Same command, then `npx vitest run src/components/universe src/components/expanse`. Expected: PASS.
- [ ] **Step 5: Run PR 3.1's gate.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, with `boundary-breaks`, `cycles` and `big-files` as on the branch before Task 1.
- [ ] **Step 6: Commit.** `git commit -m "Rules for picking a generated place, naming the ones in view, and docking at a station"`. The body says the tags' cap is a field of the one tier table, as spec H asks, and the quality steps lower it.

---

## What PR 3.2 waits on

PR 3.1 needs nothing unmerged: it builds on `eu/lane-3` as it stands. Every task of PR 3.2 waits for the coordinator's merge of wave 1 into this branch (lane 2's five PRs, and lanes 1, 5a and 6a). From each, exactly this:

**Lane 2, PR 2.4's Task 17** (on `eu/lane-2` at `18952195`, not yet on `eu/lane-3`):
- its face, `expanse/shared/space.js`, lending `UNIVERSE`, `spaceTime` and `farRoom` (Tasks 11 and 12)
- `expanse.update({ …, now: state.held || reduced ? 0 : Date.now() })` in `render()`, right after `aimAt()` (Task 11's clock)
- `expanse.solids()` in the frame's `moving` (`solidsWith(…, expanse.solids())`), which `solidsNow` and the autopilot both take (Task 12 adds `places.solids()` beside it)
- `expanse.setStep(at.step, at.floor)` in `paceTo` (Task 12's `places.setStep` beside it)
- a crash into a generated body backing out from that body, found in `solidsNow` (so Task 12 needs no crash fix of its own)
- the far layer made with `farRoom(device())`'s room (Task 12's list cap is that room)

**Lane 2, PR 2.5:**
- **Task 19:** `expanse/gen/job.js`'s `sectorJob` and `withMoons`, and the worker behind the `'expanse'` pool (`sector.worker.js`). A job's sector must carry Task 1's `stations`. Task 12 lends both names on `expanse/shared/gen.js`, builds `fakePool` on `sectorJob`, and fetches with it.
- **Task 20:** `createExpanse(…).sectors()`, a `Map` of `fullSector`-shaped sectors, things and `stations` included, their moons through `withMoons`, loaded round the ship in 3D everywhere. Until then the Expanse holds 2D `addBodies(makeSector(…))` sectors, with no things or stations, and sleeps inside the rim. Tasks 11 (`resolve`), 12 (what's near, the stations, `missing`), 13 (tags and picks) and 14 (a link's start) read it.
- **Task 21:** the lattice things and extras drawn as discs, and `nearThings`' solids. Task 13's browser pick of a thing needs the disc (its unit test needs only Task 8). Task 2's card for a legacy wonder should match the solid Task 21 makes (assumption 5).
- **Task 22:** `workers: ctx.rt.workers` passed to `createExpanse`, so the pool is the scene's (`places.fetch` gives null until then); `__universeDebug.teleport`; `scripts/universe-endless-check.mjs`, its steps and its recorder; and the poses `old-rim`, `above-core` and `expanse-system`, with their baselines in `lab/universe/endless/<tier>`. (Its floating origin going changes nothing here: while it's in, it re-anchors only what's drawn, and every position stays the map's.)

**Lane 6a** (all on `eu/lane-6a` at `3cf60b7c`): `CHART_WORDS.sector` (Task 14); `chart/declutter.js`'s `declutter` and `boxOf` (Task 13); the mini-map on `chart/marks.js`, so `Interests` loads `nav.js` (Task 14's `weight.test.js` line and its bundle numbers); `FlatMap` in `UniverseMap.jsx`'s flat box (Task 14); and its `FILES` line in `src/lib/words.test.js`, which Task 14 adds beside.

| Task | Waits on |
|---|---|
| 10 | the whole merge, for its before shots (2.5's poses among them). The move itself needs only `scene.js`. |
| 11 | 2.4's Task 17 (the face, the clock); 2.5's Task 20 (`sectors()`) and Task 22 (the endless check, `teleport`) |
| 12 | 2.4's Task 17 (`farRoom`, `moving`, `setStep`, the crash); 2.5's Tasks 19 (`sectorJob`, `withMoons`), 20 (`sectors()`) and 22 (the pool, the check, `expanse-system`) |
| 13 | Task 12; lane 6a's `declutter`; 2.5's Tasks 21 (things drawn) and 22 |
| 14 | Task 12; lane 6a (`CHART_WORDS`, `FlatMap`, the mini-map); 2.5's Task 22 (the check) |
| 15 | all of the above; 2.5's Task 22 (the poses and the endless baselines) |

---

## PR 3.2: The wiring

### Task 10: The before shots, and the scene's travel moves out to `trips.js`

**Files:**
- Create: `src/components/universe/trips.js`, `src/components/universe/trips.test.js`, `lab/universe/before-3/mid/*` (from `universe-check`)
- Modify: `src/components/universe/scene.js`: the block from `const dropAuto = () => {` (`:1769`) through the end of `chasePilot` (`:1905`, before `// ── The ship ──`). `const wall = () => performance.now() / 1000;` (`:1766`) stays.
- Modify: `docs/superpowers/evidence/endless-universe-lane-3/README.md` (the before rows)

**Interfaces:**
- Consumes: the moved block's own imports: `HYPER`, `driveById`, `hyperState`, `legOf`, `parkFor`, `portalById`, `OPEN_SPACE`, `headingTo`, `isGoal` (travel's own check, `:1782`), `REAIM_MS`, `parkBehind`, `pilotId`, `pilotSpace`, `reached`, `JAMMED` and `jumpState`. Lint names any that's missed.
- Produces: `createTrips(deps) → { travel(id, drive = deps.props().drive), dropAuto(), arriveAt(park), navTo(id), frontSpace(), withPilot(name), pilotGone(id, name), chasePilot() }`, behaving exactly as the block did.
  - `deps` is `{ state, props, emit, pilots, front, powers, unique, heard, retarget, invalidate, reduced, onFoot, wall, settle }`.
  - The call sits where the block was (`:1769`), so anything `scene.js` declares below it, or reassigns, is a thunk, called each time it's read and never at creation (Global Constraints, "Declared after, or changed later"):
    - `props: () => props`. It's `let props = ctx` (`:491`), reassigned on every page update (`props = next`, `:6120`). The block reads `props.drive` (travel's default drive) and `props.frozen` (no travel while the page is leaving or the Shipyard is up), so a value kept at creation would fly the first drive for ever and never freeze.
    - `powers: () => powers`, `const` at `:2338`, below the call. As a value it throws a `ReferenceError` (its temporal dead zone) as the scene loads.
    - `unique: () => unique`, `const` at `:2340`, the same.
    - `front: () => front`. It's a `let` (`:1053`), null until `frontFor` makes it (`:1072`), and made again when the crew's side changes. As a value it stays null, and a trip to the front never goes.
    - `heard: () => heard()` (`const` at `:1908`, below)
    - `retarget: (ms) => retarget(ms)`. It's a `const` at `:1725`, above the call and never reassigned, so a value would do, but it's passed like `heard`, so the block's calls read alike.
    - `invalidate: () => ctx.invalidate()`
    - `settle: () => { camQOn = false; }`. `camQOn` is a `let` (`:1348`) that the block sets but can't reach from another module.
  - Plain values, declared above `:1769` and never reassigned: `state` (`:1174`), `emit` (`:1719`), `pilots` (`:1122`), `reduced` (`:490`), `onFoot` (`:843`) and `wall` (`:1766`).
  - `scene.js` puts `const { travel, dropAuto, arriveAt, navTo, frontSpace, withPilot, pilotGone, chasePilot } = createTrips({...});` in the block's place.

- [ ] **Step 1: Take the before shots** on the branch as it stands, after lanes 1, 2, 5a and 6a have merged and before any picture of this lane.
  - Run `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-check.mjs --quality mid --out lab/universe/before-3/mid`, on every pose including lane 2's `old-rim`, `above-core` and `expanse-system`. It takes about an hour in software GL. Run it in the background and wait on its exit.
  - Write the calls and triangles at each pose into the evidence README.
- [ ] **Step 2: Write the failing tests** `trips.test.js`. They pin today's behaviour, before the move:

```js
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrips } from './trips';
import { driveById, parkFor } from './nav';
import { OVERDRIVE, spawn } from './ship';
import { SECTORS } from './layout';
import { JAMMED, jumpState } from './words';

// (the deps as scene.js passes them: the page's props, the powers and the
// arms are thunks, read when they're needed, never when the trips are made)
const make = ({ state = {}, props = {}, deps = {} } = {}) => {
  const events = [];
  const st = { ship: { ...spawn('home') }, auto: null, jump: null, then: null, note: null, crash: null, dive: null, hyperAt: null, interdicted: false, stats: {}, view: 'chase', seat: 'chase', lastInput: 0, flown: true, yaw: 0, ...state };
  let now = { drive: 'super', frozen: false, ...props };
  const powers = { cancel() {} };
  const unique = { clear() {} };
  const trips = createTrips({
    state: st, props: () => now, emit: (e) => events.push(e),
    pilots: { pose: () => null }, front: () => null, powers: () => powers, unique: () => unique,
    heard() {}, retarget() {}, invalidate() {}, reduced: false, onFoot: () => false, wall: () => 100, settle() {}, ...deps,
  });
  return { state: st, events, trips, setProps: (next) => { now = { ...now, ...next }; } };
};
afterEach(() => vi.useRealTimers());

describe('trips (the scene’s travel, moved out)', () => {
  it('flies to a place on super speed, parked as nav.js parks it', () => {
    const { state, trips } = make();
    expect(trips.travel('marvel', 'super')).toBe(true);
    expect(state.auto).toEqual({ id: 'marvel', park: parkFor('marvel', [state.ship.x, state.ship.z]), od: OVERDRIVE });
  });
  it('jumps with the jump charged, and goes on super speed saying why when it isn’t', () => {
    const a = make();
    a.trips.travel('marvel', 'hyper');
    expect([a.state.jump?.phase, a.state.auto]).toEqual(['align', null]);
    const b = make({ state: { hyperAt: 98 } });
    b.trips.travel('marvel', 'hyper');
    expect(b.state.auto.od).toBe(OVERDRIVE);
    expect(b.events).toContainEqual({ type: 'hyper', why: 'charging', wait: 3 });
    expect(b.state.note.text).toBe(`${jumpState(false, 3)}: super speed instead`);
    const c = make({ state: { interdicted: true } });
    c.trips.travel('marvel', 'hyper');
    expect(c.state.note.text).toBe(JAMMED.long);
  });
  it('is simply there with reduced motion, and says so after the page’s own pick', () => {
    vi.useFakeTimers();
    const { state, events, trips } = make({ deps: { reduced: true } });
    const park = parkFor('marvel', [state.ship.x, state.ship.z]);
    trips.travel('marvel');
    expect([state.ship.x, state.ship.z, state.auto]).toEqual([park.x, park.z, null]);
    expect(events.some((e) => e.type === 'arrived')).toBe(false);
    vi.runAllTimers();
    expect(events).toContainEqual({ type: 'arrived', id: 'marvel', done: true });
  });
  it('goes by the portal into the other sector, and on from its far end', () => {
    const o = SECTORS.rickmorty.origin;
    const { state, trips } = make({ state: { ship: { ...spawn(null), x: o[0], y: 0, z: o[2] + 500 } } });
    trips.travel('marvel', 'super');
    expect([state.auto.id, state.then]).toEqual(['rmportal-back', { id: 'marvel', drive: 'super', name: null }]);
  });
  it('won’t go nowhere, on foot, frozen or mid-crash', () => {
    expect(make().trips.travel('nope')).toBe(false);
    expect(make({ deps: { onFoot: () => true } }).trips.travel('marvel')).toBe(false);
    expect(make({ props: { frozen: true } }).trips.travel('marvel')).toBe(false);
    expect(make({ state: { crash: {} } }).trips.travel('marvel')).toBe(false);
  });
  it('drops a trip and tells the page', () => {
    const { state, events, trips } = make();
    trips.travel('marvel');
    trips.dropAuto();
    expect([state.auto, state.then]).toEqual([null, null]);
    expect(events.at(-1)).toEqual({ type: 'arrived', id: 'marvel', done: false });
  });
  it('reads the page’s props as they are now, not as they were when it was made', () => {
    const { state, trips, setProps } = make();
    setProps({ frozen: true });
    expect(trips.travel('marvel')).toBe(false);
    setProps({ frozen: false, drive: 'cruise' });
    expect(trips.navTo('marvel')).toBe(true);
    expect(state.auto.od).toBe(driveById('cruise').od);
    expect(state.auto.od).not.toBe(OVERDRIVE);
  });
  it('goes to the war front just inside the fight, reading the front as it is now', () => {
    // (front.js's goal(): { id: 'front', at, r: 30, reach: ZONE.in * 0.8 })
    const goal = { id: 'front', at: [5000, 0, 3000], r: 30, reach: 400 };
    let front = null;
    const { state, trips } = make({ deps: { front: () => front } });
    expect(trips.travel('front', 'super')).toBe(false); // (no front yet: frontFor hasn't made one)
    front = { goal: () => goal };
    expect(trips.travel('front', 'super')).toBe(true);
    const { park } = state.auto;
    expect(state.auto.id).toBe('front');
    expect(Math.hypot(park.x - goal.at[0], park.z - goal.at[2])).toBeCloseTo(goal.reach, 6);
    expect(park.y).toBe(goal.at[1]);
    expect(trips.frontSpace().goals.front).toEqual(goal);
  });
  it('can be made before the powers and the arms exist, as scene.js makes it, and reads them only on a jump', () => {
    let powers;
    let unique;
    const { state, trips } = make({ deps: { powers: () => powers, unique: () => unique } });
    powers = { cancel: vi.fn() };
    unique = { clear: vi.fn() };
    trips.travel('marvel', 'super');
    expect([powers.cancel, unique.clear].map((f) => f.mock.calls.length)).toEqual([0, 0]);
    trips.dropAuto();
    trips.travel('marvel', 'hyper');
    expect(state.jump?.phase).toBe('align');
    expect([powers.cancel, unique.clear].map((f) => f.mock.calls.length)).toEqual([1, 1]);
  });
});
```

- [ ] **Step 3: Run them and see them fail.** Run `npx vitest run src/components/universe/trips.test.js`. Expected: FAIL (module not found).
- [ ] **Step 4: Move the block.** It goes verbatim into `trips.js`, with `const` closures over `deps`, and is wired into `scene.js` as in the Interfaces.
  - At the top of `createTrips`, only the plain values are destructured: `const { state, emit, pilots, reduced, onFoot, wall } = deps;`. The thunks are never destructured into values. Each is called where the block read the name, every time.
  - These are every rewrite in the moved text, by the name it read:

    | Today (`scene.js`) | In `trips.js` | Where |
    |---|---|---|
    | `props.drive` (travel's default drive) | `deps.props().drive` | `travel`'s signature (`:1776`) |
    | `props.frozen` | `deps.props().frozen` | `travel`'s guard (`:1782`) |
    | `(id === 'front' && front)` | `(id === 'front' && deps.front())` | `travel`'s guard (`:1782`) |
    | `front?.goal()` | `deps.front()?.goal()` | `frontPark` (`:1850`) |
    | `front.goal()` | `deps.front().goal()` | `frontSpace` (`:1857`) |
    | `heard()` | `deps.heard()` | `travel`, after the park (`:1796`) |
    | `powers.cancel()` | `deps.powers().cancel()` | the jump (`:1822`) |
    | `unique.clear()` | `deps.unique().clear()` | the jump (`:1823`) |
    | `retarget(700)` | `deps.retarget(700)` | `travel`'s end (`:1835`) |
    | `ctx.invalidate()` | `deps.invalidate()` | reduced motion's arrival (`:1807`) and `travel`'s end (`:1836`) |
    | `camQOn = false` | `deps.settle()` | `arriveAt` (`:1844`) |

  - Nothing else in it changes. `scene.js`'s own `state.auto.id === 'front' && front ? frontSpace() : OPEN_SPACE` (`:4378`, in `fly()`) stays in `scene.js` and reads its own `front`.
  - Count `scene.js`'s lines before and after.
- [ ] **Step 5: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS. A dep passed as a value where it should be a thunk throws as the scene loads, which the unit tests can't see: Step 6's smoke check loads `/universe` and fails on any page or console error.
- [ ] **Step 6: Check in the browser that travel is unchanged.**
  1. **Start the dev server** the first three need (Global Constraints, "The dev server"):
     - Start `npx vite --port 5173 --strictPort` in the background.
     - Wait until `curl --noproxy '*' -sf -o /dev/null http://localhost:5173/` succeeds, in an until-loop on that condition, giving up after 60 s.
  2. **Run the checks.** Expected: each as before the move.
     - `CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs desktop`: the jump to a wonder by name
     - `CHROME=/opt/pw-browsers/chromium node scripts/sector-check.mjs`: through the portal and on
     - `CHROME=/opt/pw-browsers/chromium node scripts/flyto-check.mjs --fake`: to a pilot
     - `CHROMIUM=/opt/pw-browsers/chromium node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe --quality mid`, which runs its own preview server
  3. **Stop the dev server.**

  The first three draw no pose and take no quality flag: each loads `?quality=low` itself, as Global Constraints' "Browser checks" exempts them.
- [ ] **Step 7: Commit.** `git add src/components/universe/trips.js src/components/universe/trips.test.js src/components/universe/scene.js lab/universe/before-3 docs/superpowers/evidence/endless-universe-lane-3 && git commit -m "The scene's travel moves to trips.js unchanged; before shots for lane 3"`. The body says `scene.js`'s line counts.

### Task 11: Trips go to generated places

**Files:**
- Modify: `src/components/universe/trips.js`, `src/components/universe/trips.test.js` (a new `describe`)
- Modify: `scripts/universe-endless-check.mjs` (`--only`, and the `travel` step)
- Modify `scene.js` in place. Each change says the lines it adds:
  - **The imports.**
    - Lane 2's Task 17 already moved `UNIVERSE` onto its face: `import { UNIVERSE, createExpanse, farRoom } from '../expanse/shared/space';` (`:223` on `eu/lane-2`). It gains `spaceTime` (0). (On `main` it was `import { UNIVERSE } from '../expanse/gen/seed';` at `:222`.)
    - `import { resolvePlace } from './places/resolve';` and `import { followPark, parkPlace } from './places/park';` (+2).
  - **The state** (`:1178`'s object) gains `spaceT: spaceTime(reduced ? 0 : Date.now()), arrived: null, pending: null,` (+1).
  - **The clock**, where lane 2's `expanse.update({ …, now: … })` is called in `render()`: `const nowMs = state.held || reduced ? 0 : Date.now(); state.spaceT = spaceTime(nowMs);` comes before it, and the call takes `now: nowMs` (+1).
  - **The jump's way out** (`:4350-4356`, `const pid = pilotId(j.id); … else if (pid) pilotGone(j.id, j.name);`): six lines become `const park = outOfJump(j);` (−5).
  - **The trip's end** (`:4380-4384`): `const id = state.auto.id; state.auto = null; emit({ type: 'arrived', id, done: true });` becomes `endTrip(state.auto.id);` (−2). The name isn't `finish`: `scene.js` has its own `finish` at `:4925`.
  - **The follow:** `if (!state.jump) chasePilot();` (`:4369`) becomes `if (!state.jump) (chasePilot(), followPlace());` (0).
  - **Every other place that drops `state.auto`** drops the arrival and the wait with it, so neither outlives the trip:
    - the ship change (`:2152`), `startCrash` (`:3084`), the fall (`:3134`) and `portalThrough` (`:4250`): `state.auto = null;` becomes `state.auto = state.arrived = state.pending = null;` (0 each)
    - `takeover` (`:2251`): its `state.auto = null;` becomes `state.auto = state.arrived = null;`, and `state.pending = null;` goes before its `if (state.auto)`, since the stick calls off a trip still waiting on its sector (+1)
  - **The trips' deps** gain `resolve: (id) => resolvePlace(id, { universe, t: state.spaceT, sectors: expanse.sectors(), build: false })`. `expanse.sectors()` is lane 2's PR 2.5 (Task 20); `resolvePlace` finds a sector in it by the sector's own `id`, whatever the `Map`'s keys (Task 3). The inline `typeof ctx.universe === 'bigint' ? ctx.universe : UNIVERSE` at `createExpanse` (`:773` on `main`, `:758` on `eu/lane-2`) becomes a `const universe` above it (+1). There's no `fetch` yet: a place outside the loaded sectors can't be gone to until Task 12 wires `places.fetch` in. Task 12 swaps `resolve` for `places.resolve` and adds `places.fetch` and `places.missing`.
  - **The dev hooks.**
    - `__universeDebug` (`:5911`) gains `places` on its existing line (0): `{ resolve: (id) => …, parkAt: (id, from, t0, t) => … }`. `resolve` is the deps' `resolve`. `parkAt` is `followPark(dest, parkPlace(dest, from, t0), t)`: the park a trip started from `from` at `t0` is at now.
    - `__universe()` (`:5923`) gains `t: state.spaceT` (0).

  Task 12's `places.debug` replaces the dev hook with the same two calls, so the check doesn't change.

  That is −1 in all: +6 against the −7 the jump's way out and the trip's end give back.

**Interfaces:**
- Consumes: Tasks 3, 4 and 7 (`canonicalPlace`, `isPlaceId`, `resolvePlace`, `parkPlace`, `followPark`, `placeSpace`, `atTime`).
- Produces (on `createTrips`, with `deps` gaining `resolve(id) → Destination | null`, and an optional pair, `fetch(id) → Promise<Destination | null>` and `missing(id) → boolean`, true when the id's sector isn't at hand, which Task 12 supplies from `places`):
  - **`travel(id, drive)` takes a generated id in any spelling.**
    - It canonicalises it and sets `state.arrived = null` and `state.pending = null`, as every travel now does.
    - **At hand** (`deps.resolve` finds it), it goes by an internal `go(dest, drive)`, which is all of the following:
      - `legOf` goes by the portal from the Curve.
      - The park is `parkPlace(dest, [s.x, s.z], state.spaceT)`.
      - `state.auto` (or `state.jump`) carries `place: { dest, park }`, and the auto carries `space: placeSpace(OPEN_SPACE, dest)`.
      - Reduced motion is `arriveAt(followPark(...))`.
    - **Not at hand, its sector not at hand (`deps.missing(id)`), with `deps.fetch`:**
      - It sets `state.pending = { id, drive }` and returns true.
      - When the fetch lands and `state.pending` is still that same object, it clears it and goes with the landed Destination itself, `go(dest, pending.drive)`. It never resolves the id again: the fetched sector need not be among `deps.resolve`'s yet, and a second miss would fetch for ever.
      - A fetch that gives null, or rejects, emits `{ type: 'arrived', id, done: false }`.
      - A later travel, `dropAuto`, the stick, a crash or a portal clears `state.pending`, so a late landing does nothing.
    - **Otherwise, false:** with no `deps.fetch`, or when `deps.missing(id)` is false. A sector that's at hand and doesn't hold the place (`E:1,0:0:99`) has nothing to wait for, so it never sets `pending` or asks for a fetch.
  - **`followPlace()`**, each frame: for a trip to a place, `state.auto.park = followPark(dest, park, state.spaceT)`, and its space goal's `at` is set in place to `atTime(dest, state.spaceT)`.
  - **`outOfJump(j) → park`:**
    - a pilot's: behind them as they are now, saying who you're with or that they've gone
    - a place's: `followPark` at `state.spaceT`
    - else `j.park`

    It sets `state.arrived = { id: j.id }`.
  - **`endTrip(id)`:** the autopilot's done. It clears `state.auto`, emits `arrived` done and sets `state.arrived = { id }`. The arrival is a new object each time, so the same place twice is two arrivals.
  - `dropAuto()` also clears `state.arrived` and `state.pending`.

- [ ] **Step 1: Write the failing tests** (appended to `trips.test.js`, which adds `resolvePlace` from `./places/resolve`, `atTime` from `./places/ids` and `followPark` and `parkPlace` from `./places/park` to its imports):

```js
describe('trips to generated places', () => {
  const resolve = (id) => resolvePlace(id, { t: 0 });
  const id = 'E:1,0:0:0';
  const xyz = (k) => ({ x: k.x, y: k.y, z: k.z, heading: k.heading });
  const flush = () => new Promise((r) => setTimeout(r, 0));
  it('flies to a planet in any spelling, re-parked on it as its orbit carries it', () => {
    const { state, trips } = make({ state: { spaceT: 0 }, deps: { resolve } });
    expect(trips.travel('e:1,0:0:0', 'super')).toBe(true);
    const d = resolve(id);
    const park = parkPlace(d, [spawn('home').x, spawn('home').z], 0);
    expect(state.auto.id).toBe(id);
    expect(xyz(state.auto.park)).toEqual(xyz(park));
    expect(state.auto.space.goals[id]).toMatchObject({ id, r: d.r, reach: d.reach });
    state.spaceT = 600;
    trips.followPlace();
    expect(xyz(state.auto.park)).toEqual(xyz(followPark(d, park, 600)));
    expect(state.auto.space.goals[id].at).toEqual(atTime(d, 600));
  });
  it('comes out of a jump where the place is at the flash', () => {
    const { state, trips } = make({ state: { spaceT: 0 }, deps: { resolve } });
    trips.travel(id, 'hyper');
    state.spaceT = 900;
    const out = trips.outOfJump(state.jump);
    expect(xyz(out)).toEqual(xyz(followPark(resolve(id), state.jump.place.park, 900)));
    expect(state.arrived).toEqual({ id });
  });
  it('won’t go to a place that isn’t there, or one it can’t fetch', () => {
    expect(make({ deps: { resolve } }).trips.travel('E:1,0:0:99')).toBe(false);
    expect(make({ deps: { resolve: () => null } }).trips.travel('E:9,0:0')).toBe(false);
    // (its sector is at hand and holds nothing there: no wait, no fetch)
    const fetch = vi.fn(async () => null);
    const none = make({ deps: { resolve, fetch, missing: () => false } });
    expect(none.trips.travel('E:1,0:0:99')).toBe(false);
    expect([none.state.pending, fetch.mock.calls.length]).toEqual([null, 0]);
  });
  it('waits for a place whose sector isn’t made yet, then goes, unless something came first', async () => {
    let land;
    const fetch = vi.fn(() => new Promise((r) => { land = r; }));
    // (resolve still misses when the fetch lands: the trip goes with what landed, never resolving again)
    const missing = () => true;
    const a = make({ state: { spaceT: 0 }, deps: { resolve: () => null, fetch, missing } });
    expect(a.trips.travel(id, 'super')).toBe(true);
    expect([a.state.auto, a.state.pending]).toEqual([null, { id, drive: 'super' }]);
    land(resolve(id));
    await flush();
    expect([a.state.auto?.id, a.state.pending]).toEqual([id, null]);
    expect(xyz(a.state.auto.park)).toEqual(xyz(parkPlace(resolve(id), [spawn('home').x, spawn('home').z], 0)));
    expect(fetch).toHaveBeenCalledTimes(1);
    const b = make({ state: { spaceT: 0 }, deps: { resolve: () => null, fetch, missing } });
    b.trips.travel(id, 'super');
    b.trips.travel('marvel', 'super');
    land(resolve(id));
    await flush();
    expect(b.state.auto.id).toBe('marvel');
    const c = make({ state: { spaceT: 0 }, deps: { resolve: () => null, fetch, missing } });
    c.trips.travel(id, 'super');
    c.trips.dropAuto();
    land(resolve(id));
    await flush();
    expect(c.state.auto).toBeNull();
    const d = make({ deps: { resolve: () => null, fetch: async () => null, missing } });
    d.trips.travel('E:9,0:0', 'super');
    await flush();
    expect(d.events.at(-1)).toEqual({ type: 'arrived', id: 'E:9,0:0', done: false });
    const e = make({ deps: { resolve: () => null, fetch: async () => { throw new Error('the pool went away'); }, missing } });
    e.trips.travel('E:9,0:0', 'super');
    await flush();
    expect([e.state.pending, e.events.at(-1)]).toEqual([null, { type: 'arrived', id: 'E:9,0:0', done: false }]);
  });
  it('marks a trip’s end as an arrival, each time afresh, and a dropped one or a new one as none', () => {
    const { state, events, trips } = make({ state: { spaceT: 0 }, deps: { resolve } });
    trips.travel(id);
    trips.endTrip(id);
    const first = state.arrived;
    expect([state.auto, first]).toEqual([null, { id }]);
    expect(events.at(-1)).toEqual({ type: 'arrived', id, done: true });
    trips.travel(id);
    expect(state.arrived).toBeNull();
    trips.endTrip(id);
    expect(state.arrived).not.toBe(first);
    trips.travel(id);
    trips.dropAuto();
    expect(state.arrived).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/trips.test.js`. Expected: the new `describe` FAILS.
- [ ] **Step 3: Implement**, and wire `scene.js` as above. Count its lines.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS.
- [ ] **Step 5: Add the endless check's `travel` step, and an `--only`.**
  - In `scripts/universe-endless-check.mjs`, `--only a,b` runs `start` and then only the named steps.
  - The `travel` step waits on the park itself, never on a distance from the place. A system parks in a gap past its planets' bands, and a planet may park past its moons.
  - Both of its legs here go to places that don't move: systems. A planet can't be stopped at until Task 12's carry. `E:1,0:0:0` moves at 0.645 units a second on the wall clock, and in software GL at a frame or two a second the ship gets only `MAX_DT = 0.05` s of physics a frame (`runtime.js:62`), so the autopilot's stop (within 0.4, under 0.25 units a second, `ship.js:775-779`) would never come (Review Focus 2, "Two clocks"). Task 12 adds the planet leg.
    1. Wait until `__universeDebug.places.resolve('E:1,0:0')` is non-null (the sector loads round the ship). `__universeDebug.teleport` to 1,500 units past its `span` (the system's reach) from its `at`, on +x, level.
    2. Read the ship's `[x, z]` and `__universe().t` as `from` and `t0`. Then `__universeDebug.travel('E:1,0:0', 'super')`.
    3. Wait until `__universe().auto` is null and the ship is within 1 of `places.parkAt('E:1,0:0', from, t0, __universe().t)`.
    4. Wait until `places.resolve('E:2,0:0')` is non-null (`E:2,0` is in the 3 × 3 × 3 round `E:1,0`). Read `from` and `t0` again, then `travel('E:2,0:0', 'hyper')`.
    5. Wait until `__universe().jump` is null and the ship is within 1 of `places.parkAt('E:2,0:0', from, t0, __universe().t)`.

  Each wait is a `waitForFunction` with `polling: 500` and a 300 s timeout.
- [ ] **Step 6: Run it.** Run `node scripts/universe-endless-check.mjs --quality mid --only travel`. Expected: exit 0, no console errors.
- [ ] **Step 7: Commit.** `git commit -m "Trips go to generated places by any drive, re-parked on a moving planet, out of a jump where it is"`. The body says `scene.js`'s count, and that the browser legs go to systems until the carry lands.

### Task 12: The scene's places: what's near, stations drawn and solid, the carry, where you are, docking

**Files:**
- Create: `src/components/universe/places/scenePlaces.js`, `scenePlaces.test.js`, `src/components/universe/places/stationLook.js`, `stationLook.test.js`
- Modify: `src/components/expanse/shared/gen.js` and `gen.test.js`: the face gains lane 2's `withMoons` and `sectorJob` (`expanse/gen/job.js`, its PR 2.5's Task 19), and the pinned list both names
- Modify: `scripts/universe-endless-check.mjs` (the `dock` step; the `travel` step's planet leg, which checks the way-to-go marker)
- Modify `scene.js` in place. Each change says the lines it adds:
  - **The imports.**
    - `import { createScenePlaces } from './places/scenePlaces';` (+1).
    - Task 11's `import { resolvePlace } from './places/resolve';` goes, now that `places` resolves (−1).
    - Its `places/park` import goes, now that `places` parks and follows (−1).
    - `aimTargets` leaves the `./aim` import's line (`:148`), now that `places` merges it (0).
  - **Created after `createExpanse`** (`:772-780`): `const places = createScenePlaces({ group: map, universe, expanse, workers: ctx.rt.workers, startAt: props.startAt, toScreen: (...a) => toScreen(...a), prepare: (o) => warm(o), emit: (e) => emit(e), note: (text) => { state.note = { text, until: wall() + 3 }; }, device: device() })` (+1). The trips' deps become `resolve: (id) => places.resolve(id), fetch: (id) => places.fetch(id), missing: (id) => places.missing(id)` (0, on the deps' line).
    - Values, all declared above `:780` and never reassigned: `map` (`:503`), `universe` and `expanse` (Task 11's, `:772`), `ctx`, and `device()` (`lib/device`, imported at `:107`; the `{ tier, detail }` lane 2 hands `universeBudget` and `farRoom`, `:750` on `eu/lane-2`). `props.startAt` is read once, for the start.
  - **The quality steps.** In `paceTo` (`:5053`; `:5014` on `eu/lane-2`), beside lane 2's `expanse.setStep(at.step, at.floor)` (its Task 17): `places.setStep(at.step, at.floor);` (+1). The tags' cap comes down with the discs. The list's cap is the far layer's room, which doesn't change, so it always holds what the discs draw.
    - Closures, since each is declared below: `toScreen` (`:1526`), `warm` (`:948`), `emit` (`:1719`), and `state` (`:1174`) and `wall` (`:1766`) inside `note`.
  - **In `fly()`, before the step** (`:4405-4415`):
    - `if (!state.held) state.ship = places.carry(state.ship, state.carryT ?? state.spaceT, state.spaceT); state.carryT = state.spaceT;` (+1)
    - The frame's `moving`, `solidsWith(NO_SHIPS, …, expanse.solids())` since lane 2's Task 17 (`:4322` on `eu/lane-2`), gains `places.solids()` (0, in place). The step's `solidsNow = solidsWith(…, moving)` and the autopilot both take it from there.
  - **The update, every frame.** In `render()`, right after `expanse.update(…)` (`:5340`), outside `fly()`, so it runs on foot, in a dive and frozen too (+1):

    ```js
    places.update({ ship: state.ship, camera, t: state.spaceT, flying: flying() && !onFoot() && !state.dive && !props.frozen, nose: state.ship ? noseOf(state.ship) : null, going: state.jump?.id ?? state.auto?.id ?? state.pending?.id ?? null, arrived: state.arrived, held: state.held })
    ```

    With `flying` false, it draws no tag and tracks nothing new: `here` and `docked` keep their last values. It passes the three.js `camera` itself, never `camera.position` as a place's frame: `scenePlaces` brings it into the map's frame (Interfaces).
  - **The aim** (`:803`): `aimTargets(sector, state.at)` becomes `places.aimTargets(sector, state.at)` (0). It is one merged array, kept between frames, not up to 2,000 rows spread afresh every frame. Generated stars aren't seen from inside the Curve.
  - **Names.** The aim's event (`:806`), the HUD's jump line (`:4868`, `:4872`) and `fightGoal` (`:3773`): `destinationById(id)` becomes `destinationById(id, places.look)` (0).
  - **The start** (`:2216`). The spawn's second argument becomes `(!state.sel && props.startAt && props.startAt !== MAW.id && (isGoal(props.startAt) ? parkFor(props.startAt, [0, 0]) : places.park(props.startAt, [0, 0]))) || startAt()` (0). After the spawn, `if (!state.sel && places.missing(props.startAt)) travel(props.startAt, 'hyper');` (+1). A link whose sector hadn't landed when the ship spawned goes there by the jump once it does. It usually has landed: `createScenePlaces` asks for the start's sector the moment the scene is made, seconds before a ship spawns.
  - **A crash into a generated body, or a station, comes back off it, not the home sun.** Lane 2's Task 17 fixed this (`18952195`): the way back reads `SOLIDS.find(…) ?? solidsNow.find(…) ?? { at: SUN.at, … }` (`:4114` on `eu/lane-2`). A station is in `solidsNow` through `moving`, so this task changes nothing there. Its scene test crashes into a station by its id (below).
  - **The way-to-go marker** (`placeHud`, `:3017-3040`). Today `at` is found only for a hand-made place, a pilot, the front and `wonderById`, so for a generated goal the diamond hides. On a long trip to a generated place, out of tag range, nothing would show where you're going.
    - After `const war = …`: `const gm = !mate && !place && !war ? places.mark(goal.id, state.auto?.place?.dest) : null;` (+1)
    - `wd` is looked up only when there's no `gm` (`place || war || mate || gm ? null : wonderById(goal.id)`).
    - `at`, `reach` and the name take `gm.at`, `gm.reach` and `gm.name` before the wonder's (0, in place).
  - **`where()`** (`:6277`) gains `place: places.here()?.id ?? null, docked: places.docked(), t: state.spaceT,` (+1).
  - **The handle** gains `place: (id) => places.find(id),`, `fetchPlace: (id) => places.fetch(id),` and `nearby: (max) => places.nearby(max),`, one line each (+3).
  - **The dev hooks.** `__universe()` (`:5923`) gains `place: places.here()?.id ?? null, docked: places.docked(),` (+1). `__universeDebug.places` becomes `places.debug` (0).

  That is +10 here: +12, less the resolve and park imports. With Task 11's −1 and Task 13's +2, Tasks 11 to 13 add 11 lines of the 40 allowed, against the ~130 Task 10 moved out.

**Interfaces:**
- Consumes: Tasks 3, 4, 5, 8 and 9 (and Task 9's `tags` in lane 2's `universeBudget`); lane 2's `farRoom` from its face (`expanse/shared/space.js`, Task 17); lane 2's PR 2.5: `expanse.sectors()` (a `Map`, Task 20), its `'expanse'` worker pool (Task 22 passes it) and `sectorJob` message (`{ type: 'sector', key, universe, sx, sy, sz }` → `{ key, sector }`), and `withMoons`, both lent on `expanse/shared/gen.js` (Task 19); Task 0's `parseSpaceId` (for an id's sector `key`).
- Produces:
  - **`createStationLook(group, { prepare }) → { update(rows), dispose() }`.**
    - It is two `InstancedMesh`es of at most 8 instances, from one merged procedural station, built from `src/components/universe/kit.js`'s `parts` (a hub, a ring on four spokes, a docking arm):
      - the hull, a `MeshStandardMaterial` in `src/components/universe/palette.js`'s `PALETTE.bone` and `PALETTE.grey`
      - its lights, `kit.js`'s `glowMat` with `hot(PALETTE.sun.hex, 2.2)`, where `hot` is from `src/lib/three/canvasTexture.js`
    - `visible = false` at 0 instances, so it costs no draw call.
    - `prepare` is called once for each mesh, when it's made.
    - Each row's matrix is at `row.at`, scaled by `row.size × row.grow`.
  - **`createScenePlaces({ group, universe, expanse, workers, startAt, toScreen, prepare, emit, note, device, clock = () => performance.now() / 1000 }) → { … }`**, with these methods. `clock` is the wall clock, passed in so the tests can drive it. `device` is `{ tier, detail }`, read as `budget = universeBudget(device, 0)`.
    - **One frame** (Global Constraints). Every position `scenePlaces` holds or is given is in `group`'s frame (the map's): `ship`, rows, parks, stations, solids, and what it hands `toScreen`. The camera is the one thing from another frame. Each update finds the map-frame camera as `cam = group.worldToLocal(v.copy(camera.position))`, after `group.updateWorldMatrix(true, false)`, with `v` one kept `Vector3`. That is the scene's own `camLocal` (`scene.js:5331`). What's near, the stations' grow and `aimStars` all measure from `cam`, never from `camera.position`, which is in the scene's frame and off by the map's turn.
    - **`setStep(step, floor)`:** `budget = universeBudget(device, step, floor)`, from `paceTo`.
    - **`update({ ship, camera, t, flying, nose, going, arrived, held })`**, every frame:
      - **What's near.** It refreshes `placesAround(sectors, cam, t, { ...AROUND, max: room })` every 0.25 s of `clock`, or when `cam` has moved over 500. `room` is `farRoom(device).discs`, from lane 2's face (`expanse/shared/space.js`, its Task 17): the far layer's own room, which the scene makes it with, so no set of discs lane 2 draws outnumbers the list, at any step. `sectors` is lane 2's loaded ones and the fetched ones, each keyed by its own `id` (the generator's sector key, `E:1,0`), whatever keys `expanse.sectors()`'s `Map` uses: lane 2's chunk grid names its cells `cx,cy,cz`. Whatever lane 2 draws as a disc has a row (Task 8).
      - **Stations.** It draws the stations of systems whose `span` holds `cam`, with `grow = smoothstep(span, 0.85 · span, |cam − star|)`.
      - **Where you're at.** It tracks `here` with `orbitingPlace(ship, here, rows, prefer)`. `prefer` is the latest `arrived` object's id, from the update it first appears in until `here` is that place or the ship has left its zone.
      - **Docking.** It tracks `docked` with `dockState`.
      - **The carry's frames.** `carryFrames(frames, frameOf(rows, { here, going }), dt)`, where `dt` is `t` less the last update's, on the space clock. Held, nothing moves and nothing fades.
      - **Events.** It emits `{ type: 'place', what, id, name, open?, dest? }` for each change:
        - `'arrive'`, only when `going` is null or this id
        - `'leave'`
        - `'dock'`, with `open: true` when an `arrived` object names this station and the ship hasn't left the station's zone since it appeared. Once used, it doesn't open again.
        - `'undock'`
        - `'found'`, with `dest` (a Destination, or null for nothing there), for the start place and for each `find` that had to wait. It goes out when the answer lands, not on an update. A `fetch` answers its own caller and emits nothing.
      - Leaving a station inside its system's zone, which every station in `E:1,0` is, emits `'leave'` for the station then `'arrive'` for the system. The card goes back to the system's.
      - On dock it calls `note(PLACE.docked(name))`.
    - **`around() → Row[]`**
    - **`carry(ship, t0, t1) → ship`**: Task 5's `carry` over the current frames.
    - **`solids() → [{ id, at, r: size, reach: size * 1.5 }]`**, the drawn stations (`grow > 0`)
    - **`here() → { id, place } | null`**
    - **`docked() → id | null`**
    - **`resolve(id) → Destination | null`:** `resolvePlace` with this scene's `universe`, the last `t`, the loaded and fetched sectors, and `build: false`. It never makes a sector.
    - **At hand.** An id's sector is at hand when its key (`parseSpaceId(id).key`) is among the loaded sectors or the fetched ones. `fetch`, `find` and `missing` turn on that, not on whether `resolve` found the place. When the sector is at hand, `resolve`'s answer is final: a place it doesn't find (`E:1,0:0:99` with `E:1,0` loaded) isn't there, and nothing will bring it.
    - **`fetch(id) → Promise<Destination | null>`:**
      - With its sector at hand, it resolves at once to `resolve(id)`, a Destination or null, and makes no request and adds nothing to the fetched sectors.
      - Else it asks the pool for the sector: `workers.request('expanse', { type: 'sector', key: 'place|' + sectorKey, universe, sx, sy, sz })`. It puts the answer through `withMoons`, keeps it among the fetched sectors (the last 4), and resolves.
      - Its own key never settles the expanse's ask for the same sector.
      - Null for a malformed id, a sector whose answer is null, a request that rejects or is cancelled, or no `workers` (Node). It never rejects.
      - Asking twice for one sector shares one request.
    - **`find(id) → Destination | null`:** `resolve(id)`. On a miss for a well-formed id whose sector isn't at hand, it starts a `fetch`, whose landing emits `'found'`. A miss in a sector at hand is null, with no fetch and no event.
    - **`missing(id) → boolean`:** a well-formed place id whose sector isn't at hand yet. An id its sector at hand doesn't hold is not missing: it's nothing. So the start never jumps to it, and `trips.travel` gives false for it at once (Task 11's `missing` dep).
    - **`park(id, from) → Park | null`:** `parkPlace(resolve(id), from, t)`, or null.
    - **`look`:** `{ place: (id) => resolve(id) }`, the lookup `nav.js` takes.
    - **`mark(id, dest = null) → { at, reach, name } | null`:** for the way-to-go marker. It uses `dest` (the trip's own) when its id is `id`, else `resolve(id)`. `at` is `atTime(·, t)`. Null for a non-place id.
    - **`name(id) → string | null`**, from `destinationById(id, look)`
    - **`nearby(max = 60) → Destination[]`**, `around()`'s first `max` resolved
    - **`aimTargets(sector, at) → [{ id, at, reach }]`**, for `aimFrom`: `aim.js`'s `aimTargets(sector, at)` (the hand-made ones), then, when `sector` is `'main'`, the generated stars, `aimStars(sectors, cam, { max: 2000 })`.
      - The stars are refreshed once a second of `clock`, in `update`.
      - The merged array is kept, and made again only when the stars have been refreshed or `sector` or `at` differs from the last call. Otherwise the call gives back the same array.
    - **`debug`:** `{ resolve, parkAt(id, from, t0, t), stations() }`. `stations()` is the loaded sectors' stations, nearest first, 20 at most.
    - **`dispose()`:** cancels the fetches in flight.

- [ ] **Step 1: Write the failing tests.** `stationLook.test.js` (Node, three):
  - `update([])` leaves both meshes invisible with `count` 0.
  - `update` with three rows makes them visible with `count` 3. Instance 1's matrix position equals row 1's `at`, and its scale is `size × grow`.
  - Nine rows draw eight.
  - `prepare` was called exactly twice, at creation.
  - `dispose` empties the group.

  `scenePlaces.test.js` has three helpers:
  - **`make({ sectors, universe, workers, startAt, turn = 0, device = { tier: 'mid' } } = {})`** builds `createScenePlaces` over a fake expanse whose loaded sectors are made once, in its own universe, as lane 2's expanse makes them in the scene's: `const own = sectors ?? new Map([['1,0,0', universe ? fullSector(universe, 1, 0, 0) : s]])` and `sectors: () => own`. The default is keyed as lane 2's chunk grid names a cell, not by the sector's id, so every test shows `scenePlaces` finds a sector by its own `id`. It passes:
    - `universe` through (the shared one when it's left out)
    - a `THREE.Group` turned by `turn` radians about y, as `map.rotation.y = state.yaw` turns the map
    - a `toScreen` that, as `scene.js`'s does (`:1526`), takes a map-frame point through `group.localToWorld`, then projects through the latest `tick`'s camera
    - `prepare` as a no-op, `emit` and `note` recorders, and `device`
    - a `clock` that rises by 1 each call, so every update refreshes what's near

    It returns `{ p, events, notes, group, tick }`. `tick(ship, more = {})` is `p.update({ ship, camera: fakeCamera(ship, group), t: 0, flying: true, nose: [0, 0, -1], going: null, arrived: null, held: false, ...more })`.
  - `fakePool()` is `{ request: vi.fn(async (name, m) => sectorJob(m).answer), cancel: vi.fn() }`. It runs lane 2's own job in process, so the answer comes without moons, as from the worker, on a later microtask.
  - **`fakeCamera(ship, group = null)`** is a `PerspectiveCamera(34, 16 / 9, 0.1, 45000)` in the scene's frame, as the scene's camera is. It sits at `group.localToWorld` of the ship's point and looks at `group.localToWorld` of a point 10 ahead along its heading, then `updateMatrixWorld()`. With no group, it sits at the ship.

  The file imports `vi` from Vitest, `THREE`, `PLACE`, `ship.js`'s `OPEN_SPACE`, `PARK_GAP`, `SOLIDS`, `headingTo`, `spawn` and `step`, `aim.js`'s `aimTargets`, `nav.js`'s `destinationById`, `expanse/shared/gen.js`'s `UNIVERSE`, `fullSector`, `moonAt`, `sectorJob` and `universeOf`, and Tasks 3, 4 and 8's `resolvePlace`, `parkPlace`, `followPark` and `hereZone`. It sets `s = fullSector(UNIVERSE, 1, 0, 0)` and the `len` and `xyz` helpers of Task 8. The tests:

```js
const st = s.stations[0];
const dest = resolvePlace(st.id, { t: 0 });
const park = parkPlace(dest, [st.at[0] + 2000, st.at[2]], 0);
const flush = () => new Promise((r) => setTimeout(r, 0));

it('arrives and docks at a station parked still beside it, and says so', () => {
  const { p, events, notes, tick } = make();
  tick({ ...park, speed: 0 });
  expect(events).toEqual([{ type: 'place', what: 'arrive', id: st.id, name: st.name }, { type: 'place', what: 'dock', id: st.id, name: st.name, open: false }]);
  expect(notes).toEqual([PLACE.docked(st.name)]);
  expect([p.here()?.id, p.docked()]).toEqual([st.id, st.id]);
});
it('opens the hangar only for the trip that ended there, once', () => {
  const { events, tick } = make();
  const arrived = { id: st.id };
  tick({ ...park, speed: 0 }, { arrived });
  expect(events.find((e) => e.what === 'dock').open).toBe(true);
  tick({ ...park, x: park.x + 200, speed: 0 }, { arrived });
  tick({ ...park, speed: 0 }, { arrived });
  expect(events.filter((e) => e.what === 'dock').map((e) => e.open)).toEqual([true, false]);
});
it('undocks and leaves as it flies off, back at the system, and arrives nowhere it is only passing', () => {
  const { p, events, tick } = make();
  tick({ ...park, speed: 0 });
  const off = { ...park, x: park.x + 100, speed: 20 };
  tick(off);
  const sysRow = p.around().find((r) => r.id === st.system);
  const back = Math.hypot(off.x - sysRow.at[0], off.y - sysRow.at[1], off.z - sysRow.at[2]) < hereZone(sysRow).in;
  expect(events.slice(2).map((e) => [e.what, e.id])).toEqual([['undock', st.id], ['leave', st.id], ...(back ? [['arrive', st.system]] : [])]);
  const q = make();
  q.tick({ ...park, speed: 0 }, { going: 'E:1,0:5' });
  expect(q.events.some((e) => e.what === 'arrive')).toBe(false);
});
it('makes a drawn station solid, so flying into it is a crash with its id', () => {
  const { p, tick } = make();
  tick({ ...park, speed: 0 });
  expect(p.solids()).toContainEqual({ id: st.id, at: st.at, r: st.size, reach: st.size * 1.5 });
  let ship = { ...spawn(null), x: st.at[0] + 60, y: st.at[1], z: st.at[2], heading: headingTo(-1, 0), speed: 40 };
  const hit = [];
  for (let i = 0; i < 300 && !hit.some((e) => e.type === 'crash'); i++) {
    // (boosting: on throttle alone, out in the open, it brakes to cruise long before it gets there)
    const r = step(ship, { throttle: 1, boost: true }, 1 / 30, [...SOLIDS, ...p.solids()], OPEN_SPACE);
    hit.push(...r.events);
    ship = r.ship;
  }
  expect(hit.find((e) => e.type === 'crash')?.id).toBe(st.id);
});
it('keeps a ship parked at a planet where it parked as a moon goes by, for ten minutes', () => {
  // (the first planet of E:1,0 whose moon comes within its own zone of the park in that time:
  // a carry by the nearest body dragged a quarter of such parks off within five minutes)
  let found = null;
  for (const q of s.systems.flatMap((x) => x.planets).filter((x) => x.moonList.length)) {
    const d = resolvePlace(q.id, { t: 0 });
    const k = parkPlace(d, [d.at[0] + 5000, d.at[2]], 0);
    const passes = (m) => { for (let t = 0; t < 600; t++) if (len(xyz(followPark(d, k, t)), moonAt(m, q, t)) < 1.9 * m.radius + PARK_GAP.near + PARK_GAP.in) return true; return false; };
    if (q.moonList.some(passes)) { found = { q, d, k }; break; }
  }
  expect(found).toBeTruthy();
  const { p } = make();
  const arrived = { id: found.q.id }; // (one trip's end, the same object every update, as the scene keeps it)
  let ship = { ...spawn(null), ...found.k, speed: 0 };
  p.update({ ship, camera: fakeCamera(ship), t: 0, flying: true, nose: [0, 0, -1], going: null, arrived, held: false });
  for (let t = 0; t < 600; t += 1) {
    ship = { ...p.carry(ship, t, t + 1), speed: 0 };
    p.update({ ship, camera: fakeCamera(ship), t: t + 1, flying: true, nose: [0, 0, -1], going: null, arrived, held: false });
    expect(p.here()?.id, `t ${t}`).toBe(found.q.id);
  }
  expect(len(xyz(ship), xyz(followPark(found.d, found.k, 600)))).toBeLessThan(1);
});
it('resolves from its loaded sectors, and never makes a sector itself', async () => {
  const doctored = { ...s, systems: s.systems.map((x, i) => (i === 0 ? { ...x, name: 'Testing' } : x)) };
  const { p } = make({ sectors: new Map([['E:1,0', doctored]]) });
  expect(p.resolve('e:1,0:0').name).toBe('Testing');
  expect(p.resolve('E:9,0:0')).toBeNull();
  expect(p.missing('E:9,0:0')).toBe(true);
  expect(p.missing('E:1,0:0')).toBe(false);
  expect(p.missing('E:1,0:0:99')).toBe(false); // (its sector is at hand: it's nothing, not on its way)
  expect(p.missing('marvel')).toBe(false);
});
it('answers at once, with no request, for a place its sectors hold or say isn’t there', async () => {
  const workers = fakePool();
  const { p, events } = make({ workers });
  expect(p.find('E:1,0:0:99')).toBeNull();
  expect(await p.fetch('E:1,0:0:99')).toBeNull();
  expect((await p.fetch('e:1,0:0'))?.id).toBe('E:1,0:0');
  await flush();
  expect(workers.request).not.toHaveBeenCalled();
  expect(events.filter((e) => e.what === 'found')).toEqual([]);
});
it('measures from the camera in the map’s own frame, turned as the map is after an arrival', () => {
  // (map.rotation.y = state.yaw, −heading after any arrival, spawn or pose: scene.js:1843, :2219;
  // the camera is in the scene's frame, the places in the map's)
  const turned = make({ turn: 1.2 });
  const flat = make();
  turned.tick({ ...park, speed: 0 }, { arrived: { id: st.id } });
  flat.tick({ ...park, speed: 0 }, { arrived: { id: st.id } });
  expect(turned.events.find((e) => e.what === 'dock')).toMatchObject({ id: st.id, open: true });
  expect([turned.p.here()?.id, turned.p.docked()]).toEqual([st.id, st.id]);
  expect(turned.events).toEqual(flat.events);
  expect(turned.p.around().map((r) => r.id)).toEqual(flat.p.around().map((r) => r.id));
  expect(turned.p.solids()).toEqual(flat.p.solids());
});
it('resolves in a pocket universe: its own loaded sector, and a fetch made in it', async () => {
  const marble = universeOf('marble');
  const workers = fakePool();
  const { p } = make({ universe: marble, workers });
  const mine = fullSector(marble, 1, 0, 0, { things: false });
  expect(p.resolve('E:1,0:0').name).toBe(mine.systems[0].name);
  expect(p.resolve('E:1,0:0').name).not.toBe(s.systems[0].name);
  const far = await p.fetch('E:9,0:0');
  expect(workers.request.mock.calls[0][1]).toMatchObject({ type: 'sector', key: 'place|E:9,0', universe: marble, sx: 9, sy: 0, sz: 0 });
  expect(far.name).toBe(fullSector(marble, 9, 0, 0, { things: false }).systems[0].name);
  expect(far.name).not.toBe(resolvePlace('E:9,0:0', { t: 0 }).name);
  expect(destinationById('E:9,0:0', p.look)?.name).toBe(far.name);
});
it('aims at the hand-made places and the generated stars from one array, kept until the stars refresh', () => {
  const { p, tick } = make();
  const ship = { ...park, speed: 0 };
  tick(ship);
  const a = p.aimTargets('main', null);
  expect(p.aimTargets('main', null)).toBe(a);
  expect(a.slice(0, aimTargets('main', null).length)).toEqual(aimTargets('main', null));
  expect(a.some((x) => x.id === st.system)).toBe(true);
  expect(p.aimTargets('rickmorty', null)).toEqual(aimTargets('rickmorty', null));
  tick(ship);
  expect(p.aimTargets('main', null)).not.toBe(a);
});
it('fetches a place outside its sectors from the worker pool, once a sector, and says when it’s found', async () => {
  const workers = fakePool();
  const { p, events } = make({ workers, startAt: 'E:9,0:0:0' });
  expect(p.find('E:9,0:1')).toBeNull();
  const [a, b] = await Promise.all([p.fetch('E:9,0:0'), p.fetch('E:9,0:2')]);
  expect([a.id, b.id]).toEqual(['E:9,0:0', 'E:9,0:2']);
  expect(workers.request).toHaveBeenCalledTimes(1);
  expect(workers.request.mock.calls[0][0]).toBe('expanse');
  expect(workers.request.mock.calls[0][1]).toMatchObject({ type: 'sector', key: 'place|E:9,0', universe: UNIVERSE, sx: 9, sy: 0, sz: 0 });
  expect(p.resolve('E:9,0:0:0')?.id).toBe('E:9,0:0:0');
  await flush();
  expect(events.filter((e) => e.what === 'found').map((e) => [e.id, e.dest?.id ?? null]).sort()).toEqual([['E:9,0:0:0', 'E:9,0:0:0'], ['E:9,0:1', 'E:9,0:1']]);
  expect(await make().p.fetch('E:9,0:0')).toBeNull(); // (no pool: Node)
  expect(await make({ workers }).p.fetch('E:9,0:9999')).toBeNull();
});
it('marks the way to a generated goal, from the trip’s own row or its own sectors', () => {
  const { p, tick } = make();
  tick({ ...park, speed: 0 });
  expect(p.mark(st.id)).toEqual({ at: st.at, reach: st.size * 1.5, name: st.name });
  const far = resolvePlace('E:9,0:0', { t: 0 });
  expect(p.mark('E:9,0:0', far)).toMatchObject({ at: far.at, name: far.name });
  expect(p.mark('E:9,0:0')).toBeNull();
  expect(p.mark('marvel')).toBeNull();
});
```

  The planet test is the only one over several hundred updates. Over one sector it stays under a second. The pocket test makes three sectors (about 150 ms here).

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places`. Expected: the two new files FAIL.
- [ ] **Step 3: Implement both, and wire `scene.js`.** Count its lines.
- [ ] **Step 4: Run them and see them pass.** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Add the endless check's `dock` step, and the planet leg to `travel`.**
  - The `dock` step:
    1. Take `__universeDebug.places.stations()[0]`.
    2. `travel(id, 'hyper')`.
    3. Wait until `__universe().docked === id`.
    4. Shoot it as an element JPEG, `dock.jpg`, into the evidence folder.
    5. Then `teleport` 400 out and wait until `docked` is null.

    The opening of the Hangar is Task 14's.
  - The `travel` step gains a third leg, to the planet `E:1,0:0:0` on super speed, now that the carry is wired. It moves at 0.645 units a second on the wall clock, which at software GL's frame or two a second is 13 to 26 units a second of the ship's own time (Review Focus 2): the carry is what lets the stop come.
    1. Wait until `places.resolve('E:1,0:0:0')` is non-null, and `teleport` to 1,500 units off where its `at` is now, on +x, level.
    2. Read `from` and `t0`, and `travel('E:1,0:0:0', 'super')`.
    3. Before it arrives, wait until `.universe-nav[data-on]` is shown and `.universe-nav-name` reads `places.resolve('E:1,0:0:0').name`: the way-to-go marker.
    4. Wait until `__universe().auto` is null, `__universe().place === 'E:1,0:0:0'`, and the ship is within 1 of `places.parkAt('E:1,0:0:0', from, t0, __universe().t)`.
    5. Wait 30 s of the wall clock by condition (until `__universe().t ≥ t1 + 30`, `t1` read at the arrival), with the stick let go, and check it's still within 1 of `parkAt` at that `t`: carried, not left behind.
- [ ] **Step 6: Run the checks at mid.**
  - Run `node scripts/universe-endless-check.mjs --quality mid --only travel,dock`. Expected: exit 0, no pops over 4 px (the stations grow in), no console errors.
  - Run `node scripts/universe-check.mjs --quality mid --poses expanse-system --out lab/universe/after-3/mid`. Expected:
    - Calls and triangles are at most `before-3`'s plus 2 when a station is in the built system (the station's hull and its lights), and equal when there is none. Say which in the commit. Task 15 re-records `expanse-system` into `lab/universe/endless/<tier>`, so later lanes measure against the number this lane leaves.
- [ ] **Step 7: Commit.** `git commit -m "Generated stations drawn and solid, a ship carried in orbit, and docking at the end of a trip"`. The body has the `scene.js` count and the pose's numbers.

### Task 13: Picking generated places, and their name tags

**Files:**
- Create: `src/components/universe/places/placeTags.js`, `src/components/universe/places/placeTags.test.js`
- Modify: `src/components/universe/places/scenePlaces.js` (`tags`, `pick`, `screen`), `scenePlaces.test.js`
- Modify: `src/components/universe/hud.css` (append the tag's look)
- Modify `scene.js` in place:
  - **Click.** In `onUp`'s flying branch (`:5764-5769`), after the hunter, before the wonder: `const gid = places.pick(x, y, { tanHalf, height: size.h }); if (gid) { navTo(gid); props.onPick?.(gid); } else { const wid = pickWonder(x, y); … }` (+2).
  - **Hover.** `onMove`'s cursor (`:5717`) counts `places.pick(x, y, …)` (0).
  - **The tags.**
    - `createScenePlaces` gets `tags: () => props.tags?.current ?? null`, `onPick: (id) => { navTo(id); props.onPick?.(id); }` and `frame: () => size` (0, on its line). All three are thunks: `props` is reassigned (`:6120`), `navTo` comes from `createTrips` (`:1769`) and `size` is a `const` at `:1173`, each below the call at `:780`. `size` is the scene's `{ w, h }` in CSS pixels, set in place on every resize (`:6050-6054`, `:6095-6096`), so the tags never read layout for it.
    - The update gains `aim: state.aim, picked: state.sel` (0, on its line).

**Interfaces:**
- Consumes: Task 9's `pickPlace` and `tagsFor`, and its `tags` field through Task 12's `budget`; lane 6a's `chart/declutter.js` `declutter(labels, { bounds }) → Map<id, side | null>` and `boxOf(side, label) → { x0, y0, x1, y1 }`; `nav.js`'s `shortDistance`. `placeTags` passes `bounds` alone. `declutter`'s `bounds` is a box `{ x0, y0, x1, y1 }` (or a circle `{ cx, cy, r }`), never a `DOMRect`, whose `left`, `top`, `right` and `bottom` it doesn't read. Lane 6a's code (`e59d3d04`) also takes `sides`, `dots` and `hard`, and its plan lists `sides` and `dots`: `placeTags` uses none of them.
- Produces:
  - **`createPlaceTags(box, { onPick, doc = box.ownerDocument }) → { show(list, frame), dispose() }`.**
    - `list` is `[{ id, name, dist, x, y, priority }]`, in screen pixels. `frame` is `{ w, h }`, the scene's `size`.
    - It keeps a pool of `span.universe-place-tag`, made with `doc.createElement`. Each holds a `b` with the name and a `small` with `shortDistance(dist)`, both set as `textContent`.
    - A tag's size is worked out, not measured, so no frame reads layout. It is `w = 18 + 7.5 × max(name.length, distance text length)` and `h = 34`, in the mono face at 12 px.
    - **Placement.** The labels go to `declutter(labels, { bounds: { x0: 0, y0: 0, x1: frame.w, y1: frame.h } })`. A tag `declutter` gives a side is moved by `transform` to `boxOf(side, label)`'s corner and shown with `data-on`. A tag given `null` loses `data-on`.
    - Each tag is written only when what it shows changes, as `pilots.js`'s tags are.
    - A click calls `onPick(id)`.
    - `show([])` hides them all. `dispose()` removes them from `box`.
  - **`scenePlaces.update`** also shows the tags, projected by `toScreen`, in the frame `frame()`:
    - `tagsFor(around(), { ship, nose, focus: [going, aim, picked], here: here()?.id, max: budget.tags, cone: NAME_CONE })`, so the cap is the tier table's and comes down with the quality steps (`setStep`)
    - It shows none (`show([])`) while held or not `flying`. The update runs every frame from `render()` (Task 12), so the tags go on foot, in a dive and frozen too.
  - **`scenePlaces.pick(px, py, { tanHalf, height }) → id | null`:** `pickPlace` over `around()`, when flying. Since `around()` lists whatever lane 2 draws as a disc (Task 8), a rock or derelict thousands of units off is picked where it shows, not only once you're on top of it.
  - **`scenePlaces.screen(id) → { x, y } | null`**, dev: `toScreen` of its row, for the check. `places.debug` gains it.
  - **`.universe-place-tag`** is `.universe-tag`'s look (pill, mono, never under 12 px, `pointer-events: auto`) in `#9fd8ff`.

- [ ] **Step 1: Write the failing tests.**
  - **`placeTags.test.js`**, with a fake document: `createElement` gives plain objects with `style`, `textContent`, `children`, `appendChild`, `remove`, `toggleAttribute`, `hasAttribute` and `addEventListener` (which keeps the listener). The box has `appendChild` and no `getBoundingClientRect` at all, so a layout read would throw. Every `show` passes `frame = { w: 1280, h: 720 }`.
    - `show` of two far-apart tags makes two elements, both with `data-on`, each `transform` at its `boxOf` corner, each name in its `b`.
    - The bounds are the frame's. A tag named `Ostra`, its distance's text no longer (so `w = 55.5`), at `(1250, 360)` takes the left side, since its right box would end at 1297.5, past `x1 = 1280`. One at `(640, 715)` fits no side inside the frame (each box ends below `y1 = 720`) and loses `data-on`.
    - `show` of the same list again sets no `textContent` or `transform` (count the writes with a setter spy).
    - Two tags on one point: the higher `priority` is on and the other loses `data-on`.
    - `show([])` turns every tag off but keeps the pool. A later `show` of three reuses the two and makes one.
    - The kept click listener calls `onPick` with that tag's id.
    - `dispose()` removes each from the box.
  - **In `scenePlaces.test.js`:**
    - With the fake camera's `toScreen` putting the station's star at (640, 360), `p.pick(642, 361, { tanHalf: 1, height: 720 })` is the system's id after an `update` inside it. With `flying: false` it is null.
    - A fake `tags` box records `show` calls. After an update facing the station, the list's first entry is the station.
    - With `held: true`, and again with `flying: false`, the list is empty.
    - `p.screen(st.id)` is the station's projected point, and null for an id not around.
    - **A thing far off is picked where it shows.** The file also imports the face's `thingRow`. With `make({ turn: 1.2 })` and `row = thingRow(s, 40)`, tick a still ship at `row.at` plus 5,000 on x, heading `headingTo(-1, 0)` (facing it). Then `const pt = p.screen(row.id)` is non-null, and `p.pick(pt.x, pt.y, { tanHalf: Math.tan((17 * Math.PI) / 180), height: 720 })` is `row.id`.
    - **The tags' cap is the tier table's.** Over a field of things in view, the `show` list holds at most 3 entries with `make({ device: { tier: 'low' } })` and at most 6 with mid. After `p.setStep(2, false)` on mid, it holds at most 3 (`universeBudget({ tier: 'mid' }, 2).tags`).
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/placeTags.test.js src/components/universe/places/scenePlaces.test.js`. Expected: `placeTags` FAILS (module not found), and the new `scenePlaces` tests FAIL.
- [ ] **Step 3: Implement** `placeTags.js` and the `scenePlaces` additions, append the CSS, and wire `scene.js`. Count its lines.
- [ ] **Step 4: Run them and see them pass.** Same command, then `npm test`. Expected: PASS.
- [ ] **Step 5: Check it in the browser: the endless check's `pick` step.**
  1. `teleport` inside `E:1,0:0`'s reach, facing its star.
  2. Wait until `.universe-place-tag[data-on]` shows the system's name.
  3. Read the star's screen point with `__universeDebug.places.screen(id)` and click it.
  4. Wait until `(__universe().auto ?? __universe().jump?.id) === id`. A click goes by `navTo`, so by the page's drive, and a fresh profile's is the jump (`parseDrive`'s default, `nav.js:59`; `Universe.jsx:130`). With it charged, the click sets `state.jump`, not `state.auto`.
  5. Shoot `pick.jpg`.

  Landing on foot needs a hand-made world, where no generated place is in view, so the tags going off the flight are pinned by the unit tests (`flying: false`, `held: true`) and by the update running from `render()`.

  Run `node scripts/universe-endless-check.mjs --quality mid --only pick`. Expected: exit 0, no console errors.
- [ ] **Step 6: Commit.** `git commit -m "Click a generated place to fly there; the places on your nose are named"`. The body says `scene.js`'s count.

### Task 14: The page: links, the card, the terminal, and docking opens the Hangar

**Files:**
- Create: `src/components/universe/places/PlaceCard.jsx`, `src/components/universe/places/PlaceCard.test.jsx`, `src/components/universe/places/pageCard.js`, `src/components/universe/places/pageCard.test.js`
- Modify: `src/components/universe/UniversePanel.jsx`:
  - `:144` gains a `docked = null` prop
  - `:181-212`, the wonder branch: for `wonder.generated`, `<PlaceCard>` stands in place of the eyebrow, title, about and fly button; the links row, `CopyButton` and `Exits` stay
- Modify `src/components/universe/UniverseMap.jsx`:
  - `:48`, the props, gain `onLive = null`
  - beside the handle's effect, a new effect on `[on, meant]` calls `onLive?.(meant ? (on ? 'live' : 'loading') : 'flat')`. `on` and `meant` are `useWorld`'s (`:100`); `meant` is false when 3D is off, fails, is too slow or is lost (`useWorld.js:227`), which is when the flat map takes the box (`:501`). After lane 6a that is its `FlatMap`, handed `startAt`, which presses the mark of a link's wonder; a generated id has no mark there, so it presses nothing and the card is the panel's.
  - `:236-246`, the handle, gains:
    - `place: (id) => view.current?.place?.(id) ?? null`
    - `fetchPlace: (id) => view.current?.fetchPlace?.(id) ?? Promise.resolve(null)`
    - `nearby: (max) => view.current?.nearby?.(max) ?? []`
- Modify: `src/pages/Universe.jsx`:
  - `:100`: the `map` ref's stand-in gains `place: () => null, fetchPlace: async () => null, nearby: () => []`
  - `:97-98`: `wonder` and `wonderDest`, and the link's `place`
  - `:360`: `onEvent`'s head, for the `'place'` events
  - `:449-466`: `travel`
  - `:518-542`: `<UniverseMap>` gains `onLive={setMapState}`, and `startAt`
  - `:583`: `wonder=`
  - new `found`, `docked` and `mapState` states
- Modify: `src/pages/Terminal.jsx:466` (`fly`)
- Modify: `src/components/universe/universe.css` (`.universe-facts`), `src/lib/words.test.js:23` (`FILES` gains `...list('components/universe/places/', /\.jsx$/)`, after the `...list('components/universe/chart/', /\.jsx$/)` line lane 6a adds there)
- Modify: `src/components/universe/places/weight.test.js` (the page; and `Interests.jsx` joins `LOADS_NAV`, now that lane 6a's mini-map reaches `nav.js`)
- Modify: `scripts/universe-endless-check.mjs`: the `link`, `flat` and `terminal` steps; the `dock` step waits for the Hangar

**Interfaces:**
- Consumes: Task 3's `canonicalPlace` and `isPlaceId` (from `ids.js`, the page) and `resolvePlace` (from `resolve.js`, the terminal only); Task 7's `findDestination` and `destinationById` with a lookup; Task 12's `'place'` events and the handle's `place`/`fetchPlace`; lane 6a's `CHART_WORDS.sector`; `PLACE`; `PICK_A_SHIP`; Task 0's `parseSpaceId`.
- **Imports.** `Universe.jsx`, `UniversePanel.jsx`, `PlaceCard.jsx` and `pageCard.js` import nothing from `places/resolve.js` or `places/cards.js`. They load with `Front`, the site's root, so they take only `places/ids.js`, `lib/space/address.js`, `words.js` and the light face.
- Produces:
  - **`cardRow(place, found, map) → Destination | Row | null`**, in `pageCard.js`: the row the page's card shows for a link. `map` is `'live' | 'loading' | 'flat'`.
    - no `place`: null
    - `found?.id === place`: `found.dest`, which is null for nothing there
    - `map === 'flat'`: `{ id: place, generated: true, flat: true, cube }`. No scene runs to find it (3D off, failed or lost), so the wait ends here.
    - otherwise: `{ id: place, generated: true, pending: true, cube }`, while the scene loads or finds it
    - `cube` is `[sx, sy, sz]` from `parseSpaceId(place)`.
  - **`PlaceCard({ dest, docked = false, onFly = null, onHangar = null, leaving = false })`** renders:
    - an eyebrow `` `${dest.type} · ${CHART_WORDS.sector(dest.cube)}` `` in `dest.color`
    - `h2.universe-title` with the name
    - the about
    - `dl.universe-facts` (one `div > dt + dd` per fact; none when there are no facts)
    - one primary button:
      - `PLACE.hangar` (`onHangar`) when docked
      - else `PLACE.dock` for a station and `PLACE.fly` otherwise (`onFly(dest.id)`, disabled while leaving)
      - else, with no `onFly`, `PICK_A_SHIP`
    - **While it's being found**, for a pending row `{ id, generated: true, pending: true, cube }`, only the eyebrow's sector and the title `PLACE.plotting` (Task 2's), with no button.
    - **With no scene**, for a flat row `{ id, generated: true, flat: true, cube }`, the eyebrow's sector, the id as the title and `PLACE.flat` as the about, with no button.
  - **On the page.** The page never resolves an id: it doesn't import `resolvePlace` and never makes a sector.
    - **The link.** `const place = wonder ? null : canonicalPlace(param)`.
    - **Whether a scene runs.** `const [mapState, setMapState] = useState('loading')`, set by `<UniverseMap onLive={setMapState}>`. It's state, not `map.current.live` (a ref the map's effect writes, which no effect of the page's can depend on), so the page's effects run again when the map goes live, fails or is lost.
    - **The card.** `found` is `{ id, dest }` state, set from:
      - the scene's `{ type: 'place', what: 'found', id, dest }` (the start place, or a `find` that waited)
      - the page's own fetch, in an effect on `[place, mapState]` that runs only while `mapState === 'live'`: `map.current.fetchPlace(place).then((dest) => setFound({ id: place, dest }))`, dropped by the effect's cleanup if `place` or `mapState` changes first

      Then `const placeRow = cardRow(place, found, mapState)`. While `place` is set and not yet found, the panel shows the pending row. With the map flat, it shows the flat row at once, and never waits. When it's found to be nothing (`dest` null), it shows no card, as for any id the map doesn't know.
    - **The panel.** `wonder={wonderDest ?? placeRow}` and `docked={docked}`.
    - **The start.** `startAt={wonder ?? place}`.
    - **`travel(id, d)`:**
      - It selects a generated id (`isPlaceId(id)`: `select(id)`), so its card stays up while you fly, and without a ship too.
      - Its `destinationById` call passes `{ place: map.current.place }`.
    - **`onEvent`**, for `e.type === 'place'`, handled and not passed to the Comms:
      - `found` sets `found`
      - `arrive` selects the place
      - `leave` clears the selection when the URL is that place
      - `dock` sets `docked`, and with `open` does `setHangarTab('shipyard'); setYard(true)`
      - `undock` clears `docked`
  - **The terminal.** `fly` passes a lookup that builds: `findDestination(arg, { place: (id) => resolvePlace(id) })`. It's one sector made on the terminal's own page, once a command, before it navigates. A generated id that isn't there gets the usual `nowhere on the map` line.

- [ ] **Step 1: Write the failing tests.**
  - **`PlaceCard.test.jsx`** (`renderToStaticMarkup`):
    - **A planet's card** has its type and `Sector 1, 0, 0` in the eyebrow, its name in the title, every fact's `dt` and `dd`, and a button `Fly here`.
    - **A station's** button reads `Dock here`. With `docked` and `onHangar` it reads `Hangar and shop` instead.
    - **With no `onFly`**, `PICK_A_SHIP` shows and there's no button.
    - **A thing** has no `dl`.
    - **A pending row** for `E:1,0:0` shows `Sector 1, 0, 0` and `PLACE.plotting`, and no button.
    - **A flat row** for `E:1,0:0:0` shows `Sector 1, 0, 0`, `E:1,0:0:0` as the title and `PLACE.flat`, never `PLACE.plotting`, and no button.
  - **`pageCard.test.js`**:

    ```js
    import { describe, expect, it } from 'vitest';
    import { cardRow } from './pageCard';

    const id = 'E:1,0,2:0:0';
    const dest = { id, generated: true, name: 'Ostra' };
    describe('the card a link shows', () => {
      it('waits while a scene loads or looks, and ends the wait when there’s no scene', () => {
        expect(cardRow(null, null, 'live')).toBeNull();
        expect(cardRow(id, null, 'loading')).toEqual({ id, generated: true, pending: true, cube: [1, 2, 0] });
        expect(cardRow(id, null, 'live')).toEqual({ id, generated: true, pending: true, cube: [1, 2, 0] });
        expect(cardRow(id, null, 'flat')).toEqual({ id, generated: true, flat: true, cube: [1, 2, 0] });
        expect(cardRow(id, { id: 'E:5,5:0', dest: {} }, 'flat').flat).toBe(true);
      });
      it('shows what the scene found, or nothing for nothing there', () => {
        expect(cardRow(id, { id, dest }, 'live')).toBe(dest);
        expect(cardRow(id, { id, dest: null }, 'live')).toBeNull();
        expect(cardRow(id, { id, dest }, 'flat')).toBe(dest);
      });
    });
    ```
  - **`weight.test.js`** gains: `src/pages/Universe.jsx` reaches neither `places/resolve.js` nor `places/cards.js` (it does reach `expanse/gen/space.js` today, through `online/rosterWhere.js`, finding 21, so this test names those two files, not `GENERATOR`). And `src/components/interests/Interests.jsx` joins `LOADS_NAV` (Task 7): with lane 6a merged it reaches `nav.js` through `MiniMap.jsx` and `chart/marks.js` (51 files on `eu/lane-6a` at `3cf60b7c`). If the merged mini-map doesn't, that line fails: leave `Interests.jsx` out of `LOADS_NAV`, keep its generator check, and say so in the commit.
  - **The words test** (`npx vitest run src/lib/words.test.js`) reads the new files and passes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/PlaceCard.test.jsx src/components/universe/places/pageCard.test.js`. Expected: FAIL (modules not found). `weight.test.js`'s new line passes already. Then record the bundle before: `npm run build` and Task 1's `chunks.mjs` line, written into the README as "before Task 14".
- [ ] **Step 3: Implement** `PlaceCard.jsx`, `pageCard.js` and the panel, map, page, terminal and CSS changes.
- [ ] **Step 4: Run them and see them pass.** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Check it in the browser.**
  - **The `link` step.**
    - Open `#/universe/E:1,0:0:0` fresh, with a ship.
    - Wait until `.universe-panel .universe-title` reads `PLACE.plotting` or the place's name. Then wait until it reads the name and `__universe().place === 'E:1,0:0:0'`.
    - Shoot `card.jpg`.
    - Open `#/universe/E:1,0:0:99` fresh, and wait until the panel shows no `.universe-title` reading `PLACE.plotting`: the card is gone, not stuck.
  - **The `flat` step.** With `tp-3d` set to `off` in local storage before the page loads (`lib/gpu.js:15`, written raw, as its `setMode3D` does at `:84-87`), open `#/universe/E:1,0:0:0` fresh. Wait until `.universe-flat` is shown and `.universe-panel .universe-title` reads `E:1,0:0:0`, with `PLACE.flat` in the panel. Then check over 20 polls, a second apart, that no `.universe-title` reads `PLACE.plotting`. Shoot `card-flat.jpg`. (Review Focus 1, and the index's Review Focus 5.)
  - **The `dock` step** also waits for `.hangar-panel .hangar-body[data-tab="shipyard"]`, then presses Escape. It waits for the panel to go, and checks that it doesn't come back over 20 frames, with `__universe().docked` still the station. Shoot `hangar.jpg`.
  - **The `terminal` step** opens `#/terminal` on its own page:
    - It turns on CDP's `Emulation.setCPUThrottlingRate({ rate: 4 })`, the low tier's stand-in, and a `PerformanceObserver` for `longtask`.
    - It types `fly E:9,0:0` and Enter, then waits for the `Setting course for` line.
    - It records the longest task. Write it into the README under "A sector made on the main thread".
    - It fails only over 1,500 ms. Between 500 and 1,500 ms, it's a finding in the hand-off notes for the terminal to resolve in a worker.
  - **The phone.** At 390 × 844, the card's button and facts are inside the panel, and the panel scrolls.

  Run `node scripts/universe-endless-check.mjs --quality mid --only link,flat,dock,terminal`. Expected: exit 0, no console errors.
- [ ] **Step 6: Record the bundle after.** Run `npm run build` and the same `chunks.mjs` line again, for "after Task 14". Expected:
  - `Front`, `CommandPalette` and `Interests` each grow by at most 2 kB gzipped over "before Task 14": the card, its words and the page's few lines, on `Front` alone. `CommandPalette` and `Interests` shouldn't move at all.
  - `Waystation` is still in neither `CommandPalette`'s nor `Interests`' closure.
  - `Terminal` grows by the resolver and the generator, which now ride there for `fly` (about 12 kB gzipped, finding 17). Its number goes into the README with no ceiling: it's the terminal's own page.
  - The lane's whole growth for each, from Task 1's "before", goes into the README too.
- [ ] **Step 7: Commit.** `git commit -m "A generated place's card at its own address, found off the main thread, and docking at a station opens the hangar and shop"`

### Task 15: The station pose, the full measure, and the hand-off notes

**Files:**
- Modify: `src/components/universe/poses.js` (`'expanse-station'`), `src/components/universe/poses.test.js`, `scripts/universe-check.mjs:31` (the name added)
- Create: `docs/superpowers/evidence/endless-universe-lane-3/HANDOFF-NOTES.md`
- Modify: `docs/superpowers/evidence/endless-universe-lane-3/README.md`

**Interfaces:**
- Produces:
  - **`poseFor('expanse-station')`** is parked at the first station of `E:1,0`:
    - `stationsOf(fullSector(UNIVERSE, 1, 0, 0, { things: false }))[0]`
    - parked by `parkPlace(resolvePlace(id, { t: 0 }), [at[0], at[2] + 1000], 0)`
    - `{ name, at, heading, ...chase(at, heading, { back: 1.6, rise: 0.3, look: station.at }) }`
    - **Built only when asked.** The sector is made inside `poseFor`'s `'expanse-station'` branch, the first time that pose is asked for, and kept in a module-level `let` after. Nothing at `poses.js`'s top level calls `fullSector`, `stationsOf` or `resolvePlace`. `scene.js` imports `poses.js` (`:216`), so a sector made at import would cost every scene load 40 to 100 ms on the main thread, against "the scene never builds a sector". Only the dev hook `__universe().pose(name)` and the checks ask for it. `POSES['expanse-station']` is a plain marker row, `{ generated: 'station', back: 1.6, rise: 0.3 }`, so `POSE_NAMES` lists it without building anything.
  - The hand-off notes.

- [ ] **Step 1: Write the failing test.** `poseFor('expanse-station').at` is within `1.5 × size + 4 + 1e-6` of that station's `at`, and its `heading` faces it, the dot of `forward(heading)` with the way to it over 0.99. A second call gives an equal pose, and `POSES['expanse-station']` holds no sector, station or array of rows.
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/poses.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, and add the name to `universe-check.mjs`'s `POSES`. If lane 2's `expanse-system` pose builds its sector at `poses.js`'s top level, move it inside `poseFor` the same way and say so in the commit.
- [ ] **Step 4: Run it and see it pass.** Same command. Expected: PASS.
- [ ] **Step 5: The full measure, once.** Run these in the background, each with `CHROMIUM=/opt/pw-browsers/chromium` in front, and wait on their exits:
  - `node scripts/universe-check.mjs --quality high --out lab/universe/after-3/high`, then the same for `mid` and `low`: every pose at every tier, about three hours here in all. Run them as three, because `universe-check.mjs` ignores `--out` when more than one tier runs (`:53`, `args.out && tiers.length === 1`), and `--quality all` would write over `lab/universe/<tier>`.
  - `QUALITY=mid node scripts/perf-probe.mjs universe` and `QUALITY=low …`, against Task 10's branch point

  Expected:
  - **Draw calls and triangles:** at every pose in `lab/universe/baseline/<tier>.json`, no higher. Generated stations are drawn only inside a generated system's reach, and the keep-outs keep every reach away from the hand-made poses, so the fourteen hand-made poses are equal.
  - **Frame time:** p50 no worse than 2%.
  - **The endless baselines, re-recorded.** Run `--quality <tier> --poses old-rim,above-core,expanse-system,expanse-station --out lab/universe/endless/<tier>`, once a tier.
    - `universe-check` writes one `<out>.json` a run, holding only the poses that run measured (`:237`, `:246`). A run of `expanse-station` alone would write over lane 2's `old-rim`, `above-core` and `expanse-system` numbers, so all four go in one run.
    - `expanse-station` is new and becomes its own baseline.
    - `expanse-system` is re-recorded, because Task 12 let it rise by up to 2 calls when a station is in the built system. Lanes 4a and 4b then compare against what lane 3 left, not a number lane 3 has already raised.
    - `old-rim` and `above-core` should be equal to lane 2's. Any change there is a finding.
    - The commit body and `HANDOFF-NOTES.md` (for the coordinator's pull request) say whether `expanse-system` rose, by how much, and that it is on purpose: the station's hull and its lights, two `InstancedMesh`es (Task 12's `stationLook`).
  - **Pixels:** `scripts/pixel-measure.mjs` against `before-3/mid` gives identical shots at the hand-made poses at mid.
- [ ] **Step 6: The endless check, whole.** Run `node scripts/universe-endless-check.mjs --quality mid` and then `--quality low`, all of lane 2's steps and this lane's. Expected: exit 0 both times, and the per-step table printed and copied into the README.
- [ ] **Step 7: The repo's checks.** Expected: each as on the branch before Task 1.
  1. **Start the dev server** the first four need (Global Constraints, "The dev server"):
     - Start `npx vite --port 5173 --strictPort` in the background.
     - Wait until `curl --noproxy '*' -sf -o /dev/null http://localhost:5173/` succeeds, in an until-loop on that condition, giving up after 60 s.
  2. **Run the checks:**
     - `CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs`
     - `CHROME=/opt/pw-browsers/chromium node scripts/sector-check.mjs`
     - `CHROME=/opt/pw-browsers/chromium node scripts/flyto-check.mjs --fake`
     - `CHROME=/opt/pw-browsers/chromium node scripts/links-check.mjs`
     - `CHROMIUM=/opt/pw-browsers/chromium node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`, which runs its own preview server
  3. **Stop the dev server.**

  The first four load `?quality=low` themselves and draw no pose. The smoke check runs at its default here, as the lane's gate.
- [ ] **Step 8: Write the README and the hand-off notes.**
  - **The README** holds:
    - before and after, side by side
    - the table of calls and triangles per pose and tier
    - frame times
    - the bundle numbers: `Front`, `CommandPalette`, `Interests` and `Terminal`, at Task 1's before, Task 1's after, Tasks 7 and 14 before and after, and the lane's whole growth
    - `scene.js`'s line count at each task
    - `boundary-breaks` and `cycles`, before and after
  - **`HANDOFF-NOTES.md`, "Landed":** every module above by path, with its interface in one line each, and the six new endless steps (`travel`, `dock`, `pick`, `link`, `flat` and `terminal`) and the pose. Also the re-recorded `lab/universe/endless/<tier>.json`, with `expanse-system`'s change and why (Step 5), and `BUDGET`'s new `tags` field.
  - **`HANDOFF-NOTES.md`, "Left":**
    - Lane 6b lists generated places on the chart and in search, from `handle.nearby()`, `where().t` and `findDestinations`' `more`, passing `{ place: handle.place }` to `nav.js`. A visited place outside the loaded sectors comes from `handle.fetchPlace(id)`, one worker build of about 45 ms a sector, so N visited ids in N sectors cost N builds. Resolve the ones in view, not the whole list.
    - The terminal's longest task at 4× throttling, and whether it's a finding (Task 14).
    - Lane 4a draws its kinds' cards (`THING_CARDS`) and counts the station as catalogue kind 11. It may restyle `stationLook.js`.
    - Lane 4b's trader event hails from a station's dock (the `'place'` `dock` event).
    - Lane 5b lands from `where().place` (a planet with `land: true`) and returns to `/universe/E:…`, which now starts parked at the place with its card up.
    - **Lane 6b, the "Star systems" filter.** Generated systems are `kind: 'star'`, and `KINDS`' "Star systems" is `'system'` (`nav.js:188`), the galaxy's gate systems. `findDestinations('system', …)` takes both now (Task 7). But `NavMap.jsx:317` groups a list by `d.kind === g.id`, so a generated system falls in no group, and `NavMap.jsx:243` and lane 6a's `chart/marks.js` leave `kind === 'system'` off the chart as a gate. When 6b wires search, it folds `'star'` into the "Star systems" group (or adds a `KINDS` row for it), and keeps generated systems on the chart.
    - **Anyone importing from `places/`**: from a module that loads with a page (`nav.js` and what it reaches, the page, the panel), take ids and `atTime` from `places/ids.js` and the orbits from `expanse/shared/orbits.js`, never from `places/resolve.js`, `expanse/shared/gen.js` or lane 2's `expanse/shared/space.js`. `weight.test.js` fails otherwise.
    - Any finding from the bundle steps (Tasks 1, 7 and 14).
- [ ] **Step 9: Run the gates and commit.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, within budget. Then `git add -A src/components/universe/poses.js src/components/universe/poses.test.js scripts/universe-check.mjs lab/universe/after-3 lab/universe/endless docs/superpowers/evidence/endless-universe-lane-3 && git commit -m "Lane 3 measured at every tier, a station pose, and its hand-off notes"`

---

## What later lanes consume

| Name | From | Used by |
|---|---|---|
| `canonicalPlace(id)`, `isPlaceId(id)`, `atTime(place, t)` (a planet's orbit, a moon's, else the row's own `move(row, t)`, else its `at`): no generator behind them, for anything that loads with a page | `universe/places/ids.js` | 4a, 4b, 5b, 6b |
| `resolvePlace(id, { universe, t, sectors, build })`, `lookupOf(opts)`, `Destination` (with `move` and `moving`): the generator behind them, for the scene and the terminal only | `universe/places/resolve.js` | 4a, 4b, 5b, 6b |
| `orbitAt`, `moonAt`, `spaceTime`, `extentOf` (the light face) | `expanse/shared/orbits.js` | 5b, 6b |
| `cardRow(place, found, map)` | `places/pageCard.js` | 5b, 6b |
| `onLive('live' \| 'loading' \| 'flat')` | `UniverseMap.jsx`'s prop | 5b, 6b (what to show with no scene) |
| `reach(entry)` and `GENERATOR` in a test that pins what a page loads | `places/weight.test.js` | every later lane that imports into `nav.js` or the page |
| `THING_CARDS` (a row per kind: `type`, `about`, `color`, `solid`, `far` (default 45,000), `move?(row, t)` for a kind that moves), `placeCard`, `PLACE` | `places/cards.js`, `words.js` | 4a (its kinds' cards, comets' `move`), 6b |
| `parkPlace(dest, from, t)`, `parkDistance`, `followPark`, `placeSpace`, `gapRadius`, `moonGap` | `places/park.js` | 4a ("Park" actions), 4b (events at a place), 5b (back in orbit) |
| `PARK_GAP`, `clearOf` | `ship.js` | 4a, 4b |
| `carry`, `carryFrames`, `carryZone`, `carryWeight`, `frameOf`, `CARRY` | `places/carry.js` | 5b (taking off into orbit: the planet is the frame) |
| `longTrip`, `TRIP` | `places/trip.js` | 6b |
| `destinationById(id, { place })`, `goalOf`, `canGo(id, { place })`, `legOf`, `parkFor(id, from, { place })`, `distanceTo(ship, id, { place })`, `tripTime(ship, id, drive, { place })`, `findDestinations(kind, q, { more, place })`, `findDestination(q, { place })` | `nav.js`. Generated places come only through the caller's `place` lookup. | 6b, 4c, 5b |
| `placesAround(sectors, cam, t, { far, inside, max })` (every disc lane 2 draws: every body of the systems you're in, then the nearest `max` (the far layer's room) of the rest within the far plane; `cam` in the map's frame), `orbitingPlace(ship, current, rows, prefer)`, `hereZone`, `aimStars`, `AROUND`, `Row` (with `park` and `move`) | `places/around.js` | 4b (zones), 6b (marks) |
| `pickPlace`, `tagsFor`, `dockState`, `DOCK` | `places/pick.js`, `dock.js` | 4a (its own picks), 4b |
| `tags` (3, 6, 6, 6, stepped with `discs`, never below 1) | lane 2's `BUDGET`, `universe/budget.js` | 6b (the chart's names, if it caps them by tier) |
| `createPlaceTags(box, { onPick, doc })` → `{ show(list, { w, h }), dispose() }` | `places/placeTags.js` | 6b, if the chart's names want the same pool |
| `STATION_BASE`, `stationsOf`, `extentOf`, `fullSector(…).stations`, `placeIn`, and lane 2's `withMoons` and `sectorJob`, on the generator's face (pure, no three.js) | `expanse/gen/stations.js`, `space.js`, via `expanse/shared/gen.js` | 4a, 4b (traffic between stations) |
| `places.look`, `places.resolve` (never builds), `places.fetch(id)` (one worker build a sector not at hand, about 45 ms; at once and with no request when the sector is at hand; never rejects), `places.find`, `places.missing` (the id's sector isn't at hand), `places.mark`, `places.aimTargets(sector, at)` (one kept array), `places.setStep(step, floor)`, `places.debug`. Every position in the map's frame; the camera brought in by `group.worldToLocal`. | `places/scenePlaces.js` | 4b, 5b, 6b |
| `travel(id)` on `E:` ids (scene handle and `__universeDebug`), `where().place`, `where().docked`, `where().t`, `handle.place(id)`, `handle.fetchPlace(id)`, `handle.nearby(max)` | `scene.js`, `UniverseMap.jsx` | 4b, 5b, 6b |
| `{ type: 'place', what: 'arrive' \| 'leave' \| 'dock' \| 'undock' \| 'found', id, name?, open?, dest? }` | `scenePlaces.js` (the scene's `emit`) | 4b (the trader), 5b, 6b |
| `/universe/<E: id>`: starts parked with its card, found off the main thread | `Universe.jsx` | 5b (take-off's return), 4c |
| `PlaceCard` (and its pending row) | `places/PlaceCard.jsx` | 6b, 4a |
| `createTrips(deps)` (with `props`, `front`, `powers`, `unique`, `heard`, `retarget`, `invalidate` and `settle` as thunks) with `resolve`, `fetch` and `missing`, `state.spaceT`, `state.arrived`, `state.pending`, `endTrip`, `outOfJump` | `trips.js` | 4b, 4c |
| the `travel`, `dock`, `pick`, `link`, `flat` and `terminal` steps, `--only` | `scripts/universe-endless-check.mjs` | every later lane |

**For lane 6b in particular.**
- Resolving costs a whole sector for each sector not at hand: about 45 ms warm and up to 130 ms cold in Node here, several times that on a phone.
- `handle.fetchPlace(id)` makes it in the worker, so N visited ids in N sectors cost N worker builds. Fetch the visited places in view, not the whole list.
- Never call `resolvePlace` with `build` on the page.

## Assumptions about wave 1's unmerged work

Checked on 2026-10-25 against `eu/lane-3` at `9d927892` (lane 2 through PR 2.4's Task 16), `eu/lane-2` at `18952195` (Task 17 in, PR 2.5 not begun) and `eu/lane-6a` at `3cf60b7c`. Each says whether it **holds**, was **wrong** (and what changed in this plan), or **waits** on lane 2's PR 2.5, with what to check when it lands.

1. **Waits (2.5's Tasks 19 and 20).** `createExpanse(…).sectors()` returns a `Map` of `fullSector`-shaped sectors, their moons through `withMoons`, and `stations` brought through `sectorJob` unchanged. On `eu/lane-2` there is no `sectors()` yet: the Expanse holds 2D `addBodies(makeSector(…))` sectors, keyed `'sx,sz'`, with no things and no stations. Lane 2's plan doesn't say what the `Map` is keyed by, and its chunk grid names cells `cx,cy,cz`, so `resolvePlace` and `scenePlaces` find a sector by its own `id`, never by the key (Tasks 3 and 12, changed in this revision). When 2.5 lands, check that the job's sector keeps `stations`, and that the expanse's sectors have `moonList` back.
2. **Holds for the built bodies, waits for the things (2.5's Task 21).** `expanse.solids()` is `near.js`'s, `{ id, at, r, reach }` with the generator's `E:` ids and each `at` moved in place every frame (`eu/lane-2`, `18952195`). A planet's solid reaches its atmosphere's top, 1.03 to 1.07 radii, so a park at 1.9 radii + 4 is clear of it.
3. **Holds.** Lane 2's Task 17 calls `expanse.update({ …, now: state.held || reduced ? 0 : Date.now() })` (`:5292` on `eu/lane-2`), read through `spaceTime(now)` in `expanse.js`. Task 11 hoists that value as `nowMs` and keeps `state.spaceT = spaceTime(nowMs)`.
4. **Holds.** `near.js` puts the built planets at `orbitAt(p, t)` and their moons at `moonAt(m, p, t)` with the expanse's `t` (`eu/lane-3`), and `discs.js` puts their discs at the same.
5. **Waits (2.5's Task 21).** `nearThings` draws a lattice thing within `THING_NEAR × size` and makes it solid as `{ r: size, reach: size * 1.2 }`, leaving a legacy nebula out of the solids. Also check the legacy wonders: today they aren't solid, and `sectors.js` draws one as a ball of `size × WONDER[kind].r` (0.12 to 0.5 of its size). If Task 21 makes one solid at its whole `size`, that's a wall many times the ball, a finding for lane 2. If it makes it solid at its ball, Task 2's wonder card takes that radius for `r` and `reach`, so the park is off the ball and not out past where the solid ends.
6. **Holds.** `OPEN_SPACE` has `roof: null` (`ship.js:408`), and the far plane is 45,000: the camera's (`scene.js:482` on `eu/lane-2`) and `levels.js`'s `FAR`.
7. **Waits (2.5's Task 22).** `scripts/universe-endless-check.mjs`, `__universeDebug.teleport` and the poses `expanse-system`, `old-rim` and `above-core` aren't on any branch yet.
8. **Holds, on `eu/lane-6a` at `3cf60b7c`.** `CHART_WORDS.sector` writes a minus as `−`. `declutter(labels, { bounds, sides, dots, hard })` and `boxOf(side, { x, y, w, h })` are as Task 13 takes them, `bounds` a box or a circle. Lane 6a also put a `FlatMap` in `UniverseMap.jsx`'s flat box (handed `startAt`) and a line in `src/lib/words.test.js`'s `FILES`; Task 14 now says both.
9. **Holds.** `expanse/gen/space.js` is as on `main` on both branches (`placeOf`, `fullSector`, `wonderPlace` at `:165`). `gen/orbits.js` gained an `out` argument and `moonAt`'s `planetAt` (PR 2.4), which this plan's calls don't need. Lane 2's 2.5 plan adds `gen/job.js` and leaves `space.js` be.
10. **Wrong: lane 2 fixed it.** A crash into a generated body comes back off it: lane 2's Task 17 looks in `solidsNow` too (`:4114` on `eu/lane-2`). Task 12's own fix is gone; a station is in `solidsNow` through `moving`.
11. **Holds for the pool, waits for the job (2.5's Task 19).** `src/runtime/workers.js`: asking again for a key settles the first ask with null, and only the same key does, so `place|E:9,0` never settles the expanse's own ask. `sectorJob` and `withMoons` don't exist yet, so Task 1 no longer lends them; Task 12 does.
12. **Half holds.** `ctx.rt.workers` is the runtime's pool (`runtime.js:541`). The scene doesn't pass it to `createExpanse`, and no `'expanse'` worker is defined, until 2.5's Task 22. Until then `request('expanse', …)` rejects (`no worker defined`), and `places.fetch` gives null.
13. **Holds.** `render()` calls `expanse.update(…)` once a frame right after `aimAt()` (`:5291`, `:5292` on `eu/lane-2`).
14. **Holds, on `eu/lane-6a`; not here.** `Interests.jsx` reaches `nav.js` through `MiniMap.jsx` → `chart/marks.js` (51 files on `eu/lane-6a`). On `eu/lane-3` it doesn't (42), so Task 7 holds it to the generator check alone, and Task 14 adds the `nav.js` check after the merge.
15. **Holds.** `eu/lane-2`'s and `eu/lane-6a`'s `dist/assets` have `Front-*.js`, `CommandPalette-*.js`, `Interests-*.js` and `Terminal-*.js` (Vite 8). There are two `Online-*.js` chunks; `chunks.mjs` finds chunks by the four names alone.
16. **Holds.** The pool's `request` resolves null on a cancel, a second ask, a closed name or a failed worker, and rejects only for a name with no worker. `places.fetch` gives null either way.
17. **Waits (2.5's Task 22).** Whether `expanse-system` builds its sector at `poses.js`'s top level. Task 15 moves it into `poseFor` if so.
18. **Wrong in its detail; Task 8 changed.** `discs.js` (`eu/lane-3`) draws more than this said, and caps it differently:
    - moons too: every moon of a system within `FAR + 2 × reach`, at `moonAt`, within `FAR + its radius` (the old list held moons only within their system's reach + 1,000)
    - a legacy wonder as its ball, `size × WONDER[kind].r`
    - none of a system the camera is inside the build reach of, which `near.js` meshes, and which takes none of the budget
    - the nearest `budget.discs`, but with an eased edge that draws more while it moves, up to the far layer's room, `farRoom`'s 1.5 × `discs`

    So Task 8 now lists moons as discs, rides every body of the systems the camera is in outside the cap, and caps the rest at the room (Task 12 passes `farRoom(device).discs`), which no drawn set can outnumber. Lattice things and extras are 2.5's Task 21: when it lands, check it draws them within `FAR + size` (Task 8 lists within `FAR + 1.2 × size`, which holds that), with no cut by kind through `thingKinds`.
19. **Holds.** `universe/budget.js` is as lane 2's Task 12 gives it, steps and floor included, and its tests pin whole rows with `toEqual`, which Task 9 extends. Lane 2's Task 17 puts `expanse.setStep(at.step, at.floor)` in `paceTo` (`:5014` on `eu/lane-2`).
20. **Holds.** `render()` finds the map-frame camera as `map.worldToLocal(camLocal.copy(camera.position))` (`:5283` on `eu/lane-2`) before `aimAt()` and `expanse.update`. `relative.js` puts the camera and the map back by copy after each draw, so `camera.position` is the true scene-frame position at update time. `expanse.js` measures from `parent.worldToLocal(camera.getWorldPosition(…))`, the same frame.
21. **New, holds.** Lane 2's Task 17 made its own face, `expanse/shared/space.js` (`createExpanse`, `farRoom`, `UNIVERSE`, `makeSector`, `addBodies`, `orbitAt`, `moonAt`, `spaceTime`), and `scene.js` imports `UNIVERSE` from it. This lane's Task 1 had planned a new `expanse/shared/space.js` of its own, which would have collided with it at the merge, and lent the pure generator through a face that reaches three.js. Task 1's face is now `expanse/shared/gen.js`, pinned in `gen.test.js`, and lane 2's `space.js` and `shared.test.js` are left alone.

## Findings for the coordinator (spec against code)

1. **The spec's "GOALS … accept it" can't be taken literally.** `GOALS` is `ship.js`'s static table of the hand-made map, and the generated places are endless. So a generated goal goes into a trip's own space (`placeSpace`), as a pilot's does through `pilotSpace`, and `GOALS` doesn't change.
2. **Stations are generated in lane 3, not lane 4a.** The spec puts "about one system in three has a station" in section B, and lists stations as catalogue kind 11. But docking, which is lane 3's, can't be built or tested without them. Lane 3 generates them (`expanse/gen/stations.js`) and draws them plainly. Lane 4a counts kind 11 and may restyle the look.
3. **The address has no station form.** Stations take wonder numbers past the lattice, `w(10000 + i)`. This is additive: nothing in `w8064` to `w∞` resolved before.
4. **Moving orbits against parking.** Generated planets move up to about 0.9 units a second (moons a little more), but the autopilot's stop needs the ship under 0.25. So the ship is carried by the planet or moon it's at or going to, fully out past its park. Without the carry, done item 6's "taking off leaves you in orbit" would drift.
5. **`state.at` is hand-made only.** The scene reads `state.at` as a hand-made id: `POSITIONS[pulseAt.id]`, `byId(state.at)` for landing, and the E and Enter keys. So generated places live in `scenePlaces.here()` and `where().place`, and lane 5b lands from those, not from `where().at`. A moon is `here` only once the ship has flown into its zone or a trip has ended there, never because it went by.
6. **Search and long-trip times.** The spec's lane table gives them to 6b (`NavMap.jsx`, `nav.js`). This lane ships their pure halves (`findDestinations`' `more`, `tripTime`'s formula), and 6b wires the UI.
7. **A visible change on the nav map.** A hand-made place too far for the 150 s simulation now gets a time from the formula instead of a dash, as spec F asks.
8. **The pocket universe and `nav.js`.** `nav.js` is pure and can't know which universe a page is in. The lookup its caller passes knows: the scene's resolves in the pocket, and the page passes the scene's. The terminal and ⌘K resolve in the shared universe, as their links carry no seed.
9. **The spelling of ids.** Generated ids are canonical in the generator's form (upper-case `E:`), to match lane 2's solids and crash events. Lane 5a's flight uses lower case, and lane 5b converts.
10. **The spec's line count is stale.** `scene.js` is 6,409 lines at `cc5e2eaf`, not the spec's 6,226. It is 6,374 on `eu/lane-3` (lane 2 through Task 16) and 6,361 on `eu/lane-2` after Task 17.
11. **The bundle of every page that loads `nav.js`.** `nav.js` loads with `Interests` (the home page, through the mini-map, after lane 6a's Task 9), `CommandPalette` (⌘K, preloaded on every page, `App.jsx:392`) and `Front` (the site's root). A module is never split across chunks, so `nav.js` takes its ids from `places/ids.js` and its orbits from the light face, never from `resolve.js`, and generated places reach it only through a lookup the caller passes. `weight.test.js` pins it, and Tasks 7 and 14 hold each chunk's growth to 2 kB gzipped.
12. **Islands.** `boundary-breaks` has eight imports of room on `eu/lane-3` (481 of 489), ten on `eu/lane-2` after its Task 17 put the scene on its face (479). This lane adds the expanse's two faces of its own (`shared/gen.js`, `shared/orbits.js`), so it uses none of them. `online/rosterWhere.js` still reaches `expanse/gen` directly (`:12`, `:13`), and could move onto `shared/gen.js`.

13. **A carry by the nearest body drags parked ships.** I carried each ship by whichever planet or moon had the most weight, with "highest weight wins, ties to the smaller reach". Over `E:1,0`, a moon going by a ship parked at its planet picked it up: 183 of 746 parked ships were dragged over a unit off their park within five minutes (331 within fifty), the worst by 252 units. This lane carries by one frame, the trip's goal or the place you're at. The review's suggested blend over every near body would drag them the same way.
14. **`{ things: false }` saves about a sixth of a sector build, not half.** Measured warm in Node here: 54 ms with things, 44 without, 2 for `makeSector` and `addBodies`. `appendSystems`' darts are the cost. So this lane doesn't add a second cache shape to `placeOf`. Instead the scene never builds: its misses go to the worker, and the page never resolves.
15. **Spec A's "`makeSector` … never on the main thread" against a resolver.** Any resolve outside the loaded sectors is a whole sector, 45 to 130 ms in Node, several times that on a phone. This lane keeps the rule for the scene and the page. The terminal's `fly` still makes one on its own page. Task 14 times it at 4× CPU throttling and fails over 1,500 ms.
16. **A link's card now waits for the scene.** The page never makes a sector, so `/universe/E:…` shows "Plotting a course…" until the scene has fetched the place, a second or so after load. A hand-made wonder's link shows its card at once, as before.
17. **The face drags universe data, but shakes the generator.** Bundled alone with rolldown, importing `orbitAt` and `moonAt` through a face that also lends `fullSector` was 6.6 kB gzipped. Most of that is `universe/layout.js` and friends, whose top-level `.map` calls are kept. `appendSystems` was not in it. `placeOf` was 12.3 kB. So `nav.js` takes a lookup and never names the resolver, and its ids and orbits come from `places/ids.js` and the light face (`gen/orbits.js` and `gen/extent.js`, which import nothing), not the whole face. Tasks 7 and 14 hold `Interests`, `CommandPalette` and `Front` to 2 kB each.
18. **Neighbouring planets' moon systems can cross.** `planetsOf` spaces orbits by `2 × max radius + 40…400` and ignores moons, which reach 4.4 radii out. So another planet, or its moons, can pass through a planet's park, and a park only clears its own planet's moons. A generator matter for lane 2's owner, not changed here.
19. **`extentOf` against `systemReach`.** `systemReach` measures a planet to its last moon, but by `moonsOf`'s slots an earlier, bigger moon can reach further. None does in the five test cubes (0 of 4,581 planets). Stations and parks use the furthest. `systemReach` is unchanged, because the fingerprint pins it.
20. **The first revision against the first review.** Each of its twelve findings was checked against the code and spec, and all twelve hold:
    - the station test: 315 of 397 stations sit inside their star's old zone
    - the crash test: 36.7 units in 300 frames on throttle alone, no crash
    - the moon fallback: 66 of 2,025 planets with moons, with `clearPark`'s margin and exact gaps
    - the marker: `navGoal` finds no `at`
    - `universe-check`'s `--out`
    - the waits
    - the jolt
    - the aim's `realAt`
    - systems never arriving
    - the small gaps

    Two corrections. `{ things: false }` saves a sixth, not half (finding 14). The extent gap is real by the rule but absent in practice (finding 19). Two of the review's fixes were not taken as written:
    - **The carry.** The suggested blend over every near body is replaced by one frame with a cross-fade (finding 13).
    - **The zones.** A system's zone is measured from its park radius, as suggested. A smaller zone takes over only while under way or at a trip's own end, so a passing moon can't take a parked ship.
21. **The generator is on the front door already, and a sector is made on its main thread.** `Universe.jsx` imports `online/Online.jsx` statically, which imports `online/rosterWhere.js`, which calls `fullSector(SHARED, …, { things: false })` (`rosterWhere.js:12`, `:41`) to name where a pilot in the roster is. So `fullSector` is in `Front`'s static closure today. A build on `eu/lane-2` puts it in `Online-*.js`, which `Front-*.js` imports, and 144 chunks and 682.8 kB gzipped load with `Front`. Two things follow:
    - Spec A's "`makeSector` … never on the main thread" is broken already, outside the scene, by a roster row: a whole sector, about 38 ms here. It's lane 2's file or 6b's (the roster is online), not this lane's. It should resolve from the scene's sectors or the pool.
    - Task 1's stations add to `Front` through it. The 2 kB gates measure `Front` by its growth over Tasks 7 and 14 alone, and the README records the stations' share from Task 1.
22. **This revision against the second review.** Each of its thirteen findings was checked against the code and spec.
    - Eleven hold as written: the thunks (`powers` at `:2338` and `unique` at `:2340` are below the block at `:1769`, and `props` is reassigned at `:6120`), the stuck "Plotting" with 3D off, the pocket test's shared sectors, the planet's 0.645 units a second against the stop's 0.25 (`ship.js:775-779`) and `MAX_DT` (`runtime.js:62`), the pick's drive (`parseDrive`'s `'hyper'`, `nav.js:59`), the landed Destination, `wonderPlace`'s order (`space.js:166`), the checks' quality, the pose built at import, the aim's array and the systems' kind.
    - **The bundle (finding 2) holds for ⌘K and the home page, not for `Front`.** "Today the generator reaches these only through the lazy scene" is true of `CommandPalette` and `Interests`, and of `nav.js` (15 files, none of the generator). It's not true of `Front`, which has had `fullSector` since `rosterWhere.js` (finding 21). The fix is taken as asked: ids and `atTime` in `places/ids.js`, `extentOf` in `gen/extent.js` behind a light face, and the three chunks measured. `Front` is held to its growth, and only `CommandPalette` and `Interests` must hold none of the generator.
    - **The declutter call (finding 10) holds for 6a's plan, not its code.** Lane 6a's plan has no `hard`, but `declutter.js` on `eu/lane-6a` (`e59d3d04`) takes `hard = []`. `placeTags` passes `bounds` alone, so it doesn't matter which lands. The `bounds` conversion is taken: `{ x0: 0, y0: 0, x1: w, y1: h }`, from the scene's `size` rather than `getBoundingClientRect`, so no frame reads layout.
    - Also found while checking: `createScenePlaces`' `frame` must be a thunk too (`size` is a `const` at `:1173`, below the call at `:780`), and Task 12's other deps were checked by line.
23. **This revision against the third review.** Each of its ten findings was checked against the spec, the wave-1 plans and the code, and all ten hold.
    - **The listing against what's drawn.** Spec A's table draws "planets and things as impostors" within the far plane. Lane 2's Task 15 picks stars, planets and wonders within `far + r`, and its Task 21's discs "carry a lattice thing within the far plane", the nearest `budget.discs`. Within the far plane of `E:1,0`'s middle there are 68 systems, 274 planets and 1,741 lattice things (measured at `cc5e2eaf`, against 11 things within 9,000). The old list held things only within `THING_NEAR × size` and planets within 20,000, so most discs had no row. Task 8 now lists by the disc layer's own rule, capped by `budget.discs`.
    - **The camera's frame.** `toScreen` (`:1526`) and `aimAt` (`:800-803`) already work in the map's frame through `camLocal` (`:5331`), and `map.rotation.y = state.yaw` (`:5076`, `:5134`) turns it by `−heading` after any arrival (`:1843`), spawn (`:2219`) or pose (`:5879`). Lane 2's camera-relative drawing (`eu/lane-2`, `b4747d89`) restores the camera after the draw, so this still holds there (`:5296`). `scenePlaces` now finds `cam` from its own `group`.
    - **The travel block's other names.** `front` (three reads), `heard()`, `retarget(700)` and `camQOn = false` are at `:1782`, `:1796`, `:1835`, `:1844`, `:1850` and `:1857`. Task 10 lists every rewrite by line, and tests a trip to the front.
    - **Sector at hand.** Taken as given, with one more consequence: `trips.travel` gains a `missing` dep, so a trip to `E:1,0:0:99` with `E:1,0` loaded is refused at once, not left pending and then dropped.
    - **The mover.** Taken as given, named `move` on the card, the `Destination` and the `Row`.
    - **The baselines.** Taken, and it found a second hazard. `universe-check` writes one `<out>.json` a run, holding only the poses that run measured (`:237`, `:246`). So the old Step 5, recording `expanse-station` alone into `lab/universe/endless/<tier>`, would have written over lane 2's `old-rim`, `above-core` and `expanse-system` numbers. Task 15 now records all four endless poses in one run a tier.
    - **The browser checks.** Taken, and it found more. `navmap-check` and `links-check` default to `/opt/google/chrome/chrome`, which this container lacks. `universe-check` and `autopilot-check` look for `chromium-N/chrome-linux/chrome`, but this container has `chromium-1243/chrome-linux64/chrome`, and Playwright's own fallback wants revision 1194. So every browser command runs with `CHROME` and `CHROMIUM` set to `/opt/pw-browsers/chromium` (Global Constraints).
    - **The evidence folder** is `endless-universe-lane-3/`, as lane 2's and lane 6a's hand-off notes are (`eu/lane-2`, `eu/lane-6a`).
    - **The tier table.** `tags` joins lane 2's `BUDGET` and its stepped fields. The list's cap is the row's `discs`, so neither count is kept outside the table.
    - **The sector name.** Task 8's fixture cube `[1, 1, 0]` is `fullSector(UNIVERSE, 1, 1, 0)`, i.e. `E:1,0,1`. The 2,025 planets with moons are counted over `E:1,0`, `E:2,0` and `E:1,0,1` (checked: `E:1,1` in its place gives 2,013).
24. **This revision against the code.** Lane 2's PR 2.4 is in up to Task 16 on `eu/lane-3`, and Task 17 on `eu/lane-2`, so the plan's assumptions were checked one by one ("Assumptions about wave 1's unmerged work": eleven hold, two were wrong, four wait on PR 2.5, and four hold in part). What changed:
    - **The generator's face is `expanse/shared/gen.js`, not `space.js`.** Lane 2's Task 17 made `expanse/shared/space.js` its own face for the drawn Expanse, and it reaches three.js. Task 1 makes a pure face beside it, pinned in a test of its own, so neither file collides at the merge.
    - **`withMoons` and `sectorJob` move from Task 1 to Task 12.** They are PR 2.5's (`gen/job.js`), not on this branch, so PR 3.1 could not have lent them.
    - **The list covers what `discs.js` draws.** Moons are discs too, the systems the camera is in ride outside the cap, and the cap is the far layer's room (`farRoom`, 1.5 × `discs`), since the disc layer's eased edge draws past `budget.discs` while it moves. Within the far plane of `E:1,0`'s middle: 69 systems, 278 planets, 415 moons and 1,746 lattice things.
    - **A sector is found by its own id.** Lane 2's `sectors()` will be a `Map` keyed by its chunk grid's cells, so `resolvePlace` (Task 3) and `scenePlaces` (Task 12) look a sector up by `id`.
    - **`weight.test.js` without lane 6a.** `Interests.jsx` doesn't reach `nav.js` on this branch, so Task 7 pins its generator check alone and Task 14 adds the rest after the merge.
    - **Lane 2 already brings the crash back off a generated body** (Task 17), so Task 12 drops its fix, and its `scene.js` budget falls to +10.
    - "What PR 3.2 waits on" says, task by task, what it needs from PR 2.4's Task 17, from PR 2.5 and from lane 6a.

    Both of the last review's findings had been taken by the revision before this one (the list follows what's drawn; `scenePlaces` measures from `group.worldToLocal` of the camera, tested with the group turned by 1.2 radians). This revision checked both against `discs.js`, `relative.js` and `toScreen`, and tightened the first as above.

## Spec coverage

- **Done item 4, "Every place you see, you can go to"** (all but "the map lists it", which is lane 6b's):
  - **It has a name** (Tasks 2 and 3, the tags in 13).
  - **You can pick it** (Tasks 9 and 13), aim at it and press J (Task 12). "Every place you see" is taken literally: whatever lane 2 draws as a disc within the far plane has a row (Task 8), so a rock 5,000 off is picked where it shows (Task 13), named by a tag and handed to lane 6b through `handle.nearby()`. This holds with the map turned (Task 12).
  - **Travel takes you there** by the jump, super speed or cruise (Tasks 4, 7 and 11), into and out of the Curve (Task 7), and to a place outside the loaded sectors once the worker has made it (Tasks 11 and 12).
  - **You stay there:** parked, carried by what you're at, arrived at a system or a planet past its moons, and never dragged by a passing moon (Tasks 4, 5, 8 and 12).
  - **You can't fly through it:** stations are solid (Task 12), and generated bodies are lane 2's.
- **Section B, "every one has a name, a card and a parking spot":** Tasks 2, 3, 4 and 14. Lane 4a's new kinds get theirs through `THING_CARDS`.
- **Section B, stations, "about one system in three":** Task 1.
- **Section B, docking through the hangar and shop:** Tasks 9, 12 and 14.
- **Section C, `/universe/<id>` behaving as today for generated places:** Task 14. It starts parked with the card up. The card waits on the scene (finding 16), and with 3D off, failed or lost it shows a plain card for the id at once, never a wait.
- **Section F, "Generated places are destinations":** Tasks 3, 7 and 11.
  - "Nothing is stored": Global Constraints, and Task 3's resolver.
  - "Trip times for long trips come from a formula": Task 6.
  - "The jump goes to anything on the map", with its recharge and interdiction kept: Tasks 7 and 11, and Task 10's pinned behaviour.
- **Done item 9, "Nothing is lost":**
  - Task 10 pins today's travel before moving it.
  - Every existing test is untouched.
  - Task 15 reruns the repo's checks.
- **Done item 10, "Phones still fly":**
  - fewer tags on `low`, from spec H's one tier table, and fewer again as the quality steps come down (Tasks 9, 12 and 13)
  - no draw call for a station out of range (Task 12)
  - no sector made on the main thread by the scene or the page; spec A's rule, kept for the resolver (Tasks 3, 11, 12 and 14); the terminal's one build timed at 4× throttling (Task 14)
  - the generator kept off ⌘K and the home page, and those and the front door each held to 2 kB of growth (Tasks 7 and 14, `weight.test.js`)
  - trips to moving places that end at a frame or two a second, by the carry (Task 12's `travel` step in software GL)
  - the frame times in Task 15
- **Section H, "One tier table … the quality steps lower these further":** the tags' cap is `BUDGET.tags`, read through `universeBudget(device, step, floor)` and stepped by `places.setStep` from `paceTo` (Tasks 9 and 12). The list's is the far layer's room, `farRoom(device)`, made from the same row, so it is never shorter than what the discs draw at any step. `expanse-system` and `expanse-station` are recorded as the endless baselines (Task 15).
- **The spec's counts:**
  - No count of 20 kinds or 15 events is this lane's.
  - The density targets are lane 2's, and stations add to them without touching them (Task 1 leaves `density.test.js` unchanged).
  - Pacing is lane 4b's.

## Self-review

- **Types:**
  - `Destination` is defined in Task 3 and read in Tasks 4–8 and 11–14.
  - `Row` is defined in Task 8 (with `move`, and `at` from `atTime`) and read in 9, 12 and 13.
  - `move(row, t)` is defined on `THING_CARDS` (Task 2), carried by `Card`, `Destination` (Task 3) and `Row` (Task 8), and read by `atTime` alone.
  - `BUDGET.tags` is defined in Task 9 and read by `scenePlaces` (Tasks 12 and 13) through `universeBudget(device, step, floor)`. `farRoom(device).discs` (lane 2's room, 1.5 × `budget.discs`) is `placesAround`'s `max` in Task 12.
  - The map-frame camera is found in `scenePlaces.update` (Task 12) and is the `cam` that `placesAround`, `aimStars` and the stations' grow take.
  - `Park` is defined in Task 4 and read in 5, 7, 11 and 15.
  - `parkDistance` is defined in Task 4 and read in 5 (`carryZone`), 8 (`Row.park`, `hereZone`) and 12.
  - `PARK_GAP` and `clearOf` are defined in Task 2.
  - The lookup `{ place(id) }` is made by `lookupOf` (Task 3) and `places.look` (Task 12), and taken by every `nav.js` function (Task 7), the page (Task 14) and the terminal (Task 14).
  - `frames` (`[{ body, k }]`) are made by `carryFrames` (Task 5), kept by `scenePlaces` (Task 12) and read by `carry`.
  - Trips' `endTrip` (not `finish`, which `scene.js` has), `outOfJump`, `followPlace`, `state.arrived` and `state.pending` are defined in Task 11 and read in Task 12.
  - The `place` values match `placeIn`'s kinds plus `'station'`.
  - The `kind` values (`star`, `world`, `station`, `wonder`) are the ones `findDestinations` filters by, and its `'system'` takes `'star'` too.
  - `isPlaceId`, `canonicalPlace` and `atTime` are defined in `ids.js` (Task 3) and imported from there by Tasks 4, 5, 7, 11, 12 and 14. `resolvePlace` and `lookupOf` come from `resolve.js` only in the scene's places (Tasks 11 and 12), the terminal (Task 14), `poses.js` (Task 15) and tests.
  - `extentOf` is defined in `gen/extent.js` (Task 1) and lent by both faces. `park.js` takes it from the light one.
  - `cardRow` and its flat and pending rows are defined in Task 14's `pageCard.js` and drawn by `PlaceCard`. `PLACE.flat` and `PLACE.plotting` are Task 2's.
  - `createTrips`' deps: thunks for `props`, `powers`, `unique`, `front`, `heard`, `retarget`, `invalidate` and `settle` (Task 10, every rewrite in its table), with `resolve`, `fetch` and `missing` (Tasks 11 and 12). `createScenePlaces`' thunks are `tags`, `onPick` and `frame` (Task 13). Its `device` is a value.
  - "At hand" (the id's sector loaded or fetched) is defined in Task 12 and decides `fetch`, `find` and `missing`. `missing` is what Task 11's trips and Task 12's start read.
  - The `'place'` event's `what` values (`arrive`, `leave`, `dock`, `undock`, `found`) are the same in Tasks 12 and 14.
  - `places.screen` (Task 13) and `places.debug` (Task 12) are what the endless check's steps call.
- **Review Focus lines and their tests:**
  - spellings, and no stuck wait with 3D off: Tasks 3, 7 and 14
  - a moving target, and the two clocks: Tasks 4, 5, 8, 11 and 12
  - pockets: Tasks 3 and 12
  - far, and from the Curve: Tasks 6 and 7
  - docking: Tasks 9 and 12
  - a place outside the loaded sectors: Tasks 3, 11, 12 and 14
  - the weight of every page that loads `nav.js`: Tasks 1 (the before), 7 and 14
  - hand-made trips after the move, and the deps declared below: Task 10
  - a turned map: Task 12
  - a disc you can see: Tasks 8 and 13
- **Test times.** RULES asks under a second a test. The heavy ones run over `E:1,0` alone: every planet's zone, about 25 planets parked past their moons for 60 s, and one planet over 600 updates. `step` costs about 20 µs here, and 6,000 steps took 121 ms.
