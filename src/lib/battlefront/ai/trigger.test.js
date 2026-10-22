import { describe, expect, it } from 'vitest';
import { aiOf, loadRulebook } from '../rulebook.js';
import { DEFAULT_MOVE, MOVE_FIRE, aimY, firesOnTheMove, holdsFire, keepFiring, reacquired, weaponRange } from './trigger.js';

const ai = aiOf(loadRulebook());

describe('the trigger, as the source holds it', () => {
  it('fires on at a target out of sight while standing, for the keep-firing time, and only in sight on the move', () => {
    expect(keepFiring(ai.system)).toBe(4);
    expect(keepFiring(ai.systemPvE)).toBe(3);
    expect(holdsFire({ seen: false, standing: true, sinceSeen: 3.5, keep: 4 })).toBe(false);
    expect(holdsFire({ seen: false, standing: true, sinceSeen: 4.5, keep: 4 })).toBe(true);
    expect(holdsFire({ seen: false, standing: false, sinceSeen: 0.1, keep: 4 })).toBe(true);
    expect(holdsFire({ seen: true, standing: false, sinceSeen: 0, keep: 4 })).toBe(false);
  });

  it('marks a target spotted again away from where it was last seen, not one back where it was, nor a new one', () => {
    const t = {};
    expect(reacquired(t, { id: 'a', seen: true, at: [0, 0, 10], threshold: 1, now: 1 })).toBe(-Infinity);
    reacquired(t, { id: 'a', seen: false, at: [0, 0, 10], threshold: 1, now: 2 });
    expect(reacquired(t, { id: 'a', seen: true, at: [0, 0, 10.5], threshold: 1, now: 3 })).toBe(-Infinity);
    reacquired(t, { id: 'a', seen: false, at: [0, 0, 10.5], threshold: 1, now: 4 });
    expect(reacquired(t, { id: 'a', seen: true, at: [3, 0, 10.5], threshold: 1, now: 5 })).toBe(5);
    expect(reacquired(t, { id: 'b', seen: true, at: [9, 0, 9], threshold: 1, now: 6 })).toBe(-Infinity);
  });

  it('is held past the AI weapon row’s range', () => {
    expect(weaponRange(ai.weapons.AI_Rifle)).toBe(250);
    expect(weaponRange(ai.weapons.AI_Pistol_Officer)).toBe(100);
    expect(weaponRange(ai.weapons.AI_Flamethrower)).toBe(Infinity);
  });

  it('fires on the move only where the tactic’s move settings say, inside their distance', () => {
    expect(firesOnTheMove(MOVE_FIRE.attack.Rifleman_Tactics, 30)).toBe(true);
    expect(firesOnTheMove(MOVE_FIRE.attack.Rifleman_Tactics, 45)).toBe(false);
    expect(firesOnTheMove(MOVE_FIRE.attack.Officer_Tactics, 5)).toBe(false);
    expect(firesOnTheMove(DEFAULT_MOVE, 5)).toBe(false);
    // (every row a template plays has its rule)
    for (const t of Object.values(ai.templates)) expect(MOVE_FIRE.attack[t.tactics]).toBeDefined();
    for (const t of Object.values(ai.skirmish.templates)) expect(MOVE_FIRE.attack[t.tactics]).toBeDefined();
  });

  it('aims at the eye less the system’s offset', () => {
    expect(ai.system.targeting.aimOffsetY).toBe(-0.25);
    expect(aimY(1.2, { eyeOverChest: 0.4, offset: -0.25 })).toBeCloseTo(1.35, 9);
  });
});
