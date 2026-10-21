import { describe, expect, it } from 'vitest';
import { armCurve } from './water';

describe('the squid’s arm', () => {
  const base = [100, 0, -250];
  const out = [1, 0];

  it('is under the water before it rises and after it sinks, and up out of it between', () => {
    const top = (k) => Math.max(...armCurve(k, base, out, { reach: 15, n: 40 }).map((p) => p[1]));
    expect(top(0)).toBeLessThan(0.01);
    expect(top(1)).toBeLessThan(0.3);
    expect(top(0.45)).toBeGreaterThan(8);
  });

  it('leans away and curls over: its tip further out than its middle at the height of it', () => {
    const pts = armCurve(0.55, base, out, { reach: 15, n: 40 });
    const tip = pts.at(-1);
    const mid = pts[20];
    expect(tip[0] - base[0]).toBeGreaterThan(mid[0] - base[0]);
    expect(tip[1]).toBeLessThan(Math.max(...pts.map((p) => p[1])));
    for (const p of pts) for (const v of p) expect(Number.isFinite(v)).toBe(true);
  });
});
