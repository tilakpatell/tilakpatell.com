import { describe, expect, it } from 'vitest';
import { bladeLayout } from './grass';

// how many of the first `n` blades fall in each cell of a k × k grid over the patch
const cells = (offs, n, patch, k) => {
  const c = new Array(k * k).fill(0);
  for (let i = 0; i < n; i++) {
    const gx = Math.min(k - 1, Math.floor((offs[i * 4] / patch + 0.5) * k));
    const gz = Math.min(k - 1, Math.floor((offs[i * 4 + 1] / patch + 0.5) * k));
    c[gz * k + gx] += 1;
  }
  return c;
};

describe('grass blade layout', () => {
  it('puts every blade in the patch, with its two random numbers in 0..1', () => {
    const offs = bladeLayout(5000, 30);
    expect(offs.length).toBe(5000 * 4);
    for (let i = 0; i < 5000; i++) {
      expect(Math.abs(offs[i * 4])).toBeLessThanOrEqual(15);
      expect(Math.abs(offs[i * 4 + 1])).toBeLessThanOrEqual(15);
      expect(offs[i * 4 + 2]).toBeGreaterThanOrEqual(0);
      expect(offs[i * 4 + 2]).toBeLessThan(1);
      expect(offs[i * 4 + 3]).toBeGreaterThanOrEqual(0);
      expect(offs[i * 4 + 3]).toBeLessThan(1);
    }
  });

  // the watchdog thins the grass by drawing only the first blades: those
  // must still cover the whole patch, thinner, not a strip of it
  it('spreads any first part of the blades over the whole patch', () => {
    const count = 20000;
    const patch = 30;
    const offs = bladeLayout(count, patch);
    for (const share of [0.1, 0.45, 0.7, 1]) {
      const n = Math.round(count * share);
      const c = cells(offs, n, patch, 6);
      const want = n / c.length;
      for (const v of c) {
        expect(v).toBeGreaterThan(want * 0.75);
        expect(v).toBeLessThan(want * 1.25);
      }
    }
  });

  it('is the same every time', () => {
    expect(Array.from(bladeLayout(300, 20))).toEqual(Array.from(bladeLayout(300, 20)));
  });
});
