import { describe, expect, it } from 'vitest';
import { FORCE, STANCE_IDS, STANCE_NAMES, forceAt, hitStop, pushVelocity } from './combatRules';

describe('the stances', () => {
  it('are the game’s two ways to hold a saber, each named, for the online protocol', () => {
    expect(STANCE_IDS).toEqual(['single', 'double']);
    for (const id of STANCE_IDS) expect(STANCE_NAMES[id]).toBeTruthy();
  });
});

describe('the Force', () => {
  it('the push reaches a cone in front, harder up close, and shoves away; the pull draws in', () => {
    const me = { x: 0, z: 0, yaw: 0 };
    expect(forceAt(me, { x: 0, z: 4 }).hit).toBe(true);
    expect(forceAt(me, { x: 0, z: 4 }).k).toBeGreaterThan(forceAt(me, { x: 0, z: 8 }).k);
    // a push with its own numbers (a roar's): a wider cone, a shorter reach
    const roar = { range: 5, cone: 1.4, force: 8, lift: 2 };
    expect(forceAt(me, { x: 0, z: 6 }, 'push', roar).hit).toBe(false);
    expect(forceAt(me, { x: 3, z: 1 }, 'push', roar).hit).toBe(true);
    expect(pushVelocity(me, { x: 0, z: 4 }, 1, 'push', roar).vz).toBeCloseTo(8);
    expect(forceAt(me, { x: 0, z: -4 }).hit).toBe(false);
    expect(forceAt(me, { x: 0, z: FORCE.push.range + 1 }).hit).toBe(false);
    const v = pushVelocity(me, { x: 0, z: 4 }, 1);
    expect(v.vz).toBeGreaterThan(0);
    expect(v.vy).toBeGreaterThan(0);
    expect(pushVelocity(me, { x: 0, z: 4 }, 1, 'pull').vz).toBeLessThan(0);
  });
  it('a hit holds the frame a touch, a kill a touch more', () => {
    expect(hitStop(2)).toBeGreaterThan(0);
    expect(hitStop(5)).toBeGreaterThan(hitStop(2));
    expect(hitStop(2, true)).toBeGreaterThan(hitStop(5));
    expect(hitStop(2, true)).toBeLessThan(0.15);
  });
});
