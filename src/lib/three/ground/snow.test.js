import { describe, expect, it } from 'vitest';
import { loadThree } from '../light/three.js';
import { SNOW, SNOW_BASE, SNOW_DETAIL, SNOW_MAPS, SNOW_ROLES } from './snowMaps.js';
import { NEAR_BAND, createSnowGround, displaceHeight, mapsFor, nearBand, scrollUv, smoothnessOf, streakTerm, sumNormal, tileUv, windDir } from './snow.js';

describe('the record (snowMaps.js)', () => {
  it('names the seven maps at the shader’s tilings, the _C maps sRGB, the rest linear', () => {
    expect(Object.keys(SNOW_MAPS)).toHaveLength(7);
    expect(SNOW_MAPS[SNOW_BASE].cycles).toEqual([0.25, 0.03]);
    expect(SNOW_MAPS[SNOW_DETAIL].cycles).toEqual([1]);
    expect(SNOW_MAPS[SNOW_ROLES.brightness].cycles).toEqual([0.45]);
    expect(SNOW_MAPS[SNOW_ROLES.soot]).toMatchObject({ srgb: true, cycles: [0.2] });
    expect(SNOW_MAPS[SNOW_ROLES.flow]).toMatchObject({ srgb: true, cycles: [0.2] });
    expect(SNOW_MAPS[SNOW_ROLES.streaks].cycles).toEqual([
      [0.08, 0.04],
      [0.02, 0.08],
    ]);
    for (const [slug, m] of Object.entries(SNOW_MAPS)) {
      expect(Boolean(m.srgb), slug).toBe(/_c$/.test(slug));
      // (2K at most on desktop, the sizes a power of two, never over the source's)
      for (const s of Object.values(m.sizes)) expect(s <= 2048 && (s & (s - 1)) === 0, `${slug} ${s}`).toBe(true);
    }
  });
  it('carries the record’s colour and smoothness', () => {
    expect(SNOW.colour.map((v) => +v.toFixed(3))).toEqual([0.547, 0.594, 0.644]);
    expect(SNOW.smoothness).toBe(0.26);
    expect(windDir(SNOW.windDeg).map((v) => +v.toFixed(3))).toEqual([-0.99, 0.139]);
  });
});

describe('the tiling and layer maths', () => {
  it('tiles world metres into cycles, one rate or two', () => {
    expect(tileUv([8, 4], 0.25)).toEqual([2, 1]);
    expect(tileUv([100, 50], [0.08, 0.04])).toEqual([8, 2]);
  });
  it('scrolls the streaks against the wind, at the read’s own rate', () => {
    const still = scrollUv([10, 10], [0.08, 0.04], 172, 0);
    expect(still).toEqual(tileUv([10, 10], [0.08, 0.04]));
    const [u, v] = scrollUv([10, 10], [0.08, 0.04], 172, 1, 2.5);
    // (the wind blows along −x: the read slides +u)
    expect(u).toBeGreaterThan(still[0]);
    expect(v).toBeLessThan(still[1]);
    expect(u - still[0]).toBeCloseTo(0.99 * 2.5 * 0.08, 3);
  });
  it('combines the two streak reads as the shader does: nothing dark, full where one is bright and the other not', () => {
    expect(streakTerm(0, 0)).toBe(0);
    expect(streakTerm(0.3, 0.3)).toBe(0);
    expect(streakTerm(1, 0)).toBe(1);
    expect(streakTerm(1, 1)).toBe(0);
    expect(streakTerm(0.6, 0.2)).toBeGreaterThan(0);
    expect(streakTerm(0.6, 0.2)).toBeLessThan(1);
  });
  it('sums the octaves under an up normal and keeps it unit', () => {
    expect(sumNormal([])).toEqual([0, 1, 0]);
    const n = sumNormal([
      [0.3, 0],
      [-0.1, 0.2],
      [0, 0.1],
    ]);
    expect(Math.hypot(...n)).toBeCloseTo(1, 6);
    expect(n[0]).toBeGreaterThan(0);
    expect(n[2]).toBeGreaterThan(0);
  });
  it('the near band is whole inside, gone past it', () => {
    expect(nearBand(0)).toBe(1);
    expect(nearBand(NEAR_BAND[0])).toBe(1);
    expect(nearBand((NEAR_BAND[0] + NEAR_BAND[1]) / 2)).toBeCloseTo(0.5, 6);
    expect(nearBand(NEAR_BAND[1] + 1)).toBe(0);
  });
  it('the smoothness sits at the record’s 0.26 on the map’s middle grey and stays matte', () => {
    expect(smoothnessOf(0.45)).toBeCloseTo(0.26, 6);
    expect(smoothnessOf(0)).toBeGreaterThanOrEqual(0.1);
    expect(smoothnessOf(1)).toBeLessThanOrEqual(0.5);
  });
  it('the displacement is centred: the map’s middle moves nothing, its ends a few centimetres', () => {
    expect(displaceHeight(0.5)).toBeCloseTo(0, 6);
    expect(displaceHeight(1)).toBeCloseTo(0.35 * 0.175, 6);
    expect(displaceHeight(0)).toBeCloseTo(-0.35 * 0.175, 6);
  });
  it('each tier reads its maps: low none, mid the two octaves, high and ultra all; the far grid the base alone', () => {
    expect(mapsFor('low')).toEqual([]);
    expect(mapsFor('mid')).toEqual([SNOW_BASE, SNOW_DETAIL]);
    expect(mapsFor('high')).toEqual(Object.keys(SNOW_MAPS));
    expect(mapsFor('ultra')).toEqual(Object.keys(SNOW_MAPS));
    expect(mapsFor('ultra', { far: true })).toEqual([SNOW_BASE]);
    expect(mapsFor('low', { far: true })).toEqual([]);
  });
});

describe('the material', () => {
  const stubs = (THREE) => Object.fromEntries(Object.keys(SNOW_MAPS).map((s) => [s, new THREE.Texture()]));
  it('reads every map on ultra: three normal octaves, five data reads for the brightness, soot, streaks and sparkle', async () => {
    const three = await loadThree();
    const g = createSnowGround({ maps: stubs(three.THREE), tier: 'ultra', three, displace: true });
    expect(g.samples).toEqual({ normal: 3, data: 6 });
    expect(g.material.colorNode).toBeTruthy();
    expect(g.material.normalNode).toBeTruthy();
    expect(g.material.positionNode).toBeTruthy();
    expect(g.material.name).toBe('snow-ground:near:ultra');
    g.dispose();
  });
  it('the far grid takes the two large octaves and no displacement', async () => {
    const three = await loadThree();
    const g = createSnowGround({ maps: stubs(three.THREE), tier: 'ultra', three, far: true, displace: true });
    expect(g.samples).toEqual({ normal: 2, data: 0 });
    expect(g.material.positionNode).toBeFalsy();
    g.dispose();
  });
  it('low, or no maps, is the record’s colour alone', async () => {
    const three = await loadThree();
    const g = createSnowGround({ maps: stubs(three.THREE), tier: 'low', three });
    expect(g.samples).toEqual({ normal: 0, data: 0 });
    expect(g.material.normalNode).toBeFalsy();
    const bare = createSnowGround({ maps: {}, tier: 'ultra', three });
    expect(bare.samples).toEqual({ normal: 0, data: 0 });
  });
  it('a map that did not land leaves its term out, the rest drawn', async () => {
    const three = await loadThree();
    const maps = stubs(three.THREE);
    delete maps[SNOW_ROLES.flow];
    delete maps[SNOW_ROLES.sparkle];
    const g = createSnowGround({ maps, tier: 'high', three });
    expect(g.samples).toEqual({ normal: 3, data: 2 });
  });
});
