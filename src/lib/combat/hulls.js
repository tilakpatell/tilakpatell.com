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
//       where n·p ≤ d), part, box }], empty where the bin has one root.
//   hullFromTriangles(positions, indices, { maxTris, property, name }) → Hull:
//     a drawn model’s triangles, clustered on a grid until under `maxTris`.
//   segmentHit(hull, pose, a, b) → { t, part, property, point, normal } | null
//   hullContact(small, smallPose, big, bigPose) → { normal, depth, at, part } | null

import { readHull } from '../physics/shapesBin.js';

const LEAF = 4; // triangles a leaf
const SLACK = 1e-7; // a triangle widened by this in its corners’ weights, so a bolt down a shared edge meets one of the two
// contact on ray triangles leaves the probe this far outside (a share of the
// big ship’s length), so the next step’s sweep starts in front of the surface
export const SKIN = 1e-3;

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
let found = 0; // the last nearest()’s t
const N = new Float64Array(3); // the last normalOf()
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

// The nearest triangle along o + t·d, t in [0, 1] (Möller–Trumbore), or −1;
// its t is left in `found`. `cull` meets only a triangle’s front (wound
// outward), so a probe leaving through a face is let go.
function nearest(tree, ox, oy, oz, dx, dy, dz, cull) {
  if (!tree.nodes) return -1;
  const { box, node, tris } = tree;
  const ix = 1 / (dx || 1e-30), iy = 1 / (dy || 1e-30), iz = 1 / (dz || 1e-30);
  let best = 1, hit = -1, sp = 0;
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
      const det = e1x * px + e1y * py + e1z * pz; // −d·(e1 × e2): over 0 when the path meets the front
      if (cull ? det <= 0 : det === 0) continue;
      const inv = 1 / det;
      const sx = ox - vx, sy = oy - vy, sz = oz - vz;
      const u = (sx * px + sy * py + sz * pz) * inv;
      if (u < -SLACK || u > 1 + SLACK) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < -SLACK || u + v > 1 + SLACK) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t < 0 || t > best) continue;
      best = t;
      hit = k;
    }
  }
  found = best;
  return hit;
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
// hull so far replaces the faces it sees with a fan from their rim. A flat
// set is given a thousandth of its size in thickness first, so it is still a
// solid and still met.
function convex(pts) {
  const n = pts.length / 3;
  if (n < 3) return null;
  const P = (i, k) => pts[i * 3 + k];
  const far = (score) => {
    let best = -Infinity, at = 0;
    for (let i = 0; i < n; i++) {
      const s = score(P(i, 0), P(i, 1), P(i, 2));
      if (s > best) [best, at] = [s, i];
    }
    return [at, best];
  };
  const [i0] = far((x) => -x);
  const [x0, y0, z0] = [P(i0, 0), P(i0, 1), P(i0, 2)];
  const [i1, d1] = far((x, y, z) => (x - x0) ** 2 + (y - y0) ** 2 + (z - z0) ** 2);
  const size = Math.sqrt(d1);
  const eps = size * 1e-6;
  if (!(size > 1e-12)) return null;
  const [ux, uy, uz] = [(P(i1, 0) - x0) / size, (P(i1, 1) - y0) / size, (P(i1, 2) - z0) / size];
  const [i2, d2] = far((x, y, z) => Math.hypot((y - y0) * uz - (z - z0) * uy, (z - z0) * ux - (x - x0) * uz, (x - x0) * uy - (y - y0) * ux));
  if (d2 < eps) return null;
  const face = (a, b, c) => {
    const [ax, ay, az] = [P(a, 0), P(a, 1), P(a, 2)];
    const [px, py, pz] = [P(b, 0) - ax, P(b, 1) - ay, P(b, 2) - az];
    const [qx, qy, qz] = [P(c, 0) - ax, P(c, 1) - ay, P(c, 2) - az];
    const [nx, ny, nz] = [py * qz - pz * qy, pz * qx - px * qz, px * qy - py * qx];
    const l = Math.hypot(nx, ny, nz) || Infinity; // a sliver keeps a zero normal: it sees nothing
    return { a, b, c, nx: nx / l, ny: ny / l, nz: nz / l, d: (nx * ax + ny * ay + nz * az) / l };
  };
  const base = face(i0, i1, i2);
  const [i3, d3] = far((x, y, z) => Math.abs(base.nx * x + base.ny * y + base.nz * z - base.d));
  if (d3 < eps) {
    const h = size * 1e-3;
    const thick = new Float32Array(n * 6);
    thick.set(pts);
    for (let i = 0; i < n; i++) thick.set([P(i, 0) + base.nx * h, P(i, 1) + base.ny * h, P(i, 2) + base.nz * h], (n + i) * 3);
    return convex(thick);
  }
  const mid = [0, 1, 2].map((k) => (P(i0, k) + P(i1, k) + P(i2, k) + P(i3, k)) / 4);
  let faces = [
    [i0, i1, i2],
    [i0, i2, i3],
    [i0, i3, i1],
    [i1, i3, i2],
  ].map(([a, b, c]) => {
    const f = face(a, b, c);
    return f.nx * mid[0] + f.ny * mid[1] + f.nz * mid[2] - f.d > 0 ? face(a, c, b) : f;
  });
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1 || i === i2 || i === i3) continue;
    const [x, y, z] = [P(i, 0), P(i, 1), P(i, 2)];
    const seen = faces.filter((f) => f.nx * x + f.ny * y + f.nz * z - f.d > eps);
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
  const k = nearest(hull.rays, ox, oy, oz, dx, dy, dz, false);
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
// is put back out through the plane it entered by (a thin wall crossed in
// one step pushes it back the side it came from); one that was already
// inside and stays is put out by its nearest face (a ship arriving inside);
// one on its way out is let go. Where the big ship has no solids, a probe’s
// path against its ray triangles’ fronts: pushed back along the face it
// crossed by how far behind it the probe ended, and SKIN more. The deepest
// wins; `at` is where it is put, on the big ship’s surface at the step’s end.
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
  const { solids } = big;
  for (let s = 0; s < solids.length; s++) {
    const { planes: pl, box: b } = solids[s];
    if (b[0] > SWEPT[3] || b[3] < SWEPT[0] || b[1] > SWEPT[4] || b[4] < SWEPT[1] || b[2] > SWEPT[5] || b[5] < SWEPT[2]) continue;
    for (let p = 0; p < n; p++) {
      const o = p * 6;
      const sx = seg[o], sy = seg[o + 1], sz = seg[o + 2];
      const ex = seg[o + 3], ey = seg[o + 4], ez = seg[o + 5];
      if (Math.max(sx, ex) < b[0] || Math.min(sx, ex) > b[3] || Math.max(sy, ey) < b[1] || Math.min(sy, ey) > b[4] || Math.max(sz, ez) < b[2] || Math.min(sz, ez) > b[5]) continue;
      let tIn = 0, tOut = 1, enter = -1, least = Infinity, way = -1, j = 0;
      for (; j < pl.length; j += 4) {
        const ds = pl[j] * sx + pl[j + 1] * sy + pl[j + 2] * sz - pl[j + 3];
        const de = pl[j] * ex + pl[j + 1] * ey + pl[j + 2] * ez - pl[j + 3];
        if (ds > 0) {
          if (de > 0) break;
          if (ds / (ds - de) > tIn) {
            tIn = ds / (ds - de);
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
      const depth = pl[w + 3] - (pl[w] * ex + pl[w + 1] * ey + pl[w + 2] * ez);
      if (depth > deepest) [deepest, part, at, nx, ny, nz] = [depth, solids[s].part, p, pl[w], pl[w + 1], pl[w + 2]];
    }
  }
  if (!solids.length) {
    for (let p = 0; p < n; p++) {
      const o = p * 6;
      const dx = seg[o + 3] - seg[o], dy = seg[o + 4] - seg[o + 1], dz = seg[o + 5] - seg[o + 2];
      const h = nearest(big.rays, seg[o], seg[o + 1], seg[o + 2], dx, dy, dz, true);
      if (h < 0) continue;
      normalOf(big.rays.tris, h);
      // how far behind the face it crossed the probe ended, and SKIN more
      const depth = (found - 1) * (dx * N[0] + dy * N[1] + dz * N[2]) + SKIN;
      if (depth > deepest) [deepest, part, at, nx, ny, nz] = [depth, big.rays.part[h], p, N[0], N[1], N[2]];
    }
  }
  if (part < 0) return null;
  const wx = r[0] * nx + r[3] * ny + r[6] * nz, wy = r[1] * nx + r[4] * ny + r[7] * nz, wz = r[2] * nx + r[5] * ny + r[8] * nz;
  const l = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1;
  const s = bp.scale;
  // the deepest probe put back out: on the big ship’s surface, at the step’s end
  const ox = seg[at * 6 + 3] + nx * deepest, oy = seg[at * 6 + 4] + ny * deepest, oz = seg[at * 6 + 5] + nz * deepest;
  return {
    normal: [wx / l + 0, wy / l + 0, wz / l + 0],
    depth: deepest * s,
    at: [bp.at1[0] + (r[0] * ox + r[3] * oy + r[6] * oz) * s, bp.at1[1] + (r[1] * ox + r[4] * oy + r[7] * oz) * s, bp.at1[2] + (r[2] * ox + r[5] * oy + r[8] * oz) * s],
    part,
  };
}
