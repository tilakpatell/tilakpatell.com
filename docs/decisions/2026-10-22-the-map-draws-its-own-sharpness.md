# The universe map draws its own sharpness: a canvas of the screen's pixels, FSR 1 up to it, the samples by the sharpness

**Date:** 2026-10-22 · **Status:** accepted · **Where:** `src/components/universe/post.js` (the finish), `src/components/universe/module.js` (`canvas: 'screen'`), `src/runtime/quality.js` (`ratioUnder`'s `screen`), `src/runtime/module.js`, `src/components/universe/videoLook.js`

## Context

The owner, on a laptop's built-in graphics at Ultra: the map and its worlds read as 720p to 1080p with rough edges, not 4K.

- The map's canvas was drawn at the budget's least on a 1× screen (1.5 at Ultra, 1.25 at High: `lib/device`'s `minRatio`), the browser folding it down to the screen. The pace's steps (`lib/three/pace`'s `STEPS`, chosen once by `lib/three/calibrate` against 12 ms of the chip's time) drew the scene softer inside that and the last pass stretched it back with one bilinear read.
- Its multisampling was chosen once, as the post was made, from the canvas's ratio: four samples under 1.75, none at 1.75 and over. On a 2× screen it never multisampled, so at the pace's step 3 the scene was 1.2× with no samples at all, stretched bilinearly to 2× (measured on `main`, headless at 1280 × 720: `{"canvasRatio":2,"drawn":1.2,"samples":0}`). On a 1× screen at Ultra a weak chip paid for four samples on a half-float target at 1.5×, so it calibrated low.
- The galaxy's surfaces and Battlefront already bring a softer picture up through FSR 1 or TAAU on the node renderer (`lib/three/light/post.js`); the map, still `'glsl'`, had nothing between the bilinear stretch and the canvas.
- The settings panel's Render resolution did nothing to the map until a reload (a module with `sharpness: 'own'` keeps its canvas), and its video controls named for the map (film grain, chromatic aberration) never reached it.

## Decision

- **The canvas is the screen's own pixels** for a module that says `canvas: 'screen'` (the map alone): `quality.ratioUnder(cap, { screen: true })` leaves out the least and the visitor's render resolution. Those are the post's: it draws the scene at `ratioUnder(2, { unscaled: true })` times the pace's step, and folds a sharper one down in its last pass.
- **Softer than the canvas, FSR 1 brings it up** (post.js's finish, the map's alone: `upscale`): the grade into an 8-bit picture at the scene's size, EASU to the canvas, RCAS at FidelityFX's 0.2 stops, the dither again. GLSL from three r186's `FSR1Node`, after GPUOpen's `ffx_fsr1.h` (MIT).
- **The samples follow the sharpness drawn at** (`samplesAt`): none at 1.75 and over, two from 1.25, four under (two on a small screen), the composer's buffers made again when that changes. The buffers are named the frame's to the frame guard, so a material arriving late is readied behind the frame at any size.
- **Calibrated afresh** (`universe-fsr`, not `universe-2x`): a kept level from the old chain says nothing of this one.
- **The settings reach it live:** the render resolution at the next frame; film grain, aberration, bloom and multisampling through the scene's `onVideo` (`videoLook.js`: only what the visitor turned away from the level's row, so a level picked whole keeps the map's look).
- The galaxy's post is untouched (`upscale` is off by default), so its node twin's parity holds.

## Consequences

- A weak chip's frame goes on the picture rather than on a canvas bigger than its screen: at Ultra on a 1× screen the grade, the canvas copy and the browser's fold are at 1× (2.25 times fewer pixels than at 1.5), and the scene's top step takes two samples where it took four.
- At the pace's softer steps the edges are multisampled and come up as edges, sharpened, not stairs; on a 2× screen the map multisamples whenever it isn't drawn at 1.75 or more.
- Two more full-screen passes while it's softer than the canvas (EASU's twelve reads, RCAS's five), and two 8-bit pictures (made the first time, dropped with the post).
- A sharper scene folded down by one bilinear read in the last pass, as the browser's compositor did; the fold is on linear light before the tone map rather than after it.
- The WebGPU rows are the owner's machines'; the container draws in software, where only the pictures and the sizes are measured.

## Revisit when

- The map moves to the node renderer (lane FL3): its chain is `lib/three/light/post.js`'s, with TAAU, and this finish goes with the GLSL.
- The owner's laptop shows the calibrated step: if it still lands at 0.5 at Ultra, the budget's least on a 1× screen is the next thing to give (`minRatio`).
- A browser's compositor fold proves sharper than the last pass's: a four-read fold there.
