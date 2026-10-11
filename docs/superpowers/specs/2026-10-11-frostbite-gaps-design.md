# The Frostbite gaps: seven lanes beside the GPU-first eight. The design

Date: 2026-10-11 (late). Status: approved by the owner in conversation (“Yes implement that”), to be carried out one lane a PR by this session. Builds on `2026-10-11-gpu-first-renderer-design.md` (#915: G1, N1 to N7), `2026-10-11-bf2017-picture-everywhere-design.md` (T2, P, D2, U2, M2, G, W, R2, X2) and the audit `docs/research/2026-10-11-frostbite-gap-audit.md`, which holds every number and source this design rests on. The rules every lane keeps: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`.

## What the owner asked

What Rapier, WebAssembly and WebGPU still need to replicate the Frostbite frame with the assets on hand, the best quality a PC can run; the assets checked; the drift between the running lanes checked. Then: implement it.

## The answer in one paragraph

The GPU-first design carries the architecture. This design adds what the audit found it leaves out, as seven lanes that each own new files and touch the running lanes’ files by one call or not at all. Two change no pixel and land first: **X3** streams Rapier’s wasm instead of inlining it as base64, and **D3** takes the 16 MB asset manifest out of the galaxy’s chunk and runs the nine Sketchfab-era landmarks through the packs’ pipeline. Two are small and change the picture where the record says: **N10** gives the rulebook’s sphere lights their radius in the game material’s direct term, and **H1** lets an ultra visitor with an HDR display see the record’s linear tone map and LUT in HDR. Three are the Frostbite frame’s missing systems: **N8** puts every figure on the GPU (instanced skinning with the palettes in a storage buffer, so N1’s one-draw-a-group holds for soldiers, bots and ragdolls too), **N9** replaces lane V’s cones with Hillaire’s froxel grid lit by the cascades and every clustered light, and **T3** draws the terrain as a clipmap from the heightfield texture Rapier also stands on, with the game’s own layer masks as a desktop ask. Each lane starts on the lit fixture (`src/runtime/fixtures/litWorld.js`) and the `battlefront` world, both already `'nodes'`, as #915’s lanes do, and wires into the Star Wars surfaces when T2 lands. Three rules go in beside them: a lane never commits the health snapshot; a lane’s binaries go to the bucket; a lane letter names its design.

## 1. The lanes

| lane | what | starts after | gate |
| --- | --- | --- | --- |
| **X3 Rapier streams in** | the bare `@dimforge/rapier3d@0.21.0` and `@dimforge/rapier3d-simd@0.21.0` behind `loadEngine`’s same face; their `rapier_wasm3d.js` (an ESM import of the wasm, which Vite does not bundle) replaced by a Vite plugin with one shim a build that instantiates the wasm itself: `instantiateStreaming` from a hashed `.wasm` asset in the browser, the bytes fallback where the type is wrong, `readFile` in Node for the tests; the compat packages removed; `optimizeDeps.exclude` for the two packages; the stack pages and the census | now | `npm test` unchanged (the same wasm, the same floats); `scripts/wasm-check.mjs` validates the two hashed binaries in `dist/`; bytes over the wire for the physics chunk before and after (4.14 MB → the glue plus 2.94 MB raw; 1.58 MB → about 1.1 MB gzipped); `x2-profile.mjs`’s replay identical |
| **D3 the manifest and the landmarks** | a build step (`scripts/build-manifest.mjs`’s shape) that writes `src/data/galaxyLibrary.json`, the rows `bf2017-library.js` places and nothing else, so the 15.5 MB file leaves the client; the nine `models/galaxy/surface/*.ultra.glb` and `galaxy/deathstar2.hq.glb` through the packs’ pipeline (`scripts/ktx2.mjs`: UASTC on normal and data maps, ETC1S colour below ultra; `meshoptimizer`’s simplifier for a `.lod1` and a `.far` cut each, as `catalog/bf2017-vehicles.js` has them); `models/galaxy` to the bucket listed as a desktop ask (the cloud session cannot write the bucket) | now | the galaxy chunk’s size before and after (13.19 MB today); `npm run coverage:bf2017` and `assets-check` unchanged; each landmark’s FLIP at its gallery pose unchanged on the laptop; the `models MB` row |
| **H1 HDR output** | `outputType: HalfFloatType` on the WebGPU renderer when the visitor’s setting says so and `matchMedia('(dynamic-range: high)')` is true; the record’s chain unchanged (the linear tone map and the LUT already end in linear); a settings line; off by default | N2 (the chain’s output pass) | a shot on the laptop’s HDR display beside the SDR one; nothing changes on an SDR display (the parity check) |
| **N10 sphere lights** | `Radius` carried from the rulebook reader (`scripts/lib/bf2017-rulebook-look.mjs`, `PbrSphereLightEntityData`) through `lights.json` into `light/placed.js`; the game material’s direct specular term widened to the sphere by the representative point (Karis 2013; Lagarde and de Rousiers 2014, §4.7) with its energy normalisation, as a TSL hook in `surface/compose.js`; the clustered list unchanged | T2 (the surfaces), the fixture now | the hangar fixture against the game’s hangar frame; the FLIP of a frame with no sphere lights unchanged |
| **N8 the figures on the GPU** | `src/lib/three/gpuFigures/`: one `Mesh` a (rig, LOD, material group) with `count` figures; the bone palettes an `instancedArray` of `mat4` (bones × figures) written once a frame from the animators (`lib/three/animator.js`, `animBudget.js`) or from a compute pass sampling packed clips; a TSL skinning node reading the palette by instance id; last frame’s palette kept for N2’s velocity; ragdoll poses from Rapier written into the same rows; a dithered LOD crossfade as N1’s | N1 (its `lodFade`), T2 | 40 and 64 figures on Hoth: `render()` CPU time and figure draws before and after; the figure FLIP unchanged |
| **N9 unified volumetrics** | `src/lib/three/light/froxels.js`: a camera-aligned 3D grid (160 × 90 × 64 on `T1` and up) in a `texture_storage_3d` filled by a TSL compute pass from the record’s fog (`fog.js`), `volumes.json`’s volumes and the particles, lit by the sun through its cascades and by `ClusteredLighting`’s list, integrated against last frame’s grid, then along the view into a 2D scattering and transmittance texture that `fog.js`, `volumetrics.js` and the particles read; lane V’s path kept on `nodes-webgl` and `T0` by data | T2, N3 | the hangar and the Hoth day on the lit fixture, FLIP against G1’s reference; GPU under 0.8 ms at 1,600 × 900 on the laptop |
| **T3 the terrain** | a lane W job that reads the `TerrainStreamingTree` and the layer mask textures from the depots where the records allow; `src/lib/three/terrain/clipmap.js`: rings of one quad grid displaced in TSL from the heightfield as a texture, morphing between rings, the same texture under `physics/heightfield.js` | N4 (the horizon grid), W (the masks) | the ground’s FLIP at the gallery poses; the ground’s triangles and draws before and after |

Order: X3, D3, H1, N10 first (no seam with the running lanes beyond one call); N8, N9, T3 after their rows. One PR a lane, `origin/main` merged before the PR with both sides kept, this file’s table updated by each.

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
