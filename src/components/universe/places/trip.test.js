import { describe, expect, it } from 'vitest';
import { OPEN_SPACE, SOLIDS, autopilot, headingTo, spawn, step } from '../ship';
import { TRIP, longTrip } from './trip';

// flown on the real physics, far out in the open (no place near to close the drive)
const X = 600000;
const sim = (D, drive, heading) => {
  const goal = { id: 'g', at: [X + D + 20, 0, 0], r: 10, reach: 12 };
  const space = { ...OPEN_SPACE, goals: { ...OPEN_SPACE.goals, g: goal } };
  const park = { x: X + D, y: 0, z: 0, heading: headingTo(1, 0) };
  let s = { ...spawn(null), x: X, y: 0, z: 0, heading };
  for (let t = 0; t < 400; t += 1 / 30) {
    const a = autopilot(s, 'g', park, space, drive === 'super' ? 3 : 1);
    if (a.done) return { t, s0: { ...spawn(null), x: X, y: 0, z: 0, heading }, park };
    s = step(s, a.input, 1 / 30, SOLIDS, space).ship;
  }
  return null;
};

describe('a long trip’s time', () => {
  it('is within a tenth, or a second and a half, of flying it, at three headings on both drives', () => {
    expect(TRIP).toEqual({ extra: { cruise: 7.1, super: 5.6 }, turn: { cruise: 1.7, super: 0.5 } });
    for (const drive of ['cruise', 'super']) {
      for (const D of [2000, 10000, 40000]) {
        for (const heading of [headingTo(1, 0), 0, headingTo(-1, 0)]) {
          const flown = sim(D, drive, heading);
          const t = longTrip(flown.s0, flown.park, drive);
          expect(Math.abs(t - flown.t), `${drive} ${D} ${heading}`).toBeLessThanOrEqual(Math.max(1.5, 0.1 * flown.t));
        }
      }
    }
  });
  it('is finite for any trip, and nothing but the overhead for none', () => {
    const s = { ...spawn(null), x: 0, y: 0, z: 0, heading: 0 };
    expect(longTrip(s, { x: 0, y: 0, z: 0 }, 'super')).toBeCloseTo(TRIP.extra.super, 9);
    expect(longTrip(s, { x: 0, y: 0, z: 0 }, 'cruise')).toBeCloseTo(TRIP.extra.cruise, 9);
    const far = longTrip(s, { x: 0, y: 9e8, z: 0 }, 'super');
    expect(Number.isFinite(far)).toBe(true);
    expect(far).toBeCloseTo(9e8 / 900 + TRIP.extra.super + TRIP.turn.super / 2, 6);
  });
});
