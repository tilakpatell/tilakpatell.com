# The render stack, and the docs for the stack: the design

Date: 2026-10-08. Lane: docs. Answers the question “is Babylon.js worth adding for performance?”, and settles how the site documents the libraries, engines and frameworks it is built on, so the next session that asks about one finds a page instead of a grep. Builds on `2026-10-08-webgpu-acceleration-design.md` (the WebGPU lane, which this design keeps) and `2026-10-06-codebase-health-design.md` (the measure and the ratchet, which this design extends).

## Part 1: three.js stays; Babylon.js is not added

### The question

Babylon.js is an engine: physics, PBR, animation blending, particles, a GUI and an inspector come in the box, and it has a WebGPU engine. The site is on three.js r186 and a session is making the runtime’s WebGPU backend reachable. Would Babylon buy performance that three.js will not?

### What was measured

Counted over `src/` and `scripts/` on 2026-10-08 (the census script in Part 2 makes these numbers a page, not a one-off):

| what | number |
| --- | --- |
| files importing `three` | 677 |
| files importing `three/examples/jsm/*` | 185 |
| GLSL sites (`ShaderMaterial` 308, `onBeforeCompile` 237, `UnrealBloomPass` 41, `EffectComposer` 40, `RenderPass` 38, `OutputPass` 35, `ShaderPass` 12) | 711 in 237 files, tests left out |
| modules under `src/lib/three/` | 60 or more, each with a test |
| skills under `.claude/skills/threejs-*` | 17 |
| source files | 2,420 under `src/`, 34 MB |

What Babylon advertises is already here, built on three.js and tested:

| Babylon has | the site has |
| --- | --- |
| physics (Havok, Cannon, Ammo plug-ins) | Rapier (`src/lib/physics/`: world, vehicle, heightfield, pusher, catch; pure, tested in Node) |
| PBR materials | `MeshStandardMaterial`, `MeshPhysicalMaterial`, and the house look (`src/lib/three/house.js`) over every lit material |
| animation blending | `src/lib/three/animator.js`, `clipLibrary.js`, `ik.js`, `gait.js`, `locomotion.js` |
| particles | `src/lib/three/explosions.js`, `puffs.js`, `flare.js`, the ambience kit’s GPU particle field |
| GUI | the HUD kit (`src/runtime/hud/`), with its rules in `docs/health/RULES.md` |
| inspector and playground | `src/lib/debugPanel.js`, `window.__RUNTIME__`, `scripts/perf-probe.mjs`, `scripts/autopilot-check.mjs`’s screenshots, the AI end-to-end evals |

### Why a swap would not pay

1. **The cost is a rewrite, not a port.** Every scene, every shared module, the frame guard (which wraps `WebGLRenderer`’s `renderBufferDirect`), the GPU work queue (fences and slices on the WebGL context), the house look (an `onBeforeCompile` patch) and 711 GLSL sites are three.js-shaped. Babylon’s scene graph, material system and shader language are its own. There is no incremental path: a world is on one engine or the other, and a site on two engines downloads both.
2. **The performance Babylon would give is the one the lane is already taking.** The measured bottleneck (`docs/research/2026-10-07-frame-hitches.md`, the WebGPU design) is draw submission on the main thread. Babylon’s WebGPU engine cuts it with render bundles (its snapshot rendering); three.js’s `WebGPURenderer` cuts it with `BundleGroup`. Same mechanism, same class of gain. Pixel cost (ratio, multisampling, bloom) is the same on either.
3. **The shader port is owed on both roads.** Babylon’s WebGPU engine runs WGSL and converts GLSL through a WebAssembly compiler at load; three.js’s runs node materials (TSL) and refuses GLSL. Either way the 711 sites are rewritten. TSL rewrites them once and draws them on WebGPU and on WebGL 2 (`'nodes-webgl'`, from the WebGPU design), so a ported world works for every visitor and the parity check compares the same materials on both.
4. **The site is a static site with per-world packs and a phone gate.** Babylon’s core is larger than three’s, and its WebGPU path adds the shader compiler. Every world is a lazy chunk measured by the budgets; a second engine’s bytes would be paid by every visitor to a world on it.
5. **Everything around the code is three-shaped**: seventeen skills, the health rules (`src/lib/three` is a layer), the handoffs, the autopilot. A new engine makes all of it wrong at once.

### The decision

three.js stays the renderer. WebGPU comes through `three/webgpu` and TSL, one world at a time, as `2026-10-08-webgpu-acceleration-design.md` lays out (the three backend kinds, the closure guard, the parity check, the ports in order of GLSL count). Babylon.js is not added, as an engine or beside one.

Revisit only if one of these turns out true: `three/webgpu` loses its WebGL 2 fallback (then a `'nodes'` world has nowhere to run for a third of visitors); or two ports in a row fail the parity check for a reason in the renderer rather than in the port. Either goes in the decision record as a new entry, not an edit of this one.

The decision is written as the first entry in `docs/decisions/` (Part 2), with this section as its body, so it is found by anyone who asks the question again.

## Part 2: the docs for the stack

### What is wrong today

- `docs/architecture.md` is 146 KB in 63 bullets, each a paragraph, shared by every session (the rule: edit only your area). Nothing in it is about a library; it is about the site’s pieces, and the three.js conventions (what `precompile` does, how a texture is sharpened, why a material is patched) are spread over its paragraphs, 60 file headers under `src/lib/three/`, and 80 specs.
- There is no page for any dependency: not which version, not why it was chosen, not where it is imported, not how to upgrade it, not what parts of it the site refuses (a `ShaderMaterial` in a `'nodes'` world; a runtime call to an asset service).
- There is no record of a decision. “Why not Babylon”, “why Rapier”, “why Nostr and no backend” live in specs that a reader finds only by knowing their names.
- `docs/` has no index. `docs/PICKUP-PROMPT.md` is the entry, and it lists folders, not pages. `docs/readme/` is pictures for the README, which surprises on first sight.
- 45 handoffs sit flat in `docs/superpowers/` beside `specs/` and `plans/`.

### The shape

Four small things, each with a rule or a measure behind it so it stays true.

**1. `docs/README.md`: the map.** One screen: what each folder under `docs/` holds and where to start for a question (a library → `stack/`; why → `decisions/`; a feature → its spec, plan and handoff; what may import what → `health/RULES.md`; the site’s pieces → `architecture.md`). `docs/PICKUP-PROMPT.md`’s “What you have” list points at it. A root `CLAUDE.md` of under 25 lines points at it too, and at `docs/health/RULES.md` and the commands to check a change; it restates no rule (the rules live where they live, and a second copy drifts).

**2. `docs/stack/`: one page per library, engine or framework.** `docs/stack/README.md` is the index: a table with one row per package in `package.json` (runtime and dev), its version, the page it belongs to, and the count of files that import it, generated between `<!-- census:start -->` and `<!-- census:end -->` by `scripts/stack-census.mjs`. Each page follows `docs/stack/_template.md`:

```
# <name>

**Version** <from package.json> · **Page owner** <the src/ folder that wraps it> · **Decision** <link into docs/decisions/, or “none recorded”>

## What it is, and why it is here
## Where it is used          (the census’s rows for this page: entry points, not every file)
## How the site uses it      (the conventions: which wrappers to go through, which parts of the API are the site’s)
## What the site does not use, and why
## Rules                     (one line each, with where the measure or test enforces it)
## Upgrading                 (the command, the checks to run after, the last upgrade and what it broke)
## Gotchas
```

The pages, grouped where a package is only ever used with another:

| page | packages |
| --- | --- |
| `three.md` | `three` (the classic renderer, `three/examples/jsm`, `src/lib/three/` as the site’s face on it: renderer, textures, gltf, precompile, frame guard, GPU work, house look, pace) |
| `webgpu-tsl.md` | `three/webgpu`, `three/tsl` (the runtime’s backends, the `'nodes'` promise and its guard, how a world is ported, the parity check, `'nodes-webgl'`) |
| `physics-rapier.md` | `@dimforge/rapier3d-compat` |
| `react.md` | `react`, `react-dom`, `react-router-dom`, `react-icons` |
| `multiplayer-nostr.md` | `@noble/secp256k1` |
| `fonts.md` | every `@fontsource/*` |
| `build.md` | `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`, `eslint` and its plugins, `globals`, `gh-pages` |
| `testing.md` | `vitest`, `playwright-core`, `fake-indexeddb` |
| `assets-pipeline.md` | `@gltf-transform/*`, `meshoptimizer`, `basisu`, `sharp`, `fflate`, `yaml`, `watlas`, `d3-geo`, `topojson-client`, `world-atlas`, `@types/*` |

`three.md` and `webgpu-tsl.md` are the deep ones (the question this design answers is about them); the rest are short, and a short page that is right beats a long one that is guessed. Every sentence on a page is traceable to a file header, a spec or the census; a page records no number the census or `package.json` does not give.

**3. `docs/decisions/`: the record.** `docs/decisions/README.md` says the shape: `YYYY-MM-DD-<slug>.md`, sections **Context**, **Decision**, **Consequences**, **Revisit when**, under 80 lines, never edited after a week (a change of mind is a new entry that links the old). The first entry is `2026-10-08-three-over-babylon.md`, from Part 1. No other decision is written retroactively in this lane; a later session adds one when it touches the choice.

**4. Two numbers in the measure** (`scripts/health/`, `docs/health/budgets.json`), so the pages and the port stay true without a person remembering:

- `stack-pages`: the packages in `package.json` (`dependencies` and `devDependencies`) that no row of `docs/stack/README.md`’s index names. Budget 0. A new dependency fails CI until its page exists, which is the rule “a dependency has a page” in `docs/health/RULES.md`.
- `glsl-sites`: the count of `RawShaderMaterial`, `ShaderMaterial`, `onBeforeCompile`, `EffectComposer`, `ShaderPass`, `UnrealBloomPass`, `RenderPass` and `OutputPass` under `src/`, tests left out, comments stripped, and the infrastructure that names those words without making them left out (`lib/three/frameGuard.js`, `lib/three/renderer.js`, `lib/three/gpuWork.js`, `runtime/*`: the same list the WebGPU design’s guard exempts, so the two agree). Budgeted at today’s number; each port lowers it; the ratchet keeps it down. This is the WebGPU lane’s progress bar, and the number `webgpu-tsl.md` quotes.

`scripts/stack-census.mjs` is pure over a file list (the health context’s `walk`), so it is tested on the health fixture tree; `--write` rewrites the index’s block, `--check` exits 1 when the block is stale (the steward runs it; CI does not, so a dependency bump does not fail CI twice).

### What does not change

- `docs/architecture.md` gets one sentence at the top pointing at `docs/stack/` and `docs/decisions/`, and nothing else moves out of it in this lane. (Moving its three.js paragraphs onto `three.md` is a later repair for the steward, one paragraph at a time, each a link left behind.)
- The handoffs stay where they are. A move of 45 files breaks 45 links across specs, the autopilot skill and open pull requests for no reader’s gain this week.
- The WebGPU lane’s files (`src/runtime/backend.js`, `webgpu.js`, `runtime.js`, `shading.test.js`, `scripts/gpu-parity*`, `scripts/perf-probe.mjs`, `docs/superpowers/HANDOFF-runtime.md`) are another session’s. This lane does not touch them; `webgpu-tsl.md` describes them as they are on `main` when it is written, and names the lane’s design for what is coming.
- `README.md`’s “Tech stack” list gains one line linking `docs/stack/`.

### Testing

- `scripts/health.test.mjs`: `stack-pages` on a fixture `package.json` and index (one package missing → value 1, named in the detail); `glsl-sites` on the fixture tree (a file with two sites, a test file ignored, a commented site ignored, an exempt path ignored).
- `scripts/stack-census.test.mjs`: the census over the fixture tree finds static, dynamic and `export … from` imports, counts a file once per package, maps a subpath (`three/examples/jsm/…`, `@gltf-transform/core`) to its package, and `--check` reports stale against a given index.
- `docs/stack/*.md`: a test (`docs/stack/stack.test.js`, in Vitest’s run) that every page has the template’s seven headings in order, that every package in `package.json` is in the index table, and that every path a page names in backticks under `src/` or `scripts/` exists. A page that names a file that moved fails the suite, which is how the pages stay true.
- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green on every pull request.

### Rollout

Two pull requests. The first: the map, the template, the index with its census, `three.md`, `webgpu-tsl.md`, the decision record with its first entry, the two metrics with their budgets, the rule line, the `CLAUDE.md` pointer, the one-line links in `README.md` and `architecture.md`. The second: the seven shorter pages. Each merges on its own, CI green, with a merge commit.
