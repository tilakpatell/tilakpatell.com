import { describe, expect, it } from 'vitest';
import { BACK, ROWS_FROM, bandOf, onFeet, rowsFrom } from './band.js';

describe('the band a soldier is a row in', () => {
  it('starts at the character LOD group’s sixth distance times the preset’s LOD scale: the site’s own choice from the game’s table', () => {
    const scale = { low: 0.425, mid: 0.75, high: 1.2, ultra: 1.75 };
    for (const [level, k] of Object.entries(scale)) expect(ROWS_FROM[level], level).toBe(Math.round(52 * k));
    expect(rowsFrom('ultra')).toBe(91);
    expect(rowsFrom('low')).toBe(22);
    // (a level nobody named reads as high's, as lib/budgets.js does)
    expect(rowsFrom(undefined)).toBe(62);
    expect(rowsFrom('typo')).toBe(62);
  });

  it('takes a figure in past the distance and not at it', () => {
    expect(bandOf(90.9, 'figure', 91)).toBe('figure');
    expect(bandOf(91, 'figure', 91)).toBe('figure');
    expect(bandOf(91.01, 'figure', 91)).toBe('row');
    expect(bandOf(400, 'figure', 91)).toBe('row');
  });

  it('gives a row back only inside nine tenths of it', () => {
    expect(BACK).toBe(0.9);
    expect(bandOf(91, 'row', 91)).toBe('row');
    expect(bandOf(85, 'row', 91)).toBe('row');
    expect(bandOf(81.9, 'row', 91)).toBe('row');
    expect(bandOf(81.89, 'row', 91)).toBe('figure');
    expect(bandOf(10, 'row', 91)).toBe('figure');
  });

  it('holds a soldier walking the line: one change out, one change back, however many steps between', () => {
    let was = 'figure';
    let changes = 0;
    // out past the line, a hundred steps a metre either side of it, then home
    const walk = [80, 88, 92, ...Array.from({ length: 100 }, (_, i) => 91 + (i % 2 ? 1 : -1)), 86, 83, 80];
    for (const d of walk) {
      const now = bandOf(d, was, 91);
      if (now !== was) changes++;
      was = now;
    }
    expect(changes).toBe(2);
    expect(was).toBe('figure');
  });

  it('is a figure with no distance to go by', () => {
    expect(bandOf(NaN, 'row', 91)).toBe('figure');
    expect(bandOf(500, 'figure', 0)).toBe('figure');
    expect(bandOf(500, 'row', undefined)).toBe('figure');
  });

  it('holds only the living on their feet', () => {
    for (const state of ['alive', 'stand', 'crouch', 'roll']) expect(onFeet({ state }), state).toBe(true);
    for (const state of ['dying', 'down', 'deploying', 'thrown', undefined]) expect(onFeet({ state }), String(state)).toBe(false);
    expect(onFeet(null)).toBe(false);
  });
});
