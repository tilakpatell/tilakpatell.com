// The site's hulls (the hulls design §2.1): a ship the game never had, or
// whose game shapes miss the model the galaxy draws (bf2017-hulls.mjs's
// SITE_OVER_GAME), is hit on its drawn model, simplified with meshoptimizer:
// about 600 triangles for a fighter and 4,000 for a capital, one part, and
// the war's subsystems parts of their own where the war fires at them. Made
// ahead of time by scripts/bf2017-hulls.mjs; this is its pure part (the
// frame is bf2017-hulls.mjs's, the one galaxy/models.js draws the kind in).
//
//   siteHull(doc, kind, { maxTris, nose }) → shapes: root 1 the simplified
//     triangles (bolts), root 0 up to SITE_SOLIDS convex hulls (contact), part 0
//   subsystemParts(subsystems, first) → { parts, shapes }: the war's
//     subsystems as parts named for their ids
//
// A game capital's hull is cut to the same budget (the hulls design §2.1:
// a battle's dozen kinds under 300 KB; §2.6: the hull and contact work under
// half a millisecond a frame at mid): its modules' shapes as the game has
// them are the Star Destroyer's 2.9 MB, 116,000 triangles and 4,278 solids,
// 291 ms to build.
//
//   capitalBudget(hull, { maxTris, maxSolids, greeble, maxBytes }) → { hull, said }:
//     root 1 at most `maxTris` triangles over all its parts, each part kept
//     (its index, name and property); root 0 at most `maxSolids` solids; the
//     whole at most `maxBytes`

import { MeshoptSimplifier } from 'meshoptimizer';
import { hullOf } from '../../src/lib/combat/hulls.js';
import { packHull } from '../../src/lib/physics/shapesBin.js';
import { OBJECTIVE, assemble, boxOf, drawnPrimitives, frameOf } from './bf2017-hulls.mjs';
import { reduceHull } from './bf2017-physics.mjs';

// the careful simplifier's error bound (a share of the model's size): at
// 0.01 it stops well short of a fighter's 600 triangles on the B-wing, whose
// many separate pieces are all border, and the sloppy one's grid then covers
// the drawing worse (a drawn vertex's mean distance from the hull 1.5 % of the
// length, against 1.0 % at 0.05); the sloppy one has no bound: the budget is
// the bound
export const SITE_ERROR = 0.05;
// root 0's solids: up to this many convex hulls of the drawn vertices, each of
// at most 64 points (reduceHull's)
export const SITE_SOLIDS = 8;

// The drawn model's triangles in the frame it is drawn in, its vertices
// welded where they meet (to a millionth of its length): { positions, indices }
function drawnMesh(doc, frame) {
  const positions = [];
  const indices = [];
  const seen = new Map();
  for (const { points, triangles } of drawnPrimitives(doc, frame)) {
    if (!triangles) continue;
    const at = new Int32Array(points.length / 3);
    for (let i = 0; i < at.length; i++) {
      const p = points.subarray(i * 3, i * 3 + 3);
      const key = `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)},${Math.round(p[2] * 1e6)}`;
      let j = seen.get(key);
      if (j === undefined) {
        j = positions.length / 3;
        seen.set(key, j);
        positions.push(p[0], p[1], p[2]);
      }
      at[i] = j;
    }
    for (let i = 0; i + 2 < triangles.length; i += 3) {
      const [a, b, c] = [at[triangles[i]], at[triangles[i + 1]], at[triangles[i + 2]]];
      if (a !== b && b !== c && a !== c) indices.push(a, b, c);
    }
  }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

// At most `maxTris` of the triangles, by the careful simplifier, else the
// sloppy one (bf2017-horizon.mjs's way), less six to spare: then, for each of
// the drawn box's six faces whose extreme vertex the simplifier collapsed
// away, one drawn triangle on that vertex put back, so the hull's box is the
// model's (a fighter's thin wing tip or nose goes first at 600)
function simplifiedTriangles(P, I, maxTris) {
  if (I.length <= maxTris * 3) return I;
  const target = (maxTris - 6) * 3;
  let [out] = MeshoptSimplifier.simplify(I, P, 3, target, SITE_ERROR);
  if (out.length > target) [out] = MeshoptSimplifier.simplifySloppy(I, P, 3, null, target, 1);
  const kept = Array.from(out);
  for (let a = 0; a < 3; a++)
    for (const sign of [1, -1]) {
      let best = -1;
      for (const v of I) if (best < 0 || sign * P[v * 3 + a] > sign * P[best * 3 + a]) best = v;
      if (kept.some((v) => sign * P[v * 3 + a] >= sign * P[best * 3 + a])) continue;
      for (let t = 0; t < I.length; t += 3)
        if (I[t] === best || I[t + 1] === best || I[t + 2] === best) {
          kept.push(I[t], I[t + 1], I[t + 2]);
          break;
        }
    }
  return Uint32Array.from(kept);
}

// k-means of the points (k at most, seeded with the farthest from the middle,
// then each the farthest from those chosen), each lot of four or more a
// convex hull's points cut to 64
function solidsOf(P, k) {
  const n = P.length / 3;
  const d2 = (i, c) => (P[i * 3] - c[0]) ** 2 + (P[i * 3 + 1] - c[1]) ** 2 + (P[i * 3 + 2] - c[2]) ** 2;
  const mid = [0, 0, 0];
  for (let i = 0; i < n * 3; i++) mid[i % 3] += P[i] / n;
  const centres = [];
  const near = new Float64Array(n).fill(Infinity);
  let next = 0;
  for (let i = 0; i < n; i++) if (d2(i, mid) > d2(next, mid)) next = i;
  while (centres.length < Math.min(k, Math.floor(n / 4))) {
    centres.push([P[next * 3], P[next * 3 + 1], P[next * 3 + 2]]);
    for (let i = 0; i < n; i++) near[i] = Math.min(near[i], d2(i, centres.at(-1)));
    next = 0;
    for (let i = 0; i < n; i++) if (near[i] > near[next]) next = i;
  }
  const of = new Int32Array(n).fill(-1);
  for (let round = 0; round < 64; round++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      let best = 0;
      for (let c = 1; c < centres.length; c++) if (d2(i, centres[c]) < d2(i, centres[best])) best = c;
      if (of[i] !== best) moved++;
      of[i] = best;
    }
    if (!moved) break;
    const sum = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) for (let a = 0; a < 4; a++) sum[of[i]][a] += a < 3 ? P[i * 3 + a] : 1;
    sum.forEach((s, c) => s[3] && (centres[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]));
  }
  return centres
    .map((_, c) => {
      const pts = [];
      for (let i = 0; i < n; i++) if (of[i] === c) pts.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      return pts;
    })
    .filter((pts) => pts.length >= 12)
    .map((pts) => reduceHull(Float32Array.from(pts)));
}

// A site hull: the drawn model's triangles (every primitive through its node,
// in the frame galaxy/models.js draws the kind in: turned by `nose`, centred,
// its fitScale) simplified to `maxTris` for bolts (root 1), and up to
// SITE_SOLIDS convex hulls of its vertices for contact (root 0); one part, 0.
export async function siteHull(doc, kind, { maxTris, nose = 0 } = {}) {
  await MeshoptSimplifier.ready;
  const { positions, indices } = drawnMesh(doc, frameOf(doc, nose, kind));
  if (!indices.length) throw new Error(`${kind}: no triangles drawn`);
  const kept = simplifiedTriangles(positions, indices, maxTris);
  // (the triangles' own vertices only, in a run)
  const remap = new Map();
  const points = [];
  const idx = new Uint32Array(kept.length);
  kept.forEach((v, i) => {
    if (!remap.has(v)) {
      remap.set(v, remap.size);
      points.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    }
    idx[i] = remap.get(v);
  });
  const base = { part: 0, instance: 0, material: 0 };
  return [{ kind: 'mesh', root: 1, ...base, points: Float32Array.from(points), indices: idx }, ...solidsOf(positions, SITE_SOLIDS).map((p) => ({ kind: 'hull', root: 0, ...base, points: p }))];
}

// The war's subsystems on a ship (universe/wars.js's SUBSYSTEMS: each an
// `id`, its place `at` as shares of the length and its radius `r`), each a
// part of its own from `first`, named for its id and carrying OBJECTIVE: a
// box `r` either way of its place, in root 1, so a bolt on it names it
export function subsystemParts(subsystems, first = 0) {
  const parts = subsystems.map((s) => ({ name: s.id, property: OBJECTIVE }));
  const shapes = subsystems.map((s, n) => {
    const corners = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push(s.at[0] + x * s.r, s.at[1] + y * s.r, s.at[2] + z * s.r);
    return { kind: 'hull', root: 1, part: first + n, instance: 0, material: OBJECTIVE, points: Float32Array.from(corners) };
  });
  return { parts, shapes };
}

// ── a game capital's hull, to the budget ──

// root 1's triangles over all its parts (a capital's site hull's, so a game
// capital costs what a site one does) and root 0's solids (what a contact
// query loops over)
export const CAPITAL_TRIS = 4000;
export const CAPITAL_SOLIDS = 256;
// a root 0 solid less than this share of the length across is a greeble
// (a vent, a rail): dropped from contact first
export const GREEBLE = 0.01;
// each part's fewest triangles (a part with fewer keeps its own); one the
// simplifier leaves under four is a box of its own, so a turret stays hittable
const FLOOR = 12;
const FEWEST = 4;
// a part this share of the length across is a box's size (the Star
// Destroyer's turrets' parts are 0.010 to 0.026, its shield domes 0.03)
const COMPACT = 0.03;

// a mesh's `count` largest triangles
function largest(I, P, count) {
  const area = (t) => {
    const [a, b, c] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]];
    const u = [0, 1, 2].map((k) => P[b * 3 + k] - P[a * 3 + k]);
    const v = [0, 1, 2].map((k) => P[c * 3 + k] - P[a * 3 + k]);
    return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
  };
  const order = Array.from({ length: I.length / 3 }, (_, t) => t)
    .map((t) => [t, area(t)])
    .sort((x, y) => y[1] - x[1])
    .slice(0, count);
  return Uint32Array.from(order.flatMap(([t]) => [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]]));
}

// a triangle soup (nine numbers a triangle): its area, its box
function soupOf(t) {
  let area = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < t.length; i += 9) {
    const u = [t[i + 3] - t[i], t[i + 4] - t[i + 1], t[i + 5] - t[i + 2]];
    const v = [t[i + 6] - t[i], t[i + 7] - t[i + 1], t[i + 8] - t[i + 2]];
    area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    for (let c = 0; c < 9; c++) {
      min[c % 3] = Math.min(min[c % 3], t[i + c]);
      max[c % 3] = Math.max(max[c % 3], t[i + c]);
    }
  }
  return { area, min, max, n: t.length / 9 };
}

// a soup's vertices welded where they meet: { P, I }
function weld(t) {
  const P = [];
  const I = new Uint32Array(t.length / 3);
  const seen = new Map();
  for (let v = 0; v < t.length / 3; v++) {
    const key = `${Math.round(t[v * 3] * 1e6)},${Math.round(t[v * 3 + 1] * 1e6)},${Math.round(t[v * 3 + 2] * 1e6)}`;
    let j = seen.get(key);
    if (j === undefined) {
      j = P.length / 3;
      seen.set(key, j);
      P.push(t[v * 3], t[v * 3 + 1], t[v * 3 + 2]);
    }
    I[v] = j;
  }
  return { P: Float32Array.from(P), I };
}

// the triangles `I` names, their own vertices only, in a run
function compact(P, I) {
  const remap = new Map();
  const points = [];
  const indices = new Uint32Array(I.length);
  I.forEach((v, i) => {
    if (!remap.has(v)) {
      remap.set(v, remap.size);
      points.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    }
    indices[i] = remap.get(v);
  });
  return { points: Float32Array.from(points), indices };
}

// a box's twelve triangles (corner i is x·4 + y·2 + z; each face two)
function boxMesh(min, max) {
  const points = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) points.push(x, y, z);
  const faces = [
    [0, 1, 3, 2],
    [4, 6, 7, 5],
    [0, 4, 5, 1],
    [2, 3, 7, 6],
    [0, 2, 6, 4],
    [1, 5, 7, 3],
  ];
  return { points: Float32Array.from(points), indices: Uint32Array.from(faces.flatMap(([a, b, c, d]) => [a, b, c, a, c, d])) };
}

// each part's triangles: its own where it has fewer than FLOOR, else FLOOR
// or its share of the budget by its surface area, whichever is more, never
// more than its own; the share the largest that keeps the sum within budget
function allocate(parts, budget) {
  const sum = (s) => parts.reduce((n, p) => n + Math.min(p.n, Math.max(FLOOR, s * p.area)), 0);
  if (sum(0) > budget) throw new Error(`${parts.length} parts at ${FLOOR} triangles each are over ${budget}`);
  let lo = 0;
  let hi = 1;
  while (sum(hi) < budget && hi < 1e15) hi *= 2;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (sum(mid) <= budget) lo = mid;
    else hi = mid;
  }
  return parts.map((p) => Math.floor(Math.min(p.n, Math.max(FLOOR, lo * p.area))));
}

// a part's welded triangles cut to `target`: the careful simplifier with its
// borders locked (where a module's pieces meet), else the sloppy one
function cut(P, I, target) {
  if (I.length <= target * 3) return I;
  let [out] = MeshoptSimplifier.simplify(I, P, 3, target * 3, SITE_ERROR, ['LockBorder']);
  if (out.length > target * 3) [out] = MeshoptSimplifier.simplifySloppy(I, P, 3, null, target * 3, 1);
  return out;
}

// a convex shape's points (a sphere's or a capsule's ends pushed out along
// the 26 ways, as hulls.js rounds them)
function pointsOf(s) {
  if (s.kind === 'hull') return s.points;
  const out = [];
  for (const c of s.kind === 'sphere' ? [s.centre] : [s.a, s.b])
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          const l = Math.hypot(x, y, z);
          if (l) out.push(c[0] + (x / l) * s.radius, c[1] + (y / l) * s.radius, c[2] + (z / l) * s.radius);
        }
  return Float32Array.from(out);
}

const across = (b) => Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);

// Solids merged down to `max`: the smallest into its nearest (the least gap
// between their boxes, then the nearest middles), the two's points one
// convex hull of at most 64 (reduceHull's), the larger's part kept
function merged(solids, max) {
  const items = solids.map((shape) => {
    const box = boxOf([shape]);
    return { shape, box, across: across(box) };
  });
  let n = 0;
  while (items.length > max) {
    let i = 0;
    for (let k = 1; k < items.length; k++) if (items[k].across < items[i].across) i = k;
    const a = items[i].box;
    let j = -1;
    let best = Infinity;
    for (let k = 0; k < items.length; k++) {
      if (k === i) continue;
      const b = items[k].box;
      let gap = 0;
      let mid = 0;
      for (let c = 0; c < 3; c++) {
        gap += Math.max(0, a.min[c] - b.max[c], b.min[c] - a.max[c]) ** 2;
        mid += ((a.min[c] + a.max[c]) / 2 - (b.min[c] + b.max[c]) / 2) ** 2;
      }
      const d = gap * 1e6 + mid;
      if (d < best) [best, j] = [d, k];
    }
    const [small, big] = [items[i], items[j]];
    const points = reduceHull(Float32Array.from([...pointsOf(small.shape), ...pointsOf(big.shape)]));
    const shape = { kind: 'hull', root: 0, part: big.shape.part, instance: 0, material: big.shape.material, points };
    const box = boxOf([shape]);
    items[j] = { shape, box, across: across(box) };
    items.splice(i, 1);
    n++;
  }
  return { solids: items.map((it) => it.shape), merges: n };
}

// Root 1 (bolts) cut to `maxTris` triangles over all its parts: every part's
// triangles as hullOf meets them (`rays`: meshes, and convex shapes' faces),
// each part simplified to its share by its area, keeping its index and
// property (a part the cut leaves under four triangles a box of its own), and,
// for each face of the hull's box the cut pulled in, the triangle that held it
// put back
function bolts(rays, maxTris, properties) {
  const byPart = new Map();
  for (let t = 0; t < rays.count; t++) {
    const list = byPart.get(rays.part[t]) ?? byPart.set(rays.part[t], []).get(rays.part[t]);
    for (let c = 0; c < 9; c++) list.push(rays.tris[t * 9 + c]);
  }
  const parts = [...byPart].map(([part, t]) => ({ part, t: Float32Array.from(t), ...soupOf(t) }));
  // (six spare for the box's faces)
  const alloc = allocate(parts, maxTris - 6);
  let boxes = 0;
  const out = parts.map((p, n) => {
    const { P, I } = weld(p.t);
    let kept = cut(P, I, alloc[n]);
    let mesh = null;
    // (a part the cut left under four triangles: a turret's size, its box; a
    // bigger one spread thin, its own largest triangles, never a box over the
    // space between its pieces; one that had no more is as it was)
    if (kept !== I && kept.length / 3 < FEWEST) {
      if (across(p) <= COMPACT) {
        mesh = boxMesh(p.min, p.max);
        boxes++;
      } else kept = largest(I, P, Math.max(FEWEST, alloc[n]));
    }
    return { kind: 'mesh', root: 1, part: p.part, instance: 0, material: properties[p.part], ...(mesh ?? compact(P, kept)) };
  });
  const was = boxOf([{ kind: 'mesh', points: rays.tris }]);
  const now = boxOf(out);
  for (let a = 0; a < 3; a++)
    for (const end of ['min', 'max']) {
      if (now[end][a] === was[end][a]) continue;
      let t = 0;
      for (let k = a; k < rays.count * 9; k += 3) if (rays.tris[k] === was[end][a]) t = Math.floor(k / 9);
      out.push({ kind: 'mesh', root: 1, part: rays.part[t], instance: 0, material: properties[rays.part[t]], points: Float32Array.from(rays.tris.subarray(t * 9, t * 9 + 9)), indices: Uint32Array.from([0, 1, 2]) });
    }
  return { shapes: out, boxes };
}

// Root 0 (contact) cut to `maxSolids`: first the solids wholly inside another
// (they add nothing a contact meets) and the ones hullOf can't make a solid
// of, then the greebles, then the smallest merged into their neighbours.
// `built` hullOf's solids of the same hull, in its root 0 convex shapes'
// order (one a shape it could hull).
function contact(solids, built, maxSolids, greeble) {
  const said = { flat: 0, contained: 0, greebles: 0, merges: 0 };
  // (each shape with its solid: hullOf skips a shape it can't hull)
  const paired = [];
  let j = 0;
  for (const s of solids) {
    const b = boxOf([s]);
    const sol = built[j];
    if (sol && [...b.min, ...b.max].every((v, k) => Math.abs(v - sol.box[k]) < 1e-5)) paired.push({ shape: s, solid: sol, box: b, j: j++ });
    else said.flat++;
  }
  const within = (p, planes) => {
    for (let i = 0; i < planes.length; i += 4) if (planes[i] * p[0] + planes[i + 1] * p[1] + planes[i + 2] * p[2] > planes[i + 3] + 1e-5) return false;
    return true;
  };
  const inside = (a, b) => {
    for (let k = 0; k < 3; k++) if (a.box.min[k] < b.solid.box[k] - 1e-5 || a.box.max[k] > b.solid.box[k + 3] + 1e-5) return false;
    const pts = pointsOf(a.shape);
    for (let i = 0; i < pts.length; i += 3) if (!within([pts[i], pts[i + 1], pts[i + 2]], b.solid.planes)) return false;
    return true;
  };
  // (of two the same, the first stays)
  let kept = paired.filter((a) => !paired.some((b) => b !== a && inside(a, b) && !(b.j > a.j && inside(b, a))));
  said.contained += paired.length - kept.length;
  kept = kept.map((a) => a.shape);
  if (kept.length > maxSolids) {
    const big = kept.filter((s) => across(boxOf([s])) >= greeble);
    said.greebles = kept.length - big.length;
    kept = big;
  }
  if (kept.length > maxSolids) {
    const m = merged(kept, maxSolids);
    kept = m.solids;
    said.merges = m.merges;
  }
  return { solids: kept, said };
}

// a hull's bytes: what the bucket serves and the page fetches with the model
export const CAPITAL_BYTES = 120000;
// what a solid's points come down to, in turn, while the hull is over its
// bytes (reduceHull keeps a solid's six extremes, so its box stays), then
// root 1 a tenth fewer triangles at a time
const POINTS = [64, 48, 32, 24, 16];

// A game capital's hull to the budget, in the frame it is drawn in (1 long):
// root 1 at most `maxTris` triangles in all (bolts), root 0 at most
// `maxSolids` solids (contact), and the whole at most `maxBytes`, every part
// kept with its index, name and property. A hull within all three is as it
// was.
export function capitalBudget(hull, { maxTris = CAPITAL_TRIS, maxSolids = CAPITAL_SOLIDS, greeble = GREEBLE, maxBytes = CAPITAL_BYTES } = {}) {
  const solids = hull.shapes.filter((s) => s.root === 0 && s.kind !== 'mesh');
  const h = hullOf(packHull(hull));
  const said = { tris: [h.rays.count, h.rays.count], solids: [solids.length, solids.length], boxes: 0, flat: 0, contained: 0, greebles: 0, merges: 0, points: 64 };
  if (h.rays.count <= maxTris && solids.length <= maxSolids && packHull(hull).byteLength <= maxBytes) return { hull, said };
  const properties = hull.parts.map((p) => p.property);
  const names = hull.parts.map((p) => p.name);
  // (root 0's meshes go: a hull of two roots meets bolts on root 1 and
  // contact on root 0's convex shapes alone, src/lib/combat/hulls.js)
  const c = contact(solids, h.solids, maxSolids, greeble);
  Object.assign(said, c.said);
  said.solids[1] = c.solids.length;
  let tris = maxTris;
  let root1 = h.rays.count > tris ? bolts(h.rays, tris, properties) : { shapes: hull.shapes.filter((s) => s.root !== 0), boxes: 0 };
  for (let p = 0; ; ) {
    const root0 = c.solids.map((s) => (s.kind === 'hull' && s.points.length / 3 > POINTS[p] ? { ...s, points: reduceHull(s.points, POINTS[p]) } : s));
    const out = assemble([...root0, ...root1.shapes], properties, names);
    if (packHull(out).byteLength <= maxBytes) {
      said.tris[1] = hullOf(packHull(out)).rays.count;
      said.boxes = root1.boxes;
      said.points = POINTS[p];
      return { hull: out, said };
    }
    if (p < POINTS.length - 1) p++;
    else {
      tris = Math.floor(tris * 0.9);
      if (tris < 1000) throw new Error(`no cut of the hull is within ${maxBytes} bytes`);
      root1 = bolts(h.rays, tris, properties);
    }
  }
}
