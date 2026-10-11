# Every visitor’s own GPU renders the game; Unreal’s methods are rebuilt on three’s WebGPU renderer

Date: 2026-10-11. Design: `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md`. Research: `docs/research/2026-10-11-ue5-on-webgpu-gpu-first-renderer.md`.

## Context

The owner asked for AAA quality (“how a packaged, installed AAA game would look”) on the Battlefront II (2017) reconstruction, and weighed, over one conversation, four roads: an engine (Unity 6.6, Godot 4.6, Unreal through a third party), an engine compiled to WebAssembly (the RAGE port: a 63 MB binary, memory64, threads, a 740 MB boot slice and Range requests, Direct3D replayed on WebGPU), pixel streaming from the owner’s GPU (lane R2’s spike), and Unreal Engine 5’s techniques rebuilt on three r186’s node renderer. Measured on the day: three’s per-object path costs 29 ms for 5,000 meshes against 7 ms on the classic renderer (issue #30560), so the draw path, not the backend, is the frame; the Battlefront’s CPU step is 0.5 ms a frame (lane X2); WebGPU reaches 83 to 88 % of visitors; GitHub Pages cannot set the headers threads need and Safari lacks `credentialless`; there is no Frostbite source to compile; Godot’s web export is WebGL 2 only; Supabase Pro includes 250 GB of cached egress a month.

## Decision

Every visitor’s own GPU renders every frame, in their browser, through three’s `WebGPURenderer` and TSL, with the node renderer over WebGL 2 as the reduced tier. No engine is added; nothing is compiled from a game engine; nothing is streamed as video from the owner’s machine. Unreal Engine 5’s systems are rebuilt where WebGPU allows (GPU-driven culling and indirect draws; temporal upscaling under a GPU-time controller; three distances of indirect light; cached cascades; two-grid streaming; GPU effects split from CPU physics), each as a lane with a measured before and after on the owner’s laptop, each falling back by data. The world streams in while the visitor plays, from Supabase Storage as many small hashed files, never a Range request into one file.

## Consequences

- The picture stays the game’s (Frostbite’s records say what to draw); the frame time comes from the GPU-driven path, not from a smaller picture.
- The quality a visitor sees is their chip’s: a renderer tier from a probe and the adapter’s features, the quality levels still theirs.
- Threads stay off; Rapier stays on the main thread until a step is measured over 2 ms a frame; WebAssembly ports only where a number says so.
- The egress line is the budget rows’; Cloudflare R2 is the hedge if the bucket’s bill climbs.
- Lane R2’s stream stays a spike with its numbers; it is not the way the site works.

## Revisit when

- WebGPU ships 64-bit atomics, multi-draw-indirect or bindless in stable browsers (the cluster tier and the material groups get cheaper).
- GitHub Pages sets response headers, or Safari ships `credentialless` (threads become possible).
- three’s per-object path is fixed (#30560) or the node renderer becomes the default export.
- A measured step passes 2 ms a frame (the physics worker turns on).
- The owner wants the streamed ultra after all (lane R2’s numbers decide it).
