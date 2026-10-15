# WebGPU acceleration: the design

Date: 2026-10-08. Lane: runtime. Builds on `2026-10-06-world-runtime-design.md` (the backends) and `2026-10-07-smooth-worlds-design.md` (the GPU work queue). Measured against `docs/research/2026-10-07-frame-hitches.md`.

## What was found

The runtime already has a WebGPU backend (`src/runtime/webgpu.js`: `WebGPURenderer` from `three/webgpu`, a `PostProcessing` chain from `three/tsl`) and a pure pick (`backend.js`) that gives it to a module whose `shading` is `'nodes'`. No shipped module is. Every world is `shading: 'glsl'`, because `WebGPURenderer` cannot run a `ShaderMaterial`, an `onBeforeCompile` patch or an `EffectComposer`, and the site has 541 such sites in 259 files. So the WebGPU path is built, tested against one fixture, and never taken by a visitor.

Counted over each module’s transitive imports (a module’s own folder and everything it reaches under `src/`), the GLSL that stands between each world and WebGPU:

| module | files reached | GLSL sites | where |
| --- | --- | --- | --- |
| `earth` | 21 | 5 | all in `earth/scene.js` (globe, clouds, air, beams, trail) |
| `minecraft` | 43 | 7 | `scene/shaders.js`, `sky.js`, `drops.js`, `cursor.js` |
| `mario64` | 56 | 9 | `looks.js`, `models/things.js`, `scene.js` |
| `expanse-surface` | 41 | 21 | all in `lib/three` (foliage, wind, groundmap, house, grass, river, land, tracks, puffs, windLines) |
| `deathstar-inside` | 112 | 26 | the rooms’ effects and `lib/three` |
| `galaxy`, `galaxy-surface` | 300 to 424 | 133 to 182 | the universe’s post chain, planet shading, grounding, matcap, the cockpit |

(`lib/three/frameGuard.js` reads `onBeforeCompile` to compare materials and is not GLSL; the counts leave it out.)

Three things stand in the way of a visitor ever reaching WebGPU, and none is a port:

1. **A `'nodes'` module has nowhere to run without WebGPU.** `pickBackend` gives it `'webgl'` on Safari, Firefox and after a device loss, and the WebGL backend is the classic `WebGLRenderer`, which cannot draw a node material. The first ported world would be broken for a third of visitors.
2. **The `'nodes'` promise is checked over the module’s folder only.** `shading.test.js` reads the files under the module; Expanse’s 21 GLSL sites are all in `lib/three`, so a module flipped to `'nodes'` with a GLSL import passes the test and throws on its first frame.
3. **Nothing measures that a port draws the same picture, or draws it faster.** `scripts/perf-probe.mjs` runs one backend; nothing diffs two renders of a world.

## What WebGPU buys here, and what it does not

The steady frame is 2 to 16 ms on an M3 Pro in every world but the Shire’s map (22.7 ms at 359 to 1056 draws), and two to five times that on a laptop chip. The stalls were the problem and the frame guard answered them. What is left is per-frame cost, and on three.js that cost splits two ways: pixels (the pixel ratio, multisampling, bloom), which a backend swap does not change, and draw submission on the main thread (state, uniforms, bind groups per draw: roughly 10 to 20 µs a draw on WebGL), which WebGPU cuts, and which `three/webgpu`’s `BundleGroup` can take to near zero for everything static in a scene. The worlds that gain most are the draw-heavy ones (Middle-earth, Avengers, the galaxy surfaces), and they carry the most GLSL. The worlds that can be ported this week gain less per frame.

So this design is a lane, not a flip: make the WebGPU path reachable and safe, prove it on the smallest world with a picture diff and a frame-time table, then port worlds in order of their GLSL count, building the TSL twins of `lib/three`’s shared shaders as each needs them, so that the big worlds’ ports become possible. Each port ships only when the picture is the same within a stated tolerance.

Not here: WebGPU compute for the land cells and chunk meshing. Both already run in workers; moving them to WGSL would trade a worker’s latency for a readback’s and risk a block boundary flipping between a JS noise and a WGSL one. Revisit when a `'nodes'` world owns its buffers on the GPU (then the result never comes back to the CPU).

## The shape

### Three backend kinds

`pickBackend({ gpu, shading, override, lost })` returns one of:

- `'webgl'`: the classic `WebGLRenderer` (`runtime/webgl.js`). Every `'glsl'` module, always.
- `'webgpu'`: `WebGPURenderer` on a WebGPU device (`runtime/webgpu.js`). A `'nodes'` module when `navigator.gpu` exists, no device has been lost, and the override is not `'webgl'`.
- `'nodes-webgl'`: `WebGPURenderer({ forceWebGL: true })`, three’s node renderer on a WebGL 2 context (`runtime/webgpu.js`, the same factory). A `'nodes'` module everywhere else: no `navigator.gpu`, a lost device, or `?gpu=webgl`.

A `'nodes'` module therefore never meets the classic renderer, and `?gpu=webgl` on a `'nodes'` module means “the same materials on WebGL 2”, which is the comparison the parity check wants. `readOverride` still accepts only `webgl` and `webgpu`: the third kind is the runtime’s, never asked for. `rt.gfx.backend` reports the kind in force.

A `'nodes-webgl'` backend is a WebGL context like any other: its canvas’s `webglcontextlost` is its loss, reported through `onLost` as the classic one is, and the next mount of a `'nodes'` module makes `'nodes-webgl'` again (a WebGL loss never downgrades further; a WebGPU loss downgrades once, to `'nodes-webgl'`).

### The promise, checked over the imports

`src/runtime/shadingClosure.js` (pure): `importsOf(source) → string[]` (static and dynamic import specifiers), `closure(entry, { read, resolve }) → Set<string>` (every file reached under `src/`, tests left out), `glslSites(source) → string[]` (the forbidden names it uses: `RawShaderMaterial`, `ShaderMaterial`, `onBeforeCompile`, `EffectComposer`, `ShaderPass`, `UnrealBloomPass`, `RenderPass`, `OutputPass`). `shading.test.js` runs `closure` from each `'nodes'` module and fails on any site in any reached file, except the infrastructure that names those words without making them: `lib/three/frameGuard.js`, `lib/three/renderer.js`, `lib/three/gpuWork.js` and `runtime/*`. (`lib/stage3d.js` is not exempt: it builds a composer.) The exemption list is in the test, with a line each saying why.

### The parity check

`scripts/gpu-parity.mjs <route> [--before] [--view <name>...] [--quality high]`: the route in headless Chromium at a fixed clock (`page.clock.install` at `2026-10-08T12:00:00Z`, so a sun or a tide is where it was), `?calibrate=off&quality=high`, the dev hook `__tpKeepFrames`, and the world’s named views where it has them (`window.__RUNTIME__.current.world.view?.(name)`, a dev hook the ported module adds: Earth’s `orbit` and `low`, Minecraft’s `title` and `day`). `--before` shoots `main`’s build (as `autopilot-check --before` does) into `scripts/gpu-parity/out/<route>/<view>-before.png`. Without it the script shoots the branch twice, `?gpu=webgl` (`'nodes-webgl'`) and `?gpu=webgpu`, and diffs each against `-before` with `sharp`: mean absolute difference per channel, the share of pixels off by more than 16/255 in any channel, and PSNR. **A port passes when every view has PSNR ≥ 32 dB and under 2 % of its pixels off by more than 16/255, on both backends.** The numbers and the three images go in the pull request. When Chromium finds no WebGPU adapter (this is the case in a cloud container: `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader` is tried, and reported), the `webgpu` leg is marked `skipped`, the `webgl` leg still gates the port (the materials are the same on both; only multisampling and float paths differ), and the owner’s desktop runs the WebGPU leg before the merge.

`scripts/perf-probe.mjs` learns `GPU=webgl|webgpu` (appended to the query as `gpu=`) and writes the backend into each journey’s report, so a port’s frame-time table is two runs of the same journey.

### The ports, in order

Each is its own session and pull request, flips its module to `'nodes'` with the guard green, and ships with the parity table and the perf table (both backends) in the pull request.

1. **Earth** (5 sites, one file). The proof of the path: the globe, the clouds, the air, the beams and the trail as TSL `Fn`s in `earth/nodes.js`, each a factory returning a `NodeMaterial` and its uniform nodes under the names the frame code already writes (`uSun`, `uTime`, …), so `scene.js`’s per-frame code changes only where it imports the materials. `precompile(renderer, …)` becomes `rt.gfx.compile(scene, camera)`. No bloom, no composer: nothing in the post chain to match.
2. **Minecraft** (7 sites, four files, and the first world where the frame is draw-bound: a chunk column is up to three draws and the high tier draws a 21 × 21 ring). The block material reads the mesher’s packed `data` attribute and a `DataArrayTexture` atlas (`texture(atlas, uv).depth(layer)`), with flat varyings and the four animation strips as a uniform array; the sky’s dome, stars (`PointsNodeMaterial`), sun and moon sprites and clouds; the drops and the crack cursor. The arithmetic stays on sRGB bytes as painted: the atlas keeps `NoColorSpace` and the material writes its colour to `outputNode` with the renderer’s own output transform, so the first thing the parity check looks at is colour.
3. **Mario 64** (9 sites).
4. **The Expanse surface** (21 sites, all shared): the TSL twins of `lib/three`’s foliage, wind, groundmap, house, grass, river, land, tracks, puffs and wind lines, each beside its GLSL original as `<name>Nodes.js` with the same factory signature and the same pure test on a stub, so the natural-worlds lane keeps shipping GLSL and the ported worlds take the nodes twin. This is the step that opens the galaxy surfaces and Middle-earth.

Then, per world as it is ported: `BundleGroup` round what never moves (a town, a compound, the Death Star’s rooms), measured by the perf probe.

### Nothing changes for the visitor

The quality tiers, the pace, the calibration and the gate are the runtime’s and apply to every kind. A `'nodes'` module reads `rt.gfx.backend` only to show it. Save keys, dev hooks, achievements and sounds are untouched by a port: a port changes a world’s materials and nothing it does.

## Testing

- `backend.test.js`: every pick for the three kinds, the override on each shading, a WebGPU loss to `'nodes-webgl'`, a WebGL loss staying put.
- `runtime.test.js`: a `'nodes'` module on a runtime without `gpu` mounts on `'nodes-webgl'`; a WebGPU loss then a mount makes `'nodes-webgl'`; `browser.js`’s `makeBackend` maps the kind to `createWebGPU(canvas, { forceWebGL: true })`.
- `shadingClosure.test.js`: imports found (static, dynamic, re-exports, index files, `.jsx`), the closure over a fixture tree, the sites found and the comments ignored.
- `shading.test.js`: the fixture passes; a fixture `'nodes'` module importing a GLSL helper fails (the test makes it in a temp dir).
- Each port: a `nodes.test.js` that builds every material in Node (TSL builds without a GPU) and checks the uniform names and the material flags (transparent, blending, side, depthWrite) match the GLSL originals; the parity check; the perf probe; `node scripts/autopilot-check.mjs --only smoke --routes <route>`.
- CI runs the unit tests. The parity and perf scripts run on a machine with a GPU, and their tables go in the pull request.

## Rollout

Pull request 1 (this lane’s infrastructure: the three kinds, the closure guard, the parity and perf scripts, the docs), then one pull request per port in the order above, each merged on its own as soon as its checks and tables are in. A port whose parity fails is not merged; it is fixed or the module stays `'glsl'`.

## Addendum, 2026-10-13: every world, by its measure

The owner's word: every world defaults to WebGPU, the renderer that does the most with the chip, choosing whatever gives the best quality for the performance; and a TSL twin is as good as the GLSL it replaces, or better, never worse.

What the research of the day found (`docs/research/2026-10-13-webgpu-wasm-and-engines.md`, c9): WebGPU the API costs less a draw, but three's node renderer spends more of the main thread a mesh than the classic one (r183, 4,000 meshes: 9.7 ms a frame against 4.5, the first frame 167 ms against 32, the same with `forceWebGL`: the renderer's own bookkeeping). Its gains come from what only it has: render bundles, indirect draws, compute culling, a GPU-resident scene. So a world moved 1:1 can lose frames on a laptop, and a world moved and rebuilt for it gains them.

So each port, in this design's order and then the rest of the site's worlds, ships only when all three hold, its tables in the pull request:

1. **Parity, shader by shader**: `scripts/twin-parity.mjs` for each twin (32 dB and under 2 % of pixels off, the line it already keeps), `scripts/gpu-parity.mjs` for the world. A twin under the line is fixed, not merged.
2. **Frames, both ways**: `scripts/perf-probe.mjs` on the classic renderer and on the node renderer, the main thread's milliseconds and the GPU's, at Low and at High. The world draws on WebGPU where it is no slower; where it is slower, it is rebuilt the node renderer's way first (`BundleGroup` round what never moves, instancing for what repeats, the GPU scene for a level) and measured again.
3. **The closure clean**: `shading.test.js`, and `glsl-sites` lower by the world's count.

The worlds not on the runtime (the universe map, Middle-earth, the Rick and Morty worlds, the Avengers' compound, Cybertron, Scranton, Albuquerque, the Death Star's trench, Invincible, the Caribbean, the music room, the classic pages' scenes) first become world modules on the runtime, still `'glsl'`, which gives them the renderer tier's Auto, the cadence and loss recovery at once; their ports follow. The order after Mario 64 and the Expanse flight: the Death Star's inside (13 files in its closure), the universe map (the most visited), the galaxy (54), then the rest by visits.
