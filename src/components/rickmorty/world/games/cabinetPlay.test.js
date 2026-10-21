import { describe, expect, it } from 'vitest';
import { newCabinet, stepCabinet } from './cabinet';
import { drawn, keyFor } from './cabinetPlay';

describe('the cabinet’s keys', () => {
  it('smashes a chute and pauses while playing', () => {
    expect(keyFor('play', 'ArrowLeft')).toEqual({ smash: 0 });
    expect(keyFor('play', 's')).toEqual({ smash: 1 });
    expect(keyFor('play', 'D')).toEqual({ smash: 2 });
    expect(keyFor('play', 'Escape')).toBe('pause');
    expect(keyFor('play', 'p')).toBe('pause');
  });

  it('leaves on Esc from every card, the pause card too, where P plays on', () => {
    for (const phase of ['intro', 'paused', 'won', 'lost']) expect(keyFor(phase, 'Escape'), phase).toBe('leave');
    expect(keyFor('paused', 'P')).toBe('play');
    expect(keyFor('intro', 'ArrowDown')).toBe(null);
    expect(keyFor('intro', 'p')).toBe(null);
  });

  it('holds every key on an end card that has only just come up', () => {
    for (const phase of ['won', 'lost']) for (const key of ['Escape', 'Enter', ' ', 'ArrowLeft']) expect(keyFor(phase, key, true), `${phase} ${key}`).toBe('hold');
    expect(keyFor('lost', 'Enter')).toBe(null);
  });
});

describe('what the cabinet redraws', () => {
  it('keeps a frame that only moves the plumbuses down to their elements', () => {
    let g = newCabinet({ seed: 3 });
    while (!g.drops.length) g = stepCabinet(g, {});
    const next = stepCabinet(g, {});
    expect(next.drops[0].y).toBeGreaterThan(g.drops[0].y);
    expect(drawn(next)).toBe(drawn(g));
  });

  it('redraws for a smash, a miss, a new plumbus and the stick', () => {
    const g = { ...newCabinet({ seed: 3 }), drops: [{ id: 1, lane: 0, y: 0.8 }] };
    expect(drawn(stepCabinet(g, { smash: 0 }))).not.toBe(drawn(g)); // a smash: the score, one plumbus fewer
    expect(drawn(stepCabinet(g, { smash: 2 }))).not.toBe(drawn(g)); // a swing at nothing: the stick
    expect(drawn({ ...g, lives: 2 })).not.toBe(drawn(g));
    expect(drawn({ ...g, drops: [...g.drops, { id: 2, lane: 1, y: 0 }] })).not.toBe(drawn(g));
  });
});
