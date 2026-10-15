# The universe map, clean: the design

Date: 2026-10-08. Lane: universe visuals, second round. Rests on `docs/research/2026-10-08-universe-polish-audit.md` (what Bruno Simon's folio does that the map doesn't, with the numbers) and follows `2026-10-06-universe-visual-upgrade-design.md` (the first round: HDR, bloom, one light from the stars, real air, the hero tuned, rock, fire), whose poses and check script (`scripts/universe-check.mjs`, `lab/universe/baseline/`) are this round's measure.

## The brief

The owner: the map and the hero ships have had their upgrade and still don't have the *cleanliness* of Bruno's game. The audit's answer: it is not the assets and not the renderer. It is four disciplines his whole picture keeps and ours doesn't: **frequency** (nothing finer than about four pixels), **value structure** (a clean dark and a clean light in every frame), **one palette**, and **a hero that is big and the highest-contrast thing on screen**. This design puts those four into the map without taking out anything the first round built.

## Goals

Measured at the fixed poses on `high`, before and after, with `scripts/universe-check.mjs`'s own metrics and the audit's measure (`luminance` as Rec. 709 of the sRGB bytes; a "point" a local maximum over 0.6 luminance and 0.25 over its neighbours):

| what | today | target |
| --- | --- | --- |
| the Falcon's width at cruise, of the frame's width | 11 % | 20 to 25 % |
| the ship's crop: standard deviation of luminance (its internal contrast) | 0.11 to 0.15 | 0.20 or more |
| the ship's crop: mean luminance against the ring 40 px round it | 0.18 against 0.025 (home) and 0.14 (galaxy) | at least 3 : 1 either way, in every pose |
| bright points in a 1280 × 720 frame of sky | 1,300 to 4,100 | under 800 |
| pixels under 0.02 luminance, in a frame with a nebula or the band in it | 0.4 to 10 % | 15 % or more |
| `edgeDensity` on the sky alone (a pose aimed at the band with the ship hidden) | the baseline's | half |
| `colorEntropyBits`, whole frame | the baseline's | one bit lower |
| draw calls and triangles at every pose | the baseline's | no higher; the sky's and the belt's lower |
| hero texture bytes (the two HD GLBs) | 2.7 MB + 1.9 MB | under 1.5 MB together |

And by eye, in the pull request: `falcon-sun`, `overview`, `belt`, `maw` and `middleearth-limb`, before and after, side by side.

## Non-goals

- The HUD and its labels (the house UI rules in `docs/health/RULES.md` own it; the audit notes it as a third of what "busy" means, for another lane).
- The planets' own maps and styles (the fandoms' identity: the first round's checkpoints 3 and 4 stand). Only their air's and rim's tint takes the palette.
- The galaxy's own systems' sky as seen from the galaxy page: `galaxy/sky.js` gains an option the universe map passes; the galaxy passes nothing and draws as today.
- Physics, flight, sound, the hangar, the shipyard's builds (a garage build is painted by the same `livery.js` and takes the same light; nothing else there changes).
- WebGPU: every change here is GLSL on the classic renderer, in files the WebGPU lane will port later as it reaches the universe.

## Constraints (the standing rules that bite here)

- A change changes no gameplay: every key, save, achievement, dev hook and sound as before. The poses must still resolve (`window.__universe().pose`).
- No new dependency. No runtime call to an asset service; the hero maps are rebuilt by a script in `scripts/` and committed.
- Every number a tier reads comes from `lib/budgets` or `lib/device`; a new one is named and tested.
- Draw calls and triangles at every pose at or under the baseline (`lab/universe/baseline/high.json`); a rise is a finding, not a budget change.
- `docs/architecture.md`: one sentence under the universe map's entry, from each lane, naming its files.
- British spelling, curly quotes, plain sentences; comments say why.

## The shape, in three lanes

Three lanes run at once, each owning its files. Nothing is shared but `universe/palette.js`, which lane B lands in its first pull request within its first hour; until it is on `main`, a lane that needs a colour uses the hex this design gives and leaves a comment naming the palette key, so the swap later is a one-line change.

### Lane A: the hero ship (`shipModels.js`, `hulls.js`, `livery.js`, `engines.js`, `lib/three/gltf.js`'s `SHIP_PROFILE`, `scripts/ship-maps.mjs`, the two HD GLBs)

1. **Maps at the frequency the camera sees.** `scripts/ship-maps.mjs` rewrites `public/models/sketchfab/falcon-hd.glb` and `xwing-hd.glb` in place with `@gltf-transform`: every albedo and normal map to 512², through a *contrast-preserving* downscale (Lanczos 3, then unsharp at radius 1.5 and amount 0.6 on the albedo only, so a panel line that was two texels dark stays dark at one), metallic-roughness maps to 256², WebP at quality 82, meshopt kept. Both files together under 1.5 MB. The script prints each map's before and after size and the mean local contrast (the standard deviation of a 5 × 5 high-pass) so the gain is a number. A `--check` reports without writing. The 60 k and 134 k triangle counts stay: geometry is not the problem.
2. **A graphic light ratio.** `SHIP_PROFILE` gains `light: { key: 1, fill: 0.25, rim: 0.5 }`, and `livery.js`'s hook reads it: the rim goes from 0.35 to 0.5, in the *complement* of the key's colour (warm when the key is cool, cool when warm: `rimColour = mix(fill.colour, 1 − key.colour normalised, 0.5)`), and the fill's contribution is scaled by 0.25 against the key's 1 inside the hook (today the scene's fill `DirectionalLight` is what `lighting.js` gives; the hook does not change the lights, it scales what the material takes from the fill through `uFillScale`). Paint roughness floor 0.42 stays; the clamp's top drops from 0.72 to 0.6 on the hull, so the key makes a real highlight. `envMapIntensity` 1.3 stays.
3. **Engines under the ship.** `engines.js`: the plume's length capped at 0.6 of `LENGTH` and its peak luminance at 0.8 of the hull's lit side (today it passes the bloom threshold and is the brightest thing in frame while boosting); the boost adds length, never brightness. The traffic's and hunters' engines take the same cap.
4. **Measured.** At `falcon-sun` and `maw` (the ship against the sun and against the dark): the ship's crop standard deviation and the crop-to-ring ratio, before and after, in the pull request; and the maps' sizes.

### Lane B: the sky and the space between (`universe/palette.js`, `galaxy/sky.js`'s new option, `scene.js`'s one `createSky` call, `landmarks.js`, `deepspace.js`'s nebula puffs, `belt.js`, `lib/three/rock.js`, and the deletion of `skyShader.js`, `starField.js`, `starCatalog.js`, `public/textures/universe/stars.bin`)

1. **The palette.** `universe/palette.js`: nine named colours as hex and as linear `[r, g, b]` (`PALETTE.sky`, `nebula`, `star`, `sun`, `bone` (the Falcon), `grey` (the X-wing), `engine`, `shot`, `ink`), a `tint(name, k)` that returns the colour `k` of the way to white, and a test that the nine are distinct by at least 0.15 in OKLab and that `sky` is the darkest. The starting values are read from the code as it is (the engine blue from `engines.js`, the sun from `sun.js`, the shot red from `gunfx.js`, the nebula blue from `deepspace.js`), so the first commit changes no pixel; the lane then moves every tint it owns onto the names.
2. **The floor.** `galaxy/sky.js`'s `createSky` takes `dim` (default 1, the galaxy's): the band, the core and the nebulae in the bake multiplied by it, and the cubed grain term left out when `dim < 1` or the level is under `ultra`. The universe map passes `dim: 0.4`, chosen so the brightest texel of the band away from the core is 0.06 luminance in the map. The stars past the first 4,200 drawn at 0.25 (`STARS_PAST` becomes a parameter the map sets; the galaxy keeps 0.7), and the brightness law of the first 4,200 steepened (the magnitude distribution's exponent from its value today to one where the top fifth carry 70 % of the light; the exact exponent is found by the count target and written down). `landmarks.js`'s nebulae and `deepspace.js`'s puffs take `PALETTE.nebula` at 0.7 of their brightness today, so a frame with a nebula in it keeps 15 % of its pixels under 0.02.
3. **Frequency on what is small.** `lib/three/rock.js`'s pitted detail fades out by *screen size* (a `uScreenPx` the belt sets from the camera's distance and the rock's radius each frame, one uniform per instanced draw), flat two-tone below 10 px; the belt's rock tones come from `tint('grey', k)` in three steps. The far stars' spikes (`farStars.js`) are drawn only above 14 px.
4. **Dead code out.** `skyShader.js`, `starField.js`, `starCatalog.js` and `stars.bin` deleted with their tests and the `bake-universe-stars.mjs` script that made the binary; `docs/architecture.md`'s sentence on the Hipparcos field goes with them. `node scripts/health.mjs` shows `big-files` and the bundle no worse.
5. **Measured.** At `overview`, `maw` and `middleearth-limb`: bright points, the share under 0.02, `edgeDensity` and `colorEntropyBits`, before and after, in the pull request.

### Lane C: the lens and the frame (`post.js`, `flight.js`, `scene.js`'s `chaseView` and the grade uniforms it sets, `lib/three/exposure.js`)

1. **The hero in the frame.** `chaseView`: the target 0.15 ahead of the ship (0.4 today) and 0.1 above it (0.06), `dist` 1.1 + speed term 0.6 + streak 0.5 (1.7 + 0.9 + 0.7): the Falcon spans 20 to 25 % of the frame's width at cruise and not under 14 % at the boost. The numbers live in `flight.js` as `CHASE = { ahead, up, dist, speed, streak }` with a test that the ship's projected width at cruise, from `LENGTH`, `FOV` and `CHASE`, is between 0.2 and 0.25 of a 16 : 9 frame. The cockpit view is untouched. The map view's `mapPose` is untouched.
2. **A toe.** `post.js`'s final pass: before the shoulder, `lin = max(0, lin − 0.02) × (1 / 0.98)` smoothed (`smoothstep(0, 0.08, luminance)` as a mix toward black over the darkest stop), so the sky between the stars is black and the planets' night sides hold a dark. `uContrast` from 0.07 to 0.18, `uSat` stays. Under `prefers-reduced-motion` nothing here changes (it is not motion).
3. **A soft edge.** A radial defocus in the final pass: a 5-tap blur (centre and four at 1.5 px) mixed in by `smoothstep(0.55, 1.0, r)` where `r` is the distance from the frame's centre in the aspect-corrected square; the chromatic aberration rides the same falloff as today. Off on `low` and at the pace's step 3 (one read, as the aberration is). It is a vignette of sharpness, not a depth of field: the ship, in the middle, is never blurred.
4. **Measured.** At `falcon-sun`, `overview` and `belt`: the ship's width in pixels (from `window.__universe()`'s projected bounds, a DEV hook the lane adds: `shipPx()` → `{ w, h }`), the share of pixels under 0.02, and the baseline's counts, before and after, in the pull request. The README's `hero.webp` and `universe.webp` retaken by this lane last, once A and B are on `main`.

## Testing

- Lane A: `scripts/ship-maps.test.mjs` (the downscale on a fixture PNG: a two-texel line survives at one texel with its contrast within 20 %; `--check` writes nothing); `livery.test.js` (the rim colour is the key's complement mixed with the fill; `uFillScale` 0.25); `engines.test.js` (the plume's length and luminance caps).
- Lane B: `palette.test.js`; `galaxy/sky.test.js` (`dim` scales the bake's uniforms; the galaxy's default is 1 and unchanged; `starsPast` per caller); `rock.test.js` (the detail weight by screen pixels); `belt.test.js` unchanged.
- Lane C: `flight.test.js` (`CHASE` and the projected width); `post.test.js` (the toe maps 0.02 to 0 and 0.08 to 0.08 within 1 %; the defocus mix is 0 at the centre and 1 at the corner; the pass is off on `low`).
- Every lane: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --routes /universe`, and `node scripts/universe-check.mjs --quality high --poses <its poses> --frames 3 --out lab/universe/<lane>` before and after, the tables in the pull request. (In a cloud container the check draws in software: a pose takes minutes. Run it once before, once after, on the lane's poses only, in the background while writing the PR body.)

## Rollout

Three branches from `main`, at once: `claude/universe-polish-a` (the ship), `claude/universe-polish-b` (the sky), `claude/universe-polish-c` (the lens). Lane B's first pull request (the palette and the dead code) merges first and small; the rest of each lane is one pull request, merged on its own as its checks and tables are in. Lane C retakes the README's two pictures in a last small pull request once A and B are on `main`. The handoff `docs/superpowers/HANDOFF-universe.md` carries the status table, one row per lane.
