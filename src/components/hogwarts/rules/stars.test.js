import { describe, expect, it } from 'vitest';
import { STARS, TELESCOPES, along, caption, dirOf, night } from './stars';

describe('the sky from the Astronomy Tower', () => {
  it('stands every star over the horizon, each with a line of the site’s own', () => {
    expect(new Set(STARS.map((s) => s.name)).size).toBe(STARS.length);
    for (const s of STARS) {
      expect(s.el).toBeGreaterThanOrEqual(0);
      expect(s.el).toBeLessThanOrEqual(90);
      expect(s.az).toBeGreaterThanOrEqual(0);
      expect(s.az).toBeLessThan(360);
      expect(s.says).toMatch(new RegExp(`^${s.name}`));
      expect(s.says).not.toMatch(/['"]/);
    }
  });

  it('points north up the y-less −z, east along +x, and overhead up', () => {
    const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
    expect(near(dirOf(0, 0), [0, 0, -1])).toBe(true);
    expect(near(dirOf(90, 0), [1, 0, 0])).toBe(true);
    expect(near(dirOf(0, 90), [0, 1, 0])).toBe(true);
  });

  it('leaves every telescope pointing at something, brightest first', () => {
    for (const t of TELESCOPES) {
      const seen = along(t.az, t.el);
      expect(seen.length, t.id).toBeGreaterThan(0);
      for (let i = 1; i < seen.length; i++) expect(seen[i].mag).toBeGreaterThanOrEqual(seen[i - 1].mag);
      expect(caption(seen)).toMatch(/\.$/);
    }
  });

  it('names the stars an old family named its children after, through the telescopes', () => {
    const seen = new Set(TELESCOPES.flatMap((t) => along(t.az, t.el).map((s) => s.name)));
    for (const name of ['Bellatrix', 'Mirach', 'Pollux', 'Schedar', 'Polaris']) expect(seen.has(name), name).toBe(true);
  });

  it('says so when a telescope finds nothing, and knows night from day', () => {
    expect(caption([])).toMatch(/Nothing/);
    expect(night(23)).toBe(true);
    expect(night(2)).toBe(true);
    expect(night(12)).toBe(false);
  });
});
