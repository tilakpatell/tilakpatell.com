import { describe, expect, it } from 'vitest';
import { autoPlayerOf, loadRulebook } from '../rulebook.js';
import { createWaves, due, forceOf, forced, pauseOf } from './waves.js';

const ap = autoPlayerOf(loadRulebook());

describe('the AutoPlayers’ waves', () => {
  it('reads the server’s pause table: the attackers’ 30 s, the defenders’ by phase', () => {
    expect(pauseOf(ap, 'attack', { phase: 1 })).toBe(30);
    expect(pauseOf(ap, 'attack', { phase: 3 })).toBe(30);
    expect([1, 2, 3, 4].map((phase) => pauseOf(ap, 'defend', { phase }))).toEqual([12, 6, 3, 0]);
    expect(pauseOf(ap, 'defend', { phase: 5 })).toBe(15);
  });

  it('shortens the pause by the kill ratio for the points held', () => {
    expect(pauseOf(ap, 'attack', { held: 1 })).toBeCloseTo(30 / 1.1, 9);
    expect(pauseOf(ap, 'attack', { held: 3 })).toBeCloseTo(30 / 1.3, 9);
    expect(pauseOf(ap, 'attack', { held: 9 })).toBeCloseTo(30 / 1.3, 9);
  });

  it('forces a bot back after the phase’s force time', () => {
    expect([1, 2, 3, 4, 5].map((phase) => forceOf(ap, 'attack', { phase }))).toEqual([55, 50, 45, 40, 40]);
    expect([1, 2, 3, 4, 5].map((phase) => forceOf(ap, 'defend', { phase }))).toEqual([40, 45, 50, 55, 55]);
    expect(forceOf(ap, 'attack', { phase: 9 })).toBe(60);
    const w = createWaves(ap, 'attack');
    expect(forced(w, 0, 54, { phase: 1 })).toBe(false);
    expect(forced(w, 0, 55, { phase: 1 })).toBe(true);
  });

  it('opens a wave at the spawn time, then every spawn time plus pause', () => {
    const w = createWaves(ap, 'defend');
    expect(due(w, 4.9, { phase: 1 })).toBe(false);
    expect(due(w, 5, { phase: 1 })).toBe(true);
    expect(due(w, 5.05, { phase: 1 })).toBe(false);
    expect(w.next).toBeCloseTo(5 + 5 + 12, 9);
    expect(due(w, 22, { phase: 4 })).toBe(true);
    expect(w.next).toBeCloseTo(27, 9);
  });
});
