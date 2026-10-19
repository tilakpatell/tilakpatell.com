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
