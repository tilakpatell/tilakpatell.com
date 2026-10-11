import { describe, expect, it } from 'vitest';
import hoth from './fixtures/hoth.ve.json';
import { BLOOM_FACTORS, GAUSSIAN_LEVELS, RGBM_RANGE, bloomTints, cloudShadowOf, gradeOf, gradientUV, panoramaOf, panoramaUV, pictureOf, rgbmDecode } from './grade.js';
import { sunDir } from './entry.js';

const sunny = hoth.sunny.record;
const close = (a, b, e = 1e-6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], -Math.log10(e)));

describe('gradeOf', () => {
  it("reads Hoth Sunny's tone map, grade and HBAO", () => {
    const g = gradeOf(sunny, { name: hoth.sunny.name });
    expect(g.tonemap).toBe('linear');
    expect(g.lut).toEqual({ name: 'Levels/Lighting/Hoth/Sunny_01/T_CC_Hoth_Sunny_01', size: 33, maxHdr: 1 });
    expect(g.bloom.scale).toEqual([0.1, 0.1, 0.1]);
    expect(g.bloom.weights).toEqual([0, 0, 0.2, 0.35, 0.5]);
    expect(g.bloom.colors).toHaveLength(5);
    close(g.bloom.colors[4], [0.406536341, 0.568836153, 0.8148467]);
    expect(g.bloom.levels).toEqual(GAUSSIAN_LEVELS);
    expect(g.bloom.lensDirt).toBeNull();
    expect(g.ao).toEqual({ radius: 1.5, bias: 15, attenuation: 0.7, contrast: 0.65, exponent: 2, blur: 8, sharpness: 4 });
    expect(g._source.record).toBe(hoth.sunny.name);
    // every leaf names where it came from
    for (const k of ['tonemap', 'lut.name', 'lut.size', 'bloom.scale', 'bloom.weights', 'bloom.colors', 'bloom.levels', 'ao.radius', 'ao.exponent', 'ao.blur']) expect(g._source[k]).toBeTruthy();
  });

  it('is null without the components, and each part null without its own', () => {
    expect(gradeOf(null)).toBeNull();
    expect(gradeOf({})).toBeNull();
    expect(gradeOf({ OutdoorLightComponentData: [{ SunIntensity: 1 }] })).toBeNull();
    // the interior has a tone map and a LUT, no HBAO
    const inside = gradeOf(hoth.interior.record);
    expect(inside.ao).toBeNull();
    expect(inside.lut.name).toMatch(/T_CC_Hoth_Interior_01/);
    // a LUT switched off, an AO disabled, a tone map not linear
    // (all four off: no grade at all, the site's own picture)
    const off = { ColorCorrectionComponentData: [{ HdrColorGradingLut: 'x', ColorGradingEnable: false }], DynamicAOComponentData: [{ Enable: false, HbaoRadius: 2 }], TonemapComponentData: [{ TonemapMethod: 'TonemapMethod_FilmicNeutral', BloomScale: [0.1, 0.1, 0.1] }] };
    expect(gradeOf(off)).toBeNull();
    const some = gradeOf({ ...off, DynamicAOComponentData: [{ HbaoRadius: 2 }] });
    expect([some.lut, some.tonemap, some.bloom]).toEqual([null, null, null]);
    expect(some.ao.radius).toBe(2);
  });

  it('reads the bucket shape (vectors as { x, y, z }, assets as { $asset }) and dotted keys', () => {
    const g = gradeOf({
      TonemapComponentData: [{ TonemapMethod: 'TonemapMethod_Linear', BloomMethod: 'BloomMethod_GaussianSimple', BloomScale: { x: 0.2, y: 0.2, z: 0.2 }, Gaussian5Weight: 1, 'Gaussian5Color.x': 1, 'Gaussian5Color.y': 0.5, 'Gaussian5Color.z': 0.25 }],
      ColorCorrectionComponentData: [{ HdrColorGradingLut: { $asset: 'Levels/X/T_CC_X' } }],
    });
    expect(g.bloom.scale).toEqual([0.2, 0.2, 0.2]);
    expect(g.bloom.weights).toEqual([0, 0, 0, 0, 1]);
    expect(g.bloom.colors[4]).toEqual([1, 0.5, 0.25]);
    expect(g.lut.name).toBe('Levels/X/T_CC_X');
  });
});

describe('bloomTints', () => {
  it("folds each Gaussian's weight and colour into BloomNode's tint over its own factor", () => {
    const { strength, tints, threshold } = bloomTints(gradeOf(sunny).bloom);
    expect(strength).toBe(0.1);
    expect(threshold).toBe(0);
    expect(tints[0]).toEqual([0, 0, 0]);
    // what BloomNode adds per level, factor × tint × strength, is the record's weight × colour × scale
    for (let i = 0; i < 5; i++) close(tints[i].map((t) => t * BLOOM_FACTORS[i] * strength), gradeOf(sunny).bloom.colors[i].map((c) => c * gradeOf(sunny).bloom.weights[i] * 0.1));
  });
});

describe('the sky textures', () => {
  it("names the panorama, its gradient and the cloud shadow's texture", () => {
    const p = panoramaOf(sunny);
    expect(p.name).toBe('Levels/Lighting/Hoth/Sunny_01/T_Hoth_Sunny_02_C');
    expect(p.gradient).toBe('Levels/Lighting/Hoth/Sunny_01/T_Hoth_Sunny_02_Fog_C');
    expect(p.rotation).toBe(0.963);
    expect(p.uv).toEqual([0, 0.01, 1, 1]);
    expect(panoramaOf(hoth.interior.record)).toBeNull();
    const c = cloudShadowOf(sunny);
    expect(c).toEqual({ name: 'Objects/Nature/Arctic/_ArcticBase/_CommonTextures/T_Arctic_01_CloudShadow_RGBM', rgbm: true, topDown: true, wrap: true, offset: [0, 0] });
    expect(cloudShadowOf({ OutdoorLightComponentData: [{ CloudShadowTexture: null }] })).toBeNull();
  });

  it("maps the panorama as the upper hemisphere's equirect: the record's sun on the painted sun's azimuth (u 0.225 measured)", () => {
    const o = sunny.OutdoorLightComponentData[0];
    const sun = sunDir(o.SunRotationX, o.SunRotationY);
    const [u, v] = panoramaUV(sun, panoramaOf(sunny));
    expect(u).toBeCloseTo(0.225, 2);
    expect(v).toBeCloseTo(0.01 + 0.99 * (1 - o.SunRotationY / 90), 6);
    // the zenith at the top, the horizon at the foot, below it the foot still
    expect(panoramaUV([0, 1, 0], panoramaOf(sunny))[1]).toBeCloseTo(0.01, 6);
    expect(panoramaUV([1, 0, 0], panoramaOf(sunny))[1]).toBeCloseTo(1, 6);
    expect(panoramaUV([1, -0.5, 0], panoramaOf(sunny))[1]).toBeCloseTo(1, 6);
    // 6° up is 6/90 of the way: the sky's low band keeps its rows
    expect(1 - panoramaUV(sunDir(0, 6), panoramaOf(sunny))[1]).toBeCloseTo((0.99 * 6) / 90, 6);
    // the gradient: the whole sphere, the same rotation
    const [gu, gv] = gradientUV(sun, 0.963);
    expect(gu).toBeCloseTo(u, 6);
    expect(gv).toBeCloseTo(0.5 - o.SunRotationY / 180, 6);
    expect(gradientUV([0, 1, 0], 0.963)[1]).toBeCloseTo(0, 6);
    expect(gradientUV([0, -1, 0], 0.963)[1]).toBeCloseTo(1, 6);
  });

  it('decodes RGBM by the suffix', () => {
    expect(rgbmDecode([0.1, 0.2, 0.05, 1])).toEqual([0.1 * RGBM_RANGE, 0.2 * RGBM_RANGE, 0.05 * RGBM_RANGE].map((x) => Math.min(1, x)));
    expect(rgbmDecode([0.5, 0.5, 0.5, 0.1])[0]).toBeCloseTo(0.3, 6);
  });
});

describe('pictureOf', () => {
  const urls = { lut: { url: 'l.png', size: 17 }, panorama: { url: 'p.ktx2', horizon: [0.7, 0.8, 0.9] }, gradient: { url: 'g.ktx2' }, cloudShadow: { url: 'c.ktx2' } };
  it('takes the picture only where the caller hands it and the record names it', () => {
    expect(pictureOf({ record: sunny }, null)).toBeNull();
    expect(pictureOf({ record: {} }, urls)).toBeNull();
    const p = pictureOf({ record: sunny, name: hoth.sunny.name }, urls);
    expect(p.grade.tonemap).toBe('linear');
    expect(p.lut).toEqual({ url: 'l.png', size: 17 });
    expect(p.panorama.url).toBe('p.ktx2');
    expect(p.panorama.rotation).toBe(0.963);
    expect(p.gradient.url).toBe('g.ktx2');
    expect(p.cloudShadow.url).toBe('c.ktx2');
    // (the entry's own field stands in for the option)
    expect(pictureOf({ record: sunny, picture: urls }).lut.url).toBe('l.png');
    // a world that names no texture keeps the record's grade only
    const bare = pictureOf({ record: sunny }, true);
    expect(bare.grade.bloom.weights[4]).toBe(0.5);
    expect(bare.lut).toBeNull();
    expect(bare.panorama).toBeNull();
  });
});
