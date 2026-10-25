import { describe, expect, it } from 'vitest';
import { CHARACTERS, FIB_512, TERRAIN, groundOf } from './characters';
import { chartOf } from './sphere';
import { randomDirs } from './fixtures/generated';

const mid = ([a, b]) => (a + b) / 2;
const step4 = (dir, R, a) => chartOf(dir, R).toDir(Math.cos(a) * 4, Math.sin(a) * 4);

describe('the terrain characters', () => {
  it('are the eight the spec names', () => {
    expect(CHARACTERS).toEqual(['continents', 'archipelago', 'canyons', 'mesas', 'dunes', 'craters', 'ridges', 'plateaus']);
    expect(Object.keys(TERRAIN).sort()).toEqual([...CHARACTERS].sort());
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
    const hs = (kind, peaks) => {
      const g = groundOf({ kind, sea: 0.05, peaks }, 21, 25000);
      return randomDirs(1500, 4).map((d) => g(d).h).sort((a, b) => a - b);
    };
    expect(hs('ridges', 1000)[Math.floor(1500 * 0.95)]).toBeGreaterThanOrEqual(350);
    const cr = hs('craters', 200);
    expect(cr[Math.floor(1500 * 0.05)]).toBeLessThanOrEqual(cr[750] - 60);
    const du = hs('dunes', 40);
    expect(du[1499] - du[750]).toBeLessThanOrEqual(200);
  });

  it('rims a crater with a crease, never a cliff: 2 m steps along a 20 km walk', () => {
    const R = 20000;
    const g = groundOf({ kind: 'craters', sea: 0, peaks: TERRAIN.craters.peaks[1] }, 13, R);
    const chart = chartOf([0.3, 0.8, -0.52], R);
    let last = g(chart.toDir(0, 0)).h;
    let [lo, hi] = [last, last];
    for (let x = 2; x <= 20000; x += 2) {
      const { h } = g(chart.toDir(x, 0.37 * x));
      expect(Math.abs(h - last), `at ${x} m`).toBeLessThan(5);
      [last, lo, hi] = [h, Math.min(lo, h), Math.max(hi, h)];
    }
    // and it did cross craters on the way
    expect(hi - lo).toBeGreaterThan(60);
  });

  it('digs a planet with water deeper under its sea than a dry one’s basins, with the same shore', () => {
    for (const kind of ['continents', 'dunes']) {
      const c = { kind, sea: 0.4, peaks: mid(TERRAIN[kind].peaks) };
      const dry = groundOf(c, 8, 20000);
      const wet = groundOf(c, 8, 20000, { kind: 'sea', level: 0 });
      let deepest = 0;
      for (const d of randomDirs(600, 2)) {
        const [a, b] = [dry(d), wet(d)];
        expect(Number.isFinite(b.h)).toBe(true);
        expect(b.land).toBe(a.land);
        expect(b.h < 0).toBe(a.h < 0);
        if (a.h >= 0) expect(b.h).toBe(a.h);
        else expect(b.h).toBeLessThanOrEqual(a.h);
        deepest = Math.max(deepest, a.h - b.h);
      }
      expect(deepest, kind).toBeGreaterThan(40);
    }
  });

  it('is a function of the planet: the same seed and radius give the same ground, another seed another', () => {
    const c = { kind: 'ridges', sea: 0.1, peaks: 800 };
    const [a, b, other] = [groundOf(c, 3, 30000), groundOf(c, 3, 30000), groundOf(c, 4, 30000)];
    const dirs = randomDirs(50, 6);
    expect(dirs.map((d) => a(d).h)).toEqual(dirs.map((d) => b(d).h));
    expect(dirs.some((d) => other(d).h !== a(d).h)).toBe(true);
  });
});

describe('FIB_512', () => {
  it('is 512 unit directions spread over the whole sphere', () => {
    expect(FIB_512).toHaveLength(512);
    const sum = [0, 0, 0];
    for (const d of FIB_512) {
      expect(Math.abs(Math.hypot(...d) - 1)).toBeLessThan(1e-12);
      for (let k = 0; k < 3; k++) sum[k] += d[k] / 512;
    }
    expect(Math.hypot(...sum)).toBeLessThan(0.01);
    // each octant holds its eighth, give or take
    const octants = new Array(8).fill(0);
    for (const [x, y, z] of FIB_512) octants[(x > 0) * 4 + (y > 0) * 2 + (z > 0)]++;
    for (const n of octants) expect(Math.abs(n - 64)).toBeLessThanOrEqual(6);
  });
});
