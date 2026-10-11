// The record's picture (the surfaces design, §6 and lane Q6): the
// weather's tone map, grade and ambient occlusion read into the post
// chain's numbers, and the sky's painted textures named for sky.js, fog.js
// and clouds.js. Pure: apply.js loads what it names.
//
// The game's order, which post.js keeps: the scene → the bloom (the
// record's five Gaussians, added to the HDR scene) → the tone map
// (TonemapMethod_Linear on Hoth: the exposed scene clamped to 0…1) → the
// HDR grading LUT (HdrColorGradingLut, read over 0…ColorGradingMaxHdrValue,
// 1 on Hoth: so over the tone-mapped 0…1) → the site's output. A LUT before
// the tone map would clamp every bright pixel to its last cell (Hoth's snow).
//
// What the records say (Hoth Sunny, VE_Sky_Arctic_Sunny_01, read 2026-10-10):
// - TonemapComponentData: TonemapMethod_Linear; BloomMethod_GaussianSimple,
//   Gaussian1..5Weight 0, 0, 0.2, 0.35, 0.5 and Gaussian1..5Color (blue
//   tints, Gaussian5 0.41, 0.57, 0.81), BloomScale 0.1 per channel;
//   LensDirtTexture and FFTKernelTexture null. The record names weights and
//   colours, not radii: Gaussian i is the bloom pyramid's level i
//   (GAUSSIAN_LEVELS), which is how three's BloomNode already draws five
//   blurs (one at each of its five mips, kernels 6 to 22 texels): one node,
//   its factors and tints set from the record (bloomTints), no added pass.
//   GaussianSimple has no threshold: everything glows by its share.
// - ColorCorrectionComponentData: HdrColorGradingLut T_CC_Hoth_Sunny_01 (a
//   GradingLutAsset, 33³ like all 63 in the export's textures.jsonl:
//   GAME_LUT_SIZE; the site serves it halved to 17³, scripts/bf2017-light.mjs).
// - DynamicAOComponentData: HbaoRadius 1.5 m, HbaoAngleBias 15°,
//   HbaoAttenuation 0.7, HbaoContrast 0.65, HbaoPowerExponent 2,
//   HbaoBlurRadius 8, HbaoBlurSharpness 4. Into three's GTAO (passes.js):
//   the radius as its radius, the power exponent as its `scale` (GTAO's
//   pow(ao, scale), which is what HBAO+'s PowerExponent is), the
//   attenuation as its distance fall-off, the blur radius as the denoise's;
//   the angle bias, contrast and sharpness have no GTAO knob and are kept
//   as data.
// - SkyComponentData: PanoramicTexture T_Hoth_Sunny_02_C (8,192 × 2,048
//   BC6U in the export; the bucket's KTX2 is 2,048 × 512 UASTC, linear,
//   clamped to 0…1: the HDR above 1 is lost, the sun's disc with it),
//   PanoramicRotation 0.963, PanoramicUVMinY 0.01; SkyGradientTexture
//   T_Hoth_Sunny_02_Fog_C (512 × 256).
// - OutdoorLightComponentData: CloudShadowTexture T_Arctic_01_CloudShadow_RGBM
//   (2,048², BC1: no alpha, so its RGBM's multiplier is 1 throughout),
//   CloudShadowIsTopDown, CloudShadowAddressingMode TaWrap.
//
// The panorama's mapping, read off the textures (not documented): the
// upper hemisphere as an equirect, u = fract(PanoramicRotation − azimuth / 2π)
// (the rotation in turns, the azimuth from +Z toward +X as entry.js's
// sunDir: the record's sun, azimuth 265.61°, lands on the painted sun's
// u 0.225 exactly) and v = MinY + (MaxY − MinY) · (1 − elevation / 90°), the
// zenith at the top. The painted sun of Hoth's day stands at about 16°
// (v 0.82) against the record's 32.9°: v = cos(elevation) would put it at
// the record's, but squeezes the sky's lowest 12° into 11 of the 512 rows
// and drew the fixture's horizon as vertical smears; Hoth's sunset (its
// sun at 10.25°, its glow at the horizon's foot) fits the equirect. So the
// record's disc is drawn at the record's sun and the painted glow stays
// where it was painted. The fog gradient is the whole sphere at the same
// rotation, the zenith at its top and the nadir at its foot.
//
// GAUSSIAN_LEVELS, BLOOM_FACTORS, GAME_LUT_SIZE, RGBM_RANGE
// gradeOf(record, { name }) → { tonemap, lut, bloom, ao, _source } | null
// bloomTints(bloom) → { strength, threshold, tints: [[r, g, b] × 5], levels }   (BloomNode's)
// panoramaOf(record) → { name, gradient, rotation, uv: [minX, minY, maxX, maxY], tile, _source } | null
// cloudShadowOf(record) → { name, rgbm, topDown, wrap, offset } | null
// panoramaUV(dir, panorama) → [u, v];  gradientUV(dir, rotation) → [u, v]
// rgbmDecode([r, g, b, a]) → [r, g, b] in 0…1
// pictureOf(entry, picture) → { grade, lut, panorama, gradient, cloudShadow } | null
//   (the caller's `picture`, or the entry's own `entry.picture`: true for the
//   record's numbers alone, or { lut: { url, size }, panorama: { url, horizon },
//   gradient: { url }, cloudShadow: { url } } for its textures too; null
//   without one, so a world that asks for nothing draws as before)

// the bloom pyramid's level each of the record's Gaussians blurs at
export const GAUSSIAN_LEVELS = [1, 2, 3, 4, 5];
// three's BloomNode weighs its five mips by these at radius 0 (its source)
export const BLOOM_FACTORS = [1, 0.8, 0.6, 0.4, 0.2];
// the export's GradingLutAssets are all 33³ (textures.jsonl, 63 of them)
export const GAME_LUT_SIZE = 33;
// an _RGBM map's multiplier range: rgb × a × 6 (the suffix's encoding)
export const RGBM_RANGE = 6;

const first = (v) => (Array.isArray(v) ? v[0] : v);
const comp = (r, name) => first(r?.[`${name}ComponentData`]) ?? null;
const has = (o, k) => o && (o[k] !== undefined || o[`${k}.x`] !== undefined);
function field(o, k) {
  if (!o) return undefined;
  if (o[k] !== undefined) return o[k];
  if (o[`${k}.x`] !== undefined) return { x: o[`${k}.x`], y: o[`${k}.y`], z: o[`${k}.z`] };
  return undefined;
}
const num = (v, d) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? d : Number(v));
const vec3 = (v, d) => {
  if (Array.isArray(v) && v.length >= 3) return v.slice(0, 3).map(Number);
  if (v && typeof v === 'object' && 'x' in v) return [v.x, v.y, v.z].map(Number);
  if (typeof v === 'number') return [v, v, v];
  return d.slice();
};
const asset = (v) => (typeof v === 'string' && v ? v : v && typeof v === 'object' && typeof v.$asset === 'string' ? v.$asset : null);

export function gradeOf(record, { name = null } = {}) {
  const tone = comp(record, 'Tonemap');
  const cc = comp(record, 'ColorCorrection');
  const dao = comp(record, 'DynamicAO');
  if (!tone && !cc && !dao) return null;
  const _source = { record: name };

  let tonemap = null;
  if (tone?.TonemapMethod === 'TonemapMethod_Linear') {
    tonemap = 'linear';
    _source.tonemap = 'TonemapComponentData.TonemapMethod';
  }

  let lut = null;
  const lutName = asset(cc?.HdrColorGradingLut);
  if (lutName && cc.ColorGradingEnable !== false && cc.Enable !== false) {
    lut = { name: lutName, size: GAME_LUT_SIZE, maxHdr: num(cc.ColorGradingMaxHdrValue, 1) };
    Object.assign(_source, { 'lut.name': 'ColorCorrectionComponentData.HdrColorGradingLut', 'lut.size': 'GAME_LUT_SIZE', 'lut.maxHdr': 'ColorCorrectionComponentData.ColorGradingMaxHdrValue' });
  }

  let bloom = null;
  const gaussian = tone && (tone.BloomMethod === 'BloomMethod_GaussianSimple' || [1, 2, 3, 4, 5].some((i) => has(tone, `Gaussian${i}Weight`)));
  if (gaussian) {
    bloom = {
      scale: vec3(field(tone, 'BloomScale'), [0.1, 0.1, 0.1]),
      weights: [1, 2, 3, 4, 5].map((i) => num(tone[`Gaussian${i}Weight`], 0)),
      colors: [1, 2, 3, 4, 5].map((i) => vec3(field(tone, `Gaussian${i}Color`), [1, 1, 1])),
      levels: GAUSSIAN_LEVELS.slice(),
      lensDirt: asset(tone.LensDirtTexture),
    };
    Object.assign(_source, { 'bloom.scale': 'TonemapComponentData.BloomScale', 'bloom.weights': 'TonemapComponentData.Gaussian1..5Weight', 'bloom.colors': 'TonemapComponentData.Gaussian1..5Color', 'bloom.levels': 'GAUSSIAN_LEVELS', 'bloom.lensDirt': 'TonemapComponentData.LensDirtTexture' });
  }

  let ao = null;
  if (dao && dao.Enable !== false && has(dao, 'HbaoRadius')) {
    ao = {
      radius: num(dao.HbaoRadius, 1),
      bias: num(dao.HbaoAngleBias, 0),
      attenuation: num(dao.HbaoAttenuation, 1),
      contrast: num(dao.HbaoContrast, 1),
      exponent: num(dao.HbaoPowerExponent, 1),
      blur: num(dao.HbaoBlurRadius, 5),
      sharpness: num(dao.HbaoBlurSharpness, 1),
    };
    for (const [k, f] of Object.entries({ radius: 'Radius', bias: 'AngleBias', attenuation: 'Attenuation', contrast: 'Contrast', exponent: 'PowerExponent', blur: 'BlurRadius', sharpness: 'BlurSharpness' })) _source[`ao.${k}`] = `DynamicAOComponentData.Hbao${f}`;
  }
  if (!tonemap && !lut && !bloom && !ao) return null;
  return { tonemap, lut, bloom, ao, _source };
}

export function bloomTints(bloom) {
  const strength = Math.max(...bloom.scale);
  const k = bloom.scale.map((s) => (strength > 0 ? s / strength : 0));
  const tints = bloom.colors.map((c, i) => c.map((v, j) => (v * bloom.weights[i] * k[j]) / BLOOM_FACTORS[i]));
  return { strength, threshold: 0, tints, levels: bloom.levels.slice() };
}

export function panoramaOf(record) {
  const sky = comp(record, 'Sky');
  const name = asset(sky?.PanoramicTexture);
  if (!name) return null;
  return {
    name,
    gradient: asset(sky.SkyGradientTexture),
    rotation: num(sky.PanoramicRotation, 0),
    uv: [num(sky.PanoramicUVMinX, 0), num(sky.PanoramicUVMinY, 0), num(sky.PanoramicUVMaxX, 1), num(sky.PanoramicUVMaxY, 1)],
    tile: num(sky.PanoramicTileFactor, 1),
    _source: { name: 'SkyComponentData.PanoramicTexture', gradient: 'SkyComponentData.SkyGradientTexture', rotation: 'SkyComponentData.PanoramicRotation', uv: 'SkyComponentData.PanoramicUVMin/MaxX/Y', tile: 'SkyComponentData.PanoramicTileFactor' },
  };
}

export function cloudShadowOf(record) {
  const o = comp(record, 'OutdoorLight');
  const name = asset(o?.CloudShadowTexture);
  if (!name || o.CloudShadowEnable === false) return null;
  const off = field(o, 'CloudXZTranslation');
  return {
    name,
    rgbm: /_rgbm$/i.test(name),
    topDown: o.CloudShadowIsTopDown !== false,
    wrap: (o.CloudShadowAddressingMode ?? 'TaWrap') === 'TaWrap',
    offset: Array.isArray(off) ? off.slice(0, 2).map(Number) : off ? [num(off.x, 0), num(off.y, 0)] : [0, 0],
  };
}

const fract = (x) => x - Math.floor(x);
const azimuth = (d) => Math.atan2(d[0], d[2]) / (2 * Math.PI);
const unit = (d) => {
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  return [d[0] / l, d[1] / l, d[2] / l];
};

// the view's elevation as a share of a quarter turn: 0 at the horizon, 1 at the zenith
const lift = (d) => Math.asin(Math.max(-1, Math.min(1, d[1]))) / (Math.PI / 2);

export function panoramaUV(dir, p) {
  const d = unit(dir);
  const [minX, minY, maxX, maxY] = p.uv;
  const u = minX + (maxX - minX) * fract(p.rotation - azimuth(d));
  const v = minY + (maxY - minY) * (1 - Math.max(0, lift(d)));
  return [u, v];
}

export function gradientUV(dir, rotation = 0) {
  const d = unit(dir);
  return [fract(rotation - azimuth(d)), 0.5 - 0.5 * lift(d)];
}

export function rgbmDecode([r, g, b, a = 1]) {
  return [r, g, b].map((c) => Math.min(1, c * a * RGBM_RANGE));
}

export function pictureOf(entry, picture = null) {
  const ask = picture ?? entry?.picture ?? null;
  if (!ask) return null;
  const record = entry?.record ?? null;
  const grade = gradeOf(record, { name: entry?.name ?? null });
  const sky = panoramaOf(record);
  const cloud = cloudShadowOf(record);
  if (!grade && !sky && !cloud) return null;
  const urls = typeof ask === 'object' ? ask : {};
  return {
    grade,
    lut: grade?.lut && urls.lut?.url ? { url: urls.lut.url, size: urls.lut.size ?? GAME_LUT_SIZE } : null,
    panorama: sky && urls.panorama?.url ? { ...sky, url: urls.panorama.url, horizon: urls.panorama.horizon ?? null } : null,
    gradient: sky?.gradient && urls.gradient?.url ? { name: sky.gradient, url: urls.gradient.url, rotation: sky.rotation } : null,
    cloudShadow: cloud && urls.cloudShadow?.url ? { ...cloud, url: urls.cloudShadow.url } : null,
  };
}
