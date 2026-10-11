// Where the game's scatter stands round the visitor (fidelity lane N: docs/
// superpowers/specs/2026-10-10-battlefront-fidelity-design.md, "Lane N").
// Pure: no three.js. A tile's instances come from the record's density for
// the tier, the derived mask (scatter.json's layers.png: a layer index + 1 a
// texel) and a seed from the tile and the type, so a tile is the same every
// visit and on every machine.
//
//   TILE                                   metres a side of a scatter tile
//   layerAt(mask, x, z) → layer index | -1 (the mask's texel under a point)
//   reachOf(type, radius, tier) → metres it is drawn out to
//   keepShare(count, tier) → 0…1 (the tier's DENSITY_CAP over the ring's count)
//   tileInstances({ tx, tz, mask, layers, tier, scale, reach, centre }) → [{ type, x, z, yaw, w, h, d, r }]
//   dissolveOf(distance, reach, range) → 0…1 (the size an instance is drawn at)
//   tilesAround(x, z, reach) → [[tx, tz, distance]] nearest first
//   mulberry32(seed) → () → 0…1

// metres a tile: small enough that the ring follows the visitor closely,
// large enough that a tile of clover is a few hundred instances
export const TILE = 16;
// metres a 1 m type is drawn out to on each tier; a larger one farther, by
// the square root of its size (REACH_SIZE). Named: the game's scatter view
// distance is in a render setting the export does not carry.
export const REACH = { low: 18, mid: 28, high: 40, ultra: 56 };
export const REACH_SIZE = { min: 0.5, max: 6 };
// the most instances the ring holds on each tier (the frame's budget for the
// scatter: under 2 ms at ultra on the owner's laptop is the plan's gate); a
// ring over it thins every type alike, never drops one
export const DENSITY_CAP = { low: 3000, mid: 9000, high: 24000, ultra: 48000 };
// the game's dissolve range on a type that does not say (DissolveRangeRatio)
export const DISSOLVE = 0.4;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (tx, tz, k) => (Math.imul(tx | 0, 73856093) ^ Math.imul(tz | 0, 19349663) ^ Math.imul(k + 1, 83492791)) >>> 0;

// mask: { data (Uint16Array: index + 1, 0 none), w, h, minX, minZ, metresPerPixel }
export function layerAt(mask, x, z) {
  const i = Math.floor((x - mask.minX) / mask.metresPerPixel + 0.5);
  const j = Math.floor((z - mask.minZ) / mask.metresPerPixel + 0.5);
  if (i < 0 || j < 0 || i >= mask.w || j >= mask.h) return -1;
  return mask.data[j * mask.w + i] - 1;
}

export function reachOf(type, radius, tier) {
  const size = Math.max(...type.scale.max) * (radius || 1);
  const k = Math.sqrt(Math.min(REACH_SIZE.max, Math.max(REACH_SIZE.min, size)));
  return (REACH[tier] ?? REACH.high) * k;
}

// the share of the ring's instances the tier keeps: all while they are under
// DENSITY_CAP, else the cap over them (each instance carries its own roll,
// `r`, so the thinning is the same every visit and takes every type alike)
export function keepShare(count, tier) {
  const cap = DENSITY_CAP[tier] ?? DENSITY_CAP.high;
  return count > cap ? cap / count : 1;
}

const lerp = (a, b, t) => a + (b - a) * t;

// layers: [{ index, types: [{ density, scale, randomness, … }] }] (scatter.json's);
// reach(type) metres, from `centre`; scale a share of the density. An instance:
// its type (an index into the flat list of the layers' types, in order), its
// place and turn, its width (x and z) and height.
export function tileInstances({ tx, tz, mask, layers, tier, scale = 1, reach = null, centre = null }) {
  const out = [];
  let k = -1;
  for (const l of layers) {
    for (const t of l.types) {
      k++;
      const density = (t.density?.[tier] ?? 0) * scale;
      if (density <= 0) continue;
      const rand = mulberry32(seedOf(tx, tz, k));
      // (the expected count, its fraction a last instance by chance)
      const want = density * TILE * TILE;
      const n = Math.floor(want) + (rand() < want - Math.floor(want) ? 1 : 0);
      const r = reach ? reach(t) : Infinity;
      for (let i = 0; i < n; i++) {
        const x = (tx + rand()) * TILE;
        const z = (tz + rand()) * TILE;
        const yaw = rand() * Math.PI * 2;
        const s = rand() ** (t.randomness ?? 1);
        const s2 = rand();
        if (layerAt(mask, x, z) !== l.index) continue;
        if (centre && Math.hypot(x - centre[0], z - centre[1]) > r) continue;
        const w = lerp(t.scale.min[0], t.scale.max[0], s);
        out.push({ type: k, x, z, yaw, w, h: lerp(t.scale.min[1], t.scale.max[1], s), d: w, r: s2 });
      }
    }
  }
  return out;
}

// the game's dissolve: whole until the last `range` of its reach, gone at it
export function dissolveOf(distance, reach, range = DISSOLVE) {
  const start = reach * (1 - range);
  if (distance <= start) return 1;
  if (distance >= reach) return 0;
  const t = (distance - start) / (reach - start);
  return 1 - t * t * (3 - 2 * t);
}

export function tilesAround(x, z, reach) {
  const cx = Math.floor(x / TILE);
  const cz = Math.floor(z / TILE);
  const ring = Math.ceil(reach / TILE);
  const out = [];
  for (let dz = -ring; dz <= ring; dz++)
    for (let dx = -ring; dx <= ring; dx++) {
      const tx = cx + dx;
      const tz = cz + dz;
      // (the tile's nearest point to the visitor)
      const nx = Math.max(tx * TILE, Math.min(x, (tx + 1) * TILE));
      const nz = Math.max(tz * TILE, Math.min(z, (tz + 1) * TILE));
      const d = Math.hypot(nx - x, nz - z);
      if (d <= reach) out.push([tx, tz, d]);
    }
  return out.sort((a, b) => a[2] - b[2]);
}
