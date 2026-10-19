import { describe, expect, it } from 'vitest';
import { TUNING, WORDS, curse, dealNews, dealReadout, newDeal, stepDeal } from './deal';

const ITEMS = ['typewriter', 'aftershave', 'cream', 'shopclock', 'shopmirror'];
const BAD = ['typewriter', 'aftershave', 'cream', 'shopclock'];
const game = (o = {}) => newDeal({ items: ITEMS, bad: BAD, ...o });
// presses, one a step, the last state and every event
const use = (g, ...ids) => {
  const seen = [];
  for (const id of ids) {
    g = stepDeal(g, { use: id });
    seen.push(...g.events);
  }
  return { g, seen };
};
// a seeded stand-in for Math.random
const seq = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('the deal kind: Needful Things’ free things, one with no curse', () => {
  it('waits, readout off, till a thing is used', () => {
    const g = game();
    expect(g).toMatchObject({ phase: 'idle', items: ITEMS, bad: BAD, need: TUNING.need, looks: TUNING.looks, left: TUNING.looks, seen: {}, taken: [], last: null, told: false, events: [] });
    expect(stepDeal(g, {}).phase).toBe('idle');
    expect(dealReadout(g)).toEqual({ on: false, vitals: null, line: '' });
  });

  it('looks a thing over the first time it’s used, a look a time', () => {
    const bad = use(game(), 'typewriter');
    expect(bad.g).toMatchObject({ phase: 'run', left: TUNING.looks - 1, last: 'bad', seen: { typewriter: 'bad' } });
    expect(bad.seen).toEqual([{ type: 'look', id: 'typewriter', saw: 'bad' }]);
    const good = use(game(), 'shopmirror');
    expect(good.g).toMatchObject({ left: TUNING.looks - 1, last: 'good', seen: { shopmirror: 'good' } });
    expect(good.seen).toEqual([{ type: 'look', id: 'shopmirror', saw: 'good' }]);
  });

  it('takes a thing seen clean the second time, and is won at the last one needed', () => {
    const { g, seen } = use(game(), 'shopmirror', 'shopmirror');
    expect(g).toMatchObject({ phase: 'won', taken: ['shopmirror'], last: 'taken' });
    expect(seen).toEqual([{ type: 'look', id: 'shopmirror', saw: 'good' }, { type: 'take', id: 'shopmirror' }, { type: 'won' }]);
  });

  it('leaves a thing seen cursed be: used again, nothing happens', () => {
    const { g, seen } = use(game(), 'typewriter', 'typewriter');
    expect(g).toMatchObject({ phase: 'run', taken: [], left: TUNING.looks - 1 });
    expect(seen).toEqual([{ type: 'look', id: 'typewriter', saw: 'bad' }]);
  });

  it('with no looks left, sees nothing, and a second use chances it: lost on a curse, taken on none', () => {
    const blind = use(game(), 'typewriter', 'aftershave', 'cream', 'shopclock');
    expect(blind.g).toMatchObject({ left: 0, last: 'blind', seen: { shopclock: 'blind' } });
    expect(blind.seen.at(-1)).toEqual({ type: 'look', id: 'shopclock', saw: 'blind' });
    const lost = use(blind.g, 'shopclock');
    expect(lost.g.phase).toBe('lost');
    expect(lost.seen).toEqual([{ type: 'lost', id: 'shopclock' }]);
    const lucky = use(game(), 'typewriter', 'aftershave', 'cream', 'shopmirror', 'shopmirror');
    expect(lucky.g.phase).toBe('won');
    expect(lucky.seen.slice(-2)).toEqual([{ type: 'take', id: 'shopmirror' }, { type: 'won' }]);
  });

  it('ignores a use of nothing, of what isn’t for sale, or of a thing taken', () => {
    const g = game({ need: 2, bad: ['typewriter'] });
    expect(stepDeal(g, { use: null })).toEqual({ ...g, events: [] });
    expect(stepDeal(g, { use: 'needful' })).toEqual({ ...g, events: [] });
    const taken = use(g, 'cream', 'cream').g;
    expect(stepDeal(taken, { use: 'cream' })).toEqual({ ...taken, events: [] });
  });

  it('counts the takings when more than one is needed', () => {
    const { g } = use(game({ need: 2, bad: ['typewriter'] }), 'cream', 'cream');
    expect(g).toMatchObject({ phase: 'run', taken: ['cream'] });
    expect(dealReadout(g).line).toBe('Taken 1 of 2');
  });

  it('changes nothing once it’s over', () => {
    const lost = { ...game(), phase: 'lost' };
    expect(stepDeal(lost, { use: 'shopmirror' })).toEqual({ ...lost, events: [] });
    const won = { ...game(), phase: 'won' };
    expect(stepDeal(won, { use: 'shopmirror' })).toEqual({ ...won, events: [] });
  });

  it('takes perks and, until the shop decides what they do here, reads none', () => {
    expect(game({ perks: { laser: 3 } })).toEqual(game());
  });

  it('curses n of the things by the draw it’s given, never all of them', () => {
    const a = curse(ITEMS, 4, seq(7));
    expect(a).toHaveLength(4);
    expect(new Set(a).size).toBe(4);
    for (const id of a) expect(ITEMS).toContain(id);
    expect(curse(ITEMS, 4, seq(7))).toEqual(a);
    expect(curse(ITEMS, 9, seq(3))).toHaveLength(ITEMS.length - 1);
    expect(curse(ITEMS, 0, seq(3))).toEqual([]);
    // (a different draw, a different shop: some seed curses another set)
    expect([1, 2, 3, 4, 5, 6].some((s) => curse(ITEMS, 4, seq(s)).join() !== a.join())).toBe(true);
  });

  it('tells the place what to say: the win till it’s kept, the loss once and not in a fade', () => {
    const won = { ...game(), phase: 'won' };
    expect(dealNews(won, { done: false, fading: false })).toBe('done');
    expect(dealNews(won, { done: true, fading: false })).toBe(null);
    const lost = { ...game(), phase: 'lost' };
    expect(dealNews(lost, { done: false, fading: false })).toBe('caught');
    expect(dealNews(lost, { done: false, fading: true })).toBe(null);
    expect(dealNews({ ...lost, told: true }, { done: false, fading: false })).toBe(null);
    expect(dealNews(game(), { done: false, fading: false })).toBe(null);
  });

  it('reads out for the HUD only while the deal’s on: the looks left, and what the last look said', () => {
    const one = use(game(), 'typewriter').g;
    expect(dealReadout(one)).toEqual({ on: true, vitals: { value: 2, max: 3, low: false }, line: WORDS.bad });
    expect(dealReadout(use(game(), 'shopmirror').g).line).toBe(WORDS.good);
    const none = use(game(), 'typewriter', 'aftershave', 'cream').g;
    expect(dealReadout(none).vitals).toEqual({ value: 0, max: 3, low: true });
    expect(dealReadout(use(none, 'shopclock').g).line).toBe(WORDS.blind);
    // (a place's own words: Pluto's, say)
    expect(dealReadout(one, { ...WORDS, bad: 'Not true.' }).line).toBe('Not true.');
    expect(dealReadout(null)).toEqual({ on: false, vitals: null, line: '' });
    expect(dealReadout(undefined)).toEqual({ on: false, vitals: null, line: '' });
  });

  it('has its words, one sentence each', () => {
    for (const line of [WORDS.good, WORDS.bad, WORDS.blind, WORDS.taken(1, 2)]) {
      expect(line).not.toMatch(/!/);
      expect(line.split(/[.?]\s/)).toHaveLength(1);
    }
  });
});
