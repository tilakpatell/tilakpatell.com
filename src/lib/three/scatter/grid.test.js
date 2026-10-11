import { describe, expect, it } from 'vitest';
import { DENSITY_CAP, REACH, TILE, dissolveOf, keepShare, layerAt, mulberry32, reachOf, tileInstances, tilesAround } from './grid.js';

// a 64 m square at 2 m a texel: layer 4 west of x = 32, layer 7 east, none in the last row
const mask = (() => {
  const w = 32;
  const h = 32;
  const data = new Uint16Array(w * h);
  for (let z = 0; z < h - 1; z++) for (let x = 0; x < w; x++) data[z * w + x] = x < 16 ? 5 : 8;
  return { data, w, h, minX: 0, minZ: 0, metresPerPixel: 2 };
})();
const type = (density, over = {}) => ({ density: { low: density, mid: density, high: density, ultra: density }, scale: { min: [1, 1], max: [2, 3] }, randomness: 1, dissolve: { range: 0.4 }, ...over });
const layers = [
  { index: 4, types: [type(1)] },
  { index: 7, types: [type(0.25)] },
];

describe('layerAt', () => {
  it('reads the mask’s layer under a point, -1 off it or where nothing grows', () => {
    expect(layerAt(mask, 10, 10)).toBe(4);
    expect(layerAt(mask, 50, 10)).toBe(7);
    expect(layerAt(mask, -5, 10)).toBe(-1);
    expect(layerAt(mask, 10, 62)).toBe(-1);
  });
});

describe('tileInstances', () => {
  it('the record’s density a square metre, on its own layer only', () => {
    const a = tileInstances({ tx: 0, tz: 0, mask, layers, tier: 'ultra' });
    // (tile 0,0 is wholly layer 4: about one a square metre of its type, none of layer 7's)
    expect(a.length).toBeGreaterThan(TILE * TILE * 0.9);
    expect(a.length).toBeLessThan(TILE * TILE * 1.1);
    expect(a.every((i) => i.type === 0)).toBe(true);
    const b = tileInstances({ tx: 2, tz: 0, mask, layers, tier: 'ultra' });
    expect(b.every((i) => i.type === 1)).toBe(true);
    expect(b.length).toBeGreaterThan(TILE * TILE * 0.2);
    expect(b.length).toBeLessThan(TILE * TILE * 0.3);
  });
  it('is the same every visit, and its sizes are in the record’s range', () => {
    const a = tileInstances({ tx: 1, tz: 1, mask, layers, tier: 'high' });
    expect(tileInstances({ tx: 1, tz: 1, mask, layers, tier: 'high' })).toEqual(a);
    for (const i of a) {
      expect(i.w).toBeGreaterThanOrEqual(1);
      expect(i.w).toBeLessThanOrEqual(2);
      expect(i.h).toBeGreaterThanOrEqual(1);
      expect(i.h).toBeLessThanOrEqual(3);
    }
  });
  it('a tier whose density is nought draws none', () => {
    expect(tileInstances({ tx: 0, tz: 0, mask, layers: [{ index: 4, types: [type(0)] }], tier: 'low' })).toEqual([]);
  });
});

describe('reach, dissolve and the cap', () => {
  it('a bigger type is drawn farther; ultra farther than low', () => {
    const small = type(1, { scale: { min: [0.5, 0.5], max: [0.5, 0.5] } });
    const big = type(1, { scale: { min: [6, 6], max: [6, 6] } });
    expect(reachOf(big, 1, 'high')).toBeGreaterThan(reachOf(small, 1, 'high'));
    expect(reachOf(small, 1, 'ultra')).toBeGreaterThan(reachOf(small, 1, 'low'));
    expect(REACH.ultra).toBeGreaterThan(REACH.high);
  });
  it('whole until the last of its reach, gone at it', () => {
    expect(dissolveOf(10, 40, 0.4)).toBe(1);
    expect(dissolveOf(24, 40, 0.4)).toBe(1);
    expect(dissolveOf(32, 40, 0.4)).toBeCloseTo(0.5, 5);
    expect(dissolveOf(40, 40, 0.4)).toBe(0);
  });
  it('keeps all under the tier’s cap, the cap’s share over it', () => {
    expect(keepShare(100, 'high')).toBe(1);
    expect(keepShare(DENSITY_CAP.high * 2, 'high')).toBe(0.5);
  });
});

describe('tilesAround', () => {
  it('the tiles within reach, nearest first', () => {
    const t = tilesAround(8, 8, 20);
    expect(t[0]).toEqual([0, 0, 0]);
    expect(t.every((x, i) => i === 0 || x[2] >= t[i - 1][2])).toBe(true);
    expect(t.every((x) => x[2] <= 20)).toBe(true);
  });
  it('mulberry32 is seeded', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    expect([a(), a()]).toEqual([b(), b()]);
  });
});
