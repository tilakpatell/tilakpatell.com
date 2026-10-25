import { describe, expect, it } from 'vitest';
import { createLockOn } from '../../../lib/combat/lockOn';
import * as R from './interiors/rickall';
import { stepRmLockOn } from './rmLockOn';
import { MORTY } from './rules';
import { SHOT } from './dimensions/duel';

const person = (id, x, z) => ({ id, name: id, r: 0.3, h: 1.8, x, z, parasite: true });
const sim = (extra = {}) => ({ m: { x: 0, z: 0, y: 0, face: 0 }, yaw: -Math.PI / 2, pitch: R.SIGHT.level, ...extra });
const hunter = (x, z) => ({ id: 'evilrick', a: [x, 0.4, z], b: [x, 1.4, z], r: 0.4, side: 'them', ref: 'duel' });

describe('the lock-on in C-137', () => {
  it('in a duel on touch, turns Morty to the hunter within 14 m', () => {
    const lock = createLockOn({ coarse: true });
    const s = sim();
    for (let i = 0; i < 120; i++) stepRmLockOn(lock, s, 1 / 60, { hunter: hunter(0, -6) });
    expect(lock.on).toBe(true);
    expect(s.m.face).toBeCloseTo(Math.PI / 2, 3); // (−z is a heading of π/2)
    const far = sim();
    stepRmLockOn(createLockOn({ coarse: true }), far, 1 / 60, { hunter: hunter(0, -20) });
    expect(far.m.face).toBe(0);
  });

  it('in a duel, keeps Morty facing the hunter as he backs off, strafes or turns away, where the walker would turn him', () => {
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const dt = 1 / 60;
    for (const [dx, dz] of [[0, 1], [1, 0], [0.7, 0.7]]) {
      const lock = createLockOn({ coarse: false });
      lock.toggle();
      const s = sim();
      for (let i = 0; i < 120; i++) {
        // (the walker, rules.js's stepMorty: on along the stick, turned toward it)
        const m = s.m;
        const face = m.face + wrap(Math.atan2(-dz, dx) - m.face) * (1 - Math.exp(-MORTY.turn * dt));
        s.m = { ...m, x: m.x + dx * MORTY.walk * dt, z: m.z + dz * MORTY.walk * dt, face };
        stepRmLockOn(lock, s, dt, { hunter: hunter(0, -6) });
      }
      const want = Math.atan2(-(-6 - s.m.z), 0 - s.m.x);
      expect(Math.abs(wrap(s.m.face - want)), `walking along ${dx}, ${dz}`).toBeLessThan(SHOT.half / 4);
    }
  });

  it('in Total Rickall, by hand, keeps the sights on whoever was in them', () => {
    const lock = createLockOn({ coarse: false });
    lock.toggle();
    const g = { people: [person('a', 5, 3)], shot: [], told: {}, state: 'on', t: 0 };
    const s = sim({ rickall: { phase: 'on', game: g, aim: 'a' } });
    for (let i = 0; i < 180; i++) stepRmLockOn(lock, s, 1 / 60, { R });
    expect(s.lockId).toBe('a');
    expect(R.aimAt(g, R.sight(s.m, s.yaw, s.pitch))).toBe('a');
    // (shot: let go)
    g.shot.push('a');
    s.rickall.aim = null;
    stepRmLockOn(lock, s, 1 / 60, { R });
    expect(s.lockId).toBe(null);
  });
});
