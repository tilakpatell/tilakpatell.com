// Hoth's ground as the game's terrain tile shader reads it (the owner's
// study: bf2-re/findings/35 and 58, and the listing they keep,
// data/shaders/dis/rvm/hoth-terrain-2d-511.asm, whose immediates these are):
// the nine layers, the maps each reads, at what tiling, and how the site
// packs them. Data only: the material is snow.js, the import
// scripts/bf2017-snow.mjs, the masks scripts/bf2017-terrain-masks.mjs.
//
// The site's files: the game's maps of one size and colour space packed as
// the layers of one KTX2 array (a WebGPU stage binds 16 textures; the
// shader's 18 maps would not fit beside the masks and the sun's cascades),
// written at each size its tiers read (tex/<slug>.<size>.ktx2). Slot names
// are the listing's registers; three of them (t14, t16, t18) the RVM
// database does not name, and findings/58 reads them from the shaders'
// depots by elimination: t8 is SnowRough_03_N (every depot has it, and the
// 3-layer shader's six slots are its six names), t14 SnowSmoothnessVirtual-
// Texture_01_RGBM (in a depot exactly when layer 2 is), t16 and t18 the
// rough map again (sampler s4, the one name left).
//
// The constants the listing compiles in (smoothness, the mask edges, the
// blowing snow's frame and rates) are in SNOW and LAYERS below; the one it
// does not, the base colour cb1[13], is the record's TerrainColor (the clamp
// decision, 2026-10-12: src/data/bf2017/NOTES.md).

const SIZES = { low: 512, mid: 512, high: 1024, ultra: 2048 };

// file slug → { kind, srgb, sizes, layers (the export's maps, in array order) }
export const SNOW_FILES = {
  hoth_snow_normals: {
    kind: 'normals',
    srgb: false,
    sizes: SIZES,
    layers: [
      't_arcticbase_snow_02_n',
      't_arcticbase_snowrough_03_n',
      't_arcticbase_snowpacked_04_n',
      't_arcticbase_snowwavey_02_n',
      't_arcticbase_snowchunkywind_01_n',
      't_arcticbase_snowroughpacked_03_n',
      't_arcticbase_snowtrampled_01_n',
      't_arcticbase_snowrockypacked_04_n',
      't_arcticbase_snowrocky_02_n',
    ],
  },
  hoth_snow_colours: { kind: 'colours', srgb: true, sizes: SIZES, layers: ['t_arcticbase_snowrocky_04_c', 't_arcticbase_snowrocky_02_c'] },
  // (the packed smoothness is 2048 in the export, the virtual-texture one 1024: an array is one size)
  hoth_snow_data: { kind: 'data', srgb: false, sizes: { low: 512, mid: 512, high: 512, ultra: 1024 }, layers: ['t_arcticbase_snowpackedsmoothness_01_rgbm', 't_arcticbase_snowsmoothnessvirtualtexture_01_rgbm'] },
  hoth_snow_small: { kind: 'small', srgb: false, sizes: { low: 256, mid: 256, high: 512, ultra: 512 }, layers: ['t_arcticbase_snowdetail_01_n', 't_arcticbase_snowsparkle_03_rgbm'] },
  // (one map: the pack's row from before, published already)
  t_blowingsnowflowmap_01_c: { kind: 'flow', srgb: true, sizes: { low: 512, mid: 512, high: 512, ultra: 512 }, layers: null },
};
export const SNOW_KIND = Object.fromEntries(Object.entries(SNOW_FILES).map(([slug, f]) => [f.kind, slug]));

// a map's file and layer
export function mapAt(map) {
  for (const [slug, f] of Object.entries(SNOW_FILES)) {
    if (f.layers ? f.layers.includes(map) : slug === map) return { slug, kind: f.kind, layer: f.layers ? f.layers.indexOf(map) : 0 };
  }
  return null;
}

// The listing's reads: register, map, cycles a metre (or [u, v]), and a
// scroll in cycles a second along the wind's turned u.
export const READS = {
  snow4: { slot: 't6', map: 't_arcticbase_snow_02_n', cycles: 0.25 },
  snow33: { slot: 't6', map: 't_arcticbase_snow_02_n', cycles: 0.03 },
  detail: { slot: 't7', map: 't_arcticbase_snowdetail_01_n', cycles: 1 },
  // (t8 at 0.45 and t9: the dynamic mask's grey and soot, read only where the mask is painted)
  roughGrey: { slot: 't8', map: 't_arcticbase_snowrough_03_n', cycles: 0.45 },
  roughEdge: { slot: 't8', map: 't_arcticbase_snowrough_03_n', cycles: 0.5 },
  soot: { slot: 't9', map: 't_blacksootmask_01_c', cycles: 0.2 },
  packed: { slot: 't11', map: 't_arcticbase_snowpacked_04_n', cycles: 0.2 },
  wavey: { slot: 't12', map: 't_arcticbase_snowwavey_02_n', cycles: 0.03 },
  chunky: { slot: 't13', map: 't_arcticbase_snowchunkywind_01_n', cycles: 0.2 },
  chunkyNoise: { slot: 't14', map: 't_arcticbase_snowsmoothnessvirtualtexture_01_rgbm', cycles: 0.008 },
  roughPacked: { slot: 't15', map: 't_arcticbase_snowroughpacked_03_n', cycles: 0.2 },
  roughPackedDetail: { slot: 't16', map: 't_arcticbase_snowrough_03_n', cycles: 0.08 },
  trampled: { slot: 't17', map: 't_arcticbase_snowtrampled_01_n', cycles: 0.5 },
  trampledDetail: { slot: 't18', map: 't_arcticbase_snowrough_03_n', cycles: 0.5 },
  rockyPacked: { slot: 't19', map: 't_arcticbase_snowrockypacked_04_n', cycles: 0.2 },
  rockyPackedColour: { slot: 't20', map: 't_arcticbase_snowrocky_04_c', cycles: 0.2 },
  rocky: { slot: 't21', map: 't_arcticbase_snowrocky_02_n', cycles: 0.2 },
  rockyColour: { slot: 't22', map: 't_arcticbase_snowrocky_02_c', cycles: 0.2 },
  streakA: { slot: 't23', map: 't_arcticbase_snowpackedsmoothness_01_rgbm', cycles: [0.2, 0.2], rate: 0.5 },
  streakB: { slot: 't23', map: 't_arcticbase_snowpackedsmoothness_01_rgbm', cycles: [0.02, 0.08], rate: 0.2 },
  flow: { slot: 't24', map: 't_blowingsnowflowmap_01_c', cycles: [0.08, 0.04], rate: 0.06 },
  // (the on-screen pass's: its listing is not found, so the tiling is the site's: src/data/bf2017/NOTES.md)
  sparkle: { slot: '3d', map: 't_arcticbase_snowsparkle_03_rgbm', cycles: 1 },
};

// the record's numbers and the listing's immediates
export const SNOW = {
  colour: [0.546830952, 0.594003737, 0.644479752], // TerrainColor, VE_Sky_Arctic_Sunny_01's EnlightenComponentData (cb1[13]'s stand-in)
  smoothness: 0.26,
  streakSmoothness: 0.25,
  windRad: 3, // the streaks' frame: the listing's (−0.989992, 0.141120) is (cos 3, sin 3)
  flowGain: 0.8,
  flowBias: -0.1,
  streakBias: 0.15,
  displacement: { cycles: 0.2, gain: 0.35, lift: 0.4 },
};

// each layer's terms (the listing's blocks, layer k drawn when its weight > 0.01)
export const LAYERS = {
  // 1 packed: its mask broken by Packed_04_N's blue, m · (m + (1 − m) · b)
  // 2 chunky: its normal at double strength
  chunkyGain: 2,
  // 3 rough packed: its colour RoughPacked_03_N's alpha; t16 at half strength
  roughPackedDetailGain: 0.5,
  // 4 trampled: the mask broken by t8's alpha, smoothstep(sat(2 (m + (1 − m)(2 a m − m) − 0.2)))
  trampledEdge: { lift: 0.2, gain: 2 },
  // 5 rocky packed: height-blended by RockyPacked_04_N's blue, sat(5 ((1 − m)(3.2 h m − m) + m) − 1)
  rockyPackedBlend: { height: 3.2, gain: 5, lift: -1 },
  // 6 rocky: height-blended by Rocky_02_N's blue, sat(10 ((1 − m)(4 h m − m) + m) − 2); colour 0.9 × Rocky_02_C
  rockyBlend: { height: 4, gain: 10, lift: -2 },
  rockyColour: 0.9,
  rockySmoothness: { base: 0.26, gain: 0.24 },
  // the dynamic mask (tracks, craters: D, its alpha): S = (1 − D²)(1 + D² (2Q − 1)),
  // Q = (1 + rough.b − soot)(1 − rough.g), soot = sat((soot.b · soot.a − 0.8) / 0.11);
  // under it the colour goes to the grey rough.r + 0.05 through a brown edge
  soot: { gain: 9.090909, lift: -7.272727 },
  greyLift: 0.05,
  brown: [1, 1 - 0.372047, 1 - 0.794921],
  brownEdge: 10,
};
