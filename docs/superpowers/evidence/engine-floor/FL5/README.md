# FL5: the frame off the main thread

Lane FL5 of the engine floor (the design’s §4.8, the plan `docs/superpowers/plans/2026-10-15-engine-floor-laneFL5-worker.md`): the runtime’s renderer and loop in a module worker on an `OffscreenCanvas`, behind `?worker=on` (or `localStorage` `tp-worker` `'on'`), off by default. A spike, as the every-world hand-off’s “Not to do” says it must be until the ports are done.

## What is here

| file | what it is |
| --- | --- |
| `results.json` | the container’s run of `tools/measure.mjs` (320 × 180, three runs, ten seconds a leg): every leg’s row |
| `lit-worker-and-page.png` | the lit fixture after 8 s at 480 × 270 on SwiftShader’s WebGL 2: in the worker (left) and on the page (right); 0.01 % of pixels differ by more than 24 of 255 (the temporal passes’ own noise) |
| `tools/lit.html`, `tools/lit.js` | the harness: the lit fixture mounted through the site’s own `runtime()`, so `?worker=on` takes the path a page takes; `?load=30` adds lane P7’s deliberate main-thread load (a 30 ms task every 100 ms) |
| `tools/measure.mjs` | drives the harness on and off the worker, with and without the load, interleaved, and prints the table below |

The code: `src/runtime/worker/` (`protocol.js` the messages and the input snapshot packed for structured clone; `worker.js` the runtime in the worker; `host.js` the page’s face of it), one guarded line in `src/runtime/index.js`, a `canvas` option in `src/runtime/browser.js`’s `makeBackend`, `WORKER=on` in `scripts/perf-probe.mjs`.

## Which worlds can go

Only a module whose `create` reads neither `document` nor `window` (`protocol.js`’s `DOORS`). The lit fixture can: it draws in the worker, the same picture as on the page (the shot above). **Battlefront cannot, as it is:** its `module.js` reads the page in `create` and its step:

- `window.devicePixelRatio`, `innerWidth` and `innerHeight` for its ratio cap (`module.js:99`) and its small-screen test (`:180`);
- `window.location`’s flags (`:144`, `:316`);
- `window.localStorage` for the collection (`:268`, `lib/bf2017/collection.js`’s `readStore`), and `lib/device`’s `device()`, which reads `localStorage`, `navigator` and `matchMedia`;
- the audio: `sound/player.js` takes `rt.audio.context` and `rt.audio.bus()`, Web Audio nodes, which are the page’s;
- `window.__battlefront`, the dev door the checks drive it through (`:698`), and the page’s own door, `send.js`: the spawn screen calls `world.do(action, arg)` on the world object and reads its answer at once, which across a worker is a message and a promise.

The HUD would cross as it is: its numbers reach the page as the world’s `'hud'` events (`BattlefrontWorld.jsx`’s `setSnap`), which the worker relays like any other event.

Each is a change in Battlefront’s folder (the numbers passed in `props` or read through `rt`; the sound as calls on the page’s bus; the doors as messages), which the Hoth pull requests own until they merge. With `?worker=on` Battlefront goes to the page runtime through the same face: `scripts/battlefront-check.mjs --gpu webgl` with `&worker=on` added to its address passed in the container (deploy, the 30 s advance, the end card, no console error; 301 frames, median 16.7 ms).

## What crosses, and what stays on the page

| on the page (host.js) | crosses | in the worker (worker.js) |
| --- | --- | --- |
| the input’s listeners (`createInput`), sampled in the page’s own `requestAnimationFrame` | `input { snapshot, at }` each page frame (`packInput`: the Sets as arrays) | a store the runtime samples; a press or a drag between two of the worker’s frames merged, handed over once (`mergeInput`) |
| the box’s size (useWorld’s ResizeObserver), whether it is on screen | `resize { w, h, ratio }`, `visible { on }` | `rt.resize`, `rt.setVisible`: the runtime sizes the canvas itself, before its next frame |
| the page’s props, the settings panel’s quality | `props`, `quality`, `kick` | `world.update`, `rt.requality`, `rt.invalidate` |
| `rt.events` (useWorld’s `onEvent`), the HUD | `event { name, data }`, `hud { values }` | the world’s `rt.events.emit`; `rt.hud(values)` |
| the input’s bound keys (so their default is prevented) | `bind { actions, axes }` | `rt.input.bind` |
| `rt.saves` (`localStorage`), `rt.store` (IndexedDB), the audio bus | `call { id, name, args }` → `result` (only `protocol.js`’s `CALLS`) | `saves.get` from a copy of the keys the module names in `saves: [...]`, written through; `store` as promises; `audio.bus()` throws |
| useWorld’s recovery | `lost { kind, reason }`, `failed { message }` | `rt.lost()`: the page mounts the world again on the page runtime, and every world after |
| the probe’s `__RUNTIME__.gpuClock`, `workerFrames()` | `frame { ms, at, gpu, inputAt, drawnAt }` each frame | |

What a world in the worker gives up: a handover’s cover (the old world goes, the new one mounts), the settings panel’s sharpness and video while it is up, the renderer tier’s probe (the page’s tier is passed in, or none), `saves.watch`, its audio. Three gaps the review found, left for the lane that adopts it (each needs a change outside `worker/`, or is unreached by the fixture): a change of the screen’s pixel ratio (a zoom, a move to another monitor) is posted with each resize but the worker’s quality keeps the ratio it was made with; `rt.assets`’ texture loader in the worker reaches `document` (`lib/three/textures.js`, three’s `ImageLoader`), so a world that loads a picture needs an `ImageBitmapLoader` road first; a device lost in the worker mounts the world again on the page but is not kept against the chip (`index.js`’s `onLoss`, `noteLoss`), though a chip already kept as lost twice starts the worker on WebGL 2. What three reached for that a worker has not: `new Image()`, in `SMAANode`’s look-up tables; without it the game light’s chain failed to build and the worker drew black with nothing in the console. `worker.js`’s `imageShim` gives the worker an `Image` that is an `OffscreenCanvas` (`docs/stack/webgpu-tsl.md`’s gotcha).

## The container’s table (SwiftShader: the shape only)

`VIEW=320x180@1 RUNS=3 SECS=10 node docs/superpowers/evidence/engine-floor/FL5/tools/measure.mjs`, 2026-10-15, four cores, Chromium on SwiftShader’s WebGL 2 (no WebGPU device). The lit fixture at its defaults (the ultra tier, its post chain: render, AO, bloom, LUT, SMAA, output). “World” is the world’s own frame intervals (the worker’s beats in a worker, the page’s on the page); “page” is the page’s own `requestAnimationFrame` intervals; “input to draw” is the page’s input sample to the frame having been issued (on the page, inside one task; in the worker, the wait for the worker’s next beat as well). Three runs, interleaved:

| load (ms every 100 ms) | worker | world p50 ms | world worst 1 % ms | page worst 1 % ms | input to draw p50 ms | input to draw worst 1 % ms |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | off | 33.3, 33.3, 33.3 | 166.7, 183.3, 116.7 | 150, 183.3, 116.7 | 1, 1, 0.8 | 4.9, 3, 3.5 |
| 0 | on | 33.3, 50.1, 16.7 | 283.3, 266.6, 166.7 | 283.3, 266.6, 166.7 | 17.5, 14.8, 12.4 | 287.3, 274.1, 183.2 |
| 30 | off | 33.4, 33.4, 33.4 | 200, 149.9, 183.3 | 200, 133.3, 150 | 1.2, 1.1, 0.9 | 4, 4.3, 5 |
| 30 | on | 66.6, 16.7, 16.8 | 299.9, 200, 300.1 | 283.4, 200, 300 | 62.9, 32.5, 91.7 | 311.4, 218.7, 301.6 |

What it says, and what it cannot: on SwiftShader the drawing is the CPU’s, in the GPU process, on the same four cores as the page and the worker, so moving the JavaScript off the main thread moves no drawing off it. **In the container the worker’s worst 1 % is worse, not better, in every run** (167 to 300 ms against 117 to 200), and its p50 swings from one run to the next (16.7 to 66.6 ms) where the page’s holds at the cadence’s even 30. Unloaded, the input reaches the worker’s draw about one frame later (p50 12.4 to 17.5 ms at 60 Hz beats); under the load it is the page’s busy task that holds the input back (p50 32.5 to 91.7 ms), since the input is sampled on the page. None of this is the decision’s number: that is the desktop’s.

The review’s fixes after this run (a page mount in flight let go, `ready` on the first drawn frame, a timer’s beats where a worker has no `requestAnimationFrame`) leave the frame’s path in Chromium as it was. An earlier run (before `imageShim`) timed a worker drawing black, without its post chain; it was thrown away.

## The owner’s rows (RTX 5090, Battlefront at High, and the lit fixture)

The decision rule (the design’s §4.8): **kept if the worst 1 % of frames falls on the desktop with the flag on, and input to picture is within one frame; else the branch is the evidence, the pull request is closed with this table, and the flag goes.** The rows are the owner’s machine’s; none is estimated here.

The lit fixture, on WebGPU at the desktop’s screen (three runs, interleaved, with and without the load):

```
GPU=webgpu VIEW=2560x1440@1 RUNS=3 SECS=20 node docs/superpowers/evidence/engine-floor/FL5/tools/measure.mjs
```

| load | worker | world p50 ms | world worst 1 % ms | page worst 1 % ms | input to draw p50 ms | input to draw worst 1 % ms |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | off | | | | | |
| 0 | on | | | | | |
| 30 | off | | | | | |
| 30 | on | | | | | |

Battlefront, once its module is a candidate (the list above): `perf-probe` at High on WebGPU, `WORKER=on` and off, interleaved, three runs each, the `main`, `p50` and `worst 1 %` columns side by side. Until then `WORKER=on` measures Battlefront on the page runtime through the worker’s face (the same frame, for the face’s own cost):

```
GPU=webgpu QUALITY=high OUT=fl5-off-1 node scripts/perf-probe.mjs battlefront
GPU=webgpu QUALITY=high WORKER=on OUT=fl5-on-1 node scripts/perf-probe.mjs battlefront
GPU=webgpu QUALITY=high OUT=fl5-off-2 node scripts/perf-probe.mjs battlefront
GPU=webgpu QUALITY=high WORKER=on OUT=fl5-on-2 node scripts/perf-probe.mjs battlefront
GPU=webgpu QUALITY=high OUT=fl5-off-3 node scripts/perf-probe.mjs battlefront
GPU=webgpu QUALITY=high WORKER=on OUT=fl5-on-3 node scripts/perf-probe.mjs battlefront
```

| run | worker | main ms | p50 ms | worst 1 % ms |
| --- | --- | --- | --- | --- |
| 1 | off | | | |
| 1 | on | | | |
| 2 | off | | | |
| 2 | on | | | |
| 3 | off | | | |
| 3 | on | | | |

A note for reading `perf-probe` with the flag on: its recorder times the page’s `requestAnimationFrame` callbacks, so for a world drawn in the worker its `main` column is the page’s share alone (the input’s sample and post), and its frame times are the page’s beats; the world’s own frames are `__RUNTIME__.workerFrames()` (what `tools/measure.mjs` reads), and its GPU column the worker’s clock through `__RUNTIME__.gpuClock`.
