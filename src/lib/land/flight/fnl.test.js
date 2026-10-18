import { describe, expect, it } from 'vitest';
import { cells3For, fold, noise3For, noiseFor } from './fnl';

describe('noiseFor', () => {
  it('gives the same value for the same seed and point', () => {
    const a = noiseFor(7, { type: 'simplex' });
    const b = noiseFor(7, { type: 'simplex' });
    expect(a(123.4, -56.7)).toBe(a(123.4, -56.7));
    expect(a(123.4, -56.7)).toBe(b(123.4, -56.7));
  });

  it('differs between seeds', () => {
    expect(noiseFor(1)(10, 10)).not.toBe(noiseFor(2)(10, 10));
  });

  it('stays in [−1, 1]', () => {
    const n = noiseFor(1, { type: 'simplex' });
    for (let i = 0; i < 1000; i++) {
      const v = n(i * 37.1 - 9000, i * -13.7 + 4000);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('warps the domain', () => {
    expect(noiseFor(5, { warp: 200 })(100, 100)).not.toBe(noiseFor(5, { warp: 0 })(100, 100));
  });

  it('takes every type and fractal it names', () => {
    for (const type of ['simplex', 'cellular', 'perlin', 'value'])
      for (const fractal of ['fbm', 'ridged', 'pingpong', 'none']) expect(Number.isFinite(noiseFor(3, { type, fractal })(50, 70))).toBe(true);
  });
});

describe('noise3For', () => {
  it('gives the same value for the same seed and point, and differs between seeds', () => {
    const a = noise3For(7);
    expect(a(123.4, -56.7, 890.1)).toBe(a(123.4, -56.7, 890.1));
    expect(a(123.4, -56.7, 890.1)).toBe(noise3For(7)(123.4, -56.7, 890.1));
    expect(noise3For(1)(10, 20, 30)).not.toBe(noise3For(2)(10, 20, 30));
  });

  it('stays in [−1, 1] over 1,000 points', () => {
    const n = noise3For(1, { octaves: 5 });
    for (let i = 0; i < 1000; i++) {
      const v = n(i * 37.1 - 9000, i * 11.3 - 2000, i * -13.7 + 4000);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous: two points a millimetre apart differ by under 1e−3', () => {
    const n = noise3For(4, { octaves: 5 });
    for (let i = 0; i < 200; i++) {
      const [x, y, z] = [i * 91.7 - 5000, i * -23.9 + 700, i * 57.3];
      expect(Math.abs(n(x + 0.001, y, z) - n(x, y, z))).toBeLessThan(1e-3);
      expect(Math.abs(n(x, y + 0.001, z) - n(x, y, z))).toBeLessThan(1e-3);
      expect(Math.abs(n(x, y, z + 0.001) - n(x, y, z))).toBeLessThan(1e-3);
    }
  });

  it('warps in 3D', () => {
    // not (100, 100, 100): a lattice point of the noise and of the warp's
    // own, where OpenSimplex2 reads 0 warped or not
    expect(noise3For(5, { warp: 200 })(100, 37, -80)).not.toBe(noise3For(5, { warp: 0 })(100, 37, -80));
  });

  it('takes every type and fractal it names', () => {
    for (const type of ['simplex', 'cellular', 'perlin', 'value'])
      for (const fractal of ['fbm', 'ridged', 'pingpong', 'none']) expect(Number.isFinite(noise3For(3, { type, fractal })(50, 70, -90))).toBe(true);
  });
});

describe('cells3For', () => {
  it('is a distance from 0 up, the same twice', () => {
    const a = cells3For(9, { frequency: 1 / 500 });
    const b = cells3For(9, { frequency: 1 / 500 });
    const seen = new Set();
    for (let i = 0; i < 1000; i++) {
      const [x, y, z] = [i * 37.1 - 9000, i * 11.3 - 2000, i * -13.7 + 4000];
      const d = a(x, y, z);
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(b(x, y, z)).toBe(d);
      seen.add(d);
    }
    // a distance that moves with the point, not one constant
    expect(seen.size).toBeGreaterThan(900);
  });
});

describe('fold', () => {
  it('folds a bigint to an int32, stably', () => {
    const f = fold(2n ** 40n + 5n);
    expect(Number.isInteger(f)).toBe(true);
    expect(f | 0).toBe(f);
    expect(fold(f)).toBe(f);
  });

  it('keeps a small number', () => {
    expect(fold(42)).toBe(42);
  });
});
