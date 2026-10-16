# Lane T2, the flip: what was measured, and what the laptop measures

The design (`docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md`, §3, §4 “T2”), its plan (`docs/superpowers/plans/2026-10-11-bf2017-picture-laneT2-flip.md`) and the decision `docs/decisions/2026-10-11-the-node-renderer-above-low.md` left `main` in the docs audit (#1009); they are in git at `7a15c4673`. The lane’s row is in `docs/superpowers/HANDOFF-galaxy.md`. Taken in the cloud container on 2026-10-11: headless Chromium on SwiftShader, no graphics chip. SwiftShader has no WebGPU, so every run here is the node renderer over WebGL 2 (`nodes-webgl`).

## What runs where

WebGPU, the node renderer, is the default for everything where the browser has it (the owner's word, 2026-10-11); without it, the node renderer over WebGL 2, at every level. The lane first brought the classic renderer back as the fallback at low and mid without WebGPU (the GLSL originals in `surface/looks/classic.js`); the owner ruled it out, as main's rule of 2026-10-13 has every world on WebGPU or the node renderer and the engine floor's FL4 retires the classic one, so it is gone and nothing in the lane is classic or GLSL. Rapier (WebAssembly) is the physics on every Star Wars world, every tier and a phone: a world from the 2017 game (a level pack with its shapes: Hoth) stands on the game's own collision (`level/levelPhysics.js`, low at half mid's collider budget, a judgement until a phone is measured); every other world on a Rapier world of its drawn ground and the solids and floors it is walked on (`surface/sitePhysics.js`, 64 m cells in a ring round you). The 2017 soldier's body (`playerBody.js`) stands on either; if WebAssembly cannot start, the walker stays.

| level | WebGPU | no WebGPU | `?gpu=webgl` |
| --- | --- | --- | --- |
| low | WebGPU | WebGL 2, node renderer | WebGL 2, node renderer |
| mid | WebGPU | WebGL 2, node renderer | WebGL 2, node renderer |
| high | WebGPU | WebGL 2, node renderer | WebGL 2, node renderer |
| ultra | WebGPU | WebGL 2, node renderer | WebGL 2, node renderer |

`src/runtime/backend.test.js` pins every cell (and that `?gpu=classic` asks for nothing); `src/runtime/runtime.test.js` that a quality change never remakes the world on another renderer, and that WebGPU that will not start at low or mid falls to the node renderer over WebGL 2; `src/components/galaxy/surface/module.test.js` that the surface has no classic path. The settings panel's readout says “Drawn with WebGPU” or “WebGL 2, node renderer”, and the `?gpu=` asked.

**Apple silicon.** A Mac's chip is no GeForce but a strong one, and is drawn as one: Chrome names it through ANGLE's Metal renderer (`Apple M2 Pro`), graded by generation and class (`lib/gpuGrade.js`: an M1 a good chip, a Max or an Ultra the top grade), Safari says only “Apple GPU” and Firefox rounds the name, and either way a Mac is a laptop or desktop with Auto at ultra (`lib/device.test.js` pins each). WebGPU that will not start (an adapter refused, a device the browser will not make) is counted as lost once and the world made on the node renderer over WebGL 2 (`src/runtime/runtime.test.js`, main's #985), never a failed mount.

**The game's physics books.** The surface reads the 2017 soldier (`soldier.json`, the body's speeds and capsule), the bone capsules for hits (`bones.json`, `boltPlay.js`) and the level's material grid (`materials.json`: impacts and footprints, and now the Rapier world's colliders' tags, friction and bounce where the site names its materials). Only Hoth's grid and Hoth's Havok shapes are in the repo; another world's take the same paths the day its pack and grid are built (lanes E1 to E4).

**Hoth in its own picture.** On the node renderer the surface draws Hoth under its weather's whole VisualEnvironment record (`src/data/bf2017/light/hoth.ve.json`) and picture (`hoth.picture.json`): the linear tone map with the `T_CC_Hoth` LUT read as the game reads it (the clamp gamma-2.2 encoded, the LUT's answer shown as it is), one exposure, the record's (at its clamp of EV 15: sun 9.21, sky 2.52, as the Battlefront world's Hoth), the five Gaussians as the bloom, the HBAO numbers, the sun flare and the motion blur in the chain; the painted panorama over the dome; the record's fog with its gradient; the cloud texture in the sun's shadow; the level's 104 placed lights clustered (`surface/nodes/picture.js`, `surface/nodes/stack.js`). A weather change fades the surface's own light, not the picture (the first weather's stays, as lane Q6 left it). Whether it matches the game's frames is the owner's laptop's to judge: no game frame is in the repo, and the panorama is the bucket's 2,048 × 512 LDR copy of the game's 8,192 × 2,048 HDR (the desktop's re-encode is listed).

**Ragdolls.** The Battlefront world's fallen (`lib/three/ragdolls2017.js`, `lib/combat/fall.js`) fall on every galaxy surface: the hostiles (`activity.js`), the assault's soldiers (`missions/assaultScene.js`), and the ground war's, which now take the game's fifteen bodies where the figure is on the game's skeleton (`ground/groundFigures.js`). The heroes-versus-villains fighters, who stand again, and you and your crewmate, who get back up, keep their falls.

## Hoth at high, node renderer over WebGL 2 (1280 × 720)

| | calls | triangles | |
| --- | --- | --- | --- |
| baseline, classic (`lab/baseline/surface-high.json`) | 249 | 1,512,875 | lane T found main's classic shot never drew the level |
| flip with every layer (lane T's #887, then this lane) | 281 | 10,077,091 | the first run, the page reloading under it (errors were the reload's) |
| the view without the sun's shadow | 238 | 2,665,101 | the probe's own frame |
| the view without the sun's shadow, the level batched | 238 | 1,799,600 | lane U's `BatchedMesh` on the node renderer |
| the shadow casters, one cascade's worth | | 1,881,360 → 1,449,807 | before and after the batches |

The chain built for Hoth at high over WebGL 2: render, SSGI, denoise, GTAO, volumes, bloom, the surface's grade, SMAA, output (SSR and TRAA are what `nodes-webgl` cannot build: `lib/three/light/post.js`'s CANNOT). The stack: the cascades, PCSS, contact shadows, Hoth's 130 volumes; no console error on a clean run. A frame took over two minutes, so the whole-frame count with the cascades could not be taken here; the row (3M at high) is the laptop's to confirm.

## Hoth in its picture, rendered here

640 × 360, high, the node renderer over WebGL 2 (SwiftShader), the landing's view: every layer up (`entry, soft, clouds, cascades, contact, volumetrics, sky, fog, placed, picture`; the chain `render, ssgi, denoise, ao, volumes, bloom, motionBlur, grade, smaa, output`), no page error.

- `hoth-high-nodes-webgl.webp`: as it stands (the house's exposure under the record's linear tone map, as lane Q6 drew Hoth).
- `hoth-high-nodes-webgl-exposure1.webp`: before that, at the site's exposure alone, a stop and a half dark. (The first render, before the record's own rate was let stand, was white.)

## Tatooine in software GL (2026-10-11)

Since lane E1’s pack (#910), Tatooine on the node renderer holds the page for minutes at a time in SwiftShader, on main as on this branch (main at `59191ed5` served alone: no answer from the page for 120 s, then 50 s, from half a minute after the scene came up). The classic renderer on the same world answers in 0.2 s.

- **Where the time goes.** A CPU profile over 330 s at mid, the level’s lights off: 272 s in WebGL’s `getProgramParameter` and 30 s in `getUniformBlockIndex`, both the synchronous end of a program’s link (three’s `_completeCompile`, from `compileAsync` and from drawing). At high a single query to the page took 34 minutes, and the profiler could not stop.
- **Why so many links.** After 8 minutes at mid, Tatooine had 379 materials and 369 fragment programs: nearly one each. Hoth had 564 materials sharing 141. Tatooine’s pack has no `recipes.json`, so its meshes keep their own GLB materials; the level lights are not it (off, the stall stays), nor the level’s draws (none yet when it starts). What makes each of Tatooine’s programs its own is E1’s to find.
- **With the cascades sharing one shadow node** (`sun.js`’s SunCSM, `0b198643`), the shot comes: in CI 59.8 s (shard 3, `cefb3358`), here 45.8 s, frames at 15 to 20 s. Here, with the bucket and `DRAW_WAIT` at 50 minutes, Tatooine came up with no error (1,063 calls, 3.18M triangles, the level 92 calls and 347k of them; 137 MB from the bucket), the run 54 minutes in all, most of it the warm-up; at the 10-minute default CI said “the world never came up”. `galaxy-check.mjs` now prints how long each world took to come up.
- **What CI does.** Each world has a worlds job of its own, so a slow one (Tatooine, Geonosis) keeps no other from being measured. `galaxy-check.mjs` records a screenshot that never comes as that world’s error and goes on. On a GPU, a link takes milliseconds; the laptop’s run is the frame number.

## CI

The worlds boot at high on the node renderer over a runner's software GL, one world a job. On a pull request, `ci.yml`'s worlds job runs three without a pack, on the site's Rapier ground: Dagobah, Coruscant and Mustafar (its lava). The worlds with a level pack are the slow ones and run nightly: on the merged branch (`d625b00a`, 2026-10-15) Hoth's surface was made but the runtime never came up in 50 minutes, and the job was cut off at 150, where on `6f8af3fe` it came up in 22 s; main's Hoth ground had since become the game's nine terrain layers in arrays and masks (#1004 and before). All seventeen run nightly at 03:23 UTC and by hand (`.github/workflows/worlds.yml`, the same steps). The 2026-10-11 decision's revisit line said a seventeen-world gate past twenty minutes moves to a nightly run with three on the pull request; on lane T2's runs a world took 3 to 70 minutes (Kashyyyk 23, Geonosis 28, Tatooine 53, Naboo 70) and Scarif and Kamino were cut off at 150. Before that, with eight worlds a job on `6e46fde0`, shard 1 measured seven (Naboo’s shot had not come 85 minutes on) and shard 2 three (Geonosis alone 57 minutes).

A job fails when its world does not come up or says an error (less the noise `scripts/lib/noise.mjs` lists: a browser with no WebGPU says so, and the runtime draws on WebGL 2). Each wait prints its time as it ends (the level round you, the frame guard, the three warm-up frames, the counted frames), the two frame phases fail after `FRAME_WAIT` (40 minutes each), and each shot prints its mean colour and the share of it clipped white: a job cut off says only what it printed, and the cloud session cannot download a job's pictures. Its rows (calls, triangles, models) are reported against the baseline, not held (`BUDGET_REPORT=1`): the baseline was made on the classic renderer, a frame through the node renderer's whole chain takes minutes in software, and the cascades' share of the frame cannot be counted there. The frame numbers are the laptop's run below, and a node-renderer baseline is made from it.

What the seventeen said on lane T2's last full run (`6f8af3fe`, 2026-10-12), and what is done about it:

| world | said | why | now |
| --- | --- | --- | --- |
| hoth | `tex/t_arcticbase_rockwall_large_04_lod_01_n__normal` did not load | four maps the far rock walls' GLBs name were never encoded or sent to the bucket | published on `main` (`8c7ff9cf6`); but on the merged branch Hoth's runtime did not come up in 50 minutes and the job was cut off at 150 (above): nightly |
| endor | `tex/t_lightpole_xl_01_beamslod_a_nam__orm_456c2ae0` did not load (16 maps) | the pack's README: 20 textures missing from the bucket; none in `src/data/galaxyAssets.json` | the owner's export (the desktop's not-uploaded textures) |
| bespin | `tex/t_plaza_stair_large_s1024_01_n__normal` did not load | the same: 3 missing | the owner's export |
| naboo | `nodeVar37 = /* Recursion detected. */` in its fragment programs; `tex/t_nab_building_12_nam__orm_aa5858b6` did not load | its trim set's parallax (43 recipes) built its view ray in three's TBN, whose normal off the normal's own build is the material's: the normal map at the parallax's uv; and 15 maps missing from the bucket | the parallax fixed (`gameMaterial.js`, its frame from the geometry's normal alone); the maps the owner's export |
| scarif, kamino | “up in 58 s”, then nothing till the 150-minute limit | the check printed a world's numbers only at its end, and its frame phases had no limit; the time went after “up” (the level, the guard, the frames) | each wait now prints when it ends and the frames fail after `FRAME_WAIT`, so the nightly run says where they stall. Not measured here: the cloud session cannot load their packs (the bucket's host is outside its network policy). Likely the same as Tatooine's (above): in software GL every program is a synchronous link, and these packs leave the most meshes on their own GLB materials, without a recipe (Kamino 753 of 1,084, Scarif 318 of 538, Naboo 522 of 795; Hoth none) |
| the other eleven | no error | | pass |

## Left for the owner's laptop

- `BUDGET=1 QUALITY=high node scripts/galaxy-check.mjs surface tatooine,hoth,endor,yavin,bespin,dagobah,mustafar,coruscant,naboo,kashyyyk,kamino,geonosis,scarif,nevarro,mandalore,lothal,sorgan` with `ANGLE=d3d11` (or metal): every world's calls, triangles, MB, p50 and p95. The baseline was made on the classic renderer; if the node renderer counts its passes differently, a node baseline is made from that run, with its reason in the commit.
- The WebGPU leg (the container's SwiftShader device drops its instance).
- Hoth's triangles with the cascades against the 3M row; if over, the cascade count or `SHADOW_REACH` (`level/levelScene.js`) is the lever.
