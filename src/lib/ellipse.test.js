import { describe, expect, it } from 'vitest';
import { ellipseLength } from './ellipse';

describe('ellipseLength', () => {
  it('is a circle’s circumference when the radii agree', () => {
    expect(ellipseLength(50, 50)).toBeCloseTo(2 * Math.PI * 50, 9);
  });

  it('matches the rim of the One Ring’s path to a hair', () => {
    // the elliptic integral, summed finely: the rim of the 112 × 50 path
    let sum = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * Math.PI * 2;
      sum += Math.hypot(112 * Math.sin(t), 50 * Math.cos(t));
    }
    expect(ellipseLength(112, 50)).toBeCloseTo((sum * Math.PI * 2) / n, 2);
  });

  it('reads the same either way round', () => {
    expect(ellipseLength(104, 46)).toBe(ellipseLength(46, 104));
  });
});
