# Hand-off: GPU-first, Unreal’s methods under the Frostbite reconstruction

The design: `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md`. The research: `docs/research/2026-10-11-ue5-on-webgpu-gpu-first-renderer.md`. The decision: `docs/decisions/2026-10-11-every-visitors-own-gpu.md`. One plan a lane under `docs/superpowers/plans/2026-10-11-gpu-first-lane*.md`. The rules every lane keeps: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`.

The owner’s word, fixed on 2026-10-11: no engine switch, no pixel streaming, every visitor’s own GPU renders every frame; the game should feel like it streams in; it should look like an installed AAA game; implemented by Opus 5.5.

## Done (2026-10-11, the design session)

- Seven research notes and their synthesis (the research page): Unreal Engine 5 system by system and its WebGPU reconstruction, WebGPU in October 2026, three r186’s node renderer and TSL, Rapier and web physics, WebAssembly, the best 2025 to 2026 web titles, image quality. The repository audited the same day (the spec’s §2).
- The design (eight lanes) and a plan a lane, written against `origin/main` at `6e18a9c5` and lane T2’s branch.
- No code.

## The lanes

| lane | plan | what | starts | session | branch | PR |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | `…-laneG1-reference.md` | the GPU clock (`timestamp-query`), the renderer tier from a probe, the reference frames and FLIP scores, the variance column | now | `session_01LAx1qXT387hkeFARZ34j6d` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-g1-reference` | |
| N1 | `…-laneN1-gpu-scene.md` | the GPU scene: instances in a storage buffer, compute culling with the LOD cut and a depth pyramid, indirect draws a material group, bundles | now | `session_01LJWah8w91QsWaqjvBuukhu` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n1-scene` | |
| N2 | `…-laneN2-picture.md` | the dynamic-resolution controller on GPU time, sharpen after the upscaler, mip bias, velocity everywhere, reversed depth, specular anti-aliasing, the 30 fps cadence | now | `session_01C7wedSXsaKtR2ce8rN4e17` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n2-picture` | #917 (draft) |
| N3 | `…-laneN3-light.md` | the Enlighten atlases as the baked bounce, the budgeted probe grid, SSR’s roughness cut, cached far cascades over the far shadow cache | now | `session_018TWXtVyrnGi8eHtVLYkiwK` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n3-light` | |
| N4 | `…-laneN4-stream.md` | the coarse horizon grid first, the boot slice, priority by size along the heading, low mip first, UASTC data rows, the cache, the byte budgets | now | `session_01M3zvYcbcXu7nBwoLQTvyZ3` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n4-stream` | |
| N5 | `…-laneN5-sim.md` | Rapier in a worker behind the same face (off until measured), GPU debris on the depth buffer, particle lights in the clustered list | now | `session_012ehUtVgawMKAYhGQL7fUVS` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n5-sim` | |
| N6 | `…-laneN6-tiers.md` | the tier table, the iOS self-test, the phone preset, the settings line, every world on every tier | after G1, N1, N2 | | `claude/gpu-n6-tiers` | |
| N7 | `…-laneN7-clusters.md` | the cluster tier spike: meshlets, a visibility buffer, a compute rasteriser on `T2`; kept only where it pays | after N1, N6, on the laptop | | `claude/gpu-n7-clusters` | |

Each lane fills its row (session, PR) in its own PR and merges `origin/main` before it, keeping both sides.

## Lane N2: the stable picture (2026-10-11, `session_01C7wedSXsaKtR2ce8rN4e17`, #917)

**Done.**
- **The controller:** `src/runtime/dynres.js` carries Unreal’s constants, each with its `_source`. `quality.js` takes a source (`setSource('gpu' | 'cpu' | 'classic', { gpuTime, fps, tier, pixels })`), steps through `stepsAt`, the same list `headroomAt` reads, and feeds each of G1’s readings once. The runtime sets the source per world, never resizes the canvas from the GPU clock, and runs the 30 fps cadence (`cadence.js`, `loop.js`).
- **The chain:** sharpen after TAAU (not FSR1, which runs RCAS itself), and no multisampling under TRAA or TAAU (per chain, through `PassNode`’s `samples`). The mip bias follows the scale at the game material’s samples (`mipBias.js`, `compose.js`’s `biasedTexture`).
- **Reversed depth on a WebGPU device:** the screen-space passes get `1 − depth` in R32F, and TRAA and TAAU get the raw buffer.
- **Velocity:** the particles write the still velocity (`light/velocity.js`); three r186 already covers matrices, instancing, batching and skinning. `--trails` is on the lit fixture.
- **Specular anti-aliasing** on the shaded normal (`compose.js`’s `specularAA`).
- **Evidence:** `docs/superpowers/evidence/gpu-first/N2/README.md`, with the plan’s corrections listed there.

**Left.**
1. When G1 merges: `gpuClock: (renderer) => createGpuTime(renderer)` in `src/runtime/index.js` (one line). The runtime already reads `rt.tier` for T0. G1’s `webgpu.js` also turns its `makeGfx` into `const gfx`, as N2’s does: keep both sides (G1’s `jitter`, N2’s `reversedDepth`).
2. When T2 merges: its `surface/nodes/chain.js` calls `headroom()` and `lowerQuality(level)` as before. The sharpen and the samples rule come through `post.js`’s `arrange` and `passes.js` with no call of their own. Check that the chain reads `quality.internal` if it shows the scale.
3. The laptop table in N2’s README (the fixture on both legs at both sizes, `battlefront-check` at ultra on WebGPU). Whether the GPU clock should lift the 4K start (0.77 on ultra) back to 1 is that table’s to say.
4. The particles’ trail on a real chip (`--particles` with the pan, under TRAA).

**Checking it.**
- `npx vitest run src/runtime src/lib/three/light src/lib/three/surface src/lib/three/particles src/lib/three/loop.test.js src/lib/three/mipBias.test.js`
- `node scripts/light-fixture.mjs --tier ultra --post on --upscale taau:0.77 --size 800x450 --legs webgl --evidence gpu-first/N2` (the pass list ends `upscale sharpen output`; bias −1.377)
- `node scripts/light-fixture.mjs --trails --tier ultra --post on --size 800x450 --legs webgl` (trail-free: yes)
- `--shadows --reversed off|on` (PSNR ≥ 40 dB on every view)

## What the other work must know

- **Lane T2** (`claude/bf2017-t2-flip`): every lane here builds on the lit fixture and the `battlefront` world until T2 lands, then wires into `surface/nodes/stack.js` by one call each (N2: `post.js` and `quality.js`; N3: `createBaked`, the grid’s budget, the sun’s cadence). Nothing here edits `stack.js` before T2 merges.
- **Lane U2** (headroom on): N1 adds a third level path (`gpuScene: true`) beside lane U’s batched one and changes neither; N2 replaces the pace’s input, not `headroom()`’s face. Whichever merges second reconciles `map/level.js`’s call.
- **Lane D2** (every detail): N4 adds `uastc`, `horizon` and (N3) `enlighten`, `farShadow` rows beside D2’s in `scripts/lib/bf2017-level.mjs`.
- **Lane M2** (materials): N2 adds specular anti-aliasing and the mip-bias uniform as nodes in `compose.js`; N3 adds the baked term. M2’s branches untouched.
- **Lane W** (the desktop): this design asks W for two more jobs: the impostor bake at full quality (N4) and the UASTC data rows (N4); N3 consumes the `atlases` job.
- **Lane X2**: N5’s worker loads Rapier through `src/lib/wasm/load.js`.

## Left, in order

1. The six lanes that start now were spawned on 2026-10-11 at 07:10 UTC (the table); each opens a draft PR and fills its row.
2. N6 when G1, N1 and N2 are on `main`; N7 when N1 and N6 are, on the owner’s laptop.
3. The owner’s open questions (the spec’s §9): the egress line (R2 in front of the bucket, or the budget rows alone), the phone’s 30 fps default, when N7 runs, which worlds the gallery pairs with the game’s frames first.
4. After the eight: the lane the spec names as “after M2”: a generated translation of the game’s shader graphs from the depots where the records allow.

## Checking it

- The gates, every lane: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && npm run coverage:bf2017 && npm run maps:bf2017`; the seventeen worlds at high on `nodes-webgl` in software GL (`BUDGET=1 QUALITY=high SCANS=game node scripts/galaxy-check.mjs surface <world>`); `node scripts/gpu-parity.mjs <route>` on the routes a lane touches.
- The laptop (RTX 5090, Edge, `ANGLE=d3d11`, 1,600 × 900 and 3,840 × 2,160, both legs): each lane’s own table; `scripts/galaxy-budget.mjs` (ultra p95 under 16.7 ms); `scripts/frame-score.mjs` against G1’s references under `docs/superpowers/evidence/gpu-first/reference/`.
- Evidence: `docs/superpowers/evidence/gpu-first/<lane>/README.md`, every number with `_source`.
- Gotchas: the cloud’s SwiftShader has no usable WebGPU device (the webgpu leg is the laptop’s); Chrome quantises `timestamp-query` to 100 µs; `BatchedMesh` culls on the CPU and `IndirectStorageBufferAttribute` is the indirect path; `renderObject.getIndirect()` and `storage().toAttribute()` are inside three’s face and may move on an upgrade (N1 wraps them in `gpuScene/three.js`).
