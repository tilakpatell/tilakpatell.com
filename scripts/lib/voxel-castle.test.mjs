import { describe, expect, it } from 'vitest';
import { classOf, compact, findWindows, hexOf, weldPositions } from './voxel-castle.mjs';

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
