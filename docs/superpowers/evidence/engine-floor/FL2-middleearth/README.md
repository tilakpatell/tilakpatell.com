# FL2, Middle-earth: onto the runtime

Session `session_01G8eoBfhJotc8EawZtkbnVz`, branch `claude/engine-floor-fl2-middleearth`, from the spec branch with `origin/main` merged (last at `a559e190`, with FL2 Rick and Morty’s #1019).

## What moved

`/middle-earth/:place?` is one `'glsl'` world module (`components/middleearth/module.js`), mounted by `pages/MiddleEarth.jsx` with `useWorld` in the map’s box (fixed, the window’s size). The page shows up to five pictures at once (the map behind it, a town’s stage, the kitchen, the bridge in Moria, Gorgoroth and the Ring in Mordor), each in its own box as before; they are drawn by the runtime’s one renderer in its one loop.

| before | after |
| --- | --- |
| 17 scene files on `lib/stage3d`’s `createStage`, each stage its own `WebGLRenderer`, composer, watchdog and lost-context listener | `middleearth/stage.js`: `createStage` with `lib/stage3d`’s face, on the runtime’s renderer; its chain built by the runtime (`rt.gfx.post`), multisampled half-float buffers as before; its quality steps the runtime governor’s (`lowerQuality`), on the watchdog’s ladder (sharpness, shadows, bloom, sharpness again) |
| `MapBackdrop3D.js`: a renderer of its own | a view on the world’s renderer (ACES at 1.15, as its own context had) |
| 17 components’ `useFrameLoop`, the map’s own `requestAnimationFrame` | ticks the world runs in the runtime’s loop (`middleearth/tick.js`’s `useTick`), in the order they were started, with the milliseconds since their own last frame (16 for the first), as `useFrameLoop` gave them |

**One canvas, many boxes** (`runtime/views.js`, new): a view is a box with its own canvas, its own renderer state and its own sharpness. The view drawing the most of the screen (an average of what each drew, with a margin so it doesn’t flicker between two) has the runtime’s canvas, laid under its own and clipped to it; the others draw in the canvas’s corner and are copied onto their own canvas (`drawImage`). The buffer is the lead view’s own size, grown only while a bigger view has drawn recently. A view off screen draws once and then not until it’s back. `useWorld.js`’s header says the rule: one world a page, however many pictures it shows.

**The runtime, for a second picture** (`src/runtime/`, the owner’s call in this session: “A whatever is better and good”): `views.js`; `sharpness: 'own'` modules keep their canvas’s size through a quality step (`requality`, `sharpen`); a module’s `antialias` boolean makes the backend multisampled or not (Middle-earth’s stages drew without, the map with, and in software one draws straight to the canvas). `lib/three/frameGuard.js` takes `frames(fn)`: the composer’s buffers named as frames, as `lib/stage3d` named them.

`lib/stage3d.js` stays: the Caribbean, the music room, Cybertron, Albuquerque and Rick and Morty’s three places make stages with it. Middle-earth takes only its helpers now (`hot`, `canvasTexture`, `disposeTree`, `GRADE`, `stageRatio`, `stageSizing`, `stageTune`); no file under `components/middleearth/` makes a renderer, a loop of its own for a picture, or a watchdog.

## The pixel gate

`shoot.mjs`, on each build’s `vite preview`; every place on main and on the branch, a fresh page each:

- development builds (`vite build --mode development`), for the frame guard’s switch (`window.__tpGuardOff`): every frame drawn whole, whenever a shader linked;
- Playwright’s clock installed and stopped; loading goes a frame of 16 ms at a time, with real time after each until nothing is in flight; network answers held and handed over between frames, one at a time, in the order they were asked for;
- `Math.random` seeded, and seeded again when the counted frames start; three’s own draws (its ids, `generateUUID`) from a stream of their own (each stage made a renderer of its own before, 36 draws each);
- no sound either side (a sound’s noise is drawn from `Math.random` a sample at a time; Moria’s air is 88,200 of them, and whether it was made before the shot scrolled to the kitchen was a race a frame wide);
- no CSS animation or transition;
- a town counted from its first frame (`sim.t > 0`), shot after 12 frames, judged inside its stage’s box (the map behind the page’s edges is still easing from the page’s load there); a part (the kitchens at Low, the bridge, Gorgoroth, the Ring) after 240 frames, the whole page;
- 1440 × 900, PNG, every pixel counted, no tolerance.

Main at `a559e190` and the branch at its head, two runs each:

TABLE

A shot is the same when one of the branch’s matches one of main’s pixel for pixel. Two runs of the same build don’t always match each other: where they don’t, it is the same few things on both sides (a character whose model arrived a frame sooner, its pose a frame on; the Ring, turned by `performance.now()`), and the pair that agrees on them agrees on every pixel.

**One difference is the move’s, and it is said here.** RESIDUALS

## The pace

PACE

The WebGPU rows are the owner’s machines’ (the laptop’s Radeon 740M and the desktop’s RTX 5090) and are left empty: Middle-earth is `'glsl'` until FL3.

## Checks

CHECKS

## Known, carried on

- A handover from Middle-earth (`rt.handover`) would snapshot the lead view’s canvas only; no route hands over from it.
- The map at a budget without antialiasing loses its multisampling (it had its own context’s before).
- After a lost context every picture shows its drawing again, as each did when its own context went; the page offers 3D back as before.
- `lib/three/frameGuard.js` and `src/runtime/` are outside the plan’s files: the runtime’s second picture is the owner’s decision in this session, told to the design session; P4 (#993) had merged.

## Tools

- `shoot.mjs`: the shots (`--dist`, `--out`, `--only`, `--frames`, `--part-frames`, `--quality`, `--settle`, `--quiet`, `--probe`, `--trace`, `--trace-random`, `--split-stream`, `--map3d`), and `--compare <a> <b>`.
- `pace.mjs`: the frame times, the two builds alternating (`--before`, `--after`, `--quality`, `--runs`, `--only`, `--window`).
