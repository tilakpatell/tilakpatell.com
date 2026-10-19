import { describe, expect, it } from 'vitest';
import { AREAS, CRUISER, floorAt } from '../rules';
import { COURSE, SAYS, TUNING, chaseGoal, chaseReadout, chaseStart, newChase, shaken, stepChase } from './chase';

const DT = 1 / 60;
const types = (g) => g.events.map((e) => e.type);
// the cruiser `back` metres before a ring, on its way through (or the other way: `way` -1)
const before = (ring, back = 1, way = 1) => ({ x: ring.x - Math.sin(ring.yaw) * back * way, y: ring.y, z: ring.z - Math.cos(ring.yaw) * back * way });
// flown from a to b in half-metre steps (a step each frame), the events gathered
const fly = (g, a, b, input = {}) => {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.5));
  const seen = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    g = stepChase(g, { flying: true, ...input, at: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k } }, DT);
    seen.push(...g.events);
  }
  return { g, seen };
};
// through ring i on its way (1 m before it to just past: the pass on the last step)
const through = (g, i, input, way = 1) => fly(g, before(g.rings[i], 1, way), before(g.rings[i], -0.3, way), input);

describe('the chase kind: shake the Federation ship through the rings', () => {
  it('waits, with no run, till the cruiser flies through the first ring', () => {
    const g = newChase();
    expect(g).toMatchObject({ phase: 'idle', rings: COURSE, max: TUNING.hits, next: 0, hits: 0, t: 0, rest: 0, at: null, events: [] });
    // through the second ring first: nothing
    expect(through(g, 1).g.phase).toBe('idle');
  });

  it('starts the run at the first ring while flying, with a patrol up to shake', () => {
    const { g, seen } = through(newChase(), 0);
    expect(g).toMatchObject({ phase: 'run', next: 1, hits: 0 });
    expect(seen).toEqual([{ type: 'start' }, { type: 'ring', n: 0 }]);
    // on foot (or set down), nothing
    const walked = fly(newChase(), before(COURSE[0]), before(COURSE[0], -1), { flying: false });
    expect(walked.g.phase).toBe('idle');
  });

  it('says there’s nothing to shake when the patrol’s down, and starts nothing', () => {
    const { g, seen } = through(newChase(), 0, { down: true });
    expect(g.phase).toBe('idle');
    expect(seen).toEqual([{ type: 'wait' }]);
  });

  it('takes the rings in order, either way through, and not a jump past one', () => {
    let { g } = through(newChase(), 0);
    // the fourth ring before the second: nothing
    g = through(g, 3).g;
    expect(g.next).toBe(1);
    // the second ring the wrong way round still counts
    const back = through(g, 1, {}, -1);
    expect(back.g.next).toBe(2);
    expect(back.seen).toEqual([{ type: 'ring', n: 1 }]);
    // a portal's jump from 4 m before the third to 4 m past it isn't a pass
    let j = stepChase(back.g, { flying: true, at: before(COURSE[2], 4) }, DT);
    j = stepChase(j, { flying: true, at: before(COURSE[2], -4) }, DT);
    expect(j.next).toBe(2);
    // and a pass wide of the ring isn't one
    const wide = (p) => ({ ...p, y: p.y + TUNING.r + 0.5 });
    expect(fly(back.g, wide(before(COURSE[2])), wide(before(COURSE[2], -1))).g.next).toBe(2);
  });

  it('is won through the last ring, with the run’s time, and the patrol kept off a while', () => {
    let { g } = through(newChase(), 0);
    for (let i = 1; i < COURSE.length - 1; i++) g = through(g, i).g;
    const last = through(g, COURSE.length - 1);
    expect(last.g.phase).toBe('won');
    expect(last.seen.at(-1)).toEqual({ type: 'won', t: last.g.t });
    expect(last.g.t).toBeGreaterThan(0);
    expect(shaken(last.g)).toBe(true);
    // the next step: the first ring again; the rest runs out in its seconds
    const after = stepChase(last.g, { flying: true, at: last.g.at }, 1);
    expect(after).toMatchObject({ phase: 'idle', next: 0, hits: 0, t: 0 });
    expect(after.rest).toBeCloseTo(TUNING.rest - 1, 5);
    expect(shaken(stepChase(after, { flying: true, at: after.at }, TUNING.rest))).toBe(false);
    // a run started again ends the rest
    expect(shaken(through(after, 0).g)).toBe(false);
  });

  it('counts the patrol’s hits, and is lost once at three, then back to the first ring', () => {
    let { g } = through(newChase(), 0);
    g = stepChase(g, { flying: true, at: g.at, hit: 1 }, DT);
    expect(g.events).toEqual([{ type: 'hit', left: 2 }]);
    g = stepChase(g, { flying: true, at: g.at, hit: 2 }, DT);
    expect(g.phase).toBe('lost');
    expect(types(g)).toEqual(['hit', 'hit', 'lost']);
    const next = stepChase(g, { flying: true, at: g.at, hit: 1 }, DT);
    expect(next).toMatchObject({ phase: 'idle', next: 0, hits: 0 });
    expect(next.events).toEqual([]);
  });

  it('is lost when the deflectors go and the engines cut', () => {
    const { g } = through(newChase(), 0);
    const down = stepChase(g, { flying: true, at: g.at, grounded: true }, DT);
    expect(down.phase).toBe('lost');
    expect(types(down)).toEqual(['lost']);
  });

  it('ends quietly when the cruiser lands, or the patrol goes down', () => {
    const { g } = through(newChase(), 0);
    const landed = stepChase(g, { flying: false, at: g.at }, DT);
    expect(landed).toMatchObject({ phase: 'idle', next: 0 });
    expect(landed.events).toEqual([{ type: 'off' }]);
    expect(stepChase(g, { flying: true, at: g.at, down: true }, DT).events).toEqual([{ type: 'off' }]);
    // idle, landing says nothing
    expect(stepChase(newChase(), { flying: false, at: COURSE[0] }, DT).events).toEqual([]);
  });

  it('keeps the run’s time while it’s on, and none while it waits', () => {
    const { g } = through(newChase(), 0);
    expect(stepChase(g, { flying: true, at: g.at }, 0.5).t).toBeCloseTo(g.t + 0.5, 5);
    expect(stepChase(newChase(), { flying: true, at: COURSE[3] }, 0.5).t).toBe(0);
  });

  it('takes perks and, until the shop decides what they do here, reads none', () => {
    expect(newChase({ perks: { slow: 3 } })).toEqual(newChase());
  });

  it('reads out for the HUD only while the run’s on', () => {
    const { g } = through(newChase(), 0);
    expect(chaseReadout(g)).toEqual({ on: true, vitals: { value: 3, max: 3, low: false }, line: 'Ring 2 of 6, 3 hits left' });
    const hit = { ...g, hits: 2 };
    expect(chaseReadout(hit)).toEqual({ on: true, vitals: { value: 1, max: 3, low: true }, line: 'Ring 2 of 6, 1 hit left' });
    expect(chaseReadout(newChase())).toEqual({ on: false, vitals: null, line: '' });
    expect(chaseReadout(null)).toEqual({ on: false, vitals: null, line: '' });
  });

  it('points the map at the next ring', () => {
    expect(chaseGoal(newChase())).toEqual({ x: COURSE[0].x, z: COURSE[0].z });
    expect(chaseGoal(through(newChase(), 0).g)).toEqual({ x: COURSE[1].x, z: COURSE[1].z });
    expect(chaseGoal(null)).toBe(null);
  });

  it('starts a retry twelve metres before the first ring, facing through it', () => {
    const s = chaseStart(newChase());
    const r = COURSE[0];
    expect(s.yaw).toBe(r.yaw);
    expect(s.y).toBe(r.y);
    expect(Math.hypot(s.x - r.x, s.z - r.z)).toBeCloseTo(12, 5);
    // on its way through: the ring is ahead of the nose
    expect((r.x - s.x) * Math.sin(s.yaw) + (r.z - s.z) * Math.cos(s.yaw)).toBeCloseTo(12, 5);
  });

  it('has its words, one sentence each', () => {
    for (const line of Object.values(SAYS)) {
      expect(line).not.toMatch(/!/);
      expect(line.split(/[.?]\s/)).toHaveLength(1);
    }
  });
});

describe('the chase’s course over the street', () => {
  // the patrol keeps 4 m inside the street (./ship.js), and flies no lower than 8 m
  const s = AREAS.street;
  it('keeps every ring where the patrol can follow', () => {
    for (const [i, r] of COURSE.entries()) {
      expect(r.x, `ring ${i}`).toBeGreaterThanOrEqual(s.x0 + 4);
      expect(r.x, `ring ${i}`).toBeLessThanOrEqual(s.x1 - 4);
      expect(r.z, `ring ${i}`).toBeGreaterThanOrEqual(s.z0 + 4);
      expect(r.z, `ring ${i}`).toBeLessThanOrEqual(s.z1 - 4);
      expect(r.y + TUNING.r, `ring ${i}`).toBeLessThan(CRUISER.ceiling);
    }
    expect(Math.min(...COURSE.map((r) => r.y))).toBeGreaterThanOrEqual(8);
  });

  it('buries no ring in a roof or the road', () => {
    for (const [i, r] of COURSE.entries()) {
      // across the ring, its lowest point at each place over the ground
      for (let u = -TUNING.r; u <= TUNING.r; u += 0.5) {
        const x = r.x + Math.cos(r.yaw) * u;
        const z = r.z - Math.sin(r.yaw) * u;
        expect(r.y - Math.sqrt(TUNING.r ** 2 - u ** 2), `ring ${i} at ${u}`).toBeGreaterThan(floorAt(x, z));
      }
    }
  });

  it('is six rings, each a fair flight from the last', () => {
    expect(COURSE).toHaveLength(6);
    for (let i = 1; i < COURSE.length; i++) {
      const d = Math.hypot(COURSE[i].x - COURSE[i - 1].x, COURSE[i].z - COURSE[i - 1].z);
      expect(d, `leg ${i}`).toBeGreaterThan(40);
      expect(d, `leg ${i}`).toBeLessThan(100);
    }
  });
});
