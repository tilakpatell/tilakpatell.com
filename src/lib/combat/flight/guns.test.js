import { describe, expect, it } from 'vitest';
import { CADENCE, gunsUnder, pace } from './guns';

const FASTEST = 0.12;
// pickups.js's gunsUnder at cc5e2eaf
const before = (base, delay, fastest, out = { gap: 0, punch: 1 }) => {
  const wanted = Math.max(fastest, base) * delay;
  out.gap = Math.max(fastest, wanted);
  out.punch = Math.min(1.5, out.gap / wanted);
  return out;
};

describe('the flight core’s guns', () => {
  it('has one pace table, and paces as gunsUnder did', () => {
    expect(CADENCE).toEqual({ xwing: 0.12, falcon: 0.16, cruiser: 0.19, rv: 0.2 });
    for (const base of [0.06, 0.084, 0.12, 0.16, 0.19, 0.2, 0.3, 0.4, 0.5])
      for (const delay of [0.2, 0.6, 1]) {
        expect(pace(Math.max(FASTEST, base), delay, FASTEST)).toEqual(before(base, delay, FASTEST));
        expect(gunsUnder(base, delay, FASTEST)).toEqual(before(base, delay, FASTEST));
      }
    const out = { gap: 0, punch: 0 };
    expect(pace(0.12, 0.6, FASTEST, out)).toBe(out);
    expect(out).toEqual({ gap: 0.12, punch: 1.5 });
  });
});
