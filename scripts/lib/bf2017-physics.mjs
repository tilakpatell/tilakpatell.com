// The game's collision shapes, read out of the export's physics GLBs and
// packed once per mesh beside a level (lane P0 of the physics design,
// docs/superpowers/specs/2026-10-10-bf2017-physics-design.md §1).
//
// A physics GLB (`<object>_Physics_Win32.glb`, gltfpack-quantised and
// meshopt-compressed) has a node per Havok root (`root<N>_<Class>`), a leaf
// under it per shape (`r<root>[_i<instance>]_p<part>_<kind>`, its extras
// { havokClass, kind, root, part, userData, instance, convexRadius }), and
// under the leaf the quantised mesh on a node whose scale (about 3e-5) and
// translation undo the quantisation. So a point is the node's world matrix
// times the raw integers; taken raw, a shape is a few millimetres wide.
//
// Kinds: a convex leaf is its hull's surface (its points are the hull: kept,
// or cut to 64 by farthest-point sampling); a mesh (or triangle) leaf is a
// trimesh, as is a flat convex (`convex_flat`: no hull through points in a
// plane); a capsule and a sphere are tessellated, so a capsule's ends are
// its two farthest points pulled in by the radius (`convexRadius` in the
// leaf's extras), a sphere is its box's centre and the radius. A static
// asset often has both a convex root and a mesh root over the same thing
// (its mesh leaves' user data 0xFFFF00NN, NN running 00 to 42 over Hoth's
// 432 meshes: an index, not the "visual only" tag the design took it for);
// both are kept, as the design's statics take both. `dropVisual` drops a
// 0xFFFF0000 mesh leaf for whoever wants the design's first reading. A
// leaf of no kind we know is dropped, with the reason.
//
//   readPhysicsGlb(buffer, record?, { dropVisual = false }) → Promise<{ shapes, dropped }>
//     shape: { kind: 'hull' | 'mesh' | 'capsule' | 'sphere', root, part,
//       instance, material, points: Float32Array, indices?: Uint32Array,
//       a?, b?, centre?, radius? }
//   reduceHull(points, max = 64) → Float32Array
//   packShapes, readShapes: the bin (src/lib/physics/shapesBin.js)
//   summarise(shapes) → { hulls, meshTriangles, capsules, spheres, colliders,
//     bounds: { min, max }, partCount }
//   physicsKey(modelFile) → the physics.jsonl `res` a map's model has
//   cellIndex(cells, physicsByMesh) → { 'cx,cz': { instances: [{ mesh,
//     count }], colliders, triangles } }

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { packShapes, readShapes } from '../../src/lib/physics/shapesBin.js';

export { packShapes, readShapes };

export const MAX_HULL = 64;
const VISUAL_ONLY = '0xFFFF0000';

let io = null;
async function reader() {
  if (io) return io;
  await MeshoptDecoder.ready;
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  return io;
}

// (a column-major 4 × 4 matrix times a point)
function transform(m, x, y, z, out, o) {
  out[o] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
}

// A leaf's points in the mesh's frame and its triangles, over every mesh
// node beneath it.
function leafGeometry(leaf) {
  const pts = [];
  const idx = [];
  let material = null;
  const visit = (node) => {
    const mesh = node.getMesh();
    if (mesh) {
      const m = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const base = pts.length / 3;
        const out = new Array(pos.getCount() * 3);
        const el = [0, 0, 0];
        // (getElement undoes a normalised accessor; the node's matrix the rest)
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, el);
          transform(m, el[0], el[1], el[2], out, i * 3);
        }
        // (a loop, not a spread: a big mesh has more points than a call takes arguments)
        for (const v of out) pts.push(v);
        const ind = prim.getIndices();
        if (ind) for (const v of ind.getArray()) idx.push(base + v);
        else for (let i = 0; i < pos.getCount(); i++) idx.push(base + i);
        const ex = prim.getMaterial()?.getExtras();
        if (material === null && ex && Number.isInteger(ex.materialIndex)) material = ex.materialIndex;
      }
    }
    for (const c of node.listChildren()) visit(c);
  };
  visit(leaf);
  return { points: pts, indices: idx, material: material ?? 0 };
}

// (the same point twice, once)
function unique(points) {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < points.length; i += 3) {
    const k = `${points[i].toFixed(5)},${points[i + 1].toFixed(5)},${points[i + 2].toFixed(5)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(points[i], points[i + 1], points[i + 2]);
  }
  return out;
}

// At most `max` of a hull's points: the six extremes first (so its box is
// kept), then whichever point is farthest from those already chosen.
export function reduceHull(points, max = MAX_HULL) {
  const n = points.length / 3;
  if (n <= max) return Float32Array.from(points);
  const chosen = [];
  const taken = new Uint8Array(n);
  const take = (i) => {
    if (taken[i]) return;
    taken[i] = 1;
    chosen.push(i);
  };
  for (let axis = 0; axis < 3; axis++) {
    let lo = 0;
    let hi = 0;
    for (let i = 1; i < n; i++) {
      if (points[i * 3 + axis] < points[lo * 3 + axis]) lo = i;
      if (points[i * 3 + axis] > points[hi * 3 + axis]) hi = i;
    }
    take(lo);
    take(hi);
  }
  const near = new Float64Array(n).fill(Infinity);
  const d2 = (i, j) => (points[i * 3] - points[j * 3]) ** 2 + (points[i * 3 + 1] - points[j * 3 + 1]) ** 2 + (points[i * 3 + 2] - points[j * 3 + 2]) ** 2;
  for (const c of chosen) for (let i = 0; i < n; i++) near[i] = Math.min(near[i], d2(i, c));
  while (chosen.length < max) {
    let best = -1;
    for (let i = 0; i < n; i++) if (!taken[i] && (best < 0 || near[i] > near[best])) best = i;
    if (best < 0) break;
    take(best);
    for (let i = 0; i < n; i++) near[i] = Math.min(near[i], d2(i, best));
  }
  const out = new Float32Array(chosen.length * 3);
  chosen.forEach((c, k) => out.set(points.subarray ? points.subarray(c * 3, c * 3 + 3) : points.slice(c * 3, c * 3 + 3), k * 3));
  return out;
}

function boxOf(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < points.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], points[i + k]);
      max[k] = Math.max(max[k], points[i + k]);
    }
  return { min, max };
}

// A tessellated capsule: its axis runs between its two farthest points,
// each a radius beyond an end.
function capsuleOf(points, radius) {
  const n = points.length / 3;
  let best = -1;
  let ia = 0;
  let ib = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = (points[i * 3] - points[j * 3]) ** 2 + (points[i * 3 + 1] - points[j * 3 + 1]) ** 2 + (points[i * 3 + 2] - points[j * 3 + 2]) ** 2;
      if (d > best) {
        best = d;
        ia = i;
        ib = j;
      }
    }
  const p = points.slice(ia * 3, ia * 3 + 3);
  const q = points.slice(ib * 3, ib * 3 + 3);
  const len = Math.sqrt(best);
  const r = Math.min(radius, len / 2);
  const u = len > 0 ? [(q[0] - p[0]) / len, (q[1] - p[1]) / len, (q[2] - p[2]) / len] : [0, 1, 0];
  return { a: p.map((v, k) => v + u[k] * r), b: q.map((v, k) => v - u[k] * r), radius: r };
}

export async function readPhysicsGlb(buffer, record = null, { dropVisual = false } = {}) {
  const doc = await (await reader()).readBinary(new Uint8Array(buffer));
  const shapes = [];
  const dropped = [];
  for (const scene of doc.getRoot().listScenes())
    for (const rootNode of scene.listChildren())
      for (const leaf of rootNode.listChildren()) {
        const ex = leaf.getExtras() ?? {};
        const name = leaf.getName();
        const kind = ex.kind;
        if (!kind) {
          dropped.push({ node: name, why: 'no kind in its extras' });
          continue;
        }
        if (dropVisual && (kind === 'mesh' || kind === 'triangle') && String(ex.userData).toUpperCase() === VISUAL_ONLY.toUpperCase()) {
          dropped.push({ node: name, why: `visual only (user data ${VISUAL_ONLY})` });
          continue;
        }
        const g = leafGeometry(leaf);
        if (!g.points.length) {
          dropped.push({ node: name, why: 'no points' });
          continue;
        }
        const base = { root: ex.root ?? 0, part: ex.part ?? 0, instance: ex.instance ?? 0, material: g.material };
        if (kind === 'convex') {
          shapes.push({ kind: 'hull', ...base, points: reduceHull(Float32Array.from(unique(g.points))) });
        } else if (kind === 'mesh' || kind === 'triangle' || kind === 'convex_flat') {
          shapes.push({ kind: 'mesh', ...base, points: Float32Array.from(g.points), indices: Uint32Array.from(g.indices) });
        } else if (kind === 'capsule') {
          const pts = unique(g.points);
          const c = capsuleOf(pts, ex.convexRadius ?? record?.maxConvexRadius ?? 0);
          shapes.push({ kind: 'capsule', ...base, points: Float32Array.from([...c.a, ...c.b]), a: c.a, b: c.b, radius: c.radius });
        } else if (kind === 'sphere') {
          const { min, max } = boxOf(g.points);
          const centre = min.map((v, k) => (v + max[k]) / 2);
          const radius = ex.convexRadius ?? Math.max(...max.map((v, k) => (v - min[k]) / 2));
          shapes.push({ kind: 'sphere', ...base, points: Float32Array.from(centre), centre, radius });
        } else dropped.push({ node: name, why: `kind '${kind}' isn't a collider` });
      }
  return { shapes, dropped };
}

export function summarise(shapes) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const grow = (p, r = 0) => {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[k] - r);
      max[k] = Math.max(max[k], p[k] + r);
    }
  };
  const out = { hulls: 0, meshTriangles: 0, capsules: 0, spheres: 0, colliders: shapes.length, partCount: 0 };
  const parts = new Set();
  for (const s of shapes) {
    parts.add(s.part);
    if (s.kind === 'hull' || s.kind === 'mesh') for (let i = 0; i < s.points.length; i += 3) grow([s.points[i], s.points[i + 1], s.points[i + 2]]);
    if (s.kind === 'hull') out.hulls++;
    else if (s.kind === 'mesh') out.meshTriangles += s.indices.length / 3;
    else if (s.kind === 'capsule') {
      out.capsules++;
      grow(s.a, s.radius);
      grow(s.b, s.radius);
    } else {
      out.spheres++;
      grow(s.centre, s.radius);
    }
  }
  out.partCount = parts.size;
  const r = (v) => Math.round(v * 1000) / 1000;
  out.bounds = shapes.length ? { min: min.map(r), max: max.map(r) } : null;
  return out;
}

// models/objects/…/arctic_corridorsnowpile_01_mesh.glb →
// objects/…/arctic_corridorsnowpile_01_physics_win32
export const physicsKey = (modelFile) =>
  String(modelFile)
    .toLowerCase()
    .replace(/^(web\/)?models\//, '')
    .replace(/\.glb$/, '')
    .replace(/_mesh$/, '')
    .replace(/_lod\d+$/, '') + '_physics_win32';

// Per cell, which meshes with shapes it places and how many colliders and
// trimesh triangles they come to (`cells` the pack's: { key: { draws:
// [{ mesh, count }] } }; `physicsByMesh` { mesh: { colliders, meshTriangles } }).
export function cellIndex(cells, physicsByMesh) {
  const out = {};
  for (const key of Object.keys(cells).sort()) {
    const counts = new Map();
    for (const d of cells[key].draws ?? []) {
      const p = physicsByMesh[d.mesh];
      if (!p || !p.colliders) continue;
      counts.set(String(d.mesh), (counts.get(String(d.mesh)) ?? 0) + (d.count ?? 1));
    }
    if (!counts.size) continue;
    let colliders = 0;
    let triangles = 0;
    const instances = [];
    for (const [mesh, count] of counts) {
      instances.push({ mesh, count });
      colliders += physicsByMesh[mesh].colliders * count;
      triangles += physicsByMesh[mesh].meshTriangles * count;
    }
    out[key] = { colliders, instances, triangles };
  }
  return out;
}
