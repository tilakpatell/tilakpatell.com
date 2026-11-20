import { describe, expect, it } from 'vitest';
import { hopPoint, hyperRoute, isGenerated, sectorGap } from './route';

describe('the hyperdrive’s reach', () => {
  it('holds only generated places to it', () => {
    expect(isGenerated('E:3,4:w10002')).toBe(true);
    expect(isGenerated('resume')).toBe(false);
    expect(isGenerated(null)).toBe(false);
  });

  it('goes in one jump within range', () => {
    expect(sectorGap([0, 0, 0], [2, -1, 1])).toBe(2);
    expect(hyperRoute([0, 0, 0], [2, -1, 1], 2)).toEqual([[2, -1, 1]]);
  });

  it('goes in hops past it, none longer than the range, the last the target', () => {
    for (const [from, to, range] of [
      [[0, 0, 0], [40, 3, -7], 2],
      [[5, 1, 5], [-30, 0, 12], 8],
      [[0, 0, 0], [10, 0, 0], 4],
    ]) {
      const hops = hyperRoute(from, to, range);
      expect(hops.length).toBe(Math.ceil(sectorGap(from, to) / range));
      expect(hops.at(-1)).toEqual(to);
      let at = from;
      for (const h of hops) {
        expect(sectorGap(at, h)).toBeLessThanOrEqual(range);
        at = h;
      }
    }
  });

  it('takes 20 hops for 40 sectors at Mk I and 2 at Mk V', () => {
    expect(hyperRoute([0, 0, 0], [40, 0, 0], 2)).toHaveLength(20);
    expect(hyperRoute([0, 0, 0], [40, 0, 0], 24)).toHaveLength(2);
  });

  it('comes out along the straight line', () => {
    expect(hopPoint([0, 0, 0], [100, 50, -10], 1, 2)).toEqual([50, 25, -5]);
  });
});
