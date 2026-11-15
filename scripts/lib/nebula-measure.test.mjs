import { expect, it } from 'vitest';
import { bestRotation, centroid, diffMask, largestBlob } from './nebula-measure.mjs';

const W = 200, H = 120;
const img = (f) => { const d = new Uint8Array(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = f(x, y); d.set([v, v, v, 255], (y * W + x) * 4); } return d; };
const blob = (cx, cy) => img((x, y) => 255 * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 50));
const ell = (deg) => { const a = (deg * Math.PI) / 180; return img((x, y) => { const u = (x - 100) * Math.cos(a) + (y - 60) * Math.sin(a), v = -(x - 100) * Math.sin(a) + (y - 60) * Math.cos(a); return (u > -20 && u < 30 && Math.abs(v) < 4) || (v > -20 && v < 4 && Math.abs(u + 16) < 4) ? 255 : 0; }); };
const black = img(() => 0);
it('finds a blob and how far it moved', () => {
  const a = centroid(diffMask({ on: blob(60, 50), off: black, width: W, height: H }), W);
  const b = centroid(diffMask({ on: blob(100, 50), off: black, width: W, height: H }), W);
  expect(b.x - a.x).toBeCloseTo(40, 0);
});
it('says nothing, not NaN, of an empty frame', () => {
  expect(centroid(diffMask({ on: black, off: black, width: W, height: H }), W)).toEqual({ x: 0, y: 0, n: 0 });
});
it('finds how far a shape turned, and that a shape that didn’t turn didn’t', () => {
  expect(Math.abs(bestRotation(ell(0), ell(30), { width: W, height: H, about: [100, 60], radius: 50 }) - 30)).toBeLessThanOrEqual(1);
  expect(bestRotation(ell(0), ell(0), { width: W, height: H, about: [100, 60], radius: 50 })).toBe(0);
});

it('keeps the biggest part of a mask, not a speck far off', () => {
  const on = img((x, y) => (Math.hypot(x - 60, y - 50) < 15 || (Math.abs(x - 190) <= 2 && Math.abs(y - 10) <= 2) ? 255 : 0));
  const m = diffMask({ on, off: black, width: W, height: H });
  expect(centroid(m, W).x).toBeGreaterThan(60.5);
  const b = centroid(largestBlob(m, W, H), W);
  expect(b.x).toBeCloseTo(60, 0);
  expect(b.y).toBeCloseTo(50, 0);
  expect(largestBlob(new Uint8Array(W * H), W, H).some(Boolean)).toBe(false);
});
