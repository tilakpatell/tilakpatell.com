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

  it('read a step as the game does: at its edge, the value after it', () => {
    const xs = [-90, -90, 90, 90];
    const ys = [-1, 0, 0, -1];
    expect(curveAt(xs, ys, -90)).toBe(0);
    expect(curveAt(xs, ys, -91)).toBe(-1);
    expect(curveAt(xs, ys, 89)).toBe(0);
    expect(curveAt(xs, ys, 90)).toBe(-1);
  });

  // slots in the open south of a threat at [0, 40], each a full-height solid on its north side
  const slot = (x, z, normal = [0, -1], height = 'stand') => ({ at: [x, 0, z], normal, height });
  const ctx = (terms, over = {}) => ({ me: [0, 0], threat: [0, 40], query: { terms }, range: 200, ...over });
  const D = (x, score, extra = {}) => ({ term: 'CoverQueryStyle_Distance', from: 'CoverQueryPosition_ActorPosition', to: 'CoverQueryPosition_CoverPosition', ref: 'CoverQueryDirection_CoverDirection', x, score, filter: ['StandCovers', 'CrouchCovers'], ...extra });

  it('reject a slot any term scores below nothing, where it was added to the total', () => {
    const near = slot(0, 10);
    const far = slot(0, 30);
    const ranked = scoreSlots([near, far], ctx([D([0, 20, 20], [2, 0, -1])]));
    expect(ranked.map((r) => r.slot)).toEqual([near]);
  });

  it('measure an angle from the term’s own reference: the cover’s facing, not the line to the bot', () => {
    // (two slots on the line from the threat to the bot: one facing straight away from the threat, one turned 80°)
    const square = slot(0, 10);
    const turned = slot(0, 12, [Math.sin((-100 * Math.PI) / 180), Math.cos((-100 * Math.PI) / 180)]);
    const term = { term: 'CoverQueryStyle_Angle', from: 'CoverQueryPosition_TargetPosition', to: 'CoverQueryPosition_CoverPosition', ref: 'CoverQueryDirection_CoverDirection', x: [-70, -70, 70, 70], score: [-1, 0, 0, -1], filter: ['StandCovers'] };
    const ranked = scoreSlots([square, turned], ctx([term]));
    expect(ranked.map((r) => r.slot)).toEqual([square]);
  });

  it('apply a term only to the cover kinds and top its filter names, and count the sides it cannot know by their best', () => {
    const stand = slot(0, 10);
    const low = slot(2, 10, [0, -1], 'crouch');
    // (an open cover’s penalty touches neither; a top-blocked term the stand slot alone)
    const open = D([100], [-1], { filter: ['OpenCovers', 'OpenDirectionalCovers'] });
    const top = D([100], [3], { filter: ['TopBlocked', 'StandCovers', 'CrouchCovers'] });
    const scored = scoreSlots([stand, low], ctx([open, top]));
    expect(scored.map((r) => [r.slot, r.score])).toEqual([
      [stand, 3],
      [low, 0],
    ]);
    // (one side open or the other: a slot with both open takes both; both closed is worth more here)
    const left = D([100], [2], { filter: ['LeftNotBlocked', 'StandCovers'] });
    const right = D([100], [1], { filter: ['RightNotBlocked', 'StandCovers'] });
    expect(scoreSlots([stand], ctx([left, right]))[0].score).toBe(3);
    const closed = D([100], [5], { filter: ['LeftBlocked', 'RightBlocked', 'StandCovers'] });
    expect(scoreSlots([stand], ctx([left, right, closed]))[0].score).toBe(5);
  });

  it('skip a term the record switches off, and take a preferred-range term’s X from the weapon', () => {
    const s = slot(0, 0);
    expect(scoreSlots([s], ctx([D([100], [-1], { enabled: false })]))).toHaveLength(1);
    // (the cover 40 m from the target: past the rifle’s 30 m end, where the record’s own X ran to 50)
    const range = { term: 'CoverQueryStyle_Distance', from: 'CoverQueryPosition_CoverPosition', to: 'CoverQueryPosition_TargetPosition', ref: 'CoverQueryDirection_TargetToActorDirection', x: [0, 0, 25, 50, 50], score: [0, 0, 5, 5, 0], filter: ['StandCovers'], xSource: 'WeaponPreferredRange' };
    // (no preferred range given: the record’s own X, whose 5 runs to 50 m)
    expect(scoreSlots([s], ctx([range]))[0].score).toBe(5);
    expect(scoreSlots([s], ctx([range], { preferred: { Start: 0, Ideal: 0.5, End: 30 } }))[0].score).toBe(0);
    expect(scoreSlots([slot(0, 25)], ctx([range], { preferred: { Start: 0, Ideal: 0.5, End: 30 } }))[0].score).toBe(5);
  });

  it('count the terms it does not read', () => {
    scoreSlots(nav.slots.slice(0, 1), { me: [0, 5], threat: [0, 45], query: ai.cover.queries.Hide, range: 200 });
    expect(unknownTerms.has('CoverSelectData')).toBe(true);
    expect(unknownTerms.has('CoverQueryStyle_Angle')).toBe(false);
  });
});
