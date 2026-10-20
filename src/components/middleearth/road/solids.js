// What stands solid on a stage, as a grid over its land near the road: for
// each CELL-metre square within SPAN of the lane, which SLAB-high layers
// over its ground hold something (a wall, a trunk, a cart, a stair; a roof
// over a floor is two, not one block), filled from the stage's triangles
// as it builds (their surfaces: a box's inside reads open, and is only
// reached through its marked walls). The camera's boom stops short of what's in it, a fixed
// shot is moved out of it, and the walkers step round what stands in their
// lane, so nothing on the Road is walked or seen through. Pure: triangles
// in, answers out.
//
//   createSolids({ from, to, span, cell, ground(x, z) }) → {
//     add(ax, ay, az, bx, by, bz, cx, cy, cz): a triangle, in the land's frame
//     filled(): the cells something is in (for the checks)
//     at(x, y, z, pad) → whether the point (padded, sideways and up) is in something
//     boom(from, to, { pad, step }) → how far along from → to (0…1) a camera can stand:
//       1 when nothing's between, else just short of the first thing
//     standing(x, z, y, { radius, high }) → whether a walker's body there (feet at y) is in something
//     sidestep(x, z, y, { radius, high, reach, step }) → the x nearest x (within reach)
//       a walker can stand at, or x itself when it's clear (or nowhere is)
//   }

export const CELL = 0.5; // m
export const SLAB = 0.5; // m a layer
export const SPAN = 12; // m either side of the lane
export const BASE = -4; // m under the ground the layers start
export const LIFT = 0.2; // m: nearer the ground than this is the ground's (a path, a rug, a puddle)
const LAYERS = 64;
const MOST = 48; // samples along a triangle's longest edge, at most

export function createSolids({ from = 0, to = 200, span = SPAN, cell = CELL, ground = () => 0 }) {
  const nx = Math.ceil((2 * span) / cell);
  const nz = Math.ceil((to - from) / cell);
  const low = new Uint32Array(nx * nz); // layers 0…31
  const high = new Uint32Array(nx * nz); // layers 32…63
  const floor = new Float32Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) floor[iz * nx + ix] = ground(-span + (ix + 0.5) * cell, from + (iz + 0.5) * cell);
  const cellOf = (x, z) => {
    const ix = Math.floor((x + span) / cell);
    const iz = Math.floor((z - from) / cell);
    return ix < 0 || iz < 0 || ix >= nx || iz >= nz ? -1 : iz * nx + ix;
  };
  const layerOf = (c, y) => Math.floor((y - floor[c] - BASE) / SLAB);
  const mark = (x, y, z) => {
    const c = cellOf(x, z);
    if (c < 0 || y - floor[c] < LIFT) return;
    const k = layerOf(c, y);
    if (k < 0 || k >= LAYERS) return;
    if (k < 32) low[c] |= 1 << k;
    else high[c] |= 1 << (k - 32);
  };
  // whether any layer from y0 to y1 holds something in cell c
  const holds = (c, y0, y1) => {
    if (c < 0) return false;
    const k0 = Math.max(0, layerOf(c, y0));
    const k1 = Math.min(LAYERS - 1, layerOf(c, y1));
    for (let k = k0; k <= k1; k++) if ((k < 32 ? low[c] >>> k : high[c] >>> (k - 32)) & 1) return true;
    return false;
  };
  const around = (x, z, pad, test) => {
    if (test(cellOf(x, z))) return true;
    if (pad <= 0) return false;
    for (const [dx, dz] of [[pad, 0], [-pad, 0], [0, pad], [0, -pad]]) if (test(cellOf(x + dx, z + dz))) return true;
    return false;
  };

  const grid = {
    add(ax, ay, az, bx, by, bz, cx, cy, cz) {
      // (none of it near the lane: nothing to mark)
      if (Math.max(ax, bx, cx) < -span || Math.min(ax, bx, cx) > span || Math.max(az, bz, cz) < from || Math.min(az, bz, cz) > to) return;
      const edge = Math.max(Math.hypot(bx - ax, by - ay, bz - az), Math.hypot(cx - ax, cy - ay, cz - az), Math.hypot(cx - bx, cy - by, cz - bz));
      const n = Math.min(MOST, Math.max(1, Math.ceil(edge / (cell * 0.7))));
      for (let i = 0; i <= n; i++)
        for (let j = 0; j <= n - i; j++) {
          const u = i / n;
          const v = j / n;
          mark(ax + (bx - ax) * u + (cx - ax) * v, ay + (by - ay) * u + (cy - ay) * v, az + (bz - az) * u + (cz - az) * v);
        }
    },
    filled() {
      let n = 0;
      for (let c = 0; c < low.length; c++) if (low[c] || high[c]) n++;
      return n;
    },
    at(x, y, z, pad = 0) {
      return around(x, z, pad, (c) => holds(c, y - pad, y + pad));
    },
    boom(a, b, { pad = 0.25, step = 0.2 } = {}) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (len < 1e-6) return 1;
      const steps = Math.ceil(len / step);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        if (grid.at(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, pad)) return Math.max(0, t - (pad + 0.15) / len);
      }
      return 1;
    },
    standing(x, z, y, { radius = 0.25, high = 1.5 } = {}) {
      return around(x, z, radius, (c) => holds(c, y + 0.3, y + high));
    },
    sidestep(x, z, y, { radius = 0.25, high = 1.5, reach = 3, step = 0.25 } = {}) {
      if (!grid.standing(x, z, y, { radius, high })) return x;
      for (let d = step; d <= reach + 1e-9; d += step)
        for (const s of x > 0 ? [-1, 1] : [1, -1]) if (!grid.standing(x + s * d, z, y, { radius, high })) return x + s * d;
      return x;
    },
  };
  return grid;
}
