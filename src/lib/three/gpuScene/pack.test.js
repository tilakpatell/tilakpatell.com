import { describe, expect, it } from 'vitest';
import { FLAG, ROW_U32, fromHalf, packInstances, rowsOfBin, toHalf, unpackInstance } from './pack.js';
import { writeInstances } from '../../level/instances.js';

describe('half floats, by hand', () => {
  it('round-trips the numbers a transform holds within f16’s step', () => {
    // (half a step of f16's 10-bit mantissa: 2^-11 of the value, relative)
    for (const v of [0, 1, -1, 0.5, 0.70710678, -0.3333, 14.653, 1e-3, 65504, -2.75]) {
      expect(Math.abs(fromHalf(toHalf(v)) - v)).toBeLessThanOrEqual(Math.abs(v) * 2 ** -11 + 2 ** -25);
    }
    expect(toHalf(1)).toBe(0x3c00);
    expect(toHalf(-2)).toBe(0xc000);
    expect(fromHalf(0x7bff)).toBe(65504);
    expect(fromHalf(toHalf(1e9))).toBe(Infinity);
  });
});

describe('packInstances', () => {
  const rows = [
    { position: [12.5, -3, 900.25], quaternion: [0.1, -0.2, 0.3, Math.sqrt(1 - 0.14)], scale: [1, 2.5, 14.65], mesh: 601, mirrored: false },
    { position: [0, 0, 0], quaternion: [0, 0.70710678, 0, 0.70710678], scale: [-1, 1, 1], mesh: 3, mirrored: true, horizon: true },
  ];

  it('writes 8 u32 a row and round-trips a quaternion and a scale within 1e-3', () => {
    const out = new Uint32Array(4 * ROW_U32);
    expect(packInstances(rows, out, 1)).toBe(2);
    expect(out.slice(0, ROW_U32).every((v) => v === 0)).toBe(true);
    for (const [k, row] of rows.entries()) {
      const got = unpackInstance(out, 1 + k);
      expect(got.position).toEqual(row.position.map((v) => Math.fround(v)));
      got.quaternion.forEach((v, j) => expect(Math.abs(v - row.quaternion[j])).toBeLessThan(1e-3));
      got.scale.forEach((v, j) => expect(Math.abs(v - row.scale[j]) / Math.max(1, Math.abs(row.scale[j]))).toBeLessThan(1e-3));
      expect(got.mesh).toBe(row.mesh);
      expect(Boolean(got.flags & FLAG.live)).toBe(true);
      expect(Boolean(got.flags & FLAG.mirrored)).toBe(row.mirrored);
      expect(Boolean(got.flags & FLAG.horizon)).toBe(Boolean(row.horizon));
    }
  });

  it('refuses a mesh id past u16', () => {
    expect(() => packInstances([{ ...rows[0], mesh: 70000 }], new Uint32Array(ROW_U32))).toThrow(/mesh/);
  });
});

describe('rowsOfBin', () => {
  it('reads a pack’s draws out of its bin, the mirrored flag and the cell kept', () => {
    const bin = writeInstances({ count: 3, position: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), quaternion: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]), scale: new Float32Array([1, 1, 1, -1, 1, 1, 2, 2, 2]) });
    const draws = [
      { mesh: 4, offset: 0, count: 1, mirrored: false, cells: { '0,0': [0, 1] } },
      { mesh: 9, offset: 1, count: 2, mirrored: true, cells: { '0,0': [0, 1], '1,0': [1, 1] } },
    ];
    const rows = rowsOfBin(draws, bin);
    expect(rows.map((r) => [r.mesh, r.mirrored, r.cell])).toEqual([
      [4, false, '0,0'],
      [9, true, '0,0'],
      [9, true, '1,0'],
    ]);
    expect(rows[2].position).toEqual([7, 8, 9]);
    expect(rows[1].scale).toEqual([-1, 1, 1]);
  });
});
