import { describe, expect, it } from 'vitest';
import { CAMPS, COLUMN, REFUGE, fissures, strewn } from './place';

describe('Gorgoroth’s plain', () => {
  it('strews its boulders off the lane and the column’s road, clear of the camps, short of the slope', () => {
    const rocks = strewn(24, 150);
    expect(rocks.length).toBe(150);
    for (const [x, z, s] of rocks) {
      expect(Math.abs(x)).toBeGreaterThanOrEqual(6);
      expect(Math.abs(x - COLUMN.from[0])).toBeGreaterThan(2);
      expect(z).toBeLessThan(REFUGE[1] - 50);
      expect(s).toBeGreaterThan(0);
      for (const [cx, cz] of CAMPS) expect(Math.hypot(x - cx, z - cz)).toBeGreaterThanOrEqual(10);
    }
  });
  it('is the same plain on every load', () => {
    expect(strewn(24, 20)).toEqual(strewn(24, 20));
    expect(fissures(42, 5)).toEqual(fissures(42, 5));
  });
  it('cracks the plain either side, never across the lane', () => {
    const lines = fissures(42, 28);
    expect(lines.length).toBe(28);
    for (const line of lines) {
      expect(line.length).toBeGreaterThanOrEqual(4);
      for (const [x] of line) expect(Math.abs(x)).toBeGreaterThanOrEqual(6);
    }
  });
});
