import { describe, expect, it } from 'vitest';
import { FLOOR_PIXELS, floorRatio } from './floorRatio';

// Low is the floor in the Star Wars worlds (the every-chip-plays addendum):
// a drawing buffer of 1,280 × 720 at most, stretched to the screen
describe('the drawing buffer at the floor', () => {
  it('holds Low to 921,600 pixels whatever the window, and leaves every other level its own ratio', () => {
    expect(FLOOR_PIXELS).toBe(1280 * 720);
    const r = floorRatio(1.25, { w: 1920, h: 1080, detail: 'low' });
    expect(Math.round(1920 * r) * Math.round(1080 * r)).toBeLessThanOrEqual(FLOOR_PIXELS + 2000);
    expect(r).toBeCloseTo(2 / 3, 3);
    expect(floorRatio(1.25, { w: 1920, h: 1080, detail: 'mid' })).toBe(1.25);
    // (a window already under the floor keeps its ratio, never sharper than asked)
    expect(floorRatio(1, { w: 1024, h: 600, detail: 'low' })).toBe(1);
    expect(floorRatio(2, { w: 0, h: 0, detail: 'low' })).toBe(2);
  });
});
