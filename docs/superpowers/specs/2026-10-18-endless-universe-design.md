# The endless universe: one seamless space, full of places, nebulae that stay put, planets you land on, a map that follows. The design

Date: 2026-10-18. Status: design, written from the owner's brief by an architecting session, for implementation sessions working in parallel lanes. The plan will be `docs/superpowers/plans/2026-10-18-endless-universe.md`; the hand-off is `docs/superpowers/HANDOFF-universe.md`, whose owner's rules apply to every lane.

## What the owner asked

> "Fix the universe to make it more populated and better. Also look into the nebulas as when you move around the nebulas move as well (which is wrong). Make it better and work on the infinite worlds (which we were doing before) but make it so for the universe so it's like No Man's Sky and we can continue exploring or have chunks. Fix the map as well."

From the conversation that followed:

- **The first minute:** "Something gargantuan or make it really cool or we spawn next to one of the worlds and make it unique."
- **New places, land or look:** "I think both is good (if you can make the worlds unique and stuff with the infinite world generation and other libraries)."
- **The bar:** "As long as the map is dynamic and we can go to places in the universe and everything works and seems populated then I don't care."
- **On the first draft:** "I don't like how it's like a ceiling or whatever. Also it needs more than just planets but events and like things in space too etc." So space has no ceiling or floor anywhere, and sections B and C are a catalogue of things and events, not only planets.

The rest of this document is the architect's reading of those words against the code. Everything marked **(my call)** was decided here, not by the owner, and can be overruled.

## What done looks like

Each of these is checked, by a test or in a browser, before the lane that owns it is done.

1. **No end, no edge, no ceiling.** From anywhere you can fly in any direction, up and down included, for as long as you like.
   - No ceiling, floor or turn-back anywhere, the hand-made core included.
   - No rim, no empty band, no wall of things popping in.
   - No seam between the hand-made core and the generated space.
2. **It seems populated, in every direction** (numbers are my call, pinned by a test so a lane can tune them):
   - From any point in 3D, at least three things are within 9,000 units. That is 30 seconds on the pulse drive.
   - The nearest named thing is never more than 6,000 units away.
   - Something moves within 20 seconds of flying anywhere: traffic, a fight, wildlife or an event.
3. **More than planets.**
   - At least 20 kinds of thing in space (section B's catalogue).
   - At least 15 kinds of event (section C's), the director's existing ones included.
   - In 10 minutes of free flight anywhere, a pilot meets at least three different events.
   - Each thing and each event can be forced by a dev hook, so the check can see every one.
4. **Every place you see, you can go to.** It has a name, you can pick it, the map lists it, and travel takes you there. You can't fly through a solid body.
5. **Nebulae stay put.**
   - Fly 5,000 units sideways and a nebula shifts on screen by the parallax its distance gives.
   - Roll the ship and it rolls with the stars.
   - Fly towards it and it grows; fly into it and you are in its fog.
   - The same holds for every far object: gargantuans, wonders and generated nebulae.
6. **Generated planets are unique, and you can land on them.**
   - Fly down to any rocky generated planet, land, step out, walk around, get back in and take off.
   - Taking off leaves you in orbit of that same planet.
   - Two neighbouring planets never look alike.
   - What you see from orbit matches what you walk on.
7. **The map is dynamic.**
   - It is centred on your ship, wherever you are.
   - It zooms from a single system out to everything you know.
   - It shows generated places and travels to any of them.
   - The no-3D mini-map uses the same projection and the same data.
8. **The first minute is a "wow".** A new visitor with a ship spawns beside one of the site's worlds, with something gargantuan in view and traffic moving through.
9. **Nothing is lost.** Every route, key, save, sound, achievement, dev hook and test that works today works afterwards (HANDOFF-universe's owner's rules).
10. **Phones still fly.** The `low` and `mid` tiers hold their frame rate, with less built, not a broken scene.

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
- **Ceilings.** The ship is turned back at ±100 in the home system and ±1,400 in deep space (`ship.js`, `deep.js`'s `ceilingAt`). The generator keeps systems within y ±500. The online protocol clamps other pilots' heights to ±1,300 (`readPose`).
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

**One address for everywhere, in three dimensions (my call).**
- Space is fully 3D, with no ceiling, floor or disc. A place's address is its sector `(sx, sy, sz)` plus a position inside it.
- Sectors are cubes 120,000 units on a side: today's horizontal size. The hand-made core is in sector `0,0,0`.
- Ids keep the generator's form, read in either case. Today's form `e:sx,sz:…` means `sy = 0`, and it stays valid for good: the planet flight's ids, the 13 seeded planets' ids and the online `E:` poses all keep working. A sector above or below the middle layer writes its height third, `e:sx,sz,sy:…`.
  - `e:sx,sz:i` for a system
  - `e:sx,sz:i:j` for a planet
  - `e:sx,sz:i:j:k` for a moon
  - `e:sx,sz:w<n>` for a wonder, gargantuan or thing in space
- **Generation is additive.**
  - For the middle layer, everything `makeSector` gives today keeps its index, type and seed: every system, planet and wonder. An id that resolves today resolves to the same thing afterwards.
  - New content is appended after it, at new indices.
  - A test pins a fingerprint of today's output for 25 sectors, the 13 seeded planets' sectors among them.
- A sector's content may be generated in sub-cells on demand rather than all at once. That is the lane's choice, as long as the result is the same whichever order the cells are asked for.

**No ceilings anywhere.**
- `ship.js`'s and `deep.js`'s ceilings and floors stop turning the ship back, in the home system and the core as well. Where code uses `ceilingAt` to place things (`clearToStart`, the director, the camera), it stays as a placement guide only.
- The hand-made places stay where they are, in their plane. Generated space fills above and below the core too, kept off by the keep-outs, which are spheres.
- The online protocol's height clamp (`readPose`, ±1,300) goes. A pose carries `sy` and a height relative to its sector, as it carries x and z.

**State in doubles, drawing camera-relative, every frame (my call).**
- The ship, the camera target and every place keep absolute positions as JavaScript numbers. These are doubles, which hold millimetres beyond 10^12 units.
- What is handed to three.js is always relative to the camera. `drawn()`'s trick is made unconditional and the Expanse's root goes under the same root.
- This replaces the plan in `2026-10-07-infinite-worlds-design.md` to rebase the universe with `rt.origin`. Rebasing means every system in a 6,000-line scene must re-anchor in the same frame; camera-relative drawing needs none of that.
- `rt.origin` stays for the worlds that use it.
- A shader that needs a world position gets it camera-relative. The test pins that a body at 10^9 units draws within a pixel of where it should.

**Generated everywhere, the core included.**
- The generator covers sector `0,0,0` as well. Inside the core it keeps out of a sphere round each hand-made place:
  - the home system: 8,000 (my call; the portfolio's stations stay clear and readable)
  - each fandom planet and wonder: 3 × its reach
  - the Rick and Morty pocket: as today
- The `MAP_RADIUS + 4,000` keep-out and the wake/sleep rim go.
- Generated content inside the core is lighter (my call): systems, fields, derelicts and the smaller things, but no gargantuan within 20,000 of home except the arrival's (section C).

**Built round the ship, off the main thread, a little a frame.**
- The chunk grid asks for the 3 × 3 × 3 sectors round the ship, nearest and ahead first. `chunkGrid.js` gains a third axis, or a 3D twin beside it.
- `makeSector` runs in the worker pool, never on the main thread.
- The starfield's 40 synchronous calls become requests to the pool.
- Uploads go through `gpuWork`.
- Systems and things are built in levels of detail by distance:

| Distance | What's drawn |
|---|---|
| Within a system's own reach | Everything: the star and its light, planets on their orbits, moons, rings, belts, stations, traffic |
| Within the far plane | The star as a lit sphere, planets and things as impostors |
| In the 3 × 3 × 3 | A speck in the star's colour, with its true brightness falloff; gargantuans as impostors |
| Beyond | The density starfield, drawn sectors out in every direction |

- A change of level fades, never pops. The far plane may grow if the depth test says it can (logarithmic depth is a lane 2 decision, measured).
- How much is fully built at once is per tier (section H).

**Orbits move.**
- A generated planet's position is a pure function of its seed and the shared clock, `orbitAt(planet, t)`, so every pilot sees it in the same place. Comets and drifting things work the same way.
- Moons and rings are drawn.
- Generated bodies join the solids, so you can't fly through them.

### B. Things in space

Space is full of more than planets.
- Every kind below is generated from the sector's seed, original in design (the owner's rule: new props, nothing copied), and drawn instanced or as impostors in numbers.
- Every one has a name, a card and a parking spot, and shows on the map.
- Some have an action. Each action uses what the site already has:
  - credits through the universe's existing earning (`useEarn`, `economy.js`)
  - standing through `tp:universe-standing`
  - fights through the guns, hunters and law
  - docking through the hangar and shop

There is no new economy.

**The catalogue: at least 20 kinds** (my list; the lane may swap a kind for a better one but keeps the count).

| # | Kind | Action |
|---|---|---|
| 1 | Star systems of every class: red dwarf, yellow, blue giant, white dwarf, neutron star, binary and trinary | Park |
| 2 | Rogue planets, alone between stars | Land, if rocky |
| 3 | Comets on long orbits, tails pointing from their star | Fly the tail |
| 4 | Asteroid and ice-shard fields | Shoot a rock for ore, sold for credits |
| 5 | Nebula pockets (section D) | Fly in |
| 6 | Pulsars and magnetars, beams sweeping | A beam hit scrambles the HUD |
| 7 | Supernova remnants: glowing shells | Fly through |
| 8 | Forming stars in dust discs | Park |
| 9 | Ion storms: moving volumes | Drains shields while inside |
| 10 | Wormholes | Enter: thrown to a far sector, one way; the map marks where you came from |
| 11 | Stations and trade posts | Dock: hangar and shop |
| 12 | Abandoned stations and outposts | Salvage |
| 13 | Derelict ships and wrecks | Salvage; sometimes a trap (an event) |
| 14 | Debris fields of old battles | Salvage |
| 15 | Freighters, capital ships and fleets at anchor, with their faction | Hail; a hostile one fights |
| 16 | Mining rigs on asteroids, with their traffic | Park |
| 17 | Beacons and distress signals | Follow: leads to an event |
| 18 | Satellites and relay arrays | Scan |
| 19 | Ancient monoliths and relics | Scan: a line of lore and credits, once each |
| 20 | Shipyards mid-build: scaffolds, cranes, hulls | Park |
| 21 | Space leviathans and their herds (`leviathans.js` exists) | Watch |
| 22 | Drifting swarms and glowing jellyfish in nebulae | Watch |
| 23 | Gargantuans (section C) | Park |

**Density targets.** The targets in "What done looks like" are measured in a pure test over 1,000 seeded sample points across 27 sectors in 3D. The generator is tuned until they hold.
- As a first estimate (my call): a few hundred systems and over a thousand smaller things a sector, with the systems' 6,000 minimum gap kept.
- Things cluster round systems, but never so tightly that the space between is empty.

**Places with life.** Each system's `traffic`, `faction` and `hazard`, already generated, drive who is there:
- **Traffic** (`traffic.js`) spawns round the ship from the nearest system's density and faction, not only near hand-made places. It flies between stations, rigs, shipyards and fleets.
- **Hunters and the law** read the system's faction.
- **Far fights** (`farFights.js`) are placed in generated sectors too, in every direction.
- **Stations.** About one system in three has one (my call).

### C. Events, gargantuans and the first minute

**Events: at least 15 kinds, everywhere.**
- The director (`director.js`) gains generated zones (which system or thing an event can happen at), so every event can happen anywhere, not only in the core.
- The existing events all work out there:
  - the flare
  - the meteor stream
  - leviathans
  - the minefield
  - the escort
  - the eclipse
  - the rift
  - the convoy (given a column of its own, as `HANDOFF-universe.md` asks)
  - bounties
  - far fights
- New ones (my list; the lane may swap any for a better one but keeps the count):

| # | Event | What happens |
|---|---|---|
| 1 | Pirate ambush | Pulled out of a jump into a fight |
| 2 | Distress call | A stranded ship to reach and defend; a reward |
| 3 | A battle you can join | Two factions fighting; pick a side; standing moves |
| 4 | A derelict wakes | It powers up and turns its guns on you |
| 5 | A wormhole opens | It stays open for a minute; dive in or not |
| 6 | Comet fly-by | A close pass with a shower of ice |
| 7 | Ion storm front | It sweeps across your path |
| 8 | Supernova | Rare: seen from afar, its shell spreading over minutes |
| 9 | A trader hails you | The existing merchant NPC, wired to a station's shop |
| 10 | Leviathan migration | A herd crossing, gargantuan-sized |
| 11 | Tidal pull | Near a black hole, debris and ships dragged in |
| 12 | Treasure signal | A beacon that leads to a cache |
| 13 | Smuggler chase | The law after a runner; help either side |

**Event pacing:**
- In 10 minutes of free flight a pilot meets at least three different events.
- Two big events never land on top of each other.
- The arrival's first minute gets a gentle one (traffic, a trader), never an ambush.
- Every event can be forced with `__universeDebug.happen(kind)`, as today's can.

**Gargantuans** are a new class of place: at most one a sector, and at least one in every 3 × 3 × 3 (my call), so one is always somewhere in view. Each is 20 to 200 times a planet's size and visible from across a sector. The kinds, a first list for the lane to choose from and add to:
- a black hole with an accretion disc and lensing
- a ringworld or megastructure arc
- a colossal derelict hulk
- a gas supergiant with a storm you can see from far off
- a star wrapped in a Dyson swarm
- a migration of space leviathans

How they behave:
- Like nebulae, a gargantuan never rides the camera. It is a world-space object with its true angular size at every distance, an impostor far off, a mesh near.
- Each has a name, a card and a parking spot.
- The Maw keeps its place, size, pull and its "beyond" link (my call). The arrival gargantuan below is a new one.

**The first minute.**
- **A new visitor with a ship** (`startAt` with no saved position) gets an arrival:
  - parked on the day side of one of three or four chosen fandom worlds, near enough that it fills a good part of the frame
  - a gargantuan placed by hand behind it, far enough out (beyond 20,000) to sit on the sky, big enough to own it
  - generated traffic crossing between
  - a gentle event
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
6. **Take-off.** Back in the ship, take off and climb out of the planet's air (or press Take off). The route returns to `/universe/e:sx,sz:i:j`, parked in orbit of that planet, facing it.

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
- **3D, not flat.** The chart looks down by default, and every mark stands on a stem showing how far above or below the ship it is. Dragging with a modifier (or two fingers) tilts and turns the chart into a 3D view; one button puts it back.
- The ship's height and the sector `(sx, sy, sz)` are always on the chart.

**Levels by zoom:**

| Level | What's shown |
|---|---|
| System | The star, planets, moons, stations, belts, traffic |
| Neighbourhood | The 3 × 3 × 3: systems, things in space, gargantuans, nebulae, fights, events in progress, other pilots |
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
- The ship's marker is on the chart wherever you are, at any height.
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
- things in space drawn, by kind
- events at once
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
- 50,000 units straight above the core
- in an asteroid field, and at a station with its traffic
- on a generated planet's ground

**Frame time:**
- At `?quality=mid` and on the `low` tier it is no worse than today at the baseline poses (`scripts/perf-probe.mjs`).
- Crossing a sector boundary costs no frame over the runtime's budget (`frameGuard`).

**Download:** `WORLD_MB['/universe']` is updated if it grows. It shouldn't by much: everything new is generated.

## Goals, non-goals, anti-goals

**Goals:** the ten items under "What done looks like".

**Not in this design:**
- The Star Wars galaxy (`/galaxy`) and its sky.
- The fandom planets' own landing and pages.
- Any hand-made world.
- Sharing named worlds with other browsers (infinite worlds' phase 6).
- A server.
- Naming planets.
- A new economy.
- New NPC conversations.
- The fleet war (`tp-gcw`) past the core: it stays where it is. The generated battles of section C are events, not the war.

**Failures even if it technically works:**
- A visible edge, a seam, an empty band, or a wall of pop-in.
- Any ceiling, floor or invisible wall that turns the ship back.
- Space that is only planets: no things to find between them, no events.
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

Ten lanes, each one pull request from one session (a lane too big for one PR splits into numbered PRs inside its lane). Three waves.

| Lane | What | Owns | Depends on | Wave |
|---|---|---|---|---|
| 1 | **Nebulae and the sky** (section D) | `galaxy/sky.js`'s new option, `landmarks.js`, a new `universe/nebula/`, the nebula parts of `deepspace.js` and `expanse/scene/sectors.js` | none | 1 |
| 2 | **One space** (section A): the 3D address and ids, additive generation and its fingerprint test, no ceilings, camera-relative drawing always, generation over the core with keep-outs, the rim gone, worker generation, the 3 × 3 × 3 grid, levels of detail, moving orbits, moons, rings, solids, the online height clamp | `expanse/gen/*`, `expanse/scene/*`, `chunkGrid.js`'s third axis, `drawn()`, the ceilings in `ship.js` and `deep.js`, `online/protocol.js`'s pose | none | 1 |
| 5a | **Unique planets, pure half** (section E): `planetSpecOf`'s variety, the field on the sphere and the chart for non-roster planets, moons' type and seed, the orbit-map bake in a worker, the sibling-distance test and a contact sheet | `lib/land/flight/*`, a new bake module | none | 1 |
| 6a | **The map, first half** (section F): the projection in 3D with stems and tilt, zoom, pan, levels, the ship marker always, MiniMap unified, `navmap-check` fixed, phone layout | a new projection module, `NavMap.jsx`, `MiniMap.jsx`, `navmap.css` | none | 1 |
| 3 | **Places you can go**: `e:` destinations in `nav.js`, picking, labels and cards for generated places and things, park, jump and autopilot to them, docking at stations | `nav.js` resolver, `ship.js` goals, the scene's picking and travel wiring | 2 | 2 |
| 4a | **Things in space and gargantuans** (section B's catalogue, section C's gargantuans): the generator's kinds and density, their drawing, their actions, the gargantuans | the generator's tables, a new `universe/things/` and `universe/gargantuans/` | 2, 3 | 2 |
| 4b | **Events and life** (section B's life, section C's events): the director's generated zones, the existing events everywhere, the 13 new ones, pacing, traffic, hunters, law and far fights in generated space | `director.js` and its event files, `traffic.js`, `hunters.js`, `farFights.js`, a new `universe/events/` | 2, 3 | 2 |
| 4c | **The first minute and saves** (section C's arrival, section G): the arrival gargantuan's place, the arrival, the saved position, the known-places table | `ship.js`'s `startAt`, saves | 4a | 3 |
| 5b | **Landing and walking** (section E): the orbit shader wearing the baked map, the entry, the hand-off to `/fly`, on foot on the streamed ground, take-off back to orbit | `galaxy/bodies.js` option, `entry.js`, the flight's module and a walker on its ground, `lib/view.js`'s return path | 3, 5a | 3 |
| 6b | **The map, second half**: generated places and things, events in progress, visited and named, search, long-trip times, other pilots everywhere | `NavMap.jsx`, `nav.js` | 3, 6a | 3 |

**Running it.**
- Wave 1 is four sessions started together: 1, 2, 5a, 6a.
- Wave 2 starts when lane 2 merges: 3 first, then 4a and 4b together once 3's resolver is in.
- Wave 3 starts when lane 3 merges: 5b and 6b, then 4c after 4a.

**Shared files.** Lanes 2, 3, 4a, 4b and 4c all wire into `scene.js`. Each touches only its own section, and they merge in the order 2, 3, 4a, 4b, 4c. A lane that needs another's unmerged work says so in its PR and waits; it doesn't copy the work.

## Testing

**Pure tests first, in Node, for:**
- the address and id parsing
- `orbitAt`
- the keep-outs (no generated system inside any hand-made place's keep-out)
- the density targets, in 3D
- the fingerprint of today's generator output (additive generation)
- no ceiling: a pure flight of 100,000 units straight up from home is never turned back
- the catalogue: every kind of thing appears within a set number of sectors
- the director's pacing: over 10 simulated minutes from 100 seeded starts, at least three different events each time, never two big ones together
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
7. climbs 50,000 units straight up
8. lands on a generated planet
9. returns

Then it forces every kind of thing and every event once with the dev hooks and shoots each one.


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
3. The density numbers: three things within 9,000, the nearest within 6,000, in 3D; a few hundred systems and over a thousand smaller things a sector.
4. Gargantuans: at most one a sector and at least one in every 3 × 3 × 3, none within 20,000 of home except the arrival's; a new hand-placed one for the arrival; the Maw left as it is.
5. One system in three has a station; docking opens the existing hangar and shop.
6. Landing hands off to the planet flight behind an entry cloud, rather than a seamless descent in one scene. That makes the planet flight a part the universe relies on.
7. Orbit and ground share one baked map per planet, made in a worker and never stored.
8. Returning pilots resume where they were.
9. `scene.js` doesn't grow; new work lives in new modules.
10. Pocket universes need not land.
11. Space is fully 3D. Sectors are 120,000 cubes, and today's ids mean the middle layer. There is no ceiling anywhere, the core included, and generation is additive so every existing id still resolves.
12. Generated planets are round: their ground is a field on the sphere, and the flight flies a chart round the landing spot. Ground radius is about 15 to 60 km. The 50 roster planets keep their plane ground untouched.
13. Building stays on the 50 seeded planets only. New points of interest never touch the 13 seeded Expanse planets.
14. Moons get a type and a seed, and can be landed on.
15. The catalogue of 23 kinds of thing and 13 new events is my list. A lane may swap an entry for a better one but keeps the counts (at least 20 and 15).
16. Actions on things (salvage, ore, scans) pay through the existing earning, with no new economy.
