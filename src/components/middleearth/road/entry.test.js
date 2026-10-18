import { describe, expect, it } from 'vitest';
import { FIRST_VISIT_RIDES, OFFERED, SAVE, firstVisitRides, resume, ridden, savedAt, shouldOffer } from './entry';
import { sOf } from './line';
import { STAGES } from './stages/index';

const saves = (local = {}, session = {}) => ({ get: (k, fb = null) => local[k] ?? fb, session: { get: (k, fb = null) => session[k] ?? fb } });

describe('the way in: the save, the resume card, the first visit', () => {
  it('keeps the ride under tp-road, version 1', () => {
    expect(SAVE).toEqual({ key: 'tp-road', version: 1 });
  });

  it('a save is where the ride is, whether it was ridden, and when', () => {
    expect(savedAt(0.5, 1000, false)).toEqual({ v: 1, s: 0.5, ridden: false, at: 1000 });
  });

  it('a lost context put back within a minute carries on with no title card again', () => {
    expect(resume({ s: 0.4, at: 1000 }, 1000 + 59_000)).toEqual({ s: 0.4, showTitle: false });
    expect(resume({ s: 0.4, at: 1000 }, 1000 + 61_000)).toEqual({ s: 0.4, showTitle: true });
    expect(resume(null, 5)).toEqual({ s: 0, showTitle: true });
  });

  it('offers to carry on only from past Hobbiton’s first 40 m', () => {
    expect(shouldOffer(null)).toBe(false);
    expect(shouldOffer({ s: sOf(STAGES, 'hobbiton', 30) })).toBe(false);
    expect(shouldOffer({ s: sOf(STAGES, 'hobbiton', 50) })).toBe(true);
    expect(shouldOffer({ s: 1 })).toBe(true);
  });

  it('counts the Road ridden once two thirds of it are walked', () => {
    expect(ridden(null)).toBe(false);
    expect(ridden({ s: 0.6 })).toBe(false);
    expect(ridden({ s: 2 / 3 })).toBe(true);
    expect(ridden({ s: 0.1, ridden: true })).toBe(true);
  });

  it('a first visit rides the Road once: no seal, no ride, not offered this session', () => {
    expect(FIRST_VISIT_RIDES).toBe(true);
    expect(firstVisitRides(saves(), [])).toBe(true);
    expect(firstVisitRides(saves(), ['mushrooms'])).toBe(false);
    expect(firstVisitRides(saves({ 'tp-road': { v: 1, data: { s: 0.1 } } }), [])).toBe(false);
    expect(firstVisitRides(saves({}, { [OFFERED]: true }), [])).toBe(false);
    expect(firstVisitRides(saves(), [], { flag: false })).toBe(false);
  });
});
