import { describe, expect, it } from 'vitest';
import { BUDGET, universeBudget } from './budget';

const LEVELS = ['low', 'mid', 'high', 'ultra'];
const GARGANTUAN = ['low', 'mid', 'high'];

// every number in a row, by its path (nebula.steps, planetMap.0, …)
const numbers = (row, at = '') =>
  Object.entries(row).flatMap(([k, v]) => (typeof v === 'number' ? [[`${at}${k}`, v]] : v && typeof v === 'object' ? numbers(v, `${at}${k}.`) : []));

describe('the endless universe’s budget table', () => {
  it('holds the plan’s rows', () => {
    expect(BUDGET.low).toEqual({
      systemsBuilt: 1, discs: 400, slotSize: 400, nearSlots: 64, beyondRings: 1, thingsNear: 16, thingKinds: {},
      workers: 1, expanseMs: 1, traffic: 2, events: 1, nebula: { res: 0.25, steps: 16 }, gargantuan: 'low', planetMap: [256, 128], tags: 3,
    });
    expect(BUDGET.mid).toEqual({
      systemsBuilt: 1, discs: 1200, slotSize: 400, nearSlots: 64, beyondRings: 1, thingsNear: 32, thingKinds: {},
      workers: 2, expanseMs: 1.5, traffic: 4, events: 2, nebula: { res: 0.5, steps: 32 }, gargantuan: 'mid', planetMap: [256, 128], tags: 6,
    });
    expect(BUDGET.high).toEqual({
      systemsBuilt: 2, discs: 2500, slotSize: 400, nearSlots: 64, beyondRings: 2, thingsNear: 64, thingKinds: {},
      workers: 3, expanseMs: 2, traffic: 6, events: 3, nebula: { res: 0.5, steps: 48 }, gargantuan: 'high', planetMap: [512, 256], tags: 6,
    });
    expect(BUDGET.ultra).toEqual({
      systemsBuilt: 3, discs: 4000, slotSize: 400, nearSlots: 64, beyondRings: 2, thingsNear: 96, thingKinds: {},
      workers: 4, expanseMs: 2, traffic: 8, events: 3, nebula: { res: 1, steps: 64 }, gargantuan: 'high', planetMap: [512, 256], tags: 6,
    });
    expect(Object.keys(BUDGET)).toEqual(LEVELS);
  });

  it('never gives a higher level less of anything', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const was = Object.fromEntries(numbers(BUDGET[LEVELS[i - 1]]));
      const now = numbers(BUDGET[LEVELS[i]]);
      expect(now.map(([k]) => k)).toEqual(Object.keys(was));
      for (const [k, v] of now) expect(v, `${LEVELS[i]}.${k}`).toBeGreaterThanOrEqual(was[k]);
      expect(GARGANTUAN.indexOf(BUDGET[LEVELS[i]].gargantuan)).toBeGreaterThanOrEqual(GARGANTUAN.indexOf(BUDGET[LEVELS[i - 1]].gargantuan));
    }
  });

  it('can’t be changed by whoever reads it', () => {
    for (const l of LEVELS) {
      expect(Object.isFrozen(BUDGET[l])).toBe(true);
      expect(Object.isFrozen(BUDGET[l].nebula)).toBe(true);
      expect(Object.isFrozen(BUDGET[l].planetMap)).toBe(true);
      expect(Object.isFrozen(BUDGET[l].thingKinds)).toBe(true);
    }
    expect(Object.isFrozen(BUDGET)).toBe(true);
  });
});

describe('the row this device draws', () => {
  it('is ultra’s at the ultra detail level', () => {
    expect(universeBudget({ tier: 'high', detail: 'ultra' })).toEqual(BUDGET.ultra);
  });

  it('is the tier’s where the detail level says nothing', () => {
    for (const tier of ['low', 'mid', 'high']) expect(universeBudget({ tier })).toEqual(BUDGET[tier]);
  });

  it('is the detail level’s where it is one (lib/device’s budget(): a held Low draws Low’s row)', () => {
    expect(universeBudget({ tier: 'high', detail: 'low' })).toEqual(BUDGET.low);
    expect(universeBudget({ tier: 'low', detail: 'high' })).toEqual(BUDGET.high);
    expect(universeBudget({ tier: 'mid', detail: 'nonsense' })).toEqual(BUDGET.mid);
  });

  it('is mid’s for a tier it doesn’t know, or none', () => {
    expect(universeBudget({ tier: 'nonsense' })).toEqual(BUDGET.mid);
    expect(universeBudget({})).toEqual(BUDGET.mid);
    expect(universeBudget()).toEqual(BUDGET.mid);
  });
});

describe('the quality steps and the floor', () => {
  const at = (level, step, floor) => universeBudget({ tier: level === 'ultra' ? 'high' : level, detail: level }, step, floor);

  it('step by step take discs, things near and traffic down to 1, 0.75, 0.5 and 0.35, rounded', () => {
    expect([0, 1, 2, 3].map((s) => at('high', s).discs)).toEqual([2500, 1875, 1250, 875]);
    expect([0, 1, 2, 3].map((s) => at('mid', s).thingsNear)).toEqual([32, 24, 16, 11]);
    expect([0, 1, 2, 3].map((s) => at('high', s).traffic)).toEqual([6, 5, 3, 2]);
  });

  it('read any step past the last as the last', () => {
    expect(at('high', 4)).toEqual(at('high', 3));
    expect(at('high', 9)).toEqual(at('high', 3));
  });

  it('take a beyond ring away from step 2, never below none, and halve the nebula’s steps', () => {
    expect([0, 1, 2, 3].map((s) => at('high', s).beyondRings)).toEqual([2, 2, 1, 1]);
    expect([0, 1, 2, 3].map((s) => at('low', s).beyondRings)).toEqual([1, 1, 0, 0]);
    expect([0, 1, 2, 3].map((s) => at('ultra', s).nebula)).toEqual([
      { res: 1, steps: 64 },
      { res: 1, steps: 64 },
      { res: 1, steps: 32 },
      { res: 1, steps: 32 },
    ]);
  });

  it('at the floor, take the counts to a quarter of the step’s', () => {
    expect(at('ultra', 0, true)).toMatchObject({ discs: 1000, thingsNear: 24, traffic: 2 });
    expect(at('mid', 3, true)).toMatchObject({ discs: 105, thingsNear: 3, traffic: 0 });
  });

  it('never raise a count, and always build one system at least', () => {
    for (const level of LEVELS) {
      const top = Object.fromEntries(numbers(BUDGET[level]));
      let was = top;
      for (const floor of [false, true]) {
        for (let s = 0; s <= 4; s++) {
          const row = at(level, s, floor);
          for (const [k, v] of numbers(row)) {
            expect(v, `${level} step ${s}${floor ? ' floor' : ''} ${k}`).toBeLessThanOrEqual(top[k]);
            expect(v, `${level} step ${s}${floor ? ' floor' : ''} ${k} against the step before`).toBeLessThanOrEqual(was[k]);
          }
          expect(row.systemsBuilt).toBeGreaterThanOrEqual(1);
          for (const n of [row.discs, row.thingsNear, row.traffic, row.beyondRings, row.nebula.steps]) {
            expect(Number.isInteger(n) && n >= 0, `${level} step ${s}${floor ? ' floor' : ''}: ${n} is a whole count`).toBe(true);
          }
          expect(row.gargantuan).toBe(BUDGET[level].gargantuan);
          was = Object.fromEntries(numbers(row));
        }
        was = top;
      }
    }
  });

  it('leave the table as it was', () => {
    const before = JSON.stringify(BUDGET);
    at('high', 3, true);
    at('low', 2, false);
    expect(JSON.stringify(BUDGET)).toBe(before);
  });
});

describe('name tags (lane 3)', () => {
  it('are 3 on low and 6 above, lowered with the discs by the quality steps, never below one', () => {
    expect(['low', 'mid', 'high'].map((tier) => universeBudget({ tier }).tags)).toEqual([3, 6, 6]);
    expect(universeBudget({ tier: 'high', detail: 'ultra' }).tags).toBe(6);
    expect(universeBudget({ tier: 'mid' }, 2).tags).toBe(3);
    for (const tier of ['low', 'mid', 'high']) {
      for (let step = 0; step <= 3; step++) {
        for (const floor of [false, true]) {
          const n = universeBudget({ tier }, step, floor).tags;
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(universeBudget({ tier }).tags);
        }
      }
    }
  });
});
