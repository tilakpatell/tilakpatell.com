import { describe, expect, it } from 'vitest';
import { TUNING, WORDS, litSets, newSequence, runningOrder, sequenceNews, sequenceReadout, stepSequence } from './sequence';

const ITEMS = ['set-ants', 'set-legs', 'set-sneezy', 'set-field', 'set-doors', 'set-bits', 'set-shmlo'];
const ORDER = ['set-sneezy', 'set-ants', 'set-bits', 'set-field', 'set-legs'];
const game = (o = {}) => newSequence({ items: ITEMS, order: ORDER, start: true, ...o });
// the countdown started, then presses, one a step (the stage steps them at no time): the last state and every event
const play = (g, ...ids) => {
  const seen = [];
  for (const id of ids) {
    g = stepSequence(g, id === 'start' ? { start: true } : { use: id }, 0);
    seen.push(...g.events);
  }
  return { g, seen };
};
const LABELS = { 'set-ants': 'Ants in my Eyes Johnson’s Electronics', 'set-sneezy': 'Mr. Sneezy', 'set-legs': 'Baby Legs and Regular Legs' };

describe('the sequence kind: the sets on in the running order, against the clock', () => {
  it('waits, the clock still, till the countdown’s started, and a set used first only says to start it', () => {
    const g = game();
    expect(g).toMatchObject({ phase: 'idle', items: ITEMS, order: ORDER, on: 0, start: true, left: TUNING.s, len: TUNING.s, last: null, told: false, events: [] });
    expect(stepSequence(g, {}, 5)).toMatchObject({ phase: 'idle', left: TUNING.s });
    const early = stepSequence(g, { use: 'set-sneezy' }, 0);
    expect(early).toMatchObject({ phase: 'idle', on: 0, last: null });
    // (the place says to start the countdown first: a set pressed early isn't a set that does nothing)
    expect(early.events).toEqual([{ type: 'early', id: 'set-sneezy' }]);
    const { g: run, seen } = play(g, 'start');
    expect(run).toMatchObject({ phase: 'run', on: 0 });
    expect(seen).toEqual([{ type: 'start' }]);
    // (started again while it runs: nothing)
    expect(play(run, 'start').seen).toEqual([]);
  });

  it('starts at the first set used, for a place with no start spot, and judges that set', () => {
    const right = play(game({ start: false }), 'set-sneezy');
    expect(right.g).toMatchObject({ phase: 'run', on: 1, last: 'on' });
    expect(right.seen).toEqual([{ type: 'start' }, { type: 'on', id: 'set-sneezy' }]);
    const wrong = play(game({ start: false }), 'set-legs');
    expect(wrong.g).toMatchObject({ phase: 'run', on: 0, last: 'dark' });
    expect(wrong.seen).toEqual([{ type: 'start' }, { type: 'dark', id: 'set-legs' }]);
    // (and a start spot pressed on a place without one: nothing)
    expect(play(game({ start: false }), 'start').g.phase).toBe('idle');
  });

  it('switches the sets on in order, and is won at the last', () => {
    const { g, seen } = play(game(), 'start', ...ORDER);
    expect(g).toMatchObject({ phase: 'won', on: ORDER.length });
    expect(seen).toEqual([{ type: 'start' }, ...ORDER.map((id) => ({ type: 'on', id })), { type: 'won' }]);
    // (no clock that step)
    expect(g.left).toBe(TUNING.s);
  });

  it('turns them all dark at a wrong set, back to the first, and the clock runs on', () => {
    const two = play(game(), 'start', 'set-sneezy', 'set-ants').g;
    const { g, seen } = play(two, 'set-field');
    expect(g).toMatchObject({ phase: 'run', on: 0, last: 'dark' });
    expect(seen).toEqual([{ type: 'dark', id: 'set-field' }]);
    expect(stepSequence(g, {}, 0.05).left).toBeCloseTo(TUNING.s - 0.05, 5);
    // (one of the two not dealt this run is as wrong)
    expect(play(two, 'set-doors').g).toMatchObject({ on: 0, last: 'dark' });
  });

  it('says dark at a wrong set before any is on, at no cost', () => {
    const { g, seen } = play(game(), 'start', 'set-shmlo');
    expect(g).toMatchObject({ phase: 'run', on: 0, last: 'dark', left: TUNING.s });
    expect(seen.at(-1)).toEqual({ type: 'dark', id: 'set-shmlo' });
  });

  it('costs nothing for a set already on, used again', () => {
    const two = play(game(), 'start', 'set-sneezy', 'set-ants').g;
    const { g, seen } = play(two, 'set-sneezy');
    expect(g).toMatchObject({ phase: 'run', on: 2, last: 'again', left: TUNING.s });
    expect(seen).toEqual([]);
  });

  it('ignores a use that isn’t one of the sets, and the clock runs on', () => {
    const run = play(game(), 'start', 'set-sneezy').g;
    const after = stepSequence(run, { use: 'cablebooth' }, 0.05);
    expect(after).toMatchObject({ on: 1, last: 'on' });
    expect(after.events).toEqual([]);
    expect(after.left).toBeCloseTo(TUNING.s - 0.05, 5);
  });

  it('is lost when the clock runs out, once', () => {
    let g = play(game(), 'start').g;
    const seen = [];
    for (let i = 0; i < Math.ceil(TUNING.s / 0.1) + 2; i++) {
      g = stepSequence(g, {}, 0.1);
      seen.push(...g.events);
    }
    expect(g).toMatchObject({ phase: 'lost', left: 0 });
    expect(seen).toEqual([{ type: 'lost', why: 'time' }]);
  });

  it('counts a long frame as a tenth of a second at most', () => {
    const g = stepSequence(play(game(), 'start').g, {}, 5);
    expect(g.left).toBeCloseTo(TUNING.s - 0.1, 5);
  });

  it('changes nothing once it’s over', () => {
    const won = { ...game(), phase: 'won' };
    expect(stepSequence(won, { use: 'set-sneezy' }, 1)).toEqual({ ...won, events: [] });
    const lost = { ...game(), phase: 'lost', left: 0 };
    expect(stepSequence(lost, { start: true }, 1)).toEqual({ ...lost, events: [] });
  });

  it('takes perks and, until the shop decides what they do here, reads none', () => {
    expect(game({ perks: { slow: 2 } })).toEqual(game());
  });

  it('deals a running order of distinct sets by the draw it’s given', () => {
    for (const r of [0, 0.5, 0.999999]) {
      const order = runningOrder(ITEMS, 5, () => r);
      expect(order).toHaveLength(5);
      expect(new Set(order).size).toBe(5);
      for (const id of order) expect(ITEMS).toContain(id);
    }
    expect(runningOrder(ITEMS, 5, () => 0)).not.toEqual(runningOrder(ITEMS, 5, () => 0.999999));
    // (the items it's dealt from left as they were)
    expect(ITEMS).toEqual(['set-ants', 'set-legs', 'set-sneezy', 'set-field', 'set-doors', 'set-bits', 'set-shmlo']);
  });

  it('tells the place what to say: the win till it’s kept, the loss once and not in a fade', () => {
    const won = { ...game(), phase: 'won' };
    expect(sequenceNews(won, { done: false, fading: false })).toBe('done');
    expect(sequenceNews(won, { done: true, fading: false })).toBe(null);
    const lost = { ...game(), phase: 'lost' };
    expect(sequenceNews(lost, { done: false, fading: false })).toBe('caught');
    expect(sequenceNews(lost, { done: false, fading: true })).toBe(null);
    expect(sequenceNews({ ...lost, told: true }, { done: false, fading: false })).toBe(null);
    expect(sequenceNews(game(), { done: false, fading: false })).toBe(null);
  });

  it('reads out the time left and the next set, and the dark after a wrong one', () => {
    const started = play(game(), 'start').g;
    expect(sequenceReadout(started, LABELS)).toEqual({ on: true, vitals: { value: 100, max: 100, low: false }, line: WORDS.next('Mr. Sneezy', 0, 5) });
    const one = play(started, 'set-sneezy').g;
    expect(sequenceReadout(one, LABELS).line).toBe(WORDS.next('Ants in my Eyes Johnson’s Electronics', 1, 5));
    expect(sequenceReadout(play(one, 'set-sneezy').g, LABELS).line).toBe(WORDS.again('Ants in my Eyes Johnson’s Electronics'));
    expect(sequenceReadout(play(one, 'set-legs').g, LABELS).line).toBe(WORDS.dark('Mr. Sneezy'));
    // (a set with no label is named by its id)
    expect(sequenceReadout(play(one, 'set-ants').g, LABELS).line).toBe(WORDS.next('set-bits', 2, 5));
    expect(sequenceReadout({ ...one, left: TUNING.s * 0.2 }, LABELS).vitals).toEqual({ value: 20, max: 100, low: true });
    expect(sequenceReadout(game(), LABELS)).toEqual({ on: false, vitals: null, line: '' });
    expect(sequenceReadout(null)).toEqual({ on: false, vitals: null, line: '' });
    expect(sequenceReadout(undefined)).toEqual({ on: false, vitals: null, line: '' });
  });

  it('lights the sets that are on, and every set once the task’s done', () => {
    expect(litSets(game(), false)).toEqual([]);
    expect(litSets(play(game(), 'start', 'set-sneezy', 'set-ants').g, false)).toEqual(['set-sneezy', 'set-ants']);
    expect(litSets(game(), true)).toEqual(ITEMS);
  });

  it('has its words, one sentence each', () => {
    // (a label of its own may have a stop in it, Mr. Sneezy's: these are the words')
    for (const line of [WORDS.next('Lil’ Bits', 2, 5), WORDS.dark('Lil’ Bits'), WORDS.again('Lil’ Bits')]) {
      expect(line).not.toMatch(/!/);
      expect(line.split(/[.?]\s/)).toHaveLength(1);
    }
  });
});
