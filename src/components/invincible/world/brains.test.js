import { describe, expect, it } from 'vitest';
import { seeded } from '../../../lib/seeded';
import { WALK } from './traffic';
import { crowdCount, newBrain, poseOf, stepBrain } from './brains';

const FAR = [5000, 0, 5000];
const sense = (o = {}) => ({ hero: FAR, heroMode: 'air', heroSpeed: 0, slam: null, hit: null, fight: false, won: false, time: 'noon', ...o });
// run a brain for `secs` at 1/30 s steps
function run(b, secs, s = sense(), r = seeded(3)) {
  for (let t = 0; t < secs; t += 1 / 30) b = stepBrain(b, typeof s === 'function' ? s(b, t) : s, 1 / 30, r);
  return b;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('a passer-by', () => {
  it('wanders along their pavement, never more than 20 m from home', () => {
    // a walker on the pavement of the E–W street at z = 40, its south side
    let b = newBrain({ home: [100, 40 + WALK], yaw: 0, walk: { axis: 'x', line: 40, side: 1 } });
    let moved = 0;
    const r = seeded(9);
    for (let i = 0; i < 30 * 120; i++) {
      const was = b.at;
      b = stepBrain(b, sense(), 1 / 30, r);
      moved += dist(was, b.at);
      expect(Math.abs(b.at[1] - (40 + WALK))).toBeLessThan(1e-6);
      expect(Math.abs(b.at[0] - 100)).toBeLessThanOrEqual(20 + 1e-6);
    }
    expect(moved).toBeGreaterThan(10); // (it did wander)
  });

  it('runs from a slam 30 m off at 4 m/s for 6 s, then stands, still afraid', () => {
    let b = newBrain({ home: [0, 0], yaw: 0 });
    b = stepBrain(b, sense({ slam: [30, 0] }), 1 / 30, seeded(1));
    expect(b.state).toBe('flee');
    const start = b.at;
    b = run(b, 2.9);
    expect(b.state).toBe('flee');
    expect(b.at[0]).toBeLessThan(start[0]); // (away from it)
    expect(dist(b.at, start)).toBeCloseTo(4 * 3, 0);
    b = run(b, 3.5);
    expect(b.state).not.toBe('flee');
    expect(b.fear).toBeGreaterThan(0);
  });

  it('runs from a car he carries over them, as from one thrown', () => {
    let b = newBrain({ home: [0, 0], yaw: 0 });
    b = stepBrain(b, sense({ carried: [20, 0] }), 1 / 30, seeded(1));
    expect(b.state).toBe('flee');
    expect(stepBrain(newBrain({ home: [0, 0], yaw: 0 }), sense({ carried: [90, 0] }), 1 / 30, seeded(1)).state).not.toBe('flee');
  });
  it('gathers round him when he lands 10 m off: 4–8 m from him, facing him; leaves after 12 s', () => {
    let b = newBrain({ home: [0, 0], yaw: 0 });
    const s = sense({ hero: [10, 0, 0], heroMode: 'ground' });
    b = run(b, 4, s);
    expect(b.state).toBe('gather');
    const d = dist(b.at, [10, 0]);
    expect(d).toBeGreaterThanOrEqual(4);
    expect(d).toBeLessThanOrEqual(8);
    const want = Math.atan2(10 - b.at[0], 0 - b.at[1]);
    expect(Math.abs(Math.atan2(Math.sin(b.yaw - want), Math.cos(b.yaw - want)))).toBeLessThan(0.3);
    b = run(b, 9, s);
    expect(b.state).not.toBe('gather');
  });

  it('leaves the gathering when he takes off', () => {
    let b = run(newBrain({ home: [0, 0], yaw: 0 }), 3, sense({ hero: [10, 0, 0], heroMode: 'ground' }));
    expect(b.state).toBe('gather');
    b = run(b, 0.5, sense({ hero: [10, 30, 0], heroMode: 'air', heroSpeed: 20 }));
    expect(b.state).not.toBe('gather');
  });

  it('does not gather while afraid', () => {
    let b = stepBrain(newBrain({ home: [0, 0], yaw: 0 }), sense({ slam: [20, 0] }), 1 / 30, seeded(2));
    b = run(b, 7); // (done running, still afraid)
    b = run(b, 2, sense({ hero: [8, 0, 0], heroMode: 'ground' }));
    expect(b.state).not.toBe('gather');
  });

  it('waves when he hovers within 15 m', () => {
    const b = run(newBrain({ home: [0, 0], yaw: 0 }), 0.5, sense({ hero: [8, 6, 0], heroMode: 'air', heroSpeed: 0 }));
    expect(b.state).toBe('wave');
    expect(poseOf(b)).toBe('wave');
  });

  it('cheers for 4 s when a fight is won within 80 m', () => {
    let b = stepBrain(newBrain({ home: [0, 0], yaw: 0 }), sense({ hero: [50, 20, 0], won: true }), 1 / 30, seeded(4));
    expect(b.state).toBe('cheer');
    b = run(b, 3.5, sense({ hero: [50, 20, 0] }));
    expect(b.state).toBe('cheer');
    b = run(b, 1, sense({ hero: [50, 20, 0] }));
    expect(b.state).not.toBe('cheer');
  });

  it('takes a minute away as one short step (a hidden tab)', () => {
    const b0 = stepBrain(newBrain({ home: [0, 0], yaw: 0 }), sense({ slam: [30, 0] }), 1 / 30, seeded(5));
    const b1 = stepBrain(b0, sense(), 60, seeded(5));
    expect(dist(b0.at, b1.at)).toBeLessThanOrEqual(4 * 0.05 + 1e-9);
    expect(b1.at.every(Number.isFinite)).toBe(true);
  });

  it('poses by what it is doing', () => {
    expect(poseOf({ state: 'wander' })).toBe('walk');
    expect(poseOf({ state: 'flee' })).toBe('run');
    expect(poseOf({ state: 'gather' })).toBe('phone');
    expect(poseOf({ state: 'chat' })).toBe('talk');
    expect(poseOf({ state: 'cheer' })).toBe('cheer');
    expect(poseOf({ state: 'idle' })).toBe('idle');
  });
});

describe('how many are out', () => {
  it('thins out at dusk and night, and nobody sits on the school steps at night', () => {
    expect(crowdCount(6, 'noon')).toBe(6);
    expect(crowdCount(6, 'dusk')).toBe(4);
    expect(crowdCount(6, 'night')).toBe(2);
    expect(crowdCount(4, 'night', { school: true })).toBe(0);
  });
});
