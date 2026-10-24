# Endless universe, lane 3: Places you can go. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every generated place (a star system, a planet, a moon, a station, a thing in space) has a name, a card and a parking spot. You can pick it, aim at it, and get there by the jump, super speed or cruise. A station docks you into the hangar and its shop. Nothing about a place is stored: an `E:` id goes through the pure generator every time it's asked for.

**Architecture:**
- **Pure first.** One system in three gets a station from its own seed (`expanse/gen/stations.js`). A new folder `universe/places/` holds the rest:
  - `resolve.js` turns an `E:` id into a destination row by running the generator.
  - `cards.js` holds the words and the numbers each kind is parked and shown by.
  - `park.js` says where the ship parks.
  - `carry.js` carries a parked ship round with a moving planet.
  - `trip.js` is the long-trip formula.
  - `around.js` says what's round the ship.
  - `pick.js` and `dock.js` hold the rules for picking, names and docking.
- **`nav.js`** accepts `E:` ids in every function the nav map and the scene call: `destinationById`, `goalOf`, `canGo`, `legOf`, `parkFor`, `distanceTo`, `tripTime` and `findDestination(s)`.
- **Wiring.**
  - The scene's travel block moves out of `scene.js` into `trips.js`, so `scene.js` shrinks by about 120 lines over the lane.
  - `places/scenePlaces.js` puts it together for the scene: what's near, the stations drawn and solid, the carry, where the ship is, docking, picking and the name tags.
  - The page reads `/universe/<E: id>` and shows the place's card. Docking at the end of a trip opens the Hangar on its shipyard tab.
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
- Pure first. `expanse/gen/*`, `expanse/shared/*` and `universe/places/{cards,resolve,park,carry,trip,around,pick,dock}.js` import no React, no DOM and no three.js. Each has its Node test before its drawing half.
- A changed picture is on purpose. The before shots come first (Task 10), at `--quality mid`.
- Draw calls and triangles are no higher at any pose in `lab/universe/baseline/<tier>.json`. Say the numbers.
- Before the lane is done: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` and `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`.
- Every commit is one plain sentence in the repo's voice. The body says why and gives the numbers, and it ends with the attribution lines the session's harness gives (`.claude/skills/autopilot/SKILL.md`, "Commit"). This plan writes the first line only, with no model names.
- The hand-off goes in `docs/superpowers/evidence/endless-universe-3/HANDOFF-NOTES.md`, not in `HANDOFF-universe.md`, which the coordinator folds.

**Code shape:**
- `src/components/universe/scene.js` doesn't grow. Task 10 moves the travel block out, about 130 lines. Tasks 11 to 13 add at most 40 lines between them, and each says how many lines it moves out and adds, by `wc -l` before and after.
- New files stay under 800 lines. `Universe.jsx` (649) and `UniversePanel.jsx` (350) stay under 800.
- **Islands.** The universe reaches the expanse's generator only through a new face, `src/components/expanse/shared/space.js`, as the expanse reaches the universe through `universe/shared/space.js`. `boundary-breaks` (484, budget 489) doesn't rise, and neither does `cycles` (5).
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
  - systems, things and wonders park `reach + 16` off
  - **reach by kind:**
    - a system: 2 × its star's size
    - a planet: the greater of 1.9 × its radius and its ring band's outer edge
    - a moon: 1.9 × its radius
    - a station: 1.5 × its size
    - a solid thing or wonder: 1.2 × its size, as lane 2's `nearThings` has it
    - a nebula: 0 (fly into its middle)
- **Carry:** all of a planet's or moon's motion within 2 reaches, easing to none at 4.
- **Long trips:**
  - `t = D / (SHIP.pulse × od) + extra + turn × angle / π`
  - `extra = { cruise: 7.1, super: 5.6 }` s and `turn = { cruise: 1.7, super: 0.5 }` s
  - the jump is `HYPER.length`
- **Around the ship:**
  - stars within 45,000 (the far plane) and planets within 20,000
  - moons and the station once inside their system's reach
  - lattice things within `THING_NEAR` × their size, as lane 2 draws them
  - at most 400, refreshed four times a second
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

   Pinned in Task 3 (resolver) and Task 7 (`findDestination`, `canGo`).
2. **A moving target.** A trip to a fast planet or moon stops, and the ship stays parked off it for minutes with the stick let go. A jump comes out where the place is at the flash, not where it was when the jump began. Pinned in Task 5 (carry), Task 4 (follow) and Task 11 (the jump's park).
3. **A pocket universe** (`/universe/E:1,0:0?seed=marble`). Every resolve the page and the scene make uses the pocket's universe, not the shared one: the card, the aim's name, travel and the start. Pinned in Task 3 (universe option) and Task 12 (`places.resolve` uses the scene's universe).
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

## Files

| File | Responsibility | Task |
|---|---|---|
| `src/components/expanse/gen/stations.js` (new) | a station at one system in three, from its seed | 1 |
| `src/components/expanse/gen/space.js` | `fullSector` gains `stations`; `placeIn` | 1 |
| `src/components/expanse/gen/tables.js` | `STATION_NAMES` | 1 |
| `src/components/expanse/shared/space.js` (new) | the expanse's face for the universe | 1 |
| `src/components/universe/words.js` | `PLACE` | 2 |
| `src/components/universe/ship.js` | `export const PARK_GAP` | 2 |
| `src/components/universe/places/cards.js` (new) | each kind's card: words, reach, solid, dock, land | 2 |
| `src/components/universe/places/resolve.js` (new) | `E:` id to destination row; `atTime` | 3 |
| `src/components/universe/places/park.js` (new) | parking, following a moving park, a trip's space | 4 |
| `src/components/universe/places/carry.js` (new) | a ship near a moving body goes with it | 5 |
| `src/components/universe/places/trip.js` (new) | the long-trip formula | 6 |
| `src/components/universe/nav.js` | `E:` ids in every destination function | 7 |
| `src/components/universe/places/around.js` (new) | what's near the ship; where it's at; stars to aim at | 8 |
| `src/components/universe/places/pick.js`, `dock.js` (new) | picking, which names show, docking | 9 |
| `src/components/universe/trips.js` (new) | the scene's travel block, moved out, then taught `E:` ids | 10, 11 |
| `src/components/universe/places/scenePlaces.js` (new) | the scene's places: around, stations, carry, here, dock, pick, tags | 12, 13 |
| `src/components/universe/places/stationLook.js` (new) | generated stations drawn, instanced | 12 |
| `src/components/universe/places/placeTags.js` (new) | the name tags, DOM | 13 |
| `src/components/universe/places/PlaceCard.jsx` (new) | a generated place's card | 14 |
| `src/components/universe/scene.js` | wiring only, smaller after | 10–13 |
| `src/components/universe/UniverseMap.jsx`, `UniversePanel.jsx`, `src/pages/Universe.jsx` | the card, the link, docking opens the Hangar | 14 |
| `src/components/universe/poses.js`, `scripts/universe-check.mjs`, `scripts/universe-endless-check.mjs` | a station pose; this lane's steps | 12–15 |

---

## PR 3.1: The pure half

### Task 1: Stations in the generator, and the expanse's face for the universe

**Files:**
- Create: `src/components/expanse/gen/stations.js`, `src/components/expanse/gen/stations.test.js`, `src/components/expanse/shared/space.js`, `src/components/expanse/shared/shared.test.js`
- Modify: `src/components/expanse/gen/space.js` (`fullSector` after `appendSystems(sector, outs)`; `wonderPlace` and `placeOf` at the file's end), `src/components/expanse/gen/tables.js` (append)

**Interfaces:**
- Consumes: `fullSector`, `systemReach`, `addBodies`' planet rows (`orbit`, `radius`, `ringBand`, `moonList`), `rngOf`, `hash64`, `range`, `pick` (`seed.js`), Task 0's `spaceId` and `parseSpaceId`.
- Produces:
  - **Constants:** `STATION_BASE = 10000`, `STATION_SHARE = 1 / 3`, `STATION_SIZE = [18, 36]`, and `STATION_NAMES = ['Station', 'Dock', 'Exchange', 'Port', 'Yards', 'Waystation']` (in `tables.js`).
  - **`extentOf(planet) → number`:** how far from its middle a planet's body, ring and moons reach, `max(radius, ringBand?.outer ?? 0, last moon's orbit + radius)`.
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
    - `placeOf(universe, id)` becomes `placeIn(sectorFor(universe, p), p)`, with the same behaviour.
  - **`src/components/expanse/shared/space.js`** lends exactly these names: `UNIVERSE`, `universeOf`, `fullSector`, `placeOf`, `placeIn`, `orbitAt`, `moonAt`, `bodiesAt`, `spaceTime`, `systemReach`, `THING_BASE`, `THING_CELLS`, `THING_NEAR`, `THING_KINDS`, `SECTOR_EXTRAS`, `thingRow`, `WONDER_KINDS`, `STATION_BASE`, `stationsOf`, `extentOf`.

- [ ] **Step 1: Write the failing tests.** `stations.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { parseSpaceId, spaceId } from '../../../lib/space/address.js';
import { fullSector, placeIn, placeOf } from './space';
import { UNIVERSE, universeOf } from './seed';
import { moonAt, orbitAt } from './orbits';
import { THING_BASE, THING_CELLS, thingRow } from './things';
import { STATION_BASE, STATION_SHARE, extentOf, poleHeight, stationsOf } from './stations';

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
});
```

  `expanse/shared/shared.test.js` pins the face's names. It mirrors `universe/shared/shared.test.js`: the module's sorted keys equal the list above, and each is a function, an object or a number (`UNIVERSE` is a bigint, so `'bigint'` is allowed too).

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/stations.test.js src/components/expanse/shared`. Expected: FAIL, because `./stations` and `./space` can't be resolved.
- [ ] **Step 3: Implement** `stations.js` to the Interfaces, append `STATION_NAMES`, wire `stations` into `fullSector`, export `placeIn`, and write the face. The header comments are in the repo's voice, listing the exports as `things.js` does. The station header says why the pole: planets keep within ±40 of their star's plane, so a point over the pole is clear at every `t` and needs no orbit of its own.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse`. Expected: PASS, with `fingerprint.test.js`, `space.test.js`, `density.test.js` and lane 2's `job.test.js` unchanged and green.
- [ ] **Step 5: Commit.** `git add src/components/expanse && git commit -m "Stations at one system in three, and the expanse's face for the universe"`

### Task 2: The words and cards for generated places

**Files:**
- Modify: `src/components/universe/words.js` (append `PLACE`), `src/components/universe/ship.js:147-149` (the private `ORBIT_IN`, `ORBIT_OUT` and `PARK`: add `export const PARK_GAP` beside them, +1 line)
- Create: `src/components/universe/places/cards.js`, `src/components/universe/places/cards.test.js`

**Interfaces:**
- Consumes: Task 1's face (`THING_KINDS`, `WONDER_KINDS`).
- Produces:
  - **`PARK_GAP = { near: PARK, deep: PARK * 4, in: ORBIT_IN, out: ORBIT_OUT }`** in `ship.js` (4, 16, 8, 14).
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
import { PARK_GAP } from '../ship';
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
  it('parks by ship.js’s own numbers', () => expect(PARK_GAP).toEqual({ near: 4, deep: 16, in: 8, out: 14 }));
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

### Task 3: The resolver

**Files:**
- Create: `src/components/universe/places/resolve.js`, `src/components/universe/places/resolve.test.js`

**Interfaces:**
- Consumes: Task 1's face (`placeIn`, `placeOf`, `orbitAt`, `moonAt`, `spaceTime`, `UNIVERSE`), Task 2's `placeCard`, Task 0's `parseSpaceId` and `spaceId`.
- Produces:
  - **`isPlaceId(id) → boolean`**, true when `parseSpaceId` reads it.
  - **`canonicalPlace(id) → string | null`**: the generator's form, `spaceId([sx, sy, sz], ...parts)`.
  - **`placeOpts(opts = {}) → { universe, t, sectors }`**. The defaults are `UNIVERSE`, `spaceTime(Date.now())` and `null`.
  - **`resolvePlace(id, opts) → Destination | null`.**
    - It looks in `opts.sectors.get(key)` first (a scene's `Map` of loaded sectors), else in `placeOf(universe, id)`.
    - It is null for anything not there, never throws, and stores nothing.
    - It makes the card afresh on every call, which is cheap. `placeOf` keeps its own eight sectors.
  - **`Destination`** is Task 2's `Card` and:
    ```
    { id (canonical), generated: true, place: 'system' | 'planet' | 'moon' | 'station' | 'thing' | 'extra' | 'wonder',
      at: [x, y, z] (at t), t, moving (planet or moon, or a card with at()), sector: 'main', key: sectorKey,
      cube: [sx, sy, sz], to: null, src: { row, system, planet } (the generator's rows, read-only) }
    ```
    `sector` is always `'main'`: the keep-outs keep every generated place out of the Rick and Morty pocket, so `legOf` reads it as the main map's.
  - **`atTime(place, t) → [x, y, z]`**, over anything with `{ place, src }` (a `Destination` or Task 8's `Row`):
    - a planet: `orbitAt(src.row, t)`
    - a moon: `moonAt(src.row, src.planet, t)`
    - a card with `at(row, t)`: that
    - otherwise `src.row.at`

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { UNIVERSE, fullSector, moonAt, orbitAt, thingRow, universeOf } from '../../expanse/shared/space';
import { atTime, canonicalPlace, isPlaceId, placeOpts, resolvePlace } from './resolve';

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
  it('looks in the sectors it is given before making one', () => {
    const doctored = { ...s, systems: s.systems.map((x, i) => (i === 0 ? { ...x, name: 'Testing' } : x)) };
    expect(resolvePlace('E:1,0:0', { t: 0, sectors: new Map([['E:1,0', doctored]]) }).name).toBe('Testing');
  });
  it('resolves in the universe it’s given', () => {
    expect(resolvePlace('E:1,0:0', { t: 0, universe: universeOf('marble') }).name).not.toBe(sys.name);
  });
  it('says where a place is at any time, and reads the shared clock by default', () => {
    const d = resolvePlace(p.id, { t: 0 });
    expect(atTime(d, 9e8)).toEqual(orbitAt(p, 9e8));
    expect(atTime(resolvePlace(sys.id, { t: 0 }), 9e8)).toEqual(sys.at);
    expect(Math.abs(placeOpts().t - Date.now() / 1000)).toBeLessThan(5);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/resolve.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `resolve.js`. Its header says what it never does: store a row.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 6 tests.
- [ ] **Step 5: Commit.** `git commit -m "An E: id resolves to a destination by running the generator, nothing stored"`

### Task 4: Parking, a park that moves, and a trip's space

**Files:**
- Create: `src/components/universe/places/park.js`, `src/components/universe/places/park.test.js`

**Interfaces:**
- Consumes: Task 3's `resolvePlace` and `atTime`; Task 1's `extentOf`; `ship.js`'s `SHIP`, `PARK_GAP`, `headingTo`, `forward`, `OPEN_SPACE`, `SOLIDS`, `autopilot` and `step`.
- Produces:
  - **`gapRadius(system, least, margin) → number`:** the least `r ≥ least` with `|r − p.orbit| ≥ extentOf(p) + margin` for every planet.
  - **`parkPlace(dest, from: [x, z], t) → Park | null`**, where `Park` is `{ x, y, z, heading, offset: [dx, dy, dz] }` and `offset` is the park less `atTime(dest, t)`.
    - **Distance.** `d = reach + (deep ? PARK_GAP.deep : PARK_GAP.near)`, except:
      - a system: `d = gapRadius(system, d, PARK_GAP.deep + 40)`
      - a planet: when no direction at `d` is clear of every moon's orbit, `d` becomes the last moon's `orbit + radius + PARK_GAP.near + 2`
    - **Direction.** Of 32 level directions, the best score, ties to the lower index, as `ship.js`'s `parkAt` scores. The score is the sum of:
      - the facing toward `from`
      - +3 on a planet's or moon's day side (its star at `src.system.at`)
      - +6 when clear of every moon's whole orbit (64 samples of each moon's circle round the planet)
    - **Height and heading.** `y = at[1] + (deep ? 0 : SHIP.height)`. `heading` faces the place.
  - **`followPark(dest, park, t) → Park`:** the same offset and heading, from `atTime(dest, t)`.
  - **`placeSpace(space, dest) → space`:** `space` with `goals[dest.id] = { id, at: [...dest.at], r: dest.r, reach: dest.reach }`, every other goal as it was. It is `pilotGoal.js`'s `pilotSpace`'s way. The goal's `at` is that space's own array, which the trip moves in place.

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { OPEN_SPACE, PARK_GAP, SHIP, SOLIDS, autopilot, forward, spawn, step } from '../ship';
import { UNIVERSE, extentOf, fullSector, thingRow } from '../../expanse/shared/space';
import { atTime, resolvePlace } from './resolve';
import { followPark, gapRadius, parkPlace, placeSpace } from './park';

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
      expect(faces(park, d.at)).toBeGreaterThan(0.99);
      expect(park.offset).toEqual([park.x - d.at[0], park.y - d.at[1], park.z - d.at[2]]);
      for (const m of p.moonList) {
        for (let i = 0; i < 64; i++) expect(len(park.offset, circle(m, (i / 64) * 2 * Math.PI))).toBeGreaterThanOrEqual(m.radius + SHIP.radius + 1);
      }
      const star = d.src.system.at;
      if ((park.x - d.at[0]) * (star[0] - d.at[0]) + (park.z - d.at[2]) * (star[2] - d.at[2]) >= 0) day++;
    }
    expect(day / planets.length).toBeGreaterThan(0.8);
  });
  it('parks off a system’s star in a gap between its planets’ orbits', () => {
    for (const sys of s.systems.slice(0, 60)) {
      const d = resolvePlace(sys.id, { t: 0 });
      const park = parkPlace(d, [0, 0], 0);
      const r = Math.hypot(park.x - sys.at[0], park.z - sys.at[2]);
      expect(r).toBeCloseTo(gapRadius(sys, d.reach + PARK_GAP.deep, PARK_GAP.deep + 40), 6);
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
- [ ] **Step 3: Implement** `park.js`. The header says why a system parks in a gap: a giant on a small star's first orbit can sweep through any fixed ring near the star.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git commit -m "Parking at a generated place: off its day side, clear of its moons, in a gap at a star"`

### Task 5: The carry, so a parked ship stays in orbit

A generated planet moves up to about 0.9 units a second (orbit 180, 52 turns a cycle), and a moon a little more. The autopilot's stop needs the ship under 0.25 units a second, and a parked ship drifts off at the planet's speed. So a ship near a moving body is carried with it, and the trip happens in the body's frame.

**Files:**
- Create: `src/components/universe/places/carry.js`, `src/components/universe/places/carry.test.js`

**Interfaces:**
- Consumes: Task 3's `atTime`; Task 4's `parkPlace` and `followPark` (in the tests).
- Produces:
  - **`CARRY = { inner: 2, outer: 4 }`**, in reaches.
  - **`carryWeight(dist, reach) → 0…1`:** `1 − smoothstep(inner·reach, outer·reach, dist)`.
  - **`carry(ship, bodies, t0, t1) → ship`.**
    - `bodies` are destinations or rows with `place` of `'planet'` or `'moon'`. The body with the highest weight at `t0` carries the ship, the smaller `reach` breaking ties, so a moon wins inside its own zone.
    - The ship moves by `w × (atTime(b, t1) − atTime(b, t0))`.
    - It returns the same object when `w` is 0 or `t1 === t0`.

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { OPEN_SPACE, SOLIDS, autopilot, spawn, step } from '../ship';
import { UNIVERSE, fullSector, moonAt, orbitAt } from '../../expanse/shared/space';
import { atTime, resolvePlace } from './resolve';
import { followPark, parkPlace, placeSpace } from './park';
import { CARRY, carry, carryWeight } from './carry';

const s = fullSector(UNIVERSE, 1, 0, 0);
const planets = s.systems.flatMap((x) => x.planets);
const speed = (p) => (2 * Math.PI * p.orbit * p.revs) / 65536;
const fastest = planets.reduce((a, b) => (speed(b) > speed(a) ? b : a));
const mooned = planets.filter((p) => p.moonList.length).reduce((a, b) => (b.moonList[0].revs > a.moonList[0].revs ? b : a));
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const xyz = (k) => [k.x, k.y, k.z];
const solidsAt = (p, t) => [...SOLIDS, { id: p.id, at: orbitAt(p, t), r: p.radius, reach: p.radius * 1.9 }, ...p.moonList.map((m) => ({ id: m.id, at: moonAt(m, p, t), r: m.radius, reach: m.radius * 1.9 }))];

describe('the carry', () => {
  it('is all of it close in, none far out, and smooth between', () => {
    expect(CARRY).toEqual({ inner: 2, outer: 4 });
    expect([carryWeight(0, 50), carryWeight(100, 50), carryWeight(200, 50), carryWeight(1e6, 50)]).toEqual([1, 1, 0, 0]);
    for (let d = 100; d < 200; d += 1) expect(Math.abs(carryWeight(d + 1, 50) - carryWeight(d, 50))).toBeLessThan(0.03);
  });
  it('moves a ship by what its planet moved, or a moon’s ship by its moon', () => {
    const d = resolvePlace(fastest.id, { t: 100 }); // (d.at is where it is at t = 100, where the carry measures from)
    const ship = { ...spawn(null), x: d.at[0] + d.reach + 4, y: d.at[1], z: d.at[2] };
    const moved = carry(ship, [d], 100, 101);
    const dp = atTime(d, 101).map((v, i) => v - atTime(d, 100)[i]);
    expect([moved.x - ship.x, moved.y - ship.y, moved.z - ship.z].map((v, i) => v - dp[i]).every((v) => Math.abs(v) < 1e-9)).toBe(true);
    expect(carry(ship, [d], 100, 100)).toBe(ship);
    expect(carry({ ...ship, x: d.at[0] + d.reach * 5 }, [d], 100, 101).x).toBe(d.at[0] + d.reach * 5);
    const md = resolvePlace(mooned.moonList[0].id, { t: 100 });
    const atMoon = { ...spawn(null), x: md.at[0] + md.reach + 4, y: md.at[1], z: md.at[2] };
    const step2 = carry(atMoon, [resolvePlace(mooned.id, { t: 100 }), md], 100, 101);
    expect(step2.x - atMoon.x).toBeCloseTo(atTime(md, 101)[0] - atTime(md, 100)[0], 9);
  });
  it('keeps a parked ship in orbit of a fast planet for five minutes with the stick let go', () => {
    expect(speed(fastest)).toBeGreaterThan(0.5);
    const d = resolvePlace(fastest.id, { t: 0 });
    const park = parkPlace(d, [d.at[0] + 5000, d.at[2]], 0);
    let ship = { ...spawn(null), ...park };
    for (let t = 0; t < 300; t += 0.1) {
      ship = carry(ship, [d], t, t + 0.1);
      ship = step(ship, { throttle: 0 }, 0.1, solidsAt(fastest, t + 0.1), OPEN_SPACE).ship;
      expect(len(xyz(ship), atTime(d, t + 0.1))).toBeGreaterThan(fastest.radius);
    }
    expect(len(xyz(ship), xyz(followPark(d, park, 300)))).toBeLessThan(1);
  });
  it('brings the autopilot to rest at a fast moon', () => {
    const m = resolvePlace(mooned.moonList[0].id, { t: 0 });
    const planet = resolvePlace(mooned.id, { t: 0 });
    let ship = { ...spawn(null), x: m.at[0] + 900, y: m.at[1], z: m.at[2] };
    const park = parkPlace(m, [ship.x, ship.z], 0);
    const space = placeSpace(OPEN_SPACE, m);
    let done = false;
    for (let t = 0; t < 90 && !done; t += 1 / 30) {
      const a = autopilot(ship, m.id, followPark(m, park, t), space, 1, null, solidsAt(mooned, t).slice(SOLIDS.length));
      done = a.done;
      ship = step(carry(ship, [planet, m], t, t + 1 / 30), a.input, 1 / 30, solidsAt(mooned, t + 1 / 30), space).ship;
    }
    expect(done).toBe(true);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/carry.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `carry.js`. The header gives the speeds above as the why.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 4 tests, under 3 s.
- [ ] **Step 5: Commit.** `git commit -m "A ship near a generated planet or moon goes round with it, so a park stays a park"`

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
- Create: `docs/superpowers/evidence/endless-universe-3/README.md` (the bundle numbers)

**Interfaces:**
- Consumes: Tasks 3, 4 and 6.
- Produces (every signature keeps its old arguments and adds an `opts` that defaults to `{}`; `opts` is Task 3's `placeOpts` input):
  - **`destinationById(id, opts) → row | null`:** a hand-made row as before, else `resolvePlace(id, opts)`.
  - **`goalOf(id)`:** the system's gate, else `canonicalPlace(id)`, else `id`.
  - **`canGo(id, opts) → boolean`:** `isGoal(goalOf(id))`, or a resolvable generated id.
  - **`legOf(ship, id, pose)`:** a generated goal is in `'main'`, so from the Curve it goes by `'rmportal-back'`, from anywhere else straight.
  - **`parkFor(id, from, opts)`:** a generated id gives `parkPlace(resolvePlace(id, opts), from, t)`.
  - **`distanceTo(ship, id, opts)`:** generated, `max(0, |ship − at| − reach)`, plus the portal leg as for any place.
  - **`tripTime(ship, id, drive, { limit, dt, ...opts })`:**
    - generated, by the jump: `HYPER.length`
    - generated, by any other drive: `longTrip(ship, parkFor(id, [ship.x, ship.z], opts), drive)`, after a portal leg when there is one
    - hand-made: the simulation as today, and `longTrip` when it doesn't arrive within `limit` (a far trip had `null` before, a dash on the nav map)
    - still `null` for no ship or nowhere
  - **`findDestinations(kind, query, { more = [] })`:**
    - `more` are destination rows (the places in view, the visited: lane 6b passes them), searched with `DESTINATIONS`, de-duplicated by id
    - a generated row also matches by its id
    - `kind` matches a row's `kind`, so `'star'` finds generated systems
  - **`findDestination(query, opts)`:** a generated id in any spelling resolves before the name search.

- [ ] **Step 1: Write the failing tests** (appended to `nav.test.js`, with imports added at the top):

```js
describe('generated places', () => {
  const U = { t: 0 };
  const s = fullSector(UNIVERSE, 1, 0, 0);
  const sys = s.systems[0];
  const home = () => ({ ...spawn('home') });
  const curve = () => ({ ...spawn(null), x: RM[0], y: 0, z: RM[2] + 500 });

  it('are destinations by any spelling, made by the generator, never listed', () => {
    expect(destinationById('e:1,0:0', U)).toMatchObject({ id: sys.id, generated: true, name: sys.name });
    expect(goalOf('e:1,0,0:0')).toBe(sys.id);
    expect([canGo(sys.id, U), canGo(`E:1,0:${s.systems.length}`, U), canGo('marvel'), canGo('nope')]).toEqual([true, false, true, false]);
    expect(DESTINATIONS.some((d) => d.generated)).toBe(false);
  });
  it('are parked at, measured, and reached from the Curve by its portal', () => {
    const d = resolvePlace(sys.id, U);
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
    const more = [resolvePlace(sys.id, U), resolvePlace(sys.planets[0].id, U)];
    expect(findDestinations('all', sys.name, { more }).map((x) => x.id)).toContain(sys.id);
    expect(findDestinations('star', '', { more }).map((x) => x.id)).toEqual([sys.id]);
    expect(findDestinations('all', 'e:1,0:0', { more }).map((x) => x.id)).toContain(sys.id);
    expect(findDestinations('all', 'resume', { more }).map((x) => x.id)).toEqual(['resume']);
    expect(findDestinations('all', '', { more: [...more, more[0]] }).filter((x) => x.id === sys.id)).toHaveLength(1);
    expect(findDestination('e:1,0:0', U)?.id).toBe(sys.id);
    expect(findDestination(`E:1,0:${s.systems.length}`, U)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/nav.test.js`. Expected: the new `describe` FAILS (`canGo` is not exported). Every test above it passes.
- [ ] **Step 3: Record the bundle before.** Run `npm run build` and write the `Interests-*.js` and `UniverseMap-*.js` chunk sizes (raw and gzip) from Vite's report into the evidence README. `nav.js` is on the home page's lazy section through the mini-map (lane 6a's Task 9).
- [ ] **Step 4: Implement** the Interfaces. The file header gains one paragraph on generated places: resolved, never listed, parked by `places/park.js`, timed by `places/trip.js`.
- [ ] **Step 5: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS, with every existing test in `nav.test.js` unchanged.
- [ ] **Step 6: Record the bundle after, and the islands.**
  - Run `npm run build` again and add the two chunks' after-sizes to the README.
  - Run `node scripts/health.mjs --check --skip build`. Expected: `boundary-breaks` and `cycles` as on the branch before Task 1 (484 and 5 at `cc5e2eaf`).
  - If the `Interests` chunk grew by more than 15 kB gzipped, say so in the README as a finding for the coordinator. The generator now rides with the mini-map, and the fix (a mini-map that doesn't import `nav.js`'s functions) is lane 6b's to weigh.
- [ ] **Step 7: Commit.** `git add src/components/universe/nav.js src/components/universe/nav.test.js docs/superpowers/evidence/endless-universe-3 && git commit -m "The nav map's places take E: ids: parked, measured, timed and found"`

### Task 8: What's round the ship

**Files:**
- Create: `src/components/universe/places/around.js`, `src/components/universe/places/around.test.js`

**Interfaces:**
- Consumes: Task 1's face; Tasks 2 and 3; `ship.js`'s `PARK_GAP`; Task 0's `SECTOR` and `sectorCentre`.
- Produces:
  - **`AROUND = { far: 45000, planets: 20000, max: 400 }`.**
  - **`Row`** is `{ id, place, kind, name, at, r, reach, deep, color, dist, src }`, where `dist = max(0, |cam − at| − reach)`. It is a light destination: `resolvePlace(row.id)` gives the card.
  - **`placesAround(sectors, cam, t, { far, planets, max } = AROUND) → Row[]`**, nearest `dist` first, at most `max`. `sectors` is a `Map` or any iterable of sectors. It lists:
    - every system whose `dist` is within `far`
    - the planets (at `orbitAt(p, t)`) of systems within `planets`
    - the moons (at `moonAt`) and the station of every system whose `span` holds `cam`
    - each lattice thing within `THING_NEAR × size`, found by looking only in the cells round the camera's cell (±1, 6,000 each) of the sectors whose cube is within 6,000, binary-searched in `things.slot`
    - extras and legacy wonders within their card's `far` (45,000 by default)
  - **`orbitingPlace(ship, current, rows) → id | null`.**
    - Of the rows whose surface gap is under `gap + PARK_GAP.in` (`gap` is `PARK_GAP.deep` or `PARK_GAP.near` by the row's `deep`), the ship is at the one with the least `reach`: the most particular place. A station over a big star's pole is inside that star's own zone, and the station is where you are.
    - It stays at `current` till its gap is past `gap + PARK_GAP.out`, unless a row with a smaller reach takes it.
    - It mirrors `ship.js`'s `orbiting`.
  - **`aimStars(sectors, cam, { max = 2000 }) → [{ id, at, reach }]`:** every system of the sectors, nearest first, with `reach = span`, for `aim.js`'s `aimFrom`, which leaves out those near enough to be themselves.

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { PARK_GAP } from '../ship';
import { THING_NEAR, UNIVERSE, fullSector, moonAt, orbitAt, thingRow } from '../../expanse/shared/space';
import { resolvePlace } from './resolve';
import { parkPlace } from './park';
import { AROUND, aimStars, orbitingPlace, placesAround } from './around';

const sectors = new Map([[1, 0, 0], [2, 0, 0], [1, 1, 0]].map(([x, y, z]) => fullSector(UNIVERSE, x, y, z)).map((s) => [s.id, s]));
const s = sectors.get('E:1,0');
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
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
  it('puts planets where their orbits have them, and moons and the station only once inside the system', () => {
    const sys = s.systems.find((x) => s.stations.some((st) => st.i === x.i) && x.planets.some((p) => p.moonList.length));
    const p = sys.planets.find((q) => q.moonList.length);
    const inside = placesAround(sectors, [sys.at[0] + sys.reach * 0.5, sys.at[1], sys.at[2]], 777, all);
    expect(inside.find((r) => r.id === p.id).at).toEqual(orbitAt(p, 777));
    expect(inside.find((r) => r.id === p.moonList[0].id).at).toEqual(moonAt(p.moonList[0], p, 777));
    expect(inside.some((r) => r.place === 'station' && r.src.row.i === sys.i)).toBe(true);
    const outside = placesAround(sectors, [sys.at[0] + sys.reach + 5000, sys.at[1], sys.at[2]], 777, all);
    expect(outside.some((r) => r.id === p.id)).toBe(true);
    expect(outside.some((r) => r.id === p.moonList[0].id)).toBe(false);
  });
  it('lists a lattice thing near enough to be drawn, and not one further off', () => {
    const row = thingRow(s, 40);
    const near = placesAround(sectors, [row.at[0] + 4 * row.size, row.at[1], row.at[2]], 0, all);
    expect(near.find((r) => r.id === row.id)).toMatchObject({ place: 'thing', name: row.name, at: row.at });
    expect(placesAround(sectors, [row.at[0] + (THING_NEAR + 0.5) * row.size, row.at[1], row.at[2]], 0, all).some((r) => r.id === row.id)).toBe(false);
  });
  it('says which place the ship is at, and keeps it till it has clearly left', () => {
    const st = s.stations[0];
    const rows = placesAround(sectors, st.at, 0, all);
    const reach = rows.find((r) => r.id === st.id).reach;
    const ship = (d) => ({ x: st.at[0] + d, y: st.at[1], z: st.at[2] });
    expect(orbitingPlace(ship(reach + PARK_GAP.near), null, rows)).toBe(st.id);
    expect(orbitingPlace(ship(reach + PARK_GAP.near + PARK_GAP.out - 1), st.id, rows)).toBe(st.id);
    expect(orbitingPlace(ship(reach + PARK_GAP.near + PARK_GAP.out + 1), st.id, rows)).toBeNull();
    expect(orbitingPlace(ship(reach + PARK_GAP.near + PARK_GAP.in + 1), null, rows)).toBeNull();
    // (parked at any station, even one inside its star's zone, it's the station you're at)
    for (const x of s.stations) {
      const park = parkPlace(resolvePlace(x.id, { t: 0 }), [x.at[0], x.at[2] + 1000], 0);
      expect(orbitingPlace(park, null, placesAround(sectors, x.at, 0, all)), x.id).toBe(x.id);
    }
  });
  it('names the stars to aim at, nearest first, each with its system’s reach', () => {
    const cam = s.systems[0].at;
    const stars = aimStars(sectors, cam, { max: 50 });
    expect(stars).toHaveLength(50);
    for (let i = 1; i < 50; i++) expect(len(stars[i].at, cam)).toBeGreaterThanOrEqual(len(stars[i - 1].at, cam));
    expect(stars[0]).toEqual({ id: s.systems[0].id, at: s.systems[0].at, reach: s.systems[0].reach });
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places/around.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `around.js`. It allocates no per-row objects for systems it rejects. Measured on a warmed run, `placesAround` over 27 sectors takes under 4 ms, said in the commit.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git commit -m "What's round the ship: stars, planets on their orbits, moons, stations and the things near enough to draw"`

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
  - **`tagsFor(rows, { ship, nose, focus = [], here = null, max, cone }) → Row[]`**, chosen in this order and capped at `max`. `cone` has no default: the caller passes `aim.js`'s `NAME_CONE`, because `aim.js` reaches three.js through `farStars.js` and `pick.js` stays pure.
    1. the `focus` rows, in their order
    2. the row the ship is `here` at
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
- Consumes: the moved block's own imports (`HYPER`, `driveById`, `hyperState`, `legOf`, `parkFor`, `portalById`, `OPEN_SPACE`, `headingTo`, `REAIM_MS`, `parkBehind`, `pilotId`, `pilotSpace`, `reached`, `JAMMED`, `jumpState`).
- Produces: `createTrips(deps) → { travel(id, drive = props.drive), dropAuto(), arriveAt(park), navTo(id), frontSpace(), withPilot(name), pilotGone(id, name), chasePilot() }`, behaving exactly as the block did.
  - `deps` is `{ state, props, emit, pilots, front, powers, unique, heard, retarget, invalidate, reduced, onFoot, wall, settle }`.
  - Anything the scene defines later, or that changes, is passed as a thunk or a getter, so the call sits where the block was:
    - `front: () => front`
    - `heard: () => heard()`
    - `retarget: (ms) => retarget(ms)`
    - `settle: () => { camQOn = false; }`
  - `scene.js` puts `const { travel, dropAuto, arriveAt, navTo, frontSpace, withPilot, pilotGone, chasePilot } = createTrips({...});` in the block's place.

- [ ] **Step 1: Take the before shots** on the branch as it stands, after lanes 1, 2, 5a and 6a have merged and before any picture of this lane.
  - Run `node scripts/universe-check.mjs --quality mid --out lab/universe/before-3/mid`, on every pose including lane 2's `old-rim`, `above-core` and `expanse-system`. It takes about an hour in software GL. Run it in the background and wait on its exit.
  - Write the calls and triangles at each pose into the evidence README.
- [ ] **Step 2: Write the failing tests** `trips.test.js`. They pin today's behaviour, before the move:

```js
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrips } from './trips';
import { parkFor } from './nav';
import { OVERDRIVE, spawn } from './ship';
import { SECTORS } from './layout';
import { JAMMED, jumpState } from './words';

const make = ({ state = {}, props = {}, deps = {} } = {}) => {
  const events = [];
  const st = { ship: { ...spawn('home') }, auto: null, jump: null, then: null, note: null, crash: null, dive: null, hyperAt: null, interdicted: false, stats: {}, view: 'chase', seat: 'chase', lastInput: 0, flown: true, yaw: 0, ...state };
  const trips = createTrips({
    state: st, props: { drive: 'super', frozen: false, ...props }, emit: (e) => events.push(e),
    pilots: { pose: () => null }, front: () => null, powers: { cancel() {} }, unique: { clear() {} },
    heard() {}, retarget() {}, invalidate() {}, reduced: false, onFoot: () => false, wall: () => 100, settle() {}, ...deps,
  });
  return { state: st, events, trips };
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
});
```

- [ ] **Step 3: Run them and see them fail.** Run `npx vitest run src/components/universe/trips.test.js`. Expected: FAIL (module not found).
- [ ] **Step 4: Move the block.** It goes verbatim into `trips.js`, with `const` closures over `deps`, and is wired into `scene.js` as in the Interfaces. Count `scene.js`'s lines before and after.
- [ ] **Step 5: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS.
- [ ] **Step 6: Check in the browser that travel is unchanged** (all at `--quality low`, as each script's header says; none draws a pose). Expected: each as before the move.
  - `node scripts/navmap-check.mjs desktop`: the jump to a wonder by name
  - `node scripts/sector-check.mjs`: through the portal and on
  - `node scripts/flyto-check.mjs --fake`: to a pilot
  - `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`
- [ ] **Step 7: Commit.** `git add src/components/universe/trips.js src/components/universe/trips.test.js src/components/universe/scene.js lab/universe/before-3 docs/superpowers/evidence/endless-universe-3 && git commit -m "The scene's travel moves to trips.js unchanged; before shots for lane 3"`. The body says `scene.js`'s line counts.

### Task 11: Trips go to generated places

**Files:**
- Modify: `src/components/universe/trips.js`, `src/components/universe/trips.test.js` (a new `describe`)
- Modify `scene.js` in place:
  - **The state** (`:1178`'s object) gains `spaceT: spaceTime(reduced ? 0 : Date.now())` and `arrived: null` (+1 line).
  - **The clock**, where lane 2's `expanse.update({ …, now: … })` is called in `render()`: `const nowMs = state.held || reduced ? 0 : Date.now(); state.spaceT = spaceTime(nowMs);` comes before it, and the call takes `now: nowMs` (+1).
  - **The jump's way out** (`:4350-4356`, `const pid = pilotId(j.id); … else if (pid) pilotGone(j.id, j.name);`): six lines become `const park = outOfJump(j);` (−5).
  - **The trip's end** (`:4380-4384`): `const id = state.auto.id; state.auto = null; emit({ type: 'arrived', id, done: true });` becomes `finish(state.auto.id);` (−2).
  - **The follow:** `if (!state.jump) chasePilot();` (`:4369`) becomes `if (!state.jump) (chasePilot(), followPlace());` (0).
  - **The trips' deps** gain `resolve: (id) => resolvePlace(id, { universe, t: state.spaceT, sectors: expanse.sectors() })`. The inline `typeof ctx.universe === 'bigint' ? ctx.universe : UNIVERSE` at `createExpanse` becomes a `const universe` above it (+1). Task 12 swaps the dep for `places.resolve`.
  - **The dev hooks.** `__universeDebug` (`:5911`) gains `places: { resolve: (id) => resolvePlace(id, { universe, t: state.spaceT, sectors: expanse.sectors() }) }` on its existing line (0). Task 12's `places` object replaces it with the same `resolve`, so the check's calls don't change.

**Interfaces:**
- Consumes: Tasks 3, 4 and 7 (`canonicalPlace`, `resolvePlace`, `parkPlace`, `followPark`, `placeSpace`, `canGo`).
- Produces (on `createTrips`, with `deps` gaining `resolve(id) → Destination | null`):
  - **`travel(id, drive)` takes a generated id in any spelling.**
    - It canonicalises it and resolves it with `deps.resolve`. Nothing there gives false.
    - `legOf` goes by the portal from the Curve.
    - The park is `parkPlace(dest, [s.x, s.z], state.spaceT)`.
    - `state.auto` (or `state.jump`) carries `place: { dest, park }`, and the auto carries `space: placeSpace(OPEN_SPACE, dest)`.
    - Reduced motion is `arriveAt(followPark(...))`.
  - **`followPlace()`**, each frame: for a trip to a place, `state.auto.park = followPark(dest, park, state.spaceT)`, and its space goal's `at` is set in place to `atTime(dest, state.spaceT)`.
  - **`outOfJump(j) → park`:**
    - a pilot's: behind them as they are now, saying who you're with or that they've gone
    - a place's: `followPark` at `state.spaceT`
    - else `j.park`

    It sets `state.arrived = { id: j.id }`.
  - **`finish(id)`:** the autopilot's done, which clears `state.auto`, emits `arrived` done and sets `state.arrived = { id }`. It is a new object each time, so the same place twice is two arrivals.
  - `dropAuto()` also sets `state.arrived = null`.

- [ ] **Step 1: Write the failing tests** (appended to `trips.test.js`):

```js
describe('trips to generated places', () => {
  const resolve = (id) => resolvePlace(id, { t: 0 });
  const id = 'E:1,0:0:0';
  const xyz = (k) => ({ x: k.x, y: k.y, z: k.z, heading: k.heading });
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
  it('won’t go to a place that isn’t there', () => {
    expect(make({ deps: { resolve } }).trips.travel('E:1,0:0:99')).toBe(false);
  });
  it('marks a trip’s end as an arrival, each time afresh, and a dropped one as none', () => {
    const { state, events, trips } = make({ state: { spaceT: 0 }, deps: { resolve } });
    trips.travel(id);
    trips.finish(id);
    const first = state.arrived;
    expect([state.auto, first]).toEqual([null, { id }]);
    expect(events.at(-1)).toEqual({ type: 'arrived', id, done: true });
    trips.travel(id);
    trips.finish(id);
    expect(state.arrived).not.toBe(first);
    trips.travel(id);
    trips.dropAuto();
    expect(state.arrived).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/trips.test.js`. Expected: the new `describe` FAILS.
- [ ] **Step 3: Implement**, and wire `scene.js` as above.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS.
- [ ] **Step 5: Add the endless check's `travel` step, and an `--only`.**
  - In `scripts/universe-endless-check.mjs`, `--only a,b` runs `start` and then only the named steps.
  - The `travel` step:
    1. `__universeDebug.teleport` to 1,500 units off where `__universeDebug.places.resolve('E:1,0:0:0').at` is now.
    2. `__universeDebug.travel('E:1,0:0:0', 'super')`.
    3. Wait until `__universe().auto` is null and the ship is within `reach + 4 + 1` of `places.resolve('E:1,0:0:0').at`, read again at that moment.
    4. Then `travel('E:2,0:0', 'hyper')`. Wait until `__universe().jump` is null and the ship is within `places.resolve('E:2,0:0')`'s reach + 16 + 1, past any planet band (`parkFor` puts it in a gap).

  Each wait is a `waitForFunction` with `polling: 500` and a 300 s timeout.
- [ ] **Step 6: Run it.** Run `node scripts/universe-endless-check.mjs --quality mid --only travel`. Expected: exit 0, no console errors.
- [ ] **Step 7: Commit.** `git commit -m "Trips go to generated places by any drive, re-parked on a moving planet, out of a jump where it is"`. The body says `scene.js`'s count.

### Task 12: The scene's places: what's near, stations drawn and solid, the carry, where you are, docking

**Files:**
- Create: `src/components/universe/places/scenePlaces.js`, `scenePlaces.test.js`, `src/components/universe/places/stationLook.js`, `stationLook.test.js`
- Modify `scene.js` in place:
  - **Created after `createExpanse`** (`:772-780`): `const places = createScenePlaces({ group: map, universe, expanse, toScreen: (...a) => toScreen(...a), prepare: (o) => warm(o), emit: (e) => emit(e), note: (text) => { state.note = { text, until: wall() + 3 }; }, tier })` (+1). Trips' `resolve` dep becomes `(id) => places.resolve(id)`.
  - **In `fly()`, before the step** (`:4405-4415`):
    - `if (!state.held) state.ship = places.carry(state.ship, state.carryT ?? state.spaceT, state.spaceT); state.carryT = state.spaceT;` (+1)
    - the step's `solidsNow = solidsWith(…, moving)` gains `places.solids()`, and so does the autopilot's `moving` (`:4371`) (0, both in place)
  - **The update.** After the step, before `// at a universe: arriving, and leaving` (`:4496`): `places.update({ ship: state.ship, camera, t: state.spaceT, flying: flying() && !onFoot(), nose: noseOf(state.ship), going: state.jump?.id ?? state.auto?.id ?? null, arrived: state.arrived, held: state.held })` (+1).
  - **The aim** (`:803`): `aimTargets(sector, state.at)` becomes `[...aimTargets(sector, state.at), ...places.aimTargets()]` (0).
  - **Names** for the aim's event (`:806`), the HUD's jump line (`:4868`, `:4872`) and `fightGoal` (`:3773`): `destinationById(id)` becomes `destinationById(id, places.opts())` (0).
  - **The start** (`:2216`): `isGoal(props.startAt) ? parkFor(props.startAt, [0, 0])` becomes `canGo(props.startAt, places.opts()) ? parkFor(props.startAt, [0, 0], places.opts())` (0).
  - **A crash into a generated body comes back off that body, not the home sun.** If lane 2 already fixed it, skip this and say so.
    - In `startCrash` (`:3083`): `if (solid.ship) …` gains `else if (isPlaceId(e.id)) state.crash.centre = [...solid.at];` (+1).
    - In the crash's way back (`:4162`): `c.ship ? { at: c.centre, …` becomes `c.ship || c.centre ? { at: c.centre, …` (0).
  - **`where()`** (`:6277`) gains `place: places.here()?.id ?? null, docked: places.docked(), t: state.spaceT,` (+1). The handle gains `place(id) { return places.resolve(id); }` and `nearby(max) { return places.nearby(max); }` (+6).
  - **The dev hooks.** `__universe()` (`:5923`) gains `place: places.here()?.id ?? null, docked: places.docked(),` (+1), and `__universeDebug` (`:5911`) gains `places` on its existing line (0).
- Modify: `scripts/universe-endless-check.mjs` (the `dock` step)

**Interfaces:**
- Consumes: Tasks 3, 5, 8 and 9; lane 2's `expanse.sectors()` (a `Map`).
- Produces:
  - **`createStationLook(group, { prepare }) → { update(rows), dispose() }`.**
    - Two `InstancedMesh`es of at most 8 instances, from one merged procedural station (`kit.js`'s `parts`: a hub, a ring on four spokes, a docking arm):
      - the hull, a `MeshStandardMaterial` in `palette.js`'s `bone` and `grey`
      - its lights, `kit.js`'s `glowMat` with `hot('#ffcf6a', 2.2)`
    - `visible = false` at 0 instances, so it costs no draw call.
    - `prepare` is called once for each mesh, when it's made.
    - Each row's matrix is at `row.at`, scaled by `row.size × row.grow`.
  - **`createScenePlaces({ group, universe, expanse, toScreen, prepare, emit, note, tier }) → { … }`**, with these methods:
    - **`update({ ship, camera, t, flying, nose, going, arrived, held })`**, every frame.
      - It refreshes `placesAround` every 0.25 s, or when the camera has moved over 500.
      - It draws the stations of systems whose `span` holds the camera, `grow = smoothstep(span, 0.85 · span, dist to star)`.
      - It tracks `here` with `orbitingPlace` and `docked` with `dockState`.
      - It emits `{ type: 'place', what, id, name, open? }` for each change:
        - `'arrive'`, only when `going` is null or this id
        - `'leave'`
        - `'dock'`, with `open: true` when the latest `arrived` object names this station and wasn't used yet
        - `'undock'`
      - On dock it calls `note(PLACE.docked(name))`.
    - **`around() → Row[]`**
    - **`carry(ship, t0, t1) → ship`**, over `around()`'s planets and moons
    - **`solids() → [{ id, at, r: size, reach: size * 1.5 }]`**, the drawn stations
    - **`here() → { id, place } | null`**
    - **`docked() → id | null`**
    - **`resolve(id, t = last t) → Destination | null`**, with this scene's `universe`, `t` and `sectors`
    - **`opts(t = last t) → { universe, t, sectors }`**
    - **`name(id) → string | null`**, from `destinationById(id, opts())`
    - **`nearby(max = 60) → Destination[]`**, `around()`'s first `max` resolved
    - **`aimTargets() → aimStars(…)`**, refreshed every second
    - **`stations() → Row[]`** (dev): the loaded sectors' stations, nearest first, 20 at most
    - **`dispose()`**

- [ ] **Step 1: Write the failing tests.** `stationLook.test.js` (Node, three):
  - `update([])` leaves both meshes invisible with `count` 0.
  - `update` with three rows makes them visible with `count` 3. Instance 1's matrix position equals row 1's `at`, and its scale is `size × grow`.
  - Nine rows draw eight.
  - `prepare` was called exactly twice, at creation.
  - `dispose` empties the group.

  `scenePlaces.test.js` has two helpers:
  - `make({ sectors, universe } = {})` builds `createScenePlaces` over a fake expanse (`sectors: () => sectors ?? new Map([['E:1,0', s]])`), with a `THREE.Group`, a `toScreen` that projects through the fake camera, `prepare` as a no-op, and `emit` and `note` recorders. It returns `{ p, events, notes }`.
  - `fakeCamera(ship)` is a `PerspectiveCamera(34, 16 / 9, 0.1, 45000)` at the ship, looking along its heading.

  The tests:

```js
const st = s.stations[0];
const dest = resolvePlace(st.id, { t: 0 });
const park = parkPlace(dest, [st.at[0] + 2000, st.at[2]], 0);
const tick = (p, ship, more = {}) => p.update({ ship, camera: fakeCamera(ship), t: 0, flying: true, nose: [0, 0, -1], going: null, arrived: null, held: false, ...more });

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
it('undocks and leaves as it flies off, and arrives nowhere it is only passing', () => {
  const { p, events } = make();
  tick(p, { ...park, speed: 0 });
  tick(p, { ...park, x: park.x + 100, speed: 20 });
  expect(events.slice(2).map((e) => e.what)).toEqual(['undock', 'leave']);
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
  for (let i = 0; i < 60; i++) {
    const r = step(ship, { throttle: 1 }, 1 / 30, [...SOLIDS, ...p.solids()], OPEN_SPACE);
    hit.push(...r.events);
    ship = r.ship;
  }
  expect(hit.find((e) => e.type === 'crash')?.id).toBe(st.id);
});
it('resolves with the scene’s universe and its loaded sectors', () => {
  const doctored = { ...s, systems: s.systems.map((x, i) => (i === 0 ? { ...x, name: 'Testing' } : x)) };
  const { p } = make({ sectors: new Map([['E:1,0', doctored]]) });
  expect(p.resolve('e:1,0:0').name).toBe('Testing');
  expect(make({ universe: universeOf('marble') }).p.resolve('E:1,0:0').name).not.toBe(s.systems[0].name);
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/places`. Expected: the two new files FAIL.
- [ ] **Step 3: Implement both, and wire `scene.js`.** Count its lines.
- [ ] **Step 4: Run them and see them pass.** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Add the endless check's `dock` step.**
  1. Take `__universeDebug.places.stations()[0]`.
  2. `travel(id, 'hyper')`.
  3. Wait until `__universe().docked === id`.
  4. Shoot it as an element JPEG, `dock.jpg`, into the evidence folder.
  5. Then `teleport` 400 out and wait until `docked` is null.

  The opening of the Hangar is Task 14's.
- [ ] **Step 6: Run the checks at mid.**
  - Run `node scripts/universe-endless-check.mjs --quality mid --only travel,dock`. Expected: exit 0, no pops over 4 px (the stations grow in), no console errors.
  - Run `node scripts/universe-check.mjs --quality mid --poses expanse-system --out lab/universe/after-3/mid`. Expected: calls and triangles at most `before-3`'s plus 2 when a station is in the built system, and equal when there is none. Say which in the commit.
- [ ] **Step 7: Commit.** `git commit -m "Generated stations drawn and solid, a ship carried in orbit, and docking at the end of a trip"`. The body has the `scene.js` count and the pose's numbers.

### Task 13: Picking generated places, and their name tags

**Files:**
- Create: `src/components/universe/places/placeTags.js` (DOM: no unit test, as lane 6a's `useChartView.js` has none; Step 4 checks it in the browser)
- Modify: `src/components/universe/places/scenePlaces.js` (`tags`, `pick`), `scenePlaces.test.js`
- Modify: `src/components/universe/hud.css` (append the tag's look)
- Modify `scene.js` in place:
  - **Click.** In `onUp`'s flying branch (`:5764-5769`), after the hunter, before the wonder: `const gid = places.pick(x, y, { tanHalf, height: size.h }); if (gid) { navTo(gid); props.onPick?.(gid); } else { const wid = pickWonder(x, y); … }` (+2).
  - **Hover.** `onMove`'s cursor (`:5717`) counts `places.pick(x, y, …)` (0).
  - **The tags' parent.** `createScenePlaces` gets `tags: () => props.tags?.current ?? null` and `onPick: (id) => { navTo(id); props.onPick?.(id); }` (0, on its line).

**Interfaces:**
- Consumes: Task 9's `pickPlace`, `tagsFor` and `TAGS_MAX`; lane 6a's `chart/declutter.js` `declutter(labels, { bounds })`; `nav.js`'s `shortDistance`.
- Produces:
  - **`createPlaceTags(box, { onPick }) → { show(list), dispose() }`.**
    - `list` is `[{ id, name, dist, x, y, priority }]`.
    - A pool of `span.universe-place-tag`, each holding a `b` with the name (set as `textContent`) and a `small` with `shortDistance(dist)`.
    - Each is moved by `transform` and shown by `data-on`, and is written only when it changes, as `pilots.js`'s tags are.
    - A click calls `onPick(id)`.
    - Tags whose boxes `declutter` gives `null` are hidden.
  - **`scenePlaces.update`** also shows the tags: `tagsFor(around(), { ship, nose, focus: [going, aim, picked], here, max: TAGS_MAX[tier] })`, projected by `toScreen`. There are none while held, on foot or not flying.
  - **`scenePlaces.pick(px, py, { tanHalf, height }) → id | null`:** `pickPlace` over `around()`, when flying.
  - **`.universe-place-tag`** is `.universe-tag`'s look (pill, mono, never under 12 px, `pointer-events: auto`) in `#9fd8ff`.

- [ ] **Step 1: Write the failing test** in `scenePlaces.test.js`:
  - With the fake camera's `toScreen` putting the station's star at (640, 360), `p.pick(642, 361, { tanHalf: 1, height: 720 })` is the system's id after an `update` inside it.
  - With `flying: false` it is null.
  - A fake `tags` box records `show` calls. After an update facing the station, the list's first entry is the station. With `held: true` the list is empty.
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/places/scenePlaces.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** `placeTags.js` and the `scenePlaces` additions, append the CSS, and wire `scene.js`. Count its lines.
- [ ] **Step 4: Check it in the browser: the endless check's `pick` step.**
  1. `teleport` inside `E:1,0:0`'s reach, facing its star.
  2. Wait until `.universe-place-tag[data-on]` shows the system's name.
  3. Read the star's screen point with `__universeDebug.places.screen(id)` (dev: `toScreen` of its row) and click it.
  4. Wait until `__universe().auto === id`.
  5. Shoot `pick.jpg`.

  Run `node scripts/universe-endless-check.mjs --quality mid --only pick`. Expected: exit 0, no console errors.
- [ ] **Step 5: Commit.** `git commit -m "Click a generated place to fly there; the places on your nose are named"`. The body says `scene.js`'s count.

### Task 14: The page: links, the card, and docking opens the Hangar

**Files:**
- Create: `src/components/universe/places/PlaceCard.jsx`, `src/components/universe/places/PlaceCard.test.jsx`
- Modify: `src/components/universe/UniversePanel.jsx`:
  - `:144` gains a `docked = null` prop
  - `:181-212`, the wonder branch: for `wonder.generated`, `<PlaceCard>` stands in place of the eyebrow, title, about and fly button; the links row, `CopyButton` and `Exits` stay
- Modify: `src/components/universe/UniverseMap.jsx:236-246` (the handle gains `place: (id) => view.current?.place?.(id) ?? null` and `nearby: (max) => view.current?.nearby?.(max) ?? []`)
- Modify: `src/pages/Universe.jsx`:
  - `:100` (the `map` ref's stand-in gains `place: () => null, nearby: () => []`)
  - `:97-98` (`wonder`, `wonderDest`)
  - `:360` (`onEvent`'s head: `'place'` events)
  - `:449-466` (`travel`)
  - `:542` (`startAt`)
  - `:583` (`wonder=`)
  - and a `docked` state
- Modify: `src/components/universe/universe.css` (`.universe-facts`), `src/lib/words.test.js:23` (`FILES` gains `...list('components/universe/places/', /\.jsx$/)`)
- Modify: `scripts/universe-endless-check.mjs` (the `link` step; the `dock` step waits for the Hangar)

**Interfaces:**
- Consumes: Task 3's `canonicalPlace` and `resolvePlace`; Task 12's `'place'` events and the handle's `place(id)`; lane 6a's `CHART_WORDS.sector`; `PLACE`; `PICK_A_SHIP`.
- Produces:
  - **`PlaceCard({ dest, docked = false, onFly = null, onHangar = null, leaving = false })`** renders:
    - an eyebrow `` `${dest.type} · ${CHART_WORDS.sector(dest.cube)}` `` in `dest.color`
    - `h2.universe-title` with the name
    - the about
    - `dl.universe-facts` (one `div > dt + dd` per fact; none when there are no facts)
    - one primary button:
      - `PLACE.hangar` (`onHangar`) when docked
      - else `PLACE.dock` for a station and `PLACE.fly` otherwise (`onFly(dest.id)`, disabled while leaving)
      - else, with no `onFly`, `PICK_A_SHIP`
  - **On the page:**
    - **The link.** `const place = canonicalPlace(param)`. `placeDest` is `(map.current.live && map.current.place(place)) || resolvePlace(place, { universe: pocket.universe })` when `place` is set, memoised on `place` and the universe.
    - **The card.** `wonder={wonderDest ?? placeDest}`, `docked={docked}`.
    - **The start.** `startAt={wonder ?? place}`.
    - **`travel(id, d)`** selects a generated id (`select(id)`), so its card stays up while you fly. Without a ship it selects it too. Its `destinationById` calls pass `{ universe: pocket.universe }`.
    - **`onEvent`**, for `e.type === 'place'`, handled and not passed to the Comms:
      - `arrive` selects the place
      - `leave` clears the selection when the URL is that place
      - `dock` sets `docked`, and with `open` does `setHangarTab('shipyard'); setYard(true)`
      - `undock` clears `docked`

- [ ] **Step 1: Write the failing test** `PlaceCard.test.jsx` (`renderToStaticMarkup`):
  - **A planet's card** has its type and `Sector 1, 0, 0` in the eyebrow, its name in the title, every fact's `dt` and `dd`, and a button `Fly here`.
  - **A station's** button reads `Dock here`. With `docked` and `onHangar` it reads `Hangar and shop` instead.
  - **With no `onFly`**, `PICK_A_SHIP` shows and there's no button.
  - **A thing** has no `dl`.
  - **The words test** (`npx vitest run src/lib/words.test.js`) reads the new file and passes.
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/places/PlaceCard.test.jsx`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `PlaceCard.jsx` and the panel, map, page and CSS changes.
- [ ] **Step 4: Run them and see them pass.** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Check it in the browser.**
  - **The `link` step.** Open `#/universe/E:1,0:0:0` fresh, with a ship. Wait until `__universe().place === 'E:1,0:0:0'` and `.universe-panel .universe-title` reads its name. Shoot `card.jpg`.
  - **The `dock` step** also waits for `.hangar-panel .hangar-body[data-tab="shipyard"]`, then presses Escape. It waits for the panel to go, and that it doesn't come back over 20 frames (`__universe().docked` still the station). Shoot `hangar.jpg`.
  - **The phone.** At 390 × 844, the card's button and facts are inside the panel, and the panel scrolls.

  Run `node scripts/universe-endless-check.mjs --quality mid --only link,dock`. Expected: exit 0, no console errors.
- [ ] **Step 6: Commit.** `git commit -m "A generated place's card at its own address, and docking at a station opens the hangar and shop"`

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
  - The hand-off notes.

- [ ] **Step 1: Write the failing test.** `poseFor('expanse-station').at` is within `1.5 × size + 4 + 1e-6` of that station's `at`, and its `heading` faces it, the dot of `forward(heading)` with the way to it over 0.99.
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/poses.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, and add the name to `universe-check.mjs`'s `POSES`.
- [ ] **Step 4: Run it and see it pass.** Same command. Expected: PASS.
- [ ] **Step 5: The full measure, once.** Run these in the background and wait on their exits:
  - `node scripts/universe-check.mjs --quality all --out lab/universe/after-3/<tier>`: every pose at every tier, about three hours here
  - `QUALITY=mid node scripts/perf-probe.mjs universe` and `QUALITY=low …`, against Task 10's branch point

  Expected:
  - **Draw calls and triangles:** at every pose in `lab/universe/baseline/<tier>.json`, no higher. Generated stations are drawn only inside a generated system's reach, and the keep-outs keep every reach away from the hand-made poses, so the fourteen hand-made poses are equal.
  - **Frame time:** p50 no worse than 2%.
  - **New baseline:** `expanse-station` is recorded with `--poses expanse-station --out lab/universe/endless/<tier>` and becomes its own baseline.
  - **Pixels:** `scripts/pixel-measure.mjs` against `before-3/mid` gives identical shots at the hand-made poses at mid.
- [ ] **Step 6: The endless check, whole.** Run `node scripts/universe-endless-check.mjs --quality mid` and then `--quality low`, all of lane 2's steps and this lane's. Expected: exit 0 both times, and the per-step table printed and copied into the README.
- [ ] **Step 7: The repo's checks.** Expected: each as on the branch before Task 1.
  - `node scripts/navmap-check.mjs`
  - `node scripts/sector-check.mjs`
  - `node scripts/flyto-check.mjs --fake`
  - `node scripts/links-check.mjs`
  - `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`
- [ ] **Step 8: Write the README and the hand-off notes.**
  - **The README** holds:
    - before and after, side by side
    - the table of calls and triangles per pose and tier
    - frame times
    - the bundle numbers from Task 7
    - `scene.js`'s line count at each task
    - `boundary-breaks` and `cycles`, before and after
  - **`HANDOFF-NOTES.md`, "Landed":** every module above by path, with its interface in one line each, and the four new endless steps and the pose.
  - **`HANDOFF-NOTES.md`, "Left":**
    - Lane 6b lists generated places on the chart and in search, from `handle.nearby()`, `where().t` and `findDestinations`' `more`.
    - Lane 4a draws its kinds' cards (`THING_CARDS`) and counts the station as catalogue kind 11. It may restyle `stationLook.js`.
    - Lane 4b's trader event hails from a station's dock (the `'place'` `dock` event).
    - Lane 5b lands from `where().place` (a planet with `land: true`) and returns to `/universe/E:…`, which now starts parked at the place with its card up.
    - Any finding from Task 7's bundle step.
- [ ] **Step 9: Run the gates and commit.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, within budget. Then `git add -A src/components/universe/poses.js src/components/universe/poses.test.js scripts/universe-check.mjs lab/universe/after-3 lab/universe/endless docs/superpowers/evidence/endless-universe-3 && git commit -m "Lane 3 measured at every tier, a station pose, and its hand-off notes"`

---

## What later lanes consume

| Name | From | Used by |
|---|---|---|
| `resolvePlace(id, { universe, t, sectors })`, `Destination`, `atTime`, `canonicalPlace`, `isPlaceId`, `placeOpts` | `universe/places/resolve.js` | 4a, 4b, 5b, 6b |
| `THING_CARDS` (a row per kind: `type`, `about`, `color`, `solid`, `far`, `at?`), `placeCard`, `PLACE` | `places/cards.js`, `words.js` | 4a (its kinds' cards), 6b |
| `parkPlace(dest, from, t)`, `followPark`, `placeSpace`, `gapRadius` | `places/park.js` | 4a ("Park" actions), 4b (events at a place), 5b (back in orbit) |
| `carry`, `CARRY` | `places/carry.js` | 5b (taking off into orbit) |
| `longTrip`, `TRIP` | `places/trip.js` | 6b |
| `destinationById(id, opts)`, `goalOf`, `canGo`, `legOf`, `parkFor(id, from, opts)`, `distanceTo(ship, id, opts)`, `tripTime(ship, id, drive, opts)`, `findDestinations(kind, q, { more })`, `findDestination(q, opts)` | `nav.js` | 6b, 4c, 5b |
| `placesAround`, `orbitingPlace`, `aimStars`, `AROUND`, `Row` | `places/around.js` | 4b (zones), 6b (marks) |
| `pickPlace`, `tagsFor`, `TAGS_MAX`, `dockState`, `DOCK` | `places/pick.js`, `dock.js` | 4a (its own picks), 4b |
| `STATION_BASE`, `stationsOf`, `extentOf`, `fullSector(…).stations`, `placeIn` | `expanse/gen/stations.js`, `space.js`, via `expanse/shared/space.js` | 4a, 4b (traffic between stations) |
| `travel(id)` on `E:` ids (scene handle and `__universeDebug`), `where().place`, `where().docked`, `where().t`, `handle.place(id)`, `handle.nearby(max)`, `__universeDebug.places` | `scene.js`, `UniverseMap.jsx` | 4b, 5b, 6b |
| `{ type: 'place', what: 'arrive' \| 'leave' \| 'dock' \| 'undock', id, name, open? }` | `scenePlaces.js` (the scene's `emit`) | 4b (the trader), 5b |
| `/universe/<E: id>`: starts parked with its card | `Universe.jsx` | 5b (take-off's return), 4c |
| `PlaceCard` | `places/PlaceCard.jsx` | 6b, 4a |
| `createTrips(deps)`, `state.spaceT`, `state.arrived`, `finish`, `outOfJump` | `trips.js` | 4b, 4c |
| the `travel`, `dock`, `pick` and `link` steps, `--only` | `scripts/universe-endless-check.mjs` | every later lane |

## Assumptions about wave 1's unmerged work

Each of these can be checked once lane 2 (2.3 to 2.5), lane 1, lane 5a and lane 6a have merged.

1. `createExpanse(…).sectors()` returns a `Map` from the sector key to a `fullSector`-shaped sector, its moons through `withMoons`, and `stations` comes along from `sectorJob` unchanged (lane 2's Tasks 19 and 20). If not, scenePlaces reads `expanse.sector()` and the neighbours by key.
2. `expanse.solids()` lists the built bodies with the generator's `E:` ids, each `at` moved in place every frame (lane 2's Tasks 16, 17 and 21).
3. Lane 2's Task 17 calls `expanse.update({ …, now })` with `now = state.held || reduced ? 0 : Date.now()`, read through `spaceTime`. Task 11 makes `state.spaceT` the same value.
4. The built systems' planets sit at `orbitAt(p, t)` and their moons at `moonAt` with that `t` (lane 2's Task 16), so a pick, a tag and a park land on what's drawn.
5. `nearThings` draws a lattice thing within `THING_NEAR × size` and makes it solid as `{ r: size, reach: size * 1.2 }` (lane 2's Task 21). It leaves a legacy nebula out of the solids, since its `size` is a cloud's radius. If it doesn't, that's a lane 2 bug: a nebula's "fly into its middle" park would sit in a solid.
6. `OPEN_SPACE` has no roof, and the far plane is still 45,000 (on `main`, and lane 2's `levels.js`'s `FAR`).
7. `scripts/universe-endless-check.mjs` exists with steps `start`, `old-rim`, `boundary`, `system` and `climb`, a per-step recorder, and `__universeDebug.teleport(x, y, z, heading, pitch)` (lane 2's Task 22). So do the poses `expanse-system`, `old-rim` and `above-core`.
8. Lane 6a's `CHART_WORDS.sector` is in `words.js` and `chart/declutter.js`'s `declutter` is merged, both from 6a's Tasks 4 and 7.
9. Lane 2's PRs 2.3 to 2.5 leave `expanse/gen/space.js`'s `placeOf` and `fullSector` as they are on `main`. Lane 3 is the next to edit that file.
10. Whether lane 2's Task 17 fixed a crash into a generated body coming back at the home sun (`scene.js:4162` reads `SOLIDS`, not `solidsNow`). Task 12 fixes it if not.

## Findings for the coordinator (spec against code)

1. **The spec's "GOALS … accept it" can't be taken literally.** `GOALS` is `ship.js`'s static table of the hand-made map, and the generated places are endless. So a generated goal goes into a trip's own space (`placeSpace`), as a pilot's does through `pilotSpace`, and `GOALS` doesn't change.
2. **Stations are generated in lane 3, not lane 4a.** The spec puts "about one system in three has a station" in section B, and lists stations as catalogue kind 11. But docking, which is lane 3's, can't be built or tested without them. Lane 3 generates them (`expanse/gen/stations.js`) and draws them plainly. Lane 4a counts kind 11 and may restyle the look.
3. **The address has no station form.** Stations take wonder numbers past the lattice, `w(10000 + i)`. This is additive: nothing in `w8064` to `w∞` resolved before.
4. **Moving orbits against parking.** Generated planets move up to about 0.9 units a second (moons a little more), but the autopilot's stop needs the ship under 0.25. So a ship within 2 to 4 reaches of a planet or moon is carried with it. Without the carry, done item 6's "taking off leaves you in orbit" would drift.
5. **`state.at` is hand-made only.** The scene reads `state.at` as a hand-made id: `POSITIONS[pulseAt.id]`, `byId(state.at)` for landing, and the E and Enter keys. So generated places live in `scenePlaces.here()` and `where().place`, and lane 5b lands from those, not from `where().at`.
6. **Search and long-trip times.** The spec's lane table gives them to 6b (`NavMap.jsx`, `nav.js`). This lane ships their pure halves (`findDestinations`' `more`, `tripTime`'s formula), and 6b wires the UI.
7. **A visible change on the nav map.** A hand-made place too far for the 150 s simulation now gets a time from the formula instead of a dash, as spec F asks.
8. **The pocket universe and `nav.js`.** `nav.js` is pure and can't know which universe a page is in. Every caller in a pocket passes `{ universe }`: the page and the scene do. The terminal and ⌘K resolve in the shared universe, as their links carry no seed.
9. **The spelling of ids.** Generated ids are canonical in the generator's form (upper-case `E:`), to match lane 2's solids and crash events. Lane 5a's flight uses lower case, and lane 5b converts.
10. **The spec's line count is stale.** `scene.js` is 6,409 lines at `cc5e2eaf`, not the spec's 6,226. Lane 2's 2.3 has it at 6,374 so far.
11. **The home page's bundle.** `nav.js` now brings the generator into the mini-map's chunk on the home page (lane 6a's Task 9 put `nav.js` there). Task 7 measures it.
12. **Islands.** `boundary-breaks` has five imports of room (484 of 489). This lane adds the expanse's face so it uses none of them. Lane 2's `rosterWhere.js` reaches `expanse/gen` directly, and could move onto the face.

## Spec coverage

- **Done item 4, "Every place you see, you can go to"** (all but "the map lists it", which is lane 6b's):
  - **It has a name** (Tasks 2 and 3, the tags in 13).
  - **You can pick it** (Tasks 9 and 13), aim at it and press J (Task 12).
  - **Travel takes you there** by the jump, super speed or cruise (Tasks 4, 7 and 11), into and out of the Curve (Task 7).
  - **You can't fly through it:** stations are solid (Task 12), and generated bodies are lane 2's.
- **Section B, "every one has a name, a card and a parking spot":** Tasks 2, 3, 4 and 14. Lane 4a's new kinds get theirs through `THING_CARDS`.
- **Section B, stations, "about one system in three":** Task 1.
- **Section B, docking through the hangar and shop:** Tasks 9, 12 and 14.
- **Section C, `/universe/<id>` behaving as today for generated places:** Task 14.
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
  - `PARK_GAP` is defined in Task 2.
  - The `place` values match `placeIn`'s kinds plus `'station'`.
  - The `kind` values (`star`, `world`, `station`, `wonder`) are the ones `findDestinations` filters by.
  - The `'place'` event's `what` values are the same in Tasks 12 and 14.
- **Review Focus lines and their tests:**
  - spellings: Tasks 3 and 7
  - a moving target: Tasks 4, 5 and 11
  - pockets: Tasks 3 and 12
  - far, and from the Curve: Tasks 6 and 7
  - docking: Tasks 9 and 12
