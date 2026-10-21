// What grows on the grounds, by the MegaKit’s names (public/kit/naturemega/
// index.json, Quaternius, CC0): a table of rows, each on one kind of ground
// (land.js’s cover: the forest, the moor, the lawn, the lakeside, the steep,
// the strand), placed a cell at a time by a pure rule and drawn through the
// kit’s instanced pools (lib/three/kitScatter over kitNodes), one pool a
// model and tint for the whole of the grounds, each cell’s items under its
// own key. Few models, each in its tint: a pool is a draw a level, and
// the grounds’ draws are counted.
//
//   ROWS: [{ model, on, per100, clump, spread, scale, slope, tint, kind, reach }]
//     on: 'forest' | 'moor' | 'lawn' | 'lakeside' | 'steep' | 'strand' (the ground it grows on,
//       its density weighted by how much of that ground a point is)
//     per100: items a hundred square metres of it; kind 'grass': dropped on low, halved on mid
//     reach: how far its pool draws it (its far stand-ins to there), by tier
//   CLEAR: [{ at, r } | { line, r }]: where nothing grows (the castle, the pitch, the
//     buildings, the bridges’ lines), from the places
//   placementsFor(land, i, j, { tier }) → [{ model, x, y, z, yaw, scale, tint }] (pure, seeded by the cell)
//   createScatter({ kitFor, tier }) → kitScatter’s, its pools’ reach from the rows
//   rngOf(seed) → () → 0…1

import { createKitScatter } from '../../../lib/three/kitScatter';
import { placeById } from '../rules/places';
import { BRIDGES } from './castle/plan';
import { CELL, cellRect } from './ground';
import { LAKE } from './terrain';

// the forest’s pines dark (the kit’s are a cartoon green), their bark a cold
// brown; the moor’s heather in its late purple, its grass straw; the
// lakeside’s birches white-barked over green; the stones a warm grey
const PINES = { Leaves_Pine: { recolour: '#1c3020' }, Leaves_GiantPine: { recolour: '#1a2c1e' }, Bark_Pine: { recolour: '#3e342c' } };
const UNDER = { Leaves: { recolour: '#26381f' } };
const HEATHER = { Leaves: { recolour: '#6a3a5c' }, Flowers: { recolour: '#8a4a78' } };
const STRAW = { Grass: { recolour: '#8a8456' } };
const LAWN = { Grass: { recolour: '#4e6a34' } };
const BIRCH = { Leaves_Birch: { recolour: '#6f8a3e' } };
const OAK = { Leaves_NormalTree: { recolour: '#3e5a2a' }, Bark_NormalTree: { recolour: '#5a4c3e' } };
const STONE = { Rocks: { recolour: '#7e786c' } };

export const ROWS = [
  // the Forbidden Forest: pines close and dark, a giant among them now and then, ferns and dark bushes under
  { model: 'Pine_2', on: 'forest', per100: 0.4, clump: 3, spread: 7, scale: [1.3, 1.9], slope: 1.1, tint: PINES, reach: 'forest' },
  { model: 'Pine_5', on: 'forest', per100: 0.42, clump: 3, spread: 6, scale: [1.5, 2.2], slope: 1.1, tint: PINES, reach: 'forest' },
  { model: 'GiantPine_3', on: 'forest', per100: 0.09, clump: 1, spread: 1, scale: [1.1, 1.5], slope: 0.8, tint: PINES, reach: 'forest' },
  { model: 'Fern_1', on: 'forest', per100: 0.9, clump: 5, spread: 4, scale: [0.9, 1.5], slope: 1, kind: 'grass' },
  { model: 'Bush_Common', on: 'forest', per100: 0.22, clump: 3, spread: 4, scale: [0.9, 1.5], slope: 1, tint: UNDER },
  // by the lake: birches and oaks, a bush or two
  { model: 'Birch_3', on: 'lakeside', per100: 0.09, clump: 3, spread: 8, scale: [0.9, 1.3], slope: 0.7, tint: BIRCH },
  { model: 'CommonTree_1', on: 'lakeside', per100: 0.05, clump: 2, spread: 9, scale: [1.1, 1.6], slope: 0.6, tint: OAK },
  { model: 'Bush_Large', on: 'lakeside', per100: 0.06, clump: 2, spread: 5, scale: [0.8, 1.2], slope: 0.7, tint: UNDER },
  // the lawns: grass and a few flowers, a lone oak here and there
  { model: 'Grass_Common_Short', on: 'lawn', per100: 1.6, clump: 6, spread: 3, scale: [0.8, 1.3], slope: 0.6, kind: 'grass', tint: LAWN },
  { model: 'Flower_7_Group', on: 'lawn', per100: 0.05, clump: 3, spread: 4, scale: [0.6, 0.9], slope: 0.5, kind: 'grass' },
  { model: 'CommonTree_1', on: 'lawn', per100: 0.004, clump: 1, spread: 1, scale: [1.3, 1.8], slope: 0.4, tint: OAK },
  // the moor: heather in clumps, straw-coloured grass, boulders
  { model: 'Bush_Common', on: 'moor', per100: 1.2, clump: 6, spread: 5, scale: [0.6, 1.1], slope: 1, tint: HEATHER },
  { model: 'Grass_Wispy_Short', on: 'moor', per100: 0.8, clump: 5, spread: 4, scale: [0.8, 1.2], slope: 1, kind: 'grass', tint: STRAW },
  { model: 'Rock_Big_1', on: 'moor', per100: 0.012, clump: 2, spread: 6, scale: [0.7, 1.4], slope: 1.4, tint: STONE },
  // the steep: rocks out of the slopes (the crag’s cliffs, the knolls’ flanks)
  { model: 'Rock_Medium_1', on: 'steep', per100: 0.35, clump: 3, spread: 4, scale: [0.8, 1.8], slope: 3, tint: STONE },
  { model: 'Rock_Big_1', on: 'steep', per100: 0.04, clump: 1, spread: 1, scale: [0.8, 1.6], slope: 3, tint: STONE },
  // the strand: pebbles and a stone or two at the water
  { model: 'Rock_Medium_1', on: 'strand', per100: 0.08, clump: 2, spread: 3, scale: [0.4, 0.9], slope: 1, tint: STONE },
  { model: 'Pebble_Round_1', on: 'strand', per100: 1.2, clump: 6, spread: 3, scale: [0.8, 1.6], slope: 1, kind: 'grass', tint: STONE },
];

// how far each pool draws its items (its far stand-ins out to here), by tier:
// the forest’s pines out to where the canopy (canopy.js) takes over
export const REACH = { forest: { low: 170, mid: 220, high: 260, ultra: 320 } };
// (and the near bands: a pine’s whole model only close, its LOD1 to here)
export const BANDS = { forest: { low: [20, 70], mid: [28, 90], high: [34, 100], ultra: [45, 140] } };

const at = (id) => placeById(id).at;
export const CLEAR = [
  { at: [-6, -40], r: 132 }, // the castle on its crag
  { at: at('pitch'), r: 105 },
  { at: at('greenhouses'), r: 36 },
  { at: [-254, -238], r: 28 }, // the hut, the patch and the paddock
  { at: at('paddock'), r: 22 },
  { at: at('willow'), r: 22 },
  { at: at('stone-circle'), r: 24 },
  { at: [-30, -266], r: 16 }, // the Owlery
  { at: [-25, 54], r: 16 }, // the boathouse
  { at: at('station'), r: 42 },
  { at: at('hogsmeade'), r: 80 },
  { at: at('clearing'), r: 16 },
  { line: [BRIDGES.viaduct.from, BRIDGES.viaduct.to], r: 9 },
  { line: [BRIDGES.covered.from, BRIDGES.covered.to], r: 7 },
];
const cleared = (x, z) =>
  CLEAR.some((c) => {
    if (c.at) return (x - c.at[0]) ** 2 + (z - c.at[1]) ** 2 < c.r * c.r;
    const [a, b] = c.line;
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz)));
    return (x - a[0] - dx * t) ** 2 + (z - a[2] - dz * t) ** 2 < c.r * c.r;
  });

// mulberry32
export function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const share = (row, tier) => (row.kind === 'grass' ? (tier === 'low' ? 0 : tier === 'mid' ? 0.5 : 1) : tier === 'low' ? 0.6 : 1);

// how much of a row’s ground a point is (0…1)
function groundOf(on, cv, h, shore) {
  switch (on) {
    case 'forest':
      return cv.forest;
    case 'moor':
      return cv.moor * (1 - cv.rock);
    case 'lawn':
      return cv.lawn * (1 - cv.shore) * (h > 1.5 ? 1 : 0);
    case 'lakeside':
      return cv.lawn * (shore > 4 && shore < 70 ? 1 - shore / 70 : 0);
    case 'steep':
      return cv.rock;
    case 'strand':
      return h > LAKE + 0.15 ? cv.shore : 0;
    default:
      return 0;
  }
}

export function placementsFor(land, i, j, { tier = 'high', rows = ROWS } = {}) {
  const [x0, z0, x1, z1] = cellRect(i, j);
  const rng = rngOf(7919 * (i + 1) + 104729 * (j + 1));
  const out = [];
  const cv = {};
  for (const row of rows) {
    const count = Math.round(((row.per100 * CELL * CELL) / 100) * share(row, tier));
    const clump = Math.max(1, row.clump ?? 1);
    const spread = row.spread ?? 4;
    const [s0, s1] = row.scale ?? [1, 1];
    for (let n = 0; n < count; n += clump) {
      const cx = x0 + rng() * (x1 - x0);
      const cz = z0 + rng() * (z1 - z0);
      // (a clump is kept or not by the ground under its middle, so a wood’s edge is ragged, not thinned)
      land.coverAt(cx, cz, cv);
      const hc = land.heightAt(cx, cz);
      const weight = groundOf(row.on, cv, hc, land.shoreAt(cx, cz));
      const keep = rng() < weight;
      for (let k = 0; k < clump && n + k < count; k++) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * spread;
        const yaw = rng() * Math.PI * 2;
        const scale = s0 + rng() * (s1 - s0);
        if (!keep) continue;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
        const h = land.heightAt(x, z);
        if (h < LAKE + 0.2) continue;
        if (land.pathAt(x, z) < (row.kind === 'grass' ? 0.6 : 2.2)) continue;
        if (row.on !== 'strand' && row.on !== 'steep' && cleared(x, z)) continue;
        if (land.slopeAt(x, z) > (row.slope ?? 0.7)) continue;
        out.push({ model: row.model, x, y: h - 0.12, z, yaw, scale, tint: row.tint ?? null });
      }
    }
  }
  return out;
}

export function createScatter({ kitFor, tier = 'high' } = {}) {
  const reachOf = new Map(ROWS.filter((r) => r.reach).map((r) => [r.model, r.reach]));
  return createKitScatter({
    kitFor,
    tier,
    name: 'hogwarts:scatter',
    poolOptions: (model) => {
      const kind = reachOf.get(model);
      if (!kind) return {};
      return { reach: REACH[kind]?.[tier] ?? REACH[kind].high, bands: BANDS[kind]?.[tier] ?? BANDS[kind].high };
    },
  });
}
