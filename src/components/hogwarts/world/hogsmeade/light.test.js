import { describe, expect, it } from 'vitest';
import { skyAt } from './light';

describe('the village’s light', () => {
  it('is day at noon and night at nine, with the sun up and down', () => {
    const noon = skyAt(13);
    const nine = skyAt(21);
    expect(noon.day).toBeGreaterThan(0.95);
    expect(noon.sun.dir[1]).toBeGreaterThan(0.3);
    expect(nine.night).toBeGreaterThan(0.95);
    expect(nine.sun.dir[1]).toBeLessThan(0);
    // (the key light is the moon’s by night, high up)
    expect(nine.key.dir[1]).toBeGreaterThan(0.4);
  });

  it('lights the shop windows and the lamps as it gets dark, and puts the stars out by day', () => {
    expect(skyAt(21).windows).toBeGreaterThan(0.9);
    expect(skyAt(21).lamps).toBeGreaterThan(0.9);
    expect(skyAt(12).lamps).toBeLessThan(0.05);
    expect(skyAt(12).windows).toBeLessThan(0.3);
    expect(skyAt(12).stars).toBe(0);
    expect(skyAt(1).stars).toBeGreaterThan(0.9);
  });

  it('has a dusk either end of the day', () => {
    expect(skyAt(8).dusk).toBeGreaterThan(0.5);
    expect(skyAt(18).dusk).toBeGreaterThan(0.5);
    expect(skyAt(13).dusk).toBeLessThan(0.1);
    expect(skyAt(23).dusk).toBe(0);
  });

  it('wraps the hours and keeps every colour a colour', () => {
    expect(skyAt(25).hour).toBe(1);
    for (let h = 0; h < 24; h += 0.5) {
      const s = skyAt(h, { snow: 1 });
      for (const c of [s.zenith, s.horizon, s.fog.colour, s.key.colour, s.hemi.sky, s.hemi.ground, s.smoke]) for (const v of c) expect(v >= 0 && v <= 1, `${h}`).toBe(true);
      expect(Math.hypot(...s.key.dir)).toBeCloseTo(1);
      expect(s.exposure).toBeGreaterThan(0.9);
    }
  });
});
