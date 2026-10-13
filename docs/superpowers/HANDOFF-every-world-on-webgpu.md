# Hand-off: every world on WebGPU, and the site quick on every chip

The design: `docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md` and its addendum of 2026-10-13 (“every world, by its measure”). The research: `docs/research/2026-10-13-webgpu-wasm-and-engines.md` (eighteen agent skill files and about ninety primary sources: WebGPU, WebAssembly, web engines, AAA techniques, profiling). The decisions of the day: `docs/decisions/2026-10-13-every-chip-plays.md`, `2026-10-13-the-star-wars-worlds-need-a-real-gpu.md`, `2026-10-13-the-browser-is-told-how-to-reach-the-card.md`. The rules every change keeps: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`.

The lanes that cut this into one session each: `docs/superpowers/HANDOFF-performance-lanes.md`.

The owner’s word (2026-10-13): every world defaults to WebGPU, choosing whatever gives the best quality for the performance; a TSL shader is as good as the GLSL it replaces or better, never worse; at least 60 fps on a strong chip and 30 on a weak one, and faster is fine; the GPU asked for everywhere; no lag from a busy main thread; merge each task as it is finished.

Line numbers below are as of 2026-10-13, `origin/main` after the pull request that carries this file.

## Landed (2026-10-13)

- Pull request #985 (the every-chip-plays design): Auto by the chip (a score under 50, or a renderer tier kept as weak, is Low); a lost WebGPU device mounts its world again on WebGL 2; WebGPU first and WebGL 2 at once where it cannot be had; the Star Wars worlds need a real GPU (`lib/fit.js`, score 10, the card with Try anyway); Low as the floor (720p, no bloom, 8 lamps and 2 spots, first-row maps, 8 m ground, five bots a side); the cadence by the display’s beat; the PNG16 decode and meshopt in workers; the tier kept for the chip; the 19 TSL Return warnings gone. Hoth at Low in the container: in at about 43 s against 209 s.
- The pull request after it: the built-in graphics panel (`lib/gpuHint.js`, `components/worlds/GpuHint.jsx`), every context asking for `high-performance` (a test fails one that asks for less), the compressed-format probe letting its context go, a first WebGL loss recoverable too, the 40 ms quality floors at 36 ms, the Avengers’ engine reading lib/device’s level, Battlefront building one view a frame instead of three, the other pilots’ pointers written only on change, a pinned 60 at every beat again, the research note and the design’s addendum.

## Left: the ports to the node renderer

Each world is its own pull request, in this order, merged only when all three gates hold (the addendum): every twin at `scripts/twin-parity.mjs`’s line (32 dB, under 2 % of pixels off) and the world at `scripts/gpu-parity.mjs`; `scripts/perf-probe.mjs` no slower on the node renderer than the classic one, main thread and GPU, at Low and High (a world that is slower is rebuilt the node renderer’s way first: `BundleGroup` round what never moves, instancing for what repeats, the GPU scene for a level); `src/runtime/shading.test.js` clean and `glsl-sites` lower by the world’s count.

The method is lane T’s (`docs/superpowers/plans/2026-10-10-galaxy-engine-laneT-surface-port.md`): a twin is a new file (`<name>Nodes.js` beside a shared original in `src/lib/three/`, or `nodes.js` beside a world’s scene), a factory returning a node material and its uniform nodes under the names the frame code already writes; the GLSL original is never edited while another world draws with it; the module flips to `shading: 'nodes'` last. Twins that exist already: `src/lib/three/{core,dust,foliage,grass,groundLook,groundingBake,grounding,groundmap,groundwork,hook,house,ink,kit,matcap,portalFx,puffs,recolour,scans,splat,wind}Nodes.js` and `src/components/galaxy/surface/nodes/` (sky, skyfog, water, weather, props, post, figures, kit, missions, activity, hvv).

### On the runtime, still `'glsl'` (they flip as soon as their closure is clean)

GLSL sites in each module’s import closure (`src/runtime/shadingClosure.js`):

| world | module | files in the closure with GLSL | what it needs |
|---|---|---|---|
| /fly (the Expanse flight) | `components/expanse/flight/module.js:134` | 14 | its own two: the sky dome’s `ShaderMaterial` (`flight/scene.js:21`) and the city’s `onBeforeCompile` (`flight/ground.js:143`); the rest are shared files with twins (`lib/three` core, foliage, groundLook, groundmap, house, puffs, recolour, wind; the surface’s props `shaders.js`, `windows.js`, `weather.js`): it reaches them through `galaxy/shared/models.js` and `galaxy/shared/weather.js`, re-exports of the surface’s GLSL files, so the flight needs a nodes path to those (the surface’s own module imports the twins directly) |
| /dot-matrix/64, the tribute view | `components/mario64/module.js:63` | 3 | `mario64/scene.js` and `models/things.js` (`onBeforeCompile`), and `looks.js`’s `EffectComposer` with `UnrealBloomPass`: the post through `rt.gfx.post` (the runtime’s node chain) |
| /deathstar/inside | `components/deathstar/inside/module.js:91` | 13 | `ShaderMaterial` in shaft/depths, deep/parts, ds2/space, hangar, views, saber, fx; `onBeforeCompile` in deep/compactor, views; `lib/three` explosions (no twin yet), dye (no twin yet), house, groundmap |
| /galaxy | `components/galaxy/module.js` (fromScene’s default) | 54 | the galaxy’s own (levelArea, areaWeather, skyStreaks, world, fx, rocks, rocksPlaced, placesDraw, bodies, surface/sky), `lib/three` atmosphere (no twin), ink, recolour, puffs, wind, foliage, core, and what it borrows: the cockpit’s vehicles and space, the Rick and Morty cruiser, wardrobe dress, portal toon and meshyCast. The biggest; last of these four |

The runtime also draws `'glsl'` worlds on the classic backend with no GPU-clock dynamic resolution (`src/runtime/runtime.js:345-352`), and the renderer tier is probed only for a `'nodes'` world on WebGPU (`runtime.js:370`, `runtime/browser.js:52-55`): both are answered by the flips.

### Off the runtime (their own renderer and loop)

They miss the renderer tier’s Auto (they read lib/device’s level, which carries the chip’s score and the kept tier’s hold, but not this page’s probe), the cadence, GPU-clock dynamic resolution and loss recovery. Each becomes a world module on the runtime first, still `'glsl'` (that alone gives it the cadence, the recovery and one renderer), then is ported. GLSL sites counted in the folder (`ShaderMaterial(` and `onBeforeCompile`):

| world | its renderer now | GLSL sites in the folder |
|---|---|---|
| `/` and /universe, the universe map | `lib/three/useScene` (`universe/UniverseMap.jsx:87`, `universe/scene.js:482`) | 98 |
| /middle-earth: the map, the Shire, twelve towns, Rush, the Ring, Gorgoroth, the Bridge | `lib/stage3d.js:197`; the map its own (`middleearth/MapBackdrop3D.js:29`) | 86 |
| /avengers: the compound, Titan, nine games | `avengers/hq/engine.js:55` (one live at a time) | 48 |
| /c-137 and the small planets, /c-137/citadel | `lib/stage3d.js`, the cruiser (`rickmorty/cruiser3d.js:77`), the backdrop, the swirl (`rickmorty/swirl.js:45`), the wardrobe (`rickmorty/wardrobe/preview.js:32`) | 39 |
| /cybertron | `useScene`, `lib/stage3d`, two of its own (`cybertron/game/scene.js:54`, `world/CybertronBackdrop3D.js:792`) | 36 |
| /invincible | `avengers/hq/engine.js` | 21 |
| /deathstar (the hero and the trench) | its own (`deathstar/DeathStar3D.js:79`, `Trench3D.js:335`) | 15 |
| /albuquerque | `office/stage3d.js` and Metherria’s own (`albuquerque/metherria/scene.js:66`) | 10 |
| /scranton | `lib/stage3d`, `office/stage3d.js` | 8 |
| /caribbean | `lib/stage3d`, its own loop (`caribbean/DeadMansTide.jsx:281-418`) | 7 |
| /music | `lib/stage3d` | 2 |
| /dickansh, /dot-matrix | `useScene`, `lib/three/renderer.js` | (not counted) |
| the classic pages’ scenes (ambience, cartridges, motifs, the paper plane, mist, lamplight, the AKD stage, the globe, the GPU stage) | `useScene` | (not counted) |
| the default views of /dot-matrix/64 and /dot-matrix/minecraft | EmulatorJS and Eaglercraft in iframes | third-party, left as they are |

Order after the four above: the universe map (the most visited, and every visit starts there), then Middle-earth, the Rick and Morty worlds, the Avengers’ compound, Cybertron, then the rest by visits. The classic pages’ ambience (`components/ambience/kit.js:24`, a WebGL backdrop at 30 fps on every classic page) may be better as WebGL: measure it before porting.

## Left: performance

Most valuable first. Each item says where; measure before and after (`scripts/perf-probe.mjs`, and Long Animation Frames in Chrome for the main thread).

### The frame loop and the runtime

1. **Pipelines made mid-play are hitches.** In three r186 only `compileAsync` makes pipelines asynchronously; a `render()` that meets a new material makes its pipeline at once (research §2a, items 2–5). The site has its pipeline guard (`lib/three/pipelineGuard`) and `compileAsync` at mount; still to do: count pipelines created a frame after the first second (a dev counter on `renderer.info.memory.programs` or the guard’s own), precompile what a world adds later (`compileAsync(object, camera, scene)` before `scene.add`), and check the shadow pass’s pipelines are warmed (r186 #33924 skips shadow maps in precompile).
2. **Per-frame allocations on the runtime’s path**: `runtime/input.js:140-157` (`sample()`: a new `Set` and objects every frame), `components/games/pad.js:8-15` (`getGamepads()` spread twice, a 20-field object), `runtime.js:201` (the cadence’s argument object), `lib/three/gpuTime.js:62-79` (a closure and a promise every frame), `runtime/dynres.js:132-142` (a sorted copy every frame once the history is full). Reuse objects; keep a running median.
3. **`runtime/useWorld.js:147-152`**: an effect with no dependency list calls `world.update` and `rt.invalidate` on every render of the page; give it its dependencies.
4. **`runtime/hud/MiniMap.jsx:27-43`**: a second `requestAnimationFrame` chain beside the runtime’s loop, woken on every display beat while it draws at 10 Hz, its `fitCanvas` reading layout ten times a second (`runtime/hud/canvas.js:8-9`). Drive it from the world’s own frame, measure on resize only.
5. **Different watchdogs**: `lib/three/renderer.js:137-191` (22 ms), `lib/stage3d.js:288-304` (24 ms), `office/stage3d.js` (36), `avengers/hq/engine.js:167-177` (22 and 34), the Death Star’s (36). They go when their worlds join the runtime (its cadence and controller); until then they are the floor.

### Battlefront

6. **The HUD’s snapshot**: 8 a second (`battlefront/module.js:74`, `:500-505`) to `setSnap` (`BattlefrontWorld.jsx:83-84`), so the whole HUD tree renders 8 times a second, each snapshot allocating every soldier’s row, the objectives, the kill log and `machine()` (whose `gpuClock.median` sorts a copy). Split it: what changes every snapshot (health, ammo, the radar) to the parts that show it, through refs; what changes rarely (the scoreboard, the objectives) only on change.
7. **`battle.js:315-406` `view()`** still rebuilds every entity’s `vel` array, the objectives, `deploy`’s offers and spawns, the squad rows, the player and the scoreboard on each call, now once or twice a frame. Reuse the arrays; build `deploy` only while deploying, the scoreboard only when it is open.
8. **The front-end’s hero stage** (`galaxy/surface/heroStage.js:173-181`): a second WebGL context drawing every frame beside the runtime’s while the Collection is open. Stop it when its canvas is out of view, draw on change under reduced motion as it does, and consider drawing it through the runtime’s renderer instead of its own context.

### WebGPU, from the research

9. **Indirect draws stay in one buffer** (Dawn validates each indirect buffer on D3D12: 412 buffers about 3 ms, one about 10 µs). The GPU scene already does (`lib/three/gpuScene/draws.js:14`); keep it so as it grows.
10. **Compatibility-mode devices** (Chrome 146, OpenGL ES 3.1 Android): three r186 asks for compatibility and then every feature; such a device has no storage buffers in the vertex stage. Gate the GPU scene’s vertex pulling on `renderer.backend.device.features.has('core-features-and-limits')`.
11. **TSL graphs stay shallow** (three #34434: node-type resolution grows exponentially with long chains that reuse a value); give a long `Fn` its type (`Fn(fn, type)`).
12. **The weak-chip tier** (research §3, 4): `TAAUNode` at 0.5–0.67 scale, or `FSR1Node` where there is no velocity, in place of a plain stretch at Low; `outputBufferType: UnsignedByteType` where the chain allows (HalfFloat is the default); MSAA off with TRAA. Each measured on the floor’s chip before it ships.
13. **Static parts in `BundleGroup`** (a town, a compound, the Death Star’s rooms), measured: no gain on WebGL 2, and a bundle rebuilt every frame costs more than none.
14. **The public loss hooks**: `renderer.onDeviceLost` and `renderer.onError` (r186) instead of `renderer.backend.device.lost` (`runtime/webgpu.js:193`): the same promise today, safer across three’s releases.

### Loops and the main thread elsewhere

15. **`rickmorty/swirl.js:108-146`**: one WebGL context copied into each portal’s 2D canvas with `drawImage` every frame it shows; the home page’s card starts it. Draw only while a portal is on screen and moving, or use one canvas per visible portal.
16. **`rickmorty/Cable.jsx:17-27`**: a full `putImageData` of TV static every frame while it fuzzes; a pre-made noise texture scrolled by CSS costs nothing.
17. **`universe/scene.js:2734`, `:3549`, `:2757-2761`**: HUD strings built every frame before the comparison; compare the numbers, build the string on change. `:5045-5049`: a new pose object and a `map` every frame of a dive.
18. **Showroom and wardrobe** (`universe/shipyard/showroom.js:209-238`, `rickmorty/wardrobe/preview.js:120-134`): drawing while open; skip the draw when nothing turns and the canvas is out of view.

### Measurement still owed

19. **The owner’s laptop** (Ryzen 5, Radeon 740M) has not been measured: no real chip in the container. Run `GPU=webgpu node scripts/perf-probe.mjs` and `GPU=webgl` there, and read the console’s `[battlefront] in at …` line; the 5090 the same at High and Ultra. The tables go into the decisions’ “Revisit when”.

## Not to do

- **WebAssembly threads on GitHub Pages**: they need cross-origin isolation; a service worker can add the headers but costs a reload on the first visit, Safari has no `COEP: credentialless`, and the cross-origin asset bucket and fonts would need CORP headers. Keep the workers that pass data by transfer; port only a measured hot kernel to WebAssembly, as the navmesh search was (research §2g).
- **A world moved to WebGPU unchanged where it measures slower** (the addendum).
- **The renderer in an OffscreenCanvas worker** before the ports: a large refactor of input, audio and the React HUD; worth it for one heavy world once the ports are done.

## Settled with the owner

- A WebGPU loss holds a weak chip only (2026-10-13): a T1 or T2 chip, or one whose name grades 50 or more before a tier is decided, gets its world back once on WebGL 2 and keeps everything else (`lib/gpuProbe.js`’s `lossHolds`, `runtime/index.js`’s `onLoss`).

## Checks

Before a change is done (CLAUDE.md): `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`. A whole-repo scan test can pass its 5 s limit under the full suite’s load in the cloud container (`scripts/conflict-markers.test.mjs`, the secret scan in `scripts/assets-upload.test.mjs`, Moria’s layout, the long battle simulations); run it alone before calling it real. `npm run build` rewrites `public/github.json`: put it back with `git checkout public/github.json`. In the cloud container the browser draws in software (SwiftShader), so the Star Wars gate shows its card: set `tp-software` to `"on"` in local storage, or open `?software=on`.

## The prompt for the next session

Paste this into a new Claude Code session on the repository:

```
You are continuing the site's GPU work on tilakpatell.com. Read, in order:
CLAUDE.md, docs/README.md, docs/superpowers/HANDOFF-every-world-on-webgpu.md
(this hand-off: what is left and how each item is checked),
docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md (its
2026-10-13 addendum is the rule for every port), and
docs/research/2026-10-13-webgpu-wasm-and-engines.md (the evidence).

Skills: use superpowers throughout (using-superpowers first; brainstorming
before any design change; writing-plans for each port; subagent-driven-
development or executing-plans to build it; test-driven-development;
systematic-debugging on any failure; verification-before-completion before
saying anything is done; requesting-code-review before each merge;
finishing-a-development-branch to merge). Talk to me in caveman (ultra),
but write docs, code comments and commits in the repo's own voice
(docs/health/RULES.md: British spelling, curly quotes, comments say why).
Delegate with cavecrew: cavecrew-investigator to locate code,
cavecrew-builder for a one- or two-file edit, cavecrew-reviewer on each
diff before it merges; Explore for wide searches; a general-purpose agent
for web research. The threejs-debug-profiler, threejs-shaders,
threejs-postprocessing and threejs-qa-release skills help with the ports
and the checks.

The work, one pull request each, merged as soon as its CI is green:
1. Port the worlds still 'glsl' on the runtime to the node renderer, in
   the hand-off's order (/fly, the Mario 64 tribute, the Death Star's
   inside, the galaxy). A TSL twin must match its GLSL original
   (scripts/twin-parity.mjs: 32 dB, under 2 % of pixels off) and the world
   must be no slower on the node renderer (scripts/perf-probe.mjs, both
   backends, Low and High); if it is slower, rebuild it the node
   renderer's way (BundleGroup, instancing, the GPU scene) first. A port
   that fails parity is not merged.
2. Move the worlds off the runtime onto it as world modules ('glsl'
   first), the universe map first, then port them the same way.
3. Work the hand-off's performance list, most valuable first, measuring
   before and after.
Rules: at least 60 fps on a strong GPU, at least 30 on a weak integrated
one, faster is fine; a level picked by hand and ?quality=, ?tier=, ?gpu=,
?fps= are never overridden; T1 and T2 chips keep everything; never print
or commit a key; run the four checks in CLAUDE.md before each merge.
Update the hand-off's lists as items land.
```
