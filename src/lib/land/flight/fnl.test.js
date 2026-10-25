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
    const a = noise3For(7);
    expect(a(123.4, -56.7, 8.9)).toBe(a(123.4, -56.7, 8.9));
    expect(a(123.4, -56.7, 8.9)).toBe(noise3For(7)(123.4, -56.7, 8.9));
    expect(noise3For(1)(10, 20, 30)).not.toBe(noise3For(2)(10, 20, 30));
    // a bigint seed folds as noiseFor's does
    expect(noise3For(2n ** 40n + 5n)(10, 20, 30)).toBe(noise3For(fold(2n ** 40n + 5n))(10, 20, 30));
  });

  it('stays in [−1, 1] over 1,000 points', () => {
    const n = noise3For(1, { octaves: 5 });
    for (let i = 0; i < 1000; i++) {
      const v = n(i * 37.1 - 9000, i * 11.3 - 5000, i * -13.7 + 4000);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous: two points a millimetre apart differ by under 1e−3', () => {
    const n = noise3For(4, { frequency: 0.02, octaves: 5, warp: 30 });
    for (let i = 0; i < 200; i++) {
      const [x, y, z] = [i * 91.7 - 9000, i * -23.1 + 300, i * 57.3 - 4000];
      expect(Math.abs(n(x + 0.001, y, z) - n(x, y, z))).toBeLessThan(1e-3);
      expect(Math.abs(n(x, y + 0.001, z) - n(x, y, z))).toBeLessThan(1e-3);
      expect(Math.abs(n(x, y, z + 0.001) - n(x, y, z))).toBeLessThan(1e-3);
    }
  });

  it('is continuous across its lattice’s ties too: a hair either side of y = z, it reads the same', () => {
    // (OpenSimplex2's fast 3D takes one of two equally near corners by a
    // comparison, so it steps up to 0.006 where they tie: y = z, x = y, x = z)
    for (const warp of [0, 0.3]) {
      const n = noise3For(8, { frequency: 1, octaves: 1, fractal: 'none', warp });
      for (let i = 0; i < 400; i++) {
        const [x, y] = [Math.sin(i * 12.9898) * 20, Math.cos(i * 78.233) * 20];
        expect(Math.abs(n(x, y, y + 1e-11) - n(x, y, y - 1e-11))).toBeLessThan(1e-6);
      }
      // where a planet's map wraps at its equator (sphereField.js's seam)
      expect(Math.abs(n(-1.6, 0, 1e-12) - n(-1.6, 0, -1e-12))).toBeLessThan(1e-6);
    }
  });

  it('is a function of all three: moving along y alone changes it', () => {
    const n = noise3For(9);
    expect(n(100, 0, 100)).not.toBe(n(100, 60, 100));
  });

  it('warps in 3D', () => {
    // (off the diagonal x = y = z, where the simplex lattice can read 0 either way)
    expect(noise3For(5, { warp: 200 })(100, 37, -60)).not.toBe(noise3For(5, { warp: 0 })(100, 37, -60));
  });

  it('takes every type and fractal it names', () => {
    for (const type of ['smooth', 'simplex', 'cellular', 'perlin', 'value'])
      for (const fractal of ['fbm', 'ridged', 'pingpong', 'none']) expect(Number.isFinite(noise3For(3, { type, fractal })(50, 70, -20))).toBe(true);
  });
});

describe('cells3For', () => {
  it('is a distance from 0 up, the same twice', () => {
    const c = cells3For(6, { frequency: 1 / 50 });
    const again = cells3For(6, { frequency: 1 / 50 });
    let low = Infinity;
    let high = 0;
    for (let i = 0; i < 1000; i++) {
      const p = [i * 7.3 - 3000, i * -3.9 + 200, i * 5.1 - 1000];
      const d = c(...p);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBe(again(...p));
      low = Math.min(low, d);
      high = Math.max(high, d);
    }
    // in cells: near a point it reads near 0, and nowhere is two cells from one
    expect(low).toBeLessThan(0.2);
    expect(high).toBeGreaterThan(0.5);
    expect(high).toBeLessThan(2);
    expect(cells3For(7, { frequency: 1 / 50 })(10, 20, 30)).not.toBe(c(10, 20, 30));
  });

  it('is the Euclidean distance: it never changes faster than the step (the squared one would)', () => {
    const c = cells3For(2, { frequency: 1 });
    for (let i = 0; i < 300; i++) {
      const [x, y, z] = [i * 0.37, i * -0.21, i * 0.13];
      expect(Math.abs(c(x + 0.01, y, z) - c(x, y, z))).toBeLessThanOrEqual(0.01 + 1e-9);
    }
  });
});
