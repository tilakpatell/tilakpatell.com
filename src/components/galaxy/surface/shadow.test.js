import { describe, expect, it } from 'vitest';
import { snapToTexel } from './shadow';

describe('the sun’s shadow', () => {
  it('snaps the shadow to whole texels', () => {
    const [x, z] = snapToTexel(10.37, -3.21, 42, 2048);
    const t = 84 / 2048;
    expect(x / t).toBeCloseTo(Math.round(x / t), 6);
    expect(z / t).toBeCloseTo(Math.round(z / t), 6);
    expect(Math.abs(x - 10.37)).toBeLessThanOrEqual(t / 2);
    expect(Math.abs(z + 3.21)).toBeLessThanOrEqual(t / 2);
  });

  it('holds still while you move less than a texel', () => {
    const t = 84 / 2048;
    const a = snapToTexel(5 * t + t * 0.1, 0, 42, 2048);
    const b = snapToTexel(5 * t + t * 0.4, 0, 42, 2048);
    expect(b).toEqual(a);
  });
});
