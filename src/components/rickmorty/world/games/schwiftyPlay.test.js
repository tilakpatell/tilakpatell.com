import { describe, expect, it } from 'vitest';
import { LANE_KEYS, drawn, keyFor, padEdges, padFor, padLanes } from './schwiftyPlay';
import { TUNING, newRhythm, stepRhythm } from './rhythm';

describe('the show’s keys', () => {
  it('hits a lane and pauses while playing', () => {
    expect(LANE_KEYS).toHaveLength(4);
    expect(keyFor('play', 'ArrowLeft')).toEqual({ hit: 0 });
    expect(keyFor('play', 'f')).toEqual({ hit: 1 });
    expect(keyFor('play', 'J')).toEqual({ hit: 2 });
    expect(keyFor('play', 'ArrowRight')).toEqual({ hit: 3 });
    expect(keyFor('play', 'k')).toEqual({ hit: 3 });
    expect(keyFor('play', 'Escape')).toBe('pause');
    expect(keyFor('play', 'p')).toBe('pause');
    expect(keyFor('play', 'x')).toBe(null);
    expect(keyFor('intro', 'd')).toBe(null);
  });

  it('leaves on Esc from every card, the pause card too, where P plays on', () => {
    for (const phase of ['intro', 'paused', 'won', 'lost']) expect(keyFor(phase, 'Escape'), phase).toBe('leave');
    expect(keyFor('paused', 'P')).toBe('play');
    expect(keyFor('won', 'p')).toBe(null);
  });

  it('holds a key held down: a repeat neither leaves, nor pauses and plays, nor hits again', () => {
    expect(keyFor('play', 'Escape', false, true)).toBe('hold');
    expect(keyFor('paused', 'Escape', false, true)).toBe('hold');
    expect(keyFor('paused', 'p', false, true)).toBe('hold');
    expect(keyFor('play', 'd', false, true)).toBe('hold');
    expect(keyFor('play', 'x', false, true)).toBe(null);
  });

  it('holds every key on an end card that has only just come up', () => {
    expect(keyFor('won', 'Escape', true)).toBe('hold');
    expect(keyFor('lost', 'd', true)).toBe('hold');
    expect(keyFor('play', 'd', true)).toEqual({ hit: 0 });
  });
});

describe('the show on a controller', () => {
  it('counts a button already down when the show opens as no press (the A that opened it doesn’t start the song)', () => {
    expect(padEdges({ a: true }, null)).toEqual({});
    expect(padEdges({ a: true, left: true }, {})).toEqual({ a: true, left: true });
    expect(padEdges({ a: true }, { a: true })).toEqual({});
    expect(padEdges(null, {})).toEqual({});
  });

  it('starts, pauses, plays on, leaves and goes again on its buttons, the pause card too', () => {
    expect(padFor('intro', { a: true })).toBe('start');
    expect(padFor('intro', { b: true })).toBe('leave');
    expect(padFor('play', { start: true })).toBe('pause');
    expect(padFor('paused', { start: true })).toBe('play');
    expect(padFor('paused', { a: true })).toBe('play');
    expect(padFor('paused', { b: true })).toBe('leave');
    expect(padFor('lost', { a: true })).toBe('again');
    expect(padFor('won', { b: true })).toBe('leave');
    expect(padFor('won', { a: true }, true)).toBe('hold');
    expect(padFor('play', { left: true })).toBe(null);
  });

  it('hits a lane for each of the d-pad’s four, left to right', () => {
    expect(padLanes({ left: true, right: true })).toEqual([0, 3]);
    expect(padLanes({ down: true, up: true })).toEqual([1, 2]);
    expect(padLanes({ a: true })).toEqual([]);
  });
});

describe('what the show redraws', () => {
  const to = (g, t) => {
    while (g.t < t - 1e-9) g = stepRhythm(g, {}, Math.min(1 / 60, t - g.t));
    return g;
  };
  it('redraws for a hit, a miss and a note coming into view, not for one falling', () => {
    const first = newRhythm().notes[0];
    const a = to(newRhythm(), first.t - TUNING.fall + 0.1);
    expect(drawn(to(a, a.t + 0.2))).toBe(drawn(a));
    const second = a.notes[1];
    expect(drawn(to(a, second.t - TUNING.fall + 0.05))).not.toBe(drawn(a));
    const near = to(a, first.t);
    expect(drawn(stepRhythm(near, { hit: first.lane }, 0))).not.toBe(drawn(near));
    expect(drawn(to(near, first.t + TUNING.good + 0.05))).not.toBe(drawn(near));
  });
});
