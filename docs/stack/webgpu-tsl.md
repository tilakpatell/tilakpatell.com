# three/webgpu and TSL

**Version** `three@^0.186.1` (`three/webgpu`, `three/tsl`, `three/addons/tsl/display/BloomNode.js`) · **Page owner** `src/runtime/` · **Decision** [three.js over Babylon.js](../decisions/2026-10-08-three-over-babylon.md)

## What it is, and why it is here

`three/webgpu` is three.js’s node renderer, `WebGPURenderer`; `three/tsl` is its shading language, materials and post chains written as JavaScript node graphs that compile to WGSL on WebGPU and to GLSL on WebGL 2. They ship inside the `three` package, so they have no row of their own in the index.

The site wants it for draw submission: on WebGL every draw costs main-thread time for state and uniforms, WebGPU cuts that, and `BundleGroup` can take what never moves in a scene to near nothing. Pixel cost (the ratio, multisampling, bloom) is the same on either backend. The reasoning and the measurements are in `docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md`, and why this road and not another engine is in the decision.

What it refuses: the node renderer cannot run a `ShaderMaterial`, an `onBeforeCompile` patch or an `EffectComposer` (`src/runtime/backend.js`’s header). Every one of those in a world stands between that world and WebGPU.

## Where it is used

Only in the runtime, and only through dynamic imports, so no visitor downloads it until a world asks for it:

- `src/runtime/webgpu.js`: the WebGPU backend, `createWebGPU` and `buildPostProcessing`.
- `src/runtime/backend.js`: `pickBackend`, the pure choice of backend, and `readOverride`.
- `src/runtime/fixtures/nodesWorld.js`: the smallest world that keeps the `'nodes'` promise, a lit cube that turns; the reference to copy and the proof the check runs.
- `src/lib/three/light/`: the game's light as one stack for a `'nodes'` world (the galaxy engine's lane R): `applyGameLight` in `apply.js` wires the sun (`SunLight` with its cascades), the placed lights (`ClusteredLighting` on WebGPU), the probe volumes and grid (`LightProbeGrid`), the TSL sky and fog, and gives the post chain as data (`post.js`), which `src/runtime/webgpu.js` hands to `passes.js` to build. The addons it loads, each dynamically and only from this folder: `three/addons/lights/SunLight.js` and `SunLightNode.js`, `three/addons/lighting/ClusteredLighting.js` and `LightProbeGrid.js`, and `three/addons/tsl/display/` `SSGINode`, `DenoiseNode`, `GTAONode`, `SSRNode`, `BloomNode`, `GodraysNode`, `LensflareNode` with `GaussianBlurNode`, `Lut3DNode`, `TRAANode`, `SMAANode`.
- `src/lib/three/particles/`: the game's effects from their emitter tables (fidelity lane X). `gpu.js` is the site's first compute pass: an emitter's step as a TSL `Fn().compute(n)` over three `instancedArray` storage buffers (`posAge`, `velLife`, `extra`, a vec4 each a particle), one `renderer.compute` an emitter a frame, the spawns not sent but hashed from each particle's serial (PCG in `u32`, the same integers `curves.js` hashes in JavaScript); `sprites.js` draws a pool as one `Mesh` with `count` instances of a quad whose corners its `positionNode` places in world space from the buffers (`storage.toAttribute()` on WebGPU, `instancedBufferAttribute` over the CPU step's arrays on WebGL 2). `effects.js`'s `createEffects` is the face a world takes. No addon: three's `softParticles` is written out in `sprites.js` (see Gotchas).
- `src/runtime/fixtures/litWorld.js`: the lit fixture, `applyGameLight` on a ring of pillars; `node scripts/light-fixture.mjs` draws it on both kinds and writes its shots and frame times to `docs/superpowers/evidence/galaxy-engine/R/`.

On `main` today no shipped world is `'nodes'`, so no visitor reaches this renderer yet.

## How the site uses it

**On `main` today:**

- **A world says what it draws with.** A world module carries `shading: 'glsl' | 'nodes'` (`src/runtime/module.js`), `'glsl'` when it says nothing.
- **The runtime picks.** `pickBackend({ gpu, shading, override, lost })` in `src/runtime/backend.js` returns `'webgpu'` only when the browser has WebGPU, no device has been lost and the module is `'nodes'`; otherwise `'webgl'`, the classic renderer. A lost WebGPU device sets the runtime’s `lostWebGPU` (`src/runtime/runtime.js`), so the next mount is on WebGL: one downgrade, never a loop.
- **The visitor can force either**: `?gpu=webgl` or `?gpu=webgpu` in the address (after the `?` in the hash too, since the site uses hash routes), or `localStorage` `tp-gpu`; `readOverride` takes only those two words.
- **A module sees one renderer.** `src/runtime/gfx.js` gives a world the same face on both backends: its size and sharpness, `compile` and `upload` before the first frame, and `post(passes)`, a post chain described as data (`render`, `bloom`, `output`; `shader` only on WebGL; on the node renderer also `ssgi`, `denoise`, `ao`, `ssr`, `godrays`, `lensflare`, `lut`, `traa`, `smaa`, in the order and per tier that `src/lib/three/light/post.js`’s `passesFor` gives). `src/runtime/webgl.js` builds it with an `EffectComposer` and refuses the node renderer’s kinds by name, `src/runtime/webgpu.js` with `PostProcessing` and TSL’s `bloom`, or, for a chain with any of the node kinds, `src/lib/three/light/passes.js`’s `buildChain`.
- **The promise is tested.** `src/runtime/shading.test.js` reads the folder of every `'nodes'` module under `src/components/`, and the fixture, and fails on a `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile` or `EffectComposer` in it.

**In the design, not yet on `main`** (the WebGPU lane is building it; this page is updated by that lane in the same pull request as the code):

- A third kind, `'nodes-webgl'`: the node renderer on a WebGL 2 context, so a `'nodes'` world runs for the visitors without WebGPU and never meets the classic renderer.
- The promise checked over a module’s imports, not only its folder: the closure guard, with the same exempt infrastructure as the measure’s `glsl-sites` (`EXEMPT` in `scripts/health/glsl-sites.mjs`).
- A parity check that shoots a world on `main` and on the branch on both backends and diffs the pictures; a port passes under the thresholds the design states.
- The port recipe: a world’s GLSL becomes TSL functions in a `nodes.js` beside its scene, each a factory returning a node material and its uniforms under the names the frame code already writes, so the per-frame code changes only where it imports the materials. Then `BundleGroup` round what never moves, measured by the perf probe on each backend.
- The order: Earth, Minecraft, Mario 64, then the Expanse surface (the TSL twins of `src/lib/three/`’s shared shaders), which opens the galaxy surfaces and Middle-earth.

## What the site does not use, and why

- **WebGPU compute for the land cells and chunk meshing.** Both already run in workers; moving them to WGSL would trade a worker’s latency for a readback’s and risk a block boundary differing between the JavaScript noise and a WGSL one (the design, “What WebGPU buys here”). Revisit when a `'nodes'` world keeps its buffers on the GPU.
- **`three/addons/` on the classic renderer.** The runtime’s WebGPU backend imports its bloom from `three/addons/tsl/`; classic-renderer code keeps to `three/examples/jsm/` ([three.md](three.md)).
- **A `'shader'` post pass.** `buildPostProcessing` throws on one: a full-screen GLSL pass has no place on this renderer, and a world that needs one ports it to TSL first.

## Rules

- A world is `'glsl'` until nothing it draws with is GLSL; `src/runtime/shading.test.js` fails a `'nodes'` module whose folder makes any.
- `readOverride` takes only `webgl` and `webgpu`; anything else forces nothing (`src/runtime/backend.test.js`).
- A port changes a world’s materials and nothing it does: its rules, controls and saves stay as they were (the design; the parity check will hold the picture once it lands).
- The GLSL left in the site is counted by the measure’s `glsl-sites` (`scripts/health/glsl-sites.mjs`); a port lowers it, and nothing should raise it without a reason in the commit.
- The lighting and display addons are imported dynamically and from `src/lib/three/light/` only (`three.js`’s `loadThree`, `passes.js`’s `ADDONS`, `probes.js`’s grid); a world takes them through `applyGameLight` and `passesFor`, never by importing an addon itself.
- A particle effect is one draw per emitter of a kind and one compute dispatch on WebGPU, never one per particle or per instance (`src/lib/three/particles/effects.js`); its buffers are sized once from the record (`MaxCount × MaxActiveInstanceCount`) and nothing is allocated per frame.
- What the node renderer over WebGL 2 cannot draw is left out by data, not by a throw: `post.js`’s `CANNOT` (SSR and TRAA there, SMAA in TRAA’s place), `placed.js`’s fallback pool where `ClusteredLighting`’s compute does not run. Each was found on the lit fixture; the shots are in `docs/superpowers/evidence/galaxy-engine/R/`.

## Upgrading

`three/webgpu` and `three/tsl` move with `three`, so they upgrade with it ([three.md](three.md), Upgrading). The node renderer changes faster than the classic one; after a bump, also re-check:

- `buildPostProcessing`’s imports in `src/runtime/webgpu.js`: `PostProcessing`, `pass`, and `bloom` from `three/addons/tsl/display/BloomNode.js`. They are loaded dynamically, so a rename fails when a world first draws, not at build time.
- `src/lib/three/light/`: `SunLightShadow`’s cascade count (two in r186, read by `sun.js`), `ClusteredLightsNode.setLights` (which lights it clusters, read by `placed.js`), and the display nodes’ uniforms `passes.js` sets (`sliceCount`, `stepCount`, `giIntensity`, `radius`, `distanceExponent`, `maxDistance`, `thickness`, `density`, `maxDensity`). `npx vitest run src/lib/three/light` builds every tier’s chain in Node; `node scripts/light-fixture.mjs` draws it.
- `createWebGPU`’s watch for a lost device, which reads `renderer.backend.device` (inside three’s backend, not its public face).
- `npx vitest run src/runtime` and, once it exists, the parity check on every ported world.

Last upgrade: not recorded; record the next one here, with what it broke.

## Gotchas

- **An override can put a `'glsl'` world on WebGPU.** `pickBackend` honours `?gpu=webgpu` whatever the module’s shading, as long as the browser has WebGPU, so forcing it on a world that still has GLSL breaks that world’s first frame. Use it on `'nodes'` worlds and the fixture only.
- **Colour space on a port.** A world that does its arithmetic on sRGB bytes as painted (Minecraft’s atlas is `NoColorSpace`) shifts every colour if the node material lets the renderer linearise the texture or applies the output transform twice; colour is the first thing to compare (the WebGPU plan’s Review Focus 4).
- **A sun that moves with the clock.** Two shots of Earth a minute apart differ, so a picture diff freezes the page clock first (the WebGPU plan’s Review Focus 5).
- **A LUT or SMAA on linear HDR.** `Lut3DNode` indexes 0…1; given the scene pass before tone mapping it clamps every bright pixel to its last cell and the frame goes white. `passes.js` applies `renderOutput` before the first of them and switches the pipeline’s own output transform off, as three’s examples do.
- **The headless WebGPU leg.** In the cloud container Chromium makes a SwiftShader WebGPU device and loses it on the first frame, even under a bare cube (`scripts/gpu-parity/README.md`), so `light-fixture.mjs`’s webgpu leg fails there and does not gate; the owner’s laptop runs it.
- **Device loss is a downgrade, not a retry.** After a lost WebGPU device the runtime stays on WebGL for as long as it lives (`lostWebGPU`, set by `lost()` in `src/runtime/runtime.js`).

## The number

How much GLSL is left between the site and WebGPU is the measure’s `glsl-sites`: `node scripts/health.mjs --only glsl-sites` prints today’s count and the files with the most. The design’s table of sites per world (counted over each module’s imports on 2026-10-08) is in `docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md`, “What was found”; it is the order the ports follow.
