import { describe, expect, it } from 'vitest';
import { IN_COMBAT, OFFSETS, SPAWN_PROTECTION, SQUAD_SAFE, WAVE, blocked, isProtected, pickSpawn, protect, squadSpawn, waves } from './spawn.js';
import { loadRulebook, squadsOf } from './rulebook.js';

const area = (id, x0, z0, x1, z1) => ({ id, mode: 'galacticAssault', team: 1, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y: 0 });
const point = (id, x, z, priority) => ({ id, mode: 'galacticAssault', team: 1, priority, enabled: false, at: [x, 0, z], yaw: 0.5 });
const map = () => ({
  polygons: [area('A', 0, 0, 100, 100)],
  spawns: [point('hi', 10, 10, 2), point('lo', 80, 80, 1), point('out', 200, 200, 3), { ...point('them', 50, 50, 5), team: 2 }],
});

describe('spawning', () => {
  it('takes the highest priority point inside the set', () => {
    expect(pickSpawn({ map: map(), ids: ['A'], team: 1, rand: () => 0 }).at).toEqual([10, 0, 10]);
  });

  it('picks a lower-priority safe point over a high one with an enemy 10 m off', () => {
    const s = pickSpawn({ map: map(), ids: ['A'], team: 1, enemies: [[10, 20]], rand: () => 0 });
    expect(s.at).toEqual([80, 0, 80]);
    expect(s.yaw).toBe(0.5);
  });

  it('no safe point still spawns', () => {
    const enemies = [[10, 10], [80, 80]];
    const s = pickSpawn({ map: map(), ids: ['A'], team: 1, enemies });
    expect(s).not.toBe(null);
    const d = Math.min(...enemies.map((e) => Math.hypot(e[0] - s.at[0], e[1] - s.at[2])));
    expect(d).toBeGreaterThan(50);
  });

  it('returns null only for a set with nothing in it', () => {
    expect(pickSpawn({ map: map(), ids: ['nope'], team: 1 })).toBe(null);
  });

  it('spawns behind a squadmate out of contact, and not on one in contact', () => {
    const mate = { id: 'm', kind: 'soldier', alive: true, at: [0, 0, 0], yaw: 0, suppressed: 0 };
    const s = squadSpawn({ squad: [mate], me: 'me', enemies: [[0, SQUAD_SAFE + 5]] });
    // (the friendly position table's first spot: 3 m behind the mate)
    expect(s.at[2]).toBeCloseTo(-3, 6);
    expect(s.mate).toBe('m');
    expect(squadSpawn({ squad: [mate], me: 'me', enemies: [[0, 10]] })).toBe(null);
    expect(squadSpawn({ squad: [{ ...mate, suppressed: 0.5 }], me: 'me', enemies: [] })).toBe(null);
  });

  it('lands at the record’s first offset, turned by the mate’s yaw', () => {
    expect(OFFSETS).toEqual(squadsOf(loadRulebook()).offsets);
    const mate = { id: 'm', kind: 'soldier', alive: true, at: [10, 2, 10], yaw: Math.PI / 2, suppressed: 0 };
    const s = squadSpawn({ squad: [mate], me: 'me' });
    // (facing +X, behind is −X)
    expect(s.at[0]).toBeCloseTo(7, 6);
    expect(s.at[1]).toBe(2);
    expect(s.at[2]).toBeCloseTo(10, 6);
    expect(s.yaw).toBe(Math.PI / 2);
  });

  it('skips an offset that is not walkable for the next', () => {
    const mate = { id: 'm', kind: 'soldier', alive: true, at: [0, 0, 0], yaw: 0, suppressed: 0 };
    const s = squadSpawn({ squad: [mate], me: 'me', walkable: (x, z) => z > -2.5 || x > 0 });
    // (the table's second, (−1.6, −2.25), is 1.6 m to the mate's left: +X at yaw 0, the right being −X)
    expect(s.at[0]).toBeCloseTo(1.6, 6);
    expect(s.at[2]).toBeCloseTo(-2.25, 6);
    expect(squadSpawn({ squad: [mate], me: 'me', walkable: () => false })).toBe(null);
  });

  it('blocks a mate in combat, out of bounds, down or in the air, and spawns on none then', () => {
    const mate = { id: 'm', kind: 'soldier', alive: true, at: [0, 0, 0], yaw: 0, suppressed: 0, cls: { cls: 'assault' } };
    expect(blocked(mate, { now: 10 })).toBe(null);
    expect(blocked({ ...mate, combatAt: 10 - IN_COMBAT + 0.5 }, { now: 10 })).toBe('combat');
    expect(blocked({ ...mate, combatAt: 10 - IN_COMBAT }, { now: 10 })).toBe(null);
    expect(blocked(mate, { enemies: [[0, SQUAD_SAFE - 1]], now: 10 })).toBe('combat');
    expect(blocked({ ...mate, oobSince: 3 }, { now: 10 })).toBe('oob');
    expect(blocked({ ...mate, alive: false }, { now: 10 })).toBe('dead');
    expect(blocked(null, { now: 10 })).toBe('none');
    expect(blocked({ ...mate, cls: { cls: 'aerial' } }, { now: 10 })).toBe('airborne');
    const squad = [{ ...mate, combatAt: 9.5 }, { ...mate, id: 'n', oobSince: 1 }];
    expect(squadSpawn({ squad, me: 'me', now: 10 })).toBe(null);
  });

  it('keeps a squad spawn the record’s safe enemy distance from every enemy, not the points’ hand 30 m', () => {
    expect(SQUAD_SAFE).toBe(squadsOf(loadRulebook()).safeEnemyDistance);
    const mate = { id: 'm', kind: 'soldier', alive: true, at: [0, 0, 0], yaw: 0, suppressed: 0, cls: { cls: 'assault' } };
    // (an enemy 40 m off: clear of the hand 30, inside the record's 50)
    expect(blocked(mate, { enemies: [[0, 40]], now: 10 })).toBe('combat');
    expect(squadSpawn({ squad: [mate], me: 'me', enemies: [[0, 40]], now: 10 })).toBe(null);
    expect(blocked(mate, { enemies: [[0, SQUAD_SAFE]], now: 10 })).toBe(null);
  });

  it('protects a fresh soldier for a while', () => {
    const e = {};
    protect(e, 10);
    expect(isProtected(e, 10 + SPAWN_PROTECTION - 0.1)).toBe(true);
    expect(isProtected(e, 10 + SPAWN_PROTECTION)).toBe(false);
  });

  it('brings bots back on the wave', () => {
    expect(waves(0)).toBe(0);
    expect(waves(0.1)).toBe(WAVE);
    expect(waves(WAVE)).toBe(WAVE);
  });
});
