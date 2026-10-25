import { describe, expect, it } from 'vitest';
import { CADENCE, createGuns, gunsUnder, pace } from './guns';
import { aimAngles } from './targeting';

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

const point = () => ({ x: 0, y: 0, z: 0, own: true }); // (the scenes': () => new THREE.Vector3())
const AT = { x: 1, y: 2, z: 3 };
const AHEAD = [0, 0, -1];
const LINE = { life: 1, punch: 2, damage: 7, scale: 1.5 };
const taker = (log, name, takes = false) => (from, to, shot) => (log.push({ name, from, to, z: [from.z, to.z], shot }), takes ? { name } : null);

describe('createGuns', () => {
  it('fires a bolt a direction from a copy of at; a full pool takes slot 0', () => {
    const SLANT = [0.48, 0.6, -0.64];
    const guns = createGuns({ count: 2, point });
    guns.fire(AT, [AHEAD, SLANT], 10, LINE);
    const [a, b] = guns.bolts;
    expect(a).toMatchObject({ on: true, fresh: true, life: 1, punch: 2, damage: 7, heavy: false, warPunch: 2, scale: 1.5, at: { ...AT, own: true }, v: [0, 0, -10] });
    expect(b.v.map((x) => +x.toFixed(9))).toEqual([4.8, 6, -6.4]);
    expect([b.heading, b.pitch]).toEqual([aimAngles(SLANT).heading, aimAngles(SLANT).pitch]);
    guns.fire({ x: 9, y: 9, z: 9 }, [AHEAD], 5, { ...LINE, punch: 3, heavy: true });
    expect([a.punch, a.at.x, a.heavy, b.punch]).toEqual([3, 9, true, 2]);
  });
  it('steps by v·dt through the sources in order till one takes it, and spends its life', () => {
    const log = [];
    const guns = createGuns({ count: 1, point });
    guns.fire(AT, [AHEAD], 10, LINE);
    const [b] = guns.bolts;
    expect(guns.step(0.25, [])).toBe(true);
    expect([b.from, b.at, b.life]).toMatchObject([AT, { x: 1, y: 2, z: 0.5 }, 0.75]);
    const sources = [taker(log, 'stim'), taker(log, 'hunter'), taker(log, 'citadel', true), taker(log, 'rock', true)];
    expect(guns.step(0.1, sources)).toBe(true);
    expect(log.map((e) => e.name)).toEqual(['stim', 'hunter', 'citadel']);
    expect(log[0].z).toEqual([0.5, -0.5]);
    expect(log.every((e) => e.from === b.from && e.to === b.at && e.shot === b)).toBe(true);
    expect([b.on, guns.step(0.1, sources), log.length]).toEqual([false, false, 3]);
    guns.fire(AT, [AHEAD], 10, LINE);
    expect([guns.step(1, []), b.on, b.at.z]).toEqual([false, false, 3]);
  });
  it('strike hands on copies of from, to and a whole shot; null when none takes it', () => {
    const guns = createGuns({ count: 1, point });
    let seen = null;
    const look = (f, t, s) => ((seen = { f, t, s: { ...s, v: [...s.v] } }), null);
    expect(guns.strike({ x: 0, y: 0, z: 0 }, AT, { punch: 4 }, [look, () => ({ name: 'traffic' }), () => ({ name: 'rock' })])).toEqual({ name: 'traffic' });
    expect(seen).toEqual({ f: { x: 0, y: 0, z: 0, own: true }, t: { ...AT, own: true }, s: { punch: 4, damage: undefined, v: [1, 2, 3], heavy: false, warPunch: 4 } });
    const v = [0, 0, 0];
    expect(guns.strike(point(), AT, { punch: 2, damage: 5, v, heavy: true, warPunch: 1 }, [(f, t, s) => ((seen = s), null)])).toBeNull();
    expect(seen).toEqual({ punch: 2, damage: 5, v: [0, 0, 0], heavy: true, warPunch: 1 });
    expect(seen.v).not.toBe(v);
  });
  it('makes its slots and points once, and clear lets every bolt go', () => {
    let made = 0;
    const guns = createGuns({ count: 2, point: () => (made++, point()) });
    const held = guns.bolts.flatMap((b) => [b, b.at, b.from, b.v]);
    guns.fire(AT, [AHEAD, AHEAD], 10, LINE);
    guns.step(0.1, []);
    guns.strike(AT, point(), { punch: 1 }, []);
    guns.clear();
    expect([made, guns.bolts.some((b) => b.on), guns.step(0.1, [])]).toEqual([6, false, false]);
    expect(guns.bolts.flatMap((b) => [b, b.at, b.from, b.v]).every((p, i) => p === held[i])).toBe(true);
  });
});
