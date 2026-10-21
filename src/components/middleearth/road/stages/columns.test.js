import { describe, expect, it } from 'vitest';
import { rankAt } from './columns';

describe('a marching column', () => {
  const road = { from: [0, 0], to: [0, 100], files: 4, gap: 2, spacing: 1, speed: 1.5 };

  it('keeps every marcher on its road, files abreast across it', () => {
    for (let i = 0; i < 40; i++) {
      const r = rankAt(i, 7.3, road);
      expect(r.z).toBeGreaterThanOrEqual(0);
      expect(r.z).toBeLessThan(100);
      expect(Math.abs(r.x)).toBeLessThanOrEqual(1.5 + 1e-9);
    }
    expect(Math.abs(rankAt(0, 0, road).x)).toBeCloseTo(1.5, 9);
    expect(rankAt(3, 0, road).x).toBeCloseTo(-rankAt(0, 0, road).x, 9);
  });

  it('marches at its speed, and comes round again at the start past the end', () => {
    expect(rankAt(0, 2, road).z - rankAt(0, 0, road).z).toBeCloseTo(3, 9);
    expect(rankAt(0, 100 / 1.5 + 1, road).z).toBeCloseTo(1.5, 6);
  });
});
