import { describe, expect, it } from 'vitest';
import { CHARACTERS, TERRAIN, groundOf } from './characters';
import { chartOf } from './sphere';
import { randomDirs } from './fixtures/generated';

const mid = ([a, b]) => (a + b) / 2;
const step4 = (dir, R, a) => chartOf(dir, R).toDir(Math.cos(a) * 4, Math.sin(a) * 4);

describe('the terrain characters', () => {
  it('are the eight the spec names', () => {
    expect(CHARACTERS).toEqual(['continents', 'archipelago', 'canyons', 'mesas', 'dunes', 'craters', 'ridges', 'plateaus']);
  });

  it.each(CHARACTERS)('%s: finite, within −190…1150 m, never more than 60 m in 4 m, at 15 km and 60 km', (kind) => {
    for (const R of [15000, 60000]) {
      const g = groundOf({ kind, sea: mid(TERRAIN[kind].sea), peaks: TERRAIN[kind].peaks[1] }, 11, R);
      for (const [i, d] of randomDirs(1000, 3).entries()) {
        const { h, land } = g(d);
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(-190);
        expect(h).toBeLessThanOrEqual(1150);
        expect(land).toBeGreaterThanOrEqual(0);
        expect(land).toBeLessThanOrEqual(1);
        expect(Math.abs(g(step4(d, R, i)).h - h), `${kind} ${R}`).toBeLessThanOrEqual(60);
      }
    }
  });

  it('puts the sea where it says: the share under 0 within 0.05 of `sea`', () => {
    for (const kind of ['continents', 'archipelago']) for (const sea of TERRAIN[kind].sea) {
      const g = groundOf({ kind, sea, peaks: mid(TERRAIN[kind].peaks) }, 5, 30000);
      const under = randomDirs(2000, 9).filter((d) => g(d).h < 0).length / 2000;
      expect(Math.abs(under - sea), `${kind} ${sea}`).toBeLessThanOrEqual(0.05);
    }
  });

  it('gives each its mark: ridges stand tall, craters dig in, dunes stay low', () => {
    const hs = (kind, peaks) => randomDirs(1500, 4).map((d) => groundOf({ kind, sea: 0.05, peaks }, 21, 25000)(d).h).sort((a, b) => a - b);
    expect(hs('ridges', 1000)[Math.floor(1500 * 0.95)]).toBeGreaterThanOrEqual(350);
    const cr = hs('craters', 200);
    expect(cr[Math.floor(1500 * 0.05)]).toBeLessThanOrEqual(cr[750] - 60);
    const du = hs('dunes', 40);
    expect(du[1499] - du[750]).toBeLessThanOrEqual(200);
  });
});
