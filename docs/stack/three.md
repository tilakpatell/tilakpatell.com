# three.js

**Version** `three@^0.186.1` · **Page owner** `src/lib/three/` · **Decision** [three.js over Babylon.js](../decisions/2026-10-08-three-over-babylon.md)

## What it is, and why it is here

The WebGL library every 3D thing on the site draws with: the classic pages’ scenes, the universe map and every world. It gives a scene graph, materials, loaders and the add-ons under `three/examples/jsm/`; the site builds its own engine-shaped pieces on top (the renderer’s care, the frame guard, the house look), which is why a switch to an engine was turned down (see the decision). Its node renderer, `three/webgpu`, has its own page: [webgpu-tsl.md](webgpu-tsl.md).

## Where it is used

`three` is the most imported package on the site; the census row in [README.md](README.md) gives the count. Run `node scripts/stack-census.mjs` for the folders that import it most: on 2026-10-08, `src/components/universe`, `src/components/rickmorty`, `src/components/middleearth`, `src/components/galaxy` and `src/lib/three`.

The entry points to open first:

- `src/lib/three/renderer.js`: the renderer every page scene draws with.
- `src/lib/three/useScene.js`: how a page loads a scene only near the viewport and draws it only while it is on screen.
- `src/runtime/webgl.js`: the world runtime’s WebGL backend, built on the same renderer, with an `EffectComposer` for a post chain described as data.

three.js is loaded only by lazily loaded scene modules, so a page that never draws in 3D never downloads it (`renderer.js`’s header).

## How the site uses it

Go through the shared pieces in `src/lib/three/` rather than three directly; each exists because a scene got it wrong on its own.

- **Renderer** (`src/lib/three/renderer.js`): `createRenderer` gives sRGB output, a pixel ratio the device can afford, a watchdog that trades sharpness for frame rate, context loss reported rather than thrown, and a dispose that frees everything (`disposeTree`, `releaseContext`). `fitRatio` keeps the drawing buffer inside the chip’s limits (`maxSide`).
- **Shaders before the first frame**: `precompile` and `precompilePasses` in `renderer.js`, so something new coming into view doesn’t stop the page while the chip catches up.
- **The frame guard** (`src/lib/three/frameGuard.js`): no frame waits for a shader or a picture; what isn’t ready on the chip is left out of the frame and readied behind it, under a budget.
- **The GPU work queue** (`src/lib/three/gpuWork.js`): a world’s warm-up (pictures, shaders, one draw of everything) in slices, with a fence between them, never a synchronous question to the chip.
- **Textures** (`src/lib/three/textures.js`): every loader and painted canvas goes through `sharpen`, so anisotropy comes from the device’s tier; `loadTexture` decodes off the main thread where the browser can; `variant` picks the `-sm` file for a smaller tier; `warm` uploads before the first draw.
- **Models** (`src/lib/three/gltf.js`): one loader for every GLB, meshopt always on, KTX2 read with the transcoder fetched only when a file carries one; `prepare` gives each model the same care (shadows, skinned meshes never culled, sharp maps).
- **The house look** (`src/lib/three/house.js`): one look for every world, patched on after three has lit the point: shade as a colour, fog as the sky, and the light the ground bounces up.
- **Pace** (`src/lib/three/pace.js`): watches the time between frames and draws a step softer when frames come late, sharper once they don’t; or never sharper (`climb: false`) where each step resizes the canvas, as on the world runtime. On a stage world (`src/lib/stage3d.js`, `stage.scale`) and the universe a step is the composer’s buffers drawn smaller and scaled up to the canvas, which keeps its size.
- **Device tiers** (`src/lib/device.js`): `budget()` is the renderer’s numbers for this device (pixel ratio, multisampling, shadows, bloom, anisotropy); `src/lib/budgets.js` says how much a scene draws at each quality level (triangles, draw calls, props).

Add-ons come from `three/examples/jsm/` (`src/runtime/webgl.js` is the example to copy). `three/addons/` is the same folder under another name; under `src/` only the node renderer’s files use it, `src/runtime/webgpu.js` for its bloom and `src/lib/three/light/` for the game light’s lights and passes ([webgpu-tsl.md](webgpu-tsl.md)), so a classic-renderer file follows the `examples/jsm` spelling the rest of the site uses.

## What the site does not use, and why

- **`OrbitControls` and the other control add-ons**: no file under `src/` imports them; each world has its own controls for flying, walking and driving.
- **`THREE.Clock`**: no file under `src/` makes one; time comes from the frame loop’s own `ms` and `now` (`useScene.js`’s `render(ms, now)`).
- **Physics add-ons**: physics is Rapier, under `src/lib/physics/` ([physics-rapier.md](physics-rapier.md)).
- **`WebGPURenderer`**: it is `three/webgpu`’s, reached only through the runtime ([webgpu-tsl.md](webgpu-tsl.md)).

## Rules

- `src/lib/three` knows Three.js and nothing about any world, and imports no page or component (`docs/health/RULES.md`, Layers; the measure’s `boundary-breaks` counts the imports that cross).
- Every scene starts from `lib/device`’s tier (`budget()`), lowers itself under `lib/three/pace`, loads only when near (`lib/three/useScene`) and is disposed on leave (the standing rules in `.claude/skills/autopilot/SKILL.md`; nothing measures this).
- Textures go through `sharpen`; `SRGBColorSpace` on colour maps only (the same standing rules; `src/lib/three/textures.test.js` tests `sharpen` itself).
- Models go through `gltf.js`’s loader, so meshopt and KTX2 are set once (no measure; reviews hold it).
- GLSL (`ShaderMaterial`, `onBeforeCompile`, `EffectComposer` and the passes) stays in worlds that draw with the classic renderer; the measure’s `glsl-sites` counts it, and each world ported to node materials lowers it ([webgpu-tsl.md](webgpu-tsl.md)).

## Upgrading

```
npm install three@<version>
npm test
npm run build
node scripts/autopilot-check.mjs --only smoke
node scripts/health.mjs --check --skip build
```

On a new release, re-read the two files that reach inside the renderer: `src/lib/three/frameGuard.js` wraps the instance’s `renderBufferDirect`, and both it and `src/lib/three/gpuWork.js` read `renderer.properties`. Either breaks quietly if three renames what it holds there. The GPU clock (`src/lib/three/gpuTime.js`) and the tier probe lean on three r186’s timestamp names: `backend.trackTimestamp` (r186 reads it on the backend, set from the renderer’s parameters, not on the renderer), `renderer.resolveTimestampsAsync('render')` (`TimestampQuery.RENDER`) and `renderer.info.render.timestamp`; the reference shots’ jitter (`src/lib/three/jitter.js`) wraps the instance’s `render`, which three’s `PassNode` calls for a post chain’s scene. Check all four still mean the same. Then `node scripts/stack-census.mjs --write` for the version in the index.

For the node renderer's picture (GPU-first lane N2), also re-check `SharpenNode`, `Renderer`'s `reversedDepthBuffer` (and `Camera.reversedDepth`, a getter it sets), whether `Texture` has gained a `mipmapBias` of its own (the site biases at the sample: `src/lib/three/mipBias.js`), and `getRoughness`'s floor of 0.0525 under `surface/compose.js`'s `specularAA` ([webgpu-tsl.md](webgpu-tsl.md), Gotchas).

Last upgrade: not recorded; record the next one here, with what it broke.

## Gotchas

- **The drawing buffer has a side limit.** A canvas wider than the chip’s smallest texture, renderbuffer or viewport limit draws wrong; `fitRatio` keeps the ratio a hair under it (`renderer.js`, `maxSide`).
- **A synchronous question waits on the chip.** Asking whether a shader has linked straight after compiling it makes the page wait for everything queued before it; ask after a fence (`gpuWork.js`’s header).
- **Colour space is opt-in.** `sharpen(texture, { color })` sets sRGB for `true`, none for `false` and leaves the texture alone when `color` is not given, so a data map (normals, roughness) must say `false` or keep what its loader set (`textures.js`).
- **A composer's buffers aren't whole pixels.** `EffectComposer.setSize` sizes its targets at width × pixel ratio unrounded (1470 × 1.75 = 2572.5) while the renderer floors the canvas (2572), and WebGL truncates the buffer to 2572. Compare a buffer with the canvas in whole pixels, `Math.floor(target.width)`, as `frameGuard.js`'s `frameTarget` does.
- **The first draw compiles.** three compiles a material’s shader and sends its pictures the first time it is drawn, and that frame waits for both; that is what the frame guard and `precompile` are for (`frameGuard.js`’s header, `docs/research/2026-10-07-frame-hitches.md`).
