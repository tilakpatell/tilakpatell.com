# Handoff: the WebGPU worlds, the uncharted and the living worlds

The lane that answers the owner's brief “move beyond Three.js and use WebGPU and write shaders; AI for conversational NPCs and alien life”. Read these first, in this order:

1. `docs/research/2026-10-06-beyond-webgl-webgpu-and-living-worlds.md` (what the named projects do, what three r186 gives, the probes run here, the AI options with costs)
2. `docs/superpowers/specs/2026-10-06-webgpu-worlds-and-living-worlds-design.md` (the design: four parts, the decisions, the open questions)
3. `docs/superpowers/plans/2026-10-06-webgpu-foundation.md` (part 1's plan, task by task)
4. `docs/superpowers/specs/2026-10-06-world-runtime-design.md` and `src/runtime/` (the runtime the whole lane stands on; its WebGPU backend is written and unused)

## The rules (don't break)

- The renderer moves, three stays. New worlds are `shading: 'nodes'` modules on `WebGPURenderer` with TSL; hand-written shaders are WGSL through `wgslFn` with a TSL or `glslFn` twin for the WebGL 2 fallback. A GLSL world is never flipped to `'nodes'` until every shader in its folder is TSL (`src/runtime/shading.test.js`).
- No runtime calls to asset services. Species sheets, baked lines and baked tiles are made ahead by scripts and committed. The talk Worker is the one runtime call, for conversation only, and only once the owner has said yes (open question 2 in the spec).
- Never print or commit a key. `ANTHROPIC_API_KEY` in `.env.local` for scripts, as a Worker secret for talk.
- Pure logic in tested modules apart from the drawing, tests first: `system.js`, `terrain.js`, the kernels' JS twins, `sheet.js`, `rules.js`, `persona.js`, `brain.js`, the Worker's caps.
- Every nodes world starts from the tier, lowers itself under the runtime's quality, names what the fallback draws for every WebGPU-only effect, and reports frame time, calls and triangles at fixed poses on `high`, `mid` and `low` before and after.
- One PR per step in the spec's sequence, merged on its own; never red, never force-pushed.

## Done

- The research, the design, the foundation's plan and this hand-off (this PR). No code.

## Left, in order

1. **Foundation A**: `docs/superpowers/plans/2026-10-06-webgpu-foundation.md`. Done: `/lab/gpu` draws on both backends, `scripts/gpu-check.mjs` proves it in headless Chromium, `src/lib/tsl/` has hash, noise, sky, surface and post with tests, the runtime has `caps`, `compute`, `needs` and the first-frame guard, Playwright carries Chromium ≥ 143.
2. **Foundation B**: `src/lib/tsl/kernels/{height,scatter}.wgsl.js` as WGSL with JS and TSL twins; a compute pass into a storage texture on `/lab/gpu`; a readback test that the WGSL and the JS agree on a grid. Done: the numbers in the hand-off and the test green on both backends.
3. **Uncharted 1**: `src/components/uncharted/system.js` (tested, three pinned seeds), the hand-over from the universe map past `layout.js`'s `RIM`, the system from space, `/uncharted/:seed` and the share link. Done: fly out of the map into a system and back.
4. **Uncharted 2**: `terrain.js` (tested quadtree), the floating origin, `logarithmicDepthBuffer`, flight to a few metres, seas, clouds; `high`/`mid`/`low` as the spec says. Done: counts at the three poses (orbit, descent, ground) on three tiers.
5. **Life 1**: `src/components/life/sheet.js`, `scripts/species.mjs` (the owner's machine; without the key, open an issue as gen3d does), six sheets under `src/data/species/`, `body.js`, `rules.js`, a herd at the first landing.
6. **Talk 1** (after open questions 2 and 3): `talk/{persona,brain,baked,remote}.js`, `workers/talk/` with caps, the alien speaks, then the hangar crews.
7. **Talk 2** (if wanted): `talk/local.js` with WebLLM behind opt-in.
8. **Earth from above** (after open question 4): `scripts/tiles.mjs`, baked places, `earth/flight.js`.

## Checking it

- WebGPU in headless Chromium needs an `http://` origin (not `about:blank`) and these flags: `--headless=new --enable-unsafe-webgpu --enable-features=Vulkan,WebGPU --use-vulkan=swiftshader --use-angle=vulkan --ignore-gpu-blocklist --enable-unsafe-swiftshader`. Verified in this container: an adapter with 19 features.
- three r186 throws on Chromium older than 143 (`createView`… `swizzle`). Playwright 1.56's Chromium is 141. Bump Playwright first (Foundation A, Task 1).
- `?gpu=webgl` and `?gpu=webgpu` force a backend (`src/runtime/backend.js`'s `readOverride`); `localStorage 'tp-gpu'` keeps it.
- Dev hooks: `window.__RUNTIME__` (the runtime), `window.__GPU__` (the proving ground, once built).
- The GLSL worlds are the control: after any runtime change, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /earth,/galaxy/tatooine,/` must still draw.

## Gotchas

- `WebGLBackend` (three's fallback) runs compute as transform feedback: one count, no indirect dispatch, no storage-texture writes. Anything that needs those checks `rt.gfx.caps` and takes the CPU path.
- `about:blank` has no `navigator.gpu`; a probe there says WebGPU is missing when it is not.
- The names in the brief that did not resolve (“gtremors/cosmos”, “recast”, “Trip”) are matched to likely projects in the research note; confirm with the owner before leaning on one.
