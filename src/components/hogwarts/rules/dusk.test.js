import { describe, expect, it } from 'vitest';
import { DUSK, dirOf, lightAt } from './dusk';

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('the light from dusk into night', () => {
  it('opens on the last of the sunset: the sun just up, the horizon warm, a few stars', () => {
    const l = lightAt(0);
    expect(l.sun.el).toBeGreaterThan(0);
    expect(l.horizon[0]).toBeGreaterThan(l.horizon[2]); // (orange, not blue)
    expect(l.stars).toBeLessThan(0.3);
    expect(l.windows).toBeGreaterThan(0.5); // (the castle is lit from the first)
  });

  it('goes down into the night and holds there', () => {
    const n = lightAt(DUSK.length);
    expect(n.sun.el).toBeLessThan(0);
    expect(n.stars).toBe(1);
    expect(n.windows).toBe(1);
    expect(lum(n.zenith)).toBeLessThan(lum(lightAt(0).zenith));
    expect(lightAt(DUSK.length * 3)).toEqual(n);
  });

  it('darkens steadily, never brightening on the way, and lifts the eye’s exposure as it goes', () => {
    let was = lightAt(0);
    for (let t = 10; t <= DUSK.length; t += 10) {
      const l = lightAt(t);
      expect(lum(l.horizon), `${t}`).toBeLessThanOrEqual(lum(was.horizon) + 1e-9);
      expect(l.stars).toBeGreaterThanOrEqual(was.stars - 1e-9);
      expect(l.exposure).toBeGreaterThanOrEqual(was.exposure - 1e-9);
      was = l;
    }
  });

  it('keys the scene by the sun while it’s up and by the moon after, from over the castle’s right shoulder', () => {
    expect(lightAt(0).key.dir).toEqual(dirOf(lightAt(0).sun.el, lightAt(0).sun.az));
    const night = lightAt(DUSK.length);
    expect(night.key.dir).toEqual(night.moon.dir);
    expect(night.moon.dir[0]).toBeGreaterThan(0); // (to the right of the castle, which is down −z)
    expect(night.moon.dir[2]).toBeLessThan(0);
  });

  it('is night at once under reduced motion: no change to sit through', () => {
    expect(lightAt(0, { reduced: true })).toEqual(lightAt(DUSK.length));
  });

  it('points a direction by its height and bearing: up is up, bearing 0 down −z', () => {
    expect(dirOf(Math.PI / 2, 0)[1]).toBeCloseTo(1, 9);
    const [x, y, z] = dirOf(0, 0);
    expect([x, y, z].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([0, 0, -1]);
  });
});
