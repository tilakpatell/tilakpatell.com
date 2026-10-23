import { describe, expect, it } from 'vitest';
import { COOL_WAIT, SHOT_FLOOR, VENT, heatShot, heatStep, spreadAt, vent, ventSpot, weaponOf, withMods } from './handRules';
import { MAX_MODS, WEAPONS } from './hand';

const cold = { value: 0, locked: false, lockedAt: null, shotAt: null };

describe('a gun in the hand', () => {
  it('reads its numbers from the table, the blaster’s for a kind it doesn’t know', () => {
    expect(weaponOf('revolver')).toBe(WEAPONS.revolver);
    expect(weaponOf('nope')).toBe(WEAPONS.blaster);
    expect(SHOT_FLOOR).toBeGreaterThan(0.1);
    expect(SHOT_FLOOR).toBeLessThan(0.3);
  });

  it('bends them by its mods, no more than MAX_MODS, and never under a whole hit', () => {
    const w = withMods('blaster', ['barrel', 'barrel', 'choke', 'cooling', 'nope']);
    expect(w.mods.length).toBeLessThanOrEqual(MAX_MODS);
    expect(w.mods).toEqual(['barrel', 'choke']);
    expect(w.range).toBeCloseTo(WEAPONS.blaster.range * 1.3);
    expect(w.spread).toBeCloseTo(WEAPONS.blaster.spread * 0.5);
    expect(withMods('nope').kind).toBe('blaster');
    expect(withMods('smg').damage).toBeGreaterThanOrEqual(1);
  });

  it('heats with each shot and locks when full', () => {
    const w = { heat: 0.4, cool: 1 };
    let h = heatShot(cold, w, 1);
    expect(h.value).toBeCloseTo(0.4);
    h = heatShot(heatShot(h, w, 1.2), w, 1.4);
    expect(h.locked).toBe(true);
    expect(h.lockedAt).toBe(1.4);
  });

  it('cools only once the trigger has rested, and comes clear after a lock', () => {
    const w = { heat: 0.4, cool: 1 };
    const h = heatShot(cold, w, 0);
    expect(heatStep(h, 0.1, w, COOL_WAIT / 2).value).toBeCloseTo(0.4);
    expect(heatStep(h, 0.1, w, COOL_WAIT + 0.1).value).toBeCloseTo(0.3);
    const locked = { value: 1, locked: true, lockedAt: 0, shotAt: 0 };
    expect(heatStep(locked, 0.1, w, VENT.lock / 2)).toBe(locked);
    expect(heatStep(locked, 0.1, w, VENT.lock + 0.01).locked).toBe(false);
  });

  it('vents all at once in the sweet spot, half early, nothing late', () => {
    const locked = { value: 1, locked: true, lockedAt: 0, shotAt: 0 };
    const mid = ((VENT.sweet[0] + VENT.sweet[1]) / 2) * VENT.lock;
    expect(ventSpot(locked, mid)).toBeCloseTo(mid / VENT.lock);
    expect(vent(locked, mid)).toMatchObject({ value: 0, locked: false, perfect: true });
    expect(vent(locked, 0.01)).toMatchObject({ value: 0.5, locked: false, perfect: false });
    expect(vent(locked, VENT.lock * 0.9)).toMatchObject({ locked: true, perfect: false });
    expect(ventSpot(cold, 1)).toBeNull();
  });

  it('scatters less down the sights', () => {
    expect(spreadAt({ spread: 0.02 }, true)).toBeLessThan(spreadAt({ spread: 0.02 }, false));
  });
});
