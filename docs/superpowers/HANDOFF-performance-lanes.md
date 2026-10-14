# Hand-off: the performance lanes, one session each

The plan for making the site as quick as it can be on every chip, cut into lanes that separate sessions can run at once without editing the same files. The detail behind each item (file and line, the evidence) is in `docs/superpowers/HANDOFF-every-world-on-webgpu.md`; the rule for every port is the addendum of `docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md`; the evidence is `docs/research/2026-10-13-webgpu-wasm-and-engines.md`. The GPU-first lanes before these (G1, N1 to N5) are merged: the GPU clock and the renderer tier, the GPU scene, the resolution controller with TAAU and sharpening, the baked light, the stream, the physics worker (off). This file starts where they stopped.

## What each piece buys (read this first)

Everything on WebGPU, on one runtime, with the renderer in a worker, makes the heavy worlds much smoother, but each piece fixes a different limit, and none is automatic:

- **The node renderer, built its way** (bundles round what never moves, instancing for what repeats, the GPU scene for a level) cuts the main thread’s cost of submitting draws, and opens compute (culling, particles). Moved over unchanged, a world with many separate meshes is slower: three’s node renderer spends about twice the CPU a mesh of the classic one (the research, c9).
- **One runtime for every world** gives every world the renderer tier’s Auto, the 60-or-even-30 cadence, the GPU-clock resolution controller and loss recovery, where today twelve worlds each run their own renderer and loop with their own thresholds.
- **The renderer in a worker** does not make a frame cheaper; it moves the frame off the main thread, so React, garbage collection, loading and input can no longer drop one, and the frame and the page run on two cores. It helps where the main thread is busy (Battlefront, with its HUD); it does nothing for a frame that is slow on its own.
- **What it will not fix**: a weak chip at Low is mostly short of GPU fill. There the gains are the resolution (the 720p floor, the controller, TAAU), not threads. And Battlefront’s whole simulation (soldiers, bots, physics) is 0.5 ms a frame (lane X2’s measure), so moving it to a worker buys nothing: its main-thread time is three’s drawing and the HUD.

So: measure first (lane P0), then the lanes below, each measured before and after on the owner’s two machines (the Radeon 740M laptop and the RTX 5090 desktop).

## The lanes

| lane | what | owns (only this lane edits these) | starts |
| --- | --- | --- | --- |
| P0 | the measure: the perf probe with long frames, the worst 1 %, both backends, every heavy world; the two machines’ baseline | `scripts/perf-probe.mjs` (+ its tests), `docs/superpowers/evidence/perf/` | now, first |
| P1 | the ports on the runtime: /fly, the Mario 64 tribute, the Death Star’s inside, the galaxy | `components/expanse/flight/`, `components/mario64/`, `components/deathstar/inside/`, `components/galaxy/` (not `surface/`), new `src/lib/three/*Nodes.js` twins | now |
| P2 | onto the runtime: each world off it becomes a world module (`'glsl'` first), then is ported by P1’s method | one world’s folder a session (the universe map first: `components/universe/`, then `middleearth/`, `rickmorty/`, `avengers/`, `cybertron/`, …), its route in `App.jsx` | now, one session a world |
| P3 | Battlefront’s draws: `userData.batchKey` on the game materials and texture arrays, so the GPU scene groups Hoth’s 70 material keys into their 11 shapes (209 draws today on the site, N1’s note) | `components/galaxy/surface/level/levelGltf.js`, `src/lib/three/gpuScene/`, `components/galaxy/surface/level/levelGpu.js` | now |
| P4 | the main thread in the runtime and Battlefront: the per-frame allocations, `useWorld`’s effect, the MiniMap’s second loop, the HUD’s 8 Hz whole re-render, `view()` | `src/runtime/` except `webgpu.js` and `worker/`, `components/battlefront/` | now |
| P5 | pipelines and the device: a counter of pipelines made mid-play, `compileAsync` for what a world adds late, the shadow pass warmed, shallow TSL graphs, the compat-mode gate, the public loss hooks | `src/runtime/webgpu.js`, `src/lib/three/pipelineGuard*.js`, `src/lib/three/gpuScene/three.js` | now |
| P6 | the weak chip’s picture: TAAU or FSR1 at Low against the plain stretch, the 8-bit output buffer, MSAA or TRAA, each on the 740M | the post chain (`src/lib/three/light/post.js`, `passes.js`; `runtime/webgpu.js`’s `buildPostProcessing` through P5), `src/lib/video.js`’s rows | after P0’s baseline |
| P7 | the renderer in a worker: a spike on the runtime’s fixture, then Battlefront, behind `?worker=on`, measured | new files only: `src/runtime/worker/` (+ one opt-in line in `src/runtime/index.js`) | now |
| P8 | the small loops: the portal swirl, the TV static, the hangar, the wardrobe, the Collection’s stage | `rickmorty/swirl.js`, `rickmorty/Cable.jsx`, `universe/shipyard/showroom.js`, `rickmorty/wardrobe/preview.js`, `galaxy/surface/heroStage.js` | now (before P2’s Rick and Morty session) |

A lane that needs a file another lane owns asks in that lane’s pull request, or waits for it to merge; every lane merges `origin/main` before its pull request, keeping both sides.

### Where each lane stands

One line a lane, filled as it lands: the pull request, what it measured, what is left.

- **P0**: pull request #989 (2026-10-13). The probe reports the worst 1 %, the main thread’s and the GPU’s ms, WebGPU’s draws and pipelines, the pipelines made late; `--heavy` runs the nine heavy worlds (`/galaxy/hoth/surface` sends the visitor to Battlefront’s Hoth now, so it is measured once); the RTX 5090’s baseline is in `docs/superpowers/evidence/perf/README.md`. Left: the Radeon 740M’s rows, the owner’s to run.
- **P1**: not started.
- **P2**: not started.
- **P3**: not started. Found while scoping it (2026-10-13): Battlefront’s map loads Hoth’s level with the GLB’s own materials, not the game materials, so the GPU scene already draws it in about 69 groups (`materialKey`: type, maps, scalars); the 209 are the indirect sub-draws inside them (N1’s table). Arrays per shape would have to be per size, colour space and transcoded format, and a map’s size changes mid-play as it is promoted (`levelGltf.js`’s swap). Measure Battlefront’s draws by pass before deciding it is worth it.
- **P4**: not started.
- **P5**: not started.
- **P6**: waits for the laptop’s rows.
- **P7**: not started.
- **P8**: not started.

### P0, the measure

1. `scripts/perf-probe.mjs` gains, per route and backend: the median frame and its worst 1 %, the main thread’s milliseconds (Long Animation Frames where Chrome has them), the GPU’s (the G1 clock), draws, programs, and pipelines made after the first second.
2. A routes list for every heavy world: `/battlefront/hoth`, `/galaxy/hoth/surface`, `/galaxy`, `/fly`, `/universe`, `/middle-earth`, `/c-137`, `/avengers`, `/deathstar`, `/deathstar/inside`.
3. The commands the owner runs on the two machines, written out; the table (empty until they are run) in `docs/superpowers/evidence/perf/README.md`. The cloud runs it in SwiftShader for the shape of the numbers only.
Done when the probe prints the table and its tests pass; the laptop’s and the desktop’s rows are filled by the owner.

### P1, the ports on the runtime

One pull request a world, in this order: /fly, the Mario 64 tribute, the Death Star’s inside, the galaxy. Each: the TSL twins (new files; a shared GLSL original is never edited), the module flipped to `'nodes'`, then the three gates of the addendum: `scripts/twin-parity.mjs` for each twin (32 dB, under 2 % of pixels off), `scripts/gpu-parity.mjs` for the world, `scripts/perf-probe.mjs` no slower on the node renderer at Low and High (if slower, the world is rebuilt with bundles and instancing first), and `src/runtime/shading.test.js` clean. The details for each world’s closure: the every-world hand-off’s first table.

### P2, onto the runtime

One session a world. The universe map first (`components/universe/UniverseMap.jsx:87`, `universe/scene.js:482`, on `lib/three/useScene` today): a world module through `fromScene` (`src/runtime/module.js`), mounted with `useWorld`, still `'glsl'`; its own frame-rate ladder and watchdog go, the runtime’s cadence and controller take over; then its HUD strings built each frame (`universe/scene.js:2734`, `:3549`, `:2757-2761`) compared as numbers. Then Middle-earth, the Rick and Morty worlds, the Avengers’ compound, Cybertron, Scranton, Albuquerque, the Death Star’s hero and trench, Invincible, the Caribbean, the music room, the classic pages’ scenes. Each is measured before and after with P0’s probe, and then ported by P1’s method in its own pull request.

### P3, Battlefront’s draws

N1’s note: Hoth’s 70 material keys are 11 material shapes; game materials on the node renderer have no `userData.batchKey`, so each is its own group (209 draws, as instanced). Give them their key, and put the shapes’ maps in texture arrays with a per-part material row, so the GPU scene draws about one indirect draw a shape. Measure draws with `scripts/level-draws.mjs hoth --tier ultra` (the third column) and frames with P0.

### P4, the main thread

The every-world hand-off’s performance items 2, 3, 4, 6 and 7: reuse the objects `runtime/input.js`’s `sample()`, `components/games/pad.js`, `runtime.js`’s cadence call and `lib/three/gpuTime.js` make every frame; a running median in `runtime/dynres.js`; dependencies for `runtime/useWorld.js:147-152`’s effect; the MiniMap drawn from the world’s frame, measured on resize only; Battlefront’s HUD split so the parts that change each snapshot (health, ammo, the radar) update through refs and the rest only on change; `battle.js`’s `view()` reusing its arrays and building `deploy` and the scoreboard only when shown. Measure garbage collection and long frames before and after.

### P5, pipelines and the device

The hand-off’s items 1, 10, 11 and 14: a development counter of pipelines created after a world’s first second (zero is the goal: each is a hitch); `compileAsync(object, camera, scene)` before `scene.add` for what a world adds late; the shadow pass’s pipelines warmed (three r186 skips shadow maps in precompile, #33924); long TSL `Fn`s given their type (#34434); the GPU scene’s vertex pulling gated on `core-features-and-limits` (compatibility-mode devices have no vertex-stage storage buffers); `renderer.onDeviceLost` in place of `renderer.backend.device.lost`.

### P6, the weak chip’s picture

At Low, on T0: the buffer stretched today against `TAAUNode` at the floor’s scale (N2’s chain has it) and `FSR1Node`, each with its GPU milliseconds and a shot; `outputBufferType: UnsignedByteType` where the chain keeps its range; MSAA off with TRAA. Only what holds 30 fps on the 740M and looks better ships; the floor’s table in the every-chip-plays spec is updated with it.

### P7, the renderer in a worker

A spike, new files only, behind `?worker=on`: the runtime hosted in a module worker (`transferControlToOffscreen`, WebGPU with the WebGL 2 fallback, input events forwarded, resize, visibility, device loss, a snapshot channel back to the page), on the runtime’s fixture world (`src/runtime/fixtures/`), then Battlefront. Measured against the main thread with a deliberate main-thread load (a 30 ms task every 100 ms): the worst 1 % of frames and long frames. The finding goes to `docs/research/` and a decision (adopt, adopt for Battlefront only, or not), with what bridging audio (Web Audio is the main thread’s), the HUD and the loaders would cost. It is adopted only after Battlefront’s port has settled, so it is built once.

### P8, the small loops

The hand-off’s items 8, 15, 16 and 18: the swirl draws only while a portal is on screen and moving; the TV static becomes a pre-made noise texture moved by CSS; the hangar and the wardrobe skip the draw when nothing turns or the canvas is out of view; the Collection’s stage stops out of view. Each one’s main-thread milliseconds before and after.

## Not lanes

- WebAssembly threads on GitHub Pages (cross-origin isolation costs more than it buys here: the every-world hand-off’s “Not to do”).
- Battlefront’s simulation in a worker (0.5 ms a frame; the hop costs about as much).
- An engine switch (the 2026-10-08 decision, three over Babylon.js, stands; Babylon’s snapshot rendering is matched by `BundleGroup`).

## The prompt for a lane

Paste into a new Claude Code session, with the lane’s id in the first line:

```
Do lane <P0..P8> of docs/superpowers/HANDOFF-performance-lanes.md on
tilakpatell.com. Read, in order: CLAUDE.md, docs/README.md, that file
(your lane's row says which files only you may edit), docs/superpowers/
HANDOFF-every-world-on-webgpu.md (the detail and the file:line of each
item), docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md
(its 2026-10-13 addendum: the rule for every port) and docs/research/
2026-10-13-webgpu-wasm-and-engines.md (the evidence).

Skills: superpowers throughout (using-superpowers first; brainstorming
before any design change; writing-plans for the lane; subagent-driven-
development or executing-plans to build it; test-driven-development;
systematic-debugging on any failure; verification-before-completion before
saying anything is done; requesting-code-review before each merge;
finishing-a-development-branch to merge). Talk to me in caveman (ultra);
docs, comments and commits in the repo's voice (docs/health/RULES.md:
British spelling, curly quotes, comments say why). Delegate with cavecrew:
cavecrew-investigator to locate code, cavecrew-builder for a one- or
two-file edit, cavecrew-reviewer on each diff before it merges; Explore
for wide searches; a general-purpose agent for web research. The
threejs-debug-profiler, threejs-shaders, threejs-postprocessing and
threejs-qa-release skills help with the measuring and the ports.

Rules: measure before and after with scripts/perf-probe.mjs and put the
numbers in the pull request; at least 60 fps on a strong GPU, at least 30
on a weak integrated one, faster is fine; a TSL shader must match its GLSL
original (scripts/twin-parity.mjs) and a world must be no slower on the
node renderer, or it is not merged; a level picked by hand and ?quality=,
?tier=, ?gpu=, ?fps= are never overridden; T1 and T2 chips keep
everything; edit only the files your lane owns, merge origin/main before
each pull request; never print or commit a key; run the four checks in
CLAUDE.md, then open the pull request and merge it when CI is green. Fill
your lane's row in this file (session, pull request) as you go.
```
