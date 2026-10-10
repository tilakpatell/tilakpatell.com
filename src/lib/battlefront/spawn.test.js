import { describe, expect, it } from 'vitest';
import { SAFE, SPAWN_PROTECTION, WAVE, isProtected, pickSpawn, protect, squadSpawn, waves } from './spawn.js';

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
    const s = squadSpawn({ squad: [mate], me: 'me', enemies: [[0, SAFE + 5]] });
    expect(s.at[2]).toBeCloseTo(-1.5, 6);
    expect(s.mate).toBe('m');
    expect(squadSpawn({ squad: [mate], me: 'me', enemies: [[0, 10]] })).toBe(null);
    expect(squadSpawn({ squad: [{ ...mate, suppressed: 0.5 }], me: 'me', enemies: [] })).toBe(null);
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
