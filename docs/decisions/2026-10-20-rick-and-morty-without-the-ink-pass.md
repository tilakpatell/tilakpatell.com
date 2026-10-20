# The Rick and Morty worlds are drawn as the show is: no ink pass, a line round the cast only

**Date:** 2026-10-20 · **Status:** accepted · **Where:** `src/components/rickmorty/portal/toon.js` (the `InkPass` gone), `toonCore.js`, `world/kit.js` and `portal/meshyCastCore.js` (the ramps), `world/look.js` (`PLAIN`, `CAST_INK`), `citadel/look.js` (`alarmGrade`), the five scenes (`world/scene.js`, `world/roy/scene.js`, `world/sewer/scene.js`, `citadel/scene.js`, `portal/Portal3D.js`)

## Context

The owner's word: the filter that "bakes the Rick and Morty world and makes it have more dark outlines and stuff" should go, and the worlds should look more like the show; it might be how the models are baked. Measured on C-137's street, living room and the Jerryboree (1280 by 720, software GL):

- Every Rick and Morty scene ran a screen-space ink pass after the picture: the scene drawn again as normals and depth, darkened 92% toward near-black wherever depth stepped or neighbouring normals turned more than about 41°. The crease term inked every floor plank, tile joint, sofa seam and box edge, and drew sketchy lines across the faceted Meshy models' flat walls and roofs.
- Switching only that pass off removed 76–88% of the thin dark strokes on screen (street 2.75% → 0.55% of pixels, living room 6.09% → 1.49%, the Jerryboree 3.76% → 0.46%).
- The models are baked with lines too: the concept images Meshy was given asked for "clean thick black outlines". Across all 244 GLBs (143 MB, one WebP base colour each) that is 0.4–5% of covered texels, mostly drawn on purpose (mouths, brows, pupils, collars, window frames, garage panels); a line remover tried on copies took garage panels, window bars and pockets with the strokes.
- Each scene also had a film grade: grain, a vignette, a contrast curve and tints (the sewer and Portal panic the heaviest, at lib/stage3d's defaults).
- The show draws one clean, even line round its characters and none from surface folds; flat fills with at most one hard shadow tone; no grain and no vignette.

## Decision

The ink pass is gone from all five scenes, and the class with it. The modelled cast gets the show's one line, `lib/three/ink.js`'s inverted hull (the cast's `ink` option: 0.01 m in C-137, the sewer and the Citadel, 0.03 m in Portal panic's high camera), drawn in the scene pass so it is antialiased and thins with distance. Props, rooms, floors and sky have no line. Every toon ramp is two steps (lit, and one shade of shadow with a hard edge). Every scene takes `PLAIN`, a grade that changes nothing; the Citadel keeps only its red-alert and chase vignette and pulse (`alarmGrade`). The baked textures are not rewritten.

## Consequences

- No second scene draw and no full-screen edge pass a frame; one extra draw per figure mesh for its hull.
- The cast's lighter two-step ramp is the shared cast paint, so every Meshy figure on the site (the galaxy's, the universe's landings, the cruiser's crew, the wardrobe) shades the same way.
- Roy's figures, built in code from many parts, have no line; the Citadel's instanced crowd, hats and gear have none either. Ghosts, the basement hologram and the jar's Total Rickall ghost hide theirs (a projection has no outline).
- Portal panic's shape fallback keeps its own hull on every tier.
- The rooms' `noInk` lists stay: the street's ground-light bake still reads its own.

## Revisit when

- The owner wants lines on the backgrounds (a thin, tinted hull on near props, as the show draws its sets).
- Shots still show baked strokes on a set piece: an opt-in, offline texture pass for the named models (the Gazorpazorp gate, the Citadel's exterior, the Cronenberg house, the Gotron), never the Smiths' house, the school or the main cast.
- A new Meshy generation is made: ask the concept image for no outline round the figure.
