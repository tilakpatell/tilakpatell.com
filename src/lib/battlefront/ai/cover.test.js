import { describe, expect, it } from 'vitest';
import { aiOf, loadRulebook } from '../rulebook.js';
import { field } from '../fixtures/field.js';
import { buildNav } from '../nav.js';
import { curveAt, pickCover, queryFor, scoreSlots, unknownTerms } from './cover.js';

const ai = aiOf(loadRulebook());
const nav = buildNav({ ...field(), cover: ai.cover.constants });

describe('cover queries', () => {
  it('read the game’s curves, steps and all', () => {
    expect(curveAt([-30, -30, 0, 0, 60, 60, 90, 90], [0, 1, 1, 2, 2, 1, 1, 0], 10)).toBe(2);
    expect(curveAt([-30, -30, 0, 0, 60, 60, 90, 90], [0, 1, 1, 2, 2, 1, 1, 0], -10)).toBe(1);
    expect(curveAt([0, 0, 25, 50, 50], [0, 0, 5, 5, 0], 12.5)).toBe(2.5);
    expect(curveAt([100], [2], 7)).toBe(2);
    expect(curveAt([0, 20, 20], [2, 0, -1], 30)).toBe(-1);
  });

  it('prefer a slot that shields from the threat and lies nearer the objective', () => {
    // the threat north of the wall: only the south face's slots shield
    const query = queryFor(ai, 'attack');
    const ctx = { me: [0, 5], threat: [0, 45], query, range: 200, objective: [14, 18], nav };
    const slots = nav.slots.filter((s) => s.solid === 0);
    const ranked = scoreSlots(slots, ctx);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((r) => r.slot.normal[1] < 0)).toBe(true);
    const near = ranked.find((r) => r.slot.at[0] > 10);
    const far = ranked.find((r) => r.slot.at[0] < -10);
    expect(near.score).toBeGreaterThan(far.score);
  });

  it('give nothing when no slot is in the query’s reach', () => {
    const hide = queryFor(ai, 'hide');
    expect(pickCover(nav, { me: [-80, -80], threat: [-80, -40], query: hide, range: 200 })).toBeNull();
    expect(pickCover(nav, { me: [0, 17], threat: [0, 45], query: hide, range: 200 })).not.toBeNull();
  });

  it('skip a slot another bot holds', () => {
    const query = queryFor(ai, 'attack');
    const ctx = { me: [0, 5], threat: [0, 45], query, range: 200 };
    const best = scoreSlots(nav.slots, ctx)[0].slot;
    const taken = new Map([[best, 'other']]);
    expect(scoreSlots(nav.slots, { ...ctx, taken, who: 'me' })[0].slot).not.toBe(best);
    expect(scoreSlots(nav.slots, { ...ctx, taken: new Map([[best, 'me']]), who: 'me' })[0].slot).toBe(best);
  });

  it('count the terms it does not read', () => {
    scoreSlots(nav.slots.slice(0, 1), { me: [0, 5], threat: [0, 45], query: ai.cover.queries.Hide, range: 200 });
    expect(unknownTerms.has('CoverSelectData')).toBe(true);
    expect(unknownTerms.has('CoverQueryStyle_Angle')).toBe(false);
  });
});
