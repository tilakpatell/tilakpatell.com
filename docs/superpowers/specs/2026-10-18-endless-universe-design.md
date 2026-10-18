# The endless universe: one seamless space, full of places, nebulae that stay put, planets you land on, a map that follows. The design

Date: 2026-10-18. Status: design, written from the owner's brief by an architecting session, for implementation sessions working in parallel lanes. The plan will be `docs/superpowers/plans/2026-10-18-endless-universe.md`; the hand-off is `docs/superpowers/HANDOFF-universe.md`, whose owner's rules apply to every lane.

## What the owner asked

> "Fix the universe to make it more populated and better. Also look into the nebulas as when you move around the nebulas move as well (which is wrong). Make it better and work on the infinite worlds (which we were doing before) but make it so for the universe so it's like No Man's Sky and we can continue exploring or have chunks. Fix the map as well."

From the conversation that followed:

- **The first minute:** "Something gargantuan or make it really cool or we spawn next to one of the worlds and make it unique."
- **New places, land or look:** "I think both is good (if you can make the worlds unique and stuff with the infinite world generation and other libraries)."
- **The bar:** "As long as the map is dynamic and we can go to places in the universe and everything works and seems populated then I don't care."

The rest of this document is the architect's reading of those words against the code. Everything marked **(my call)** was decided here, not by the owner, and can be overruled.

## What done looks like

Each of these is checked, by a test or in a browser, before the lane that owns it is done.

1. **No end, no edge.** From anywhere you can fly across the disc in any direction for as long as you like, and up or down out of it where it thins (section A). There is no rim, no empty band, no wall of things popping in, and no seam between the hand-made core and the generated space.
2. **It seems populated** (numbers are my call, pinned by a test so a lane can tune them):
   - From any point, at least three places are within 9,000 units. That is 30 seconds on the pulse drive.
   - The nearest named place is never more than 6,000 units away.
   - Something moves within 20 seconds of flying anywhere: traffic, a fight, wildlife or an event.
3. **Every place you see, you can go to.** It has a name, you can pick it, the map lists it, and travel takes you there. You can't fly through a solid body.
4. **Nebulae stay put.**
   - Fly 5,000 units sideways and a nebula shifts on screen by the parallax its distance gives.
   - Roll the ship and it rolls with the stars.
   - Fly towards it and it grows; fly into it and you are in its fog.
   - The same holds for every far object: gargantuans, wonders and generated nebulae.
5. **Generated planets are unique, and you can land on them.**
   - Fly down to any rocky generated planet, land, step out, walk around, get back in and take off.
   - Taking off leaves you in orbit of that same planet.
   - Two neighbouring planets never look alike.
   - What you see from orbit matches what you walk on.
6. **The map is dynamic.**
   - It is centred on your ship, wherever you are.
   - It zooms from a single system out to everything you know.
   - It shows generated places and travels to any of them.
   - The no-3D mini-map uses the same projection and the same data.
7. **The first minute is a "wow".** A new visitor with a ship spawns beside one of the site's worlds, with something gargantuan in view and traffic moving through.
8. **Nothing is lost.** Every route, key, save, sound, achievement, dev hook and test that works today works afterwards (HANDOFF-universe's owner's rules).
9. **Phones still fly.** The `low` and `mid` tiers hold their frame rate, with less built, not a broken scene.

## Where it is today

Read from `main` at `ba818787` by two surveys in this session.

- **The scene.** `src/components/universe/scene.js` is 6,226 lines; the repo's ceiling is 1,500 (`docs/health/RULES.md`, "Size"). The hand-made core is a disc 54,000 units in radius:
  - 6 stations
  - 12 fandom planets
  - 10 Rick and Morty moons in their own sector
  - 15 wonders (`deep.js`)

  They sit 3,000 to 10,000 units apart (`regions.js:5-6`). Most of the disc is empty.
- **The Expanse** (`src/components/expanse/`).
  - It generates seeded sectors of 120,000 units (`gen/grid.js:12`), each holding:
    - 8 to 24 systems, at least 6,000 apart
    - 1 to 7 planets per system
    - 0 to 3 wonders
  - It wakes past `RIM.outer` = 51,600 and sleeps inside 48,000 (`scene/expanse.js:38-45`), so the whole core has nothing generated in it.
  - Generated systems keep out `MAP_RADIUS + 4,000` (`sector.js:87-93`), which leaves an empty band of 10,000 units or more.
  - Sectors pop in at the rim one a frame. The starfield calls `makeSector` up to 40 times synchronously on a sector change (`starfield.js:41`).
  - Generated planets:
    - are frozen at their t = 0 positions
    - have their moons and rings generated but never drawn
    - aren't solid (`ship.js:178`)
    - can't be picked or labelled
    - aren't destinations
- **Coordinates.**
  - Positions are absolute floats.
  - `drawn()` makes the draw camera-relative past 3,000 units (`scene.js:1458-1478`).
  - `runtime/origin.js` is used only by the Expanse root, and the scene passes it no `onShift`.
  - The far plane is 45,000 (`scene.js:490`).
- **Nebulae.** Three faults, all of which make a nebula appear to ride with the camera:
  1. The universe uses Kashyyyk's sky (`galaxy/sky.js`), which bakes three bright nebulae into a cube shown on a sphere re-centred on the camera every frame (`scene.js:5299`). They have no parallax and never get closer.
  2. The Veil and the Cradle are landmark impostors (`landmarks.js`).
     - Each is redrawn every frame at `SKY_FAR` and never drops below 14° (`:39`).
     - Each is screen-aligned with no roll correction (`:127-129`), while the chase camera rolls with the ship.
     - Each is drawn with `depthTest: false`.
     - The real cloud only takes over within 5,700 units.
  3. The Expanse's nebulae are `gl.Points` capped at 512 px (`expanse/scene/sectors.js:60`), so close up they stop growing.

  The real puff clouds (`deepspace.js:714-869`) are anchored in world space, but each puff spins and faces the camera.
- **The maps.**
  - `NavMap.jsx` and `nav.js`:
    - a fixed list of destinations
    - three fixed charts, on a 0.375-power projection out to 54,000
    - no zoom or pan
    - In the Expanse, the ship marker falls off the chart and generated systems aren't drawn.
  - `MiniMap.jsx` uses a different projection (square root against about 34,000):
    - It draws orbit rings that match nothing.
    - It shows no wonders or moons, yet it is the whole map when 3D is off.
  - `scripts/navmap-check.mjs:90` jumps to coordinates from before the spread.
- **Travel.**
  - `travel(id, drive)` accepts only ids in `GOALS` (`ship.js:183-187`).
  - The jump goes any distance (recharge 5 s).
  - The pulse drive is 300 units/s.
  - `tripTime` simulates for at most 150 s, so an Expanse-scale trip has no time.
- **Landing.**
  - Flying into a fandom planet's air (radius × 1.2, at ≤10 units/s, sinking; `entry.js`) swaps to that fandom's page. Coming back parks you at the planet.
  - The on-foot scene (`footScene.js`) is reachable only from dev hooks.
  - The **planet flight** (`/fly/:planet`, `src/components/expanse/flight/`, `src/lib/land/flight/`) already flies Expanse planets (`e:sx,sz:i:j`) over endless streamed ground:
    - a quadtree of tiles built in a worker with FastNoiseLite
    - life, landmarks and a map
  - It has no walking, and nothing in the universe links to it.
  - Its design (`2026-10-10-planet-flight-removable-island-design.md`) kept it removable in one move.
- **Spawn and saves.**
  - A pilot with a ship starts at a random entry of `STARTS` (`ship.js:321-368`), and returning pilots do too: no position is saved.
  - Saves are small keys over `localStorage` (`rt.saves`) and IndexedDB through `runtime/store.js`.
- **Online.** Poses outside the core are sent relative to their sector with an `E:` id (`online/protocol.js:206-251`), so other pilots already work past the rim. They are drawn within 3,000 units and are off the chart otherwise.
- **Tools at hand.**
  - FastNoiseLite (`lib/land/flight/fnl.js`, with its own `docs/stack/` page).
  - GPU value noise with derivatives (`lib/three/noiseGlsl.js`, `noiseNodes.js`).
  - The worker pool (`runtime/workers.js`) and `chunkGrid.js`.
  - The `gpuWork` upload queue.
  - The quality steps (`lowerQuality`, `pace.js`).

## The design

### A. One space

**One address for everywhere.**
- A place's address is its sector `(sx, sz)` plus a position inside it.
- The hand-made core is sector `0,0`, as the infinite-worlds design decided.
- Ids keep the generator's form, read in either case:
  - `e:sx,sz:i` for a system
  - `e:sx,sz:i:j` for a planet
  - `e:sx,sz:i:j:k` for a moon
  - `e:sx,sz:w<n>` for a wonder, gargantuan or point of interest

  The planet flight already reads the planet form.

**State in doubles, drawing camera-relative, every frame (my call).**
- The ship, the camera target and every place keep absolute positions as JavaScript numbers. These are doubles, which hold millimetres beyond 10^12 units.
- What is handed to three.js is always relative to the camera. `drawn()`'s trick is made unconditional and the Expanse's root goes under the same root.
- This replaces the plan in `2026-10-07-infinite-worlds-design.md` to rebase the universe with `rt.origin`. Rebasing means every system in a 6,000-line scene must re-anchor in the same frame; camera-relative drawing needs none of that.
- `rt.origin` stays for the worlds that use it.
- A shader that needs a world position gets it camera-relative. The test pins that a body at 10^9 units draws within a pixel of where it should.

**A disc, not a slab, and not a cube (my call).**
- The universe is shaped like a galaxy: a disc. Sectors stay two-dimensional `(sx, sz)`, as the generator, the online protocol, the planet flight's ids and the map already are.
- The generated content's thickness grows from today's y ±500 to about ±4,000, with density falling off with height.
- The core keeps its own ceilings (±100 in the home system, ±1,400 in deep space; `ship.js`, `deep.js`). They are the owner's earlier choice, and they keep the portfolio's places in one plane.
- In generated space there is no ceiling: you can fly up out of the disc, where it thins to the odd rogue body and then to open sky.
- Gargantuans may stand far taller than the disc.
- The online protocol's height clamp (`readPose`, ±1,300) widens to match.

**Generated everywhere, the core included.**
- The generator covers sector `0,0` as well. Inside the core it keeps out of a radius round each hand-made place:
  - the home system: 8,000 (my call; the portfolio's stations stay clear and readable)
  - each fandom planet and wonder: 3 × its reach
  - the Rick and Morty pocket: as today
- The `MAP_RADIUS + 4,000` keep-out and the wake/sleep rim go.
- Generated content inside the core is lighter (my call): systems, fields and derelicts, but no gargantuans within 20,000 of home.

**Built round the ship, off the main thread, a little a frame.**
- `chunkGrid.js` asks for the 3 × 3 sectors round the ship, nearest and ahead first.
- `makeSector` runs in the worker pool, never on the main thread.
- The starfield's 40 synchronous calls become requests to the pool.
- Uploads go through `gpuWork`.
- Systems are built in levels of detail by distance:

| Distance | What's drawn |
|---|---|
| Within the system's own reach | Everything: the star and its light, planets on their orbits, moons, rings, belts, stations, traffic |
| Within the far plane | The star as a lit sphere, planets as impostors |
| In the 3 × 3 | A speck in the star's colour, with its true brightness falloff |
| Beyond the 3 × 3 | The density starfield already drawn sectors out |

- A change of level fades, never pops. The far plane may grow if the depth test says it can (logarithmic depth is a lane 2 decision, measured).
- How many systems are fully built at once is per tier (section H).

**Orbits move.**
- A generated planet's position is a pure function of its seed and the shared clock, `orbitAt(planet, t)`, so every pilot sees it in the same place.
- Moons and rings are drawn.
- Generated bodies join the solids, so you can't fly through them.

### B. Populated

**Density targets.** The targets in "What done looks like" are measured in a pure test over 1,000 seeded sample points across 25 sectors. The generator is tuned until they hold. As a first estimate (my call):
- about 50 to 90 systems a sector, with the 6,000 minimum gap kept
- points of interest between systems, so the space between stars isn't empty:
  - derelicts
  - asteroid fields
  - comets
  - beacons
  - nebula pockets
  - rogue planets
  - a fleet at anchor

**Places with life.** Each system's `traffic`, `faction` and `hazard`, already generated, now drive what's there:
- **Traffic** (`traffic.js`) spawns round the ship from the nearest system's density and faction, not only near hand-made places.
- **The director's events** (`director.js`) gain generated zones, so a convoy, a meteor stream, a leviathan or an eclipse can happen out there.
- **Hunters and the law** read the system's faction.
- **Far fights** (`farFights.js`) are placed in generated sectors too.
- **Stations.** About one system in three has a station (my call). You can park at a station, it has its own traffic in and out, and docking opens the existing hangar and shop. There is no new economy.

### C. Gargantuans and the first minute

**Gargantuans** are a new class of place, at most one a sector and at least one in every 3 × 3 (my call). Each is 20 to 200 times a planet's size and visible from across a sector. The kinds, a first list for the lane to choose from and add to:
- a black hole with an accretion disc and lensing
- a ringworld or megastructure arc
- a colossal derelict hulk
- a gas supergiant with a storm you can see from far off
- a star wrapped in a Dyson swarm
- a migration of space leviathans (`leviathans.js` exists)

How they behave:
- Like nebulae, a gargantuan never rides the camera. It is a world-space object with its true angular size at every distance, an impostor far off, a mesh near.
- Each has a name, a card and a parking spot.
- The Maw keeps its place, size, pull and its "beyond" link (my call). The arrival gargantuan below is a new one.

**The first minute.**
- **A new visitor with a ship** (`startAt` with no saved position) gets an arrival:
  - parked on the day side of one of three or four chosen fandom worlds, near enough that it fills a good part of the frame
  - the core's own gargantuan, placed by hand, behind it
  - generated traffic crossing between
  - one line naming where they are
- `startAt`'s other starts stay for the arrival's fallback.
- **A returning pilot** resumes where they left off (section G). The map's Home takes them back to the core.
- **`/universe/<id>`** behaves as today.

### D. Nebulae and the sky

**The rule:** only what is truly at infinity rides the camera. That means the stars, the galactic band and the far galaxies.

- **The sky.** The universe's sky drops its resolved nebula clouds: `sky.js` gets an option that bakes without them, or leaves at most a faint haze under a pinned brightness. The galaxy's sky is unchanged (`/galaxy` is not in scope).
- **Every nebula is a world-space object:**
  - the Veil
  - the Cradle
  - the Expanse's generated nebulae
  - the new nebula pockets from section B
- **One nebula renderer** replaces the landmark impostors for nebulae, the 512 px Points and the spinning puffs. It has three levels, all fixed in the world:
  - **Far:** a cheap volume shell that shows the cloud's shape along the view ray. It has its true angular size, no 14° floor, and depth-tested.
  - **Near:** a raymarched volume at a resolution and step count set by the tier.
  - **Inside:** fog and lit wisps round the ship, the cloud's colour on the scene, and the ship's lights scattering.
- The lane picks the techniques. What's fixed is the behaviour: world-anchored, rolls with the stars, grows as you approach, and you can fly in.
- The landmark rule for **non-nebula** landmarks keeps its handover, but loses the screen-aligned quad: an impostor's up is the world's, not the camera's.

### E. Generated planets: unique, seen from orbit, landed on, walked

**One description a planet.**
- `planetSpecOf('e:sx,sz:i:j')` (`lib/land/flight/planetSpec.js`) already turns a generated planet into biomes, palette, clutter, ground, water, fog and landmarks from its type. It is the one description, used by the orbit view, the landing and the ground alike.
- It grows the per-planet variety that makes each one its own:
  - **Palette:** generated within the type's family. Each planet has a guaranteed hue and lightness distance from its siblings in the same system.
  - **Terrain character:** continents, archipelago, canyons, mesas, dunes, craters, ridges or plateaus, with its water level and mountain height.
  - **Sky:** colour, haze and clouds; its rings and moons in the sky.
  - **Weather:** none, rain, snow, dust, ash or spores.
  - **Flora:** density, form family (`lib/land/flora.js`) and colours from the palette.
  - **Fauna:** density and body plans (`lifeTables.js`).
  - **Points of interest:** ruins, a crashed ship, an outpost, a monolith or a signal (`landmarkTables.js`, the CC0 kits).
  - **Rarities:** about one in twenty is exotic (my call): crystal, glowing, floating islands or the like.
- `TERRAIN_VERSION` bumps as its rule says.

**Round planets, flown as a plane (my call).** The planet flight's own design says "a planet is an infinite plane, not a sphere": `planetField(spec)` is a function of an unbounded `(x, z)`. Orbit-matches-ground needs a finite sphere. This design gives every generated planet a round ground and lets the flight keep its plane:

- **The ground is a field on the sphere.** A generated planet's climate, biomes and heights are a function of a direction on its unit sphere: 3D noise of the direction (FastNoiseLite's 3D noise), never of a flat `(x, z)`. So the ground has no seam, and it wraps.
- **The flight's plane is a chart round the landing spot.**
  - The flight still works in metres on an unbounded `(x, z)`.
  - A point `(x, z)` maps to the sphere by the exponential map from the landing spot: walk `hypot(x, z)` metres along the great circle in that direction.
  - Close to the spot the chart is near enough flat. Fly far enough and you come round the planet to where you started.
  - The quadtree, the worker and the leaf meshes keep their shape; only the sample function changes.
- **Size.** A generated planet's ground radius in metres is set per planet from its universe radius, about 15 to 60 km (my call; the lane tunes it).
  - The climate field's wavelength is set against that circumference, so the 256-pixel orbit map shows several biomes.
  - Circling a planet is a long but real flight.
- **The 50 roster planets keep their plane ground exactly as it is.** These are the galaxy's, Rick and Morty's, the fandoms' and the 13 seeded Expanse planets.
  - No `TERRAIN_VERSION` bump touches them, and no stored turret moves (rule 8).
  - The 13 seeded Expanse planets' orbit map is baked from a window of their plane round the flight's origin. The mismatch at their edges is accepted.

**The shared world (my call).**
- Building (turrets, structures through Supabase) stays on the 50 seeded planets only.
- On every other generated planet, building is off and nothing is written. There is no migration and nothing for the owner to apply.
- The new points of interest never apply to the 13 seeded Expanse planets: their POIs and no-build zones stay exactly as they are, so no new outpost lands on a player's turret.

**Moons land too (my call).**
- The generator gives each moon a type (rocky or icy) and a seed, pure and cheap.
- `planetSpecOf` and the flight's id handling accept `e:sx,sz:i:j:k`.
- A moon lands by the same path as a planet.
- Gas giants stay unlandable.

**Orbit matches ground (my call).**
- A worker bakes a small equirectangular map, 256 × 128 (512 × 256 on `high` and up), from the planet's own climate field and biomes. It is the field the planet flight uses.
- The universe's planet shader (`galaxy/bodies.js`'s `buildBody`) wears it, with the planet's clouds and atmosphere from the same description.
- The on-foot biome lookup (`landings/biomes.js`'s model, the pixel under the spot) reads the same map.
- The map is never stored; it is made when wanted and cached in memory.

**Landing.** For a rocky generated planet:
1. **Approach.** Fly into its air the way you fly into a fandom planet's (`entry.js`'s rule).
2. **Entry.** A two-to-three-second atmospheric entry plays in the universe: heat on the hull, then cloud in the planet's palette filling the frame.
3. **Hand-off.** Behind the cloud, the route changes to `/fly/e:sx,sz:i:j`, carrying the spot you dove at.
4. **Arrival.** The planet flight starts low over that spot with the ship descending.
5. **Touchdown and walking.** You land on ground flat enough to take you, then step out on foot. Walking on the flight's streamed ground is new. The lane reuses the universe's walker, camera and HUD (`footScene.js`'s parts), not a new one, with the height from the flight's field.
6. **Take-off.** Back in the ship, take off and climb past the flight's ceiling (or press Take off). The route returns to `/universe/e:sx,sz:i:j`, parked in orbit of that planet, facing it.

What doesn't land:
- Gas giants: their cloud tops turn you back with a line saying why.
- Fandom planets keep their own landing: their world page, as today.
- Pocket universes (`?seed=`) need not land (my call); it is only done if the planet id can carry the seed for free.

**The planet flight becomes a kept part (my call).** Its removable-island design stays honoured in form: the remover script learns the new links, so dropping it whole remains one move. But the universe now leans on it for landing, so dropping it would take landing away.

### F. The map and travel

**One projection, pure** (a new module beside `nav.js`), used by `NavMap.jsx` and `MiniMap.jsx` alike:
- centred on a focus, the ship by default
- a radial scale that keeps near detail and far places on one chart (the 0.375-power family, re-centred)
- continuous zoom by scroll, pinch and the keys
- pan by dragging, with a button to re-centre on the ship

**Levels by zoom:**

| Level | What's shown |
|---|---|
| System | The star, planets, moons, stations, belts, traffic |
| Neighbourhood | The 3 × 3: systems, points of interest, gargantuans, nebulae, fights, other pilots |
| Universe | The core's places, sector outlines, every system the pilot has visited or seen named, the gargantuans, Home |

Labels thin out by priority so the chart never turns to mush.

**Generated places are destinations.**
- `nav.js` gains a resolver: an `e:` id resolves to a destination by running the pure generator. Nothing is stored.
- `GOALS`, `parkFor`, `legOf`, `distanceTo`, `findDestinations` and the autopilot accept it.
- Search covers:
  - the hand-made places
  - the visited and named places
  - the places in the neighbourhood now in view
- Trip times for long trips come from a formula, not the 150 s simulation.
- The jump goes to anything on the map, as today. Its recharge and its interdiction stay.

**Always honest.**
- The ship's marker is on the chart wherever you are.
- Other pilots are drawn at their sector positions.
- Nothing on the map is a place you can't go to.
- The no-3D `MiniMap.jsx` uses the projection and data above. It shows the wonders and the moons, and drops the orbit rings that match nothing.
- `navmap-check.mjs` picks its wonder by name from `__universeDebug.wonders`, as `HANDOFF-universe.md` says.
- The phone layout (390 × 844) is looked at in a browser.

### G. Saves

Seeds and deltas only, as the owner's rules say. What is generated is never stored.

| What | Key | Where |
|---|---|---|
| Where you are | `tp-universe-where`: sector, position, heading, the place you were at | `rt.saves` |
| What you've visited or seen named | ids only, capped at a few thousand, oldest dropped | `rt.store` table `universe-known` |

Both are new; nothing existing changes shape.

### H. Budgets and performance

**One tier table.** A pure `universe/budget.js` with its test, read from `lib/device`'s tier. It sets:
- systems fully built
- impostor and speck counts
- nebula resolution and steps
- traffic groups
- gargantuan detail
- the size of the planet maps
- how many sectors' starfield are drawn

The quality steps (`lowerQuality`) lower these further.

**The ten baseline poses** (`lab/universe/baseline/`):
- They keep the owner's rule: draw calls and triangles no higher than today's at each, measured before and after.
- Population arrives through instancing, merged far layers and impostors, not one mesh a thing.

**New poses** get their own recorded numbers, which become the baseline for later work:
- in a generated system
- inside a nebula
- at a gargantuan
- at the rim's old line
- on a generated planet's ground

**Frame time:**
- At `?quality=mid` and on the `low` tier it is no worse than today at the baseline poses (`scripts/perf-probe.mjs`).
- Crossing a sector boundary costs no frame over the runtime's budget (`frameGuard`).

**Download:** `WORLD_MB['/universe']` is updated if it grows. It shouldn't by much: everything new is generated.

## Goals, non-goals, anti-goals

**Goals:** the nine items under "What done looks like".

**Not in this design:**
- The Star Wars galaxy (`/galaxy`) and its sky.
- The fandom planets' own landing and pages.
- Any hand-made world.
- Sharing named worlds with other browsers (infinite worlds' phase 6).
- A server.
- Naming planets.
- A new economy.
- New NPC conversations.
- Battles and the fleet war past the core: they stay where they are.

**Failures even if it technically works:**
- A visible edge, a seam, an empty band, or a wall of pop-in.
- Anything far off that rides the camera or stays upright when the ship rolls.
- A generated planet that reads as a recoloured copy of its neighbour, or a ground that doesn't match the planet seen from orbit.
- Landing somewhere other than the spot you dove at, or on a flat featureless plane.
- A map that loses your ship, or shows a place travel can't reach.
- The hand-made core buried under generated clutter, so the portfolio's stations stop reading as the site's.
- Phones dropping to a slideshow or crashing.
- Any existing key, save, route, hook or test broken, or a test loosened to pass.

## Constraints

- **HANDOFF-universe's owner's rules, all of them:**
  - pure first, tests before drawing
  - a before shot on `main` before any picture changes
  - one pull request a lane, CI green, merge commits, never a force-push
  - `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build` before done
- **Libraries are welcome** (the owner said so), and each one gets its page under `docs/stack/` before it is first imported. No runtime call to any service.
- **`scene.js` doesn't grow (my call).**
  - New behaviour goes in new modules under the repo's 800-line guide.
  - `scene.js` gets wiring only.
  - A lane that adds wiring moves at least as many lines out of it. The section table in this session's survey (setup 477-749, travel 1744-1882, `fly()` 4254-4538, on foot 4539-4825, `render()` 4993-5321, dev hooks 5725-5881) says where.
- **One art.** The universe's `look.js` holds; a nebula or gargantuan shader is the universe's own.
- **British spelling** in the site's words. The glossary (`universe/words.js`) has a word for each new thing before it appears on screen.

## Lanes

Six lanes, each one pull request from one session (a lane too big for one PR splits into numbered PRs inside its lane). Three waves.

| Lane | What | Owns | Depends on | Wave |
|---|---|---|---|---|
| 1 | **Nebulae and the sky** (section D) | `galaxy/sky.js`'s new option, `landmarks.js`, a new `universe/nebula/`, the nebula parts of `deepspace.js` and `expanse/scene/sectors.js` | none | 1 |
| 2 | **One space** (section A): the address, camera-relative drawing always, generation over the core with keep-outs, the rim gone, worker generation, levels of detail, moving orbits, moons, rings, solids | `expanse/gen/*`, `expanse/scene/*`, `drawn()`, `runtime/` additions | none | 1 |
| 5a | **Unique planets, pure half** (section E): `planetSpecOf`'s variety, the field on the sphere and the chart for non-roster planets, moons' type and seed, the orbit-map bake in a worker, the sibling-distance test and a contact sheet | `lib/land/flight/*`, a new bake module | none | 1 |
| 6a | **The map, first half** (section F): the projection, zoom, pan, levels, the ship marker always, MiniMap unified, `navmap-check` fixed, phone layout | `nav.js`'s projection, a new projection module, `NavMap.jsx`, `MiniMap.jsx`, `navmap.css` | none | 1 |
| 3 | **Places you can go**: `e:` destinations in `nav.js`, picking, labels and cards for generated places, park, jump and autopilot to them, stations you can dock at | `nav.js` resolver, `ship.js` goals, the scene's picking and travel wiring | 2 | 2 |
| 4 | **Populated** (sections B, C, G): density tuning and points of interest, traffic, director, hunters and far fights in generated space, gargantuans, the arrival, the saved position, the known-places table | `traffic.js`, `director.js`, `hunters.js`, `farFights.js`, a new `gargantuans/`, `ship.js`'s `startAt`, saves | 2, 3 | 2 |
| 5b | **Landing and walking** (section E): the orbit shader wearing the baked map, the entry, the hand-off to `/fly`, on foot on the streamed ground, take-off back to orbit | `galaxy/bodies.js` option, `entry.js`, the flight's module and a walker on its ground, `lib/view.js`'s return path | 3, 5a | 3 |
| 6b | **The map, second half**: generated places, visited and named, search, long-trip times, other pilots everywhere | `NavMap.jsx`, `nav.js` | 3, 6a | 3 |

**Running it.** Wave 1 is four sessions started together. Wave 2 starts when lane 2 merges. Wave 3 when lane 3 merges.

**Shared files.** Lanes 2, 3 and 4 all wire into `scene.js`. Each touches only its own section, and they merge in the order 2, 3, 4. A lane that needs another's unmerged work says so in its PR and waits; it doesn't copy the work.

## Testing

**Pure tests first, in Node, for:**
- the address and id parsing
- `orbitAt`
- the keep-outs (no generated system inside any hand-made place's keep-out)
- the density targets
- the sibling-distance and variety tests for planets
- the projection and its zoom levels
- the `e:` resolver
- the budget table
- the nebula impostor's placement: its world position doesn't depend on the camera's, and its angular size is 2·atan(r / d)

**One new browser check**, `scripts/universe-endless-check.mjs`, waiting on conditions, not times. It flies a fixed seeded route that:
1. starts at the arrival
2. crosses the old rim
3. crosses a sector boundary
4. enters a generated system
5. flies into a nebula
6. reaches a gargantuan
7. lands on a generated planet
8. returns

and it records along the way:
- pop-ins: anything that appears over 4 px in one frame
- the frame time on the tier
- the places in view and the time to the next one
- the nebula's parallax between two poses 5,000 apart, and its roll against the stars
- the map's ship marker present at every step
- console errors (none allowed)

**The repo's own checks:**
- `scripts/universe-check.mjs` against the baseline
- `scripts/perf-probe.mjs`
- `autopilot-check.mjs --only smoke` on `/universe` and `/fly`
- `landing-check.mjs`
- `navmap-check.mjs`, fixed

**A contact sheet**, from lane 5a's script: 24 random generated planets, each from orbit and on the ground, for the owner to judge "unique" by eye.

## Calls made in this design, for the owner to check

1. Absolute positions in doubles with camera-relative drawing, instead of the earlier plan's `rt.origin` rebasing.
2. The generator fills the core too, kept 8,000 off home and three reaches off every hand-made place.
3. The density numbers: three places within 9,000, the nearest within 6,000, about 50 to 90 systems a sector.
4. Gargantuans at most one a sector and at least one in every 3 × 3, none within 20,000 of home; a new hand-placed one for the arrival, the Maw left as it is.
5. One system in three has a station; docking opens the existing hangar and shop.
6. Landing hands off to the planet flight behind an entry cloud, rather than a seamless descent in one scene. That makes the planet flight a part the universe relies on.
7. Orbit and ground share one baked map per planet, made in a worker and never stored.
8. Returning pilots resume where they were.
9. `scene.js` doesn't grow; new work lives in new modules.
10. Pocket universes need not land.
11. The universe is a disc. Generated space is about ±4,000 thick and thins with height, with no ceiling out there. The core keeps its ceilings.
12. Generated planets are round: their ground is a field on the sphere, and the flight flies a chart round the landing spot. Ground radius is about 15 to 60 km. The 50 roster planets keep their plane ground untouched.
13. Building stays on the 50 seeded planets only. New points of interest never touch the 13 seeded Expanse planets.
14. Moons get a type and a seed, and can be landed on.
