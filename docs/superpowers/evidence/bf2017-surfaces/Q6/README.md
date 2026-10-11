# Lane Q6: the record's picture

The spec: `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md` (§6 and "Q6"). The plan: `docs/superpowers/plans/2026-10-10-bf2017-surfaces-laneQ6-picture.md`.

## What is here

The lit fixture under Hoth Sunny's record (`--hoth`: snow, the ring, the house's exposure 1.4, the lamps off) on the node renderer over WebGL 2 (SwiftShader), at ultra, 960 × 540:

- `nopicture-post-ultra-*`: the before, `node scripts/light-fixture.mjs --picture off --post on --tier ultra --legs webgl --size 960x540`: the chain as `main` builds it (ACES, the site's bloom, the house's AO, the fixture's cool test LUT over the encoded picture, the analytic sky).
- `picture-post-ultra-*`: the after, `--picture`: the record's picture through `applyGameLight(..., { picture })`, with the urls in `src/data/bf2017/light/hoth.picture.json` (written by `node scripts/bf2017-picture.mjs hoth`).
- Each run: the frame (`-webgl.png`), the horizon where the painted sky meets the model (`-horizon.png`, and `-horizon-nopost.png` with the chain off, which is where the bands below are measured), the snow from 90 m up (`-cloudtex.png`), and the numbers (`.json`).

## The numbers

| | before | after |
| --- | --- | --- |
| passes | render ssgi denoise ao bloom godrays lensflare motionBlur lut smaa output | render ssgi denoise ao bloom godrays lensflare motionBlur **tonemap** lut smaa output |
| mean linear luminance | 0.3951 | 0.4436 (+12 %) |
| programs before → after a light moves | 82 → 82 | 82 → 82 |
| mean ms a frame (SwiftShader: the CPU's, a ratio only) | 2733.6 | 2727.7 |
| the sky 1°–2° over the horizon (where they meet) | 0.5413 | 0.5715 (× 1.056) |
| the sky 3.5°–6° over the horizon (the panorama alone) | 0.4685 | 0.6096 (× 1.30) |

Lane G's calibrated classic Hoth field measured 0.3531 (`docs/superpowers/evidence/bf2017-light/`); lane S's fixture 0.3686. The record's picture is brighter than the calibration by 12 % on this frame, from the LUT's own curve (its middle is near identity, 0.5 → 0.52, and it lifts the upper tones: 0.75 → 0.85, all over 0.875 to 1) and the painted sky's clouds; lane S's next calibration, against the game's own frames, decides whether that stays.

### On the owner's laptop (RTX 5090, Edge, ANGLE d3d11; the design session's run of `--picture` and `--picture off`, ultra, 1600 × 900)

| leg | picture off: ms mean (median / p95), lum | picture: ms mean (median / p95), lum |
| --- | --- | --- |
| WebGPU | 6.0 (5.7 / 7.1), 0.394 | 5.5 (5.5 / 6.7), 0.4419 (passes render ssgi ao ssr bloom godrays lensflare motionBlur tonemap lut traa output; 88 programs) |
| WebGL 2 | 6.8 (5.4 / 14.8, noisy), 0.3949 | 3.2 (3.1 / 3.5), 0.4429 |

The record's picture costs nothing measurable on the GPU (within noise of the frame without it) and lifts the mean luminance from 0.39 to 0.44 on both legs, as on SwiftShader. The WebGPU shots land in this folder in the design session's docs PR.

## Review focus

1. **Five Gaussians as one `BloomNode`.** No extra pass: three's `BloomNode` already blurs five mips (kernels 6 to 22 texels at halving resolutions) and composites them through its factors (1, 0.8, 0.6, 0.4, 0.2) and tints. The record's five Gaussians are those five levels (`GAUSSIAN_LEVELS`), each tint the record's colour × weight over the node's own factor (`bloomTints`), its `BloomScale` the strength, and no threshold (GaussianSimple has none). The frame cost is the bloom's as before; SwiftShader shows no change (2733.6 → 2727.7 ms, the CPU's). On the laptop the whole ultra chain with the picture is 5.5 ms on WebGPU against 6.0 without it: nothing to collapse.
2. **The panorama's exposure.** The bucket's panorama is the desktop's KTX2, 2,048 × 512 UASTC, linear, clamped to 0…1 (the export's 8,192 × 2,048 BC6 HDR lost its range above 1, the sun's disc with it). It is scaled to the model's sky where the two meet: `panoramaGain` makes its horizon row (0.7335, 0.8368, 0.962, measured by the script) as bright as the model's sky at 1.4° averaged round the horizon, from the same calibrated luminance (the record's LuminanceScale through `calibrate.js`: the test pins that twice the luminance is twice the gain). Hoth's day: a gain of 0.509. On the shot the painted sky is 5.6 % over the model at 1°–2° (inside 10 %), and 30 % over it higher up, which is the painted sky's own gradient, not a band (`picture-post-ultra-webgl-horizon-nopost.png`).
3. **The LUT after the tone map.** `post.js`'s order puts `tonemap` after the bloom and before `lut` (tested in `post.test.js`, a chain given LUT-first is put back). The tone map is the record's `TonemapMethod_Linear`: the renderer's exposure and a clamp to 0…1, kept linear; the LUT reads that (its range is 0…`ColorGradingMaxHdrValue`, 1 on Hoth), and the encoding comes after. Read over the encoded picture instead, as lane R's `lut` pass did, Hoth's LUT sends everything over 0.875 to white: the first after-shot of this lane was a white sky for that reason.

## What the textures turned out to say

- **The panorama's mapping** (not documented; read off the textures): the upper hemisphere as an equirect, `u = fract(PanoramicRotation − azimuth / 2π)`, the rotation in turns. The record's sun's azimuth lands on the painted sun's (u 0.225) exactly. The painted sun of the day stands near 16° against the record's 32.9°; `v = cos(elevation)` would put it at the record's but squeezed the lowest 12° of sky into 11 rows and drew the horizon as vertical smears, and the sunset's glow sits at the horizon's foot as the equirect has it. So the record's disc is drawn at the record's sun and the painted glow stays where it was painted.
- **The fog gradient** (`T_Hoth_Sunny_02_Fog_C`, 512 × 256) is the whole sphere at the same rotation, a blurred copy of the sky; the fog's colour is FogColor × the gradient by the view's direction × the panorama's gain.
- **The cloud shadow** (`T_Arctic_01_CloudShadow_RGBM`) is BC1 in the export: no alpha, so its RGBM decode is `rgb × 6`, clamped, lit wherever the map is over a sixth. At the record's 8,192 m tile the fixture's 200 m of snow is 2.4 % of the map, one even patch (`-cloudtex.png`): it shows at a level's scale, not here. The served copies are 1,024 px (8 m a texel).
- **Sunset** has its own panorama, gradient and cloud texture (in the manifest); the interior names the day's sky.

## Left

- The world: no world passes `picture` yet, so no page changes. Lane picture (`claude/bf2017-picture`) hands the Battlefront world's entry `picture: hoth.picture.json`'s weather.
- A weather crossfade eases the panorama's gain but not its texture, the LUT or the Gaussians (the chain is built from the first weather's record, as the fog and the flares are).
- The analytic model's below-horizon ground colour shows as a tan line between the panorama's foot and the fixture's ground edge, before and after; the record's GroundColor is black, so entry.js's fallback stands in.
