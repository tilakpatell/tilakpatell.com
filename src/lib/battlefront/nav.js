// The navgrid (spec decision 7): built, not read, since the game's
// PathfindingBlobAssets are opaque. A grid of `cell` metres over a height
// function and solid boxes: a cell is blocked when a solid's footprint
// touches it or the ground to a neighbour is steeper than `maxSlope`; A* on
// eight neighbours, string-pulled; a line of sight that stops at the first
// solid; and cover slots along each solid's edges as the game's
// `CoverConstants` place them (`SlotSpacing`, the crouch and stand heights,
// the occlusion check distance as the slot's stand-off from the face).
//
// The grid is coarse (2 m) and conservative for paths; `walkable` is exact
// (a point is off when inside a solid grown by the soldier's radius), so a
// slot 0.7 m off a wall is walkable though its cell is blocked: a path ends
// at the nearest open cell and walks the last metre straight.
//
//   buildNav({ heightAt, bounds, cell, solids, maxSlope, cover, radius }) → nav
//   cellAt(nav, x, z) → [c, r] | null      heightAt(nav, x, z) → y (bilinear)
//   walkable(nav, x, z) → bool             nearestWalkable(nav, x, z) → [x, z] | null
//   findPath(nav, from, to, { blocked }) → [[x, z]] | null
//   firstSolid(nav, a, b) → { t, at, solid } | null   lineClear(nav, a, b) → bool
//   coverSlots(nav, near, r) → slots       nearestSlot(nav, at, threat) → slot | null
// Pure: typed arrays, no three.js.

export const MAX_EXPAND = 20000;
// The slot buckets' size in metres: a coverSlots query looks at the few buckets its circle touches.
const BUCKET = 16;
const SQRT2 = Math.SQRT2;

function prepSolid(s, i) {
  const yaw = s.yaw ?? 0;
  return { i, at: s.at, half: s.half, yaw, c: Math.cos(yaw), s: Math.sin(yaw), top: s.at[1] + s.half[1], bottom: s.at[1] - s.half[1] };
}

// a world point in the solid's frame (its x and z axes turned by yaw about +Y)
function local(sol, x, z) {
  const dx = x - sol.at[0];
  const dz = z - sol.at[2];
  return [dx * sol.c - dz * sol.s, dx * sol.s + dz * sol.c];
}

function toWorld(sol, lx, lz) {
  return [sol.at[0] + lx * sol.c + lz * sol.s, sol.at[2] - lx * sol.s + lz * sol.c];
}

export function buildNav({ heightAt, bounds, cell = 2, solids = [], maxSlope = 0.9, cover = {}, radius = 0.3 }) {
  const origin = [bounds.min[0], bounds.min[1]];
  const cols = Math.ceil((bounds.max[0] - bounds.min[0]) / cell);
  const rows = Math.ceil((bounds.max[1] - bounds.min[1]) / cell);
  const n = cols * rows;
  const height = new Float32Array(n);
  const walk = new Uint8Array(n);
  const solid = new Uint8Array(n);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) height[r * cols + c] = heightAt(origin[0] + (c + 0.5) * cell, origin[1] + (r + 0.5) * cell);
  const boxes = solids.map(prepSolid);
  // which solids touch each cell, for the line tests and the exact walkable
  const near = new Map();
  for (const b of boxes) {
    const reach = Math.hypot(b.half[0], b.half[2]) + cell * 2;
    const c0 = Math.max(0, Math.floor((b.at[0] - reach - origin[0]) / cell));
    const c1 = Math.min(cols - 1, Math.floor((b.at[0] + reach - origin[0]) / cell));
    const r0 = Math.max(0, Math.floor((b.at[2] - reach - origin[1]) / cell));
    const r1 = Math.min(rows - 1, Math.floor((b.at[2] + reach - origin[1]) / cell));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const [lx, lz] = local(b, origin[0] + (c + 0.5) * cell, origin[1] + (r + 0.5) * cell);
        const i = r * cols + c;
        // the cell touches the footprint (a solid only blocks walking where it stands on the ground)
        if (Math.abs(lx) < b.half[0] + cell / 2 && Math.abs(lz) < b.half[2] + cell / 2) {
          if (b.bottom <= height[i] + 0.5) solid[i] = 1;
          if (!near.has(i)) near.set(i, []);
          near.get(i).push(b);
        } else if (Math.abs(lx) < b.half[0] + cell * 1.5 && Math.abs(lz) < b.half[2] + cell * 1.5) {
          if (!near.has(i)) near.set(i, []);
          near.get(i).push(b);
        }
      }
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (solid[i]) continue;
      let ok = 1;
      for (let dr = -1; dr <= 1 && ok; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          const d = dr && dc ? cell * SQRT2 : cell;
          if (Math.abs(height[rr * cols + cc] - height[i]) > maxSlope * d) {
            ok = 0;
            break;
          }
        }
      walk[i] = ok;
    }
  const nav = { cell, cols, rows, origin, height, walk, solid, boxes, near, radius, slots: [], buckets: new Map(), scratch: null };
  nav.slots = findSlots(nav, cover);
  for (const s of nav.slots) {
    const k = bucketKey(s.at[0], s.at[2]);
    if (!nav.buckets.has(k)) nav.buckets.set(k, []);
    nav.buckets.get(k).push(s);
  }
  return nav;
}

const bucketKey = (x, z) => `${Math.floor(x / BUCKET)},${Math.floor(z / BUCKET)}`;

export function cellAt(nav, x, z) {
  const c = Math.floor((x - nav.origin[0]) / nav.cell);
  const r = Math.floor((z - nav.origin[1]) / nav.cell);
  if (c < 0 || r < 0 || c >= nav.cols || r >= nav.rows) return null;
  return [c, r];
}

const indexAt = (nav, x, z) => {
  const cr = cellAt(nav, x, z);
  return cr ? cr[1] * nav.cols + cr[0] : -1;
};

export function heightAt(nav, x, z) {
  const fx = Math.min(nav.cols - 1, Math.max(0, (x - nav.origin[0]) / nav.cell - 0.5));
  const fz = Math.min(nav.rows - 1, Math.max(0, (z - nav.origin[1]) / nav.cell - 0.5));
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fz);
  const c1 = Math.min(nav.cols - 1, c0 + 1);
  const r1 = Math.min(nav.rows - 1, r0 + 1);
  const tx = fx - c0;
  const tz = fz - r0;
  const h = nav.height;
  const a = h[r0 * nav.cols + c0] * (1 - tx) + h[r0 * nav.cols + c1] * tx;
  const b = h[r1 * nav.cols + c0] * (1 - tx) + h[r1 * nav.cols + c1] * tx;
  return a * (1 - tz) + b * tz;
}

// inside a solid's footprint grown by the soldier's radius, where the solid stands on the ground
function inSolid(nav, x, z, i) {
  const list = nav.near.get(i);
  if (!list) return false;
  for (const b of list) {
    const [lx, lz] = local(b, x, z);
    if (Math.abs(lx) < b.half[0] + nav.radius && Math.abs(lz) < b.half[2] + nav.radius && b.bottom <= nav.height[i] + 0.5) return true;
  }
  return false;
}

export function walkable(nav, x, z) {
  const i = indexAt(nav, x, z);
  if (i < 0) return false;
  // the slope flag holds for the cell; a blocked cell may still be open beside its solid
  if (!nav.walk[i] && !nav.solid[i]) return false;
  return !inSolid(nav, x, z, i);
}

const open = (nav, i, blocked) => nav.walk[i] === 1 && !nav.solid[i] && !(blocked && blocked.has(i));

// the nearest open cell to a point (rings outward), for a start or goal inside a blocked cell
function nearestOpen(nav, x, z, blocked, reach = 4) {
  const cr = cellAt(nav, x, z);
  if (!cr) return -1;
  const [c0, r0] = cr;
  if (open(nav, r0 * nav.cols + c0, blocked)) return r0 * nav.cols + c0;
  let best = -1;
  let bestD = Infinity;
  for (let ring = 1; ring <= reach; ring++) {
    for (let dr = -ring; dr <= ring; dr++)
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const c = c0 + dc;
        const r = r0 + dr;
        if (c < 0 || r < 0 || c >= nav.cols || r >= nav.rows) continue;
        const i = r * nav.cols + c;
        if (!open(nav, i, blocked)) continue;
        const d = Math.hypot(nav.origin[0] + (c + 0.5) * nav.cell - x, nav.origin[1] + (r + 0.5) * nav.cell - z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    if (best >= 0) return best;
  }
  return -1;
}

// the nearest walkable point to (x, z): itself, or the middle of the nearest open cell
export function nearestWalkable(nav, x, z, reach = 8) {
  if (walkable(nav, x, z)) return [x, z];
  const i = nearestOpen(nav, x, z, null, reach);
  return i < 0 ? null : centre(nav, i);
}

// the open cells' regions (four-neighbour), labelled once: each cell's region and the largest
function regions(nav) {
  if (nav.regions) return nav.regions;
  const n = nav.cols * nav.rows;
  const label = new Int32Array(n).fill(-1);
  const sizes = [];
  const stack = [];
  for (let i = 0; i < n; i++) {
    if (label[i] >= 0 || !open(nav, i, null)) continue;
    const k = sizes.length;
    let size = 0;
    label[i] = k;
    stack.push(i);
    while (stack.length) {
      const c = stack.pop();
      size++;
      const x = c % nav.cols;
      const y = (c - x) / nav.cols;
      for (const j of [x > 0 ? c - 1 : -1, x < nav.cols - 1 ? c + 1 : -1, y > 0 ? c - nav.cols : -1, y < nav.rows - 1 ? c + nav.cols : -1]) {
        if (j < 0 || label[j] >= 0 || !open(nav, j, null)) continue;
        label[j] = k;
        stack.push(j);
      }
    }
    sizes.push(size);
  }
  nav.regions = { label, main: sizes.indexOf(Math.max(...sizes)) };
  return nav.regions;
}

// the nearest point of the largest open region to (x, z), so nothing is placed in a walled-off pocket
export function nearestMainland(nav, x, z, reach = 12) {
  const R = regions(nav);
  const cr = cellAt(nav, x, z);
  if (!cr) return null;
  const [c0, r0] = cr;
  if (R.label[r0 * nav.cols + c0] === R.main && walkable(nav, x, z)) return [x, z];
  for (let ring = 0; ring <= reach; ring++) {
    let best = -1;
    let bestD = Infinity;
    for (let dr = -ring; dr <= ring; dr++)
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const c = c0 + dc;
        const r = r0 + dr;
        if (c < 0 || r < 0 || c >= nav.cols || r >= nav.rows) continue;
        const i = r * nav.cols + c;
        if (R.label[i] !== R.main) continue;
        const d = Math.hypot(dc, dr);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    if (best >= 0) return centre(nav, best);
  }
  return null;
}

const centre = (nav, i) => [nav.origin[0] + ((i % nav.cols) + 0.5) * nav.cell, nav.origin[1] + (Math.floor(i / nav.cols) + 0.5) * nav.cell];

// every cell a segment crosses is open (sampled at a quarter cell)
function gridClear(nav, a, b, blocked) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(d / (nav.cell / 4)));
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const i = indexAt(nav, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    if (i < 0 || !open(nav, i, blocked)) return false;
  }
  return true;
}

// a binary heap of cell indices keyed by f
function heap(f) {
  const a = [];
  return {
    get size() {
      return a.length;
    },
    push(i) {
      a.push(i);
      let k = a.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (f[a[p]] <= f[a[k]]) break;
        [a[p], a[k]] = [a[k], a[p]];
        k = p;
      }
    },
    pop() {
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1;
          const r = l + 1;
          let m = k;
          if (l < a.length && f[a[l]] < f[a[m]]) m = l;
          if (r < a.length && f[a[r]] < f[a[m]]) m = r;
          if (m === k) break;
          [a[m], a[k]] = [a[k], a[m]];
          k = m;
        }
      }
      return top;
    },
  };
}

function scratchOf(nav) {
  const n = nav.cols * nav.rows;
  nav.scratch ??= { g: new Float32Array(n), f: new Float32Array(n), from: new Int32Array(n), seen: new Uint32Array(n), shut: new Uint32Array(n), gen: 0 };
  nav.scratch.gen++;
  return nav.scratch;
}

export function findPath(nav, from, to, { blocked = null, max = MAX_EXPAND } = {}) {
  const s = nearestOpen(nav, from[0], from[1], blocked);
  const goal = nearestOpen(nav, to[0], to[1], blocked);
  if (s < 0 || goal < 0) return null;
  const S = scratchOf(nav);
  const { g, f, from: came, seen, shut, gen } = S;
  const cols = nav.cols;
  const gc = goal % cols;
  const gr = Math.floor(goal / cols);
  const h = (i) => {
    const dx = Math.abs((i % cols) - gc);
    const dz = Math.abs(Math.floor(i / cols) - gr);
    return (Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz)) * nav.cell;
  };
  const q = heap(f);
  g[s] = 0;
  f[s] = h(s);
  came[s] = -1;
  seen[s] = gen;
  q.push(s);
  let expanded = 0;
  let found = false;
  while (q.size) {
    const cur = q.pop();
    if (shut[cur] === gen) continue;
    shut[cur] = gen;
    if (cur === goal) {
      found = true;
      break;
    }
    if (++expanded > max) return null;
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= nav.rows) continue;
        const ni = rr * cols + cc;
        if (!open(nav, ni, blocked) || shut[ni] === gen) continue;
        // no corner cutting: a diagonal needs both sides open
        if (dr && dc && (!open(nav, r * cols + cc, blocked) || !open(nav, rr * cols + c, blocked))) continue;
        const ng = g[cur] + (dr && dc ? nav.cell * SQRT2 : nav.cell);
        if (seen[ni] === gen && ng >= g[ni]) continue;
        seen[ni] = gen;
        g[ni] = ng;
        f[ni] = ng + h(ni);
        came[ni] = cur;
        q.push(ni);
      }
  }
  if (!found) return null;
  const cells = [];
  for (let i = goal; i !== -1; i = came[i]) cells.push(i);
  cells.reverse();
  const pts = [[from[0], from[1]], ...cells.map((i) => centre(nav, i))];
  if (walkable(nav, to[0], to[1])) pts.push([to[0], to[1]]);
  // string-pull: drop a point when the line past it is open
  const out = [pts[0]];
  let k = 0;
  while (k < pts.length - 1) {
    let j = pts.length - 1;
    while (j > k + 1 && !gridClear(nav, pts[k], pts[j], blocked)) j--;
    out.push(pts[j]);
    k = j;
  }
  return out;
}

// the slab test of segment a→b against one solid box (in its frame): the entry fraction, or null
function segBox(b, a, e) {
  const [ax, az] = local(b, a[0], a[2]);
  const [ex, ez] = local(b, e[0], e[2]);
  const p0 = [ax, a[1] - b.at[1], az];
  const d = [ex - ax, e[1] - a[1], ez - az];
  let t0 = 0;
  let t1 = 1;
  for (let k = 0; k < 3; k++) {
    const h = b.half[k];
    if (Math.abs(d[k]) < 1e-9) {
      if (p0[k] < -h || p0[k] > h) return null;
      continue;
    }
    let ta = (-h - p0[k]) / d[k];
    let tb = (h - p0[k]) / d[k];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

// the first solid (or the ground) segment a→b meets: its fraction and point
export function firstSolid(nav, a, b) {
  const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const steps = Math.max(1, Math.ceil(d / (nav.cell / 2)));
  const tried = new Set();
  let best = null;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[2] + (b[2] - a[2]) * t;
    const i = indexAt(nav, x, z);
    if (i >= 0) {
      for (const box of nav.near.get(i) ?? []) {
        if (tried.has(box.i)) continue;
        tried.add(box.i);
        const hit = segBox(box, a, b);
        if (hit !== null && (!best || hit < best.t)) best = { t: hit, solid: box.i };
      }
    }
    // a solid already met before the last sample: nothing nearer is left
    if (best && best.t <= (k - 1) / steps) break;
    const y = a[1] + (b[1] - a[1]) * t;
    if (y < heightAt(nav, x, z) - 0.05) {
      if (!best || t < best.t) best = { t, solid: -1 };
      break;
    }
  }
  if (!best) return null;
  return { ...best, at: [a[0] + (b[0] - a[0]) * best.t, a[1] + (b[1] - a[1]) * best.t, a[2] + (b[2] - a[2]) * best.t] };
}

export const lineClear = (nav, a, b) => firstSolid(nav, a, b) === null;

// slots along each solid's four faces, `SlotSpacing` apart, a stand-off out
// from the face, where the solid's top makes crouch or stand cover
function findSlots(nav, cover) {
  const spacing = cover.SlotSpacing ?? 2.2;
  const crouch = cover.CrouchHeight ?? 0.94;
  const stand = cover.StandHeight ?? 1.7;
  const off = cover['CrouchCoverOcclusionSettings.OcclusionCheckDist'] ?? 0.7;
  const slots = [];
  for (const b of nav.boxes) {
    const faces = [
      { n: [1, 0], along: 2, len: b.half[2], d: b.half[0] },
      { n: [-1, 0], along: 2, len: b.half[2], d: b.half[0] },
      { n: [0, 1], along: 0, len: b.half[0], d: b.half[2] },
      { n: [0, -1], along: 0, len: b.half[0], d: b.half[2] },
    ];
    for (const face of faces) {
      const count = Math.floor((2 * face.len) / spacing) + 1;
      const span = (count - 1) * spacing;
      for (let k = 0; k < count; k++) {
        const u = -span / 2 + k * spacing;
        const lx = face.n[0] ? face.n[0] * (face.d + off) : u;
        const lz = face.n[1] ? face.n[1] * (face.d + off) : u;
        const [x, z] = toWorld(b, lx, lz);
        if (!walkable(nav, x, z)) continue;
        const y = heightAt(nav, x, z);
        const rise = b.top - y;
        if (rise < crouch) continue;
        const [nx, nz] = toWorld(b, face.n[0], face.n[1]);
        const normal = [nx - b.at[0], nz - b.at[2]];
        slots.push({ at: [x, y, z], facing: Math.atan2(normal[0], normal[1]), normal, height: rise >= stand ? 'stand' : 'crouch', protectedWidth: 2 * face.len, solid: b.i });
      }
    }
  }
  return slots;
}

export function coverSlots(nav, near, r) {
  const out = [];
  const b0 = Math.floor((near[0] - r) / BUCKET);
  const b1 = Math.floor((near[0] + r) / BUCKET);
  const c0 = Math.floor((near[1] - r) / BUCKET);
  const c1 = Math.floor((near[1] + r) / BUCKET);
  for (let bx = b0; bx <= b1; bx++)
    for (let bz = c0; bz <= c1; bz++)
      for (const s of nav.buckets.get(`${bx},${bz}`) ?? []) if (Math.hypot(s.at[0] - near[0], s.at[2] - near[1]) <= r) out.push(s);
  return out;
}

// the slot's solid stands between it and the threat
export const shields = (slot, threat) => slot.normal[0] * (threat[0] - slot.at[0]) + slot.normal[1] * (threat[1] - slot.at[2]) < 0;

export function nearestSlot(nav, at, threat, r = 40) {
  let best = null;
  let bestD = Infinity;
  for (const s of coverSlots(nav, [at[0], at[at.length - 1]], r)) {
    if (threat && !shields(s, threat)) continue;
    const d = Math.hypot(s.at[0] - at[0], s.at[2] - at[at.length - 1]);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
