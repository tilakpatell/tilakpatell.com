import { describe, expect, it } from 'vitest';
import { NEBULA_BUDGET, nebulaBudget } from './budget';

const KEYS = ['volume', 'farSteps', 'nearSteps', 'nearMax', 'fog', 'stars', 'drawn'];

describe('the nebula tier rows', () => {
  it('has every row, with all seven numbers', () => {
    for (const tier of ['low', 'mid', 'high']) {
      expect(Object.keys(NEBULA_BUDGET[tier]).sort()).toEqual([...KEYS].sort());
      for (const k of KEYS) expect(Number.isFinite(NEBULA_BUDGET[tier][k])).toBe(true);
    }
  });
  it('never gives a stronger tier a smaller number', () => {
    for (const k of KEYS) {
      expect(NEBULA_BUDGET.low[k]).toBeLessThanOrEqual(NEBULA_BUDGET.mid[k]);
      expect(NEBULA_BUDGET.mid[k]).toBeLessThanOrEqual(NEBULA_BUDGET.high[k]);
    }
  });
  it('reads ultra as high and an unknown tier as mid', () => {
    expect(nebulaBudget('ultra')).toBe(NEBULA_BUDGET.high);
    expect(nebulaBudget('?')).toBe(NEBULA_BUDGET.mid);
    expect(nebulaBudget('low')).toBe(NEBULA_BUDGET.low);
  });
});
