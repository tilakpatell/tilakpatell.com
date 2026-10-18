import { describe, expect, it } from 'vitest';
import { CAST } from '../cast';
import { FLY } from './flight';
import { DEFAULT, HEROES, ORDER, canPlay, hero, speedFor } from './heroes';

describe('who he flies as', () => {
  it('is Mark by default, and Mark for any id it doesn’t know', () => {
    expect(DEFAULT).toBe('mark');
    expect(hero('nobody')).toBe(HEROES.mark);
    expect(hero(undefined)).toBe(HEROES.mark);
  });
  it('has a figure in the cast for each, and every one in the order', () => {
    for (const id of ORDER) expect(CAST[hero(id).cast], id).toBeTruthy();
    expect(Object.keys(HEROES).sort()).toEqual([...ORDER].sort());
  });
  it('Mark always; Eve once her race is won; Omni-Man after the truth; Thragg after the Regent', () => {
    expect(canPlay('mark')).toBe(true);
    expect(canPlay('eve', { story: { done: ['everace'], best: {} } })).toBe(false);
    expect(canPlay('eve', { story: { done: ['everace'], best: { everace: 41.5 } } })).toBe(true);
    expect(canPlay('omniman', { achievements: ['regent'] })).toBe(false);
    expect(canPlay('omniman', { achievements: ['truth'] })).toBe(true);
    expect(canPlay('thragg', { achievements: ['truth'] })).toBe(false);
    expect(canPlay('thragg', { achievements: ['regent'] })).toBe(true);
    expect(canPlay('nobody', { achievements: ['truth', 'regent'] })).toBe(false);
    expect(canPlay('eve', { story: 'garbage', achievements: 'garbage' })).toBe(false);
  });
  it('flies at his own top speed: Eve slower, Omni-Man at Mach 1.2, Thragg faster still', () => {
    expect(speedFor('mark')).toBe(FLY.top);
    expect(speedFor('eve')).toBeCloseTo(FLY.top * 0.8, 9);
    expect(speedFor('omniman') / 343).toBeCloseTo(1.2, 1);
    expect(speedFor('thragg')).toBeGreaterThan(speedFor('omniman'));
    expect(hero('omniman').flight.boom).toBe(90);
    expect(hero('thragg').fists).toBe(2);
  });
});
