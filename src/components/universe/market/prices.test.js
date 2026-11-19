import { describe, expect, it } from 'vitest';
import { GOODS } from './goods';
import { PRICE, drift, haulOf, priceOf, yoursAt } from './prices';

const at = { sector: [12, 0, 3], pocket: null };
const base = { stationId: 'E:12,3:w10004', type: 'mining', area: { id: 'heroes' }, at, t: 1.7e12 };

describe('prices', () => {
  it('always asks more than it pays, at any clock, for any good', () => {
    for (let k = 0; k < 40; k++) {
      for (const good of Object.keys(GOODS)) {
        const p = priceOf({ ...base, good, t: 1.7e12 + k * 997 * 60000 });
        expect(p.buy, good).toBeGreaterThan(p.sell);
        expect(p.sell).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('gives the same price for the same station, good and clock', () => {
    expect(priceOf({ ...base, good: 'iron' })).toEqual(priceOf({ ...base, good: 'iron' }));
  });

  it('drifts by a quarter at most, slowly', () => {
    for (let k = 0; k < 100; k++) {
      const v = drift('s', 'food', k * 3600e3);
      expect(v).toBeGreaterThanOrEqual(1 - PRICE.drift - 1e-9);
      expect(v).toBeLessThanOrEqual(1 + PRICE.drift + 1e-9);
    }
    expect(Math.abs(drift('s', 'food', 0) - drift('s', 'food', 60e3))).toBeLessThan(0.01);
  });

  it('pays less after you sell ten, and recovers with time', () => {
    const fresh = priceOf({ ...base, good: 'food' }).sell;
    const after = priceOf({ ...base, good: 'food', yours: 10 }).sell;
    expect(after).toBeLessThan(fresh);
    expect(yoursAt({ n: 10, t: 0 }, PRICE.halfLife)).toBeCloseTo(5, 9);
    expect(yoursAt(null, 5)).toBe(0);
  });

  it('pays for a specialty hauled ten sectors twice what it fetches at home', () => {
    const home = priceOf({ ...base, good: 'vibranium', from: at }).sell;
    const far = priceOf({ ...base, area: { id: 'grave' }, good: 'vibranium', from: { sector: [2, 0, 3], pocket: null } }).sell;
    expect(far).toBeGreaterThanOrEqual(home * 2 * 1.9);
    expect(haulOf('iron', { sector: [0, 0, 0] }, at)).toBe(1);
    expect(haulOf('spice', { sector: [0, 0, 0], pocket: 'starwars' }, at)).toBe(PRICE.haulMost);
  });

  it('makes the Core’s exchange flat', () => {
    const core = { ...base, area: { id: 'core' }, type: 'industry' };
    expect(priceOf({ ...core, good: 'food', t: 0 })).toEqual(priceOf({ ...core, good: 'food', t: 5 * 3600e3 }));
  });

  it('knows no price for a good there isn’t', () => {
    expect(priceOf({ ...base, good: 'unobtainium' })).toBe(null);
  });
});
