# Every chip plays: no hang on integrated graphics, no dead page after a loss, no long wait to get in

**Date:** 2026-10-13 · **Status:** approved by the owner the same day (“yes approved, write the spec and build it”) · **Branch:** `claude/charming-rubin-k3iubw`

## Why

The owner played Hoth (`/battlefront/hoth?from=/galaxy/hoth`) on a work laptop, a Ryzen 5 with its integrated Radeon 740M and 32 GB, in Edge on Windows. The GPU hung (`DXGI_ERROR_DEVICE_HUNG`, “WebGPU Device Lost”), nineteen TSL warnings came before it, and nothing came back. With Low picked by hand the game still took a very long time to get into. At home the same site runs on an RTX 5090.

The owner’s words: the site is GPU-driven wherever there is a chip, integrated or discrete; a laptop with a weak chip, or with none, is put on **Low by Auto**; “playable means 30–60 fps, ideally closer to 60”, throughout the game; and nobody waits for eons to get in.

## What was found

Read in the code and measured on the branch’s base (`1a471eee`), the production build with the live asset base, in headless Chromium:

1. **The renderer tier is decided and then not used.** `lib/gpuProbe` gives a chip `T0` (integrated or weak: the probe scene over 8 ms) or `T1`/`T2`, but only the loop’s cadence reads it (`runtime/cadence.js`). `lib/device` grades the chip by its WebGL name: “AMD Radeon(TM) 740M Graphics” scores 40 (`lib/gpuGrade`, under `GRADE_AT.high`, 50), which Auto turns into the High level: SSGI, SSR, volumetrics, TRAA, four cascades at 2,048, and GPU-first lane N1’s compute-culled level. On a chip with four compute units that is several hundred milliseconds a frame, and Windows resets a GPU that does not answer within two seconds.
2. **A lost device leaves a dead page.** `runtime.lost()` sets the status to `'lost'`; the Battlefront page has no state for it, and `lostWebGPU` lives in memory only, so a reload goes straight back to WebGPU and can hang the chip again. A loss while a world is still being made fails it (`place()` reads a canvas from a renderer that is gone). Reproduced in the container: the WebGL 2 context went at 5.8 s (the container’s software GL cannot share a video frame’s image, a quirk of its own) and no world came back in 600 s.
3. **A level picked while a world is up does not reach it.** `quality.retune(level)` swaps the budget row but never `quality.tier`, which Battlefront reads for its chain, its level cut, its boot budget and its fetch pool. Low picked mid-visit and the world reloaded from the settings panel still builds High’s level: reach 1,000 m for a 1 m thing against Low’s 35 m, a 12 MB boot against 3 MB.
4. **Low fetches with half the pool.** `lib/net/assetFetch.js`’s `poolSize` gives 4 at Low and Mid, 6 at High, 8 at Ultra. Hoth at Low is about 700 files, and the bucket answers each in 0.35–0.8 s from the container, so the load is bound by round trips: the lowest level is the slowest to arrive.
5. **The waiting screen holds for every shader.** `waiting.js`’s `readiness` calls the field ready only once nothing has been building for 0.6 s. The pipeline guard (`lib/three/pipelineGuard`) already keeps any frame from waiting on a shader, so the wait buys no smoothness; it only stretches the load on a chip that compiles slowly. Windows compiles every WGSL pipeline through D3D12.
6. **Every page carries the whole asset manifest.** `runtime/install.js` imports three small helpers from `lib/assetBase`, which imports the bundled manifest: 77,510 entries, 9.07 MB of JavaScript, 1.41 MB gzipped, preloaded by `index.html` on the classic home page as on a world. V8 takes 525 ms to evaluate it as the object literal Vite emits, and 220 to 275 ms as one `JSON.parse`.
7. **The network is not the wait.** A GET from the bucket carries `public, max-age=31536000` and is a CDN hit (a HEAD says `no-cache`, as `scripts/assets-check.mjs` notes). Hoth at Low through the container’s software GL: the world was made at 10.7 s, the level’s boot was in at 209 s, after 694 requests and 46.7 MB, with 279 s of main-thread long tasks (the longest 111 s). Software GL exaggerates every one of them, so the numbers say where the time goes, not how long a laptop takes.
8. **The nineteen warnings were noise** (fixed first, `d71f075f3`): an `If` callback written as `() => x.assign(y)` hands its node back, which three reads as a return from an inline `Fn` and comments out.

## The design

### 1. The tier decides Auto

- `classifyTier` takes the chip’s name score (`gpuScore` of lib/gpu’s WebGL renderer name). A score under `GRADE_AT.high` makes the chip `T0` with no probe, `why: 'name'`, but only when the name’s vendor is the WebGPU adapter’s (`adapter.info.vendor`), so a laptop whose WebGL and WebGPU sit on different chips is judged by the probe. A probe over 8 ms is `T0`, `why: 'slow'`. A WebGPU device lost is `T0`, `why: 'lost'`. The other `T0`s (a phone, a fallback adapter, no `timestamp-query`) keep `why` saying so and change nothing below.
- The facts-only `T0` is decided before a kept tier is read, so a `T1` kept under the old rule is put right on the next visit; a `?tier=` pin still wins.
- A `T0` for `name`, `slow` or `lost` holds Auto at **Low** for that chip (`lib/device`’s `capDetail('low')`, kept with the chip’s WebGL name, so another graphics card starts fresh), before the world is made: the runtime’s quality is retuned and the video values resolved again from the capped level. A level the visitor picked by hand is never capped (lib/device’s rule). Software WebGL is already Low.
- `T0` draws the level on lane L’s instanced path, not lane N1’s compute cull (`gpuScene` needs `T1` or above).

### 2. Frames: 60 where the chip holds it, an even 30 where it cannot

- `T0` no longer pins every second beat. Every world starts at the display’s rate with the 16.7 ms budget; the controller (`dynres.js` on the GPU clock, `lib/three/pace` without one) lowers the internal resolution down to `T0`’s floor, 0.58, as before.
- A new pure rule, `runtime/cadence.js`’s `createCadence`, watches the frames’ own work (the GPU clock’s time where it has one, the main thread’s time in the frame otherwise). With the quality at its last step and the work median over 16.7 ms for two seconds, the loop takes every second beat: an even 30, never a ragged 40. Back to every beat once the work median is under 0.8 × 16.7 ms for three seconds. A visitor who pins 30 or 60 (`?fps=`, `tp-fps`) is held there, as today.

### 3. A loss comes back by itself

- `webgpu.js` reports a loss with its reason, message and the adapter’s vendor and architecture; a device three destroys on dispose is not a loss (as today).
- `runtime.lost()` also abandons any world still being made (the mount’s token moves on), so a loss mid-make ends that make quietly instead of failing it. `rt.recoverable` is true after a WebGPU loss: the next backend is `nodes-webgl`, the node renderer on WebGL 2.
- `useWorld` mounts the page’s module again, once, when the status turns `'lost'` and the runtime is recoverable; the page’s handle (`world.current`) follows the new world. A second loss stays lost, and the page’s own fallback stands.
- The loss is kept for the chip (`lib/gpuProbe`): its tier becomes `T0` (`why: 'lost'`, so Auto drops to Low as above) and its losses are counted. Two WebGPU losses within seven days start the next visits on `nodes-webgl`; `?gpu=webgpu` asks for WebGPU anyway.

### 4. A level picked mid-visit reaches the world

`quality.retune(level)` sets `quality.tier` too (`ultra` is the `high` tier, as `lib/device` has it). A world reloaded from the settings panel is built at the level asked for: its chain, its cut, its boot budget and its pool.

### 5. Getting in fast

- **The pool by the connection, not the level.** `poolSize`: 2 on a saver connection, 4 on a phone, 8 on a desktop or laptop at any level. A weak chip is slow at drawing, not at downloading.
- **The manifest off the entry.** `install.js` imports `WAIT_MS`, `isDown` and `markDown` from a new `lib/assetDown.js` that holds the bucket’s up-or-down state with no manifest; `lib/assetBase` re-exports them, so no caller changes. The manifest then loads only with the loaders that read it.
- **The manifest as `JSON.parse`.** `scripts/assets-manifest.mjs` serves the bundled manifest as a module whose default export is one `JSON.parse` of its text: half the evaluation time where it is read.
- **The shaders no longer hold the door.** `readiness` calls the field ready once the level is in and either nothing has been building for `QUIET_S`, or `SHADER_WAIT_S` (5 s) has passed since the level came in. What is still building is held back by the pipeline guard and appears as it lands; no frame waits for it.
- **The load says where its time went.** When the field is first ready the world logs one line (`console.info`): the seconds to the world made, to the level in, to ready, the requests and megabytes, and the shaders still building; the snapshot’s `marks` carry the same. The owner’s laptop then tells the next session what to cut next.

## What does not change

- The 5090 and any chip that probes `T1` or `T2`: the same Auto (Ultra), the same chain, the same GPU scene, the same pool of 8.
- A level picked by hand, a `?quality=` in the address, `?tier=`, `?gpu=`, `?fps=`.
- The classic renderer’s worlds (`'glsl'`): they never meet the tier.

## Testing

- Pure, beside their files: `gpuProbe.test.js` (the name rule and its vendor guard, the order against a kept tier, `why`, the loss record and its seven days), `device.test.js` (the cap at Low, never over a hand pick), `cadence.test.js` (the drop to 30 and the climb back, the pins), `quality.test.js` (`retune` moves `tier`), `assetFetch.test.js` (the pool), `waiting.test.js` (the shader wait’s cap), `backend.test.js` (the start on `nodes-webgl` after two losses).
- The runtime with a fake backend (`runtime.test.js`): a WebGPU loss with a world up and with one being made; `recoverable`; the second loss. `useWorld.test.js`: one remount after a recoverable loss, none after the second.
- `cullPass.test.js` builds the cull’s kernels to WGSL with no warning (done).
- The gates: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; the production build’s load probe again in the container at Low.
- On the owner’s laptop (no real chip in the container): Hoth at Auto, no hang, the logged load line, frames at 30 or more throughout a round.

## Left for later

- The full N6 table (`pathsFor` read by every caller, the iOS self-test, the settings line).
- The manifest split by world (Hoth’s 6,382 entries of 77,510), if the laptop’s line says the 250 ms still matters.
- What the laptop’s load line names next: the D3D12 pipeline builds at Low, the boot’s binding on the main thread.
