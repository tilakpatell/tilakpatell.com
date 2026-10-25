import { describe, expect, it } from 'vitest';
import { ROUND_ROUGH, TYPE_BIOMES, WATER_LOOKS, byteOf, linearOf, roundBiomes, waterColourOf, waterLinearOf } from './planetTables';

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

describe('the water sheets', () => {
  it('look as the flight drew them, by kind', () => {
    expect(WATER_LOOKS).toEqual({
      sea: { color: '#1f5a6e', roughness: 0.12, opacity: 0.86 },
      lake: { color: '#2a4f5a', roughness: 0.16, opacity: 0.9 },
      swamp: { color: '#2e3322', roughness: 0.35, opacity: 0.95 },
      lava: { color: '#3a0c02', roughness: 0.6, opacity: 1, glow: '#ff4a0a' },
    });
  });

  it('are drawn in the water’s own colour or its kind’s, a little toward the accent', () => {
    expect(waterColourOf({ kind: 'sea', level: 0 }, '#1f5a6e')).toBe('#1f5a6e');
    expect(waterColourOf({ kind: 'sea', level: 0, colour: '#204060' }, '#204060')).toBe('#204060');
    // (a mix in linear light lands nearer the brighter end than half the bytes would)
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(waterColourOf({ kind: 'lava', level: 0, colour: '#000000' }, '#ffffff').slice(i, i + 2), 16));
    expect([r, g, b].every((v) => v === r)).toBe(true);
    expect(r).toBeGreaterThan(Math.round(0.15 * 255));
    expect(waterColourOf({ kind: 'sea', level: 0 }, '#3ad0c8')).toMatch(/^#[0-9a-f]{6}$/);
    for (const w of [null, undefined, { kind: 'clouds', level: -380 }]) expect(waterColourOf(w, '#ffffff'), String(w?.kind)).toBeNull();
  });

  it('are that colour in linear light before it’s written as bytes', () => {
    for (const [w, accent] of [[{ kind: 'sea', level: 0 }, '#3ad0c8'], [{ kind: 'lava', level: 0 }, '#ff8800'], [{ kind: 'sea', level: 0, colour: '#204060' }, '#0a0b0c']]) {
      const c = waterLinearOf(w, accent);
      expect(`#${c.map((v) => byteOf(v).toString(16).padStart(2, '0')).join('')}`).toBe(waterColourOf(w, accent));
    }
    expect(waterLinearOf({ kind: 'clouds', level: -380 }, '#ffffff')).toBeNull();
  });
});

describe('the colour curves', () => {
  it('read a byte into linear light and write it back as the same byte, as three’s do', () => {
    for (let v = 0; v < 256; v++) {
      const hex = `#${v.toString(16).padStart(2, '0').repeat(3)}`;
      expect(linearOf(hex).map(byteOf), hex).toEqual([v, v, v]);
    }
    expect(linearOf('#ff0000')).toEqual([1, 0, 0]);
    // halfway in linear light is sRGB 188; past the ends is clamped
    expect([byteOf(0.5), byteOf(-1), byteOf(2)]).toEqual([188, 0, 255]);
  });
});
