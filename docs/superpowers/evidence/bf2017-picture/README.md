# The game's world, shot for the gallery (the picture lane)

`node scripts/battlefront-shots.mjs [--gpu webgl|webgpu|both] [--quality ultra,high] [--hidden]` shoots `/battlefront/hoth/galacticAssault` from lane 5's three shots (deploy, field, end) and the nine spots of `src/components/battlefront/spots.js` (under the first AT-AT's path, the first uplink, the hangar mouth in the low sun and from inside, five of the level's own cameras), writing each PNG and a row (whole-frame calls, triangles, textures; the level's own counts; the passes on; the frame times) to `shots*.json` here.

**The cloud's rows are counts only** (SwiftShader WebGL 2, no GPU):

| tier | spot | level calls | level triangles | instances | note |
|---|---|---|---|---|---|
| low | field | 94 | 448,469 | 1,133 | lane 5's row exactly |
| low | deploy | 146 | 719,439 | 1,919 | |
| high | deploy | — | — | — | whole frame 2,023 calls, 8.8 M triangles with the volumes off; black with them on (V's volumes now WebGPU only) |

**For the owner's laptop** (`ANGLE=d3d11 CHROME=<path to msedge.exe>`, `PLAYWRIGHT_BROWSERS_PATH` unset): run the script at `--quality ultra,high --hidden` on both legs, put the game's own frames (if any) under `game/<spot>.png`, and fill this table; until then each shot stands beside lane M's poster `public/films/bf2017/planet-hoth-01.webp`.

| spot | ultra WebGPU (ms) | ultra WebGL 2 (ms) | high WebGPU (ms) | high WebGL 2 (ms) | shot | the game's frame |
|---|---|---|---|---|---|---|
| deploy | | | | | | |
| field | | | | | | |
| walker | | | | | | |
| uplink | | | | | | |
| hangar | | | | | | |
| hangarInside | | | | | | |
| camera1 … camera5 | | | | | | |
| end | | | | | | |
| hidden tab (up, loaded) | | | | | | |
