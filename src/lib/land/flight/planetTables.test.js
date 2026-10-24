import { describe, expect, it } from 'vitest';
import { ROUND_ROUGH, TYPE_BIOMES, roundBiomes } from './planetTables';

const ROUND = ['ice', 'desert', 'forest', 'lava', 'ocean', 'rock'];

describe('roundBiomes', () => {
  it.each(ROUND)('gives a round %s planet its template’s biomes, flat, each with its roughness', (family) => {
    const out = roundBiomes(family);
    expect(out.map((b) => b.id)).toEqual(TYPE_BIOMES[family].map((b) => b.id));
    out.forEach((b, i) => {
      const t = TYPE_BIOMES[family][i];
      expect(b).toEqual({ id: t.id, at: t.at, reach: t.reach, base: t.base, rough: ROUND_ROUGH[family][t.id], relief: [] });
      expect(Number.isFinite(b.rough)).toBe(true);
    });
    expect(Object.keys(ROUND_ROUGH[family]).sort()).toEqual(TYPE_BIOMES[family].map((b) => b.id).sort());
  });

  it('hands out its own arrays, so no spec shares the template’s', () => {
    const [a, b] = [roundBiomes('ice'), roundBiomes('ice')];
    expect(a[0].at).not.toBe(TYPE_BIOMES.ice[0].at);
    expect(a[0].at).not.toBe(b[0].at);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});
