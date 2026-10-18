// The eight terrain characters a generated planet's round ground is made
// from, each a recipe in 3D noise of a unit direction on the sphere, so the
// ground has no seam, no pole and no edge (sphereField.js builds a planet's
// whole field on groundOf).
//
// A character is one big shape and one layer on it:
//   - `shape`, noise3For at TERRAIN[kind].shape of the direction (5 octaves),
//     says land from sea; `s0`, the `sea` quantile of shape over FIB_512, is
//     the shore, so the measured sea share is the one asked for.
//   - Over the shore the ground lifts (shape − s0) × lift. Under it, it sinks
//     × lift on a dry planet (its basins) and × 420 on a wet one, easing
//     onto a floor 180 m down either way.
//   - `land` runs 0 to 1 over the first 0.12 of shape past the shore, and the
//     kind's layer, in metres at p = dir × radius, is added on top.
//
// Pure: runs in Node and in a worker.
//
//   CHARACTERS: the eight kinds, in the spec's order
//   TERRAIN[kind] → { shape, sea: [lo, hi], peaks: [lo, hi], lift }
//   FIB_512: 512 Fibonacci-sphere unit directions
//   groundOf({ kind, sea, peaks, wet = false }, seed, radius) → (dir) → { h: metres, land: 0…1 }

import { cells3For, fold, noise3For } from './fnl.js';
import { dirOfLatLon, unit } from './sphere.js';

export const CHARACTERS = ['continents', 'archipelago', 'canyons', 'mesas', 'dunes', 'craters', 'ridges', 'plateaus'];

// Starting values, to tune by eye. Two peaks moved so that every planet in
// range keeps the flight's limits at any `sea`: craters' to 140 (a bowl digs
// 1.3 × peaks, so 250 went to −310 m) and ridges' to 850 (1100 stood 1330 m
// tall at sea 0).
export const TERRAIN = {
  continents: { shape: 1.3, sea: [0.35, 0.6], peaks: [300, 900], lift: 260 },
  archipelago: { shape: 3.2, sea: [0.62, 0.8], peaks: [150, 450], lift: 200 },
  canyons: { shape: 1.0, sea: [0, 0.15], peaks: [150, 350], lift: 60 },
  mesas: { shape: 1.0, sea: [0, 0.15], peaks: [60, 160], lift: 60 },
  dunes: { shape: 0.9, sea: [0, 0.1], peaks: [20, 60], lift: 40 },
  craters: { shape: 1.0, sea: [0, 0.1], peaks: [80, 140], lift: 60 },
  ridges: { shape: 1.1, sea: [0, 0.3], peaks: [600, 850], lift: 200 },
  plateaus: { shape: 1.0, sea: [0, 0.3], peaks: [80, 200], lift: 0 },
};

// metres a unit of shape sinks under the shore on a planet with water, at
// the shore; deeper down, every basin, wet or dry, eases onto a floor DEEP
// metres down (tanh: steady at the shore, never past the floor), so a
// continent's sea stays inside the flight's −200 m. The ease keeps the sign,
// so the share under 0 is still `sea`.
const WET = 420;
const DEEP = 180;
const sink = (h) => DEEP * Math.tanh(h / DEEP);

// frozen: every planet's shore is measured on it
const GOLDEN = 180 * (3 - Math.sqrt(5)); // the golden angle, in degrees
export const FIB_512 = Object.freeze(
  Array.from({ length: 512 }, (_, i) => Object.freeze(dirOfLatLon((Math.asin(1 - (2 * i + 1) / 512) * 180) / Math.PI, ((i * GOLDEN) % 360) - 180))),
);

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// noise3For read 0…1
const ridged = (s, frequency, octaves, gain = 0.5) => {
  const n = noise3For(s, { frequency, octaves, gain, fractal: 'ridged' });
  return (x, y, z) => (n(x, y, z) + 1) / 2;
};
const fbm = (s, frequency, octaves) => {
  const n = noise3For(s, { frequency, octaves });
  return (x, y, z) => (n(x, y, z) + 1) / 2;
};

// a crater by its distance d from the cell's point, in cells: the bowl's
// floor at −1, rising to a rim of 0.3 at 0.6 that fades out past it. The
// bowl climbs all the way to the rim: one that stopped at 0 under a rim
// starting at 0.3 would be a cliff 0.3 × peaks high (75 m at 250 m peaks,
// over the flight's 60 m in 4 m).
const bowl = (d) => (d < 0.6 ? -1 + 1.3 * (d / 0.6) ** 2 : 0.3 * Math.exp(-(((d - 0.6) / 0.12) ** 2)));

// each layer's own noises, seeded apart from the shape, and the metres it
// adds at p: (x, y, z, land, peaks, shape, s0) → metres
const A = 0x68e31da4;
const B = 0x1b56c4e9;
const LAYERS = {
  continents: (s) => {
    const r = ridged(s ^ A, 1 / 2600, 5);
    return (x, y, z, land, peaks) => r(x, y, z) * peaks * land * land;
  },
  archipelago: (s) => {
    const r = ridged(s ^ A, 1 / 1400, 4);
    return (x, y, z, land, peaks) => r(x, y, z) * peaks * land * land;
  },
  canyons: (s) => {
    const n = fbm(s ^ A, 1 / 3200, 3);
    return (x, y, z, land, peaks) => land * (0.5 * peaks - peaks * (1 - Math.abs(2 * n(x, y, z) - 1)) ** 8);
  },
  mesas: (s) => {
    const n = fbm(s ^ A, 1 / 1800, 4);
    return (x, y, z, land, peaks) => land * peaks * smoothstep(0.55, 0.6, n(x, y, z));
  },
  dunes: (s) => {
    // squeezed along the planet's axis, so the crests run east–west
    const crest = ridged(s ^ A, 1 / 300, 3, 0.45);
    const field = fbm(s ^ B, 1 / 1800, 2);
    return (x, y, z, land, peaks) => land * peaks * crest(x, 2.6 * y, z) ** 1.6 * (0.35 + 0.65 * smoothstep(0.3, 0.7, field(x, y, z)));
  },
  craters: (s) => {
    const big = cells3For(s ^ A, { frequency: 1 / 3500 });
    const small = cells3For(s ^ B, { frequency: 1 / 900 });
    return (x, y, z, land, peaks) => land * peaks * (bowl(big(x, y, z)) + 0.3 * bowl(small(x, y, z)));
  },
  ridges: (s) => {
    const r = ridged(s ^ A, 1 / 1600, 5);
    return (x, y, z, land, peaks) => land * r(x, y, z) * peaks;
  },
  // three steps of shape past the shore, each a 0.03-wide scarp
  plateaus: () => (x, y, z, land, peaks, shape, s0) => {
    let steps = 0;
    for (let k = 1; k <= 3; k++) steps += smoothstep(s0 + 0.12 * k, s0 + 0.12 * k + 0.03, shape);
    return peaks * steps;
  },
};

// A kind's noises and its shape over FIB_512, sorted, by seed: building a
// FastNoiseLite allocates its tables, and a bake asks one planet's ground
// many times. A few dozen planets' worth is plenty.
const BUILT = new Map();
function builtFor(kind, seed) {
  const s = fold(seed);
  const key = `${kind} ${s}`;
  let b = BUILT.get(key);
  if (!b) {
    const shape = noise3For(s, { frequency: TERRAIN[kind].shape, octaves: 5 });
    b = { shape, sorted: Float64Array.from(FIB_512, (d) => shape(d[0], d[1], d[2])).sort(), layer: LAYERS[kind](s) };
    if (BUILT.size >= 32) BUILT.delete(BUILT.keys().next().value);
    BUILT.set(key, b);
  }
  return b;
}

// the q quantile, read between the two samples either side of it
function quantile(sorted, q) {
  const at = Math.min(1, Math.max(0, q)) * (sorted.length - 1);
  const i = Math.floor(at);
  return i + 1 < sorted.length ? sorted[i] + (sorted[i + 1] - sorted[i]) * (at - i) : sorted[i];
}

export function groundOf({ kind, sea, peaks, wet = false }, seed, radius) {
  if (!Object.hasOwn(TERRAIN, kind)) throw new Error(`No terrain character ${kind}.`);
  const t = TERRAIN[kind];
  const b = builtFor(kind, seed);
  const s0 = quantile(b.sorted, sea);
  const under = wet ? WET : t.lift;
  return (dir) => {
    const d = unit(dir);
    const shape = b.shape(d[0], d[1], d[2]);
    const land = smoothstep(s0, s0 + 0.12, shape);
    const lift = shape >= s0 ? (shape - s0) * t.lift : sink((shape - s0) * under);
    return { h: lift + b.layer(d[0] * radius, d[1] * radius, d[2] * radius, land, peaks, shape, s0), land };
  };
}
