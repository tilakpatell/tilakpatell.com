import { describe, expect, it } from 'vitest';
import { biomeWeights, climateOf, weightsAt } from './biomes';
import { planetSpecOf } from './planetSpec';

describe('biomeWeights', () => {
  const hoth = planetSpecOf('hoth');

  it('sums to 1 at 100 points, one weight a biome', () => {
    for (let i = 0; i < 100; i++) {
      const w = biomeWeights(hoth, Math.sin(i * 12.9898) * 40000, Math.cos(i * 78.233) * 40000);
      expect(w).toHaveLength(hoth.biomes.length);
      expect(Math.abs(w.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-6);
      for (const v of w) expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('falls back to the first biome outside every reach', () => {
    const far = { ...hoth, biomes: hoth.biomes.map((b) => ({ ...b, at: [5, 5], reach: 0.01 })) };
    expect(biomeWeights(far, 100, 100)).toEqual(hoth.biomes.map((_, i) => (i === 0 ? 1 : 0)));
  });

  it('weightsAt is biomeWeights given the climate', () => {
    for (let i = 0; i < 20; i++) {
      const [x, z] = [Math.sin(i * 3.7) * 52000, Math.cos(i * 1.3) * 52000];
      expect(weightsAt(hoth.biomes, ...climateOf(hoth)(x, z))).toEqual(biomeWeights(hoth, x, z));
    }
  });

  it('gives every biome somewhere on the planet', () => {
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      const w = biomeWeights(hoth, (i % 20) * 3000, Math.floor(i / 20) * 3000);
      seen.add(w.indexOf(Math.max(...w)));
    }
    expect(seen.size).toBe(hoth.biomes.length);
  });
});
