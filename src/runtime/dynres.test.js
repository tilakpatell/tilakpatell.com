import { describe, expect, it } from 'vitest';
import { DYNRES, createDynres, dynresFor } from './dynres';

// feed n frames of ms each; the scales returned, in order, with their frame
const feed = (d, n, ms) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = d.frame(ms);
    if (s !== null) out.push([i + 1, s]);
  }
  return out;
};

describe('createDynres', () => {
  it('carries Unreal’s constants, each with its source', () => {
    expect(DYNRES).toMatchObject({ budgetMs: 16.7, headroom: 0.1, threshold: 0.05, minPeriod: 8, history: 16, panic: 3, floor: 0.67, ceiling: 1 });
    expect(DYNRES._source).toMatch(/r\.DynamicRes/);
  });

  it('starts at the ceiling, level 0', () => {
    const d = createDynres();
    expect(d.scale).toBe(1);
    expect(d.level).toBe(0);
  });

  it('steps down once the 16-frame median is over the target, then waits at least 8 frames', () => {
    // (20 ms is over the budget too: the panic is off here to see the median's own step)
    const calm = createDynres({ panic: Infinity });
    expect(feed(calm, 16, 20)).toEqual([[16, 0.77]]);
    expect(calm.level).toBe(1);
    // the next 7 frames make no change, whatever they say
    expect(feed(calm, 7, 40)).toEqual([]);
  });

  it('drops a step at once after 3 frames in a row over the budget', () => {
    const d = createDynres();
    expect(feed(d, 3, 30)).toEqual([[3, 0.77]]);
    // (and again only after 3 more: the count starts over)
    expect(feed(d, 2, 30)).toEqual([]);
    expect(feed(d, 1, 30)).toEqual([[1, 0.67]]);
  });

  it('never goes under its floor, nor over its ceiling', () => {
    const d = createDynres();
    feed(d, 60, 100);
    expect(d.scale).toBe(0.67);
    const phone = createDynres({ floor: 0.58 });
    feed(phone, 60, 100);
    // (no step at 0.58: the last of RESOLUTION_STEPS at or over the floor)
    expect(phone.scale).toBe(0.67);
    const low = createDynres({ floor: 0.5 });
    feed(low, 60, 100);
    expect(low.scale).toBe(0.5);
  });

  it('climbs back a step after the minimum period when the median is well under the target and the next step fits', () => {
    const d = createDynres();
    d.set(1);
    // 8 ms at 0.77 is 13.5 ms at 1: under the 15 ms target, so it climbs
    expect(feed(d, 16, 8)).toEqual([[16, 1]]);
    expect(d.level).toBe(0);
  });

  it('does not climb into a step its own prediction says would miss (no see-saw)', () => {
    const d = createDynres();
    d.set(1);
    // 10 ms at 0.77 is 16.9 ms at 1: over the target, so it stays
    expect(feed(d, 40, 10)).toEqual([]);
    expect(d.level).toBe(1);
  });

  it('ignores frames with no reading and drops a pause (over 250 ms) from the history', () => {
    const d = createDynres();
    expect(feed(d, 10, null)).toEqual([]);
    expect(d.frame(300)).toBe(null);
    expect(d.frame(300)).toBe(null);
    expect(d.frame(300)).toBe(null);
    expect(d.scale).toBe(1);
    expect(d.frames).toBe(0);
  });

  it('makes no change smaller than the threshold', () => {
    const d = createDynres({ steps: [1, 0.97, 0.5], floor: 0.5 });
    // (1 → 0.97 is 3 %: under the 5 % threshold, so it goes straight to 0.5)
    expect(feed(d, 3, 30)).toEqual([[3, 0.5]]);
  });

  it('holds its ceiling at 1 whatever sharpness asks (the upscaler cannot downscale)', () => {
    expect(createDynres({ ceiling: 1.5 }).scale).toBe(1);
    expect(createDynres({ ceiling: 0.8 }).scale).toBe(0.77);
  });

  it('reset() starts it again at the ceiling with nothing counted', () => {
    const d = createDynres();
    feed(d, 3, 30);
    d.reset();
    expect(d.scale).toBe(1);
    expect(d.frames).toBe(0);
    expect(feed(d, 2, 30)).toEqual([]);
  });
});

describe('dynresFor', () => {
  // (T0 aims at 60 like the rest since 2026-10-13, under its lower floor;
  // runtime/cadence.js's createCadence takes it to an even 30 when it cannot)
  it('budgets 33.3 ms when the visitor pins 30, 16.7 otherwise, and floors T0 at 0.58', () => {
    expect(dynresFor({ tier: 'T1' })).toMatchObject({ budgetMs: 16.7, floor: 0.67 });
    expect(dynresFor({ tier: 'ultra' })).toMatchObject({ budgetMs: 16.7, floor: 0.67 });
    expect(dynresFor({ tier: 'T0' })).toMatchObject({ budgetMs: 16.7, floor: 0.58 });
    expect(dynresFor({ tier: 'high', fps: 30 })).toMatchObject({ budgetMs: 33.3, floor: 0.67 });
  });
});
