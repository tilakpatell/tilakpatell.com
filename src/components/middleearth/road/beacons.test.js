import { describe, expect, it } from 'vitest';
import { BEACONS, EVERY, lit } from './beacons';

describe('the beacons of Gondor', () => {
  it('none lit before the beat, then one every 1.8 s, seven at the last', () => {
    expect(BEACONS).toBe(7);
    expect(EVERY).toBe(1.8);
    expect(lit(null)).toBe(0);
    expect(lit(-1)).toBe(0);
    expect(lit(0)).toBe(1);
    expect(lit(1.79)).toBe(1);
    expect(lit(1.8)).toBe(2);
    expect(lit(EVERY * 6)).toBe(7);
    expect(lit(100)).toBe(7);
    expect(lit(Infinity)).toBe(7);
  });
});
