import { describe, expect, it } from 'vitest';
import { TUNING, WORDS, findNews, findReadout, newFind, pickOurs, stepFind } from './find';

const ITEMS = ['jerryreal', 'jerrytv', 'jerrygown', 'jerrytux', 'jerrytrack', 'jerryrobe'];
const game = (o = {}) => newFind({ items: ITEMS, ours: 'jerrygown', ...o });
// presses, one a step (the stage steps them at no time), the last state and every event
const use = (g, ...ids) => {
  const seen = [];
  for (const id of ids) {
    g = stepFind(g, { use: id }, 0);
    seen.push(...g.events);
  }
  return { g, seen };
};
const TELLS = { ours: 'He asks if you’re hungry for apples', jerrytv: 'He shushes you for his programme' };

describe('the find kind: our Jerry among the Jerrys, against the clock', () => {
  it('waits, the clock still, till a Jerry is talked to', () => {
    const g = game();
    expect(g).toMatchObject({ phase: 'idle', items: ITEMS, ours: 'jerrygown', left: TUNING.s, len: TUNING.s, cost: TUNING.cost, heard: [], wrong: [], last: null, lastId: null, told: false, events: [] });
    const later = stepFind(g, {}, 5);
    expect(later).toMatchObject({ phase: 'idle', left: TUNING.s });
    expect(findReadout(g)).toEqual({ on: false, vitals: null, line: '' });
  });

  it('ignores a press on anyone who isn’t a candidate, and the clock runs on', () => {
    const run = use(game(), 'jerrytv').g;
    const after = stepFind(run, { use: 'receptionist' }, 0.05);
    expect(after).toMatchObject({ heard: ['jerrytv'], wrong: [] });
    expect(after.events).toEqual([]);
    expect(after.left).toBeCloseTo(TUNING.s - 0.05, 5);
    expect(stepFind(game(), { use: 'receptionist' }, 0.05).phase).toBe('idle');
  });

  it('talks to a Jerry the first time, and takes him the second: ours, and it’s won', () => {
    const { g, seen } = use(game(), 'jerrygown', 'jerrygown');
    expect(g.phase).toBe('won');
    expect(seen).toEqual([{ type: 'start' }, { type: 'talk', id: 'jerrygown' }, { type: 'won', id: 'jerrygown' }]);
  });

  it('costs time for a wrong one taken, once, and a wrong one again costs nothing more', () => {
    const wrong = use(game(), 'jerrytv', 'jerrytv');
    expect(wrong.g).toMatchObject({ phase: 'run', wrong: ['jerrytv'], left: TUNING.s - TUNING.cost, last: 'wrong' });
    expect(wrong.seen.at(-1)).toEqual({ type: 'wrong', id: 'jerrytv' });
    const again = use(wrong.g, 'jerrytv');
    expect(again.g).toMatchObject({ left: TUNING.s - TUNING.cost, last: 'again', wrong: ['jerrytv'] });
    expect(again.seen).toEqual([]);
  });

  it('is lost when the clock runs out, once', () => {
    let g = use(game(), 'jerrytv').g;
    const seen = [];
    for (let i = 0; i < Math.ceil(TUNING.s / 0.1) + 2; i++) {
      g = stepFind(g, {}, 0.1);
      seen.push(...g.events);
    }
    expect(g).toMatchObject({ phase: 'lost', left: 0 });
    expect(seen).toEqual([{ type: 'lost', why: 'time' }]);
  });

  it('is lost in the same step as the wrong pick that takes the last of the time', () => {
    const { g, seen } = use(game(), 'jerrytv', 'jerrytv', 'jerrytux', 'jerrytux', 'jerrytrack', 'jerrytrack');
    expect(g).toMatchObject({ phase: 'lost', left: 0 });
    expect(seen.slice(-2)).toEqual([{ type: 'wrong', id: 'jerrytrack' }, { type: 'lost', why: 'time' }]);
  });

  it('counts a long frame as a tenth of a second at most', () => {
    const g = stepFind(use(game(), 'jerrytv').g, {}, 5);
    expect(g.left).toBeCloseTo(TUNING.s - 0.1, 5);
  });

  it('changes nothing once it’s over', () => {
    const won = { ...game(), phase: 'won' };
    expect(stepFind(won, { use: 'jerrytv' }, 1)).toEqual({ ...won, events: [] });
    const lost = { ...game(), phase: 'lost', left: 0 };
    expect(stepFind(lost, { use: 'jerrygown' }, 1)).toEqual({ ...lost, events: [] });
  });

  it('takes perks and, until the shop decides what they do here, reads none', () => {
    expect(game({ perks: { slow: 2 } })).toEqual(game());
  });

  it('picks ours by the draw it’s given, always one of them', () => {
    expect(pickOurs(ITEMS, () => 0)).toBe('jerryreal');
    expect(pickOurs(ITEMS, () => 0.4)).toBe('jerrygown');
    expect(pickOurs(ITEMS, () => 0.999999)).toBe('jerryrobe');
    expect(pickOurs(ITEMS, () => 1)).toBe('jerryrobe');
  });

  it('tells the place what to say: the win till it’s kept, the loss once and not in a fade', () => {
    const won = { ...game(), phase: 'won' };
    expect(findNews(won, { done: false, fading: false })).toBe('done');
    expect(findNews(won, { done: true, fading: false })).toBe(null);
    const lost = { ...game(), phase: 'lost' };
    expect(findNews(lost, { done: false, fading: false })).toBe('caught');
    expect(findNews(lost, { done: false, fading: true })).toBe(null);
    expect(findNews({ ...lost, told: true }, { done: false, fading: false })).toBe(null);
    expect(findNews(game(), { done: false, fading: false })).toBe(null);
  });

  it('reads out the time left, and what the Jerry talked to does', () => {
    const ours = use(game(), 'jerrygown').g;
    expect(findReadout(ours, TELLS)).toEqual({ on: true, vitals: { value: 100, max: 100, low: false }, line: WORDS.heard(TELLS.ours) });
    expect(findReadout(use(game(), 'jerrytv').g, TELLS).line).toBe(WORDS.heard(TELLS.jerrytv));
    // (with no tells of its own, the words' own)
    expect(findReadout(ours).line).toBe(WORDS.heard(WORDS.ours));
    expect(findReadout(use(game(), 'jerrytux').g).line).toBe(WORDS.heard(WORDS.other));
    const wrong = use(game(), 'jerrytv', 'jerrytv').g;
    expect(findReadout(wrong, TELLS)).toMatchObject({ vitals: { value: 67, max: 100, low: false }, line: WORDS.wrong });
    expect(findReadout(use(wrong, 'jerrytv').g, TELLS).line).toBe(WORDS.again);
    const late = { ...ours, left: TUNING.s * 0.2 };
    expect(findReadout(late, TELLS).vitals.low).toBe(true);
    expect(findReadout(null)).toEqual({ on: false, vitals: null, line: '' });
    expect(findReadout(undefined)).toEqual({ on: false, vitals: null, line: '' });
  });

  it('has its words, one sentence each', () => {
    for (const line of [WORDS.wrong, WORDS.again, WORDS.heard(WORDS.ours), WORDS.heard(WORDS.other), WORDS.heard(TELLS.ours)]) {
      expect(line).not.toMatch(/!/);
      expect(line.split(/[.?]\s/)).toHaveLength(1);
    }
  });
});
