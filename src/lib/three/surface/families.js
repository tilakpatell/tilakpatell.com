// The game's surface shader families, read by name (lane Q1:
// docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md, "Q1"). The
// ShaderGraph records are opaque names, but each material's parameters are
// dumped (web/materials.jsonl): this says which family a shader is, which of
// its texture slots is which map, which of its vectors is which number, and
// the defaults where the dump has none. Pure: no three.js, so the recipe
// builder (scripts/lib/bf2017-recipes.mjs) and the material share it.
//
//   familyOf(shader, slots) → 'props' | … | 'glb'
//   slotsOf(textures) → the slot names that bind a real texture
//   MAPS: map key → the slot names it is read from, first found wins
//   PARAMS: param path → the vector names it is read from, first found wins

// ---- defaults the dump lacks (each a named number, said where it is from)

// the vehicle preset's own DetailTiling (SS_VehicleLargePreset_01 rows: 20, 20)
export const DETAIL_TILING = 20;
// the detail normal at full weight (NormalDetail_Intensity's most common value, 1)
export const DETAIL_NORMAL = 1;
// no smoothness from the detail (SmoothnessDetail_Intensity absent means none)
export const DETAIL_SMOOTHNESS = 0;
// the detail map's overall weight (DetailArrayStrength's most common value, 1)
export const DETAIL_STRENGTH = 1;
// parallax depth in UV units (the site's: no ParallaxScale on the row)
export const PARALLAX_SCALE = 0.02;
// grunge at full weight when the row names a colour and no intensity
export const GRUNGE_INTENSITY = 1;
// grunge and scorch tile once over the UVs when the row says nothing
export const OVERLAY_TILING = 1;
// the alpha a cut-out keeps (the GLB's alphaCutoff default)
export const ALPHA_CUTOFF = 0.5;
// The game's emissive is in nits (EmissiveIntensity reaches 333,210 on a
// Hoth lantern); the site's exposure is not the game's. Hoth's day exposes at
// EV 10 with +1.5 compensation (VE_Sky_Arctic_Sunny_01's TonemapComponentData),
// so a nit reads 2^1.5 / (1.2 × 2^10) of white; the result is held under the
// site's bloom ceiling.
export const EMISSIVE_EXPOSURE = 2 ** 1.5 / (1.2 * 2 ** 10);
export const EMISSIVE_MAX = 16;
// a mask map's channels (the presets' unique mask: paint in red, metal in
// green; unconfirmed by the graph, which is opaque: research_textures.json's
// `unconfirmed`)
export const PAINT_CHANNEL = 'r';
export const METAL_CHANNEL = 'g';
// the detail array's slice index in AOSlice's blue: tenths (the research's
// "discrete k/10 levels")
export const SLICE_STEPS = 10;
// the tiers and what each draws (the spec's "Tiers")
export const PARALLAX_STEPS = { ultra: 16, high: 8, mid: 0, low: 0 };

// ---- families

// By shader name, first match wins (the order settles overlaps: an emissive
// alpha-tested prop is `emissive`, not `propsNonMetallic`).
export const FAMILIES = [
  { name: 'hair', shaderRe: /Hair/i },
  { name: 'head', shaderRe: /Characters?Head|HeadPreset/i },
  { name: 'character', shaderRe: /SS_Characters?Preset/i },
  { name: 'creature', shaderRe: /Creature/i },
  { name: 'vegetation', shaderRe: /Vegetation|Foliage/i },
  { name: 'glass', shaderRe: /Glass/i },
  { name: 'decal', shaderRe: /Decal/i },
  {
    name: 'emissive',
    shaderRe: /EmissiveAlphaTest|EmissiveOnly|SS_Emissive_Lights/i,
  },
  { name: 'vehicleLarge', shaderRe: /VehicleLarge/i },
  { name: 'vehicle', shaderRe: /Vehicles?(Preset|NonMetallic|Metallic)/i },
  { name: 'weapon', shaderRe: /Weapons?Preset/i },
  { name: 'panels', shaderRe: /SS_Panels?_|PanelTile/i },
  { name: 'propsMetallic', shaderRe: /PropsMetallic|PropsInteriorMetallic/i },
  { name: 'propsNonMetallic', shaderRe: /PropsNonMetallic/i },
  { name: 'props', shaderRe: /SS_Props|ObjectsGeneric|ObjectPreset/i },
];

// A per-world instance (SS_Naboo_Concrete_01) takes the family whose slots
// it has: every slot pattern in `all` must match one of its slots.
export const SLOT_FAMILIES = [
  { name: 'hair', all: [/^HairColorTexture$/] },
  { name: 'head', all: [/RSSSAO$/i] },
  { name: 'character', all: [/^_?Base[Cc]olou?r$/, /^_?Normal$/, /^AOSlice$/] },
  { name: 'vegetation', all: [/_CA$|^_?CA$/, /NTS$|^_?NS$/] },
  { name: 'panels', all: [/^_?CS$/, /^_?NMR$/] },
  { name: 'props', all: [/^_?CS$/, /^_?NAM(_texcoord\d)?$/] },
  { name: 'props', all: [/^_?Base[Cc]olou?r$/, /^_?Normals?$/] },
  { name: 'props', all: [/^_?CS$/, /^_?(NW|NM|N|Normal)$/] },
  { name: 'props', all: [/^_?ColorSmoothness$/, /^_?Normal(AO)?$/] },
];

// the engine's own placeholders: a slot bound to one binds nothing
const DEFAULT_TEXTURE_RE = /^shaders\/T_Default/i;
export const isDefaultTexture = (name) => DEFAULT_TEXTURE_RE.test(name ?? '');
export const slotsOf = (textures = {}) => Object.keys(textures).filter((k) => textures[k] && !isDefaultTexture(textures[k]));

export function familyOf(shader, slots = []) {
  if (!shader || !slots.length) return 'glb';
  const short = shader.split('/').pop();
  const byName = FAMILIES.find((f) => f.shaderRe.test(short));
  if (byName) return byName.name;
  const bySlots = SLOT_FAMILIES.find((f) => f.all.every((re) => slots.some((s) => re.test(s))));
  if (bySlots) return bySlots.name;
  // (no family, but a map the recipe draws: the GLB's three under it)
  return slots.some((s) => DRAWN_SLOTS.has(s)) ? 'instance' : 'glb';
}

// ---- maps: which slot is which map (the export's GLB carries the colour,
// normal and ORM; these are the maps on top of them)

export const MAPS = {
  detail: ['_DetailNormal', 'DetailNormal', 'NormalDetail', 'Detail_NM', 'TilingNormal', 'DetailNS', 'NormalmapDetail', '1DetailNormal', 'NS'],
  detailArray: ['NormalDetailTextureArray'],
  aoSlice: ['AOSlice'],
  grunge: ['GrungeMask', 'GrungeMap'],
  breakupColor: ['BreakUpColorRGBA'],
  breakupNormal: ['BreakUpNormalRGBA'],
  scorch: ['ScorchMask'],
  height: ['ParallaxOcclusionHeightmap'],
  wear: ['__WearMap', '__WearRGBA'],
  weathering: ['WeatheringMask', '_WeatheringMask'],
  emissive: ['_E', '_Emissive', 'NormalEmissive', '__NormalEmissiveAO'],
  idMap: ['__IdMap'],
  tintSwatch: ['TintSwatchTexture'],
  mask: ['UniqueMask_01', 'RGBAUnique', 'UniqueMap', 'RGBA_Mask', '_Mask'],
  // hair's strand flow (rg) and a head's reflectance, scattering and AO
  hairStrand: ['HairStrandTexture'],
  sss: ['RSSSAO', '_RSSSAO'],
};

const DRAWN_SLOTS = new Set(Object.values(MAPS).flat());

// what each map is, for the fetch's order (the desktop encodes detail,
// height, overlay, emissive, mask in that order)
export const MAP_KINDS = {
  detail: 'detail',
  detailArray: 'array',
  aoSlice: 'mask',
  grunge: 'overlay',
  breakupColor: 'overlay',
  breakupNormal: 'overlay',
  scorch: 'overlay',
  height: 'height',
  wear: 'overlay',
  weathering: 'mask',
  emissive: 'emissive',
  idMap: 'mask',
  tintSwatch: 'mask',
  mask: 'mask',
  hairStrand: 'mask',
  sss: 'mask',
};

// the colour slots, for an alpha test read off the map's suffix (`_CA`:
// colour + alpha)
export const COLOR_SLOTS = ['_BaseColor', 'BaseColor', 'Basecolor', 'BaseColour', '_CS', 'CS', '_CA', '_ColorSmoothness', 'ColorSmoothness', 'CW'];

// ---- parameters: which vector is which number

export const PARAMS = {
  'detail.tiling': ['GlobalTilingDetailmap', 'DetailTiling', 'Detail_Tiling', '___DetailTile', 'DetailNormalTiling', 'DetailNormal_Tiling', 'NormalDetailScalar', 'DetailMapTiling', 'DetailTile'],
  'detail.normal': ['NormalDetail_Intensity', 'DetailNormalStrength'],
  'detail.smoothness': ['SmoothnessDetail_Intensity'],
  'detail.strength': ['DetailArrayStrength', 'GlobalDetailStrength', 'DetailStrength', 'Detail_Strength'],
  'emissive.color': ['EmissiveColor'],
  'emissive.intensity': ['EmissiveIntensity', 'EmissiveIntensety', 'EmissiveStrength', 'EmissivePower'],
  'emissive.blink': ['BlinkLength01', 'BlinkLength02'],
  paint: ['PaintColour', 'MetalPaintColor'],
  metal: ['MetalColour', 'MetalColor'],
  tint: ['ColorTint'],
  'grunge.color': ['GrungeColour_01'],
  'grunge.intensity': ['GrungeIntensity'],
  'grunge.tiling': ['GrungeTiling', 'AlphaGrunge_Tile'],
  'scorch.tiling': ['ScorchTiling'],
  'scorch.ember': ['ScorchEmberIntensity', 'ScorchEmissiveIntensity'],
  'breakup.tiling': ['BreakupMaskTiling', 'BreakUpRGBATiling'],
  'parallax.scale': ['ParallaxScale', 'ParallaxHeightmapscale', 'ParallaxHeight'],
  'reflectance.up': ['ReflectanceUp'],
  'reflectance.down': ['ReflectanceDown'],
  'backface.subsurface': ['SubsurfaceBackfaceScale'],
  'backface.smoothness': ['SmoothnessBackfaceScale'],
  aoDirt: ['AODirtColor'],
  'hair.melanin': ['MelaninXY'],
  'hair.tip': ['TintTipColor'],
  'hair.tipMin': ['TintTipColorMin'],
  'hair.tipMax': ['TintTipColorMax'],
  'hair.smoothness': ['Smoothness'],
  'hair.normalScale': ['HairNormalScale'],
};

// the conditionals and bools the recipe reads (Shaders/ExternalConditionals/<name>)
export const FLAGS = {
  wreck: 'ESB_VehicleIsWreck',
  parallax: 'ESB_ParallaxEnable',
  terrainBlend: 'ESB_TerrainVirtualTextureBlendEnable',
  'weather.top': 'ESB_TopDirt',
  'weather.sand': 'ESB_Sand',
  'weather.rain': 'ESB_Rain',
  emissiveMode: 'ESS_Emissive',
  emissiveFrom: 'ESS_Emissive_02',
  uvSet: 'ESS_SliceArrayTexCoord_01',
  melanin: 'ESB_MelaninColor',
};
