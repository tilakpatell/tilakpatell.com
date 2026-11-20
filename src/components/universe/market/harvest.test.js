import { describe, expect, it } from 'vitest';
import { PURE_FROM } from './areas';
import { harvest } from './harvest';
import { createMarket } from './store';
import { PLANET_CAP, yieldOfPlanet } from './yields';

const forest = { resources: [{ id: 'organics', amount: 0.8 }, { id: 'food', amount: 0.5 }], rare: { id: 'silk' } };

describe('a planet’s harvest', () => {
  it('gives its first resource always, the same for the same press', () => {
    const y = yieldOfPlanet(forest, { id: 'E:3,1:2:1', press: 0 });
    expect(y[0]).toEqual({ good: 'organics', n: 3 });
    expect(yieldOfPlanet(forest, { id: 'E:3,1:2:1', press: 0 })).toEqual(y);
    expect(yieldOfPlanet({ resources: [{ id: 'nope', amount: 1 }] }, { id: 'x' })).toEqual([]);
  });

  it('gives its rare now and then, the pure grade only far out', () => {
    const many = (d) => Array.from({ length: 300 }, (_, i) => yieldOfPlanet(forest, { id: `p${i}`, press: 0, d })).flat();
    expect(many(5).some((g) => g.good === 'silk')).toBe(true);
    expect(many(5).some((g) => g.good === 'silk-pure')).toBe(false);
    expect(many(PURE_FROM).some((g) => g.good === 'silk-pure')).toBe(true);
  });

  it('fills the hold, says so, and is worked out after its last harvest', () => {
    const market = createMarket();
    const first = harvest({ market, crew: 'rv', room: 16, traits: forest, id: 'E:3,1:2:1', press: 0, sector: [3, 0, 1] });
    expect(first.got[0].good).toBe('organics');
    expect(first.said).toMatch(/^Into the hold: 3 organics/);
    expect(market.hold('rv', 16).lots[0].from.sector).toEqual([3, 0, 1]);
    harvest({ market, crew: 'rv', room: 16, traits: forest, id: 'E:3,1:2:1', press: PLANET_CAP - 1 });
    expect(harvest({ market, crew: 'rv', room: 16, traits: forest, id: 'E:3,1:2:1', press: 0 }).said).toMatch(/^Worked out here/);
  });

  it('says the hold is full, or not ready, rather than lose anything', () => {
    const market = createMarket();
    market.hold('xwing', 1).add('iron', 1, { sector: [0, 0, 0] });
    expect(harvest({ market, crew: 'xwing', room: 1, traits: forest, id: 'a' }).said).toMatch(/full/);
    expect(harvest({ market: null, crew: 'xwing', room: 1, traits: forest, id: 'a' }).got).toEqual([]);
  });
});
