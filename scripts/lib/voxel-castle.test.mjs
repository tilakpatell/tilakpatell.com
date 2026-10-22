import { describe, expect, it } from 'vitest';
import { classOf, compact, findWindows, footprintGrid, hexOf, opened, rectangles, weldPositions } from './voxel-castle.mjs';

describe('the voxel castle’s classes', () => {
  it('names the colours it was read for', () => {
    expect(classOf([0x2c, 0x2f, 0x30])).toBe('slate');
    expect(classOf([0x2b, 0x28, 0x18])).toBe('rock');
    expect(classOf([0x92, 0xaf, 0xaa])).toBe('glass');
  });
  it('reads any other colour by its hue and value', () => {
    expect(classOf([0x4c, 0x4a, 0x48])).toBe('stone');
    expect(classOf([0x21, 0x21, 0x21])).toBe('window');
    expect(classOf([0x0d, 0x20, 0x01])).toBe('grass');
    expect(classOf([0xfa, 0xf6, 0xaa])).toBe('lamp');
    expect(hexOf([1, 2, 255])).toBe('0102ff');
  });
});

describe('welding', () => {
  it('welds the corners a voxel export repeats', () => {
    const { verts, remap } = weldPositions(new Float32Array([0, 0, 0, 1, 0, 0, 0.0001, 0, 0, 1, 1, 0]), 0.01);
    expect(verts.length / 3).toBe(3);
    expect([...remap]).toEqual([0, 1, 0, 2]);
  });
  it('compacts a class’s triangles into their own mesh', () => {
    const { positions, indices } = compact(new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0]), [3, 1, 2]);
    expect(positions.length).toBe(9);
    expect([...indices]).toEqual([0, 1, 2]);
    expect(positions[0]).toBe(3);
  });
});

describe('the windows', () => {
  // a wall in the plane z = 0, 3 × 3 squares of stone with the middle one slate
  const grid = () => {
    const v = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) v.push(x, y, 0);
    const t = [];
    const cls = [];
    const names = ['stone', 'slate', 'window'];
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++) {
        const a = y * 4 + x;
        t.push(a, a + 1, a + 4, a + 1, a + 5, a + 4);
        const c = x === 1 && y === 1 ? 1 : 0;
        cls.push(c, c);
      }
    return { v: new Float32Array(v), t, cls: Uint8Array.from(cls), names };
  };
  it('finds a slate square set into a stone wall', () => {
    const { v, t, cls, names } = grid();
    const out = findWindows(v, t, cls, names);
    expect(out[8]).toBe(2);
    expect(out[9]).toBe(2);
    expect(out[0]).toBe(0);
  });
  it('leaves a slate plane with no wall round it as roof', () => {
    const { v, t, names } = grid();
    const out = findWindows(v, t, new Uint8Array(18).fill(1), names);
    expect([...out].every((c) => c === 1)).toBe(true);
  });
  it('leaves a long low band of slate as wall, not a window', () => {
    // a wall in z = 0, 8 squares long and 3 high, its middle row slate
    const v = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 9; x++) v.push(x, y, 0);
    const t = [];
    const cls = [];
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 8; x++) {
        const a = y * 9 + x;
        t.push(a, a + 1, a + 9, a + 1, a + 10, a + 9);
        const c = y === 1 ? 1 : 0;
        cls.push(c, c);
      }
    const out = findWindows(new Float32Array(v), t, Uint8Array.from(cls), ['stone', 'slate', 'window']);
    expect(out[16]).toBe(1);
  });
});

describe('the ground a castle needs', () => {
  // a flat 10 × 10 m slab at y 10 with a 2 m wide bridge out from it, a
  // high walk over nothing (y 40, far down to 30 on its piers' feet: no),
  // a hall west of it: its roof (y 30) over walls whose feet are at 12 and
  // no floor; and a court east of it, its lawn over walls that go down to 6
  // (wound to face up, as a floor is)
  const quad = (x0, z0, x1, z1, y) => [x0, y, z0, x1, y, z1, x1, y, z0, x0, y, z0, x0, y, z1, x1, y, z1];
  const wall = (x0, z0, x1, z1, y0, y1) => [x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y0, z0, x1, y1, z1, x0, y1, z0];
  const hall = [...quad(-20, 0, -12, 10, 30), ...wall(-20, 0, -20, 10, 12, 30), ...wall(-12, 0, -12, 10, 12, 30), ...wall(-20, 0, -12, 0, 12, 30), ...wall(-20, 10, -12, 10, 12, 30)];
  const court = [...quad(20, -10, 30, -2, 10), ...wall(20, -10, 30, -10, 6, 12), ...wall(20, -2, 30, -2, 6, 12)];
  const tris = Float32Array.from([...quad(0, 0, 10, 10, 10), ...quad(10, 4, 30, 6, 10), ...quad(0, -20, 10, -12, 40), ...hall, ...court, ...wall(0, -16, 0, -16.5, 40, 0)]);
  const grid = (o = {}) => footprintGrid(tris, { cell: 1, floor: 10, reach: 6, bounds: [-22, -22, 34, 12], ...o });
  it('stands each part on its own floor, or on its own feet', () => {
    const g = grid();
    const k = (x, z) => Math.floor(z - g.z0) * g.w + Math.floor(x - g.x0);
    expect(g.on[k(5, 5)]).toBe(1);
    expect(g.y[k(5, 5)]).toBe(10);
    expect(g.on[k(-16, 5)]).toBe(1);
    expect(g.y[k(-16, 5)]).toBe(12);
    // (a court: walls' feet at 6, its lawn at 10: the walk on the lawn)
    expect(g.y[k(25, -6)]).toBe(10);
    expect(g.on[k(-5, -5)]).toBe(0);
  });
  it('lets a narrow bridge go when opened, and covers the rest with rectangles a level each', () => {
    const rects = rectangles(opened(grid(), 2));
    const slab = rects.filter((r) => r[4] === 10 && r[2] <= 12);
    const area = slab.reduce((s, [a, b, c, d]) => s + (c - a) * (d - b), 0);
    // (a triangle's box takes the cell its edge lies on: 11 × 11)
    expect(area).toBeGreaterThanOrEqual(100);
    expect(area).toBeLessThanOrEqual(121);
    expect(Math.max(...slab.map((r) => r[2]))).toBeLessThanOrEqual(11);
    // (the hall, with no floor, solid; the court, its lawn a floor, not)
    expect(rects.some((r) => r[4] === 12 && r[0] <= -19 && r[5] === 1)).toBe(true);
    expect(rects.some((r) => r[4] === 10 && r[0] >= 19 && r[5] === 0)).toBe(true);
  });
});
