import { describe, expect, it } from 'vitest';
import { STANCE, WALK } from '../../creatures';
import { PACE, STRIDE, feetAt } from './mumak.rules';

describe('the mûmak’s walk', () => {
  it('walks at a metre a second, a stride a cycle', () => {
    expect(PACE).toBe(1);
    const a = feetAt(0.3);
    const b = feetAt(0.3 + STRIDE / PACE);
    for (let i = 0; i < 4; i++) expect(b[i].lift).toBeCloseTo(a[i].lift, 9);
  });

  it('is a four-beat walk: never more than two feet off the ground, and at least two down', () => {
    for (let t = 0; t < STRIDE * 2; t += 0.05) {
      const up = feetAt(t).filter((f) => f.lift > 0).length;
      expect(up).toBeLessThanOrEqual(2);
    }
  });

  it('lifts each foot in turn, a quarter of a stride apart, in the order WALK’s offsets set', () => {
    const first = [0, 1, 2, 3].map((i) => {
      for (let t = 0; t < STRIDE; t += 0.01) {
        const was = feetAt(t - 0.01)[i].lift > 0;
        if (!was && feetAt(t)[i].lift > 0) return t;
      }
      return null;
    });
    const order = [0, 1, 2, 3].sort((a, b) => first[a] - first[b]);
    // (a foot lifts as its cycle passes the stance: at (STANCE.walk − offset) of a cycle)
    const lift = (i) => (((STANCE.walk - WALK[i]) % 1) + 1) % 1;
    const want = [0, 1, 2, 3].sort((a, b) => lift(a) - lift(b));
    const sorted = order.map((i) => first[i]);
    for (let k = 1; k < 4; k++) expect(sorted[k] - sorted[k - 1]).toBeCloseTo(STRIDE / 4, 1);
    expect(order).toEqual(want);
  });

  it('stands still with every foot down', () => {
    expect(feetAt(5, { speed: 0 }).every((f) => f.lift === 0)).toBe(true);
  });
});
