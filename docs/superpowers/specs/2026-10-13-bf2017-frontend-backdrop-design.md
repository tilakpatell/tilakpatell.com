# The front end's room behind the menus: the design and the plan

Date: 2026-10-13. Status: **approved by the owner in conversation on 2026-10-13 (“Yes, build it now”), with no separate review of this written copy, which is the record; the room, the figure and the governor landed, lit from the game's records (`src/data/bf2017/backdrop.json`), the camera the front end's own (decisions 2 and 3 went that way rather than by hand); Chewbacca's lighting and the rest are in `HANDOFF-battlefront.md`.** Branch `claude/magical-curie-arkgxh`. It follows the canvas design (`2026-10-13-bf2017-ui-canvas-design.md`), whose screens it goes behind.

## What the owner asked

- “The one big gap is the backdrop: the game's is its 3D front-end corridor, not built yet. Can you buikd this? so it looks like the asset on the right and stuff.” (The game's HOME capture: Chewbacca standing on the right, a dark room out of focus behind him, a cool light from behind.)
- “But make sure it hits 60fps regardless of cpu/gpu and can tell and is in a seperate thread and stuff. Make sure its perforamnt.”
- “Less tests more implementation.”

Read as: the main menu and Play are drawn over the game's own front-end room, with the game's own character in it, drawn in a worker so nothing the page does (React, the level loading behind) can drop its frames; it picks how much to draw from the device, measures itself, draws less when it misses frames and more when it has room, and stops when it can't be seen.

## The decisions

1. **The room is the game's.** The Frontend level's `Backdrop_01` sub-level: `nowheredome_01` and `nowherepilllights_01`, the kit the Collection's hero stage already draws (`KITS.frontendstage`, placed by `src/data/bf2017/stage.json`, lit by `VE_FrostEnd` in `src/data/bf2017/light/frontend.json`). Nothing new is cut from the bucket.
2. **Out of focus, as the game's is.** The room is drawn small (an eighth of the view's size), blurred twice with a separable Gaussian, and kept as the scene's background; it is drawn again only when the view's size changes. Each frame draws one full-screen texture and the figure: the room costs nothing per frame.
3. **The character on the right.** HOME's is Chewbacca (the capture), from the Collection's 2017 body (`crew/chewie`, its `.lod1` cut below ultra, as the hero stage picks), in the game's own main-menu idle (`frontend.idle`: `UI_FrontEnd_Chewbacca_MainMenu_f90_01`, the emotes pack), else his idle. Placed by hand to the capture: his middle at 0.83 of the frame's width, his head at its top, cut at the knee. The frame is the game's 1920 × 1080, fitted as the screens fit it (`frameOf`), so on a wider window he stays where the tiles leave him room.
4. **Its own thread.** The canvas is handed to a module worker (`transferControlToOffscreen`), which runs three.js on WebGL 2 and loads its own files. The page sends only the size, the pixel ratio, whether it is seen, and the device's level. Where a worker can't draw (no OffscreenCanvas WebGL), the same scene runs on the page, one step down.
5. **One room for the whole front end.** It is made the first time a screen asks for it, moved into each screen's backdrop as the screen opens, and let go 15 s after the last one closes: going from HOME to PLAY loads nothing again.
6. **60 frames a second, by measuring.** A governor (`governor.js`, pure, the one part with tests) holds a step:

   | step | the pixel ratio (of the level's) | animates |
   | --- | --- | --- |
   | 0 | 1 | yes |
   | 1 | 0.8 | yes |
   | 2 | 0.65 | yes |
   | 3 | 0.5 | yes |
   | 4 (still) | 0.5 | no: one frame a change |

   It starts from the device (ultra and high at 0, mid at 1, low at 3; one more on the page; reduced motion at the still). Every 60 frames drawn it counts the late ones (an interval over 1.4 times the frame it aims at: a 60th of a second, or the display's own frame where that is longer); 6 or more steps it down. Five clean windows in a row (at most one late) step it up, unless that step failed in the last 20 s. A display faster than 60 Hz is drawn at 60. A hidden tab, or no screen showing it, draws nothing.

## The plan

Files: `src/components/battlefront/backdrop/` — `governor.js` (+ test), `scene.js` (the room, the figure, the loop; no DOM), `backdrop.worker.js`, `host.js` (the one room, the worker or the page), `FrontEndBackdrop.jsx`, `backdrop.css`. `GameScreen.jsx` takes `room`; `MainMenu.jsx` and `Play.jsx` pass it.

1. The room in the worker, behind HOME and PLAY; pushed.
2. Chewbacca in it, placed to the capture; pushed.
3. The governor, its tests first; pushed.
4. Shots at 1920 × 1080 and 2560 × 1080 beside the capture; the numbers in the evidence README.

## What is left out

- The game's thin smoke (`FX_ThinSmoke_01` at the dome's foot) and its bloom: the blur gives most of what they do here.
- Another hero on HOME: the game's HOME shows the player's last; the site has no account, so it is the capture's.
