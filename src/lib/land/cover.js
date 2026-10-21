// A land's cover, a square tile at a time: rows of kit models at so many an
// 100 m², in clumps (the Road's rule, middleearth/road/scatter.js), placed
// on one tile from a seed and the tile's place alone, so the same tile is
// the same on every visit and every machine, and a ring of tiles can follow
// you anywhere: a galaxy world's core or ground with no edge
// (docs/superpowers/specs/2026-10-20-galaxy-living-free-roam-design.md, 1).
//
// Pure: no three.js, no DOM.
//
//   TILE = 32 (metres a side)
//   tileSeed(seed, tx, tz) → the tile's seed (an integer)
//   tilesAround(x, z, reach, size = TILE) → [[tx, tz, d]] nearest first, d
//     the tile's nearest point's distance from (x, z), every tile within reach
//   coverTile(rows, tx, tz, { size, seed, height, slope, keep, cover, share })
//     → [{ model, x, y, z, yaw, scale, row }]
//     rows   [{ model, per100, clump = 1, spread = 4, scale = [1, 1],
//              slope = 0.6, on = 'any' | 'grass', woods = 0 }]
//            per100  how many an 100 m² (the count's fraction a last clump by chance)
//            clump   how many stand together, `spread` metres from its middle
//                    at most (a clump keeps to its middle's tile: a member
//                    past the edge is still its tile's)
//            slope   the steepest ground it stands on, rise over run
//            on      'grass': kept as often as the ground grows grass there
//                    (`cover(x, z)`, 0…1)
//            woods   0…1: how much it keeps to the woods, a low noise
//                    gathering it into woods with glades between (a tree's
//                    1, the meadow's -1: into the glades)
//     height(x, z)  the ground's height
//     slope(x, z)   rise over run (from `height` by central differences unless given)
//     keep(x, z, row) → false where nothing of that row may stand (a place's
//                   flat, the water, a wall)
//     share(row)    the share of its count a device lays (1)
//   `row` on an item is the row's index in `rows`.
//
// Every item draws the same random numbers whether it is kept or not, so a
// tile's survivors never shift with what `keep` says.

import { seeded } from '../seeded.js';
import { noise2 } from './layers.js';

export const TILE = 32;
const SLOPE = 0.6;
// the woods: a bump every ~180 m, a clump kept as often as smoothstep(WOODS) of it
const WOODS_SCALE = 180;
const WOODS = [-0.15, 0.35];

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const tileSeed = (seed, tx, tz) => (Math.imul(tx | 0, 73856093) ^ Math.imul(tz | 0, 19349663) ^ Math.imul((seed | 0) + 1, 83492791)) >>> 0;

export function tilesAround(x, z, reach, size = TILE) {
  const cx = Math.floor(x / size);
  const cz = Math.floor(z / size);
  const ring = Math.ceil(reach / size);
  const out = [];
  for (let dz = -ring; dz <= ring; dz++)
    for (let dx = -ring; dx <= ring; dx++) {
      const tx = cx + dx;
      const tz = cz + dz;
      // (the tile's nearest point to you)
      const nx = Math.max(tx * size, Math.min(x, (tx + 1) * size));
      const nz = Math.max(tz * size, Math.min(z, (tz + 1) * size));
      const d = Math.hypot(nx - x, nz - z);
      if (d <= reach) out.push([tx, tz, d]);
    }
  return out.sort((a, b) => a[2] - b[2]);
}

// how far a row keeps to the woods (or to the glades, below 0) at (x, z): 0…1
const woodsAt = (woods, x, z, seed) => {
  if (!woods) return 1;
  const n = noise2(x / WOODS_SCALE, z / WOODS_SCALE, seed + 17) * 0.7 + noise2(x / 60, z / 60, seed + 19) * 0.3;
  const k = smoothstep(WOODS[0], WOODS[1], woods > 0 ? n : -n);
  return 1 - Math.abs(woods) + Math.abs(woods) * k;
};

export function coverTile(rows, tx, tz, { size = TILE, seed = 1, height, slope = null, keep = null, cover = null, share = null } = {}) {
  const slopeAt = slope ?? ((x, z) => Math.hypot(height(x + 1, z) - height(x - 1, z), height(x, z + 1) - height(x, z - 1)) / 2);
  const x0 = tx * size;
  const z0 = tz * size;
  const out = [];
  rows.forEach((row, i) => {
    const rand = seeded(tileSeed(seed + i * 7919, tx, tz));
    const want = (row.per100 * size * size * (share?.(row) ?? 1)) / 100;
    const clump = Math.max(1, row.clump ?? 1);
    const clumps = want / clump;
    const n = Math.floor(clumps) + (rand() < clumps - Math.floor(clumps) ? 1 : 0);
    const spread = row.spread ?? 4;
    const steep = row.slope ?? SLOPE;
    const [s0, s1] = row.scale ?? [1, 1];
    for (let c = 0; c < n; c++) {
      const cx = x0 + rand() * size;
      const cz = z0 + rand() * size;
      const held = rand() < woodsAt(row.woods ?? 0, cx, cz, seed);
      for (let k = 0; k < clump; k++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * spread;
        const yaw = rand() * Math.PI * 2;
        const scale = s0 + rand() * (s1 - s0);
        const grassy = rand();
        if (!held) continue;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        if (row.on === 'grass' && cover && grassy >= cover(x, z)) continue;
        if (keep && !keep(x, z, row)) continue;
        if (slopeAt(x, z) > steep) continue;
        out.push({ model: row.model, x, y: height(x, z), z, yaw, scale, row: i });
      }
    }
  });
  return out;
}
