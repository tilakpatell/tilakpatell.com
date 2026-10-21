import { describe, expect, it } from 'vitest';
import { STEP, gatherAt, hopOf, loopLengths, rowAt, walkerAt } from './crowdPose';

const SQUARE = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
// how far a point is from the loop's nearest side
const offLoop = (loop, x, z) =>
  Math.min(
    ...loop.map(([ax, az], i) => {
      const [bx, bz] = loop[(i + 1) % loop.length];
      const len2 = (bx - ax) ** 2 + (bz - az) ** 2;
      const k = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / len2));
      return Math.hypot(x - (ax + (bx - ax) * k), z - (az + (bz - az) * k));
    }),
  );

describe('a walker on its loop', () => {
  const { lengths, total } = loopLengths(SQUARE);
  it('measures the loop closed, back to its start', () => {
    expect(lengths).toEqual([10, 10, 10, 10]);
    expect(total).toBe(40);
  });
  it('is always on the loop, and goes round in its length over its speed', () => {
    const out = {};
    for (let t = 0; t < 30; t += 0.37) {
      walkerAt(SQUARE, lengths, total, 1.3, t, 0.2, out);
      expect(offLoop(SQUARE, out.x, out.z)).toBeLessThan(1e-9);
    }
    const a = walkerAt(SQUARE, lengths, total, 2, 0, 0, {});
    const b = walkerAt(SQUARE, lengths, total, 2, total / 2, 0, {});
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.z).toBeCloseTo(a.z, 9);
  });
  it('starts where its phase puts it, and faces along its side (rules.js’s heading: east 0, north π/2)', () => {
    const e = walkerAt(SQUARE, lengths, total, 1, 0, 0.125, {});
    expect(e.x).toBeCloseTo(5, 9);
    expect(e.z).toBeCloseTo(0, 9);
    expect(e.yaw).toBeCloseTo(0, 9);
    // the second side runs +z, which is south: heading −π/2
    const s = walkerAt(SQUARE, lengths, total, 1, 0, 0.375, {});
    expect(s.x).toBeCloseTo(10, 9);
    expect(s.yaw).toBeCloseTo(-Math.PI / 2, 9);
  });
  it('bobs and sways a little in its step, never much', () => {
    let top = 0;
    let lean = 0;
    for (let t = 0; t < 4; t += 0.01) {
      const w = walkerAt(SQUARE, lengths, total, 1.2, t, 0, {});
      top = Math.max(top, Math.abs(w.bob));
      lean = Math.max(lean, Math.abs(w.sway));
    }
    expect(top).toBeGreaterThan(0.01);
    expect(top).toBeLessThan(0.06);
    expect(lean).toBeGreaterThan(0.01);
    expect(lean).toBeLessThan(0.08);
    // a step a STEP seconds: the bob comes round twice a stride
    const a = walkerAt(SQUARE, lengths, total, 1.2, 0.1, 0, {});
    const b = walkerAt(SQUARE, lengths, total, 1.2, 0.1 + STEP, 0, {});
    expect(b.bob).toBeCloseTo(a.bob, 9);
  });
  it('writes into what it’s given, making nothing new', () => {
    const out = {};
    expect(walkerAt(SQUARE, lengths, total, 1, 3, 0, out)).toBe(out);
  });
});

describe('a gathering', () => {
  it('stands each of its people in its disc, all facing what they watch', () => {
    const face = [0, -30];
    for (let i = 0; i < 40; i++) {
      const g = gatherAt([5, 5], 4, i, 40, face, 7);
      expect(Math.hypot(g.x - 5, g.z - 5)).toBeLessThanOrEqual(4);
      // the heading points from where they stand to what they watch (within a few degrees: they look round a little)
      const want = Math.atan2(-(face[1] - g.z), face[0] - g.x);
      const off = Math.atan2(Math.sin(g.yaw - want), Math.cos(g.yaw - want));
      expect(Math.abs(off)).toBeLessThan(0.35);
    }
  });
  it('stands them apart, the same every time for the same seed', () => {
    const a = Array.from({ length: 12 }, (_, i) => gatherAt([0, 0], 3, i, 12, [0, -10], 3));
    const b = Array.from({ length: 12 }, (_, i) => gatherAt([0, 0], 3, i, 12, [0, -10], 3));
    expect(a).toEqual(b);
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) expect(Math.hypot(a[i].x - a[j].x, a[i].z - a[j].z)).toBeGreaterThan(0.45);
  });
});

describe('a hop on the beat', () => {
  it('rises and settles within its length, rippling out by who it is', () => {
    expect(hopOf(0, null, 0)).toBe(0);
    expect(hopOf(5, 5, 0)).toBe(0);
    const peak = Math.max(...Array.from({ length: 60 }, (_, k) => hopOf(5 + k * 0.01, 5, 0)));
    expect(peak).toBeGreaterThan(0.09);
    expect(peak).toBeLessThanOrEqual(0.11);
    expect(hopOf(5 + 0.6, 5, 0)).toBeCloseTo(0, 9);
    expect(hopOf(10, 5, 0)).toBe(0);
    // someone further along starts a little later
    expect(hopOf(5.05, 5, 0)).toBeGreaterThan(hopOf(5.05, 5, 9));
  });
});

describe('a row (a gallery’s, a stand’s)', () => {
  it('stands its people along the row, evenly, all facing what they watch', () => {
    const at = [10, -4];
    const face = [10, -30];
    const all = Array.from({ length: 8 }, (_, i) => rowAt(at, 7, i, 8, face, 2));
    for (const p of all) {
      // along the row (across the way to what they watch), within its length
      expect(Math.abs(p.z - at[1])).toBeLessThan(0.25);
      expect(Math.abs(p.x - at[0])).toBeLessThanOrEqual(3.5);
      const want = Math.atan2(-(face[1] - p.z), face[0] - p.x);
      expect(Math.abs(Math.atan2(Math.sin(p.yaw - want), Math.cos(p.yaw - want)))).toBeLessThan(0.35);
    }
    const xs = all.map((p) => p.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(0.6);
  });

  it('turned to look at someone, keeps its line on its tier and turns only its people', () => {
    const at = [10, -4];
    const face = [10, -30];
    const look = [40, 6];
    for (let i = 0; i < 8; i++) {
      const p = rowAt(at, 7, i, 8, face, 2);
      const q = rowAt(at, 7, i, 8, face, 2, look);
      expect([q.x, q.z]).toEqual([p.x, p.z]);
      const want = Math.atan2(-(look[1] - q.z), look[0] - q.x);
      expect(Math.abs(Math.atan2(Math.sin(q.yaw - want), Math.cos(q.yaw - want)))).toBeLessThan(0.35);
    }
  });
});
