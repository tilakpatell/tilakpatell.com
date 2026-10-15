# The Rick and Morty worlds, made immense: eight planets with things to do. The design

Date: 2026-10-08. Status: design, written from the owner's brief by an architecting session, for Opus 5.5 implementation sessions (one phase per pull request, each merged to `main` before the next starts). The plan is `docs/superpowers/plans/2026-10-08-rm-worlds.md`; the hand-off is `docs/superpowers/HANDOFF-worlds.md`.

## What the owner asked

"Take 5 to 10 main Rick and Morty worlds and, instead of making the worlds really boring where you just have the characters and press E, make actual fun things to do and make the worlds immense and nice. Architect this, then give it to Opus 5.5 to implement. Make PRs and constantly merge to main."

The owner asks for no checkpoints (standing feedback: take the recommended picks and keep building), so the choices below were made for them.

## Where the site is today

Read from the code in this session.

- **The Rick and Morty places are boxes.** Every destination of the portal gun's dial and every planet of the universe map's Rick and Morty sector is a `place()` in `src/components/rickmorty/world/dimensions/rows{1,2,3}.js`: a box 50 m deep and 70 m wide at most, a painted ground, a few models stood about, hotspots you press E at, and one of three things to do (an `escape` clock, a `collect`, a `duel`). Their people have brains (`world/npc.js`: wander, watch, bark, hunt), which is the best of it. Landing on a planet from the map (`pages/RmPlanet.jsx`) puts you in the same box.
- **The Citadel is a real world** (`rickmorty/citadel/`): a 40 m concourse with five story beats, Mortytown below it, a herd, a factory line, Cop Ricks. It stays as it is.
- **The galaxy's worlds are the immense ones.** `src/components/galaxy/surface/` is a whole planet engine: 1.28 km of walkable land in layers (`terrain.js`, on `src/lib/land/layers.js`), a sky with suns and weather, water you wade or drown in, places to find on a compass, zones you go into (a cantina, a palace, their own rooms and lights), people who live there (`actors.js` on `lib/ai`: needs, bands, fear, chatter), enemies with heads (`activity.js`, `hostiles.js`: cover, flanking, searching, bursts, shields, blades), things to ride (`rides.js`, `walker.js`: speeders, bikes, creatures, a flyer), quests of nine step kinds (`quests.js`: reach, talk, collect, shoot, ride, race, use, enter, trip), and missions with stars (`missions/`: a chase, an assault for command posts, a timed quest), with online peers and the wardrobe. Rick's cruiser is already a crew there (`universe/footScene.js`'s `PARTY.cruiser`: you are Rick with the portal gun, Morty beside you with his laser), and every crew line in `surface/lines.js` has a `cruiser` entry. It is bound to Star Wars only at its edges: `siteOf(system)` looks sites up by galaxy system, models come from `catalog/` at `/models/galaxy/surface/<kind>.glb`, and `pages/GalaxySurface.jsx` wraps it in the Galactic Civil War.
- **The models are there.** The Meshy cast (`rickmorty/portal/meshyCast.js`) has the people of every planet below, most of them rigged on the shared 24-bone skeleton with idle, walk and run and the thirteen shared clips: Gazorpians, Marsha and Morty Jr, Squanchy, Birdperson and Tammy, Gromflomites, the gearpeople and Gearhead, the Plutonians, King Flippy Nips and Scroopy Noopers, the snakes and their rocket, Arthricia, the Cronenbergs. The set pieces (the women's gate, Squanchy's house, Birdperson's house and perches, the gear monument and cogs, the suckulents) are models too (`universe/landings/landings.js`'s moon entries). The clip library has thirty-six more actions on the same skeleton (`public/games/meshy/ual-*.glb`, `act-*.glb`).

## The decision

**The eight planets of the Rick and Morty sector become worlds on the galaxy's planet engine.** Not bigger boxes in C-137, and not a new engine: the engine the site already has for an immense world with things to do, pointed at Rick and Morty data and models. Each planet is one site file (data: its land, sky, places, zones, people, rides, quests) and one mission, as Tatooine or Endor are, in `src/components/rickmorty/planets/`. You land from the universe map as today (`/c-137/<id>`), the cruiser sets down, Rick and Morty climb out, and the planet is yours to walk, ride, fight and finish.

The two paths not taken:

- *Grow the boxes.* `dimensions/stage.js` could take a bigger box and a height field, but everything else (rides, enemies with heads, zones, quests, missions, peers) would have to be written again inside RmWorld's area model. Months of work to arrive where the galaxy already is.
- *The Expanse's land and Rapier.* `src/lib/land` and `src/lib/physics` (the natural-worlds work, #622, #638) give real rivers and a rigid-body car, but no people, quests or enemies yet. Its ground layers are already the galaxy's (`terrain.js` imports `LAYERS` from it), so the look carries over; the car does not, and no planet here needs one.

The planets kept as boxes: Nuptia 4 and the Immortality Field Resort (a counselling retreat and a spa: nothing to ride or fight on either). They stay in `rows2.js`/`rows3.js` and `RmPlanet.jsx` keeps opening RmWorld for them. The dial's destinations (Froopyland, the Blood Dome, Evil Rick's lair…) are not touched: they are rooms off Rick's garage and play as they do.

## The pieces

### 1. The engine's seams (`src/components/galaxy/surface/`, small changes)

Four openings, each a few lines, each tested, each leaving every galaxy world as it was (`sites.test.js`, `validity.test.js`, `travel-check.mjs` stay green).

- **A site handed in.** `scene.js`'s `create(canvas, ctx)` takes `ctx.site` (a site already made whole) in place of `siteOf(ctx.system)`, and `ctx.missionSpec` (a mission object) in place of `missionOf(ctx.system, ctx.mission)`; with neither, it looks them up as today. A mission may carry `site: { sky?, light?, fog?, weather? }`, laid over the site's while that mission runs (the Purge Planet's night, the snakes' shelling): the world is built again for a mission anyway (`SurfaceView`'s `rebuild`). `sites/index.js` exports `siteFrom(raw, id)`: the "made whole" step of `siteOf` (places' things moved, flats gathered, zones placed high, quests' zone spots resolved) factored out so another book of sites can use it. `siteOf(id)` becomes `siteFrom(SITES[id] with EXTRA, id)`.
- **A model from anywhere.** A catalogue entry may carry `url`; `modelUrlFor` and `surfaceLodUrl` honour it (`placer.js`, `actors.js`, `rides.js`'s swap). The planets' set pieces (`/models/c137/rm/*.glb`) and the Meshy props come in through their own catalogue group, `rickmorty/planets/catalog.js`, merged into the placer's `models` for a Rick and Morty site only (`ctx.models`), never into `SURFACE_MODELS`.
- **A figure from the cast.** `createActors` takes `makers: { [kind]: (i) → figure }`, consulted before the catalogue and before `figures.js`. `rickmorty/planets/cast.js`'s `rmFigure(kind)` wraps `createMeshyCast().make(kind)` in `crewFigure`'s interface (`model`, `tall`, `anim`, `update(dt, move, motion)`, `play`, `stop`, `base`, `look`, `react`, `dispose`), on the cast's own animator, so a Gazorpian walks on his feet, waves, is hit, falls and is scared with the clips the cast already has. One cast per scene, shared with the crew's two and the peers (the scene makes it once already).
- **A page without the war.** `rickmorty/planets/RmSurface.jsx` mounts `SurfaceView` with `{ site, missionSpec, ship: 'cruiser', found, done, compass, net, onEvent }` and draws the HUD from the kit (`src/runtime/hud`): the compass bar with the places, the objective, the prompt, the talk bubble, the quest list on M, the mission's own HUD (`ChaseHud`, `AssaultHud`, reused as they are), the players chip, the exit. No heroes, allegiance, ranks or GCW. `pages/RmPlanet.jsx` renders it for the eight (`planets/index.js`'s `PLANET_SITES`), RmWorld for the other two.

### 2. The planets' kit (`src/components/rickmorty/planets/`)

- `index.js`: `PLANET_SITES` (the eight, by id), `planetSite(id)` → `siteFrom(…)`, `planetMission(id)`, `isBigPlanet(id)`; tested against `destinations.js`'s `PLANETS` (every id here is one of those) and `universes.js`'s `MOONS`.
- `catalog.js`: the planets' models by kind with `url`, `tall`/`wide`, and whether rigged; a test that every file exists under `public/`.
- `cast.js`: `rmFigure`, above, and the dyes: a kind drawn in several tints (`dyed`, as the Death Star's cast does it: hue at the texel's luminance) so the purgers are Arthricia's model in five colours and the gear police are gearpeople in blue.
- `props.js`: what is built in code where there is no model, in the galaxy's prop style (`props/*.js`: `k.build([part(…)])`): the rock sled, the gear bike, the purge skiff, the bird glider (the four rides), the women's city's walls and towers, the Gear World's cog-faced buildings, Pluto's mine mouths and rally stage, the snakes' launch gantry, the purge village's huts and the lighthouse, the Cronenberged suburb's broken houses.
- `rides.js`: four rides on `walker.js`'s ride, with the galaxy's numbers as the start: `rocksled` (a hover sled, landspeeder's handling, hover 0.6), `gearbike` (the speeder bike's, with a trail), `purgeskiff` (the landspeeder's, slower, seats two), `birdglider` (the airspeeder's `fly`: Space climbs, let go and it sinks, alt 14).
- `lines.js` and `voicelines.js`: what Rick and Morty say on each planet (landing, each quest's start and end, the mission's), in the site's own words; keys in `voicelines.js` for the desktop's voices job later (`scripts/voices/README.md`).
- `planets.css`: the HUD's skin (the show's green and the Citadel's type), over the kit's parts.
- `sites/<id>.js`, one per planet, below, each with its tests beside it (`sites/<id>.test.js`: the quests' spawns stand on walkable ground (`validity.js`), every giver is in `life`, every zone's spots are inside its bounds, the mission's route is clear of solids).

### 3. The eight planets

Every planet has: land 1.28 km square (`terrain.js`'s `HALF`), with its own layers and flats; a sky; four to six places to find; one or two zones to go into; people with needs and bands; one or two rides; four to six quests; one mission with stars; one hazard of its own. Where the show has a thing, the planet has it. The numbers below are starting points: the site file is the law once a session has walked it.

**Gazorpazorp** (desert, the men's wasteland and the women's city).
- Land: red dunes along the wind, two mesas, a dry riverbed; the women's city on a flat at the north (a walled ring, its gate the model); the men's camp at the south among boulders.
- Places: the women's gate, Marsha's chamber (zone: the council hall, marble and pink light), the pit where the men fight, Morty Jr's house (zone: a small suburban house, out of place), the breeding mesa.
- People: Gazorpian men (rigged) roaming the south in bands, fighting each other when no one is about (`chases` each other within a band's reach), throwing rocks at you if you come close; Marsha and her guards at the gate; the women inside; Morty Jr wandering with his notebook.
- Ride: the rock sled.
- Quests: *A word with Marsha* (talk at the gate, enter the hall, talk); *The men's pit* (shoot 8 Gazorpians who come at the pit, in two waves); *Morty Jr's novel* (collect 5 pages blown across the dunes, bring them back); *Sled run* (ride the sled through 7 gates round the mesas in 50 s); *The breeding mesa* (reach it, use the machine, escape the swarm: reach the sled in 40 s).
- Mission: **The sled chase** (chase kind): three Gazorpian raiders on sleds making for the women's gate with a stolen sex robot; four waypoints round the mesas; stars at 25/40 s.
- Hazard: a sandstorm (the `sand` weather at twice its count, and the fog's density up with it: the men stop, you see 30 m).

**Planet Squanch** (red grass, cat trees, the wedding).
- Land: rolling hills, a lake, a wood of cat trees (scattered: the model), the wedding meadow flat at the middle.
- Places: the wedding arch, Squanchy's house (zone: three storeys of carpet and toys, climbed by its floors), the bar tent, the suckulent field, Birdperson's nest on the hill.
- People: the guests in bands (Magdalians, gearpeople, Squanchy); Birdperson and Tammy under the arch; Squanchy, drunk, with needs (the bar, the lake).
- Ride: none on the ground; the glider is Bird World's.
- Quests: *The toast* (talk Squanchy, collect 3 glasses from the bar, use the toast: the raid begins); *The raid* (shoot 10 Gromflomites in waves at the arch, 120 s); *Get Birdperson out* (reach the nest with him following, use the beacon); *Squanchy's house* (enter the zone, collect 4 toys on 3 floors); *Suckulents* (reach the field without being bitten: a timed walk round 12 suckulents, each a hostile with reach 2 and no chase).
- Mission: **The wedding** (assault kind): the guests hold three posts (the arch, the bar, the house) against the Federation's landing from the lake; tickets as Hoth's; your side is the guests.
- Hazard: the suckulents (anything within 1.5 m of one is bitten: 10 health a second).

**Bird World** (cliffs, perches, the Federation's trap).
- Land: a plateau cut by canyons, perches (the model) on the cliff tops, a river at the bottom, Birdperson's house (the model) on the highest rock.
- Places: Birdperson's house (zone: the nest's inside, Tammy's listening post hidden in it), the perch ring, the canyon floor, the feather field, the Federation's hide.
- People: bird people (the `birdperson` model in three dyes) perched and gliding (`dive` over the canyon), Tammy inside the house, Gromflomites hidden at the hide (`hidden` until the quest says).
- Ride: the bird glider (Space to climb, from any perch; the fall into the canyon is the river: `water` with `wade` off, so you swim out).
- Quests: *Peace among worlds* (talk Birdperson, reach 4 perches in turn: the glider's first lesson); *Tammy's post* (enter the house, use the listening post: the Gromflomites show); *The hide* (shoot 8 Gromflomites at the hide, 90 s); *Feathers* (collect 6 feathers on the cliff tops: only reachable by glider); *Phoenixperson* (reach the far rock, talk: a line, and the achievement).
- Mission: **The long glide** (quest kind, `race` on the glider): 9 gates down the canyon from the house to the river, 60 s; stars at 35/48.
- Hazard: the fall (a `fall` height under the plateau; the river catches you, the cliffs do not).

**Gear World** (brass, cogs, the gear police).
- Land: a flat plain of plating (the Expanse's `plating` look is the galaxy's `tiles`) with cog towers (built), the gear monument (the model) at the middle, a gear canal of oil round it.
- Places: the monument square, Revolio Clockberg Jr's workshop (zone: benches, a press, cogs on the walls), the gear police station (zone: cells), the gear-dive stand, the oil canal's bridge.
- People: gearpeople in bands with needs (the workshop, the square's benches), Gearhead at the workshop, gear police (gearpeople dyed blue) patrolling with a `path`.
- Ride: the gear bike.
- Quests: *Gearhead's debt* (talk, collect 5 cogs about the square, bring them back); *The press* (enter the workshop, use the press 3 times on a rhythm: a `use` step with a `time`); *Gear-dive* (reach the stand, use it: a 10 s fall through the city's gears, a `fall` step with `respawn`); *Breaking Gearhead out* (enter the station, use the cell, escape: reach the bike in 30 s with the police after you); *The canal* (race the bike over 8 gates round the canal, 45 s).
- Mission: **The gear police** (chase kind): four gear police on bikes racing to the monument to sound the alarm; the route round the canal and over its bridge; stars at 30/45 s.
- Hazard: the oil canal (`water` kind `lava`'s rules with an oil look: in it, you are slowed and burnt).

**Pluto** (ice, the mines, the rally).
- Land: blue ice fields, a crater ring, the mine mouths (built) in the crater wall, King Flippy Nips's palace (zone) on a rise, the rally stage (built) on the plain.
- Places: the palace, the rally, the plutonium mine (zone: a tunnel with carts and a seam that glows), Scroopy Noopers's hide in the mine, the crater's rim.
- People: Plutonians in bands at the rally, the king and his guard at the palace, Scroopy in the mine (`hidden` until the quest), miners with needs (the seam, the carts).
- Ride: the rock sled, in Plutonian blue (the same prop, an `opts.color`).
- Quests: *Pluto is a planet* (talk the king, reach the stage, use the microphone: Jerry's speech, Rick's line); *The seam* (enter the mine, collect 6 plutonium, 60 s before the tunnel's gas: a `time`); *Scroopy's case* (talk Scroopy in the mine, reach 3 collapse points, use each); *The king's gold* (shoot 6 guards at the palace once Scroopy's case is made); *Rim run* (race the sled over 8 gates round the crater's rim, 55 s).
- Mission: **The collapse** (quest kind, timed): the mine's gas is lit; collect 4 miners (reach each, they follow) and reach the mouth in 90 s; stars at 55/70.
- Hazard: thin ice over the crater's lake (a `water` of kind `salt`'s look: you go through and swim).

**Snake Planet** (the snakes' cold war).
- Land: a green world of grass and low hills, two snake cities (built: domes and tunnels) east and west, a rocket base (the snakes' rocket model on its gantry) at the north.
- Places: the east city, the west city, the rocket base (zone: the control room), the snake jazz bar (zone), the nest fields.
- People: snakes (the two props on a slither: `figures.js`'s legless kind, a sway in place of a gait) in bands at each city, snake astronauts at the base, a jazz band in the bar.
- Ride: the gear bike, as the snakes' hover sled (the gearbike prop with `opts.look: 'snake'`).
- Quests: *The jazz bar* (enter, talk the band, use the stage: the snake jazz plays); *The cold war* (reach both cities, talk each leader, bring the east's message west: the war starts); *The launch* (enter the control room, use 3 consoles in order; the rocket goes); *The nest fields* (collect 8 eggs, 60 s, with the nests' snakes spawned hostile round them: `melee`, slow, so creeping between them works); *Nuclear winter* (shoot 12 snake soldiers in the war's waves, 150 s).
- Mission: **The rocket base** (assault kind): the west snakes attack the base's three posts (the gantry, the control room, the pad); you hold with the east; tickets as Geonosis's.
- Hazard: the war's shelling in the mission (the mission's `site` override adds `embers` weather and a `shelling` thing built by `props.js` on `storm.js`'s `strikeAt`: a flash and a blast near you every few seconds).

**The Purge Planet** (the village, the night).
- Land: a coast of grey rock and sea, the village (built: huts round a square) on the shore, the lighthouse (built, with a zone: the keeper's room and the stair) on the point, a wood behind.
- Places: the village square, the lighthouse, the keeper's room, the beach where the cruiser is, the wood's hut.
- People: the villagers (Arthricia's model in five dyes) with needs (the well, the square's benches, the huts) by day; Arthricia at the lighthouse; the lighthouse keeper inside.
- Ride: the purge skiff (Arthricia's).
- Quests: *The lighthouse* (talk the keeper, use the lamp: he tells his screenplay, you have to listen through 3 lines); *Arthricia's ask* (talk, collect 4 parts for the skiff about the village); *The first purge* (shoot 10 purgers who come at the lighthouse, 120 s); *The suits* (reach the cruiser, use the crate: the purge suits; from here your shots are the heavy gun); *Burn it down* (reach the village's 4 huts, use each: they burn).
- Mission: **The purge night** (quest kind, timed waves): hold the square against 4 waves of purgers, 30 s apart, with the skiff to get between them; stars at 25 health left / 60.
- Hazard: night itself (the mission's `site` override, below, is a night sky; the purgers' lanterns are the only lights).

**Cronenberg World** (C-137's suburb, ruined).
- Land: the Smiths' street, as C-137's rules place it (`world/rules.js`'s `HOUSE`, `SCHOOL`, `NEIGHBOURS`, `OUTSKIRTS` read for their footprints, drawn as broken houses by `props.js`), round a flat at the middle of a dead plain; the wood of dead trees; the pit where the Cronenberged bodies were buried.
- Places: the Smith house (zone: the kitchen and the living room, Cronenberged), the school, the garage, the pit, the far road.
- People: Cronenbergs (the rigged model, with `blob` and `bigcronenberg`) in hordes that wander by day and hunt by night; Rick C-137's own grave by the garage (a thing, not a person); the two Ricks and Mortys who stayed, as corpses at the pit.
- Ride: the rock sled, grey (`opts.color`).
- Quests: *Home* (reach the house, enter, use the kitchen's tv: the family's last tape); *The garage* (reach, use the portal gun's charger: the lights come on; the horde comes); *The horde* (shoot 15 Cronenbergs at the house, 150 s); *The pit* (reach the pit, use the shovel: the graves; a line); *The far road* (race the sled over 6 gates along the road, 40 s, through the horde).
- Mission: **The night of the Cronenbergs** (quest kind, timed waves): hold the garage against 5 waves, the big ones in the last two; stars at 60/90 s under the time.
- Hazard: the horde's bite (a Cronenberg within reach is `melee`: 12 health a swipe).

### 4. How you get there and back

- **In:** the universe map's landing on a moon (`landings/rmmoons.js`: the portal on the ground, G to go in) navigates to `/c-137/<id>` as today; `RmPlanet.jsx` opens `RmSurface` for a big planet. The scene's own landing phase plays (the cruiser comes down and sets down at `site.land`, the two climb out), as the galaxy's does.
- **Out:** E at the cruiser takes off (`takeOff`); the page's `leave` event navigates to `/universe/<id>` with `replace`, as `RmPlanet.jsx` does today for the portal. The back button of the exit does the same.
- **Saves:** `tp-rm-found` (places found, by planet), `tp-rm-quests` (quests done, by planet), `tp-rm-missions` (the mission's best time and stars, by planet). C-137's `done` list (`tp-rm-done`) is untouched: a planet's old box tasks are retired from `PLANET_TASKS` for the eight (`world/rules.js`), and the eight's rows in `rows*.js` are left in place for the data the map's `MOONS` test holds, marked `big: true` so `RmWorld` never opens them.
- **Achievements:** one per planet's mission won, one for all eight (`Achievements.jsx`'s list, in the site's words).
- **Online:** `net` as the galaxy's: the others on the same planet are drawn by `peers.js`; nothing new.

### 5. How it holds a frame

The planet engine already holds its frame on every tier (`amounts.js` by `lib/device`'s tier, `lib/three/pace`'s steps, `near.js`'s shadow phase, instanced scatter, `animBudget`). The planets keep inside its budgets: scattered kinds under 4,000 instances a site, life under 40 figures a site (24 rigged at most at `high`, 14 at `mid`, 8 at `low`, as the Death Star's table), zones under 300 parts, one storm at a time. `scripts/perf-probe.mjs` gets a `rmPlanet` probe (the Purge Planet's night mission: the most on screen); the worst frame under 24 ms at `high` on the owner's Mac, under 34 at `mid`.

## Decisions (for the owner to overturn)

1. **You are Rick.** The cruiser's party is Rick with Morty beside him, as it is in the galaxy; the dial's worlds stay Morty's. Rick has the portal gun's bolts and Morty the laser; the wardrobe's looks apply to both.
2. **Eight, not ten.** Nuptia 4 and the Resort stay boxes.
3. **The site model is the law.** No new step kinds, no new ride physics, no new mission kinds. What a planet wants that the engine lacks is written as the nearest thing the engine has, and the lack goes in the hand-off's "Left" with a one-line proposal.
4. **No new models in this pass.** Every kind is a model the repo has, a dye of one, or a code-built prop. What would be better as a model (the purgers' own faces, the gear police, a snake soldier rigged to slither) is listed in the hand-off as `gen3d` issues for the desktop.
5. **Voices later.** The lines go in with keys; the recordings are a `voices` issue once the lines are on `main`.
6. **One PR per planet**, after the two engine PRs; the order below.

## What this is not

- Not a change to the galaxy's worlds: every site, quest and mission there plays as it did; `GalaxySurface.jsx` is not touched.
- Not a change to C-137's street, rooms, dial or the Citadel.
- Not the Expanse's physics: no Rapier, no `src/lib/physics`.
- Not multiplayer missions: a mission is yours alone, as the galaxy's are.

## Phases and dependencies

| Phase | What | Blocked by |
|---|---|---|
| 0 | The engine's seams and `RmSurface` with a bare Gazorpazorp (land, sky, the crew, take-off) | nothing |
| 1 | The planets' kit: catalogue, cast, props, rides, HUD skin, the guide page, the probe | 0 |
| 2–9 | One planet each: Gazorpazorp, Squanch, Bird World, Gear World, Pluto, Snake Planet, the Purge Planet, Cronenberg World | 1; any order, in parallel |
| 10 | The close: README's row, `docs/architecture.md`, achievements, the `gen3d` and `voices` issues, the hand-off's "Left" | 2–9 |

## Testing

- Rules, Node, test first: `siteFrom` on a galaxy site equals `siteOf`; a catalogue `url` wins; a `makers` figure is used before the catalogue; each site passes `validity.js`'s spawn checks; each mission's route is clear (`planRoute` with the site's solids); every model file in `catalog.js` exists; every quest's giver is in `life`; every zone's spots are in its bounds; `PLANET_SITES`' ids are `PLANETS`' and `MOONS`'.
- In the browser (headless Chromium, the autopilot's smoke, then `scripts/.cache/rm-planet-check.mjs` on the world-runtime hand-off's pattern): land, walk to the first place, take the first quest, mount the ride, start the mission, take off; no console error; a screenshot per planet in the PR.
- Gates: `npx eslint .`, `npx vitest run`, `npx vite build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /c-137/<id>`.

## Open assumptions, marked

- `walker.js`'s `fly` ride climbs while Space is held and sinks at half the climb when it is not: enough for a glider. If it feels like a lift, Phase 3 (Bird World) adds `glide` (forward speed from height lost) to `rides.js` and says so in the PR.
- `figures.js` has no legless kind; Phase 7 (Snake Planet) adds `slither` to it (a sway and a bob, no legs) if nothing there serves. One new figure kind, tested as the others.
- The Death Star's `dyed` lives in `deathstar/inside/scene/dye.js`; Phase 1 lifts it to `src/lib/three/dye.js` (tested) and the Death Star imports it from there, unchanged in effect.
