import { describe, expect, it } from 'vitest';
import { loadThree } from '../light/three.js';
import { SNOW, SNOW_BASE, SNOW_DETAIL, SNOW_MAPS, SNOW_ROLES } from './snowMaps.js';
import { NEAR_BAND, STREAK_WEIGHT, createSnowGround, displaceHeight, layerNormal, mapsFor, nearBand, smoothnessUnder, streakTerm, streakUv, tileUv, windFrame, worldNormal } from './snow.js';

describe('the record (snowMaps.js)', () => {
  it('names the five maps of untouched snow at the listing’s tilings and rates, the _C map sRGB, the rest linear', () => {
    expect(Object.keys(SNOW_MAPS)).toHaveLength(5);
    expect(SNOW_MAPS[SNOW_BASE].cycles).toEqual([0.25, 0.03]);
    expect(SNOW_MAPS[SNOW_DETAIL].cycles).toEqual([1]);
    expect(SNOW_MAPS[SNOW_ROLES.flow]).toMatchObject({ srgb: true, cycles: [[0.08, 0.04]], rates: [0.06] });
    expect(SNOW_MAPS[SNOW_ROLES.streaks]).toMatchObject({
      cycles: [
        [0.2, 0.2],
        [0.02, 0.08],
      ],
      rates: [0.5, 0.2],
    });
    for (const [slug, m] of Object.entries(SNOW_MAPS)) {
      expect(Boolean(m.srgb), slug).toBe(/_c$/.test(slug));
      // (every tier has a row; 2K at most on desktop, the sizes a power of two)
      expect(Object.keys(m.sizes), slug).toEqual(['low', 'mid', 'high', 'ultra']);
      for (const s of Object.values(m.sizes)) expect(s <= 2048 && (s & (s - 1)) === 0, `${slug} ${s}`).toBe(true);
    }
  });
  it('leaves out the two maps the shader reads only inside its dynamic mask', () => {
    expect(SNOW_MAPS.t_arcticbase_snowsmoothnessvirtualtexture_01_rgbm).toBeUndefined();
    expect(SNOW_MAPS.t_blacksootmask_01_c).toBeUndefined();
  });
  it('carries the record’s colour, smoothness and the streaks’ frame', () => {
    expect(SNOW.colour.map((v) => +v.toFixed(3))).toEqual([0.547, 0.594, 0.644]);
    expect(SNOW.smoothness).toBe(0.26);
    expect(SNOW.streakSmoothness).toBe(0.25);
    // (the listing's immediates: cos −0.989992, sin 0.141120)
    expect(Math.cos(SNOW.windRad)).toBeCloseTo(-0.989992, 6);
    expect(Math.sin(SNOW.windRad)).toBeCloseTo(0.14112, 6);
    expect(SNOW.displacement).toEqual({ cycles: 0.2, gain: 0.35, lift: 0.4 });
  });
});

describe('the tiling and layer maths', () => {
  it('tiles world metres into cycles, one rate or two', () => {
    expect(tileUv([8, 4], 0.25)).toEqual([2, 1]);
    expect(tileUv([100, 50], [0.08, 0.04])).toEqual([8, 2]);
  });
  it('turns world xz into the streaks’ frame as the listing does', () => {
    // (r10.x = −0.989992 x − 0.14112 z; r10.y = 0.14112 x − 0.989992 z)
    const [u, v] = windFrame([10, 20]);
    expect(u).toBeCloseTo(-0.989992 * 10 - 0.14112 * 20, 4);
    expect(v).toBeCloseTo(0.14112 * 10 - 0.989992 * 20, 4);
    expect(windFrame([10, 20], 0)).toEqual([10, 20]);
  });
  it('slides a streak read along the turned frame’s own u, at the read’s rate', () => {
    const still = streakUv([10, 20], [0.02, 0.08], 0.2, 0);
    expect(still).toEqual(tileUv(windFrame([10, 20]), [0.02, 0.08]));
    const [u, v] = streakUv([10, 20], [0.02, 0.08], 0.2, 3);
    expect(u - still[0]).toBeCloseTo(0.6, 6);
    expect(v).toBe(still[1]);
  });
  it('combines the two streak reads as the shader does: nothing dark, full where one is bright and the other not', () => {
    expect(streakTerm(0, 0)).toBe(0);
    expect(streakTerm(0.3, 0.3)).toBe(0);
    expect(streakTerm(1, 0)).toBe(1);
    expect(streakTerm(1, 1)).toBe(0);
    expect(streakTerm(0.6, 0.2)).toBeGreaterThan(0);
    expect(streakTerm(0.6, 0.2)).toBeLessThan(1);
  });
  it('sums the octaves’ two channels and rebuilds z from the 4 m read alone', () => {
    expect(layerNormal([])).toEqual([0, 0, 1]);
    const n = layerNormal([
      [0.3, 0.4],
      [-0.1, 0.2],
      [0, 0.1],
    ]);
    expect(n[0]).toBeCloseTo(0.2, 6);
    expect(n[1]).toBeCloseTo(0.7, 6);
    expect(n[2]).toBeCloseTo(Math.sqrt(1 - 0.25), 6);
  });
  it('lays the blowing snow flat over the layer by its weight', () => {
    const bare = layerNormal([[0.3, 0.4]]);
    const half = layerNormal([[0.3, 0.4]], 0.5);
    expect(half[0]).toBeCloseTo(bare[0] / 2, 6);
    expect(half[2]).toBeCloseTo(bare[2] / 2 + 0.5, 6);
    expect(layerNormal([[0.3, 0.4]], 1)).toEqual([0, 0, 1]);
  });
  it('stands the layer’s normal on the ground: red along world x, green toward −z, unit', () => {
    expect(worldNormal([0, 0, 1])).toEqual([0, 1, 0]);
    const red = worldNormal([0.5, 0, 1]);
    expect(red[0]).toBeGreaterThan(0);
    expect(red[2]).toBeCloseTo(0, 6);
    const green = worldNormal([0, 0.5, 1]);
    expect(green[2]).toBeLessThan(0);
    expect(green[0]).toBeCloseTo(0, 6);
    // (on a slope the frame leans with the ground's normal)
    const m = [0.6, 0.8, 0];
    const leant = worldNormal([0.2, -0.3, 0.9], m);
    expect(Math.hypot(...leant)).toBeCloseTo(1, 6);
    worldNormal([0, 0, 1], m).forEach((c, i) => expect(c).toBeCloseTo(m[i], 6));
  });
  it('the near band is whole inside, gone past it', () => {
    expect(nearBand(0)).toBe(1);
    expect(nearBand(NEAR_BAND[0])).toBe(1);
    expect(nearBand((NEAR_BAND[0] + NEAR_BAND[1]) / 2)).toBeCloseTo(0.5, 6);
    expect(nearBand(NEAR_BAND[1] + 1)).toBe(0);
  });
  it('the smoothness is the record’s 0.26, the blowing snow’s 0.25 under its weight', () => {
    expect(smoothnessUnder()).toBe(0.26);
    expect(smoothnessUnder(1)).toBe(0.25);
    expect(smoothnessUnder(STREAK_WEIGHT)).toBeCloseTo(0.26 - 0.01 * STREAK_WEIGHT, 6);
  });
  it('the displacement is about a mid grey: it moves nothing, the ends a few centimetres', () => {
    expect(displaceHeight(0.5)).toBeCloseTo(0, 6);
    expect(displaceHeight(1)).toBeCloseTo(0.35 * 0.175, 6);
    expect(displaceHeight(0)).toBeCloseTo(-0.35 * 0.175, 6);
  });
  it('each tier reads its maps: low none, mid the two normal maps, high and ultra all five; the far grid the 4 m map alone', () => {
    expect(mapsFor('low')).toEqual([]);
    expect(mapsFor('mid')).toEqual([SNOW_BASE, SNOW_DETAIL]);
    expect([...mapsFor('high')].sort()).toEqual(Object.keys(SNOW_MAPS).sort());
    expect(mapsFor('ultra')).toEqual(mapsFor('high'));
    expect(mapsFor('ultra', { far: true })).toEqual([SNOW_BASE]);
    expect(mapsFor('low', { far: true })).toEqual([]);
  });
});

describe('the material', () => {
  const stubs = (THREE) => Object.fromEntries(Object.keys(SNOW_MAPS).map((s) => [s, new THREE.Texture()]));
  it('reads every map on ultra: three normal octaves, the flow, the two wisps and the sparkle', async () => {
    const three = await loadThree();
    const g = createSnowGround({ maps: stubs(three.THREE), tier: 'ultra', three, displace: true });
    expect(g.samples).toEqual({ normal: 3, data: 4 });
    expect(g.flat).toBe(false);
    expect(g.material.colorNode).toBeTruthy();
    expect(g.material.normalNode).toBeTruthy();
    expect(g.material.positionNode).toBeTruthy();
    expect(g.material.name).toBe('snow-ground:near:ultra');
    g.dispose();
  });
  it('mid reads the three octaves alone', async () => {
    const three = await loadThree();
    const g = createSnowGround({ maps: stubs(three.THREE), tier: 'mid', three });
    expect(g.samples).toEqual({ normal: 3, data: 0 });
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
    expect(g.flat).toBe(true);
    expect(g.material.normalNode).toBeFalsy();
    const bare = createSnowGround({ maps: {}, tier: 'ultra', three });
    expect(bare.samples).toEqual({ normal: 0, data: 0 });
    expect(bare.flat).toBe(true);
  });
  it('without the 4 m map nothing is read, whatever else landed (the sparkle alone is in the bucket today)', async () => {
    const three = await loadThree();
    const only = { [SNOW_ROLES.sparkle]: new three.THREE.Texture() };
    for (const far of [false, true]) {
      const g = createSnowGround({ maps: only, tier: 'ultra', three, far, displace: true });
      expect(g.samples).toEqual({ normal: 0, data: 0 });
      expect(g.flat).toBe(true);
      expect(g.material.normalNode).toBeFalsy();
      expect(g.material.positionNode).toBeFalsy();
    }
  });
  it('a map that did not land leaves its term out, the rest drawn', async () => {
    const three = await loadThree();
    const maps = stubs(three.THREE);
    delete maps[SNOW_ROLES.flow];
    delete maps[SNOW_DETAIL];
    const g = createSnowGround({ maps, tier: 'high', three });
    // (no flow, no wisps: the two large octaves and the sparkle)
    expect(g.samples).toEqual({ normal: 2, data: 1 });
    expect(g.flat).toBe(false);
  });
});
