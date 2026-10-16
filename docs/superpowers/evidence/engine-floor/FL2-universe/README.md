# FL2, the universe map: onto the runtime

Lane FL2 of the engine floor (`docs/superpowers/plans/2026-10-15-engine-floor-laneFL2-onto-the-runtime.md`) for `/` and `/universe/:id?`. Started from lane P2’s branch (`claude/perf-p2-universe`, which had moved the map onto the runtime through `fromScene`), merged with the design and `main` at `f97079c7`. Measured in the cloud container (SwiftShader, no WebGPU device) on 2026-10-15.

## What the move is

- `src/components/universe/module.js`: the map’s scene (`scene.js`, written for `lib/three/useScene`) as a world module through `fromScene`, `'glsl'`, `mb` 6, `ratio` 1.5, `sharpness: 'own'`.
- `UniverseMap.jsx` mounts it with `useWorld` in a `WorldHost`; what the scene said through callbacks comes out as `rt.events`.
- Gone from the map: its `WebGLRenderer` (`createRenderer` in `scene.js`), its frame loop (`useScene`’s), its 22 ms watchdog and its pace and calibration (the runtime’s cadence, governor and `tune()` on the same `'universe'` key). Its post chain (`universe/post.js`, an `EffectComposer` with a grade pass that reads the scene’s depth) stays the map’s own in this lane: the runtime’s `gfx.post(passes)` on the classic backend has no pass that reads depth, and the chain is replaced by the node renderer’s at the port (FL3).
- `src/runtime/useWorld.js` gains `near` (the map asks `'0px'`, as it asked `useScene`), and the rule for several pictures on one page, word for word as the Middle-earth lane wrote it (one world a page, each picture a view of the one canvas: `runtime/views.js` on `claude/engine-floor-fl2-middleearth`), with the shipyard’s showroom under it: a view of the map’s world once the views are on main, its own renderer until then.

## The pictures: a repair changes no pixel

`scripts/autopilot-check.mjs`’s shots (a wall-clock settle, lossy WebP) and `scripts/gpu-parity.mjs` (which waits for `window.__RUNTIME__`, which main’s map never has) cannot say “the same pixels”: two runs of main itself, shot that way, differ in 39 % of their pixels. `../tools/shoot-same.mjs` shoots both floors the same way: a page clock pinned at 2026-10-08T12:00:00Z and stopped, `Math.random` seeded and reseeded before the frames that are shot, the page’s time moved to one moment, the same 120 frames, a frame asked for on both (`tp:uncover`), the GPU timer hidden so main’s own calibration lands on the sharpest step as the runtime’s `?calibrate=off` does, reduced motion on (the map’s time held at 0: moving, its clock starts when it is made, which the two floors reach at different moments), after a pose (and with `--settle-frames`, before a route) frames till what loads a slice a frame is in, a lossless PNG, every differing pixel counted.

Main at `1467c2b5` against the branch at `4ad60daf` (and the same counts at `c75a0806` and `e6be51ca`, and at `f97079c7` against `b0fb8b53`, each shot again as main or the branch moved on), 1280 × 800 (phone: 390 × 844, touch), each route with `--settle-frames`, from a fresh page:

| shot | differing pixels |
| --- | --- |
| `/` | 0 |
| `/universe/marvel` | 0 |
| `/universe/rickmorty` | 0 |
| `/universe/starwars` (main against main 0, the branch against itself 0; one run of the branch with three shooters sharing the machine had 3 pixels off by 1 there, and two more of each, alone, 0) | 0 |
| `/` phone | 0 |
| `/universe/marvel` phone | 0 |
| `/universe/rickmorty` phone | 0 |
| `/universe/starwars` phone | 0 |
| `/universe` with the Falcon flying | 0 |
| poses (`poses.js`, in this order on one page): `overview`, `falcon-sun`, `middleearth-limb`, `rickmorty`, `belt`, `maw`, `station`, `far-rim` | 0 each |

`before/` and `after/` hold them, 640 wide (390 on a phone) as WebP to look at; the counts are the PNGs’.

What the method found on the way, each run down to its cause:

- **A runtime bug, fixed here** (`src/runtime/runtime.js`, one line and a test; asked on #993, whose files they are): a world at rest woken by `invalidate()` drew two frames, not one (`kicked`, set before the frame, was read at its end as a request made during it). The map eases its orbit rings a step a drawn frame, so at the `overview` and `falcon-sun` poses the branch’s rings had faded one step further for each wake: 8,940 and 6,626 pixels off by 1 to 7 levels. With `kicked` cleared as a frame begins, 0.
- 159 pixels at `/`: the floating phone’s lock screen read 12:00 on main and 12:01 on the branch, the extra frame above having redrawn its clock after the page’s time was moved on.
- The sun’s flare gone on some runs of main: main’s map calibrated itself on every visit by the chip’s clock, which wanders in software, and one run softened it a step (the flare goes at the pace’s step 2). Main against itself differed so; with the timer hidden, 0.
- A thin streak at `/universe/starwars` (92 pixels main against main, 142 the branch against itself) and a planet’s near maps in one run and not the other: things that come in a slice a frame, as fast as they load in real time, against a stopped clock. With frames run till they are in, 0 against itself and 0 against each other.
- The runtime’s canvas is multisampled (`budget.antialias`) where the map’s own had none: shot with it forced off, the same pixels (the map draws through its post’s target and puts one full-screen pass on the canvas). It costs; see the probe, and the open questions.

## The review (cavecrew), and what was done

Fixed in the map’s folder: the map’s tone mapping and draw count set round its own draws only (a handover makes the new world while the old one still draws, and lets the old one go after the new one is made: `borrow.js`); the sky’s cube target freed (it went with the map’s own context before); the post’s multisampling chosen at the map’s own ratio, not the last world’s; `reduced` in the rebuild key, as `useScene` made the scene again for it.

Open, in `src/runtime/` (lane P4’s until #993 merges, then FL4’s): the canvas’s multisampling wants a per-module option; `createPace({ climb: false })` means a world drawn through its own passes never sharpens again after a hitch; `tune()`’s calibration does not idle under the intro’s cover as the map’s own did; a dead canvas is not removed from its host after a loss; events past 200 held before a page listens are dropped.

## The probe

`scripts/perf-probe.mjs universe`, main at `1467c2b5` and the branch at `c75a0806`, each on its own Vite, alternating (`before, after, before, after`), the probe’s default window (1470 × 956 at 2), in the container’s SwiftShader. The universe journey now times the map from when it is on screen (`data-gl="on"`, which useScene and useWorld both set): timed from the ship, as it was, the branch was measured behind its loading screen while the runtime’s own calibration walked five steps.

The software renderer links some of the map’s shaders in seconds, sometimes minutes, inside a frame (`getProgramParameter` 13 s to 217 s in these runs, on either side): the worst 1 % and the frame rate are those stalls, run to run, not the map. The main thread a frame (the probe’s `main`) and the time to the map are what compare.

| quality | ref | ready s | main ms a frame, flying | p50 ms | worst 1 % ms | draws |
| --- | --- | --- | --- | --- | --- | --- |
| Low | main, run 1 | 47.1 | 9.9 | 13.4 | 17,364 | 56 |
| Low | main, run 2 | 45.6 | 8.6 | 13.0 | 23,454 | 25 |
| Low | branch, run 1 | 46.2 | 6.0 | 7.5 | 45,405 | 23 |
| Low | branch, run 2 | 42.8 | 10.1 | 16.4 | 13,290 | 46 |
| High | main, run 1 | 128.2 | 7.4 | 10.3 | 126,506 | 44 |
| High | main, run 2 | 125.1 | 2,613.4 | 2,626.1 | 10,148 | 40 |
| High | branch, run 1 | 112.2 | 4.2 | 6.1 | 2,258 | 37 |
| High | branch, run 2 | 108.0 | 881.2 | 891.7 | 1,591 | 38 |

Time to the map on screen at Low, by a probe of `data-gl` every five seconds (`quality=low`, no `calibrate=off`): main 14 s; the branch 61 s before the map calibrated itself again (the runtime’s `tune()` timed a whole world frame, which in software fits the budget at no step, and walked all five), 13 s after.

The WebGPU rows are the owner’s machines’: this container has no WebGPU device, and a `'glsl'` module draws on the classic renderer whatever is asked. Left empty, not estimated.
