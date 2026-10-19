import { describe, expect, it } from 'vitest';
import { MAX_PERKS, PERKS, PERK_IDS, groundSkills, perkEffects, readPerks, withGround } from './perks';

describe('the perks', () => {
  it('each bends at least one number and says so', () => {
    for (const id of PERK_IDS) {
      const p = PERKS[id];
      expect(p.name.length).toBeGreaterThan(2);
      expect(p.about.length).toBeGreaterThan(10);
      expect(Object.keys(p).filter((k) => typeof p[k] === 'number').length).toBeGreaterThanOrEqual(1);
    }
    expect(PERK_IDS.length).toBeGreaterThanOrEqual(8);
  });
  it('reads a choice: perks only, no twice, three at most', () => {
    expect(readPerks(['focus', 'focus', 'nope', 'nimble', 'survivor', 'riposte'])).toEqual(['focus', 'nimble', 'survivor']);
    expect(readPerks(null)).toEqual([]);
    expect(MAX_PERKS).toBe(3);
  });
  it('multiplies, and leaves the rest at one', () => {
    const none = perkEffects([]);
    for (const v of Object.values(none)) expect(v).toBe(1);
    const fx = perkEffects(['survivor', 'heatsink']);
    expect(fx.hurt).toBe(0.75);
    expect(fx.heat).toBe(0.75);
    expect(fx.cool).toBe(1.35);
    expect(fx.damage).toBe(1);
  });
});

describe('the skill tree on foot (hangar/skills’ fx, on the perks’ numbers)', () => {
  it('takes the ground branch’s keys: tough as a hit taken lighter, the medic on the regen, hard hitter on the damage', () => {
    const g = groundSkills({ health: 1.1, heal: 1.5, heat: 0.85, cool: 1.15, damage: 1.15, spread: 0.85, boost: 0.1 });
    expect(g.hurt).toBeCloseTo(1 / 1.1);
    expect(g).toMatchObject({ regen: 1.5, heat: 0.85, cool: 1.15, damage: 1.15, spread: 0.85 });
    expect(g.boost).toBeUndefined();
  });
  it('is neutral with no skills, or nonsense', () => {
    for (const fx of [undefined, null, {}, { heal: 'x', health: 0, damage: -2 }]) expect(groundSkills(fx)).toEqual({ hurt: 1, regen: 1, heat: 1, cool: 1, damage: 1, spread: 1 });
  });
  it('multiplies into the perks, each key on its own, keeping the perks’ others', () => {
    const both = withGround(perkEffects(['heatsink', 'secondwind']), groundSkills({ heat: 0.85, heal: 1.5 }));
    expect(both.heat).toBeCloseTo(0.75 * 0.85);
    expect(both.regen).toBeCloseTo(2 * 1.5);
    expect(both.guard).toBe(1);
    expect(both.spread).toBe(1);
  });
});
