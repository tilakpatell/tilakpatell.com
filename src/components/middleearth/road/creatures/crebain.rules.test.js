import { describe, expect, it } from 'vitest';
import { GAP, RADIUS, centreOf, newFlock, step } from './crebain.rules';

const bird = (f, i) => [f.p[i * 3], f.p[i * 3 + 1], f.p[i * 3 + 2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('the crebain’s flock', () => {
  it('is the same flock for the same seed', () => {
    expect(newFlock(300, { seed: 4 })).toEqual(newFlock(300, { seed: 4 }));
    expect(newFlock(300, { seed: 4 }).count).toBe(300);
  });

  it('keeps every bird within 40 m of its centre and no two closer than 0.6 m, flying to its goal', () => {
    expect(GAP).toBe(0.6);
    expect(RADIUS).toBe(40);
    let f = newFlock(300, { seed: 7, at: [0, 20, 0] });
    const goals = [[60, 30, 80], [-40, 18, 40], [0, 25, -30]];
    const check = () => {
      const c = centreOf(f);
      let far = 0;
      let nearest = Infinity;
      for (let i = 0; i < f.count; i++) {
        far = Math.max(far, dist(bird(f, i), c));
        for (let j = i + 1; j < f.count; j++) nearest = Math.min(nearest, dist(bird(f, i), bird(f, j)));
      }
      expect(far).toBeLessThanOrEqual(RADIUS);
      expect(nearest).toBeGreaterThanOrEqual(GAP);
    };
    // (twenty frames a second for twenty-four seconds: the flock over the ridge, back, and away)
    for (let i = 0; i < 20 * 24; i++) {
      f = step(f, 1 / 20, goals[Math.floor(i / 160)]);
      if (i % 80 === 0) check();
    }
    check();
    // (it got there: the last goal is under the flock)
    expect(dist(centreOf(f), [0, 25, -30])).toBeLessThan(25);
  });

  it('steps without changing the flock it was given', () => {
    const f = newFlock(20, { seed: 1 });
    const copy = structuredClone(f);
    step(f, 1 / 60, [10, 10, 10]);
    expect(f).toEqual(copy);
  });
});
