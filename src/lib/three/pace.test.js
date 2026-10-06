import { describe, expect, it } from 'vitest';
import { STEPS, createPace } from './pace';

// feed `count` frames `ms` apart from `t`; the scales it moved to, and where it got to
const run = (pace, t, count, ms) => {
  const changes = [];
  for (let i = 0; i < count; i++) {
    t += typeof ms === 'function' ? ms(i) : ms;
    const k = pace.frame(t);
    if (k !== null) changes.push(k);
  }
  return { t, changes };
};

describe('pace', () => {
  it('stays sharp while frames come on the beat', () => {
    const pace = createPace();
    const { changes } = run(pace, 1000, 600, 16.7);
    expect(changes).toEqual([]);
    expect(pace.scale).toBe(1);
  });

  it('steps down within a fraction of a second when frames run long, and again if that is not enough', () => {
    const pace = createPace();
    let { t } = run(pace, 1000, 120, 16.7); // the beat, read
    const slow = run(pace, t, 45, 33.4); // every frame a beat late: a second and a half
    expect(slow.changes).toEqual([STEPS[1], STEPS[2]]);
    t = slow.t;
    expect(pace.level).toBe(2);
  });

  it('ignores a single hiccup and a pause', () => {
    const pace = createPace();
    let { t } = run(pace, 1000, 120, 16.7);
    ({ t } = run(pace, t, 60, (i) => (i === 10 ? 80 : 16.7))); // one long frame
    ({ t } = run(pace, t + 5000, 60, 16.7)); // back from a pause
    expect(pace.level).toBe(0);
  });

  it('comes to take a laptop capped at 30 a second as on time', () => {
    const pace = createPace();
    run(pace, 1000, 1800, 33.4); // a minute
    expect(pace.level).toBe(0);
    // and from then on, 30 a second moves nothing
    const { changes } = run(pace, 70000, 900, 33.4);
    expect(changes).toEqual([]);
  });

  it("doesn't chase a fast screen past what looks smooth", () => {
    const pace = createPace();
    // a 144 Hz screen drawn at about 55 a second
    run(pace, 1000, 600, (i) => (i < 120 ? 6.95 : 18));
    expect(pace.level).toBe(0);
  });

  it('goes back up once frames have been on time a while, and waits longer if that brings misses back at once', () => {
    const pace = createPace();
    let { t } = run(pace, 1000, 120, 16.7);
    ({ t } = run(pace, t, 25, 33.4));
    expect(pace.level).toBe(1);
    // on time again: back up after the wait (4 s)
    let back = run(pace, t, 300, 16.7);
    expect(back.changes).toEqual([STEPS[0]]);
    t = back.t;
    // the misses come straight back: down, and the next wait is twice as long
    ({ t } = run(pace, t, 25, 33.4));
    expect(pace.level).toBe(1);
    back = run(pace, t, 300, 16.7); // 5 s: not yet
    expect(back.changes).toEqual([]);
    back = run(pace, back.t, 300, 16.7);
    expect(back.changes).toEqual([STEPS[0]]);
  });

  it('says once, when frames stay late with nothing left to soften', () => {
    let told = 0;
    const pace = createPace({ onFloor: () => (told += 1) });
    let { t } = run(pace, 1000, 120, 16.7);
    ({ t } = run(pace, t, 160, 50)); // down every step
    expect(told).toBe(0);
    run(pace, t, 600, 50); // and half a minute more at the softest
    expect(told).toBe(1);
  });

  it('says nothing for a short while at its softest', () => {
    let told = 0;
    const pace = createPace({ onFloor: () => (told += 1) });
    let { t } = run(pace, 1000, 120, 16.7);
    while (pace.level < STEPS.length - 1) ({ t } = run(pace, t, 1, 50)); // down to the softest
    ({ t } = run(pace, t, 60, 50)); // three seconds more
    ({ t } = run(pace, t, 600, 16.7)); // then on time
    run(pace, t, 60, 50); // and a later stretch starts the count again
    expect(told).toBe(0);
  });

  it('never goes past its last step', () => {
    const pace = createPace();
    const { t } = run(pace, 1000, 120, 16.7);
    const { changes } = run(pace, t, 160, 50); // 8 s at 20 a second
    expect(changes).toEqual(STEPS.slice(1));
    expect(pace.scale).toBe(STEPS[STEPS.length - 1]);
  });
});
