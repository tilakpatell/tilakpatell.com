# The engine floor: one renderer, one loop, less code, before the Frostbite reconstruction

Date: 2026-10-15. Lane: runtime, every world. Builds on `2026-10-08-webgpu-acceleration-design.md` (the backends and its addendum of 2026-10-13, the rule for every port), `2026-10-11-gpu-first-renderer-design.md` (the GPU scene, the picture, the light, the stream) and the audit `docs/research/2026-10-11-frostbite-gap-audit.md`. The hand-offs it starts from: `docs/superpowers/HANDOFF-every-world-on-webgpu.md`, `HANDOFF-performance-lanes.md`, `HANDOFF-gpu-first.md`. Written from `origin/main` at `f97079c7` (#1003). Every number below says where it was read; the inventory commands are in `docs/superpowers/evidence/engine-floor/README.md`.

## What the owner asked

“In preparation of a new recreation of the Frostbite engine for Battlefront II: find and architect ways to remove all unnecessary bloat and code in the codebase; figure out how to switch all the worlds to WebGPU; convert everything to be more performant. Write an extremely detailed spec and then implement with new Opus 5.5 sessions.”

## The answer in one paragraph

The Frostbite reconstruction (`HANDOFF-bf2017.md`, the GPU-first lanes) is being built on a floor that is three floors: the node renderer on the runtime, where the Star Wars worlds live; the classic `WebGLRenderer` on the same runtime for three worlds not yet ported; and fourteen worlds and the classic pages’ scenes off the runtime altogether, each with its own renderer, loop, watchdog and post chain. Every visitor who crosses from the universe map into a Star Wars world downloads three copies of three.js, 1.4 MB of it; every world off the runtime misses the renderer tier, the cadence, the GPU-clock resolution and loss recovery that the design of 2026-10-13 built; and about 5,000 lines of GLSL originals are kept beside their 5,000 lines of TSL twins because one `'glsl'` module somewhere still reaches them. The bloat is not dead files (the static scan finds none in `src/`); it is the second and third floors, their plumbing (1,719 lines of stage and engine code beside the runtime’s 1,100), 619 GLSL sites, 17 renderer constructors, 61 frame loops, 12 post chains, and 1.7 MB of game records parsed as JavaScript on the way into Battlefront. So this design makes the floor one: **every world a module on the runtime, every module `'nodes'`, the classic renderer and the GLSL retired, the measure holding it there**, and then the two performance moves that only the one floor allows: the figures on the GPU (the 4,261 bone objects of Battlefront’s 5,617-object graph) and the frame off the main thread. Seven lanes, one Opus 5.5 session each, file ownership disjoint, every one measured before and after, every one gated by the three rules of the 2026-10-13 addendum and by the rule that a repair changes no pixel.

## 1. What was found

Measured on 2026-10-15 in the cloud container at `f97079c7`, unless a row says otherwise.

### 1.1 The size of it

| what | measured | where |
| --- | --- | --- |
| source under `src/`, tests left out | 605,667 lines in 4,112 files (3,408 `.js`, 436 `.jsx`, 446 `.json`, 142 `.css`) | `find src … wc -l` |
| tests under `src/` | 169,937 lines | the same |
| `scripts/` | 87,182 lines in 686 `.mjs`, 20,023 lines of their tests | the same |
| the biggest folders | `components/middleearth` 100,358; `components/galaxy` 78,526 (`surface/` 48,919); `components/universe` 73,566; `src/lib` 73,366 (`lib/three` 38,997); `components/rickmorty` 47,703; `components/avengers` 34,953; `components/deathstar` 28,965 | recursive `wc -l`, tests left out |
| the biggest files | `universe/scene.js` 6,147; Middle-earth’s town `props.js` files 2,380 to 4,575 (nine of them); `galaxy/surface/scene.js` 4,143; `universe/footScene.js` 3,299; `universe/crews.js` 3,179 | the same |
| the health measure | `big-files` 30 of a budget of 30 (ceiling 1,500 lines); `boundary-breaks` 479, unbudgeted; `cycles` 5, unbudgeted; `glsl-sites` 619, unbudgeted; `lint-disables` 54 of 54 | `node scripts/health.mjs --check --skip build` |
| tracked in git | 17,566 files; `public/` about 1,090 MB (`models` 588.6, `games` 129.4, `textures` 120.7, `audio` 68.7, `hq` 50.6, `eagler` 39.9, `fonts` 34.9, `kit` 16.9); `docs/superpowers/evidence` 97.9 MB; `lab/` 2.1 MB; `.git` 1.2 GB | `git ls-files -z … du -cb` |
| the build | 1,238 chunks, 28.97 MB of JavaScript, 1.01 MB of CSS, `dist/` 1.3 GB with the assets | `npm run build`, `dist/.vite/manifest.json` |

### 1.2 Three floors

The world runtime (`src/runtime/`, `2026-10-06-world-runtime-design.md`) is one renderer, one loop, the quality governor, the cadence, the renderer tier, the floating origin, the saves, the input snapshot and loss recovery, with a world module mounted on it. Eight modules are on it; everything else draws beside it.

| floor | worlds | renderer | what it has |
| --- | --- | --- | --- |
| the runtime, `'nodes'` | `earth`, `battlefront`, `galaxy/surface`, `minecraft` (`src/components/*/module.js`) | `WebGPURenderer` on a WebGPU device, or the same renderer forced onto WebGL 2 (`runtime/webgpu.js`) | the tier, the cadence, the GPU-clock resolution, TRAA and TAAU, the GPU scene, loss recovery, the post chain as data |
| the runtime, `'glsl'` | `mario64`, `expanse/flight` (/fly), `deathstar/inside`, `galaxy` (`fromScene`’s default) | the classic `WebGLRenderer` (`runtime/webgl.js` over `lib/three/renderer.js`) | the cadence and loss recovery; no tier probe (`runtime/browser.js:52-55`), no GPU clock (`runtime.js:345-352`), `EffectComposer` post |
| off the runtime | the universe map (`/` and `/universe`), Middle-earth (the map, the Shire, twelve towns), the Rick and Morty worlds, the Avengers’ compound and its nine games, Invincible, Cybertron, Scranton, Albuquerque and Metherria, the Death Star’s hero and trench run, the Caribbean, the music room, Dickansh, Dot Matrix, the classic pages’ scenes (ambience, cartridges, motifs, the paper plane, mist, the AKD stage, the globe, the GPU stage) | 17 `new WebGLRenderer` sites (`grep`, `src/`, tests left out): `lib/three/renderer.js`, `lib/stage3d.js`, `office/stage3d.js`, `avengers/hq/engine.js`, `deathstar/DeathStar3D.js`, `deathstar/Trench3D.js`, `cybertron/game/scene.js`, `cybertron/world/CybertronBackdrop3D.js`, `middleearth/MapBackdrop3D.js`, `albuquerque/metherria/scene.js`, `rickmorty/cruiser3d.js`, `rickmorty/GalaxyBackdrop.jsx`, `rickmorty/wardrobe/preview.js`, `universe/shipyard/showroom.js`, `galaxy/surface/heroStage.js`, `battlefront/backdrop/scene.js` | each its own loop (61 files call `requestAnimationFrame`), its own watchdog (`lib/three/renderer.js` 22 ms, `lib/stage3d.js` 24, `office/stage3d.js` 36, `avengers/hq/engine.js` 22 and 34, the Death Star’s 36), its own post (12 `new EffectComposer` sites), its own quality steps, its own loss handling |

The plumbing of the third floor, counted: `lib/three/renderer.js` 419 lines, `lib/three/useScene.js` 308, `lib/stage3d.js` 423, `office/stage3d.js` 180, `avengers/hq/engine.js` 389: 1,719 lines that do what `runtime/runtime.js` (802), `runtime/webgpu.js` (226) and `runtime/webgl.js` (72) do, five ways, with five thresholds. `runtime/module.js`’s `fromScene` already wraps a `useScene` scene (`create(canvas, ctx) → { render, resize, dispose, … }`) into a world module without changing it, so for the twelve `useScene` scenes the move is a wrap and a route.

### 1.3 Three copies of three.js

The build carries `three.module` (365,087 bytes: the classic renderer and the core), `three.core` (379,014: the core alone) and `three.webgpu` (690,472: the node renderer), because the classic floors import `three` and the node floor imports `three/webgpu`. A visitor who opens the universe map (classic) and goes down to Hoth (nodes) downloads all three, 1.43 MB before compression. When the last `WebGLRenderer` goes, `three.module` goes with it and every `import * as THREE from 'three'` resolves to the core alone.

### 1.4 The twins kept beside their originals

Thirty-one `*Nodes.js` twins exist (`find src -name '*Nodes.js'`): 5,037 lines of TSL. Twenty-nine have a GLSL original beside them, 5,003 lines, every one still imported by some `'glsl'` module or a world off the runtime (`shadingClosure.js`’s closure says which). `galaxy/surface/nodes/` holds 1,200 more lines of twins for the surface’s own GLSL files. The method of lane T (“the GLSL original is never edited while another world draws with it”) is right while two floors exist and is the reason the originals cannot go yet. Once every module is `'nodes'`, no reader is left and the originals, the `EffectComposer` passes, `runtime/webgl.js` and the classic make in `lib/three/renderer.js` are dead code, provable by the closure.

### 1.5 The GLSL that stands in the way, by world

`glsl-sites` counts 619 (`scripts/health/glsl-sites.mjs`: `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile`, `EffectComposer`, `ShaderPass`, `UnrealBloomPass`, `RenderPass`, `OutputPass`). The worst files: `cybertron/world/CybertronBackdrop3D.js` 18, `avengers/world/scene.js` 17, `cybertron/planet3d.js` 17. By world, from the every-world hand-off’s tables (2026-10-13) and this count: the universe map 98, Middle-earth 86, the galaxy’s module closure 54, the Avengers 48, Rick and Morty 39, Cybertron 36, Invincible 21, the Death Star’s hero and trench 15, the Death Star’s inside 13, /fly 14 (its branch `claude/perf-p1-fly` has it at 0), Albuquerque 10, Scranton 8, the Caribbean 7, Mario 64 3 (its branch `claude/perf-p1-mario64` at 0), the music room 2.

### 1.6 What is dead, and what is not

- **Files under `src/` nothing imports:** 112, 12,019 lines, by a static scan of every `import`, `export … from` and `import()` in `src/`, `scripts/`, `.github/`, `docs/` and `index.html` (`docs/superpowers/evidence/engine-floor/tools/deadfiles.mjs`). Every one is data a script reads (`data/bf2017/*.json`, the `.picture.json` and `.stages.json` rows, `data/galaxy/space/*.json`, `data/changes/*.json`), a `look.js` or `voicelines.js` a test walks by folder, or a worker made by URL (`backdrop.worker.js`, `png16.worker.js`, `signer.worker.js`, `minecraft/worker.js`). **No dead source file was found.** The bloat is not orphaned code.
- **Scripts nothing names:** nine top-level `scripts/*.mjs` that `package.json`, the workflows, `docs/`, the skills, `src/` and the other scripts never mention: `capital-check.mjs` (276 lines), `standing-check.mjs` (129), `galaxy-respawn-check.mjs` (122), `black-check.mjs` (122), `earth-plane-livery.mjs` (103), `wanted-check.mjs` (85), `outlaw-check.mjs` (70), `m64-island-check.mjs` (58), `glb-retex.mjs` (43): 1,008 lines.
- **Exports no other file names:** 531 in 324 files (`docs/superpowers/evidence/engine-floor/tools/unused-exports.mjs`, the list in `FL1/unused-exports-before.txt`; `knip` ran out of memory on this tree at 8 GB, and at 12 GB with `src/data` ignored), most of them named constants a file exports for its own reading (`src/lib/three/surface/hair.js`’s eleven melanin numbers, the rulebook readers’ rows): little weight, some tidiness. Lane FL1 works the list one folder a commit, each row read before it is cut (a name a DEV hook or a built path reaches is kept), each folder’s tests run before and after.
- **JSON parsed as JavaScript on the way into a world:** `lib/battlefront/rulebook.js:14,30` imports `data/bf2017/ai.json` (530,307 bytes) and `ui.json` (388,698) statically; `lib/bf2017/ui/screens.js:21` imports `screens.json` (755,635); `lib/bf2017/ui/index.js:28` imports `ui.json` again. The build inlines a JSON import as a module, so the `instantAction` chunk is 2,223,619 bytes and the `FrontEnd` chunk 859,669: the two biggest code chunks of the build, parsed before the first screen of Battlefront. Lane D3 already cut the 16 MB asset manifest to a slice at build (`scripts/library-slice.mjs`); the same shape fits these.
- **The 169,937 lines of tests are not bloat** (`RULES.md`: anything that can be tested without a canvas is tested). Neither are the 87,182 lines of scripts that build the assets: they are the Frostbite pipeline’s desktop half. What goes from `scripts/` is the nine files above and what `knip` proves unreachable.
- **What is heavy but not this design’s:** the 1,090 MB of assets in `public/` (the decision of 2026-10-11, “every visitor’s own GPU”, puts them in the bucket by hash; lane D3’s rest moves `models/galaxy`’s 371 MB) and the 97.9 MB of evidence pictures under `docs/superpowers/evidence/`. Moving either shrinks a fresh clone only with a history rewrite, which is the owner’s call alone (§8). This design adds the rule that stops the pile growing (§4.6).

### 1.7 Where the frame goes

Lane P0’s census (`HANDOFF-performance-lanes.md`, P4): Battlefront’s graph at play is 5,617 objects, 4,261 of them the 101 soldiers’ bones and 1,057 the placed lights’ pool, every one recomposed every frame and walked in each pass, most of the 6.7 ms of JavaScript a frame at High on the RTX 5090 against the chip’s 1.2 ms. Lane P4 (#993, open) takes the runtime’s own allocations out and measures below the noise: the frame is the graph, not the runtime. The cure is not a faster walk; it is fewer objects: the figures as instances with their palettes in one storage buffer (the Frostbite audit’s lane N8) and the light pool as a list, not a subtree.

Lane P1’s /fly port is the measured warning for every port: moved 1:1 the node renderer costs more main thread a mesh than the classic one (the research of 2026-10-13, c9: r183, 4,000 meshes, 9.7 ms against 4.5), so /fly on nodes went from 0.5 to 0.7–0.8 ms at Low and failed parity on the city twin (20.9 dB). A port is a rebuild where it must be: bundles round what never moves, instancing for what repeats, the GPU scene for a level.

### 1.8 What is in flight (do not collide)

Open pull requests on 2026-10-15: #1004 (Hoth’s ground by texel density), #1002 (Hoth’s charges), #1001 (Hoth’s doors), #1000 (Echo Base’s light), #993 (lane P4, the main thread), #984, #982 (draft, far soldiers as rows), #975, #974, #970 (drafts, Battlefront), #968 (a design), #912 (lane T2). Branches pushed without a pull request: `claude/perf-p1-fly`, `claude/perf-p1-mario64`, `claude/perf-p1-ds-inside`, `claude/perf-p2-universe`, `claude/perf-p5-pipelines`. The Hoth pull requests own `components/battlefront/` and `components/galaxy/surface/level/` until they merge; lane FL6 waits for them.

## 2. What the Frostbite reconstruction needs of the floor

Frostbite is one renderer with one frame graph, every object GPU-resident, every figure skinned on the GPU, one simulation thread beside the render thread. The reconstruction (`2026-10-11-gpu-first-renderer-design.md`) rebuilds that on three’s node renderer, and every lane of it assumes the floor it stands on: the node renderer, the runtime’s loop and cadence, the GPU scene, the stream, Rapier. Each world that is not on that floor is a world the lanes have to step round, a shared file the twins cannot retire, a renderer that pays its own way and a visitor who downloads two engines. The floor this design leaves:

1. **One renderer.** `src/runtime` makes the only renderer on the site; nothing under `src/components` or `src/lib` constructs one. The node renderer (`WebGPURenderer`) on a WebGPU device, the same renderer on WebGL 2 where there is none. No `WebGLRenderer`.
2. **One loop.** The runtime’s (`lib/three/loop.js` under `runtime.js`), on the cadence, with the quality governor and the GPU clock. A page scene that draws on its own schedule draws through `lib/shownLoop.js` (P8) and is counted.
3. **One material language.** TSL. `glsl-sites` is 0 and budgeted at 0; the GLSL originals are gone; `shadingClosure.js` stays as the test that nothing comes back.
4. **One post chain.** `gfx.post(passes)`: `lib/three/light/post.js`’s chain as data, built by `runtime/webgpu.js`. No `EffectComposer`.
5. **One world shape.** A world module (`runtime/module.js`: `{ id, mb, label, create(rt, props) → world }`); the `shading` field goes when it has one value.
6. **The measure holds it.** `renderers`, `loops`, `glsl-sites`, `boundary-breaks`, `cycles`, `client-json-kb`, `doc-binaries` budgeted and ratcheted; CI’s `--check` fails a return.

## 3. What this design does not do

- **No engine switch, no three.js upgrade.** r186 stays until a lane needs a release note (`docs/stack/three.md`, “Upgrading”). The node renderer’s face the GPU scene wraps (`gpuScene/three.js`) is the one place an upgrade is paid.
- **No world is deleted.** The owner has not said a world goes; a world the owner drops later leaves by its remover (`RULES.md`, “Worlds are islands”). What goes is the floor under it, not the world.
- **No content changes.** Not a word, model, texture or sound (`autopilot/SKILL.md`’s standing rules).
- **No history rewrite, no asset move to the bucket** beyond what lane D3 already owns. §8 puts the question to the owner with the numbers.
- **No port 1:1 that measures slower** (the addendum). A slower port is rebuilt or not merged.
- **No new dependency** without the owner’s word and a stack page first (the inventory’s own scans are scripts under the evidence folder, nothing added to `package.json`).
- **No WebAssembly threads, no renderer in a worker before the ports** (the every-world hand-off, “Not to do”), except lane FL5’s measured spike behind a flag.

## 4. The shape

### 4.1 The end state of a world

Every world is a folder under `src/components/<world>/` with a `module.js`:

```js
export default {
  id: 'middleearth-moria',
  mb: 3,
  label: 'Moria, walked through the halls under the mountain. …',
  async create(rt, props) { … return world; },
};
```

and a `look.js` (`components/worlds/looks.js`, unchanged). The page mounts it through `runtime/useWorld.js` and reads it through `rt.events`. The world draws on `rt.gfx.renderer`, compiles through `rt.gfx.compile`, posts through `rt.gfx.post(passes)`, loads through `rt.assets`, sounds through `rt.audio`, saves through `rt.saves`, reads `rt.input`’s snapshot in `step(dt, input)`, lowers itself through `lowerQuality(level)` when the governor says, and disposes everything it made. Its materials are TSL (`three/tsl`) or three’s node materials; its shared pieces come from `lib/three/*Nodes.js` renamed to their plain names once the originals go (§4.4). A HUD is the kit’s (`runtime/hud/`).

A scene written for `lib/three/useScene` becomes a module through `fromScene(id, create, { mb, label, ratio, sharpness })` today and is rewritten to the module shape only when it is next worked on; `fromScene` stays.

### 4.2 The end state of the runtime

`src/runtime/`:

- `backend.js`: two kinds, `'webgpu'` and `'nodes-webgl'`; `pickBackend({ gpu, override, lost })` (no `shading`); `readOverride` as it is. The `'webgl'` kind and the `KINDS` row go.
- `webgpu.js`: as it is. `webgl.js`: deleted. `browser.js`: `makeBackend(kind, opts)` makes `createWebGPU` for both kinds; `rendererTier` as it is.
- `module.js`: `validateModule` no longer reads `shading`; `SHADINGS` goes; `fromScene` keeps its face minus `shading`.
- `shadingClosure.js` and `shading.test.js`: kept, and run over every module (the test walks `src/components/**/module.js`), so a GLSL site anywhere in a module’s closure fails the suite.
- `runtime.js`: the `'glsl'` branches go (the classic source for the governor at `:345-352`, the tier’s `'nodes'`-only ask at `:370`): every world is probed for its tier and governed by the GPU clock.

`src/lib/three/`:

- `renderer.js`: `createRenderer` (the classic make), `precompile`, `precompilePasses`, `uploadTextures` and the 22 ms watchdog go; `fitRatio` and `maxSide` move to `runtime/gfx.js` (their one reader after the move); `quiet` goes if no reader is left.
- `useScene.js`: deleted (every page scene mounts through `useWorld`; lane FL2 gives the pages the same hook the worlds have: `useWorld(module, props, { near })`, the near-the-viewport loading `useScene` did moved into `useWorld`’s option, or a thin `useSceneWorld` beside it that wraps `fromScene` and the intersection observer; the lane decides by what the twelve page scenes need and writes it down).
- `lib/stage3d.js`, `office/stage3d.js`, `avengers/hq/engine.js`: deleted with their last world; what a world still needs of them (`stageSizing`, `stageTune`, the grade’s numbers) moves into the world’s own folder or `lib/three/house.js`.
- The GLSL originals (§1.4): deleted; each twin renamed to the plain name in the same commit (`coreNodes.js → core.js`, with `git mv` so history follows), callers updated by the rename alone, no body edited.

### 4.3 How a world comes onto the runtime (lane FL2)

For a world with its own stage (Middle-earth on `lib/stage3d`, the Avengers on `hq/engine.js`, Scranton and Albuquerque on `office/stage3d.js`, Cybertron, the Death Star, Metherria, the Rick and Morty cruiser and wardrobe):

1. Shoot the before on `main`: `node scripts/autopilot-check.mjs --before --routes <every route of the world> --shots <id>` and the world’s own check (`scripts/<world>-check.mjs` where one exists) and `node scripts/perf-probe.mjs --routes <route> --gpu webgl` (the baseline rows, kept in `docs/superpowers/evidence/engine-floor/<world>/`).
2. Write `module.js` (`shading: 'glsl'` while the classic kind exists, so the picture is the classic renderer’s and parity is exact), its `create(rt, props)` making the scene the stage used to make, on `rt.gfx.renderer`; the stage’s loop becomes `step` and `draw`; its watchdog goes (the governor is the runtime’s: `lowerQuality(level)` takes the stage’s own steps in order); its `EffectComposer` becomes `rt.gfx.post([{ kind: 'render', scene, camera }, { kind: 'bloom', … }, { kind: 'shader', material }, { kind: 'output' }])` (the `'shader'` kind exists on the classic backend and is replaced by a TSL pass at the port, FL3); its lost-context path goes (the runtime remounts); its own sounds go through `rt.audio.bus()`; its own saves through `rt.saves`.
3. The page mounts it through `useWorld` where the stage was made (the world’s `*World.jsx` or page), listens on `rt.events` for what the scene used to tell it through callbacks, and keeps its HUD as it is.
4. The universe map (`/` and `/universe`) is the precedent lane P2 began on `claude/perf-p2-universe` (its ten gaps are listed in `HANDOFF-performance-lanes.md`, P2); the session that takes it starts from that branch, merges `main`, and lands it.
5. Gates, in the pull request: the after shots of every route pixel-identical to the before (`scripts/autopilot-check.mjs`’s compare; a repair changes no pixel), the world’s check green, `perf-probe` no slower (main thread and GPU, Low and High, on the classic backend), `renderers` down by the world’s constructor sites, the stage file deleted when this was its last world, `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build` green.

A world that draws two canvases at once (the universe map and its nav map; the Rick and Morty page’s portal swirl and backdrop; the Collection’s hero stage beside Battlefront’s front end) is one module with one canvas where the second was a copy of the first (the swirl: P8 already paints it on change) and a second module in a second host where it is a different picture (the hero stage), mounted by the same page through a second `useWorld`; the runtime makes one renderer and the second module shares it as `handover` does. The lane that meets this first writes the rule into `runtime/useWorld.js`’s header.

### 4.4 How a world is ported to the node renderer (lane FL3)

The addendum’s method, with the rebuild spelled out:

1. **The closure first.** `node docs/superpowers/evidence/perf/tools/glsl-closure.mjs src/components/<world>/module.js` lists every file with GLSL the module reaches. Each shared one (`lib/three/*.js`) has a twin already (§1.4) or gets one; each of the world’s own gets a twin beside it (`<name>Nodes.js`, or the world’s `nodes.js` for several small ones), a factory returning the node material and its uniform nodes under the names the frame code writes.
2. **Parity, twin by twin.** `node scripts/twin-parity.mjs <twin>`: 32 dB and under 2 % of pixels off, or the twin is fixed.
3. **The rebuild, where the probe says so.** Before the flip, `node scripts/perf-probe.mjs --routes <route> --gpu webgl` and after it `--gpu webgpu` (and `--gpu nodes-webgl`), Low and High, main thread and GPU, worst 1 %. Slower on the main thread means too many objects walked: the fix is, in order, (a) `BundleGroup` round every subtree that never changes (a town, a room, a compound); (b) `InstancedMesh` or `BatchedMesh` for every repeated prop (the props files’ builders return one instanced mesh a kind, not a mesh a placement); (c) the GPU scene (`lib/three/gpuScene/`) for a level-sized set with the LOD cut; (d) one `Object3D` per figure, its bones a palette in a buffer (FL6’s shape, taken early for a world whose figures dominate). Slower on the GPU means the twin draws more than the original: compare the pass list (`post.js`’s `arrange`) and the material’s node count; a TSL `Fn` with a long chain gets its type (`Fn(fn, type)`).
4. **The flip.** `shading: 'nodes'` in `module.js`; the `'shader'` post passes become TSL passes in the chain; `shading.test.js` clean.
5. **The world’s parity.** `node scripts/gpu-parity.mjs <route>` on the world’s named views (`world.view(name)` in DEV, the earth module’s pattern).
6. **The gates in the pull request:** the twin table (dB, % off), the probe table (both backends, both levels), the closure at 0, `glsl-sites` down by the world’s count, the four checks green.

The order: the four on the runtime first (/fly from `claude/perf-p1-fly`, the Mario 64 tribute from `claude/perf-p1-mario64`, the Death Star’s inside from `claude/perf-p1-ds-inside`, the galaxy), then each world as FL2 lands it, the universe map first (every visit starts there), Middle-earth, Rick and Morty, the Avengers, Cybertron, then the rest.

### 4.5 The classic renderer retired (lane FL4)

When every `module.js` under `src/components` is `'nodes'` (the FL3 table full), one pull request:

1. `runtime/backend.js`, `module.js`, `browser.js`, `runtime.js` as §4.2; `runtime/webgl.js` deleted with `webgl.test.js`; `backend.test.js` and `runtime.test.js` lose their `'webgl'` rows.
2. `lib/three/renderer.js` cut to what has a reader; `useScene.js`, `lib/stage3d.js` and the two stages deleted if FL2 left them; the `EffectComposer` imports gone.
3. The GLSL originals: for each twin, `node docs/superpowers/evidence/perf/tools/glsl-closure.mjs` over every module shows no reader of the original; `git mv <name>Nodes.js <name>.js` over it; every import of `<name>Nodes` becomes `<name>`; nothing else in the diff.
4. `scripts/health/glsl-sites.mjs`’s budget to 0; `renderers` to 1; the two kinds in `docs/stack/webgpu-tsl.md` and `three.md` (“Where it is used”, “Rules”); a decision entry, `docs/decisions/2026-10-15-one-renderer.md`.
5. Gate: `grep -rn "WebGLRenderer" src` finds the runtime’s `nodes-webgl` comment and nothing else; `dist/` has no `three.module-*.js` chunk; `glsl-sites` 0; every world’s check script green on `nodes-webgl` in the container (SwiftShader) and on WebGPU on the owner’s laptop.

### 4.6 The measure (lane FL0, first)

New metrics in `scripts/health/`, each a module like the others, each with a budget at today’s value in `docs/health/budgets.json`, each in `RULES.md`:

| metric | counts | today | end |
| --- | --- | --- | --- |
| `renderers` | `new WebGLRenderer(` and `new WebGPURenderer(` in `src/`, tests and fixtures left out, outside `src/runtime/` | 17 | 0 (the runtime’s own is not counted) |
| `loops` | files under `src/` calling `requestAnimationFrame(` outside `src/runtime/`, `src/lib/three/loop.js` and `src/lib/shownLoop.js`, tests left out | measured by FL0 (61 files call it today, the three allowed among them) | 0 |
| `client-json-kb` | kilobytes of every `.json` imported statically by a file under `src/` (not a script, not a test, no `?url`), summed over files above 64 KB; the detail names each (the `-kb` suffix is `ratchet()`’s 5 kB rounding) | measured by FL0 (the four rows of §1.6 are 2,065 kB of it) | under 256 |
| `glsl-sites` | as it is | 619 | 0 |
| `boundary-breaks` | as it is | 479 | budgeted at 479; FL2 and FL3 lower it where they pass (a world’s file reaching another world’s file is the rule’s own break) |
| `cycles` | as it is | 5 | 5, lowered as met |

The ratchet (`node scripts/health.mjs --ratchet`) lowers a budget to the number when a lane lands; a lane that raises one says why in its commit (RULES.md, “Never”). Two rules added to `RULES.md`: a renderer, a loop and a post chain are the runtime’s alone (the metrics above say so); a binary over 1 MB under `docs/` goes to the bucket by hash through `scripts/assets-publish.mjs` and is linked from the evidence README, never committed (`scripts/health/doc-binaries.mjs`, budgeted at today’s count, may only fall).

### 4.7 The sweep (lane FL1)

1. The nine scripts of §1.6 deleted, one commit, after a `git log --oneline -3 -- <file>` of each is in the commit message (what it was for, when it was last touched).
2. The exports no other file names (§1.6’s list), worked folder by folder: each row read (`grep -rn` of the name; a DEV hook, a built path or a fixture that reaches it keeps it, with the reason in the lane’s README), each removed export going with the test that pinned it (a test that only tests a removed export goes with it; a test of a kept export stays); `npm test` after each folder; the scan run again at the end, its rest the exceptions, each explained.
3. The rulebook’s records out of the chunk: `scripts/data-slice.mjs`, a Vite plugin after `library-slice.mjs`’s shape, serving `virtual:bf2017-ai`, `virtual:bf2017-ui` and `virtual:bf2017-screens` as the keys the readers read (`rulebook.js`’s `ai` and `ui` reads, `screens.js`’s `BOOK` reads, `ui/index.js`’s `UI`; the lane lists the keys by reading the four files and tests the slice against the whole: every key read is in the slice, `scripts/lib/data-slice.test.mjs`), or, where a reader walks the whole record, a dynamic `import()` at the world’s `create` behind the loading screen, the data fetched as JSON (`?url`) and parsed by the browser’s parser, not the JavaScript one. Gate: `instantAction` under 600 KB, `FrontEnd` under 300 KB, `client-json-kb` down by the four rows, the Battlefront tests unchanged, the first screen of /battlefront no later (`scripts/perf-probe.mjs`’s ready time).
4. The duplicated glue: `dist/` carries `@dimforge/rapier3d/rapier.js` and `rapier3d-simd/rapier.js` at 224,664 bytes each, the same glue twice; only one loads a visit (`lib/physics/engine.js` picks by `features.js`), so nothing to do but the note here.

### 4.8 The frame off the main thread (lane FL5)

Lane P7’s spike, in new files only: `src/runtime/worker/` (`host.js` on the page: the canvas transferred as an `OffscreenCanvas`, the input snapshot, the resize and the quality level posted each frame, `rt.events` relayed back; `worker.js`: the runtime made inside the worker with `makeBackend` on the offscreen canvas, the module imported there, the world stepped and drawn there), one opt-in line in `runtime/index.js` behind `?worker=on`, the lit fixture first (`runtime/fixtures/litWorld.js`), then Battlefront. What cannot cross (the React HUD, `AudioContext`, `localStorage`) stays on the page behind the same `rt` faces, proxied by message. Gate: on the RTX 5090, Battlefront at High, `perf-probe`’s main thread ms a frame and the worst 1 % with the flag on against off; the HUD’s numbers still land through refs at the same rate; input to picture no more than one frame later. Kept only where the worst 1 % falls; else the branch is the evidence and the flag goes.

### 4.9 The figures on the GPU (lane FL6)

The Frostbite audit’s N8, now the measured biggest cost (§1.7): one `Mesh` per (rig, LOD, material group) with `count` figures; the bone palettes an `instancedArray` of `mat4` (bones × figures) written once a frame from `lib/three/animator.js`’s mixers (the animators stay on the CPU in this lane; a clip-sampling compute is the lane after); a TSL `skinning` that reads the palette by instance id; last frame’s palette kept for the velocity pass; a ragdoll’s pose from Rapier written into the same rows; the 1,057 placed lights’ pool a list the clustered node reads, not `Object3D`s in the graph. Owns `lib/three/animator.js`, `rig.js`, a new `lib/three/gpuFigures/`, and the figures’ files under `galaxy/surface/` and `battlefront/` once the Hoth pull requests of §1.8 have merged. Gate: Battlefront’s graph at play from 5,617 objects to under 1,000 (P0’s census tool); the main thread’s JavaScript a frame at High on the 5090 from 6.7 ms to under 3; the figures’ FLIP at the gallery poses unchanged; 40 and 64 figures on Hoth, `render()` CPU time before and after.

## 5. The lanes

One session each. Each owns its files alone; a lane that needs another’s file asks in that lane’s pull request or waits. Every lane merges `origin/main` before its pull request, keeping both sides, and never commits `src/data/health/latest.json`.

| lane | what | owns | starts | ends when |
| --- | --- | --- | --- | --- |
| FL0 | the measure and the ratchet (§4.6) | `scripts/health/`, `docs/health/`, `scripts/health.mjs`’s `METRICS` row | now | the six metrics budgeted, CI red on a return |
| FL1 | the sweep (§4.7) | the nine scripts; the exports the scan names; `scripts/data-slice.mjs` and its test; `src/lib/battlefront/rulebook.js`, `src/lib/bf2017/ui/` (the imports only) | now | `instantAction` under 600 KB, the scan’s rest explained, the nine gone |
| FL2 | onto the runtime (§4.3), one session a world | one world’s folder, its route in `App.jsx`, its page in `src/pages/`; the stage file when the world is its last user; `runtime/useWorld.js`’s near-viewport option (the universe map’s session, first) | now: the universe map (from `claude/perf-p2-universe`), Middle-earth, Rick and Morty, the Avengers and Invincible; then Cybertron, Scranton and Albuquerque, the Death Star, the Caribbean, the music room, Dickansh, Dot Matrix, the page scenes | every world a module on the runtime; `renderers` 0 |
| FL3 | the ports (§4.4), one session a world | the world’s folder; new `lib/three/*Nodes.js` twins (new files only) | now: /fly, the Mario 64 tribute and the Death Star’s inside (their branches), the galaxy; then each world FL2 lands | every module `'nodes'`; `glsl-sites` 0 |
| FL4 | the classic renderer retired (§4.5) | `src/runtime/`, `src/lib/three/renderer.js`, the originals’ files, `docs/stack/three.md`, `webgpu-tsl.md`, a decision | after FL2 and FL3 | no `WebGLRenderer`, no `three.module` chunk |
| FL5 | the frame off the main thread (§4.8) | `src/runtime/worker/` (new), one line in `runtime/index.js` | now | the table on the 5090; kept or dropped by it |
| FL6 | the figures on the GPU (§4.9) | `lib/three/animator.js`, `rig.js`, `lib/three/gpuFigures/` (new), the figures under `galaxy/surface/` and `battlefront/` | after #1000 to #1004 merge | the graph under 1,000, the main thread under 3 ms |

FL2’s and FL3’s sessions on the same world are the same session: a world comes onto the runtime and is ported in two pull requests by one session, so the parity before-shots are the session’s own.

## 6. Testing

- **Every lane:** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build` before a pull request (CLAUDE.md); `git checkout public/github.json` after a build.
- **FL0:** each metric’s module has its test beside it (`scripts/health/<metric>.test.mjs`: a fixture tree with a known count); `health.test.mjs` runs the table.
- **FL1:** `npm test` after each folder of removals; `scripts/lib/data-slice.test.mjs` proves every key read is in the slice; the build’s manifest read for the chunk sizes (`tools/chunks.mjs`).
- **FL2:** the before and after shots pixel-identical (`scripts/autopilot-check.mjs`, `--phone` too for a world with a touch layout); the world’s check script; `perf-probe` on the classic backend; `src/runtime/shading.test.js` passes with the new module (`'glsl'`, its closure may have GLSL).
- **FL3:** `twin-parity`, `gpu-parity`, `perf-probe` on both backends at Low and High, `shading.test.js`, `glsl-sites`.
- **FL4:** the five checks of §4.5.
- **FL5:** `perf-probe` with and without the flag; `scripts/battlefront-check.mjs` with the flag.
- **FL6:** the census tool, `perf-probe`, `frame-score` against G1’s references, `scripts/battlefront-check.mjs`.
- **In the cloud container** the browser draws in software (SwiftShader) and has no WebGPU device: the WebGPU rows are the owner’s laptop’s (Radeon 740M) and desktop’s (RTX 5090); a cloud session fills the `nodes-webgl` and `webgl` rows and leaves the WebGPU rows empty, never estimated. The Star Wars gate shows its card in software: `?software=on`.

## 7. Rollout

1. FL0 lands first (a day): the budgets are the contract every other lane is measured by.
2. FL1, FL5, and the first four FL2/FL3 sessions start the same day, disjoint.
3. FL2/FL3 sessions for the remaining worlds start as the first four merge, one session a world, in §4.4’s order.
4. FL6 starts when the Hoth pull requests merge.
5. FL4 when FL3’s table is full. The decision entry is written then, not before: the record shows what was known when.
6. Each lane fills its row in `docs/superpowers/HANDOFF-engine-floor.md` and the numbers in `docs/superpowers/evidence/engine-floor/<lane>/README.md`.

## 8. Questions for the owner

1. **The clone’s weight.** `.git` is 1.2 GB; a fresh clone carries every past version of 1,090 MB of assets and 97.9 MB of evidence pictures. Moving them to the bucket now stops the growth (§4.6’s rule) but shrinks nothing already written. A history rewrite (`git filter-repo` over `public/models`, `public/games`, `docs/superpowers/evidence`, with the bucket holding every hash first) would bring a clone under 200 MB and would break every open branch and every session’s checkout once. Do it, and when (after the open pull requests merge is the only safe moment), or leave it.
2. **The worlds.** This design keeps every world. A world the owner would drop (the inventory above says what each weighs) leaves by a tested remover as the planet flight does, and its weight leaves with it: Middle-earth is 100,358 lines and 86 GLSL sites; Rick and Morty 47,703 and 39; the Avengers 34,953 and 48. Which, if any?
3. **The merge rule.** The owner’s word of 2026-10-13 was to merge each task as it is finished. The lanes here merge when their gates and CI are green, as the autopilot does. Say so if a lane should hold for a look first.
4. **The desktop rows.** Every WebGPU number in this design is the owner’s machines’ to fill; a lane that cannot fill a row leaves it empty and says so. Who runs them, and when?
