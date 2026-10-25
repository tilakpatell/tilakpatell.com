import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGuns } from '../../lib/combat/flight/guns';
import { WEAPONS } from './weapons';
import { createUniqueArms } from './uniqueArms';

const v = (x, y, z) => ({ x, y, z });
// a source a shot is offered to, as the scene's are: what it saw, and what it took (a shot ending within `size` of it)
const src = (id, at, size, kind) => {
  const seen = [];
  const took = [];
  const fn = (from, to, shot) => (seen.push({ ...shot }), Math.hypot(to.x - at.x, to.y - at.y, to.z - at.z) <= size && (took.push({ ...shot }), true));
  return Object.assign(fn, { t: { id, kind, at, size }, seen, took });
};
const fire = (S, id, speed, punch, s = 0, lock = null) => {
  const guns = createGuns({ count: 4, point: () => new THREE.Vector3() });
  const arms = createUniqueArms({ parent: new THREE.Group(), foes: () => S.map((x) => x.t), bolts: { fire() {} }, flashes: { at() {} }, state: { ship: v(0, 0, 0), lockTarget: lock }, emit() {}, strike: (from, to, shot) => guns.strike(from, to, shot, S), reduced: true });
  arms.fire(id, v(0, 0, 0), [0, 0, -1], speed, WEAPONS[id], punch);
  for (let t = 0; t < s; t += 0.1) arms.frame(0.1);
  return S;
};

describe('the unique arms reach what a bolt does (B10)', () => {
  it('seismic: the Citadel heavy, a rock, a skirmish ship', () => {
    const [hunter, skirm, gen, rock] = fire([src('h:1', v(0, 0, -60), 0.3), src('sk:1', v(0, 0, 5), 0.3), src('cit:g0', v(3, 0, 1.2), 2), src('rock:1', v(-3, 0, 1.2), 0.5)], 'seismic', 6, 9, 1.3);
    expect(gen.took).toEqual([{ punch: 9, damage: 0, heavy: true, warPunch: 9, v: expect.any(Array) }]);
    expect([rock.took.length, skirm.took.length, hunter.took.length, hunter.seen.length]).toEqual([1, 1, 0, 3]);
    for (const s of [hunter, skirm, gen, rock].flatMap((x) => x.seen)) expect([typeof s.punch, typeof s.damage, typeof s.warPunch, typeof s.heavy, s.v.length]).toEqual(['number', 'number', 'number', 'boolean', 3]);
  });
  it('the arc: a front lock light, an objective at the cut', () => {
    const S = [src('front:7', v(0, 0, -20), 0.4), src('front:t1', v(6, 0, -20), 0.6, 'turret')];
    const [front, turret] = fire(S, 'energon', 60, 2.4, 0, S[0].t);
    expect(front.took).toEqual([{ punch: 2.4, damage: 0, heavy: false, warPunch: 2.4, v: expect.any(Array) }]);
    expect([turret.took[0].punch, turret.took[0].warPunch].map((x) => +x.toFixed(12))).toEqual([1.68, 0.84]);
  });
  it('a Blue sky round lands heavy on the Citadel', () => {
    const [gen] = fire([src('cit:g1', v(0, 0, -8), 2)], 'crystal', 33, 3, 0.5);
    expect(gen.took[0]).toEqual({ punch: 3, damage: 0, heavy: true, warPunch: 1.5, v: [0, 0, -33] });
  });
});
