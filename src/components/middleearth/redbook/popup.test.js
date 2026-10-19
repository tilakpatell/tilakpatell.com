import { describe, expect, it } from 'vitest';
import { rise } from './popup';

describe('a pop-up piece’s rise', () => {
  it('lies flat with the book shut and stands with it open', () => {
    for (const at of [0, 0.3, 0.8, 1]) {
      expect(rise(0, at)).toBe(0);
      expect(rise(1, at)).toBeCloseTo(1);
    }
  });

  it('only ever rises as the book opens', () => {
    for (const at of [0, 0.5, 1]) {
      let was = 0;
      for (let o = 0; o <= 1.0001; o += 0.02) {
        const r = rise(Math.min(1, o), at);
        expect(r).toBeGreaterThanOrEqual(was - 1e-9);
        was = r;
      }
    }
  });

  it('lifts the near pieces first and the far ones last', () => {
    expect(rise(0.4, 0)).toBeGreaterThan(rise(0.4, 1));
    expect(rise(0.15, 1)).toBe(0);
  });
});
