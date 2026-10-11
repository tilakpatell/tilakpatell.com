import { describe, expect, it } from 'vitest';
import { LOD, lodAt } from '../../level/lod.js';
import { MAX_LODS, lodFrom, lodIndex, stepsTable } from './lodRule.js';

// a seeded generator, so a failure names the same instance every run
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('lodIndex', () => {
  it('agrees with lib/level/lod.js’s lodAt on 10,000 random instances', () => {
    const r = rng(7);
    const tiers = Object.keys(LOD);
    let differ = 0;
    for (let i = 0; i < 10000; i++) {
      const n = 1 + Math.floor(r() * MAX_LODS);
      let t = 2000 + r() * 60000;
      const chain = Array.from({ length: n }, () => Math.round((t /= 1.5 + r() * 2)));
      const tier = tiers[Math.floor(r() * tiers.length)];
      // (distances out to 5 km, radii from a speck to a hangar, and the edges: 0 and exact steps)
      const d = i % 50 === 0 ? 0 : r() ** 2 * 5000;
      const rad = i % 37 === 0 ? 0 : 0.05 + r() ** 3 * 400;
      if (lodIndex(d, rad, chain, tier) !== lodAt(chain, d, rad, tier)) differ++;
    }
    expect(differ).toBe(0);
  });

  it('reads the same steps the GPU reads: four, padded with the last', () => {
    expect(stepsTable([13060, 6980, 2322, 894, 218], 'high')).toEqual([1, 3, 4, 4]);
    expect(stepsTable([13060, 6980, 2322, 894, 218], 'ultra')).toEqual([0, 2, 4, 4]);
    expect(stepsTable([500], 'low')).toEqual([0, 0, 0, 0]);
    expect(lodFrom(100, 1, LOD.high.L0, [1, 3, 4, 4])).toBe(4);
    expect(lodFrom(1, 1, LOD.high.L0, [1, 3, 4, 4])).toBe(1);
  });

  it('refuses a chain longer than the GPU table holds', () => {
    expect(() => stepsTable(Array.from({ length: MAX_LODS + 1 }, (_, i) => 1000 >> i), 'high')).toThrow(/LODs/);
  });
});
