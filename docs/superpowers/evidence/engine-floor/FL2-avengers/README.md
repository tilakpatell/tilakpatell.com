# FL2, the Avengers and Invincible: onto the runtime

Lane FL2 of the engine floor (`docs/superpowers/specs/2026-10-15-engine-floor-design.md`, §4.3) for the Avengers’ compound, its eight games and Titan (`/avengers`) and Invincible’s city, game and cast viewer (`/invincible`): thirteen HQ games, each a `'glsl'` world module drawn by the runtime’s renderer and loop, `avengers/hq/engine.js` deleted. Branch `claude/engine-floor-fl2-avengers`, from `claude/engine-floor-spec` at `5f5f71f75` (main at `f97079c7` and the design’s documents). Everything below was measured in the cloud container (headless Chromium, SwiftShader WebGL); the WebGPU rows are the owner’s machines’ and are left empty.

## What moved

| before | after |
| --- | --- |
| `avengers/hq/engine.js`: a `WebGLRenderer`, an `EffectComposer` (render, bloom, output), a watchdog (22 ms, then 34 ms to onSlow) and a lost-context listener for each game | `hq/stage.js`: the same face on `rt.gfx.renderer`, the chain through `rt.gfx.post`, the renderer state it needs held while it draws and given back after; `hq/tiers.js`: the engine’s tiers as `lowerQuality(level)` steps in the watchdog’s order, the runtime’s floor saying slow as onSlow did |
| `hq/useStage.js`: one live view a page, its own canvas, built by `mod.create(canvas)` | the same arbitration (`useLive`), the live view mounted as a world module through `runtime/useWorld` (`hq/module.js`’s `hqModule`, one `module.js` a game) |
| thirteen `useFrameLoop` loops, one a page | none: each page’s frame is run by its world’s `draw`, inside the runtime’s loop (`useStageFrame`) |
| the compound and the city made once and kept while a game draws | the same: their modules keep the world while their page wants it (`keep`), so coming out of a building builds nothing again |
| Invincible reaching into `avengers/hq/useStage.js` | through `avengers/shared/runtime.js` (a test pins its names) |

## The pictures: the same, pixel for pixel

`tools/hq-shots.mjs` shoots each game’s opening on Vite’s dev server with the page’s clock installed and stopped, and the page made the same on every run:

- the frame counted is the game’s own: its engine’s `render` is wrapped as soon as it’s there, and the shot is taken after exactly 90 of its frames;
- `Math.random` is a sequence for each file that calls it, every sequence started again before the game’s first frame;
- the page’s time (its frames’ timestamps and `performance.now`) is set to T0 by that first frame;
- each frame waits until the network is quiet, and the game gets three seconds of real time before its first frame, so what it loads lands at the same frame each run;
- the frame guard is off (`window.__tpGuardOff`): it holds a material back until its shader has linked, and that runs on the chip’s own real time.

Each change to the harness answered a difference that main showed against main, so the harness was proven on main before it judged the branch. `--compare` counts the pixels that differ at all (a difference of 1/255 counts).

1280 × 800, `?quality=low` (main = `5f5f71f75`, after = the branch’s head):

| game | main against main | after against main |
| --- | --- | --- |
| compound | 64 px | 2 px (see below) |
| repulsor (Tony’s workshop) | 0 | 0 |
| lawn (Mjolnir) | 0 | 0 |
| ricochet (the training center) | 0 | 0 |
| trickshot (Clint’s range) | 0 | 0 |
| widow (operations) | 0 | 0 |
| smash (Bruce’s lab) | 0 | 0 |
| thwip (the gatehouse) | 0 | 0 |
| tesseract (the hangar) | 0 | 0 |
| titan | 2 px | 0 against the second main run |
| invworld (the city) | 0 | 0 |
| thinkmark | 887 px | 0 against the first main run |
| viewer | 0 | main draws it blank: see below |

`?quality=high` (bloom and four samples on: the chain’s targets and the bloom pass are the parts of the stage that changed most): every game 0 against main except the compound’s same 2 px. Main’s viewer has no engine hook to count by, so it isn’t in that run.

- **The compound’s 2 px** are at (7, 789) and (7, 794), on the anti-aliased edge of an HTML pill drawn over the canvas. They differ between main’s own runs too (64 px main against main; a different pixel of the same edge in the second run).
- **Titan and Think, Mark!** each have two outcomes on main (2 and 887 px apart). The after equals one of them exactly.
- **The cast viewer is blank on main.** `useStage` measured the box `.hq-screen`, and the viewer’s box is `.gda-screen`, so its canvas was never sized: 300 × 150 under a 510 × 638 box (`shots/viewer-main.webp`). On the runtime the box is measured for every world, and the viewer draws its figure (`shots/viewer.webp`).
- **A probe of main with only that box fixed** (and the viewer given the dev hook the others have, commits `cf720f20c` and `8e97c10fa`, never merged) has the same camera, box, turntable angle (0.5056 rad at its first frame) and plinth as the after. The figure’s pose still differs. `lib/three/rig.js` seeds each figure from a page-wide count of figures made (`made++`), and which views had been built earlier on the page differs. That is the likely cause; it is not proven.

The shots: `shots/<game>.webp` (the after, 960 × 600; the full PNGs are not committed).

## Checks

- `scripts/hq-world-check.mjs` (the compound’s nine named shots) and `scripts/inv-world-check.mjs` (the city’s views and every mission run to its end): both pass with no errors on the branch. `hq-world-check.mjs`’s HUD-less shots now keep `.cw-canvas` (the box the runtime’s canvas goes in) where they kept the bare canvas.

- `npm run lint`: clean.
- `npm test`: after merging main, 1,514 files pass, none failing. Before the merge, two timing tests had failed with the browser running alongside, and passed alone or on the next run.
- `npm run build`: green.
- `node scripts/health.mjs --check --skip build`: within budget, after merging main. `renderers` is 15 (budget 16), `glsl-sites` 607 (budget 619), `boundary-breaks` 487 (budget 489; 479 → 477 before main’s own additions).
- Renderer constructors outside `src/runtime/`: 16 → 15. `new EffectComposer` sites: 12 → 11. The HQ pages’ `useFrameLoop` loops: 13 → 0.
- `src/runtime/shading.test.js`: green (the modules are `'glsl'`).

## The probe

`scripts/perf-probe.mjs avengers` (the default 1470 × 956 at 2×), main’s dev server against the branch’s, three runs a side and level, in the container. The phase is `move`: the compound walked once it’s up.

| quality | side | main-thread ms a frame | p50 ms | draws | worst 1 % ms |
| --- | --- | --- | --- | --- | --- |
| low | main | 6.1, 6.8, 6.6 | 6.6, 8.6, 7.8 | 189, 188, 190 | 37,010, 39,348, 38,409 |
| low | branch | 6.4, 6.4, 6.3 | 7.8, 8.0, 7.8 | 192, 192, 192 | 36,817, 37,951, 39,167 |
| high | main | 7.7, 12.6, 10.1 | 10.8, 22.4, 13.6 | 354, 351, 359 | 225,195, 228,431, 229,636 |
| high | branch | 8.3, 9.4, 6.6 | 9.7, 10.2, 8.7 | 402, 364, 394 | 220,440, 229,565, 226,990 |

Once it’s up it is no slower: main-thread time a frame is 6.5 against 6.4 ms at low and 10.1 against 8.1 ms at high. The worst 1 % on both sides is one software frame of tens of seconds, the same on each.

**Its first frame is later.** Time to the first frame, on the production build (`vite build`, `vite preview`), measured by when frames reach the canvas, four runs each at low:

| | main | branch |
| --- | --- | --- |
| the prepare’s warm draw | 16.7, 16.6, 16.8, 17.6 s | 18.2, 17.7, 19.8, 20.4 s |
| the first frame after it | 29.4, 23.5, 22.9, 25.0 s | 27.6, 26.7, 29.5, 31.8 s |

That is about 2 s later to the warm draw and 2–4 s later to the first frame. Two causes were found and fixed on the way:

- The runtime sized the canvas only once it placed the world, after the prepare. In software that resize waited 8.2 s on all of the prepare’s work. The module now sizes the canvas before preparing, as the engine did (0.4 s).
- `useLive` waited 240 ms of quiet scrolling even with no view live.

What is left sits between the mount and the module’s `create`. On the dev server the runtime’s backend took 2.3 s to come up there (its modules loading). In production the branch loads 13 more scripts (+40 kB compressed; no WebGPU chunk) and the scene’s chunks start about 170 ms later. The rest was not pinned down here. The owner’s machines say whether it shows on a real chip.

Once up, the branch also draws more often in software (its frames reached the canvas about 1.5 s apart against main’s about 9 s), because the runtime’s governor softens the canvas where main’s watchdog stepped its tiers.

The city (`/invincible`) has no probe journey. The one tried here waited for the city’s canvas and then measured the page (one draw, ready in 1.6 s on both sides), so it was taken out. The city’s check (`scripts/inv-world-check.mjs`) runs every mission to its end on the branch, with no page errors.

## Not done here

- The WebGPU rows: the owner’s laptop and desktop.
- An Invincible journey for the probe: the one tried waited for the city’s canvas and measured the page, so it was taken out.
