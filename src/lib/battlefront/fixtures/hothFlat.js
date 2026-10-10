// Hoth for the Node arena, until lane 5 ships the level's own `nav.bin`: the
// map's real bounds, spawns and Galactic Assault volumes over a plane fitted
// (least squares) through every spawn, with cover made up round the
// volumes: a 2 m wall along each volume's edge with a 4 m door every 20 m
// (none round a volume too small for a door, such as an uplink's console,
// which would wall it off), and crates scattered round them from a fixed seed.

import { seeded } from '../../seeded.js';
import { aiOf, mapOf } from '../rulebook.js';
import { buildNav } from '../nav.js';

const WALL = 16; // metres of wall between doors
const DOOR = 4;
const CRATES = 40;
// A volume whose edge is shorter than this all round has no door, so no wall.
const SMALL = 2 * (WALL + DOOR);

// y = a·x + b·z + c through the points, by the normal equations
export function fitPlane(points) {
  let sxx = 0, sxz = 0, szz = 0, sx = 0, sz = 0, sy = 0, sxy = 0, szy = 0;
  const n = points.length;
  for (const [x, y, z] of points) {
    sxx += x * x;
    sxz += x * z;
    szz += z * z;
    sx += x;
    sz += z;
    sy += y;
    sxy += x * y;
    szy += z * y;
  }
  // solve [[sxx sxz sx][sxz szz sz][sx sz n]] · [a b c] = [sxy szy sy] by Cramer
  const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const M = [
    [sxx, sxz, sx],
    [sxz, szz, sz],
    [sx, sz, n],
  ];
  const r = [sxy, szy, sy];
  const D = det3(M);
  const col = (k) => M.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)));
  return { a: det3(col(0)) / D, b: det3(col(1)) / D, c: det3(col(2)) / D };
}

function wallsAlong(points, y) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 2) continue;
    const ex = (q[0] - p[0]) / L;
    const ez = (q[1] - p[1]) / L;
    // a solid's local x runs along (cos yaw, −sin yaw): see nav.js
    const yaw = Math.atan2(-ez, ex);
    for (let s = 0; s < L; s += WALL + DOOR) {
      const len = Math.min(WALL, L - s);
      if (len < 1) break;
      const m = s + len / 2;
      const x = p[0] + ex * m;
      const z = p[1] + ez * m;
      out.push({ at: [x, y(x, z) + 1, z], half: [len / 2, 1, 0.5], yaw });
    }
  }
  return out;
}

let cached = null;

export function hothFlatNav(rb) {
  if (cached?.rb === rb) return cached.nav;
  const map = mapOf(rb, 'hoth');
  const plane = fitPlane(map.spawns.map((s) => s.at));
  const y = (x, z) => plane.a * x + plane.b * z + plane.c;
  const volumes = map.volumes.filter((v) => v.mode === 'galacticAssault' && v.points?.length >= 3);
  const perimeter = (v) => v.points.reduce((n, p, i) => n + Math.hypot(v.points[(i + 1) % v.points.length][0] - p[0], v.points[(i + 1) % v.points.length][1] - p[1]), 0);
  const solids = volumes.filter((v) => perimeter(v) >= SMALL).flatMap((v) => wallsAlong(v.points, y));
  const rand = seeded(2017);
  for (let i = 0; i < CRATES; i++) {
    const v = volumes[Math.floor(rand() * volumes.length)];
    const cx = v.points.reduce((n, p) => n + p[0], 0) / v.points.length;
    const cz = v.points.reduce((n, p) => n + p[1], 0) / v.points.length;
    const a = rand() * Math.PI * 2;
    const r = 8 + rand() * 30;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    solids.push({ at: [x, y(x, z) + 0.6, z], half: [0.6, 0.6, 0.6], yaw: rand() * Math.PI });
  }
  const nav = buildNav({ heightAt: y, bounds: { min: map.bounds.min, max: map.bounds.max }, cell: 2, solids, cover: aiOf(rb).cover.constants });
  cached = { rb, nav };
  return nav;
}
