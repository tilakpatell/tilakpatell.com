import { describe, expect, it } from 'vitest';
import { BEAT, FLAPS, GLIDE, LIFT, flap } from './eagle.rules';

describe('the Eagles’ wings', () => {
  it('beat between the up and the down stroke, then glide, once every 4 s', () => {
    expect(BEAT).toBe(4);
    for (let t = 0; t < BEAT * 2; t += 0.02) {
      const a = flap(t);
      expect(Math.abs(a)).toBeLessThanOrEqual(LIFT + 1e-9);
      if (t % BEAT > FLAPS) expect(a).toBeCloseTo(GLIDE, 9);
    }
    // (the beats reach both strokes)
    const as = Array.from({ length: 200 }, (_, i) => flap((i / 200) * FLAPS));
    expect(Math.max(...as)).toBeGreaterThan(LIFT * 0.9);
    expect(Math.min(...as)).toBeLessThan(-LIFT * 0.9);
  });

  it('a phase sets each eagle apart, and the wings are smooth into the glide', () => {
    expect(flap(1, 0.5)).not.toBeCloseTo(flap(1, 0), 3);
    expect(flap(FLAPS - 1e-4)).toBeCloseTo(GLIDE, 2);
    expect(flap(BEAT + 1e-4)).toBeCloseTo(GLIDE, 2);
  });
});
