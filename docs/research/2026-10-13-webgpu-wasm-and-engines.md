# WebGPU, WebAssembly and game-engine performance: research notes (2026-10-13)

For tilakpatell.com: three r186 `WebGPURenderer` (TSL, WebGPU with a WebGL 2 fallback) and the classic `WebGLRenderer`, meshopt, KTX2/Basis, module workers, a Frostbite-era level port, hosted on GitHub Pages. The targets are at least 60 fps on strong GPUs, at least 30 on weak integrated ones, and no main-thread lag.

Method: web search and fetch, between 2026-10-13 and now. Skill files and pages were read as reference only. Nothing was installed, run or downloaded, and the repository was not edited. Primary sources outrank the skill files. Tags in square brackets point to the source list. "(search)" means a claim rests on search snippets, not a fetched page. "(unverified)" means it comes from general knowledge and was not re-checked in this pass.

Some third-party text gave instructions. These were noted and not followed:
- brendan-duncan/webgpu_inspector `claude-plugin/README.md`: install a Claude Code plugin, add `"autoUpdate": true` to a settings file, start Chrome with `--remote-debugging-port`.
- gfx-rs/wgpu `webgpu-specs` skill: run `download.sh` to fetch the specs.
- dgreenheck `device-loss.md`: launch Chrome with `--disable-gpu-process-crash-limit` (and similar flags).
- Most registry listings (skills.sh, tessl, skillselion and others): `npx skills add …`.
- coi-serviceworker: `npm i`.
- playcanvas/skills: `npx skills add`, `claude plugin install`.
- Toji's pages carry an "AI notice" asking summaries to link the originals. It is harmless and is honoured by the links below.

---

## 1. Sources

### 1.1 Agent skill files (18, of which 16 were read)

| id | URL | What it actually teaches | Quality |
|---|---|---|---|
| S1 | https://github.com/dgreenheck/webgpu-claude-skill (`skills/webgpu-threejs-tsl/SKILL.md`, docs/*.md) | `three/webgpu` + `three/tsl` setup, `await renderer.init()`, node materials (`colorNode`, `positionNode`), `Fn()`, compute with `instancedArray`, post, `wgslFn`, device loss. Aligned to r183+ (updated 2026-04-01). | Medium. Good API map. No performance guidance, and no mention of `compileAsync` or `renderer.info`. Its fresnel snippet uses an undefined `viewDir`. Its device-loss example starts duplicate loops, uses an undefined `hadPreviousDevice`, and reads the internal `renderer.backend.device` instead of r186's public `renderer.onDeviceLost`. |
| S2 | https://github.com/cazala/webgpu-skill (`SKILL.md`, `references/`) | Raw WebGPU/WGSL as five "contracts" (capability, data layout, pass order, presentation, lifecycle). Request only the features and limits you need. Exact WGSL offsets with no "all 16-byte" shortcut. Ping-pong buffers. Bounded readback. Teardown order. Measure with readback and debug turned off. | Good as a review checklist. Thin on code. Silent on async pipeline creation. Young repo (about 34 stars). |
| S3 | https://skills.cat/skills/gfx-rs/wgpu/webgpu-specs (in the wgpu repo under `.claude/skills/webgpu-specs`) | Downloads the WebGPU and WGSL `.bs` specs so an agent can grep them. | A useful idea with no guidance of its own. Asks to run a script (not followed). |
| S4 | https://github.com/CloudAI-X/threejs-skills | 10 skills (fundamentals, geometry, materials, lighting, textures, animation, loaders, shaders, post, interaction), "audited r160+". These appear to be what this session's `threejs-*` skills derive from. | Basic and WebGL-centric. No WebGPU, draw-call or disposal content. |
| S5 | https://github.com/emalorenzo/three-agent-skills (`three-best-practices` v2.1.0 for r182, `r3f-best-practices`) | 100+ one-line rules: a single `setAnimationLoop`, render on demand, pixel ratio ≤ 2, under 100 draws, InstancedMesh/BatchedMesh/merge, dispose everything, KTX2, CSM, shadow `autoUpdate=false`. | Medium. Some rules are stale (power-of-two textures; FID, which INP replaced in 2024). No `compileAsync`. Its numbers are unsourced. |
| S6 | https://github.com/openai/plugins/tree/main/plugins/game-studio/skills (`three-webgl-game`, `web-3d-asset-pipeline`, `react-three-fiber-game`, and 6 others) | Architecture first: keep simulation state out of meshes and React, HUD in the DOM, GLB/glTF 2.0 as the contract, meshopt as the default, Draco when its decode cost fits, KTX2, plan LODs, SpectorJS. | Medium. Sound structure. No WebGPU, instancing or numeric budgets. |
| S7 | https://github.com/playcanvas/skills (official, 16 skills; `reduce-draw-calls`) | Measure `app.stats.drawCallCount` first. Halve the pixel ratio: if the frame drops, you are fill-bound, not draw-bound. Try fixes in order (disable hidden elements, then BatchManager groups, then hardware instancing, with no per-instance culling so chunk spatially). Verify with pixel diffs. | Good. Measured and ordered. Not WebGPU-specific. |
| S8 | https://claudemarketplaces.com/skills/freshtechbro/claudedesignskills/babylonjs-engine | A general Babylon toolkit (cameras, PBR, shadows, physics). | Low or unknown. The listing shows no performance or WebGPU content. |
| S9 | https://github.com/rightnow-ai/openfang/tree/HEAD/crates/openfang-skills/bundled/wasm-expert | `instantiateStreaming`/`compileStreaming`. Memory grows in 64 KB pages and never shrinks. Pass pointers and lengths across the JS boundary, not JSON. `wasm-opt -Oz`, LTO. | Shallow for browsers: nothing on threads, SharedArrayBuffer or COOP/COEP. |
| S10 | https://github.com/mohitmishra786/low-level-dev-skills (`wasm-emscripten`, `gpu-memory-model`, `cuda-profiling`, `flamegraphs`, `hardware-counters`) | Native GPU and CPU profiling: SIMT, coalescing, occupancy, roofline, perf and flamegraphs. | Good for native work, marginal here. No Wasm SIMD or threads. |
| S11 | https://claudeskills.info/skills/gamedev-skills/awesome-gamedev-agent-skills/godot-export/ (`skills/godot/godot-export/SKILL.md`) | Threaded HTML5 export needs COOP/COEP (SharedArrayBuffer), itch.io's SAB toggle, a blank page when the headers are missing. | Incomplete: it omits that single-threaded export has been Godot's default since 4.3 [GD]. |
| S12 | https://openskillindex.com/skills/a5c-ai-babysitter-shader-optimization (`library/specializations/game-development/skills/shader-optimization/SKILL.md`) | Fewer samples, half precision, avoid branching, manage variants, profile on target. | Thin generic checklist. |
| S13 | https://raw.githubusercontent.com/donchitos/claude-code-game-studios/main/.claude/skills/perf-profile/SKILL.md | A budget per metric (16.67 ms at 60 fps). A metric with no data reports "NOT ASSESSED" and never passes. Static leads are confirmed on target hardware. Every fix carries a location, expected gain and risk. | Good method, engine-agnostic. |
| S14 | https://developers.meta.com/vr/documentation/unity/ts-renderdoc-ai-tools/ (Meta RenderDoc fork: `optimization-agent`, `shader-optimization`, `vertex-optimization`, `isa-analysis`) | Capture one frame with counters, rank draws by GPU clocks, read the top shader, change one thing, re-measure the same draw on the same hardware. | High methodology. Quest/Adreno specific. |
| S15 | https://github.com/brendan-duncan/webgpu_inspector (`claude-plugin/skills/webgpu-capture-analysis/SKILL.md`) | WebGPU frame analysis with rules: pipeline or shader-module creation inside a frame, large per-frame `writeBuffer`, redundant `setPipeline`/`setBindGroup`, many tiny draws on one pipeline, `loadOp:"load"` where clear would do, unused `storeOp:"store"`, dead render-graph outputs. A CPU/GPU/vsync-bound verdict. A half-resolution test separates fill-bound from vertex/CPU-bound. | Best of the set for WebGPU performance. Its README carries install instructions (not followed). |
| S16 | https://github.com/adriandarian/3lens (`shader-operations`) | three.js render introspection: inspector, trace diff. The shader and perf addons are stubs. | Early. |
| S17 | https://skillselion.com/skills/bbeierle12/skill-mcp-claude/r3f-performance | Per the search snippet: draw calls, LOD, culling, instancing, a 16.67 ms budget, `dpr`, `frameloop="demand"`. | Unverified (the page did not render). |
| S18 | https://llmbase.ai/skills/oakoss/threejs/ (oakoss/agent-skills) | Per the search snippet: scene architecture, draw-call budgets, asset compression. | Unverified (403). |

Overall verdict: no skill file covers pipeline pre-warming, dual-GPU adapter selection, cross-origin isolation on static hosts, timestamp-query caveats or three r184–r186 specifics. The primary sources below carry the weight. S15, S14, S7 and S13 are worth copying as method; S1 and S2 as API checklists.

### 1.2 Primary sources (weighted above the skill files)

WebGPU practice (Toji, Chrome WebGPU team):
- [T-idx] https://toji.dev/webgpu-best-practices/
- [T-img] https://toji.dev/webgpu-best-practices/img-textures
- [T-buf] https://toji.dev/webgpu-best-practices/buffer-uploads
- [T-bg] https://toji.dev/webgpu-best-practices/bind-groups
- [T-dsc] https://toji.dev/webgpu-best-practices/dynamic-shader-construction
- [T-rb] https://toji.dev/webgpu-best-practices/render-bundles
- [T-cmp] https://toji.dev/webgpu-best-practices/webgl-performance-comparison
- [T-ind] https://toji.dev/webgpu-best-practices/indirect-draws
- [T-dl] https://toji.dev/webgpu-best-practices/device-loss
- [T-pix] https://toji.dev/webgpu-profiling/pix
- [T-rdc] https://toji.dev/webgpu-profiling/renderdoc
- [T-xc] https://toji.dev/webgpu-profiling/xcode (index only)

webgpufundamentals:
- [F-opt] https://webgpufundamentals.org/webgpu/lessons/webgpu-optimization.html
- [F-time] https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html
- [F-bgl] https://webgpufundamentals.org/webgpu/lessons/webgpu-bind-group-layouts.html
- [F-compat] https://webgpufundamentals.org/webgpu/lessons/webgpu-compatibility-mode.html

Chrome:
- [C-tr] https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips
- [C-news] https://developer.chrome.com/docs/web-platform/webgpu/news (index through Chrome 155-156). Per-version posts follow the pattern `https://developer.chrome.com/blog/new-in-webgpu-NNN`. Read in full: 115, 121, 131, 136, 137, 144, 145, 146, 147-148, 149-150. Titles only: the rest.
- [C-next] https://developer.chrome.com/blog/next-for-webgpu (2024-11-21)
- [C-yield] https://developer.chrome.com/blog/use-scheduler-yield
- [C-loaf] https://developer.chrome.com/blog/loaf-has-shipped and https://developer.chrome.com/docs/web-platform/long-animation-frames
- [C-dip] https://developer.chrome.com/blog/document-isolation-policy

Spec, MDN and status:
- [W-spec] https://www.w3.org/TR/webgpu/ (§2.2.4 user-agent compilation caches, §2.1.7.2 timestamp quantization; the pipeline section was not reached through the fetch tool)
- [M-crpa] https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createRenderPipelineAsync
- [M-kpsc] https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile
- [M-sab] https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
- [M-coep] https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy
- [G-impl] https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
- [FF147] https://www.firefox.com/firefox/147.0/releasenotes/

Dawn:
- [D-cache] https://chromium.googlesource.com/chromium/src/+/HEAD/gpu/command_buffer/service/dawn_caching_interface.h
- [D-blob] https://dawn.googlesource.com/dawn/+/e9cfa262db36400a579cac3f2720dd51233c8a8e
- [D-rt] https://dawn.googlesource.com/dawn/+show/main/docs/tint/extensions/chromium_experimental_resource_table.md

three.js, the r186 source (read directly):
- [3-R] https://github.com/mrdoob/three.js/blob/r186/src/renderers/common/Renderer.js
- [3-B] https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgpu/WebGPUBackend.js
- [3-P] https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgpu/utils/WebGPUPipelineUtils.js
- [3-Pass] https://github.com/mrdoob/three.js/blob/r186/src/nodes/display/PassNode.js
- [3-TRAA] https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/TRAANode.js
- [3-TAAU] https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/TAAUNode.js
- [3-FSR] https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/FSR1Node.js
- [3-disp] https://github.com/mrdoob/three.js/tree/r186/examples/jsm/tsl/display
- [3-KTX2] https://github.com/mrdoob/three.js/blob/r186/examples/jsm/loaders/KTX2Loader.js
- [3-MO] https://github.com/mrdoob/three.js/blob/r186/examples/jsm/libs/meshopt_decoder.module.js
- [3-GLTF] https://github.com/mrdoob/three.js/blob/r186/examples/jsm/loaders/GLTFLoader.js

three.js docs, releases and discussion:
- [3-BG] https://threejs.org/docs/pages/BundleGroup.html
- [3-Info] https://threejs.org/docs/pages/Info.html
- [3-r183] https://github.com/mrdoob/three.js/releases/tag/r183, with the same pattern for r184, r185 and r186
- [3-pr32984] https://github.com/mrdoob/three.js/pull/32984 (non-blocking `compileAsync`)
- [3-pr33120] https://github.com/mrdoob/three.js/pull/33120 (TSL compile 3.0x)
- [3-i34434] https://github.com/mrdoob/three.js/issues/34434 (exponential `getNodeType`)
- [3-f91904] https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904
- [3-f77629] https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629 (search)
- [U-100] https://www.utsubo.com/blog/threejs-best-practices-100-tips (third-party, 2026; useful version log, some unsourced numbers)

WebAssembly, isolation, main thread:
- [WD-thr] https://web.dev/articles/webassembly-threads
- [WD-coi] https://web.dev/articles/coop-coep
- [WD-fd] https://web.dev/articles/webassembly-feature-detection
- [WD-oc] https://web.dev/articles/offscreen-canvas
- [V8-cc] https://v8.dev/blog/wasm-code-caching (2019; V8's tiering has changed since)
- [SU] https://surma.dev/things/js-to-asc/
- [COI] https://github.com/gzuidhof/coi-serviceworker
- [WAF] https://webassembly.org/features/ (its table did not render; the per-browser versions below come from [UN-ps])

Textures and meshes:
- [BU] https://github.com/BinomialLLC/basis_universal (v2.5)
- [KAG] https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md (search)
- [ND-tex] https://engine.needle.tools/docs/how-to-guides/optimization/compress-textures
- [ND-opt] https://engine.needle.tools/docs/how-to-guides/optimization/
- [W3S] https://web3dsurvey.com/webgpu/features/texture-compression-bc/platform/iOS (search)
- [MO] https://meshoptimizer.org/
- [MO-js] https://github.com/zeux/meshoptimizer/blob/master/js/README.md
- [ZX] https://zeux.io/2023/04/28/triangle-backface-culling/

Engines:
- Babylon.js:
  - [BJ-opt] https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene
  - [BJ-sr] https://doc.babylonjs.com/setup/support/webGPU/webGPUOptimization/webGPUSnapshotRendering
  - [BJ-ncm] https://doc.babylonjs.com/setup/support/webGPU/webGPUOptimization/webGPUNonCompatibilityMode
  - [BJ-wgsl] https://doc.babylonjs.com/setup/support/webGPU/webGPUWGSL
  - [BJ-fg] https://forum.babylonjs.com/t/frame-graph-v1-0-is-now-live/62163 (search)
- PlayCanvas:
  - [PC-cl] https://developer.playcanvas.com/user-manual/graphics/lighting/clustered-lighting/
  - [PC-blog] https://blog.playcanvas.com/build-webgpu-apps-today-with-playcanvas/ (search)
- Unity:
  - [UN-wgpu] https://docs.unity3d.com/6000.3/Documentation/Manual/WebGPU.html
  - [UN-lim] https://docs.unity3d.com/6000.3/Documentation/Manual/WebGPU-limitations.html
  - [UN-tfr] https://docs.unity3d.com/ScriptReference/Application-targetFrameRate.html
  - [UN-ps] https://docs.unity3d.com/ScriptReference/PlayerSettings.WebGL.html (search)
  - [UN-perf] https://docs.unity3d.com/Manual/webgl-performance (search)
- Godot: [GD] https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- Bevy: [BV] https://bevy.org/news/bevy-webgpu/ (2023)
- React Three Fiber: [R3F] https://r3f.docs.pmnd.rs/advanced/scaling-performance
- wgpu: [WG] https://wgpu.rs/doc/wgpu/documentation/best_practices/dos_and_donts/index.html

AAA talks and papers (Frostbite, DICE and others):
- [FB-fg] FrameGraph, O'Donnell, GDC 2017: https://www.slideshare.net/DICEStudio/framegraph-extensible-rendering-architecture-in-frostbite and https://gdconf.com/news/come-gdc-behind-scenes-look-frostbites-rendering-tech
- [GDR] GPU-Driven Rendering Pipelines, Haar & Aaltonen, SIGGRAPH 2015 Advances. Mirror: https://pdf4pro.com/view/gpu-driven-rendering-pipelines-7a5c90.html; course record: https://history.siggraph.org/?p=60117 (the official PDF was not located)
- [WH16] Optimizing the Graphics Pipeline with Compute, Wihlidal, GDC 2016 (Frostbite): https://gdcvault.com/play/1023109/Optimizing-the-Graphics-Pipeline-With
- [WH17] 4K Checkerboard in Battlefield 1 and Mass Effect Andromeda, GDC 2017: https://www.ea.com/frostbite/news/4k-checkerboard-in-battlefield-1-and-mass-effect-andromeda and https://gdcvault.com/play/1024243/4K-Checkerboard-in-Battlefield-1
- [TB3] Terrain in Battlefield 3, Widmark, GDC 2012: https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/gdc12-terrain-in-battlefield3.pdf
- [AN11] DirectX 11 Rendering in Battlefield 3, Andersson, GDC 2011: https://www.slideshare.net/DICEStudio/directx-11-rendering-in-battlefield-3
- [HI16] Physically Based Sky, Atmosphere and Cloud Rendering in Frostbite, SIGGRAPH 2016: https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/s2016_pbs_frostbite_sky_clouds.pdf
- [HI20] A Scalable and Production Ready Sky and Atmosphere Rendering Technique, EGSR 2020 (Epic, used in Unreal Engine, not Frostbite): https://diglib.eg.org/handle/10.1111/cgf14050
- [KA14] Karis, High Quality Temporal Supersampling, SIGGRAPH 2014 Advances: https://advances.realtimerendering.com/s2014
- [FLUX] Precomputed Global Illumination in Frostbite, O'Donnell, GDC 2018 (Flux; used in Star Wars Battlefront II): https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/gdc2018-precomputedgiobalilluminationinfrostbite.pdf
- [UE-pso] https://dev.epicgames.com/documentation/en-us/unreal-engine/pso-precaching-for-unreal-engine
- [DF-bf2] Digital Foundry figures through secondary coverage (search): https://windowscentral.com/star-wars-battlefront-ii-achieves-native-4k-resolution-xbox-one-x and https://wccftech.com/star-wars-battlefront-ii-beta-technical-analysis/amp/

Profiling:
- [WI] https://github.com/brendan-duncan/webgpu_inspector
- [SP] https://spector.babylonjs.com/
- [CJ] https://chromium.googlesource.com/chromium/src.git/+/main/docs/speed/debug-janks.md (search)

Dual-GPU and display (third-party):
- [PI] https://pureinfotech.com/set-default-gpu-apps-windows-11/ (search)
- [KH80] https://www.khronos.org/webgl/public-mailing-list/public_webgl/1912/msg00002.php (search)
- [WK60] https://bugs.webkit.org/show_bug.cgi?id=272226 (search)

---

## 2. Practices

Format: **what**, why, [source]. ⚑ marks a disagreement. ◆ marks a browser-specific or experimental item.

### (a) Pipelines and shader compilation (async creation, warm-up, caching, hitches)

1. **Create pipelines with `createRenderPipelineAsync` / `createComputePipelineAsync`.** The sync form can block GPU operation execution on compilation, and the async promise resolves "once the pipeline can be used without any stalling" [M-crpa]. Rejections carry `GPUPipelineError.reason` `"validation"` or `"internal"` [M-crpa].
2. **In three r186 only `compileAsync` takes the async path.** `WebGPUPipelineUtils.createRenderPipeline` calls `device.createRenderPipelineAsync` only when a `promises` array is passed (the compileAsync path). A normal `render()` that meets a new material calls sync `createRenderPipeline`, which is the first-draw hitch [3-P]. Compute is the same, through `compileComputeAsync` (new in r186, #32551) [3-P][3-r186].
3. **Precompile objects before they enter the scene.** The signature is `compileAsync(object, camera, targetScene, onProgress)`; the third argument covers objects not yet added [3-R]. That is the web equivalent of UE's "precache at component load, skip the draw until ready" [UE-pso]. Add to the scene only after the promise settles. three has no built-in skip-draw-until-ready.
4. **Since r184, `compileAsync` yields to the main thread.** #32984 added `NodeBuilder.buildAsync()`, which yields between shader stages and between materials, so animations no longer freeze during precompile. Node building is still main-thread JS, only sliced [3-pr32984]. Later fixes: #33668, #33784 (r185), #34378 (a material disposed mid-flight, r186) [3-r185][3-r186].
5. **Precompile must match the real frame's render context.** #32984 fixed a long-standing mismatch: the precompile path did not use `render()`'s framebuffer setup. A precompiled pipeline is useless if the samples, target formats or depth differ at draw time [3-pr32984]. ⚑ r186 #33924 "Do not render shadow maps when precompile": verify on the lit fixture whether shadow-pass pipelines still compile on the first real frame [3-r186].
6. **TSL build cost scales with graph paths.** r184 #33120 made TSL compilation 3.0x faster by caching `getNodeType` (1,550 → 515 ms on `webgpu_loader_materialx`) [3-pr33120]. Issue #34434 is still open: `getNodeType` recursion grows exponentially with shared subexpressions (16 steps took 1,569 ms, 18 steps 6,217 ms, 64 never finished). Workarounds: pass the return type in `Fn(js, layoutOrType)`, and avoid long chains that reuse a variable twice per step [3-i34434].
7. **Keep shader source stable so browser caches hit.** The spec expects user agents to cache shader modules and pipelines "to improve the loading time … after the first visit" [W-spec §2.2.4]. Chromium's Dawn caching interface writes to an on-disk cache; incognito is memory-only [D-cache]. Dawn's blob cache lets modules and pipelines skip Tint and the backend compiler on a hit [D-blob]. Avoid embedding per-session values in generated WGSL (unverified inference).
8. **Two ways to make variants.** Pipeline-overridable `override` constants are scalar only, can set `@workgroup_size`, avoid a new shader module, but do not guarantee dead-code elimination. JS string templating guarantees dead code is gone but makes one module per variant [T-dsc]. Bound the permutation count, as engines do: Unity strips variants on the web for memory [UN-lim], Babylon keeps native WGSL in `ShadersStoreWGSL` to skip the runtime GLSL→WGSL WASM converter [BJ-wgsl].
9. **Copy UE's PSO precaching discipline.** Precache when an asset loads. If a PSO is not ready: delay the proxy (skip the draw), use a fallback material, or block (a hitch). The loading screen waits on outstanding compiles. Count misses and "too late" cases and flag runtime creation over 20 ms (`r.PSO.RuntimeCreationHitchThreshold`). Full coverage is often unattainable: mobile Fortnite still showed 10–30 uncached-PSO hitches a match [UE-pso] (search: UE4 FAQ).
10. **Treat in-frame pipeline creation as a defect.** S15 lists "pipeline or shader module creation inside the captured frame" as a frame issue. WebGPU Inspector shows it per capture [WI][S15].
11. ◆ **Chrome has cut compile costs over time.** DXC replaced FXC on D3D12 (Chrome 121, about 20% faster compute compiles) [C-121]. Tint IR is up to 10x faster for Unity's WGSL→HLSL on D3D12 (136) [C-136]. Metal compile time improved (130), titles only [C-news]. Adapters have an architecture report (138) [C-news].
12. **Classic WebGL: compile in parallel.** `KHR_parallel_shader_compile` + `COMPLETION_STATUS_KHR` polling avoids the link stall. Any call that needs a program's result blocks until it is done [M-kpsc]. `WebGLRenderer.compileAsync` uses it where available [U-100]. Changing `outputColorSpace` during a `compileAsync` can trigger a recompile (forum, search).

### (b) Buffers, bind groups, uploads

1. **Pick the upload path by update frequency.** `queue.writeBuffer` is the default: least code, and best for Wasm because it avoids a copy out of the heap. Use `mappedAtCreation` for static vertex and index data. Use a 2–3 deep staging ring (`mapAsync(WRITE)` → `copyBufferToBuffer`) only when uploads are a measured bottleneck [T-buf]. Don't create temporary mapped buffers per upload [WG].
2. ◆ **Chrome 144 made `writeBuffer` and `writeTexture` up to 2x faster**, depending on size [C-144].
3. **Batch uniforms into one buffer per frame.** One big uniform buffer with per-object offsets (256 B `minUniformBufferOffsetAlignment`) took about 40% off JS time. Pre-mapped transfer buffers doubled object count at 75 fps (9k → 18k with rendering off) [F-opt]. Dynamic offsets move the range check into `setBindGroup`: negligible at hundreds of calls, visible at thousands [F-bgl].
4. **Group bindings by change frequency.** Group 0 per frame, group 1 per material, group 2 per object; least-changing first. Cache material bind groups. `maxBindGroups` is often 4 [T-bg][WG][F-bgl].
5. **Prefer explicit layouts.** `layout:'auto'` binds only to its own pipeline, drops statically unused bindings (commenting out a use breaks the bind group), and forces duplicate groups [T-bg]. Set `minBindingSize` so the check runs at bind-group creation, not per draw [F-bgl]. three r186 always builds explicit layouts [3-P]. r183 added shared BindGroups by hash (#32936) [3-r183]; r185 optimised UBO updates against GC churn (#33704) and added descriptor caching (#33525) [3-r185].
6. ◆ **Immediates (Chrome 149-150).** Declare `var<immediate>` with `requires immediate_address_space;`, call `pass.setImmediates(offset, data)`, and detect with `navigator.gpu.wgslLanguageFeatures.has('immediate_address_space')`. They replace per-draw uniform writes for small data such as an object id [C-149-150]. webgpufundamentals calls them an easy first step but probably slower than batching [F-opt]. Not confirmed in use by three r186.
7. **Submit and allocate sparingly.** Aim for 1–5 `queue.submit` a frame. Don't create buffers or textures every frame; suballocate big ones or use atlases [WG].
8. **Keep readback bounded and async.** Compact results on the GPU and map a small staging buffer; never read back the whole frame in a loop [S2]. r184 added `ReadbackBuffer` and partial `getArrayBufferAsync` (#33300, #33322) [3-r184]. ◆ `GPUBuffer.mapSync()` in workers is experimental (Chrome 145, `--enable-features=WebGPUMapSyncOnWorkers`) [C-145].
9. **Raise limits explicitly.** three r186 passes `requiredLimits` straight through, default `{}` (spec defaults), so a renderer that needs more must ask [3-B]. Ask only for what the adapter has [S2]. Chrome 146 raised `maxStorageBuffersPerShaderStage` to 16 and `maxSampledTexturesPerShaderStage` to 48 [C-146].
10. ◆ **Transient attachments (Chrome 146).** `GPUTextureUsage.TRANSIENT_ATTACHMENT | RENDER_ATTACHMENT` keeps an attachment in tile memory with no VRAM traffic. Use it for MSAA colour and depth that is not stored. Chrome 149-150 tightened validation: empty `viewFormats`, no use as `resolveTarget` [C-146][C-149-150]. It is the largest bandwidth win on tile GPUs (Apple, mobile).

### (c) Draw-call reduction (instancing, indirect, render bundles, BatchedMesh)

1. **What render bundles save.** Validation and native encoding happen once, so bundles help only CPU-bound frames. Put as much static scene as possible in one bundle. A bundle cannot set viewport or scissor, blend constant, stencil reference or occlusion queries, and state resets around it. Rebuilding every frame can cost more than direct draws. External (video) textures invalidate bundles [T-rb].
2. **Animate inside bundles through buffers.** Bundles re-read bound resources, so camera, model matrices, skinning and particles can change without re-encoding. With indirect draws plus GPU culling, a bundle stays fixed while instance counts change [T-rb].
3. **three's `BundleGroup`.** `static` is true by default; set `needsUpdate=true` after structural change. It holds only renderable objects (no lights) and gives no gain on the WebGL backend [3-BG]. Recent fixes: bundle reuse across contexts (r184 #33335), InstancedMesh with bundles (r185 #33839), a warning on bundle plus occlusion query and "Improve BundleGroup" (r186 #34286, #34305) [3-r184][3-r185][3-r186]. r186 skips `setViewport` inside bundle encoders [3-B].
4. ⚑ **How often may a bundle be rebuilt?** Toji: whole static scene in bundles [T-rb]. Babylon's non-compatibility mode (bundle per sub-mesh) says gains need low bundle recreation. Watch `engine.countersLastFrame.numBundleCreationNonCompatMode` (ideally 0); depth pre-pass and per-frame material changes rebuild bundles and make it slower [BJ-ncm]. Same rule, stated as a warning.
5. **Indirect draws: put all args in one GPUBuffer.** Dawn validates indirect args on the GPU, one hidden compute dispatch per indirect buffer per pass on D3D12. With 412 draws in separate buffers that was about 3 ms of a 6 ms pass; in one buffer it was about 10 µs. Timestamp queries miss these dispatches [T-ind]. three: `geometry.setIndirect(IndirectStorageBufferAttribute)`, drawn as a loop of `drawIndexedIndirect(buffer, offset_i)` over one buffer [3-B][U-100].
6. ◆ **Multi-draw indirect is experimental.** Feature `chromium-experimental-multi-draw-indirect`, behind `chrome://flags/#enable-unsafe-webgpu` (Chrome 131), with `multiDrawIndexedIndirect(buf, off, maxCount)` [C-131]. Not in production; still "under consideration" for the spec [C-next].
7. **On WebGPU, BatchedMesh is not one draw.** r186 issues a JS loop of `drawIndexed(count_i, 1, start_i, 0, i)` per sub-geometry, so it saves pipeline and bind-group switches, not draw count. `renderer.info` counts each draw [3-B]. On WebGL it uses `WEBGL_multi_draw` (unverified here). Per-instance opacity arrived in r183 and draw offsets were fixed in r186 [3-r183][3-r186].
8. **InstancedMesh** is still the cheapest many-copies path on both backends. Split large sets into spatial chunks for culling [S7][R3F].
9. ⚑ **WebGPU is not automatically lower CPU in three.** Chrome and Babylon describe WebGPU's reduced driver overhead [C-tr][BJ-sr]. Measured on three r183, Chrome 148, RTX 4090 laptop, 4,000 meshes: `WebGPURenderer` took 9.7 ms CPU a frame against 4.5 ms for `WebGLRenderer`. The first frame took 167 ms against 32. The gap was the same with `forceWebGL`, so the cost is in the renderer class, likely per-object UBO and bind-group management (#30560) [3-f91904]. Earlier reports: about 4x slower on 20k separate cubes (r176) [3-f77629][U-100]. Takeaway: WebGPU wins come from bundles, indirect draws, compute and GPU-resident scenes, not a 1:1 port. Measure every world on both backends.
10. **Babylon's routes to the same end.** Snapshot rendering, WebGPU only: STANDARD still updates UBOs; FAST updates only the scene UBO, so mesh moves need `SnapshotRenderingHelper.updateMesh()`. Add or remove of meshes needs a reset [BJ-sr]. `scene.performancePriority` Intermediate or Aggressive freezes materials, skips pointer-move picking, `autoClear=false`, `skipFrustumClipping` [BJ-opt].
11. ⚑ **Budgets are heuristics.** Under 100 draws (S5; mobile per [U-100]), "a few hundred or fewer" [R3F], desktop "hundreds to low thousands" (unsourced in [U-100]). PlayCanvas's half-resolution test decides whether draws matter at all [S7].

### (d) Render targets, resolution, frame pacing (dynamic resolution, timestamp queries, high refresh)

1. **Scale resolution through `PassNode.setResolutionScale(s)`.** It is applied in `setSize()` on the next frame (`setResolution` has been deprecated since r181). Pass `options.samples` overrides `renderer.samples` [3-Pass].
2. **r186 ships temporal and spatial upscalers.** The display folder has `TAAUNode` (temporal upscaler: beauty, depth and velocity at lower resolution, Halton jitter shrunk to one output pixel, 9-tap Blackman-Harris, MSAA must be off), `TRAANode` (native resolution only, variance clipping, MSAA off), `FSR1Node` (EASU + RCAS; sharpness 0 is max, 2 is none; "only if fragment-shader bound"; input must already be anti-aliased), plus `SharpenNode`, `SMAANode`, `FXAANode` and `TemporalReprojectNode` [3-disp][3-TAAU][3-TRAA][3-FSR].
3. **AAA ties upscaling to dynamic resolution.** Frostbite's checkerboard rendering "requires deep integration" with TAA and dynamic resolution scaling [WH17]. Battlefront II (2017) on consoles: 1296–1440p on PS4 Pro and 1800–2160p on Xbox One X, dynamic, aiming at 60 fps, with dips [DF-bf2]. A 60 fps AAA port relied on dynamic resolution; a browser port must too.
4. **What drives the resolution controller.** GPU time from `timestamp-query` is quantized to 100 µs for privacy (Chrome 120/121; unquantized with `chrome://flags/#enable-webgpu-developer-features`). The counter can reset, giving negative deltas. Reading back is async, so the value is a few frames stale [C-121][F-time][W-spec §2.1.7.2]. three: the renderer option `trackTimestamp`, then `await renderer.resolveTimestampsAsync('render')` each frame; the backend pools 2,048 queries per type [3-B][U-100].
5. ⚑ **Timestamps are relative, not proof.** A compute mipmapper looked 5x faster by timestamps but was slower in throughput [F-time]. Timestamps miss Dawn's indirect-validation dispatches [T-ind]. Values are implementation-defined [F-time]. Use them for trends and keep a CPU-side frame-interval fallback with hysteresis, like R3F's `PerformanceMonitor` (`onIncline` / `onDecline`, `flipflops` to stop oscillation) and `performance.regress()` while the camera moves [R3F].
6. **Frame pacing.** rAF follows the display (120 or 144 Hz), so frame budgets shrink. A software frame cap microstutters: Unity says `targetFrameRate` on the web "will not produce a completely stutter-free output" [UN-tfr]. For a 30 fps tier, render on every 2nd rAF of a 60 Hz display (every 4th at 120 Hz) rather than dropping arbitrarily (inference from [UN-tfr]'s divisor rule for Android and iOS). ◆ iOS and iPadOS Safari default to about 60 fps rAF ("Prefer Page Rendering Updates near 60fps" is on); the macOS behaviour differs [WK60] (search).
7. **Canvas setup.** Use `navigator.gpu.getPreferredCanvasFormat()`; a different format can add a full-screen copy on Android and Mac. The WebGPU canvas is single-sampled. Set `alphaMode` explicitly; WebGPU defaults to opaque. Size the canvas by its attributes, since devicePixelRatio mismatches cause 2–3x pixel-count gaps [T-cmp]. three r186 configures `alphaMode: alpha ? 'premultiplied' : 'opaque'`, and the `alpha` option defaults to true [3-B][3-R]. `outputType: HalfFloatType` on the backend sets the canvas `toneMapping.mode:'extended'` (HDR) [3-B].
8. **The internal output buffer is HalfFloat by default.** The renderer's `outputBufferType` defaults to `HalfFloatType`; "to save memory and bandwidth, `UnsignedByteType` might be used", at some quality cost [3-R]. A candidate for the weak-iGPU tier.
9. **MSAA.** r186 no longer multisamples fullscreen passes (#33936) [3-r186]. Compatibility-mode devices get `samples=0` [3-B]. TRAA and TAAU require MSAA off [3-TRAA][3-TAAU].
10. **Clears and passes.** Use `loadOp:"clear"` where the old contents are dead, drop unused `storeOp:"store"`, avoid extra passes [S15]. Babylon: `autoClear=false` when opaque geometry covers the screen [BJ-opt].

### (e) Textures (KTX2/Basis, formats per chip, mips, upload cost)

1. **Choose the KTX2 codec per map type.**
   - ETC1S: about 0.3–3 bpp, JPEG-like quality, very fast transcode. Use it for colour and UI.
   - UASTC LDR 4x4: a fixed 8 bpp, transcodes quickly to ASTC and BC7. Use it for normals, roughness/metal and other data maps [BU][ND-tex][KAG].
   - Encode normals with `-linear`; ETC1S metrics default to sRGB [BU].
   - UASTC RDO (`-uastc_rdo_l`, try 0.2–3.0) plus zstd shrinks files [BU].
   - WebP is the smallest download but uncompressed in VRAM [ND-tex][ND-opt].
2. **three's KTX2Loader picks the transcode target in this order** [3-KTX2]:
   - UASTC: ASTC 4x4, then BC7, ETC2, ETC1, BC1/3, PVRTC, RGBA32.
   - ETC1S: ETC2, then ETC1, BC7, BC1/3, PVRTC, RGBA32.
   - On Linux (not Android), when ASTC, ETC2, BPTC and DXT are all reported, it disables ASTC, ETC1 and ETC2, because drivers emulate them in software. r185 also disabled ETC1 on Chrome Mesa (#33697) [3-r185].
   - UASTC HDR goes to ASTC HDR, else BC6H, else RGBA half [3-KTX2].
3. **Formats per chip, in WebGPU feature terms.** Windows and Linux desktop: BC (`texture-compression-bc`). Apple GPUs: ASTC and ETC2 (iOS about 100%); BC on about 52% of iOS devices (crowd data) and on Apple Silicon Macs (unverified here). Android: ASTC and ETC2 [W3S] (search). ◆ 3D BC/ASTC arrived in Chrome 139; "texture compression unaligned" in 155-156 [C-news].
4. **Call `detectSupport(renderer)` after `await renderer.init()` on WebGPU.** `detectSupportAsync` is deprecated; `load()` throws without detection [3-KTX2].
5. **Transcode off the main thread.** The Basis transcoder is single-threaded and thread-safe, so slices decode in parallel across workers [BU]. three runs it in a `WorkerPool` (`setWorkerLimit`) and transfers buffers [3-KTX2]. One active KTX2Loader per app; more log a warning [3-KTX2].
6. **Decode images off-thread and generate mips on the GPU.** `createImageBitmap(blob)` decodes off-thread; `HTMLImageElement` decode can be synchronous in Chrome. Use `copyExternalImageToTexture`. WebGPU has no `generateMipmap`, so mips need a render or compute pass; compressed KTX2 should carry its mip chain [T-img].
7. **VRAM arithmetic.** A 4096² RGBA8 texture is 64 MiB, about 85 MiB with mips. KTX2 cuts VRAM 4–8x [U-100]. WebGPU exposes no VRAM budget: ◆ `memoryHeaps` sits behind the developer-features flag (Chrome 121) [C-121]. Texture budgets must therefore be per tier, chosen by the app.

### (f) Device loss, adapter selection, powerPreference, dual-GPU laptops

1. **Handle `device.lost`.** Attach the handler right after creation and never `await` it directly. `reason` is `'destroyed'` or `'unknown'`; never parse `message`. Recover by requesting a fresh adapter, then a device, then `context.configure()`, then re-uploading. Never cache adapters: since Chrome 140 "device requests consume adapter". A `null` adapter after a loss means "restart the browser" [T-dl][C-news].
2. **In three r186, use `renderer.onDeviceLost(info)`.** It is a public callback, wired from `device.lost` and skipped for `'destroyed'`. `renderer.onError` receives uncaptured errors (r185 #33418 surfaced WGSL diagnostics) [3-R][3-B][3-r185]. This beats reaching into `renderer.backend.device`, which both S1 and the site do.
3. ◆ **Chrome throttles repeated GPU crashes** [T-dl]:
   - A second crash within 2 minutes blocks that page's adapters until a reload.
   - Three crashes within 2 minutes block all pages for 2 minutes.
   - About 3–6 crashes in 5 minutes stop GPU-process recovery entirely.
   - Test with `device.destroy()`, which differs from a real loss, and with `about:gpucrash` in another tab. A crash-loop guard ("one downgrade, never a loop") is the right design.
4. ◆ **`isFallbackAdapter` moved.** It was removed from `GPUAdapter` in Chrome 140 and now lives on `adapter.info` / `device.adapterInfo` (136). Chrome ships no fallback adapters, so it is always false there [C-136]. ◆ The non-standard `adapterInfo.powerPreference` exists only behind the developer flag (137) [C-137].
5. ◆ **Windows (Chrome):** "Chrome uses the adapter allocated to its other workloads, usually integrated graphics on laptops. `powerPreference` has no effect on `requestAdapter()`." Multiple adapters cannot be used at once (crbug 329211593) [C-tr]. Remedies, all user-side:
   - Windows Settings > System > Display > Graphics: add `chrome.exe`, choose High performance, restart Chrome (the UI changed in 24H2; stored under `HKCU\Software\Microsoft\DirectX\UserGpuPreferences`) [PI] (search).
   - Or `chrome://flags/#force-high-performance-gpu` [C-tr].
   - A vendor control-panel per-app setting (search, older WebGL threads).
   - Since Chrome 80, WebGL's default `powerPreference` is low-power [KH80] (search).
   - Diagnose from `adapter.info` vendor and architecture and `chrome://gpu`.
6. ◆ **macOS (Chrome 115+):** on dual-GPU Macs with no `powerPreference`, Chrome returns the discrete GPU on AC power and the integrated one on battery [C-115]. `high-performance` is a strong hint, not a guarantee; Chrome may pick the low-power GPU on battery [T-cmp].
7. ◆ **Linux (Chrome):** WebGPU on by default for Intel Gen12+ (144) and NVIDIA driver 535.183.01+ on Wayland (147). Other GPUs need `--enable-unsafe-webgpu --ozone-platform=x11 --use-angle=vulkan --enable-features=Vulkan,VulkanFromANGLE` [G-impl][C-144][C-147-148]. WebGPU runs on Vulkan while the rest of Chromium stays on GL [C-144]. Hybrid laptops: Mesa `DRI_PRIME=1` or NVIDIA `__NV_PRIME_RENDER_OFFLOAD=1` (unverified here).
8. ◆ **Other browsers:**
   - Firefox: Windows in 141. macOS Apple Silicon in 145 on macOS 26, and on all macOS versions in 147 ⚑ (sources disagree; the official 147 notes say all versions [FF147]). Linux: Nightly only, "expected in 2026". Android: behind a flag [G-impl].
   - Safari 26: macOS, iOS, iPadOS, visionOS [G-impl].
   - Chrome Android: 121 (Android 12+, ARM, Qualcomm, Intel); Imagination on Android 16+ in 139 [G-impl].
9. ◆ **Compatibility mode (Chrome 146, GLES 3.1 and opt-in).** Request with `requestAdapter({featureLevel:'compatibility'})`; a core-capable device still returns core, but the app stays in compat limits unless it enables `core-features-and-limits` [C-146][C-136].
   - Restrictions include zero storage buffers and storage textures in the vertex stage (about 45% of old devices lack them), `textureBindingViewDimension` required, no cube arrays, 4096 maximum 2D texture size, and a 16 KB uniform binding [F-compat].
   - three r186 always requests `featureLevel:'compatibility'` plus every feature the adapter lists, so it gets core where available, then sets `compatibilityMode = !device.features.has('core-features-and-limits')` and `samples=0` when in compat [3-B].
   - Vertex pulling from storage buffers will not run on a compat device: gate it on the feature.
10. **Adapter options to pass.** three r186 passes `powerPreference` and `xrCompatible` from the parameters, and you can hand it your own `device` [3-B]. On Windows, a `high-performance` request does nothing for the dual-GPU case (item 5).

### (g) WebAssembly: threads, SIMD, SharedArrayBuffer, cross-origin isolation on a static host, streaming, where Wasm wins

1. **Threads need cross-origin isolation.** Wasm threads need shared `WebAssembly.Memory`, which requires `crossOriginIsolated`: `COOP: same-origin` plus `COEP: require-corp` or `credentialless` [WD-thr][M-sab][M-coep]. Without isolation, `postMessage` of a SharedArrayBuffer throws. `Atomics` is always present [M-sab].
2. **COEP rules.** `require-corp` blocks cross-origin no-cors subresources without CORP. `credentialless` loads them without cookies [M-coep]. ◆ `credentialless`: Chrome 96+, Firefox supported (version not confirmed here), Safari not supported (search) [WD-coi]. COOP `same-origin` severs `window.opener` and popups, which breaks OAuth-popup flows; cross-origin iframes need `allow="cross-origin-isolated"` [WD-coi]. Try `Cross-Origin-Embedder-Policy-Report-Only` first [WD-coi].
3. ◆ **Document-Isolation-Policy (Chrome 137, desktop only).** Values `isolate-and-require-corp` and `isolate-and-credentialless`, applied per frame, with no requirements on subframes or popups. Android was planned for later. It is still an HTTP header, and whether a service worker can supply it was not covered [C-dip].
4. **On GitHub Pages, which cannot set headers, the options are:**
   - **Service worker that synthesises the headers** [COI][GD]. It reloads the page on the first visit, must be a same-origin non-bundled file, uses `credentialless` by default and falls back to `require-corp` (`coepDegrade`). Godot's PWA export does the same ("Enable Cross Origin Isolation Headers") [GD]. Costs:
     - Safari has no `credentialless`, so it lands on `require-corp`, and every cross-origin asset (bucket, fonts, CDN) must send CORP or be fetched with CORS.
     - The extra reload.
     - The service worker sits in every fetch.
     - A hard reload bypasses the worker, so a non-threaded path must remain (unverified).
     - COOP breaks popups.
     - The site's own docs already rejected it because of its cross-origin assets.
   - **Host or proxy with header control** (Cloudflare Pages, Netlify `_headers`, or Cloudflare in front of Pages) (unverified here).
   - **Stay single-threaded:** several workers, each with its own Wasm instance, moving data by transfer. That is the site's current Rapier-in-worker design, and Godot's default since 4.3, which is "preferred … works better with stores and publishers … macOS and iOS" [GD].
5. **Ship builds per cohort.** Feature-detect with `WebAssembly.validate` probes (wasm-feature-detect) and ship SIMD, threads and baseline variants [WD-fd]. Fixed-width SIMD (`wasm2023` in Unity's terms) needs Chrome 91+, Firefox 89+, Safari 16.4+ [UN-ps] (search). ⚑ Relaxed SIMD support is inconsistent across sources; Chrome-first, others unclear (search).
6. **Thread pools.** Pre-spawn them (`PTHREAD_POOL_SIZE`). `pthread_join` on the main thread deadlocks because the worker never starts, so use `PROXY_TO_PTHREAD` or run the module in a worker. Rust needs `wasm-bindgen-rayon` with `await initThreadPool(n)` before parallel work. Squoosh measured 1.5–3x from threads, more with SIMD [WD-thr].
7. **Stream and cache compilation.** Use `instantiateStreaming`/`compileStreaming` with `Content-Type: application/wasm`. V8 caches compiled code only for modules of 128 KB or more, keyed by URL (a changed query string means a recompile). `304` keeps the cache and `200` replaces it. Compiled code is 5–7x the `.wasm` size [V8-cc] (2019; V8's dynamic tiering since may change when caching happens). Godot: GitHub Pages gzips on the fly; Brotli does better where offered [GD].
8. **Where Wasm beats JS:** predictable, no warm-up (Liftoff ran a blur in 381 ms against Ignition's 4,434 ms), no deopts, SIMD, hand-tuned kernels. **Where it doesn't:** idiomatic ports. Naive AssemblyScript ran 2.9–4.2x slower than JS TurboFan, and a binary heap was faster in JS than Rust [SU]. Boundary rules: pass pointers into linear memory and avoid JSON; memory never shrinks [S9]. The site's measured navsearch port (153.6 → 51.2 µs) is the right pattern: port only measured hot kernels.
9. **WebGPU from Wasm.** Prefer `writeBuffer` (no extra heap copy) [T-buf]. Chrome 127 improved WebAssembly interop [C-news]. The Emscripten `emdawnwebgpu` port is active (Chrome 145 notes) [C-145].
10. **Unity web, for comparison.** Multithreading covers native C/C++ and Burst; plain C# jobs stay on the main thread. Memory settings are `initialMemorySize`, `maximumMemorySize`, `memoryGrowthMode` and `linearMemoryGrowthStep` [UN-ps] (search).

### (h) Main thread: workers, OffscreenCanvas, transferables, scheduler.yield/postTask, long tasks

1. **Measure jank with Long Animation Frames.** ◆ LoAF shipped in Chrome 123 (not Firefox or Safari). It attributes a frame's blocking work, including many sub-50 ms tasks that the Long Tasks API misses. web-vitals v4 ties LoAF to INP [C-loaf] (search).
2. ◆ **Yield with `scheduler.yield()`.** Chrome and Edge 129, Firefox 142, not Safari. Its continuation runs ahead of other queued tasks (unlike `setTimeout`) and inherits `postTask` priority. Fall back to `setTimeout` or a polyfill [C-yield]. Slice loaders, BVH builds and material setup with it; three r184's `compileAsync` already yields [3-pr32984].
3. ◆ **OffscreenCanvas** (Chrome 69, Firefox 105, Safari 16.4): `transferControlToOffscreen()` lets a worker render with no main-thread jank. three needs stubbed `style.width`/`height`, input stays on the main thread, and DOM-dependent loaders need workarounds [WD-oc]. WebGPU pipelines can be created in workers [M-crpa]. ◆ WebGPU also runs in service and shared workers (Chrome 124) [C-news]. Trade-off: a large refactor for a React-driven HUD and router; best reserved for one heavy world.
4. **Move bulk data by transfer.** Transferables (ArrayBuffer, ImageBitmap, OffscreenCanvas) move without copies; SharedArrayBuffer is unavailable without isolation [M-sab]. Physics poses and decoded geometry should cross by transfer.
5. **Keep decoders off the main thread:**
   - three's meshopt decoder runs on the calling (main) thread unless `MeshoptDecoder.useWorkers(n)` was called; `decodeGltfBufferAsync` only wraps a promise. GLTFLoader uses `decodeGltfBufferAsync` when present [3-MO][3-GLTF][MO-js].
   - meshopt decodes at 1–3 GB/s with SIMD [MO-js] and 3–6 GB/s native [MO].
   - KTX2 transcodes in a WorkerPool [3-KTX2]. Images go through `createImageBitmap` [T-img].
6. **Keep simulation out of React.** Per-frame state outside React and out of `setState` in the frame loop; `startTransition` for expensive UI [S6][R3F].
7. **Render on demand** where nothing animates: `frameloop="demand"` plus `invalidate()` [R3F][S5].

### (i) three.js r17x–r18x `WebGPURenderer` specifics

1. **Version notes:**

   | release | change | source |
   |---|---|---|
   | r171 | `three/webgpu` entry; `setAnimationLoop` awaits `init()` | [U-100] |
   | r181 | Inspector added; `renderAsync`/`computeAsync` deprecated; `setResolution` → `setResolutionScale` | [U-100][3-Pass] |
   | r182 | `colorBufferType` → `outputBufferType`; PCFSoft deprecated | [3-R][U-100] |
   | r183 | reversed depth (#32967 and related); `PostProcessing` → `RenderPipeline`; shared BindGroup by hash; BatchedMesh per-instance opacity | [3-r183] |
   | r184 | non-blocking `compileAsync`; TSL 3x; `ReadbackBuffer`; Inspector Memory tab and Timeline, `forceWebGL`; "Dynamic Lights" (#33042); bundle reuse fix | [3-r184] |
   | r185 | `ClusteredLighting` (Forward+); descriptor caching; uncaptured errors and WGSL diagnostics; InstancedMesh in bundles; function nodes cached per backend (#33517); WebXR on WebGPU; overdraw view; `submit()` optimisation | [3-r185] |
   | r186 | `compileComputeAsync`; `SunLight` CSM; `DirectRenderPipeline`; `resetState()`; no MSAA on fullscreen passes; `batchIndirectIndex`; BundleGroup improvements; `compile()` supports node materials; tree-shaking | [3-r186] |

2. **`renderer.info`:**
   - `render.drawCalls`, `frameCalls`, `triangles`, `points`, `lines`, `timestamp` [3-Info].
   - `compute.frameCalls` and `compute.calls` [3-Info].
   - `memory.programs`/`programsSize`, which tracks shader programs, plus textures, attributes, storage and indirect attributes, `renderTargets`, `readbackBuffers`, `uniformBuffers`, `total` [3-Info].
   - `autoReset` (call `info.reset()` once a frame if false) [3-Info].
   - On WebGPU, `render.calls` counts `render()` invocations, not draws [U-100].
3. **Init order.** `render()` before `init()` throws. `hasFeature()` before init throws, although its JSDoc says it returns false ⚑. `hasFeatureAsync` is deprecated [3-R].
4. **Inspector** (`renderer.inspector = new Inspector()`, r181+): Memory tab and Timeline (a commands recorder) from r184, overdraw mode from r185 [3-r184][3-r185][U-100].
5. **Pipelines rebuild when the render-object key changes.** Material comparison was sped up in r184 (#33198, #33199) [3-r184]. Changing pipeline-relevant state (output colour space, tone mapping, samples, MRT layout, light set) creates new pipelines, so mutate uniforms, not structure (inference from [3-r184] #33187 and [3-pr32984]). Whether r184's Dynamic Lights avoids recompiles when lights are added or removed: check PR #33042.
6. **The WebGL 2 backend of `WebGPURenderer`.** BundleGroup brings no gain [3-BG]. Storage-buffer compute paths may not run (the site's own `CANNOT` list). Timestamps go through the WebGL query extension [U-100].
7. **GPU-resident building blocks in TSL:** `instancedArray`/storage buffers, `atomicAdd`, `textureStore`/storage textures (read/write in one pass from r183), `workgroupArray` with barriers, `geometry.setIndirect`, `IndirectStorageBufferAttribute`, `batchIndirectIndex` (r186) [U-100][3-r186].

### (j) Web engines and how they get performance on WebGPU/WebGL and WASM

- **Babylon.js:**
  - Snapshot rendering in STANDARD and FAST modes, WebGPU only, CPU-side gains [BJ-sr].
  - Non-compatibility mode: a bundle per sub-mesh per context, with counters to watch [BJ-ncm].
  - `performancePriority` modes; `freezeActiveMeshes`, `freezeWorldMatrix`, `material.freeze`, `blockMaterialDirtyMechanism`, `skipPointerMovePicking`; `EngineInstrumentation.captureGPUFrameTime` and `captureShaderCompilationTime`; `SceneInstrumentation.drawCallsCounter` [BJ-opt].
  - Native WGSL in `ShadersStoreWGSL` avoids the runtime GLSL→WGSL WASM converter's download and time [BJ-wgsl].
  - Frame Graph: experimental in v8, v1.0 in v9.0; the GPU picker is not yet compatible [BJ-fg] (search).
  - Does not adapt to devicePixelRatio by default [BJ-opt].
- **PlayCanvas:**
  - Clustered lighting is the default since 1.56, for omni and spot lights. Each frame the CPU fills a world-space 3D grid of light indices into a texture (8-bit indices, so 255 lights; 16-bit above that from 2.22). Shadows and cookies live in atlases. Disabling unused features shrinks shaders and compile time. It works on WebGL 2 because the grid is a texture [PC-cl].
  - WebGPU with fallback to WebGL; compute from 1.70 [PC-blog] (search).
  - Official agent skills [S7].
- **Unity web:**
  - WebGPU is experimental, WebGL 2 the default [UN-wgpu].
  - On WebGPU: no async compute, no dynamic resolution, no cubemap arrays, no synchronous readback (`AsyncGPUReadback` instead), no wave intrinsics or 16-bit native types, baked GI only, 16 textures a shader, and variant stripping for memory [UN-lim].
  - `targetFrameRate` on the web is rAF-bound and microstutters [UN-tfr].
  - Threads cover native C/C++ and Burst only [UN-perf][UN-ps] (search).
- **Godot 4.x web:**
  - Compatibility renderer on WebGL 2 only; no WebGPU yet [GD].
  - Single-threaded export is the default (4.3+); threads need COOP/COEP or the PWA service-worker headers [GD].
  - Sample-based Web Audio playback for low latency without threads [GD].
  - Ship `.wasm` as `application/wasm` and precompress [GD].
- **Bevy/wgpu:**
  - WebGPU path since 0.11 (2023), WebGL 2 the default in older builds [BV]; later status not re-verified.
  - wgpu do's: 1–5 submits a frame, `write_buffer` over temporary mapped buffers, bind groups ordered by frequency, no per-frame resource creation [WG].
  - The wasm32 target has no web threading without extra crates [WD-thr].
- **Needle Engine** (three.js-based):
  - Production builds auto-compress (KTX2 ETC1S/UASTC or WebP; Draco or meshopt), generate texture and mesh LODs, and progressively stream (`gltf-progressive`, usable in plain three.js) [ND-opt][ND-tex].
  - Rapier (about 2 MB of Wasm) loads only when colliders exist; post and MaterialX load only when used [ND-opt].
- **React Three Fiber / pmndrs** [R3F]:
  - `frameloop="demand"` and `invalidate()`.
  - Shared geometry and materials; `useLoader` caching.
  - `<instancedMesh>`; Drei `<Detailed distances>` for LOD.
  - Nested `<Suspense>` for low-then-high models.
  - `<PerformanceMonitor onIncline onDecline flipflops>`.
  - `performance={{min}}` with `regress()` during interaction, and adaptive DPR via `setDpr(devicePixelRatio * current)`.

### (k) AAA techniques that carry to the web: what is feasible in a browser today, and what three r18x has

WebGPU gaps, as of Chrome 156 notes:
- No bindless: only Dawn's `chromium_experimental_resource_table` prototype, with no spec [D-rt][C-next].
- No mesh shaders.
- Multi-draw indirect behind a flag [C-131].
- No 64-bit atomics, which Nanite-style software rasterisation needs [C-next].
- One queue, so no async compute (also absent in Unity's WebGPU path [UN-lim]).
- `timestamp-query` optional and quantized [C-121].
- Compat devices have no vertex-stage storage buffers [F-compat].
- `indirect-first-instance` is an optional feature (unverified per adapter).

Available:
- Compute, storage buffers and textures, atomics (32-bit), indirect draws, render bundles, subgroups (Chrome 134+), `shader-f16`, transient attachments [C-news].

1. **Frame graph** [FB-fg]. A graph of passes and resources lets features stay decoupled, culls unused passes, aliases transient memory (ESRAM on Xbox One), and simplifies async compute. *Web:* WebGPU has no heaps or aliasing, so "aliasing" means pooling textures with identical descriptors. Pass culling and transient attachments are available. *three r18x:* `RenderPipeline`/`PassNode` node graph (MRT, `setResolutionScale`, per-pass samples); `DirectRenderPipeline` (r186). *Babylon:* Frame Graph v1.0 [BJ-fg].
2. **Tiled and clustered shading** [AN11]. Battlefield 3 culled lights per screen tile in DX11 compute and shaded only those; motivated by forward-rendering permutations and light pre-pass cost. *Web:* compute available. *three:* `ClusteredLighting` (Forward+, r185) [3-r185]. PlayCanvas's CPU-filled 3D grid texture also runs on WebGL 2 [PC-cl].
3. **Physically based sky and atmosphere.** Frostbite: [HI16]. A scalable LUT version (transmittance, multi-scattering and sky-view LUTs, mobile to high-end PC) [HI20] (Epic/UE, cited separately). *Web:* small LUTs updated per frame or on sun change are cheap on iGPUs. The approach fits a TSL compute plus fragment pass. three core ships no Hillaire atmosphere as far as checked.
4. **Terrain and procedural virtual texturing** [TB3]. A heightfield with a runtime-generated mesh. Splatting is cached into a procedural virtual texture with prioritised, throttled updates; streaming; procedural decoration. *Web:* no sparse or tiled resources. A software VT (indirection texture plus page atlas, updated a few pages a frame) is feasible with `textureStore` but complex. A cheaper middle ground: bake splat composites into clipmap rings.
5. **LOD and clusters** [MO][ZX]. Build LODs with `meshopt_simplify` (`simplifyWithAttributes`, relative error) and pick by screen-space error. Order coarse LODs first in the index buffer.
   - Meshlets: `buildMeshlets` (64 vertices and 126 triangles for NVIDIA; 64/96 more achievable ⚑; JS caps at 256/512) [MO][MO-js].
   - Cluster cone culling rejected 13–32% of triangles in practice; per-triangle culling in the mesh shader about 50%. Without mesh shaders on the web, only cluster-level tests apply, done in compute [ZX].
   - The Frostbite GDC 2016 talk preprocessed and culled geometry in compute each frame to beat fixed-function triangle limits [WH16].
6. **GPU-driven rendering** [GDR][WH16]. Mesh clusters; per-cluster frustum, backface-cone and occlusion culling in compute; two-phase occlusion (test against last frame's depth pyramid, render, rebuild Hi-Z, re-test the culled set); compacted indirect args.
   - *Web:* all doable with compute plus `drawIndexedIndirect`, minus MDI. Do one indirect draw per material or vertex-layout bucket with vertex pulling, and pack every arg in one buffer [T-ind]. Keep those draws in a static bundle [T-rb].
   - Expect zero-instance draws for culled buckets; acceptable [T-rb].
   - *three r186:* `setIndirect`, `IndirectStorageBufferAttribute`, `instancedArray`, `atomicAdd`, `textureStore`, `batchIndirectIndex` [3-r186][U-100].
7. **Dynamic resolution and temporal upscaling** [WH17][KA14]. Karis's TAA (2014) became the de facto standard. Checkerboard rendering (BF1, ME:A) needed TAA and dynamic resolution integration. *Web:* `TAAUNode` + `setResolutionScale` + timestamp or frame-time control is the TSR analogue; `FSR1Node` is the spatial fallback when no velocity buffer exists or the frame is fragment-bound; `SharpenNode`; `TRAANode` at native [3-TAAU][3-FSR][3-TRAA]. ⚑ Unity's WebGPU path does not support dynamic resolution at all [UN-lim]. three users build it themselves.
8. **Shader permutations and PSO pre-warm** [UE-pso]. Precache at load, delay or fallback-draw, a loading screen that waits on outstanding compiles, miss telemetry, a 20 ms hitch threshold. *Web:* no app-visible pipeline cache API. The browser's disk cache warms second visits [W-spec][D-cache]. In three, `compileAsync(obj, cam, scene)` before `scene.add`, plus a per-frame pipeline-creation counter (WebGPU Inspector rule [S15]), approximates it. Babylon and Unity both cut permutations at source [BJ-wgsl][UN-lim].
9. **Streaming budgets.** Frostbite's terrain prioritises and throttles its virtual-texture work [TB3]; UE caps compile threads by memory [UE-pso]. *Web:* no VRAM query (`memoryHeaps` flag only) [C-121]. Budget per tier by count and bytes (`renderer.info.memory.texturesSize`, `total`) [3-Info]. Throttle uploads a frame (KTX2 transcodes, `writeTexture`) and load near-to-far.
10. **Precomputed GI as the cheap tier** [FLUX]. Star Wars Battlefront II used Flux: a CPU path tracer (Embree) baking SH lightmaps and irradiance volumes offline. Runtime cost is a texture fetch, which is why baked atlases and probe grids are the right weak-GPU tier on the web too.

### (l) Profiling and reverse engineering of game and web graphics

1. **`chrome://gpu`.** Confirm "WebGPU: Hardware accelerated" (not "Software only") and blocklist status; also shows which GPU is active [C-tr]. Flags:
   - `chrome://flags/#enable-unsafe-webgpu` (blocklisted or unsupported platforms, experimental features)
   - `#enable-webgpu-developer-features` (unquantized timestamps, full adapter strings, `memoryHeaps`, `adapterInfo.powerPreference`)
   - `#ignore-gpu-blocklist`
   - `#enable-vulkan` (Linux)
   - `#force-high-performance-gpu` (Windows) [C-tr][C-121][C-137]
2. **Chrome test helpers.** `about:gpucrash` exercises device loss [T-dl]. Running WebGPU in software (SwiftShader) for CI is a separate Chrome article (not read).
3. **PIX on Windows** [T-pix]:
   - Launch Chrome from PIX with `--disable-gpu-sandbox --disable-gpu-watchdog`, optionally `--enable-dawn-features=emit_hlsl_debug_symbols,disable_symbol_renaming`, and the PIX event DLL for `pushDebugGroup` labels.
   - You see the D3D12 translation, including barriers and compositor work, not WebGPU calls; the timing view shows per-pass GPU time.
   - This is where Dawn's hidden indirect-validation dispatches show up [T-ind].
4. **RenderDoc** [T-rdc]:
   - Windows D3D12 only, Chrome 144+.
   - Set `RENDERDOC_HOOK_EGL=0`, launch with `--no-sandbox --disable-gpu-sandbox --disable-direct-composition --gpu-startup-dialog --enable-dawn-features=enable_renderdoc_process_injection`, then inject into the GPU process by PID.
   - Every frame is captured; there is no on-demand trigger.
   - Xcode for macOS [T-xc].
5. **WebGPU Inspector** [WI]:
   - Chrome/Edge extension; Firefox Nightly; Safari TP is a work in progress.
   - Live objects, allocation plots, CPU-submit against GPU frame-time plots, a CPU- or GPU-bound verdict, frame capture (commands, state, buffers, pass outputs), recordings to HTML, live shader editing and a debugger.
   - The skill S15 encodes its analysis rules: setter-to-draw ratios, in-frame pipeline creation, tiny draws, load and store waste.
   - It is the WebGPU stand-in for Spector.js, which is WebGL-only (classic worlds) [SP].
6. **Tracing.** Perfetto (`ui.perfetto.dev`) and `chrome://tracing` record the GPU process; a blocked GPU main thread delays the display compositor's swap [CJ] (search). The `devtools.timeline` category and `v8.wasm` events confirm Wasm code-cache hits (`moduleCacheHit`) [V8-cc].
7. **three Inspector** (Memory, Timeline, overdraw) and `renderer.info` (`drawCalls`, `programs`, memory) give in-app counts; read them each frame [3-r184][3-r185][3-Info].
8. **Method** (S14, S7, S13, S2, S15):
   - Capture on the target hardware, with readback and debug instrumentation off.
   - Rank passes and draws by GPU time.
   - Halve the resolution: if time scales with pixels, the frame is fill- or fragment-bound; if it stays flat, it is vertex- or CPU-bound.
   - Change one thing, re-measure the same draw, keep before-and-after.
   - Report "NOT ASSESSED" where data is missing.
   - Rank fixes by gain and risk.
   - Mobile Fortnite still showed 10–30 PSO hitches a match, so measure hitches as a distribution (worst frames), not as an average [UE-pso].
9. **How AAA ports are profiled.** GPU captures in the platform tool (PIX for D3D12; RenderDoc; vendor counters, as in Meta's flow: per-draw clocks, then ISA and register pressure) [S14][T-pix]. Frostbite's own talks report per-pass GPU milliseconds as the unit of decision [WH16][WH17].
10. **What public Frostbite and Battlefront II material implies for a web port's budgets.** Only this was used; nothing about assets or extraction:
    - Consoles held a 60 fps target with dynamic resolution, far below native 4K on PS4 Pro [DF-bf2].
    - Lighting was largely precomputed (Flux SH lightmaps and irradiance volumes) [FLUX].
    - Terrain shading was cached and throttled [TB3].
    - Frostbite leaned on compute culling and a frame graph [WH16][FB-fg].
    - A browser on an iGPU has a fraction of a PS4 Pro's bandwidth, so the same tools (dynamic resolution, temporal upscaling, baked GI, cached terrain, GPU culling) are the requirement, not an option.

---

## 3. Implications for tilakpatell.com (cross-checked against the repo, read-only)

The site already does much of this: `requiredLimits`, `reversedDepthBuffer`, `compileAsync` with a 4 s settle, a pipeline guard that uses `scheduler.yield`, meshopt `useWorkers`, a KTX2 worker limit, `setResolutionScale`, `BundleGroup`, a timestamp ring, `isFallbackAdapter` read from `adapter.info` / `device.adapterInfo`, a single-downgrade device-loss policy, and Wasm via streaming with a SIMD probe. The gaps and risks:

1. **Measure CPU per world on both backends before porting** (⚑ c9). three r183 measured about 2x WebGLRenderer's per-object CPU cost and a 5x slower cold first frame. The gpuScene indirect plus bundle path is the route that dodges it; porting worlds 1:1 is not.
2. **Treat any pipeline created during play as a bug.** Count first-use pipelines a frame (the S15 rule) and precompile with `compileAsync(obj, cam, scene)` before `scene.add`. Verify that shadow-pass pipelines are warmed despite r186 #33924. Keep TSL graphs shallow because of #34434.
3. **Dual-GPU Windows laptops will run WebGPU on the iGPU whatever `powerPreference` says** (Chrome). Show `adapter.info` in the video settings and link the Windows Graphics setting. Tier from the measured probe, not the requested power mode.
4. **Weak-iGPU tier:**
   - `TAAUNode` at about 0.5–0.67 scale (or FSR1 where there is no velocity buffer).
   - `outputBufferType: UnsignedByteType` once the HDR chain allows it.
   - Transient MSAA and depth attachments, or MSAA off with TRAA.
   - Baked GI only, cascade caching.
   - Render on every 2nd rAF for an even 30 fps.
5. **Use `renderer.onDeviceLost` and `renderer.onError`** (public in r186) instead of watching `renderer.backend.device.lost`.
6. **Gate the storage-buffer vertex-pulling path on `core-features-and-limits`.** three requests compat first, so compat-only Android devices lack vertex-stage storage.
7. **Indirect args stay in one buffer** (Dawn validation cost scales with buffer count). MDI and bindless are not available, so keep one indirect draw per material bucket inside a static bundle.
8. **Wasm threads on GitHub Pages remain a poor trade.** Safari has no `credentialless` and the cross-origin bucket and fonts would need CORP. Keep the transfer-based workers. Document-Isolation-Policy (Chrome 137 desktop) or a header-capable host are the only clean routes.
9. **Use LoAF** (Chrome 123+) in the perf probe to attribute main-thread frames; `scheduler.yield` with a `setTimeout` fallback for Safari.
10. **For ETC1S/UASTC choice and per-chip transcode targets, trust three's KTX2Loader order.** Ship UASTC for normal and ORM maps, ETC1S for albedo. Budget VRAM per tier from `renderer.info.memory`, because WebGPU exposes no VRAM query.
