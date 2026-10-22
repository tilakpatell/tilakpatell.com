import { describe, expect, it } from 'vitest';
import { MONTHS, TERM, advance, isChristmas, isLeaving, newTerm, parseWeek, seasonOf, weekLabel } from './term';

const run = (term, list) => {
  const events = [];
  for (const e of list) {
    const r = advance(term, e);
    term = r.term;
    events.push(...r.events);
  }
  return { term, events };
};

describe('the term', () => {
  it('is twelve weeks from September to June', () => {
    expect(TERM.weeks).toBe(12);
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe('September');
    expect(MONTHS[TERM.christmas - 1]).toBe('December');
    expect(MONTHS[11]).toBe('June');
    expect(weekLabel(6)).toBe('Week 6 · December');
  });

  it('moves on a week for a night in your bed and for a lesson finished', () => {
    const r = run(newTerm({ day: 0 }), [{ type: 'sleep', day: 1 }, { type: 'lesson-done', day: 1 }]);
    expect(r.term.week).toBe(3);
    expect(r.events.map((e) => e.why)).toEqual(['slept', 'lesson']);
    expect(r.term.began).toBe(1);
  });

  it('moves on by itself every three world days', () => {
    let t = newTerm({ day: 0 });
    const weeks = [];
    for (let day = 0; day <= 9; day++) {
      t = advance(t, { type: 'day', day }).term;
      weeks.push(t.week);
    }
    expect(weeks).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4]);
  });

  it('brings Christmas at the sixth week and the leaving feast at the twelfth, and holds there', () => {
    const r = run(newTerm(), Array.from({ length: 15 }, (_, i) => ({ type: 'sleep', day: i + 1 })));
    expect(r.term.week).toBe(12);
    expect(r.events.filter((e) => e.type === 'christmas')).toHaveLength(1);
    expect(r.events.filter((e) => e.type === 'leaving')).toHaveLength(1);
    expect(r.events.filter((e) => e.type === 'week')).toHaveLength(11);
  });

  it('starts the next year only once the leaving feast is held', () => {
    const end = newTerm({ week: 12, day: 30 });
    expect(advance(end, { type: 'year', day: 31 }).term.week).toBe(12);
    const fed = advance(end, { type: 'feast' }).term;
    expect(fed.feast).toBe(true);
    const next = advance(fed, { type: 'year', day: 31 }).term;
    expect(next).toEqual(expect.objectContaining({ week: 1, year: 2, feast: false, began: 31 }));
    // (and a feast before the last week is no leaving feast)
    expect(advance(newTerm({ week: 6 }), { type: 'feast' }).term.feast).toBe(false);
  });

  it('turns the seasons', () => {
    expect([1, 5, 6, 8, 9, 11, 12].map(seasonOf)).toEqual(['autumn', 'autumn', 'winter', 'winter', 'spring', 'spring', 'summer']);
    expect(isChristmas(6)).toBe(true);
    expect(isLeaving(12)).toBe(true);
    expect(isLeaving(11)).toBe(false);
  });

  it('reads ?week= and nothing else', () => {
    expect(parseWeek('?week=7')).toBe(7);
    expect(parseWeek('week=12&at=night')).toBe(12);
    expect(parseWeek(new URLSearchParams('week=3'))).toBe(3);
    expect(parseWeek('?week=13')).toBeNull();
    expect(parseWeek('?week=two')).toBeNull();
    expect(parseWeek('?at=night')).toBeNull();
    expect(newTerm({ week: 40 }).week).toBe(12);
  });
});
