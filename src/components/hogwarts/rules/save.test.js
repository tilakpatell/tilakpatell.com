import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { SAVE, blank, houseOf, migrate, withArrival, withSorting } from './save';
import { sort } from './sorting';
import { wandFor } from './wand';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};

describe('the save under tp-hogwarts', () => {
  it('is one object under the world’s own key, with a version', () => {
    expect(SAVE.key).toBe('tp-hogwarts');
    expect(SAVE.version).toBeGreaterThanOrEqual(1);
    expect(blank()).toEqual({ house: null, wand: null, sorted: null, answers: null, password: null, arrived: 0 });
  });

  it('writes the house, the wand and when, from the Sorting', () => {
    const answers = [1, 2, 2];
    const result = sort(answers);
    const wand = wandFor(answers, result.house);
    const s = withSorting(blank(), { answers, result, wand, now: 1000 });
    expect(s).toMatchObject({ house: 'ravenclaw', sorted: 1000, answers, password: result.password });
    expect(s.wand.said).toBe(wand.said);
    expect(houseOf(s)).toBe('ravenclaw');
    expect(houseOf(blank())).toBeNull();
    expect(houseOf(null)).toBeNull();
  });

  it('keeps a later lane’s keys when the Sorting or the arrival writes', () => {
    const later = { ...blank(), points: { ravenclaw: 40 }, term: { week: 3 } };
    const answers = [0, 0, 0];
    const result = sort(answers);
    const s = withArrival(withSorting(later, { answers, result, wand: wandFor(answers, result.house), now: 5 }));
    expect(s.points).toEqual({ ravenclaw: 40 });
    expect(s.term).toEqual({ week: 3 });
    expect(s.arrived).toBe(1);
  });

  it('round-trips through the runtime’s saves, wrapped with its version', () => {
    const local = memory();
    const saves = createSaves({ local, session: memory() });
    saves.register({ ...SAVE, migrate });
    expect(saves.get(SAVE.key, null)).toBeNull();
    saves.set(SAVE.key, withArrival(blank()));
    expect(JSON.parse(local.m.get('tp-hogwarts'))).toEqual({ v: SAVE.version, data: withArrival(blank()) });
    expect(saves.get(SAVE.key).arrived).toBe(1);
  });

  it('takes an unversioned or broken value in under the blank', () => {
    expect(migrate({ house: 'hufflepuff' }, 0)).toEqual({ ...blank(), house: 'hufflepuff' });
    expect(migrate('rubbish', 0)).toEqual(blank());
    expect(migrate(null, 0)).toEqual(blank());
  });
});
