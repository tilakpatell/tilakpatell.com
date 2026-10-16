# The galaxy's open systems, finished: super speed and places to find. The design

Phase 6 of `HANDOFF-galaxy.md`, the part Lane D (PR #548) left: the systems are 2,400 across now, with the sublight drive up to 120 out in the open. This finishes them. Journeys with deep-space stops and ships to fly beside on a lane are their own lane, after this.

## What the owner asked for

Open systems, with super speed and three to six places to find in each (the galaxy phases design, Phase 6). No seamless flight between systems. No new models or textures. Nothing new drawn on `low`. No sequel trilogy.

## Where it is today

- `galaxy/space.js`: `EDGE` 2,400, `PULSE` 120, the drive opens by how far the ship is from anything big the way it's going (`driveAlong`), as the universe map's does.
- `universe/ship.js` already knows super speed: `input.overdrive` up to `OVERDRIVE` (3) times what the drive allows, with the brakes squared so it stops in the same room (`overdriveAt`), and the autopilot takes an `od`. The universe map uses it only on the autopilot (`travel(..., 'super')`).
- A system's goals are its planet and its great stations (`systems.js` `goalsOf`, `world.js` `addSolid(..., { goal: true })`): the autopilot flies to them, the HUD labels them (`GalaxyView.jsx`), the panel lists them (`GalaxyPanel.jsx`), `atGoal` says when you're there. Beyond them a system is empty out to its edge.

## Decisions

### 1. Super speed is the ship's, out in the open, on the boost

Out past everything, holding the boost opens the drive into super speed: `space.js`'s `makeSpace` gains `wideAlong(x, y, z, f)` (0…1: how far out in the open, past everything big, the way it's going: 0 within `WIDE.near` (500) of anything's reach, 1 beyond `WIDE.near + WIDE.ramp` (500 more)), and `overdriveAt(x, y, z, f)` = `1 + (OVERDRIVE − 1) × wideAlong`. The scene passes it as `input.overdrive` while the pilot boosts, and as the autopilot's `od`. So the sublight drive's 120 becomes up to 360 well out from the planet, and `ship.js`'s own easing brings it down again coming up on anything: it never arrives flat out (tested, as the 120 is). Nothing changes within about a thousand units of the planet, where the moment from the films plays. Under the Interdictor's hold `input.interdicted` already shuts it. The crew say their universe-map `overdrive` line the first time it's past 150.

### 2. Three to six places to find in each system, from the seed

`galaxy/places.js` (pure, tested): `placesOf(sys)` gives each system three to six places out in its open space, the same every time and for every pilot (seeded from the system's id, as the rocks are). Each is `{ id, kind, name, at, r, reach, goal: true, place: true }`:

- between `PLACES.inner` (700) and `PLACES.outer` (2,000) from the planet, within ±180 of its plane, at least `PLACES.apart` (420) from each other, clear of the system's hazards (`hazardsOf`) by their reach and 60;
- kinds, each drawn from what the galaxy can already draw and named in the galaxy's own way, with no model: `wreck` (a derelict hull, dark, turning slowly), `comet` (a head and a tail streaming away from the system's first sun), `rocks` (a knot of asteroids), `beacon` (a navigation beacon, blinking), `outpost` (a small station, rings on a spar), `nebula` (a pocket of glowing gas, not solid: fly through it);
- names from a table per kind with a few variants (`The Hollow Freighter`, `A derelict Nebulon-B`…); a system gets no kind twice;
- a `find` for each: `createFinds({ store })` keeps which have been found, per system, in `localStorage` (`tp-galaxy-found`), believed only in shape (as `interdiction.js`'s count is). `found(sysId)` → ids; `mark(sysId, id)` → whether new; `count(sysId)` → `{ found, of }`.

### 3. Drawn in two draw calls, everywhere, fewer glows on `low`

`galaxy/placesDraw.js` `createPlaces({ places, small, sun })` → `{ group, update(t), dispose() }`: every solid place in one merged `BufferGeometry` with vertex colours under one `MeshStandardMaterial` (the wreck's hull, the outpost's rings and spar, the rocks' chunks, the beacon's body, the comet's head: icosahedra and cylinders, pushed about by the seed), and every glow in one `Points` under one `ShaderMaterial` with a time uniform (the comet's tail, the nebula's puffs, the beacon's blink, a faint marker over each place so it reads from far off). Two draw calls a system, within the baseline's budget (+10%). On `low` the solids are the same (one draw, a few thousand triangles, so a derelict is still there to bump) and the glows are fewer. The solids are `world.js` solids with `goal: true` (the nebula has `reach` for `atGoal` but `r` 0, so it's not bumped), so the autopilot parks by them and the labels and the panel know them.

### 4. Finding one

Arriving at a place (`atGoal`) the first time: the scene emits `{ type: 'find', id, name, kind, first, found, of }`; the page keeps `finds` for the panel (`Out there: 2 of 5 found`, each place `Fly to …` or `Found: …`); the crew have one `find` exchange each (`lines.js`); an `earn` of `find` pays as `station` does if the economy knows it (else nothing). The HUD label of an unfound place shows its kind (`A derelict`), and its name once found. The holomap is untouched. Sizes are the galaxy's ships' (a Star Destroyer is 16): a derelict's hull is 4 long, a beacon under 1, an outpost's rings 8 across.

### 5. Numbers kept

`EDGE`, `PULSE`, `FAR`, the streaks: as Lane D left them. `OVERDRIVE` stays 3 (the ship's). If 360 proves too much in the browser, `WIDE.near` and `ramp` are the knobs.

## Out of scope

Journeys and deep-space stops (between systems), ships beside you on a lane (the streaks stay sky-only), named NPCs, Phases 2 to 5's events.
