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
| N3 | `…-laneN3-light.md` | the Enlighten atlases as the baked bounce, the budgeted probe grid, SSR’s roughness cut, cached far cascades over the far shadow cache | now | `session_018TWXtVyrnGi8eHtVLYkiwK` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n3-light` | #921 (draft) |
| N4 | `…-laneN4-stream.md` | the coarse horizon grid first, the boot slice, priority by size along the heading, low mip first, UASTC data rows, the cache, the byte budgets | now | `session_01M3zvYcbcXu7nBwoLQTvyZ3` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n4-stream` | |
| N5 | `…-laneN5-sim.md` | Rapier in a worker behind the same face (off until measured), GPU debris on the depth buffer, particle lights in the clustered list | now | `session_012ehUtVgawMKAYhGQL7fUVS` (Opus 5.5, spawned 2026-10-11 07:10 UTC) | `claude/gpu-n5-sim` | |
| N6 | `…-laneN6-tiers.md` | the tier table, the iOS self-test, the phone preset, the settings line, every world on every tier | after G1, N1, N2 | | `claude/gpu-n6-tiers` | |
| N7 | `…-laneN7-clusters.md` | the cluster tier spike: meshlets, a visibility buffer, a compute rasteriser on `T2`; kept only where it pays | after N1, N6, on the laptop | | `claude/gpu-n7-clusters` | |

Each lane fills its row (session, PR) in its own PR and merges `origin/main` before it, keeping both sides.

## Lane N3 (2026-10-11): three distances of light

**Done** (branch `claude/gpu-n3-light`, draft PR #921):
- `src/lib/three/light/baked.js`: an atlas on `TEXCOORD_1` as the game material’s diffuse indirect light, directional through the three per-channel direction maps (`dirR`, `dirG`, `dirB`: the export’s names, one map a colour channel), scaled by lane S’s `gameToSite`; wired by wrapping the material’s lighting model (`withBaked`), not M2’s branches; `compose.js`’s one term, `indirectDiffuse`. Rows on either of the spec’s §11 roads: `charts: 'game' | 'site'` with `rects` per mesh. A mesh without `TEXCOORD_1`, or without a chart, keeps the probe term; a level with no rows keeps today’s probes. `levelGltf.js` takes `baked` (and `loader.atlas(path)` loads its maps); the pack’s `enlighten` rows come from `scripts/lib/bf2017-level-light.mjs` (re-exported by `bf2017-level.mjs`, D2’s rows untouched) and `bf2017-level-parts.mjs` copies the maps. The far shadow’s row is E0’s `shadowCache`, already written: no second row.
- `probes.js`: the budgeted grid, 8 m and 32 m cascades round the player, each a front and back `LightProbeGrid`, the back re-rendered a few probes a frame (r186’s ranged bake), crossfaded in over `FADE`; the budget (`createBudget`) is coded against lane G1’s `gpuTime` face with a test double.
- `sun.js`: the cadence (near cascades every frame, far every fourth, staggered; at once on a tracked body entering, the view passing the map’s slack, or the shadow sun turning); `track(object)`. `shadows.js`: the far cache, the level’s 16-bit distant shadow map marched past the last cascade. `apply.js` takes `cadence` and `farCache`.
- `post.js` and `passes.js`: SSR only under roughness 0.4 (r186’s `SSRNode` has no cut: its metalness is masked).
- `scripts/desktop/bf2017-lightmaps.mjs --dry`: lane W’s `lightmaps` job’s cloud road, the fixture’s 256² stand-in atlas.
- The fixture: `--baked`, `--grid` (the budgeted pass), `--shadows --cadence`; evidence in `docs/superpowers/evidence/gpu-first/N3/README.md`.

**Left:**
- **Which levels light up as lane W uploads: none yet.** The game’s atlases cannot be read without each instance’s chart (never exported; Hoth’s props have one uv set), so a level lights up only when lane Q3’s probe finds the charts (the `game` road) or lane W’s `lightmaps` job bakes it (the `site` road). The second road’s level bake needs `three-gpu-pathtracer`, which this lane did not add: the owner’s standing rule is no new npm dependency without their word. **Owner’s decision**: add it (then `docs/stack/pathtracer.md` and the census first, then the level road in `bf2017-lightmaps.mjs`).
- Per-instance rects: the pack’s instances share one material a mesh, so a per-instance `uvRect` (the game road) needs an instance attribute in `levelScene.js`; `baked.js` takes a chart a mesh today.
- The far cache’s two assumptions (a top-down height field; its rows along the box’s forward axis) are not in the record: the laptop checks them on Hoth’s `shadow/far.png` (`depthConvention` reads which end is the top from the map itself).
- Lane T2’s `stack.js`, when it lands: one call each, `createBaked` (over `level.json`’s `enlighten`, `loadTexture: loader.atlas`, `calibrate(record)`), `createProbeGrid(…, { budget: { gpuTime } })`, `applyGameLight(…, { cadence: true, farCache: await createFarCache(farShadowOf(level), …) })`, and `track` on the figures and vehicles.
- The stand-in atlas lands 24 % under lane S’s band (its sky level counts only the hemisphere light, while the atlas replaces the environment’s diffuse too): judged again on a real bake.
- The laptop’s table (README’s last section).

**Checking it:** `npx vitest run src/lib/three/light scripts/lib/bf2017-level-light.test.mjs scripts/lib/enlighten-fixture.test.mjs src/components/galaxy/surface/level/levelGltf.test.js`; `node scripts/light-fixture.mjs --hoth --baked --legs webgl`, `--grid`, `--shadows --cadence --legs webgl`.

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
