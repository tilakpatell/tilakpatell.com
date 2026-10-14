import { describe, expect, it } from 'vitest';
import { loadThree } from '../light/three.js';
import { LAYERS, READS, SNOW, SNOW_FILES, SNOW_KIND, mapAt } from './snowMaps.js';
import { NEAR_BAND, createSnowGround, displaceHeight, dynamicS, layerMasks, layerWeights, mapsFor, nearBand, streakTerm, streakUv, texelOf, tileUv, windFrame, worldNormal } from './snow.js';

describe('the record (snowMaps.js)', () => {
  it('packs the listing’s maps into four arrays and the flow map, the _C maps sRGB, the rest linear', () => {
    expect(Object.keys(SNOW_FILES)).toHaveLength(5);
    expect(SNOW_FILES[SNOW_KIND.normals].layers).toHaveLength(9);
    for (const [slug, f] of Object.entries(SNOW_FILES)) {
      for (const m of f.layers ?? [slug]) expect(Boolean(f.srgb), m).toBe(/_c$/.test(m));
      expect(Object.keys(f.sizes), slug).toEqual(['low', 'mid', 'high', 'ultra']);
      for (const s of Object.values(f.sizes)) expect(s <= 2048 && (s & (s - 1)) === 0, `${slug} ${s}`).toBe(true);
    }
  });
  it('finds every read’s map in a file, but the soot’s (read only under a dynamic mask)', () => {
    for (const [key, r] of Object.entries(READS)) {
      if (key === 'soot') expect(mapAt(r.map)).toBeNull();
      else expect(mapAt(r.map), key).toBeTruthy();
    }
    expect(mapAt('t_arcticbase_snowrough_03_n')).toEqual({ slug: SNOW_KIND.normals, kind: 'normals', layer: 1 });
    expect(mapAt('t_blowingsnowflowmap_01_c')).toEqual({ slug: SNOW_KIND.flow, kind: 'flow', layer: 0 });
  });
  it('carries the listing’s tilings', () => {
    expect([READS.snow4.cycles, READS.snow33.cycles, READS.detail.cycles]).toEqual([0.25, 0.03, 1]);
    expect([READS.packed, READS.chunky, READS.roughPacked, READS.rockyPacked, READS.rocky].map((r) => r.cycles)).toEqual([0.2, 0.2, 0.2, 0.2, 0.2]);
    expect([READS.trampled.cycles, READS.trampledDetail.cycles, READS.roughPackedDetail.cycles, READS.wavey.cycles]).toEqual([0.5, 0.5, 0.08, 0.03]);
    expect(READS.streakA).toMatchObject({ cycles: [0.2, 0.2], rate: 0.5 });
    expect(READS.streakB).toMatchObject({ cycles: [0.02, 0.08], rate: 0.2 });
    expect(READS.flow).toMatchObject({ cycles: [0.08, 0.04], rate: 0.06 });
  });
  it('carries the record’s colour, smoothness and the streaks’ frame', () => {
    expect(SNOW.colour.map((v) => +v.toFixed(3))).toEqual([0.547, 0.594, 0.644]);
    expect(SNOW.smoothness).toBe(0.26);
    expect(SNOW.streakSmoothness).toBe(0.25);
    expect(Math.cos(SNOW.windRad)).toBeCloseTo(-0.989992, 6);
    expect(Math.sin(SNOW.windRad)).toBeCloseTo(0.14112, 6);
    expect(LAYERS.brown.map((v) => +v.toFixed(3))).toEqual([1, 0.628, 0.205]);
  });
});

describe('the tiling and the streaks', () => {
  it('tiles world metres into cycles, one rate or two', () => {
    expect(tileUv([8, 4], 0.25)).toEqual([2, 1]);
    expect(tileUv([100, 50], [0.08, 0.04])).toEqual([8, 2]);
  });
  it('turns world xz into the streaks’ frame as the listing does', () => {
    const [u, v] = windFrame([10, 20]);
    expect(u).toBeCloseTo(-0.989992 * 10 - 0.14112 * 20, 4);
    expect(v).toBeCloseTo(0.14112 * 10 - 0.989992 * 20, 4);
  });
  it('slides a streak read along the turned frame’s own u, at the read’s rate', () => {
    const still = streakUv([10, 20], [0.02, 0.08], 0.2, 0);
    const [u, v] = streakUv([10, 20], [0.02, 0.08], 0.2, 3);
    expect(u - still[0]).toBeCloseTo(0.6, 6);
    expect(v).toBe(still[1]);
  });
  it('combines the two streak reads as the shader does', () => {
    expect(streakTerm(0, 0)).toBe(0);
    expect(streakTerm(1, 0)).toBe(1);
    expect(streakTerm(1, 1)).toBe(0);
  });
});

describe('the layers (the listing’s blocks)', () => {
  const none = [0, 0, 0, 0, 0, 0, 0, 0];
  it('untouched ground is layer 0 alone', () => {
    expect(layerWeights(layerMasks(none))).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });
  it('a full upper layer takes everything below it; the weights sum to 1 + the base surface', () => {
    const w = layerWeights(layerMasks([1, 1, 0, 0, 0, 0, 0, 0], { packedB: 0.3 }));
    expect(w).toEqual([0, 0, 1, 0, 0, 0, 0, 0]);
    const half = layerWeights(layerMasks([0.5, 0, 0.5, 0, 0, 0, 0, 0.5], { packedB: 1 }));
    expect(half.reduce((a, b) => a + b)).toBeCloseTo(1.5, 9);
    // (3 over 1: 3 takes half of 1.5, 1 half of the rest, 0 what is left)
    expect(half[3]).toBeCloseTo(0.75, 9);
    expect(half[1]).toBeCloseTo(0.375, 9);
    expect(half[0]).toBeCloseTo(0.375, 9);
  });
  it('the packed layer’s edge is broken by its map’s blue', () => {
    expect(layerMasks([0.5, 0, 0, 0, 0, 0, 0, 0], { packedB: 0 })[0]).toBeCloseTo(0.25, 9);
    expect(layerMasks([0.5, 0, 0, 0, 0, 0, 0, 0], { packedB: 1 })[0]).toBeCloseTo(0.5, 9);
    expect(layerMasks([1, 0, 0, 0, 0, 0, 0, 0], { packedB: 0 })[0]).toBe(1);
  });
  it('the trampled layer: nothing under 0.2, full by 0.7 where the rough map’s alpha is a half', () => {
    expect(layerMasks([0, 0, 0, 0.1, 0, 0, 0, 0], { roughA: 0.5 })[3]).toBe(0);
    expect(layerMasks([0, 0, 0, 0.7, 0, 0, 0, 0], { roughA: 0.5 })[3]).toBeCloseTo(1, 9);
  });
  it('the rocks come through by their maps’ heights', () => {
    const at = (m, h) => layerMasks([0, 0, 0, 0, m, m, 0, 0], { rockyPackedB: h, rockyB: h });
    // (a half mask: a quarter of the packed rock and half the rock on bare height, all of both on full)
    expect(at(0.5, 0)[4]).toBeCloseTo(0.25, 9);
    expect(at(0.5, 0)[5]).toBeCloseTo(0.5, 9);
    expect(at(0.5, 1).slice(4, 6)).toEqual([1, 1]);
    expect(at(0.2, 0).slice(4, 6)).toEqual([0, 0]);
    expect(at(1, 0)).toEqual([0, 0, 0, 0, 1, 1, 0, 0]);
  });
  it('the blowing snow is its mask times the streaks', () => {
    expect(layerMasks([0, 0, 0, 0, 0, 0, 1, 0], { streak: 0.4 })[6]).toBeCloseTo(0.4, 9);
    expect(layerMasks([0, 0, 0, 0, 0, 0, 1, 0])[6]).toBe(0);
  });
  it('a texel’s colour and smoothness: the base colour, the rough packed grey, the rocks', () => {
    expect(texelOf([1, 0, 0, 0, 0, 0, 0, 0])).toEqual({ colour: SNOW.colour, smoothness: 0.26 });
    const rock = texelOf([0, 0, 0, 0, 0, 0, 1, 0], { rocky: [0.5, 0.4, 0.3], rockyA: 1 });
    rock.colour.forEach((c, i) => expect(c).toBeCloseTo([0.45, 0.36, 0.27][i], 9));
    expect(rock.smoothness).toBeCloseTo(0.5, 9);
    expect(texelOf([0, 0, 0, 1, 0, 0, 0, 0], { roughPackedA: 0.8 }).colour).toEqual([0.8, 0.8, 0.8]);
    expect(texelOf([0, 0, 0, 0, 0, 0, 0, 1]).smoothness).toBe(0.25);
    // (lifted past one by the base surface: the atlas holds no more)
    expect(texelOf([2, 0, 0, 0, 0, 0, 0, 0], { base: [0.7, 0.7, 0.7] }).colour).toEqual([1, 1, 1]);
  });
  it('the dynamic mask’s S: untouched 1, inside a track 0', () => {
    expect(dynamicS(0, { g: 0.3, b: 0.2 })).toBe(1);
    expect(dynamicS(1, { g: 0.3, b: 0.2 })).toBe(0);
    const mid = dynamicS(0.5, { g: 0, b: 0 });
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
  it('stands the layer’s normal on the ground: red along world x, green toward −z, unit', () => {
    expect(worldNormal([0, 0, 1])).toEqual([0, 1, 0]);
    expect(worldNormal([0, 0.5, 1])[2]).toBeLessThan(0);
    expect(Math.hypot(...worldNormal([0.2, -0.3, 0.9], [0.6, 0.8, 0]))).toBeCloseTo(1, 6);
  });
  it('the near band is whole inside, gone past it', () => {
    expect(nearBand(0)).toBe(1);
    expect(nearBand(NEAR_BAND[1] + 1)).toBe(0);
  });
  it('the displacement is about a mid grey', () => {
    expect(displaceHeight(0.5)).toBeCloseTo(0, 6);
    expect(displaceHeight(1)).toBeCloseTo(0.35 * 0.175, 6);
  });
  it('each tier reads its files: low none, mid the layers without the wisps, high and ultra all five; the far grid no small maps', () => {
    expect(mapsFor('low')).toEqual([]);
    expect(mapsFor('mid')).toEqual([SNOW_KIND.normals, SNOW_KIND.colours, SNOW_KIND.small]);
    expect([...mapsFor('high')].sort()).toEqual(Object.keys(SNOW_FILES).sort());
    expect(mapsFor('ultra')).toEqual(mapsFor('high'));
    expect(mapsFor('ultra', { far: true })).not.toContain(SNOW_KIND.small);
  });
});

describe('the material', () => {
  const stubs = (THREE) => Object.fromEntries(Object.values(SNOW_FILES).map((f) => [f.kind, new THREE.Texture()]));
  const masks = (THREE) => ['near', 'mid', 'far'].map((n, i) => ({ name: n, texture: new THREE.Texture(), corner: [-100 * (i + 1), -100 * (i + 1)], extent: [200 * (i + 1), 200 * (i + 1)] }));
  it('reads every layer’s maps on ultra, the masks of every frame, and displaces', async () => {
    const three = await loadThree();
    const g = createSnowGround({ maps: stubs(three.THREE), masks: masks(three.THREE), tier: 'ultra', three, displace: true });
    expect(g.flat).toBe(false);
    // (normals: 4 m, 33 m, packed, wavey, chunky, rough packed, its 0.08 read, the rough 0.5 read, trampled, the two rocks, and the displacement's)
    expect(g.samples).toEqual({ normal: 12, data: 7, mask: 6 });
    expect(g.material.colorNode).toBeTruthy();
    expect(g.material.normalNode).toBeTruthy();
    expect(g.material.positionNode).toBeTruthy();
    expect(g.material.name).toBe('snow-ground:near:ultra');
    g.dispose();
  });
  it('mid reads the layers without the blowing snow', async () => {
    const three = await loadThree();
    const g = createSnowGround({ maps: stubs(three.THREE), masks: masks(three.THREE), tier: 'mid', three });
    expect(g.samples).toEqual({ normal: 11, data: 3, mask: 6 });
    g.dispose();
  });
  it('the far grid: no 1 m detail, no sparkle, no displacement', async () => {
    const three = await loadThree();
    const g = createSnowGround({ maps: stubs(three.THREE), masks: masks(three.THREE), tier: 'ultra', three, far: true, displace: true });
    expect(g.samples).toEqual({ normal: 11, data: 5, mask: 6 });
    expect(g.material.positionNode).toBeFalsy();
    g.dispose();
  });
  it('a dynamic mask reads the rough map’s grey and the soot', async () => {
    const three = await loadThree();
    const maps = { ...stubs(three.THREE), soot: new three.THREE.Texture() };
    const g = createSnowGround({ maps, masks: [], tier: 'high', three, dynamic: { texture: new three.THREE.Texture(), corner: [0, 0], extent: [10, 10] } });
    expect(g.samples.mask).toBe(0);
    expect(g.samples.data).toBe(7 + 2);
    g.dispose();
  });
  it('low, or no normals, is the record’s colour alone', async () => {
    const three = await loadThree();
    const g = createSnowGround({ maps: stubs(three.THREE), tier: 'low', three });
    expect(g.flat).toBe(true);
    expect(g.material.normalNode).toBeFalsy();
    const maps = stubs(three.THREE);
    delete maps.normals;
    const bare = createSnowGround({ maps, masks: masks(three.THREE), tier: 'ultra', three, displace: true });
    expect(bare.samples).toEqual({ normal: 0, data: 0, mask: 0 });
    expect(bare.flat).toBe(true);
    expect(bare.material.positionNode).toBeFalsy();
  });
  it('a file that did not land leaves its terms out, the rest drawn', async () => {
    const three = await loadThree();
    const maps = stubs(three.THREE);
    delete maps.flow;
    delete maps.colours;
    const g = createSnowGround({ maps, masks: [], tier: 'high', three });
    // (no flow: no streaks; no colours: the rocks in the base colour; the detail and the sparkle stay)
    expect(g.samples).toEqual({ normal: 11, data: 2, mask: 0 });
    expect(g.flat).toBe(false);
  });
});
