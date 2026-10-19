// Bumping into things: the lawn's edge, the buildings' walls and roofs, and
// how high the floor is under a point.

import { inPoly } from '../../compound/plan';
import { EDGE, HERO_R, LAWN_W, ROUND, SOLIDS, nearestEdge } from './plan';

// Out of a footprint, or `rad` clear of it, by the nearest edge.
function outOf(x, z, foot, rad) {
  const inside = inPoly(x, z, foot);
  const e = nearestEdge(x, z, foot);
  if (!inside && e.d >= rad) return [x, z];
  let ux;
  let uz;
  if (e.d > 1e-6) {
    ux = (x - e.x) / e.d;
    uz = (z - e.z) / e.d;
    if (inside) {
      ux = -ux;
      uz = -uz;
    }
  } else {
    // on the edge: out along its normal, whichever way leaves
    const l = Math.hypot(e.nx, e.nz) || 1;
    ux = e.nx / l;
    uz = e.nz / l;
    if (inPoly(e.x + ux * 0.01, e.z + uz * 0.01, foot)) {
      ux = -ux;
      uz = -uz;
    }
  }
  return [e.x + ux * rad, e.z + uz * rad];
}

// Back inside the lawn, `rad` from its edge.
export function onLawn(x, z, rad) {
  const inside = inPoly(x, z, LAWN_W);
  const e = nearestEdge(x, z, LAWN_W);
  if (inside && e.d >= rad) return [x, z];
  let ux;
  let uz;
  if (e.d > 1e-6) {
    // from the edge towards the middle of the lawn
    ux = (x - e.x) / e.d;
    uz = (z - e.z) / e.d;
    if (!inside) {
      ux = -ux;
      uz = -uz;
    }
  } else {
    const l = Math.hypot(e.nx, e.nz) || 1;
    ux = e.nx / l;
    uz = e.nz / l;
    if (!inPoly(e.x + ux * 0.01, e.z + uz * 0.01, LAWN_W)) {
      ux = -ux;
      uz = -uz;
    }
  }
  return [e.x + ux * rad, e.z + uz * rad];
}

export const BODY = 1.7; // how tall he is, for heads under the bridge
const STEP = 0.35; // a ledge he steps up onto, rather than walks into
// whether a solid is in the way of someone whose feet are at `y`
export const atHeight = (s, y) => y < s.h - STEP && y + BODY > s.y0;

// Where (x, z) ends up for something `rad` round with its feet at `y`: out of
// whatever's at that height (the buildings, and the things on the lawn), and
// on the lawn.
export function collide(x, z, rad, y = 0) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of SOLIDS) {
      if (!atHeight(b, y)) continue;
      const [x0, z0, x1, z1] = b.box;
      if (x < x0 - rad || x > x1 + rad || z < z0 - rad || z > z1 + rad) continue;
      [x, z] = outOf(x, z, b.foot, rad);
    }
    [x, z] = offRound(x, z, rad, y);
    [x, z] = onLawn(x, z, Math.max(rad, EDGE));
  }
  return [x, z];
}

function offRound(x, z, rad, y) {
  for (const c of ROUND) {
    if (y >= c.top) continue;
    const dx = x - c.x;
    const dz = z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + rad;
    if (d < min) {
      if (d > 1e-6) {
        x = c.x + (dx / d) * min;
        z = c.z + (dz / d) * min;
      } else x = c.x + min;
    }
  }
  return [x, z];
}

// Whether (x, z) is somewhere you can stand (on the lawn, or a roof at `y`,
// and in nothing).
export function walkable(x, z, rad = HERO_R, y = 0) {
  const [cx, cz] = collide(x, z, rad, y);
  return Math.hypot(cx - x, cz - z) < 1e-6;
}

// The ground under (x, z) for someone whose feet are at `y`: the highest roof
// there he's on or over, or the lawn.
export function floorAt(x, z, y = 0) {
  let f = 0;
  for (const s of SOLIDS) {
    if (s.h > y + STEP || s.h <= f) continue;
    const [x0, z0, x1, z1] = s.box;
    if (x < x0 || x > x1 || z < z0 || z > z1) continue;
    if (inPoly(x, z, s.foot)) f = s.h;
  }
  return f;
}

// The way out of a footprint from (x, z) beside it: the nearest edge's normal.
export function wallNormal(x, z, foot) {
  const e = nearestEdge(x, z, foot);
  let nx = e.nx;
  let nz = e.nz;
  const l = Math.hypot(nx, nz) || 1;
  nx /= l;
  nz /= l;
  if (inPoly(e.x + nx * 0.05, e.z + nz * 0.05, foot)) {
    nx = -nx;
    nz = -nz;
  }
  return { x: e.x, z: e.z, nx, nz };
}

// A body come to (x, y, z) from a height `py`: onto a roof it came down on,
// under whatever it hit its head on, out of the walls it went into, over the
// things on the lawn it cleared, still on the lawn, and down on the ground.
// → { x, y, z, landed (the floor it's down on, or null), head, wall (the
// solid it's against, with the way out of it: nx, nz), lawn (the way back
// onto the lawn, if it went off it) }
export function collide3(py, x, y, z) {
  let landed = null;
  let head = false;
  let wall = null;
  let lawn = null;
  for (let pass = 0; pass < 2; pass++) {
    for (const s of SOLIDS) {
      if (y >= s.h || y + BODY <= s.y0) continue;
      const [x0, z0, x1, z1] = s.box;
      if (x < x0 - HERO_R || x > x1 + HERO_R || z < z0 - HERO_R || z > z1 + HERO_R) continue;
      const inside = inPoly(x, z, s.foot);
      if (inside && py >= s.h - 0.05) {
        // came down on its roof
        y = s.h;
        landed = Math.max(landed ?? 0, s.h);
        continue;
      }
      if (inside && py + BODY <= s.y0 + 0.05) {
        // came up under it
        y = s.y0 - BODY;
        head = true;
        continue;
      }
      const [ox, oz] = outOf(x, z, s.foot, HERO_R);
      if (ox === x && oz === z) continue;
      x = ox;
      z = oz;
      const n = wallNormal(x, z, s.foot);
      wall = { s, nx: n.nx, nz: n.nz };
    }
    [x, z] = offRound(x, z, HERO_R, y);
    const [lx, lz] = onLawn(x, z, Math.max(HERO_R, EDGE));
    if (lx !== x || lz !== z) {
      const d = Math.hypot(lx - x, lz - z) || 1;
      lawn = { nx: (lx - x) / d, nz: (lz - z) / d };
      x = lx;
      z = lz;
    }
  }
  const f = floorAt(x, z, Math.max(py, y));
  if (y <= f) {
    y = f;
    landed = f;
  }
  return { x, y, z, landed, head, wall, lawn };
}
