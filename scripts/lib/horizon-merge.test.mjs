import { describe, expect, it } from 'vitest';
import { compose, mergeInto, multiply, newGroup } from './horizon-merge.mjs';

const tri = {
  position: [0, 0, 0, 1, 0, 0, 0, 0, 1],
  normal: [0, 1, 0, 0, 1, 0, 0, 1, 0],
  uv: [0, 0, 1, 0, 0, 1],
  index: [0, 1, 2],
};

describe('compose and multiply', () => {
  it('places a point as glTF does: scale, then turn, then move', () => {
    const q = [0, Math.SQRT1_2, 0, Math.SQRT1_2]; // a quarter turn about y
    const m = compose([10, 0, 0], q, [2, 2, 2]);
    // (1, 0, 0) scaled to 2, turned to (0, 0, −2), moved to (10, 0, −2)
    const p = [m[0] + m[12], m[1] + m[13], m[2] + m[14]];
    p.forEach((c, k) => expect(c).toBeCloseTo([10, 0, -2][k], 6));
  });

  it('multiplies with the identity as itself', () => {
    const id = compose([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]);
    const m = compose([1, 2, 3], [0, 0, 0, 1], [4, 5, 6]);
    expect(multiply(id, m)).toEqual(m);
    expect(multiply(m, id)).toEqual(m);
  });
});

describe('mergeInto', () => {
  it('appends each instance’s triangles, its indices offset', () => {
    const g = newGroup();
    mergeInto(g, tri, compose([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]));
    mergeInto(g, tri, compose([5, 0, 0], [0, 0, 0, 1], [1, 1, 1]));
    expect(g.position).toHaveLength(18);
    expect(g.index).toEqual([0, 1, 2, 3, 4, 5]);
    expect(g.position.slice(9, 12)).toEqual([5, 0, 0]);
    expect(g.uv).toHaveLength(12);
  });

  it('flips the winding of a mirrored instance and keeps its normal out', () => {
    const g = mergeInto(newGroup(), tri, compose([0, 0, 0], [0, 0, 0, 1], [-1, 1, 1]));
    expect(g.index).toEqual([0, 2, 1]);
    g.normal.slice(0, 3).forEach((c, k) => expect(c).toBeCloseTo([0, 1, 0][k], 9));
  });

  it('leans a normal by the inverse of a stretch, and keeps it unit', () => {
    const slope = {
      position: [0, 0, 0, 1, 1, 0, 0, 0, 1],
      normal: [-Math.SQRT1_2, Math.SQRT1_2, 0, 0, 1, 0, 0, 1, 0],
      index: [0, 1, 2],
    };
    const g = mergeInto(newGroup(), slope, compose([0, 0, 0], [0, 0, 0, 1], [2, 1, 1]));
    const [x, y, z] = g.normal.slice(0, 3);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
    // (a 45° slope stretched twice as long along x is shallower: its normal nearer up)
    expect(y).toBeGreaterThan(Math.SQRT1_2);
  });

  it('gives a mesh without normals or UVs straight up and zero', () => {
    const g = mergeInto(newGroup(), { position: [0, 0, 0, 1, 0, 0, 0, 0, 1] }, compose([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]));
    expect(g.normal).toEqual([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    expect(g.index).toEqual([0, 1, 2]);
  });
});
