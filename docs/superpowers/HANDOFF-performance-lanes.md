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

- **P0**: pull request #989 (2026-10-13). The probe reports the worst 1 %, the main thread’s and the GPU’s ms, WebGPU’s draws and pipelines, the pipelines made late; `--heavy` runs the nine heavy worlds (`/galaxy/hoth/surface` sends the visitor to Battlefront’s Hoth now, so it is measured once); a `mario64` journey for P1. The RTX 5090’s baseline is in `docs/superpowers/evidence/perf/README.md` (the High WebGPU rows of the eight worlds but Battlefront were being run again when the session ended: their first run ran out of Node’s heap on Battlefront’s old five-minute wait). Left: the Radeon 740M’s rows, the owner’s to run. The bench’s scratch tools are in `docs/superpowers/evidence/perf/tools/` (how they were run: below).
- **P1**: /fly ported on `claude/perf-p1-fly` (pushed, no pull request): its closure’s GLSL 13 files to 0 (`flight/nodes.js`: the sky dome and the city’s windows; the originals in `flight/glsl.js`; the house’s twin made before the ground; the galaxy’s `shared/models.js` and `shared/weather.js` now hand out the node twins, the flight being their one borrower; DEV `world.view('start')` and `settled()` for gpu-parity; twin-parity’s server given `library-slice`; gpu-parity unlinks its node_modules junction before removing its worktree, which on Windows had deleted packages through it). **Not mergeable yet by the addendum’s rule: slower on the node renderer** (main thread 0.5 → 0.7–0.8 ms at Low, 0.6 → 0.8–0.9 at High; ready 9 → 14 s; buffer uploads ×2.8 on WebGL 2). Parity (2026-10-13, the 5090): the sky twin 52.5 dB, 0 % off (passes); **the city twin 20.9 dB, 2.58 % off, with console errors (fails)**; the world at `view('start')` 29.1 dB / 16.6 % off on WebGL 2 and 25.1 dB / 32.5 % on WebGPU against main (fails: the city, the house's late adoption and the ground's look are the places to look; the pictures are in the bench's `.perf-out/p1-fly/`, not kept). Its CPU profiles, classic against nodes, are in the bench's `.perf-out/p1-fly-prof-*` logs. Next: rebuild it the node renderer’s way (bundles, instancing), then the gates. The Mario 64 tribute is ported on `claude/perf-p1-mario64` (pushed, by an agent; closure 0 GLSL; `cfe1a4365` is its parity before-ref with views `grounds,castle,bobomb`); not yet checked in a browser. The Death Star’s inside was being ported by an agent on `claude/perf-p1-ds-inside` (in its own worktree; may not be pushed). The galaxy: not started.
- **P2**: the universe map onto the runtime was being done by an agent on `claude/perf-p2-universe` (its own worktree; may not be pushed). The map of what it takes (the galaxy’s precedent, ten gaps: lowerQuality takes no level, tone mapping, the double calibration, `reduced` and `onEvent` in props, `data-tour-still`, prepare’s `frame`, the CSS on `.scene-canvas`, `rt.host`, `info.autoReset`) is in this session’s notes; the rest of the worlds not started.
- **P3**: not started. Found while scoping it (2026-10-13): Battlefront’s map loads Hoth’s level with the GLB’s own materials, not the game materials, so the GPU scene already draws it in about 69 groups (`materialKey`: type, maps, scalars); the 209 are the indirect sub-draws inside them (N1’s table). Arrays per shape would have to be per size, colour space and transcoded format, and a map’s size changes mid-play as it is promoted (`levelGltf.js`’s swap). Battlefront’s frame at High is the main thread’s (below, P4), not its draws: worth little until that is down.
- **P4**: `claude/perf-p4-main-thread` (pushed). The runtime’s frame makes no garbage (one input snapshot, the cadence’s argument, the GPU clock’s resolve, dynres’s median sorted as it goes; `readPad` without its spreads); the MiniMap on a paced clock (`runtime/hud/clock.js`) in a ResizeObserver’s box; `useWorld` updates only on changed props (`sameProps`); Battlefront’s frame takes a lean `view()`. Measured: below the noise on the 5090 (the profile shows the runtime’s own path is not where Battlefront’s main thread goes). **The real cost, by P0’s census: Battlefront’s graph is 5,617 objects, 4,261 of them the 101 soldiers’ bones and 1,057 the placed lights’ pool, every one recomposed every frame and walked in each pass** (`_projectObject`, `updateMatrixWorld`, `compose`: most of the 6.7 ms of JavaScript a frame at High against the chip’s 1.2). Committed for it (`0c08e2f3a`): bones with nothing drawn under them out of three’s walk (`figures/lod.js` `quietBones`), far soldiers animated every second or fourth frame (`animEvery`: 30 m, 70 m), the lights’ pool making its matrices only where it moves them. Its A/B (`queue6.sh`: before, after, before, after, High and Low on WebGPU, a profile each, the census after) was queued when the session ended. Not yet: the HUD split (the HUD is 2 % of the profile: low value).
- **P5**: `claude/perf-p5-pipelines` (pushed). A lost device heard through three’s `renderer.onDeviceLost` (three’s default first); the GPU scene off compatibility-mode devices (`hasIndirect`); **the pipeline guard on the node renderer’s WebGL 2 backend too** (three links asynchronously there when given a list): unguarded, Battlefront at High over WebGL 2 took 154 to 180 s to come in, its worst 1 % of frames 4.5 to 5.5 s, 48 pipelines late. Its after-run was going when the session ended. The count of late pipelines is P0’s probe’s; shadow-pass warming and typed TSL `Fn`s wait for a measured cost. **Its review (cavecrew, 2026-10-13) found three risks to fix before it merges:** (1) one-time renders, three/webgpu's PMREMGenerator above all (`fromScene`, `fromEquirectangular`, PMREMNode from a `scene.environment`), are held by the guard and never drawn again, so an environment map can stay empty (on WebGPU already; now on WebGL 2 too: the lit fixture, `runtime/fixtures/litWorld.js` L451–454, meets it): a switch that turns the guard off round one-time generators and asks `origGet(ro, null)` meanwhile, and the `object === scene` test (never true: three passes its own `_scene` for a root that is not a scene) dropped; (2) a device already lost as it is made is never reported (the hook is put on after `await renderer.init()`, and three's own `device.lost.then` runs inside it): put the hook on right after construction, map the reason by `info.api === 'WebGL'`, and dispose and throw if a loss comes before createWebGPU returns; (3) a question: does a core device on Firefox and Safari list `core-features-and-limits`? If not, three reads it as compatibility mode and the GPU scene is off there. **Measured (the 5090, Battlefront at High over WebGL 2, before → after): in 180 → 68.5 s, worst 1 % 4,510 → 19.3 ms, fps 18.7 → 68.3, but draws 118 → 19 and programs 107 → 282: most of the scene held back and never drawn, which is the review's first risk. Not mergeable until fixed.** WebGPU unchanged (Battlefront 103.9 fps, main 7.5 ms; earth the same).
- **P6**: waits for the laptop’s rows.
- **P7**: not started.
- **P8**: pull request #991 (pushed; review’s four fixed). The small loops on `lib/shownLoop.js` (no frame asked for out of view or in a hidden tab); the still portal painted only on change; the TV static a noise picture moved by CSS; the wardrobe and the Collection’s hero at 30 a second unless dragged. Measured (main thread ms a second): the portal scrolled away 40.8 → 34.3, the wardrobe open 352 → 294. Merge when CI is green.

**How the session measured.** A second worktree of the repository (`.claude/worktrees/perf-lanes`, detached) was the bench: each run checks out a lane’s commit with P0’s branch merged in (detached, no branch made) and runs the probe there, one browser at a time (`tools/bench.sh`, `tools/queue6.sh`); the edits were made in the session’s own worktree. Headless frame times shift when another browser or a full test run shares the CPU: run A/B back to back, interleaved. `tools/glsl-closure.mjs <module.js>` lists the GLSL in a module’s import closure (run from the repository’s root with node); `tools/bf-census.mjs` counts Battlefront’s graph at play; `tools/loops-measure.mjs <case>` measures P8’s small loops.

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
