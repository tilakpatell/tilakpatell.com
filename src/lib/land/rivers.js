// Rivers, traced. Each REGION (1,024 m square) has spec.rivers.perRegion
// sources, placed by a seeded Poisson disc and moved up to a local high of
// the land's field; each runs downhill in STEP metres by steepest descent,
// carrying 0.6 of its last direction and wandering across the slope by a
// noise (the meander), until it reaches the sea, or stalls in a pit, or
// runs 4,000 m. Its level never rises; it widens and deepens as it runs.
// A pit it stalls in fills as a lake, which spills over the lowest point of
// its rim, and the river runs on from there (a reach a lake; up to 8 lakes):
// on land summed from small hills a river that stopped at its first pit
// would never get further than a few hundred metres.
//
// The trace stays within its region and the next round it (less a margin
// for its banks and its lake), so the 3 × 3 regions round any cell hold
// every river that reaches the cell, and two cells either side of a region
// edge carve the same river the same way without talking.
//
// Pure: no three.js, no DOM; imports the galaxy's noise (a pure module),
// seeded.js and its own files.
//
//   REGION = 1024, STEP = 8
//   regionRivers(spec, rx, rz) → River[]; River = { points: Float32Array
//     (stride 5: x, z, level, width, depth), lake: { x, z, r, level, depth }
//     | null, length (run from its source to its end), source (true for the
//     reach that rises at a source; false for one spilt from a lake) }
//   riversNear(spec, cx, cz) → the rivers of the 3 × 3 regions round the
//     64 m cell (cx, cz), in a fixed order (cached, 32 regions)
//   clipRivers(rivers, x0, z0, x1, z1, margin = 0) → the runs of each river
//     whose banks reach the box, and the lakes that do (for a cell's scan)
//   nearestRiverPoint(rivers, x, z) → { d, level, width, depth, tangent:
//     [tx, tz] } | null (within twice the width there)
//   lakeAt(rivers, x, z) → lake | null (within 1.1 × its radius)

import { noise2 } from '../noise.js';
import { seeded } from '../seeded.js';
import { fieldAt } from './layers.js';

export const REGION = 1024;
export const STEP = 8;
const CELL = 64;
const MOMENTUM = 0.6;
const MAX_LENGTH = 4000;
const STALL = 0.2; // metres a river must fall over STALL_STEPS, or it's a lake
const STALL_STEPS = 6;
const MAX_LAKES = 8;
const BREACH = 128; // how far ahead a stalled river looks for lower ground // a river fills at most this many on its way
const SPACING = 200; // between sources
const INSET = 64; // sources this far inside their region
// how far past its region a river may run: a cell two regions away is
// REGION metres further, less its banks (2 × width) and a lake (1.1 × 60 m)
const SPAN = REGION - 96;

const mix = (a, b, c) => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) | 0;
};

// sources: up to n points SPACING apart, INSET inside the region, each moved
// to the highest of 9 samples within 32 m
function sources(spec, rx, rz, n, rand) {
  const out = [];
  const x0 = rx * REGION + INSET;
  const z0 = rz * REGION + INSET;
  const span = REGION - 2 * INSET;
  for (let tries = 0; out.length < n && tries < 30 * n; tries++) {
    const x = x0 + rand() * span;
    const z = z0 + rand() * span;
    if (out.some((p) => Math.hypot(p[0] - x, p[1] - z) < SPACING)) continue;
    out.push([x, z]);
  }
  return out.map(([x, z]) => {
    let best = [x, z, fieldAt(spec, x, z)];
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const h = fieldAt(spec, x + i * 32, z + j * 32);
        if (h > best[2]) best = [x + i * 32, z + j * 32, h];
      }
    return best;
  });
}

const DIRS = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)]);
const RIM = Array.from({ length: 16 }, (_, i) => [Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)]);

// One reach of a river, from (x, z) at height h, heading (dx, dz) (0, 0: the
// steepest way), `run` metres already run upstream of it. It ends at the sea,
// or stalls into a lake, or leaves its bounds (a lake there too), or runs out.
function reach(spec, x, z, h, level, dx, dz, run, bounds, seed, rand) {
  const { width, depth, meander } = spec.rivers;
  const pts = [];
  const heights = [];
  let length = 0;
  let since = 0; // the stall is judged from here (moved on by a breach)
  const push = () => {
    const k = 0.6 + 0.4 * Math.min(1, (run + length) / 1500);
    pts.push(x, z, level, width * k, depth * k);
    heights.push(h);
  };
  push();
  // the lake it stalls in: at the lowest of its last few points, a disc whose
  // level is held under the ring round it, so it never spills over its rim
  const lake = () => {
    let at = heights.length - 1;
    for (let i = Math.max(0, heights.length - STALL_STEPS - 1); i < heights.length; i++) if (heights[i] < heights[at]) at = i;
    const lx = pts[at * 5];
    const lz = pts[at * 5 + 1];
    const r = 20 + 40 * rand();
    let rim = Infinity;
    let out = RIM[0];
    for (const d of RIM) {
      const v = fieldAt(spec, lx + d[0] * r, lz + d[1] * r);
      if (v < rim) {
        rim = v;
        out = d;
      }
    }
    // (a pit whose rim is under the sea is a bay: it ends there, at the sea)
    return { x: lx, z: lz, r, level: Math.max(spec.sea, Math.min(heights[at] + 1, rim - 0.05, level)), depth, out, bay: rim - 0.05 <= spec.sea };
  };
  for (;;) {
    // the steepest way down, from 8 samples STEP round
    let sx = 0;
    let sz = 0;
    let low = Infinity;
    for (const [cx, cz] of DIRS) {
      const v = fieldAt(spec, x + cx * STEP, z + cz * STEP);
      if (v < low) {
        low = v;
        sx = cx;
        sz = cz;
      }
    }
    if (dx === 0 && dz === 0) {
      dx = sx;
      dz = sz;
    }
    let nx = MOMENTUM * dx + (1 - MOMENTUM) * sx;
    let nz = MOMENTUM * dz + (1 - MOMENTUM) * sz;
    let l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    // the meander: across the way, by a noise along it
    const m = meander * noise2((run + length) / 90, 0.5, seed);
    const tx = nx - nz * m;
    nz += nx * m;
    nx = tx;
    l = Math.hypot(nx, nz) || 1;
    dx = nx / l;
    dz = nz / l;
    x += dx * STEP;
    z += dz * STEP;
    length += STEP;
    h = fieldAt(spec, x, z);
    if (h <= spec.sea) {
      level = Math.min(level, Math.max(h, spec.sea));
      push();
      return { points: new Float32Array(pts), lake: null, length: run + length, sea: true };
    }
    level = Math.min(level, h);
    const out = x < bounds[0] || x > bounds[2] || z < bounds[1] || z > bounds[3];
    if (out) {
      length -= STEP;
      return { points: new Float32Array(pts), lake: lake(), length: run + length, out: true };
    }
    push();
    const n = heights.length;
    let stalled = n - 1 - STALL_STEPS >= since && heights[n - 1 - STALL_STEPS] - h < STALL;
    if (stalled) {
      // before it fills a lake, a river cuts through to lower ground it can
      // see within BREACH metres (a gorge through a low rise, not a pond)
      let best = null;
      for (let r = 16; r <= BREACH && !best; r += 16)
        for (const d of RIM) {
          const v = fieldAt(spec, x + d[0] * r, z + d[1] * r);
          if (v < level - STALL && (!best || v < best[2])) best = [d[0], d[1], v];
        }
      if (best) {
        dx = best[0];
        dz = best[1];
        since = n - 1;
        stalled = false;
      }
    }
    if (stalled || run + length >= MAX_LENGTH) return { points: new Float32Array(pts), lake: lake(), length: run + length };
  }
}

export function regionRivers(spec, rx, rz) {
  const n = spec.rivers.perRegion | 0;
  if (n <= 0) return [];
  const rand = seeded(mix(spec.seed, rx, rz));
  const bounds = [rx * REGION - SPAN, rz * REGION - SPAN, (rx + 1) * REGION + SPAN, (rz + 1) * REGION + SPAN];
  const rivers = [];
  sources(spec, rx, rz, n, rand).forEach(([x, z, h], i) => {
    if (!(h > spec.sea)) return;
    const seed = mix(spec.seed, rx * 7 + i, rz * 13 + i);
    // a river and the lakes it fills on the way: each lake spills over the
    // lowest point of its rim, and the river runs on from there
    let r = reach(spec, x, z, h, h, 0, 0, 0, bounds, seed, rand);
    const filled = [];
    for (let lakes = 0; ; lakes++) {
      // (a reach that stalls again beside a lake it left is that lake's
      // shore, not a river: the chain ends in the lake before it)
      if (r.lake && filled.some((k) => Math.hypot(k.x - r.lake.x, k.z - r.lake.z) < k.r + r.lake.r)) break;
      if (r.lake) filled.push(r.lake);
      if (r.points.length >= 10) rivers.push({ points: r.points, lake: r.lake && { x: r.lake.x, z: r.lake.z, r: r.lake.r, level: r.lake.level, depth: r.lake.depth }, length: r.length, source: lakes === 0 });
      if (r.sea || r.out || !r.lake || r.lake.bay || r.length >= MAX_LENGTH || lakes >= MAX_LAKES) break;
      const k = r.lake;
      const sx = k.x + k.out[0] * (k.r + STEP);
      const sz = k.z + k.out[1] * (k.r + STEP);
      if (sx < bounds[0] || sx > bounds[2] || sz < bounds[1] || sz > bounds[3]) break;
      r = reach(spec, sx, sz, fieldAt(spec, sx, sz), k.level, k.out[0], k.out[1], r.length + k.r * 2, bounds, seed, rand);
    }
  });
  return rivers;
}

// the regions' rivers, cached by seed and region, the oldest dropped past 32
const cache = new Map();
const LIMIT = 32;
function cached(spec, rx, rz) {
  const key = `${spec.seed}:${spec.type}:${rx}:${rz}`;
  let v = cache.get(key);
  if (v) {
    cache.delete(key);
    cache.set(key, v);
    return v;
  }
  v = regionRivers(spec, rx, rz);
  cache.set(key, v);
  if (cache.size > LIMIT) cache.delete(cache.keys().next().value);
  return v;
}

export function riversNear(spec, cx, cz) {
  const rx = Math.floor((cx * CELL) / REGION);
  const rz = Math.floor((cz * CELL) / REGION);
  const out = [];
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) out.push(...cached(spec, rx + i, rz + j));
  return out;
}

export function clipRivers(rivers, x0, z0, x1, z1, margin = 0) {
  const out = [];
  const bx0 = x0 - margin;
  const bz0 = z0 - margin;
  const bx1 = x1 + margin;
  const bz1 = z1 + margin;
  for (const r of rivers) {
    const p = r.points;
    const n = p.length / 5;
    const keep = new Uint8Array(n);
    for (let i = 0; i + 1 < n; i++) {
      const a = i * 5;
      const b = a + 5;
      const reach = 2 * Math.max(p[a + 3], p[b + 3]);
      if (Math.max(p[a], p[b]) + reach < bx0 || Math.min(p[a], p[b]) - reach > bx1) continue;
      if (Math.max(p[a + 1], p[b + 1]) + reach < bz0 || Math.min(p[a + 1], p[b + 1]) - reach > bz1) continue;
      keep[i] = 1;
      keep[i + 1] = 1;
    }
    const lake = r.lake;
    const lakeIn = lake && lake.x + lake.r * 1.1 >= bx0 && lake.x - lake.r * 1.1 <= bx1 && lake.z + lake.r * 1.1 >= bz0 && lake.z - lake.r * 1.1 <= bz1;
    let start = -1;
    let any = false;
    for (let i = 0; i <= n; i++) {
      if (i < n && keep[i]) {
        if (start < 0) start = i;
        continue;
      }
      if (start >= 0) {
        any = true;
        out.push({ points: p.slice(start * 5, i * 5), lake: i === n && lakeIn ? lake : null, length: r.length });
        start = -1;
      }
    }
    if (lakeIn && !(any && out[out.length - 1].lake === lake)) out.push({ points: new Float32Array(0), lake, length: r.length });
  }
  return out;
}

export function nearestRiverPoint(rivers, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const r of rivers) {
    const p = r.points;
    for (let a = 0; a + 5 < p.length; a += 5) {
      const b = a + 5;
      const ex = p[b] - p[a];
      const ez = p[b + 1] - p[a + 1];
      const ll = ex * ex + ez * ez;
      let t = ll > 0 ? ((x - p[a]) * ex + (z - p[a + 1]) * ez) / ll : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = p[a] + ex * t - x;
      const qz = p[a + 1] + ez * t - z;
      const d = Math.sqrt(qx * qx + qz * qz);
      if (d >= bestD) continue;
      const width = p[a + 3] + (p[b + 3] - p[a + 3]) * t;
      if (d > 2 * width) continue;
      bestD = d;
      const l = Math.sqrt(ll) || 1;
      best = { d, level: p[a + 2] + (p[b + 2] - p[a + 2]) * t, width, depth: p[a + 4] + (p[b + 4] - p[a + 4]) * t, tangent: [ex / l, ez / l] };
    }
  }
  return best;
}

export function lakeAt(rivers, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const r of rivers) {
    const k = r.lake;
    if (!k) continue;
    const d = Math.hypot(x - k.x, z - k.z);
    if (d <= k.r * 1.1 && d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}
