# Lane P: the record’s picture on every lit world

The design: `docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md` (§3.3, §4 “P”). The plan: `docs/superpowers/plans/2026-10-11-bf2017-picture-laneP-picture.md`.

## What is here

For each of the ten worlds the game lights, the lit fixture (Hoth’s snow, the ring, the house’s exposure 1.4, the lamps off) under that world’s own main weather: its VisualEnvironment records from the bucket made the light stack’s entry (`scripts/lib/bf2017-picture.mjs`’s `entryOf`), on the node renderer over WebGL 2 (SwiftShader), at ultra, 960 × 540:

```
node scripts/light-fixture.mjs --picture off --world <w> --post on --tier ultra --legs webgl --size 960x540 --frame
node scripts/light-fixture.mjs --picture     --world <w> --post on --tier ultra --legs webgl --size 960x540 --frame
```

- `<w>-nopicture.webp`: the before, the chain as `main` builds it for a record (the house’s tone map, the site’s bloom and AO, the fixture’s cool test LUT over the encoded picture, the analytic sky).
- `<w>-picture.webp`: the after, the record’s picture through `applyGameLight(..., { picture })` with `<w>.picture.json`’s main weather: its tone map, the 33³ LUT after it, the five Gaussians, the HBAO numbers, the painted panorama, the fog gradient and the cloud texture.
- `<w>-nopicture-post-ultra.json`, `<w>-picture-post-ultra.json`: the runs’ numbers (their `shot` names the canvas PNG the WebP was made from) (`meanLum`, the frame’s mean linear luminance as lane G measures it; `horizon`, the sky’s in two bands over the horizon with the chain off; the passes).

The shots are the canvas shrunk to WebP; the horizon and cloud-texture views the fixture also takes are left out (lane Q6’s README has Hoth’s).

## The numbers

| world | weathers | panorama (main) | LUT | cloud texture | picture KB (all weathers) | mean lum, no picture | mean lum, picture | change | in lane G’s band |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bespin | dusk (main), interior | 2048 × 1024 | 33³ | yes | 1,597 | 0.6683 | 0.9668 | +44.7 % | **out** |
| endor | sunny (main), night, foggy, interior | 2048 × 512 | 33³ | yes | 1,693 | 0.3283 | 0.3665 | +11.6 % | in |
| geonosis | cloudy (main), interior | 2048 × 512 | 33³ | yes | 1,634 | 0.2995 | 0.3704 | +23.7 % | in |
| hoth | sunny (main), sunset, interior | 2048 × 512 | 33³ | yes | 2,576 | 0.3638 | 0.3636 | -0.1 % | in |
| kamino | stormy (main), interior | 2048 × 512 | 33³ | yes | 888 | 0.1828 | 0.7085 | +287.6 % | **out** |
| kashyyyk | overcast (main), interior, night | 2048 × 512 | 33³ | yes | 1,397 | 0.4228 | 0.729 | +72.4 % | **out** |
| naboo | dusk (main) | 2048 × 512 | 33³ | yes | 1,406 | 0.9101 | 0.8074 | -11.3 % | **out** |
| scarif | sunset (main) | 2048 × 512 | 33³ | none named | 593 | 0.9166 | 0.9994 | +9.0 % | **out** |
| tatooine | sunny (main), interior | 2048 × 512 | 33³ | none named | 718 | 0.6788 | 0.6481 | -4.5 % | **out** |
| yavin | sunny (main), interior, sunset | 2048 × 512 | 33³ | yes | 1,872 | 0.3791 | 0.464 | +22.4 % | **out** |

The panorama gain (`sky.js`’s `panoramaGain`: the painted sky’s foot scaled to the model’s sky where they meet) per world’s main weather, from the same entry: Hoth 0.38, Endor 0.46, Geonosis 0.63, Tatooine 0.70, Naboo 0.28, Yavin 1.50, Kashyyyk 1.98, Scarif 2.70, Bespin 5.66, Kamino 9.99.

The band is lane G’s (`docs/superpowers/evidence/bf2017-light/`): the mean luminance its calibrated worlds put on screen under the game’s light, 0.1008 (Hoth’s speeder hangar) to 0.4167 (Scarif), Hoth’s field the anchor at 0.3531; no file names a narrower one. It measures the worlds’ own views, not this fixture: on Hoth’s snow at Hoth’s exposure, five worlds are over it before their picture is drawn at all (Bespin, Naboo, Scarif, Tatooine, Kashyyyk), so the column says where the after lands and the change column is the picture’s own effect. Each world outside is a finding below, not a constant.

## Findings

- **Hoth, Endor, Geonosis** are inside the band with their picture (Hoth unchanged, −0.1 %; Endor +11.6 %, Geonosis +23.7 %), the LUT after the tone map on each (`tonemap lut` in the chain).
- **Kamino (+288 %), Bespin (+45 %, 0.97: near white), Kashyyyk (+72 %)**: dark-footed panoramas (a storm, a dusk over the cloud sea, an overcast) take large gains (10.0, 5.7, 2.0), because lane Q6’s rule matches the painted sky’s foot to the analytic sky, which a storm or a dusk painting does not resemble. Kamino’s storm draws as a bright cyan day. The cure is the record’s own scale, which the desktop’s HDR panoramas (lane W, `hdr` in a row) carry and the LDR copies lost; until `sky.js` reads them, these three are the picture’s known fault.
- **Scarif (0.92 → 0.9994)** is white before and after: its record’s fog fills the fixture at Hoth’s exposure; the picture clamps what was left. Not the picture’s, but the fixture’s exposure against Scarif’s record.
- **Naboo (0.91 → 0.81)**: the record’s fog colour reads as (1,298, 2,125, 3,072) through `entry.js` (a record in other units than the others’); its site passes no `picture` (lane G’s ruling stands), so nothing on the site changes.
- **Tatooine (0.68 → 0.65)** and **Yavin (0.38 → 0.46)** move little; Yavin’s pillars go navy under its Takodana-named grade (below).
- **The fixture’s ground and exposure are Hoth’s**: the comparison is of each record’s picture on one stage, not of each world as its surface will draw it; that is lane T2’s and the gallery’s (G).

## The records

- **Every weather’s picture**: 24 weathers over ten worlds, each with its panorama, fog gradient and the game’s whole 33³ LUT (a 1,089 × 33 strip beside the 17³ the classic surface keeps; every shared point equal), 20 with a cloud-shadow texture (Scarif and Tatooine name none). 63 files, 14.7 MB, published by hash to `site-assets` (`src/data/galaxyAssets.json`); git keeps none of them.
- **The overrides**: a weather’s record over the day’s now takes only the fields its `PropertyOverrides` name, as `bf2017-light.mjs`’s `readVE` does. Before, Kashyyyk’s interior, which sets nothing of the grade, wiped the day’s LUT, and Endor’s caves wiped its panorama.
- **The picture fields**: each row carries the record’s picture fields by name (`record`), because an entry built from a site’s own tables (the galaxy’s `light/<world>.json`, the Battlefront rulebook) has the numbers but not the textures’ names; `grade.js`’s `withPicture(entry, row)` lays them over it.
- **The tone maps**: five of the ten records name `TonemapMethod_Linear`; Endor, Geonosis, Naboo and Yavin name `FilmicNeutral` and Scarif `LinearApproxGamma`, which `grade.js` did not read, so their LUT read the house’s ACES-encoded picture. `TONEMAPS` now maps FilmicNeutral to three’s Neutral (the export carries no curve) and LinearApproxGamma to the linear map.
- **A sequel-era name**: Yavin’s day and interior and Endor’s night grade through `Levels/Lighting/Takodana/Sunny/T_CC_Takodana_Sunny_02`, the records’ own choice (lane G’s 17³ already ships it). It is a colour cube and draws nothing of Takodana; it is named here for the owner to rule on.

## Left

- Naboo’s record and picture are written; its site still names no `gameLight` (lane G: its dusk reads 62 % darker without the game’s bounce), so it passes no `picture`.
- Drawing the picture on the galaxy surface is lane T2’s (`scene.js`); until it lands, the fixture and the Battlefront world are where it shows.
- The panoramas are the desktop’s 2,048-wide LDR encodes; lane W’s HDR copies (`hdr` in a row, when made) are not yet read by `sky.js`.
