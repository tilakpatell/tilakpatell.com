// A land's paths: a lane levelled into the land along a line, as flats.js
// levels a pad round a point. Within width / 2 of the line the land is the
// line's own height (the raw land at the nearest point on it, so a lane
// keeps the rise and fall along it and loses the slope across it); it eases
// back over `edge`, and past width / 2 + edge the raw land is untouched.
//
// The path is anything with `length` and `pointAt(m) → { x, z }` (the Road's
// line.js roadOf, the flight's or the galaxy's later). It lives here, not in
// the Road's folder, so they may level their lanes with it too.
//
// Pure: imports nothing but the galaxy's noise (a pure module, as flats.js
// imports it), and runs in Node and in a worker.
//
//   nearestOn(path, x, z) → { m, d }   (metres along, metres off)
//   distanceTo(path) → (x, z) → metres off (the table made once, for many asks)
//   boundsOf(path) → { x0, x1, z0, z1 }
//   levelAlong(raw, path, { width = 6, edge = 12 }) → (x, z) → metres
//   cutAlong(raw, path, { depth, width = 8, bank = width / 2 }) → (x, z) → metres
//     (a river's channel: the land lowered by depth along the line, banked)

import { smoothstep } from '../../components/galaxy/surface/noise.js';

const STEP = 1; // m between the table's points

// the path as a table: a point every STEP metres, and its bounds
function tableOf(path) {
  const n = Math.max(1, Math.ceil(path.length / STEP));
  const xs = new Float64Array(n + 1);
  const zs = new Float64Array(n + 1);
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i <= n; i++) {
    const p = path.pointAt((i / n) * path.length);
    xs[i] = p.x;
    zs[i] = p.z;
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    z0 = Math.min(z0, p.z);
    z1 = Math.max(z1, p.z);
  }
  return { n, each: path.length / n, xs, zs, x0, x1, z0, z1, cells: null };
}

// the table's segments by CELL-metre squares, so a point asks only those
// near it (made once, on the first ask within a reach)
const CELL = 8;
function cellsOf(t) {
  if (t.cells) return t.cells;
  const cols = Math.floor((t.x1 - t.x0) / CELL) + 1;
  const rows = Math.floor((t.z1 - t.z0) / CELL) + 1;
  const cells = Array.from({ length: cols * rows }, () => []);
  for (let i = 0; i < t.n; i++) {
    const a0 = Math.floor((Math.min(t.xs[i], t.xs[i + 1]) - t.x0) / CELL);
    const a1 = Math.floor((Math.max(t.xs[i], t.xs[i + 1]) - t.x0) / CELL);
    const b0 = Math.floor((Math.min(t.zs[i], t.zs[i + 1]) - t.z0) / CELL);
    const b1 = Math.floor((Math.max(t.zs[i], t.zs[i + 1]) - t.z0) / CELL);
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) cells[b * cols + a].push(i);
  }
  t.cells = { cols, rows, cells };
  return t.cells;
}

// the nearest point of the segments within `reach` of (x, z): { d, i, k }, d
// Infinity when none is that near
function nearestWithin(t, x, z, reach) {
  const { cols, rows, cells } = cellsOf(t);
  const a0 = Math.max(0, Math.floor((x - reach - t.x0) / CELL));
  const a1 = Math.min(cols - 1, Math.floor((x + reach - t.x0) / CELL));
  const b0 = Math.max(0, Math.floor((z - reach - t.z0) / CELL));
  const b1 = Math.min(rows - 1, Math.floor((z + reach - t.z0) / CELL));
  let best = Infinity;
  let bi = 0;
  let bk = 0;
  for (let b = b0; b <= b1; b++)
    for (let a = a0; a <= a1; a++)
      for (const i of cells[b * cols + a]) {
        const ax = t.xs[i];
        const az = t.zs[i];
        const dx = t.xs[i + 1] - ax;
        const dz = t.zs[i + 1] - az;
        const l2 = dx * dx + dz * dz;
        let k = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
        k = k < 0 ? 0 : k > 1 ? 1 : k;
        const ex = ax + dx * k - x;
        const ez = az + dz * k - z;
        const d2 = ex * ex + ez * ez;
        if (d2 < best) {
          best = d2;
          bi = i;
          bk = k;
        }
      }
  return { d: Math.sqrt(best), i: bi, k: bk };
}

// the nearest point of the table's segments: { m, d, i, k } (segment i, k along it)
function nearestIn(t, x, z) {
  let best = Infinity;
  let bi = 0;
  let bk = 0;
  for (let i = 0; i < t.n; i++) {
    const ax = t.xs[i];
    const az = t.zs[i];
    const dx = t.xs[i + 1] - ax;
    const dz = t.zs[i + 1] - az;
    const l2 = dx * dx + dz * dz;
    let k = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    const ex = ax + dx * k - x;
    const ez = az + dz * k - z;
    const d2 = ex * ex + ez * ez;
    if (d2 < best) {
      best = d2;
      bi = i;
      bk = k;
    }
  }
  return { m: (bi + bk) * t.each, d: Math.sqrt(best), i: bi, k: bk };
}

export function nearestOn(path, x, z) {
  const { m, d } = nearestIn(tableOf(path), x, z);
  return { m, d };
}

export function distanceTo(path) {
  const t = tableOf(path);
  return (x, z) => nearestIn(t, x, z).d;
}

export function boundsOf(path) {
  const { x0, x1, z0, z1 } = tableOf(path);
  return { x0, x1, z0, z1 };
}

export function levelAlong(raw, path, { width = 6, edge = 12 } = {}) {
  const t = tableOf(path);
  const half = width / 2;
  const reach = half + edge;
  // the line's own height at each of the table's points
  const hs = new Float64Array(t.n + 1);
  for (let i = 0; i <= t.n; i++) hs[i] = raw(t.xs[i], t.zs[i]);
  return (x, z) => {
    const h = raw(x, z);
    // (outside the line's bounds by more than the reach: untouched, without the search)
    if (x < t.x0 - reach || x > t.x1 + reach || z < t.z0 - reach || z > t.z1 + reach) return h;
    const near = nearestWithin(t, x, z, reach);
    if (near.d >= reach) return h;
    const own = hs[near.i] + (hs[near.i + 1] - hs[near.i]) * near.k;
    const w = 1 - smoothstep(half, reach, near.d);
    return h + (own - h) * w;
  };
}

export function cutAlong(raw, path, { depth, width = 8, bank = width / 2 } = {}) {
  const t = tableOf(path);
  const half = width / 2;
  const reach = half + bank;
  return (x, z) => {
    const h = raw(x, z);
    if (x < t.x0 - reach || x > t.x1 + reach || z < t.z0 - reach || z > t.z1 + reach) return h;
    const { d } = nearestWithin(t, x, z, reach);
    if (d >= reach) return h;
    return h - depth * (1 - smoothstep(half, reach, d));
  };
}
