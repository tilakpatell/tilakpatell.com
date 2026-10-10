import { describe, expect, it } from 'vitest';
import { wallGeometry } from './hvvScene';

describe('the hero arena’s edge', () => {
  it('stands a strip of light round the ground, closed, on the ground’s own height', () => {
    const points = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const g = wallGeometry(points, (x, z) => x * 0.1 + z, 3);
    const pos = g.getAttribute('position');
    // (a foot and a top a corner, and the first again to close it)
    expect(pos.count).toBe((points.length + 1) * 2);
    expect(g.getIndex().count).toBe(points.length * 6);
    expect([pos.getX(2), pos.getY(2), pos.getZ(2)]).toEqual([10, 1, 0]);
    expect(pos.getY(3) - pos.getY(2)).toBe(3);
    expect([pos.getX(8), pos.getZ(8)]).toEqual([0, 0]);
    expect(Array.from(g.getAttribute('v').array.slice(0, 4))).toEqual([0, 1, 0, 1]);
  });
});
