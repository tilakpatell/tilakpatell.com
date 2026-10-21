import { describe, expect, it } from 'vitest';
import { fbm, hash2, lerp, noise2, ridged, rng, smoothstep } from './noise';

// sample points spread over a few hundred units, off the grid and on it
const points = Array.from({ length: 200 }, (_, i) => [i * 3.7 - 300, i * -2.3 + 150]);

describe('hash2', () => {
  it('is 0…1 and the same for the same integers and seed', () => {
    for (const [x, y] of points) {
      const h = hash2(x, y, 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      expect(hash2(x, y, 7)).toBe(h);
    }
  });

  it('changes with the seed', () => {
    expect(points.some(([x, y]) => hash2(x, y, 1) !== hash2(x, y, 2))).toBe(true);
  });
});

describe('noise2', () => {
  it('is −1…1', () => {
    for (const [x, y] of points) {
      const n = noise2(x, y, 3);
      expect(n).toBeGreaterThanOrEqual(-1);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it('is its corner’s hash on a whole-number point', () => {
    expect(noise2(4, -9, 5)).toBeCloseTo(hash2(4, -9, 5) * 2 - 1, 12);
  });

  it('is smooth: a small step moves it a little', () => {
    for (const [x, y] of points) expect(Math.abs(noise2(x + 0.001, y, 3) - noise2(x, y, 3))).toBeLessThan(0.01);
  });
});

describe('fbm and ridged', () => {
  it('fbm stays near −1…1 and ridged in 0…1', () => {
    for (const [x, y] of points) {
      expect(Math.abs(fbm(x * 0.05, y * 0.05, { seed: 9 }))).toBeLessThanOrEqual(1);
      const r = ridged(x * 0.05, y * 0.05, { seed: 9 });
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it('one octave of fbm is the noise itself', () => {
    expect(fbm(1.3, 2.7, { octaves: 1, seed: 4 })).toBe(noise2(1.3, 2.7, 4));
  });
});

describe('rng', () => {
  it('gives the same run for the same seed, each 0…1', () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('smoothstep and lerp', () => {
  it('smoothstep is 0 below, 1 above and a half midway', () => {
    expect(smoothstep(2, 4, 1)).toBe(0);
    expect(smoothstep(2, 4, 5)).toBe(1);
    expect(smoothstep(2, 4, 3)).toBe(0.5);
  });

  it('lerp runs a to b', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(lerp(10, 20, 1)).toBe(20);
  });
});
