import { describe, expect, it } from 'vitest';
import { NEBULA_BUDGET, nebulaBudget } from './budget';

describe('the nebula’s rows', () => {
  const KEYS = ['volume', 'farSteps', 'nearSteps', 'nearMax', 'fog', 'stars', 'drawn'];
  it('has every row whole', () => {
    for (const t of ['low', 'mid', 'high']) for (const k of KEYS) expect(Number.isInteger(NEBULA_BUDGET[t][k]) && NEBULA_BUDGET[t][k] > 0).toBe(true);
  });
  it('never asks less of a stronger tier', () => {
    for (const k of KEYS) {
      expect(NEBULA_BUDGET.mid[k]).toBeGreaterThanOrEqual(NEBULA_BUDGET.low[k]);
      expect(NEBULA_BUDGET.high[k]).toBeGreaterThanOrEqual(NEBULA_BUDGET.mid[k]);
    }
  });
  it('marches more near than far', () => {
    for (const t of ['low', 'mid', 'high']) expect(NEBULA_BUDGET[t].nearSteps).toBeGreaterThan(NEBULA_BUDGET[t].farSteps);
  });
  it('reads ultra as high, and what it doesn’t know as mid', () => {
    expect(nebulaBudget('ultra')).toBe(NEBULA_BUDGET.high);
    expect(nebulaBudget('?')).toBe(NEBULA_BUDGET.mid);
    expect(nebulaBudget(undefined)).toBe(NEBULA_BUDGET.mid);
    expect(nebulaBudget('low')).toBe(NEBULA_BUDGET.low);
  });
});
