# FL2, the universe map: onto the runtime

Lane FL2 of the engine floor (`docs/superpowers/plans/2026-10-15-engine-floor-laneFL2-onto-the-runtime.md`) for `/` and `/universe/:id?`. Started from lane P2’s branch (`claude/perf-p2-universe`, which had moved the map onto the runtime through `fromScene`), merged with the design and `main` at `f97079c7`. Measured in the cloud container (SwiftShader, no WebGPU device) on 2026-10-15.

## What the move is

- `src/components/universe/module.js`: the map’s scene (`scene.js`, written for `lib/three/useScene`) as a world module through `fromScene`, `'glsl'`, `mb` 6, `ratio` 1.5, `sharpness: 'own'`.
- `UniverseMap.jsx` mounts it with `useWorld` in a `WorldHost`; what the scene said through callbacks comes out as `rt.events`.
- Gone from the map: its `WebGLRenderer` (`createRenderer` in `scene.js`), its frame loop (`useScene`’s), its 22 ms watchdog and its pace and calibration (the runtime’s cadence, governor and `tune()` on the same `'universe'` key). Its post chain (`universe/post.js`, an `EffectComposer` with a grade pass that reads the scene’s depth) stays the map’s own in this lane: the runtime’s `gfx.post(passes)` on the classic backend has no pass that reads depth, and the chain is replaced by the node renderer’s at the port (FL3).
- `src/runtime/useWorld.js` gains `near` (the map asks `'0px'`, as it asked `useScene`), and the rule for two pictures on one page (the shipyard’s showroom: a second module, its own renderer until the runtime holds a second world).

## The pictures: a repair changes no pixel

`scripts/autopilot-check.mjs`’s shots (a wall-clock settle, lossy WebP) and `scripts/gpu-parity.mjs` (which waits for `window.__RUNTIME__`, which main’s map never has) cannot say “the same pixels”: two runs of main itself differ in about 40 % of their pixels. `tools/shoot-same.mjs` shoots both floors the same way: a page clock pinned at 2026-10-08T12:00:00Z and stopped, `Math.random` seeded and reseeded before the frames that are shot, the page’s time moved to one moment, the same 120 frames, a frame asked for on both (`tp:uncover`), the GPU timer hidden so main’s own calibration lands on the sharpest step as the runtime’s `?calibrate=off` does, reduced motion on (the map’s time held at 0: with it moving, its clock starts when it is made, which the two floors reach at different moments), a lossless PNG, every differing pixel counted.

Main against itself, the same way: 0 pixels differ.

| shot (1280 × 800; phone 390 × 844, touch) | main `f97079c7` against the branch | differing pixels |
| --- | --- | --- |
| `/` | `front.png` | 0 |
| `/universe/marvel` | `universe-marvel.png` | 0 |
| `/universe/rickmorty` | `universe-rickmorty.png` | 0 |
| `/universe/starwars` | `universe-starwars.png` | PENDING |
| `/` phone | `front-phone.png` | 0 |
| `/universe/marvel` phone | | 0 |
| `/universe/rickmorty` phone | | 0 |
| `/universe/starwars` phone | | 0 |

What the method found on the way, each run down to its cause:

- 159 pixels at `/`: the floating phone’s lock screen read 12:00 on main and 12:01 on the branch. The map at rest draws only when asked; the runtime asked for one more frame after the page’s time was moved on (useWorld’s effect invalidates after each render), and that frame redrew the clock. With a frame asked for on both, 0.
- The sun’s flare gone on some runs of main: main’s map calibrated itself on every visit by the chip’s clock, which wanders in software, and one run softened it a step (the flare goes at the pace’s step 2). With the timer hidden, 0.
- The runtime’s canvas is multisampled (`budget.antialias`) where the map’s own had none: no pixel of it shows (the map draws through its post target and puts one full-screen pass on the canvas), but it is a cost; see the probe below and the open questions.

## The review (cavecrew), and what was done

Fixed in the map’s folder: the map’s tone mapping and draw count set round its own draws only (a handover makes the new world while the old one still draws, and lets the old one go after the new one is made: `borrow.js`); the sky’s cube target freed (it went with the map’s own context before); the post’s multisampling chosen at the map’s own ratio, not the last world’s; `reduced` in the rebuild key, as `useScene` made the scene again for it.

Open, in `src/runtime/` (lane P4’s until #993 merges, then FL4’s): the canvas’s multisampling wants a per-module option; `createPace({ climb: false })` means a world drawn through its own passes never sharpens again after a hitch; `tune()`’s calibration does not idle under the intro’s cover as the map’s own did; a dead canvas is not removed from its host after a loss; events past 200 held before a page listens are dropped.

## The probe

PENDING
