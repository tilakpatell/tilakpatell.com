import { describe, expect, it } from 'vitest';
import { hatch, peaks, range, trees, wood } from './mapData';

describe('the painters’ helpers', () => {
  it('stands peaks along a straight range as it always did, in either form', () => {
    const old = peaks(0, 0, 130, 0);
    expect(old).toHaveLength(11);
    expect(old[0]).toEqual([-3, 0, 9]);
    expect(old[1]).toEqual([16, 0, 9]);
    expect(peaks([[0, 0], [130, 0]])).toEqual(old);
  });
  it('follows a polyline without doubling a joint', () => {
    const p = peaks([[0, 0], [26, 0], [26, 26]], 13, 9);
    expect(p).toHaveLength(5);
    expect(p.map(([, y]) => y)).toEqual([0, 0, 0, 13, 26]);
    expect(range([[0, 0], [26, 0]])).toMatch(/^M/);
  });
  it('plants the same trees in an ellipse as wood() does, and keeps a polygon’s inside it', () => {
    expect(trees({ at: [50, 50], rx: 10, ry: 5 }, 7, 12)).toEqual(wood(50, 50, 10, 5, 7, 12));
    const tri = { points: [[0, 0], [100, 0], [0, 100]] };
    const t = trees(tri, 11, 40);
    expect(t).toHaveLength(40);
    for (const [x, y] of t) expect(x + y).toBeLessThan(100);
    expect(trees(tri, 11, 40)).toEqual(t);
  });
  it('hatches a marsh with level strokes inside it', () => {
    const h = hatch({ at: [100, 100], rx: 20, ry: 10 });
    expect(h.length).toBeGreaterThan(10);
    for (const [x0, y, x1] of h) {
      expect(x1 - x0).toBeCloseTo(2.6, 9);
      expect(((x0 - 100) / 20) ** 2 + ((y - 100) / 10) ** 2).toBeLessThan(1);
    }
  });
});
