# FL2, Middle-earth: onto the runtime

Session `session_01G8eoBfhJotc8EawZtkbnVz`, branch `claude/engine-floor-fl2-middleearth`, from the spec branch with `origin/main` merged (last at `a559e190`, with FL2 Rick and Morty’s #1019).

## What moved

`/middle-earth/:place?` is one `'glsl'` world module (`components/middleearth/module.js`), mounted by `pages/MiddleEarth.jsx` with `useWorld` in the map’s box (fixed, the window’s size). The page shows up to five pictures at once (the map behind it, a town’s stage, the kitchen, the bridge in Moria, Gorgoroth and the Ring in Mordor), each in its own box as before; they are drawn by the runtime’s one renderer in its one loop.

| before | after |
| --- | --- |
| 17 scene files on `lib/stage3d`’s `createStage`, each stage its own `WebGLRenderer`, composer, watchdog and lost-context listener | `middleearth/stage.js`: `createStage` with `lib/stage3d`’s face, on the runtime’s renderer; its chain built by the runtime (`rt.gfx.post`), multisampled half-float buffers as before; its quality steps the runtime governor’s (`lowerQuality`), on the watchdog’s ladder (sharpness, shadows, bloom, sharpness again) |
| `MapBackdrop3D.js`: a renderer of its own | a view on the world’s renderer (ACES at 1.15, as its own context had) |
| 17 components’ `useFrameLoop`, the map’s own `requestAnimationFrame` | ticks the world runs in the runtime’s loop (`middleearth/tick.js`’s `useTick`), in the order they were started, with the milliseconds since their own last frame (16 for the first), as `useFrameLoop` gave them |

**One canvas, many boxes** (`runtime/views.js`, new): a view is a box with its own canvas, its own renderer state and its own sharpness. The view on screen drawing the biggest buffer (an average of what each drew, with a margin so it doesn’t flicker between two: the view a copy would cost most) has the runtime’s canvas, laid under its own and clipped to it; the others draw in the canvas’s corner and are copied onto their own canvas (`drawImage`). The buffer is the lead view’s own size, grown only while a bigger view has drawn recently. A view off screen draws once and then not until it’s back. `useWorld.js`’s header says the rule: one world a page, however many pictures it shows.

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

Main at `a559e190`, shot five times over the two days (twice with the final tool, `FM1`, `FM2`; three times before sound was off, `B1` to `B3`), and the branch’s final build (`e7cced39`: the merge after it changes nothing Middle-earth draws through but one line of the runtime’s loop), shot twice. Pixels that differ (a town inside its stage, 1440 × 740; a part, the whole page):

| shot | the branch against main, the closest of main’s shots | main against itself, the furthest two of its shots |
| --- | --- | --- |
| the map (`/middle-earth`) | **0** | 0 |
| Bree’s kitchen | **0** | 0 |
| Weathertop’s kitchen | **0** | 0 |
| Edoras | **0** | 0 |
| Minas Tirith | **0** | 0 |
| Mordor | **0** | 0 |
| Moria | **0** | 0 |
| Orthanc | **0** | 0 |
| Gorgoroth | **0** | 0 |
| Amon Hen | **0** | 49,939 |
| Amon Hen’s kitchen | **0** | 4,951 |
| Rivendell | **0** | 181,973 |
| the Dead Marshes | **0** | 432 |
| the Dead Marshes’ kitchen | **0** | 235,668 |
| Mordor’s kitchen | **0** | 948 |
| Moria’s kitchen | 3 | 77,136 |
| the bridge | 2 | 6,515 |
| Lothlórien | 29,511 | 0 |
| Cirith Ungol | 5,322 | 0 |
| Cirith Ungol’s kitchen | 362 | 8,402 |
| Lothlórien’s kitchen | 404 | 6,017 |
| Rivendell’s kitchen | 657 | 7,084 |
| the Ring | 787 | 2,798 |
| Bree | 72 | 738 |
| the Shire | 67 | 456 |
| Weathertop | 87 | 156 |
| the Shire’s kitchen | 256,040 | 257,760 |

15 of 27 are the same pixel for pixel as one of main’s.

Where main’s own shots differ from each other, the branch’s land among them: the kitchens of Cirith Ungol, Lothlórien and Rivendell and the Ring by hundreds of pixels (a town above a kitchen, out of view, shows a frame from its loading; the Ring turns by `performance.now()`), Bree, the Shire and Weathertop by tens at their figures’ edges, and the Shire’s kitchen by a quarter of a million in the town above it, where main’s furthest two shots differ by more.

**The differences that are the move’s, and why.** None is a picture drawn otherwise; each is said here, not tolerated.

- *A figure’s seed.* `cast3d.js`’s `upgrade` gives each figure its clocks from a page-wide count (`upgrades++`: “two of one figure … never breathe or step together”), so the order two scenes on the page are built in sets every figure’s idle. That order is which scene’s code arrives first. The branch’s town code no longer imports the passes (the runtime’s chunk has them), so in Lothlórien the town is built before the kitchen, where on main the kitchen came first; in Cirith Ungol, the same race, moved by main’s own sweep merged in (the branch before the merge was 0 there). With the count taken out of the seed on both sides (`upgrades++, 0`, a build of each, not committed), Lothlórien and Cirith Ungol are 0 pixels, main against the branch. The fix that would end it is the seed’s (a figure’s own, not the page’s order), and it changes main’s pictures: not this lane’s.
- *An edge over a copy.* Moria’s kitchen (3 pixels, each 1 off) and the bridge (2 pixels: the corner of the page’s badge at the bottom left, at (7, 889) and (7, 894); Gorgoroth and the Ring had the same two before the canvas went to the costliest view, and are 0 there now): a CSS edge antialiased, or a backdrop blurred, over a picture that is a 2D canvas (a view copied, `drawImage`) where it was a WebGL canvas. The picture under them is the same pixel for pixel; the compositor blends its edge with it otherwise.
- *Rivendell’s kitchen* (657 pixels from the nearest of main’s, in the top 30 rows) is the loading race the paragraph above names, not traced further: with the seeds’ count taken out it is still 764, and the loading’s frames come one sooner on the branch (the kitchen draws at frame 20 where main’s drew at 21).

## The pace

`pace.mjs`: each build’s production `vite preview` (`P-main` at `a559e190`, the branch at `e7cced39`), 1440 × 900, the place loaded, scrolled to, settled 8 s, then a window of real time: the page’s frame intervals (a `requestAnimationFrame` loop of the probe’s own) and the main thread’s time a frame (CDP’s task duration over the window). The two builds alternate, two runs each. SwiftShader: a town at High is seconds a frame, so these say “no slower in software” and no more.

The towns at High, a 40 s window:

| place | main, p50 (ms) | branch, p50 (ms) | main, frames | branch, frames |
| --- | --- | --- | --- | --- |
| Moria | 2,099.9 / 2,033.2 | 2,100.0 / 2,099.8 | 16 / 19 | 18 / 15 |
| the Shire | 4,099.9 / 4,366.5 | 2,549.9 / 1,549.9 | 8 / 8 | 14 / 21 |
| Bree | 16,666.0 / 9,583.0 | 8,383.1 / 6,966.3 | 4 / 6 | 5 / 7 |

Low, a 12 s window:

| place | main, p50 (ms) | branch, p50 (ms) | main, frames | branch, frames |
| --- | --- | --- | --- | --- |
| the map (`/middle-earth`) | 33.3 / 33.3 | 33.2 / 33.3 | 461 / 466 | 476 / 456 |
| Bree | 1,999.9 / 1,933.3 | 1,183.2 / 2,383.3 | 7 / 7 | 9 / 5 |
| the Shire | 983.4 / 966.7 | 683.4 / 699.9 | 12 / 12 | 18 / 18 |
| Moria | 516.5 / 499.9 | 533.3 / 500.0 | 22 / 23 | 22 / 24 |
| Bree’s kitchen | 1,350.0 / 1,400.0 | 1,516.7 / 1,400.0 | 10 / 8 | 7 / 10 |
| the bridge | 616.6 / 583.3 | 266.7 / 283.3 | 20 / 20 | 43 / 42 |
| the Ring | 383.3 / 400.0 | 166.7 / 166.7 | 30 / 30 | 70 / 68 |

High, a 12 s window: the map 33.3 either side; the bridge 1,666.6 / 1,599.8 on main, 316.7 / 300.0 on the branch; the Ring 1,333.3 / 1,200.0 on main, 183.3 / 166.7 on the branch. The towns and Bree’s kitchen draw two to six frames in 12 s at High, too few to say anything (their 40 s rows are above).

Two things were found by this gate and mended before these numbers: the canvas went to the view with the most of the screen, so on Moria’s page the map (the window’s size) led and the town over it, drawn at 1.75, was copied every frame; and an opaque view was made opaque by asking GL its colour mask and clear colour back (`getParameter`), which waits for the graphics chip to finish all it was given (a profile of Moria’s page: 15.2 s of 15.7 s in it). Before the two, Moria was a tenth slower than main at both levels; the canvas now goes to the view whose copy would cost the most, and nothing is asked of GL. The bridge and the Ring each had a context of their own beside the map’s on main, and draw two to seven times as often on the branch; why, beyond that, wasn’t measured.

The WebGPU rows are the owner’s machines’ (the laptop’s Radeon 740M and the desktop’s RTX 5090) and are left empty: Middle-earth is `'glsl'` until FL3.

## Checks

- `npm run lint`: clean.
- `npm test`: 16,164 passed, 6 skipped, 3 failed under the load of the shots running beside it (`scripts/assets-upload.test.mjs`’s secret scan, `scripts/motion/bvh-map.test.mjs`’s forward kinematics, `rickmorty/portal/rules.test.js`’s whole game a level); all three pass alone (63 of 63). The runtime’s and Middle-earth’s suites: 1,111 passed.
- `npm run build`: built.
- `node scripts/health.mjs --check --skip build`: every metric in budget. `renderers` 15, one fewer than main (the map’s own); `glsl-sites` 619 and `lint-disables` 54, as main; `loops` 58, as main (the components’ `useFrameLoop` was never counted, `lib/stage3d.js`’s site stays for its other users).

## Known, carried on

- A handover from Middle-earth (`rt.handover`) would snapshot the lead view’s canvas only; no route hands over from it.
- The map at a budget without antialiasing loses its multisampling (it had its own context’s before).
- After a lost context every picture shows its drawing again, as each did when its own context went; the page offers 3D back as before.
- `lib/three/frameGuard.js` and `src/runtime/` are outside the plan’s files: the runtime’s second picture is the owner’s decision in this session, told to the design session; P4 (#993) had merged.

## Tools

- `shoot.mjs`: the shots (`--dist`, `--out`, `--only`, `--frames`, `--part-frames`, `--quality`, `--settle`, `--quiet`, `--probe`, `--trace`, `--trace-random`, `--split-stream`, `--map3d`), and `--compare <a> <b>`.
- `pace.mjs`: the frame times, the two builds alternating (`--before`, `--after`, `--quality`, `--runs`, `--only`, `--window`).
