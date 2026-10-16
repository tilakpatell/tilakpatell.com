import { describe, expect, it } from 'vitest';
import { ORDER, TIERS, startRatio, tierAt, tierOfDetail } from './tiers';
import { STEPS } from '../../../lib/three/pace';

describe('the HQ games’ tiers', () => {
  it('takes lib/device’s level as before', () => {
    expect(tierOfDetail('low')).toBe('low');
    expect(tierOfDetail('mid')).toBe('medium');
    expect(tierOfDetail('high')).toBe('high');
    expect(tierOfDetail('ultra')).toBe('high');
    expect(tierOfDetail(undefined)).toBe('medium');
  });

  it('steps down from the start a level at a time, in the watchdog’s order, and stops at the last', () => {
    expect(ORDER).toEqual(['high', 'medium', 'low']);
    expect(tierAt('high', 0)).toEqual({ tier: 'high', slow: false });
    expect(tierAt('high', 1)).toEqual({ tier: 'medium', slow: false });
    expect(tierAt('high', 2)).toEqual({ tier: 'low', slow: false });
    expect(tierAt('high', 3)).toEqual({ tier: 'low', slow: false });
    expect(tierAt('medium', 1)).toEqual({ tier: 'low', slow: false });
    expect(tierAt('low', 2)).toEqual({ tier: 'low', slow: false });
  });

  it('is slow past the pace’s last step: the runtime’s floor, where the watchdog said onSlow', () => {
    expect(tierAt('high', STEPS.length - 1).slow).toBe(false);
    expect(tierAt('high', STEPS.length)).toEqual({ tier: 'low', slow: true });
    expect(tierAt('low', STEPS.length + 2).slow).toBe(true);
  });

  it('starts the canvas at the tier’s sharpness, never past the screen’s', () => {
    expect(startRatio('high', 2)).toBe(TIERS.high.dpr);
    expect(startRatio('high', 1)).toBe(1);
    expect(startRatio('medium', 3)).toBe(TIERS.medium.dpr);
    expect(startRatio('low', 2)).toBe(1);
    expect(startRatio('high', undefined)).toBe(1);
  });

  it('keeps a frame under the tier’s pixels on a screen as wide as three', () => {
    expect(startRatio('high', 2, 1470 * 956)).toBe(TIERS.high.dpr);
    const wide = 7680 * 2160;
    expect(startRatio('high', 2, wide)).toBeCloseTo(Math.sqrt(TIERS.high.pixels / wide), 6);
    expect(startRatio('high', 2, wide) ** 2 * wide).toBeLessThanOrEqual(TIERS.high.pixels + 1);
  });
});
