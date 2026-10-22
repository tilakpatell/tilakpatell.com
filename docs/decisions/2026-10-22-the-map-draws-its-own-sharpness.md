# The universe map and the galaxy draw their own sharpness: a canvas of the screen's pixels, FSR 1 up to it, the samples by the sharpness

**Date:** 2026-10-22 · **Status:** accepted · **Where:** `src/components/universe/post.js` (the finish), `src/components/galaxy/nodes/post.js` (its twin's), `src/components/universe/module.js` and `src/components/galaxy/module.js` (`canvas: 'screen'`, `calibrateAs`), `src/runtime/quality.js` (`ratioUnder`'s `screen`), `src/runtime/module.js`, `src/runtime/runtime.js`, `src/lib/three/finish.js`, `src/lib/videoLook.js`

## Context

The owner, on a laptop's built-in graphics at Ultra: the map and its worlds read as 720p to 1080p with rough edges, not 4K.

- The map's canvas was drawn at the budget's least on a 1× screen (1.5 at Ultra, 1.25 at High: `lib/device`'s `minRatio`), the browser folding it down to the screen. The pace's steps (`lib/three/pace`'s `STEPS`, chosen once by `lib/three/calibrate` against 12 ms of the chip's time) drew the scene softer inside that and the last pass stretched it back with one bilinear read.
- Its multisampling was chosen once, as the post was made, from the canvas's ratio: four samples under 1.75, none at 1.75 and over. On a 2× screen it never multisampled, so at the pace's step 3 the scene was 1.2× with no samples at all, stretched bilinearly to 2× (measured on `main`, headless at 1280 × 720: `{"canvasRatio":2,"drawn":1.2,"samples":0}`). On a 1× screen at Ultra a weak chip paid for four samples on a half-float target at 1.5×, so it calibrated low.
- The galaxy drew through the same post, its canvas 1.5× at most, so a Retina screen's browser stretched it from 1.5 to 2 as well; its node twin (`galaxy/nodes/post.js`) waits on lane FL3's flip (#1018, a draft).
- The galaxy's surfaces and Battlefront already bring a softer picture up through FSR 1 or TAAU on the node renderer (`lib/three/light/post.js`); the map, still `'glsl'`, had nothing between the bilinear stretch and the canvas.
- The settings panel's Render resolution did nothing to the map until a reload (a module with `sharpness: 'own'` keeps its canvas), and its video controls named for the map (film grain, chromatic aberration) never reached it.

## Decision

- **The canvas is the screen's own pixels** for a module that says `canvas: 'screen'` (the map, and the galaxy, its canvas 2× at most and its scene 1.5× as it always drew): `quality.ratioUnder(cap, { screen: true })` leaves out the least and the visitor's render resolution. Those are the post's: it draws the scene at `ratioUnder(2, { unscaled: true })` times the pace's step, and folds a sharper one down in its last pass.
- **Softer than the canvas, FSR 1 brings it up** (post.js's finish, `upscale`): the grade into an 8-bit picture at the scene's size, EASU to the canvas, RCAS, the dither again. GLSL from three r186's `FSR1Node`, after GPUOpen's `ffx_fsr1.h` (MIT). RCAS at FidelityFX's 0.2 stops brought up by half or more, easing to 0.8 as the scene nears the canvas (`rcasStops`): at full strength a lit hull's greebles sparkled at 0.9 of a 1× canvas.
- **The samples follow the sharpness drawn at** (`samplesAt`): none at 1.75 and over, two from 1.25, four under (two on a small screen), the composer's buffers made again when that changes. The buffers are named the frame's to the frame guard, so a material arriving late is readied behind the frame at any size.
- **Calibrated afresh** (the map's `universe-fsr`, not `universe-2x`; the galaxy's `galaxy-fsr` through the module's new `calibrateAs`): a kept level from the old chain, which the walk only ever steps down from, says nothing of this one.
- **The galaxy's twin keeps it** for the flip: the same numbers (`lib/three/finish.js`, GLSL-free), the scene pass at the sharpness's share (over 1 to fold), three's `FSR1Node` over an RTT of the grade, the passes' samples set as they move. `scripts/twin-parity.mjs galaxy-post` holds it: `fold` 40.8 dB, 0.47 % off; `fsr` 37.2 dB, 1.36 % off (`cab` and `open` as they were, 39.2 and 40.8 dB).
- **The settings reach it live:** the render resolution at the next frame; film grain, aberration, bloom and multisampling through the scene's `onVideo` (`lib/videoLook.js`: only what the visitor turned away from the level's row, so a level picked whole keeps the map's look).
- The surfaces keep their own chain (`lib/three/light/post.js`, FSR 1 or TAAU already).

## Consequences

- A weak chip's frame goes on the picture rather than on a canvas bigger than its screen: at Ultra on a 1× screen the grade, the canvas copy and the browser's fold are at 1× (2.25 times fewer pixels than at 1.5), and the scene's top step takes two samples where it took four.
- On a 2× screen the galaxy's scene is brought up from 1.5 by FSR 1 at every step, two full-screen passes at 2× it didn't have, where the browser stretched it before.
- At the pace's softer steps the edges are multisampled and come up as edges, sharpened, not stairs; on a 2× screen the map multisamples whenever it isn't drawn at 1.75 or more.
- Two more full-screen passes while it's softer than the canvas (EASU's twelve reads, RCAS's five), and two 8-bit pictures (made the first time, dropped with the post).
- A sharper scene folded down by one bilinear read in the last pass, as the browser's compositor did; the fold is on linear light before the tone map rather than after it.
- The WebGPU rows are the owner's machines'; the container draws in software, where only the pictures and the sizes are measured.

## Revisit when

- The map moves to the node renderer (lane FL3): its chain is `lib/three/light/post.js`'s, with TAAU, and this finish goes with the GLSL. The galaxy's flip (#1018) passes `upscale` and `top` to its twin as `scene.js` passes them to the GLSL post.
- The owner's laptop shows the calibrated step: if it still lands at 0.5 at Ultra, the budget's least on a 1× screen is the next thing to give (`minRatio`).
- A browser's compositor fold proves sharper than the last pass's: a four-read fold there.
