// A level's instances as the GPU scene holds them (GPU-first lane N1): 32
// bytes a row, eight u32, read in WGSL as two uvec4s. Pure: the scene
// (scene.js), the cull's CPU twin (cull.js) and the tests read the same rows.
//
//   [0..2] position, f32 × 3 (the instance's origin: what lodAt measures from)
//   [3]    quaternion x, y as two f16 (WGSL's unpack2x16float: x in the low half)
//   [4]    quaternion z, w as two f16
//   [5]    scale x, y as two f16
//   [6]    scale z as f16, the low half (the high half spare)
//   [7]    mesh id (u16, the pack's meshes[] index) | flags << 16
//
// The design (spec §4, N1) gave one scale, a radius and a group; the code
// says otherwise: Hoth's bin holds 23 instances scaled unevenly, so the row
// keeps three scales; the radius is the mesh's (its bounds, scaled by the
// row's largest axis, as levelScene.js's rowsOf has it), read from the
// per-mesh table; and a mesh's GLB has a part a material, so the group is
// the part's, not the instance's (draws.js).
//
//   toHalf(f) → u16; fromHalf(h) → f
//   packInstances(rows, out: Uint32Array, offset = 0) → count
//     rows: [{ position: [3], quaternion: [4], scale: [3], mesh, mirrored?, horizon? }]
//   unpackInstance(u32, i) → { position, quaternion, scale, mesh, flags }
//   rowsOfBin(draws, bin) → rows (a pack's draws read from its bin: with `cell`)

import { readInstances } from '../../level/instances.js';

export const ROW_U32 = 8;
export const ROW_BYTES = ROW_U32 * 4;
export const FLAG = Object.freeze({ live: 1, mirrored: 2, horizon: 4 });

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

// f32 → f16 bits, rounded to nearest even, as the GPU's pack2x16float does
// (overflow to infinity, the smallest values flushed through subnormals)
export function toHalf(v) {
  f32[0] = v;
  const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  const exp = (x >>> 23) & 0xff;
  let mant = x & 0x7fffff;
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0);
  let e = exp - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    mant |= 0x800000;
    const shift = 14 - e;
    let h = mant >>> shift;
    const rest = mant & ((1 << shift) - 1);
    const half = 1 << (shift - 1);
    if (rest > half || (rest === half && h & 1)) h++;
    return sign | h;
  }
  let h = (e << 10) | (mant >>> 13);
  const rest = mant & 0x1fff;
  if (rest > 0x1000 || (rest === 0x1000 && h & 1)) h++;
  return sign | h;
}

export function fromHalf(h) {
  const sign = h & 0x8000 ? -1 : 1;
  const e = (h >>> 10) & 0x1f;
  const m = h & 0x3ff;
  if (e === 0) return sign * m * 2 ** -24;
  if (e === 0x1f) return m ? NaN : sign * Infinity;
  return sign * (1 + m / 1024) * 2 ** (e - 15);
}

const pair = (a, b) => (toHalf(a) | (toHalf(b) << 16)) >>> 0;

export function packInstances(rows, out, offset = 0) {
  let k = offset * ROW_U32;
  for (const r of rows) {
    if (!(r.mesh >= 0 && r.mesh < 0x10000)) throw new Error(`a GPU row’s mesh is a u16: ${r.mesh}`);
    for (let j = 0; j < 3; j++) {
      f32[0] = r.position[j];
      out[k + j] = u32[0];
    }
    const [qx, qy, qz, qw] = r.quaternion;
    out[k + 3] = pair(qx, qy);
    out[k + 4] = pair(qz, qw);
    out[k + 5] = pair(r.scale[0], r.scale[1]);
    out[k + 6] = toHalf(r.scale[2]);
    const flags = FLAG.live | (r.mirrored ? FLAG.mirrored : 0) | (r.horizon ? FLAG.horizon : 0);
    out[k + 7] = (r.mesh | (flags << 16)) >>> 0;
    k += ROW_U32;
  }
  return rows.length;
}

export function unpackInstance(rows, i) {
  const k = i * ROW_U32;
  const position = [0, 1, 2].map((j) => {
    u32[0] = rows[k + j];
    return f32[0];
  });
  const lo = (w) => fromHalf(w & 0xffff);
  const hi = (w) => fromHalf(w >>> 16);
  return {
    position,
    quaternion: [lo(rows[k + 3]), hi(rows[k + 3]), lo(rows[k + 4]), hi(rows[k + 4])],
    scale: [lo(rows[k + 5]), hi(rows[k + 5]), lo(rows[k + 6])],
    mesh: rows[k + 7] & 0xffff,
    flags: rows[k + 7] >>> 16,
  };
}

export function rowsOfBin(draws, bin) {
  const inst = readInstances(bin);
  const rows = [];
  for (const d of draws) {
    const cells = new Array(d.count).fill(null);
    for (const [key, [first, count]] of Object.entries(d.cells ?? {})) for (let k = first; k < first + count && k < d.count; k++) cells[k] = key;
    for (let i = d.offset; i < d.offset + d.count; i++) {
      const q = Array.from(inst.quaternion.subarray(i * 4, i * 4 + 4));
      const len = Math.hypot(...q) || 1;
      rows.push({
        position: Array.from(inst.position.subarray(i * 3, i * 3 + 3)),
        quaternion: q.map((v) => v / len),
        scale: Array.from(inst.scale.subarray(i * 3, i * 3 + 3)),
        mesh: d.mesh,
        mirrored: Boolean(d.mirrored),
        cell: cells[i - d.offset],
      });
    }
  }
  return rows;
}
