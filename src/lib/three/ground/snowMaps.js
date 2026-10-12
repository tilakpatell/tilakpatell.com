// Hoth's base snow as the game's terrain shader reads it (the owner's study,
// bf2-re/findings/35-terrain-layers.md: the all-layers tile shader's
// immediates, and its 3-D pass): the maps, what each is for, its tiling in
// cycles a metre, and the size each tier draws it at. Data only: the
// material is snow.js, the import scripts/bf2017-snow.mjs. The slugs are the
// level pack's tex rows (tex/<slug>.<size>.ktx2).
//
// The game's constants, read off the shader (finding 35, "Hoth's all-layers
// tile shader"):
//   normals   Snow_02_N at 0.25/m (4 m tiles) + the same at 0.03/m (33 m) +
//             SnowDetail_01_N at 1/m, summed as two-channel normals
//   colour    cb1[13], the engine's base colour: the record's TerrainColor
//             (the clamp decision, 2026-10-12)
//   brightness  SmoothnessVirtualTexture_01_RGBM.r + 0.05 at 0.45/m
//   smoothness  0.26 (0.25 on the blowing streaks)
//   soot      BlackSootMask_01_C.r × .b over 0.9 at 0.2/m
//   streaks   two reads of SnowPackedSmoothness_01_RGBM scrolled along 172°
//             at (0.08, 0.04) and (0.02, 0.08) cycles/m, offset by
//             BlowingSnowFlowMap_01_C × 0.8 − 0.1 at 0.2/m, combined as
//             smoothstep(sat(4(a² − a²b² − 0.15)))
//   sparkle   SnowSparkle_03_RGBM on the 3-D (near) pass alone
//   displacement  the blue of a 0.2/m height × 0.35 + 0.4, by the engine's scale

export const SNOW_MAPS = {
  t_arcticbase_snow_02_n: { kind: 'normal', cycles: [0.25, 0.03], sizes: { low: 256, mid: 512, high: 1024, ultra: 2048 } },
  t_arcticbase_snowdetail_01_n: { kind: 'normal', cycles: [1], sizes: { low: 256, mid: 256, high: 512, ultra: 512 } },
  t_arcticbase_snowsmoothnessvirtualtexture_01_rgbm: { kind: 'brightness', cycles: [0.45], sizes: { low: 256, mid: 256, high: 512, ultra: 1024 } },
  t_blacksootmask_01_c: { kind: 'soot', srgb: true, cycles: [0.2], sizes: { low: 256, mid: 256, high: 512, ultra: 1024 } },
  t_arcticbase_snowsparkle_03_rgbm: { kind: 'sparkle', cycles: [1], sizes: { low: 256, mid: 256, high: 512, ultra: 512 } },
  // (the streaks tile over 12–50 m: a 1,024 px map is 2 cm a pixel there,
  // the 2,048 px source would be 4 MB for nothing seen)
  t_arcticbase_snowpackedsmoothness_01_rgbm: { kind: 'streaks', cycles: [[0.08, 0.04], [0.02, 0.08]], sizes: { low: 256, mid: 512, high: 1024, ultra: 1024 } },
  t_blowingsnowflowmap_01_c: { kind: 'flow', srgb: true, cycles: [0.2], sizes: { low: 256, mid: 256, high: 512, ultra: 512 } },
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
  brightnessLift: 0.05,
  sootOver: 0.9,
  windDeg: 172, // the streaks' direction: (cos, sin) = (−0.990, 0.141)
  flowGain: 0.8,
  flowBias: -0.1,
  streakBias: 0.15,
  displacement: { gain: 0.35, lift: 0.4 },
};
