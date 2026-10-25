import { describe, expect, it } from 'vitest';
import { NEBULA_BUDGET, nebulaAtStep, nebulaBudget } from './budget';

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

describe('the row at a quality step (lowerQuality’s, lib/three/pace’s)', () => {
  it('is the row itself at the sharpest', () => {
    for (const t of TIERS) expect(nebulaAtStep(NEBULA_BUDGET[t], 0)).toBe(NEBULA_BUDGET[t]);
  });

  it('marches fewer steps near each step down, half at the softest, never fewer than far', () => {
    for (const t of TIERS) {
      const row = NEBULA_BUDGET[t];
      const near = [0, 1, 2, 3, 4, 5, 9].map((s) => nebulaAtStep(row, s).nearSteps);
      expect(near).toEqual([...near].sort((a, b) => b - a));
      expect(near[1]).toBeLessThan(row.nearSteps);
      expect(near[4]).toBe(Math.max(row.farSteps, Math.round(row.nearSteps / 2)));
      for (const n of near) expect(n).toBeGreaterThanOrEqual(row.farSteps);
    }
  });

  it('leaves the rest of the row as it is, and the row itself alone', () => {
    const row = NEBULA_BUDGET.high;
    const soft = nebulaAtStep(row, 3);
    expect({ ...soft, nearSteps: row.nearSteps }).toEqual(row);
    expect(Object.isFrozen(soft)).toBe(true);
    expect(row.nearSteps).toBe(32);
  });

  it('reads a step it can’t use as the sharpest', () => {
    for (const s of [undefined, null, NaN, -1, 'x']) expect(nebulaAtStep(NEBULA_BUDGET.mid, s)).toBe(NEBULA_BUDGET.mid);
  });
});
