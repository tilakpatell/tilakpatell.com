// What a web can catch: the corners a swing whips round, the perches a point
// launch takes him to, and the anchors a web shot looks for.

import { inPoly } from '../../compound/plan';
import { BUILDINGS, FLAGS, FLAG_H, LAWN_TREES, LAWN_W, MASTS, MAST_H, RIVER_W, SOLIDS, solidById } from './plan';
import { floorAt, wallNormal } from './bump';
import { SWING } from './tuning';

// The rope a web wants: no longer than it is, short enough that the bottom
// of the swing clears the ground (or the roof) under him, and no more than
// `dip` under where he caught it.
export function ropeFor(a, len, entry, floor) {
  const bottom = Math.max(floor + SWING.clear, entry - SWING.dip);
  return Math.max(4, Math.min(len, a[1] - bottom));
}

// The corners of the buildings a swing can whip round: { x, z, nx, nz (out
// along the corner's bisector), h (its roof), id }.
export const CORNERS = (() => {
  const out = [];
  for (const b of BUILDINGS) {
    if (b.h < 8 || b.id === 'pier') continue;
    const f = b.foot;
    for (let i = 0; i < f.length; i++) {
      const p = f[(i - 1 + f.length) % f.length];
      const v = f[i];
      const q = f[(i + 1) % f.length];
      const n1 = wallNormal((p[0] + v[0]) / 2, (p[1] + v[1]) / 2, f);
      const n2 = wallNormal((v[0] + q[0]) / 2, (v[1] + q[1]) / 2, f);
      // a real corner, not a bend in a curve, and one that sticks out
      if (n1.nx * n2.nx + n1.nz * n2.nz > 0.87) continue;
      let nx = n1.nx + n2.nx;
      let nz = n1.nz + n2.nz;
      const l = Math.hypot(nx, nz) || 1;
      nx /= l;
      nz /= l;
      if (inPoly(v[0] + nx * 0.3, v[1] + nz * 0.3, f)) continue;
      out.push({ x: v[0], z: v[1], nx, nz, h: b.h, id: b.id });
    }
  }
  return out;
})();

// Where a point launch can land him: the masts' and flagpoles' tops, and the
// roofs' corners. { x, y, z, roof } (roof: it's a roof he can walk on from there)
export const PERCHES = [
  ...MASTS.map((m) => ({ x: m.x, y: MAST_H + 0.95, z: m.z, roof: false })),
  ...FLAGS.map((f) => ({ x: f.x, y: FLAG_H + 0.5, z: f.z, roof: false })),
  ...CORNERS.map((c) => ({ x: c.x - c.nx * 0.7, y: c.h, z: c.z - c.nz * 0.7, roof: true })),
];

// The perch a point launch would go to: ahead of him (where you steer, or he
// faces), in reach, the nearer the straighter ahead, with nothing in the way.
export function findPerch(h, { mx = 0, mz = 0, len = 0 } = {}) {
  let fx = len > 0.1 ? mx : Math.cos(h.face);
  let fz = len > 0.1 ? mz : -Math.sin(h.face);
  const l = Math.hypot(fx, fz) || 1;
  fx /= l;
  fz /= l;
  let best = null;
  for (const p of PERCHES) {
    const rx = p.x - h.x;
    const rz = p.z - h.z;
    const d = Math.hypot(rx, p.y - h.y, rz);
    if (d < 4 || d > SWING.point.reach) continue;
    const hd = Math.hypot(rx, rz) || 1;
    const ahead = (rx * fx + rz * fz) / hd;
    if (ahead < 0.55) continue;
    const score = d * (2 - ahead);
    if (best && score >= best.score) continue;
    if (!clearLine(h.x, h.y + 1.2, h.z, p.x, p.y + 0.5, p.z)) continue;
    best = { p, score };
  }
  return best?.p ?? null;
}

// ── what a web can catch ──
// { a: the point he swings about, at: where the web sticks, n: the way out
// of the wall it's on (roof edges), kind }. Insomniac tag every edge in the
// city a web can stick to; here they're every roof's edges, the trees and the
// masts. A web sticks to a roof's edge, but he swings about a point a couple
// of metres out from the wall, as in every Spider-Man game: anchored at the
// wall itself, a swing would carry him into it.
const OUT = 2.2;
function edgeAnchors(s, every = 3.5) {
  const out = [];
  const f = s.foot;
  for (let i = 0; i < f.length; i++) {
    const [ax, az] = f[i];
    const [bx, bz] = f[(i + 1) % f.length];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 0.5) continue;
    const n = wallNormal((ax + bx) / 2, (az + bz) / 2, f);
    const k = Math.max(1, Math.round(l / every));
    for (let j = 0; j < k; j++) {
      const t = (j + 0.5) / k;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const px = x + n.nx * OUT;
      const pz = z + n.nz * OUT;
      if (!inPoly(px, pz, LAWN_W) || BUILDINGS.some((o) => inPoly(px, pz, o.foot))) continue;
      out.push({ a: [px, s.h - 0.5, pz], at: [x + n.nx * 0.05, s.h - 0.1, z + n.nz * 0.05], n: [n.nx, n.nz], kind: 'roof', id: s.id });
    }
  }
  return out;
}
// the firs round the lawn (there are none on the river's side): the web goes
// into one a few metres back in the woods, but he swings along the lawn's edge
function woodsAnchors(every = 9) {
  const out = [];
  const f = LAWN_W;
  for (let i = 0; i < f.length; i++) {
    const [ax, az] = f[i];
    const [bx, bz] = f[(i + 1) % f.length];
    const l = Math.hypot(bx - ax, bz - az);
    const n = wallNormal((ax + bx) / 2, (az + bz) / 2, f);
    const k = Math.max(1, Math.round(l / every));
    for (let j = 0; j < k; j++) {
      const t = (j + 0.5) / k;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      if (inPoly(x + n.nx * 5, z + n.nz * 5, RIVER_W) || inPoly(x + n.nx * 12, z + n.nz * 12, RIVER_W)) continue;
      out.push({ a: [x - n.nx * 3, 11.5, z - n.nz * 3], at: [x + n.nx * 5, 12.5, z + n.nz * 5], kind: 'tree' });
    }
  }
  return out;
}
// (the lawn's trees are 9 to 12.5 m tall, as the drawing has them)
export const treeHeight = (t) => 9 + t.tone * 3.5;
export const ANCHORS = [
  ...BUILDINGS.filter((b) => b.id !== 'pier').flatMap((b) => edgeAnchors(b)),
  ...['bridge', 'clerestory'].flatMap((id) => edgeAnchors(solidById(id))),
  ...woodsAnchors(),
  ...LAWN_TREES.map((t) => {
    const p = [t.x, treeHeight(t) * 0.78, t.z];
    return { a: p, at: p, kind: 'tree' };
  }),
  ...MASTS.map((m) => ({ a: [m.x, MAST_H - 1, m.z], at: [m.x, MAST_H - 0.6, m.z], kind: 'mast' })),
  ...FLAGS.map((f) => ({ a: [f.x, FLAG_H - 0.6, f.z], at: [f.x, FLAG_H - 0.3, f.z], kind: 'mast' })),
];

// Whether a web from (x0, y0, z0) to (x1, y1, z1) is clear of the buildings.
export function clearLine(x0, y0, z0, x1, y1, z1) {
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const z = z0 + (z1 - z0) * t;
    for (const s of SOLIDS) {
      if (y >= s.h - 0.3 || y <= s.y0) continue;
      const [bx0, bz0, bx1, bz1] = s.box;
      if (x < bx0 || x > bx1 || z < bz0 || z > bz1) continue;
      if (inPoly(x, z, s.foot)) return false;
    }
  }
  return true;
}

// Where a web shot now would catch, as Insomniac's and its re-creations'
// searches do it: a point he'd like to swing from, ahead of him (further the
// faster he goes, toward where you steer if you are) and above him (but not
// far above the height a chain of swings likes, so the next arc dips back
// down rather than stair-stepping up the roofs); then the anchor nearest it
// that's in reach, in front of the wall it's on, at a good angle up (26° to
// 75°), not off to one side, with nothing between him and it nor in the way
// of the swing. → { a, at, len, hand ('L' | 'R'), kind } or null.
export function aimWeb(h, turn = null) {
  const hs = Math.hypot(h.vx, h.vz);
  let fx = hs > 3 ? h.vx / hs : Math.cos(h.face);
  let fz = hs > 3 ? h.vz / hs : -Math.sin(h.face);
  if (turn) {
    // steering: the way he's going, bent toward the way you want
    fx = fx * 0.55 + turn.x * 0.9;
    fz = fz * 0.55 + turn.z * 0.9;
    const l = Math.hypot(fx, fz) || 1;
    fx /= l;
    fz /= l;
  }
  const speed = Math.hypot(h.vx, h.vy, h.vz);
  const floor = floorAt(h.x, h.z, h.y);
  const band = floor + Math.min(34, 24 + speed * 0.25);
  const high = h.y > band - 4;
  const minUp = high ? 2 : SWING.minUp;
  const ahead = Math.min(32, Math.max(12, 10 + speed * 0.6));
  const dy = Math.max(minUp + 1, Math.min(13 + speed * 0.2, band - h.y));
  const D = [h.x + fx * ahead, h.y + dy, h.z + fz * ahead];
  const [lo, hi] = SWING.elev;
  const pick = (strict) => {
    const found = [];
    for (const an of ANCHORS) {
      const rx = an.a[0] - h.x;
      const ry = an.a[1] - h.y;
      const rz = an.a[2] - h.z;
      if (ry < (strict ? minUp : SWING.minUp)) continue;
      const len = Math.hypot(rx, ry, rz);
      if (len < SWING.near || len > SWING.reach) continue;
      const fwd = rx * fx + rz * fz;
      if (fwd < (strict ? 1 : -1)) continue;
      // in front of the wall it's on, not along it or behind it
      if (an.n && (h.x - an.at[0]) * an.n[0] + (h.z - an.at[2]) * an.n[1] < (strict ? 2.5 : 0.5)) continue;
      const lat = Math.abs(rx * fz - rz * fx);
      const elev = Math.atan2(ry, Math.hypot(rx, rz));
      let score = Math.hypot(an.a[0] - D[0], an.a[1] - D[1], an.a[2] - D[2]) / 8;
      score += Math.max(0, lat - 14) * 0.3 + Math.max(0, lo - elev) * 4 + Math.max(0, elev - hi) * 3 - Math.min(fwd, 30) * 0.02;
      found.push({ an, len, score });
    }
    found.sort((p, q) => p.score - q.score);
    for (const f of found.slice(0, 10)) {
      const { an } = f;
      if (!clearLine(h.x, h.y + 1.5, h.z, an.at[0], an.at[1], an.at[2])) continue;
      // and the way down to the bottom of the swing is clear too
      const rope = ropeFor(an.a, f.len, h.y, floor);
      if (!clearLine(h.x, h.y + 1, h.z, an.a[0], an.a[1] - rope + 1, an.a[2])) continue;
      // the hand on the anchor's side (his left is +x when he faces +z)
      const left = (an.a[0] - h.x) * fz - (an.a[2] - h.z) * fx;
      return { a: [...an.a], at: [...an.at], len: f.len, hand: left > 0 ? 'L' : 'R', kind: an.kind };
    }
    return null;
  };
  // (and if nothing fits, whatever's in reach and over him)
  return pick(true) ?? pick(false);
}
