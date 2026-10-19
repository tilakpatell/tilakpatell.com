import { describe, expect, it } from 'vitest';
import { enemyShare, heartsToHealth } from './vitalsOf';

describe('a duel’s hearts as health (the site’s one scale: 100 on foot)', () => {
  it('makes Morty’s three hearts a hundred, a hit taking 34', () => {
    expect(heartsToHealth(3, 3)).toEqual({ value: 100, max: 100, low: false });
    expect(heartsToHealth(2, 3)).toEqual({ value: 66, max: 100, low: false });
    expect(heartsToHealth(1, 3)).toEqual({ value: 32, max: 100, low: true });
    expect(heartsToHealth(0, 3)).toEqual({ value: 0, max: 100, low: true });
  });
  it('is low on the last heart, whatever the count', () => {
    expect(heartsToHealth(1, 5).low).toBe(true);
    expect(heartsToHealth(2, 5).low).toBe(false);
  });
  it('reads nonsense as a full bar', () => {
    expect(heartsToHealth(Number.NaN, 0)).toEqual({ value: 100, max: 100, low: false });
  });
});

describe('an enemy’s hits as a share of its full', () => {
  it('keeps its hits, shown as how much is left', () => {
    expect(enemyShare(6, 6)).toBe(100);
    expect(enemyShare(4, 6)).toBe(67);
    expect(enemyShare(0, 6)).toBe(0);
    expect(enemyShare(3, 0)).toBe(100);
  });
});
