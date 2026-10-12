# The picture on the owner's desktop: what the RTX 5090 actually draws, and the lanes that close the gap. The design

Date: 2026-10-11 (night). Status: measured on the owner's desktop, lanes for Opus 5.5 to implement; the owner asked. Builds on `2026-10-11-bf2017-picture-everywhere-design.md` (T2, P, D2, U2, M2, G, W, R2, X2), `2026-10-11-gpu-first-renderer-design.md` (G1, N1 to N7) and `2026-10-11-frostbite-gaps-design.md` (X3, D3, V1, H1, N8, N9, N10, T3). The rules every lane keeps: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`.

## What the owner asked

Why the site on the owner's RTX 5090 does not render like an installed AAA game, with the Battlefront II (2017) assets the pipeline already has; test it, design the fix, implement it with Opus 5.5, and make it robust.

## The answer in one paragraph

The chip and the renderer are not the problem: on this desktop Edge hands both WebGL 2 and WebGPU to the RTX 5090, the site grades it ultra and tiers it T1, and the Star Wars surfaces mount on the WebGPU backend. What the surfaces draw on that backend is the problem, and it is five things, each measured. First, the game-light stack that makes the picture Frostbite's (four PCSS cascades, SSGI, GTAO, SSR, the volumetrics, the record's linear tonemap and LUT, TRAA, the clustered lamps, the Menu line that says which renderer draws) reaches the surfaces only through pull request #912 (lane T2), seventy-five files, open and conflicting with `main` since 20:44 UTC; on `main` the surfaces run the node renderer with the surface's own bloom-and-grade post and the one PCF sun. Second, the GPU-time controller of lane N2 never runs: `src/runtime/index.js` never hands `createRuntime` a `gpuClock`, so the CPU pace governs the picture from frame gaps, floors at a 0.5 internal scale while the level is still arriving, and `lib/detail.js`'s `strained()` then caps the chip at high in `localStorage` and reloads the world; on the 5090 that took under twenty seconds. Third, ultra draws the canvas at one and a half times the screen (`BUDGETS.ultra.minRatio`, the module's `ratio: 1.5`), a 3,840 × 2,160 buffer for a 2,560 × 1,440 window and 7,680 × 2,160 for the owner's monitor, and then the pace halves the chain inside it: the budget goes to pixels the eye never sees. Fourth, the desktop's own data was never made (the HDR panoramas, the Enlighten atlases, the UASTC colour row, 3,301 textures) and seven of the twenty-eight packs have no ultra row, so even with the stack on, the sky is a clamped LDR copy, the bounce is screen-space only, and the colour maps are ETC1S at 1,024. Fifth, nothing of this could be measured here before today: the dev build on the desktop had no asset base, so every pack binary came back as the SPA's index page and the level never loaded, a Windows-only path bug stopped every surface page in the dev server, and the deploy cancels itself on each merge, so the live site trails `main` by hours.

## 1. What was measured (2026-10-11, the owner's desktop)

The machine: Windows 11, an RTX 5090 (32 GB, driver 610.88), a Radeon integrated chip driving the 5,120 × 1,440 240 Hz monitor, Edge 154 the only browser. The probe: Playwright driving Edge with the gate's flags (`--use-angle=d3d11 --enable-unsafe-webgpu`), a page over `http://127.0.0.1`, headless and headed.

| what | measured | where |
| --- | --- | --- |
| WebGL 2 adapter | `ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 …)`, anisotropy 16, float targets, headless and headed alike | the adapter probe |
| WebGPU adapter | vendor `nvidia`, architecture `blackwell`; `timestamp-query`, `subgroups`, `shader-f16`, `float32-filterable`, indirect first instance; no `atomic-vec2u-min-max` | the same |
| `lib/device` | tier high, grade ultra (score 1,170), detail ultra, no cap stored in the owner's Edge profile | `classifyDevice` in the page |
| the runtime | module `galaxy-surface`, backend `webgpu` on a WebGPU device, tier `T1`, `quality.source` `cpu` | `window.__RUNTIME__` |
| the canvas at ultra, 2,560 × 1,440 | drawing buffer 3,840 × 2,160 (ratio 1.5), internal scale 0.5 within 20 s, `post.sharpness` 0.5 | the same |
| the governor | pace level 5 (past its last step), `device().auto` turned from `ultra` to `high` (`capDetail`), the world unmounted and fetched again | the report's last snapshot |
| the frame, the site's own Hoth (the level failed to load: 0 instances) | still: p50 130.6 ms, p95 206.5 ms; walking: p50 15.0 ms, p95 118 ms; 2,156 to 3,486 draw calls, 1.5 M triangles | the probe, `?quality=ultra` |
| the level in dev | every mesh and probe face `SyntaxError: Unexpected token 'm', "ml lang="e"…`: index.html served for `/models/galaxy/bf2017/levels/hoth/…` | the page's console |

The table's last two rows are the dev server's doing (section 2.5), not the site's; the run with the bucket base is recorded below as it lands.

## 2. The causes, and the lane that owns each

### 2.1 The stack is on a branch (lane L3: land #912)

`grep` finds no import of `lib/three/light/apply`, `passesFor`, `light/sun` or `createVolumetrics` under `src/components/galaxy/surface/` on `main`; the sites' files mention `applyGameLight` in comments only. `surface/engine.js`'s `postFor` picks `nodes/post.js` for the node renderer: bloom, the house grade or the record's LUT, vignette, nothing else. PR #912 adds `surface/nodes/{stack,chain,final,picture}.js`, `surface/looks/{classic,nodes}.js`, the sun through `light/sun.js` (CSM, PCSS, cloud and contact shadows), `backend.js`'s table by tier, the Menu's and the readout's renderer line, Rapier and ragdolls everywhere, and the CI shard. The lane: merge `origin/main` into `claude/bf2017-t2-flip` keeping both sides (V1's `applyVideo`, N2's `setSource`, N3's calls, D3's and X3's plugins), every gate green, the shots on the real chip, the PR left for the owner. Dispatched 2026-10-11 to an Opus 5.5 session.

### 2.2 The governor judges the wrong clock (lane L1)

`createRuntime` takes `gpuClock` (`runtime.js:84`, tested at `runtime.test.js:1000`) and `index.js` never passes it; `browser.js` makes a `createGpuTime` only for the tier probe. So `quality.setSource('gpu', { gpuTime: null })` falls back to the pace, which counts rAF gaps: a frame over 22 ms is a miss, a run with a quarter missed steps down, five runs late at the floor call `strained()`, and `strained()` caps the chip at high for good (`tp-detail-cap`). The level's cells, maps and shaders arrive over 60 to 80 s on this desktop (the pack is about 470 MB at ultra), the hold is 3 s (`WARM_UP`), and the main thread is the loader's for most of that time: the governor read a loading hitch as a weak chip. The lane: `gpuClock: (renderer) => createGpuTime(renderer)` through `browser.js` (the one line N2 left); the governor held while the level reports `ready: false` and for three seconds after; `strained()` only from the GPU clock's own median over its budget for ten seconds after ready, never from the pace on a chip whose `gpuGrade` is ultra; the cap kept a day, shown in the settings beside "Try ultra again"; the readout saying `source` (`gpu`/`cpu`), the internal scale and the drawing buffer. Tests: `runtime.test.js` (the clock given), `quality.test.js` (held while loading), `pace.test.js` (`onFloor` not called under a hold), `device.test.js` (the cap's age).

### 2.3 Pixels the eye never sees (lane L2)

`pixelRatio()` returns `max(dpr, minRatio)` under the module's cap, so a 1× screen draws at 1.5 at ultra and 1.25 at high, for the classic renderer's MSAA edges (the quality-modes design). On the node renderer the chain is temporal (TRAA, or TAAU under the controller) and anti-aliases a single-sampled history; the supersample costs 2.25× the pixels in every screen-space pass (SSGI at `high`, GTAO, SSR, the volumetrics, TRAA's history) and then the controller shrinks the chain to recover. The lane: a `'nodes'` module with a temporal chain draws its canvas at the screen's own ratio (`dpr`, under `budget.ratio`), `minRatio` kept for the classic renderer and for a node chain without a temporal pass; the controller's ceiling may then rise above 1 (`stepsAt` gaining 1.25 and 1.5 as super-resolution steps) where the GPU clock says there is room, so a 5090 at 1,440p spends its headroom inside the chain and a 4K screen starts at native. Measured on this desktop at 2,560 × 1,440 and 5,120 × 1,440: the frame p50 and p95, the scale the controller settles at, FLIP against G1's reference frames; the design's "nothing slower" rule holds.

### 2.4 The data only the desktop makes (lane L4, run here) and the seven packs (lane L5)

Lane W's jobs have never run: `docs/superpowers/evidence/bf2017-picture/w/` holds the cloud's dry runs and nothing made. The doctor on this desktop: the export, its index, encoder, uploader, depot probe and record all present; `texconv` and `toktx` absent; the bucket's keys absent from the runner's `.env` (they are in the repo's `.env.local`). The lane, run on this desktop by hand (`node --env-file=.env.local scripts/desktop/bf2017-<job>.mjs`, `TEXCONV` and `TOKTX` pointed at the binaries under `C:\Users\tilak\tools\`), in this order: `uastc` (the 220 colour maps at 2,048, kept at 3 dB or better over ETC1S), `panoramas` (the 15 skies and 16 fog gradients as RGBA16F KTX2), `depots` (the resolved share), `atlases` (the 868 Enlighten maps; they light a level only once a chart is found, lane N3's note), `textures` (the 3,301 rows), `gate` (every world at ultra on this chip, both legs, the ultra baseline). Each opens its own PR. Lane L5: `geonosis`, `kamino`, `kashyyyk`, `naboo` and their districts (`endor/{village,station,bunker}` too) rebuilt with `--ultra` and published by hash, as E1's were in #937.

### 2.5 The desktop could not measure (lane L0, this branch)

- `scripts/library-slice.mjs` (lane D3) imported `${root}/src/…` with a Windows `root`: Node's loader answered "protocol c:" and every surface page failed in the dev server on Windows. Fixed with `pathToFileURL`, as `prerender.mjs` and `packs.mjs` import; `scripts/rapier-wasm.mjs`'s `ROOT` normalised to forward slashes so a resolved id is one kind of path.
- The dev server has no asset base unless `VITE_ASSET_BASE` is in the environment: the deploy takes it from the repository variable `ASSET_BASE`; `.env.local` on the desktop lacked it, so the packs' hashed files were asked of the site's origin and the SPA fallback answered with index.html. The desktop jobs' `checkEnv` and the doctor read `ASSET_BASE` from `.env.local` or `gh variable get ASSET_BASE`; `docs/assets/battlefront-2017.md` says so.
- The doctor wants Chrome for the gate; `findChromium` already takes Edge. The doctor says which it found.
- `.github/workflows/deploy.yml` cancels the deploy in progress on each push to `main` (`cancel-in-progress: true`); on an evening of nine merges the last green deploy was #933's and the site trailed `main` for hours. The lane: `cancel-in-progress: false` (each merge deploys in turn; the `pages` group still serialises them).
- A collider with an invalid extent (`RangeError: Invalid array length` in `surface/walker.js:49` from `level/colliders.js:36`) is an unhandled rejection on Hoth at ultra: the walker refuses a box whose extent is not finite and the level says which piece.

### 2.6 After the stack lands

The Frostbite-gaps lanes stand as designed and start when #912 is on `main`: N10 (the sphere lights' radius in the material's direct term), N9 (the froxel volumetrics), N8 (the figures on the GPU: the site's own Hoth is 2,100 to 3,500 draw calls on three's per-object path, about 15 ms of main thread on this desktop while walking), T3 (the terrain clipmap). Lane L6, new: `bf2017-recipes.mjs` reads the depots' resolved texture parameters (`maps_work/shaderdepots.jsonl`: 287,596 of 287,612 material blocks resolved to texture names, read by no writer today) ahead of the suffix and folder heuristics, so Naboo's 450 unbound materials bind by the game's own word.

## 3. The lanes

| lane | what | needs first | gate | session |
| --- | --- | --- | --- | --- |
| **L0 the desktop measures** | the Windows path fixes, `VITE_ASSET_BASE` for the dev server and the desktop jobs, the doctor's Edge line, the deploy not cancelling itself, the collider guard | nothing | the probe loads Hoth's level from the bucket on this desktop; `npm test`; the dev server serves every surface on Windows | this branch, `claude/fidelity-5090` |
| **L1 the governor** | the GPU clock wired, the hold until ready, `strained()` from the chip's own time only, the cap's age and the settings' "try again", the readout's `source` and scale | L0 | `runtime.test.js`, `quality.test.js`, `pace.test.js`, `device.test.js`; on this desktop at ultra no cap within the first two minutes of Hoth; the frame p95 after ready | Opus 5.5 |
| **L2 native pixels** | the canvas at the screen's ratio on a temporal node chain; super-resolution steps above 1 under the controller | L1 | p50/p95 and the settled scale at 2,560 × 1,440 and 5,120 × 1,440 before and after; FLIP not worse | Opus 5.5 |
| **L3 land #912** | `origin/main` merged into T2 keeping both sides; gates; shots on the chip | nothing | every gate; the lit shots | Opus 5.5, dispatched |
| **L4 the desktop's data** | uastc, panoramas, depots, atlases, textures, gate | texconv, toktx | each job's PR with its evidence | this desktop |
| **L5 ultra for the seven** | `--ultra` re-runs, published by hash | L4's keys | `galaxy-check` at ultra within the rows | Opus 5.5 |
| **L6 the depots bind** | the recipes read the resolved depot parameters first | nothing | the material audit's bound share on Naboo, Kamino, Hoth | Opus 5.5 |
| N10, N9, N8, T3 | as the Frostbite-gaps design has them | L3 | their rows | Opus 5.5 |

## 4. The seams

L0 and L1 own `src/runtime/{index,quality,runtime}.js`, `src/lib/{device,detail}.js`, `src/lib/three/pace.js`, `scripts/{library-slice,rapier-wasm}.mjs`, `scripts/desktop/{bf2017-desk,doctor}.mjs`, `.github/workflows/deploy.yml`. L2 owns `src/lib/device.js`'s `pixelRatio`, `src/runtime/quality.js`'s `stepsAt`, `src/runtime/dynres.js`'s ceiling. L3 owns what #912 owns (`surface/nodes/*`, `surface/looks/*`, `scene.js`, `backend.js`, the Menu and readout) and merges `main`'s N2 and V1 through them. Where L1 and L3 both touch `runtime.js` and `quality.js`, L3 lands first and L1 merges over it. L4 writes nothing under `src/` but the picture JSONs and `shaderParams.json` its jobs own.

## 5. Risks

- L2 lowers the drawing buffer on every 1× screen; a world on the classic renderer (the low tier) keeps `minRatio`. The FLIP gate says whether TRAA at native reads softer than MSAA at 1.5× on the worlds the owner looks at.
- L1's hold on `ready` trusts the level's `progress`; a world without a level (the site's own, the mapless seven) reports ready at once, and the pace keeps its 3 s.
- L3's merge is the largest the branch has seen; the agent keeps both sides and the gates decide.
- L4's jobs read the export once and upload for hours; the desktop stays awake.
