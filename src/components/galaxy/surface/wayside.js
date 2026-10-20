// What you come on out in the free roam, past a world's core (roam.js): a
// kilometre square region at a time, seeded by the world and the region
// alone, so it is the same every visit, holds one place or none, a camp, a
// downed starfighter, an outpost or a ruin, by what kind of world it is.
// Pure: the scene puts a region's things in (`abs`, on the land's own height,
// so they sit on the ground as the ground is drawn when you get there) as it
// comes within sight (docs/superpowers/specs/2026-10-20-galaxy-living-free-
// roam-design.md, 3).
//
//   REGION = 1000 (metres a side)
//   waysideAt(site, rx, rz) → { id, kind, at: [x, z], things: [spec…] } | null
//   regionsAround(x, z, reach) → [[rx, rz]] whose middles are within reach

import { seeded } from '../../../lib/seeded.js';

export const REGION = 1000;
const CHANCE = 0.55; // of a region holding a place
const JITTER = 0.35; // of a region its place may stand off its middle
const CORE = 300; // metres past the world's reach before the first

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
    ['$ship', 0, 0, { roll: 0.45, pitch: -0.12 }],
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
const SHIPS = ['xwing', 'ywing', 'tie'];
// which a world's kind of land turns up, and how often
const GREEN = { camp: 0.4, ruin: 0.35, wreck: 0.25 };
const BARE = { wreck: 0.35, outpost: 0.35, camp: 0.3 };
const LUSH = new Set(['plains', 'temperate', 'conifer', 'jungle', 'swamp', 'tropical']);

const pick = (rand, odds) => {
  let t = rand();
  for (const [k, p] of Object.entries(odds)) if ((t -= p) <= 0) return k;
  return Object.keys(odds)[0];
};

export function waysideAt(site, rx, rz) {
  const rand = seeded((Math.imul(rx | 0, 73856093) ^ Math.imul(rz | 0, 19349663) ^ Math.imul((site.ground?.seed ?? 1) + 7, 83492791)) >>> 0);
  const mx = (rx + 0.5) * REGION;
  const mz = (rz + 0.5) * REGION;
  const roll = rand();
  const x = mx + (rand() * 2 - 1) * JITTER * REGION;
  const z = mz + (rand() * 2 - 1) * JITTER * REGION;
  const yaw = rand() * Math.PI * 2;
  const kind = pick(rand, LUSH.has(site.flora?.biome) ? GREEN : BARE);
  const ship = SHIPS[Math.floor(rand() * SHIPS.length)];
  if (roll > CHANCE || Math.hypot(x, z) < (site.reach ?? 590) + CORE) return null;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const things = KITS[kind].map(([k, dx, dz, more = {}]) => ({
    kind: k === '$ship' ? ship : k,
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
