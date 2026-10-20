import { describe, expect, it } from 'vitest';
import { fbm, makeNoise, makeCells, smooth, mix, clamp01 } from './paint';

describe('seeded, tiling noise for painted textures', () => {
  it('paints the same for the same seed, and differently for another', () => {
    const a = makeNoise(7);
    const b = makeNoise(7);
    const c = makeNoise(8);
    const pts = [[0.3, 0.7], [2.5, 1.25], [5.9, 3.1]];
    for (const [x, y] of pts) expect(a(x, y, 8)).toBe(b(x, y, 8));
    expect(pts.some(([x, y]) => a(x, y, 8) !== c(x, y, 8))).toBe(true);
  });

  it('stays between 0 and 1', () => {
    const n = makeNoise(3);
    for (let i = 0; i < 2000; i++) {
      const v = n(i * 0.137, i * 0.291, 16);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    for (let i = 0; i < 400; i++) {
      const v = fbm(n, i * 0.21, i * 0.05, { period: 4, octaves: 5 });
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('wraps at its period, so a texture tiles without a seam', () => {
    const n = makeNoise(11);
    for (let y = 0; y < 4; y += 0.37) {
      expect(n(0, y, 4)).toBeCloseTo(n(4, y, 4), 10);
      expect(n(y, 0, 4)).toBeCloseTo(n(y, 4, 4), 10);
      expect(fbm(n, 0, y, { period: 4 })).toBeCloseTo(fbm(n, 4, y, { period: 4 }), 10);
    }
  });

  it('wraps at a period of its own each way, for grain long one way and fine the other', () => {
    const n = makeNoise(13);
    for (let t = 0; t < 3; t += 0.29) {
      expect(n(0, t * 10, 3, 32)).toBeCloseTo(n(3, t * 10, 3, 32), 10);
      expect(n(t, 0, 3, 32)).toBeCloseTo(n(t, 32, 3, 32), 10);
      expect(fbm(n, t, 0, { period: 3, periodY: 32 })).toBeCloseTo(fbm(n, t, 32, { period: 3, periodY: 32 }), 10);
    }
    expect(n(0.5, 0.5, 3, 32)).not.toBeCloseTo(n(0.5, 3.5, 3, 32), 4);
  });

  it('is smooth: nearby points are close', () => {
    const n = makeNoise(5);
    for (let i = 0; i < 200; i++) {
      const x = i * 0.173;
      expect(Math.abs(n(x, 1.3, 32) - n(x + 0.001, 1.3, 32))).toBeLessThan(0.01);
    }
  });
});

describe('cells, for cracks, cobbles and scales', () => {
  it('gives the distance to the nearest and second-nearest point, and tiles', () => {
    const cells = makeCells(4);
    for (let i = 0; i < 300; i++) {
      const x = (i * 0.37) % 6;
      const y = (i * 0.61) % 6;
      const c = cells(x, y, 6);
      expect(c.f1).toBeGreaterThanOrEqual(0);
      expect(c.f2).toBeGreaterThanOrEqual(c.f1);
      expect(c.f1).toBeLessThan(1.5);
      expect(c.id).toBeGreaterThanOrEqual(0);
      expect(c.id).toBeLessThan(1);
    }
    const a = cells(0.2, 1.7, 6);
    const b = cells(6.2, 1.7, 6);
    expect(a.f1).toBeCloseTo(b.f1, 10);
    expect(a.id).toBe(b.id);
  });
});

describe('small helpers', () => {
  it('eases, mixes and clamps', () => {
    expect(smooth(0, 1, -1)).toBe(0);
    expect(smooth(0, 1, 2)).toBe(1);
    expect(smooth(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(mix(10, 20, 0.25)).toBe(12.5);
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(-3)).toBe(0);
  });
});
