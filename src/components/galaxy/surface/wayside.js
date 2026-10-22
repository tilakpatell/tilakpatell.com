// What you come on out in the free roam, past a world's core (roam.js): a
// kilometre square region at a time, seeded by the world and the region
// alone, so it is the same every visit, holds one place or none, a camp, a
// downed starfighter, an outpost, a ruin or a small town (town.js), by what
// kind of world it is.
// Pure: the scene puts a region's things in (`abs`, on the land's own height,
// so they sit on the ground as the ground is drawn when you get there) as it
// comes within sight (docs/superpowers/specs/2026-10-20-galaxy-living-free-
// roam-design.md, 3).
//
//   REGION = 1000 (metres a side)
//   waysideAt(site, rx, rz, height?) → { id, kind, at: [x, z], things: [spec…] } | null
//     (given the land's height, the place goes on the flattest of a few
//     spots in its region, the first flat enough: no camp on a cliff, no
//     ship across a hilltop)
//     (a thing's `lie`: metres each way the scene lays it along the land's slope)
//   regionsAround(x, z, reach) → [[rx, rz]] whose middles are within reach
//   laidOn(thing, height) → the thing on the land's own height (`abs`, `y`),
//     one with a `lie` pitched and rolled to the land's slope under it, one
//     with a `seat` (a house's) on the lowest of the land round it, so no
//     corner of it hangs over a slope

import { seeded } from '../../../lib/seeded.js';
import { SPAN as TOWN, townOf } from './town.js';

export const REGION = 1000;
const CHANCE = 0.55; // of a region holding a place
const JITTER = 0.35; // of a region its place may stand off its middle
const CORE = 300; // metres past the world's reach before the first
const TRIES = 8; // spots in its region a place may try for flat ground
const FLAT = 0.12; // the most its ground may rise across it, a metre a metre
// (the metres across a place that must be flat: a ship's its length)
const SPAN = { camp: 10, outpost: 12, ruin: 12, town: TOWN };

// a place's things, about its middle and turned with it: [kind, x, z, more]
const KITS = {
  camp: [
    ['tent', 0, 0],
    ['tent', 7, 3, { yaw: 0.9 }],
    ['fire', 3, -4],
    ['crates', -5, 2],
    ['barrels', -4, -3],
    ['log', 2, -7, { yaw: 1.3 }],
  ],
  wreck: [
    ['$ship', 0, 0],
    ['wrecksmoke', 1, 1, { solid: false, opts: { h: 18, r: 1.1 } }],
    ['crates', 9, 4],
    ['crates', -7, -5, { yaw: 2.1 }],
  ],
  outpost: [
    ['bunker', 0, 0],
    ['turret', 9, 7],
    ['turret', -9, 7],
    ['crates', 3, -9],
    ['barrels', -4, -9],
  ],
  ruin: [
    ['statue', 0, 0, { scale: 0.8 }],
    ['statue', 11, 5, { scale: 0.7, roll: 1.4 }],
    ['statue', -9, 6, { scale: 0.6, roll: 0.3 }],
  ],
};
// (the flight's own models, at their lengths: props/generic.js's downed)
const SHIPS = [
  ['xwing', 12.5],
  ['ywing', 23.4],
  ['tie', 6.3],
];
// which a world's kind of land turns up, and how often
const GREEN = { camp: 0.3, ruin: 0.25, wreck: 0.2, town: 0.25 };
const BARE = { wreck: 0.3, outpost: 0.25, camp: 0.2, town: 0.25 };
const LUSH = new Set(['plains', 'temperate', 'conifer', 'jungle', 'swamp', 'tropical']);

const pick = (rand, odds) => {
  let t = rand();
  for (const [k, p] of Object.entries(odds)) if ((t -= p) <= 0) return k;
  return Object.keys(odds)[0];
};

// how steep the ground is across (x, z), r round: its rise over its width
const roughAt = (height, x, z, r) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI * 2;
    const h = i === 8 ? height(x, z) : height(x + Math.cos(a) * r, z + Math.sin(a) * r);
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  return (hi - lo) / (2 * r);
};

export function waysideAt(site, rx, rz, height = null) {
  const rand = seeded((Math.imul(rx | 0, 73856093) ^ Math.imul(rz | 0, 19349663) ^ Math.imul((site.ground?.seed ?? 1) + 7, 83492791)) >>> 0);
  const mx = (rx + 0.5) * REGION;
  const mz = (rz + 0.5) * REGION;
  const held = rand();
  let x = mx + (rand() * 2 - 1) * JITTER * REGION;
  let z = mz + (rand() * 2 - 1) * JITTER * REGION;
  const yaw = rand() * Math.PI * 2;
  const kind = pick(rand, LUSH.has(site.flora?.biome) ? GREEN : BARE);
  const [ship, metres] = SHIPS[Math.floor(rand() * SHIPS.length)];
  const roll = (rand() < 0.5 ? -1 : 1) * (0.3 + rand() * 0.3);
  if (held > CHANCE || Math.hypot(x, z) < (site.reach ?? 590) + CORE) return null;
  if (height) {
    // (more spots drawn after the rest, so the place is the same without the land's height)
    const r = kind === 'wreck' ? metres / 2 : SPAN[kind];
    let best = roughAt(height, x, z, r);
    for (let i = 1; i < TRIES && best > FLAT; i++) {
      const cx = mx + (rand() * 2 - 1) * JITTER * REGION;
      const cz = mz + (rand() * 2 - 1) * JITTER * REGION;
      const rough = Math.hypot(cx, cz) < (site.reach ?? 590) + CORE ? Infinity : roughAt(height, cx, cz, r);
      if (rough < best) [x, z, best] = [cx, cz, rough];
    }
  }
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const things = (kind === 'town' ? townOf(rand, site) : KITS[kind]).map(([k, dx, dz, more = {}]) => ({
    kind: k === '$ship' ? 'downed' : k,
    // (a ship laid along the land under its length: `lie`)
    ...(k === '$ship' ? { opts: { ship, metres, roll }, lie: metres * 0.45 } : {}),
    at: [x + dx * c + dz * s, z - dx * s + dz * c],
    ...more,
    yaw: yaw + (more.yaw ?? 0),
  }));
  return { id: `wayside:${rx},${rz}`, kind, at: [x, z], things };
}

export function regionsAround(x, z, reach) {
  const out = [];
  const r = Math.ceil(reach / REGION);
  const cx = Math.floor(x / REGION);
  const cz = Math.floor(z / REGION);
  for (let i = cx - r; i <= cx + r; i++) for (let j = cz - r; j <= cz + r; j++) if (Math.hypot((i + 0.5) * REGION - x, (j + 0.5) * REGION - z) <= reach) out.push([i, j]);
  return out;
}

// (a long thing laid along the land, `lie` metres each way: pitched up the
// slope ahead of it and rolled to the slope across it, so a downed ship's
// ends neither hang over a drop nor dig in deep)
const lowest = (height, x, z, r) => {
  let y = height(x, z);
  for (let i = 0; i < 8; i++) y = Math.min(y, height(x + Math.cos((i / 8) * Math.PI * 2) * r, z + Math.sin((i / 8) * Math.PI * 2) * r));
  return y;
};
export function laidOn(t, height) {
  const [x, z] = t.at;
  const out = { ...t, abs: true, y: t.seat ? lowest(height, x, z, t.seat) : height(x, z) };
  const L = t.lie ?? 0;
  if (!L) return out;
  const f = [Math.sin(t.yaw ?? 0), Math.cos(t.yaw ?? 0)];
  const slope = ([dx, dz]) => (height(x + dx * L, z + dz * L) - height(x - dx * L, z - dz * L)) / (2 * L);
  const along = slope(f);
  // (the roll turns about the pitched nose, so the slope across is foreshortened by the pitch)
  return { ...out, pitch: (t.pitch ?? 0) - Math.atan(along), roll: (t.roll ?? 0) + Math.atan(slope([f[1], -f[0]]) / Math.hypot(1, along)) };
}
