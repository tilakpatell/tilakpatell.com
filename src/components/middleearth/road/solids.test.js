import { describe, expect, it } from 'vitest';
import { createSolids } from './solids';

// a box's twelve triangles, as add() takes them
const box = (grid, [x0, y0, z0], [x1, y1, z1]) => {
  const p = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  for (const [a, b, c, d] of [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]) {
    grid.add(...p(a), ...p(b), ...p(c));
    grid.add(...p(a), ...p(c), ...p(d));
  }
};

describe('what stands solid on a stage', () => {
  it('a wall beside the lane is in the grid at its height, and nothing is either side of it or over it', () => {
    const g = createSolids({ from: 0, to: 60 });
    box(g, [3, 0, 10], [3.4, 3, 20]);
    expect(g.at(3.2, 1.5, 15)).toBe(true);
    expect(g.at(3.2, 4.5, 15)).toBe(false);
    expect(g.at(0, 1.5, 15)).toBe(false);
    expect(g.at(3.2, 1.5, 25)).toBe(false);
    expect(g.filled()).toBeGreaterThan(10);
  });

  it('on sloping land the layers are over the ground there; what lies on the ground is the ground’s', () => {
    const ground = (x, z) => z * 0.1;
    const g = createSolids({ from: 0, to: 60, ground });
    // (a rug: flat on the land)
    g.add(-1, 2.0, 20, 1, 2.0, 20, 0, 2.0, 21);
    expect(g.filled()).toBe(0);
    box(g, [-0.5, 4, 40], [0.5, 6, 41]);
    // (its face toward the walker, two metres over the ground there)
    expect(g.at(0, 5, 40.1)).toBe(true);
    expect(g.at(0, 2, 40.1)).toBe(false);
  });

  it('a roof over a floor is two things, not one block: a walker stands between them', () => {
    const g = createSolids({ from: 0, to: 30 });
    box(g, [-2, 0.3, 5], [2, 0.4, 10]);
    box(g, [-2, 3, 5], [2, 3.2, 10]);
    expect(g.standing(0, 7, 0.4)).toBe(false);
    expect(g.at(0, 3.1, 7)).toBe(true);
  });

  it('the boom stops short of a wall between the lead and the camera, and goes the whole way when nothing is', () => {
    const g = createSolids({ from: -10, to: 30 });
    box(g, [-3, 0, 4], [3, 4, 4.4]);
    const t = g.boom([0, 1.5, 8], [0, 1.7, 0]);
    expect(t).toBeGreaterThan(0.2);
    expect(t).toBeLessThan(0.5);
    // (where it stops is clear of the wall)
    const at = [0, 1.5 + 0.2 * t, 8 - 8 * t];
    expect(at[2]).toBeGreaterThan(4.4);
    expect(g.boom([0, 1.5, 20], [0, 1.7, 12])).toBe(1);
  });

  it('a walker steps round a cart in the lane, to the nearer side of it, and stays put when the lane is clear', () => {
    const g = createSolids({ from: 0, to: 60 });
    box(g, [-1.2, 0, 20], [0.3, 1.4, 23]);
    expect(g.standing(-0.45, 21, 0)).toBe(true);
    const x = g.sidestep(-0.45, 21, 0);
    expect(g.standing(x, 21, 0)).toBe(false);
    expect(x).toBeGreaterThan(0.3);
    expect(g.sidestep(0.45, 40, 0)).toBe(0.45);
  });

  it('outside the grid is open: far off the lane, before or past the stage', () => {
    const g = createSolids({ from: 0, to: 20 });
    box(g, [20, 0, 5], [22, 3, 8]);
    expect(g.filled()).toBe(0);
    expect(g.at(0, 1, -5)).toBe(false);
    expect(g.at(0, 1, 50)).toBe(false);
  });
});
