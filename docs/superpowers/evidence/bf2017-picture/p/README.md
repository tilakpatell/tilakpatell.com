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
- `<w>-nopicture-post-ultra.json`, `<w>-picture-post-ultra.json`: the runs’ numbers (`meanLum`, the frame’s mean linear luminance as lane G measures it; `horizon`, the sky’s in two bands over the horizon with the chain off; the passes).

The shots are the canvas shrunk to WebP; the horizon and cloud-texture views the fixture also takes are left out (lane Q6’s README has Hoth’s).

## The numbers

TABLE

The band is lane G’s (`docs/superpowers/evidence/bf2017-light/`): the mean luminance its calibrated worlds put on screen under the game’s light, 0.1008 (Hoth’s speeder hangar) to 0.4167 (Scarif), Hoth’s field the anchor at 0.3531. No file names a narrower band; a world whose after leaves it is a finding below, not a constant.

FINDINGS

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
