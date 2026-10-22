// The grounds baked into grids once, so the drawing reads the land fast:
// terrain.js’s field is exact but a microsecond and a half a read, and the
// ground’s map, its meshes, the blades and the scatter between them ask for
// it millions of times. Over the ground (GROUND metres across, HALF either
// way of the middle), every STEP metres: the height, the loch’s edge, what
// the ground is (forest, moor, rock, the strand); and every PATH_STEP metres
// how far the nearest worn way is. Read between the samples, bilinear; past
// the ground’s edge the field itself (the far hills are drawn coarse).
//
// Built as a job (a generator, a few rows a step: terrain.js’s shape on the
// Road), so the world can build it a slice a frame, or run it to the end.
//
//   landJob({ step }) → a generator whose return is the land:
//     { heightAt(x, z), shoreAt(x, z), pathAt(x, z), coverAt(x, z, out) → out { forest, moor, rock, shore, lawn },
//       slopeAt(x, z), step, size, ms }
//   bakeLand(opts) → the land, at once
//   run(job) → a job run to its end

import { HALF, PATHS, cover, heightAt, shoreAt as exactShore } from './terrain';

export const STEP = 4; // m between the land’s samples
export const PATH_STEP = 2; // m between the ways’ samples

export function run(job) {
  for (;;) {
    const r = job.next();
    if (r.done) return r.value;
  }
}

export const bakeLand = (opts) => run(landJob(opts));

export function* landJob({ step = STEP } = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const n = Math.round((2 * HALF) / step) + 1;
  const x0 = -HALF;
  const heights = new Float32Array(n * n);
  const shore = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = x0 + j * step;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * step;
      heights[j * n + i] = heightAt(x, z);
      shore[j * n + i] = exactShore(x, z);
    }
    if (j % 6 === 5) yield;
  }
  // what the ground is, from the heights’ slope there (no field read again)
  const forest = new Float32Array(n * n);
  const moor = new Float32Array(n * n);
  const rock = new Float32Array(n * n);
  const strand = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const sx = (heights[j * n + Math.min(n - 1, i + 1)] - heights[j * n + Math.max(0, i - 1)]) / (2 * step);
      const sz = (heights[Math.min(n - 1, j + 1) * n + i] - heights[Math.max(0, j - 1) * n + i]) / (2 * step);
      const c = cover(x0 + i * step, x0 + j * step, heights[k], Math.hypot(sx, sz));
      forest[k] = c.forest;
      moor[k] = c.moor;
      rock[k] = c.rock;
      strand[k] = c.shore;
    }
    if (j % 8 === 7) yield;
  }
  // the worn ways: each path’s segments stamped into a grid of distances
  const pn = Math.round((2 * HALF) / PATH_STEP) + 1;
  const paths = new Float32Array(pn * pn).fill(64);
  for (const p of PATHS) {
    for (let s = 1; s < p.points.length; s++) {
      const [ax, az] = p.points[s - 1];
      const [bx, bz] = p.points[s];
      const reach = 8 + p.width;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach - x0) / PATH_STEP));
      const i1 = Math.min(pn - 1, Math.ceil((Math.max(ax, bx) + reach - x0) / PATH_STEP));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - reach - x0) / PATH_STEP));
      const j1 = Math.min(pn - 1, Math.ceil((Math.max(az, bz) + reach - x0) / PATH_STEP));
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz || 1;
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const x = x0 + i * PATH_STEP;
          const z = x0 + j * PATH_STEP;
          const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
          const d = Math.hypot(x - ax - dx * t, z - az - dz * t) - p.width / 2;
          const k = j * pn + i;
          if (d < paths[k]) paths[k] = d;
        }
    }
    yield;
  }

  // a grid read between its samples (`side` a row, `gap` metres apart), clamped to its edge
  const reader = (grid, side, gap) => (x, z) => {
    const u = Math.min(side - 1.0001, Math.max(0, (x - x0) / gap));
    const v = Math.min(side - 1.0001, Math.max(0, (z - x0) / gap));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    const k = j * side + i;
    const a = grid[k] + (grid[k + 1] - grid[k]) * fu;
    const b = grid[k + side] + (grid[k + side + 1] - grid[k + side]) * fu;
    return a + (b - a) * fv;
  };
  const inside = (x, z) => x >= x0 && x <= -x0 && z >= x0 && z <= -x0;
  const h = reader(heights, n, step);
  const sh = reader(shore, n, step);
  const f = reader(forest, n, step);
  const m = reader(moor, n, step);
  const r = reader(rock, n, step);
  const st = reader(strand, n, step);
  const pa = reader(paths, pn, PATH_STEP);
  const heightOf = (x, z) => (inside(x, z) ? h(x, z) : heightAt(x, z));
  return {
    step,
    size: n,
    ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0),
    heightAt: heightOf,
    shoreAt: (x, z) => (inside(x, z) ? sh(x, z) : exactShore(x, z)),
    pathAt: (x, z) => (inside(x, z) ? pa(x, z) : 64),
    coverAt(x, z, out = {}) {
      if (!inside(x, z)) {
        Object.assign(out, cover(x, z));
        return out;
      }
      out.forest = f(x, z);
      out.moor = m(x, z);
      out.rock = r(x, z);
      out.shore = st(x, z);
      out.lawn = Math.max(0, 1 - out.forest - out.moor - out.rock);
      return out;
    },
    slopeAt(x, z, e = 2) {
      const sx = (heightOf(x + e, z) - heightOf(x - e, z)) / (2 * e);
      const sz = (heightOf(x, z + e) - heightOf(x, z - e)) / (2 * e);
      return Math.hypot(sx, sz);
    },
  };
}
