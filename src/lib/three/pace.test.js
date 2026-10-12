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

  it('says how many runs in a row it has been at its softest with frames still late', () => {
    const pace = createPace({ onFloor: () => {} });
    let { t } = run(pace, 1000, 120, 16.7);
    expect(pace.stuck).toBe(0);
    while (pace.level < STEPS.length - 1) ({ t } = run(pace, t, 1, 50)); // down to the softest
    expect(pace.stuck).toBe(0); // (there, but not yet late there)
    ({ t } = run(pace, t, 60, 50)); // three runs late at the softest
    expect(pace.stuck).toBe(3);
    ({ t } = run(pace, t, 20, 16.7)); // a run on time
    expect(pace.stuck).toBe(0);
  });

  it('a reset starts it again from its sharpest, its waits as they were at first', () => {
    const pace = createPace({ onFloor: () => {} });
    let { t } = run(pace, 1000, 120, 16.7);
    ({ t } = run(pace, t, 25, 33.4));
    ({ t } = run(pace, t, 300, 16.7)); // back up after the wait
    ({ t } = run(pace, t, 25, 33.4)); // and straight down again: the next wait twice as long
    ({ t } = run(pace, t, 60, 50)); // and on down
    expect(pace.level).toBeGreaterThan(1);
    pace.reset();
    expect(pace.level).toBe(0);
    expect(pace.scale).toBe(1);
    expect(pace.stuck).toBe(0);
    // the next late run steps to the first step, not one past where it was
    ({ t } = run(pace, t + 5000, 40, 16.7));
    const down = run(pace, t, 25, 33.4);
    expect(down.changes).toEqual([STEPS[1]]);
    // and comes back up after the first wait (4 s), not the doubled one
    const back = run(pace, down.t, 300, 16.7);
    expect(back.changes).toEqual([STEPS[0]]);
  });

  it('never goes past its last step', () => {
    const pace = createPace();
    const { t } = run(pace, 1000, 120, 16.7);
    const { changes } = run(pace, t, 160, 50); // 8 s at 20 a second
    expect(changes).toEqual(STEPS.slice(1));
    expect(pace.scale).toBe(STEPS[STEPS.length - 1]);
  });

  it("never climbs back with climb: false (each step's a canvas resize)", () => {
    const pace = createPace({ climb: false, settle: 0, wait: 100 });
    let t = 0;
    const run = (dt, n) => {
      let changed = null;
      for (let i = 0; i < n; i++) {
        t += dt;
        const c = pace.frame(t);
        if (c !== null) changed = c;
      }
      return changed;
    };
    run(16, 2);
    run(60, 40);
    const down = pace.level;
    expect(down).toBeGreaterThan(0);
    run(16, 2000);
    expect(pace.level).toBe(down);
  });

  it('set() puts it at a step and never climbs past it', () => {
    const pace = createPace({ wait: 100 });
    pace.set(2);
    expect(pace.level).toBe(2);
    run(pace, 1000, 3000, 16.7);
    expect(pace.level).toBe(2);
  });

  // (lane L1: a level's cells, maps and shapes arriving on the main thread
  // for a minute read as late frames; on the owner's RTX 5090 the pace
  // reached its softest and told onFloor within twenty seconds)
  it('under a hold says nothing and moves nothing, and judges again from the first frame after', () => {
    let told = 0;
    const pace = createPace({ onFloor: () => (told += 1) });
    const { t } = run(pace, 1000, 120, 16.7);
    pace.hold(true);
    const held = run(pace, t, 1200, 50); // a minute of late frames
    expect(held.changes).toEqual([]);
    expect(pace.level).toBe(0);
    expect(pace.stuck).toBe(0);
    expect(told).toBe(0);
    pace.hold(false);
    expect(run(pace, held.t, 45, 33.4).changes).toEqual([STEPS[1], STEPS[2]]);
  });
});
