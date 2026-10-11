# The Frostbite gaps: seven lanes beside the GPU-first eight. The design

Date: 2026-10-11 (late). Status: approved by the owner in conversation (“Yes implement that”), to be carried out one lane a PR by this session. Builds on `2026-10-11-gpu-first-renderer-design.md` (#915: G1, N1 to N7), `2026-10-11-bf2017-picture-everywhere-design.md` (T2, P, D2, U2, M2, G, W, R2, X2) and the audit `docs/research/2026-10-11-frostbite-gap-audit.md`, which holds every number and source this design rests on. The rules every lane keeps: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`.

## What the owner asked

What Rapier, WebAssembly and WebGPU still need to replicate the Frostbite frame with the assets on hand, the best quality a PC can run; the assets checked; the drift between the running lanes checked. Then: implement it.

## The answer in one paragraph

The GPU-first design carries the architecture. This design adds what the audit found it leaves out, as seven lanes that each own new files and touch the running lanes’ files by one call or not at all. Two change no pixel and land first: **X3** streams Rapier’s wasm instead of inlining it as base64, and **D3** takes the 16 MB asset manifest out of the galaxy’s chunk and runs the nine Sketchfab-era landmarks through the packs’ pipeline. Two are small and change the picture where the record says: **N10** gives the rulebook’s sphere lights their radius in the game material’s direct term, and **H1** lets an ultra visitor with an HDR display see the record’s linear tone map and LUT in HDR. Three are the Frostbite frame’s missing systems: **N8** puts every figure on the GPU (instanced skinning with the palettes in a storage buffer, so N1’s one-draw-a-group holds for soldiers, bots and ragdolls too), **N9** replaces lane V’s cones with Hillaire’s froxel grid lit by the cascades and every clustered light, and **T3** draws the terrain as a clipmap from the heightfield texture Rapier also stands on, with the game’s own layer masks as a desktop ask. Each lane starts on the lit fixture (`src/runtime/fixtures/litWorld.js`) and the `battlefront` world, both already `'nodes'`, as #915’s lanes do, and wires into the Star Wars surfaces when T2 lands. Three rules go in beside them: a lane never commits the health snapshot; a lane’s binaries go to the bucket; a lane letter names its design.

## 1. The lanes

| lane | what | starts after | gate | PR |
| --- | --- | --- | --- | --- |
| **X3 Rapier streams in** | the bare `@dimforge/rapier3d@0.21.0` and `@dimforge/rapier3d-simd@0.21.0` behind `loadEngine`’s same face; their `rapier_wasm3d.js` (an ESM import of the wasm, which Vite does not bundle) replaced by a Vite plugin with one shim a build that instantiates the wasm itself: `instantiateStreaming` from a hashed `.wasm` asset in the browser, the bytes fallback where the type is wrong, `readFile` in Node for the tests; the compat packages removed; `optimizeDeps.exclude` for the two packages; the stack pages and the census | now | `npm test` unchanged (the same wasm, the same floats); `scripts/wasm-check.mjs` validates the two hashed binaries in `dist/`; bytes over the wire for the physics chunk before and after (4.14 MB → the glue plus 2.94 MB raw; 1.58 MB → about 1.1 MB gzipped); `x2-profile.mjs`’s replay identical | #931 (draft; every gate green) |
| **D3 the manifest and the landmarks** | a build step (`scripts/build-manifest.mjs`’s shape) that writes `src/data/galaxyLibrary.json`, the rows `bf2017-library.js` places and nothing else, so the 15.5 MB file leaves the client; the nine `models/galaxy/surface/*.ultra.glb` and `galaxy/deathstar2.hq.glb` through the packs’ pipeline (`scripts/ktx2.mjs`: UASTC on normal and data maps, ETC1S colour below ultra; `meshoptimizer`’s simplifier for a `.lod1` and a `.far` cut each, as `catalog/bf2017-vehicles.js` has them); `models/galaxy` to the bucket listed as a desktop ask (the cloud session cannot write the bucket) | now | the galaxy chunk’s size before and after (13.19 MB today); `npm run coverage:bf2017` and `assets-check` unchanged; each landmark’s FLIP at its gallery pose unchanged on the laptop; the `models MB` row | #934 (draft; the chunk 13.19 MB → 0.05 MB; the landmarks’ maps weighed by `scripts/ktx2.mjs report` and left as WebP: 7.3× the download for a quarter of the GPU memory, 44.5 dB normals; the laptop’s GPU-memory question in the evidence) |
| **H1 HDR output** | `outputType: HalfFloatType` on the WebGPU renderer when the visitor’s setting says so and `matchMedia('(dynamic-range: high)')` is true; the record’s chain unchanged (the linear tone map and the LUT already end in linear); a settings line; off by default | N2 (the chain’s output pass) | a shot on the laptop’s HDR display beside the SDR one; nothing changes on an SDR display (the parity check) | folded into V1 (its one control: `hdr`, the Display group; `createWebGPU`’s `hdr`) |
| **N10 sphere lights** | `Radius` carried from the rulebook reader (`scripts/lib/bf2017-rulebook-look.mjs`, `PbrSphereLightEntityData`) through `lights.json` into `light/placed.js`; the game material’s direct specular term widened to the sphere by the representative point (Karis 2013; Lagarde and de Rousiers 2014, §4.7) with its energy normalisation, as a TSL hook in `surface/compose.js`; the clustered list unchanged | T2 (the surfaces), the fixture now | the hangar fixture against the game’s hangar frame; the FLIP of a frame with no sphere lights unchanged | |
| **N8 the figures on the GPU** | `src/lib/three/gpuFigures/`: one `Mesh` a (rig, LOD, material group) with `count` figures; the bone palettes an `instancedArray` of `mat4` (bones × figures) written once a frame from the animators (`lib/three/animator.js`, `animBudget.js`) or from a compute pass sampling packed clips; a TSL skinning node reading the palette by instance id; last frame’s palette kept for N2’s velocity; ragdoll poses from Rapier written into the same rows; a dithered LOD crossfade as N1’s | N1 (its `lodFade`), T2 | 40 and 64 figures on Hoth: `render()` CPU time and figure draws before and after; the figure FLIP unchanged | |
| **N9 unified volumetrics** | `src/lib/three/light/froxels.js`: a camera-aligned 3D grid (160 × 90 × 64 on `T1` and up) in a `texture_storage_3d` filled by a TSL compute pass from the record’s fog (`fog.js`), `volumes.json`’s volumes and the particles, lit by the sun through its cascades and by `ClusteredLighting`’s list, integrated against last frame’s grid, then along the view into a 2D scattering and transmittance texture that `fog.js`, `volumetrics.js` and the particles read; lane V’s path kept on `nodes-webgl` and `T0` by data | T2, N3 | the hangar and the Hoth day on the lit fixture, FLIP against G1’s reference; GPU under 0.8 ms at 1,600 × 900 on the laptop | |
| **T3 the terrain** | a lane W job that reads the `TerrainStreamingTree` and the layer mask textures from the depots where the records allow; `src/lib/three/terrain/clipmap.js`: rings of one quad grid displaced in TSL from the heightfield as a texture, morphing between rings, the same texture under `physics/heightfield.js` | N4 (the horizon grid), W (the masks) | the ground’s FLIP at the gallery poses; the ground’s triangles and draws before and after | |

Order: X3, D3, then V1 (§6), then H1, N10 (no seam with the running lanes beyond one call); N8, N9, T3 after their rows. One PR a lane, `origin/main` merged before the PR with both sides kept, this file’s table updated by each.

## 2. The rules

1. **A lane never commits `src/data/health/latest.json`.** `scripts/health.mjs` rewrites it on every run and the merge to `main` writes the snapshot (as #903’s did). Every GPU-first branch conflicts on it today.
2. **A lane’s binaries go to the bucket**, never under `public/`: the decision of 2026-10-11 and D2’s row. N4’s hundred horizon cells are the case in point.
3. **A lane letter names its design** in the hand-offs: `G1` is a landing lane in one design and the GPU clock in another; `N` is the scatter in one and `N1` to `N5` in another.

## 3. The seams

| lane | owns | touches | rule |
| --- | --- | --- | --- |
| X3 | `scripts/rapier-wasm.mjs`, `scripts/lib/rapier-wasm.mjs`, `src/lib/wasm/instantiate.js`, `src/lib/physics/raw/{scalar,simd}.js` | `src/lib/physics/engine.js` (the importers), `vite.config.js` (one plugin, one exclude), `package.json` | N5’s worker imports `world.js`, which imports `engine.js`: nothing changes for it |
| D3 | `scripts/build-library.mjs`, `src/data/galaxyLibrary.json`, `scripts/landmarks.mjs` | `bf2017-library.js:26` (the import), the ten landmark files | D2’s pack writers untouched |
| H1 | `src/runtime/hdr.js` | `src/runtime/webgpu.js` (the `outputType`), the settings line T2 adds | N2 owns the chain’s output pass; H1 sets the renderer’s type only |
| N10 | `src/lib/three/light/sphereLight.js` | `placed.js` (one field), `compose.js` (one hook), `scripts/lib/bf2017-rulebook-look.mjs` (one field) | M2 owns `surface/*`; N10 adds one node |
| N8 | `src/lib/three/gpuFigures/` | `battlefront/figures/figures.js` (the path chosen by tier), `animator.js` (a palette writer) | N1 owns `gpuScene/`; N8 reuses `lodFade.js` and the tier table |
| N9 | `src/lib/three/light/froxels.js` | `fog.js`, `volumetrics.js`, `post.js` (`volumes` reads the grid on `T1`+) | V’s path stays by data; N3’s `baked.js` untouched |
| T3 | `src/lib/three/terrain/`, `scripts/desktop/bf2017-terrain.mjs` | `galaxy/surface/level/ground.js` (the path chosen by tier), `physics/heightfield.js` (the texture) | N4 owns the horizon; T3 draws under it |

## 4. Risks

- X3 wraps an internal of the Rapier packages (`rapier_wasm3d.js`’s import of the wasm); a Rapier upgrade can move it. The shim is one file a build, the plugin is pure and tested, and `docs/stack/physics-rapier.md` lists it under “Upgrading”.
- N8 writes a skinning node of its own; three’s `SkinningNode` reads one `boneTexture` a mesh, not a palette by instance. The node is tested against three’s on one figure (the same pose, the same vertices) before any instance count.
- N9’s 3D storage texture is WebGPU only; `nodes-webgl` keeps lane V’s path, so the two tiers draw different fog. The tier table (N6) says which.
- T3’s masks are the desktop’s; until the job runs the clipmap draws Q2’s derived layers and says so in the gallery.
- H1 has no cloud leg: SwiftShader has no HDR canvas. The laptop shoots it.

## 5. Gates

Every lane: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `npm run coverage:bf2017`, `npm run maps:bf2017`; the seventeen worlds at high on `nodes-webgl` in software GL for a lane that changes a surface’s picture; the parity check on the routes it touches; the laptop table named in the lane’s row; evidence under `docs/superpowers/evidence/frostbite-gaps/<lane>/` with a README and `_source` on every number.

## 6. Lane V1: the video settings, and the clean picture by default (added 2026-10-11, after the owner’s third ask)

(V for video: #932 took the letters S1 to S3 for the space lanes the same day, which is rule 3 of §2 at work.)

The owner asked: “Right now we can only choose presets, but we want our engine to be like Frostbite, robust and beautiful, not grainy but HD and smooth. Figure out more detailed controls.”

### What is true today

A visitor picks one word (`tp-quality`: auto, low, mid, high, ultra) and a “Sharpness” slider that is in fact a multiplier on the pixel ratio (`src/lib/device.js:212`, `tp-sharpness`). Everything else is decided from that word and the device probe: the post chain per tier (`src/lib/three/light/post.js:123`), the sun’s cascades and PCSS samples (`sun.js`, `shadows.js:42`), the contact and cloud shadows, the volumetric steps, the probe grid, the clustered lights, the budget rows (`src/lib/budgets.js`), the texture rows, MSAA (`BUDGETS.samples`, off above a pixel ratio of 1.75 on the galaxy and universe posts). No visitor can turn one of them.

### Why the picture reads as grainy

- **High is the grainy tier, by construction.** PCSS rotates its disk by interleaved gradient noise (`shadows.js:116`), the fog march jitters its start the same way (`fog.js:254`), the volumetric cones dither with a Bayer matrix at a quarter of the resolution (`volumetrics.js:154`), SSGI on high is the non-temporal variant at half resolution through a denoiser (`passes.js:260`), AO is half resolution (`passes.js:266`). On ultra, TRAA integrates every one of those patterns. On high the chain ends in SMAA, which cannot: the noise is drawn and never integrated. The research note under #915 said so (“TSR”: SSGI’s temporal filter needs TRAA); N2’s chain still reads `high: […, 'smaa', 'output']`.
- **The pace shrinks the canvas and the browser stretches it.** Late frames step the drawing buffer down to 0.5 (`pace.js:45`) and the compositor scales it back up; no upscaler or sharpen pass runs in production on `main` (`post.js:208` takes an `upscale` that `apply.js:165` never passes). That is the “soft” half of “grainy and soft”.
- **No MSAA above a pixel ratio of 1.75 and no temporal pass** on the galaxy’s and the universe’s posts (`surface/nodes/post.js:75`, `universe/post.js:311`): a HiDPI laptop at high gets shimmer on every edge.
- **Film grain and dither** in the universe’s final pass (`universe/post.js:277`, `grainFor`) are a look, not a fault, and have no control.

### The decision

1. **The default picture is clean before any menu.** TRAA on high wherever the backend has it (WebGPU; `nodes-webgl` keeps SMAA and gains the denoiser on AO and GI since nothing temporal follows), TAAU with N2’s sharpen pass whenever the controller drops the scale, the denoiser only where no temporal pass follows (`arrange()`), and MSAA 4 where a chain has no temporal pass. This is N2’s chain settled (the audit’s §1.7) and lands with or before V1.
2. **A video menu under the presets.** The preset row stays the one-click way; under it, the controls below, each a knob that already exists in code. Touching any marks the preset *Custom*; picking a preset writes every control to the preset’s value. A control is *live* (the post chain is rebuilt through `onChain`, the renderer resized) or *needs a reload* (the backend, MSAA on the classic renderer); the panel says which, and the existing “Reload this world” button (`Settings.jsx:159`) serves the second kind.
3. **One schema, one store.** `src/lib/video.js` (pure, tested) holds every control: its id, its kind (choice or range), its values, its default per preset, whether it is live, which systems read it. Stored under `tp-video` `{ v: 1, preset, ...overrides }` in the settings store (`settings.js`’s `read`/`write`), beside `tp-quality`, which stays the preset. The device’s budget rows (`lib/budgets.js`, `BUDGETS`) stay the ceiling: a control cannot raise a row above the device’s tier, and the panel greys a value the device cannot afford, with the reason.
4. **The readers take resolved values.** `passesFor(tier, refs, video)`, `createSun(entry, { …, video })`, `applyGameLight(…, { video })`, `createQuality({ video })`: each reads its own fields and nothing else; no reader opens the store. The runtime resolves once a world and on each change (`tp:video` event).
5. **A readout and a benchmark.** The panel’s device block gains the renderer, the tier, the controller’s scale, the frame’s GPU time (G1) and a ten-second benchmark on the lit fixture that proposes a preset.

### The controls

| group | control | values | reads it |
| --- | --- | --- | --- |
| Display | Render resolution | 50 to 200 %, or Auto (the GPU-time controller) | `runtime/quality.js`, N2’s `dynres.js` |
| Display | Upscaler | TAAU, FSR 1, off | `post.js` (`upscaleKind`) |
| Display | Sharpening | 0 to 1 | N2’s `sharpenFor` |
| Display | Frame rate | Auto, 30, 60, 120 | N2’s cadence; the controller’s budget |
| Display | HDR output | on/off (shown only where `matchMedia('(dynamic-range: high)')`) | H1 |
| Anti-aliasing | Method | TRAA, TAAU, SMAA, off | `post.js` |
| Anti-aliasing | MSAA (classic renderer) | 0, 2, 4, 8 | `BUDGETS.samples` |
| Shadows | Quality | off; low (2 cascades at 1,024, PCF); medium (4 at 2,048, PCSS 32); high (PCSS 128); ultra (4 at 4,096, PCSS 256) | `sun.js`, `shadows.js` |
| Shadows | Distance | 30 to 140 m | `sun.js` far |
| Shadows | Contact shadows; cloud shadows | on/off each | `contact.js`, `clouds.js` |
| Lighting | Global illumination | off, SSAO, SSGI low, medium, high | `passesFor` |
| Lighting | Reflections | probes, SSR half, SSR full | `passes.js` SSR scale |
| Lighting | Volumetric light | off, low, high | `volumetrics.js` steps and cones; N9’s grid |
| Lighting | Fog quality | low, high | `fog.js` steps |
| Lighting | Local lights | nearest 64, all | `placed.js` |
| Post | Bloom; lens flare; god rays; depth of field | on/off each | `passesFor` |
| Post | Motion blur | off, camera, full | the record’s scale |
| Post | Film grain | off, low, full | `grainFor` |
| Post | Chromatic aberration | on/off | `aberrationFor` |
| Textures | Texture quality | 256, 512, 1,024, 2,048 | `texSizeFor` |
| Textures | Anisotropic filtering | 1, 4, 8, 16 | `BUDGETS.aniso` |
| Geometry | Model detail | far copies on/off; ultra cuts on/off | `budgets.js` lod1, `usesUltra` |
| Geometry | Draw distance | the near and mid bands | `budgets.js` |
| Geometry | Scatter density | 0.5 to 2 | `budgets.js` props, grass |
| Effects | Particles | half, full | the particle cap |
| Effects | Ragdolls and debris | few, all | N5’s caps |

### The seams

V1 owns `src/lib/video.js`, the panel’s new section (`src/components/settings/Video.jsx`), the `tp:video` event and the readers’ one new argument each. N2 owns the chain’s shape and the controller; V1 reads N2’s names (`sharpenFor`, `upscaleKind`, `dynres`) and adds none. N6’s tier table says what a device may use; V1 greys what it may not. Every control’s default per preset is the value the code has today, so a visitor who never opens the menu sees exactly what the preset drew before, except the high tier’s TRAA (decision 1).

### Gate

The schema tested (every control has a default per preset and a reader); the panel on every preset in software GL; a change of each live control rebuilds the chain without a reload (the lit fixture); the high tier’s FLIP against G1’s reference improves on the laptop (the grain integrated); the seventeen worlds at high on `nodes-webgl`.

### Assumed until the owner says otherwise

- V1 runs after D3 and before H1 and N10.
- A visitor’s custom settings are the device’s, kept across worlds and visits in the settings store (as `tp-quality` is today), never per world.
