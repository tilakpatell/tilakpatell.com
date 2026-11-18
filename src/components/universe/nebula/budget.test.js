import { describe, expect, it } from 'vitest';
import { NEBULA_BUDGET, nebulaAtStep, nebulaBudget } from './budget';

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

describe('at the pace’s steps', () => {
  it('marches an eighth fewer near a step down, half at the softest, never fewer than far', () => {
    const r = NEBULA_BUDGET.high;
    expect(nebulaAtStep(r, 0)).toBe(r);
    expect(nebulaAtStep(r, NaN)).toBe(r);
    expect(nebulaAtStep(r, 1).nearSteps).toBe(28);
    expect(nebulaAtStep(r, 4).nearSteps).toBe(16);
    expect(nebulaAtStep(NEBULA_BUDGET.low, 8).nearSteps).toBe(NEBULA_BUDGET.low.farSteps);
    expect(nebulaAtStep(r, 2)).toMatchObject({ farSteps: r.farSteps, drawn: r.drawn, stars: r.stars });
  });
});
