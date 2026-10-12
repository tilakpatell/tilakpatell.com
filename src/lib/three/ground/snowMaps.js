// Hoth's base snow as the game's terrain shader reads it (the owner's study,
// bf2-re/findings/35-terrain-layers.md, and the listing it keeps,
// data/shaders/dis/rvm/hoth-terrain-2d-511.asm, whose immediates these are):
// the maps, what each is for, its tiling in cycles a metre, its scroll in
// cycles a second, and the size each tier that reads it draws it at. Data
// only: the material is snow.js, the import scripts/bf2017-snow.mjs. The
// slugs are the level pack's tex rows (tex/<slug>.<size>.ktx2).
//
// The untouched base snow (layer 0), read off the listing:
//   colour    cb1[13], the engine's base colour, the same on every snow
//             layer: the record's TerrainColor (the clamp decision,
//             2026-10-12)
//   normals   Snow_02_N at 0.25/m (4 m tiles) + the same at 0.03/m (33 m) +
//             SnowDetail_01_N at 1/m, their two channels summed (2t − 1
//             each), z rebuilt from the 4 m read alone; green runs to −z
//             (the frame is world x, the ground normal × x, the ground normal)
//   smoothness  0.26 (0.25 where the blowing snow lies)
//   streaks   the blowing snow, layer 7, in a frame turned 3 rad (171.9°:
//             cos −0.989992, sin 0.141120): BlowingSnowFlowMap_01_C's red
//             and green at (0.08, 0.04) cycles/m sliding 0.06 a second,
//             × 0.8 − 0.1, offset two reads of SnowPackedSmoothness_01_RGBM's
//             blue, at 0.2/m sliding 0.5 a second and at (0.02, 0.08)
//             sliding 0.2; the weight smoothstep(sat(4(a² − a²b² − 0.15)))
//             times the layer's painted mask. The layer has the base's
//             colour, a flat normal and smoothness 0.25
//   sparkle   SnowSparkle_03_RGBM on the 3-D (near) pass alone (the pass's
//             own shader is not listed: the tiling here is the site's)
//   displacement  the blue of a 0.2/m height × 0.35 + 0.4, by the engine's
//             DetailDisplacementScale (the height is bound by the engine;
//             the site reads the 4 m map's blue)
//
// Not here, and why: the listing reads SnowSmoothnessVirtualTexture_01_RGBM
// (0.45/m, its red + 0.05 a grey) and BlackSootMask_01_C (0.2/m, blue ×
// alpha ramped over 0.8 … 0.91) only inside the dynamic mask, the tracks
// and craters the game paints as it plays: untouched snow (the mask 0)
// is cb1[13] at smoothness 0.26 whatever those two say. The site paints no
// such mask yet, so neither map is fetched or drawn.

// (a tier that reads no map, snow.js's mapsFor, shares the next one's row:
// the import writes a file for each size named, and none for nothing)
export const SNOW_MAPS = {
  t_arcticbase_snow_02_n: { kind: 'normal', cycles: [0.25, 0.03], sizes: { low: 512, mid: 512, high: 1024, ultra: 2048 } },
  t_arcticbase_snowdetail_01_n: { kind: 'normal', cycles: [1], sizes: { low: 256, mid: 256, high: 512, ultra: 512 } },
  // (the pack has this one already, at these sizes: lane Q2's /roam ground reads it)
  t_arcticbase_snowsparkle_03_rgbm: { kind: 'sparkle', cycles: [1], sizes: { low: 256, mid: 512, high: 512, ultra: 512 } },
  // (its blue is the wisps; the near read's 5 m tile is a centimetre a pixel at 512)
  t_arcticbase_snowpackedsmoothness_01_rgbm: {
    kind: 'streaks',
    cycles: [
      [0.2, 0.2],
      [0.02, 0.08],
    ],
    rates: [0.5, 0.2],
    sizes: { low: 512, mid: 512, high: 512, ultra: 1024 },
  },
  t_blowingsnowflowmap_01_c: { kind: 'flow', srgb: true, cycles: [[0.08, 0.04]], rates: [0.06], sizes: { low: 512, mid: 512, high: 512, ultra: 512 } },
};

// the map a role reads: { role → slug }
export const SNOW_ROLES = Object.fromEntries(
  Object.entries(SNOW_MAPS).flatMap(([slug, m]) => (m.kind === 'normal' ? [] : [[m.kind, slug]])),
);
export const SNOW_BASE = 't_arcticbase_snow_02_n';
export const SNOW_DETAIL = 't_arcticbase_snowdetail_01_n';

// the record's numbers
export const SNOW = {
  colour: [0.546830952, 0.594003737, 0.644479752], // TerrainColor, VE_Sky_Arctic_Sunny_01's EnlightenComponentData
  smoothness: 0.26,
  streakSmoothness: 0.25,
  windRad: 3, // the streaks' frame: the listing's (−0.989992, 0.141120) is (cos 3, sin 3)
  flowGain: 0.8,
  flowBias: -0.1,
  streakBias: 0.15,
  displacement: { cycles: 0.2, gain: 0.35, lift: 0.4 },
};
