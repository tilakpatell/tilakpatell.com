# Hand-off: the fandom worlds

The universe’s walkable worlds other than Star Wars: Middle-earth’s chapters, kitchens and hidden places; Avengers HQ; Dunder Mifflin Scranton; Cybertron; Albuquerque; Dimension C-137 with its dial of destinations, the Citadel and the Rick and Morty sector of the map; Invincible’s city; Minecraft as a tribute and as the real game behind a password; the kit and the natural-world libraries every world may draw from; and the look engine that Coruscant, Yavin 4 and Bespin were made whole on. Each world is a folder under `src/components/<world>/`, with pure rules under test, a scene that draws them and a page or world module that drives them. This page says what landed, what is open and the rules the owner set. The code is right where it and this page differ.

## The designs

- Albuquerque: `docs/superpowers/specs/2026-10-04-albuquerque-games-design.md`.
- Avengers HQ: `docs/superpowers/specs/2026-10-04-avengers-hq-games-design.md`; the swinging is engineered from the sources in `docs/research/2026-10-05-web-swinging.md`.
- C-137 and the multiverse: `docs/superpowers/specs/2026-10-05-c137-world-design.md`, `docs/superpowers/specs/2026-10-06-rick-and-morty-multiverse-design.md` (its “model standard” governs every figure), `docs/superpowers/specs/2026-10-08-rm-worlds-design.md` (the sector’s planets on the galaxy’s planet engine); `docs/research/2026-10-06-meshy-community-rick-and-morty.md`.
- Cybertron: `docs/superpowers/specs/2026-10-05-cybertron-world-design.md`.
- Invincible: `docs/superpowers/specs/2026-10-05-invincible-world-design.md` and `docs/superpowers/specs/2026-10-07-invincible-world-2-design.md`.
- Middle-earth: the chapters’ specs `docs/superpowers/specs/2026-10-04-shire-world-design.md` through `docs/superpowers/specs/2026-10-05-mount-doom-design.md`; the kitchens `docs/superpowers/specs/2026-10-05-pony-rush-design.md`; the hidden places `docs/superpowers/specs/2026-10-05-orthanc-design.md`, `docs/superpowers/specs/2026-10-06-minas-tirith-design.md`, `docs/superpowers/specs/2026-10-06-edoras-design.md`; the map hub `docs/superpowers/specs/2026-10-09-middle-earth-landing-design.md`.
- Minecraft: `docs/superpowers/specs/2026-10-07-minecraft-world-design.md`.
- The kit and the natural worlds: `docs/superpowers/specs/2026-10-08-kit-worlds-design.md`, `docs/superpowers/specs/2026-10-08-natural-worlds-design.md`; the research they quote, `docs/research/2026-10-08-folio-2025-assets-foliage-and-quaternius-packs.md`, `docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md`, `docs/research/2026-10-08-site-planets-generation-rigging-today.md`.
- Coruscant, Yavin 4 and Bespin: `docs/superpowers/specs/2026-10-07-three-worlds-design.md`.
- Decisions: `docs/decisions/2026-10-08-fingers-on-the-meshy-skeleton.md` (one skeleton for every Meshy figure, which is why the shared clips retarget to each of them).
- The Office world has no spec: its floor is the page’s researched plan, `src/components/office/layout.js`, extended to be walked.

## Landed

### Albuquerque

`/albuquerque` is a city on a street grid, not roads in the sand. `src/components/albuquerque/world/`: `rules.js` (the grid, blocks a kerb above the street, every place moved onto a block, colliders in a spatial hash, traffic with lights on Central and stop signs elsewhere, Hank driven by the sim, the car’s sliding model), `plan.js` (zones, lots and buildings as pure data), `roads.js`, `city.js` (every building one instance of a shell geometry, its facade drawn in the fragment shader), `vehicles.js` (six code-built cars). The minimap is north-up round the car. Dev hook: `window.__ABQ__` (`api.settle()`, `api.peek()`).

### Avengers HQ

`src/components/avengers/world/`: swinging, zipping, wall-running and roofs in `rules.js`, tested, with a bot that plays the whole swing tour; the swing tour with best time and ghost lap; twelve backpacks (`packs.js`); settings on O; air tricks on T; the Iron Man armour’s hover flight; photo mode on P; the grounds (`grounds.js`); the web and marks (`swing.js`); the HUD and controls in `CompoundWorld.jsx`. Other players see him swing through `src/components/middleearth/towns/travellers.js`. Dev hook: `window.__HQWORLD__` (`sim.speedup`, `api.skipIntro()`).

### Dunder Mifflin Scranton

`/scranton` opens on the walkable office, the old page kept underneath. `src/components/office/world/`: `layout.js` (metres from the plan, doorways, walls, seats, job spots, the warehouse, the lot, the amblers’ walks), `story.js` (eight jobs from reception to the Dundies), the set, the warehouse (`warehouse.js`), the lot (`outside.js`), per-pixel parallax windows, a ceiling grid, desks dressed from seeds, static things merged by material (`batch.js`), contact shade, A* paths for coworkers who get up (`paths.js`), footsteps by floor. Accuracy was checked against photos of the set (blinds, the desktop screens, nameplates, the phones, the break room). Culling and a following shadow box roughly halved draws and triangles. Shots: `scripts/office-shots.mjs`; dev hook `window.__OFFICE__`.

### Cybertron

`src/components/cybertron/game/`: `rules.js`, `areas/` (Iacon, Team Prime’s base, Jasper, Kaon), `sim.js` (a run through every mission under test), `stage/`, `GameWorld.jsx`. Twelve missions with achievements, a side to pick, the Matrix of Leadership with Shockwave as a boss, Megatron’s tank cycle and every Decepticon’s change on one table (`FORMS`, clips in `catalog.js`), Metroplex waking on the skyline, Barricade ramming, the autorig for robots that came without a skeleton, hp that mends, a fuzz test over every area (`fuzz.test.js`). The planet at war is `src/components/cybertron/skin.js` and `war.js`, maps from `scripts/build-cybertron-planet.mjs`; the models come through `scripts/sketchfab-cybertron.mjs`. Dev hook: `window.__CY__` (`go(area)`, `sim`).

### Dimension C-137, the dial and the Citadel

`src/components/rickmorty/world/`: the street (x ±150, z ±55) with outskirts, hedge and barriers, jumping and the stoop, Rick’s garage at the show’s size, the school’s class, Dr. Wong’s office and the family’s friends in `interiors/`, Total Rickall, the street’s vehicles. The portal gun on the bench dials `dimensions/`: the destinations as data (`place.js`, `rows1.js` to `rows3.js`, `destinations.js`), one lazy area per row on `stage.js`, from Customs to Mr. Frundles’ Earth: timed escapes, collect-then-escape, hunts, the Vindicators’ rooms, Evil Rick’s duel (`duel.js`), and NPCs that wander, watch, bark and hunt on `npc.js` over `src/lib/ai/steer.js`. Shared clips beyond idle, walk and run retarget to every figure (`src/components/rickmorty/portal/meshyCast.js`). The Pickle Rick sewer run is `sewer/`. The Citadel, Mortytown and the Locos are `src/components/rickmorty/citadel/`; the NX-5 is `src/components/universe/remover.js`. Models: rigged figures in `public/games/meshy/`, props and crowds in `public/models/c137/rm/`, made through `scripts/meshy-rm-local.mjs` with task ids kept in `scripts/meshy-tasks.json` so a step is never paid twice; `dimensions/models.test.js` fails on any missing file. Shots: `scripts/c137-shots.mjs`, `scripts/citadel-shots.mjs`; dev hook `window.__C137__`.

### The Rick and Morty sector

The map’s Rick and Morty worlds sit in a sector of their own at `[0, 0, −40000]`, reached through a green portal (`src/components/universe/layout.js` `SECTORS`, `portals.js`, `sectorPortals.js`, `nav.js` routing through the portal, `sides.js`, the Central Finite Curve in `curve.js`, the standing fleets in `sectorFleet.js`). Ten worlds on their own spiral, landed on through `src/components/universe/landings/rmmoons.js`, set pieces as models, grounds in `rmWorldsGlsl.js`; past 3000 out the scene draws round the camera. A world’s ground portal opens `/c-137/<id>` (`src/pages/RmPlanet.jsx`, `src/components/rickmorty/world/planetMode.js`). The planets on the galaxy’s engine: Gazorpazorp bare and the planets’ kit (`src/components/rickmorty/planets/`, `src/lib/three/dye.js`). Check: `scripts/sector-check.mjs`, `scripts/landing-check.mjs`.

### Invincible

`/invincible` opens on a flyable 40 km city: `src/components/invincible/world/` with `map.js`, `flight.js`, `orbit.js` (space, the Moon and Mars), `quests.js`, `traffic.js`, `brains.js` (the crowd), `companions.js` (Eve and Dad), `foes.js` and `villains.js` (Flaxans, the Maulers, Doc Seismic), `missions.js` (seven episodes and the radio’s side calls), `getaway.js`, and the HUD’s layout rules drawn by `InvHud.jsx`. The cast is made from the show’s art and moves on motion-captured clips (`scripts/meshy-invincible.mjs`, `src/lib/three/rig.js`); `people.js` gives the HD figure where one can be posed. Sweep and metrics: `scripts/inv-world-check.mjs --metrics` (band and mark per shot, targets band 0.30–0.65 by day and mark ≥ 0.18). The universe map’s Invincible planet has offline maps now (`scripts/build-invincible-planet.mjs`, `src/components/universe/planets.js`). Dev hook: `window.__INVWORLD__`.

### Middle-earth

Ten kitchens, one per chapter, played online (`src/components/middleearth/rush/`: `rules.js`, `protocol.js`, `online.js`, `themes/`, `levels/`); ghost travellers in the towns (`src/components/middleearth/towns/travellers.js`, `ghosts.js`, `useTravellers.js`); a side game in every chapter (`towns/side.js`); three hidden places found by clicking the map, Orthanc, Minas Tirith and Edoras (`src/components/middleearth/hidden.js`, `towns/orthanc/`, `towns/minastirith/`, `towns/edoras/`); the road so far on the hub (`record.js`, `MapHub.jsx`). The landing was remade as a desk, a candle and a sheet (`src/components/middleearth/hub/`); its lane kept numbers (calls, triangles, UI share, the night’s pool) at a baseline of 254 calls and 206,318 triangles on desktop and one row after the room’s task.

### Minecraft

The tribute, `#/dot-matrix/minecraft`, `src/components/minecraft/`: an endless seeded world in the game’s own tiles, dig and build, crafting and the save, light and the day, caves, ores, fluids, the furnace, chest, hunger and death. The rules never import three.js; they run in the worker and in vitest. Check: `scripts/mc-check.mjs`; atlas: `scripts/mc-atlas.mjs`. The real game is `src/components/eagler/`: files sealed with the password (`crypt.js`, `scripts/eagler-pack.mjs`, `public/eagler/manifest.json`), two clients (1.12.2 and 1.8.8, `clients.js`), the game in a frame on an origin of its own (`public/eagler-player/index.html`, published by `scripts/eagler-player-publish.mjs`), a shared world for each version in `public/eagler/worlds/`, and `scripts/eagler-check.mjs` proving the wall. Republish the player whenever `public/eagler-player/`, `crypt.js` or `load.js` changes.

### The kit and the natural worlds

The Quaternius packs as one kit: `scripts/kit/`, `public/kit/`, `src/lib/three/kit.js` (loader, keyed instanced pools with three LOD bands, a puff at the far band), `src/lib/three/weather.js`, budgets’ `near`, `mid` and `leaves` columns in `src/lib/budgets.js`, `scripts/kit-check.mjs`, `scripts/pack-check.mjs`. Land as data in `src/lib/land/` (layers shared with the galaxy, rivers, cells, flora per cell), Rapier as data in `src/lib/physics/`, and the look in pieces in `src/lib/three/` (`landmap.js`, `land.js`, `river.js`, `tracks.js`, `puffs.js`, `leaves.js`, `windLines.js`, `view.js`, `grass.js`). The Expanse they were built for was removed by the owner; the libraries stay for whoever streams a land next.

### Coruscant, Yavin 4 and Bespin

The house look on every galaxy world (`src/lib/three/house.js`, each world’s look in `src/components/galaxy/surface/look.js`, the fog from `skyfog.js`, exposure through `src/components/universe/post.js`), and the three sites in `src/components/galaxy/surface/sites/` (`coruscant.js`, `yavin.js`, `bespin.js`). Gates for a surface change: `scripts/galaxy-check.mjs surface` against a baseline from main, never over 600 draw calls or 2.5 M triangles, no page error.

## Left

### Albuquerque

- A visual pass on the city: residential streets, the strip’s set-back car parks, downtown from above, night (lit windows, sign glow, lamp pools), dawn and noon, the RV out west, Walt’s spawn. Likely tuning: facade contrast, sign placement for `PLACES`, tree density, lamp pools. Done: screenshots of each that read right, no console errors.
- A frame-rate pass at `?quality=mid` (about 1 M triangles before shadows on low: trees, cars, props). Fewer trees and props when the stage is coarse, canopies at detail 0, vigas not casting. Done: fewer calls and triangles with the same picture, numbers in the entry. The autopilot backlog has the same item for Avengers HQ and C-137’s street.
- The universe map’s Invincible planet was merged without a browser run: open `/universe/invincible` and tune glow, dust, the debris belt against the halo and the moon’s orbit. Done: one object, not a pile of effects.

### Avengers HQ

- Ring 3 of the swing tour, under the bridge, is reachable (the bot gets it) but fussy by hand (`TOUR` in `rules.js`). Move or widen it so a visitor gets it in a few tries; keep the bot’s test green.
- Frame rate on `medium` on a real phone; it cannot be measured headless.
- Thor, Natasha and the Hulk stand still: a walk, or the Hulk fought or raced.
- The armour has no weapons: repulsors at Ultron drones over the trees would tie it to Repulsor Range.
- Photo mode has no filters or poses.

### Dunder Mifflin Scranton

- The people’s faces and clothes (the cast’s GLBs) and the break room’s layout are the weakest; its vending machines cannot be reached because the plan’s three tables box them in.
- Signs could share one atlas (each is a draw); more amblers, or ones who talk to each other; a real get-up and sit-down instead of the swap.
- Nothing to do outside yet: a job in the lot (Michael’s car, a fun run, the truck). Warehouse people (Roy, Lonny, Madge) need models. Pretzel Day, the Diversity Day cards, Prison Mike, Creed’s mung beans.
- Pick `WORLD_MB['/scranton']` from a measured load.

### Cybertron

- Online players in the world (`useTravellers`, as Avengers HQ does); out of the spec’s scope, still open.
- Prime’s Optimus stands with his upper arms out: a per-model `stand` pose in `catalog.js`.
- Iacon could take more detail: pipes between the towers, a few huge rings, the deck’s trenches.

### C-137, the multiverse and the sector

- Fold `scripts/meshy-rm-local.mjs` into `scripts/meshy.mjs` (port `stiffenAnkles` and `greenShin`), then delete the runner. Done: one pipeline, every task id still honoured.
- The map’s Birdperson and Phoenixperson are still code-built (`src/components/universe/trafficModels.js`); the Meshy figures need a flying pose.
- The dial’s sounds are `src/components/games/gameAudio.js`’s synthesised ones; no samples yet.
- The NX-5 is not carried online: other pilots do not see yours. `remover.js` keeps damage per pilot, ready for a protocol action.
- Small misses kept: the Zigerion crowd copy has two arms; Morty Jr.’s hands are pale; Poncho has no helmet; Kyle reads like a Rick; the wedding guests block the way after they run, because `rules.js` counts a place’s crowd as always there.
- The sector’s worlds: ground cover still code-built (rocks, bones, cat trees, feathers, bolts in `landings/rmmoons.js`); the moons are not on the mini-map; no crew lines for arriving; `scripts/landing-check.mjs`’s 120 s wait for the crew is too short in software GL.
- The planets on the engine: only Gazorpazorp has a site (`PLANET_SITES`). Left: one phase per planet for `squanch`, `birdworld`, `gearworld`, `pluto`, `snakeplanet`, `purge`, `cronenberg`, each with its land, places, people, a ride, quests and a mission, and the close (README, architecture, the `gen3d` and `voices` issues). Done per planet: every place found on foot, every quest finished in the browser, the ride ridden, the mission won and lost with stars in `tp-rm-missions`.
- What the engine lacked, with a proposal each: the scene says who talks but not where (write the speaker’s screen spot to a `talkAt` ref); `SurfaceView`’s touch buttons are the galaxy’s (a `buttons` list); a `fly` ride with `hover: 0` sinks to the bed under deep water (take `max(ground, water)` as its floor); one seat a ride, so the skiff’s mate walks (`seats` on a ride); the Cronenbergs are not rigged (a `gen3d` issue).

### Invincible

- Eve’s ghost on the line at her best time, and Allen flying the race home: the gates are drawn, nobody races.
- The Flaxans’ portal closes as the second wave goes down, before episode 5’s last step; it should stay open until he flies through it.
- The bank model’s own lettering reads GDA.
- No interiors (the Graysons’ house, the GDA’s floor, Burger Mart’s counter would follow the C-137 and Office patterns). (Online ghosts are wired: `useTravellers('invincible')`, drawn by `scene.js`’s `createGhosts`.)
- Phone frame rate on hardware. Levers: a distance cull on the suburb’s instanced trees and houses, the land disc’s ring step, traffic counts. `maulers`, `seismic`, `everace` and `photo` sit over the 1.5 M triangle budget on low.
- Mark’s `mark` metric misses in the air over towers (a mean-luminance measure; a colour-difference measure would judge it better). Left as is: low-poly yard trees, the HDRI’s clouds above 7 km, the jet’s livery unseen up close.

### Middle-earth

- Shots of every walkable world now the side games are in, then dress what looks bare.
- The landing lane’s rows stop at the room’s task; later tasks’ numbers were not recorded. If picked up: desktop 1440 × 900 and phone 390 × 844, calls, triangles, UI share and the night’s pool, the sheet’s middle at 0.12 or over.

### Minecraft

- The tribute is frozen at Phase 4 by the owner. If resumed: Phase 5, mobs, has its rules written and tested on the `claude/minecraft-phase-5` branch but no drawing; never merge the rules without the drawing, or the monsters hunt unseen. Phase 6, biomes and builds (per-place tints need the biome in the vertex). Phase 7, polish.
- Eaglercraft: the 1.21.11 beta, only ever in the walled-off player; the owner fetches it, it is inspected as text, its `worldsDB` patch checked, sealed beside the other two, greyed out where `WebAssembly.Suspending` is missing. More shared worlds, sealed beside The Plaza. A live shared server (EaglerXServer on Velocity in front of Paper, through a tunnel), only with the owner’s say.

### The kit and the natural worlds

- Kit Phase 4, planets as data (lazy maps, screen-size LOD, a far sprite under 5 px); Phase 5, crowds baked into vertex-animation textures and the farm kit’s creatures; Phase 6, each world taking the kit, with before and after shots. Done per phase is in the kit spec.
- Phase 3’s world half went with the Expanse; its probe gate is in the history if another journey wants it.

### Coruscant, Yavin 4 and Bespin

- The hand-off’s later pull requests (the models, the people, the allegiance plan’s, the war on the ground) are not confirmed done here; the galaxy’s own hand-off is the record.
- Each world beyond the three has the default look made from its sky, and grass worlds read paler: tune in `?debug` and paste the `look`, `exposure` and `grass` blocks into the site. The ground’s bounce tints legs strongly on bright grass.

## The owner’s rules

- Albuquerque: the show’s character figures and its branded signage stay as they are; nothing new recreates known characters or the shows’ marks. Every new building, car, sign and prop is original, and the shop names are invented.
- The Invincible planet stays original: no characters, logos or suits. The Invincible cast is made from the show’s own art on the wiki, but the studio’s pictures are never committed; only the models ship.
- Avengers HQ: Spider-Man, Thor, Natasha, the Hulk and the armour are other people’s credited Sketchfab models. The site only poses and moves them and adds no Marvel artwork of its own.
- Cybertron: models from the era, the Aligned continuity, High Moon’s two games and Transformers: Prime; search first, generate only if none can be found; credit every Sketchfab model.
- Rick and Morty: never a figure or a prop drawn in code where a model can stand (Meshy, Sketchfab, or the owner’s own); space scenery in code is fine. NPCs do things, not just stand and talk. Coach Feratu is never shown in the show, so he is not drawn; Gwendolyn is left out on purpose. The people’s lines are the site’s own words. The main map’s feel is kept: the fandoms’ positions do not move. The planets on the engine do not change the galaxy or C-137, their site files are data with no three.js, they add no models and call no asset service, and they write only `tp-rm-found`, `tp-rm-quests` and `tp-rm-missions`.
- Minecraft: the textures and the game are used with Mojang’s permission, and the owner wants no credit lines on the site; the clients’ built-in credits screens stay as they ship. The real game runs only in the walled-off player. No anonymous binary is downloaded by the assistant; the owner fetches it. A live server runs on the owner’s machine, so ask first. The tribute stays behind “Walk the tribute”.
- Middle-earth: other players are ghosts from another dimension, visible, no interaction; everything online goes over Nostr relays with no backend. The hidden places are found by clicking the map, never listed until found.
- The Office: the site page is kept alongside the world; both stay.
- The kit: the packs are data and nothing in them runs; only `public/kit/` GLBs and their manifests ship, each saying `CC0-1.0` and its source. The house look is the one material. Pools, never a mesh per thing. Authored landmarks are never replaced; the kit fills. His numbers are the start, not the law: change one only when a test or a screenshot says to.
- The natural worlds: one dependency, Rapier, imported only by `src/lib/physics/world.js`; the galaxy does not change.
- Standing rules of the code these worlds share: pure rules first, no three.js in rules or site data; nothing a visitor can do is lost and no test is loosened; new kinds, states and events go on the end of their lists where a wire or a save indexes them (the kitchens’ `KINDS`, Minecraft’s `BLOCKS`); no model names in code, docs or commits.
