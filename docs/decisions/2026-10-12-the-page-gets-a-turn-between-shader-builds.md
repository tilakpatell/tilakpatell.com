# The page gets a turn between shader builds, and a click on the spawn screen reaches the world

**Date:** 2026-10-12 · **Status:** accepted · **Where:** `src/lib/three/pipelineGuard.js`, `src/components/battlefront/send.js`, `src/components/battlefront/hud/battlefront.css`, `src/lib/bf2017/ui/screens.js` · **Follows:** [No frame waits for a shader on WebGPU](2026-10-12-no-frame-waits-for-a-shader-on-webgpu.md)

## Context

The owner found the Battlefront world's menus "so laggy you can't do anything" on the RTX 5090 (2560 × 720 at 200 %, Edge on WebGPU). Measured in headless Edge on that chip (`scripts/bf2017-menus-profile.mjs`, the numbers in `docs/superpowers/evidence/bf2017-menus-2026-10-12.md`):

- The front end itself (Start, the main menu, Play, the modes, the levels) paints each screen in 85 to 190 ms after a click, at the display's own frame time. It is not where the lag was.
- A click on the spawn screen's class cells did nothing: the page read `handle.world.do`, and useWorld's handle holds the world in a ref (`handle.world.current`). Only Enter, which the module's own input hears, deployed. Since the page's first day (b1420ec, 2026-10-10).
- Once the sim had taken a deploy, the HUD stood on the spawn screen for 6.2 to 8.6 s. The sim was alive at once; React's commit was not run. three's `buildAsync` yields between a build's stages with `scheduler.yield()`, whose continuations go ahead of any new task of their priority, and three's queue starts the next build in the microtask of the last one's landing, so the guard's queue was one unbroken run of continuations for as long as there were shaders to build (a hundred and more as the camera moved): no React commit, no timer, no CDP call ran until it drained. Input events still ran (they outrank everything), which is why the sim deployed on the click.
- Handing builds to three one at a time, or a few at a time, from a timer or a frame callback, did not do: a build on its own took 150 to 300 ms where the chain's take 40, and Hoth's props stayed out of the picture for 35 to 50 s instead of 6.5.
- The HUD's and the screens' fonts were Arial: `battlefront.css` declared the game's faces over `/battlefront/fonts/`, a folder removed when the drop's set moved to `public/fonts/bf2017/` (`src/lib/bf2017/fonts.css`), so each request was answered with the page itself (`sfntVersion 1008821359` is `<!do`).
- 405 pairs of sibling boxes in the game's screens share an id (the footer's two Select cells, a stack's separator lines), so React keyed children twice: a warning a render, 250 in a battle, and boxes dropped or doubled.

## Decision

1. The guard keeps three's chain (the queue handed over whole once the frame is over, as before) and breaks it every four builds for a timer task (`processInRuns` wraps `Nodes._processBuildQueue`), so React's commits and the page's timers run within four builds' worth.
2. `sendTo(handle, action, arg)` (`send.js`, tested) is the page's one way into the world, through the handle's ref.
3. The HUD names the faces `fonts.css` declares (`--font-bf-hud`, `--font-bf-numerals`) by weight; no second declaration.
4. The resolver gives a second sibling of a name the id `name#2` (`screens.js`, tested over every screen).

## Consequences

- Click to the HUD standing: 8.6 s → 0.2 to 0.75 s. The guard's drain after the spawn screen: 6.5 s → 6.6 to 7.5 s; after the deploy 0.1 → 0.15 to 0.4 s.
- While shaders build the frame still runs at 7 to 8 a second (each frame waits on the chain's run as before); the picture fills in as fast as before.
- A deploy, a pick, a squad spawn, Respawn and Quit in the in-game menu reach the world.
- The HUD and the screens draw in Univers Condensed and RaxusPrime; no font warning.

## Revisit when

- three gives its build queue a priority of its own, or yields with a macrotask: the break is then three's to make.
- The per-build cost falls (`WGSLNodeBuilder.getUniforms` is 4.4 ms a call, 2,795 calls on Hoth's load): then the run could be longer, or the frame could draw between builds.
