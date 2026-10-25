# The Road: the evidence

The numbers behind the Road’s lanes (`docs/superpowers/HANDOFF-the-road.md`, the design `docs/superpowers/specs/2026-10-18-the-road-design.md` §4.10 and §6). Each lane adds its rows; a row says where it was measured. Everything here was measured in the cloud container: headless Chromium drawing in software (SwiftShader, WebGL 2) through the node renderer (`nodes-webgl`). **The WebGPU rows are the owner’s laptop and desktop and are left empty**; nothing here is an estimate of them.

## R1, the spine (2026-10-18)

Sixteen flat placeholder stages with their names, their light and their company; no ground, scatter, water or weather yet (R2). The stage tables below are therefore the cast and the sky alone: what a stage adds is R2’s and the stage lanes’ to measure against them.

### Each stage (`node lab/road/measure.mjs`)

Each stage opened by its address in a fresh window at `high`, 6 s for the walkers to arrive, then `window.__ROAD__.info()` (the last frame’s draws and triangles), the walkers in the frame, the assets fetched from cold (every response under `/models`, `/textures`, `/audio` and the like; the code left out, since the dev server sends it unbundled) and the share of the window the Road’s own UI covers (the ribbon, the prompt, the brand, the Menu and any card up).

| stage | draws | triangles | walkers | assets MB | UI share | page errors |
| --- | --- | --- | --- | --- | --- | --- |
| hobbiton | 5 | 27,249 | 1 | 0.5 | 13.9 % | 0 |
| shire-edge | 7 | 52,273 | 2 | 1.1 | 9.9 % | 0 |
| bree | 11 | 102,171 | 4 | 2.0 | 9.7 % | 0 |
| weathertop | 13 | 127,133 | 5 | 2.5 | 9.8 % | 0 |
| ford | 13 | 127,133 | 5 | 2.5 | 10.0 % | 0 |
| rivendell | 13 | 127,133 | 5 | 2.5 | 9.8 % | 0 |
| caradhras | 21 | 227,025 | 9 | 4.8 | 12.0 % | 0 |
| moria | 21 | 227,025 | 9 | 4.8 | 11.1 % | 0 |
| lorien | 19 | 202,049 | 8 | 4.3 | 9.8 % | 0 |
| anduin | 19 | 202,049 | 8 | 4.3 | 9.8 % | 0 |
| marshes | 7 | 52,273 | 2 | 1.1 | 10.0 % | 0 |
| ithilien | 7 | 52,273 | 3 | 1.1 | 9.7 % | 0 |
| cirith-ungol | 7 | 52,273 | 3 | 1.1 | 9.8 % | 0 |
| gorgoroth | 7 | 52,273 | 3 | 1.1 | 9.8 % | 0 |
| minas-tirith | 21 | 226,935 | 9 | 4.6 | 9.8 % | 0 |
| havens | 19 | 201,639 | 8 | 4.0 | 9.9 % | 0 |

- Draws: 21 at most, against the design’s 350 on `high` and 200 on `low`. A figure is two draws (itself and its ink hull) and about 12,500 triangles twice; the sky and the placeholder ground the rest.
- Triangles: 227,025 at most, against 1,200,000 and 400,000.
- Gollum has no model yet (the owner’s step), so the three from the Marshes to Gorgoroth draw two.
- Download: the most a stage fetched from cold is the nine’s cast, 4.8 MB, under the boot slice’s 8 MB. `WORLD_MB['/middle-earth/road']` stays at 8 until the stages carry their ground and props, with a sentence when it moves.
- The UI covers about a tenth of the window; 13.9 % at Hobbiton is the Road’s own card, up as the ride opens.

### The probe (`node scripts/perf-probe.mjs road`)

`#/middle-earth/road?at=moria`, the world up, 4 s settled, 40 s of the road walking itself; `GPU=webgl`, the container’s Chromium (SwiftShader).

| route | machine | drawn on | quality | ready s | fps | p50 ms | worst 1 % ms | main ms | GPU ms | draws | programs | late pipelines |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| road | container | nodes-webgl | high | 15.6 | 2.9 | 413.4 | 1289 | 407.8 | - | 21 | 12 | 0 |
| road | container | nodes-webgl | low | 14.2 | 3.0 | 487.1 | 878.7 | 487 | - | 21 | 12 | 0 |
| road | owner’s laptop | webgpu | high | | | | | | | | | |
| road | owner’s desktop | webgpu | high | | | | | | | | | |

The frame rate is the software rasteriser’s, not the Road’s: in the same container, at the same window, `/earth` draws at 1.6 frames a second and the Road at 0.8, and the Road at Moria with its sky and its nine walkers hidden draws no faster (the main thread is idle 4.8 s of every 5; the frames wait on SwiftShader). Twelve programs, no late pipelines.

### The pictures (`node lab/road/shots.mjs`)

`shots/<stage>-desktop.webp` (1440 × 900, kept at 960 × 600) and `shots/<stage>-phone.webp` (390 × 844), each stage 20 m in after 5 s of the road walking itself. Looked at: the morning lane, Hobbiton’s and Bree’s starry nights, Caradhras at dusk, Moria black, Lothlórien gold, Gorgoroth under the red pall, the Havens’ sunset; the company changing stage by stage, the one you follow at the back of the file; on a phone the ribbon’s one name, the Walk (76) and Run (52) buttons in the thumbs, no letterbox.

### The Death Star’s letterbox, lifted into the kit

The bars drawn by the old `.ds-letterbox` rules and by the kit’s `Letterbox` with the Death Star’s skin (`--hud-bar: 11%`, `--hud-bar-in: 0.5s`), in a 960 × 600 frame once their animation has run: 0 bytes differ, 22 % of the frame black (two bars of 11 %). The page’s first screen in the container (its graphics-chip gate) before and after: 0 bytes differ.

## R2, the systems and Hobbiton (2026-10-19)

The ground, the scatter, the water, the weather, the ambience, the house with the Ring vision and the post chain, and Hobbiton built in full (the stage recipe). Measured in the container on `nodes-webgl`; **the WebGPU rows are the owner’s machines’ and are left empty**.

### Hobbiton (`node lab/road/measure.mjs hobbiton`, and each beat held)

| where | quality | draws | triangles | assets MB | UI share |
| --- | --- | --- | --- | --- | --- |
| the first beat (Bag End’s door, 6 s in) | high | 49 | 339,778 | 2.4 | 13.9 % |
| the first beat | low | 35 | 139,769 | 4.7 | 13.9 % |
| the Party Field, the crane up (the heaviest frame) | high | 82 | 848,682 | | |
| the Party Field, the crane up | low | 44 | 263,795 | | |
| the dragon over the field | high | 80 | 821,187 | | |
| the dragon over the field | low | 42 | 237,589 | | |

- Against the design’s targets (350 and 200 draws, 1,200,000 and 400,000 triangles): the heaviest frame is 82 draws and 848,682 triangles on `high`, 44 and 263,795 on `low`. The chain adds about twenty draws on `high` (AO, bloom, the grade, SMAA: 51 against 30 before it at the same spot).
- Assets from cold: 2.4 MB at `high` (the Hill’s door, the farm horse, the nature kit, Frodo and Gandalf, Bilbo and the dancers once near); the 4.7 MB at `low` counted the cast that walked in during the slower first frames. Under the boot slice’s 8 MB either way.
- The Road’s own sheets (rain, snow, ash, embers, motes, spray, smoke, fire) are 1.5 to 14 kB each; the eight sounds are made on the context, nothing fetched.

### The probe (`BASE=http://localhost:5173 node scripts/perf-probe.mjs road`)

Moria’s first metre, as R1’s rows; run against the warm dev server (the probe’s own fresh Vite counts its dependency pre-bundling in the ready time: 55 s that way, cold).

| route | machine | drawn on | quality | ready s | fps | p50 ms | worst 1 % ms | main ms | GPU ms | draws | programs | late pipelines |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| road | container | nodes-webgl | high | 36.6 | 4.8 | 4.9 | 9,520.6 | 3.5 | - | 37 | 27 | 7 |
| road | container | nodes-webgl | low | 13.5 | 4.6 | 4.4 | 10,550.1 | 3.2 | - | 37 | 27 | 7 |
| road | owner’s laptop | webgpu | high | | | | | | | | | |
| road | owner’s desktop | webgpu | high | | | | | | | | | |

- The median main thread is a few milliseconds; the worst frames (5 to 11 s here) are node shaders built inside the frame as a stage’s materials first draw (`getProgramParameter`, and three’s builder under `Promise.resolve`): the neighbour stage’s scatter pools, the water and the sprites. On SwiftShader that is seconds; on a graphics chip tens of milliseconds a material. Open for R7: compile each built stage off the frame (`rt.gfx.compile` on its group once lands.js finishes it) before it is drawn.
- `/middle-earth/road?at=moria` comes up (the world on) in 4.6 s from a warm page in the container.

### The pictures

`shots/hobbiton-desktop.webp` and `-phone.webp` (`node lab/road/shots.mjs hobbiton`: 20 m in, the cart coming down the lane), and the beats, each looked at against its film moment:

- `hobbiton-door-desktop.webp`: the first beat’s wide on the Hill, six round doors in its turf, Bag End’s the Sketchfab door, chimneys on the crown; Frodo on the lane. The Shire’s morning.
- `hobbiton-cart-desktop.webp`: the side shot as Gandalf’s cart passes, the bay horse at a slow walk, the fireworks in the bed, Frodo turning to it. “A wizard is never late.”
- `hobbiton-party-desktop.webp` and `hobbiton-party-phone.webp`: the crane up over the Party Field at dusk: the tree, its lanterns, the long tables, eight dancers round them. The party.
- `hobbiton-dragon-desktop.webp`: the dragon, a fiery streak over the field from the tree, under the first stars.
- `hobbiton-vision-desktop.webp`: `window.__ROAD__.vision(1)` on the lane: the world drained to a cold grey-blue, its edges smeared, the sky washed out; the beat takes it for 0.4 s as Bilbo goes.

## R3, stages 2 to 6 (2026-10-19)

The Shire’s edge, Bree, Weathertop, the Ford of Bruinen and Rivendell, each on Hobbiton’s recipe and drawn with its chapter’s own builders (`shire/build.js`, `towns/*/build.js`) on the Road’s town kit. Measured in the container on `nodes-webgl`; **the WebGPU rows are the owner’s machines’ and are left empty**.

### Each stage’s heaviest beat (the beat held, `window.__ROAD__.info()`)

Each stage opened a few metres short of its beat by its address, sped to it (`fast(6)`), held there at one to one, then the last frame read. Assets are everything fetched from cold under `/models`, `/textures` and the like, the neighbours’ included.

| stage | beat | quality | draws | triangles | assets MB |
| --- | --- | --- | --- | --- | --- |
| shire-edge | the ferry (the Rider on the bank) | high | 141 | 991,442 | 4.5 |
| shire-edge | the ferry | low | 128 | 393,717 | 5.9 |
| bree | the riders at the beds | high | 138 | 756,675 | 5.3 |
| bree | the riders at the beds | low | 111 | 256,813 | 7.9 |
| weathertop | the Ring (the vision at full) | high | 97 | 700,348 | 5.9 |
| weathertop | the Ring | low | 116 | 335,358 | 10.0 |
| ford | the flood | high | 144 | 650,057 | 6.9 |
| ford | the flood | low | 181 | 345,574 | 12.9 |
| rivendell | the reveal from the ridge | high | 104 | 694,622 | 10.1 |
| rivendell | the reveal | low | 74 | 360,407 | 10.5 |
| rivendell | the Council | high | 107 | 806,377 | 10.2 |
| rivendell | the Council | low | 64 | 391,635 | 10.6 |

- Against the design’s targets (350 and 200 draws, 1,200,000 and 400,000 triangles) every beat is under on both tiers; the closest are the Shire’s edge at 991,442 triangles on `high` (the chapter’s wheat, four rows deep by the fences) and its 393,717 on `low`.
- Getting there on `low`: the chapters’ builders draw a building in a mesh a material, so a stage’s still meshes are merged one a material (`stages/parts.js`’s `mergeStatics`; Bree’s riders beat from 261 draws to 111 on `low`, 281 to 138 on `high`); a figure is drawn once on `low`, without its ink hull (a skinned figure is never culled, so the hull doubled every walker); the Shire’s edge keeps one row of wheat by the fence on `low`, Rivendell its house alone down the valley, and Rivendell’s Council guests come into the garden only from the bridge.
- Assets: a stage opened by its address fetches its neighbours’ cast and the chapters’ models too, so these are more than a stage adds on the ride; the boot slice (Hobbiton, R2’s 2.4 MB) is unchanged. A `low` row can fetch more than its `high` one: its slower first frames let more of the cast walk in before the reading.

### The pictures

Each stage 20 m in (`shots/<stage>-desktop.webp` and `-phone.webp`) and each stage’s film moment held (`shots/<stage>-<beat>-desktop.webp`), every one looked at:

- `shire-edge-desktop.webp`: the lane between Maggot’s fences, the standing wheat either side, the mushrooms spilt where Merry and Pippin came through the gap.
- `shire-edge-roots-desktop.webp`: from the mouth of the hollow under the old tree’s roots, a hobbit close by and the Rider’s cloaked shape over them against the sky.
- `bree-desktop.webp` and `bree-phone.webp`: the lane on a wet night, jettied houses with lit windows and a lantern at every door.
- `bree-pony-desktop.webp`: the Prancing Pony’s front, Butterbur in its door, its windows warm.
- `weathertop-desktop.webp`: the wide on the hill at dusk, Amon Sûl’s broken ring on its crown, the company small on the road below.
- `weathertop-ring-desktop.webp`: inside the ring under the Ring: the five as pale kings coming on in the wraith-world’s cold light, the blade, Frodo’s shoulder in the foreground.
- `ford-desktop.webp`: Bilbo’s three trolls in stone by the road and the Last Bridge ahead.
- `ford-ford-desktop.webp`: the Bruinen rising across the ford, the foam horses on the flood, the Nine at the far bank.
- `rivendell-desktop.webp`, `rivendell-phone.webp`: the road down past the court and a pavilion, golden birches, the south gate ahead.
- `rivendell-council-desktop.webp`: the Council in the chapter’s court, the company in the ten chairs round the plinth. The Council of Elrond.
- `rivendell-reveal-desktop.webp`: the crane from the ridge across the valley to the falls off the far cliff, the house and pavilions on its slope, the bridge over the stream.

After the lane, mended as they were looked at again (`claude/the-road-3-eriador`’s second pull request):

- `shire-edge-crop-desktop.webp`: 30 m in, Maggot’s corn standing gold to the far hedge, its ears a little over a hobbit’s head (the kit’s wheat had stood 2.4 to 3.3 m, its cut-outs dark cards: `recolourNodes` lost the map’s alpha).
- `bree-riders-desktop.webp`: from over the lane at the Pony’s end, down it to the West-gate on a wet night, the Riders coming up it (the shot had stood inside a roof, black).
- `weathertop-kingsfoil-desktop.webp`: Frodo down by the glowing athelas, a hobbit by him, Aragorn’s brand stood in the verge their one light (the dell’s fire is eighty metres back: it was the athelas alone in the black).
- `ford-ride-desktop.webp`: on the road behind Asfaloth, Arwen and Frodo up, the Trollshaws gold either side (the camera had been behind her head).

What still falls short, for R7: the figures seen from behind at dusk and at night read nearly black; Weathertop’s crags are a cold purple in the evening light; the Ford’s Nine are small dark shapes at the flood’s far edge, and the flood a low ridge rather than a wall of water; Rivendell’s valley is gentler than the films’ gorge and its far cliff stands behind a crest.

## R4, stages 7 to 10 (2026-10-19)

Caradhras and the Doors, Moria, Lothlórien and the Anduin, each on Hobbiton’s recipe and drawn with its chapter’s own builders: the Moria, Lothlórien and Amon Hen chapters split by what they draw so their builders carry no GLSL (`towns/{moria,lorien,amonhen}/`), and their materials made on the Road’s look (`road/moriaKit.js`, `road/lorienKit.js`). Measured in the container on `nodes-webgl`; **the WebGPU rows are the owner’s machines’ and are left empty**.

### Each stage’s heaviest beats (the beat held, `window.__ROAD__.info()`)

As R3’s: each stage opened a few metres short of its beat, sped to it (`fast(6)`), held at one to one, then the last frame read 2.5 s on. Assets are everything fetched from cold, the neighbours’ included.

| stage | beat | quality | draws | triangles | assets MB |
| --- | --- | --- | --- | --- | --- |
| caradhras | the crebain over the ridge | high | 60 | 494,275 | 7.1 |
| caradhras | the crebain | low | 35 | 182,858 | 6.9 |
| caradhras | the white-out (Saruman on the wind) | high | 70 | 463,152 | 7.3 |
| caradhras | the white-out | low | 47 | 194,607 | 7.1 |
| caradhras | the Doors (the ithildin, open) | high | 61 | 385,510 | 7.3 |
| caradhras | the Doors | low | 53 | 312,193 | 10.1 |
| caradhras | the Watcher (Frodo lifted) | high | 74 | 445,554 | 7.1 |
| caradhras | the Watcher | low | 47 | 208,871 | 6.9 |
| moria | Balin’s tomb | high | 73 | 346,933 | 5.9 |
| moria | Balin’s tomb | low | 55 | 199,540 | 5.8 |
| moria | the Dwarrowdelf (the staff flared) | high | 75 | 457,746 | 21.6 |
| moria | the Dwarrowdelf | low | 52 | 183,360 | 6.8 |
| moria | the Bridge (the Balrog) | high | 154 | 416,159 | 5.8 |
| moria | the Bridge | low | 140 | 223,428 | 6.9 |
| moria | the Dimrill Dale | high | 45 | 323,143 | 5.2 |
| moria | the Dimrill Dale | low | 35 | 159,251 | 6.3 |
| lorien | the dais on the flet | high | 67 | 608,496 | 6.9 |
| lorien | the dais | low | 49 | 338,031 | 7.5 |
| lorien | the Mirror (the Eye) | high | 69 | 573,397 | 6.8 |
| lorien | the Mirror | low | 48 | 308,346 | 7.4 |
| anduin | the Argonath | high | 63 | 402,396 | 5.5 |
| anduin | the Argonath | low | 44 | 223,681 | 6.4 |
| anduin | the Seat (the vision) | high | 63 | 416,647 | 5.5 |
| anduin | the Seat | low | 41 | 199,267 | 6.4 |

- Against the design’s targets (350 and 200 draws, 1,200,000 and 400,000 triangles) every beat is under on both tiers; the closest are Lothlórien’s dais at 608,496 triangles on `high` (four mallorns by the road and the great one, each a few tens of thousands) and 338,031 on `low`, and the Bridge’s 140 draws on `low` (the Balrog’s many parts, which the chapter animates and so are not merged).
- The Dwarrowdelf’s 21.6 MB on `high` is the window fetching the cast of the stages either side as it was opened by its address, not what the ride adds there; its `low` row, opened the same way, fetched 6.8.
- Getting there: every stage’s still meshes merged one a material (`mergeStatics`); on `low` the hall is a narrower bay of pillars, three goblins rather than six, six of the Watcher’s arms rather than twelve, three mallorns by the road rather than four, half the far wood and the Anduin’s woods; the crebain are 120 on `low`, 300 on `high`, one instanced draw.

### The ride’s length

The four stages are shorter than the table’s first lengths (170, 180, 150 and 170 m) with their holds trimmed (47, 54, 34 and 42 s): the ride on auto is 1,749 s with stages 11 to 16 still counted at half a minute of holds (`clock.test.js`). Each of the four is 94 to 126 s on auto.

### The pictures

Each stage 20 m in (`shots/<stage>-desktop.webp` and `-phone.webp`) and its film moments held, every one looked at:

- `caradhras-crebain-desktop.webp`: the wide on Hollin’s slope, the company small on the snow’s edge, the black flock wheeling over the ridge.
- `caradhras-snow-desktop.webp`: the white-out on the Redhorn’s shoulder: the walkers grey shapes in it, the sky gone into the fog.
- `caradhras-avalanche-desktop.webp`: the slab come down ahead of them, a burst of white, the frame shaken.
- `caradhras-doors-desktop.webp`: low behind Frodo at dusk, the Doors of Durin in silver lines on the cliff between the two hollies: the arch, the crown and seven stars, the trees.
- `caradhras-watcher-desktop.webp`: the arms out of the black lake in the Doors’ silver light, Frodo hung from the first.
- `moria-tomb-desktop.webp`: the Chamber of Mazarbul, Balin’s tomb in its shaft of grey light, the dead dwarves, the company round it.
- `moria-dwarrowdelf-desktop.webp`: the crane up the Dwarrowdelf, Gandalf’s staff flared and the carved pillars with their runes going on into the dark.
- `moria-bridge-desktop.webp`: from the far bank, Gandalf small on the span, the Balrog over him, its sword of fire raised, the fire red under the abyss.
- `moria-dale-desktop.webp`: out into a grey day, the eight climbing the Dale’s slope, the Mirrormere dark in its hollow, snow on the peak.
- `lorien-haldir-desktop.webp`: Haldir out of the trees by the company, the stair going up beside the road, the mallorns.
- `lorien-climb-desktop.webp`: up the stair behind the company, the flet round the great tree ahead.
- `lorien-dais-desktop.webp`: on the flet, the Lady and the Lord on the dais under the gold crowns, a lantern, the rail.
- `lorien-mirror-desktop.webp`: over the basin, the Eye of fire with its black slit in the water, the Lady watching, Frodo at the rim.
- `lorien-boats-desktop.webp`: Frodo and Sam in a grey boat pulling from the hythe, the flet beyond.
- `anduin-argonath-desktop.webp`: the crane up between the Kings, a hand raised on each side.
- `anduin-seat-desktop.webp`: from the Seat, the vision’s four pictures in the western sky under the vision’s drain (the White City’s tiers, Orthanc, Edoras’ hill), the Seat’s broken columns.
- `anduin-breaking-desktop.webp`: Frodo and Sam alone in one boat on the lake, Tol Brandir grey beyond.

What still falls short, for R7: the white-out’s flakes do not show (the fog carries it); Frodo on the Watcher’s arm is small; the goblins are dark shapes on the pillars; the Balrog’s fire cards are the chapter shader’s to place, so here it is its sword, whip and red glow; the Seat’s pictures are hazy under the vision; the Uruks at the horn run outside the shot; Lothlórien’s seated rowers stand.

## The look (2026-10-20)

The Road made as rich as the chapters it rides through: every stage on its own soil (photo-scanned ground, a ground map in its colours, blades of grass standing round you), mountains on every horizon as the map has them, Hobbiton rebuilt on the Shire chapter’s builders, the older Stylized Nature Pack’s maples, birches and dead trees and the farm pack’s beasts brought in from tilakverse-assets, and the light done again: one key light that casts (the sun, the moon by night), the shade from the light there is, contact AO and a gentle grade. Measured in the container on `nodes-webgl` (no TRAA, so three’s PCF stands in for PCSS); **the WebGPU rows are the owner’s machines’ and are left empty**.

### Each stage (high, settled)

Each stage opened by its address in a fresh window and given twenty seconds to settle (its neighbours in), then the last frame read: its draws and triangles (`window.__ROAD__.info()`: the whole frame, the two shadow cascades’ draws in it) and the assets fetched from cold. The ride goes on while it waits, so a stage reads about 15 % either way from one run to the next.

| stage | draws | triangles | assets MB |
| --- | --- | --- | --- |
| hobbiton | 430 | 1,589,996 | 9.1 |
| shire-edge | 250 | 1,152,181 | 7.4 |
| bree | 416 | 1,108,814 | 8.6 |
| weathertop | 71 | 901,396 | 8.4 |
| ford | 143 | 1,210,378 | 13.0 |
| rivendell | 252 | 1,325,349 | 11.7 |
| caradhras | 52 | 458,919 | 6.4 |
| moria | 23 | 127,432 | 4.3 |
| lorien | 147 | 751,573 | 10.1 |
| anduin | 124 | 459,046 | 7.7 |
| marshes | 71 | 1,038,318 | 4.7 |
| ithilien | 93 | 888,353 | 8.7 |
| cirith-ungol | 43 | 266,285 | 2.8 |
| gorgoroth | 56 | 351,742 | 4.4 |
| minas-tirith | 144 | 909,787 | 6.2 |
| havens | 60 | 702,768 | 6.3 |

- Against the site’s high budget (`src/lib/budgets.js`: 3,000,000 triangles, 700 draws) every stage is well under. Against the Road’s own design (1,200,000 and 350) most are under; Hobbiton (1.4 to 1.6 million, about 420 draws), Rivendell (1.3 million) and the Trollshaws (1.2 million) are over by a little, and Bree’s draws (about 415) too: the price of their woods, their props in bands and the two cascades.
- Getting there from 2 to 3.6 million: only trees, bushes and rocks cast (`scatter.js`’s `CASTS`: the grass, flowers and pebbles had drawn into four cascades); two cascades out to 60 m (`video.cascades`, `shadowDistance`); statics merged a 60 m band at a time (`mergeStatics`’s `band`) and Hobbiton’s hedges and oaks the same, so a cascade or the view leaves out what it can’t see; Maggot’s wheat casts none; grass rows keep within 70 m of the road (a test holds it: the Havens’ dune grass across its width was four million alone); the woods new this lane trimmed where they weighed most.

### What changed, and why it looked wrong before

- **No shadows at all**: the cascades were there (`lib/three/light/sun.js`), but PCSS (`shadows.js`) drew none on the WebGL fallback, and its per-pixel noise is a grain without TRAA. PCSS is taken only where the chain ends in TRAA; three’s PCF at a small radius everywhere else. Only trees, bushes and rocks cast (`scatter.js`’s `CASTS`), out to 60 m.
- **Shadows that barely read**: under a low sun the lit ground stood half in the house look’s shade already; the Road’s look turns to light sooner (`[0.1, 0.55]`), and the shade comes from the light there is (`daylight.js`’s `shadeOf`): a day’s pale lilac, a fainter blue under the moon (the day’s lilac made Bree’s lane violet), brown under the pall.
- **Backs black, the Marshes and Mordor lost**: the sky light is the chapters’ strength (`skyLight`); the Marshes and Gorgoroth open their exposure; Mordor’s fires glow up from its ground (a soil’s `glow`).
- **The grass**: grassNodes’ blades showed the camera their back, so three lit them from below and never by the sun (lime under a green ground light, dark under a high sun); the Road’s face the camera (`faceCamera`), lie down within 4.5 m of it (`near`), take the sun’s shadow on high, grow up the Hill (`ground.mounds`), and are tinted in slow patches. The AO is a short contact shadow: wider, it darkened a field a fifth.
- **Bree**: the lamps lay warm pools on the wet street (`stages/parts.js`’s `lampPools`, one draw, no light added).

### The pictures

Each at a beat of its stage, desktop, looked at (taken before the triangles were trimmed: two cascades rather than four, and a little less of the new woods, since):

- `look-hobbiton-40-desktop.webp`: Frodo on the lane, his shadow across it, the oak’s on the Hill, a hole with its fence, maples just turning amber, the grass light and patched.
- `look-shire-edge-90-desktop.webp`: the hollow under the old tree’s roots, the hedges into the wood, the tree’s shade over the grass, the ferry ahead.
- `look-bree-60-desktop.webp`: Bree’s street at night under the moon, blue, the lamps’ pools warm on the wet lane by the Pony.
- `look-weathertop-30-desktop.webp`: the hill against the dusk, its stones and dead trees, the heath and the rocks readable.
- `look-ford-120-desktop.webp`: Asfaloth and Frodo by the Bruinen, the Trollshaws’ maples red among the gold, the birches white, the mountains.
- `look-rivendell-40-desktop.webp`: the bridge over the river, the pavilions and the lanterns, the gold trees, the mountains round the valley.
- `look-lorien-40-desktop.webp`: the company climbing to the flet among the mallorns’ grey trunks, the gold grass short under them.
- `look-marshes-60-desktop.webp`: the Dead Marshes grey and gloomy but seen: the reeds, the track, the Ephel Dúath beyond.
- `look-ithilien-60-desktop.webp`: Ithilien’s woods in spring leaf, the flowering bushes, the road through.
- `look-gorgoroth-60-desktop.webp`: Mount Doom aglow and Barad-dûr with the Eye, the hobbits on the ash in the fires’ red.
- `look-minas-tirith-60-desktop.webp`: the company on the Pelennor’s road, the White Mountains grey under their snow.
- `look-havens-60-desktop.webp`: Gandalf and Bilbo ahead in the dune grass, the pines, a maple red.

What still falls short: Mordor is dark (on purpose, but the ash is near black away from the fires); the blades read a little darker than the field beyond them under a high sun; the galaxy’s and the Shire chapter’s grass still show their backs (`faceCamera` off: they were tuned so); the PCSS filter’s WebGL failure is noted in the hand-off, not fixed.

## Doing, not watching (2026-10-20)

The owner, after the look: the Road made no sense, you could pass through things, there was no Minas Tirith, nothing to do, and no telling it from the chapters. This section is the first three answered; the White City and the stages after the Anduin are the next pull request's.

### What there is to do

Twelve of the Road's moments now wait for the visitor (`deeds.js`, `doing.js`): the walk stops at the beat, the beat plays up to its deed's moment (`deed.at`) and holds there, and the page asks.

| stage | beat | deed | how |
| --- | --- | --- | --- |
| hobbiton | dragon | Light the dragon | E |
| shire-edge | roots | Keep still, and keep the Ring off | hold E, 4 s |
| bree | gate | Knock at the West-gate | E |
| bree | pony | The name you give at the Pony | Baggins, Underhill, Took (Sam and Pippin answer a wrong one) |
| weathertop | fire | Drive them back with fire | A and D in turn, 12 |
| ford | ride | Ride for the Ford | A and D in turn, 10 |
| ford | ford | Call up the river | E, 5 s in |
| rivendell | council | Stand up and say you'll carry it | E, 7.5 s in (Frodo's line after) |
| caradhras | snow | Push on through the snow | A and D in turn, 12 |
| caradhras | doors | Speak, friend, and enter | Edro, Annon, Mellon (Gandalf answers a wrong one) |
| moria | bridge | Hold the bridge with Gandalf | hold E, 3 s, 8 s in (the line, then the staff at 11) |
| lorien | mirror | Look into the Mirror | E (Galadriel's clip after) |
| anduin | argonath | Paddle under the Pillars of the Kings | A and D in turn, 12 |

Letting the road walk itself, the company does a deed after 20 s; under reduced motion each is one press (Enter or E); on touch the keys are buttons. T (or Talk) has whoever walks with you say the stage's next line (`talk.js`: three to seven a stage, in the site's own words, then each one's own); every line the cast says is now a subtitle (the page never showed them: unvoiced, they were silent); each title card says the tale so far (`stages/tales.js`).

### Nothing walked or seen through

Each stage's build is laid into a grid of what stands solid along its road (`solids.js`: half-metre cells 12 m either side of the lane, 64 half-metre layers over the ground, from the merged statics and the instanced dressing, never what a scene moves), a slice of 40,000 triangles a frame: Bree's 3,817 cells, Hobbiton's 2,846, Moria's 5,814. On it (`clear.js`) the walkers ease round what stands in their lane (1.6 m/s, looking 3 m ahead), a shot hung off the lead pulls in along its boom short of a wall, a placed shot is moved out of what it's in, and a figure the camera comes into isn't drawn while it's there. The follow and the low shot stand off the lead's left shoulder: straight behind, a toy's big head filled the middle of the frame (the Doors' low shot had Frodo's head where the Doors are).

### The fellowship's gear

Gandalf's staff (the Grey's gnarled, a crystal in its head; the White's straight) held planted in the right hand; Gimli's axe carried the same way; Legolas's bow upright in his left, a quiver on his back; Aragorn's sword at his hip; Boromir's sword and his round shield on his back (`gear.js`, `lib/three/held.js`). The worn things were never on until the body measure read a Meshy figure's skin through its bones: the mesh sits under an armature scaled a hundredth.

### The pictures

- `deed-doors.webp`: the Doors in the moonlight, the ithildin out, the deed's three words.
- `deed-doors-wrong.webp`: Edro struck through, Gandalf's answer as a subtitle.
- `talk-bree.webp`: Bree's street at night from over Frodo's shoulder, his line as a subtitle, the prompt naming Sam next.
- `gear-fellowship.webp`: the five close (Caradhras' foot): Aragorn's side and front, Boromir's shield from behind and his front, Gandalf with his staff, Gimli with his axe, Legolas's quiver from behind and his bow.

What still falls short: the six stages after the Anduin are not built (Minas Tirith among them: the next pull request); the new lines aren't voiced yet (`scripts/voices` on the owner's desktop); in the container a CSS fade begun after the 3D loop is busy never starts (the deed card has no backwards fill so it shows regardless).

## The road to the Havens (2026-10-20)

The owner again: the Road made no sense, there was no Minas Tirith, and it was no different from the chapters. The six stages after the Anduin are now built, each on its chapter's own builders under the Road's light, each with something to do; the ride ends at the Havens.

### Each stage (`clock.test.js`'s ledger, on auto)

| stage | length | holds | on auto |
| --- | --- | --- | --- |
| the Dead Marshes | 150 m | 42 s | 102 s |
| Ithilien | 160 m | 62 s | 126 s |
| Cirith Ungol | 150 m | 42 s | 102 s |
| Gorgoroth | 180 m | 60 s | 132 s |
| Minas Tirith | 160 m | 34 s | 98 s |
| the Grey Havens | 290 m | 24 s | 140 s |

The whole ride is 1,797 s on auto, the deeds' waits aside. The per-beat draws and triangles on both tiers, as R3 and R4 took them, are R7's still: the container draws a frame a second in software and the evidence below took most of the session's browser time.

### What there is to do

| stage | beat | deed | how |
| --- | --- | --- | --- |
| marshes | faces | Pull Frodo back from the water | hold E, 3 s |
| ithilien | crossroads | Look up at the fallen king | E |
| ithilien | vale | Keep hold of Frodo | hold E, 4 s |
| cirith-ungol | shelob | Raise the Phial | E, 7.5 s in |
| gorgoroth | beam | Keep still under the cloaks | hold E, 4 s |
| gorgoroth | carry | Carry him up the Mountain | A and D in turn, 14 (Sam's clip after) |
| gorgoroth | cracks | Reach for Frodo's hand | hold E, 3 s, 13 s in |
| minas-tirith | court | Bow to the King | E, 9 s in (the court bows to the four) |
| havens | farewell | Say goodbye | E (Frodo goes up into the ship by the gangway) |

### What each stage is

- **The Dead Marshes**: the rope down the Emyn Muil, Gollum tamed, the candles in the mist and the faces under the water (the deed pulls Frodo back from them), the fell beast's shadow, the Black Gate.
- **Ithilien**: green again under the woods, the Haradrim and their mûmakil on the road below, Faramir's rangers, Henneth Annûn behind its falls, the fallen king at the Cross-roads, the Morgul Vale's tower lit and its host going out; Minas Tirith a white landmark on the horizon to the west.
- **Cirith Ungol**: the stair up the cliff, Sam sent back, the tunnel with the Phial the one light, Shelob and Frodo stung, the tower and Frodo found, and out between the Watchers.
- **Gorgoroth**: the Mount Doom chapter's own mountain ahead, its fire and its plume; the orc column marching with its driver's whip; the Eye's beam sweeping the plain over the two under their cloaks; Sam carrying Frodo on his back; the cut down into the Sammath Naur, Gollum's fall and Sam's hand; the Mountain breaking, Barad-dûr sinking and the Eye going out (the backdrop's fall); the rock in the fire and the Eagles.
- **Minas Tirith**: the chapter's own city on its knee of Mindolluin, its seven walls up to the Citadel, its stone lifted white under the Road's light; the causeway, the Great Gate, then the Court of the Fountain and the White Tree flowering as the court bows to the four.
- **The Grey Havens**: the Gulf at sunset, the long grey quay and its lamps, the white ship with the swan prow, those sailing aboard; the farewell, the gangway, and the ship away down the lane into the light, the three left on the quay.

### Fixed on the way

- The Havens' sea had trees and reeds standing in it: a stage's `ground.sea` now makes the land wet under it, so the scatter keeps to the beach; the last stage's land no longer rises back to the seam at its far end.
- The four stood in the quay's coping (its top a tenth over the floor the scene gave them); Frodo went up into the ship through her side, not over it (now by a gangway).
- After the bow at the Court the King's side turned their backs on the four: the kneel clip was looped from its start, not held at its kneel.
- Gorgoroth's carry was shot from over the two at the ash, Frodo hiding Sam; it's now from beside, staged as the chapter stages it (Sam bent under him, Frodo on his back). The chapter's place for Frodo left most of a metre between them on the cast (the sat clip leans him back, the carry bends Sam forward; their bones measured 0.3 m apart in the page), so his place is ahead of Sam's. A scene's poses are also given the lead's place, so a pair a scene stands together no longer depends on which is asked first. The eruption's shot looked back at the sky since the Mountain moved ahead: it now faces the Mountain and the Tower.
- A whole city in the shadow pass threw on the WebGL fallback (`updateColor` reading `.r` of undefined): the city and Gorgoroth's props cast nothing into the cascades.

### The pictures

- `marshes-built-desktop.webp`, `ithilien-built-desktop.webp`, `cirith-ungol-built-desktop.webp`: the three stages R5's first session drew, merged in.
- `minas-tirith-built-desktop.webp`: the Pelennor and the causeway up to the Great Gate, the city filling the sky.
- `deed-minas-tirith-court.webp`: the Court of the Fountain, the King before the White Tree, the four before him, the deed's card.
- `minas-tirith-bowed-desktop.webp`: after the bow, the King and his side knelt to the four, the White Tree in flower.
- `havens-built-desktop.webp`: the Gulf at sunset from the beach, the quay out to the white ship.
- `havens-quay-desktop.webp`: out along the quay, the ship at its end.
- `havens-gangway-desktop.webp`: the farewell: Frodo going up the gangway over her rail, the three on the quay, those sailing aboard.
- `gorgoroth-built-desktop.webp`: the plain under the pall, the Mountain filling the sky, its plume and its fire; the column's spears on the road.
- `gorgoroth-column-desktop.webp`: the two among the orc column, the driver with his whip.
- `gorgoroth-carry-desktop.webp`: from beside on the slope, Sam bent under Frodo on his back.
- `gorgoroth-eruption-desktop.webp`: the Mountain breaking, fire out of its cone and down its streams, from the slope's top.

## Minas Tirith on the map, and fifty-one things to do (2026-10-21)

The owner: make the Road perfect, with a lot of interactions, and put Minas Tirith on the map.

### Minas Tirith, a chapter

It was a hidden place, found only by clicking the white city. Now it's the road's twelfth stop and last chapter, after Mount Doom (`road.js`, `chapters.js`; the way home to the crowning, 1 May 3019, about 145 miles on in `geography.js`'s `ROAD_MILES`), with its pin over the city, its chip at the end of the route row, and "On to Minas Tirith" from Mordor; a tap on the city itself goes where its pin does. Its five quests each win a seal (the seven gates, a Guard of the Citadel, the beacons lit, the siege of Gondor, the Return of the King), and progress made before wins them on the next visit (the court's toast: "A Guard of the Citadel"). Like every chapter it has a game on the side, "Gondor calls for aid" (`towns/minastirith/beacons.js`, `BeaconsPanel.jsx`: the seven beacons from Amon Dîn to Halifirien catching west along the White Mountains, named back in order, three to seven), and a kitchen, the Houses of Healing (`rush/levels/houses.js`, `themes/houses.js`: athelas steeped in the kettles, bread, and water from the cistern, Beregond calling the orders, in a white hall of beds with the King going among them).

### What there is to do

Twenty-nine new deeds, fifty-one in all, two or more on every stage (`stages/deeds.test.js` holds it); each has a line after it in the site's own words, and a choice has a word back for each wrong answer.

| stage | the deeds |
| --- | --- |
| Hobbiton | Light the dragon; dance the jig at the party (A D); take Sam past the corn |
| The Shire's edge | catch the mushrooms; keep still under the roots; pole the ferry across (A D) |
| Bree | knock at the West-gate; the name at the Pony; lie still while they search the beds (hold); follow Strider out the back way |
| Weathertop | stamp out Sam's fire (it goes out); drive them back with fire (A D); hold Frodo still for Aragorn (hold) |
| The Ford | look up at the stone trolls; take Arwen's hand; ride for the Ford (A D); call up the river |
| Rivendell | stand up and say you'll carry it; touch the shards of Narsil; take Sting from Bilbo |
| Caradhras | hide under the rocks from the crebain (hold); push on through the snow (A D); speak, friend, and enter; hack at the Watcher's arm while it holds Frodo up (A D) |
| Moria | read the Book of Mazarbul; bar the door; hold the bridge with Gandalf (hold) |
| Lothlórien | greet Haldir (Mae govannen, Mellon or Edro); look into the Mirror; take the Lady's gift |
| The Anduin | paddle under the Pillars (A D); run to the horn; pull Sam into the boat (hold) |
| The Dead Marshes | let Sméagol off the rope; pull Frodo back from the water (hold); down in the water under the fell beast (hold) |
| Ithilien | keep down in the ferns from the Southrons (hold); tell Faramir who you are (three names); look up at the fallen king; keep hold of Frodo (hold) |
| Cirith Ungol | brush the crumbs off Sam's cloak; raise the Phial; fight up the stair to Frodo (A D) |
| Gorgoroth | keep still under the cloaks (hold); carry him up the Mountain (A D); reach for Frodo's hand (hold) |
| Minas Tirith | look up at the White City; walk in through the Great Gate; bow to the King |
| The Grey Havens | say goodbye; wave to the three on the quay |

The keep-still deeds have the company crouch with the visitor while it's held, and through the beat's hold once done (`doing.js`'s `stance`). Letting the road walk, the company does a deed after 10 s (20 s across fifty-one deeds was a quarter of an hour of waiting). In the page: Haldir's wrong word gets his answer and the right one, after it, lets them on; Sam's fire dies once it's stamped out (its light 5.2 at the stamp, falling as the beat runs on past the deed: the scene reads `since.dell > deed.at`).

### The pictures

- `map-minas-tirith-desktop.webp`: the map with Minas Tirith's pin over the white city, and its chip last in the route row.
- `minas-tirith-beacons-desktop.webp`: Gondor calls for aid in the Court, the seven peaks and the names shuffled to give back.
- `deed-lorien-haldir.webp`: Greet Haldir, under the mallorns, Mellon struck through.

### Fixed on the way

- The Cracks' shot stood on the ash over the Sammath Naur: the director lifts every camera over the land, and a placed shot may now say it's `under` it. On a jump into the middle of the Cracks the chamber wasn't drawn (its beat long done): it is now while the walker is within the beat's reach.
- The Eagles' shot sat at the ground looking into the White City's green Pelennor, drawn beside Mordor's ash: Minas Tirith is now a stage the Road cuts to (`cut`), its land never drawn beside Gorgoroth's (its trees given back while hidden); the Eagles' shot looks down from the slope (clear of its crest, which hid the rock from further up) on the two lying on their rock, a fire light on it now (the chapter's red glow is its own shader); the Eagles come down over the camera, and it goes to black, and the White City opens out of black on the Pelennor.

- `gorgoroth-cracks-desktop.webp`: the Sammath Naur, the spur over the fire, Frodo at its tip and Sam behind.
- `minas-tirith-pelennor-desktop.webp`: the White City from the Pelennor as the stage opens, the causeway up to the Great Gate.
- `gorgoroth-eagles-desktop.webp`: the Eagles down over the rock in the fire, lit orange by it, the two just taken up.

## The end, on the desk (2026-10-21)

Task 33 on the site as it is now: `/middle-earth` is the Red Book on Bilbo's desk (the book's design), and the map is `/middle-earth/map`.

- **The end is the desk.** The Havens' white goes to `/middle-earth?from=road`, the Red Book open at its first page with "Back at Bag End. The Road goes ever on. Now walk it yourself: Play it opens the Shire." (`RedBook.jsx`'s `HOME`, read once, the address put back to `/middle-earth`).
- **The achievement**: `lotrRoad`, "The Road, ridden" (walked the Ring's road from Bag End to the Grey Havens), won at the end when two thirds of it were walked (`'end'` now says `{ ridden }`; `TheRoad.jsx` unlocks it). Skipping to the end wins nothing.
- **The hub's first step** (`hub/hubState.js`'s `firstStep` and `ghost`, wired for the first time): someone new is offered **Ride the Road**, Begin at the Shire beside it; once ridden with nothing won, **Now walk it yourself · Begin at the Shire**, Ride the Road again beside it; part-way, Carry on as before, the Road beside it. The lead says "Ride the Road first, or pick a place on it and go there" until it's ridden.
- **Watch the passage**: beside "Enter" when Frodo reaches a place, the Road from that place's stage (`redbook/routes.js`'s `walkFor`).
- **The journal**: "The road so far" opens on the Road's row, "The Road · ridden 21 October 2026" (or not ridden yet) and a way to ride it (`record.js`'s `roadRidden`). The save keeps the day it was first ridden (`on`), and starting again no longer forgets a ride made the same visit.
- Not wired: `entry.js`'s `firstVisitRides` (a first visit sent down the Road). The Red Book is the front door now and opens itself as you arrive; the hub offers the ride first instead.

Looked at in the page (the node renderer on WebGL 2, in software): a fresh visitor's head reads Ride the Road and Begin at the Shire; one with a ridden save reads Now walk it yourself and Ride the Road again, the journal's row with its day; the Road opened at the Havens and skipped to the end lands on the book with its words, and `lotrRoad` is won; no page errors.

- `hub-ride-first-desktop.webp`: a first visit's map, Ride the Road the first step.
- `hub-ridden-desktop.webp`: after the ride, Now walk it yourself, and the road so far with the Road's row.
- `redbook-home-desktop.webp`: the end on the desk, the book at the Shire with walk it yourself.

## The Dead Marshes, wet (2026-10-21)

At 60 m the Marshes read as a dark grass field (`look-marshes-60-desktop.webp`): the three pools were the only water, and the ground's grass grew in them over the water.

- **The water, for the ground and the props alike**: `stages/marshes/water.js`, pure. It holds the three pools with the candles and the faces, and eleven meres between them, either side of the track from 40 m to 118 m, each kept 4 m or more off it.
- **The ground** sinks a hollow for each (its relief, the meres after the mountains so the layers before keep their seeds) and plants nothing in any of them (its `clear`, a little inside the hollow's edge so the rim is grown).
- **The props** stand reeds round every pool's and mere's edge (in the reeds' one draw), and a candle over every other mere on high. On low, the far meres are left dry: their water is a draw each.
- **The water** is murky now: `water.js`'s new `murk` gives a pool the bog's own colour and dulls the sky off it (0.85 in the Marshes).
- `stages/marshes/water.test.js` holds the meres off the track and off one another, over the whole marsh, and the ground's hollows and clear rings to the list.

- `marshes-meres-candles-desktop.webp`: the candles' beat at 60 m, the meres either side with their reeds and two candles over them.
- `marshes-meres-desktop.webp`: walking at 79 m, Gollum leading, the water lying all the way out to the Gate's mountains.

## Gorgoroth's plain (2026-10-21)

The plain before the Mountain was bare dark ground near the road (`look-gorgoroth-60-desktop.webp`). Now it's dressed as the films have it (`stages/gorgoroth/plain.js`, its places pure in `place.js`):

- **Ash boulders and fangs of rock** either side of the road: three boulder shapes and the fangs from the Mount Doom chapter's kit, 186 on high (a draw a shape), thick near the road and thinning out. They're off the lane and the column's road, clear of the camps and short of the Mountain's slope. Those within the solid grid's reach stand solid: the camera and the walkers keep out of them.
- **Two orc camps** off the road, their fires burning (the chapter's `camp`; one on low).
- **Cracks in the plain** with the fire under it showing through: 28 on high, one mesh. Each is a ribbon dark at its edges and white-hot down its middle, added, over 1 so the house bloom takes it, breathing slowly. `plain.test.js` holds the strewing and the cracks off the lane, and the same on every load.

- `gorgoroth-plain-desktop.webp`: the plain's beat, the cracks glowing under the Mountain, the fangs and the column.
- `gorgoroth-plain-column-desktop.webp`: walking beside the column, boulders and fangs either side, a camp's fire far off.
- `gorgoroth-plain-cracks-desktop.webp`: at 51 m, before the Eye's beam, the cracks round the two.

## Shelob's Lair, and Carry on (2026-10-21)

- **The Lair** was big flat grey facets (`cirith-ungol-built-desktop.webp`). Now:
  - It is the Cirith Ungol chapter's own black rock, tiled a metre and a half over the arch and along it, and darker.
  - It is lumpier, with a third octave for the knobs and drips, and finer on high (24 round, a row every 1.5 m).
  - It has 30 webs on high, every third one slung across the roof's corner overhead, and thicker the deeper in.
  - `cirith-ungol-lair-desktop.webp` shows it at 70 m, the Phial ahead, the webs on the walls and the roof.
- **Carry on** (the resume card) picks the ride up a few metres before a moment it was left inside, so the moment plays again rather than the camera holding on what's over (`carry.js`, its test and the module's).

## A walk through every stage, and what it found (2026-10-21)

Twelve stages were pictured mid-walk afresh (`lab/road/shots.mjs`), and four things fixed from them:

- **Caradhras' snow**: a piece of the far range stood over the white in the blizzard, its foot taken by the fog and its top not. `backdrop.js`'s new `thickness(density)` lets a storm's fog take the ranges and landmarks with it: none in any stage's own air, all in Caradhras' snow (`backdrop.test.js` holds it to every stage's light and both storms). `caradhras-storm-before-desktop.webp`, `caradhras-storm-desktop.webp`.
- **Bree's streets**: the blade grass stood up through the cobbles, black spikes under the lamps. A stage's ground may now name `bare` places (its paved ones: the paint is its dirt and grows no grass, easing back over 3 m), and Bree's town is three; the fields before the gate keep their grass. `bree-street-before-desktop.webp`, `bree-street-desktop.webp`.
- **Moria's stair**: going down it Gandalf is 16 m ahead and 11 m under them, and the staff's light stops short of the ones behind; they were nothing. A faint cold light over Frodo, the staff's off the walls, makes them dim shapes. `moria-stair-before-desktop.webp`, `moria-stair-desktop.webp`.
- **The rivers**: two regular swells seen at a slant flipped the water between the sky and the deep in white stripes (Rivendell, the Ford, the Anduin). The swell is lower (0.05 m, from 0.08), calmed off into the distance from 6 m, and running water gives back at most 0.7 of the sky. `rivendell-river-before-desktop.webp`, `rivendell-river-desktop.webp`.

## Henneth Annûn's fall (2026-10-21)

From behind the fall, at Faramir's window, the fall read as a pale fog: three broad bands falling down a sheet. It is now threads of water, in two layers (360 and 140 across its 8 m, a few centimetres each with the camera a metre and a half off), each thread at its own pace and phase. They are thinner between, so the light beyond shows through, with white foam at its foot. `ithilien-henneth-before-desktop.webp`, `ithilien-henneth-desktop.webp` (walked into, 3 s in).

## The grain on WebGPU (2026-10-21)

The owner's backend is WebGPU, and every picture here till now was the node renderer on WebGL 2. The lab draws on WebGPU now (`GPU=webgpu`, `lab/road/common.mjs`), and `lab/road/probe-grain.mjs` measures the flicker: six frames of Hobbiton at 40 m on high, the walk stopped, each pixel's change from frame to frame.

| WebGPU, high | mean | pixels over 6 | the sky and hills |
| --- | --- | --- | --- |
| TRAA (before) | 1.19 | 4.21% | 0.32 |
| none | 0.60 | 1.99% | 0.01 |
| SMAA (after) | 0.68 | 2.30% | 0.01 |

Under TRAA every edge crawled: the hills and the trees against the sky, Bag End's roof and its fence (`grain-hobbiton-traa-webgpu.webp`). A view of the velocity buffer showed why the grass did. The hills read still, but the wind's blades were moving fast every frame, so TRAA took them nearly whole, jitter and all. High and ultra end in SMAA now, as they did on WebGL 2. What still changes is what moves: Frodo, and the grass in the wind (`grain-hobbiton-smaa-webgpu.webp`; the frame, `hobbiton-smaa-webgpu.webp`).

## A road underfoot, grass in blades, the kit's trees (2026-10-21)

Toward the owner's "focus more on the foliage and look of the world … making the roads better. Adding texture".

- **The road**: it was the ground map's paint, a metre a texel, so a soft brown band. `track.js` lays a ribbon down it, shaded in the road's own frame, with a row for each of twelve stages (`stages/tracks.js`):
  - The Shire's lanes have two wheel ruts and the grass down the crown.
  - The wild's paths have one trodden line, packed pale.
  - All have stones with the shade at their foot, an edge broken into the verge, and water in Bree's ruts.
  - The first version drew nothing: wound face down, it was culled from every camera, as Gorgoroth's cracks were. `track.test.js` holds every triangle face up.
  - Pictures:
    - Hobbiton at 60 m, before and after: `road-lane-before-desktop.webp`, `road-lane-desktop.webp`. The kit's oaks and the verge's tufts are in the after too.
    - Its lane at eye height: `road-lane-eye-desktop.webp`, from `lab/road/probe-look.mjs`, which holds the camera over a road's middle.
    - The Shire's edge: `road-lane-field-desktop.webp`.
- **The grass**: one broad triangle a blade, spread evenly, was a carpet of green cones at every verge. Each is now a curved blade tapering to its tip, four to a tuft, leaning its own way, a tip yellow here and there (grassNodes' `shape: 'blade'`, `tufts`).
- **The trees**: the chapters' round ones by the lane are the nature kit's leafy ones, where they stood: Hobbiton's twelve oaks, Rivendell's fourteen birches and the Ford's thirty. The older pack's birches, balls of yellow on a stick, are the kit's `Birch_1` to `Birch_5` everywhere. Rivendell from its bridge, before and after: `rivendell-birches-before-desktop.webp`, `rivendell-birches-desktop.webp`.
- **The verges**: nothing grew nearer a road's middle than 6 m. A row may line the road now (`verge`), so the Shire's lanes have long tufts, flowers, clover and stones by them, the wild's paths heath and stones, Lothlórien elanor, Ithilien its herbs.
- **The White City and the Mountain** wear the site's photo scans, as their chapters dress them. The Road built both undressed. The city from the Pelennor, before and after: `minas-tirith-dressed-before-desktop.webp`, `minas-tirith-dressed-desktop.webp`. Its road has its own darker earth (a track row's `dirt`): in the Pelennor's pale soil it read as sand.
- **The far ground**: the photo scans end at 80 m, from 120. A two-metre scan's repeat showed as a lattice on Weathertop's hill at dusk.


## A laptop's own chip (2026-10-22)

Toward the owner's "check for lighting and WebGPU shaders in laptop conditions without a dedicated GPU", for the Road and the Middle-earth chapters.

**Where a laptop's chip lands.** Nothing here changes it; it is the 2026-10-13 design's.

- Auto reads the chip by its name (`lib/gpuGrade`). An Iris Xe or a Radeon 740M scores 40, and UHD and the built-in Vegas less. Those are Low, and renderer tier T0 for `'name'` with no probe.
- A Radeon 680M (60), 780M (71), Intel's Arc graphics (85, 90), an Apple M1 (60) or M2 (80), or a Snapdragon X1-85 (55) is Auto ultra by its name. The one-second probe then holds one over 8 ms at Low (T0, `'slow'`), and under the rest the GPU clock's controller steps the resolution down.

**The lab as such a chip.** WebGPU on Dawn's SwiftShader adapter, held to WebGPU's default limits (`LIMITS=default` in `lab/road/common.mjs`). That is 16 sampled textures and 16 samplers a stage, 8 storage buffers, 32 bytes of colour attachment a sample and 16 inter-stage variables, the least a built-in chip has. The Road was surveyed at Low and High, and every chapter's page at Low. No pipeline was refused at those limits. What was wrong:

| | before | after |
| --- | --- | --- |
| A ride through Ithilien, Cirith Ungol and Gorgoroth | 2,256 errors, "buffer used in submit while destroyed"; the frame frozen from there on (`laptop-frozen-before-webgpu.webp`: Cirith Ungol and Gorgoroth, the same frame) | none |
| Pipelines over eight places, Caradhras to the Anduin and back | 1,032; the scene under 3 to 8 lights, by place | 528; the same 6 lights everywhere |
| Moria at 90 m | black, 74% of the frame crushed at Low and at High (`laptop-moria-deeps-before-webgpu.webp`) | 34% at Low: the company on the stair, seen from beside it, lit by the fire below |
| Lothlórien's chapter, on WebGPU at Low and High | the company black; a white Lambert stand-in on the ground black (`laptop-lorien-chapter-before-webgpu.webp`, `laptop-lorien-unlit-before-webgpu.webp`) | lit, the ground in the sun (`laptop-lorien-chapter-webgpu.webp`) |

- **The frozen frame**: three's Sprites share one geometry, made once. A stage given back with its geometries freed (Ithilien's, as the ride left it) took that one too, and every sprite still drawn was left on destroyed buffers: Cirith Ungol's Phial, Mount Doom's glow, the orc camps' fires. On WebGPU each frame's submit then failed. `BUFFERS=1` labelled every buffer, and `probe-destroyed.mjs` found the sprites drawn on dead ones. `runtime/webgpu.js`'s `keepSpriteGeometry` keeps it.
- **The pipelines**: three keys every lit shader by the ids of the lights it is drawn under. A stage's own point lights coming into the scene and going, a neighbour's shown and then not, built every material on the Road again at each seam: seconds of missing objects on a slow chip. They draw through `lamps.js`'s pool now (`probe-seam.mjs`).
- **The chapters' black company**: `lib/three/pipelineGuard.js` builds a held-out object's shader after the frame. three's `Lighting` puts a scene's lights back to what it held before each render, which was none, so those shaders were built unlit. The guard now leaves a scene's lights in place once its render is over. WebGL 2 builds in the frame and never showed it; the Road kept its lights because its `compileAsync` sets them.
- **The deeps**: Moria's black air left the house look nothing to measure light against (`daylight.js`'s `refFloor`). Its stair is shot from beside it (`laptop-moria-tomb-webgpu.webp` is the tomb in its shaft of light; `laptop-cirith-phial-webgpu.webp` is Shelob's lair by the Phial).
- **Warnings a laptop's console showed, gone**:
  - "PostProcessing has been renamed", once a chain.
  - A Gollum model asked for that has not been made: four requests a visit.
  - Moria's way-walls without roles.
  - Lambert's `roughness`.
  - Minas Tirith's chapter renaming a shader variable, eight times.
  - The Shire's grass without a normal. Three put a zero there, and a hook's normalize made it NaN, which a chip may draw black.
- **Left, the chapters'**:
  - The Shire's glints and fireflies, and one mesh in Lothlórien, have a map and no uv. On WebGPU a point is a pixel, so the glints are specks.
  - Moria's and Minas Tirith's chapters ask `toNonIndexed` of geometry that already is.

Every stage at Low on WebGPU, held to the default limits, after all of it: `laptop-low-webgpu-sheet.webp`, with no error. Gorgoroth's plain at 90 m is still dark under the pall at Low, the walkers dim shapes.

**No invisible walls.** `lab/road/probe-walls.mjs` walks every stage's lane, |x| ≤ 3 m, every 0.5 m, from where the walkers stand: the land, or the stair, quay or bridge a stage carries them on. It checks each cell of the solid grid from 0.45 m to 3.2 m up. Rays first look for what is drawn there; where they find nothing, the cell itself is tested against every shown triangle.

- Of 6,907 solid cells, the rays missed 616. Those are thin posts, rails and balusters elsewhere in their half-metre cells, and the inside of rock and stone.
- Two missed the exact test, one at the Ford and one on the Anduin. Looked at alone, both hold the stage's own drawn statics: the probe had rounded those points across a cell's edge.
- None is a wall no one can see. Measured from the land alone, the Havens' quay, Cirith Ungol's stair and the refuge rock read as hundreds of walls, being inside the floor the walkers are carried on.

Each stage's cost against the others, at Low on WebGPU (`probe-pace.mjs`). This is software's frames, so it only ranks the stages. Hobbiton, the Shire's edge and Bree ask the most: 400 to 700 thousand triangles at Low, 1.4 to 2 million at High.

| stage | × the lightest | stage | × the lightest |
| --- | --- | --- | --- |
| Bree | 4.8 | Moria | 1.5 |
| the Shire's edge | 4.7 | the Anduin | 1.5 |
| Hobbiton | 4.2 | the Ford | 1.4 |
| Weathertop | 2.7 | Cirith Ungol | 1.4 |
| Lothlórien | 2.6 | the Havens | 1.2 |
| Rivendell | 2.4 | Ithilien | 1.2 |
| Minas Tirith | 2.2 | the Marshes | 1.2 |
| Caradhras | 2.1 | Gorgoroth | 1.0 |

## Every beat walked into, and the buildings close (2026-10-22)

Toward the owner's "check the buildings and check everything".

**Every beat.** `lab/road/beat-tour.mjs` looked at all 80 beats with a shot of their own: the placed shots, the cranes, the low, the side and the lead. It works as a visitor comes to each one. The ride is set 3 m short of the beat and walked into it, so the beat plays. The frame is kept at the beat's moment: where its deed waits, at the top of a crane's rise, or a few seconds into a held shot. Each frame's light is measured as `light-survey.mjs` measures it.

The first tour put the ride on each beat's mark. That counts the beat as long done, so none of them played: cranes stayed at their foot and no deed waited. In software the world also steps only 50 ms a frame, so the shots were still easing in from the follow. Those frames looked wrong and the Road was not.

Of the 80, seven did read wrong (`beats-reframed-desktop.webp`, before and after):

| beat | what was wrong | now |
| --- | --- | --- |
| Ithilien, the Cross-roads | the low rig looks up the road, and the king sits 6 m off it: sky, and the edge of his plinth | low by the road, the hobbits before him, looking up at him |
| Rivendell, Narsil | the same: the hall of the shards is 9.5 m off the road | the hall, Frodo before it |
| Rivendell, Bilbo | the side shot lined the file up between the camera and his bench: Aragorn where Bilbo was | from up the road, Bilbo at his desk |
| the Anduin, the Seat of Seeing | the camera stood among the Seat's pillars, aimed under the vision's four pictures, which were cut off at the top | over Frodo's shoulder, aimed at them |
| Cirith Ungol, the betrayal | the camera stood inside the stair's cliff: a green slab, 55% of the frame black | down the stair from above, Gollum before the two |
| Cirith Ungol, the Tower | Frodo sat on a dark lane, nothing lit: 44% black | one of the orcs' torches left burning by him |
| Ithilien, the king himself | a stack of boxes, wearing the wood scan | below |

Every other beat reads as its moment, among them:
- Gandalf's cart behind Frodo;
- the Black Rider over the roots;
- Butterbur at the Pony's door;
- the Nine at the Ford;
- the Doors of Durin lit;
- Balin's tomb in its shaft of light;
- the Balrog on the Bridge;
- Galadriel at the Mirror;
- the Argonath;
- the faces in the marsh;
- Shelob before the Phial;
- the Eagles down to the rock;
- the White Tree;
- the ship going west.

`beats-all-desktop.webp` is every one. The tour's own two misses are retaken there: Hobbiton's opening was still in its black, and the Eagles were taken after the ride had gone on into Minas Tirith.

Some dark beats are dark by design and still read: the Bridge, the dwarrowdelf crane, Gorgoroth's last slope. In an 800 × 500 lab window the deed's card can cover the middle of the frame (the stone trolls behind it). It sits 8 rem above the foot, below the middle on a desktop screen.

**The buildings close.** `lab/road/building-tour.mjs` holds the camera on each stage's landmarks, up close, 31 views in all.

The stages' parts wear the photo scans by `roleOf` their shape and colour. A warm grey reads as wood there, so Ithilien's seated king and the rock round Henneth Annûn wore the wood scan; they are stone and rock now. The king is rebuilt as a seated figure:
- a throne with a back to his shoulder blades, and arms;
- thighs, shins and feet;
- arms down to his hands on his knees;
- the orcs' round stone for a head, with its one red eye;
- his own head fallen before him, crowned with flowers;
- turned to look across the road at those coming up it.

The Tower of Cirith Ungol has a spike at each corner of each tier, against the red. `buildings-reframed-desktop.webp` shows both, before and after.

Looked at and right: Bree's gate and the Pony, the Green Dragon and the Party Field's pavilion, Amon Sûl's ring, the Ford's bridge and its deck, Rivendell's bridge, council, arch and the hall of the shards, the Doors, Mazarbul, Lothlórien's dais and Mirror, the Argonath and the Seat, Henneth Annûn's curtain, Minas Morgul in its vale, the Watchers, the Morannon, the Havens' quay.

**The chapters on a laptop's chip.** These are the last of the warnings the 2026-10-22 survey above left, on WebGPU held to the default limits. The Shire's, Moria's, Minas Tirith's and Lothlórien's chapters now raise none:
- the Shire's mushroom and spoon glints are sprites, where a point was a pixel wide on WebGPU;
- Lothlórien's lantern posts carry their uv, which the elfwood's map and normal map read;
- Moria's and Minas Tirith's chapters no longer ask `toNonIndexed` of geometry that already is.

**And**: a jump (the ribbon, a stage's key) tells the page where the ride is in the same frame. It no longer waits for the next quarter second's progress.

## R7, the numbers at every stage (2026-10-25)

Every stage measured against the design’s goals (§2) after R7’s mends, in the container on `nodes-webgl` (SwiftShader). **The WebGPU rows are the owner’s laptop and desktop and are left empty**; nothing here is an estimate of them.

### Each stage, high and low (`node lab/road/measure.mjs`, `QUALITY=high` and `low`)

Each stage opened by its address in a fresh 1440 × 900 window, 6 s for the walkers to arrive, then one frame’s `renderer.info.render`: the scene and the sun’s cascades together. The assets are what that stage fetched from cold, alone; the UI is the share of the window under the Road’s own parts.

| stage | draws high | triangles high | draws low | triangles low | assets MB (cold) | UI share |
| --- | --- | --- | --- | --- | --- | --- |
| hobbiton | 268 | 1,124,284 | 163 | 338,156 | 9.6 | 14.8 % (its title card up) |
| shire-edge | 247 | 845,643 | 116 | 155,608 | 7.8 | 12.9 % |
| bree | 295 | 1,020,600 | 161 | 210,279 | 8.9 | 12.8 % |
| weathertop | 151 | 1,005,072 | 73 | 164,347 | 10.2 | 12.8 % |
| ford | 110 | 627,753 | 57 | 97,211 | 11.8 | 14.7 % (its title card up) |
| rivendell | 152 | 943,878 | 96 | 192,159 | 8.2 | 12.8 % |
| caradhras | 46 | 350,085 | 58 | 112,580 | 4.6 | 12.8 % |
| moria | 78 | 291,780 | 62 | 82,221 | 4.3 | 12.8 % |
| lorien | 157 | 905,293 | 89 | 231,040 | 11.0 | 12.9 % |
| anduin | 111 | 554,213 | 64 | 150,265 | 7.6 | 12.9 % |
| marshes | 46 | 591,001 | 64 | 164,533 | 4.7 | 13.0 % |
| ithilien | 94 | 737,953 | 89 | 128,235 | 9.3 | 12.7 % |
| cirith-ungol | 121 | 306,289 | 56 | 69,443 | 5.3 | 12.9 % |
| gorgoroth | 85 | 356,031 | 79 | 182,407 | 8.7 | 12.8 % |
| minas-tirith | 142 | 668,928 | 116 | 259,121 | 5.5 | 11.6 % |
| havens | 56 | 588,459 | 36 | 139,312 | 7.3 | 12.9 % |

- **Draws**: 295 at most on high (against 350), 163 on low (against 200).
- **Triangles**: 1,124,284 at most on high (against 1,200,000), 338,156 on low (against 400,000).
- A single frame swings by a fifth as the scatter and the figures come in (Bree read 131 draws on one run and 295 on another; Hobbiton 1.00 to 1.17 million). The table is one run, every stage in it under.
- **Before R7** on high: Hobbiton 368 draws and 1,538,722 triangles, the Shire’s edge 1,227,011; on low, Hobbiton 481 k and the Havens 418 k. What brought them under:
  - *A band’s statics cast as one shape* (`stages/parts.js`’s `mergeStatics` and `CASTS`): the cascades drew every merged mesh a material a band, 127 of Hobbiton’s 230 shadow draws in one frame. Each half band’s opaque casters are now one positions-only mesh on a layer only the sun’s cameras see (`module.js` enables it on the light’s shadow camera, which the cascades clone), and the drawn meshes stop casting. Every stage built from merged statics gained: Rivendell 256 → 152 draws, Moria 115 → 78.
  - *The Hill’s grass only over the Hill* (`ground.js`’s `patchOver`): the mounds’ patch of blades was the field’s count again, 187,500 triangles, drawn wherever the camera stood. It is drawn while a quarter of it lies over the mounds.
  - *Hobbiton’s far corn and hedges* (`parts.js`’s `inReach`, the hedges within 120 m and the corn’s clumps within 100 m of the ride; the solids grid still takes them, `userData.far`).
  - *The Shire’s wheat and hedge lighter* (`stages/shireLight.js`, the same size and colour at half the triangles or less) and the Shire’s edge’s clumps three rows deep at 0.8 m, the canopy brought in under them: 712 clumps were 359,000 triangles.
  - *The Havens’ sea in 5 m rows*: the Gulf’s still sheet at 2 m was 361,000 of a low frame’s 418,000.
- **The UI**: 11.6 to 13.0 % walking on a desktop (against 14), since the ribbon is at most 56 rem and centred (it was the stage’s width of glass, 9 % of a 1440 screen). The two over are the stage’s opening title card in its first seconds: at Hobbiton 7.6 % of the window, the Ford’s tale as long.
- **The one page error** each row counted is three’s notice that WebGPU is missing in the container (“running under WebGL2 backend”), not a fault.

### The ride (`clock.test.js`’s ledger, on auto)

1,797 s from Bag End to the Havens (the design’s 20 to 30 minutes), every stage between 90 and 140 s (60 to 150):

| stage | m | holds s | s on auto | stage | m | holds s | s on auto |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hobbiton | 220 | 30 | 118 | lorien | 150 | 34 | 94 |
| shire-edge | 175 | 34 | 104 | anduin | 170 | 42 | 110 |
| bree | 150 | 30 | 90 | marshes | 150 | 42 | 102 |
| weathertop | 165 | 46 | 112 | ithilien | 160 | 62 | 126 |
| ford | 200 | 32 | 112 | cirith-ungol | 150 | 42 | 102 |
| rivendell | 155 | 54 | 116 | gorgoroth | 180 | 60 | 132 |
| caradhras | 170 | 47 | 115 | minas-tirith | 160 | 34 | 98 |
| moria | 180 | 54 | 126 | havens | 290 | 24 | 140 |

The deeds’ waits are the visitor’s and are not counted.

### The download (`node lab/road/measure-ride.mjs`, high)

One window opened at Bag End and carried stage by stage to the Havens by the world’s own jump, each stage held 10 s once current, every file counted once:

| stage | MB fetched | MB so far | stage | MB fetched | MB so far |
| --- | --- | --- | --- | --- | --- |
| hobbiton (the boot) | 7.1 | 7.1 | lorien | 1.4 | 20.9 |
| shire-edge | 2.3 | 9.5 | anduin | 1.0 | 21.9 |
| bree | 2.0 | 11.5 | marshes | 0.0 | 21.9 |
| weathertop | 2.8 | 14.3 | ithilien | 0.0 | 21.9 |
| ford | 2.9 | 17.2 | cirith-ungol | 1.7 | 23.5 |
| rivendell | 0.0 | 17.2 | gorgoroth | 1.4 | 24.9 |
| caradhras | 0.4 | 17.6 | minas-tirith | 0.2 | 25.1 |
| moria | 1.8 | 19.4 | havens | 1.0 | 26.1 |

- **The boot slice** 7.1 MB (against 8); **the whole ride** 26.1 MB (against 45). `WORLD_MB['/middle-earth/road']` and the module’s `mb` are 27 (the spine’s guess was 8).
- A stage that fetched nothing had its files fetched with its neighbour, a stage ahead. The table’s cold column above is larger, each stage there fetching its neighbours and the cast from nothing.
- The first ride measure read 11.7 MB: a new address in the same window left the ride at Bree, and `measure-ride.mjs` jumps by `goTo` now.

### The probe (`scripts/perf-probe.mjs road`)

`#/middle-earth/road?at=moria`, the world up, 4 s settled, then the road walking itself; `GPU=webgl`, the container’s Chromium (SwiftShader). Low at 1440 × 900; High timed out there after 300 s of the canvas being resized in software (the first frame’s textures) and was taken at 960 × 600.

| route | machine | drawn on | quality | ready s | fps | p50 ms | worst 1 % ms | main ms | GPU ms | draws | programs | late pipelines |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| road | container | nodes-webgl | low | 41.9 | 1 | 37.4 | 15106.7 | 15.8 | - | 149 | 51 | 19 |
| road | container | nodes-webgl | high (960 × 600) | 175.7 | 55.2 | 17.9 | 27.3 | 16.2 | - | 242 | 72 | 0 |
| road | owner’s laptop | webgpu | high | | | | | | | | | |
| road | owner’s desktop | webgpu | high | | | | | | | | | |

The frame times are the software rasteriser’s. Low’s worst frames are shaders linked in the frame as the next stage came (one held `getProgramParameter` for 970 ms): the 19 late pipelines. Compiling each stage off the frame as `lands.js` finishes it is still the mend, the R2 note’s.

### The phone, and reduced motion

- **Four stages on a phone** (390 × 844; `shots/hobbiton-phone.webp`, `moria-phone.webp`, `lorien-phone.webp`, `havens-phone.webp`): the ribbon one row of dots with no overlap (the 44 px dots overlapped before the ribbon’s width was fixed), Walk, Run and Talk in the thumbs. Walking, the UI is the ribbon (7.9 %), the brand and the Menu: about a tenth. A stage’s opening title card takes 15 % of a phone for its first seconds (Hobbiton’s first-ride card 24 %), over the design’s 22 % with the ribbon while it is up.
- **The company on a phone**: at the walk’s 50° a portrait frame saw ±12° across and the follow’s lead, ten degrees off its aim, stood at the edge or out of it. The director’s `fovFor` opens a frame narrower than 0.6 upward (58° on this phone), and in Lothlórien all eight stand inside it, Frodo at two thirds of the half-width (`lorien-phone.webp`). Hobbiton’s opening placed shot still has Frodo just off the right of a phone’s frame until he walks into it.
- **Reduced motion** (`prefers-reduced-motion` emulated): the ride stands still (the clock at the same metre over ten seconds), the prompt is “Enter · Next”, and Enter steps to the next mark (at Bree, to the gate’s deed). A phone had no Next: the thumbs are Walk and a big Next there now, and the prompt’s click is Next too (the world’s `next()`).
- In the lab a figure takes longer to load than a stage: a picture taken in the first seconds can have no company in it. The phone pictures were taken once the figures were in.
