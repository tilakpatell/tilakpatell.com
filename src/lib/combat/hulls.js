// A ship’s hull for the hits: where a bolt meets it, and how far another
// ship has gone into it. A kind’s hull is read once from its shapes bin
// (version 2, physics/shapesBin.js) or made from the drawn model’s
// triangles, in the ship’s own unit frame (nose +z, 1 long). A query carries
// the world into that frame by the ship’s pose (pose.js: at0, at1, basis,
// scale) through the step, so a moving ship is met where it was when the
// bolt got there, not where it ended. Today’s sphere test (hull.radius ×
// scale) stays in front of every query as the broad phase. Pure: no three.js,
// no DOM; the queries allocate only what they return.
//
//   hullOf(bin) → Hull { radius, parts, rays, probes, solids }:
//     rays: the triangles a bolt meets (root 1’s; every one where the bin has
//       one root) in a tree of boxes, { count, nodes, tris (nine numbers a
//       triangle, in the tree’s order), part, property, box (six a node),
//       node (two a node: a leaf’s first triangle and count; an inner node’s
//       right child and 0, its left child the next node) };
//     probes: the points contact sweeps, xyz (root 0 hulls’ corners and
//       centres; where there are none, the farthest corner along 26
//       directions and the middle of the box);
//     solids: root 0’s convex hulls as [{ planes (nx, ny, nz, d each: inside
//       where n·p ≤ d), part, box }], empty where the bin has one root
//       (contact then reads the ray triangles as a closed mesh).
//   hullFromTriangles(positions, indices, { maxTris, property, name }) → Hull:
//     a drawn model’s triangles, clustered on a grid until under `maxTris`.
//   segmentHit(hull, pose, a, b) → { t, part, property, point, normal } | null
//   hullContact(small, smallPose, big, bigPose) → { normal, depth, at, part } | null

import { readHull } from '../physics/shapesBin.js';

const LEAF = 4; // triangles a leaf
const SLACK = 1e-7; // a triangle widened by this in its corners’ weights, so a bolt down a shared edge meets one of the two
// a contact leaves the probe this far outside (a share of the big ship’s
// length), so the next step’s sweep starts in front of the surface; a probe
// this near a face, or nearer, counts as on it
export const SKIN = 1e-3;
const GRID = 2 ** 15; // convex()’s grid steps either side of a hull’s middle: its side tests stay under 2^53

// the 26 ways out of a cube’s middle: a sphere’s or capsule’s corners, and
// the directions a mesh’s probes are its farthest corners along
const DIRS = [];
for (let x = -1; x <= 1; x++)
  for (let y = -1; y <= 1; y++)
    for (let z = -1; z <= 1; z++) {
      const l = Math.hypot(x, y, z);
      if (l) DIRS.push(x / l, y / l, z / l);
    }

// scratch for the queries (they never nest): a median-split tree is about
// log2(n) deep, so 64 is past any hull
const STACK = new Int32Array(64);
let found = 0; // the last cast()’s t
const N = new Float64Array(3); // the last normalOf()
const flip = () => {
  for (let k = 0; k < 3; k++) N[k] = -N[k];
};
const C = new Float64Array(4); // the last closest(): the point, and its distance squared
const T = new Float64Array(3); // the last onTriangle()
let seg = new Float64Array(6 * 64); // the probes’ paths in the big ship’s frame
const M = new Float64Array(9); // the small ship’s frame into the big one’s
const SWEPT = new Float64Array(6); // the box every probe’s path lies in

const pt = (p) => (Array.isArray(p) || ArrayBuffer.isView(p) ? p : [p.x, p.y, p.z]);
const empty = () => [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
// box b (min xyz, max xyz) grown to take the point at list[i]
function grow(b, list, i) {
  for (let k = 0; k < 3; k++) {
    b[k] = Math.min(b[k], list[i + k]);
    b[k + 3] = Math.max(b[k + 3], list[i + k]);
  }
}

// The tree: boxes over the triangles, split on the longest axis at the
// median, built once a kind.
function treeOf(tris, part, property) {
  const n = part.length;
  const cen = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) cen[i * 3 + k] = (tris[i * 9 + k] + tris[i * 9 + 3 + k] + tris[i * 9 + 6 + k]) / 3;
  const order = new Uint32Array(n).map((_, i) => i);
  const box = new Float32Array(Math.max(1, 2 * n) * 6);
  const node = new Int32Array(Math.max(1, 2 * n) * 2);
  let nodes = 0;
  const build = (lo, hi) => {
    const i = nodes++;
    const b = empty();
    for (let j = lo; j < hi; j++) for (let c = 0; c < 9; c += 3) grow(b, tris, order[j] * 9 + c);
    box.set(b, i * 6);
    if (hi - lo <= LEAF) {
      node[i * 2] = lo;
      node[i * 2 + 1] = hi - lo;
      return i;
    }
    const [wx, wy, wz] = [b[3] - b[0], b[4] - b[1], b[5] - b[2]];
    const ax = wx >= wy && wx >= wz ? 0 : wy >= wz ? 1 : 2;
    order.subarray(lo, hi).sort((p, q) => cen[p * 3 + ax] - cen[q * 3 + ax]);
    const mid = (lo + hi) >> 1;
    build(lo, mid);
    node[i * 2] = build(mid, hi);
    return i;
  };
  if (n) build(0, n);
  // the triangles in the tree’s order, so a leaf’s lie side by side
  const t = new Float32Array(n * 9), pa = new Uint8Array(n), pr = new Uint8Array(n);
  for (let j = 0; j < n; j++) {
    const o = order[j];
    t.set(tris.subarray(o * 9, o * 9 + 9), j * 9);
    pa[j] = part[o];
    pr[j] = property[o];
  }
  return { count: n, nodes, tris: t, part: pa, property: pr, box: box.slice(0, nodes * 6), node: node.slice(0, nodes * 2) };
}

// Along o + t·d, t in [0, 1] (Möller–Trumbore, either side of a triangle):
// the nearest triangle, or −1, its t left in `found`; or with `count`, how
// many triangles the path crosses (no slack then, so a crossing on a shared
// edge isn’t counted twice).
function cast(tree, ox, oy, oz, dx, dy, dz, count) {
  if (!tree.nodes) return count ? 0 : -1;
  const { box, node, tris } = tree;
  const slack = count ? 0 : SLACK;
  const ix = 1 / (dx || 1e-30), iy = 1 / (dy || 1e-30), iz = 1 / (dz || 1e-30);
  let best = 1, hit = -1, crossed = 0, sp = 0;
  STACK[sp++] = 0;
  while (sp) {
    const i = STACK[--sp];
    const b = i * 6;
    let p = (box[b] - ox) * ix;
    let q = (box[b + 3] - ox) * ix;
    let lo = Math.max(0, Math.min(p, q));
    let hi = Math.min(best, Math.max(p, q));
    p = (box[b + 1] - oy) * iy;
    q = (box[b + 4] - oy) * iy;
    lo = Math.max(lo, Math.min(p, q));
    hi = Math.min(hi, Math.max(p, q));
    p = (box[b + 2] - oz) * iz;
    q = (box[b + 5] - oz) * iz;
    lo = Math.max(lo, Math.min(p, q));
    hi = Math.min(hi, Math.max(p, q));
    if (lo > hi) continue;
    const c = node[i * 2 + 1];
    if (!c) {
      STACK[sp++] = node[i * 2];
      STACK[sp++] = i + 1;
      continue;
    }
    for (let k = node[i * 2], end = k + c; k < end; k++) {
      const o = k * 9;
      const vx = tris[o], vy = tris[o + 1], vz = tris[o + 2];
      const e1x = tris[o + 3] - vx, e1y = tris[o + 4] - vy, e1z = tris[o + 5] - vz;
      const e2x = tris[o + 6] - vx, e2y = tris[o + 7] - vy, e2z = tris[o + 8] - vz;
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (det === 0) continue;
      const inv = 1 / det;
      const sx = ox - vx, sy = oy - vy, sz = oz - vz;
      const u = (sx * px + sy * py + sz * pz) * inv;
      if (u < -slack || u > 1 + slack) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < -slack || u + v > 1 + slack) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t < 0 || t > best) continue;
      if (count) crossed++;
      else {
        best = t;
        hit = k;
      }
    }
  }
  found = best;
  return count ? crossed : hit;
}

// Inside a mesh: in its box, and two of three rays out of the point cross it
// an odd number of times (one ray can be fooled by an open mesh or a grazed
// edge). The rays lean a little off the axes, so they don’t run down a box’s
// edges.
const RAYS = [1, 0.0123, 0.0071, 0.0089, 1, 0.0137, 0.0113, 0.0067, 1];
function inside(tree, x, y, z) {
  const b = tree.box;
  if (!tree.nodes || x < b[0] || x > b[3] || y < b[1] || y > b[4] || z < b[2] || z > b[5]) return false;
  const L = 2 * Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
  let odd = 0;
  for (let r = 0; r < 3 && odd < 2 && odd + 3 - r >= 2; r++) odd += cast(tree, x, y, z, RAYS[r * 3] * L, RAYS[r * 3 + 1] * L, RAYS[r * 3 + 2] * L, true) & 1;
  return odd >= 2;
}

// The point of the mesh nearest (px, py, pz): its triangle, the point and its
// distance squared left in C.
function closest(tree, px, py, pz) {
  const { box, node, tris } = tree;
  let best = Infinity, hit = -1, sp = 0;
  STACK[sp++] = 0;
  while (sp) {
    const i = STACK[--sp];
    const b = i * 6;
    const gx = Math.max(box[b] - px, 0, px - box[b + 3]), gy = Math.max(box[b + 1] - py, 0, py - box[b + 4]), gz = Math.max(box[b + 2] - pz, 0, pz - box[b + 5]);
    if (gx * gx + gy * gy + gz * gz >= best) continue;
    const c = node[i * 2 + 1];
    if (!c) {
      STACK[sp++] = node[i * 2];
      STACK[sp++] = i + 1;
      continue;
    }
    for (let k = node[i * 2], end = k + c; k < end; k++) {
      const d = onTriangle(tris, k * 9, px, py, pz);
      if (d < best) {
        best = d;
        hit = k;
        C.set(T);
      }
    }
  }
  C[3] = best;
  return hit;
}

// the point of the triangle at tris[o…o + 8] nearest p, into T, and its
// distance squared (by the regions of Ericson’s Real-Time Collision Detection, 5.1.5)
function onTriangle(t, o, px, py, pz) {
  const ax = t[o], ay = t[o + 1], az = t[o + 2];
  const abx = t[o + 3] - ax, aby = t[o + 4] - ay, abz = t[o + 5] - az;
  const acx = t[o + 6] - ax, acy = t[o + 7] - ay, acz = t[o + 8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  const abac = abx * acx + aby * acy + abz * acz;
  const d3 = d1 - (abx * abx + aby * aby + abz * abz), d4 = d2 - abac; // ab·bp, ac·bp
  const d5 = d1 - abac, d6 = d2 - (acx * acx + acy * acy + acz * acz); // ab·cp, ac·cp
  const va = d3 * d6 - d5 * d4, vb = d5 * d2 - d1 * d6, vc = d1 * d4 - d3 * d2;
  let v = 0, w = 0; // T = a + v·ab + w·ac
  if (d1 > 0 || d2 > 0) {
    if (d3 >= 0 && d4 <= d3) v = 1;
    else if (d6 >= 0 && d5 <= d6) w = 1;
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) v = d1 / (d1 - d3);
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) w = d2 / (d2 - d6);
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      w = (d4 - d3) / (d4 - d3 + d5 - d6);
      v = 1 - w;
    } else {
      v = vb / (va + vb + vc);
      w = vc / (va + vb + vc);
    }
  }
  T[0] = ax + abx * v + acx * w;
  T[1] = ay + aby * v + acy * w;
  T[2] = az + abz * v + acz * w;
  return (T[0] - px) ** 2 + (T[1] - py) ** 2 + (T[2] - pz) ** 2;
}

// triangle k’s unit normal by its winding (e1 × e2), into N
function normalOf(tris, k) {
  const o = k * 9;
  const e1x = tris[o + 3] - tris[o], e1y = tris[o + 4] - tris[o + 1], e1z = tris[o + 5] - tris[o + 2];
  const e2x = tris[o + 6] - tris[o], e2y = tris[o + 7] - tris[o + 1], e2z = tris[o + 8] - tris[o + 2];
  const x = e1y * e2z - e1z * e2y, y = e1z * e2x - e1x * e2z, z = e1x * e2y - e1y * e2x;
  const l = Math.sqrt(x * x + y * y + z * z) || 1;
  N[0] = x / l;
  N[1] = y / l;
  N[2] = z / l;
}

// The convex hull of `pts` (xyz): { pts, faces: [{ a, b, c, nx, ny, nz, d }]
// wound outward }, or null for a line or a point. Each point outside the
// hull so far replaces the faces it sees with a fan from their rim. The side
// tests run on the points put on a grid of GRID steps either side of their
// box’s middle, where every product is a whole number under 2^53 and so
// exact in doubles: the hull is truly convex at every step, so the faces a
// point sees are one patch with one rim. (Rounded, a sliver on a turned
// cylinder’s end saw a point it shouldn’t, and the fans from two rims folded
// the hull through itself.) A flat set is given a thousandth of its size in
// thickness first, so it is still a solid and still met. Every point is
// checked inside every plane after (to two grid steps), and a hull that
// fails throws: a wrong solid is worse than none.
function convex(pts) {
  const n = pts.length / 3;
  if (n < 3) return null;
  const box = empty();
  for (let i = 0; i < n; i++) grow(box, pts, i * 3);
  const half = Math.max(box[3] - box[0], box[4] - box[1], box[5] - box[2]) / 2;
  if (!(half > 1e-12)) return null;
  const mid = [0, 1, 2].map((k) => (box[k] + box[k + 3]) / 2);
  const s = GRID / half;
  const q = new Float64Array(n * 3);
  for (let i = 0; i < n * 3; i++) q[i] = Math.round((pts[i] - mid[i % 3]) * s);
  const face = (a, b, c) => {
    const ux = q[b * 3] - q[a * 3], uy = q[b * 3 + 1] - q[a * 3 + 1], uz = q[b * 3 + 2] - q[a * 3 + 2];
    const vx = q[c * 3] - q[a * 3], vy = q[c * 3 + 1] - q[a * 3 + 1], vz = q[c * 3 + 2] - q[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    return { a, b, c, nx, ny, nz, d: nx * q[a * 3] + ny * q[a * 3 + 1] + nz * q[a * 3 + 2] };
  };
  const side = (f, i) => f.nx * q[i * 3] + f.ny * q[i * 3 + 1] + f.nz * q[i * 3 + 2] - f.d; // exact: over 0 is outside
  const far = (score) => {
    let best = -Infinity, at = 0;
    for (let i = 0; i < n; i++) {
      const v = score(i);
      if (v > best) [best, at] = [v, i];
    }
    return [at, best];
  };
  const [i0] = far((i) => -q[i * 3]);
  const [i1] = far((i) => (q[i * 3] - q[i0 * 3]) ** 2 + (q[i * 3 + 1] - q[i0 * 3 + 1]) ** 2 + (q[i * 3 + 2] - q[i0 * 3 + 2]) ** 2);
  const [i2, w2] = far((i) => {
    const f = face(i0, i1, i);
    return f.nx * f.nx + f.ny * f.ny + f.nz * f.nz;
  });
  if (!w2) return null; // a line or a point
  const base = face(i0, i1, i2);
  const [i3, w3] = far((i) => Math.abs(side(base, i)));
  if (!w3) {
    const l = Math.hypot(base.nx, base.ny, base.nz);
    const up = [base.nx / l, base.ny / l, base.nz / l].map((v) => v * half * 2e-3);
    const thick = new Float32Array(n * 6);
    thick.set(pts);
    for (let i = 0; i < n * 3; i++) thick[n * 3 + i] = pts[i] + up[i % 3];
    return convex(thick);
  }
  let faces = [
    [i0, i1, i2, i3],
    [i0, i2, i3, i1],
    [i0, i3, i1, i2],
    [i1, i3, i2, i0],
  ].map(([a, b, c, o]) => (side(face(a, b, c), o) > 0 ? face(a, c, b) : face(a, b, c)));
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1 || i === i2 || i === i3) continue;
    const seen = faces.filter((f) => side(f, i) > 0);
    if (!seen.length) continue;
    const edges = new Set();
    for (const f of seen) edges.add(f.a * n + f.b).add(f.b * n + f.c).add(f.c * n + f.a);
    const kept = faces.filter((f) => !seen.includes(f));
    for (const f of seen) {
      for (const [u, v] of [
        [f.a, f.b],
        [f.b, f.c],
        [f.c, f.a],
      ]) {
        if (!edges.has(v * n + u)) kept.push(face(u, v, i)); // a rim edge: its other face stays
      }
    }
    faces = kept;
  }
  // the planes back in the points’ frame, unit, and every point inside each
  for (const f of faces) {
    const l = Math.hypot(f.nx, f.ny, f.nz);
    [f.nx, f.ny, f.nz] = [f.nx / l, f.ny / l, f.nz / l];
    f.d = f.d / (l * s) + f.nx * mid[0] + f.ny * mid[1] + f.nz * mid[2];
    for (let i = 0; i < n; i++) {
      if (!(f.nx * pts[i * 3] + f.ny * pts[i * 3 + 1] + f.nz * pts[i * 3 + 2] - f.d <= 2 / s)) throw new Error(`hulls: a convex hull left point ${i} of ${n} outside a face`);
    }
  }
  return { pts, faces };
}

// a convex hull’s planes (its coplanar triangles as one) and box
function solidOf({ pts, faces }, part, corners) {
  const planes = [];
  for (const f of faces) {
    if (!(f.nx || f.ny || f.nz)) continue;
    if (planes.some((p) => p.nx * f.nx + p.ny * f.ny + p.nz * f.nz > 1 - 1e-6 && Math.abs(p.d - f.d) < 1e-6)) continue;
    planes.push(f);
  }
  const box = empty();
  for (const i of corners) grow(box, pts, i * 3);
  return { planes: Float32Array.from(planes.flatMap((p) => [p.nx, p.ny, p.nz, p.d])), part, box: Float32Array.from(box) };
}

// a sphere’s or capsule’s points: its ends pushed out along the 26 ways
function roundPoints(s) {
  const out = [];
  for (const c of s.kind === 'sphere' ? [s.centre] : [s.a, s.b]) {
    for (let k = 0; k < DIRS.length; k += 3) out.push(c[0] + DIRS[k] * s.radius, c[1] + DIRS[k + 1] * s.radius, c[2] + DIRS[k + 2] * s.radius);
  }
  return out;
}

// The hull’s probes where no convex shape gave them (a mesh-only or drawn
// hull): its farthest corner along each of the 26 ways, and its box’s middle.
function supportProbes(tris) {
  const top = new Float64Array(26).fill(-Infinity);
  const at = new Int32Array(26).fill(-1);
  const box = empty();
  for (let i = 0; i < tris.length; i += 3) {
    grow(box, tris, i);
    for (let d = 0; d < 26; d++) {
      const s = DIRS[d * 3] * tris[i] + DIRS[d * 3 + 1] * tris[i + 1] + DIRS[d * 3 + 2] * tris[i + 2];
      if (s > top[d]) [top[d], at[d]] = [s, i];
    }
  }
  if (!(box[0] <= box[3])) return [];
  const out = [];
  for (const i of new Set(at)) out.push(tris[i], tris[i + 1], tris[i + 2]);
  out.push((box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2);
  return out;
}

function finish(radius, parts, rays, probes, solids) {
  const p = probes.length ? probes : supportProbes(rays.tris);
  let reach = 0;
  for (const list of [rays.tris, p]) for (let i = 0; i < list.length; i += 3) reach = Math.max(reach, Math.hypot(list[i], list[i + 1], list[i + 2]));
  return { radius: radius || reach, parts, rays, probes: Float32Array.from(p), solids };
}

export function hullOf(bin) {
  const { radius, parts, shapes } = readHull(bin);
  const split = new Set(shapes.map((s) => s.root)).size > 1;
  const tris = [], part = [], property = [], probes = [], solids = [];
  const add = (pts, a, b, c, s) => {
    for (const v of [a, b, c]) tris.push(pts[v * 3], pts[v * 3 + 1], pts[v * 3 + 2]);
    part.push(s.part);
    property.push(parts[s.part]?.property ?? s.material);
  };
  for (const s of shapes) {
    const shot = !split || s.root !== 0;
    if (s.kind === 'mesh') {
      if (shot) for (let i = 0; i < s.indices.length; i += 3) add(s.points, s.indices[i], s.indices[i + 1], s.indices[i + 2], s);
      continue;
    }
    const c = convex(s.kind === 'hull' ? s.points : roundPoints(s));
    if (!c) continue;
    if (shot) for (const f of c.faces) add(c.pts, f.a, f.b, f.c, s);
    if (split && s.root !== 0) continue;
    const corners = [...new Set(c.faces.flatMap((f) => [f.a, f.b, f.c]))];
    const mid = [0, 0, 0];
    for (const i of corners) {
      probes.push(c.pts[i * 3], c.pts[i * 3 + 1], c.pts[i * 3 + 2]);
      for (let k = 0; k < 3; k++) mid[k] += c.pts[i * 3 + k] / corners.length;
    }
    probes.push(...mid);
    if (split) solids.push(solidOf(c, s.part, corners));
  }
  const rays = treeOf(Float32Array.from(tris), Uint8Array.from(part), Uint8Array.from(property));
  return finish(radius, parts.map((p) => ({ name: p.name, property: p.property })), rays, probes, solids);
}

// Vertex clustering: every vertex in a grid cell becomes the cell’s mean, a
// triangle with two corners in one cell goes, and the grid coarsens until
// the triangles are under `maxTris`.
function clustered(pos, idx, maxTris) {
  const nv = pos.length / 3;
  const lo = [Infinity, Infinity, Infinity];
  let hi = -Infinity;
  for (let i = 0; i < pos.length; i++) lo[i % 3] = Math.min(lo[i % 3], pos[i]);
  for (let i = 0; i < pos.length; i++) hi = Math.max(hi, pos[i] - lo[i % 3]);
  const of = new Int32Array(nv);
  for (let g = Math.ceil(Math.sqrt(maxTris)); ; g = Math.min(g - 1, Math.floor(g * 0.85))) {
    const cell = hi / g || 1;
    const cells = new Map();
    const sum = [];
    for (let v = 0; v < nv; v++) {
      let key = 0;
      for (let k = 2; k >= 0; k--) key = key * g + Math.min(g - 1, Math.floor((pos[v * 3 + k] - lo[k]) / cell));
      let c = cells.get(key);
      if (c === undefined) {
        c = cells.size;
        cells.set(key, c);
        sum.push(0, 0, 0, 0);
      }
      of[v] = c;
      for (let k = 0; k < 3; k++) sum[c * 4 + k] += pos[v * 3 + k];
      sum[c * 4 + 3]++;
    }
    const out = [];
    const seen = new Set();
    for (let i = 0; i < idx.length; i += 3) {
      let [a, b, c] = [of[idx[i]], of[idx[i + 1]], of[idx[i + 2]]];
      if (a === b || b === c || a === c) continue;
      // a face kept once with its winding (a thin wing folded flat keeps both sides)
      while (a > b || a > c) [a, b, c] = [b, c, a];
      const key = `${a},${b},${c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a, b, c);
    }
    if (out.length / 3 <= maxTris || g <= 1) {
      const means = new Float32Array(cells.size * 3);
      for (let c = 0; c < cells.size; c++) for (let k = 0; k < 3; k++) means[c * 3 + k] = sum[c * 4 + k] / sum[c * 4 + 3];
      return { pos: means, idx: Uint32Array.from(out) };
    }
  }
}

export function hullFromTriangles(positions, indices, { maxTris = 1500, property = 0, name = 'hull' } = {}) {
  const { pos, idx } = indices.length / 3 > maxTris ? clustered(positions, indices, maxTris) : { pos: positions, idx: indices };
  const n = idx.length / 3;
  const tris = new Float32Array(n * 9);
  for (let i = 0; i < idx.length; i++) for (let k = 0; k < 3; k++) tris[i * 3 + k] = pos[idx[i] * 3 + k];
  const rays = treeOf(tris, new Uint8Array(n), new Uint8Array(n).fill(property));
  return finish(0, [{ name, property }], rays, [], []);
}

export function segmentHit(hull, { at0, at1, basis: m, scale }, a, b) {
  a = pt(a);
  b = pt(b);
  const s = 1 / scale;
  // a − at0 and b − at1 into the ship’s frame (the basis’s transpose, then ÷ scale)
  const ax = a[0] - at0[0], ay = a[1] - at0[1], az = a[2] - at0[2];
  const bx = b[0] - at1[0], by = b[1] - at1[1], bz = b[2] - at1[2];
  const ox = (m[0] * ax + m[1] * ay + m[2] * az) * s, oy = (m[3] * ax + m[4] * ay + m[5] * az) * s, oz = (m[6] * ax + m[7] * ay + m[8] * az) * s;
  const dx = (m[0] * bx + m[1] * by + m[2] * bz) * s - ox, dy = (m[3] * bx + m[4] * by + m[5] * bz) * s - oy, dz = (m[6] * bx + m[7] * by + m[8] * bz) * s - oz;
  const k = cast(hull.rays, ox, oy, oz, dx, dy, dz, false);
  if (k < 0) return null;
  const t = found;
  normalOf(hull.rays.tris, k);
  // facing back along the bolt, whichever way the triangle is wound
  const f = N[0] * dx + N[1] * dy + N[2] * dz > 0 ? -1 : 1;
  const wx = (m[0] * N[0] + m[3] * N[1] + m[6] * N[2]) * f, wy = (m[1] * N[0] + m[4] * N[1] + m[7] * N[2]) * f, wz = (m[2] * N[0] + m[5] * N[1] + m[8] * N[2]) * f;
  const l = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1;
  return {
    t,
    part: hull.rays.part[k],
    property: hull.rays.property[k],
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    normal: [wx / l + 0, wy / l + 0, wz / l + 0], // (+ 0: no −0)
  };
}

// Each of the small ship’s probes, from where it was (smallPose.at0) to
// where it is (at1), in the big ship’s moving frame, against its solids:
// the path clipped by each solid’s planes. A probe that came in from outside
// (or from on a face, within SKIN, where the last push left it) is put back
// out through the plane it entered by: a thin wall crossed in one step
// pushes it back the side it came from. One already inside that stays is
// put out by its nearest face (a ship arriving inside); one on its way out
// is let go. Where the big ship has no solids (a drawn hull), against its
// ray triangles, whichever way they are wound: a probe that starts outside
// and crosses a face from either side is pushed back the side it came from,
// by how far behind the face it ended; one that starts and stays inside the
// mesh is put out through the nearest point of it. Every push leaves the
// probe SKIN outside, so the next step’s sweep starts in front of the
// surface. The deepest probe wins; `at` is where it is put, at the step’s end.
export function hullContact(small, sp, big, bp) {
  const pr = small.probes;
  const n = pr.length / 3;
  if (!n) return null;
  const r = bp.basis;
  const q = sp.basis;
  const inv = 1 / bp.scale;
  // M = Rbᵀ·Rs × the sizes’ ratio (row i, column j: the big ship’s axis i on the small’s axis j)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i * 3 + j] = (r[i * 3] * q[j * 3] + r[i * 3 + 1] * q[j * 3 + 1] + r[i * 3 + 2] * q[j * 3 + 2]) * sp.scale * inv;
  if (seg.length < n * 6) seg = new Float64Array(n * 6);
  for (let i = 0; i < 3; i++) {
    // the small ship’s place in the big one’s frame at the step’s start and end
    const s0 = (r[i * 3] * (sp.at0[0] - bp.at0[0]) + r[i * 3 + 1] * (sp.at0[1] - bp.at0[1]) + r[i * 3 + 2] * (sp.at0[2] - bp.at0[2])) * inv;
    const s1 = (r[i * 3] * (sp.at1[0] - bp.at1[0]) + r[i * 3 + 1] * (sp.at1[1] - bp.at1[1]) + r[i * 3 + 2] * (sp.at1[2] - bp.at1[2])) * inv;
    SWEPT[i] = Infinity;
    SWEPT[i + 3] = -Infinity;
    for (let p = 0; p < n; p++) {
      const l = M[i * 3] * pr[p * 3] + M[i * 3 + 1] * pr[p * 3 + 1] + M[i * 3 + 2] * pr[p * 3 + 2];
      seg[p * 6 + i] = l + s0;
      seg[p * 6 + 3 + i] = l + s1;
      SWEPT[i] = Math.min(SWEPT[i], l + Math.min(s0, s1));
      SWEPT[i + 3] = Math.max(SWEPT[i + 3], l + Math.max(s0, s1));
    }
  }
  let deepest = 0, part = -1, at = -1, nx = 0, ny = 0, nz = 0;
  const { solids, rays } = big;
  for (let s = 0; s < solids.length; s++) {
    const { planes: pl, box: b } = solids[s];
    if (b[0] > SWEPT[3] + SKIN || b[3] < SWEPT[0] - SKIN || b[1] > SWEPT[4] + SKIN || b[4] < SWEPT[1] - SKIN || b[2] > SWEPT[5] + SKIN || b[5] < SWEPT[2] - SKIN) continue;
    for (let p = 0; p < n; p++) {
      const o = p * 6;
      const sx = seg[o], sy = seg[o + 1], sz = seg[o + 2];
      const ex = seg[o + 3], ey = seg[o + 4], ez = seg[o + 5];
      if (Math.max(sx, ex) < b[0] - SKIN || Math.min(sx, ex) > b[3] + SKIN || Math.max(sy, ey) < b[1] - SKIN || Math.min(sy, ey) > b[4] + SKIN || Math.max(sz, ez) < b[2] - SKIN || Math.min(sz, ez) > b[5] + SKIN) continue;
      let tIn = 0, tOut = 1, enter = -1, least = Infinity, way = -1, j = 0;
      for (; j < pl.length; j += 4) {
        const ds = pl[j] * sx + pl[j + 1] * sy + pl[j + 2] * sz - pl[j + 3];
        const de = pl[j] * ex + pl[j + 1] * ey + pl[j + 2] * ez - pl[j + 3];
        if (ds > -SKIN) {
          // out of this face at the start, or on it: a way in
          if (de > 0) break; // and out of it at the end: the path passed the solid by
          const t = ds > 0 ? ds / (ds - de) : 0;
          if (enter < 0 || t > tIn) {
            tIn = t;
            enter = j;
          }
        } else if (de > 0) tOut = Math.min(tOut, ds / (ds - de));
        if (tIn > tOut) break;
        if (-de < least) {
          least = -de;
          way = j;
        }
      }
      if (j < pl.length) continue; // the path passed it by
      // in from outside: back out the plane it came in by; inside and staying:
      // out by its nearest face; inside and leaving: let go
      const w = enter >= 0 ? enter : tOut === 1 ? way : -1;
      if (w < 0) continue;
      const depth = pl[w + 3] - (pl[w] * ex + pl[w + 1] * ey + pl[w + 2] * ez) + SKIN;
      if (depth > deepest) [deepest, part, at, nx, ny, nz] = [depth, solids[s].part, p, pl[w], pl[w + 1], pl[w + 2]];
    }
  }
  for (let p = 0; p < n && !solids.length; p++) {
    const o = p * 6;
    const sx = seg[o], sy = seg[o + 1], sz = seg[o + 2];
    const ex = seg[o + 3], ey = seg[o + 4], ez = seg[o + 5];
    let h = -1, depth = 0;
    if (!inside(rays, sx, sy, sz)) {
      h = cast(rays, sx, sy, sz, ex - sx, ey - sy, ez - sz, false);
      if (h < 0) continue;
      normalOf(rays.tris, h);
      const along = (ex - sx) * N[0] + (ey - sy) * N[1] + (ez - sz) * N[2];
      if (along > 0) flip(); // facing back the way it came
      depth = (1 - found) * Math.abs(along) + SKIN;
    } else if (inside(rays, ex, ey, ez)) {
      h = closest(rays, ex, ey, ez);
      const l = Math.sqrt(C[3]);
      if (l > 1e-9) for (let k = 0; k < 3; k++) N[k] = (C[k] - seg[o + 3 + k]) / l;
      else {
        // on the face itself: its normal, turned away from the middle of the mesh
        normalOf(rays.tris, h);
        const b = rays.box;
        if (N[0] * (ex - (b[0] + b[3]) / 2) + N[1] * (ey - (b[1] + b[4]) / 2) + N[2] * (ez - (b[2] + b[5]) / 2) < 0) flip();
      }
      depth = l + SKIN;
    } else continue; // inside and leaving: let go
    if (depth > deepest) [deepest, part, at, nx, ny, nz] = [depth, rays.part[h], p, N[0], N[1], N[2]];
  }
  if (part < 0) return null;
  const wx = r[0] * nx + r[3] * ny + r[6] * nz, wy = r[1] * nx + r[4] * ny + r[7] * nz, wz = r[2] * nx + r[5] * ny + r[8] * nz;
  const l = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1;
  const s = bp.scale;
  // the deepest probe put back out: SKIN off the big ship’s surface, at the step’s end
  const ox = seg[at * 6 + 3] + nx * deepest, oy = seg[at * 6 + 4] + ny * deepest, oz = seg[at * 6 + 5] + nz * deepest;
  return {
    normal: [wx / l + 0, wy / l + 0, wz / l + 0],
    depth: deepest * s,
    at: [bp.at1[0] + (r[0] * ox + r[3] * oy + r[6] * oz) * s, bp.at1[1] + (r[1] * ox + r[4] * oy + r[7] * oz) * s, bp.at1[2] + (r[2] * ox + r[5] * oy + r[8] * oz) * s],
    part,
  };
}
