import { describe, expect, it } from 'vitest';
import { hot } from './canvasTexture';

describe('a hot colour', () => {
  it('is the colour times k, over 1 where the bloom finds it', () => {
    const c = hot(0xff8000, 2.5);
    expect(c.r).toBeCloseTo(2.5, 6);
    expect(c.g).toBeGreaterThan(0.5);
    expect(c.b).toBe(0);
    expect(hot(0x808080).r).toBeCloseTo(hot(0x808080, 1).r, 9);
  });
});
