# The waiting screen into Hoth, measured on the owner's desk (2026-10-12)

What the Battlefront world does now in place of a flown landing, and what headless Edge on the real chip measured for it. The code: `src/components/battlefront/waiting.js` (the rules), `WaitingScreen.jsx` and `waiting.css` (the screen and the wipe), `module.js` (the parked camera, the shader counts, the arrival), `BattlefrontWorld.jsx` (the phases). The decision: `docs/decisions/2026-10-12-the-waiting-screen-into-hoth.md`. The pictures and the runs' records are in `bf2017-waiting-screen/`.

## What the game does (the owner's study, read-only)

`bf2-re/findings/14-landing-and-bloom.md`: there is no fly-in. A loading movie over a bar sized for 66 s, then the spawn screen with the level up but the player in a darkroom under `VE_SpawnScreen` (a fixed exposure, MinEV = MaxEV = 8), and on Deploy `PF_SpawnWipeLogic`'s three delays, 0.05 s → 0.3 s → 0.4 s (about 0.75 s: black in, the swap, black out), after which the exposure adapts from EV 8 to the field's clamp over `DarkAdaptationTime`/`LightAdaptationTime` 0.25 s: the first frames on the snow are over-exposed and settle. `findings/22-hoth-variants.md`: the day is a server-side coin at round start, the sunset sub-world (`VE_PV_Hoth_Sunset_01`, weight 70) or the clear day (the sub-world named Cloudy, `VE_Sky_Arctic_Sunny_01`, weight 30).

## What the site does now

1. **The darkroom.** Until the first deploy the world's camera is parked in the soldier's own pose at the side's spawn (`spawnFor`, `soldierPose`), so the level streams round where the player will land and the shaders of what they will see are built behind the screen by the frame guard (`lib/three/pipelineGuard`: off the frame, pipelines asynchronous). The input's Enter does not deploy while parked: the screen's button does, through the wipe.
2. **The waiting screen** covers the view: the mode and the level (the route's; a link to the game's front end changes them), the day (as the game would, by the 70/30 coin rolled once at mount and sent to the module as its weather so the chain is built once for it; or the sunset or the clear day by name, which rebuilds the chain behind the screen), the classes and the heroes with their Battle Point cost, a bar fed by the level stream's progress (85 % of it) and then by the guard's `pending` pipelines, `held` objects and the post chains `building` (the rest), the machine's line, the recommendation and Deploy, which takes only once nothing has built for 0.6 s (`QUIET_S`, with the snapshot's own 1/8 s grain counted).
3. **The wipe**: black in over 0.3 s after 0.05 s, the world's deploy at the swap, black out over 0.4 s; at the swap the renderer's exposure jumps by the darkroom's stops under the day's clamp (3 on the clear day, MinEV 11; 1.5 at the sunset, 9.5) and settles to 1 over 0.25 s through the chain's tonemap pass (`tsl.toneMappingExposure`), so the light stack supports it without a change of its own.
4. **The machine and the recommendation**: `your machine: <quality level> tier (<renderer tier>), <chip>, <drawing buffer> on <backend>`, and `recommend()` from the chip's own frame time (the runtime's GPU clock, now `rt.gpuClock`) at the chain's internal scale: each frame costs ms ÷ scale² a unit of area (runtime/dynres's model), the sharpest of the chain's steps whose predicted frame fits 16.7 ms less 10 % is the recommendation; none fitting, the level below at the softest step; a frame under 0.6 of the target at the sharpest, the level above. Apply calls `setQuality`; the runtime's pace keeps the scale.

## The measurement

Headless Edge (`msedge.exe`, `--enable-unsafe-webgpu --use-angle=d3d11 --ignore-gpu-blocklist`) on the RTX 5090, a 2,560 × 720 viewport at device scale 2 (a 5,120 × 1,440 drawing buffer), `tp-quality=ultra`, the Vite dev server, the route `/battlefront/hoth/galacticAssault?from=/galaxy/hoth`. The script waits for the screen's Ready, shoots it, waits 2.5 s (a 5,120 × 1,440 capture stalls the page about a second, which an earlier run mistook for a frame of the world's), presses Deploy with the press timed in the page, and records every `requestAnimationFrame` and the world's own step and draw for 3.6 s. `check-sunset.json` is the timing run (the coin said the sunset); `check-clear-day-shots.json` is the picture run on the clear day, whose shot right after the first field frame stalls the page, so its times after the wipe are not read.

| | the sunset (timing run) |
|---|---|
| the dev door up (`window.__battlefront`) | 4.5 s from navigation |
| the screen's Ready (the level whole, nothing building for 0.6 s) | 40.8 s from navigation (35 to 41 s over five runs) |
| the chip's frame in the darkroom, at the field's own view | 7.5 ms (the clock's median, at 100 %) |
| the line | `your machine: ultra tier (T2), ANGLE (NVIDIA, NVIDIA GeForce RTX 5090, 5,120 × 1,440 on WebGPU` |
| the recommendation | `recommended: ultra at 100 % · 7.3 ms a frame on the chip` (Apply disabled: it is the level in force) |
| Deploy pressed → the swap (the world's deploy) | 395 ms (the game's 350 ms plus one frame) |
| Deploy pressed → the first drawn field frame | **430 ms** |
| the swap → the first drawn field frame | 35 ms |
| frames in the 3 s after the wipe's end | 98 |
| the worst frame of those 3 s | **54.1 ms** (one over 50 ms; the next worst 40.8) |
| median, p95 | 27.1 ms, 40.7 ms |
| from the swap (the 0.4 s of black included) | the worst 67.7 ms, three over 50 ms |
| shader builds after the swap (`pending`, `held`, `building`) | 0, 0, 0 |
| console errors | 0 |

The frames after the wipe are the world's steady frame on this drawing buffer: the step 1 to 3 ms, the draw 22 to 33 ms at 450 to 600 draws (the far cascades' frame every fourth, at 600), the chip at 7.5 ms. Nothing is built: the one frame over 50 ms is a 46 ms draw plus a slipped vsync, the same per-draw JavaScript the 2026-10-12 shader-guard note leaves (29 µs a draw in three's node renderer), not a hitch of the arrival. Before this change the first seconds carried the builds of the spawn's cells and the soldiers, the frames of 100 to 800 ms that note measured while the level came in round the player.

The load itself is the level's stream (33 s of the 41 s are its fetches and decodes; `check-sunset.json`'s `sampled` has the bar's timeline: the stream to 19 s, 130 to 166 pipelines pending while the far list builds, the cells to 22 s, the builds draining to 36 s). That is the next thing to shorten, not this screen's.

## After the rebase onto main (#948 to #952)

The same script on the branch rebased onto the HUD port, the HDR sky, the walk blend and the page-turn change, the sunset by name: Ready at 71 s (the HDR panorama and the guard's runs make the load longer), Deploy pressed to the first drawn field frame 504 ms (the swap 439 ms, the first frame 65 ms after it), nothing pending, held or building after the swap; but the world's draw is 40 to 48 ms a frame there where it was 22 to 33 before the merges, both in the darkroom and on the field, so the 3 s after the wipe read a median of 54 ms, a p95 of 95 and a worst of 203 (a 118 ms draw at 0.9 s), thirty frames over 50. Main itself with no screen, deployed through the dev door 15 s after the level's far list (`bf-steady.mjs`), draws a 4 s window after that at a median frame of 176 ms and a worst of 529 as the builds land round the player. The screen removes the builds; the steady frame's cost is the renderer's per-draw JavaScript on a 5K buffer and main's new work in the draw, not the arrival's.

## The pictures (`bf2017-waiting-screen/`, at 1,920 wide from 5,120)

| shot | what it is |
|---|---|
| `waiting-clear-day.png` | the waiting screen at Ready on the clear day: the mode and the level, the day's three cells (the coin's cell says what it said), the classes and the reinforcements, the bar at 100 per cent, the machine's line, the recommendation with Apply, Deploy lit, the way back |
| `field-first-clear-day.png` | the field about 60 ms after its first frame on the clear day: the wipe still lifting and the exposure at its darkroom stops, the game's bright landing before it settles |
| `field-3s-sunset.png` | the field 3.6 s after the swap on the sunset, settled, the HUD up |

## What is left

- The site's bar still shows over the field (it did before: the page's `main` sits under it; the game's screens cover it).
- The hero and reinforcement cells scroll under the key line on a 720-tall window; the list could take the card's column on a short screen.
- The recommendation reads the chip in the darkroom at the field's own view, which is the field's cost; a round's worst (the hangars, twenty soldiers in view) is not measured.
