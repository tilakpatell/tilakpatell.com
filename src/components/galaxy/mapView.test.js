import { describe, expect, it } from 'vitest';
import { FIT, FRAME, K_MAX, centreOn, clampView, frameUnits, onSquare, onView, panBy, toBox, zoomAt } from './mapView';
import { CORE, RIM, SYSTEMS } from './systems';
import { LANDMARKS } from './landmarks';

// (a square of the atlas's 21 squares from A-1, for the sums below)
const G = { x0: 0, z0: 0, size: 21 };

describe('mapView', () => {
  it('keeps the point under the cursor where it was when it zooms', () => {
    const v = zoomAt(FIT, 2, 0.25, 0.75);
    expect(v.k).toBe(2);
    // the map point at the cursor before (0.25, 0.75 of the square) is still under it
    expect(v.x + v.k * 0.25).toBeCloseTo(0.25);
    expect(v.y + v.k * 0.75).toBeCloseTo(0.75);
  });
  it('never zooms past its limits or leaves the box uncovered', () => {
    expect(zoomAt(FIT, 0.2, 0.5, 0.5)).toEqual(FIT);
    expect(zoomAt(FIT, 99, 0.5, 0.5).k).toBe(K_MAX);
    const v = clampView({ k: 2, x: 0.4, y: -3 });
    expect(v).toEqual({ k: 2, x: 0, y: -1 });
  });
  it('pans by a share of the box, clamped', () => {
    const v = panBy({ k: 2, x: -0.5, y: -0.5 }, 0.2, -0.2);
    expect(v.x).toBeCloseTo(-0.3);
    expect(v.y).toBeCloseTo(-0.7);
    expect(panBy(FIT, 0.3, 0.3)).toEqual(FIT);
  });
  it('frames points: both on view, zoomed no more than kMax', () => {
    const a = [16, 15]; // Naboo-ish
    const b = [18, 16];
    const v = frameUnits([a, b]);
    expect(v.k).toBeLessThanOrEqual(3);
    expect(v.k).toBeGreaterThan(1);
    expect(onView(v, a)).toBe(true);
    expect(onView(v, b)).toBe(true);
    // far apart: the whole map
    expect(frameUnits([[1, 1], [22, 20]]).k).toBe(1);
  });
  it('says where a map point is in the box', () => {
    expect(toBox(FIT, [10.5, 21], G)).toEqual([0.5, 1]);
    const v = { k: 2, x: -0.5, y: 0 };
    expect(toBox(v, [10.5, 0], G)[0]).toBeCloseTo(0.5);
    expect(onView(v, [1, 1], { frame: G })).toBe(false);
    // (the map's own square: the galaxy's middle in the middle)
    expect(toBox(FIT, CORE)[0]).toBeCloseTo(0.5, 9);
    expect(toBox(FIT, CORE)[1]).toBeCloseTo(0.5, 9);
  });
  it('centres on a point at the zoom it has, and zooms in only as far as kMin', () => {
    const v = { k: 2.5, x: -0.2, y: -0.1 };
    const c = centreOn(v, [10, 8]);
    expect(c.k).toBe(2.5); // (not a jump to a framing zoom)
    expect(toBox(c, [10, 8])[0]).toBeCloseTo(0.5);
    expect(toBox(c, [10, 8])[1]).toBeCloseTo(0.5);
    // from the whole map: kMin
    const z = centreOn(FIT, [10, 8], { kMin: 1.5 });
    expect(z.k).toBe(1.5);
    expect(toBox(z, [10, 8])[0]).toBeCloseTo(0.5);
    expect(centreOn(FIT, [10, 8]).k).toBe(1);
    expect(centreOn({ k: 1.7, x: 0, y: 0 }, [3, 3], { kMin: 1.5 }).k).toBe(1.7);
    // a point near the edge: as near the middle as the square allows, and on view
    const e = centreOn({ k: 2, x: 0, y: 0 }, [0.5, 20.5], { frame: G });
    expect(e.x).toBe(0);
    expect(e.y).toBe(-1);
    expect(onView(e, [0.5, 20.5], { frame: G, pad: 0.01 })).toBe(true);
  });
  it('is the whole galaxy, every system and landmark on it, none cut off at the edge', () => {
    // (the disc and a margin: its edge, every way, inside the square)
    for (let i = 0; i < 360; i += 5) {
      const a = (i * Math.PI) / 180;
      const [u, w] = onSquare([CORE[0] + Math.cos(a) * RIM, CORE[1] + Math.sin(a) * RIM]);
      for (const t of [u, w]) expect(t, `${i}°`).toBeGreaterThan(0.02);
      for (const t of [u, w]) expect(t, `${i}°`).toBeLessThan(0.98);
    }
    // (Kamino, past the southern rim, too, with its name's room under it)
    for (const p of [...SYSTEMS.map((s) => s.pos), ...LANDMARKS.map((l) => l.pos)]) expect(onView(FIT, p, { pad: 0.02 }), String(p)).toBe(true);
    expect(FRAME.size).toBeLessThan(24); // (and no more than that: a grid square still a good size on a phone)
  });
});
