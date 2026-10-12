import { describe, expect, it } from 'vitest';
import { ATTEMPT_OFFSET, FINDER, IN_COMBAT, NEAR_RADIUS, OFFSETS, SAFE, SPAWN_PROTECTION, SQUAD_SAFE, WAVE, blocked, createMemory, isProtected, pickSpawn, protect, remember, scoreSpot, squadSpawn, waves } from './spawn.js';
import { loadRulebook, squadsOf } from './rulebook.js';

const area = (id, x0, z0, x1, z1) => ({ id, mode: 'galacticAssault', team: 1, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y: 0 });
const point = (id, x, z, priority, yaw = 0.5) => ({ id, mode: 'galacticAssault', team: 1, priority, enabled: false, at: [x, 0, z], yaw });
const map = () => ({
  polygons: [area('A', 0, 0, 200, 200)],
  spawns: [point('hi', 10, 10, 2), point('lo', 150, 150, 1), point('out', 300, 300, 3), { ...point('them', 100, 100, 5), team: 2 }],
});

describe('spawning', () => {
  it('reads the finder’s weights from the record', () => {
    expect(FINDER).toBe(squadsOf(loadRulebook()).finder);
    expect(FINDER).toMatchObject({ friendlyWeight: -1, enemyWeight: -2, deathWeight: -50, spawnWeight: -100, deathRemember: 10, spawnRemember: 10, directionThreshold: 0.5, directionRange: 200 });
    expect(SAFE).toBe(50);
  });

  it('takes the highest priority point inside the set', () => {
    expect(pickSpawn({ map: map(), ids: ['A'], team: 1, rand: () => 0 }).at).toEqual([10, 0, 10]);
  });

  it('rejects a point with an enemy inside the safe distance, taking a lower priority one', () => {
    const s = pickSpawn({ map: map(), ids: ['A'], team: 1, enemies: [[10, 10 + SAFE - 1]], rand: () => 0 });
    expect(s.at).toEqual([150, 0, 150]);
    expect(s.yaw).toBe(0.5);
    expect(scoreSpot([10, 10], { enemies: [[10, 10 + SAFE - 1]] })).toBe(-Infinity);
    expect(scoreSpot([10, 10], { enemies: [[10, 10 + SAFE]] })).toBe(0);
  });

  it('weighs what is near a spot: a death −50, a spawn −100, a friendly −1, an enemy −2', () => {
    const memory = createMemory();
    remember(memory, 'death', [12, 12], 5);
    remember(memory, 'spawn', [12, 12], 5);
    expect(scoreSpot([10, 10], { memory, now: 6, friendlies: [[10, 15], [10, 10 + NEAR_RADIUS + 1]], enemies: [[10, 10 + SAFE + 1]] })).toBe(-151);
    expect(scoreSpot([10, 10], { memory, now: 6, enemies: [[10, 10 + NEAR_RADIUS - 1]] })).toBe(-Infinity);
    // forgotten after their durations
    expect(scoreSpot([10, 10], { memory, now: 5 + FINDER.deathRemember + 0.1 })).toBe(0);
  });

  it('spawns away from a recent death with the same priority on offer', () => {
    const m = map();
    m.spawns.push(point('hi2', 60, 60, 2));
    const memory = createMemory();
    remember(memory, 'death', [10, 12], 0);
    expect(pickSpawn({ map: m, ids: ['A'], team: 1, memory, now: 1, rand: () => 0 }).at).toEqual([60, 0, 60]);
  });

  it('prefers a spot facing the front among equals', () => {
    const m = { polygons: [area('A', 0, 0, 200, 200)], spawns: [point('back', 10, 10, 1, Math.PI), point('front', 20, 10, 1, 0)] };
    expect(pickSpawn({ map: m, ids: ['A'], team: 1, front: [15, 150], rand: () => 0 }).at).toEqual([20, 0, 10]);
    expect(pickSpawn({ map: m, ids: ['A'], team: 1, front: [15, -150], rand: () => 0 }).at).toEqual([10, 0, 10]);
  });

  it('takes the stage’s own points when it names them', () => {
    const s = pickSpawn({ map: map(), ids: ['A'], points: ['out'], team: 1, rand: () => 0 });
    expect(s.at).toEqual([300, 0, 300]);
  });

  it('no safe point still spawns', () => {
    const enemies = [[10, 10], [150, 150]];
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

  it('skips an offset that is not walkable for the next, and moves the table back for a second attempt', () => {
    const mate = { id: 'm', kind: 'soldier', alive: true, at: [0, 0, 0], yaw: 0, suppressed: 0 };
    const s = squadSpawn({ squad: [mate], me: 'me', walkable: (x, z) => z > -2.5 || x > 0 });
    // (the table's second, (−1.6, −2.25), is 1.6 m to the mate's left: +X at yaw 0, the right being −X)
    expect(s.at[0]).toBeCloseTo(1.6, 6);
    expect(s.at[2]).toBeCloseTo(-2.25, 6);
    expect(squadSpawn({ squad: [mate], me: 'me', walkable: () => false })).toBe(null);
    // nothing in the first table fits: the second attempt's table, 6 m further behind
    expect(ATTEMPT_OFFSET).toEqual([0, -6]);
    const far = squadSpawn({ squad: [mate], me: 'me', walkable: (x, z) => z < -7.5 });
    expect(far.at[2]).toBeCloseTo(-9, 6);
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

  it('keeps a squad spawn the record’s safe enemy distance from every enemy', () => {
    expect(SQUAD_SAFE).toBe(squadsOf(loadRulebook()).safeEnemyDistance);
    const mate = { id: 'm', kind: 'soldier', alive: true, at: [0, 0, 0], yaw: 0, suppressed: 0, cls: { cls: 'assault' } };
    expect(blocked(mate, { enemies: [[0, 40]], now: 10 })).toBe('combat');
    expect(squadSpawn({ squad: [mate], me: 'me', enemies: [[0, 40]], now: 10 })).toBe(null);
    expect(blocked(mate, { enemies: [[0, SQUAD_SAFE]], now: 10 })).toBe(null);
  });

  it('protects a fresh soldier for a while, or for the window asked', () => {
    const e = {};
    protect(e, 10);
    expect(isProtected(e, 10 + SPAWN_PROTECTION - 0.1)).toBe(true);
    expect(isProtected(e, 10 + SPAWN_PROTECTION)).toBe(false);
    protect(e, 10, 6);
    expect(isProtected(e, 15.9)).toBe(true);
  });

  it('brings bots back on the wave', () => {
    expect(waves(0)).toBe(0);
    expect(waves(0.1)).toBe(WAVE);
    expect(waves(WAVE)).toBe(WAVE);
  });
});
