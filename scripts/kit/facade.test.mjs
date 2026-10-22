import { describe, expect, it } from 'vitest';
import { FACES, facadeOf } from './facade.mjs';

// a box 4 m wide, 6 high and 2 deep, standing on the ground about its middle,
// each face two triangles wound to look out of it; its front red, its back
// green, its sides blue, its roof white
const W = 4;
const H = 6;
const D = 2;
const quad = (a, b, c, d, colour) => [
  { p: [...a, ...b, ...c], uv: [0, 0, 0, 0, 0, 0], tex: null, colour, cut: null },
  { p: [...a, ...c, ...d], uv: [0, 0, 0, 0, 0, 0], tex: null, colour, cut: null },
];
const [x0, x1, y0, y1, z0, z1] = [-W / 2, W / 2, 0, H, -D / 2, D / 2];
const RED = [1, 0, 0, 1];
const GREEN = [0, 1, 0, 1];
const BLUE = [0, 0, 1, 1];
const WHITE = [1, 1, 1, 1];
const box = [
  ...quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], RED),
  ...quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], GREEN),
  ...quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], BLUE),
  ...quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], BLUE),
  ...quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], WHITE),
];
const got = facadeOf(box, { size: 256, most: 10 });
// the atlas's colour at a quad's UV, `a` and `b` of the way across and up it
const colourAt = (face, a, b) => {
  const q = face * 4;
  const uv = (k) => [got.box.uvs[(q + k) * 2], got.box.uvs[(q + k) * 2 + 1]];
  const [bl, br, , tl] = [0, 1, 2, 3].map(uv);
  const u = bl[0] + (br[0] - bl[0]) * a;
  const v = bl[1] + (tl[1] - bl[1]) * b;
  const k = (Math.floor(v * got.size) * got.size + Math.floor(u * got.size)) * 4;
  return [...got.rgba.slice(k, k + 3)];
};

describe('facadeOf: a building as a box wearing pictures of itself', () => {
  it('makes a quad a face, ten triangles, the box round it, each looking out', () => {
    expect(got.box.indices).toHaveLength(30);
    expect(got.box.positions).toHaveLength(FACES.length * 4 * 3);
    const xs = [...got.box.positions].filter((_, i) => i % 3 === 0);
    expect(Math.min(...xs)).toBeCloseTo(x0, 6);
    expect(Math.max(...xs)).toBeCloseTo(x1, 6);
    // (each triangle wound to look out of its face)
    const P = got.box.positions;
    const I = got.box.indices;
    for (let t = 0; t < I.length; t += 3) {
      const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
      const e1 = b.map((v, i) => v - a[i]);
      const e2 = c.map((v, i) => v - a[i]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const want = FACES[Math.floor(t / 6)].n;
      expect(n[0] * want[0] + n[1] * want[1] + n[2] * want[2]).toBeGreaterThan(0);
    }
  });

  it('pictures each face as it looks from outside', () => {
    expect(colourAt(0, 0.5, 0.5)).toEqual([255, 0, 0]);
    expect(colourAt(1, 0.5, 0.5)).toEqual([0, 255, 0]);
    expect(colourAt(2, 0.5, 0.5)).toEqual([0, 0, 255]);
    expect(colourAt(3, 0.5, 0.5)).toEqual([0, 0, 255]);
    expect(colourAt(4, 0.5, 0.5)).toEqual([255, 255, 255]);
  });

  it('keeps its picture the right way up and round: a front red only on its left half', () => {
    // (the front's right half painted again in yellow, a hair out in front of it)
    const half = facadeOf([...box, ...quad([0, y0, z1 + 0.01], [x1, y0, z1 + 0.01], [x1, y1, z1 + 0.01], [0, y1, z1 + 0.01], [1, 1, 0, 1])], { size: 256, most: 10 });
    const at = (a) => {
      const u = half.box.uvs[0] + (half.box.uvs[2] - half.box.uvs[0]) * a;
      const v = (half.box.uvs[1] + half.box.uvs[7]) / 2;
      const k = (Math.floor(v * half.size) * half.size + Math.floor(u * half.size)) * 4;
      return [...half.rgba.slice(k, k + 3)];
    };
    expect(at(0.25)).toEqual([255, 0, 0]);
    expect(at(0.75)).toEqual([255, 255, 0]);
  });

  it('draws a material’s map, and leaves out what its cutoff cuts', () => {
    // (a 2 × 1 map: its left texel black and see-through, its right grey)
    const tex = { rgba: Uint8Array.from([0, 0, 0, 0, 128, 128, 128, 255]), w: 2, h: 1 };
    const front = [
      { p: [x0, y0, z1, x1, y0, z1, x1, y1, z1], uv: [0, 0, 1, 0, 1, 1], tex, colour: [1, 1, 1, 1], cut: 0.5 },
      { p: [x0, y0, z1, x1, y1, z1, x0, y1, z1], uv: [0, 0, 1, 1, 0, 1], tex, colour: [1, 1, 1, 1], cut: 0.5 },
    ];
    const one = facadeOf([...front, ...box.slice(2)], { size: 256, most: 10 });
    const u = (a) => one.box.uvs[0] + (one.box.uvs[2] - one.box.uvs[0]) * a;
    const v = (one.box.uvs[1] + one.box.uvs[7]) / 2;
    const px = (a) => [...one.rgba.slice((Math.floor(v * one.size) * one.size + Math.floor(u(a) * one.size)) * 4, (Math.floor(v * one.size) * one.size + Math.floor(u(a) * one.size)) * 4 + 3)];
    expect(px(0.75)).toEqual([128, 128, 128]);
    // (the cut half filled from its neighbours, not left black)
    expect(px(0.25)).toEqual([128, 128, 128]);
  });

  it('fits its five faces in the atlas, fewer pixels a metre where they won’t at the most', () => {
    expect(got.density).toBe(10);
    expect(facadeOf(box, { size: 64, most: 40 }).density).toBeLessThan(40);
  });
});
