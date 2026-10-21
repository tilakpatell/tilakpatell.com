// One cut of a figure weighted like another: each vertex takes the joints and
// weights of the nearest vertex of a cut already skinned (skin.mjs's, by
// heat). The cuts of one figure are baked from one raw model and stood the
// same way, so their surfaces lie within a millimetre or two of each other,
// and the nearest vertex is the same place on the body. Bone heat in
// Blender takes minutes a cut; this takes a second, and every cut of a figure
// then bends the same.
//
//   weightsLike(doc, from) → doc: every primitive of `doc` given JOINTS_0 and
//     WEIGHTS_0 from `from` (a skinned Document, its joints in the table's
//     order), and a skin naming the table's bones in order (for assemble)

import { NAMES } from './skin.mjs';

// a skinned document's vertices where they're bound (the mesh node's own
// transform is no part of a skin's), with their joints and weights
function bound(from) {
  const pos = [];
  const joints = [];
  const weights = [];
  const e = [];
  for (const mesh of from.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const [p, j, w] = ['POSITION', 'JOINTS_0', 'WEIGHTS_0'].map((s) => prim.getAttribute(s));
      if (!p || !j || !w) continue;
      for (let i = 0; i < p.getCount(); i++) {
        pos.push(...p.getElement(i, e));
        joints.push(...j.getElement(i, e));
        weights.push(...w.getElement(i, e));
      }
    }
  return { pos: Float32Array.from(pos), joints: Uint8Array.from(joints), weights: Float32Array.from(weights) };
}

// the nearest of `pos`'s points to each asked for, through a grid of cells `cell` wide
function nearest(pos, cell) {
  const grid = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  const n = pos.length / 3;
  for (let i = 0; i < n; i++) {
    const k = key(Math.floor(pos[i * 3] / cell), Math.floor(pos[i * 3 + 1] / cell), Math.floor(pos[i * 3 + 2] / cell));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  return (x, y, z) => {
    const [cx, cy, cz] = [Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell)];
    let best = -1;
    let bestD = Infinity;
    // (rings outward until something is found and nothing nearer can be further out)
    for (let r = 0; r < 64; r++) {
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++)
          for (let dz = -r; dz <= r; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
            for (const i of grid.get(key(cx + dx, cy + dy, cz + dz)) ?? []) {
              const d = (pos[i * 3] - x) ** 2 + (pos[i * 3 + 1] - y) ** 2 + (pos[i * 3 + 2] - z) ** 2;
              if (d < bestD) {
                bestD = d;
                best = i;
              }
            }
          }
      if (best >= 0 && Math.sqrt(bestD) <= r * cell) break;
    }
    return best;
  };
}

export function weightsLike(doc, from, { cell = 0.02 } = {}) {
  const src = bound(from);
  if (!src.pos.length) throw new Error('the cut to weight it like has no weights');
  const find = nearest(src.pos, cell);
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const skin = doc.createSkin('like');
  for (const name of NAMES) skin.addJoint(doc.createNode(name));
  const e = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    node.setSkin(skin);
    for (const prim of mesh.listPrimitives()) {
      const p = prim.getAttribute('POSITION');
      const j = new Uint8Array(p.getCount() * 4);
      const w = new Float32Array(p.getCount() * 4);
      for (let i = 0; i < p.getCount(); i++) {
        const [x, y, z] = p.getElement(i, e);
        const k = find(x, y, z);
        j.set(src.joints.subarray(k * 4, k * 4 + 4), i * 4);
        w.set(src.weights.subarray(k * 4, k * 4 + 4), i * 4);
      }
      prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(j).setBuffer(buffer));
      prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(w).setBuffer(buffer));
    }
  }
  return doc;
}
