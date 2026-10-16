# Engine floor, lane FL3: a world ported to the node renderer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One world module, the session’s argument, flipped to `shading: 'nodes'`: every GLSL site in its import closure twinned in TSL, each twin within parity, the world no slower on the node renderer than on the classic one (rebuilt its way where it was), `glsl-sites` down by the world’s count.

**Architecture:** Lane T’s method (`docs/superpowers/plans/2026-10-10-galaxy-engine-laneT-surface-port.md`): a twin is a new file beside a shared original (`src/lib/three/<name>Nodes.js`) or the world’s own `nodes.js`, a factory returning the node material and its uniform nodes under the names the frame code already writes; the original is never edited; the module flips last. Where the probe says the node renderer is slower, the world is rebuilt first: `BundleGroup` round what never moves, instancing for what repeats, the GPU scene for a level.

**Tech Stack:** `three/webgpu`, `three/tsl` (r186), `src/runtime/webgpu.js`’s `buildPostProcessing` and `lib/three/light/post.js`’s chain, `scripts/twin-parity.mjs`, `scripts/gpu-parity.mjs`, `scripts/perf-probe.mjs`, `docs/superpowers/evidence/perf/tools/glsl-closure.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-15-engine-floor-design.md`, §4.4; the rule for every port is the addendum of `2026-10-08-webgpu-acceleration-design.md`.

## The worlds, in order

| world | module | branch to start from | closure’s GLSL files (2026-10-13) | known state |
| --- | --- | --- | --- | --- |
| /fly | `components/expanse/flight/module.js` | `claude/perf-p1-fly` | 0 on the branch (14 on main) | **slower on nodes** (main thread 0.5 → 0.7–0.8 ms at Low); the city twin fails parity (20.9 dB, 2.58 % off, console errors); the world 29.1 dB on WebGL 2: rebuild (the city instanced, the ground in a bundle), then the gates |
| the Mario 64 tribute | `components/mario64/module.js` | `claude/perf-p1-mario64` | 0 on the branch (3 on main) | not checked in a browser; `cfe1a4365` is its parity before-ref with views `grounds,castle,bobomb` |
| the Death Star’s inside | `components/deathstar/inside/module.js` | `claude/perf-p1-ds-inside` (may be behind; else from `main`) | 13 | explosions and dye in `lib/three` have no twin yet |
| the galaxy | `components/galaxy/module.js` (`fromScene`’s default) | `main` | 54 | the biggest: `lib/three/atmosphere` has no twin; it borrows the cockpit’s vehicles and space, the Rick and Morty cruiser (`cruiser3dNodes.js` exists), the wardrobe’s dress (twin exists), the portal toon (twin exists), `meshyCast` (twin exists) |
| then, as FL2 lands each | the universe map (98 sites), Middle-earth (86), Rick and Morty (39), the Avengers and Invincible (48 and 21), Cybertron (36), Scranton and Albuquerque (8 and 10), the Death Star (15), the Caribbean (7), the music room (2), the page scenes | | | |

## Global Constraints

- A twin passes at 32 dB and under 2 % of pixels off by more than 16/255 (`scripts/gpu-parity/diff.mjs`’s `passes`), on the `webgl` leg (`nodes-webgl`) in the container; the `webgpu` leg is the owner’s machines’ and is marked skipped, never estimated.
- The GLSL original is not edited; a twin is a new file.
- `scripts/perf-probe.mjs` on both backends, Low and High: no worse on the main thread’s median or the worst 1 % on `nodes-webgl` than on `webgl`; a slower world is rebuilt before it is flipped.
- `src/runtime/shading.test.js` green after the flip (the closure has no GLSL); `glsl-sites` down by the world’s count.
- A `'shader'` post pass (the stage’s grade) becomes a TSL pass in `lib/three/light/post.js`’s chain (a new kind only if the chain lacks one; `post.js`’s `arrange` and `passes.js` are lane-shared files: a new kind is added, never a changed one).
- A long TSL `Fn` gets its type (`Fn(fn, type)`) (three #34434).
- Pull requests #1000 to #1004 own `components/battlefront/` and `components/galaxy/surface/level/`.
- The four checks before the pull request; `git checkout public/github.json`.

## Review Focus

1. A uniform the frame code writes by name (`material.uniforms.uTime.value = t`) must have a twin that exposes the same name as a uniform node (`twin.uniforms.uTime.value = t`); a renamed uniform is a silent freeze.
2. A material the world replaces at run time (a damage state, a highlight) must come from the same factory, or the replaced one is classic again on the first frame.
3. `onBeforeCompile` patches that read `shader.vertexShader` to inject wind or fade become `positionNode`/`colorNode` compositions on the node material: the test is parity, not the code’s shape.
4. A world’s `EffectComposer` with a `ShaderPass` whose shader reads `tDiffuse` becomes a `PostProcessing` node: the output transform is the renderer’s own on this backend, so an `OutputPass` is dropped, not twinned.
5. A `BundleGroup` must hold only what never changes: a bundled object whose matrix the frame moves draws where it was.

---

### Task 1: The branch and the closure

- [ ] **Step 1:** `git fetch origin main && git checkout -B main origin/main && npm ci`; `git checkout -b claude/engine-floor-fl3-<world> <start branch>`; `git merge origin/main` keeping both sides.
- [ ] **Step 2:** `node docs/superpowers/evidence/perf/tools/glsl-closure.mjs src/components/<world>/module.js` → the files and their sites, into `docs/superpowers/evidence/engine-floor/FL3-<world>/README.md`.
- [ ] **Step 3:** For each file: a twin exists (`<name>Nodes.js` beside it, or under `galaxy/surface/nodes/`) → note it; none → it is this lane’s to write (Task 2).
- [ ] **Step 4:** The before: `node scripts/gpu-parity.mjs <route> --before origin/main` (the pictures on the classic renderer, at the world’s `view(name)`s; a world with no `view` gets one in DEV first, as `earth/module.js` does, named for its fixed spots) and `QUALITY=low node scripts/perf-probe.mjs <journey>` then `QUALITY=high`; both into the README.
- [ ] **Step 5: Commit** `FL3 <world>: the closure and the before`.

### Task 2: A twin (one per file without one)

**Files:**
- Create: `src/lib/three/<name>Nodes.js` (shared) or `src/components/<world>/nodes.js` (the world’s own, several small ones in one file)
- Create: `scripts/twin-parity/cases.js` gains a case (the original’s material on a fixture mesh, the twin’s on the same, the same lights and camera; `scripts/twin-parity/cases.js`’s existing cases are the shape)
- Test: `src/lib/three/<name>Nodes.test.js` (the factory returns a material whose `isNodeMaterial` is true and whose uniform nodes carry the original’s names; `src/lib/three/coreNodes.test.js` is the shape)

**Interfaces:**
- Produces: `export function make<Name>(opts) → { material, uniforms: { <the original’s uniform names>: UniformNode } }`, the same `opts` as the original’s factory; where the original exported a `patch(material)` (an `onBeforeCompile` patch), the twin exports `with<Name>(material) → material` composing `positionNode`/`colorNode`/`opacityNode`.

- [ ] **Step 1: Write the failing test** (names and `isNodeMaterial`).
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement** the twin in TSL: each GLSL function a `Fn` with its type; textures through `texture()`; time through `uniform(0)`; the original’s defines as module constants.
- [ ] **Step 4: Run** the unit test → passes; `node scripts/twin-parity.mjs <case>` → ≥ 32 dB, < 2 % off (the table row into the README); under the line: fix the twin (the usual misses: colour space on a sampled map, `fract` against `mod`, a `smoothstep` edge order, the normal’s space), never the original.
- [ ] **Step 5: Commit** `FL3 <world>: the <name> twin (<dB> dB, <%> off)`.

### Task 3: The rebuild (only where the probe says so)

**Files:**
- Modify: the world’s scene file(s) and its props builders (the world’s folder only)

**Interfaces:**
- Consumes: `three/webgpu`’s `BundleGroup`, `InstancedMesh`, `BatchedMesh`; `src/lib/three/gpuScene/` (`createGpuScene`, the shape `galaxy/surface/level/levelGpu.js` uses) for a level-sized set.

- [ ] **Step 1:** With the twins wired but the module still `'glsl'`, switch the module to `'nodes'` on a scratch commit and run `GPU=webgl QUALITY=low node scripts/perf-probe.mjs <journey>` (the `nodes-webgl` row) against the before; then `QUALITY=high`. No slower → skip to Task 4, drop the scratch commit.
- [ ] **Step 2:** Slower on the main thread: count the graph (`docs/superpowers/evidence/perf/tools/bf-census.mjs` takes a route) → the subtree counts into the README. In order: (a) every subtree that never changes (a town, a room, a compound, the ground) under one `BundleGroup`; (b) every props builder that returns a mesh a placement returns one `InstancedMesh` a kind (the builder’s signature kept, its return a group of instanced meshes: callers unchanged); (c) a level-sized set (thousands of placements) through the GPU scene; (d) figures: one `Object3D` a figure. Measure after each; stop when no slower.
- [ ] **Step 3:** Slower on the GPU: `post.js`’s pass list for the chain (the `--post on` row of `scripts/light-fixture.mjs` prints it) against the classic composer’s passes; a pass the classic side never ran is turned off for this world through its module’s chain description; a twin with a deeper node graph than its original is simplified (a typed `Fn`, a shared `varying`).
- [ ] **Step 4:** `node scripts/gpu-parity.mjs <route>` → the world still within the line on the `webgl` leg (a rebuild changes no picture).
- [ ] **Step 5: Commit** `FL3 <world>: rebuilt for the node renderer (<before> → <after> ms)` per step that landed.

### Task 4: The flip

**Files:**
- Modify: `src/components/<world>/module.js` (`shading: 'nodes'`; the chain description’s `'shader'` passes replaced by their TSL kinds)
- Modify: `src/runtime/shading.test.js` if it lists modules by name (it walks; nothing to add)

- [ ] **Step 1:** Flip; `npx vitest run src/runtime/shading.test.js` → green (every file in the closure clean).
- [ ] **Step 2:** `node scripts/gpu-parity.mjs <route> --view <names>` → every view passes on the `webgl` leg; the `webgpu` leg marked skipped in the container.
- [ ] **Step 3:** `GPU=webgl QUALITY=low node scripts/perf-probe.mjs <journey>`, `QUALITY=high`, and the same with `GPU=webgpu` (skipped in the container: the owner’s rows) → the tables into the README, no worse than Task 1’s before.
- [ ] **Step 4:** `node scripts/health.mjs --only glsl-sites` → down by the world’s count; the world’s own check(s) green (`?gpu=webgl` where a check takes a query).
- [ ] **Step 5: Commit** `FL3 <world>: on the node renderer`.

### Task 5: The pull request

- [ ] `git fetch origin main && git merge origin/main`; `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`; `git checkout public/github.json`.
- [ ] Push; open the pull request with the twin table, the parity table, the probe tables and the closure; FL3’s row for the world in `docs/superpowers/HANDOFF-engine-floor.md`; the every-world hand-off’s table row struck through with the pull request’s number; merge when CI is green.
- [ ] If the `webgpu` rows are empty (the container), say so in the pull request and in the hand-off: the owner’s laptop and desktop fill them; a world slower there is reopened by the owner’s word.
