import { describe, expect, it } from 'vitest';
import { DEFAULT, HEROES, ORDER, canPlay, hero, keptHero, lockLine } from './heroes';
import { FLY, newHero, stepHero } from './flight';
import { buildWorld } from './map';

const W = buildWorld();
const look = [0, 0, -1];
const fly = (mult, secs = 6) => {
  let h = { ...newHero({ x: -2044, y: 300, z: 254, face: Math.PI }), mode: 'air' };
  for (let t = 0; t < secs; t += 0.05) h = stepHero(h, { fwd: 1, side: 0, up: 0, down: 0, boost: true, run: false, jump: false, look }, 0.05, W, mult);
  return h;
};

describe('the table', () => {
  it('has the four, Mark first, and reads an unknown id as Mark', () => {
    expect(ORDER).toEqual(['mark', 'eve', 'omniman', 'thragg']);
    expect(hero('mark').id).toBe('mark');
    expect(hero('nobody').id).toBe(DEFAULT);
    expect(keptHero('eve')).toBe('eve');
    expect(keptHero(7)).toBe('mark');
    expect(keptHero('x')).toBe('mark');
    for (const id of ORDER) expect(HEROES[id].figure).toBeTruthy();
  });
  it('is earned: Mark always, Eve by her race, Omni-Man by the truth, Thragg by the Regent', () => {
    expect(canPlay('mark')).toBe(true);
    expect(canPlay('eve', { story: { best: {} } })).toBe(false);
    expect(canPlay('eve', { story: { best: { everace: 58 } } })).toBe(true);
    expect(canPlay('omniman', { unlocked: ['season'] })).toBe(false);
    expect(canPlay('omniman', { unlocked: ['truth'] })).toBe(true);
    expect(canPlay('thragg', { unlocked: ['thinkmark'] })).toBe(false);
    expect(canPlay('thragg', { unlocked: ['regent'] })).toBe(true);
    expect(canPlay('nobody')).toBe(false);
    expect(lockLine('mark')).toBeNull();
    expect(lockLine('eve')).toMatch(/race/);
    expect(lockLine('thragg')).toMatch(/Viltrumite/);
  });
});

describe('the flight takes the multipliers', () => {
  it('Omni-Man goes 1.6 times as fast flat out, Eve 0.8, Mark as before', () => {
    const mark = fly(hero('mark').flight);
    const omni = fly(hero('omniman').flight);
    const eve = fly(hero('eve').flight);
    expect(Math.hypot(...mark.v)).toBeCloseTo(FLY.top, 0);
    expect(Math.hypot(...omni.v)).toBeCloseTo(FLY.top * 1.6, 0);
    expect(Math.hypot(...eve.v)).toBeCloseTo(FLY.top * 0.8, 0);
  });
  it('the boom comes earlier for Omni-Man', () => {
    let h = { ...newHero({ x: -2044, y: 300, z: 254, face: Math.PI }), mode: 'air' };
    let boomAt = null;
    for (let t = 0; t < 6 && boomAt == null; t += 0.05) {
      h = stepHero(h, { fwd: 1, side: 0, up: 0, down: 0, boost: true, run: false, jump: false, look }, 0.05, W, hero('omniman').flight);
      if (h.ev.some((e) => e.type === 'boom')) boomAt = Math.hypot(...h.v);
    }
    expect(boomAt).toBeLessThan(FLY.barrier);
    expect(boomAt).toBeGreaterThan(FLY.barrier * 0.6);
  });
});
