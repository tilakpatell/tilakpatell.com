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
| N2 | `…-laneN2-picture.md` | the dynamic-resolution controller on GPU time, sharpen after the upscaler, mip bias, velocity everywhere, reversed depth, specular anti-aliasing, the 30 fps cadence | now | `session_01C7wedSXsaKtR2ce8rN4e17` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n2-picture` | |
| N3 | `…-laneN3-light.md` | the Enlighten atlases as the baked bounce, the budgeted probe grid, SSR’s roughness cut, cached far cascades over the far shadow cache | now | `session_018TWXtVyrnGi8eHtVLYkiwK` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n3-light` | |
| N4 | `…-laneN4-stream.md` | the coarse horizon grid first, the boot slice, priority by size along the heading, low mip first, UASTC data rows, the cache, the byte budgets | now | `session_01M3zvYcbcXu7nBwoLQTvyZ3` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n4-stream` | #918 (draft): the grid, the stream, low mip first, the cache and the rows in; Hoth measured in software GL (`docs/superpowers/evidence/gpu-first/n4/`); the laptop’s gate and lane W’s two jobs left |
| N5 | `…-laneN5-sim.md` | Rapier in a worker behind the same face (off until measured), GPU debris on the depth buffer, particle lights in the clustered list | now | `session_012ehUtVgawMKAYhGQL7fUVS` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n5-sim` | |
| N6 | `…-laneN6-tiers.md` | the tier table, the iOS self-test, the phone preset, the settings line, every world on every tier | after G1, N1, N2 | | `claude/gpu-n6-tiers` | |
| N7 | `…-laneN7-clusters.md` | the cluster tier spike: meshlets, a visibility buffer, a compute rasteriser on `T2`; kept only where it pays | after N1, N6, on the laptop | | `claude/gpu-n7-clusters` | |

Each lane fills its row (session, PR) in its own PR and merges `origin/main` before it, keeping both sides.

## Lane N4: the stream that feels like one (`claude/gpu-n4-stream`, #918)

**Done.** `scripts/bf2017-horizon.mjs` writes each pack’s coarse grid (`horizon/`: 512 m cells of merged last LODs, 12,000 triangles, 4,000 in the `.lo` cut low and mid take; octahedral impostor atlases, 16 × 16 views, baked by `scripts/impostors.mjs`), Hoth’s committed (65 cells, 3.06 MB; two impostors, 3.58 MB at 2,048) and named by `level.json`’s `coarse` row, which the pack builder keeps while the far list is the same (`keepRows`). One fetch queue a level (`levelQueue.js`: coarse, boot, cell, detail, prefetch; ranked by projected size × a heading weight, `src/lib/level/priority.js`; the site pool’s size and timeout). `levelStream.js` fetches the grid first, then the far list and the boot slice (`ready()` once it is in or `bootMB` is pulled), then the rest; two cells beyond the mid ring ahead prefetched, dropped at the queue on a turn. The loader fetches every map at its smallest row and swaps the tier’s into the same texture (`swapInto`), a promotion for a cell no longer shown kept and not uploaded; a `.uastc` row on mid and up where listed and the chip transcodes it. `levelCoarse.js` draws the grid (impostors on the node renderer only, `lib/three/impostor.js`, TSL) and hides a cell once the fine path has its meshes. `BUDGET_ROWS` gain `bootMB` (3, 6, 12, 12) and `visitMB` (40, 120, 400, 1,200); past `visitMB` the detail waits and the surface’s toast says so (`hud.js`’s `detailToast`). `public/sw.js` keeps the played world’s hashed files, 400 MB in all, least recently played going first. `galaxy-check --bytes`.

**Left.**
1. The laptop’s gate: `BUDGET=1 QUALITY=high ANGLE=d3d11 node scripts/galaxy-check.mjs surface hoth --bytes` on a production build (walkable under 10 s at 20 Mbit/s; the cloud’s times are SwiftShader’s), and the parity shots at the coarse-to-fine swap; the impostors’ blend judged on a real chip.
2. Lane W, the impostor bake at full quality: one dispatch once #918 is on main, `gh workflow run bf2017-desktop.yml -f job=horizon` (`scripts/desktop/bf2017-horizon.mjs`): the ten surface packs baked with ANGLE d3d11 and their `horizon/` published by hash with the runner’s key, `level.json`’s `coarse` row and `horizon/index.json` committed in its pull request. `-f dry=true` shows the plan on GitHub’s runner (ten packs, 106 arena cells, 31 impostor meshes).
3. Lane W, the UASTC data rows: not needed (every data map is UASTC already). What is left of it is lane W’s existing `uastc` job for the ETC1S colour maps (335 of 1,074).
4. BC5 or EAC RG11 for two-channel normals: three r186’s KTX2Loader has no such target; a patched transcoder worker, if FLIP on the laptop says the BC7 path loses.
5. The splat vistas (the plan’s addendum): one spike after N4 lands.
6. The owner’s egress question (the spec’s §9, 1): the budget rows hold a visit; R2 in front of the bucket is the hedge (`docs/stack/supabase.md`).

**Checking it.** `npx vitest run src/components/galaxy/surface/level src/lib/level src/lib/sw.test.js src/lib/swWorker.test.js src/lib/budgets.test.js src/lib/three/impostor.test.js scripts/lib/bf2017-horizon.test.mjs scripts/lib/impostor-layout.test.mjs scripts/lib/horizon-merge.test.mjs`; the evidence README’s runs. In the cloud, serve the pack from disk (the bucket resets HTTP/2 streams from the container); a frame of Hoth in SwiftShader is 14 to 38 s, so pass `SHOT_WAIT=900000` and read the times as the renderer’s.

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
