import { describe, expect, it } from 'vitest';
import { hzbSizes, occludedAt, reduceDepth } from './hzb.js';

describe('the depth pyramid’s CPU twin', () => {
  // a 4 × 4 depth: a near wall (0.2) on the left half, the far plane (1) on the right,
  // one nearer speck (0.1) at (3, 3)
  const depth = new Float32Array([0.2, 0.2, 1, 1, 0.2, 0.2, 1, 1, 0.2, 0.2, 1, 1, 0.2, 0.2, 1, 0.1]);

  it('keeps the farthest depth of each 2 × 2 (the nearest on reversed depth)', () => {
    const mips = reduceDepth(depth, 4, 4);
    expect(mips.map((m) => [m.width, m.height])).toEqual([
      [2, 2],
      [1, 1],
    ]);
    expect(Array.from(mips[0].data)).toEqual([0.2, 1, 0.2, 1].map(Math.fround));
    expect(Array.from(mips[1].data)).toEqual([1]);
    const rev = reduceDepth(depth, 4, 4, { reversed: true });
    expect(Array.from(rev[0].data)).toEqual([0.2, 1, 0.2, 0.1].map(Math.fround));
  });

  it('takes the odd column and row into the edge texel, so nothing is left out', () => {
    // 3 × 1: the third pixel is the far one
    const mips = reduceDepth(new Float32Array([0.1, 0.1, 0.9]), 3, 1);
    expect(mips[0].width).toBe(2);
    expect(Array.from(mips[0].data)).toEqual([0.1, 0.9].map(Math.fround));
    expect(hzbSizes(1600, 900).slice(0, 3)).toEqual([
      [800, 450],
      [400, 225],
      [200, 113],
    ]);
    expect(hzbSizes(1600, 900).at(-1)).toEqual([1, 1]);
  });

  it('culls a sphere behind the wall and keeps one in front of it, and anything past the far depth', () => {
    const mips = reduceDepth(depth, 4, 4);
    // (the left two pixels' rect; standard depth: occluded when its nearest is past the farthest there)
    expect(occludedAt({ x0: 0, y0: 0, x1: 1.9, y1: 3.9 }, 0.5, mips)).toBe(true);
    expect(occludedAt({ x0: 0, y0: 0, x1: 1.9, y1: 3.9 }, 0.15, mips)).toBe(false);
    // (over the open right half, the far plane: never occluded)
    expect(occludedAt({ x0: 2.1, y0: 0, x1: 3.9, y1: 1.9 }, 0.99, mips)).toBe(false);
    // (a rect across both halves reads the far half too)
    expect(occludedAt({ x0: 0.5, y0: 0.5, x1: 2.5, y1: 1.5 }, 0.5, mips)).toBe(false);
  });

  it('on reversed depth, near is 1 and the test flips', () => {
    const rev = new Float32Array(depth.map((v) => 1 - v));
    const mips = reduceDepth(rev, 4, 4, { reversed: true });
    expect(occludedAt({ x0: 0, y0: 0, x1: 1.9, y1: 3.9 }, 0.5, mips, { reversed: true })).toBe(true);
    expect(occludedAt({ x0: 0, y0: 0, x1: 1.9, y1: 3.9 }, 0.85, mips, { reversed: true })).toBe(false);
  });

  it('a rect wider than the top level spans: no test, never a guess', () => {
    const mips = reduceDepth(new Float32Array(64).fill(0.1), 8, 8);
    // (8 pixels span four texels of level 0, the only level kept)
    expect(occludedAt({ x0: 0, y0: 0, x1: 7.9, y1: 7.9 }, 0.5, mips.slice(0, 1))).toBe(false);
    expect(occludedAt({ x0: 0, y0: 0, x1: 7.9, y1: 7.9 }, 0.5, mips)).toBe(true);
  });

  it('no pyramid: nothing is occluded (the first frame)', () => {
    expect(occludedAt({ x0: 0, y0: 0, x1: 1, y1: 1 }, 0.9, null)).toBe(false);
  });
});
