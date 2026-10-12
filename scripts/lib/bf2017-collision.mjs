// A prop's render-cut collision mesh (the bucket's web/collision/, 12,941 of
// them, which no design used before lane E0) as one convex hull in the
// mesh's frame, for a piece the game gave no Havok shape: its points through
// the node transforms, cut to P0's 64 (reduceHull). Only for pieces under
// MAX_SIZE across: a building's hull would close its doors. Pure.
//
//   collisionPath(modelFile) → its collision GLB under web/ ('collision/…')
//   glbPoints(glb) → Float32Array of every vertex, through the nodes
//   collisionHull(glb) → { kind: 'hull', points, part, material, root } | null
//   MAX_SIZE = 15 (metres, lane L's bounds rule)

import { reduceHull } from "./bf2017-physics.mjs";
import { glbJson } from "./bf2017-paths.mjs";

export const MAX_SIZE = 15;
export const collisionPath = (file) =>
  String(file).replace(/^models\//, "collision/");

const READ = {
  5126: ["getFloat32", 4, 1],
  5122: ["getInt16", 2, 32767],
  5123: ["getUint16", 2, 65535],
  5120: ["getInt8", 1, 127],
  5121: ["getUint8", 1, 255],
};
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

// column-major 4×4
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

export function glbPoints(glb) {
  const j = glbJson(glb);
  const buf = Buffer.isBuffer(glb) ? glb : Buffer.from(glb);
  const binAt = 20 + buf.readUInt32LE(12) + 8;
  const dv = new DataView(
    buf.buffer,
    buf.byteOffset + binAt,
    buf.byteLength - binAt,
  );
  const out = [];
  const visit = (i, parent) => {
    const n = j.nodes[i];
    const m = mul(parent, local(n));
    if (n.mesh !== undefined)
      for (const p of j.meshes[n.mesh].primitives) {
        const a = j.accessors[p.attributes.POSITION];
        const view = j.bufferViews[a.bufferView];
        const [get, bytes, norm] = READ[a.componentType];
        const stride = view.byteStride ?? bytes * SIZE[a.type];
        const base = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
        for (let k = 0; k < a.count; k++) {
          const v = [0, 1, 2].map(
            (c) =>
              dv[get](base + k * stride + c * bytes, true) /
              (a.normalized ? norm : 1),
          );
          out.push(
            m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
            m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
            m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
          );
        }
      }
    for (const c of n.children ?? []) visit(c, m);
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const r of j.scenes?.[j.scene ?? 0]?.nodes ?? j.nodes.map((_, i) => i))
    visit(r, I);
  return Float32Array.from(out);
}

export function collisionHull(glb) {
  let points;
  try {
    points = glbPoints(glb);
  } catch {
    return null; // (a cut this reader can't follow: the piece keeps its bounds)
  }
  if (points.length < 12) return null;
  return {
    kind: "hull",
    points: Array.from(reduceHull(points)),
    part: 0,
    material: 0,
    root: 0,
  };
}
