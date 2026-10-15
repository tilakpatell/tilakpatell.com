import { describe, expect, it } from 'vitest';
import { seeded } from '../seeded.js';
import { loadRulebook, weaponOf } from './rulebook.js';
import { kitWeapon } from './kit.js';
import { PULL_GAP, createGun, dispersionFor, fire, tick } from './weapons.js';

const STEP = 0.05;
// the trigger held from `from` to `to`, a step at a time: the times the bolts leave
function hold(gun, from, to) {
  const out = [];
  for (let i = Math.round(from / STEP); i * STEP < to - 1e-9; i++) {
    const now = i * STEP;
    tick(gun, STEP, now);
    for (const shot of fire(gun, now) ?? []) out.push(shot.at);
  }
  return out;
}
const idle = (gun, from, to) => {
  for (let i = Math.round(from / STEP); i * STEP < to - 1e-9; i++) tick(gun, STEP, i * STEP);
};

describe('the gun’s rate and the sentry’s barrel (findings 33 and 34)', () => {
  it('keeps the record’s rate between the sim’s steps: 900 rpm is fifteen bolts a second, 300 five', () => {
    const cool = { ...kitWeapon('sentry'), heat: null, firing: { ...kitWeapon('sentry').firing, preFire: 0 } };
    expect(hold(createGun(cool, { rand: seeded(1) }), 0, 4)).toHaveLength(60);
    const rb = loadRulebook();
    expect(hold(createGun({ ...weaponOf(rb, 'a280'), heat: null }, { rand: seeded(1) }), 0, 4)).toHaveLength(20);
    // (700 rpm, a rate no step divides)
    expect(hold(createGun({ ...weaponOf(rb, 'tl50'), heat: null }, { rand: seeded(1) }), 0, 6)).toHaveLength(70);
  });

  it('owes nothing for the time the trigger was up', () => {
    const cool = { ...kitWeapon('sentry'), heat: null, firing: { ...kitWeapon('sentry').firing, preFire: 0 } };
    const gun = createGun(cool, { rand: seeded(1) });
    hold(gun, 0, 1);
    idle(gun, 1, 3);
    // (one bolt at the pull, not the thirty the pause would have held)
    expect(hold(gun, 3, 3.05)).toHaveLength(1);
  });

  it('spins the sentry up for a second before its first bolt, and less from a barrel still turning', () => {
    const gun = createGun(kitWeapon('sentry'), { rand: seeded(1) });
    const first = hold(gun, 0, 2);
    expect(first[0]).toBeCloseTo(1, 9);
    expect(gun.spin).toBe(1);
    // (the trigger up for a second: ChargeUpDecrease 0.5 leaves half the spin, so half the wait)
    idle(gun, 2, 3);
    expect(gun.spin).toBeGreaterThan(0.5);
    expect(gun.spin).toBeLessThan(0.5 + PULL_GAP);
    const again = hold(gun, 3, 5);
    expect(again[0] - 3).toBeGreaterThan(0.4);
    expect(again[0] - 3).toBeLessThan(0.6);
    // (and from cold again after three)
    idle(gun, 5, 8);
    expect(gun.spin).toBe(0);
    expect(hold(gun, 8, 10)[0] - 8).toBeCloseTo(1, 9);
  });

  it('tightens the sentry’s cone from 1° to 0.5° over five bolts, and opens it again 2° a second with the trigger up', () => {
    const gun = createGun(kitWeapon('sentry'), { rand: seeded(1) });
    const deg = () => (dispersionFor(gun) * 180) / Math.PI;
    expect(deg()).toBeCloseTo(1, 9);
    hold(gun, 0, 1.05);
    expect(deg()).toBeCloseTo(0.9, 9);
    hold(gun, 1.05, 1.4);
    expect(deg()).toBeCloseTo(0.5, 9);
    hold(gun, 1.4, 3);
    expect(deg()).toBeCloseTo(0.5, 9);
    // (0.2 s without a bolt, then 2° a second: back at 1° a quarter of a second after that)
    idle(gun, 3, 3.3);
    expect(deg()).toBeGreaterThan(0.5);
    expect(deg()).toBeLessThan(1);
    idle(gun, 3.3, 3.6);
    expect(deg()).toBeCloseTo(1, 9);
  });

  it('ends the sentry’s bar at 286 bolts: 0.0035 a bolt with no fall while it is out', () => {
    const gun = createGun(kitWeapon('sentry'), { rand: seeded(1) });
    // (to the overheat and no further: the kit ends the ability there, kit.js)
    const shots = hold(gun, 0, 21);
    expect(shots).toHaveLength(286);
    expect(shots.at(-1) - shots[0]).toBeCloseTo(19, 1);
    expect(gun.state).toBe('overheated');
  });
});
