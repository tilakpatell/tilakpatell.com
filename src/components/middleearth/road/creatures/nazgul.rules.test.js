import { describe, expect, it } from 'vitest';
import { SEARCH, kingsPose, search } from './nazgul.rules';

describe('a Nazgûl’s search', () => {
  it('sweeps the same way every six seconds, never further than it can turn', () => {
    expect(SEARCH).toBe(6);
    for (let t = 0; t < SEARCH; t += 0.25) {
      const a = search(t);
      const b = search(t + SEARCH);
      expect(b.yaw).toBeCloseTo(a.yaw, 9);
      expect(Math.abs(a.yaw)).toBeLessThanOrEqual(0.75 + 1e-9);
      expect(a.sniff).toBeGreaterThanOrEqual(0);
      expect(a.sniff).toBeLessThanOrEqual(1);
    }
  });

  it('turns left, then right, then bows to the roots and breathes in hardest there', () => {
    expect(search(2).yaw).toBeCloseTo(0.75, 2);
    expect(search(4).yaw).toBeCloseTo(-0.75, 2);
    const low = search(5);
    expect(low.pitch).toBeGreaterThan(0.5);
    expect(low.sniff).toBeGreaterThan(search(1).sniff);
    expect(search(0).pitch).toBeCloseTo(0, 6);
  });
});

describe('the king under the cloak', () => {
  it('none of him with no vision, all of him at its height, the cloak the other way', () => {
    expect(kingsPose(0)).toEqual({ cloak: 1, king: 0, crown: 0 });
    expect(kingsPose(1)).toEqual({ cloak: 0, king: 1, crown: 1 });
  });

  it('shows by degrees as the vision rises, the crown last', () => {
    let last = kingsPose(0);
    for (let a = 0.05; a <= 1; a += 0.05) {
      const k = kingsPose(a);
      expect(k.king).toBeGreaterThanOrEqual(last.king);
      expect(k.cloak).toBeLessThanOrEqual(last.cloak);
      expect(k.crown).toBeLessThanOrEqual(k.king);
      last = k;
    }
  });
});
