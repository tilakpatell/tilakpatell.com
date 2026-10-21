import { describe, expect, it } from 'vitest';
import { bestRotation, centroid, diffMask } from './nebula-measure.mjs';

// synthetic frames, no browser: a soft blob, an L-shaped bar turned by `deg`
// about (100, 60), and black
const W = 200;
const H = 120;
const img = (f) => {
  const d = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = f(x, y);
      d.set([v, v, v, 255], (y * W + x) * 4);
    }
  }
  return d;
};
const blob = (cx, cy) => img((x, y) => 255 * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 50));
const ell = (deg, [cx, cy] = [100, 60]) => {
  const a = (deg * Math.PI) / 180;
  return img((x, y) => {
    const u = (x - cx) * Math.cos(a) + (y - cy) * Math.sin(a);
    const v = -(x - cx) * Math.sin(a) + (y - cy) * Math.cos(a);
    return (u > -20 && u < 30 && Math.abs(v) < 4) || (v > -20 && v < 4 && Math.abs(u + 16) < 4) ? 255 : 0;
  });
};
const black = img(() => 0);

describe('the nebula measure', () => {
  it('finds a blob and how far it moved', () => {
    const a = centroid(diffMask({ on: blob(60, 50), off: black, width: W, height: H }), W);
    const b = centroid(diffMask({ on: blob(100, 50), off: black, width: W, height: H }), W);
    expect(b.x - a.x).toBeCloseTo(40, 0);
    expect(b.y - a.y).toBeCloseTo(0, 6);
  });

  it('says nothing, not NaN, of an empty frame', () => {
    expect(centroid(diffMask({ on: black, off: black, width: W, height: H }), W)).toEqual({ x: 0, y: 0, n: 0 });
  });

  it('can look at one place only, so a second cloud in view doesn’t pull the middle', () => {
    const [p, q] = [blob(60, 50), blob(150, 70)];
    const two = img((x, y) => Math.max(p[(y * W + x) * 4], q[(y * W + x) * 4]));
    const mask = diffMask({ on: two, off: black, width: W, height: H });
    const one = centroid(mask, W, { about: [65, 55], radius: 30 });
    expect(one.x).toBeCloseTo(60, 0);
    expect(one.y).toBeCloseTo(50, 0);
    expect(centroid(mask, W).x).toBeGreaterThan(90);
    expect(centroid(mask, W, { about: [5, 115], radius: 3 })).toEqual({ x: 0, y: 0, n: 0 });
  });

  it('counts only what differs past the threshold', () => {
    const dim = img(() => 10);
    expect(diffMask({ on: dim, off: black, width: W, height: H }).every((v) => v === 0)).toBe(true);
    expect(diffMask({ on: dim, off: black, width: W, height: H }, 5).every((v) => v === 1)).toBe(true);
  });

  it('finds how far a shape turned, and that a shape that didn’t turn didn’t', () => {
    expect(Math.abs(bestRotation(ell(0), ell(30), { width: W, height: H, about: [100, 60], radius: 50 }) - 30)).toBeLessThanOrEqual(1);
    expect(Math.abs(bestRotation(ell(0), ell(-20), { width: W, height: H, about: [100, 60], radius: 50 }) + 20)).toBeLessThanOrEqual(1);
    expect(bestRotation(ell(0), ell(0), { width: W, height: H, about: [100, 60], radius: 50 })).toBe(0);
  });

  it('finds the turn of a shape that also moved, about each one’s own middle', () => {
    expect(Math.abs(bestRotation(ell(0), ell(30, [120, 64]), { width: W, height: H, about: [100, 60], to: [120, 64], radius: 50 }) - 30)).toBeLessThanOrEqual(1);
  });

  it('takes one luminance a pixel as well as RGBA', () => {
    const lum = (rgba) => Float32Array.from({ length: W * H }, (_, i) => rgba[i * 4]);
    expect(Math.abs(bestRotation(lum(ell(0)), lum(ell(30)), { width: W, height: H, about: [100, 60], radius: 50 }) - 30)).toBeLessThanOrEqual(1);
  });
});
