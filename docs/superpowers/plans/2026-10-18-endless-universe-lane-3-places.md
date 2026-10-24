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
  - **3.1 the pure half** (Tasks 1–9). Nothing on screen changes.
  - **3.2 the wiring** (Tasks 10–15). Pictures change out in generated space only.

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
- lane 2 merged, all five PRs
- lane 6a merged (`CHART_WORDS` in `words.js`)
- lanes 1 and 5a merged (no interface of theirs is used)

Line numbers are from `main` at `cc5e2eaf`. Lane 2's PRs 2.3 to 2.5 move them, so find the code again by the quoted text.

## Global Constraints

**Process (HANDOFF-universe's owner's rules and the index's Global Constraints, all of them):**
- Nothing a visitor can do is lost. Every key, save, route, dev hook and test works after as before, and no test is loosened.
  - `nav.test.js`, `ship.test.js`, `space.test.js`, `fingerprint.test.js` and `density.test.js` stay as they are. New tests go in new `describe`s.
- Pure first. `expanse/gen/*`, `expanse/shared/*` and `universe/places/{ids,cards,resolve,park,carry,trip,around,pick,dock,pageCard}.js` import no React, no DOM and no three.js. Each has its Node test before its drawing half.
- A changed picture is on purpose. The before shots come first (Task 10), at `--quality mid`.
- Draw calls and triangles are no higher at any pose in `lab/universe/baseline/<tier>.json`. Say the numbers.
- Before the lane is done: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` and `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`.
- Every commit is one plain sentence in the repo's voice. The body says why and gives the numbers, and it ends with the attribution lines the session's harness gives (`.claude/skills/autopilot/SKILL.md`, "Commit"). This plan writes the first line only, with no model names.
- The hand-off goes in `docs/superpowers/evidence/endless-universe-3/HANDOFF-NOTES.md`, not in `HANDOFF-universe.md`, which the coordinator folds.

**Code shape:**
- `src/components/universe/scene.js` doesn't grow. Task 10 moves the travel block out, about 130 lines. Tasks 11 to 13 add at most 40 lines between them, and each says how many lines it moves out and adds, by `wc -l` before and after.
- New files stay under 800 lines. `Universe.jsx` (649) and `UniversePanel.jsx` (350) stay under 800.
- **Islands.** The universe reaches the expanse's generator only through two new faces, as the expanse reaches the universe through `universe/shared/space.js`:
  - `src/components/expanse/shared/space.js`, the whole generator, for the scene's places, the resolver and the terminal
  - `src/components/expanse/shared/orbits.js`, the light face: `orbitAt`, `moonAt`, `spaceTime` and `extentOf`, from `gen/orbits.js` and `gen/extent.js`, which import nothing. It is all that `ids.js` and `park.js` take, so it is all that `nav.js` brings with it.

  `boundary-breaks` (484, budget 489) doesn't rise, and neither does `cycles` (5).
- **Declared after, or changed later.** A module made in `scene.js` (`createTrips`, `createScenePlaces`) takes, as a thunk, anything `scene.js` declares below the call (a `const` there is in its temporal dead zone) or reassigns (`props`, `front`). A plain value is only for what is declared above the call and never reassigned. Each task that adds a dep says which it is, by line.
- No `requestAnimationFrame` (the `loops` metric is at its budget), no new `onBeforeCompile`, no new GLSL.

**Ids and space:**
- Ids are Task 0's (`src/lib/space/address.js`). Any spelling is read: `e:` or `E:`, a middle-layer sector with or without its `,0`.
- A generated place's canonical id is the generator's own form, `spaceId(...)` with upper-case `E:`, because the solids' and crash events' ids are that form (lane 2's Task 17). Lane 5b lower-cases it for `/fly`.
- Stations use the wonder numbers above the lattice, `w<STATION_BASE + i>` for system `i`'s station. `THING_BASE + THING_CELLS³ = 8064 < 10000`, so no id that resolved before changes what it names, and `parseSpaceId` is unchanged.
- Generated content is never stored: no `localStorage`, `rt.saves` or `rt.store` row anywhere in this lane.
- **One clock.** A generated place's position at time `t` is `orbitAt` or `moonAt` on the shared clock. The scene's `t` is `spaceTime(state.held || reduced ? 0 : Date.now())`, the same one lane 2's `expanse.update` draws with, and it is kept in `state.spaceT`.

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
  - a planet's park keeps clear of each moon's whole circle by `clearOf(moon radius)`, ship.js's `clearPark` margin. Where no way in at `reach + 4` is clear, it parks just past its furthest moon. That is 66 of 2,025 planets with moons in `E:1,0`, `E:2,0` and `E:1,1,0`.
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
- **Around the ship:**
  - stars within 45,000 (the far plane) and planets within 20,000
  - moons, the station and the exact parks once within their system's reach + 1,000
  - lattice things within `THING_NEAR` × their size, as lane 2 draws them
  - at most 400, refreshed four times a second
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
  - 6 at most (3 on `low`)
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
- Every wait is on a condition, never a sleep.
- Evidence goes in `docs/superpowers/evidence/endless-universe-3/`, each picture under 1 MB (element shots, or JPEG at 80).

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

   The block sits at `scene.js:1769`, above `powers` (`:2338`) and `unique` (`:2340`), and `props` is reassigned on every page update (`:6120`). Passed as values, the first two throw on load and the third keeps a stale `drive` and `frozen`.

   Pinned in Task 10 (its tests written against today's behaviour before the move; made before `powers` and `unique` exist; the page's props read as they are now; then the navmap, sector, flyto and smoke checks after).

## Files

| File | Responsibility | Task |
|---|---|---|
| `src/components/expanse/gen/stations.js` (new) | a station at one system in three, from its seed | 1 |
| `src/components/expanse/gen/extent.js` (new) | `extentOf`, how far a planet's body, ring and moons reach; imports nothing | 1 |
| `src/components/expanse/gen/space.js` | `fullSector` gains `stations`; `placeIn` | 1 |
| `src/components/expanse/gen/tables.js` | `STATION_NAMES` | 1 |
| `src/components/expanse/shared/space.js` (new) | the expanse's face for the universe: the whole generator | 1 |
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
- Create: `src/components/expanse/gen/stations.js`, `src/components/expanse/gen/stations.test.js`, `src/components/expanse/gen/extent.js`, `src/components/expanse/shared/space.js`, `src/components/expanse/shared/orbits.js`, `src/components/expanse/shared/shared.test.js`, `docs/superpowers/evidence/endless-universe-3/README.md` (the bundle before; later the timings and the numbers)
- Modify: `src/components/expanse/gen/space.js` (`fullSector` after `appendSystems(sector, outs)`; `wonderPlace` (`:165-178`) and `placeOf` (`:180-193`) at the file's end), `src/components/expanse/gen/tables.js` (append)

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
  - **`src/components/expanse/shared/space.js`** lends exactly these names: `UNIVERSE`, `universeOf`, `fullSector`, `placeOf`, `placeIn`, `orbitAt`, `moonAt`, `bodiesAt`, `spaceTime`, `systemReach`, `THING_BASE`, `THING_CELLS`, `THING_NEAR`, `THING_KINDS`, `SECTOR_EXTRAS`, `thingRow`, `WONDER_KINDS`, `STATION_BASE`, `stationsOf`, `extentOf`, and lane 2's `withMoons` and `sectorJob` (`expanse/gen/job.js`). `withMoons` puts the moons back on a sector that came from the worker. `sectorJob` is lent so the scene's tests can run the worker's job in process.
  - **`src/components/expanse/shared/orbits.js`**, the light face, lends exactly `orbitAt`, `moonAt` and `spaceTime` (from `gen/orbits.js`) and `extentOf` (from `gen/extent.js`), and imports nothing else. Neither source imports anything. Its header says why it is apart: `nav.js` reaches it through `ids.js` and `park.js`, and so does every page that loads `nav.js`.

- [ ] **Step 0: Record the bundle before**, on the branch as it stands (lanes 1, 2, 5a and 6a merged), before any code of this lane.
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
  - Write the four lines into the evidence README under "Bundle". On `eu/lane-2` today it gives Front 682.8 kB over 144 chunks, CommandPalette 172.5 kB, Interests 150.9 kB and Terminal 169.0 kB, and the generator's `fullSector` sits in the `Online-*.js` chunk, which only `Front` (and the galaxy's pages) load statically.
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

  `expanse/shared/shared.test.js` pins both faces' names. It mirrors `universe/shared/shared.test.js`:
  - each module's sorted keys equal its list above
  - each is a function, an object or a number (`UNIVERSE` is a bigint, so `'bigint'` is allowed too)
  - the light face's own `import … from` lines, read from its source with `scripts/health/graph.mjs`'s `FROM` and `uncomment`, name only `../gen/orbits` and `../gen/extent`, and neither of those names any import at all

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/stations.test.js src/components/expanse/shared`. Expected: FAIL, because `./stations`, `./extent`, `./space` and `./orbits` can't be resolved.
- [ ] **Step 3: Implement** `extent.js` and `stations.js` to the Interfaces, append `STATION_NAMES`, wire `stations` into `fullSector`, put the station branch first in `wonderPlace`, export `placeIn`, and write both faces. The header comments are in the repo's voice, listing the exports as `things.js` does. The station header says why the pole: planets keep within ±40 of their star's plane, so a point over the pole is clear at every `t` and needs no orbit of its own.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse`. Expected: PASS, with `fingerprint.test.js`, `space.test.js`, `density.test.js` and lane 2's `job.test.js` unchanged and green.
- [ ] **Step 5: Record the stations' weight.** Run `npm run build` and the Step 0 command again, and add the four lines to the README. `Front` grows by the stations' code (it reaches `fullSector` through `online/rosterWhere.js`, finding 21). The others don't change, and `Waystation` is in none of them but `Front`'s `Online-*.js`.
- [ ] **Step 6: Commit.** `git add src/components/expanse docs/superpowers/evidence/endless-universe-3 && git commit -m "Stations at one system in three, and the expanse's two faces for the universe"`. The body gives the four chunks before and after.

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
  - **`THING_CARDS: { [kind]: { type, about, color, solid = true, far? } }`.**
    - One row for each of `rock`, `ice`, `derelict`, `rogue`, `nebula` (`solid: false`), `pulsar` and `default`.
    - The colours are `THING_KINDS`' `look.color`, and for the legacy wonders `expanse/scene/sectors.js`'s `WONDER` colours: nebula `#b48cff`, pulsar `#b8f4ff`.
    - `far`, in units, is how far off it's listed round the ship. The default is `THING_NEAR × size` for a lattice thing and 45,000 for a wonder or an extra.
    - This is lane 4a's table: a kind it adds gets a row here, or the test below fails.
  - **`placeCard(found) → Card`**, where `found` is `placeIn`'s `{ kind, row, sector }` plus `system` (for a planet, moon or station) and `planet` (for a moon).
  - **`Card`** is `{ kind, sub, name, type, about, facts: [[label, value]], color, r, reach, deep, solid, dock, land, faction, system, span }`:

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
import { THING_KINDS, WONDER_KINDS, fullSector, placeIn, thingRow, UNIVERSE } from '../../expanse/shared/space';
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
- Modify: `docs/superpowers/evidence/endless-universe-3/README.md` (the timings)

**Interfaces:**
- Consumes: Task 1's whole face (`placeIn`, `placeOf`, `spaceTime`, `UNIVERSE`) in `resolve.js`, and its light face (`orbitAt`, `moonAt`) in `ids.js`; Task 2's `placeCard`; Task 0's `parseSpaceId` and `spaceId`.
- **Two modules.** `ids.js` imports only `lib/space/address.js` and `expanse/shared/orbits.js`, so `nav.js`, `park.js`, `carry.js` and the page can take it. `resolve.js` imports `ids.js`, the whole face and `cards.js`, and only the scene's places, the terminal and tests import it. Neither re-exports the other's names.
- Produces, in **`ids.js`**:
  - **`isPlaceId(id) → boolean`**, true when `parseSpaceId` reads it.
  - **`canonicalPlace(id) → string | null`**: the generator's form, `spaceId([sx, sy, sz], ...parts)`.
  - **`atTime(place, t) → [x, y, z]`**, over anything with `{ place, src }` (a `Destination` or Task 8's `Row`):
    - a planet: `orbitAt(src.row, t)`
    - a moon: `moonAt(src.row, src.planet, t)`
    - a card with `at(row, t)`: that
    - otherwise `src.row.at`
- Produces, in **`resolve.js`**:
  - **`resolvePlace(id, { universe = UNIVERSE, t = spaceTime(Date.now()), sectors = null, build = true } = {}) → Destination | null`.**
    - It looks in `sectors.get(key)` first (a scene's `Map` of the sectors it has).
    - With `build`, a miss goes to `placeOf(universe, id)`, which makes the whole sector on this thread (45 to 130 ms in Node here) and keeps the last eight.
    - With `build: false`, a miss is null. The scene always passes `build: false`.
    - It is null for anything not there, never throws, and stores nothing.
    - It makes the card afresh on every call, which is cheap.
  - **`lookupOf(opts) → { place(id) → Destination | null }`:** `resolvePlace` with those options, in the shape `nav.js` takes (Task 7).
  - **`Destination`** is Task 2's `Card` and:
    ```
    { id (canonical), generated: true, place: 'system' | 'planet' | 'moon' | 'station' | 'thing' | 'extra' | 'wonder',
      at: [x, y, z] (at t), t, moving (planet or moon, or a card with at()), sector: 'main', key: sectorKey,
      cube: [sx, sy, sz], to: null, src: { row, system, planet } (the generator's rows, read-only) }
    ```
    `sector` is always `'main'`: the keep-outs keep every generated place out of the Rick and Morty pocket, so `legOf` reads it as the main map's.

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { UNIVERSE, fullSector, moonAt, orbitAt, thingRow, universeOf } from '../../expanse/shared/space';
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
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/resolve.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `ids.js` and `resolve.js`. The resolver's header says what it never does: store a row. It also says that `build` makes a whole sector on the calling thread, so the scene never passes it. The ids' header says why they're apart: a module is never split across chunks, so anything `nav.js` took from `resolve.js` would bring the generator onto every page that loads `nav.js`.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 6 tests.
- [ ] **Step 5: Time a miss, for the README.** In a scratch script (not committed), time `resolvePlace` for an id in a sector not yet made: first in a fresh Node process, then warm, five each. Write the medians into `docs/superpowers/evidence/endless-universe-3/README.md`, under "A sector made on the main thread". At `cc5e2eaf` in this container, `placeOf` was 75 to 100 ms cold and about 45 ms warm (`{ things: false }`: about 38). Task 14 adds the terminal's number at 4× CPU throttling.
- [ ] **Step 6: Commit.** `git add src/components/universe/places docs/superpowers/evidence/endless-universe-3 && git commit -m "An E: id resolves to a destination by running the generator, nothing stored; its spellings need no generator"`

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
    - A planet with moons, when none of the 32 level directions at `d` has `moonGap ≥ clearOf(moon.radius)` for every moon: `max(d, the greatest moon.orbit + clearOf(moon.radius))`. Every direction is clear out there, since the distance to a circle is at least the distance to its middle less its radius. This is 66 of 2,025 planets with moons in `E:1,0`, `E:2,0` and `E:1,1,0`.
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
import { UNIVERSE, extentOf, fullSector, thingRow } from '../../expanse/shared/space';
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
import { UNIVERSE, fullSector, moonAt, orbitAt } from '../../expanse/shared/space';
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
- Modify: `docs/superpowers/evidence/endless-universe-3/README.md` (the bundle numbers)

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

describe('the generator stays off every page that loads nav.js', () => {
  // (nav.js itself; ⌘K, preloaded on every page; the home page's lower half, through the mini-map)
  it.each(['src/components/universe/nav.js', 'src/components/CommandPalette.jsx', 'src/components/interests/Interests.jsx'])('%s reaches none of it', async (entry) => {
    const files = await reach(entry);
    expect(files).toContain('src/components/universe/nav.js');
    expect(files.filter((f) => GENERATOR.test(f))).toEqual([]);
  });
});
```

  At `cc5e2eaf` `nav.js` reaches 15 files, `CommandPalette.jsx` 50 and `Interests.jsx` 42, none of them the generator, so the test passes before and after. `Interests.jsx` reaches `nav.js` only once lane 6a's Task 9 has the mini-map on `chart/marks.js`. If merged lane 6a's mini-map doesn't reach it, the `toContain` line fails for `Interests.jsx` alone: drop that one expectation for it, keep its generator check, and say so in the commit.

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/nav.test.js src/components/universe/places/weight.test.js`. Expected: the new `describe` in `nav.test.js` FAILS (`canGo` is not exported). Every test above it passes, and `weight.test.js` PASSES (it pins what must stay true).
- [ ] **Step 3: Record the bundle before.** Run `npm run build`, then Task 1's `node <scratchpad>/chunks.mjs dist/assets Waystation Front CommandPalette Interests Terminal`, and write the four lines into the README as "before Task 7".
- [ ] **Step 4: Implement** the Interfaces. The file header gains one paragraph on generated places: looked up through the caller's `place`, never listed, parked by `places/park.js`, timed by `places/trip.js`. It says why there is a lookup and why its ids come from `places/ids.js`: the generator stays off ⌘K, the home page and the main thread.
- [ ] **Step 5: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS, with every existing test in `nav.test.js` unchanged, and `weight.test.js` still PASSING.
- [ ] **Step 6: Record the bundle after, and the islands.**
  - Run `npm run build` and the same `chunks.mjs` line, and add "after Task 7" to the README.
  - Expected: `Front`, `CommandPalette` and `Interests` each grow by at most 2 kB gzipped over "before Task 7": the ids, the park, the formula and the light face. `Waystation` is in neither `CommandPalette`'s nor `Interests`' closure.
    - `Waystation` in one of them means something on `nav.js`'s imports reaches the generator, which `weight.test.js` should have caught. Find the import and cut it.
    - Over 2 kB with no `Waystation` means `park.js` is the weight. Then `nav.js` stops importing it, and takes the park from the lookup instead: `{ place(id), park(id, from) }`, which `lookupOf` and `places.look` (Task 12) supply from `parkPlace`. `parkFor` and `tripTime` call `opts.park`. Re-run, and say so in the commit.
    - Don't raise the ceiling.
  - Run `node scripts/health.mjs --check --skip build`. Expected: `boundary-breaks` and `cycles` as on the branch before Task 1 (484 and 5 at `cc5e2eaf`).
- [ ] **Step 7: Commit.** `git add src/components/universe/nav.js src/components/universe/nav.test.js src/components/universe/places/weight.test.js docs/superpowers/evidence/endless-universe-3 && git commit -m "The nav map's places take E: ids: parked, measured, timed and found, and the generator stays off the pages that load it"`. The body gives the three chunks before and after.

### Task 8: What's round the ship, and which place it's at

**Files:**
- Create: `src/components/universe/places/around.js`, `src/components/universe/places/around.test.js`

**Interfaces:**
- Consumes: Task 1's face; Tasks 2 and 3; Task 4's `parkDistance`; `ship.js`'s `PARK_GAP`; Task 0's `SECTOR` and `sectorCentre`.
- Produces:
  - **`AROUND = { far: 45000, planets: 20000, inside: 1000, max: 400, underWay: 1 }`.**
  - **`Row`** is `{ id, place, kind, name, at, r, reach, deep, color, dist, park, src }`, where `dist = max(0, |cam − at| − reach)` and `park = parkDistance(row)`.
    - A planet of a system whose `span + inside` doesn't hold the camera has `park: null`. One that far off can't be where you're at, and finding a park past its moons costs 32 directions × its moons.
    - A Row is a light destination: `resolvePlace(row.id)` gives the card.
  - **`placesAround(sectors, cam, t, { far, planets, inside, max } = AROUND) → Row[]`**, nearest `dist` first, at most `max`. `sectors` is a `Map` or any iterable of sectors. It lists:
    - every system whose `dist` is within `far`
    - the planets (at `orbitAt(p, t)`) of systems within `planets`
    - the moons (at `moonAt`) and the station of every system whose `span + inside` holds `cam`
    - each lattice thing within `THING_NEAR × size`, found by looking only in the cells round the camera's cell (±1, 6,000 each) of the sectors whose cube is within 6,000, binary-searched in `things.slot`
    - extras and legacy wonders within their card's `far` (45,000 by default)
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
import { THING_NEAR, UNIVERSE, fullSector, moonAt, orbitAt, thingRow } from '../../expanse/shared/space';
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
    const cam = [s.systems[5].at[0] + 3000, s.systems[5].at[1], s.systems[5].at[2]];
    const rows = placesAround(sectors, cam, 0, all);
    const want = [...sectors.values()].flatMap((x) => x.systems).filter((x) => len(x.at, cam) - x.star.size * 2 <= AROUND.far).map((x) => x.id);
    expect(rows.filter((r) => r.place === 'system').map((r) => r.id).sort()).toEqual(want.sort());
    for (let i = 1; i < rows.length; i++) expect(rows[i].dist).toBeGreaterThanOrEqual(rows[i - 1].dist);
    expect(placesAround(sectors, cam, 0, { ...AROUND, max: 10 })).toHaveLength(10);
  });
  it('puts planets where their orbits have them, and moons, the station and the parks only once near the system', () => {
    const sys = s.systems.find((x) => s.stations.some((st) => st.i === x.i) && x.planets.some((p) => p.moonList.length));
    const p = sys.planets.find((q) => q.moonList.length);
    const inside = placesAround(sectors, [sys.at[0] + sys.reach * 0.5, sys.at[1], sys.at[2]], 777, all);
    expect(inside.find((r) => r.id === p.id)).toMatchObject({ at: orbitAt(p, 777), park: parkDistance(resolvePlace(p.id, { t: 777 })) });
    expect(inside.find((r) => r.id === p.moonList[0].id).at).toEqual(moonAt(p.moonList[0], p, 777));
    expect(inside.some((r) => r.place === 'station' && r.src.row.i === sys.i)).toBe(true);
    const outside = placesAround(sectors, [sys.at[0] + sys.reach + AROUND.inside + 5000, sys.at[1], sys.at[2]], 777, all);
    expect(outside.find((r) => r.id === p.id).park).toBeNull();
    expect(outside.find((r) => r.id === sys.id).park).toBe(parkDistance(resolvePlace(sys.id, { t: 777 })));
    expect(outside.some((r) => r.id === p.moonList[0].id)).toBe(false);
  });
  it('lists a lattice thing near enough to be drawn, and not one further off', () => {
    const row = thingRow(s, 40);
    const near = placesAround(sectors, [row.at[0] + 4 * row.size, row.at[1], row.at[2]], 0, all);
    expect(near.find((r) => r.id === row.id)).toMatchObject({ place: 'thing', name: row.name, at: row.at });
    expect(placesAround(sectors, [row.at[0] + (THING_NEAR + 0.5) * row.size, row.at[1], row.at[2]], 0, all).some((r) => r.id === row.id)).toBe(false);
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
- [ ] **Step 3: Implement** `around.js`. It allocates no per-row objects for systems it rejects, and works out a planet's park only for the systems near enough. Measure `placesAround` over 27 sectors on a warmed run and say the time in the commit. Under 4 ms is the target.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 7 tests, each under a second.
- [ ] **Step 5: Commit.** `git commit -m "What's round the ship and which place it's at, each place's zone measured from its park"`

### Task 9: Picking, which names show, and docking, as rules

**Files:**
- Create: `src/components/universe/places/pick.js`, `pick.test.js`, `src/components/universe/places/dock.js`, `dock.test.js`

**Interfaces:**
- Consumes: Task 8's `Row`; `ship.js`'s `PARK_GAP`. The tests import `aim.js`'s `NAME_CONE`; the modules don't.
- Produces:
  - **`pickPlace(rows, project, px, py, { tanHalf, height }) → id | null`.**
    - `project(x, y, z, out)` is the scene's `toScreen`.
    - A row's radius on screen is `reach / (z · tanHalf) · height / 2`, held between 24 px and 160 px.
    - The nearest depth under the point wins. Nothing at a depth of 0.3 or less is picked.
    - This is `scene.js`'s `pickWonder` (`:1662-1667`), over rows.
  - **`TAGS_MAX = { low: 3, mid: 6, high: 6, ultra: 6 }`.**
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
import { TAGS_MAX, pickPlace, tagsFor } from './pick';

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
    expect(TAGS_MAX).toEqual({ low: 3, mid: 6, high: 6, ultra: 6 });
    const cone = NAME_CONE;
    expect(tagsFor(rows, { ship, nose, focus: ['picked'], max: 6, cone }).map((r) => r.id)).toEqual(['picked', 'ahead', 'aheadFar']);
    expect(tagsFor(rows, { ship, nose, focus: ['picked'], here: 'side', max: 6, cone }).map((r) => r.id)).toEqual(['picked', 'side', 'ahead', 'aheadFar']);
    expect(tagsFor(rows, { ship, nose, focus: ['picked'], max: 2, cone }).map((r) => r.id)).toEqual(['picked', 'ahead']);
    expect(tagsFor(rows, { ship, nose: [1, 0, 0], max: 6, cone }).map((r) => r.id)).toEqual(['side', 'picked']);
    expect(tagsFor(rows, { ship, nose, focus: [null, 'gone', 'picked', 'picked'], here: 'picked', max: 6, cone }).map((r) => r.id)).toEqual(['picked', 'ahead', 'aheadFar']);
  });
});
```

  `dock.test.js`, with a station row `{ id: 'E:1,0:w10003', place: 'station', at: [0, 0, 0], reach: 30 }`:
  - `dockState` at `30 + 4 + 2` and speed 0.5 is true, and at speed 1.5 is false.
  - At `30 + 4 + 3` from false it is false.
  - From true it is true at `30 + 4 + 29` and false at `30 + 4 + 31`.
  - A `place: 'planet'` row is false at any distance.
  - A docked ship drifting back and forth between `30 + 4 + 29` and `30 + 4 + 30` for 100 steps, at speeds up to 3, stays docked every step.

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/pick.test.js src/components/universe/places/dock.test.js`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** `pick.js` and `dock.js`.
- [ ] **Step 4: Run them and see them pass.** Same command, then `npx vitest run src/components/universe src/components/expanse`. Expected: PASS.
- [ ] **Step 5: Run PR 3.1's gate.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, with `boundary-breaks`, `cycles` and `big-files` as on the branch before Task 1.
- [ ] **Step 6: Commit.** `git commit -m "Rules for picking a generated place, naming the ones in view, and docking at a station"`

---

## PR 3.2: The wiring

### Task 10: The before shots, and the scene's travel moves out to `trips.js`

**Files:**
- Create: `src/components/universe/trips.js`, `src/components/universe/trips.test.js`, `lab/universe/before-3/mid/*` (from `universe-check`)
- Modify: `src/components/universe/scene.js`: the block from `const dropAuto = () => {` (`:1769`) through the end of `chasePilot` (`:1905`, before `// ── The ship ──`). `const wall = () => performance.now() / 1000;` (`:1766`) stays.
- Modify: `docs/superpowers/evidence/endless-universe-3/README.md` (the before rows)

**Interfaces:**
- Consumes: the moved block's own imports: `HYPER`, `driveById`, `hyperState`, `legOf`, `parkFor`, `portalById`, `OPEN_SPACE`, `headingTo`, `isGoal` (travel's own check, `:1782`), `REAIM_MS`, `parkBehind`, `pilotId`, `pilotSpace`, `reached`, `JAMMED` and `jumpState`. Lint names any that's missed.
- Produces: `createTrips(deps) → { travel(id, drive = deps.props().drive), dropAuto(), arriveAt(park), navTo(id), frontSpace(), withPilot(name), pilotGone(id, name), chasePilot() }`, behaving exactly as the block did.
  - `deps` is `{ state, props, emit, pilots, front, powers, unique, heard, retarget, invalidate, reduced, onFoot, wall, settle }`.
  - The call sits where the block was (`:1769`), so anything `scene.js` declares below it, or reassigns, is a thunk, called each time it's read and never at creation (Global Constraints, "Declared after, or changed later"):
    - `props: () => props`. It's `let props = ctx` (`:491`), reassigned on every page update (`props = next`, `:6120`). The block reads `props.drive` (travel's default drive) and `props.frozen` (no travel while the page is leaving or the Shipyard is up), so a value kept at creation would fly the first drive for ever and never freeze.
    - `powers: () => powers`, `const` at `:2338`, below the call. As a value it throws a `ReferenceError` (its temporal dead zone) as the scene loads.
    - `unique: () => unique`, `const` at `:2340`, the same.
    - `front: () => front` (`let`, `:1053`, set at `:1072`)
    - `heard: () => heard()` (`const` at `:1908`, below)
    - `retarget: (ms) => retarget(ms)`
    - `invalidate: () => ctx.invalidate()`
    - `settle: () => { camQOn = false; }` (`let camQOn`, `:1348`)
  - Plain values, declared above `:1769` and never reassigned: `state` (`:1174`), `emit` (`:1719`), `pilots` (`:1122`), `reduced` (`:490`), `onFoot` (`:843`) and `wall` (`:1766`).
  - `scene.js` puts `const { travel, dropAuto, arriveAt, navTo, frontSpace, withPilot, pilotGone, chasePilot } = createTrips({...});` in the block's place.

- [ ] **Step 1: Take the before shots** on the branch as it stands, after lanes 1, 2, 5a and 6a have merged and before any picture of this lane.
  - Run `node scripts/universe-check.mjs --quality mid --out lab/universe/before-3/mid`, on every pose including lane 2's `old-rim`, `above-core` and `expanse-system`. It takes about an hour in software GL. Run it in the background and wait on its exit.
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
- [ ] **Step 4: Move the block.** It goes verbatim into `trips.js`, with `const` closures over `deps`, and is wired into `scene.js` as in the Interfaces. In the moved text, `props.` reads become `deps.props().`, `powers.cancel()` becomes `deps.powers().cancel()`, `unique.clear()` becomes `deps.unique().clear()` and `ctx.invalidate()` becomes `deps.invalidate()`; nothing else in it changes. Count `scene.js`'s lines before and after.
- [ ] **Step 5: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS. A dep passed as a value where it should be a thunk throws as the scene loads, which the unit tests can't see: Step 6's smoke check loads `/universe` and fails on any page or console error.
- [ ] **Step 6: Check in the browser that travel is unchanged.** Expected: each as before the move.
  - `node scripts/navmap-check.mjs desktop`: the jump to a wonder by name
  - `node scripts/sector-check.mjs`: through the portal and on
  - `node scripts/flyto-check.mjs --fake`: to a pilot
  - `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe --quality mid`

  The first three draw no pose and take no quality flag: each loads `?quality=low` itself, as Global Constraints' "Browser checks" exempts them.
- [ ] **Step 7: Commit.** `git add src/components/universe/trips.js src/components/universe/trips.test.js src/components/universe/scene.js lab/universe/before-3 docs/superpowers/evidence/endless-universe-3 && git commit -m "The scene's travel moves to trips.js unchanged; before shots for lane 3"`. The body says `scene.js`'s line counts.

### Task 11: Trips go to generated places

**Files:**
- Modify: `src/components/universe/trips.js`, `src/components/universe/trips.test.js` (a new `describe`)
- Modify: `scripts/universe-endless-check.mjs` (`--only`, and the `travel` step)
- Modify `scene.js` in place. Each change says the lines it adds:
  - **The imports.**
    - `import { UNIVERSE } from '../expanse/gen/seed';` (`:222`) becomes `import { UNIVERSE, spaceTime } from '../expanse/shared/space';` (0). It moves one existing reach into the generator onto the face.
    - `import { resolvePlace } from './places/resolve';` and `import { followPark, parkPlace } from './places/park';` (+2).
  - **The state** (`:1178`'s object) gains `spaceT: spaceTime(reduced ? 0 : Date.now()), arrived: null, pending: null,` (+1).
  - **The clock**, where lane 2's `expanse.update({ …, now: … })` is called in `render()`: `const nowMs = state.held || reduced ? 0 : Date.now(); state.spaceT = spaceTime(nowMs);` comes before it, and the call takes `now: nowMs` (+1).
  - **The jump's way out** (`:4350-4356`, `const pid = pilotId(j.id); … else if (pid) pilotGone(j.id, j.name);`): six lines become `const park = outOfJump(j);` (−5).
  - **The trip's end** (`:4380-4384`): `const id = state.auto.id; state.auto = null; emit({ type: 'arrived', id, done: true });` becomes `endTrip(state.auto.id);` (−2). The name isn't `finish`: `scene.js` has its own `finish` at `:4925`.
  - **The follow:** `if (!state.jump) chasePilot();` (`:4369`) becomes `if (!state.jump) (chasePilot(), followPlace());` (0).
  - **Every other place that drops `state.auto`** drops the arrival and the wait with it, so neither outlives the trip:
    - the ship change (`:2152`), `startCrash` (`:3084`), the fall (`:3134`) and `portalThrough` (`:4250`): `state.auto = null;` becomes `state.auto = state.arrived = state.pending = null;` (0 each)
    - `takeover` (`:2251`): its `state.auto = null;` becomes `state.auto = state.arrived = null;`, and `state.pending = null;` goes before its `if (state.auto)`, since the stick calls off a trip still waiting on its sector (+1)
  - **The trips' deps** gain `resolve: (id) => resolvePlace(id, { universe, t: state.spaceT, sectors: expanse.sectors(), build: false })`. The inline `typeof ctx.universe === 'bigint' ? ctx.universe : UNIVERSE` at `createExpanse` (`:773`) becomes a `const universe` above it (+1). There's no `fetch` yet: a place outside the loaded sectors can't be gone to until Task 12 wires `places.fetch` in. Task 12 swaps both deps for `places`'.
  - **The dev hooks.**
    - `__universeDebug` (`:5911`) gains `places` on its existing line (0): `{ resolve: (id) => …, parkAt: (id, from, t0, t) => … }`. `resolve` is the deps' `resolve`. `parkAt` is `followPark(dest, parkPlace(dest, from, t0), t)`: the park a trip started from `from` at `t0` is at now.
    - `__universe()` (`:5923`) gains `t: state.spaceT` (0).

  Task 12's `places.debug` replaces the dev hook with the same two calls, so the check doesn't change.

  That is −1 in all: +6 against the −7 the jump's way out and the trip's end give back.

**Interfaces:**
- Consumes: Tasks 3, 4 and 7 (`canonicalPlace`, `isPlaceId`, `resolvePlace`, `parkPlace`, `followPark`, `placeSpace`, `atTime`).
- Produces (on `createTrips`, with `deps` gaining `resolve(id) → Destination | null` and an optional `fetch(id) → Promise<Destination | null>`):
  - **`travel(id, drive)` takes a generated id in any spelling.**
    - It canonicalises it and sets `state.arrived = null` and `state.pending = null`, as every travel now does.
    - **At hand** (`deps.resolve` finds it), it goes by an internal `go(dest, drive)`, which is all of the following:
      - `legOf` goes by the portal from the Curve.
      - The park is `parkPlace(dest, [s.x, s.z], state.spaceT)`.
      - `state.auto` (or `state.jump`) carries `place: { dest, park }`, and the auto carries `space: placeSpace(OPEN_SPACE, dest)`.
      - Reduced motion is `arriveAt(followPark(...))`.
    - **Not at hand, with `deps.fetch`:**
      - It sets `state.pending = { id, drive }` and returns true.
      - When the fetch lands and `state.pending` is still that same object, it clears it and goes with the landed Destination itself, `go(dest, pending.drive)`. It never resolves the id again: the fetched sector need not be among `deps.resolve`'s yet, and a second miss would fetch for ever.
      - A fetch that gives null, or rejects, emits `{ type: 'arrived', id, done: false }`.
      - A later travel, `dropAuto`, the stick, a crash or a portal clears `state.pending`, so a late landing does nothing.
    - **Not at hand, without `deps.fetch`:** false.
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
  });
  it('waits for a place whose sector isn’t made yet, then goes, unless something came first', async () => {
    let land;
    const fetch = vi.fn(() => new Promise((r) => { land = r; }));
    // (resolve still misses when the fetch lands: the trip goes with what landed, never resolving again)
    const a = make({ state: { spaceT: 0 }, deps: { resolve: () => null, fetch } });
    expect(a.trips.travel(id, 'super')).toBe(true);
    expect([a.state.auto, a.state.pending]).toEqual([null, { id, drive: 'super' }]);
    land(resolve(id));
    await flush();
    expect([a.state.auto?.id, a.state.pending]).toEqual([id, null]);
    expect(xyz(a.state.auto.park)).toEqual(xyz(parkPlace(resolve(id), [spawn('home').x, spawn('home').z], 0)));
    expect(fetch).toHaveBeenCalledTimes(1);
    const b = make({ state: { spaceT: 0 }, deps: { resolve: () => null, fetch } });
    b.trips.travel(id, 'super');
    b.trips.travel('marvel', 'super');
    land(resolve(id));
    await flush();
    expect(b.state.auto.id).toBe('marvel');
    const c = make({ state: { spaceT: 0 }, deps: { resolve: () => null, fetch } });
    c.trips.travel(id, 'super');
    c.trips.dropAuto();
    land(resolve(id));
    await flush();
    expect(c.state.auto).toBeNull();
    const d = make({ deps: { resolve: () => null, fetch: async () => null } });
    d.trips.travel('E:9,0:0', 'super');
    await flush();
    expect(d.events.at(-1)).toEqual({ type: 'arrived', id: 'E:9,0:0', done: false });
    const e = make({ deps: { resolve: () => null, fetch: async () => { throw new Error('the pool went away'); } } });
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
- Modify: `scripts/universe-endless-check.mjs` (the `dock` step; the `travel` step's planet leg, which checks the way-to-go marker)
- Modify `scene.js` in place. Each change says the lines it adds:
  - **The imports.**
    - `import { createScenePlaces } from './places/scenePlaces';` (+1).
    - Task 11's `import { resolvePlace } from './places/resolve';` becomes `import { isPlaceId } from './places/ids';` (0).
    - Its `places/park` import goes, now that `places` parks and follows (−1).
    - `aimTargets` leaves the `./aim` import's line (`:148`), now that `places` merges it (0).
  - **Created after `createExpanse`** (`:772-780`): `const places = createScenePlaces({ group: map, universe, expanse, workers: ctx.rt.workers, startAt: props.startAt, toScreen: (...a) => toScreen(...a), prepare: (o) => warm(o), emit: (e) => emit(e), note: (text) => { state.note = { text, until: wall() + 3 }; }, tier })` (+1). The trips' deps become `resolve: (id) => places.resolve(id), fetch: (id) => places.fetch(id)` (0).
    - Values, all declared above `:780` and never reassigned: `map` (`:503`), `universe` and `expanse` (Task 11's, `:772`), `ctx`, `tier` (`:641`). `props.startAt` is read once, for the start.
    - Closures, since each is declared below: `toScreen` (`:1526`), `warm` (`:948`), `emit` (`:1719`), and `state` (`:1174`) and `wall` (`:1766`) inside `note`.
  - **In `fly()`, before the step** (`:4405-4415`):
    - `if (!state.held) state.ship = places.carry(state.ship, state.carryT ?? state.spaceT, state.spaceT); state.carryT = state.spaceT;` (+1)
    - The step's `solidsNow = solidsWith(…, moving)` gains `places.solids()`, and so does the autopilot's `moving` (`:4371`) (0, both in place).
  - **The update, every frame.** In `render()`, right after `expanse.update(…)` (`:5340`), outside `fly()`, so it runs on foot, in a dive and frozen too (+1):

    ```js
    places.update({ ship: state.ship, camera, t: state.spaceT, flying: flying() && !onFoot() && !state.dive && !props.frozen, nose: state.ship ? noseOf(state.ship) : null, going: state.jump?.id ?? state.auto?.id ?? state.pending?.id ?? null, arrived: state.arrived, held: state.held })
    ```

    With `flying` false, it draws no tag and tracks nothing new: `here` and `docked` keep their last values.
  - **The aim** (`:803`): `aimTargets(sector, state.at)` becomes `places.aimTargets(sector, state.at)` (0). It is one merged array, kept between frames, not up to 2,000 rows spread afresh every frame. Generated stars aren't seen from inside the Curve.
  - **Names.** The aim's event (`:806`), the HUD's jump line (`:4868`, `:4872`) and `fightGoal` (`:3773`): `destinationById(id)` becomes `destinationById(id, places.look)` (0).
  - **The start** (`:2216`). The spawn's second argument becomes `(!state.sel && props.startAt && props.startAt !== MAW.id && (isGoal(props.startAt) ? parkFor(props.startAt, [0, 0]) : places.park(props.startAt, [0, 0]))) || startAt()` (0). After the spawn, `if (!state.sel && places.missing(props.startAt)) travel(props.startAt, 'hyper');` (+1). A link whose sector hadn't landed when the ship spawned goes there by the jump once it does. It usually has landed: `createScenePlaces` asks for the start's sector the moment the scene is made, seconds before a ship spawns.
  - **A crash into a generated body comes back off that body, not the home sun.** If lane 2 already fixed this, skip it and say so.
    - In `startCrash` (`:3083`): `if (solid.ship) …` gains `else if (isPlaceId(e.id)) state.crash.centre = [...solid.at];` on the next line (+1).
    - In the crash's way back (`:4162`): `c.ship ? { at: c.centre, …` becomes `c.ship || c.centre ? { at: c.centre, …` (0).
  - **The way-to-go marker** (`placeHud`, `:3017-3040`). Today `at` is found only for a hand-made place, a pilot, the front and `wonderById`, so for a generated goal the diamond hides. On a long trip to a generated place, out of tag range, nothing would show where you're going.
    - After `const war = …`: `const gm = !mate && !place && !war ? places.mark(goal.id, state.auto?.place?.dest) : null;` (+1)
    - `wd` is looked up only when there's no `gm` (`place || war || mate || gm ? null : wonderById(goal.id)`).
    - `at`, `reach` and the name take `gm.at`, `gm.reach` and `gm.name` before the wonder's (0, in place).
  - **`where()`** (`:6277`) gains `place: places.here()?.id ?? null, docked: places.docked(), t: state.spaceT,` (+1).
  - **The handle** gains `place: (id) => places.find(id),`, `fetchPlace: (id) => places.fetch(id),` and `nearby: (max) => places.nearby(max),`, one line each (+3).
  - **The dev hooks.** `__universe()` (`:5923`) gains `place: places.here()?.id ?? null, docked: places.docked(),` (+1). `__universeDebug.places` becomes `places.debug` (0).

  That is +11 here: +12 less the park import. With Task 11's −1 and Task 13's +2, Tasks 11 to 13 add 12 lines of the 40 allowed, against the ~130 Task 10 moved out.

**Interfaces:**
- Consumes: Tasks 3, 4, 5, 8 and 9; lane 2's `expanse.sectors()` (a `Map`), its `'expanse'` worker pool and `sectorJob` message (`{ type: 'sector', key, universe, sx, sy, sz }` → `{ key, sector }`), and `withMoons` through the face.
- Produces:
  - **`createStationLook(group, { prepare }) → { update(rows), dispose() }`.**
    - It is two `InstancedMesh`es of at most 8 instances, from one merged procedural station, built from `src/components/universe/kit.js`'s `parts` (a hub, a ring on four spokes, a docking arm):
      - the hull, a `MeshStandardMaterial` in `src/components/universe/palette.js`'s `PALETTE.bone` and `PALETTE.grey`
      - its lights, `kit.js`'s `glowMat` with `hot(PALETTE.sun.hex, 2.2)`, where `hot` is from `src/lib/three/canvasTexture.js`
    - `visible = false` at 0 instances, so it costs no draw call.
    - `prepare` is called once for each mesh, when it's made.
    - Each row's matrix is at `row.at`, scaled by `row.size × row.grow`.
  - **`createScenePlaces({ group, universe, expanse, workers, startAt, toScreen, prepare, emit, note, tier, clock = () => performance.now() / 1000 }) → { … }`**, with these methods. `clock` is the wall clock, passed in so the tests can drive it:
    - **`update({ ship, camera, t, flying, nose, going, arrived, held })`**, every frame:
      - **What's near.** It refreshes `placesAround(sectors, cam, t)` every 0.25 s of `clock`, or when the camera has moved over 500. `sectors` is lane 2's loaded ones and the fetched ones.
      - **Stations.** It draws the stations of systems whose `span` holds the camera, with `grow = smoothstep(span, 0.85 · span, dist to star)`.
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
    - **`fetch(id) → Promise<Destination | null>`:**
      - It resolves at once when it can.
      - Else it asks the pool for the sector: `workers.request('expanse', { type: 'sector', key: 'place|' + sectorKey, universe, sx, sy, sz })`. It puts the answer through `withMoons`, keeps it among the fetched sectors (the last 4), and resolves.
      - Its own key never settles the expanse's ask for the same sector.
      - Null for a malformed id, a sector whose answer is null, a request that rejects or is cancelled, or no `workers` (Node). It never rejects.
      - Asking twice for one sector shares one request.
    - **`find(id) → Destination | null`:** `resolve(id)`. On a miss for a well-formed id it starts a `fetch`, whose landing emits `'found'`.
    - **`missing(id) → boolean`:** a well-formed place id that `resolve` can't find yet.
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
  - `make({ sectors, universe, workers, startAt } = {})` builds `createScenePlaces` over a fake expanse whose loaded sectors are made once, in its own universe, as lane 2's expanse makes them in the scene's: `const own = sectors ?? new Map([['E:1,0', universe ? fullSector(universe, 1, 0, 0) : s]])` and `sectors: () => own`. It passes `universe` through (the shared one when it's left out), a `THREE.Group`, a `toScreen` that projects through the fake camera, `prepare` as a no-op, `emit` and `note` recorders, and a `clock` that rises by 1 each call, so every update refreshes what's near. It returns `{ p, events, notes }`.
  - `fakePool()` is `{ request: vi.fn(async (name, m) => sectorJob(m).answer), cancel: vi.fn() }`. It runs lane 2's own job in process, so the answer comes without moons, as from the worker, on a later microtask.
  - `fakeCamera(ship)` is a `PerspectiveCamera(34, 16 / 9, 0.1, 45000)` at the ship, looking along its heading.

  The file imports `vi` from Vitest, `THREE`, `PLACE`, `ship.js`'s `OPEN_SPACE`, `PARK_GAP`, `SOLIDS`, `headingTo`, `spawn` and `step`, `aim.js`'s `aimTargets`, `nav.js`'s `destinationById`, the face's `UNIVERSE`, `fullSector`, `moonAt`, `sectorJob` and `universeOf`, and Tasks 3, 4 and 8's `resolvePlace`, `parkPlace`, `followPark` and `hereZone`. It sets `s = fullSector(UNIVERSE, 1, 0, 0)` and the `len` and `xyz` helpers of Task 8. The tests:

```js
const st = s.stations[0];
const dest = resolvePlace(st.id, { t: 0 });
const park = parkPlace(dest, [st.at[0] + 2000, st.at[2]], 0);
const tick = (p, ship, more = {}) => p.update({ ship, camera: fakeCamera(ship), t: 0, flying: true, nose: [0, 0, -1], going: null, arrived: null, held: false, ...more });
const flush = () => new Promise((r) => setTimeout(r, 0));

it('arrives and docks at a station parked still beside it, and says so', () => {
  const { p, events, notes } = make();
  tick(p, { ...park, speed: 0 });
  expect(events).toEqual([{ type: 'place', what: 'arrive', id: st.id, name: st.name }, { type: 'place', what: 'dock', id: st.id, name: st.name, open: false }]);
  expect(notes).toEqual([PLACE.docked(st.name)]);
  expect([p.here()?.id, p.docked()]).toEqual([st.id, st.id]);
});
it('opens the hangar only for the trip that ended there, once', () => {
  const { p, events } = make();
  const arrived = { id: st.id };
  tick(p, { ...park, speed: 0 }, { arrived });
  expect(events.find((e) => e.what === 'dock').open).toBe(true);
  tick(p, { ...park, x: park.x + 200, speed: 0 }, { arrived });
  tick(p, { ...park, speed: 0 }, { arrived });
  expect(events.filter((e) => e.what === 'dock').map((e) => e.open)).toEqual([true, false]);
});
it('undocks and leaves as it flies off, back at the system, and arrives nowhere it is only passing', () => {
  const { p, events } = make();
  tick(p, { ...park, speed: 0 });
  const off = { ...park, x: park.x + 100, speed: 20 };
  tick(p, off);
  const sysRow = p.around().find((r) => r.id === st.system);
  const back = Math.hypot(off.x - sysRow.at[0], off.y - sysRow.at[1], off.z - sysRow.at[2]) < hereZone(sysRow).in;
  expect(events.slice(2).map((e) => [e.what, e.id])).toEqual([['undock', st.id], ['leave', st.id], ...(back ? [['arrive', st.system]] : [])]);
  const q = make();
  tick(q.p, { ...park, speed: 0 }, { going: 'E:1,0:5' });
  expect(q.events.some((e) => e.what === 'arrive')).toBe(false);
});
it('makes a drawn station solid, so flying into it is a crash with its id', () => {
  const { p } = make();
  tick(p, { ...park, speed: 0 });
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
  expect(p.missing('marvel')).toBe(false);
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
  const { p } = make();
  const ship = { ...park, speed: 0 };
  tick(p, ship);
  const a = p.aimTargets('main', null);
  expect(p.aimTargets('main', null)).toBe(a);
  expect(a.slice(0, aimTargets('main', null).length)).toEqual(aimTargets('main', null));
  expect(a.some((x) => x.id === st.system)).toBe(true);
  expect(p.aimTargets('rickmorty', null)).toEqual(aimTargets('rickmorty', null));
  tick(p, ship);
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
  const { p } = make();
  tick(p, { ...park, speed: 0 });
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
    - Calls and triangles are at most `before-3`'s plus 2 when a station is in the built system, and equal when there is none. Say which in the commit.
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
- Consumes: Task 9's `pickPlace`, `tagsFor` and `TAGS_MAX`; lane 6a's `chart/declutter.js` `declutter(labels, { bounds }) → Map<id, side | null>` and `boxOf(side, label) → { x0, y0, x1, y1 }`; `nav.js`'s `shortDistance`. `placeTags` passes `bounds` alone. `declutter`'s `bounds` is a box `{ x0, y0, x1, y1 }` (or a circle `{ cx, cy, r }`), never a `DOMRect`, whose `left`, `top`, `right` and `bottom` it doesn't read. Lane 6a's code (`e59d3d04`) also takes `sides`, `dots` and `hard`, and its plan lists `sides` and `dots`: `placeTags` uses none of them.
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
    - `tagsFor(around(), { ship, nose, focus: [going, aim, picked], here: here()?.id, max: TAGS_MAX[tier], cone: NAME_CONE })`
    - It shows none (`show([])`) while held or not `flying`. The update runs every frame from `render()` (Task 12), so the tags go on foot, in a dive and frozen too.
  - **`scenePlaces.pick(px, py, { tanHalf, height }) → id | null`:** `pickPlace` over `around()`, when flying.
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
  - beside the handle's effect, a new effect on `[on, meant]` calls `onLive?.(meant ? (on ? 'live' : 'loading') : 'flat')`. `on` and `meant` are `useWorld`'s (`:100`); `meant` is false when 3D is off, fails, is too slow or is lost (`useWorld.js:227`), which is when the flat `MiniMap` takes the box (`:501`).
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
- Modify: `src/components/universe/universe.css` (`.universe-facts`), `src/lib/words.test.js:23` (`FILES` gains `...list('components/universe/places/', /\.jsx$/)`)
- Modify: `src/components/universe/places/weight.test.js` (the page)
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
  - **`weight.test.js`** gains: `src/pages/Universe.jsx` reaches neither `places/resolve.js` nor `places/cards.js` (it does reach `expanse/gen/space.js` today, through `online/rosterWhere.js`, finding 21, so this test names those two files, not `GENERATOR`).
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
- Create: `docs/superpowers/evidence/endless-universe-3/HANDOFF-NOTES.md`
- Modify: `docs/superpowers/evidence/endless-universe-3/README.md`

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
- [ ] **Step 5: The full measure, once.** Run these in the background and wait on their exits:
  - `node scripts/universe-check.mjs --quality high --out lab/universe/after-3/high`, then the same for `mid` and `low`: every pose at every tier, about three hours here in all. Run them as three, because `universe-check.mjs` ignores `--out` when more than one tier runs (`:53`, `args.out && tiers.length === 1`), and `--quality all` would write over `lab/universe/<tier>`.
  - `QUALITY=mid node scripts/perf-probe.mjs universe` and `QUALITY=low …`, against Task 10's branch point

  Expected:
  - **Draw calls and triangles:** at every pose in `lab/universe/baseline/<tier>.json`, no higher. Generated stations are drawn only inside a generated system's reach, and the keep-outs keep every reach away from the hand-made poses, so the fourteen hand-made poses are equal.
  - **Frame time:** p50 no worse than 2%.
  - **New baseline:** `expanse-station` is recorded with `--quality <tier> --poses expanse-station --out lab/universe/endless/<tier>`, once a tier, and becomes its own baseline.
  - **Pixels:** `scripts/pixel-measure.mjs` against `before-3/mid` gives identical shots at the hand-made poses at mid.
- [ ] **Step 6: The endless check, whole.** Run `node scripts/universe-endless-check.mjs --quality mid` and then `--quality low`, all of lane 2's steps and this lane's. Expected: exit 0 both times, and the per-step table printed and copied into the README.
- [ ] **Step 7: The repo's checks.** Expected: each as on the branch before Task 1.
  - `node scripts/navmap-check.mjs`
  - `node scripts/sector-check.mjs`
  - `node scripts/flyto-check.mjs --fake`
  - `node scripts/links-check.mjs`
  - `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`

  The first four load `?quality=low` themselves and draw no pose. The smoke check runs at its default here, as the lane's gate.
- [ ] **Step 8: Write the README and the hand-off notes.**
  - **The README** holds:
    - before and after, side by side
    - the table of calls and triangles per pose and tier
    - frame times
    - the bundle numbers: `Front`, `CommandPalette`, `Interests` and `Terminal`, at Task 1's before, Task 1's after, Tasks 7 and 14 before and after, and the lane's whole growth
    - `scene.js`'s line count at each task
    - `boundary-breaks` and `cycles`, before and after
  - **`HANDOFF-NOTES.md`, "Landed":** every module above by path, with its interface in one line each, and the six new endless steps (`travel`, `dock`, `pick`, `link`, `flat` and `terminal`) and the pose.
  - **`HANDOFF-NOTES.md`, "Left":**
    - Lane 6b lists generated places on the chart and in search, from `handle.nearby()`, `where().t` and `findDestinations`' `more`, passing `{ place: handle.place }` to `nav.js`. A visited place outside the loaded sectors comes from `handle.fetchPlace(id)`, one worker build of about 45 ms a sector, so N visited ids in N sectors cost N builds. Resolve the ones in view, not the whole list.
    - The terminal's longest task at 4× throttling, and whether it's a finding (Task 14).
    - Lane 4a draws its kinds' cards (`THING_CARDS`) and counts the station as catalogue kind 11. It may restyle `stationLook.js`.
    - Lane 4b's trader event hails from a station's dock (the `'place'` `dock` event).
    - Lane 5b lands from `where().place` (a planet with `land: true`) and returns to `/universe/E:…`, which now starts parked at the place with its card up.
    - **Lane 6b, the "Star systems" filter.** Generated systems are `kind: 'star'`, and `KINDS`' "Star systems" is `'system'` (`nav.js:188`), the galaxy's gate systems. `findDestinations('system', …)` takes both now (Task 7). But `NavMap.jsx:317` groups a list by `d.kind === g.id`, so a generated system falls in no group, and `NavMap.jsx:243` and lane 6a's `chart/marks.js` leave `kind === 'system'` off the chart as a gate. When 6b wires search, it folds `'star'` into the "Star systems" group (or adds a `KINDS` row for it), and keeps generated systems on the chart.
    - **Anyone importing from `places/`**: from a module that loads with a page (`nav.js` and what it reaches, the page, the panel), take ids and `atTime` from `places/ids.js` and the orbits from `expanse/shared/orbits.js`, never from `places/resolve.js` or `expanse/shared/space.js`. `weight.test.js` fails otherwise.
    - Any finding from the bundle steps (Tasks 1, 7 and 14).
- [ ] **Step 9: Run the gates and commit.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, within budget. Then `git add -A src/components/universe/poses.js src/components/universe/poses.test.js scripts/universe-check.mjs lab/universe/after-3 lab/universe/endless docs/superpowers/evidence/endless-universe-3 && git commit -m "Lane 3 measured at every tier, a station pose, and its hand-off notes"`

---

## What later lanes consume

| Name | From | Used by |
|---|---|---|
| `canonicalPlace(id)`, `isPlaceId(id)`, `atTime(place, t)`: no generator behind them, for anything that loads with a page | `universe/places/ids.js` | 4a, 4b, 5b, 6b |
| `resolvePlace(id, { universe, t, sectors, build })`, `lookupOf(opts)`, `Destination`: the generator behind them, for the scene and the terminal only | `universe/places/resolve.js` | 4a, 4b, 5b, 6b |
| `orbitAt`, `moonAt`, `spaceTime`, `extentOf` (the light face) | `expanse/shared/orbits.js` | 5b, 6b |
| `cardRow(place, found, map)` | `places/pageCard.js` | 5b, 6b |
| `onLive('live' \| 'loading' \| 'flat')` | `UniverseMap.jsx`'s prop | 5b, 6b (what to show with no scene) |
| `reach(entry)` and `GENERATOR` in a test that pins what a page loads | `places/weight.test.js` | every later lane that imports into `nav.js` or the page |
| `THING_CARDS` (a row per kind: `type`, `about`, `color`, `solid`, `far`, `at?`), `placeCard`, `PLACE` | `places/cards.js`, `words.js` | 4a (its kinds' cards), 6b |
| `parkPlace(dest, from, t)`, `parkDistance`, `followPark`, `placeSpace`, `gapRadius`, `moonGap` | `places/park.js` | 4a ("Park" actions), 4b (events at a place), 5b (back in orbit) |
| `PARK_GAP`, `clearOf` | `ship.js` | 4a, 4b |
| `carry`, `carryFrames`, `carryZone`, `carryWeight`, `frameOf`, `CARRY` | `places/carry.js` | 5b (taking off into orbit: the planet is the frame) |
| `longTrip`, `TRIP` | `places/trip.js` | 6b |
| `destinationById(id, { place })`, `goalOf`, `canGo(id, { place })`, `legOf`, `parkFor(id, from, { place })`, `distanceTo(ship, id, { place })`, `tripTime(ship, id, drive, { place })`, `findDestinations(kind, q, { more, place })`, `findDestination(q, { place })` | `nav.js`. Generated places come only through the caller's `place` lookup. | 6b, 4c, 5b |
| `placesAround`, `orbitingPlace(ship, current, rows, prefer)`, `hereZone`, `aimStars`, `AROUND`, `Row` (with `park`) | `places/around.js` | 4b (zones), 6b (marks) |
| `pickPlace`, `tagsFor`, `TAGS_MAX`, `dockState`, `DOCK` | `places/pick.js`, `dock.js` | 4a (its own picks), 4b |
| `createPlaceTags(box, { onPick, doc })` → `{ show(list, { w, h }), dispose() }` | `places/placeTags.js` | 6b, if the chart's names want the same pool |
| `STATION_BASE`, `stationsOf`, `extentOf`, `fullSector(…).stations`, `placeIn`, and `withMoons` and `sectorJob` on the face | `expanse/gen/stations.js`, `space.js`, via `expanse/shared/space.js` | 4a, 4b (traffic between stations) |
| `places.look`, `places.resolve` (never builds), `places.fetch(id)` (one worker build a sector not at hand, about 45 ms; never rejects), `places.find`, `places.mark`, `places.aimTargets(sector, at)` (one kept array), `places.debug` | `places/scenePlaces.js` | 4b, 5b, 6b |
| `travel(id)` on `E:` ids (scene handle and `__universeDebug`), `where().place`, `where().docked`, `where().t`, `handle.place(id)`, `handle.fetchPlace(id)`, `handle.nearby(max)` | `scene.js`, `UniverseMap.jsx` | 4b, 5b, 6b |
| `{ type: 'place', what: 'arrive' \| 'leave' \| 'dock' \| 'undock' \| 'found', id, name?, open?, dest? }` | `scenePlaces.js` (the scene's `emit`) | 4b (the trader), 5b, 6b |
| `/universe/<E: id>`: starts parked with its card, found off the main thread | `Universe.jsx` | 5b (take-off's return), 4c |
| `PlaceCard` (and its pending row) | `places/PlaceCard.jsx` | 6b, 4a |
| `createTrips(deps)` (with `props`, `powers`, `unique` and `front` as thunks) with `resolve` and `fetch`, `state.spaceT`, `state.arrived`, `state.pending`, `endTrip`, `outOfJump` | `trips.js` | 4b, 4c |
| the `travel`, `dock`, `pick`, `link`, `flat` and `terminal` steps, `--only` | `scripts/universe-endless-check.mjs` | every later lane |

**For lane 6b in particular.**
- Resolving costs a whole sector for each sector not at hand: about 45 ms warm and up to 130 ms cold in Node here, several times that on a phone.
- `handle.fetchPlace(id)` makes it in the worker, so N visited ids in N sectors cost N worker builds. Fetch the visited places in view, not the whole list.
- Never call `resolvePlace` with `build` on the page.

## Assumptions about wave 1's unmerged work

Each of these can be checked once lane 2 (2.3 to 2.5), lane 1, lane 5a and lane 6a have merged.

1. `createExpanse(…).sectors()` returns a `Map` from the sector key to a `fullSector`-shaped sector, its moons through `withMoons`, and `stations` comes along from `sectorJob` unchanged (lane 2's Tasks 19 and 20). If not, scenePlaces reads `expanse.sector()` and the neighbours by key.
2. `expanse.solids()` lists the built bodies with the generator's `E:` ids, each `at` moved in place every frame (lane 2's Tasks 16, 17 and 21).
3. Lane 2's Task 17 calls `expanse.update({ …, now })` with `now = state.held || reduced ? 0 : Date.now()`, read through `spaceTime`. Task 11 makes `state.spaceT` the same value.
4. The built systems' planets sit at `orbitAt(p, t)` and their moons at `moonAt` with that `t` (lane 2's Task 16), so a pick, a tag and a park land on what's drawn.
5. `nearThings` draws a lattice thing within `THING_NEAR × size` and makes it solid as `{ r: size, reach: size * 1.2 }` (lane 2's Task 21). It leaves a legacy nebula out of the solids, since its `size` is a cloud's radius. If it doesn't, that's a lane 2 bug: a nebula's "fly into its middle" park would sit in a solid.
6. `OPEN_SPACE` has no roof, and the far plane is still 45,000 (on `main`, and lane 2's `levels.js`'s `FAR`).
7. `scripts/universe-endless-check.mjs` exists with steps `start`, `old-rim`, `boundary`, `system` and `climb`, a per-step recorder, and `__universeDebug.teleport(x, y, z, heading, pitch)` (lane 2's Task 22). So do the poses `expanse-system`, `old-rim` and `above-core`.
8. Lane 6a's `CHART_WORDS.sector` is in `words.js` (it writes a minus as `−`), and `chart/declutter.js`'s `declutter(labels, { bounds }) → Map<id, side | null>` and `boxOf(side, label) → { x0, y0, x1, y1 }` are merged, from 6a's Tasks 4 and 7. `bounds` is a box `{ x0, y0, x1, y1 }` or a circle `{ cx, cy, r }`. Both are on `eu/lane-6a` today (`declutter.js` last at `e59d3d04`). Its code also takes `sides`, `dots` and `hard` (6a's plan lists `sides` and `dots`, not `hard`). `placeTags` passes `bounds` alone, so it holds whichever lands.
9. Lane 2's PRs 2.3 to 2.5 leave `expanse/gen/space.js`'s `placeOf` and `fullSector` as they are on `main`. Lane 3 is the next to edit that file.
10. Whether lane 2's Task 17 fixed a crash into a generated body coming back at the home sun (`scene.js:4162` reads `SOLIDS`, not `solidsNow`). Task 12 fixes it if not.
11. Lane 2's `sectorJob({ type: 'sector', key, universe, sx, sy, sz })` builds from `sx, sy, sz` and gives `key` back untouched. So scenePlaces can ask on the `'expanse'` pool with a key of its own (`place|<sector key>`) without settling the expanse's own ask for that sector (`workers.js`: asking again for a key settles the first with null). `withMoons` and `sectorJob` are exported from `expanse/gen/job.js`, and the job's sector carries Task 1's `stations`.
12. `ctx.rt.workers` is the pool lane 2 passes to `createExpanse` (its Task 22, `scene.js:734`). In Node it's null, where `places.fetch` gives null.
13. The scene's `render()` still calls `expanse.update(…)` once a frame, after `aimAt()`, as it does at `:5340` on `main` (`:5305` on `eu/lane-2` today). Task 12's `places.update` goes right after it.
14. Lane 6a's Task 9 has the mini-map reach `nav.js` (through `chart/marks.js`, which imports `../nav` on `eu/lane-6a` today), so the home page's `Interests` chunk loads `nav.js`. If merged 6a's mini-map doesn't, `weight.test.js` drops its `toContain` line for `Interests.jsx` and keeps the generator check (Task 7).
15. The build still names the chunks `Front-*.js`, `CommandPalette-*.js`, `Interests-*.js` and `Terminal-*.js`, and writes static imports as `import … from "./x.js"`, which Task 1's `chunks.mjs` follows. Both hold on `eu/lane-2`'s `dist/` today (Vite 8).
16. Lane 2's pool `request` rejects, or gives null, when a request fails or is cancelled. Either way `places.fetch` gives null, and a trip waiting on it ends as not arrived.
17. Lane 2's `expanse-system` pose is parked off `e:1,0:0:0` at `t = 0` (its Task 22). If it builds that sector at `poses.js`'s top level, Task 15 moves it inside `poseFor`.

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
10. **The spec's line count is stale.** `scene.js` is 6,409 lines at `cc5e2eaf`, not the spec's 6,226. Lane 2's 2.3 has it at 6,374 so far.
11. **The bundle of every page that loads `nav.js`.** `nav.js` loads with `Interests` (the home page, through the mini-map, after lane 6a's Task 9), `CommandPalette` (⌘K, preloaded on every page, `App.jsx:392`) and `Front` (the site's root). A module is never split across chunks, so `nav.js` takes its ids from `places/ids.js` and its orbits from the light face, never from `resolve.js`, and generated places reach it only through a lookup the caller passes. `weight.test.js` pins it, and Tasks 7 and 14 hold each chunk's growth to 2 kB gzipped.
12. **Islands.** `boundary-breaks` has five imports of room (484 of 489). This lane adds the expanse's two faces, so it uses none of them. Lane 2's `rosterWhere.js` reaches `expanse/gen` directly, and could move onto the face.

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

## Spec coverage

- **Done item 4, "Every place you see, you can go to"** (all but "the map lists it", which is lane 6b's):
  - **It has a name** (Tasks 2 and 3, the tags in 13).
  - **You can pick it** (Tasks 9 and 13), aim at it and press J (Task 12).
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
  - fewer tags on `low` (Task 9)
  - no draw call for a station out of range (Task 12)
  - no sector made on the main thread by the scene or the page; spec A's rule, kept for the resolver (Tasks 3, 11, 12 and 14); the terminal's one build timed at 4× throttling (Task 14)
  - the generator kept off ⌘K and the home page, and those and the front door each held to 2 kB of growth (Tasks 7 and 14, `weight.test.js`)
  - trips to moving places that end at a frame or two a second, by the carry (Task 12's `travel` step in software GL)
  - the frame times in Task 15
- **The spec's counts:**
  - No count of 20 kinds or 15 events is this lane's.
  - The density targets are lane 2's, and stations add to them without touching them (Task 1 leaves `density.test.js` unchanged).
  - Pacing is lane 4b's.

## Self-review

- **Types:**
  - `Destination` is defined in Task 3 and read in Tasks 4–8 and 11–14.
  - `Row` is defined in Task 8 and read in 9, 12 and 13.
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
  - `createTrips`' deps: thunks for `props`, `powers`, `unique`, `front`, `heard`, `retarget`, `invalidate` and `settle` (Task 10), with `resolve` and `fetch` (Tasks 11 and 12). `createScenePlaces`' thunks are `tags`, `onPick` and `frame` (Task 13).
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
- **Test times.** RULES asks under a second a test. The heavy ones run over `E:1,0` alone: every planet's zone, about 25 planets parked past their moons for 60 s, and one planet over 600 updates. `step` costs about 20 µs here, and 6,000 steps took 121 ms.
