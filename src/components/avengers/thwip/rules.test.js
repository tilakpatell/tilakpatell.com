import { describe, expect, it } from 'vitest';
import { AVENUE, BELL, PACK, RUN, SCHOOL, aimWeb, buildAvenue, buildingAt, distance, newRun, pilot, press, release, startRun, steer, stepRun } from './rules';

const DT = 1 / 120;
const run = (g, secs, brain) => {
  const ev = [];
  for (let t = 0; t < secs && g.phase === 'run'; t += DT) {
    brain?.(g, t);
    ev.push(...stepRun(g, DT));
  }
  return ev;
};
const types = (ev) => ev.map((e) => e.type);
const started = (seed = 1) => {
  const g = newRun({ seed });
  startRun(g);
  return g;
};

describe('the avenue', () => {
  const a = buildAvenue();
  it('has buildings down both sides, and the cross streets open', () => {
    for (const side of [-1, 1]) {
      expect(buildingAt(a, side, -40)).not.toBeNull();
      // the middle of each cross street has nothing to swing from
      for (let b = 1; b < 20; b++) expect(buildingAt(a, side, -b * AVENUE.block)).toBeNull();
    }
    for (const b of a) {
      expect(b.z0).toBeGreaterThan(b.z1);
      expect(b.h).toBeGreaterThanOrEqual(20);
    }
  });
  it('rises toward Midtown', () => {
    const avg = (z0, z1) => {
      const list = a.filter((b) => b.z0 <= z0 && b.z1 >= z1);
      return list.reduce((n, b) => n + b.h, 0) / list.length;
    };
    expect(avg(0, -500)).toBeLessThan(avg(-1500, -2000));
  });
});

describe('swinging', () => {
  it('a web catches on the wall ahead, above him, on the side he steers to', () => {
    const g = started();
    g.p[1] = 12; // low enough that any building is tall enough to swing from
    steer(g, -1);
    const w = aimWeb(g);
    expect(w.side).toBe(-1);
    expect(w.a[2]).toBeLessThan(g.p[2]);
    expect(w.a[1]).toBeGreaterThan(g.p[1]);
    expect(w.wall[0]).toBe(-AVENUE.wall);
  });
  it('holding swings him; the rope never stretches; letting go flies him on', () => {
    const g = started();
    press(g);
    let ev = run(g, 0.05);
    expect(types(ev)).toContain('thwip');
    const w = g.web;
    run(g, 0.6, () => expect(Math.hypot(g.p[0] - w.a[0], g.p[1] - w.a[1], g.p[2] - w.a[2])).toBeLessThanOrEqual(w.len + 1e-6));
    release(g);
    ev = run(g, 0.05);
    expect(g.web).toBeNull();
    expect(g.mode).toBe('air');
    expect(g.v[2]).toBeLessThan(0);
  });
  it('letting go on the upswing, past the anchor, is a perfect release: faster', () => {
    const g = started();
    press(g);
    let speed = 0;
    let ev = [];
    for (let t = 0; t < 6 && !ev.length; t += DT) {
      stepRun(g, DT);
      const past = g.web ? Math.atan2(g.web.a[2] - g.p[2], g.web.a[1] - g.p[1]) : 0;
      if (past > 0.45 && g.v[1] > 0) {
        speed = Math.hypot(...g.v);
        release(g);
        ev = stepRun(g, DT);
      }
    }
    expect(types(ev)).toContain('perfect');
    expect(Math.hypot(...g.v)).toBeGreaterThan(speed);
  });
  it('the swing keeps above the street, and the speed keeps under the limit', () => {
    const g = started();
    press(g);
    run(g, 8, (x) => {
      expect(x.p[1]).toBeGreaterThan(RUN.clear - 1.5);
      expect(Math.hypot(...x.v)).toBeLessThanOrEqual(RUN.maxSpeed + 1e-6);
    });
  });
  it('steers across the avenue, and never through the walls', () => {
    const g = started();
    steer(g, 1);
    run(g, 3, (x) => {
      if (!x.web) press(x);
      expect(Math.abs(x.p[0])).toBeLessThan(AVENUE.wall);
    });
    expect(g.p[0]).toBeGreaterThan(3);
  });
});

describe('the street', () => {
  it('costs a heart, and three is the day', () => {
    const g = started();
    let ev = run(g, 4);
    expect(types(ev)).toContain('street');
    expect(g.hearts).toBe(RUN.hearts - 1);
    expect(g.mode).toBe('street');
    // back up off the street on a web
    press(g);
    run(g, 1);
    expect(g.p[1]).toBeGreaterThan(3);
    release(g);
    g.hearts = 1;
    ev = run(g, 6);
    expect(types(ev)).toContain('lost');
    expect(ev.find((e) => e.type === 'lost')).toMatchObject({ why: 'street' });
    expect(g.phase).toBe('lost');
  });
});

describe('the bell', () => {
  it('ends the run as a loss when he does nothing, on every seed: late for school', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const g = started(seed);
      const ev = run(g, BELL + 5);
      expect(g.phase).toBe('lost');
      expect(types(ev)).toContain('bell');
      expect(ev.find((e) => e.type === 'lost')).toMatchObject({ why: 'bell' });
      expect(distance(g)).toBeLessThan(SCHOOL);
      expect(g.t).toBeGreaterThan(BELL);
      expect(g.t).toBeLessThan(BELL + 2 * DT);
    }
  });
  it('still counts school reached in the step the bell goes as made it', () => {
    const g = started(1);
    g.t = BELL - DT / 2;
    g.p = [0, 30, -(SCHOOL - 0.05)];
    g.v = [0, 0, -20];
    const ev = stepRun(g, DT);
    expect(g.t).toBeGreaterThan(BELL);
    expect(g.phase).toBe('won');
    expect(types(ev)).not.toContain('bell');
    expect(ev.find((e) => e.type === 'won')).not.toHaveProperty('onTime');
  });
});

describe('the run to school, on the autopilot', () => {
  it('gets there before the bell, without touching the street, and picks up backpacks on the way', () => {
    const g = started(2);
    const ev = run(g, 200, (x) => pilot(x));
    expect(g.phase).toBe('won');
    expect(distance(g)).toBeGreaterThanOrEqual(SCHOOL);
    expect(g.t).toBeLessThan(BELL);
    expect(g.hearts).toBe(RUN.hearts);
    expect(types(ev).filter((t) => t === 'pack').length).toBeGreaterThan(1);
    expect(g.score).toBeGreaterThan(g.got * PACK.points);
    expect(types(ev).find((t) => t === 'won')).toBeTruthy();
  });
  it('still makes it before the bell, in 45 to 60 s, on seeds 1 to 4', () => {
    for (const seed of [1, 2, 3, 4]) {
      const g = started(seed);
      run(g, BELL + 5, (x) => pilot(x));
      expect(g.phase).toBe('won');
      expect(g.t).toBeGreaterThan(45);
      expect(g.t).toBeLessThan(60);
    }
  }); // measured: 48.4, 54.6, 56.3, 49.2 s
  it('plays the same way twice from the same seed', () => {
    const a = started(3);
    const b = started(3);
    run(a, 30, pilot);
    run(b, 30, pilot);
    expect(a.p).toEqual(b.p);
    expect(a.score).toBe(b.score);
  });
});
