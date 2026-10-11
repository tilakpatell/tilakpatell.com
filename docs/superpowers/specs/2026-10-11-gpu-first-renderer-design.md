# GPU-first: Unreal’s methods under the Frostbite reconstruction, on every visitor’s own GPU. The design

Date: 2026-10-11. Status: design for Opus 5.5 to implement; the owner asked for it. Builds on `2026-10-11-bf2017-picture-everywhere-design.md` (the node renderer as the only renderer above low; lanes T2, P, D2, U2, M2, G, W, R2, X2), `2026-10-10-battlefront-fidelity-design.md` (S, V, X, C, N, U), `2026-10-10-bf2017-surfaces-design.md` (Q1 to Q6), `2026-10-10-galaxy-engine-design.md` and the decisions `docs/decisions/2026-10-08-three-over-babylon.md` and `2026-10-10-the-engine-in-place.md`. Written from `origin/main` at `6e18a9c5` (#906), lane T2’s branch (`claude/bf2017-t2-flip`), the repository audit of 2026-10-11 and the research note `docs/research/2026-10-11-ue5-on-webgpu-gpu-first-renderer.md` (seven notes: Unreal Engine 5’s renderer system by system, WebGPU in October 2026, three r186’s node renderer and TSL, Rapier and web physics, WebAssembly, the best 2025 to 2026 web titles, and image quality). Every number below that is not the repository’s own names its source there.

## What the owner asked

“Research everything about WebAssembly, Rapier, WebGPU and using GPUs to accelerate gameplay for web games, then architect a way to improve our renderer and the rest of the project to go GPU-focused, so we get AAA-quality games instead of blurry 1990-looking ones.” Then, the shape fixed over the conversation: no engine switch (Unity, Unreal, Godot weighed and set aside); **no streaming from the owner’s PC: every visitor’s own GPU renders every frame**; “reconstruct what Unreal Engine 5 does, see how it works, and implement that kind of feature and logic in the Frostbite reconstruction, robustly”; the game should feel like it streams in (“connect, and it feels like a stream, but their GPU runs it”); the assets stay on Supabase Storage; and “as long as this looks like how a packaged, installed AAA game would look, try it and implement it.”

## The answer in one paragraph

Frostbite says what to draw and Unreal says how to draw it fast enough to keep the pixels. The picture-everywhere design already carries the first half: the game’s materials, lights, ground, decals, particles, sky, fog, bloom, LUT and tone map are built from the export’s own records, and lane T2 is switching the seventeen Star Wars worlds onto the node renderer. What that stack still lacks is the machinery that lets a AAA engine spend a whole frame on pixels: today the CPU issues 180 to 210 draws a frame on Hoth through three’s per-object path (the slowest path the node renderer has: 29 ms for 5,000 meshes against 7 ms on the classic renderer, three issue #30560), the pace controller answers late frames by shrinking the picture and letting the browser stretch it, textures are ETC1S at 1,024 with anisotropy 1, there is no baked bounce, and nothing on the page measures the GPU. This design adds the Unreal layer under the Frostbite one, feature by feature, each as what WebGPU can do in 2026: a **GPU scene** with compute culling, hierarchical-Z occlusion and indirect draws (Nanite’s outer loop; the cluster rasteriser as a gated tier), a **temporal pipeline** (TRAA or TAAU with a sharpen pass, velocity on everything that moves, reversed depth, mip bias) driven by a **GPU-time dynamic-resolution controller** (Unreal’s `r.DynamicRes` constants on WebGPU timestamp queries) that never lets the browser upscale, **Lumen’s three distances** as SSGI near, an amortised probe grid mid and the export’s Enlighten atlases far, **Virtual Shadow Maps’ gains** as cached far cascades over the export’s distant shadow caches plus contact shadows, **World Partition’s two grids** as a coarse horizon grid that downloads first (impostors and merged proxies) over the fine 128 m cells, with low-mip-first texture rows, so a visitor plays within seconds and the world sharpens round them, **Niagara’s split** kept (Rapier owns what touches gameplay; compute owns debris and particles), and **UASTC** on every normal and data map above low. Each lane ships only with its before-and-after on the owner’s laptop; each falls back by data on the node renderer over WebGL 2 and on phones; nothing here renders anywhere but the visitor’s browser.

## 1. What the research found (the short version; the note has the sources)

**WebGPU, October 2026.** Baseline in every major browser: Chrome and Edge everywhere Dawn runs (Android 12+ on Qualcomm, ARM and Intel; Linux Intel Gen12+ since 144, NVIDIA on Wayland since 147), Safari 26 on macOS and iOS 26 (and only those), Firefox on Windows since 141 and on Macs since 145 to 147. About 83 to 88 % of visitors to 3D sites get an adapter. Shipped: compute, indirect draws, render bundles, `timestamp-query` (quantised to 100 µs in Chrome), `shader-f16`, subgroups, BC on 87 % and ASTC or ETC2 on about half (ship both transcodes), `primitive-index`, read-write storage textures (texture-formats-tier2). Not shipped: multi-draw-indirect (a draft), mesh shaders (no proposal), bindless (experimental behind a flag, Chrome only), 64-bit atomics (`atomic-vec2u-min-max`, in the spec’s index, shipping unverified). Default limits: 8 storage buffers a stage (Dawn 146 raised to 16), 16 sampled textures a stage, 8,192² textures, 32 bytes a sample of colour attachments (this repository already asks for the adapter’s own, `src/runtime/webgpu.js`). No API tells VRAM size or thermal state. iOS 26.0 to 26.2 had a WebGPU canvas flicker (fixed, version unconfirmed).

**three r186.** The node renderer has every GPU-driven primitive: `BundleGroup`, `IndirectStorageBufferAttribute` with `drawIndexedIndirect` and `dispatchWorkgroupsIndirect`, storage buffers and 2D, 3D and array storage textures, subgroups, atomics, `mrt()`, `Camera.reversedDepth` (r183 to r185, CSM included), `ClusteredLighting` (Forward+), `DynamicLighting`, `LightProbeGrid` (SH L2 with an indirect bounce bake), `CSMShadowNode`, 48 display nodes (TRAA, TAAU, FSR1, SMAA, SSGI, SSR with a spatiotemporal denoiser, GTAO, SSS, bloom, DOF, motion blur, god rays, lens flare, LUT, sharpen, OIT), `compileAsync` non-blocking since r184, a nanite-style compute rasteriser example and a VXGI example. Its weakness is the per-object path (issue #30560, open): the AAA road is instancing, `BatchedMesh`, storage-driven `instancedArray`, indirect draws and bundles, with `Mesh` counts in the low hundreds. `BatchedMesh` culls on the CPU and uses multi-draw, not indirect; no official compute-culling example exists. The WebGL 2 backend has no storage buffers, no indirect and emulates compute by transform feedback: a degraded tier, never a parity path.

**Unreal Engine 5, and what each system becomes on WebGPU.**
- *Nanite*: an offline cluster DAG (meshopt, 64 to 128 triangles a cluster), a GPU LOD cut, two-pass hierarchical-Z occlusion, a software rasteriser on 64-bit atomics into a visibility buffer, per-material resolves. On WebGPU today: the culling, the indirect draws and a hardware-rasterised visibility buffer (Bevy 0.14’s design, 2.78 ms for 3,092 instances of a 144k-triangle mesh on an RTX 3080 at 2,240 × 1,260); the software rasteriser waits on 64-bit atomics; cluster streaming has no web implementation. Cinevva measured a raw visibility buffer losing to forward shading past 100k instances on Apple’s tile-based GPUs, so the cluster tier is gated by adapter, never assumed.
- *Lumen*: screen traces, mesh distance fields to 2 m, a global field to 200 m, screen probes and a radiance cache, reflections under roughness 0.4; 4 ms at 60 Hz at 1080p on consoles. WebGPU has no ray tracing and no distance-field scene; the achievable stack is SSGI (near) plus a probe grid updated in compute by a budget of probes a frame (mid) plus baked irradiance (far and indoors), SSR with the probes as its miss, which is Lumen’s “Medium” tier (SSR, no hit lighting) that Epic ships on Series S.
- *Virtual Shadow Maps*: a 16k virtual map in 128² pages, a 17-level clipmap for the sun, page caching, SMRT. Needs 64-bit atomics and Nanite to be cheap. The web reconstruction is cascades with the far ones cached (redrawn on a cadence or when a caster moves), a static far shadow cache, contact shadows, PCSS as the soft filter; what is lost is per-pixel resolution at every distance.
- *TSR*: 50 to 67 % internal resolution, history reprojection, rejection, 0.4 to 1.5 ms. three has TRAA, TAAU (a 9-tap Blackman-Harris reconstruct, no sharpening) and FSR1; the rule from TSR’s feed: 1080p at native with TRAA on a discrete chip, 1440p and 4K at about 0.67 with TAAU and a sharpen pass; under 0.58 reads as soft; under 0.5 is unrecoverable. Mip bias `log2(render ÷ display) − 1`. TAA needs MSAA off and velocity for every moving, skinned, alpha-tested or panning material.
- *Virtual Texturing*: a feedback pass, tile caches, 2 fetches a sample. No WebGPU implementation shipped; the readback adds a frame on top of the network. The practical twin is per-tier texture rows per cell fetched lowest size first, which this repository already has the files for (`.256`, `.512`, `.1024`, `.2048.ktx2`).
- *World Partition and HLOD*: 256 m cells in a 768 m range, a coarser HLOD grid of merged or impostor proxies that loads first. The web twin: the fine 128 m cells this site streams, under a new coarse grid of octahedral impostors and merged proxies (agargaro’s library draws 200k trees so), GPU-ready binary cells (Bevy measured 8.5× faster loads than parsed formats).
- *Niagara* and *Chaos*: GPU emitters as compute stages with depth-buffer collision and a sort; destruction as a few CPU rigid chunks with GPU debris keyed off break events and pre-recorded caches for set pieces. The site’s particles already run this way (`src/lib/three/particles/gpu.js`); Rapier owns gameplay.
- *The look stack*: three ships nodes for nearly all of it; custom WGSL is needed only for Hillaire sky LUTs, Nubis clouds, local exposure, FFT bloom and eye adaptation. The game’s own picture (linear tone map, 33³ LUT, five Gaussians) is already Q6’s, and ACES or AgX would un-match it.
- *Scalability*: `sg.*` groups and a dynamic-resolution controller (50 to 100 %, a frame budget, a headroom percentage, a change threshold, a minimum change period, a history, a panic count). Copied here on `timestamp-query`.

**Image quality.** The “1990s blur” is the browser stretching a drawing buffer smaller than the screen; the fixes are a native-sized canvas with any reduction internal and upscaled by a real upscaler, mip bias following the scale, anisotropy 16 on every map, UASTC on normals and data (46.5 to 48.2 dB; ETC1S smears them), texel density of 512 texels a metre for environments, geometric specular anti-aliasing (variance 0.15, threshold 0.2) and a roughness floor of 0.045, a linear HDR pipeline with physical exposure, bloom without a threshold, reversed-Z float depth, and frame-time variance measured, not frame rate. Compare frames with FLIP against a supersampled reference, not PSNR alone.

**Rapier and WebAssembly.** The pinned `@dimforge/rapier3d-compat@0.21.0` (2026-09-25) is the newest release: soft bodies, a rewritten sleeper, CCD against fixed colliders on by default, a broad phase tuned for large static worlds. The npm build is single-threaded (its memory is not shared; Rayon is native only), so SharedArrayBuffer would buy only zero-copy readback. Lane X2 measured the Battlefront’s whole CPU step at 0.5 ms a frame on this container, so the CPU is not where the frame goes. Jolt and Havok exist as WebAssembly, but no 2025 to 2026 benchmark shows either faster than Rapier’s 2026 builds. Cross-origin isolation on GitHub Pages needs a service-worker shim, which this repository found breaks the bucket’s assets, and Safari has no `credentialless`: threads stay off. WebAssembly’s own ports pay only on contiguous-array kernels (X2’s A* port, 153 → 51 µs); branchy object-graph logic stays JavaScript.

**The best web titles.** No engine makes WebGPU the default yet, and every one gates the AAA features behind it (Unity 6.6: GPU Resident Drawer, occlusion culling, STP upscaling, VFX Graph; Babylon 9: frame graph, clustered lights; PlayCanvas 2.17: GPU-driven splats). The documented three.js showcases (Bruno Simon 2025, Codrops False Earth, Grassworks, agargaro’s forest, World Labs Spark) share one recipe: everything GPU-resident, compute culling with indirect draws, baked or stylised light, post switched off on phones, many small hashed files streamed by screen coverage, no game loop in a worker. Range requests on one big GLB are not practical in three (the loader parses whole files; the plugin hook conflicts with meshopt): stream many small files, as 3D Tiles, Spark and Needle do. Egress: Supabase Pro includes 250 GB a month cached, then $0.03 a GB; a 100 MB first visit is 2,500 visits a month included.

## 2. Where the site stands (the audit of 2026-10-11, against `6e18a9c5`)

| what | today | where |
| --- | --- | --- |
| draws on Hoth | 172 to 209 `InstancedMesh` draws a frame; 76 to 80 batched (lane U, off on `main`); game materials key no batch | `level/levelScene.js`, `levelBatch.js`, evidence `galaxy-engine/U` |
| culling | per-object frustum on the CPU; occlusion proxies by query (lane U, off) | `levelScene.js`, `occlusion.js` |
| resolution | the pace’s steps 1, .85, .72, .6, .5 shrink the drawing buffer on the classic renderer (the browser stretches it); on nodes `headroomAt` gives internal steps 1, .77, .67, .5 with FSR1 or TAAU, off on `main` | `src/lib/three/pace.js`, `src/runtime/quality.js` |
| the controller’s input | frame-to-frame time on the CPU (a late frame is over 1.5 beats) | `pace.js` |
| anti-aliasing | canvas MSAA 8/4/2/0 by level on the classic renderer; TRAA on ultra, SMAA on high and mid on nodes; no sharpen pass | `post.js` |
| textures | pack maps ETC1S at 1,024 (2,048 on ultra once D2 lands), anisotropy 1 on pack maps (16 is D2’s), no mip bias | `levelPack.js`, `lod.js`, `levelGltf.js` |
| shadows | four cascades at 2,048 on high and ultra (PCSS 32 and 256 samples), two at 1,024 on mid, every cascade redrawn every frame; the export’s 2,048² distant shadow caches unused | `light/sun.js`, `shadows.js` |
| bounce | SSGI, crossfading probes, the ultra probe grid; the 200 Enlighten atlases not uploaded | `light/probes.js`, lane W’s `atlases` job |
| streaming | far list, then near cells, then mid, then horizon, nearest first, 4 in flight, 128 m cells; one texture size per tier; no coarse grid; no prefetch by heading; the service worker caches installed packs only | `levelStream.js`, `bands.js`, `public/sw.js` |
| GPU time | never measured on the page; `calibrate.js` budgets 12 ms by frame time | `src/lib/three/calibrate.js` |
| physics | Rapier on the main thread, 1/60 fixed step, 4 substeps; SIMD build (X2); 0.5 ms a frame measured | `src/lib/physics/`, evidence `bf2017-picture/x2` |
| GLSL left | 621 sites; `galaxy-surface` flips to `'nodes'` in T2 | `node scripts/health.mjs --only glsl-sites` |
| the laptop | RTX 5090 at 1,600 × 900 on WebGPU: 5.7 ms (TRAA) → 5.1 (TAAU 0.77); at 4K 11.3 → 7.7 | evidence `galaxy-engine/U` |

## 3. The approaches weighed

| approach | what it is | verdict |
| --- | --- | --- |
| An engine (Unity 6.6, Godot 4.6, Unreal through a third party) | a rewrite onto another renderer; the same WebGPU under it; Godot’s web export is WebGL 2 only; Unreal has no web target | no: the decisions stand, and none renders these records as the stack already does |
| Compile an engine to WebAssembly (the RAGE port the owner cited) | the engine’s own code and renderer replayed on WebGPU | no: there is no Frostbite source or binary to compile; the records are read instead (the picture-everywhere design, §7). Its streaming shape (a boot slice, then on demand) is copied |
| Finish the picture-everywhere lanes and stop | every layer on, the pace shedding passes | not enough: the frame is CPU-bound on draws and the controller shrinks the picture, so the pixels never arrive |
| **Unreal’s methods under the Frostbite stack, as WebGPU allows** | GPU scene and indirect draws, temporal upscaling under a GPU-time controller, three-distance GI, cached shadows, two-grid streaming, UASTC data maps | **yes**: each is a lane with a measured before and after on the laptop, each falls back by data |
| Pixel streaming from the owner’s PC | the real frame as video | no: the owner ruled it out; lane R2’s spike stays a spike |

## 4. The design

Eight lanes, each a branch and a PR from `origin/main`, each owning its files, each shipping only with its laptop table. G1, N1, N2, N3, N4 and N5 start now on the lit fixture and the `battlefront` world (both already `'nodes'`) and wire into the Star Wars worlds when lane T2 lands; N6 starts when G1, N1 and N2 are in; N7 when N1 and N6 are, on the laptop. G1’s reference pictures come first wherever two lanes could race, so every lane measures against the same frames.

### G1: the reference frames and the GPU clock (`claude/gpu-g1-reference`)

What “AAA” is measured against, and the instrument every other lane reads.

- **`src/lib/three/gpuTime.js`**: the frame’s GPU time from `timestamp-query` where the adapter has it (`renderer.trackTimestamp`, `resolveTimestampsAsync`), as a ring of the last 32 frames with its median and p95; without the feature (Safari’s support is unconfirmed) it answers `null` and callers keep the CPU pace. Tested with a fake renderer. Quantised to 100 µs in Chrome, which a 16.7 ms budget tolerates.
- **The probe at first load** (`src/lib/gpuProbe.js`, pure rules tested): a one-second draw of the lit fixture’s scene at the start of a `'nodes'` world, its GPU median and the adapter’s features (`timestamp-query`, `texture-compression-bc|astc|etc2`, `subgroups`, `shader-f16`, `atomic-vec2u-min-max`, the storage-buffer and colour-attachment limits) kept in `localStorage` as the device’s *renderer tier* beside `tp-quality`: `T0` (no timestamps or an integrated or phone chip), `T1` (a discrete chip), `T2` (`atomic-vec2u-min-max` and subgroups). The quality levels stay the visitor’s; the tier says which paths the level may use. `lib/device`’s `budget()` row is unchanged.
- **The reference shots**: `scripts/reference-frames.mjs` shoots each Star Wars world at its gallery pose 8× jittered and accumulated at native size with no temporal pass, on the laptop, into `docs/superpowers/evidence/gpu-first/reference/<world>.png`; `scripts/frame-score.mjs` scores a candidate against it with FLIP (`flip-evaluator`, a Python tool run on the desktop or the laptop; a Node fallback computes PSNR and SSIM) at the laptop’s pixels per degree. The parity check (`scripts/gpu-parity.mjs`) stays the regression gate between branches; FLIP is the quality gate against the reference.
- **Frame-time variance** joins the perf probe’s columns (`scripts/perf-probe.mjs`: the standard deviation of frame-to-frame deltas beside p95), since pacing is what the eye reads.

Gate: the fixture’s GPU time within 10 % of its `renderer.info` CPU frame on the laptop; FLIP of the current ultra frame of Hoth against its reference recorded as the baseline every lane beats.

### N1: the GPU scene (`claude/gpu-n1-scene`)

Nanite’s outer loop: the level’s instances live on the GPU, the GPU decides what is drawn, the CPU issues one indirect draw a material group.

- **`src/lib/three/gpuScene/`** (knows three, no world): `scene.js` holds every instance of a level’s table in one storage buffer (a quantised transform as position, a quaternion and a scale in 32 bytes, the bounding sphere, the LOD chain’s index, the material group, flags), appended and freed per cell as the stream hands cells in and out, never rebuilt. `cull.js` is a TSL compute pass (`Fn().compute(n)`, as `particles/gpu.js`) over the buffer: frustum, then the LOD cut by projected size (the same rule as `lib/level/lod.js`’s `lodAt`, written once as a pure function and once as TSL, with a test that the two agree on 10,000 random instances), then occlusion against last frame’s hierarchical-Z (`hzb.js`: a mip chain of the depth, built by compute each frame; a second cull pass re-tests what the stale pyramid rejected, Bevy 0.14’s two-pass scheme), writing a compacted instance index list and `drawIndexedIndirect` arguments per (mesh, LOD, material group) into an `IndirectStorageBufferAttribute`. `draws.js` makes one `Mesh` per material group whose geometry carries the group’s LODs merged into one index buffer (meshopt’s chains, as the packs ship them) and whose `positionNode` pulls its instance transform from the buffer by the compacted index (`storage.toAttribute()`, as `sprites.js` does), drawn through `renderObject.getIndirect()`. Static groups go in a `BundleGroup` (lane U’s `Bundle`), recorded again only when a cell comes or goes.
- **Material groups**: a group is one game material recipe and its texture set (Q1’s `userData.batchKey`, which lane U found the batched path needs anyway); the 16-sampled-textures limit a stage holds the group’s maps in texture arrays per size (D2’s rows already size maps by the biggest wearer, so arrays are by size and format).
- **The seam**: `createLevelScene({ gpuScene: true })` is a third path beside lane L’s `InstancedMesh` and lane U’s `BatchedMesh`, chosen by the renderer tier (`T1` and up on WebGPU) and the backend; `nodes-webgl` and `T0` keep lane U’s path. `setTable`, `onCell`, `onDrop` and `update` keep their faces; `stats()` gains `{ culled, drawn, indirect }`.
- **What is kept from Nanite and what is not**: no CPU draw calls, LOD without pops (a dithered crossfade over 0.3 s under TRAA, `lib/three/lodFade.js`, blue-noise alpha), occlusion, and streaming by cell; not the software rasteriser, not sub-pixel triangle throughput. The visibility-buffer and cluster tier is lane N7’s spike.

Gate (laptop, Hoth at ultra, 1,600 × 900 and 4K, WebGPU): draws from 183 to under 40; the main thread’s `render()` time under 2 ms; the GPU frame no higher than lane U’s batched frame; `scripts/level-draws.mjs` counts the three paths; the parity check within its thresholds (occlusion is conservative: nothing visible disappears; the proxy test of lane U moves to a unit test against the HZB pass with a known depth).

### N2: the stable picture (`claude/gpu-n2-picture`)

TSR’s role: the picture is never stretched by the browser, every frame lands on time, and what moves leaves no trail.

- **The dynamic-resolution controller** (`src/runtime/dynres.js`, pure, tested): Unreal’s `r.DynamicRes` constants on G1’s GPU time: budget 16.7 ms (33.3 on a phone or when the visitor pins 30), headroom 10 %, a change only when the new scale differs by 5 % or more, at least 8 frames between changes, the median of the last 16 frames, and an immediate drop after 3 consecutive over-budget frames; the scale floor 0.67 on `T1` and up (0.58 on `T0`), the ceiling 1. It replaces the pace’s CPU steps on a `'nodes'` world where GPU time is available (`quality.js` takes a `source`; the pace stays the fallback and the only controller on the classic renderer). The output size never changes (TAA history); only `setResolutionScale` of the chain moves, through lane U’s `headroom`.
- **The chain**: TRAA at scale 1, TAAU under it, on WebGPU; SMAA and FSR1 on `nodes-webgl` (as `post.js` has it); a `sharpen` pass (`SharpenNode`, RCAS-like, strength 0.2 to 0.4 by scale) after the upscaler on every tier that upscales, since neither TAAU nor TRAA sharpens; the mip bias on every sampled pack map follows the scale, `log2(scale) − 1` with an upscaler and −0.5 at native under TRAA (a uniform the material reads; `textures.js`’s `sharpen` gains `bias`).
- **Velocity everywhere**: the MRT’s velocity written by skinned figures, instanced and GPU-scene draws (N1’s `positionNode` writes last frame’s position too), alpha-tested foliage and panning materials; a check on the lit fixture moves each kind across a still background and fails on a trail longer than one frame. Particles and decals mask themselves from the history (TRAA’s rejection) rather than write velocity.
- **No multisampling under a temporal pass**: WebGPU draws at 1 or 4 samples only, and TRAA and TAAU need 1, so a `'nodes'` world whose chain has a temporal pass is made with `antialias: false`; `BUDGETS.samples` (8, 4, 2, 0) stays the classic renderer’s.
- **Reversed depth** (`Camera.reversedDepth`, `depth32float`) on WebGPU for every Star Wars world: no z-fighting across a 2 km map, early-Z kept; the shadow path and TRAA’s depth thresholds checked on the fixture (r185 carries CSM support).
- **Specular anti-aliasing** in the game material (Q1’s): geometric roughness widening (variance 0.15, threshold 0.2) and a roughness floor of 0.045, so metal and wet snow stop sparkling under TAA.
- **Frame pacing**: a visitor who pins 30 fps gets every second display beat exactly, not a free-running loop (`loop.js` gains a cadence); the perf probe’s variance column is the gate.

Gate (laptop): at 4K on the RTX 5090 every Star Wars world holds 16.7 ms p95 with the controller at or above 0.67 (lane U measured 7.7 ms at 0.67 on the fixture); FLIP against G1’s reference better than the baseline at every scale the controller reaches; no trail on the fixture; frame-time standard deviation under 2 ms at 60.

### N3: three distances of light (`claude/gpu-n3-light`)

Lumen’s shape on what WebGPU has: screen traces near, probes mid, baked far.

- **Far: the Enlighten atlases.** The game’s own radiosity, baked by DICE, exists for every level (200 HDR irradiance atlases with direction and sky-visibility maps; lane W’s `atlases` job uploads them as RGBA16F KTX2). `src/lib/three/light/baked.js` samples a level’s atlas on `TEXCOORD_1` (the kit meshes carry it) as the diffuse indirect term of Q1’s game material, directional through the three direction maps (Enlighten’s directional irradiance), with the sky-visibility map as the probe blend; `levelGltf.js` binds the atlas per cell from the pack (`level.json` gains `enlighten` rows; `scripts/bf2017-level.mjs` writes them from the export’s `StaticEnlightenData`). Until the atlases are in the bucket the lane works on Hoth’s from the desktop export (lane Q3’s plan has the probe) and the fixture.
- **Mid: the probe grid, amortised.** `LightProbeGrid` (SH L2) is already the ultra grid’s base; it becomes a DDGI-style grid updated by a budget: N probes a frame re-rendered against the horizon proxies and the sun (the budget from G1’s GPU time, 0.5 ms a frame), two cascades round the player (8 m and 32 m spacing), sky visibility from the atlas where it exists. On `T0` the grid is baked once a cell as now.
- **Near: SSGI as it is**, with its radius set to the game’s scale (the HBAO radius the record gives Q6) and TRAA’s temporal filter; GTAO under it.
- **Reflections**: `SSRNode` for roughness under 0.4 (Lumen’s cut), the record’s reflection probes (D2 restores them at 128² with the sun) as the miss and for rougher surfaces; the denoiser on.
- **Shadows cached**: the two far cascades redrawn every fourth frame or when a tracked caster (a vehicle, a figure) crosses them, the near two every frame (`sun.js` gains `cadence`); the last cascade fades into the export’s 2,048² distant shadow cache for the level (`shadows.js` gains `farCache`, bound from the pack’s `textures/levels/` rows); contact shadows stay. SMRT stays PCSS.

Gate (laptop, Hoth hangar and Endor’s village): FLIP against G1 improves most of any lane (bounce is what the eye reads as real); the GPU frame rises by no more than 1.5 ms at ultra for the atlas and the grid together; the shadow cadence saves at least the two cascades’ draw time; luminance within lane S’s calibration band.

### N4: the stream that feels like one (`claude/gpu-n4-stream`)

World Partition’s two grids, and the boot slice before them: a visitor plays within seconds and the world sharpens round them.

- **The coarse grid**: `scripts/bf2017-horizon.mjs` writes each level’s `horizon/` beside its pack: a 512 m grid of merged low-poly proxies (the pack’s last LODs merged per cell, meshopt-compressed) and octahedral impostor atlases for the kit’s trees and repeated props (16 × 16 views at 2,048, agargaro’s layout, baked by `scripts/impostors.mjs` on the desktop or in CI’s software GL), under 400 KB a cell. `levelStream.js` fetches the coarse grid for the whole map first (it replaces the far list where a level has one), so the horizon is whole before any fine cell.
- **The boot slice**: the player’s cell and its eight neighbours at `lod1`, every map at its `.256` row, the coarse grid: under 12 MB on high, under 6 MB on mid (a budget the stream enforces, tested); the world’s gate lifts when it is in. Then, by a priority that is projected screen size × distance-along-heading, the fine LODs and the tier’s texture rows; a cell two ahead on the heading is prefetched at `lod1`.
- **Low mip first**: every pack map is fetched at `.256` first and swapped for the tier’s size when it lands (`levelGltf.js`’s texture cache gains a `promote`), the swap under a frame; the GPU scene’s material groups bind arrays by size so a promotion changes a layer, not a pipeline.
- **UASTC above low**: the pack’s `tex` rows gain `uastc` for every normal, ORM, mask and detail map (lane W’s `uastc` job encodes them; the colour row stays ETC1S below ultra as Q5 measures); the loader asks `renderer.hasFeature` for BC, ASTC or ETC2 and transcodes to BC5 or EAC RG11 for normals (two channels). Mobile tiers keep ETC1S on everything but normals.
- **The cache**: `public/sw.js` learns the packs’ hashed paths for the world being played (not only installed worlds), one world at a time, under a 400 MB cap with LRU; iOS evicts after a week, so the CDN is the real cache and every URL stays hashed and immutable.
- **Bytes**: `BUDGET_ROWS` gains `bootMB` and `visitMB` (the most a tier may pull in a visit: low 40, mid 120, high 400, ultra 1,200); the stream refuses past them and `galaxy-check` records each world’s first-visit bytes per tier. Egress stays within Supabase Pro’s included 250 GB at the site’s traffic; the research note has the arithmetic, and Cloudflare R2 is the hedge if it climbs.

Gate (cloud and laptop): time to first frame and time to “walkable” on a throttled 20 Mbit/s line per tier (under 10 s on high); first-visit bytes per tier under `bootMB` and `visitMB`; no pop in the parity shots at the coarse-to-fine swap; the maps ledger’s drawn columns unchanged.

### N5: the frame’s physics and effects, split as Chaos splits them (`claude/gpu-n5-sim`)

- **Rapier stays the truth, on the main thread, until measured otherwise.** X2 measured 0.5 ms a frame; a worker would add a hop (0.1 to 0.5 ms) for nothing today. The lane writes the worker as a module behind the same `createPhysics` face (`src/lib/physics/worker.js`, transferable `Float32Array` poses double-buffered, no SharedArrayBuffer, interpolation by `alpha`), tested in Node, and switches it on only when a world’s measured step passes 2 ms a frame on the laptop. Rapier 0.21 stays pinned (it is the newest; the SIMD build is X2’s).
- **GPU debris**: a break (a crate, a wall section, a speeder) spawns a few Rapier hulls that can hit the player and a burst into `particles/gpu.js`’s buffers with depth-buffer collision (the update kernel samples last frame’s depth and a reconstructed normal) and a lifetime; sleeping hulls become static instances in the GPU scene and are freed. Ragdolls stay Rapier, drawn as instanced skinned meshes. Big scripted collapses are pre-simulated on the desktop and streamed as keyframe tracks.
- **Particle lights** join `ClusteredLighting`’s list each frame within its cap.

Gate: a hundred breaks in a minute on Hoth with the CPU step under 2 ms and the GPU frame within 1 ms of before; the same seed gives the same battle (`x2-profile.mjs`’s replay).

### N6: the tier table and the fallbacks (`claude/gpu-n6-tiers`)

Unreal’s scalability groups as data, checked.

- **`src/runtime/tiers.js`** (pure, tested): the renderer tier (G1) × the quality level × the backend → which paths are on: the GPU scene (`T1`+ on WebGPU), the cluster tier (`T2`, N7), SSGI and SSR (`T1`+), the probe grid’s budget, the shadow cadence, TRAA or TAAU or SMAA, the controller’s floor, UASTC rows, the particle cap. `post.js`’s `CANNOT` and `passesFor` read it; `createLevelScene` reads it; nothing else branches on a backend name.
- **Phones**: `T0` draws lane U’s batched path, two cascades at 1,024, SSAO, the baked grid, TAAU at 0.67 with the controller’s floor at 0.58, ETC1S everything but normals (ASTC or ETC2 transcode), textures to 1,024, the coarse grid plus one ring of fine cells; the budget rows’ 33 ms accepted.
- **iOS 26.0 to 26.2**: a two-frame self-test after `init()` (draw, read back, compare) gates WebGPU and falls to `nodes-webgl` on a flicker, since three’s own fallback does not catch “works but flickers”.
- **The settings line** (T2’s) names the renderer, the tier and the controller’s current scale; `?tier=T0|T1|T2` pins a tier for a visit, as `?quality=` does.
- **The seventeen worlds in CI** at high on `nodes-webgl` (T2’s shards) stay the cloud gate; the laptop’s table per tier is the lane’s evidence, and the desktop’s `gate` job (lane W) runs it on the RTX.

Gate: every cell of the tier table pinned by a test; every world boots on every tier in software GL; the laptop table per tier.

### N7: the cluster tier, a spike (`claude/gpu-n7-clusters`)

Nanite’s inner loop, tried and kept only if it pays. `scripts/meshlets.mjs` cuts a pack’s LOD0 meshes into meshopt meshlets (128 triangles, groups of 8, half the triangles a level) with their bounds and error; `gpuScene/clusters.js` culls clusters (not instances) with the LOD cut and the HZB and draws them as one non-indexed `drawIndirect` with vertex pulling into an R32Uint visibility buffer (`mrt()`), then a material-depth classification and a full-screen resolve per material group (Bevy 0.14’s layout); on `T2` with `atomic-vec2u-min-max` a compute rasteriser for clusters under 64 pixels (Bevy 0.15’s layout). Measured on Hoth and on the fixture’s 3,000-instance stress scene against N1’s path on the RTX 5090, an M-series laptop and a phone. Ships behind the tier table only where it lowers the frame; otherwise its evidence and the decision why not.

## 5. Quality and rules

- **The picture is the game’s.** Nothing here changes a material’s inputs, the record’s light, the LUT, the Gaussians or the tone map; every lane’s FLIP is against G1’s reference of the same stack, and a lane that moves the mean luminance more than 3 % explains it.
- **Nothing is ever stretched by the browser** on a `'nodes'` world: the canvas is the screen’s pixels (capped at a ratio of 2); every reduction is internal and goes through an upscaler and the sharpen pass.
- **One number from one place**: the tier table (`tiers.js`), the budget rows (`budgets.js`) and the controller’s constants (`dynres.js`) carry every threshold with its `_source`; a world reads them and sets nothing of its own.
- **Every path falls back by data**, never by a throw: `nodes-webgl` and `T0` take lane U’s batched path, the baked grid, SMAA and FSR1; a lost device downgrades once.
- **Tests beside the files**; everything pure tested in Node (the cull rule against `lodAt`, the controller, the tier table, the stream’s budgets, the worker’s poses); the GPU paths on the lit fixture in both legs and on the laptop.
- **The health rules hold**: `src/lib/three` knows no world; `src/runtime` imports no component; files under 800 lines; every new addon import dynamic through `loadThree()`; the GLSL count only falls; a new dependency (`flip-evaluator` is a desktop tool, not a package; nothing else is added) gets its page first.
- **The standing rules** (`.claude/skills/autopilot/SKILL.md`): British spelling, curly quotes, `_source` on every number, no sequel era, nothing fetched from a service at run time, no key printed.

## 6. What this design does not do

- No engine, no pixel streaming, no server rendering (the owner’s word; lane R2 stays a measured spike).
- No shared-memory threads: cross-origin isolation breaks the bucket’s assets on GitHub Pages and Safari lacks `credentialless`; revisit when either changes.
- No feedback virtual texturing: the per-tier rows with low-mip-first promotion are its twin at this scale; revisit at 8,192 maps.
- No new tone mapper (ACES or AgX would un-match the game), no FFT bloom, no Hillaire sky (the record’s panorama is the sky) in these lanes.
- No shader-graph translation of the depots: M2 owns the material’s last mile; a generated translation of the game’s graphs is the lane after M2, noted in the hand-off.
- No change to the classic renderer or the low tier.

## 7. Seams with the running lanes

| lane | seam | rule |
| --- | --- | --- |
| T2 (the flip, `claude/bf2017-t2-flip`) | every lane here needs the surface on `'nodes'`; `surface/nodes/stack.js` and `chain.js` own the light and the chain | branch after T2 merges; N2 adds `sharpen` and the controller through `post.js` and `quality.js`, not `stack.js`; N3 adds `baked.js` and the cadence under `light/`, wired in `stack.js` by one call |
| U2 (headroom on) | `createLevelScene`’s `batch`, `Bundle`, `occlude`, `headroomAt`’s steps | N1 adds the third path and does not change the batched one; N2 replaces the pace’s input, not `headroom()`’s face; whichever merges second reconciles `map/level.js`’s call |
| D2 (every detail) | pack rows (ultra cut, 2,048 maps, anisotropy 16, probes 128²) | N4 adds `uastc`, `enlighten` and `horizon` rows beside D2’s; `scripts/bf2017-level.mjs` gains writers, D2’s untouched |
| M2 (materials) | Q1’s game material | N2 adds specular AA and the mip-bias uniform as two nodes in `compose.js`; N3 adds the baked term as one; M2’s branches untouched |
| P (the picture) | the record per world | nothing: N3 reads `picture` as T2 passes it |
| W (the desktop) | the `atlases`, `uastc`, `panoramas` and `gate` jobs | N3 and N4 consume their outputs; this design asks W for two more jobs: the impostor bake and the UASTC data rows |
| X2 (WebAssembly) | `src/lib/wasm/load.js` | N5’s worker loads Rapier through it |
| G (the gallery) | the ultra shots | G shoots after N2 and N3 land, beside G1’s references |

## 8. Risks

- **three’s GPU-driven path is new ground**: no official compute-culling example; `renderObject.getIndirect()` and `storage.toAttribute()` are the hooks, and a three upgrade can move them. N1 pins exact versions, wraps both in `gpuScene/three.js`, and the stack page lists them under “Upgrading”.
- **The visibility buffer may lose on tile-based chips** (Cinevva’s measurement): N7 is a spike with a phone leg for that reason.
- **64-bit atomics are not shipped**: the software rasteriser is `T2` only and may stay unreachable; N1’s hardware path is the one that ships.
- **Safari’s `timestamp-query`** is unconfirmed: the controller keeps the CPU pace as its fallback input.
- **Supabase egress** at UASTC sizes: the budget rows cap a visit; the arithmetic and the R2 hedge are in the research note.
- **The atlases are the desktop’s**: N3 ships its sampler and grid against Hoth’s desktop export and the fixture; the other levels light up as lane W uploads.
- **Collisions with U2 and D2** in `levelScene.js` and the pack writers: each lane owns a new path or new rows and merges `origin/main` before its PR, keeping both sides.

## 9. Open questions for the owner

1. The egress line: at UASTC data rows and a 1,200 MB ultra visit, does the owner want Cloudflare R2 in front of the bucket before N4 ships, or the budget rows alone?
2. The 30 fps pin: should phones default to 30 with the controller’s floor at 0.58, or to 60 at lower settings? N6 defaults to 30 on `T0`.
3. The cluster spike (N7): run it now beside N1, or after N1 to N4 land? The design says after, on the laptop, so the comparison is against the shipped path.
4. The reference frames: the owner’s picks of the game’s own frames (the Steam set) sit beside G1’s references in the gallery; which worlds first?

## 10. Gates, in one place

Every lane: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `npm run coverage:bf2017`, `npm run maps:bf2017`, the seventeen worlds at high on `nodes-webgl` in software GL (`BUDGET=1 QUALITY=high SCANS=game node scripts/galaxy-check.mjs surface <world>`), the parity check on the routes it touches, and on the owner’s laptop (RTX 5090, Edge, `ANGLE=d3d11`, 1,600 × 900 and 3,840 × 2,160, WebGPU and `nodes-webgl` legs): the lane’s own table above, every Star Wars world under 16.7 ms p95 at ultra (`scripts/galaxy-budget.mjs`), FLIP against G1’s reference no worse than before, and the evidence under `docs/superpowers/evidence/gpu-first/<lane>/` with a README saying what each file is and its `_source`. What the cloud cannot run is the desktop’s `gate` job (lane W), never a skipped row.

## 11. Addendum (2026-10-11, later): a list of libraries weighed, and one correction

The owner brought a list of repositories as candidates for the gaps above. Each against the repository as it stands:

| candidate | what it is | verdict |
| --- | --- | --- |
| `0beqz/realism-effects` (SSGI, SSR, HBAO, TRAA, motion blur) | a post stack on `pmndrs/postprocessing`, the classic renderer’s | **no**: three r186 ships every one of these as TSL nodes and the light stack already runs them (`light/post.js`); a technique reference at most |
| `gkjohnson/three-gpu-pathtracer` as an offline lightmap baker | a physically based path tracer on WebGL 2 | **yes, as N3’s second road** (below): the desktop bakes a level’s irradiance into the site’s own charts where the game’s cannot be read; never at run time |
| `elad12390/three-virtual-geometry` (cluster LOD and GPU culling on three WebGPU) | a one-author library, r180+, numbers unverified | **measure, do not adopt**: N7 benchmarks it beside N1’s path and its own clusters on the three devices; a dependency enters only with its page and a number that beats what the site builds |
| `Scthe/nanite-webgpu`, `apollo-2006/colossus` | references for compute meshlets and cluster streaming | already the research note’s sources; N7 reads them |
| three r186’s `GaussianSplatMesh` (and `mkkellogg/GaussianSplats3D`, Spark) | photoreal splats, WebGPU-native | **later, as a spike for the horizon only**: a game vista is not a photo; a splat of Hoth’s mountains means rendering hundreds of views on the desktop and training for hours, for tens of MB a level, against the record’s own painted panorama and the horizon grid’s proxies. Worth one measured try on one level after N4 |
| `N8python/n8ao` (and a WebGPU port) | screen-space AO with a denoiser | **no**: GTAO with the record’s HBAO numbers is the game’s AO (Q6); a second AO would un-match it |
| `donmccurdy/glTF-Transform`, `meshoptimizer` | the glTF pipeline | **already in place**: every GLB in the bucket is gltfpack output (meshopt, KTX2), the scripts use `@gltf-transform/*` in 185 places, and the game ships its own LOD chains |
| `gkjohnson/three-mesh-bvh` | a BVH for queries | **no**: queries are Rapier’s (`lib/physics/queries.js`) |

**The correction, for N3.** The Enlighten atlases exist (200 of them) but the atlases are of no use without each instance’s chart: the exporter writes `TEXCOORD_1` only where a mesh has a second UV set, Hoth’s props have one set, and the charts and each instance’s atlas rectangle live in an Enlighten `DatabaseResource` the exporter never read (`2026-10-10-bf2017-surfaces-design.md`, Q3; `evidence/bf2017-picture/w/atlases/FORMAT.md`). So N3’s far field has two roads, and the lane builds the sampler to take either:

1. **The game’s charts**, if Q3’s desktop spike (`tool/EnlightenResProbe.cs` on the `DatabaseResource`) finds per-instance rectangles and UVs: the pack gains a per-instance `uvRect` and a per-mesh chart UV, and `baked.js` samples the game’s own atlas at `uv1 × rect.zw + rect.xy`.
2. **The site’s own bake**, where the charts cannot be read: a lane W job (`lightmaps`) on the owner’s GPU runs `three-gpu-pathtracer` over a level’s static instances (the game’s materials, sun and sky from the record, the bounce’s own numbers from `EnlightenComponentData`: `TerrainColor`, `SkyBoxSkyColor`, `SkyBoxGroundColor`, `BounceScale`, `SunScale`), into charts the site unwraps itself with `watlas` (already a devDependency) per instance, written as RGBA16F KTX2 atlases plus direction and sky-visibility maps in the same five-texture shape as Enlighten’s, so `baked.js` reads either road the same way. Numbers to hold: Flux’s `SystemLightmapSize 128`, `MaxLightmapSize 4096`; the mean luminance within lane S’s band against the record.

`three-gpu-pathtracer` is a desktop-script dependency, never shipped to a visitor; it gets its stack page before `scripts/desktop/bf2017-lightmaps.mjs` imports it. N3’s plan carries the two roads from today.
