# The WebGPU foundation: implementation plan (part 1, PR “Foundation A”)

Date: 2026-10-06. The design is `docs/superpowers/specs/2026-10-06-webgpu-worlds-and-living-worlds-design.md`, part 1. One session, one PR, merged on its own. Tests first on every pure module. British spelling, curly quotes, comments that say why. Commits end with the harness's attribution lines; no model names in code or docs.

Done looks like: a `nodes` world at `/lab/gpu` draws through `WebGPURenderer` on a WebGPU browser and through its WebGL 2 backend with `?gpu=webgl`; `scripts/gpu-check.mjs` proves both in headless Chromium; `src/lib/tsl/` holds hash, noise, sky, surface and post with tests; the runtime reports `caps`, offers `compute`, and downgrades once when a first frame throws.

## Before starting

- `git fetch --all --prune`, branch from `origin/main`, `npm ci`.
- Read `src/runtime/{runtime,webgpu,webgl,gfx,backend,module}.js`, `src/runtime/fixtures/nodesWorld.js`, `src/runtime/shading.test.js`, `src/lib/three/noise.js`, `src/components/galaxy/bodyShaders.js` (the atmosphere shell), `src/components/universe/post.js` (the grade), `scripts/autopilot-check.mjs` (the Chromium launch).
- Confirm the probe: on an `http://127.0.0.1` page, headless Chromium with `--headless=new --enable-unsafe-webgpu --enable-features=Vulkan,WebGPU --use-vulkan=swiftshader --use-angle=vulkan --ignore-gpu-blocklist --enable-unsafe-swiftshader` gives a `requestAdapter()`; `about:blank` does not.

## Task 1: the Playwright that carries Chromium 143 or newer

three r186 sends a texture-view `swizzle` that Chrome added in 143; Playwright 1.56's Chromium is 141 and throws on the first WebGPU frame.

1. Find the smallest `playwright-core` version whose Chromium is ≥ 143 (its release notes list the browser); bump `devDependencies`, `npm install`, commit the lock.
2. Install that Chromium under `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH`), and make `autopilot-check.mjs`'s executable lookup find the new `chromium-<n>` folder (it already globs).
3. Run `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build` and keep its screenshots: the software-WebGL worlds must draw as before.

## Task 2: `src/lib/tsl/hash.js` and `noise.js` (tests first)

1. `src/lib/tsl/noise.test.js`: builds each function with `Fn` from `three/tsl` and asserts the node graph builds (`node.build` with a `NodeBuilder` from `three/webgpu`'s `WGSLNodeBuilder` and the fallback's `GLSLNodeBuilder`, so the test proves both languages compile from the same graph without a GPU), and that the JavaScript twins (`hashJs`, `simplexJs`, `fbmJs`) are deterministic and in range on a grid. Run: red.
2. `hash.js`: `pcg(uint)`, `hash21(vec2)`, `hash31(vec3)` as TSL; the JS twins exported beside them. `noise.js`: `simplex2`, `simplex3`, `fbm(p, octaves, lacunarity, gain)`, `ridged`, `voronoi`, `warp`, with JS twins for the ones the terrain worker will need (`simplex3`, `fbm`, `ridged`). Port from `src/lib/three/noise.js`'s GLSL; keep the constants the same so a nodes world's noise matches a GLSL world's. Run: green.
3. A browser check comes in Task 6; keep the module free of renderer imports.

## Task 3: `sky.js`, `surface.js`, `post.js` (tests first)

1. `sky.test.js`, `surface.test.js`, `post.test.js`: the graphs build in both builders; `blackbody(6500)` is near white, `blackbody(3000)` warmer; the grade with neutral settings returns its input (compare the JS twin of the grade on three colours).
2. `sky.js`: `rayleighMie(...)` ported from `bodyShaders.js`'s shell (same coefficients, same sunset band), `blackbody(kelvin)`, `analyticSky(dir, sun)` as the `low` tier's stand-in. `surface.js`: `matcap`, `triplanar(tex, p, n, scale)`, `antiTile` (the `lib/three/surface.js` idea), `fresnel`. `post.js`: `grade(color, { contrast, saturation, splitShadow, splitHighlight, vignette, grain })` and `dither(color, uv)` (ordered, 8×8 Bayer).

## Task 4: the runtime's capabilities, compute and the first-frame guard (tests first)

1. `src/runtime/gfx.test.js` (new, or the existing runtime tests): `makeGfx` exposes `caps` from the backend; `compute` on a WebGL gfx rejects with a plain message; `webgpu.js` fills `caps` from the renderer's backend (`isWebGPUBackend`) and `compute(node)` calls `renderer.computeAsync`.
2. `src/runtime/runtime.test.js`: a module whose first `draw` throws is unmounted and remounted on WebGL once, with `onLost`'s path; a second throw fails the world (status `failed`), never a loop. A module with `needs: 'webgpu'` on a runtime without `navigator.gpu` gets status `failed` with the reason the host card shows.
3. Implement in `gfx.js` (`caps`, `compute`), `webgpu.js`, `webgl.js` (`caps` all false), `runtime.js` (the guard around the first `draw`; `needs`), `module.js` (`needs` validated: `'any'` default or `'webgpu'`), `WorldHost.jsx` (the card's line). Run: green.
4. `rt.gfx.post`: add `grade`, `dither`, `flare` (`three/addons/tsl/display/LensflareNode.js`) and `gtao` (`GTAONode`, WebGPU only; skipped on WebGL with a `console.info` once) to `webgpu.js`'s `buildPostProcessing`, with a test over the description → graph mapping using fakes for the node modules.

## Task 5: the proving ground at `/lab/gpu`

1. `src/components/lab/gpu/module.js`: `{ id: 'lab-gpu', shading: 'nodes', mb: 0, label: 'the GPU proving ground', create(rt) }`. `module.test.js` with a fake `rt` (Earth's pattern): the module validates; `step` advances the time; `dispose` releases.
2. `scene.js`: a sphere with `MeshStandardNodeMaterial` whose `colorNode` is `noise.js`'s fbm by position, an atmosphere shell with `sky.js`, a ground plane with `surface.js`'s triplanar on a procedural texture, a point light as the star, `rt.gfx.post([{ kind: 'render' }, { kind: 'bloom' }, { kind: 'grade', ... }, { kind: 'dither' }])`. When `rt.gfx.caps.compute`, a compute node writes a 256×256 storage texture of fbm every frame and the sphere samples it; otherwise the sphere samples a `DataTexture` the CPU filled once with the JS twin. An overlay (the HUD pattern) shows the backend, the pixel ratio, draw calls and frame time.
3. The route: `/lab/gpu` in the router, development only (`import.meta.env.DEV`, as other dev hooks), on `useWorld` and `WorldHost`; `window.__GPU__` exposes `{ backend, caps, frame }`.
4. Run it in dev mode on both backends (`?gpu=webgpu`, `?gpu=webgl`): the same picture bar the compute path; note the frame time on this machine's `high` tier for the hand-off.

## Task 6: `scripts/gpu-check.mjs`

1. Written as `autopilot-check.mjs` is (the dev server on `127.0.0.1`, Playwright, screenshots under `docs/superpowers/shots/gpu/`), with the WebGPU flags above. For each nodes route (found by reading `module.js` files with `shading: 'nodes'`, the way `shading.test.js` finds them), load it, wait for `window.__RUNTIME__.status === 'on'`, read `rt.gfx.backend`, sample the canvas (non-black pixels over a threshold), collect console errors; then the same with `?gpu=webgl`. Fail if the backend is not the one asked for, the frame is black, or an error was logged.
2. `--self-test`: runs the three-line TSL plane from the research note's probe first, so a Chromium that cannot do WebGPU fails fast with a line saying why.
3. Add it to the deploy workflow after `npm test` (`node scripts/gpu-check.mjs`), and to `.claude/skills/autopilot/SKILL.md`'s check list for nodes routes.

## Task 7: docs and hand-off

1. `docs/architecture.md`: one paragraph under the world runtime's list for `src/lib/tsl/`, `/lab/gpu` and `gpu-check.mjs`.
2. `docs/superpowers/HANDOFF-webgpu-worlds.md`: tick Foundation A under Done with the PR number and the numbers (frame time on both backends, the Chromium version); Left stays as the spec's sequence.
3. `npm run lint`, `npm test`, `npm run build`, `node scripts/autopilot-check.mjs --routes /lab/gpu` (software WebGL), `node scripts/gpu-check.mjs`. Merge `origin/main` in; push; PR with the screenshots and the counts.

## Not in this PR

The WGSL kernels (Foundation B), anything under `uncharted/` or `life/`, the Worker, the tiles.
