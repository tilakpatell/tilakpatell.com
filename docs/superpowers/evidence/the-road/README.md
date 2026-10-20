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
- `havens-built-desktop.webp`: the Gulf at sunset from the beach, the quay out to the white ship.
- `havens-quay-desktop.webp`: out along the quay, the ship at its end.
- `havens-gangway-desktop.webp`: the farewell: Frodo going up the gangway over her rail, the three on the quay, those sailing aboard.
- `gorgoroth-built-desktop.webp`: the plain under the pall, the Mountain filling the sky, its plume and its fire; the column's spears on the road.
- `gorgoroth-column-desktop.webp`: the two among the orc column, the driver with his whip.
- `gorgoroth-carry-desktop.webp`: from beside on the slope, Sam bent under Frodo on his back.
- `gorgoroth-eruption-desktop.webp`: the Mountain breaking, fire out of its cone and down its streams, from the slope's top.
