import { describe, expect, it } from 'vitest';
import { BEATS, FADE, HOLD, WAIT, gate, keysOf, newDeed, stepDeed, verbOf } from './deeds';

const none = { act: false, acting: false, left: false, right: false, pick: null };
const run = (deed, inputs, o = {}) => inputs.reduce((s, input) => stepDeed(s, deed, { ...none, ...input }, { dt: 0.1, ...o }), newDeed());

describe('the deeds', () => {
  it('a press is done by one press, and by nothing else', () => {
    const deed = { verb: 'press', label: 'Light the dragon' };
    expect(run(deed, [{}, { acting: true }, { left: true }]).done).toBe(false);
    const done = run(deed, [{}, { act: true }]);
    expect(done).toMatchObject({ done: true, by: 'you', progress: 1 });
  });

  it('a hold fills while held and drains when let go, done once full', () => {
    const deed = { verb: 'hold', label: 'Hold the bridge', seconds: 2 };
    const half = run(deed, Array(10).fill({ acting: true }));
    expect(half.progress).toBeCloseTo(0.5, 6);
    expect(half.done).toBe(false);
    const let_go = stepDeed(half, deed, none, { dt: 1 });
    expect(let_go.progress).toBeCloseTo(0.5 - FADE, 6);
    expect(run(deed, Array(21).fill({ acting: true })).done).toBe(true);
    expect(run({ verb: 'hold', label: 'x' }, Array(Math.ceil(HOLD / 0.1) + 1).fill({ acting: true })).done).toBe(true);
  });

  it('a rhythm is the two keys in turn: the same key twice is one stroke', () => {
    const deed = { verb: 'rhythm', label: 'Paddle', beats: 4 };
    const same = run(deed, [{ left: true }, { left: true }, { left: true }]);
    expect(same.progress).toBeLessThan(0.3);
    const turns = run(deed, [{ left: true }, { right: true }, { left: true }, { right: true }]);
    expect(turns.done).toBe(true);
    // (E stands in for whichever is due)
    expect(run(deed, [{ act: true }, { act: true }, { act: true }, { act: true }]).done).toBe(true);
    expect(run({ verb: 'rhythm', label: 'x' }, Array(BEATS).fill(0).map((_, i) => (i % 2 ? { right: true } : { left: true }))).done).toBe(true);
  });

  it('a choice is done by the right word; a wrong one is remembered, and another try allowed', () => {
    const deed = { verb: 'choose', label: 'Speak, friend', choices: [{ label: 'Edro' }, { label: 'Annon' }, { label: 'Mellon', right: true }] };
    const wrong = run(deed, [{ pick: 0 }]);
    expect(wrong).toMatchObject({ done: false, wrong: 0 });
    expect(run(deed, [{ pick: 0 }, { pick: 2 }])).toMatchObject({ done: true, by: 'you', wrong: null });
    expect(run(deed, [{ pick: 7 }]).done).toBe(false);
  });

  it('letting the road walk, the company does it once you have had your time; walking yourself, it waits', () => {
    const deed = { verb: 'hold', label: 'x', wait: 1 };
    expect(run(deed, Array(9).fill({}), { auto: true }).done).toBe(false);
    expect(run(deed, Array(11).fill({}), { auto: true })).toMatchObject({ done: true, by: 'company' });
    expect(run(deed, Array(200).fill({}), { auto: false }).done).toBe(false);
    expect(run({ verb: 'press', label: 'x' }, Array(Math.round(WAIT / 0.1) + 1).fill({}), { auto: true }).by).toBe('company');
  });

  it('under reduced motion a hold or a rhythm is one press, and the prompt says so', () => {
    for (const verb of ['hold', 'rhythm']) {
      const deed = { verb, label: 'x' };
      expect(verbOf(deed, true)).toBe('press');
      expect(keysOf(deed, true)).toBe('E');
      expect(run(deed, [{ act: true }], { reduced: true }).done).toBe(true);
    }
    expect(keysOf({ verb: 'hold' })).toBe('Hold E');
    expect(keysOf({ verb: 'rhythm' })).toBe('A D');
    expect(keysOf({ verb: 'choose', choices: [{}, {}, {}] })).toBe('1 2 3');
  });

  it('the walk stops at a deed undone, and goes on once it is done', () => {
    const beats = [{ id: 'a', at: 10 }, { id: 'b', at: 40, deed: { verb: 'press', label: 'x' } }, { id: 'c', at: 70, deed: { verb: 'press', label: 'y' } }];
    expect(gate(beats, {})).toEqual([40, 70]);
    expect(gate(beats, { b: { done: true } })).toEqual([70]);
  });
});
