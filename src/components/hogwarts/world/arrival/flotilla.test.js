import { describe, expect, it } from 'vitest';
import { hullGeometry } from './flotilla';

describe('the boats’ hulls', () => {
  it('are whole: no point of either skin is NaN, the bow pointed, the keel at the bottom', () => {
    for (const inset of [0, 0.035]) {
      const g = hullGeometry({ inset });
      const p = g.attributes.position.array;
      for (let i = 0; i < p.length; i++) expect(Number.isFinite(p[i]), `${inset} ${i}`).toBe(true);
      g.computeBoundingBox();
      expect(g.boundingBox.min.y).toBeGreaterThanOrEqual(-1e-6);
      expect(g.boundingBox.max.z - g.boundingBox.min.z).toBeCloseTo(4.3, 1);
      expect(g.boundingBox.max.x).toBeLessThan(0.8);
    }
  });
});
