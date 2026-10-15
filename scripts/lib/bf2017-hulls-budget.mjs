// A game capital's hull cut to a capital's budget (the hulls design §2.1:
// a battle's dozen kinds about 300 KB; §2.6: the hull and contact work under
// half a millisecond a frame at mid; the controller's ruling, 2026-10-14:
// 4,000 bolt triangles, 256 solids, about 120 KB a capital, built in 20 ms).
// Its modules' shapes as the game has them are the Star Destroyer's 2.9 MB,
// 116,000 triangles and 4,278 solids, 291 ms to build. Pure; used by
// scripts/bf2017-hulls.mjs, which holds the cut hull to its drawing again and
// to the uncut one's contact.
//
//   capitalBudget(hull, { maxTris, maxSolids, greeble, maxBytes }) → Promise<{ hull, said }>:
//     root 1 at most `maxTris` triangles over all its parts, each part kept
//     (its index, name and property); root 0 at most `maxSolids` solids; the
//     whole at most `maxBytes`
//   passThrough(cut, uncut, fighter, { lines, scale }) → { lines, cut, uncut }:
//     the seeded lines through the cut hull's bolts and none of its solids,
//     and on how many a fighter flown down them passes through each hull
//   sinkIn(hull, { lines, depth }) → the share of bolts that meet the hull
//     with no solid within `depth` behind

import { MeshoptSimplifier } from 'meshoptimizer';
import { hullContact, hullOf, segmentHit } from '../../src/lib/combat/hulls.js';
import { packHull } from '../../src/lib/physics/shapesBin.js';
import { assemble, boxOf } from './bf2017-hulls.mjs';
import { compact } from './bf2017-hulls-site.mjs';
import { reduceHull } from './bf2017-physics.mjs';

// root 1's triangles over all its parts (a capital's site hull's, so a game
// capital costs what a site one does) and root 0's solids (what a contact
// query loops over)
const CAPITAL_TRIS = 4000;
const CAPITAL_SOLIDS = 256;
// a root 0 solid less than this share of the length across is a greeble
// (a vent, a rail): dropped from contact first
const GREEBLE = 0.01;
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
// borders locked (where a module's pieces meet), then with them free, its
// error unbounded (the budget bounds it), and only then the sloppy one, whose
// grid bulges past the solids: the MC80's main hull cut sloppy left 4.9 % of
// bolts with no solid within a hundredth behind them, the careful way 0.8 %
// (the uncut hull 1.0 %)
function cut(P, I, target) {
  if (I.length <= target * 3) return I;
  let [out] = MeshoptSimplifier.simplify(I, P, 3, target * 3, 1, ['LockBorder']);
  if (out.length > target * 3) [out] = MeshoptSimplifier.simplify(I, P, 3, target * 3, 1);
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
  const welded = parts.map((p) => weld(p.t));
  const cutAll = (alloc) => {
    let boxes = 0;
    const shapes = parts.map((p, n) => {
      const { P, I } = welded[n];
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
    return { shapes, boxes, total: shapes.reduce((n, s) => n + s.indices.length / 3, 0) };
  };
  // (six spare for the box's faces; the sloppy simplifier often stops well
  // under what it was asked for, so the shares are raised and the parts cut
  // again, up to three times, while the whole is under 95 % of the budget)
  const cap = maxTris - 6;
  const all = parts.reduce((n, p) => n + p.n, 0);
  let best = null;
  for (let i = 0, target = cap; i < 4; i++) {
    const tried = cutAll(allocate(parts, target));
    if (tried.total <= cap && (!best || tried.total > best.total)) best = tried;
    if ((best && best.total >= 0.95 * cap) || target >= all) break;
    target = Math.min(all, Math.floor((target * cap) / tried.total));
  }
  const { shapes: out, boxes } = best;
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

// Root 0's solids less what adds nothing a contact meets: the ones hullOf
// can't make a solid of, and the ones wholly inside another. `built` is
// hullOf's solids of the same hull, in its root 0 convex shapes' order (one
// a shape it could hull).
function cleaned(solids, built) {
  const said = { flat: 0, contained: 0 };
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
  const kept = paired.filter((a) => !paired.some((b) => b !== a && inside(a, b) && !(b.j > a.j && inside(b, a))));
  said.contained = paired.length - kept.length;
  return { solids: kept.map((a) => a.shape), said };
}

// at most `maxSolids` of them: the greebles out, then the smallest merged
// into their neighbours
function fewer(solids, maxSolids, greeble) {
  let out = solids;
  const said = { greebles: 0, merges: 0 };
  if (out.length > maxSolids) {
    out = out.filter((s) => across(boxOf([s])) >= greeble);
    said.greebles = solids.length - out.length;
  }
  if (out.length > maxSolids) {
    const m = merged(out, maxSolids);
    out = m.solids;
    said.merges = m.merges;
  }
  return { solids: out, said };
}

// a hull's bytes: what the bucket serves and the page fetches with the model
const CAPITAL_BYTES = 120000;
// What gives, in turn, while a hull is over its bytes, contact's fidelity
// last (a solid cut to fewer points shrinks inside its first self, and
// neighbours that met stop meeting: a fighter-sized gap through the MC80's
// main hull at 24 points, none at 64): root 1's triangles a tenth at a time
// to half the budget, then root 0's solids 32 at a time to half the budget,
// then the points a solid keeps (reduceHull keeps its six extremes, so its
// box stays).
const POINTS = [64, 48, 32, 24, 16];
const tried = (maxTris, maxSolids) => {
  const out = [];
  for (let t = maxTris; t >= maxTris / 2; t = Math.floor(t * 0.9)) out.push({ tris: t, solids: maxSolids, points: 64 });
  const t = out.at(-1).tris;
  for (let s = maxSolids - 32; s >= maxSolids / 2; s -= 32) out.push({ tris: t, solids: s, points: 64 });
  const s = out.at(-1).solids;
  for (const p of POINTS.slice(1)) out.push({ tris: t, solids: s, points: p });
  return out;
};

// A game capital's hull to the budget, in the frame it is drawn in (1 long):
// root 1 at most `maxTris` triangles in all (bolts), root 0 at most
// `maxSolids` solids (contact), and the whole at most `maxBytes`, every part
// kept with its index, name and property; the first of the cuts `tried`
// gives within `maxBytes`. A hull within all three is as it was.
export async function capitalBudget(hull, { maxTris = CAPITAL_TRIS, maxSolids = CAPITAL_SOLIDS, greeble = GREEBLE, maxBytes = CAPITAL_BYTES } = {}) {
  await MeshoptSimplifier.ready;
  const solids = hull.shapes.filter((s) => s.root === 0 && s.kind !== 'mesh');
  const h = hullOf(packHull(hull));
  const said = { tris: [h.rays.count, h.rays.count], solids: [solids.length, solids.length], boxes: 0, flat: 0, contained: 0, greebles: 0, merges: 0, points: 64 };
  if (h.rays.count <= maxTris && solids.length <= maxSolids && packHull(hull).byteLength <= maxBytes) return { hull, said };
  const properties = hull.parts.map((p) => p.property);
  const names = hull.parts.map((p) => p.name);
  // (root 0's meshes go: a hull of two roots meets bolts on root 1 and
  // contact on root 0's convex shapes alone, src/lib/combat/hulls.js)
  const clean = cleaned(solids, h.solids);
  Object.assign(said, clean.said);
  const root1s = new Map();
  const root0s = new Map();
  for (const step of tried(maxTris, maxSolids)) {
    if (!root1s.has(step.tris)) root1s.set(step.tris, h.rays.count > step.tris ? bolts(h.rays, step.tris, properties) : { shapes: hull.shapes.filter((s) => s.root !== 0), boxes: 0 });
    if (!root0s.has(step.solids)) root0s.set(step.solids, fewer(clean.solids, step.solids, greeble));
    const root1 = root1s.get(step.tris);
    const root0 = root0s.get(step.solids);
    const capped = root0.solids.map((s) => (s.kind === 'hull' && s.points.length / 3 > step.points ? { ...s, points: reduceHull(s.points, step.points) } : s));
    const out = assemble([...capped, ...root1.shapes], properties, names);
    if (packHull(out).byteLength > maxBytes) continue;
    Object.assign(said, root0.said, { boxes: root1.boxes, points: step.points });
    said.tris[1] = hullOf(packHull(out)).rays.count;
    said.solids[1] = capped.length;
    return { hull: out, said };
  }
  throw new Error(`no cut of the hull is within ${maxBytes} bytes`);
}

// ── whether the cut hull still keeps a fighter out ──

const IDENTITY = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const STILL = { at0: [0, 0, 0], at1: [0, 0, 0], basis: IDENTITY, scale: 1 };
// seeded lines 4 long through a hull's bolt box, each through a point in it
function* linesThrough({ rays }, count, seed) {
  const b = rays.box;
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let n = 0; n < count; n++) {
    const t = [0, 1, 2].map((k) => b[k] + rnd() * (b[k + 3] - b[k]));
    const d = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    const l = Math.hypot(...d);
    yield { a: t.map((v, k) => v - (d[k] / l) * 2), e: t.map((v, k) => v + (d[k] / l) * 2), d: d.map((v) => v / l) };
  }
}
// how much of the line a→e lies in a convex solid (Cyrus–Beck), a share
const clip = ({ planes }, a, e) => {
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < planes.length; i += 4) {
    const da = planes[i] * a[0] + planes[i + 1] * a[1] + planes[i + 2] * a[2] - planes[i + 3];
    const de = planes[i] * e[0] + planes[i + 1] * e[1] + planes[i + 2] * e[2] - planes[i + 3];
    if (da > 0 && de > 0) return 0;
    if (da > 0) t0 = Math.max(t0, da / (da - de));
    else if (de > 0) t1 = Math.min(t1, da / (da - de));
    if (t0 > t1) return 0;
  }
  return t1 - t0;
};

// The lines (`lines` seeded through the cut hull) that meet the cut hull's
// bolts and cross none of its solids, and a fighter's hull (`fighter`, flown
// at `scale` of the capital's length, in steps of 0.002 of it) flown down
// each with hullContact: on how many it passes untouched through the cut
// hull, and through the uncut one. A cut that lets a fighter through where
// the game's shapes would not has opened a hole in contact.
export function passThrough(cut, uncut, fighter, { lines = 20000, scale = 0.01, seed = 777 } = {}) {
  const fly = (h, a, e) => {
    const steps = 2000;
    let prev = a;
    for (let s = 1; s <= steps; s++) {
      const at = a.map((v, k) => v + (e[k] - v) * (s / steps));
      if (hullContact(fighter, { at0: prev, at1: at, basis: IDENTITY, scale }, h, STILL)) return true;
      prev = at;
    }
    return false;
  };
  const out = { lines: 0, cut: 0, uncut: 0 };
  for (const { a, e } of linesThrough(cut, lines, seed)) {
    if (!segmentHit(cut, STILL, a, e) || cut.solids.some((s) => clip(s, a, e) > 0)) continue;
    out.lines++;
    if (!fly(cut, a, e)) out.cut++;
    if (!fly(uncut, a, e)) out.uncut++;
  }
  return out;
}

// The share of `lines` seeded bolts that meet the hull with no root 0
// solid within `depth` of the length behind where they meet it: how far a
// ship sinks into its bolts' surface before contact stops it.
export function sinkIn(h, { lines = 20000, depth = 0.01, seed = 12345 } = {}) {
  const inAny = (p) =>
    h.solids.some(({ planes, box }) => {
      for (let k = 0; k < 3; k++) if (p[k] < box[k] - 1e-6 || p[k] > box[k + 3] + 1e-6) return false;
      for (let i = 0; i < planes.length; i += 4) if (planes[i] * p[0] + planes[i + 1] * p[1] + planes[i + 2] * p[2] > planes[i + 3] + 1e-6) return false;
      return true;
    });
  let hits = 0;
  let hollow = 0;
  for (const { a, e, d } of linesThrough(h, lines, seed)) {
    const hit = segmentHit(h, STILL, a, e);
    if (!hit) continue;
    hits++;
    let found = false;
    for (let s = 0; s <= 8 && !found; s++) found = inAny(hit.point.map((v, k) => v + (d[k] * depth * s) / 8));
    if (!found) hollow++;
  }
  return hits ? hollow / hits : 0;
}
