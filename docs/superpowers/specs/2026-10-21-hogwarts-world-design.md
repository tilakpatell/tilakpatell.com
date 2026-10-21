# Hogwarts: the Harry Potter world. The design

Date: 2026-10-21. Lane: a new fandom on the universe map (`potter`), a new world folder (`src/components/hogwarts/`), a planet, a landing and the shell’s wiring. Plan: `docs/superpowers/plans/2026-10-21-hogwarts.md`. Hand-off: `docs/superpowers/HANDOFF-worlds.md` (a Hogwarts section is added by the first lane that lands). The owner’s standing rules apply (`.claude/skills/autopilot/SKILL.md` step 5, `docs/health/RULES.md`).

## What the owner asked

“Architect a Harry Potter world for tilakaptell.com and implement with Opus 5.5. Add a lot of detail and make it unique and really really nice. Make it amazing and research about the movies and books. Add to the general universe. Merge once done to main.” And, relayed from another session: open pull requests and merge regularly; never let a branch grow for hours.

Everything marked **(my call)** was decided here, not by the owner, and can be overruled.

## The answer in one paragraph

A thirteenth planet on the universe map, a Highland world of lochs and moor with one castle lit on a crag, and down on it **Hogwarts**: the school year as a walkable, flyable world on the world runtime. You arrive as the films do, on the night train and then in a lantern-lit boat across the Black Lake with the castle rising over the water; the Sorting Hat sorts you (the site’s own questions), your house colours take the HUD, and the term begins. Then it is yours: the grounds (the lake, the Whomping Willow, Hagrid’s hut, the greenhouses, the pitch, the forest’s edge, the covered bridge and the stone circle), the castle inside (the Great Hall under its enchanted ceiling, the staircases that move, your common room, the library, the dungeons), a wand with nine spells, a broom and a Quidditch match, classes that are small games with tested rules, a night half with the Marauder’s Map as your minimap and Filch on the prowl, dementors on the shore and a Patronus to learn, Hogsmeade at the end of the road, and the House Cup counting all of it on the hourglasses in the hall. The people are figures on the site’s shared skeleton, made here on the desktop’s GPU and rigged by a new skinning step, so they walk, sit, cheer, cast and duel on the clips every other world uses.

## 1. What is there

Read from `main` at `616201b1`.

- **The map and the shell**: `src/components/universe/universes.js` (twelve fandoms; the last one added was Invincible, and it touched 40 files: `git log --stat` of its merge is the checklist), `layout.js` (a golden-angle spiral: a new fandom goes on the end and the `next`/`prev` tests move), `planets.js` and `planetMaps.js` (a skin per fandom id, baked by `scripts/planets/<id>.mjs` on `scripts/planets/sphere.mjs`’s kit), `landings/landings.js` (what each planet is like down on it, pure data; `landings/<id>.js` builds its props), `crews.js` (what each crew says as they near a world), `sounds.js` (its arrival sound), `guide/abouts.js`, `guide/pages.js`, `guide/routes.js`, `tour/brief.js` (`BRIEFED`) and `tour/briefs.js`, `tour/chapters/player.js`, `worlds/worlds.js` (`WORLD_MB`), `worlds/looks.js` (`LOOK_FOLDERS`), `worlds/packs.js`, `App.jsx`.
- **The world runtime**: `src/runtime/` (`useWorld`, `WorldHost`, the one renderer, `rt.assets`, `rt.saves`, `rt.input.bind`, `rt.gfx.post`, `rt.events`), its HUD kit (`src/runtime/hud/`), and the module contract (`runtime/module.js`: `{ id, shading, mb, label, create(rt, props) → world }`).
- **The newest world and the recipe to copy**: the Road (`src/components/middleearth/road/`, `docs/superpowers/specs/2026-10-18-the-road-design.md`): a `'nodes'` module on the node renderer, the house look through `lib/three/houseNodes`, the kit through `lib/three/kitNodes`, wind through `windNodes`, the ink line through `inkNodes`, the post chain as data (`road/hooks.js`’s `chainFor`), stages built a slice a frame (`lands.js`), a cast on the shared skeleton loaded through `rt.assets` (`cast.js`), what the figures carry (`gear.js`, `lib/three/held.js`), beats and deeds as pure data with tests, sun cascades from `lib/three/light/sun.js`.
- **People**: every figure on the site stands on Meshy’s 24-bone skeleton (`lib/three/meshyRig.fixture.js` has the bones: Hips, Spine, neck, Head, head_end, headfront, Left/Right Shoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot, ToeBase) and plays the library (`lib/three/clipLibrary.js`: Meshy’s `act-*` and Quaternius’s UAL `ual-*`, 139 of them, among them `ual-cast`, `ual-cast.double`, `ual-cast.enter`, `ual-cast.idle`, `ual-lantern`, `ual-eat`, `ual-counter.*`, `ual-crawl`, `ual-lean.rail`, `ual-celebrate`, `ual-cry`, `act-sit.*`, `act-cheer.*`, `act-talk.*`, `act-walk.sneak`, `act-look.around`). `lib/three/rig.js` finds bones by role, `animator.js` and `locomotion.js` play them. The Meshy key is not on this machine (`.env.local` is absent), so no new figure comes from Meshy. The desktop’s GPU is here (an RTX 5090; `scripts/gen3d/`: TRELLIS.2 from a picture, Blender for the bake), and Blender is scriptable headless, which is the way the cast is made (§4.10).
- **The kit**: Quaternius’s packs (`public/kit/naturemega`, `nature`, `farm`, `space`; `scripts/kit/README.md` says how a pack is added; the Stylized Nature MegaKit has the pines, birches, rocks and grass the grounds and the forest want). CC0 PBR sets through `lib/cc0.js` (`public/cc0/README.md`); `lib/three/facade.js` draws a building’s walls and windows in the shader from one box.
- **Precedents for the parts**: flight on a vehicle with a flight model (`invincible/world/flight.js`), on-rails beats and a title grammar (the Road’s `director.js`, `beats.js`), stealth and NPC wandering (`rickmorty/world/npc.js` over `lib/ai/steer.js`), rooms loaded on entry (`rickmorty/world/interiors/`), a minimap part (`runtime/hud/MiniMap`), knockable props (`lib/three/knockables.js`), water (`lib/three/river.js`, the Road’s `water.js`), weather (`lib/three/weather.js`, the Road’s `weather.js`), a day clock (the Road’s `daylight.js`).

## 2. Goals, non-goals, anti-goals

### Goals, measured

On `high` at 1440 × 900 and at the phone size (390 × 844), in the container on `nodes-webgl` by `scripts/perf-probe.mjs`’s journey `hogwarts`, and the owner’s desktop on `webgpu` where a row says so.

| what | target |
| --- | --- |
| the arrival (train, lake, Sorting) with no input | 3 to 4 minutes; skippable after the first time (Enter: “Straight to the castle”) |
| `/hogwarts` first frame of the arrival, software renderer in the container / the desktop | ≤ 6 s / ≤ 2 s |
| draws anywhere outside, `high` / `low` | ≤ 400 / ≤ 220 |
| triangles anywhere outside, `high` / `low` | ≤ 1,400,000 / ≤ 450,000 |
| draws and triangles in any room, `high` | ≤ 300 / ≤ 800,000 |
| download, the boot slice (the arrival, the grounds round the castle, the three friends and Hagrid) | ≤ 10 MB |
| download, the whole world walked (every room, Hogsmeade, the whole cast) | ≤ 48 MB; `WORLD_MB['/hogwarts']` the measured number |
| memory after a full tour against after the Sorting (`rt.assets.stats()`, `renderer.info.memory`) | within 12 %: rooms disposed on leaving, figures retained |
| HUD share of the viewport while walking, desktop / phone | ≤ 12 % / ≤ 20 %; with the Marauder’s Map open ≤ 40 % (it is the point) |
| things to do | 13 quests (§4.7), every one finished in a browser by a person and by the check’s bot |
| the cast | 24 figures on the shared skeleton (§4.10), each judged on its four-view sheet before it ships |
| tests | every rule in a `rules/` file under test; the Sorting, the spells, the staircases, Quidditch, the stealth, the points and the term each have a sim that plays them through |

### Non-goals

- Voice lines. The films’ actors are real people; the site’s cloned-voice pipeline is not used for them. The cast speaks in bubbles (`runtime/hud`’s Bubble) in the site’s own words. The owner may decide otherwise later.
- The whole castle. Hogwarts has 142 staircases and seven floors; this world has the Great Hall, the Grand Staircase, four common rooms, the library, the Potions dungeon, the Charms classroom, the Defence classroom, the Room of Requirement, the Owlery and the Astronomy Tower’s top. Everything else is a door that says it is locked, in character (“The Charms corridor. Not today.”).
- Diagon Alley, the Ministry, Azkaban, the Burrow, Privet Drive. The Floo in the Gryffindor common room names Diagon Alley as the next place the fire will go (**(my call)**: a second phase, if the owner wants it; the planet’s night side already has London’s glow for it).
- Online ghosts (other visitors in the grounds). Hooks left where `useTravellers` would go.
- The story of the books. This is the school year, not Harry’s plot: no Stone, no Chamber, no Voldemort. Things from the plot that are *places or things* are here (the Willow, the Map, the cloak, the Patronus, Buckbeak, dementors at the shore); the plot is not.

### Anti-goals (a failure even if it works)

- Copied dialogue beyond a short famous line (“Yer a wizard”, “Wingardium Leviosa”, the spell words, “I solemnly swear that I am up to no good”, “Mischief managed”). Everything the cast says is written here.
- A figure drawn in code where a model can stand. The ghosts and the creatures are models too, with their own materials.
- A room that is a box with a texture. Every room has a reason to be in it (a lesson, a thing to find, a view, a person), and a detail a reader of the books would notice.
- A HUD that is not the kit’s. Parchment skins the kit; it does not replace it.
- Keys a visitor cannot discover. Every key is on the guide page and the first-visit brief.
- Music from the films. The world’s sound is its own (§4.12).

## 3. Constraints (the standing rules that bite here)

- `'nodes'` module on the world runtime; nothing in its closure carries GLSL (`docs/superpowers/evidence/perf/tools/glsl-closure.mjs src/components/hogwarts/module.js` prints an empty list; `glsl-sites` in the measure does not rise).
- One art a folder: `src/components/hogwarts/look.js` says `scanned`, house tone, the house bloom; the `looks.test.js` sweep holds the folder to it. Every scene starts from `lib/device`’s tier, lowers under pace, loads when near, is disposed on leave.
- Files under 800 lines; 1,500 is the ceiling. The castle’s kit, the rooms and the quests are many small files from the start.
- Rules apart from drawing: `src/components/hogwarts/rules/*.js` import neither three nor React and have tests beside them.
- The HUD from `src/runtime/hud/` only; the keys written once in `guide/pages.js`; the brief in `tour/briefs.js`; the about in `guide/abouts.js`.
- No runtime calls to any service. Models are made on the desktop and committed with a credit (`public/games/credits.json`). Reference pictures used to make a figure are never committed (the Invincible rule); only the models ship.
- British spelling, curly quotes, sentence case, no Oxford comma; one sentence a toast; the key first in a prompt (“E Go in · The Great Hall”).
- New saves under keys of the world’s own: `tp-hogwarts` (the house, the wand, the term, the points, the quests, the cards found). Nothing else’s key is written.
- No model names in code, docs or commits.

## 4. The shape

### 4.1 Where it sits: the planet and the landing

**The planet** (`universes.js`, after Invincible, so every spiral test shifts by one): `id: 'potter'`, `label: 'Harry Potter'`, `world: 'Hogwarts'`, `place: 'Hogwarts'`, `to: '/hogwarts'`, swatch and accent a deep Gryffindor scarlet on the chart with a gold rim (`#c8102e` / `#f6c343`; the accent must read 4.5:1 on `#03040a`, so the accent is the gold and the swatch the scarlet), `air: { colour: '#b8c8e8', density: 2.2, top: 1.06, sunset: '#f0a060' }`, `size: 0.64`, palette `{ base: '#3f5a3a', dark: '#1a2a30', light: '#9fb09a', glow: '#f6c343' }`.

**Its maps** (`scripts/planets/potter.mjs`, registered in `build-fandom-planets.mjs`, worn by `planets.js`’s `potter(p, { u, T })` and listed in `planetMaps.js` and `planetShading.js`’s `CLOUDS`): a northern world. One continent’s west is Highland: glens and lochs in long parallel lines, snow on the tops, heather on the moor in late purple, dark pine where the forest is; a loch longer than the rest with a crag at its head is the Black Lake. South of it, rolling green and then a grey smear that is a city. The rest of the world is cold sea with island chains and ice at both poles. Clouds: long rain fronts from the west, the one over the Highlands always there. Night: one bright cluster at the crag (the castle), a smaller warm one along the loch (Hogsmeade), a thread of lamps along the railway winding south, and the city’s glow; the rest dark. Glow map: the castle’s windows and the lanterns, so the night side shows them before the night map fades in. Roughness: the lochs and the sea glossy, the moor matte.

**The landing** (`landings/landings.js` `potter`, built by `landings/potter.js`): *The shore of the Black Lake*, sub “Hogwarts · the night the first-years come”. Ground: shingle and wet grass. Sky: dusk going to night (zenith `#1a2446`, horizon `#e89a5a`, sun `#ffd0a0`). Things: the castle across the water as a far silhouette on its crag, every window lit (a kit of towers and halls, `castle/far.js`, shared with the world); the boathouse under the cliff with its lantern; four boats at the shore, one with a lantern in its prow; Hagrid (a figure, `tall: 2.6`) by the boats, saying one line of the site’s own (“Mind the step. She rocks, but she’s never lost one yet.”); an owl on a post; the door into the world at the boats (“E Go in · Hogwarts”, reach 6). Biomes read off the map under the spot: `loch` (the shore, above), `forest` (the Forbidden Forest’s edge: pines in fog, a unicorn’s glow far in, Hagrid’s line about not going further), `moor` (heather, a stone circle, the castle far off: the door still goes to the world).

**The crews’ lines** (`crews.js`, one pair a crew, in each crew’s voice), **the arrival sound** (`sounds.js`: an owl, then a bell), **the map’s fixture** (`__fixtures__/nodes.json` gets its `ramp:potter`), **the chart and the mini-map** take it from `UNIVERSES`.

### 4.2 The first minute: the arrival

The arrival is a short on-rails ride on the Road’s grammar (`director.js`’s poses, `beats.js`’s holds, a letterbox), played once in full and offered again from the Menu (“The arrival”). Four beats:

1. **Hogsmeade station, night.** The Hogwarts Express stands steaming at the platform (a scarlet engine and three carriages, made here: §4.10’s props list), lanterns on the posts, trunks on the platform, students streaming past as a crowd (the library’s walks). Hagrid’s lantern is the brightest thing: “Firs’ years! This way.” The camera walks with the crowd.
2. **The boats.** The lake path down to the shore, the boats, the push off. The boat glides (a spline over the water, the Road’s `line.js` shape); the oars are nobody’s. The castle comes up over the headland lit from a hundred windows, the moon over the Astronomy Tower, its light on the water; the giant squid’s arm rises and sinks once far off. This is the shot the world is judged by; the builder spends the time here.
3. **The steps and the hall.** Up from the boathouse by the long stair, in by the great doors, McGonagall on the stair with the site’s own words (“Wait here. When you go through, you will be sorted. Your house is your family here, and your family can lose points as well as win them.”), then the Great Hall: the four tables full, the floating candles, the ceiling the night sky, the hourglasses empty.
4. **The Sorting.** The Hat is put on (the camera drops under its brim, the view goes dark but for the hall through the gap). Three questions, each with four answers, in the Hat’s voice, the site’s own words (`rules/sorting.js`: the questions, the answers’ weights to the four houses, the tie-break by the first answer, a seed so the same answers always sort the same; tested). The Hat says the house; the table cheers (`act-cheer.*`, `act-sit.cheer`, `act-sit.clap`); the HUD takes the house colours and the scarf; the term starts. The wand comes with the house (`rules/wand.js`: wood, core and length from the answers; said on the card: “Hawthorn, dragon heartstring, eleven and three-quarter inches. Quite springy.”).

Pressing Enter once past the first time skips to the steps; `?at=hall` opens there. Reduced motion: the camera cuts instead of glides.

### 4.3 The grounds

One ground, 1,400 m across (**(my call)**: the film’s layout, which puts the castle on a crag with the lake to the south and west, the forest to the west and north, Hogsmeade to the north-east along the lake, the pitch on the lawn east of the castle), streamed in 200 m cells (the Road’s `lands.js` shape, one stage a cell, three cells built at a time). Heights from a hand-placed field (`world/terrain.js`: the crag, the lawns, the shore, the glen the station sits in, the moor behind), water at the lake’s level (`world/lake.js`: the Road’s `water.js` in the house, reflections on high, the squid’s arm every few minutes, in sight of the shore only). Ground cover from the MegaKit through pools (grass, heather tinted purple, pines tinted dark for the forest, birches and oaks by the lake, rocks). Paths worn into the ground (`lib/three/tracks.js`).

Landmarks, each a file in `world/castle/` or `world/grounds/` and a place with a name (so the Map, the prompts and the quests can say it):

- **The castle** (`castle/`): a kit of parts (`parts.js`: a tower of a radius and a height with a slate cone or a battlement, a wall with buttresses, a hall with a gabled slate roof and tall gothic windows, a bridge span, a stair), each a merged geometry under a few materials (two stone sets from CC0, slate, lead, glass that glows warm at night through `lib/three/facade.js`’s emissive window trick), composed by `plan.js` into the film’s silhouette: the Great Hall’s long roof, the Grand Staircase tower behind it, the Astronomy Tower highest, the clock tower with its face and pendulum, the covered bridge out to the stone circle, the long viaduct over the glen, the boathouse at the foot of the cliff with its stair, the Owlery on its own knoll, the greenhouses (glass over iron, green inside), the courtyard with the fountain. Near, the parts are the real meshes; past 300 m the whole castle is one baked silhouette (`far.js`, shared with the landing) with its windows on a glow map. Doors that open (`doors.js`): the great doors, the courtyard, the greenhouse, the boathouse, the Owlery, the bridge’s gates. The owner’s rule applies: the castle is the site’s own reading of the films’ shape, no studio art.
- **The Whomping Willow** (`grounds/willow.js`): a great tree on the lawn whose limbs are bones (a code-built tree is fine here: it is a creature, not a figure), idle swaying, and when you come within 12 m it swats (`rules/willow.js`: a wind-up, a strike along the shortest limb to you, a cooldown; a hit throws you 6 m and costs a point). The knot at its root freezes it for ten seconds when a thrown stone hits it (Wingardium Leviosa drops one on it), and the tunnel under it goes to the Shrieking Shack (§4.9).
- **Hagrid’s hut** (`grounds/hut.js`): the octagonal hut with its chimney smoking, the pumpkin patch (pumpkins bigger than you), Fang asleep on the step, Buckbeak tethered in the paddock behind, a crossbow over the door. Inside is one room (it opens): the kettle, the dragon’s egg in the fire when the term is at Christmas, the bed too big for anyone else.
- **The greenhouses** (`grounds/greenhouses.js`): three glasshouses in a row, the middle one open: pots on benches, Mandrakes (the Herbology lesson, §4.7), a Venomous Tentacula that snaps at you when you pass (a Willow in a pot), Professor Sprout at the bench.
- **The Quidditch pitch** (`grounds/pitch.js`): the oval, three hoops at each end at the book’s heights, six stands in the house colours with banners that move in the wind, the changing rooms under the stands, the commentator’s box. A broom rack at the changing rooms where the broom is picked up before the lesson.
- **The lake and the shore**: the boathouse, the landing’s shore, the rocks where the merpeople are said to be (a song under the water on high, three notes, when you stand on the end rock at night), the dementors’ reach (§4.8).
- **The forest’s edge** (`grounds/forest.js`): pines close and dark past the paddock, lanterns on the path for Care of Magical Creatures, a clearing with the unicorn (white, its own glow, it runs when you come within 20 m), thestrals only once you have been sorted and have died in a duel (**(my call)**: the book’s rule in a small way: you can see them once something has happened to you), centaurs as silhouettes crossing far off. Past 120 m into it the fog closes and the world turns you round with Hagrid’s voice (“Not that way. Not without me.”).
- **The stone circle and the covered bridge**: the view back at the castle; the bridge creaks and sways with you.
- **The station and the road to Hogsmeade** (§4.9).

### 4.4 The castle inside

Rooms are loaded through a door and disposed on leaving (`rooms/index.js`: one lazy module a room, the C-137 interiors’ shape; a room is a `{ build(rt, house) → { group, colliders, doors, places }, step, dispose }`). The grounds stay built but hidden under a room, so going out is instant. Each room:

- **The Entrance Hall and the Great Hall** (`rooms/greatHall.js`): the hall at the film’s size (one figure in six), the four long tables with benches, plates and goblets that fill at the feast, the head table on its dais with the teachers (Dumbledore’s chair gold), the floating candles (an instanced field of candles, each bobbing on its own phase, their light faked as a warm hemisphere plus a few real point lights on high), the enchanted ceiling: the world’s own sky drawn on the vaulting (the same `sky.js` sample as outside, by time of day and weather: it rains above the tables when it rains, without wetting them), the four hourglasses by the doors with their stones counted from `rules/points.js` (rubies, emeralds, sapphires, topazes: the count drawn as a fill height and the top few stones as instances), the house banners, the lectern with the owl. At Christmas the twelve trees. The feast (the end of term, §4.7) dresses the hall in the winner’s colours.
- **The Grand Staircase** (`rooms/staircase.js`): the tower of stairs between landings, seven floors of landings drawn, the stairs that move (`rules/staircases.js`: each stair a `{ from, to, alt }`, a schedule that swings one every so often, never the one you are on until you are at a landing, and a rule that a landing is always reachable; tested with a sim that walks every path), the portraits on every wall (a kit of frames round painted canvases made as noise-and-palette pictures, `rooms/portraits.js`: a dozen named subjects with a line each in the site’s own words, said as you pass; one of them moves to another frame when you look away), the Fat Lady at the top (the Gryffindor door: the password is the term’s word, given at the Sorting; a wrong word three times and she sulks), the trick step (sinks you to the knee once a visit).
- **The common rooms** (`rooms/common/<house>.js`): yours, by the house you were sorted into. Gryffindor: the round tower room, the fire, the squashy chairs, the notice board, the boys’ and girls’ stairs (the girls’ turns into a slide for a boy, the book’s joke, used once). Slytherin: under the lake, green light through the windows into the water, the squid passing, the stone, the fire under the carved mantel. Ravenclaw: the tower with the stars on the ceiling, the knocker that asks a riddle (`rules/riddles.js`: twelve riddles, the site’s own, any answer accepted once reasoned at: the knocker says “Well reasoned” for the right one, “Hm. Think again” and lets you in on the third try). Hufflepuff: the round low room by the kitchens, barrels, plants, yellow and warm; the kitchens next door with the house-elves (small figures on the skeleton at 0.9 m) who give you a pie. Every common room has the Floo (a fireplace that says where it will go next), a bed to sleep in (which moves the term on, §4.7), and the notice board with the week’s quests.
- **The library** (`rooms/library.js`): long stacks, the lamps, Madam Pince at the desk, the Restricted Section behind a rope at the back (the night quest, §4.8), a few books that shriek when opened (the Monster Book, chained), a book you can read (one page, the site’s own, on the house you are in).
- **The Potions dungeon** (`rooms/potions.js`): low, the cauldrons on their fires, jars of things on every shelf, Snape at the front. The lesson (§4.7).
- **The Charms classroom** (`rooms/charms.js`): desks, feathers, Flitwick on his pile of books. The lesson.
- **The Defence classroom** (`rooms/defence.js`): the duelling platform set up down the middle, the wardrobe at the back with the boggart in it.
- **The Room of Requirement** (`rooms/requirement.js`): the seventh-floor wall; walk past three times thinking of what you need (the prompt asks what: a place to practise, a place to hide, a place to find things) and the door appears; each is a small room: a practice room with targets for the spells, a room of hidden things (a hill of lost objects, a Chocolate Frog card at the top), a quiet room with a window onto the lake.
- **The Owlery** (`rooms/owlery.js`): the tower open to the wind, owls on every ledge (instanced, turning their heads to you), Hedwig recognisable on her own perch, the post: a letter you can send (a card, a line of your own typed in; it is “sent” and a reply comes the next morning on the notice board, in the site’s own words).
- **The Astronomy Tower** (`rooms/astronomy.js`): the top, the telescopes, the best view of the grounds, the lake and the forest; by night the stars named when you look along a telescope.

### 4.5 The wand and the spells

The wand is held in the right hand (`lib/three/held.js`) and shown on the HUD as a short card (wood, core, length). Spells on a radial wheel (hold Q; a tap of 1 to 9 picks one straight): the cast is the library’s `ual-cast` (a flick) or `ual-cast.double` (a push), the wand’s tip a point light for the flash and a trail (`lib/three/puffs`’s cards in the spell’s colour). `rules/spells.js`: every spell a `{ id, word, colour, kind, range, cost, cooldown, needs }` and `cast(state, spell, target) → { effects, points }`; tested. The nine:

| key | spell | what it does here |
| --- | --- | --- |
| 1 | Lumos / Nox | the wand lights (a point light that follows the tip); the dungeons and the forest at night want it |
| 2 | Wingardium Leviosa | lifts a knockable prop (a feather, a stone, a chair, a pumpkin) and carries it while held; let go and it drops; a stone on the Willow’s knot freezes it |
| 3 | Alohomora | opens a locked door or chest that is allowed to open; a door that must not says why |
| 4 | Accio | pulls a thing within 20 m to your hand (the broom, your trunk, a Snitch in practice) |
| 5 | Incendio | lights a torch, a fireplace or a cauldron fire; on a bale, a small fire that goes out |
| 6 | Expelliarmus | a duel’s disarm: a red bolt; hits a figure’s wand and sends it 4 m; the duelling club’s win condition |
| 7 | Stupefy | a duel’s stun: a bolt that knocks a figure down for 3 s (`act-knockdown`), blocked by Protego |
| 8 | Protego | a shield for a second: a bolt that hits it is thrown back along its line |
| 9 | Expecto Patronum | at the shore, against the dementors, once learnt (§4.8): the Patronus runs out of the wand (silver, additive, a shape by your house: a stag, a hare, an otter, a fox **(my call)**) and the dementors go |

Reparo is not on the wheel: anything broken mends itself when its room is left (so nothing is ever lost), and a Reparo is what the toast says it did. A spell costs nothing but a cooldown; a spell cast at a person outside a duel costs house points (Snape appears; `rules/points.js`’s `misdeed`).

### 4.6 The broom and Quidditch

The broom unlocks at the flying lesson (§4.7) and lives on the rack after. Flight (`rules/flight.js`, pure, with the Invincible world’s shape: speed, lean, bank, a ceiling at the Astronomy Tower’s height times three, a floor that lands you): W to lean forward and go, S to brake, A D to bank, Space up, C down, Shift flat out (a broom is slower than Mark: 90 km/h flat out, and the stands and the hoops are small enough that the pitch feels big). Mounting: Accio or a walk to the rack; E on the broom; a hop and you are on it (`act-jump.*` into a sitting pose over the shaft, the figure held by `held.js`’s seat).

**Quidditch** (`rules/quidditch.js`, a sim under test that a bot can win): the Seeker’s game. Six house players on each side fly the pitch on their own loops (Chasers passing the Quaffle, scoring through the hoops now and then: the score runs on its own, ten a goal), two Bludgers hunt the nearest player and are batted off by Beaters (a Bludger hit costs you 2 s of tumble and some height), the Snitch (gold, wings, a point of light) flies a wandering path that keeps its distance and darts when you are near; the other Seeker chases it on a steer that is a little worse than yours at easy and better at the third match. Catch it (within 1.5 m, E) and the match ends; the score decides it as the book’s rule does (150 for the catch). Three matches a term (Slytherin, Ravenclaw, Hufflepuff), their results on the House Cup. The crowd in the stands is a card crowd (sprites with the house colours, waving) with the commentator’s lines in bubbles over the box, the site’s own (“And that is a foul, or it would be if anyone had seen it”). A practice mode at any time: the Snitch alone.

### 4.7 The term: classes, quests, the House Cup

The term (`rules/term.js`) is a clock of twelve weeks, from September to the leaving feast, that moves on when you sleep in your bed, finish a lesson, or when the day’s clock has run three real days of the world (a world day is 24 minutes, §4.13). The season follows: autumn to the Christmas feast (snow on the grounds and Hogsmeade, the twelve trees, the lake frozen at the edges), then spring, the leaving feast at the end. The notice board (and the Menu’s Things to do, through the kit’s QuestList) lists the week’s quests. Thirteen quests (`rules/quests.js`, each a `{ id, title, where, steps, points, needs }` with `advance(state, event)` under test, and a bot in `scripts/hogwarts-check.mjs` that plays every one through by moving the figure and casting):

1. **The Sorting.** Arrive; be sorted; find your common room (the first password). 10 points for finding it unaided.
2. **Up!** The flying lesson on the lawn with Madam Hooch: say “Up”, get the broom, a circuit through three rings round the lawn. Unlocks the broom.
3. **The feather.** Charms: Wingardium Leviosa on your feather until it reaches the ceiling (the swish-and-flick is a timing: a pointer gesture or a key held and released on the beat, `rules/charms.js`); a feather set on fire costs points.
4. **A potion.** Potions: brew a Cure for Boils from the board (five ingredients in order, a stir count, a heat; the recipe is data, the cauldron reads your moves; a wrong order melts the cauldron and Snape takes five points, the site’s own words; a right one earns ten).
5. **Mandrakes.** Herbology: earmuffs on, repot four Mandrakes before their cry gets through (a timing game per pot; without the earmuffs you faint for ten seconds).
6. **Buckbeak.** Care of Magical Creatures at the paddock: bow to Buckbeak (hold the bow key until he bows back; too quick and he rears), then a ride: a flight on rails over the lake and round the castle, the broom’s controls off, the view the point.
7. **The Willow’s knot.** Something is caught in the Willow (a book from the library). Freeze it with a stone and fetch it.
8. **The duelling club.** The Defence classroom: three rounds against Malfoy (`rules/duel.js`: both sides cast on cooldowns; Protego on the beat throws a bolt back; Expelliarmus wins a round; a Stupefy that lands loses one; the bot’s timing is tested). A win is twenty points. (Losing to him three times is how you first see a thestral.)
9. **The boggart.** The wardrobe in the Defence classroom: Riddikulus is a choice of three jokes for what comes out (a dementor, a spider, Snape), the right one by what it is; the site’s own jokes.
10. **After hours.** Night: the cloak, the Map, the Restricted Section (§4.8).
11. **The Patronus.** The shore at night: dementors come; Expecto Patronum is learnt in the Defence classroom first, on a boggart dementor (three tries); then at the shore for real.
12. **Hogsmeade weekend.** Up the road: a butterbeer at the Three Broomsticks, the sweets at Honeydukes (three to find), the Shrieking Shack by the tunnel under the Willow (§4.9).
13. **The House Cup.** When the term is out: the leaving feast; the hourglasses settle; the hall is dressed in the winner’s colours; your points on the card. The other houses’ points run on their own (`rules/points.js`’s `rivals`: they gain by the week, a little behind a player who does the quests, so the Cup is winnable and not given). Finishing every quest with your house winning is the world’s achievement (`Achievements.jsx`’s list gets “Head of house” and a few smaller ones: sorted, caught the Snitch, a Patronus, the Map).

Points are everywhere: a lesson done, a question the teacher asks in a bubble (two answers), a Snitch; lost by a spell cast at a person, being caught at night, a melted cauldron, Peeves’s mischief pinned on you. The hourglasses and the HUD’s points chip read `rules/points.js`.

### 4.8 Night: the Map, the cloak, Filch, the dementors

After the first week the Map comes (an owl on the notice board: “Found in Filch’s office. Yours, if you say the words”). **The Marauder’s Map** is the world’s minimap (M, or the kit’s MiniMap part skinned as parchment, `MaraudersMap.jsx`): the castle and the grounds drawn as the Map draws them, in ink on parchment, folding open with the words (“I solemnly swear that I am up to no good”) and shut with “Mischief managed”; and on it, every person in the world as a pair of footprints with a name in a banner, moving as they move, the Map’s own feature and the world’s. Footprints come from the NPC sim (`rules/people.js`: every named figure has a day, a list of places and times, and walks between them on `lib/ai/steer.js`; the Map reads positions, not the figures), so the Map is also how you find anyone: Hagrid at his hut by day, in the Three Broomsticks on a Saturday night.

**Curfew** (`rules/curfew.js`): past the world’s 21:00 the corridors are Filch’s and Mrs Norris’s (the cat sees you from 10 m, Filch from 6 m in his lantern’s cone, both by the Map’s footprints); the prefects walk the Grand Staircase. Caught is a toast, 20 points off and a walk back to your common room (a cut). **The invisibility cloak** (found in the Room of Requirement’s room of hidden things) hides you from Filch but not from Mrs Norris, and not from Peeves, who calls out where you are (a bubble that Filch hears: the sim’s `noise`). Quest 10: reach the Restricted Section at night, open the roped book (it screams unless Lumos is off and you have been quiet), read its one page, and get back.

**The dementors** (`grounds/dementors.js`, `rules/dementors.js`): at night, past the term’s sixth week, three come over the lake toward the shore when you are on it: cloaked figures (a figure on the skeleton with the robe as its whole shape and a `ual-crawl`-like drift, hands only; the breath an exhale on the sound bus), the cold (the house look’s shade colour drains to grey as they close, frost on the shore), the pull (your walk slows). Without the Patronus you faint at the shore and wake in the hospital wing (a cut to the common room: no hospital wing room is built, the toast says Madam Pomfrey had you). With it, the Patronus runs them off and the night is yours; the sound bus plays the world’s own three notes.

### 4.9 Hogsmeade and the Shack

North-east along the lake path, past the station, the only all-wizard village: one High Street of a dozen buildings in the kit (`world/hogsmeade.js`, `castle/parts.js` reused at house scale with crooked roofs and chimneys that smoke), snow on it from the term’s eighth week whatever the lawn is doing (**(my call)**: the films’ Hogsmeade is always snowy; the lawn is not). Shops with a sign each (the site’s own lettering) and an inside for three: **Honeydukes** (shelves of sweets as instanced jars and boxes, the three to find for quest 12: a Chocolate Frog whose card is a famous witch or wizard with a line of the site’s own on the back, a box of Every Flavour Beans that says what flavour you got, a Sugar Quill; the cellar’s trapdoor is the tunnel’s other end, from the One-Eyed Witch’s hump, which is on the Grand Staircase’s third landing), **the Three Broomsticks** (the bar, Madam Rosmerta, the fire, a butterbeer in your hand that warms the HUD’s edge for a minute and gives a point of courage, students at the tables, Hagrid on a Saturday), **the Hog’s Head** (dark, a goat, the barman who says nothing you can quote). Zonko’s, Dervish and Banges, Gladrags, Scrivenshaft’s, Madam Puddifoot’s and the post office are fronts, each with a line at the door. The **Shrieking Shack** on its hill behind the fence (the tunnel under the Willow comes up inside: one room, broken furniture, scratches on the walls, the wind, a door that does not open from the inside without Alohomora).

**Chocolate Frog cards** (`rules/cards.js`): twenty, hidden through the world (the Room of Requirement’s hill, Honeydukes, under a bed, on the Astronomy Tower, in the Owlery, the common rooms, Hagrid’s hut), each a witch or wizard of the books with a card’s worth of the site’s own words, kept in the save and shown in a Menu page (a binder: the kit’s Screen).

### 4.10 The cast and the creatures

Twenty-four figures on the site’s shared skeleton, from the films’ look as the site reads it (never the studio’s pictures; never a likeness copied: the figure is the character as a stylised model in the Middle-earth cast’s big-headed proportion, **(my call)**, so one cast on the site reads as the others do and no actor’s face is modelled):

- The students: **Harry**, **Ron**, **Hermione** (they walk with you between quests as the Road’s company does, a line each at the places), **Malfoy** with **Crabbe** and **Goyle**, **Neville**, **Luna**, **Cedric**, **Ginny**, the **Weasley twins** (one model, two tints), and a **student** in each house’s scarf for the crowds (four tints of one model, two bodies).
- The staff: **Dumbledore**, **McGonagall**, **Snape**, **Hagrid** (tall: 2.6 m, his own body), **Flitwick** (0.9 m), **Sprout**, **Hooch**, **Filch**, **Madam Pince**, **Madam Rosmerta**.
- The others: **Peeves** (a figure that never touches the floor, bright, cackling: `act-dance.*` in the air), the ghosts **Nearly Headless Nick**, **the Grey Lady**, **the Fat Friar**, **the Bloody Baron** (one material: translucent, additive, a pale blue, their footprints on the Map a pale grey), the **house-elf** (0.9 m).
- The creatures (not on the skeleton; their own rigs or code where they are not people): **Mrs Norris** (a cat: the farm pack has none, so a model made here with a simple four-bone walk), **Fang**, **Buckbeak** (made here: a body with wings as bones for the ride), the **owls** (one model, instanced; Hedwig white), the **dementors** (the robe on the skeleton), the **giant squid**’s arm, the **unicorn** (the farm pack’s horse, white, a horn, its own glow), the **thestral** (the horse’s skeleton under a black skinned body made here), the **Mandrakes** (pots with a bobbing root-baby, code-built, as the Willow is).

How a figure is made (`scripts/hogwarts-cast.mjs`, with a README; the same shape as `scripts/gen3d/make.mjs` and a new skinning step):

1. **A concept picture** from a prompt describing the look (robes, scarf, hair, build, the big-headed proportion), never a name, through `scripts/gen3d/picture.mjs`; four candidates, the best picked by the judge.
2. **A model** through TRELLIS.2 on this machine (`generate.mjs`), stood up (`upright.mjs`), baked to 30,000 faces and a 2048 atlas (`bake.mjs`).
3. **A skeleton** (`scripts/rig/skin.mjs`, new, with tests on a fixture): Blender headless builds Meshy’s 24 bones at the proportions `joints()` in `cybertron/game/autorig.js` reads off the shape (feet, hips, shoulders, hands as shares of the height), named as `meshyRig.fixture.js` names them, in the A-pose, and parents the mesh with automatic (heat) weights; the GLB is written with the armature scaled as Luke’s is (centimetres under a metre root), so `lib/three/rig.js` finds every bone by name and `clipLibrary`’s `forFigure` retargets every clip by the hips’ height. The check: every library clip plays on the new figure in the headless browser with no bone missing and the feet on the floor (`scripts/anim-check.mjs`’s shape).
4. **The cut** for the web (`web.mjs`: three cuts, WebP, meshopt) into `public/models/hogwarts/cast/<name>.glb`, credited in `public/games/credits.json` (made here, from a concept picture: the credit says so).
5. **The sheet**: four views of the figure in its idle, its walk and `ual-cast`, under `docs/gen3d/hogwarts/<name>.webp` (under 1 MB each, or on the bucket), looked at before the figure ships. A figure that comes out wrong is remade from a better picture; a figure that will not skin is reported and stood in by the nearest other figure (a student) with a toast, never a code figure.

The props made the same way (static, no skeleton): the Hogwarts Express engine and carriage, the Sorting Hat, a cauldron, a broom, a trunk, a telescope, a Snitch, a Quaffle, a Bludger, the boats, the Hat’s stool, a house banner, a candle, a goblet and a plate, an owl, a pumpkin, a Mandrake pot, the Fat Lady’s frame, the One-Eyed Witch, the knocker. Where the kit or CC0 has one (benches, barrels, crates, lanterns: the farm and nature packs), the kit’s is used.

### 4.11 The face

The kit, skinned once as parchment and ink (`hogwarts.css`: a cream glass at alpha 0.82, ink `#2a1d12`, the house’s colour as the accent, serif display from a font already in the stack: Cinzel for titles, the body the house sans). Parts: the Menu (settings: the time of day, the quality, the sound; Things to do; Controls opening the guide; the binder of cards; “The arrival” again; the way out), one Prompt (“E Go in · The Great Hall”), the Objective line for the quest step, the Toast, the Bubble for what the cast says (the speaker’s head on screen: the Road’s `Said`), the QuestList under M’s page, the MiniMap as the Marauder’s Map (its own part, `MaraudersMap.jsx`, built on MiniMap’s rules), a points chip (the hourglass in small, the house colour), the wand card and the spell wheel (`SpellWheel.jsx`, a radial of nine on Q, the kit’s GameIcon for each), the Stick and TouchButtons on touch (the main one Cast, then Jump/Mount, Map, Menu), the Letterbox for the arrival and the rides. Nothing a player reads under 0.7 rem; the key first.

### 4.12 Sound

On the runtime’s bus (`rt.audio`), all made or synthesised here, none from the films: the castle’s bell on the hour (a struck tone), owls, the lake, wind on the tower, the fire in the common room, the crowd’s murmur in the hall (a bed from `lib/audio`’s noise shaped), the candles’ nothing, the Hat’s voice as a low formant hum under its bubble, a spell’s whip and its flash’s crack, the Willow’s creak and whoosh, the dementors’ breath and the cold’s ringing, the Patronus’s three notes (the world’s own motif, three rising notes in D), the train’s whistle and the steam, Quidditch’s crowd rising on a goal and the Snitch’s wing-hum when it is near. The feel’s hits (`lib/three/feel.js`) on a Bludger and a knockdown.

### 4.13 Time, weather, seasons

A world day is 24 minutes (`rules/clock.js`), starting at the arrival’s night and running: the sun on the Road’s `daylight.js` shape (the sky, the sun, the moon, the fog by hour), the castle’s windows lit from dusk, the enchanted ceiling and the Astronomy Tower’s stars following. Weather by the week (`rules/weather.js`): Highland rain in autumn (the Road’s `weather.js`), mist on the lake at dawn, snow from the eighth week, clear spring. The time can be set in the Menu (and `?at=night`).

### 4.14 Tiers and performance

`low`: no shadows, the far castle always, one room at a time, the crowds at half, no reflections on the lake, the Map at a lower sample rate, a hundred candles. `mid`: cascades to 40 m, the near castle within 150 m. `high`: cascades to 60 m, the lake’s reflection, the ink line, the full crowd, the grade. `ultra`: the castle’s `-hq` stone, the 8K planet map near. Everything instanced that repeats (candles, owls, jars, students in the stands, pines); the castle merged by material; pools for the grounds. `renderer.info` numbers in the evidence (`docs/superpowers/evidence/hogwarts/README.md`) at six fixed poses (the shore in the boat, the lawn, the Great Hall, the Grand Staircase, the pitch in a match, Hogsmeade’s street) on `high` and `low`.

## 5. Copy

- The site’s own words throughout: the Hat’s questions, every bubble, every sign, every card. The spell words, the house names, the places’ names and a handful of famous lines are the books’ and the films’; nothing longer.
- British spelling (the books’ own), curly quotes, sentence case, no Oxford comma. The houses are capitalised, the subjects too (Charms, Potions), the spells capitalised and never in quotes.
- Toasts one sentence (“Ten points to Ravenclaw.”). Prompts key first. The Hat, Snape and Peeves each have a voice; the builder writes a line or two of each in `rules/lines.js` before the rest so the voice holds.

## 6. Testing and evidence

- `rules/*.test.js`: the Sorting (every answer set sorts; the same answers twice sort the same; each house reachable), the wand (deterministic), the spells (each effect, the cooldowns, the points), the staircases (a sim walks every landing to every other in under N swings; never moves the one you stand on), the Willow (the strike window), the flight model, Quidditch (a bot catches the Snitch in under four minutes at the first match, the score’s rule), the duel (the bot’s Protego beat), the curfew (seen and unseen by the cone and the cat), the dementors (faint and Patronus), the points (every gain and loss, the rivals’ pace keeps the Cup winnable), the term (the weeks, the seasons, the sleep), the quests (each advances through its steps and no other event moves it), the NPCs’ days (every named figure has a place for every hour), the cards (twenty, each found once).
- `scripts/hogwarts-check.mjs`: builds, opens `/hogwarts`, plays the arrival, then every quest with the dev hook (`window.__HOGWARTS__ = { go(place), cast(spell, at), term(week), time(hour), quest(id), state() }`), shoots the six poses on `high` and `low`, prints draws, triangles and memory, fails on a page error, a console error beyond the known noise, or a number over §2’s table.
- `scripts/perf-probe.mjs` gets a `hogwarts` journey (load, the lawn, the hall, the pitch).
- `scripts/pack-check.mjs` against `hogwarts/pack.js`; `WORLD_MB` from the measured download.
- The planet: `scripts/sector-check.mjs` and `landing-check.mjs` already sweep every fandom; the new one is in their lists by `UNIVERSES`.
- Evidence under `docs/superpowers/evidence/hogwarts/` (README, the numbers, the shots on the bucket over 1 MB).

## 7. Files

```
src/components/hogwarts/
  module.js                the world module ('nodes'; props { at, reduced })
  look.js  pack.js  hogwarts.css
  HogwartsWorld.jsx        the page's face: the HUD over the WorldHost
  hud/  MaraudersMap.jsx SpellWheel.jsx SortingCard.jsx PointsChip.jsx Binder.jsx WandCard.jsx
  rules/  sorting.js wand.js spells.js staircases.js willow.js flight.js quidditch.js duel.js
          charms.js potions.js herbology.js boggart.js curfew.js dementors.js points.js term.js
          clock.js weather.js quests.js people.js cards.js riddles.js lines.js  (+ tests)
  world/  terrain.js cells.js lake.js sky.js daylight.js weather.js ambience.js scatter.js
          hooks.js (the house, the chain) arrival.js (the ride) hogsmeade.js
  world/castle/  parts.js plan.js far.js doors.js materials.js
  world/grounds/  willow.js hut.js greenhouses.js pitch.js forest.js bridge.js station.js dementors.js
  rooms/  index.js greatHall.js candles.js ceiling.js hourglasses.js staircase.js portraits.js
          common/{gryffindor,slytherin,ravenclaw,hufflepuff}.js kitchens.js library.js potions.js
          charms.js defence.js requirement.js owlery.js astronomy.js shack.js honeydukes.js broomsticks.js
  cast/  figures.js (load, walk, act) ghosts.js creatures.js owls.js crowd.js company.js (the three friends)
  play/  walk.js (the player on foot) broom.js snitch.js wandfx.js patronus.js
src/pages/Hogwarts.jsx
src/components/universe/landings/potter.js
scripts/planets/potter.mjs   scripts/hogwarts-check.mjs   scripts/hogwarts-cast.mjs   scripts/rig/skin.mjs (+ test)
public/models/hogwarts/cast/*.glb   public/models/hogwarts/props/*.glb   public/textures/universe/potter*.webp
docs/superpowers/evidence/hogwarts/   docs/gen3d/hogwarts/
```

## 8. The order of work: lanes and pull requests

Every lane works in its own worktree from `origin/main`, opens a pull request as soon as something stands, merges on CI green, and carries on from `main`. No branch lives for more than a working day. Lane A merges first; the others merge `main` in after it.

- **Lane A, the planet and the wiring** (one PR, small and first): `universes.js`, `layout.test.js` and the other spiral tests, `scripts/planets/potter.mjs` and the maps, `planets.js`, `planetMaps.js`, `planetShading.js`, `landings/landings.js` and `landings/potter.js`, `crews.js`, `sounds.js`, the fixture, `guide/*`, `tour/*`, `worlds.js`, `looks.js`, `packs.js`, `App.jsx`, `src/pages/Hogwarts.jsx`, and a first `module.js` that draws the sky, the lake, the far castle and lets you walk the shore with the kit’s Menu and Prompt: the world exists, on the map and under foot. HANDOFF-worlds gets its Hogwarts section.
- **Lane B, the cast** (several PRs, one every few figures): `scripts/rig/skin.mjs` with its test first, then the figures in §4.10’s order (the three friends and Hagrid first, the staff, the rest), each PR the models, the sheets and the credits; nothing else.
- **Lane C, the grounds and the castle outside** (two PRs): the terrain and cells, the castle kit and plan, the lake, the landmarks, the day clock and the weather; then the Willow, the hut, the greenhouses, the pitch, the forest’s edge.
- **Lane D, the arrival and the rooms** (three PRs): the arrival ride and the Sorting; the Great Hall, the Grand Staircase and the common rooms; the library, the dungeons, the classrooms, the Room of Requirement, the Owlery, the tower.
- **Lane E, the wand, the broom and the games** (three PRs): the spells and the wand effects; the broom and Quidditch; the duel, the boggart, the classes.
- **Lane F, night, the term and Hogsmeade** (three PRs): the NPCs’ days and the Map, the curfew, the cloak, the dementors and the Patronus; the term, the points, the quests and the Cup; Hogsmeade, the Shack, the cards, the feast.
- **Lane G, the close** (one PR): the check script and the probe journey, the evidence, `WORLD_MB`, the hand-off, the backlog.

Lanes C, D and E can run at once after A; F after D and E; G last. Each lane reads this design, the Road’s module and the HANDOFF, and owns its files only.

## 9. Decisions

- **On the world runtime, as a `'nodes'` module.** The engine floor’s direction (FL3: every module `'nodes'`) and the Road’s proof that a whole world can be built on it. The cost is that every helper used is a `*Nodes.js` twin; the Road has made the ones a world needs.
- **The arrival is on rails; the rest is free.** The films’ first sight of the castle is the shot; a visitor should get it without finding it. After that the world is theirs.
- **Figures made here and rigged here.** No Meshy key on the desktop, and a cast of twenty-four on the shared skeleton is worth a skinning step the site can use again. The proportion is the Middle-earth cast’s, so no actor’s face is modelled and the two fantasy worlds read as one site.
- **The Map is the minimap.** The one feature that could only be this world’s. Footprints need an NPC sim, which the night half needs anyway.
- **The House Cup is the economy.** Points are what every quest gives and every misdeed takes; the rivals keep it a race.
- **Thirteen quests, one term.** Enough to be a school year; few enough to finish every one in a browser before the lane closes.
- **No voices.** Real actors.

## 10. Left to the builder, and to the owner

- The builder tunes every number here (the sizes, the speeds, the week count, the points) to what reads right in a browser, keeps the tests true to the tuned numbers, and says so in the commit.
- To the owner: Diagon Alley by Floo as a second phase; voices; online ghosts in the grounds; a fourth match and a Cup table across visitors (Supabase, the site’s durable layer); the accent colours once seen on the chart.
