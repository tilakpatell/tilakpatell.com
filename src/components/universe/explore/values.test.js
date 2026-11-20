import { describe, expect, it } from 'vitest';
import { WORTH, worthOf } from './values';

describe('what a find is worth', () => {
  it('pays its kind’s worth near home, more far out and in a rich region', () => {
    expect(worthOf('system', 0, 0)).toBe(WORTH.system);
    expect(worthOf('system', 30, 0)).toBe(Math.round(25 * 3.4));
    expect(worthOf('system', 60, 0)).toBe(Math.round(25 * 3.4));
    expect(worthOf('gargantuan', 10, 1)).toBe(Math.round(400 * 1.8 * 2));
  });

  it('pays nothing for a kind it doesn’t know', () => {
    expect(worthOf('nothing', 5)).toBe(0);
  });
});
