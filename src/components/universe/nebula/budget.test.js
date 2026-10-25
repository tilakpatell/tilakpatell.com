import { describe, expect, it } from 'vitest';
import { NEBULA_BUDGET, nebulaBudget } from './budget';

const TIERS = ['low', 'mid', 'high'];

describe('the nebulae’s tier rows', () => {
  it('holds the plan’s rows', () => {
    expect(NEBULA_BUDGET.low).toEqual({ volume: 32, farSteps: 4, nearSteps: 12, nearMax: 1, fog: 2, stars: 16, drawn: 8 });
    expect(NEBULA_BUDGET.mid).toEqual({ volume: 48, farSteps: 5, nearSteps: 20, nearMax: 1, fog: 3, stars: 32, drawn: 12 });
    expect(NEBULA_BUDGET.high).toEqual({ volume: 64, farSteps: 6, nearSteps: 32, nearMax: 2, fog: 4, stars: 64, drawn: 16 });
    expect(Object.keys(NEBULA_BUDGET)).toEqual(TIERS);
  });

  it('never gives a stronger tier less of anything', () => {
    for (let i = 1; i < TIERS.length; i++) {
      const was = NEBULA_BUDGET[TIERS[i - 1]];
      const now = NEBULA_BUDGET[TIERS[i]];
      expect(Object.keys(now)).toEqual(Object.keys(was));
      for (const k of Object.keys(now)) expect(now[k], `${TIERS[i]}.${k}`).toBeGreaterThanOrEqual(was[k]);
    }
  });

  it('marches more near than far, at every tier', () => {
    for (const t of TIERS) expect(NEBULA_BUDGET[t].nearSteps).toBeGreaterThan(NEBULA_BUDGET[t].farSteps);
  });

  it('can’t be changed by whoever reads it', () => {
    expect(Object.isFrozen(NEBULA_BUDGET)).toBe(true);
    for (const t of TIERS) expect(Object.isFrozen(NEBULA_BUDGET[t])).toBe(true);
  });
});

describe('the row a tier draws', () => {
  it('is the tier’s own', () => {
    for (const t of TIERS) expect(nebulaBudget(t)).toBe(NEBULA_BUDGET[t]);
  });

  it('is high’s at ultra (lib/device’s detail level, never its tier)', () => {
    expect(nebulaBudget('ultra')).toBe(NEBULA_BUDGET.high);
  });

  it('is mid’s for a tier it doesn’t know, or none', () => {
    for (const t of ['?', '', 'constructor', 'toString', undefined, null, 3]) expect(nebulaBudget(t)).toBe(NEBULA_BUDGET.mid);
    expect(nebulaBudget()).toBe(NEBULA_BUDGET.mid);
  });
});
