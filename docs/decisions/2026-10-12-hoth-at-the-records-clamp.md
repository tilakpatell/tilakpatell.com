# Hoth exposes at the record's clamp, on the record's snow, through the record's field of view

**Date:** 2026-10-12 · **Status:** accepted · **Where:** `src/data/bf2017/maps/hoth.lighting.json`, `scripts/lib/bf2017-rulebook-look.mjs`, `src/components/battlefront/weather.js`, `src/components/battlefront/map/ground.js`, `src/components/battlefront/camera.js`

## The problem

The owner's reverse-engineering study of the game (`bf2-re`, findings 11, 12 and 14, 2026-10-12) read three numbers off the game that the site had wrong:

- **The exposure clamp.** Every Hoth VisualEnvironment in the export sets `ClampEV true` with `MinEV`/`MaxEV` (the day 11…15 at `ExposureCompensation +1.5`, the sunset 9.5…10.4, the interior 8.5…10.5). The site's lighting import kept the bounds but dropped the flag, so `calibrate.js` (which clamps only under `ClampEV`, the 2026-10-12 post-order decision) metered the day unclamped at EV 16.33: a stop and a third darker than the game, which sits at its clamp of 15 on that field.
- **The snow.** The game's terrain has no colour map: normals at several scales, a sparkle mask and displacement over a flat albedo (the record's `TerrainColor`, 0.547 / 0.594 / 0.644). The site brightened that colour toward white (0.86 / 0.90 / 0.95), and at the record's clamp the whole field clipped to white.
- **The field of view.** The game's hip camera is 55° vertical (`ZoomLevel_0_Default.FieldOfView`, the video option's default; the weapons' `RenderFov` 55 too). The site drew at 70°.

## The decision

- The rulebook look carries `ClampEV` (`clampEv`) beside `MinEV`/`MaxEV`; Hoth's three weathers have it; `weather.js` puts it on the record the meter reads. Hoth's day now meters to 15, its sun 9.21 and its sky 2.52 in the site's units (one physical exposure, 1 / k, as before).
- The ground is the record's `TerrainColor`, as it is. The game's normal maps, sparkle and displacement over it are the next step (`bf2-re/findings/11-terrain.md` has the layers).
- `FOV_DEFAULT` is 55. A blaster's sights are 55 too, so aiming no longer zooms; a scope narrower than the hip still eases down over its seconds.

## The measurement

Headless Edge on the RTX 5090, `.scratch-check/bf-stats.mjs` (1280 × 720) and `bf-profile2.mjs` (5120 × 1440): at the clamp with the brightened snow the field clipped flat white (`profile15/field.png`); with the record's colour it is a bright white-blue field with the rocks' detail intact (`stats-field.png`). The frame time is unchanged. The tests that pinned the unclamped numbers (`calibrate.test.js`, `entry.test.js`) pin the clamped ones now, and keep the unclamped meter as the case where a record sets no `ClampEV`.

## What is left

- The sky still clips at the top of the frame at EV 15: `35,000 nits × LuminanceScale` over the same k is 2.5, brighter than the sunlit snow, which a real sky is not. The panorama's own values and the record's `LuminanceScale` want reading together (findings 02 and the lighting agent's 15).
- The game's terrain look (findings 11): normals, the sparkle mask, displacement near the camera, and the layer colours once `TerrainLayerCombinations` is decoded.
- The bloom is already the record's five Gaussians (`grade.js`); the game's numbers (findings 14: weights 0 / 0 / 0.2 / 0.35 / 0.5, blue tints, `BloomScale` 0.1, no threshold) are what it reads.
