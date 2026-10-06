import { describe, expect, it } from 'vitest';
import { fogCutoff } from './actors';

describe('the people out in the fog', () => {
  it('knows where the fog swallows people', () => {
    expect(fogCutoff(0.01)).toBeCloseTo(Math.sqrt(-Math.log(0.03)) / 0.01, 3);
    // (no fog: never)
    expect(fogCutoff(0)).toBe(Infinity);
  });
});
