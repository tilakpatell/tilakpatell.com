import { describe, expect, it } from 'vitest';
import { createBattle } from './battle';
import { LIST, place } from './battleCapitals';
import { UP, dot } from './battleKit';
import { SUBSYSTEMS, WARS } from './wars';

// a seeded random, so every run of a battle is the same (battle.test.js's)
const seeded = (seed = 7) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const make = () => createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 8, rand: seeded() });
const flagOf = (b) => b.capitals.find((c) => c.team === 1 && c.role === 'flagship');
// a shot from 2 units off straight through a point
const shotAt = (b, p, damage = 5) => b.hit({ x: p.x, y: p.y + 2, z: p.z }, { x: p.x, y: p.y - 0.01, z: p.z }, damage);
// on, the battle over or not (a listing ship goes on listing)
const run = (b, seconds) => {
  for (let t = 0; t < seconds; t += 1 / 30) b.update(1 / 30, null);
};
// its generators and then its bridge shot away, by you
const bridgeDown = (b, flag) => {
  b.setYou(0);
  for (const g of flag.subs.filter((s) => s.kind === 'shieldgen')) while (g.alive) shotAt(b, g.pos);
  run(b, 0.1);
  const bridge = flag.subs.find((s) => s.kind === 'bridge');
  while (bridge.alive) shotAt(b, bridge.pos);
};

describe('a capital ship whose bridge is gone', () => {
  it('lists: rolls and sinks, slowly, as far as LIST.most, everything on it going with it', () => {
    const b = make();
    const flag = flagOf(b);
    const up = { ...flag.up };
    const y = flag.pos.y;
    bridgeDown(b, flag);
    expect(flag.listed).toBe(0);
    run(b, 4);
    expect(flag.listed).toBeGreaterThan(LIST.roll * 3.5);
    expect(flag.listed).toBeLessThan(LIST.roll * 4.5);
    expect(dot(flag.up, up)).toBeLessThan(Math.cos(LIST.roll * 3));
    expect(flag.pos.y).toBeLessThan(y);
    // (its subsystems where they are on it still, so a shot at the ship as it's drawn finds them)
    const kinds = SUBSYSTEMS[flag.kind];
    for (const s of flag.subs) {
      const at = place(flag, kinds.find((k) => k.id === s.id).at);
      expect(Math.hypot(at.x - s.pos.x, at.y - s.pos.y, at.z - s.pos.z), s.id).toBeLessThan(1e-6);
    }
    run(b, 20);
    expect(flag.listed).toBeCloseTo(LIST.most, 6);
    const now = { ...flag.up };
    run(b, 2);
    expect(dot(flag.up, now)).toBeCloseTo(1, 9);
  });

  it('is left to a set piece that moves it, and a ship with its bridge on doesn’t list', () => {
    const b = make();
    const flag = flagOf(b);
    const escort = b.capitals.find((c) => c.team === 1 && c.role !== 'flagship');
    b.turnCapital(flag, UP, 0); // (held: the Executor's dive, say)
    const up = { ...flag.up };
    bridgeDown(b, flag);
    run(b, 4);
    expect(dot(flag.up, up)).toBeCloseTo(1, 9);
    expect(escort.listed).toBeUndefined();
  });
});
