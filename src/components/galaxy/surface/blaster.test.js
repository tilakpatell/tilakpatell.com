import { describe, expect, it } from 'vitest';
import { sweptHit } from './blaster';

describe('a bolt going by', () => {
  it('hits what a fast bolt passed through', () => {
    expect(sweptHit([0, 1, -2], [0, 1, 2], [0, 1, 0], 0.55)).toBe(true);
    expect(sweptHit([0, 1, -2], [0, 1, 2], [2, 1, 0], 0.55)).toBe(false);
  });

  it('misses over your head or short of you', () => {
    expect(sweptHit([0, 3.5, -2], [0, 3.5, 2], [0, 1, 0], 0.55)).toBe(false);
    expect(sweptHit([0, 1, -4], [0, 1, -2], [0, 1, 0], 0.55)).toBe(false);
  });
});
