import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groundJson, kindOf, layersOf, packMasks, readTextureIndex, RULES, slugOf, TILE_M, tileOf } from './bf2017-ground.mjs';

const scatter = JSON.parse(readFileSync(new URL('./fixtures/hoth_01_terrain.surface.json', import.meta.url), 'utf8'));
const index = readTextureIndex(readFileSync(new URL('./fixtures/hoth_ground.textures.jsonl', import.meta.url), 'utf8'));

describe('layersOf', () => {
  const combos = layersOf(scatter, index);
  it('one entry per layer combination, its normal stack, its sparkle', () => {
    const c = combos.find((x) => x.id === '103m_103f__displacement2d__d__0');
    expect(c.normals).toEqual(['T_ArcticBase_SnowRockyPacked_04_N', 'T_ArcticBase_SnowRocky_02_N', 'T_ArcticBase_SnowPacked_04_N', 'T_ArcticBase_SnowChunkyWind_01_N']);
    // (a combination that names no sparkle of its own takes the terrain's default shader's)
    expect(c.sparkle).toBe('T_ArcticBase_SnowSparkle_03_RGBM');
    expect(c.tile).toBe(TILE_M.hoth.m);
  });
  it('the default shader is not a combination, and every displacement combination holds four or five normals or fewer', () => {
    expect(combos.some((x) => x.id === 'defaultterrainsurfaceshader')).toBe(false);
    for (const c of combos.filter((x) => /displacement/.test(x.id))) expect(c.normals.length).toBeLessThanOrEqual(5);
    expect(combos.find((x) => x.id === '110m_110f__displacement2d__d__0')).toBeUndefined();
  });
  it('keeps colour and mask maps out of the normal stack', () => {
    const c = combos.find((x) => x.id === '111m_111v__2d__d__0');
    expect(c.normals.every((n) => /_N$/.test(n))).toBe(true);
    expect(c.normals).toHaveLength(9);
  });
});

describe('tileOf', () => {
  it('a 2,048 px map tiles over the world’s TILE_M, a smaller map over less', () => {
    expect(tileOf(2048, 4)).toBe(4);
    expect(tileOf(1024, 4)).toBe(2);
    expect(tileOf(undefined, 4)).toBe(4);
  });
});

describe('kindOf', () => {
  it('names a layer by its texture', () => {
    expect(kindOf('T_ArcticBase_SnowPacked_04_N')).toBe('packed');
    expect(kindOf('T_ArcticBase_SnowRockyPacked_04_N')).toBe('rocky');
    expect(kindOf('T_ArcticBase_SnowRoughPacked_03_N')).toBe('rough');
    expect(kindOf('T_ArcticBase_SnowChunkyWind_01_N')).toBe('chunky');
  });
});

describe('groundJson', () => {
  const g = groundJson({
    world: 'hoth',
    scatter,
    index,
    masks: {
      png: 'ground/masks.png',
      w: 2561,
      h: 2561,
      minX: -1280,
      minZ: -1280,
      metresPerPixel: 1,
    },
    have: {
      t_arcticbase_snowpacked_04_n: 'tex/t_arcticbase_snowpacked_04_n.ktx2',
    },
  });
  it('four layers in Hoth’s rule order, the first three a channel of the mask, the last what they leave', () => {
    expect(g.layers.map((l) => l.id)).toEqual(['rocky', 'chunky', 'rough', 'packed']);
    expect(g.layers.map((l) => l.channel)).toEqual([0, 1, 2, null]);
    expect(g.layers[3].name).toBe('T_ArcticBase_SnowPacked_04_N');
    expect(g.layers[3].size).toBe(2048);
    expect(g.layers[3].format).toBe('BC7_UNORM');
  });
  it('says the mask is derived, and the rules it was derived by (Review Focus 1)', () => {
    expect(g.mask).toBe('derived');
    expect(g.rules).toEqual(RULES.hoth.rules);
    expect(g.rules.find((r) => r.layer === 'rocky').slope).toEqual([30, null]);
    expect(g.rules.find((r) => r.layer === 'chunky')).toMatchObject({
      slope: [null, 15],
      height: [null, -2],
    });
    expect(g.rules.find((r) => r.layer === 'rough').density).toBe('high');
  });
  it('a layer whose map the bucket lacks is said, not dropped', () => {
    expect(g.layers[3].map).toBe('tex/t_arcticbase_snowpacked_04_n.ktx2');
    expect(g.layers[0].map).toBe(null);
    expect(g.missing).toContain('T_ArcticBase_SnowRockyPacked_04_N');
    expect(g.missing).not.toContain('T_ArcticBase_SnowPacked_04_N');
  });
  it('every number carries its source', () => {
    expect(g.tile._source).toMatch(/TILE_M/);
    expect(g.macro._source).toMatch(/TerrainColor/);
    expect(g.sparkle.name).toBe('T_ArcticBase_SnowSparkle_03_RGBM');
    expect(g.sparkle._source).toBeTruthy();
    for (const l of g.layers) expect(l.roughness._source).toMatch(/ROUGHNESS/);
    expect(g.fade._source).toBeTruthy();
  });
  it('a world with no rules is refused', () => {
    expect(() => groundJson({ world: 'nowhere', scatter, index, masks: {} })).toThrow(/rules/);
  });
});

describe('packMasks', () => {
  it('the first three layers in RGB, the last the remainder: no alpha, which a browser may premultiply away', () => {
    const a = new Float32Array([1, 0.25, 0]);
    const b = new Float32Array([0, 0.25, 0]);
    const c = new Float32Array([0, 0.25, 0]);
    const rgb = packMasks([a, b, c], 3);
    expect(rgb).toHaveLength(9);
    expect([...rgb.slice(0, 3)]).toEqual([255, 0, 0]);
    expect([...rgb.slice(3, 6)]).toEqual([64, 64, 64]);
    // (all three at none: the last layer, packed snow, is the whole pixel)
    expect([...rgb.slice(6, 9)]).toEqual([0, 0, 0]);
  });
  it('a fourth mask passed is not written: it is the remainder', () => {
    const one = new Float32Array([0.5]);
    expect([...packMasks([one, one, one, one], 1)]).toEqual([128, 128, 128]);
  });
});

describe('slugOf', () => {
  it('the bucket’s file name of a texture', () => {
    expect(slugOf('Objects/Nature/Arctic/_ArcticBase/_TerrainTextures/T_ArcticBase_SnowPacked_04_N')).toBe('t_arcticbase_snowpacked_04_n');
  });
});

describe('blendModeOf (Review Focus 2)', () => {
  it('a varying blue is a height, a constant one the mask alone', async () => {
    const { blendModeOf } = await import('./bf2017-ground.mjs');
    expect(blendModeOf(Float32Array.from({ length: 256 }, (_, i) => (i % 16) / 15))).toBe('height');
    expect(blendModeOf(new Float32Array(256).fill(0.5))).toBe('mask');
  });
});

describe('groundJson with the maps’ channel statistics (Review Focus 2)', () => {
  const masks = { png: 'ground/masks.png', w: 2, h: 2, minX: 0, minZ: 0, metresPerPixel: 1 };
  const have = { t_arcticbase_snowpacked_04_n: 'tex/t_arcticbase_snowpacked_04_n.ktx2', t_arcticbase_snowchunkywind_01_n: 'tex/t_arcticbase_snowchunkywind_01_n.ktx2' };
  // (Hoth's, read from the 512 px maps: blue a height in both; alpha a
  // smoothness in the packed snow, a constant 255 in the chunky)
  const stats = {
    t_arcticbase_snowpacked_04_n: { b: { mean: 0.219, sd: 0.026 }, a: { mean: 0.447, sd: 0.04 } },
    t_arcticbase_snowchunkywind_01_n: { b: { mean: 0.368, sd: 0.096 }, a: { mean: 1, sd: 0 } },
  };
  const g = groundJson({ world: 'hoth', scatter, index, masks, have, stats });
  it('blends by height where any layer’s blue varies, and says which layers carry one', () => {
    expect(g.blend.mode).toBe('height');
    expect(g.layers.find((l) => l.id === 'packed').height).toBe(true);
    expect(g.layers.find((l) => l.id === 'rocky').height).toBe(false);
  });
  it('a varying alpha is the layer’s smoothness, its mean said; a constant one is not', () => {
    expect(g.layers.find((l) => l.id === 'packed').smoothness).toBeCloseTo(0.447);
    expect(g.layers.find((l) => l.id === 'chunky').smoothness).toBe(null);
  });
  it('without statistics: the mask alone', () => {
    expect(groundJson({ world: 'hoth', scatter, index, masks, have }).blend.mode).toBe('mask');
  });
});
