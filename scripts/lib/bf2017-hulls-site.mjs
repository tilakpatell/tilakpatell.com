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
//   compact(P, I) → { points, indices }: the triangles' own vertices only
//     (bf2017-hulls-budget.mjs's too)

import { MeshoptSimplifier } from 'meshoptimizer';
import { OBJECTIVE, drawnPrimitives, frameOf } from './bf2017-hulls.mjs';
import { reduceHull } from './bf2017-physics.mjs';

// the careful simplifier's error bound (a share of the model's size): at
// 0.01 it stops well short of a fighter's 600 triangles on the B-wing, whose
// many separate pieces are all border, and the sloppy one's grid then covers
// the drawing worse (a drawn vertex's mean distance from the hull 1.5 % of the
// length, against 1.0 % at 0.05); the sloppy one has no bound: the budget is
// the bound
const SITE_ERROR = 0.05;
// root 0's solids: up to this many convex hulls of the drawn vertices, each of
// at most 64 points (reduceHull's)
const SITE_SOLIDS = 8;

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

// the triangles `I` names (of the points `P`), their own vertices only, in
// a run: { points, indices }
export function compact(P, I) {
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

// A site hull: the drawn model's triangles (every primitive through its node,
// in the frame galaxy/models.js draws the kind in: turned by `nose`, centred,
// its fitScale) simplified to `maxTris` for bolts (root 1), and up to
// SITE_SOLIDS convex hulls of its vertices for contact (root 0); one part, 0.
export async function siteHull(doc, kind, { maxTris, nose = 0 } = {}) {
  await MeshoptSimplifier.ready;
  const { positions, indices } = drawnMesh(doc, frameOf(doc, nose, kind));
  if (!indices.length) throw new Error(`${kind}: no triangles drawn`);
  const kept = simplifiedTriangles(positions, indices, maxTris);
  const base = { part: 0, instance: 0, material: 0 };
  return [{ kind: 'mesh', root: 1, ...base, ...compact(positions, kept) }, ...solidsOf(positions, SITE_SOLIDS).map((p) => ({ kind: 'hull', root: 0, ...base, points: p }))];
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
