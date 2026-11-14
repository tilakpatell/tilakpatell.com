import { describe, expect, it } from 'vitest';
import { BUDGET, STEPS, universeBudget } from './budget';

const LEVELS = ['low', 'mid', 'high', 'ultra'];
const numbers = (row) => Object.entries(row).filter(([, v]) => typeof v === 'number');

describe('the budget table', () => {
  it('holds the numbers the lanes read', () => {
    expect(BUDGET.low).toMatchObject({ systemsBuilt: 1, discs: 400, workers: 1, traffic: 2, events: 1, nebula: { res: 0.25, steps: 16 }, gargantuan: 'low', planetMap: [256, 128] });
    expect(BUDGET.mid).toMatchObject({ systemsBuilt: 1, discs: 1200, thingsNear: 32, workers: 2, expanseMs: 1.5, nebula: { res: 0.5, steps: 32 } });
    expect(BUDGET.high).toMatchObject({ systemsBuilt: 2, discs: 2500, beyondRings: 2, planetMap: [512, 256] });
    expect(BUDGET.ultra).toMatchObject({ systemsBuilt: 3, discs: 4000, thingsNear: 96, traffic: 8, nebula: { res: 1, steps: 64 } });
  });

  it('never gives a weaker device more of anything', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const [lo, hi] = [BUDGET[LEVELS[i - 1]], BUDGET[LEVELS[i]]];
      for (const [k, v] of numbers(lo)) expect(hi[k], `${LEVELS[i]} ${k}`).toBeGreaterThanOrEqual(v);
      expect(hi.nebula.steps).toBeGreaterThanOrEqual(lo.nebula.steps);
      expect(hi.nebula.res).toBeGreaterThanOrEqual(lo.nebula.res);
      expect(hi.planetMap[0]).toBeGreaterThanOrEqual(lo.planetMap[0]);
    }
  });
});

describe('universeBudget', () => {
  it('goes by the detail in force, then the tier, else mid', () => {
    expect(universeBudget({ tier: 'high', detail: 'ultra' })).toEqual(BUDGET.ultra);
    expect(universeBudget({ tier: 'high', detail: 'low' })).toEqual(BUDGET.low); // (a weak chip under Auto, or the visitor's pick)
    expect(universeBudget({ tier: 'low' })).toEqual(BUDGET.low);
    expect(universeBudget({ tier: 'nonsense' })).toEqual(BUDGET.mid);
    expect(universeBudget()).toEqual(BUDGET.mid);
  });

  it('hands back a row of its own, so a lane can’t change the table', () => {
    const r = universeBudget({ detail: 'high' });
    r.nebula.steps = 1;
    r.planetMap[0] = 1;
    r.thingKinds.rock = 9;
    expect(BUDGET.high.nebula.steps).toBe(48);
    expect(BUDGET.high.planetMap[0]).toBe(512);
    expect(BUDGET.high.thingKinds).toEqual({});
  });

  it('takes the counts down by the quality step, and a quarter at the floor', () => {
    expect(universeBudget({ detail: 'high' }, 1).discs).toBe(Math.round(2500 * STEPS[1]));
    expect(universeBudget({ detail: 'high' }, 3)).toMatchObject({ discs: 875, thingsNear: 22, traffic: 2, beyondRings: 1, nebula: { steps: 24 } });
    expect(universeBudget({ detail: 'high' }, 2, true)).toMatchObject({ discs: 313, thingsNear: 8, traffic: 1 });
    expect(universeBudget({ detail: 'low' }, 2).beyondRings).toBe(0);
  });

  it('never raises a count, and builds one system at least', () => {
    for (const level of LEVELS) {
      const base = BUDGET[level];
      for (const step of [0, 1, 2, 3, 9, -2, NaN]) {
        for (const floor of [false, true]) {
          const r = universeBudget({ detail: level }, step, floor);
          for (const [k, v] of numbers(r)) expect(v, `${level} ${step} ${floor} ${k}`).toBeLessThanOrEqual(base[k]);
          expect(r.nebula.steps).toBeLessThanOrEqual(base.nebula.steps);
          expect(r.systemsBuilt).toBeGreaterThanOrEqual(1);
          expect(r.discs).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});
