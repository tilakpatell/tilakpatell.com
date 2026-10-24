# Endless universe, lane 5b: Landing and walking. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A rocky generated planet or moon wears, from orbit, the map baked from the ground you walk on. Fly down into its air and an entry plays; behind the cloud the route hands you to the planet flight, low over the spot you dove at. You set down on flat ground, step out, walk with the universe's walker, camera and HUD, get back in and climb out to orbit of that same planet. A gas giant turns you back with a line. A generated planet's flight ground is coloured by its biomes, under its own weather and clouds. The 50 roster planets and the galaxy keep their look exactly.

**Architecture:**
- **Orbit (PR group 5b.1).**
  - `galaxy/bodies.js`'s `buildBody` gains an `orbit` option. It wears a baked map through the skin path the galaxy's painted planets already use (`bodySkin.js`), with the planet's clouds, air and relief from the same description.
  - The flight lends the universe one face, `src/components/expanse/shared/flight.js`. It turns a generator row into lane 5a's row, bakes the orbit map off the main thread, and writes the route to `/fly`. It sits on the flight's island, so dropping the flight drops it.
  - A new `src/components/universe/landing/sceneLanding.js` wraps lane 2's planet and moon builds with that option.
- **The flight's ground (PR group 5b.2).**
  - Biome tints come from one pure rule (`lib/land/flight/biomeTint.js`). The ground's vertices and the orbit map's texels both take it, so orbit still matches ground.
  - A generated planet gets a standing weather and clouds, rings and moons in its sky dome.
  - Every one of these is keyed off a spec field (`round`, `sky`, `weather`) that the 50 roster planets have as null, so their shaders and pictures don't move.
- **Down, out and back (PR group 5b.3).**
  - `entry.js` gains the dive's rules.
  - `sceneLanding.js` takes over the scene's whole air check, the fandom planets' rule moved unchanged beside the new one. It flies the dive, plays the existing entry show (`reentry.js`) and hands off.
  - `lib/land/flight/arrival.js` starts the flight over the spot.
  - `lib/land/flight/touchdown.js` sets the ship down and lifts it off.
  - `foot.js` gives the universe's walk, its camera rule and its figure motion to a pure adapter on the flight's chart, `expanse/flight/footing.js`. The camera rule and the figure motion are moved out of `footScene.js` so both use them.
  - `lib/view.js` names the way back.
- **Three PR groups on the one branch.** The coordinator merges every lane; this plan opens no pull request.
  - **5b.1, orbit** (Tasks 1–5). Generated planets and moons change from orbit, in generated space only.
  - **5b.2, the flight's ground** (Tasks 6–8). `/fly/<generated id>` changes; `/fly/hoth` and every roster planet don't.
  - **5b.3, down, out and back** (Tasks 9–16). Landing, walking and take-off. Task 15 waits for lane 4a.

**Tech Stack:**
- React 19
- three.js 0.186 on the GLSL path (the universe and the flight are both `'glsl'`)
- Vitest
- FastNoiseLite only through lane 5a's `fnl.js`
- `src/runtime/` (`workers.js`, `input.js`, `origin.js`)
- the runtime's HUD kit (`src/runtime/hud`)
- the Playwright check scripts under `scripts/`

**Spec:** `docs/superpowers/specs/2026-10-18-endless-universe-design.md`. This lane is:
- section E's "Orbit matches ground" (the shader's half) and "Landing" steps 1–6
- "What doesn't land" and "The planet flight becomes a kept part"
- done item 6 whole: land, step out, walk, get back in, take off into orbit of that planet, orbit matches ground
- items 9 and 10 for the landings and the flight
- the index plan's gap from lane 5a (biomes, weather and sky clouds on the flight's ground for generated planets, and the island's marks)
- lane 4a's hand-on: rocky rogue planets land

Read the index plan (`…/2026-10-18-endless-universe.md`) and lane 5a's "For lane 5b" section first.

**Depends on:**
- lanes 2 (all five PRs), 3 and 5a, merged
- lane 4a, for Task 15 only
- lane 4b if it has merged (its `events.clear()`, Task 11)

Line numbers are from `main` at `cc5e2eaf`. Lanes 2, 3 and 5a move them, so find the code again by the quoted text.

## Global Constraints

**Process (HANDOFF-universe's owner's rules and the index's Global Constraints, all of them):**
- Nothing a visitor can do is lost.
  - Every key, save, route, dev hook and test works after as before, and no test is loosened.
  - A fandom planet's landing (flying into its air opens its world page) behaves exactly as today. `scripts/entry-check.mjs` and `scripts/landing-check.mjs` pass unchanged.
- Pure first. These import no React, no DOM and no three.js, and each has its Node test before its drawing half:
  - `entry.js`
  - `lib/land/flight/{arrival,touchdown,biomeTint}.js`
  - `expanse/flight/{rows,footing,landing}.js`
  - `expanse/shared/flight.js`
- A changed picture is on purpose. The before shots come first, at `--quality mid`, in the task that changes them (Tasks 5, 7, 8).
- Draw calls and triangles are no higher at any pose in `lab/universe/baseline/<tier>.json`, nor at `/fly/hoth`. The one rise this lane makes on purpose is a generated planet's weather, one draw on `/fly/<id>` while it falls (finding 6). Say the numbers.
- Before the lane is done: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/flight-island.mjs --check`, and the smoke check on `/universe` and `/fly`.
- Every commit is one plain sentence in the repo's voice. Its body says why and gives the numbers, and it ends with the attribution lines the session's harness gives (`.claude/skills/autopilot/SKILL.md`, "Commit"). This plan writes the first line only, with no model names.
- The hand-off goes in `docs/superpowers/evidence/endless-universe-lane-5b/HANDOFF-NOTES.md`, not in `HANDOFF-universe.md`. Evidence (shots under 1 MB, the numbers) goes in that folder's `README.md`.

**Code shape:**
- `src/components/universe/scene.js` doesn't grow.
  - Tasks 5, 9, 11 and 13 each say the lines they add and the lines they move out, by `wc -l` before and after.
  - Over the lane, the scene loses `diveAt` with its comment (16 lines), the air check (19), `state.hotSaid` (1), `SHIP_NAMES` (1) and `FOOT_FOV` (1): 38 lines. It gains 3: an import, the landing's line and the dive's ride.
- `src/components/universe/footScene.js` (3,530 lines, over the ceiling) doesn't grow. Task 13 moves its walk-phase camera rule and its figure-motion rule into `foot.js` (about −25) and adds one export.
- New files stay under 800 lines. `Universe.jsx` (649), `Fly.jsx` (100), `module.js` (315) and `entry.js` (226) stay under 800.
- No `requestAnimationFrame` (`loops` is at budget). No new GLSL site: every shader change is a define or a branch in a material that exists, so `glsl-sites` stays 613. `boundary-breaks` (484) and `cycles` (5) don't rise.

**The island (`scripts/lib/flight-island.mjs`, `docs/superpowers/specs/2026-10-10-planet-flight-removable-island-design.md`):**
- The universe reaches the flight through **one face**, `src/components/expanse/shared/flight.js`.
  - It goes in `ISLAND.files`, and `NAMES` gains `/expanse\/shared\/flight\b/`.
  - The one file that imports it, `universe/landing/sceneLanding.js`, marks that import and the one line that uses it `// planet flight`, and joins `ISLAND.rows`.
  - With the flight gone, those two lines go. Generated planets keep their procedural look and don't land; gas giants still turn you back.
- `lib/view.js`'s way back from `/fly/e:…` is a marked block, and `lib/view.js` joins `ISLAND.rows`. So do `scripts/universe-endless-check.mjs`'s landing steps.
- The flight reaches the universe only through `universe/shared/` (`CROSS`): `universe/shared/foot.js` (light) and `universe/shared/crew.js` (the figures, loaded lazily).
- `scripts/flight-island.test.mjs` stays as it is. In particular, removal deletes no file under `src/components/universe/` or `src/components/galaxy/`.
- `node scripts/flight-island.mjs --check` prints `ok` after every task.

**The roster and the galaxy keep their look:**
- Lane 5a's `ROSTER_LOCK` and `planetSpec.test.js`'s `GROUND` hash hold through every task.
- A spec with `round: null` and `sky: null` (the 50) gets no biome define, no weather and no sky define. Tasks 7 and 8 pin the shader text.
- A `buildBody` call without `orbit` compiles the shader and uniforms it did before (Task 3 pins them), so the galaxy's bodies and the fandom planets don't move.
- `TERRAIN_VERSION` stays 2.

**Generated content is never stored.**
- Orbit maps are in memory only (lane 5a's cache).
- The route to `/fly` carries the planet's row in `history.state` (plain strings and numbers), never in `localStorage`, `rt.saves` or `rt.store`.

**Ids:**
- The universe's generated ids are lane 3's canonical form, upper-case `E:` (`canonicalPlace`).
- The flight's are lane 5a's lower-case `canonicalId`. `/fly/` routes are written lower-case; `/universe/` routes upper-case.
- Either case is read everywhere.

**Numbers the spec pins:**
- **The entry is two to three seconds.** `DIVE.T = 2.4` s, and the route changes at `DIVE.hand = 2.1` s, behind the white-out.
- **The air** is `AIR = 1.2` radii (`entry.js:33`, the fandom planets' own).
- **Orbit maps** are 256 × 128 on `low` and `mid`, and 512 × 256 on `high` and `ultra`: lane 5a's `ORBIT_MAP_SIZE`, which equals lane 2's `BUDGET[tier].planetMap` (Task 2 pins that).
- **Taking off leaves you in orbit of that same planet.** The route is `/universe/<E: id>`, and lane 3's start parks you at `reach + 4`, facing it.
- **Gas giants and ringed giants don't land.** Pocket universes don't either (spec: "need not land").

**Numbers this plan picks (pinned by tests, so they can be tuned):**
- `DIVE = { T: 2.4, hand: 2.1, quick: 1.3, hover: 0.06, giveUp: 4 }`
  - seconds; the entry show runs `quick` times its fandom speed; the dive never goes nearer the ground than `hover` radii
- `ORBIT_SKIN = { fade: 0.6, normal: 0.35, seas: 0.5, glow: 1.4 }`
  - a map fades in over 0.6 s and never pops
- `RELIEF_GAIN = 6`
- `ARRIVE = { up: 320, pitch: -0.16, speed: 110 }` (m, rad, m/s)
- `LAND = { alt: 450, speed: 160, reach: 700, step: 25, foot: 9, slope: 0.12, dry: 2, hover: 30, glide: 3.5, settle: 2, rest: 2.5 }`
- `LIFT = { up: 60, rise: 2, climb: 5 }`
- `LEAVE = { alt: 4000 }`
- the walker: `PLANE_R = 1e7` m for a plane spec's chart, `SHORE = 0.3` m, `BOARD = 14` m, `STEP_OUT = { side: 9, back: 2 }` m

**Words and UI (`docs/health/RULES.md`, "UI"):**
- Every new on-screen word goes into `src/components/universe/words.js` first: `LAND_WORDS`, `FOOT_WORDS` and `SHIP_NAMES` (Task 9).
- British spelling, sentence case, curly quotes, no Oxford comma. No retired word.
- The flight's HUD takes its parts from `src/runtime/hud` only (`hud-kit` stays 0).

**Browser checks (as lane 3's):**
- Headless Chromium draws in software here at a frame or two a second.
- A task's browser check runs at `--quality mid` only, on the steps, poses or routes it changes. Task 16 runs the full measure once.
- Every browser command runs with `CHROME=/opt/pw-browsers/chromium CHROMIUM=/opt/pw-browsers/chromium` in front of it.
- The checks that don't start a server (`entry-check`, `landing-check`) need one:
  1. Run `npx vite --port 5173 --strictPort` in the background.
  2. Wait until `curl --noproxy '*' -sf -o /dev/null http://localhost:5173/` succeeds, in an until-loop on that condition, giving up after 60 s.
  3. Run the checks.
  4. Stop the server after.
- Every wait is on a condition, never a sleep.

## Review Focus

1. **A `/fly` link typed, shared, reloaded, or gone Back to.** None of these ever throws:
   - `?at=` that is junk, missing, or out of range (`lat 120`)
   - the id of an appended system or of another layer (`/fly/e:2,-3,1:0:0`)
   - a moon, or a gas giant or a named world with `?at=`
   - a reload (the row is kept in `history.state`)
   - Back from the universe to the flight

   The flight starts over the spot it was given, or, given none it can read, where it starts today. Only an id that isn't a planet or a moon is the 404. Pinned in Task 1 (rows in 3D, past the count), Task 10 (`readSpot`, `landingOf`, the state's row) and Task 14 (Back and reload: `universePathFor`).
2. **A dive at a frame or two a second, or a page that never goes.**
   - The dive runs on the wall clock, so the hand-off comes `DIVE.hand` seconds after the dive begins whatever the frame rate. At software GL's 1–2 frames a second, with `dt` held to 0.05 s, a timeline on `dt` would take 40 s.
   - The hand-off is said once.
   - If the page hasn't left `DIVE.giveUp` seconds later (a frozen page, a lost event), the ship is put back over the air, flying, and the dive is over.

   Pinned in Task 11.
3. **A planet that won't take you.** Each of these turns you back with its own line, or crashes as today, and never dives into nothing:
   - a gas giant
   - a ringed giant
   - any planet in a pocket universe
   - a ship too fast for the air
   - a rocky planet with the flight removed

   Pinned in Task 9 (`turnBack`) and Task 11 (each case, and the fandom rule as it was).
4. **Walking where you shouldn't.** Out into the sea, up a cliff, into the parked ship, a jump on a slope, a long way off: the walker is never under the ground or NaN, and the way back to the ship is always shown. Pinned in Task 13 (`footing`) and Task 14 (the way back, boarding only near the ship).
5. **Touch, keys and leaving mid-landing.**
   - On a phone you can land, get out, walk, get back in and take off with the HUD's buttons.
   - The flying keys and the walking keys are never bound at once.
   - Leaving the page mid-landing unbinds everything and keeps nothing.

   Pinned in Task 14 (key sets by phase, the prompts' `onClick`, dispose) and its phone shot.

## Files

| File | Responsibility | Task |
|---|---|---|
| `src/components/expanse/flight/rows.js` (new) | lane 5a's rows for a planet, a moon (and a rogue, Task 15) from the generator's rows | 1, 15 |
| `src/components/expanse/flight/planets.js` | `expanseRow` through lane 2's `placeOf`, in 3D; `planetSpecOf(id, { row })` | 1, 10, 15 |
| `src/lib/land/flight/orbitMap.js`, `orbitMap.worker.js`, `orbitMaps.js` (lane 5a's) | the bake's relief; a bake from a row; `forRow` | 2, 6 |
| `src/components/galaxy/bodySkin.js`, `bodies.js` | `skinBytes`, `skinRelief`, `ORBIT_SKIN`, `SKIN_GLOW`; `buildBody`'s `orbit` option | 3 |
| `src/components/expanse/shared/flight.js` (new, on the island) | the flight's face for the universe: rows, orbit looks, who lands, the route | 4, 15 |
| `src/lib/land/flight/arrival.js` (new) | the spot in the URL; where the flight starts | 4, 10 |
| `scripts/lib/flight-island.mjs` | the face, its name, the new marked files | 4, 5, 11, 14 |
| `src/components/universe/landing/sceneLanding.js` (new) | the scene's landings: orbit skins, the air (fandom and generated), the dive, the hand-off, the dev hooks | 5, 11, 15 |
| `src/components/expanse/scene/near.js`, `expanse.js` (lane 2's) | a build's `of`; `build` threaded through | 5 |
| `src/components/universe/scene.js` | wiring only, smaller after | 5, 9, 11, 13 |
| `scripts/universe-check.mjs` | waits for the orbit maps before measuring | 5 |
| `src/lib/land/flight/biomeTint.js` (new), `field.js` (lane 5a's) | a biome's tint, the same on the ground and from orbit | 6 |
| `src/lib/land/flight/leafMesh.js`, `src/components/expanse/flight/terrain.worker.js`, `ground.js`, `src/lib/three/groundLook.js` | the ground wears the tints | 7 |
| `src/components/expanse/flight/weather.js` (new), `scene.js`, `eventPlays.js`, `module.js` | standing weather; clouds, rings and moons in the sky | 8 |
| `src/components/universe/entry.js`, `words.js` | the dive's rules; `LAND_WORDS`, `FOOT_WORDS`, `SHIP_NAMES` | 9 |
| `src/pages/Fly.jsx`, `src/components/expanse/flight/flight.css` | the spot, the row, the cover in and out, leaving | 10, 14 |
| `src/pages/Universe.jsx` | the hand-off: the fade and the route | 11 |
| `scripts/universe-endless-check.mjs` | the `dive`, `ground`, `back` and `gas` steps | 11, 14 |
| `src/lib/land/flight/touchdown.js` (new) | setting down, lifting off, leaving the air | 12 |
| `src/components/universe/foot.js`, `footScene.js` | `CAM`, `FOOT_FOV`, `chaseView`, `easeView`, `motionOf` moved out of the scenes; `crewCast` | 13 |
| `src/components/universe/shared/foot.js`, `crew.js` (new faces) | the walker and its words; the figures, lazily | 13 |
| `src/components/expanse/flight/footing.js` (new) | the universe's walk on the flight's chart, heights from the field | 13 |
| `src/components/expanse/flight/landing.js` (new), `walker.js` (new), `module.js`, `scene.js`, `FlightHud.jsx` | phases, the walker drawn, keys, the camera on foot, the HUD | 14 |
| `src/lib/view.js` | `/fly/e:…` goes back to `/universe/E:…` | 14, 15 |
| `src/lib/land/flight/expanse.js`, `variety.js` (lane 5a's); `src/components/universe/things/looks/rogue.js` (lane 4a's) | a rogue planet's id, row and variety; its body through the landing's build | 15 |
| `docs/superpowers/evidence/endless-universe-lane-5b/` | README, shots, HANDOFF-NOTES.md | 5–16 |

---

## PR 5b.1: Orbit

### Task 1: The flight reads any generated planet or moon, in 3D

Today `expanseRow` reads only the legacy middle layer (`planets.js:35-42`'s `makeSector(...).systems[i]`). Lane 2 appends systems and adds layers above and below, so a dive into most generated planets would land on the 404.

**Files:**
- Create: `src/components/expanse/flight/rows.js`, `src/components/expanse/flight/rows.test.js`
- Modify: `src/components/expanse/flight/planets.js`
  - lane 5a's `rowOf` and `moonRowOf` move to `rows.js` unchanged, and `planets.js` re-exports `moonRowOf`
  - `expanseRow` (`:35-42`) is rewritten
- Modify: `src/components/expanse/flight/planets.test.js`. Lane 2's finding 4: the assertion `planetSpecOf('e:1,0:99:0')` is `null` now names a real planet. It's replaced by one past the sector's count. Say so in the commit; nothing else in the file changes.

**Interfaces:**
- Consumes:
  - lane 2's `placeOf(universe, id) → { kind: 'system' | 'planet' | 'moon' | 'wonder' | 'thing' | 'extra', row, sector } | null` (`expanse/gen/space.js`)
  - `fullSector(universe, sx, sy, sz)`
  - `UNIVERSE` (`gen/seed.js`)
  - lane 5a's `canonicalId(id)` (`lib/land/flight/expanse.js`), `rowOf(p, s)` and `moonRowOf(p, s, k)`
  - Task 0's `parseSpaceId`
- Produces, in `rows.js` (pure; it imports only `lib/space/address.js`):
  - `rowOf(planet, system) → Row` and `moonRowOf(planet, system, k) → Row | null`, lane 5a's, moved as they are. A **Row** is `{ id (lower-case canonical), name, type, seed: string, radius, moons, rings, system: { faction, traffic, hazard }, parent? }`.
  - `rowOfPlace(found, id) → Row | null`:
    - for `found.kind === 'planet'`, `rowOf(found.row, found.sector.systems[p.system])`
    - for `'moon'`, `moonRowOf(found.sector.systems[p.system].planets[p.planet], found.sector.systems[p.system], p.moon)`, where `p = parseSpaceId(id)`
    - anything else gives null
- Produces, in `planets.js`:
  - `expanseRow(id) → Row | null`. It is `canonicalId(id)`, then `rowOfPlace(placeOf(UNIVERSE, cid), cid)`. That covers every layer, appended systems and moons.
  - `EXPANSE` (the thirteen) is still made from `makeSector`, as today.

- [ ] **Step 1: Write the failing tests** in `rows.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { UNIVERSE } from '../gen/seed';
import { fullSector } from '../gen/space';
import { expanseRow, planetSpecOf } from './planets';

const mid = fullSector(UNIVERSE, 1, 0, 0);
const up = fullSector(UNIVERSE, 2, 1, -3); // E:2,-3,1

describe('the flight reads any generated planet or moon', () => {
  it('reads a planet of an appended system, either case', () => {
    const p = mid.systems[mid.legacy.systems + 3].planets[0];
    expect(expanseRow(p.id)).toMatchObject({ id: p.id.toLowerCase(), name: p.name, type: p.type, radius: p.radius, seed: String(p.seed) });
    expect(expanseRow(p.id.toLowerCase())).toEqual(expanseRow(p.id));
  });
  it('reads a planet off the middle layer, and makes its spec', () => {
    const p = up.systems[0].planets[0];
    expect(expanseRow(p.id)).toMatchObject({ id: p.id.toLowerCase(), type: p.type });
    expect(planetSpecOf(p.id)?.id).toBe(p.id.toLowerCase());
  });
  it('reads a moon from its planet’s moon rows', () => {
    const p = mid.systems.flatMap((s) => s.planets).find((x) => x.moonList.length);
    const m = p.moonList[0];
    expect(expanseRow(m.id)).toMatchObject({ id: m.id.toLowerCase(), type: m.type, parent: p.id.toLowerCase() });
  });
  it('is null past the sector’s count, for a system or a thing, and never throws', () => {
    for (const id of [`e:1,0:${mid.systems.length}:0`, 'e:1,0:0', 'e:1,0:w64', 'e:1,0:0:99', 'nonsense', null]) expect(expanseRow(id), String(id)).toBeNull();
  });
});
```

  In `planets.test.js`, `expect(planetSpecOf('e:1,0:99:0')).toBeNull();` becomes ``expect(planetSpecOf(`e:1,0:${fullSector(UNIVERSE, 1, 0, 0).systems.length}:0`)).toBeNull();``.

- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/components/expanse/flight/rows.test.js src/components/expanse/flight/planets.test.js`
Expected: FAIL. The appended system's planet and `E:2,-3,1`'s are null; `./rows` isn't found.

- [ ] **Step 3: Implement `rows.js` and the new `expanseRow`.** Header comment in the house style. `placeOf` keeps its own LRU of eight sectors, so a page that asks twice makes one sector.

- [ ] **Step 4: Run them, and the flight's tests and the lock.**
Run: `npx vitest run src/components/expanse/flight src/lib/land/flight`
Expected: PASS, `the roster` and `'makes the rows the fixture holds'` included.

- [ ] **Step 5: Commit.** `git commit -m "The planet flight reads any generated planet or moon, in every layer and every appended system"`

### Task 2: The orbit map's relief, and a bake from a row

The universe never makes a spec on its main thread: a generated spec places its POIs by sampling the sphere, a few milliseconds a planet, times twenty bodies when a system is built. So the bake takes the row and makes the spec in the worker. The bake also keeps the heights it already samples, as a relief map, so mountains read from orbit by the same field.

**Files:**
- Modify (lane 5a's): `src/lib/land/flight/orbitMap.js`, `orbitMap.test.js`, `orbitMap.worker.js`, `orbitMap.worker.test.js`, `orbitMaps.js`, `orbitMaps.test.js`

**Interfaces:**
- Consumes:
  - lane 5a's `bakeOrbitMap`, `ORBIT_MAP_SIZE`, `orbitMapSize`, `PLANE_WINDOW`, `createOrbitMaps`, `planetSpecOf(id, { expanse })`, `sphereField`, `dirOfUv`
  - lane 2's `BUDGET` (`universe/budget.js`), in the test only
- Produces:
  - `RELIEF_GAIN = 6`.
  - `bakeOrbitMap(spec, { width, height }) → { width, height, rgba, biome, relief }`. `relief` is a `Uint8Array(width × height × 4)`:
    - R is `128 + 127 × clamp(gE × RELIEF_GAIN, −1, 1)`, G is the same for `gN`, B is 128 and A is 255.
    - `gE = (h[i+1] − h[i−1]) / (2·ΔE)`, with `i` wrapping round. `gN = (h[j−1] − h[j+1]) / (2·ΔN)`: row `j − 1` is further north, and the first and last rows are one-sided.
    - Round specs: `ΔE = 2πR·max(cos lat, 1e−3) / width` and `ΔN = πR / height`.
    - Plane specs: `ΔE = PLANE_WINDOW / width` and `ΔN = PLANE_WINDOW / (2·height)`.
    - Gas and ringed specs: every texel is `[128, 128, 128, 255]`.
    - `h` is the height the bake already samples for the texel. Nothing is sampled twice.
  - The worker takes `{ key, row, width, height }` as well as `{ key, spec, … }`. With `row`, it makes `planetSpecOf(row.id, { expanse: [row] })` itself and answers null for a row with no spec. It transfers `relief.buffer` with the others.
  - `createOrbitMaps(…).forRow(row, tier) → Promise<map | null>`. It is `get`'s twin: the key is `` `${row.id}:${w}x${h}` ``, it shares `get`'s cache, in-flight sharing and cap, and it sends `{ key, row, width, height }`.

- [ ] **Step 1: Write the failing tests.**
  - `orbitMap.test.js`, `describe('the relief')`:
    - `'is flat on a gas giant'`: every texel of a 16 × 8 gas bake is `[128, 128, 128, 255]`.
    - `'is the height’s slope, east and north, wrapping round'`: for `round[0]` at 64 × 32, a texel's R decodes to `clamp(gE × RELIEF_GAIN, −1, 1)` within 1/127. `gE` is worked out from `sphereField(spec).sample(dirOfUv(...)).h` at the two neighbours' centres, column 0 reading column 63.
    - `'is the same bytes twice'` extends to `relief`.
  - `orbitMap.test.js`: `'is one table with the universe’s budget'`. For each tier, `ORBIT_MAP_SIZE[t]` deep-equals `BUDGET[t].planetMap`.
  - `orbitMap.worker.test.js`: `'bakes from a row, making the spec itself'`. The answer for `{ key, row: MOONS[0], width: 16, height: 8 }` has `rgba`, `biome` and `relief` transferred. Its `rgba` equals `bakeOrbitMap(planetSpecOf(MOONS[0].id, { expanse: MOONS }), { width: 16, height: 8 }).rgba`.
  - `orbitMaps.test.js`: `'bakes from a row, once for two asks, sharing get’s cache'`. Two `forRow(row, 'mid')` calls at once make one request with `{ key: `${row.id}:256x128`, row }`. A third gives the same map.
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/lib/land/flight/orbitMap.test.js src/lib/land/flight/orbitMap.worker.test.js src/lib/land/flight/orbitMaps.test.js`
Expected: FAIL. There's no `relief`, no `forRow`, and the worker ignores `row`.
- [ ] **Step 3: Implement.** Time a 256 × 128 bake of a rocky round planet in Node, five times. Write the median into the README under "The bake". Over 1,000 ms is finding 5.
- [ ] **Step 4: Run them to see them pass.** Same command. Expected: PASS, and lane 5a's texel test unchanged.
- [ ] **Step 5: Commit.** `git commit -m "An orbit map carries its relief, and is baked from the planet's row in the worker"`

### Task 3: `buildBody` wears an orbit map

**Files:**
- Modify: `src/components/galaxy/bodySkin.js`
  - `SKIN_FRAG` (`:39-107`) gains a `SKIN_GLOW` branch
  - add `ORBIT_SKIN`, `skinBytes` and `skinRelief`
- Modify: `src/components/galaxy/bodies.js`
  - `buildBody` (`:330`), its options, `defines` (`:366-370`), the skin's block (`:394-446`), `update` (`:518-530`) and `dispose`
- Test: `src/components/galaxy/bodySkin.test.js`, `src/components/galaxy/bodies.test.js`

**Interfaces:**
- Consumes: lane 2's `bodies.js` as it is after its PR 2.3 (`uCenter` and `uRot` set in `onBeforeRender`).
- Produces:
  - `ORBIT_SKIN = { fade: 0.6, normal: 0.35, seas: 0.5, glow: 1.4 }`.
  - **`skinBytes(map) → Uint8Array`**. It takes lane 5a's map (row 0 is the north pole, alpha 0 under water) to the skin's texture:
    - the rows are reversed, so texture row 0 is the south pole and `skinUv`'s `v = 1` reads the map's top row
    - the alpha is `255 − a`, so water is 255 and `SKIN_SEAS` reads it as wet at `seas = 0.5`
  - **`skinRelief(map) → Uint8Array | null`**: the relief's rows reversed, or null when the map has none.
  - **`buildBody(look, { r, small, tier, load, orbit })`**, with `orbit = { map: Promise<map | null> | map | null, clouds: { cover, color } | null, atmo: { color, density } | null, glow = false }`:
    - **Defines.** `SKIN` and `SKIN_SEAS` always; `SKIN_NORMAL` once a relief is given; `SKIN_GLOW` when `glow`. The surface shader is `surfaceFrag(…, { skin: true })`.
    - **Uniforms.** `uSkinK = (1, ORBIT_SKIN.normal, 1, ORBIT_SKIN.seas)` and `uSkinC = (1, 0, 0, 0)`. `uSkinColor` and `uSkinNormal` are the blanks until the map lands. Then each is a `DataTexture`:
      - sRGB colour space for the colour, linear for the relief
      - `RepeatWrapping` across, mipmapped, `LinearMipmapLinearFilter`
    - **Clouds and air.** `L.clouds` is replaced by `orbit.clouds` when given, as `sky(cover, color)`, and `CLOUDS` is defined when `cover > 0`. `L.atmo` is replaced by `orbit.atmo` when given, as `air(color, density)`.
    - **The mix.** `uSkinMix` is 0 until the map is in. From then it rises by `dt / ORBIT_SKIN.fade` an `update` to 1, and it never falls with distance: an orbit map has no procedural ground to give way to.
    - It works on a `small` body too (moons).
    - `dispose` frees both textures.
    - The body gains `orbitIn() → 0…1`, the mix.
  - **`SKIN_GLOW`**: `s.emit = mix(s.emit, c.rgb * wetness * ORBIT_SKIN.glow, k)`. `wetness` is the `SKIN_SEAS` term, and the glow value is spliced in from the JS constant. A lava planet's lava glows from orbit. Without the define, `s.emit *= 1.0 - k`, as today.
  - **Without `orbit`**, nothing changes: the same defines, uniforms and fragment shader as before, for every look, painted or not.

- [ ] **Step 1: Write the failing tests.**
  - `bodySkin.test.js`:
    - `'lays a baked map as the skin reads it'`. Use a 4 × 2 map whose row 0 is red with alpha 255 and row 1 is blue with alpha 0. `skinBytes` gives row 0 blue with alpha 255 and row 1 red with alpha 0.
    - `skinRelief` reverses the rows the same way, and is null with no relief.
  - `bodies.test.js`:
    - `'compiles what it did without an orbit map'`. Before any change, record `[mat.defines, sha1(mat.fragmentShader)]` for `'hoth'`, `'mustafar'`, `'moon-grey'` small, and a look with `skin` (the first in `planetSkins.json`), into `bodies.fixture.json`. The test asserts they are unchanged.
    - `'wears an orbit map once it lands, fading in, never by distance'`:
      - `buildBody('moon-dust', { r: 40, orbit: { map: Promise.resolve(map), clouds: { cover: 0.4, color: '#ffffff' }, atmo: null } })`
      - after `await` and `update(0, cam)`, `orbitIn()` is 0 and `uSkinColor` is a `DataTexture` of the map's size
      - with updates 0.1 s apart (`update` holds its step to 0.1 s, `bodies.js:519`), it is 0.5 ± 0.01 after three and 1 after six
      - a camera at 1.1 radii keeps it at 1
      - `defines` has `SKIN`, `SKIN_SEAS`, `SKIN_NORMAL` and `CLOUDS`
    - `'stays procedural for a map that never comes, and frees what it made'`: `map: Promise.resolve(null)` keeps `orbitIn()` 0. `dispose()` disposes each texture made (spy).
    - `'lets lava glow'`: `glow: true` adds `SKIN_GLOW`, and the fragment holds `ORBIT_SKIN.glow`'s value.
    - `'takes a moon'`: `small: true` with `orbit` still defines `SKIN`.
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/components/galaxy/bodySkin.test.js src/components/galaxy/bodies.test.js`
Expected: FAIL. The fixture test passes on the unchanged code: write the fixture first, then the rest. `skinBytes` and `orbit` don't exist.
- [ ] **Step 3: Implement.** The `orbit` path reuses `take`'s structure, with the textures made from the map, not loaded.
- [ ] **Step 4: Run them to see them pass.**
Run: `npx vitest run src/components/galaxy`
Expected: PASS, the galaxy's tests unchanged.
- [ ] **Step 5: Commit.** `git commit -m "A body can wear a baked orbit map, its clouds, air and relief, fading in"`

### Task 4: The flight's face for the universe

**Files:**
- Create: `src/components/expanse/shared/flight.js`, `src/components/expanse/shared/flight.test.js`
- Create: `src/lib/land/flight/arrival.js`, `src/lib/land/flight/arrival.test.js` (the spot's query; Task 10 adds the rest)
- Modify: `scripts/lib/flight-island.mjs`
  - `ISLAND.files` gains `'src/components/expanse/shared/flight.js'`
  - `NAMES` gains `/expanse\/shared\/flight\b/`
  - the header's comment says why: the universe's one way in
- Modify: `scripts/lib/flight-island.test.mjs`. Add `'takes a row that imports the flight’s face as a reference'`: a fake tree with a universe file importing `'../../expanse/shared/flight'`, unmarked, is reported `unmarked`, and marked it is clean.

**Interfaces:**
- Consumes:
  - Task 1's `rowOf`, `moonRowOf`
  - Task 2's `createOrbitMaps(…).forRow`
  - lane 5a's `varietyOf(row)` (`variety.js`), `SEEDED_EXPANSE` and `familyOf` (`planetTables.js`), `canonicalId`, `latLonOfDir`, `frameAt`, `unit`
  - Task 0's `parseSpaceId`
- Produces, in `arrival.js` (pure):
  - `spotQuery({ lat, lon, bearing }) → string`: `at=<lat>,<lon>,<bearing>`. Degrees, four decimals; the bearing is clockwise from north, 0…360.
  - `readSpot(search) → { lat, lon, bearing } | null`. It reads `?at=…` out of a `location.search`.
    - The latitude must be within −90…90 and the longitude within −180…180.
    - The bearing defaults to 0 and is wrapped into 0…360.
    - Anything else gives null.
- Produces, in `flight.js`: **`createFlightLink({ workers, tier = 'mid', maps = workers ? createOrbitMaps({ workers }) : null }) → link`**. With no `workers` (Node) there are no maps. The link's methods:
  - **`rowFor(of) → Row | null`.** `of` is a build's context from lane 2's `near.js` (Task 5): `{ id, row, system, planet? }`, the generator's own rows.
    - A planet is `rowOf(of.row, of.system)`.
    - A moon (with `of.planet`) is `moonRowOf(of.planet, of.system, parseSpaceId(of.id).moon)`.
    - Memoised by id (the last 128).
  - **`landable(of) → boolean`**: true for a moon, and for a planet whose `familyOf(type)` isn't `gas` or `ringed`.
  - **`orbit(of) → { map, clouds, atmo, glow } | null`.** Null with no `maps`, or with no row.
    - `map` is `maps.forRow(row, tier)`.
    - A seeded roster row (in `SEEDED_EXPANSE`) has `clouds: null, atmo: null, glow: false`, so the base look's stand.
    - Any other row has `v = varietyOf(row)`, then:
      - `clouds: { cover: v.sky.clouds, color: v.sky.cloudColour }`
      - `atmo: { color: v.sky.high, density: 1.6 + 1.4 × v.sky.haze }`
      - `glow: v.water?.kind === 'lava'`
    - None of it samples a field: `varietyOf` is draws from the row's seed.
  - **`cover(of) → '#rrggbb'`**: `varietyOf(row).sky.cloudColour`, or `'#e9eef4'` (`footScene.js`'s entry cloud) for a seeded row.
  - **`route(of, { dir, track }) → { to, state }`.**
    - `dir` (the spot) and `track` (the way it was heading there) are unit vectors in the body's own frame.
    - `to` is `` `/fly/${row.id}?${spotQuery({ lat, lon, bearing })}` ``, with `[lat, lon] = latLonOfDir(dir)`. The bearing is `atan2(track·east, track·north)` in degrees, from `frameAt(dir)`.
    - `state` is `{ from: 'universe', row, cover: cover(of) }`, plain data.
  - **`dispose()`** closes `maps`.

- [ ] **Step 1: Write the failing tests.**
  - `arrival.test.js`:
    - `'writes and reads a spot'`: a round trip at five spots to 1e−4°.
    - `'reads nothing from junk'`: `''`, `'?at=abc'`, `'?at=120,0'`, `'?at=0,200,0'`, `'?at=1,2'` with the bearing 0, `'?x=1'`. Only `'?at=1,2'` reads, as `{ lat: 1, lon: 2, bearing: 0 }`.
    - `'wraps the bearing'`: `-90` reads as 270.
  - `flight.test.js` (with lane 2's `fullSector` for `E:1,0` and lane 5a's fake pool from `orbitMaps.test.js`):
    - `'makes one row for a planet and a moon'`: `rowFor({ id: p.id, row: p, system: s })` equals `expanseRow(p.id)` (Task 1). The moon's equals `expanseRow(m.id)`.
    - `'lands on rock and moons, never on a giant'`: over `E:1,0`'s first 200 planets, `landable` is `!['gas', 'ringed'].includes(type)`. Every moon is landable.
    - `'wears a generated planet’s own sky, and a seeded one’s base look'`:
      - a generated rock planet's `orbit(of)` has `clouds.cover === varietyOf(row).sky.clouds`, and its `map` resolves the fake pool's answer
      - `e:1,0:0:1`'s (seeded) has `clouds: null, atmo: null`
      - with no workers, `orbit` is null
    - `'writes the route to the spot it was given'`:
      - `route(of, { dir: dirOfLatLon(12.5, -40), track: <east at that spot> })` has `to` matching `/^\/fly\/e:1,0:\d+:\d+\?at=12\.5000,-40\.0000,90\.0000$/`
      - its `state.row` is `rowFor(of)`, and `JSON.parse(JSON.stringify(state))` equals `state`
    - `'never makes a spec on the calling thread'`: `vi.mock` lane 5a's `planetSpec.js` with its own exports and a counting `planetSpecOf`. `orbit`, `landable`, `cover` and `route` for ten planets call it 0 times.
  - `scripts/lib/flight-island.test.mjs`'s new test.
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/lib/land/flight/arrival.test.js src/components/expanse/shared/flight.test.js scripts/lib/flight-island.test.mjs`
Expected: FAIL. The modules don't exist, and the island lib doesn't know the face.
- [ ] **Step 3: Implement.** The face's header says what it is: the flight's one way into the universe, on the island, so the flight goes whole.
- [ ] **Step 4: Run them, and the island.**
Run: `npx vitest run src/lib/land/flight src/components/expanse scripts/lib/flight-island.test.mjs scripts/flight-island.test.mjs && node scripts/flight-island.mjs --check`
Expected: PASS, then `ok …` with one more file on the island.
- [ ] **Step 5: Commit.** `git commit -m "The flight lends the universe one face: a planet's row, its orbit look, whether it lands and the way down"`

### Task 5: Generated planets and moons wear their orbit maps

**Files:**
- Create: `src/components/universe/landing/sceneLanding.js`, `src/components/universe/landing/sceneLanding.test.js`
- Modify (lane 2's): `src/components/expanse/scene/near.js`
  - its planet build, `build(TYPE_LOOK[p.type] ?? TYPE_LOOK.rock, { r: p.radius, tier })`, gains `of: { id: p.id, row: p, system: s }`
  - its moon build gains `of: { id: m.id, row: m, system: s, planet: p }`
  - find them by `TYPE_LOOK[` and `small: true`
- Modify (lane 2's): `src/components/expanse/scene/expanse.js`. `createExpanse`'s options gain `build`, handed to `createNear`.
- Modify: `src/components/universe/scene.js`, in place:
  - `import { createSceneLanding } from './landing/sceneLanding';` (+1)
  - after `createExpanse(…)` (`:772-780`), one line (+1):

    ```js
    const landing = createSceneLanding({ map, workers: ctx.rt.workers, tier, small, reduced, ship: () => state.ship, setShip: (s) => (state.ship = s), busy: () => onFoot() || Boolean(state.crash), dropAuto: () => dropAuto(), invalidate: () => ctx.invalidate() });
    ```

    `map`, `tier`, `small`, `reduced` and `ctx` are values declared above `:772` and never reassigned. `onFoot` (`:843`) and `dropAuto` (`:1769`) are declared below, so they go in as thunks.
  - `createExpanse`'s options gain `build: (look, o) => landing.build(look, o),` on its `reduced,` line (0). It's a thunk, because `landing` is made after it.
  - `diveAt` and its comment (`:5832-5847`, 16 lines) move into `sceneLanding` as `debug.diveAt`, unchanged for the fandom planets. In `__universeDebug` (`:5911`), `diveAt,` becomes `diveAt: landing.debug.diveAt, landing: landing.debug,` (0).
  - `SHIP_NAMES` (`:288`) moves to `words.js` as an export, and the scene imports it on its `./words` import line (−1, 0).
  - **The count:** +2, −17.
- Modify: `scripts/universe-check.mjs`. After the pose's near maps (`:178`), it waits for the orbit maps the same way: `(window.__universeDebug.landing?.pending?.() ?? 0) === 0`, polling 250 ms, giving up after 120 s with a warning printed.
- Modify: `scripts/lib/flight-island.mjs`. `ISLAND.rows` gains `'src/components/universe/landing/sceneLanding.js'`.
- Modify: `src/lib/words.test.js`. `FILES` gains `...list('components/universe/landing/', /\.js$/)`.

**Interfaces:**
- Consumes:
  - Task 3's `buildBody(look, { orbit })`
  - Task 4's `createFlightLink`
  - lane 2's `createNear` build contract and its planet and moon rows
  - `entry.js`'s `LANDABLE`, `airTop`
  - `ship.js`'s `headingTo`, `SHIP`
- Produces: **`createSceneLanding(deps) → landing`**, the first half. Task 11 adds the rest.
  - **`deps`**: `{ map, workers, tier, small, reduced, ship, setShip, busy, dropAuto, invalidate, link = undefined, build = buildBody }`. `link` undefined means the flight's. Tests pass a fake, or null for "no flight".
  - **The import** of the face and the one line that makes the link are each marked `// planet flight`:

    ```js
    import { createFlightLink } from '../../expanse/shared/flight'; // planet flight
    …
    if (link === undefined) link = createFlightLink({ workers, tier }); // planet flight
    ```

    With them gone, `link` stays undefined and is read as none.
  - **`build(look, opts) → body`.** It is `build(look, { ...opts, orbit: opts.of && link ? link.orbit(opts.of) : undefined })`.
    - It keeps every built body that has an `of` in a registry by id: `{ id, of, body }`.
    - It wraps the body's `dispose` to drop it from the registry.
    - It counts the body's map as pending until its promise settles.
  - **`bodies() → [{ id, of, body }]`**, the registry.
  - **`pending() → number`**, the maps still baking.
  - **`debug`**: `{ diveAt(id, speed = SHIP.cruise, from = [1, 0, 0]), pending }`. `diveAt` is today's (`scene.js:5832-5847`), word for word, reading the ship through `ship()` and writing it through `setShip`.
  - **`dispose()`**: the link's, and the registry cleared.

- [ ] **Step 1: Take the before shots on the branch as it is.** Run `node scripts/universe-check.mjs --quality mid --poses expanse-system,expanse-station --out lab/universe/before-5b/mid`. Leave `expanse-station` out if lane 3's pose isn't on the branch. Keep its JSON.
- [ ] **Step 2: Write the failing tests** in `sceneLanding.test.js` (Node, three). Use a fake `build` returning `{ group: new THREE.Group(), radius: r, dispose: vi.fn() }`, and a fake link whose `orbit` returns `{ map: Promise.resolve(MAP), clouds: null, atmo: null, glow: false }`.
  - `'dresses a generated planet and a moon in their orbit maps, and nothing else'`:
    - `build('moon-dust', { r: 30, of })` passes `orbit` from `link.orbit(of)`
    - `build('hoth', { r: 4, small: true })` with no `of` passes none
    - with `link: null`, none at all
  - `'keeps a registry of what it built, and lets go on dispose'`: two builds give `bodies()` two entries. Disposing one leaves one.
  - `'says how many maps are still baking'`: `pending()` is 1 until the map's promise settles, then 0. A promise that rejects settles too.
  - `'still puts the ship outside a fandom planet’s air for a script'`: `debug.diveAt('marvel')` writes a ship at `airTop(p) + 0.6` from `p.at`, heading at it. It refuses while `busy()`.
- [ ] **Step 3: Run them to see them fail.**
Run: `npx vitest run src/components/universe/landing`
Expected: FAIL, `./sceneLanding` not found.
- [ ] **Step 4: Implement, wire, and count `scene.js`'s lines.**
- [ ] **Step 5: Run the tests and the island.**
Run: `npm test && node scripts/flight-island.mjs --check`
Expected: PASS, then `ok`.
- [ ] **Step 6: Check it in the browser.**
  - Run `node scripts/universe-check.mjs --quality mid --poses expanse-system,expanse-station --out lab/universe/after-5b/mid`.
  - Expected:
    - calls and triangles equal to Step 1's at both poses (a skin is a define, not a draw)
    - the planets in view wear their maps
    - no console errors
  - Put the pair side by side in the README, and the numbers.
  - `scripts/entry-check.mjs` passes (the moved `diveAt`).
- [ ] **Step 7: Commit.** `git commit -m "Generated planets and moons wear the maps baked from their ground, from orbit"`. The body has `scene.js`'s count and the poses' numbers.

---

## PR 5b.2: The flight's ground

### Task 6: A biome's tint, the same on the ground and from orbit

Lane 5a's finding 1: biomes show from orbit only through their heights, because the ground shader colours by height and slope. This task gives each biome a tint from the planet's own palette, as one pure rule that both the ground and the orbit map read.

**Files:**
- Create: `src/lib/land/flight/biomeTint.js`, `src/lib/land/flight/biomeTint.test.js`
- Modify (lane 5a's): `src/lib/land/flight/field.js`. The round branch's field gains `tintAt(x, z)`.
- Modify (lane 5a's): `src/lib/land/flight/orbitMap.js`
  - `groundColour(spec, { h, slope, tint = null })`
  - the round bake passes `tint`
- Test: `src/lib/land/flight/orbitMap.test.js`, `src/lib/land/flight/field.test.js`

**Interfaces:**
- Consumes: lane 5a's `roundBiomes`, `ROUND_ROUGH` (its ids), `weightsAt`, `sphereField(spec).climateAt`, `chartOf`, and the variety palette's slots (`low`, `high`, `rock`, `accent`, `deep`).
- Produces:
  - **`BIOME_TINT[family][biomeId] → [slot, k]`**: which of the planet's palette colours the biome leans toward, and how far (my call; the table's coverage is the test).
    - ice: plains `['high', 0]`, shelf `['deep', 0.35]`, range `['rock', 0.25]`, glacier `['accent', 0.3]`, valley `['low', 0.3]`
    - desert: jundland `['rock', 0.3]`, dunesea `['high', 0.3]`, plateau `['accent', 0.3]`, chott `['deep', 0.35]`, wastes `['low', 0.2]`
    - forest: redwoods `['deep', 0.4]`, savannah `['accent', 0.35]`, range `['rock', 0.3]`, lakes `['low', 0.3]`, desert `['high', 0.4]`
    - lava: fields `['low', 0]`, volcanoes `['rock', 0.3]`, ash `['deep', 0.4]`, glass `['accent', 0.35]`
    - ocean: islands `['high', 0.2]`, volcano `['rock', 0.35]`, reef `['accent', 0.4]`, deep `['deep', 0.3]`
    - rock: plains `['low', 0]`, mesas `['accent', 0.3]`, badlands `['rock', 0.35]`, craters `['deep', 0.3]`
  - **`biomeTints(spec) → [[r, g, b, k] …] | null`**, one per `spec.biomes` index, from `spec.palette`. The colours are sRGB bytes and `k` is 0…1. It is null for a spec with no `round`.
  - **`tintAt(spec, dir) → [r, g, b, k]`**: `Σ w_b × tints[b]`, where `w = weightsAt(spec.biomes, ...sphereField(spec).climateAt(dir))` normalised. The colour is mixed in linear light and stored back as sRGB bytes. It is `[0, 0, 0, 0]` for a plane spec. It keeps each spec's `sphereField` and tints in a `WeakMap`, so a leaf's thousand vertices build them once.
  - **`planetField(spec).tintAt(x, z)`**, for a round spec: `tintAt(spec, chart.toDir(x, z))`. A plane spec's field has none, so it is `undefined`.
  - **`groundColour(spec, { h, slope, tint })`**: right after `mix(low, high, smoothstep(hLow, hHigh, h))`, `c = mix(c, linear(tint.rgb), tint.k)`. Everything after is as lane 5a has it. With no `tint`, it is exactly lane 5a's.
  - **The round bake** passes `tint: tintAt(spec, dir)` at each texel.

- [ ] **Step 1: Write the failing tests.**
  - `biomeTint.test.js`:
    - `'has a tint for every biome a round planet has'`: for each family of `roundBiomes`, every id has a `BIOME_TINT` row, and every slot is one of the five.
    - `'tints only round planets'`: `biomeTints(planetSpecOf('hoth'))` is null, and `tintAt` of a plane spec is `[0, 0, 0, 0]`.
    - `'blends between biomes without a seam'`: over `randomDirs(500, 2)` on `roundSpec({ type: 'forest', kind: 'continents' })`, two points 4 m apart differ by at most 2 in any byte.
    - `'shows the biomes apart'`: for ten generated forest specs, the tints of the two most common biomes on a 64 × 32 grid differ by at least 12 in some byte.
  - `orbitMap.test.js`:
    - lane 5a's `'shows what the ground shows'` passes `tint: g.tintAt(0, 0)` to `groundColour` and still matches to the byte
    - `'tints nothing on the fifty'`: every texel of the 50's bakes at 16 × 8 is unchanged from a fixture recorded before this task
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/lib/land/flight/biomeTint.test.js src/lib/land/flight/orbitMap.test.js src/lib/land/flight/field.test.js`
Expected: FAIL. Record the fifty's fixture on unchanged code first.
- [ ] **Step 3: Implement.** If `'shows the biomes apart'` fails, raise that family's `k` values, never the threshold.
- [ ] **Step 4: Run them, and the lock.**
Run: `npx vitest run src/lib/land/flight`
Expected: PASS, `the roster` included.
- [ ] **Step 5: Commit.** `git commit -m "Each biome of a generated planet takes a tint from its palette, on the ground and from orbit alike"`

### Task 7: The flight's ground wears the tints

**Files:**
- Modify: `src/lib/land/flight/leafMesh.js`
  - `makeLeaf` (`:44` on) returns `tints`
  - its header's signature line gains it
- Modify: `src/components/expanse/flight/terrain.worker.js` (`:27-28`). `tints.buffer` joins the transfer list when it's there.
- Modify: `src/components/expanse/flight/ground.js`
  - the leaf's geometry gains `aTint` (`Uint8BufferAttribute(tints, 4, true)`) when the leaf has tints
  - `groundMaterial(spec, tier)` (`:43-47`) passes `biome: Boolean(spec.round)`
  - a round spec's code-built `trunk` colour (`:281`) is `spec.palette.accent`. It stays `spec.palette.high` for the rest, so the trees aren't the ground's own colour.
- Modify: `src/lib/three/groundLook.js`. `groundMaterial(site, { small, map, splat, half, biome = false })`.
  - `biome` sets `defines.BIOME`. The vertex shader gets `attribute vec4 aTint; varying vec4 vTint;`.
  - The fragment, right after `vec3 c = mix(uLow, uHigh, …);`, gets `#ifdef BIOME c = mix(c, sRGBTransferEOTF(vec4(vTint.rgb, 1.0)).rgb, vTint.a); #endif`. Use three's sRGB decode from its colour-space chunk, whatever it's called in r186.
  - The cache key gains `:biome`.
- Test: `src/lib/land/flight/leafMesh.test.js`, `src/lib/three/groundLook.test.js` (new, unless it exists), `src/components/expanse/flight/ground.test.js`, `src/components/expanse/flight/mapWorker.test.js`

**Interfaces:**
- Consumes: Task 6's `planetField(spec).tintAt(x, z)`.
- Produces:
  - `makeLeaf(spec, leaf, opts) → { …, tints: Uint8Array | null }`. It is `null` for a plane spec. Otherwise it holds 4 bytes a vertex, the grid's from `field.tintAt` at each vertex, and each skirt vertex its edge vertex's.
  - `groundMaterial(site, { biome })`, as above.

- [ ] **Step 1: Take the before shots on the branch as it is.**
  - Run `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --quality mid --routes /fly/hoth,/fly/<id>`.
  - `<id>` is the first entry of `lab/planets/contact/index.json` (lane 5a's sheet; run `node scripts/planet-contact-sheet.mjs` if it isn't there) whose type is forest or ocean.
  - Run `FLY=hoth node scripts/perf-probe.mjs fly` and `FLY=<id> …`, and keep the calls and triangles.
- [ ] **Step 2: Write the failing tests.**
  - `leafMesh.test.js`:
    - `'carries the biome’s tint on a round planet, none on a plane'`: a leaf of `roundSpec()` has `tints.length === (n·n + 4n − 4) × 4`. A grid vertex's 4 bytes equal `field.tintAt` there, and a skirt vertex's equal its edge vertex's. Hoth's leaf has `tints: null`.
  - `groundLook.test.js`:
    - `'compiles the galaxy’s ground as it did'`:
      - Put each of `{}`, `{ map }` and `{ splat: true }` through `onBeforeCompile` with a stub shader, `{ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} }`.
      - Each of `customProgramCacheKey()`, and `sha1` of the patched vertex and fragment, equals a fixture recorded before this task.
    - `'adds the tint only when asked'`: `biome: true` has `defines.BIOME`, a key ending `:biome`, and `vTint` in both stages.
  - `ground.test.js`:
    - `'tints a generated planet’s ground and no roster planet’s'`: a leaf built for a round spec has an `aTint` attribute and the material defines `BIOME`. Hoth's has neither.
    - `'dresses a generated planet’s trees in its accent'`
  - `mapWorker.test.js`: `'hands the tints over'`. A round spec's leaf answer lists `tints.buffer` in its transfer.
- [ ] **Step 3: Run them to see them fail.**
Run: `npx vitest run src/lib/land/flight/leafMesh.test.js src/lib/three/groundLook.test.js src/components/expanse/flight`
Expected: FAIL. Record the `groundLook` fixture on unchanged code first.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run them, and the lock.**
Run: `npx vitest run src/lib src/components/expanse src/components/galaxy`
Expected: PASS.
- [ ] **Step 6: Take the after shots and compare.**
  - Run the same smoke and probes as Step 1.
  - `/fly/hoth`: the same calls and triangles. Its picture can't move: Step 2's pinned shader text is the proof, since the flight never holds still for a byte-for-byte shot. Its shot goes beside the before for the eye.
  - `/fly/<id>`: its biomes read as patches of colour, with the same calls and triangles.
  - The pair goes in the README.
- [ ] **Step 7: Commit.** `git commit -m "A generated planet's flight ground is coloured by its biomes; the fifty and the galaxy's ground are as they were"`

### Task 8: Weather, and clouds in a generated planet's sky

**Files:**
- Create: `src/components/expanse/flight/weather.js`, `src/components/expanse/flight/weather.test.js`
- Modify: `src/components/expanse/flight/eventPlays.js`. `FALL` (`:75`) is exported from `weather.js`, and `eventPlays.js` imports it (0 behaviour change).
- Modify: `src/components/expanse/flight/scene.js`
  - `skyDome(low, high)` (`:20-46`) becomes `skyDome(low, high, look = null)`
  - `createFlightScene` passes `skyOf(spec)`, and `place` sets the dome's `uTime`
- Modify: `src/components/expanse/flight/module.js`
  - after `createWater` (`:149`): `const weather = createPlanetWeather(view.scene, spec, { small: tier === 'low' });`
  - `step` updates it after `view.place`
  - `dispose` frees it

**Interfaces:**
- Consumes: lane 5a's spec `weather` (`{ kind, amount }`) and `sky` (`{ clouds, cloudColour, rings, moons, … }`); `galaxy/shared/weather.js`'s `createWeather`; `seeded`.
- Produces, in `weather.js`:
  - `FALL`, moved as it is.
  - `FALLS = { rain: 'rain', snow: 'snow', dust: 'sand', ash: 'ash', spores: 'motes' }`.
  - **`weatherOf(spec) → { kind, box, count, size?, len? } | null`.** It is null for `spec.weather` null (the fifty) or `kind: 'none'`. Otherwise:
    - `kind` is `FALLS[weather.kind]`
    - `box` is `[220, 110, 220]`
    - the rest is `FALL[kind]`, with `count` times `0.4 + 0.6 × amount`, rounded
  - **`createPlanetWeather(root, spec, { small }) → { update(t, camera, ground, height), dispose() } | null`**: `createWeather({ weather: [weatherOf(spec)] }, { small })` in `root`. `update` is `eventPlays.js:83`'s call.
  - **`skyOf(spec) → null | look`**. It is null for `spec.sky` null. Otherwise `look` is:
    - `clouds: { cover: sky.clouds, colour: sky.cloudColour, drift: 0.004 }`
    - `rings: sky.rings ? { tilt: seeded 0.25…0.6 rad, colour: palette.high } : null`
    - `moons`: `min(3, sky.moons)` of `{ dir: seeded, between 15° and 60° above the horizon, size: 0.03…0.07 rad, colour: palette.rock }`
- Produces, in `scene.js`: **`skyDome(low, high, look)`**. With a `look`, it defines:
  - `SKY_CLOUDS`: 4 octaves of value noise on `vDir` above the horizon, drifting by `uTime`, covering `cover`, in the clouds' colour
  - `SKY_RINGS` when there are rings: a thin band across the sky at the tilt, fading near the horizon
  - `SKY_MOONS` with `uMoons[3]` (`xyz` the direction, `w` the size) and `uMoonCount`

  With none, the dome is exactly today's.

- [ ] **Step 1: Write the failing tests** in `weather.test.js`:
  - `'gives the fifty no weather and their own sky'`: for every planet of `PLANETS`, `weatherOf` and `skyOf` are null.
  - `'gives a generated planet the weather its description says'`: `snow` at amount 1 gives `kind: 'snow'` with `count === FALL.snow.count`. `spores` at 0 gives `motes` at `round(0.4 × FALL.motes.count)`. `none` gives null.
  - `'puts its clouds, rings and moons in its sky'`: `cover` is `sky.clouds`. `rings` only with `sky.rings`. Moons number `min(3, sky.moons)`, each above the horizon (`dir[1] > sin 15°`).
  - `'draws the dome as it did, with no look'`: `createFlightScene({ spec: planetSpecOf('hoth'), palette: STRIP })`'s dome material has no defines, and its fragment shader is byte for byte the old string (record a fixture before).
  - `'defines what a look asks'`: a generated spec with rings and moons defines `SKY_CLOUDS`, `SKY_RINGS` and `SKY_MOONS`.
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/components/expanse/flight/weather.test.js`
Expected: FAIL. Record the dome's fixture on unchanged code first.
- [ ] **Step 3: Implement and wire.**
- [ ] **Step 4: Run the flight's tests.**
Run: `npx vitest run src/components/expanse/flight src/lib/land/flight`
Expected: PASS, `eventPlays`' and `module.test.js`'s unchanged.
- [ ] **Step 5: Check it in the browser.**
  - Take the before shot of `/fly/<id>` first: the first contact-sheet planet with weather that isn't `none`, and `sky.clouds > 0.3`.
  - Then run Task 7's smoke and probes on it, and on `/fly/hoth`.
  - Expected:
    - `/fly/hoth` with the same calls and triangles, its dome's shader pinned (Step 1)
    - `/fly/<id>` shows its weather falling and clouds in its sky
    - calls on `/fly/<id>` one higher (the weather's Points), triangles the same
  - Say so in the README.
- [ ] **Step 6: Commit.** `git commit -m "A generated planet's weather falls in the flight, and its clouds, rings and moons are in its sky"`

---

## PR 5b.3: Down, out and back

### Task 9: Diving into a generated planet, as rules, and the words

**Files:**
- Modify: `src/components/universe/entry.js`, `src/components/universe/entry.test.js`
- Modify: `src/components/universe/flight.js`, `src/components/universe/flight.test.js` (`landPlan`, beside `enterPlan` and `crashPlan`, which `Universe.jsx` already imports)
- Modify: `src/components/universe/words.js`, `src/lib/words.test.js` (if `LAND_WORDS`' functions need listing)
- Modify: `src/components/universe/scene.js`, in place:
  - `:4462`'s `` `Too fast to fly into ${placeName(air.id)}: ease off the boost` `` becomes `LAND_WORDS.hot(placeName(air.id))` (0). Task 11 moves the line out whole.
  - `:4856`'s `` `Get back in ${SHIP_NAMES[state.kind]?.replace(/^The /, 'the ') ?? 'the ship'}` `` becomes `FOOT_WORDS.in(SHIP_NAMES[state.kind])` (0).
  - The `./words` import line gains `LAND_WORDS, FOOT_WORDS` (0).

**Interfaces:**
- Consumes: `entry.js`'s `ENTRY`, `AIR`, `airTop`, `entering`, `entrySpot`, `entryPath`, `fxAt`, `velocityOf`; `ship.js`'s `headingTo`.
- Produces, in `entry.js` (pure):
  - **`DIVE = { T: 2.4, hand: 2.1, quick: 1.3, hover: 0.06, giveUp: 4 }`.**
  - **`diveFx(t) → fxAt(t × DIVE.quick)`**: the white-out peaks just before `DIVE.hand`.
  - **`divePath({ nE, hE, nS, R, track }) → { T: DIVE.T, at(t) }`**: `entryPath({ nE, hE, nS, hH: DIVE.hover × R, rest: DIVE.hover × R, R, track })`, read at `min(t, DIVE.T) × ENTRY.glide / DIVE.T`. That is the glide only, never the settle.
  - **`diveSpot({ n, track, speed, R }) → { n, f }`**: `entrySpot` with `light: null`. The flight's sun is always up, so it needs no lean to the day.
  - **`turnBack(ship, body) → ship`**:
    - the ship moved straight out to `airTop(body) + ENTRY.clear` along `n`
    - its heading turned to `headingTo(n[0], n[2])`, level
    - its pitch and bank 0, and `vy`, `lift`, `rate` 0
    - its speed kept
- Produces, in `flight.js` (the universe's): **`landPlan({ reduced }) → { delay }`**: `{ delay: reduced ? 0 : 350 }`, the ms between the cover and the route.
- Produces, in `words.js`:
  - `SHIP_NAMES` (moved by Task 5; it stays where Task 5 put it).
  - **`LAND_WORDS`:**

    ```js
    export const LAND_WORDS = {
      hot: (name) => `Too fast to fly into ${name}: ease off the boost`,
      gas: (name) => `${name} is a gas giant: there’s no ground under its clouds to come down on.`,
      pocket: 'Nothing lands in a pocket universe. Its planets are there to look at.',
      leaving: (name) => `Leaving ${name}’s air`,
      rough: 'Too rough to set down here. Find flatter ground.',
    };
    ```

  - **`FOOT_WORDS`:**

    ```js
    export const FOOT_WORDS = {
      land: 'Land',
      out: 'Get out',
      in: (ship) => `Get back in ${ship?.replace(/^The /, 'the ') ?? 'the ship'}`,
      takeoff: 'Take off',
      back: (ship, m) => `${ship ?? 'The ship'} · ${m}`,
    };
    ```

- [ ] **Step 1: Write the failing tests** in `entry.test.js`'s new `describe('diving into a generated planet')`:
  - `'peaks the white-out just before the hand-off'`: the argmax of `diveFx(t).white` over `t` in steps of 0.01 lies in `[DIVE.hand − 0.3, DIVE.hand]`. `diveFx(DIVE.hand).white > 0.6`.
  - `'dives down, never nearer than its hover, ending over the spot'`:
    - for R in `[18, 70]` and five entries, `divePath(…).at(t).h ≥ DIVE.hover × R − 1e−9` at 100 steps
    - `at(0).n` is `nE`
    - `angleBetween(at(DIVE.T).n, nS) < 1e−9`
  - `'spots ahead along the track, with no lean to the day'`: `diveSpot` equals `entrySpot({ …, light: null })`.
  - `'turns a ship back out of a gas giant’s air'`:
    - a ship at `0.9 × airTop(body)`, sinking, gives `entering(turnBack(ship, body), [body])` null and `|pos − at| ≥ airTop(body)`
    - 300 steps of `step(…, {}, 1 / 30, [], OPEN_SPACE)` never bring it back into the air
  - In `flight.test.js`, `'leaves at once with reduced motion'`: `landPlan({ reduced: true }).delay` is 0, and 350 otherwise.
  - The words: `LAND_WORDS` and `FOOT_WORDS` pass `src/lib/words.test.js`'s glossary checks.
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/components/universe/entry.test.js src/components/universe/flight.test.js src/lib/words.test.js`
Expected: FAIL. The exports are missing.
- [ ] **Step 3: Implement.** Count `scene.js`'s lines (expected: unchanged).
- [ ] **Step 4: Run them to see them pass.**
Run: `npx vitest run src/components/universe src/lib/words.test.js`
Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "The rules for diving into a generated planet, turning back from a giant, and the words for both"`

### Task 10: The flight starts low over the spot

**Files:**
- Modify: `src/lib/land/flight/arrival.js`, `arrival.test.js`
- Modify: `src/components/expanse/flight/planets.js`. `planetSpecOf(id, { row = null } = {})`: a row whose id is the same place as `id` is the lookup, and anything else is `expanseRow`.
- Modify: `src/pages/Fly.jsx` (`:21-28`, `:30-48`, `:75-98`)
- Modify: `src/components/expanse/flight/module.js`. `create` reads `props.landing`, and the ship starts at `arrivalShip(props.landing, groundAt)` when it's given, `spawnOf(...)` otherwise (`:204`).
- Modify: `src/components/expanse/flight/flight.css`. `.fly-cover`: fixed, full, `pointer-events: none`, `opacity` 1 when `[data-on]`, else 0, with a 0.8 s transition (none under `prefers-reduced-motion`).

**Interfaces:**
- Consumes:
  - Task 4's `readSpot`
  - lane 5a's `chartedAt`, `dirOfLatLon`, `uvOfDir`, `PLANE_WINDOW`, `canonicalId`
  - Task 0's `sameSpaceId`
- Produces, in `arrival.js`:
  - `ARRIVE = { up: 320, pitch: -0.16, speed: 110 }`.
  - **`windowPoint(lat, lon) → [x, z]`**: `[(u − 0.5) × PLANE_WINDOW, (v − 0.5) × PLANE_WINDOW / 2]`, where `[u, v] = uvOfDir(dirOfLatLon(lat, lon))`. It is lane 5a's plane bake's window, read back.
  - **`landingOf(spec, spot) → { spec, start: [x, z], yaw } | null`**:
    - null for no spot, or for a soft spec (a gas giant's cloud deck flies as today)
    - a round spec gives `{ spec: chartedAt(spec, dirOfLatLon(lat, lon)), start: [0, 0], yaw }`
    - a plane spec (the seeded thirteen, the named worlds) gives `{ spec, start: windowPoint(lat, lon), yaw }`
    - `yaw = −bearing` in radians: the flight's yaw 0 faces −z, which is north, and +x is east
  - **`arrivalShip({ start, yaw }, groundAt) → ship`**: `{ x: start[0], y: groundAt(...start) + ARRIVE.up, z: start[1], pitch: ARRIVE.pitch, yaw, roll: 0, speed: ARRIVE.speed }`. A ground not yet in counts as 0.
- Produces, in `Fly.jsx`:
  - The spec is `planetSpecOf(planet ?? 'hoth', { row: location.state?.row ?? null })`.
  - `landing = landingOf(spec, readSpot(location.search))`.
  - `props` becomes `{ spec: landing?.spec ?? spec, landing }`.
  - `<div className="fly-cover" style={{ background: location.state?.cover }} data-on={status !== 'on' ? '' : undefined} />` is drawn only when `location.state?.cover` is set.
  - `<Flight>`'s key (`Fly.jsx:27`) is the spec's id and the `at` query together, so a new spot on the same planet builds the flight again.

- [ ] **Step 1: Write the failing tests.**
  - `arrival.test.js`:
    - `'starts over the spot, on a round planet at the chart’s middle'`: `landingOf(round, { lat: 12, lon: −40, bearing: 90 })` has `start: [0, 0]` and `yaw: −π/2`, and its spec's `round.at` equals `dirOfLatLon(12, −40)`.
    - `'starts a seeded planet at its window point'`: for `e:1,0:0:1`, `start` is `windowPoint(lat, lon)`, and the spec is the same object.
    - `'flies a gas giant as it always has'`: null for a soft spec.
    - `'never throws on junk'`: `landingOf(spec, null)` and `landingOf(null, spot)` are null.
    - `'comes down low, descending, over the spot'`: `arrivalShip(l, () => 40)` has `y` 360, a pitch under 0 and speed 110. `() => NaN` gives `y` 320.
  - `planets.test.js`:
    - `'takes the row the universe sent, and makes no sector'`: `planetSpecOf('e:9,4:120:0', { row })` (a row for that id) equals `planetSpecOf(row.id, { expanse: [row] })` from lane 5a. A `vi.mock` of `../gen/space` that counts `placeOf` sees no call.
    - `'ignores a row for another place'`.
  - `module.test.js`: `'starts over the spot it lands at'`. `flight.create(fakeRt(), { spec, landing })` gives a `world.ship` at `landing.start` with the pitch under 0.
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/lib/land/flight/arrival.test.js src/components/expanse/flight`
Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.** Same command. Expected: PASS, the existing spawn test included.
- [ ] **Step 5: Commit.** `git commit -m "The planet flight starts low over the spot it was sent to, coming down"`

### Task 11: The dive and the hand-off in the universe

**Files:**
- Modify: `src/components/universe/landing/sceneLanding.js`, `sceneLanding.test.js`
- Modify: `src/components/universe/scene.js`. Each change gives its lines:
  - **The air.** In `fly()`, the block from `// into a planet's air (entry.js): at a speed it can land at,` through the `hotSaid` branch's `}` (`:4447-4466`, 20 lines) moves into `sceneLanding.air`. It becomes one line: `if (!state.jump && !state.auto && landing.air(state.ship)) return true;` (−19).
  - **The ride.** In `render()`, before `if (flying() && !state.dive && !props.frozen) moving = …` (`:5101`), add `if (state.dive?.generated) moving = landing.ride(dt, t);` and make the next line an `else if` on the same line (+1).
  - **Four guards, in place (0 each):**
    - `:5103` `if (flying() && !state.dive && !onFoot()) follow(dt);` → `(!state.dive || state.dive.generated)`
    - `:5138` `if (state.dive) {` → `if (state.dive && !state.dive.generated) {`
    - `:5340` `expanse.update({ ship: flying() && !state.dive ? …` → `(!state.dive || state.dive.generated)`, so the planet stays built
    - `:5391` `if (state.dive) return now - state.dive.start < DIVE_MS;` → `if (state.dive) return state.dive.generated || now - state.dive.start < DIVE_MS;`
  - **`state.hotSaid`.** The said-once flags move into `sceneLanding` with the block. `hotSaid: null,` in `state`'s initialiser (`:1201`) goes (−1). The two `state.hotSaid = null;` lines (`startFoot`'s `:4652`, `flyInto`'s `:4684`) each become `landing.forget();` (0).
  - **The creation line** from Task 5 gains these deps. They are shown on three lines here for reading; in the file they stay on the one line (0):

    ```js
    camera, emit: (e) => emit(e), note: (text) => { state.note = { text, until: wall() + 3 }; }, pocket: typeof ctx.universe === 'bigint' && ctx.universe !== UNIVERSE, flyInto: (id) => flyInto(id), open: (id) => landingOpen(removed, id, state.clock), placeName: (id) => placeName(id), roar: (k) => { roar ??= entrySound(); roar.set(k); }, hush: () => quietRoar(), prepare: (o) => warm(o), model: () => state.model,
    begin: (id) => { powers.cancel(); unique.clear(); hunters?.clear(); dropAuto(); state.dive = { id, start: performance.now(), generated: true }; },
    end: () => { state.dive = null; }
    ```

    Each thunk reads a name declared below `:772`, or one that changes (`roar` is a `let`, `:1278`). If lane 4b has merged, `begin` also calls `events.clear()`, as its Global Constraints ask; whichever of 4b and 5b merges second adds it.
  - **The dev hooks.** `__universe()` (`:5923`) gains `diving: landing.diving(),` on its line (0).
  - **The count:** +1, −20.
- Modify: `src/pages/Universe.jsx`
  - `onEvent` (`:359`) gains, first: `if (e.type === 'land') { landed(e); return; }` (+1)
  - `landed(e)` (new, beside `crashInto`): for `what === 'hand'`, `setLeaving({ id: e.id, mode: 'dive', colour: e.colour })`, then `timer.current = setTimeout(() => navigate(e.to, { state: e.state }), landPlan({ reduced }).delay)`. `landPlan` (Task 9) joins `flight.js`'s import (`:7`). It ignores any other `what` (the line is the scene's).
  - `fade` (`:510`) reads `leaving?.colour` first: `leaving?.colour ?? (…today's expression…)`, so a generated id never reaches `byId`.
- Modify: `scripts/universe-endless-check.mjs`. Add the `dive` and `gas` steps, between `// planet flight: begin` and `// planet flight: end`.
- Modify: `scripts/lib/flight-island.mjs`. `ISLAND.rows` gains `'scripts/universe-endless-check.mjs'`.

**Interfaces:**
- Consumes:
  - Task 9's `DIVE`, `diveFx`, `divePath`, `diveSpot`, `turnBack`, `LAND_WORDS`
  - `entry.js`'s `entering`, `airTop`, `LANDABLE`, `velocityOf`, `ENTRY`
  - `reentry.js`'s `createReentry({ small, reduced }) → { group, start({ cloud }), update(dt, { ship, dir, up, size, cam, fx, t }), stop(), dispose() }`
  - Task 4's `link.landable`, `link.route`, `link.cover`
- Produces: **`createSceneLanding(deps)`**, completed.
  - **Its deps:** Task 5's, and `camera`, `emit`, `note`, `pocket`, `flyInto`, `open`, `placeName`, `roar`, `hush`, `prepare`, `model`, `begin`, `end`, `clock = () => performance.now() / 1000`.
  - **The reentry show.** At creation it makes one `createReentry({ small, reduced })`, hidden, in `map`. It calls `prepare(reentry.group)` once, from the first `air` call, never at creation (the scene's `warm` is declared below).
  - **`air(ship) → boolean`.**
    1. **The fandom planets, exactly as `scene.js:4447-4466` did.** It is `entering(ship, LANDABLE)`. Then:
       - for `'enter'` while `!open(id)`, `note(`${placeName(id)} has been removed. Give it a minute.`)` once an entry
       - for `'enter'`, `return flyInto(id)` when that is true
       - for `'hot'`, `note(LAND_WORDS.hot(placeName(id)))` once an entry
    2. **The generated bodies.** These are the registry's bodies, as `{ id, at, r }`. `at` is the body's centre in `map`'s frame, `map.worldToLocal(group.getWorldPosition(v))`, and `r` is `body.radius`. Then `entering(ship, those)`, and by what the body is:
       - **A gas or ringed giant** (`of.row.type` is `gas` or `ringed`, read from lane 2's row, so it holds with the flight gone): `setShip(turnBack(ship, body))`. Then `note(LAND_WORDS.gas(of.row.name))` once an entry, and `emit({ type: 'land', what: 'turned', id, why: 'gas' })`. It returns false.
       - **A pocket universe, or no link, or `!link.landable(of)`**, for a rocky body: with `pocket`, the same with `LAND_WORDS.pocket` and `why: 'pocket'`. With no link, nothing: the solid takes it, as lane 2 has it.
       - **`'hot'`**: `note(LAND_WORDS.hot(of.row.name))` once an entry, and false.
       - **`'enter'` on a landable body**: start the dive and return true.
         - Call `begin(id)`. `id` is the body's id, upper-case canonical.
         - The spot is `diveSpot({ n, track: velocityOf(ship), speed, R: r })`, in the map's frame.
         - The path is `divePath({ nE: n, hE: h, nS: spot.n, R: r, track })`.
         - Start the show with `reentry.start({ cloud: link.cover(of) })`.
         - With `reduced`, hand off at once (below) and ride nothing.
  - **`ride(dt, t) → boolean`.** The dive's own seconds, `τ = clock() − start`, are on the wall clock, never `dt`.
    - The ship is `at + path.at(τ).p`, with `at` read again each call (the body moves). Its heading and pitch follow the path's tangent and its speed is the step's.
    - It goes through `setShip`. `model()`'s group is placed and turned there, and `model().update(t)` called.
    - `reentry.update(dt, { ship, dir, up: n, size: 0.26 × group scale, cam: the camera in the map's frame, fx: diveFx(τ), t: τ })`, and `roar(fx.burn + 0.45 × fx.cloud)`.
    - At `τ ≥ DIVE.hand`, once: `emit({ type: 'land', what: 'hand', id, colour: link.cover(of), ...link.route(of, { dir, track }) })`.
      - `dir` and `track` are the spot's `n` and `f` taken into the body's own frame. That is the inverse of the body group's world rotation relative to `map`'s, so a body turned on its axis still names the ground under the spot.
    - At `τ ≥ DIVE.hand + DIVE.giveUp`: `cancel()`.
    - It returns true.
  - **`cancel()`**: the show stopped, `hush()`, the ship set at `airTop + ENTRY.clear` over where it went in with speed 0, and `end()`.
  - **`forget()`**: the said-once flags cleared (the fandom block's `state.hotSaid = null`).
  - **`diving() → id | null`.**
  - **`debug`** gains `diveAt(id, …)` for a generated id: the registry's body, taken as Task 5's fandom one is. It also gains:
    - `nearest(kind) → id | null`: the registry's nearest landable body for `'rock'`, the nearest giant for `'gas'`
    - `state() → { diving, id, τ, handed, turned }`
  - **`dispose()`** also disposes the show.
- Produces: the scene's event `{ type: 'land', what: 'hand' | 'turned', id, why?, to?, state?, colour? }`.

- [ ] **Step 1: Write the failing tests** in `sceneLanding.test.js`, with the fakes of Task 5:
  - a body built at `[1000, 0, 0]`, r 40, with `of` for a rock planet, and one for a gas giant at `[−1000, 0, 0]`
  - a fake `clock` the test moves
  - a fake link: `landable` by type, `route: (of, spot) => ({ to: '/fly/' + of.row.id, state: { row: of.row }, spot })`, `cover: () => '#ffffff'`

  The tests:
  - `'flies into a rocky planet’s air and dives, once'`:
    - a cruising ship just inside `airTop` on −x, sinking, gives `air` true and calls `begin` once with the body's id
    - `diving()` is that id
    - a second `air` call while diving makes no second `begin`
  - `'rides down toward the spot, never nearer than its hover, and hands off once behind the cloud'`:
    - over clock steps of 0.1 s, each `ride` keeps `|ship − at| ≥ r × (1 + DIVE.hover) − 1e−6`
    - `emit` got exactly one `what: 'hand'`, at the first call with `clock ≥ start + DIVE.hand`
    - its `spot.dir` is the spot's `n` in the body's frame: with the body's group turned 0.7 rad about y, it equals `n` turned −0.7 rad
  - `'rides on the wall clock, whatever the frame rate'`: `ride(0.05, …)` called with the clock moving a second a call hands off on the third call.
  - `'gives up and flies on if the page never goes'`:
    - at `start + DIVE.hand + DIVE.giveUp`, `end` is called
    - the last `setShip` puts the ship outside the air with speed 0
    - `diving()` is null
  - `'turns back from a gas giant with its line, and never dives'`:
    - `begin` isn't called
    - `note` is called once with `LAND_WORDS.gas(name)` over three frames in the air
    - the ship given to `setShip` has `entering(…, [gas])` null
    - one `what: 'turned', why: 'gas'`
  - `'turns back in a pocket universe'`: `pocket: true` gives the rocky planet `LAND_WORDS.pocket`.
  - `'says when a ship is too fast to fly in'`: a speed of 12 gives `LAND_WORDS.hot(name)` once, and no `begin`.
  - `'without the flight, a rocky planet’s air takes nothing; a giant still turns you back'`: `link: null`.
  - `'hands off at once with reduced motion'`: `reduced: true` emits `'hand'` from `air`, and `ride` isn't needed.
  - `'flies into a fandom planet as it did'`:
    - `air` with a ship entering `LANDABLE`'s first planet calls `flyInto(id)` and returns its answer
    - with `open` false, the "has been removed" line once
    - boosting, `LAND_WORDS.hot(placeName(id))` once
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/components/universe/landing`
Expected: FAIL.
- [ ] **Step 3: Implement, wire `scene.js` and `Universe.jsx`, and count `scene.js`'s lines.**
- [ ] **Step 4: Run the tests and the island.**
Run: `npm test && node scripts/flight-island.mjs --check`
Expected: PASS, then `ok`.
- [ ] **Step 5: Add the endless check's steps.**
  - **`dive`.** It runs after lane 2's `system` step, inside a generated system with its bodies built.
    1. Wait until `__universeDebug.landing.nearest('rock')` is an id and `landing.pending() === 0`. If the system has no landable body, `teleport` into the next nearest system (lane 2's `expanse.nearestSystem`) and wait again, up to five systems.
    2. `diveAt(id, SHIP.cruise)`.
    3. Wait until `location.hash` starts with `#/fly/e:`, and read its `at`.
    4. Wait until `window.__FLIGHT__?.landing` is there and `__FLIGHT__.groundUnder()` is finite. Task 14 makes `landing`; until then wait on `__FLIGHT__` alone.
    5. The ship is within 200 m of the chart's middle, Task 10's `start`.
    6. Shoot `arrive.jpg`. Record the hand-off's time from `diveAt`, on the wall clock.
  - **`gas`.**
    1. Open `#/universe` again and wait for the `system` step's place.
    2. `diveAt(landing.nearest('gas'))`.
    3. Wait until `landing.state().turned` is that id.
    4. Over 30 frames, the hash stays `#/universe` and the ship stays outside the giant's air.
- [ ] **Step 6: Check it in the browser.**
  - Run `node scripts/universe-endless-check.mjs --quality mid --only dive,gas`.
  - Then, with the dev server up, `node scripts/entry-check.mjs` and `node scripts/landing-check.mjs`.
  - Expected: exit 0 each, no console errors, and the fandom entries as on the branch before this task.
- [ ] **Step 7: Commit.** `git commit -m "Fly down into a rocky generated planet and the entry takes you to its flight, over the spot; a giant turns you back"`. The body has `scene.js`'s count.

### Task 12: Setting down and lifting off, as rules

**Files:**
- Create: `src/lib/land/flight/touchdown.js`, `src/lib/land/flight/touchdown.test.js`

**Interfaces:**
- Consumes: lane 5a's `planetField`, `roundSpec` (fixture); `flightRules.js`'s `SHIP`, `forwardOf` (passed in, since lib can't import a component: `liftPath` takes `speedMin`).
- Produces:
  - `LAND = { alt: 450, speed: 160, reach: 700, step: 25, foot: 9, slope: 0.12, dry: 2, hover: 30, glide: 3.5, settle: 2, rest: 2.5 }`, `LIFT = { up: 60, rise: 2, climb: 5 }` and `LEAVE = { alt: 4000 }`.
  - **`canLand(ship, groundAt) → boolean`**: the ground is finite, `ship.y − ground ≤ LAND.alt` and `ship.speed ≤ LAND.speed`.
  - **`flatSpot(field, [x, z], { water = null } = {}) → { x, z, h } | null`.**
    - The candidates are the grid points `LAND.step` apart within `LAND.reach`, nearest first, ties by angle from +x.
    - It takes the first with a slope of at most `LAND.slope` and `h ≥ (water?.level ?? −Infinity) + LAND.dry`.
    - The slope is `max(|Δx|, |Δz|) / (2 × LAND.foot)` over central differences at `±LAND.foot`.
  - **`landPath(ship, spot, groundAt) → { T, at(t) → ship }`.**
    - **The glide**, over `LAND.glide` s: the ship's x, z goes straight to the spot's, eased, its yaw turned to face it.
    - Its height is the greater of the eased line and `groundAt + LAND.hover` under it, so a ridge on the way is flown over.
    - **The settle**, over `LAND.settle` s: straight down from `spot.h + LAND.hover` to `spot.h + LAND.rest`.
    - Its speed, pitch and roll ease to 0. `T = LAND.glide + LAND.settle`.
  - **`liftPath(ship, groundAt, speedMin) → { T, at(t) }`.**
    - `LIFT.rise` s straight up by `LIFT.up`, level.
    - Then `LIFT.climb` s with the nose easing up to 0.9 rad and the speed to `speedMin × 3`.
    - `T = LIFT.rise + LIFT.climb`.
  - **`leaving(ship, groundAt) → boolean`**: `ship.y − ground ≥ LEAVE.alt`.

- [ ] **Step 1: Write the failing tests:**
  - `'lands only low and slow over ground that’s in'`: `canLand` at 300 m and 100 m/s is true. At 600 m, at 200 m/s, or over `NaN`, it's false.
  - `'finds the nearest flat dry ground, or none'`:
    - on a flat field the spot is the start itself
    - on `roundSpec({ kind: 'ridges' })`'s field, every spot found has the slope rule and is dry
    - on a field that's all slope (`(x, z) => x`), the answer is null
    - with water at 50 over a flat field at 40, the answer is null
  - `'glides over a ridge, never into it, and settles on the spot'`: on a field with a 200 m ridge between the ship and the spot, `at(t).y ≥ groundAt(at(t).x, at(t).z) + LAND.rest − 1e−6` at 200 steps. `at(T)` is at the spot's x, z and `h + LAND.rest`, with speed 0.
  - `'lifts straight up, then climbs away'`: `at(LIFT.rise).y − y0` is `LIFT.up`. `at(T).pitch` is over 0.8.
  - `'says when the ship is out of the air'`: `leaving` is true at 4,000 m over the ground and false at 3,999.
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/lib/land/flight/touchdown.test.js`
Expected: FAIL.
- [ ] **Step 3: Implement.** Pure, with the header in the house style.
- [ ] **Step 4: Run them to see them pass.** Same command. Expected: PASS, under a second.
- [ ] **Step 5: Commit.** `git commit -m "The rules for setting a ship down on flat ground and lifting it off again"`

### Task 13: The universe's walker and camera, for any ground

**Files:**
- Modify: `src/components/universe/foot.js`, `src/components/universe/foot.test.js`
- Modify: `src/components/universe/footScene.js`
  - `CAM` (`:182`) moves to `foot.js` (−1)
  - `view`'s walk-phase branch (`:3041-3066`) and its kick (`:3068-3074`) become one `chaseView` call (about −20)
  - the party's motion (`:2835-2837`) and `turnRate` (`:1435-1440`) become `motionOf` (about −6)
  - add `export const crewCast = () => createMeshyCast(withWardrobe());` beside `export { loadParty as loadPartyFigure };` (`:3530`) (+1)
- Modify: `src/components/universe/scene.js`. `FOOT_FOV` (`:287`) moves to `foot.js`, and the scene imports it on its `./foot` import (−1).
- Create: `src/components/universe/shared/foot.js`, `src/components/universe/shared/crew.js`; modify `src/components/universe/shared/shared.test.js`
- Create: `src/components/expanse/flight/footing.js`, `src/components/expanse/flight/footing.test.js`

**Interfaces:**
- Consumes:
  - `foot.js`'s `walk`, `person`, `createJump`, `FOOT`, `METRE`, `rotate`, `flat`
  - lane 5a's `chartOf`, `dirOfLatLon`, `planetField`
- Produces, in `foot.js` (pure):
  - `CAM` (moved as it is) and `FOOT_FOV = 56` (moved as it is).
  - **`chaseView({ head, n, f, pitch, first = false, kick = 0, metre = METRE }) → { pos, look, up }`** (arrays). It is footScene's walk-phase rule, word for word:
    - **Over the shoulder:**
      - `look = head + f·CAM.look·m − n·pitch·0.8·m`
      - `pos = head − f·CAM.dist·m·cos(pitch) + n·(CAM.dist·m·sin(pitch) + CAM.up·m) + (f × n)·0.45·m`
    - **First person:** `pos = head + f·0.15·m` and `look = pos + f·6·m − n·pitch·4·m`.
    - `up = n`.
    - **A kick:** `look += up·kick·0.35·k` and `pos += up·kick·0.05·k`, with `k = (first ? 1.6 : 1)·m`.
  - **`easeView(prev, want, dt, rate, reduced) → view`**: each of `pos`, `look` and `up` lerped by `1 − exp(−dt·rate)` (1 when `reduced` or with no `prev`), `up` normalised.
  - **`motionOf(w, prevF, dt, { hurt = 0, down = 0 } = {}) → { move, motion }`**: footScene's (`:2835-2837` with `turnRate`):
    - `move = min(1, |speed| / FOOT.run + |side| / FOOT.run)`
    - `motion = { speed, side, turn, air: h / METRE, hurt, knock: 0.5, down }`
    - `turn` is the signed angle from `prevF` to `w.f` about `w.n` over `dt`, and 0 with no `prevF` or `dt ≤ 0`
- Produces, the faces (each re-exports only):
  - **`universe/shared/foot.js`** (light): `FOOT`, `METRE`, `CAM`, `FOOT_FOV`, `walk`, `person`, `createJump`, `chaseView`, `easeView`, `motionOf` from `../foot`, and `SHIP_NAMES`, `FOOT_WORDS`, `LAND_WORDS` from `../words`.
  - **`universe/shared/crew.js`** (heavy, for a lazy `import()`): `PARTY`, `loadPartyFigure`, `crewCast` from `../footScene`, and `SHIP_KEY`, `parseShip` from `../crews`.
- Produces, in `footing.js` (pure; it imports the light face and lib only):
  - `PLANE_R = 1e7` and `SHORE = 0.3`.
  - **`createFooting(spec, field) → footing`.**
    - `radius = spec.round?.radius ?? PLANE_R`, `R = radius × METRE`, and `chart = chartOf(spec.round?.at ?? dirOfLatLon(0, 0), radius)`.
    - The footing's members:
      - **`stand(x, z, yaw) → w`**: `person(chart.toDir(x, z), f)`, where `f` is the chart's `[−sin yaw, −cos yaw]` (the flight's forward) carried onto the sphere.
      - **`step(w, input, dt, obstacles = []) → w`**: `walk(w, input, dt, R, obstacles mapped to { n: chart.toDir(x, z), r: r × METRE })`.
        - A step whose new point's ground is under `water.level + SHORE` keeps `w.n`, takes the new `f`, and has speed and side 0.
      - **`at(w) → [x, y, z]`**: metres in the flight's frame. `[x, z] = chart.toChart(w.n)` and `y = field.heightAt(x, z) + w.h / METRE`.
      - **`yaw(w) → radians`**, the flight's yaw of `w.f`, read from `chart.toChart` of a point 1 m ahead.
      - **`frame(w, tall) → { head, n: [0, 1, 0], f: [fx, 0, fz] }`**: in metres, for `chaseView({ …, metre: 1 })`, with `head = at(w) + [0, tall × 0.92, 0]`.
      - `R`, `chart`.

- [ ] **Step 1: Write the failing tests.**
  - `foot.test.js`:
    - `'chases from over the right shoulder, as the landing camera did'`. The oracle is `footScene.js:3041-3074`'s walk branch and kick, copied into the test file before the move as a plain function over `THREE.Vector3`, in map units. Over 100 seeded `{ head, n, f, pitch, first, kick }`, `chaseView` equals the oracle to 1e−12.
    - `'moves a figure as the landing did'`: the same for `motionOf` against `:2835-2837` and `turnRate` (`:1435-1440`), copied the same way.
    - `'eases a view, at once with reduced motion'`.
    - `'reads a walker’s motion'`: the turn is `+π/2 / dt` for a quarter turn left, and `move` is 1 running.
  - `shared.test.js`: the two faces export those names. `crew.js` isn't imported statically by anything under `expanse/flight/` (walk the static imports as lane 3's `weight.test.js` does).
  - `footing.test.js` (with `roundSpec()` and hoth's plane spec):
    - `'walks the planet’s own sphere, at the universe’s pace'`: ten seconds of `{ move: 1 }` from `stand(0, 0, 0)` go `10 × FOOT.walk / METRE` m (±2%) north, along −z.
    - `'keeps its feet on the field’s ground'`: at 200 steps of a walk, `at(w)[1] − field.heightAt(x, z)` is `w.h / METRE`, and never under 0.
    - `'stops at the shore'`: on an ocean round spec, walking out to sea never puts `at(w)`'s ground under `level + SHORE − 1e−9`.
    - `'goes round the ship'`: an obstacle `{ x: 0, z: −10, r: 6 }` is never nearer than `6 + FOOT.radius / METRE − 1e−6` m.
    - `'walks a plane planet too'`: hoth's, ten seconds north is the same distance, and `at` is finite.
    - `'jumps and comes down where the ground is'`: on a slope, a jump lands with `h = 0`.
    - `'is never NaN'`: 1,000 random inputs, finite throughout.
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/components/universe/foot.test.js src/components/universe/shared src/components/expanse/flight/footing.test.js`
Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Move the rules out of `footScene.js`, which then calls `chaseView`, `easeView` and `motionOf` with `metre: METRE`, in the map's units, as it did.
  - Count `footScene.js`'s and `scene.js`'s lines.
- [ ] **Step 4: Run the universe's and the flight's tests.**
Run: `npx vitest run src/components/universe src/components/expanse`
Expected: PASS, `footScene.figures.test.js` and every foot test unchanged.
- [ ] **Step 5: Check the hand-made landings in the browser.**
  - With the dev server up, run `node scripts/landing-check.mjs`, then `node scripts/entry-check.mjs`.
  - Expected: both pass as on the branch before this task, with no console errors. The rule is moved, not changed, and Step 1's oracle test is what pins that.
- [ ] **Step 6: Commit.** `git commit -m "The universe's walk, its camera behind you and its figures' motion, for any ground"`. The body has `footScene.js`'s and `scene.js`'s counts.

### Task 14: Landing, walking and taking off in the flight

**Files:**
- Create: `src/components/expanse/flight/landing.js`, `landing.test.js` (the phases, pure), `src/components/expanse/flight/walker.js`, `walker.test.js` (drawn)
- Modify: `src/components/expanse/flight/module.js`
  - `create` (`:137-314`) makes the landing and the walker, binds the keys by phase, and steps, anchors and draws by phase
  - `world.landing` for the checks
- Modify: `src/components/expanse/flight/scene.js`. `createFlightScene` gains `look(view, at)`: the camera set from a walker's view, minus the origin, the sky and the sun round it, and `camera.fov` from `FOOT_FOV` (back to 62 in `place`). It also gains `park(ship, at)`: the ship's model placed, the camera untouched.
- Modify: `src/components/expanse/flight/FlightHud.jsx`
  - the prompts for landing, getting out and in, and taking off
  - the way back, through the kit's `Objective`
  - the Menu's `Take off` item
- Modify: `src/pages/Fly.jsx`
  - `onEvent` takes `'landing'` (HUD state) and `'leave'`
  - on `'leave'`, the cover comes back up in the sky's colour, then after `LEAVE_FADE` seconds (0 with reduced motion) it navigates to `universePathFor(pathname)` with `{ state: { from: 'fly' } }`
- Modify: `src/lib/view.js`, `src/lib/view.test.js`. `universePathFor` (`:35-39`) gains a marked block for `/fly/e:…`. Its import of `parseSpaceId` and `spaceId` from `./space/address` is a marked row too, since only the block uses them.
- Modify: `scripts/lib/flight-island.mjs`. `ISLAND.rows` gains `'src/lib/view.js'`.
- Modify: `scripts/universe-endless-check.mjs`. The `ground` and `back` steps, inside the marked block.

**Interfaces:**
- Consumes:
  - Task 12's `LAND`, `LIFT`, `LEAVE`, `canLand`, `flatSpot`, `landPath`, `liftPath`, `leaving`
  - Task 13's `createFooting`, and the faces' `LAND_WORDS`, `FOOT_WORDS`, `SHIP_NAMES`, `chaseView`, `easeView`, `motionOf`, `FOOT_FOV`
  - `flightRules.js`'s `stepShip`, `SHIP`; the HUD kit's `Prompt`, `Objective`, `MenuItem`, `far`
  - `lib/hooks`' `local`; lane 5a's `canonicalId`; Task 0's `parseSpaceId`, `spaceId`
- Produces, in `landing.js` (pure):
  - `LEAVE_FADE = 0.6` (s): the cover's fade on the way back up.
  - **The key sets:**
    - `FLY_KEYS = { ...KEYS, land: ['KeyL'], out: ['KeyG'], takeoff: ['KeyT'] }`
    - `WALK_KEYS = { forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], stepL: ['KeyQ'], stepR: ['KeyE'], run: ['ShiftLeft', 'ShiftRight'], jump: ['Space'], board: ['KeyG'] }`, as the universe's `FOOT_KEYS` (`scene.js:286`)
    - `WALK_AXES = { move: ['back', 'forward'], turn: ['left', 'right'], strafe: ['stepL', 'stepR'] }`
  - **`walkInput(snap, jump) → { move, turn, strafe, run, jump }`**, the stick added in as `inputOf` adds it.
  - **`createFlightLanding({ spec, field, groundAt, footing, canLeave, tell, now = () => performance.now() / 1000 }) → landing`**:
    - `phase`: `'fly' | 'land' | 'down' | 'walk' | 'lift' | 'leave'`.
    - `keys() → { keys, axes }` for the phase: `FLY_KEYS` and `AXES` (with `SHARED_KEYS`) in `'fly'`, `WALK_KEYS` and `WALK_AXES` in `'walk'`, and `{ out, takeoff }` alone while `'down'`.
    - **`step(ship, snap, dt) → { ship, walker }`**. By phase:
      - **`'fly'`**: `stepShip`. `L` (or `land()`) with `canLand` starts `'land'` at `flatSpot(field, [ship.x, ship.z], { water: spec.water })`; with no spot it tells `toast` `LAND_WORDS.rough`. With `canLeave`, `T` or `leaving(ship, groundAt)` goes to `'leave'`.
      - **`'land'`**: `landPath` on the clock `now()`, then `'down'` at its end.
      - **`'down'`**: the ship held. `G` makes the walker `footing.stand(ship.x + STEP_OUT side, …)`, 9 m to the ship's left and 2 m back, facing as the ship does, and goes to `'walk'`. `T` starts `'lift'`.
      - **`'walk'`**: `footing.step(walker, walkInput(snap), dt, [{ x: ship.x, z: ship.z, r: 6 }])`. `G` within `BOARD` m of the ship's middle goes back to `'down'`.
      - **`'lift'`**: `liftPath`, then `'leave'` with `canLeave`, else `'fly'`.
      - **`'leave'`**: tells `toast` `LAND_WORDS.leaving(spec.name)` and `'leave'`, each once, and holds.
    - `land()`, `out()`, `board()`, `takeoff()`: the HUD's buttons and the checks press these, as the keys do. In `'fly'`, `takeoff()` with `canLeave` goes straight to `'leave'`.
    - **`info() → { phase, can: { land, out, in, takeoff, leave }, back: { dist } | null, rough }`**:
      - `takeoff` is true while `'down'`
      - `leave` is true in `'fly'` with `canLeave`
      - told as `'landing'` when it changes, at most four times a second
- Produces, in `walker.js`: **`createWalker(root, { footing, load = () => import('../../universe/shared/crew') }) → walker`**:
  - **`kind`**: null until the crew face has loaded, then `parseShip(local.get(SHIP_KEY)) ?? 'falcon'`, the ship the visitor flies in the universe.
  - **`begin(w)`**: a code-built stand-in (a capsule 1.8 m tall), then the crew's lead figure. That is `PARTY[kind][0]` through `loadPartyFigure(spec, crewCast())`, scaled by `1 / METRE`, in place of the stand-in once loaded.
  - **`update(dt, w, at)`**: placed at `footing.at(w) − at`, turned to `footing.yaw(w)`, and animated with `motionOf` (`fig.update`, `fig.after`, `loco.drop`, as `footScene.js:2838-2845` does).
  - **`view(dt, w, at) → { pos, look, up }`**: `easeView(prev, chaseView({ ...footing.frame(w, tall), pitch: 0.22, metre: 1 }), dt, 12)`, minus `at`.
  - **`info(w, ship) → { dist, near, who }`**: the distance on the chart to the ship's middle, whether it's within `BOARD`, and the figure's name.
  - `end()`, `dispose()`.
- Produces, in `module.js`:
  - `canLeave = Boolean(canonicalId(spec.id))`.
  - The told `'landing'` info gains `ship: SHIP_NAMES[walker.kind] ?? null`.
  - `anchor()` is the walker's `at` in `'walk'`, else the ship's.
  - `rt.input.bind(...landing.keys())` again on every phase change.
  - `world.landing = { get phase, land, out, board, takeoff, spot: props.landing?.start ?? null, walker: { at: () => …, teleport(x, z) } }`.
- Produces, in `FlightHud.jsx`. It takes `landing` (the told info) and `onLanding(what)`:
  - `Prompt k="L" verb={FOOT_WORDS.land}` when `can.land`
  - `Prompt k="G" verb={FOOT_WORDS.out}` while down
  - `Prompt k="G" verb={FOOT_WORDS.in(landing.ship)}` when `can.in`
  - `Prompt k="T" verb={FOOT_WORDS.takeoff}` when `can.takeoff`
  - each with `touch` and `onClick={() => onLanding(what)}`
  - `<Objective text={FOOT_WORDS.back(landing.ship, far(back.dist))} />` while walking
  - a `MenuItem` `FOOT_WORDS.takeoff` when `can.leave`
- Produces, in `lib/view.js`, a marked block:

  ```js
  // planet flight: begin
  // (a generated planet's flight goes back to that planet, in orbit)
  const FLOWN = /^\/fly\/(e:[^/?#]+)/i;
  const flownBack = (pathname) => {
    const p = parseSpaceId(FLOWN.exec(pathname)?.[1] ?? '');
    return p && p.planet !== undefined ? `/universe/${spaceId([p.sx, p.sy, p.sz], p.system, p.planet, ...(p.moon !== undefined ? [p.moon] : []))}` : null;
  };
  // planet flight: end
  ```

  and, first in `universePathFor`: `if (FLOWN.test(pathname)) return flownBack(pathname) ?? '/universe'; // planet flight`.

- [ ] **Step 1: Write the failing tests.**
  - `landing.test.js` (a flat field at 40, a fake footing from Task 13 over it, a fake `now`, `tell` recorded):
    - `'sets down where L finds flat ground, and only low and slow'`:
      - `L` at 600 m does nothing
      - at 300 m and 100 m/s it goes to `'land'`, then to `'down'` once `now` passes `landPath`'s `T`
      - the ship ends at the spot's `h + LAND.rest`, with speed 0
    - `'says when there’s nowhere flat'`: over an all-slope field, `L` tells `toast` `LAND_WORDS.rough` and stays `'fly'`.
    - `'gets out, walks, and gets back in only by the ship'`:
      - `G` while down gives `'walk'` with the walker 9 m to the ship's left
      - `G` 40 m off does nothing
      - `G` within `BOARD` gives `'down'`
    - `'takes off and climbs out to orbit, telling the page once'`: `T` while down gives `'lift'` then `'leave'`, with `tell('leave')` and the `LAND_WORDS.leaving` toast exactly once each.
    - `'leaves the air by climbing too, or at once from the menu'`: in `'fly'`, a ship at `LEAVE.alt` goes to `'leave'`, and so does `takeoff()`.
    - `'never leaves a named world'`: with `canLeave` false, `T`, `takeoff()` and the climb do nothing, and `can.leave` is false.
    - `'gives each phase its own keys'`:
      - `'walk'` has no `KeyT`, `KeyL`, `KeyB`, `KeyX` or `KeyR`
      - `'fly'` has no `Space`
      - `'down'` has only `KeyG` and `KeyT`
      - Task 14's `module.test.js` below pins that only one set is bound at once.
  - `walker.test.js` (Node, three; `load` a fake resolving a figure with `update`, `after` and a `model` group):
    - `'stands a stand-in at once, then the crew’s figure'`
    - `'sits the figure on the ground, minus the origin'`
    - `'views from over the shoulder, eased'`: the first `view` equals `chaseView(...)` minus `at`.
    - `'says how far the ship is, and when it’s near'`
    - `'frees the figure on dispose'`
  - `module.test.js`:
    - `'rebinds the keys as the phases change, and unbinds on dispose'`: drive it through `world.landing.land()`, `out()`, `board()`.
    - `'anchors the origin on the walker while walking'`.
  - `view.test.js`:
    - `'sends a generated planet’s flight back to it in orbit'`: `universePathFor('/fly/e:1,0:0:1')` is `'/universe/E:1,0:0:1'`. `'/fly/E:2,-3,1:0:0:1?at=1,2,3'` gives `'/universe/E:2,-3,1:0:0:1'`. `'/fly/hoth'` and `'/fly/e:junk'` give `'/universe'`.
    - `'keeps every other way out as it was'`: the file's existing cases are untouched.
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/components/expanse/flight src/lib/view.test.js`
Expected: FAIL.
- [ ] **Step 3: Implement and wire.** `module.js` stays under 800 lines: the phases are `landing.js`'s and the drawing is `walker.js`'s.
- [ ] **Step 4: Run the tests and the island.**
Run: `npm test && node scripts/flight-island.mjs --check`
Expected: PASS, then `ok`.
- [ ] **Step 5: Add the endless check's steps.**
  - **`ground`:**
    1. Continue from `dive`.
    2. `__FLIGHT__.landing.land()`, then wait until its `phase` is `'down'`. The ship's x, z is within `LAND.reach` m of the arrival's start (the spot you dove at), and its height is the ground's plus `LAND.rest`.
    3. Shoot `down.jpg`.
    4. `out()`, then wait for `'walk'`.
    5. Press `W` for long enough that the walker's `at` moves 2 m, waiting on that condition. Its height is the field's within 0.05 m.
    6. Shoot `walk.jpg`, and the same at 390 × 844 (`walk-phone.jpg`) with the HUD's prompts in the frame.
    7. `teleport` the walker 6 m from the ship, `board()`, and wait for `'down'`.
  - **`back`:**
    1. `takeoff()`.
    2. Wait until `location.hash` is `#/universe/E:…`, the same place as the planet dived at.
    3. Wait until `__universe().place` (lane 3) is that id and the ship is within the planet's park distance plus 1 of it, facing it (`dot > 0.99`).
    4. Shoot `orbit.jpg`.
- [ ] **Step 6: Check it in the browser.**
  - Run `node scripts/universe-endless-check.mjs --quality mid --only dive,ground,back`.
  - Then `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --quality mid --routes /fly/hoth,/fly/<id>`.
  - Expected: exit 0 both, no console errors, and `/fly/hoth`'s numbers as before.
- [ ] **Step 7: Commit.** `git commit -m "Set down on a generated planet, step out and walk it, get back in and climb out to orbit of the same planet"`

### Task 15: Rocky rogue planets land (after lane 4a)

Lane 4a's hand-on: a rocky rogue planet's card says `land: true`, but its id is a thing's, `E:…:w<n>`, which lane 5a's ids refuse. Do this task once lane 4a is on the branch. If it isn't when the rest is done, leave this task for after 4a merges and say so in the hand-off notes.

**Files:**
- Modify: lane 4a's `src/components/universe/things/looks/rogue.js`. Its `buildBody(ROGUE_LOOK[traitsOf(row).type], { r: size, tier })` becomes `build(…, { r: size, tier, of: { id: row.id, row, rogue: true } })`, with `build` a dep from `createThingDrawers`. The scene passes `landing.build`.
- Modify: `src/components/expanse/flight/rows.js`
  - `rogueRowOf(row) → Row`
  - `rowOfPlace` takes a `'thing'` whose row's kind is `'rogue'`
- Modify: lane 5a's `src/lib/land/flight/expanse.js`. `canonicalId` also reads `e:…:w<n>`. `planetSpecOf` (`planetSpec.js`) builds a wonder id only from a lookup row with `rogue: true`, and gives null for any other.
- Modify: lane 5a's `src/lib/land/flight/variety.js`. For a row with `rogue: true`, the slot's system key is the row's id and its index 0 (a rogue has no siblings).
- Modify: `src/components/expanse/shared/flight.js`. `rowFor` takes `{ id, row, rogue: true }`.
- Modify: `src/lib/view.js`. `flownBack` writes `{ wonder: p.wonder }` for a `w` id.
- Tests: `rows.test.js`, `planetSpec.test.js`, `variety.test.js`, `flight.test.js`, `view.test.js`, lane 4a's `rogue` look test.

**Interfaces:**
- Consumes: lane 4a's `traitsOf(row) → { type, land }` (through `expanse/shared/space.js`), `thingRow`, `ROGUE_LOOK`.
- Produces: **`rogueRowOf(row) → { id: lower-case canonical, name, type: traitsOf(row).type, seed: String(row.seed), radius: row.size, moons: 0, rings: false, system: { faction: null, traffic: 0, hazard: null }, rogue: true }`**.

- [ ] **Step 1: Write the failing tests:**
  - `'reads a rocky rogue as a planet to fly over, and refuses a gas one'`: over `E:1,0`'s lattice, for the first rock-typed rogue `thingRow`, `planetSpecOf(row.id.toLowerCase())` is a round spec. For the first gas-typed one, the spec is soft, and `link.landable` is false.
  - `'still refuses a wonder id that isn’t a rogue'`: lane 5a's `'e:1,0:w1'` case still holds.
  - `'gives a rogue its own colours, no sibling read'`
  - `'goes back to the rogue in orbit'`: `universePathFor('/fly/e:1,0:w123')` is `'/universe/E:1,0:w123'`.
  - lane 4a's rogue look calls `build` with `of.rogue`.
- [ ] **Step 2: Run them to see them fail.**
Run: `npx vitest run src/components/expanse src/lib/land/flight src/lib/view.test.js src/components/universe/things`
Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.**
Run: `npm test && node scripts/flight-island.mjs --check`
Expected: PASS and `ok`.
- [ ] **Step 5: Commit.** `git commit -m "A rocky rogue planet can be landed on and walked, like any rocky world"`

### Task 16: The full measure, the island, and the hand-off notes

**Files:**
- Create: `docs/superpowers/evidence/endless-universe-lane-5b/HANDOFF-NOTES.md`
- Modify: `docs/superpowers/evidence/endless-universe-lane-5b/README.md`

- [ ] **Step 1: The full measure, once.** Run these in the background and wait on their exits:
  - `node scripts/universe-check.mjs --quality high --out lab/universe/after-5b/high`, then the same for `mid` and `low`. Three runs, since `--out` is ignored when more than one tier runs.
  - **Expected:**
    - calls and triangles at every pose in `lab/universe/baseline/<tier>.json` no higher, and the hand-made poses equal to before this lane
    - the endless poses (lane 2's and lane 3's) re-recorded together in one run a tier into `lab/universe/endless/<tier>`, equal in calls and triangles
    - their pictures changed on purpose (orbit maps), shown side by side
  - `QUALITY=mid node scripts/perf-probe.mjs universe` and `QUALITY=low …`. Expected: p50 no worse than 2%.
  - `FLY=hoth node scripts/perf-probe.mjs fly`. Expected: as before this lane.
  - **The new baseline: on a generated planet's ground** (spec H's new pose).
    - Run `FLY=<id> node scripts/perf-probe.mjs fly` on Task 8's planet, and a shot at the `ground` step's walking pose.
    - Record both as the baseline for that pose, at mid and low, in the README.
- [ ] **Step 2: The endless check, whole.** Run `node scripts/universe-endless-check.mjs --quality mid`, then `--quality low`. Expected: exit 0 both times, with every lane's steps and this lane's `dive`, `ground`, `back` and `gas`. Copy the per-step table into the README.
- [ ] **Step 3: The repo's own checks.**
  - With the dev server up: `entry-check.mjs`, `landing-check.mjs`, `navmap-check.mjs` and `links-check.mjs`.
  - Then `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe,/fly`.
  - Expected: each as on the branch before Task 1.
- [ ] **Step 4: The contact sheet.**
  - Run `node scripts/planet-contact-sheet.mjs` (lane 5a's).
  - Look at `lab/planets/contact/sheet.png`. Each orbit map shows its biomes as the ground does.
  - Copy it, at JPEG 80 under 1 MB, into the evidence folder.
- [ ] **Step 5: The island.**
  - `node scripts/flight-island.mjs --check`. Expected: `ok`.
  - `node scripts/flight-island.mjs --remove --dry`. Expected:
    - `expanse/shared/flight.js` is deleted
    - the marked rows in `sceneLanding.js`, `lib/view.js` and the endless check are dropped
    - nothing under `universe/` or `galaxy/` is deleted
  - Paste the dry run's summary into the README.
- [ ] **Step 6: The bundle.**
  - `npm run build`. Note the universe scene's chunk and `Fly`'s chunk before (from the branch point) and after.
  - `WORLD_MB['/universe']` (`src/components/worlds/worlds.js:14`) changes only if the universe's download crosses its next whole megabyte. Say which.
- [ ] **Step 7: Write `HANDOFF-NOTES.md`.**
  - **"Landed":** every module above by path, each with its interface in one line; the four endless steps; the ground pose's baseline; `scene.js`'s and `footScene.js`'s counts.
  - **"Left":**
    - Lane 4c: a take-off's `/universe/E:…` must start at that planet even when a saved position exists (spec C: "`/universe/<id>` behaves as today"); and `tp-universe-where` should say the planet you were at as you dived.
    - Lane 6b: nothing on the map changes for a landing. A landed pilot's crew could show on the chart, through the flight's own pose.
    - Task 15, if lane 4a hadn't merged.
    - The findings below.
- [ ] **Step 8: Run the gates and commit.**
  - Run `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` and `node scripts/flight-island.mjs --check`.
  - Expected: all green, within budget, with `glsl-sites`, `loops`, `boundary-breaks` and `cycles` unchanged.
  - `git add lab/universe/after-5b lab/universe/endless docs/superpowers/evidence/endless-universe-lane-5b && git commit -m "Lane 5b measured at every tier and on a generated planet's ground, and its hand-off notes"`

---

## What later lanes consume

| Name | From | Used by |
|---|---|---|
| `buildBody(look, { orbit: { map, clouds, atmo, glow } })`, `body.orbitIn()`, `ORBIT_SKIN`, `skinBytes`, `skinRelief` | `galaxy/bodies.js`, `bodySkin.js` | 4a (a gargantuan or rogue that wears a baked map), anyone building a generated body |
| `createFlightLink({ workers, tier })`: `rowFor`, `landable`, `orbit`, `cover`, `route` | `expanse/shared/flight.js` (on the island) | only `sceneLanding.js` (marked) |
| `createSceneLanding(deps)`: `build`, `bodies`, `pending`, `air`, `ride`, `diving`, `cancel`, `debug` (`diveAt`, `nearest`, `state`, `pending`) | `universe/landing/sceneLanding.js` | 4a (its drawers' bodies through `build`), 4c (`diving()`, so the arrival waits), the endless check |
| `{ type: 'land', what: 'hand' \| 'turned', id, why?, to?, state?, colour? }` | the scene's `emit` | 6b (a landing in progress), 4c |
| `DIVE`, `diveFx`, `divePath`, `diveSpot`, `turnBack`; `landPlan` | `universe/entry.js`; `universe/flight.js` | 4b (an event that throws you into a planet's air) |
| `LAND_WORDS`, `FOOT_WORDS`, `SHIP_NAMES` | `universe/words.js` | 6b, 4c |
| `CAM`, `FOOT_FOV`, `chaseView`, `easeView`, `motionOf`; the faces `universe/shared/foot.js` and `universe/shared/crew.js` (with `crewCast`) | `universe/foot.js`, `footScene.js` | any world that walks the universe's crews on its own ground |
| `rowOf`, `moonRowOf`, `rowOfPlace`, `rogueRowOf`; `expanseRow` in 3D; `planetSpecOf(id, { row })` | `expanse/flight/rows.js`, `planets.js` | 6b (a visited planet's name and type without its sector) |
| `RELIEF_GAIN`, the bake's `relief`, the worker's `{ row }`, `createOrbitMaps(…).forRow` | `lib/land/flight/orbitMap*.js` | 4a |
| `BIOME_TINT`, `biomeTints`, `tintAt`, `planetField(spec).tintAt` | `lib/land/flight/biomeTint.js`, `field.js` | anyone colouring a generated planet |
| `spotQuery`, `readSpot`, `windowPoint`, `landingOf`, `ARRIVE`, `arrivalShip` | `lib/land/flight/arrival.js` | 4c (a link that lands you), the endless check |
| `LAND`, `LIFT`, `LEAVE`, `canLand`, `flatSpot`, `landPath`, `liftPath`, `leaving` | `lib/land/flight/touchdown.js` | the flight |
| `weatherOf`, `skyOf`, `FALL`, `FALLS`, `createPlanetWeather` | `expanse/flight/weather.js` | the flight's events |
| `__FLIGHT__.landing` (`phase`, `land`, `out`, `board`, `takeoff`, `spot`, `walker`) | `expanse/flight/module.js` | the checks |
| `universePathFor('/fly/e:…') → '/universe/E:…'` | `lib/view.js` | every way out of the flight (`wayOut`, `ViewSwitch`) |
| the `dive`, `ground`, `back` and `gas` steps | `scripts/universe-endless-check.mjs` | every later lane |

## Assumptions about unmerged work

Each of these can be checked once the lane named has merged. Lane 5a had committed nothing on `eu/lane-5a` at the time of writing. Lane 2 had PR 2.3 on `eu/lane-2` (`8630fda8`); 2.4 and 2.5 weren't there yet.

1. **Lane 5a** is as its plan's Interfaces give it:
   - `planetSpecOf(id, { expanse })`, where `expanse` is a function or an array of rows
   - `chartedAt`, `chartOf`, `dirOfLatLon`, `latLonOfDir`, `uvOfDir`, `dirOfUv`, `frameAt`, `angleBetween`, `unit`
   - `sphereField(spec).climateAt`, `weightsAt`, `roundBiomes`, `ROUND_ROUGH`'s ids, `familyOf`, `SEEDED_EXPANSE`
   - `varietyOf(row)` with `sky.clouds`, `sky.cloudColour`, `sky.high`, `sky.haze` and `water.kind`
   - `bakeOrbitMap` returning `{ width, height, rgba, biome }`, `groundColour(spec, { h, slope })`, `ORBIT_MAP_SIZE`, `orbitMapSize`, `PLANE_WINDOW`
   - `createOrbitMaps({ workers, make, cap }).get(spec, tier)`
   - `canonicalId`, and `rowOf` and `moonRowOf` in `expanse/flight/planets.js`
   - spec fields `round`, `sky`, `weather`, `kind`, `parent`, `buildable`

   If `rowOf` stayed private or was renamed, Task 1 exports it from `rows.js` under that name.
2. **Lane 2's `near.js`** builds planets with `build(TYPE_LOOK[p.type] ?? TYPE_LOOK.rock, { r: p.radius, tier })` and moons with `build(..., { r, small: true })`, under a group whose parents carry no rotation or scale beyond `map`'s. Task 11 holds even if they do, since it converts through the group's world transform. `createNear` takes `build`, and `createExpanse` makes `createNear`. Each body's `dispose` is called when its system is let go.
3. **Lane 2's `placeOf(universe, id)`** answers `{ kind: 'planet' | 'moon' | …, row, sector }` with `sector.systems`, and keeps eight sectors. `fullSector(…).legacy.systems` is the appended part's start.
4. **Lane 2's `BUDGET[tier].planetMap`** equals lane 5a's `ORBIT_MAP_SIZE` (Task 2 pins it). `expanse.update({ ship })` keeps a system built while the camera is near it, even with `ship: null`. Task 11 passes the ship during a generated dive regardless.
5. **Lane 2's `scripts/universe-endless-check.mjs`** has a `system` step that ends inside a generated system with its bodies built, `--only`, `teleport`, and a per-step recorder.
6. **Lane 3's `/universe/<E: id>`** starts the ship parked at that place (`parkPlace`, `reach + 4`, facing it) with its card, and `__universe().place` is that id once arrived (its Task 14 and finding 5). `scene.js`'s `createExpanse` call stays at `:772`, and lane 3's `createScenePlaces` comes after it.
7. **Lane 4a's `traitsOf(row)`, `ROGUE_LOOK` and `things/looks/rogue.js`** (for Task 15 only) are as its plan gives them, and `createThingDrawers` can take a `build` dep.
8. **Lane 4b's `events.clear()`** is in `scene.js` if 4b has merged (Task 11's `begin`).
9. **The scene's lines.**
   - `fly()`'s air block, `render()`'s four `state.dive` guards and `diveAt` read as quoted, whatever their line numbers after lanes 2, 3, 4a and 4b.
   - `flyInto`, `landingOpen(removed, …)`, `placeName`, `entrySound`, `quietRoar`, `warm`, `powers`, `unique`, `hunters` and `dropAuto` keep their names.
10. **`footScene.js`'s `view`** walk branch and party motion read as quoted at `:3041-3074` and `:2835-2845`, so Task 13 moves them verbatim.

## Findings for the coordinator (spec against code)

1. **The island forbids what "the universe leans on it" needs, so the flight lends one face.**
   - `flight-island.test.mjs` asserts removal deletes nothing under `universe/`, and only `App.jsx` and `packs.js` may import island paths.
   - So the universe reaches the flight only through `expanse/shared/flight.js`. That face is on the island, under its own name pattern, and is imported by one marked row.
   - With the flight removed, generated planets keep a procedural look and don't land. Gas giants still turn you back.
2. **"Reuse footScene.js's walker, camera and HUD" can't mean footScene itself.**
   - `createFoot` is one 3,530-line closure over the map's spheres: smooth spheres with no terrain heights, the fandom landings, troops and lamps in the map.
   - This lane reuses `foot.js`'s `walk` on the planet's own sphere (the chart's), so the pace, turning, jump and obstacles are the universe's.
   - Its camera rule and figure motion move out of `footScene.js` into `foot.js` (`chaseView`, `motionOf`), with the old code kept as the test's oracle, so the hand-made landings frame you as they did (Task 13).
   - The crew's figures come through `footScene.js`'s existing export.
   - The HUD kit's `Prompt` and `Objective` carry the universe's own words.
   - There are no troops or guns on the flight's ground.
3. **The flight's ship isn't the universe's.**
   - The flight flies its code-built wedge (`expanse/flight/scene.js:50-79`), so the Falcon you dove in lands as a wedge, and its crew step out of it.
   - Bringing the hero ships (`shipModels.js`) into the flight is a change to the flight's look, for the owner to call.
4. **A typed `/fly` link still makes a sector on the page's main thread.** A dive's route carries the row in `history.state`, so the common path makes none. A typed, shared or reloaded-in-a-new-tab link makes one through `placeOf` (45–130 ms), as `/fly/e:…` already does with `makeSector` today. Spec A's "never on the main thread" is kept for the universe, not the flight's page load.
5. **Bake time.**
   - A 256 × 128 bake samples every texel's height five times (lane 5a's `sample`).
   - If Task 2's median is over a second, a built system of twenty bodies takes tens of seconds to wear its maps.
   - Each body fades in when its map lands and stays procedural until then. The nearest system is built first.
6. **Weather costs a draw.** A generated planet's standing weather is one `Points` or `LineSegments` draw on `/fly/<id>`, as the flight's weather events already are. "Draw calls no higher" holds at `/fly/hoth` and the fifty, not at a generated planet with weather.
7. **Lava under the skin path lost its glow** (`bodySkin.js:84`: `s.emit *= 1.0 - k`). This lane adds `SKIN_GLOW` for orbit maps only. The galaxy's painted skins are unchanged.
8. **Gas giants turn you back at their air, not their cloud tops' solid.**
   - Lane 2 makes generated giants solid at their radius. The turn-back acts at `AIR = 1.2` radii, the same air a rocky planet's dive starts in, so a ship at landing speed never reaches the solid.
   - A boosting ship (`'hot'`) still crashes into it, as at a fandom planet.
9. **Pocket universes turn you back with a line** (spec: "need not land"). The `/fly` id can't carry the seed.
10. **Lane 2's finding 4 is taken here.** `planets.test.js`'s `'e:1,0:99:0'` null case moves past the sector's count (Task 1).
11. **The 13 seeded planets land on their plane, at the window point** of lane 5a's plane bake. Their orbit map is that window, so the spot you dove at is the ground under you, with the edge mismatch the spec accepts.
12. **`footScene.js` is over the ceiling** and stays so. This lane takes about 25 lines out of it and adds one export.

## Spec coverage

| Spec | Task |
|---|---|
| E, "Orbit matches ground": the universe's planet shader (`buildBody`) wears the baked map, with clouds and atmosphere from the same description | 2, 3, 4, 5 |
| E, the map made when wanted, cached in memory, never stored | 2, 4 (lane 5a's cache); Global Constraints |
| E, "The on-foot biome lookup … reads the same map" | 6. The walker's ground is the flight's field, whose `biomeAt` lane 5a's texel test ties to the map's `biome`. Biomes now also show on the ground and from orbit by one tint. |
| E, Landing 1, Approach: the air as `entry.js`'s rule | 9, 11 |
| E, Landing 2, Entry: two to three seconds in the universe, heat then cloud in the planet's palette | 9 (`DIVE`, `diveFx`), 11 (`reentry.js`'s show, `link.cover`) |
| E, Landing 3, Hand-off: behind the cloud, `/fly/e:…` carrying the spot | 4 (`route`, `spotQuery`), 11 |
| E, Landing 4, Arrival: low over the spot, descending | 10 |
| E, Landing 5, Touchdown on ground flat enough, and walking with the universe's walker, camera and HUD, the height from the flight's field | 12, 13, 14 |
| E, Landing 6, Take-off: climb out or press Take off; `/universe/e:…` parked in orbit facing it | 12, 14 (with lane 3's start) |
| E, "What doesn't land": gas giants turn you back with a line; fandom planets keep their own; pockets need not | 9, 11 |
| E, "Moons land too" | 1, 4, 5, 11 |
| E, "The planet flight becomes a kept part", the remover learns the new links | 4, 5, 11, 14, 16 |
| Index gap: biomes, weather and sky clouds on the flight's ground, generated only; the fifty and the galaxy unchanged | 6, 7, 8 |
| Lane 4a's hand-on: rocky rogue planets land | 15 |
| Done 6: land, step out, walk, get back in, take off; in orbit of that planet after; orbit matches ground | 14's endless steps, 6, 16 (the contact sheet) |
| Done 6: "two neighbouring planets never look alike" | lane 5a's; this lane's tints and skies only add to it |
| Done 9: nothing lost | 5, 11 (`diveAt` and the fandom air as they were), 13 (the landing camera pinned to its old code), 7, 8 (the fifty's shaders pinned), 16 |
| Done 10: phones still fly | orbit maps by tier (2); weather counts by tier (8); the phone shot (14); the low-tier measure (16) |
| H: the size of the planet maps in the one tier table | 2 |
| H: the new pose "on a generated planet's ground" | 16 |
| The spec's counts (20 kinds of thing, 15 events, density, pacing) | none is this lane's |
