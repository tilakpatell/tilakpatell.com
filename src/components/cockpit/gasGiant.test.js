import { describe, expect, it } from 'vitest';
import { YAVIN, bandColor } from './gasGiant';

const at = (u, v) => bandColor(u, v, { seed: 7, palette: YAVIN });
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const spread = (xs) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

describe('Yavin’s bands', () => {
  it('give a colour in range, the same every time', () => {
    for (const [u, v] of [[0, 0], [0.5, 0.5], [0.99, 1], [1.7, -0.2]]) {
      const c = at(u, v);
      expect(c).toHaveLength(3);
      for (const k of c) expect(k >= 0 && k <= 255 && Number.isInteger(k)).toBe(true);
      expect(at(u, v)).toEqual(c);
    }
  });

  it('are warm: rust, ochre and cream, never blue or purple', () => {
    for (let i = 0; i < 200; i++) {
      const [r, g, b] = at(i / 200, (i * 0.37) % 1);
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThan(b);
    }
  });

  it('change down the latitude far more than along the longitude', () => {
    const down = Array.from({ length: 120 }, (_, i) => lum(at(0.4, i / 120)));
    const along = Array.from({ length: 120 }, (_, i) => lum(at(i / 120, 0.5)));
    expect(spread(down)).toBeGreaterThan(spread(along) * 2);
  });

  it('wrap round the longitude without a seam', () => {
    const a = lum(at(0.9999, 0.5));
    const b = lum(at(0, 0.5));
    expect(Math.abs(a - b)).toBeLessThan(12);
  });

  it('darken at the poles', () => {
    const row = (v) => Array.from({ length: 60 }, (_, i) => lum(at(i / 60, v))).reduce((a, b) => a + b, 0) / 60;
    expect(row(0.02)).toBeLessThan(row(0.5));
    expect(row(0.98)).toBeLessThan(row(0.5));
  });
});
