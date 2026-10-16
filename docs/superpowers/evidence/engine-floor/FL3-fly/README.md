# FL3 /fly: the planet flight on the node renderer

Lane FL3 of the engine floor (`docs/superpowers/specs/2026-10-15-engine-floor-design.md`, §4.4) for `/fly/:planet?` (`src/components/expanse/flight/module.js`), started from lane P1’s `claude/perf-p1-fly` with `claude/engine-floor-spec` and `origin/main` merged in. Everything here was measured in the cloud container (4 cores, Chromium 1194, SwiftShader for WebGL; no WebGPU device), 2026-10-15 and 16.

**The WebGPU rows are empty on purpose**: the container has no WebGPU device (Dawn loses the SwiftShader adapter’s device; `scripts/gpu-parity/README.md`). They are the owner’s laptop’s (Radeon 740M) and desktop’s (RTX 5090), never estimated.

## The closure

`node docs/superpowers/evidence/perf/tools/glsl-closure.mjs src/components/expanse/flight/module.js`:

| | files reached | with GLSL |
| --- | --- | --- |
| `origin/main` (`f97079c7`…, the flight `'glsl'`) | 296 | 13: `expanse/flight/ground.js`, `expanse/flight/scene.js`, `lib/three/{recolour,puffs,wind,foliage,groundLook,groundmap,core,house}.js`, `galaxy/surface/props/{shaders,windows}.js`, `galaxy/surface/weather.js` |
| this branch (the flight `'nodes'`) | 292 | **0** |

`src/runtime/shading.test.js`: 11 passed.

`node scripts/health.mjs --only glsl-sites`: **619 → 617**. The lane asked for 14 down; 2 is all a port can take without breaking the twins’ rule. The eleven shared originals the flight left (`lib/three/*`, `galaxy/surface/*`) are still drawn by other `'glsl'` worlds and are never edited or deleted while one reaches them (lane T; FL4 deletes them all at once). The flight’s own two sites (the sky dome’s `ShaderMaterial`, the city’s `onBeforeCompile`) lane P1 had moved into `flight/glsl.js`, so the count had not moved; that file draws nothing on the site and now sits beside its parity case (`scripts/twin-parity/cases/flightGlsl.js`, on the flight’s island), out of `src/`.

## The twins

`node scripts/twin-parity.mjs <case>` (the node side on WebGL 2; the line: 32 dB and under 2 % of pixels off by more than 16/255):

| case | twin | before (P1) | after | what was wrong |
| --- | --- | --- | --- | --- |
| `flight:sky` | `flight/nodes.js` `skyDome` | 52.5 dB, 0 % | 52.5 dB, 0 % | (through a pass that tone-maps the whole frame on both sides) |
| `flight:sky:direct` (new) | the same, drawn as the flight draws it | 21.9 dB, 100 % | **69.9 dB, 0 %** | the GLSL dome has no tone-mapping chunk, so the classic renderer sends it out untoned; the node renderer tone-maps the whole frame in its framebuffer pass and hears no `toneMapped = false`. `lib/three/untoneNodes.js` runs three’s Neutral backwards on the dome’s colour where the renderer has Neutral |
| `flight:city` | `flight/nodes.js` `cityMaterial` | 20.9 dB, 2.58 %, console errors | **59.8 dB, 0 %**, no errors | the hash’s `p += dot(p, p + 45.32)` was an `addAssign` outside an `Fn`: TSL has no stack there, says so and drops it, so no window ever lit |
| `groundLook`, `:map`, `:splat` | `lib/three/groundLookNodes.js` | | 53.6, 54.5, 53.6 dB, 0 % | |
| `house` | `lib/three/houseNodes.js` | | 54.4 dB, 0 % | |
| `core`, `foliage`, `puffs`, `recolour` | `lib/three/*Nodes.js` | | 61.4, 65.7, 64.5, 66.3 dB, 0 % | |
| `surface:weather:snow`, `:rain`, `:sand` | `galaxy/surface/nodes/weather.js` | | 47.5 dB 0.06 %, 71.6 dB 0 %, 43.0 dB 0.08 % | |
| `surface:windows` | `galaxy/surface/nodes/props.js` | | 58.7 dB, 0 % | |

## The world

`node scripts/gpu-parity.mjs /fly/hoth --before fl3-before --view start,poi`, then `--view start,poi` on the branch. The before-ref is `origin/main` with only the flight’s development views added (`b9e66d53`, kept as the local branch `fl3-before`; the patch is `module.js`’s `if (import.meta.env.DEV)` block on this branch, `poi` and `start`, and the `held` step): the pictures are the classic renderer’s.

| view | leg | P1’s branch | this branch | result |
| --- | --- | --- | --- | --- |
| `start` (where the flight begins) | webgl (`nodes-webgl`) | 29.11 dB, 16.65 % off | **36.80 dB, 1.91 % off** | pass |
| `poi` (parked 900 m short of the first place) | webgl (`nodes-webgl`) | | **47.76 dB, 0.16 % off** | pass |
| both | webgpu | | | skipped: no WebGPU device in the container (the owner’s machines) |

What is left at `start` is the far, fogged ridges, brighter on the node renderer: the classic renderer applies the house’s fog after tone mapping (`fog_fragment` follows `tonemapping_fragment`), the node renderer tone-maps the fogged colour at the end. The fix is in `lib/three/houseNodes.js`’s fog hook, a file every node world shares; it is not this lane’s, and is the house’s owner’s to weigh (it would move every node world’s far fog).

## The frame

The addendum’s rule: no slower on `nodes-webgl` than on `webgl` (the classic renderer) at Low and High, on the main thread’s median and the worst 1 %.

**What the container can and cannot say.** Its WebGL is SwiftShader: the GPU process runs far behind, so a GL call’s time on the main thread is mostly the wait for it (the probe’s main-thread median at 1470 × 956 was 2.6 ms classic against 3,613 ms nodes at High, the node side’s calls blocking on a swamped GPU process), and the runtime’s cadence draws a slow software frame only every other rAF on one side and every one on the other. So the frame here is measured by what the browser cannot blur: the GL calls a render asks of the driver, the draws, and the JavaScript a render with the GL calls’ own time taken out, at the parity view held still (`tools/gl-calls.mjs`, `tools/gl-ab.sh`: three rounds, interleaved, 480 × 300). The probe’s own table is below it, at the same small window, for its shape only.

### Before the rebuild (lane P1’s port, the twins fixed)

| Low, `view('start')` | classic (`webgl`) | nodes (`nodes-webgl`) |
| --- | --- | --- |
| draws a render | 142 | 216 |
| GL calls a render | 627 | 1,480 |
| GL calls a draw | 4.4 | 6.9 (a uniform block bound and its textures bound again a draw) |
| JavaScript a render | 2.33 ms | 3.89 ms |

`tools/fly-census.mjs` (the graph at play, Low): 404 objects; the ground 132 leaf meshes; the three POIs at the start (Echo Base, the trench, the ion cannon) 235 objects and 146 meshes, all but four still once placed. The node renderer pays per object drawn, so the rebuild cuts objects:

1. **The POIs’ still meshes merged a material at a time** (`flight/landmarkMerge.js`): watched for a second after the landmark is in, what stood still is baked into one geometry a material in the landmark’s frame. Left alone: what moved, what is under a `LOD` or hidden, transparent or mirrored meshes, and a material with a hook that reads the object’s frame. 216 → 129 draws, 1,480 → 811 calls, JS 3.89 → 3.40 ms.
2. **The ground’s leaves one `BatchedMesh`** (`flight/leafBatch.js`): a slot a leaf, reused as the ground streams, a full batch made again twice the size (never resized in place: three’s batch node keeps the matrix texture it was built with). 129 → 72 draws, 811 → 577 calls, JS 3.40 → 2.84 ms.
3. A `BundleGroup` round the ground and the POIs was not built: three r186’s WebGL backend has no `beginBundle` (a bundle is a plain group there, on the leg the container gates), and a bundle replays the cull it was recorded with, which under a camera that flies would leave the ground it culled undrawn. The scatter through the GPU scene was not built either: the flight’s clutter is already one instanced pool a kind (`lib/three/pool.js`, 7 draws).

### After

FRAME_TABLES

## The checks

`npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` (within budget), `node scripts/flight-island.mjs --check` (ok: 158 files, 39 marked rows). Under the full suite’s load in the container five whole-repo tests ran out of time (the secret scan, the conflict-marker scan, the galaxy’s models, the physics engine, the landings’ physics); each passed run alone.

## The tools

- `tools/gl-calls.mjs [planet]`: the GL calls, draws and JavaScript a render at `view('start')` (`QUALITY`, `FRAMES`, `PROFILE=1` for the JavaScript by function, `DRAWN=1` for what draws by subtree, `LEAVES=1` for the batch’s leaves and any overlap, `SHOT=` for a picture, `VIEW=` for the window).
- `tools/gl-ab.sh <classic> <nodes> <out.jsonl> [rounds] [qualities]`: the same, interleaved, a JSON line a run.
- `tools/fly-census.mjs [planet]`: the scene graph by subtree, the POIs’ moving meshes and their materials.
- `tools/ab.sh`: the probe’s fly journey, interleaved (what it can say in the container: above).
