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

describe('noise3For', () => {
  it('gives the same value for the same seed and point, and differs between seeds', () => {
    expect(noise3For(7)(1.5, -2.25, 3)).toBe(noise3For(7)(1.5, -2.25, 3));
    expect(noise3For(1)(10, 10, 10)).not.toBe(noise3For(2)(10, 10, 10));
  });

  it('stays in [−1, 1] over 1,000 points', () => {
    const n = noise3For(4, { octaves: 5, frequency: 0.03 });
    for (let i = 0; i < 1000; i++) {
      const v = n(i * 37.1 - 9000, i * 3.3, i * -13.7 + 4000);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous: two points a millimetre apart differ by under 1e−3', () => {
    const n = noise3For(9, { frequency: 0.01, octaves: 5 });
    for (let i = 0; i < 200; i++) {
      const [x, y, z] = [i * 17.3, i * -5.1, i * 2.9];
      expect(Math.abs(n(x, y, z) - n(x + 0.001, y, z + 0.001))).toBeLessThan(1e-3);
    }
  });

  it('warps in 3D', () => {
    expect(noise3For(5, { warp: 200 })(100, 40, 100)).not.toBe(noise3For(5, { warp: 0 })(100, 40, 100));
  });

  it('takes every type and fractal it names', () => {
    for (const type of ['simplex', 'cellular', 'perlin', 'value'])
      for (const fractal of ['fbm', 'ridged', 'pingpong', 'none']) expect(Number.isFinite(noise3For(3, { type, fractal })(50, 70, -20))).toBe(true);
  });
});

describe('cells3For', () => {
  it('is a distance from 0 up, the same twice', () => {
    const c = cells3For(11, { frequency: 0.01 });
    for (let i = 0; i < 300; i++) {
      const d = c(i * 13.1, i * -7.7, i * 3.9);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(2);
      expect(c(i * 13.1, i * -7.7, i * 3.9)).toBe(d);
    }
  });
});
