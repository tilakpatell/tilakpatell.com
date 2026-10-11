# The Enlighten atlases: what lane Q3 gets from the desktop

Written 2026-10-11 by lane W from the export’s texture index (`web/textures.jsonl` in the bucket, 17,511 rows; `_source` for every number below) and the surfaces design (`docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md`, “the baked light”). The job that sends them is `scripts/desktop/bf2017-atlases.mjs`; its run writes `made.json` beside this note.

## What the export holds

Every lit level has one set per lighting setup (`StaticEnlightenData`), five textures to a set, the same size within a set:

| map | suffix | in the export | count (index) | after the era rule |
| --- | --- | --- | --: | --: |
| irradiance | `_staticIrradianceTexture` | BC6U (187) or R9G9B9E5 (13): **HDR** | 200 | 176 |
| direction, one a colour channel | `_staticDirectionTextureR`, `G`, `B` | BC7, linear | 588 | 516 |
| sky visibility | `_staticSkyVisibilityData` | BC7, linear | 200 | 176 |

- `_source`: the index rows whose names end in those suffixes; the era rule is `scripts/lib/bf2017-manifest.mjs`’s `isSequel` (24 sets are the sequel era’s and are never sent).
- Sizes run from 4 × 4 (a spawn room’s split-screen set) to 5,564 × 6,144 (the Death Star’s); 119 sets are 1,024 or more on a side; Hoth_01’s two outdoor sets (`EN_Hoth_01_Static_Sunset`, `FL_Hoth_Cloudy_01_Static`) are 3,128 × 3,680. The 30 maps over 4,096 are cut to fit 4,096 on their longer side (`fitSize`, `--max 4096`).
- The PNGs the export wrote are 8-bit: 5.9 GB for the 988 rows, 4.8 GB for the 868 the era rule keeps (the index’s `bytes`). An irradiance PNG is therefore clamped to 1, which is why the job makes the irradiance HDR from the exporter’s `.dds` when there is one.

## What the bucket gets

| map | bucket path | encoding |
| --- | --- | --- |
| direction R, G, B and sky visibility | `web/<export path>.ktx2` | the export’s encoder, UASTC (class `attrib`: linear, not colour), at most 4,096 |
| irradiance (always) | `web/<export path>.ktx2` | the same UASTC, from the 8-bit PNG: clamped to 1, for a first look only |
| irradiance (HDR, when the exporter wrote the `.dds`) | `web/hdr/<export path>.<width>.ktx2` | RGBA16F KTX2 (`VK_FORMAT_R16G16B16A16_SFLOAT`, linear, Zstandard), texconv’s decode of the BC6U re-wrapped (`scripts/lib/ktx2-hdr.mjs`); `made.json`’s `peak` is each one’s brightest texel |

## What Q3 still needs that this does not give

- **The mapping.** The atlases are of no use without each instance’s chart rectangle and a lightmap UV; the surfaces design’s spike (`tool/EnlightenResProbe.cs` on the `DatabaseResource`) is still where that comes from. This job only puts the pictures where a cloud session can read them.
- **The directional term.** Enlighten’s directional irradiance is one direction map per colour channel (`DirectionalIrradianceRgbEnable: true` in the records); a shader samples all four maps per texel.
- **The record’s numbers** (`EnlightenComponentData`: `BounceScale`, `SunScale`, `TerrainColor`, the sky colours) are already in the light records (lane Q3’s `bounce.js`), not in these textures.
