import { describe, expect, it } from 'vitest';
import { DAMAGE, RUINS, STAGES, forceOf, heightOf, hitTower, keyOf, newRuins, parse, repair, serialise, stageOf } from './demolish';

describe('a hit on a tower', () => {
  it('adds by its force and clamps at 1', () => {
    let r = newRuins(0);
    ({ ruins: r } = hitTower(r, 'b:7', DAMAGE.car));
    expect(r.damage.get('b:7')).toBeCloseTo(0.15);
    ({ ruins: r } = hitTower(r, 'b:7', DAMAGE.mach));
    ({ ruins: r } = hitTower(r, 'b:7', DAMAGE.mach));
    expect(r.damage.get('b:7')).toBe(1);
    expect(r.collateral).toBeCloseTo(1);
  });
  it('says its stage: cracks, a bite, the top gone', () => {
    expect(stageOf(0)).toBe(0);
    expect(stageOf(0.1)).toBe(1);
    expect(stageOf(STAGES[0])).toBe(2);
    expect(stageOf(STAGES[1])).toBe(3);
    expect(stageOf(1)).toBe(3);
    const { stage, delta } = hitTower(newRuins(), 'h:3', DAMAGE.slam);
    expect(stage).toBe(2);
    expect(delta).toBeCloseTo(0.3);
  });
  it('does nothing with no key or no force', () => {
    const r = newRuins();
    expect(hitTower(r, null, 0.5).ruins).toBe(r);
    expect(hitTower(r, 'b:1', 0).ruins).toBe(r);
  });
  it('is keyed by the collider: a building’s id, a house’s index, nothing for a shop', () => {
    expect(keyOf({ building: 12 })).toBe('b:12');
    expect(keyOf({ house: 0 })).toBe('h:0');
    expect(keyOf({ shop: true })).toBeNull();
    expect(keyOf(null)).toBeNull();
  });
});

describe('the height', () => {
  it('stands whole through the cracks, loses up to a third through the bite, a third at the end', () => {
    expect(heightOf(0)).toBe(1);
    expect(heightOf(0.29)).toBe(1);
    expect(heightOf(STAGES[0])).toBeCloseTo(1);
    expect(heightOf((STAGES[0] + STAGES[1]) / 2)).toBeCloseTo(1 - RUINS.bite / 2);
    expect(heightOf(STAGES[1])).toBeCloseTo(1 - RUINS.bite);
    expect(heightOf(1)).toBeCloseTo(1 - RUINS.bite);
  });
});

describe('what does the damage', () => {
  it('Mark into a wall flat out, not at a cruise; a slam with something in hand at any speed', () => {
    expect(forceOf({ type: 'impact', speed: 260 })).toBe(DAMAGE.mach);
    expect(forceOf({ type: 'impact', speed: RUINS.fast })).toBe(DAMAGE.mach);
    expect(forceOf({ type: 'impact', speed: 80 })).toBe(0);
    expect(forceOf({ type: 'impact', speed: 45 }, { held: true })).toBe(DAMAGE.slam);
    expect(forceOf({ type: 'carrySlam', speed: 45 })).toBe(DAMAGE.slam);
    expect(forceOf({ type: 'carDown' })).toBe(DAMAGE.car);
    expect(forceOf({ type: 'swing' })).toBe(DAMAGE.swing);
    expect(forceOf({ type: 'boom' })).toBe(0);
    expect(forceOf(null)).toBe(0);
  });
});

describe('the repair', () => {
  it('takes a quarter off everything a whole day, never below 0, and keeps the days it has counted', () => {
    let r = newRuins(1000);
    ({ ruins: r } = hitTower(r, 'b:1', 0.6));
    ({ ruins: r } = hitTower(r, 'b:2', 0.2));
    expect(repair(r, 1000 + RUINS.day * 0.9)).toBe(r);
    const day = repair(r, 1000 + RUINS.day * 1.5);
    expect(day.damage.get('b:1')).toBeCloseTo(0.35);
    expect(day.damage.has('b:2')).toBe(false);
    expect([...day.mending]).toEqual(['b:1']);
    // a fresh hit sends the crews away
    expect(hitTower(day, 'b:1', 0.1).ruins.mending.has('b:1')).toBe(false);
    expect(day.at).toBe(1000 + RUINS.day);
    const week = repair(r, 1000 + RUINS.day * 7);
    expect(week.damage.size).toBe(0);
  });
});

describe('what is kept', () => {
  it('keeps the most damaged, up to the cap, and reads back', () => {
    let r = newRuins(5);
    for (let i = 0; i < RUINS.keep + 50; i++) ({ ruins: r } = hitTower(r, `b:${i}`, (i % 100) / 100 + 0.005));
    const kept = serialise(r);
    expect(kept.list).toHaveLength(RUINS.keep);
    expect(kept.at).toBe(5);
    const least = Math.min(...kept.list.map(([, d]) => d));
    const dropped = [...r.damage].filter(([k]) => !kept.list.some(([kk]) => kk === k));
    for (const [, d] of dropped) expect(d).toBeLessThanOrEqual(least + 1e-9);
    const back = parse(JSON.stringify(kept), 99);
    expect(back.at).toBe(5);
    expect(back.damage.size).toBe(RUINS.keep);
  });
  it('reads garbage as nothing: not an object, an unknown key, a damage out of range', () => {
    expect(parse('nonsense', 3).damage.size).toBe(0);
    expect(parse('nonsense', 3).at).toBe(3);
    expect(parse({ at: 1, list: 'no' }).damage.size).toBe(0);
    const r = parse({ at: 1, list: [['b:1', 0.5], ['x:2', 0.5], ['h:3', 7], ['h:4', -1], ['h:5', 'a'], 'junk', ['b:6', 1]] });
    expect([...r.damage.keys()]).toEqual(['b:1', 'b:6']);
  });
});
