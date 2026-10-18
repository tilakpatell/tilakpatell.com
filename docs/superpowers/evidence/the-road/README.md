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
