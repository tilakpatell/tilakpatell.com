import { describe, expect, it } from 'vitest';
import { createSolids } from './solids';
import { ASIDE, createClear, tooNear } from './clear';

const box = (grid, [x0, y0, z0], [x1, y1, z1]) => {
  const p = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  for (const [a, b, c, d] of [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]) {
    grid.add(...p(a), ...p(b), ...p(c));
    grid.add(...p(a), ...p(c), ...p(d));
  }
};

describe('nothing walked or seen through', () => {
  it('a walker eases round a cart in its lane, and back once past it', () => {
    const grid = createSolids({ from: 0, to: 60 });
    box(grid, [-1.2, 0, 20], [0.3, 1.4, 23]);
    const clear = createClear();
    // (walking up the lane at 2.5 m/s)
    let x = -0.45;
    const xs = [];
    for (let z = 10; z < 30; z += 2.5 / 30) {
      x = clear.walker('sam', { x: -0.45, z, y: 0 }, grid, 1 / 30);
      xs.push([z, x]);
      // (never in it)
      if (z > 20.5 && z < 22.5) expect(grid.standing(x, z, 0)).toBe(false);
    }
    // (never a jump)
    for (let i = 1; i < xs.length; i++) expect(Math.abs(xs[i][1] - xs[i - 1][1])).toBeLessThanOrEqual(ASIDE / 30 + 1e-9);
    expect(x).toBeCloseTo(-0.45, 6);
  });

  it('the camera hung off the lead comes in short of a wall between them, and lets out slowly when it’s gone', () => {
    const grid = createSolids({ from: -10, to: 40 });
    box(grid, [-3, 0, 4], [3, 4, 4.4]);
    const clear = createClear();
    const eye = [0, 1.1, 8];
    const at = clear.camera([0, 1.8, 4.6 - 3.4], eye, { rig: 'follow' }, grid, 1 / 30);
    expect(at[2]).toBeGreaterThan(4.4);
    // (past the wall: out again over a second or so, not at once)
    const open = [0, 1.8, 30 - 3.4];
    const next = clear.camera(open, [0, 1.1, 30], { rig: 'follow' }, grid, 1 / 30);
    expect(next[2]).toBeGreaterThan(26.6);
    let p = next;
    for (let i = 0; i < 60; i++) p = clear.camera(open, [0, 1.1, 30], { rig: 'follow' }, grid, 1 / 30);
    expect(p[2]).toBeCloseTo(26.6, 6);
  });

  it('a placed shot stays where the beat put it, unless that’s in a wall: then it comes toward what it looks at', () => {
    const grid = createSolids({ from: -10, to: 40 });
    box(grid, [4, 0, 10], [4.4, 4, 20]);
    const clear = createClear();
    const free = [2, 1.6, 12];
    expect(clear.camera(free, [0, 1, 12], { rig: 'seat', lookAt: [-1, 1, 15] }, grid, 0.1)).toEqual(free);
    const inWall = clear.camera([4.2, 1.6, 15], [0, 1, 12], { rig: 'seat', lookAt: [-1, 1.2, 15] }, grid, 0.1);
    expect(inWall[0]).toBeLessThan(4);
    expect(grid.at(...inWall, 0)).toBe(false);
  });

  it('a camera in a figure is too near it; one beside it is not', () => {
    expect(tooNear([0.2, 1.2, 5.1], [0, 0, 5])).toBe(true);
    expect(tooNear([1.2, 1.2, 5], [0, 0, 5])).toBe(false);
    expect(tooNear([0.1, 3, 5], [0, 0, 5])).toBe(false);
  });
});
