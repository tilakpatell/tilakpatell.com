// A round planet's land, by its character: eight recipes of FastNoiseLite's
// 3D noise (./fnl.js) of a direction on the unit sphere, so the ground has no
// seam and wraps. A low "shape" noise of the direction alone splits land
// from sea (or, on a dry world, from its basins) at the quantile the planet
// asks for; a layer of its own, sampled in metres on the sphere, gives each
// kind its mark: continents, archipelago, canyons, mesas, dunes, craters,
// ridges or plateaus.
//
// Pure: runs in Node and in a worker.
//
//   CHARACTERS → the eight kinds
//   TERRAIN[kind] → { shape, sea: [lo, hi], peaks: [lo, hi] (m), lift (m) }
//   FIB_512 → 512 Fibonacci-sphere directions
//   groundOf({ kind, sea, peaks, wet }, seed, radius) → (dir) → { h: metres, land: 0…1 }
//     (wet: a world with water drops its sea floor steeply; dry, its basins as gently as it lifts)

import { cells3For, noise3For } from './fnl.js';

export const CHARACTERS = ['continents', 'archipelago', 'canyons', 'mesas', 'dunes', 'craters', 'ridges', 'plateaus'];

// starting values, tuned by the contact sheet (scripts/planet-contact-sheet.mjs)
export const TERRAIN = {
  continents: { shape: 1.3, sea: [0.35, 0.6], peaks: [300, 900], lift: 260 },
  archipelago: { shape: 3.2, sea: [0.62, 0.8], peaks: [150, 450], lift: 200 },
  canyons: { shape: 1.0, sea: [0, 0.15], peaks: [150, 350], lift: 60 },
  mesas: { shape: 1.0, sea: [0, 0.15], peaks: [60, 160], lift: 60 },
  dunes: { shape: 0.9, sea: [0, 0.1], peaks: [20, 60], lift: 40 },
  craters: { shape: 1.0, sea: [0, 0.1], peaks: [70, 140], lift: 60 },
  ridges: { shape: 1.1, sea: [0, 0.3], peaks: [600, 950], lift: 200 },
  plateaus: { shape: 1.0, sea: [0, 0.3], peaks: [80, 200], lift: 0 },
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
export const FIB_512 = Array.from({ length: 512 }, (_, i) => {
  const y = 1 - ((i + 0.5) / 512) * 2;
  const s = Math.sqrt(1 - y * y);
  return [Math.cos(GOLDEN * i) * s, y, Math.sin(GOLDEN * i) * s];
});

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// a noise of a point in metres, read 0…1
const unitNoise = (seed, opts) => {
  const n = noise3For(seed, opts);
  return (x, y, z) => n(x, y, z) * 0.5 + 0.5;
};

// a crater's profile by the distance to its cell's point (in cells): a bowl
// rising to a rim at 0.6, the rim falling away outside; continuous at 0.6
const bowl = (d) => (d < 0.6 ? 1.3 * (d / 0.6) ** 2 - 1 : 0.3 * Math.exp(-(((d - 0.6) / 0.12) ** 2)));

// each kind's layer, given where the ranges gather (0…1) (the ridged ones at gain 0.4, so their slope falls off with the octave and
// the rock lies along whole flanks, not in a speckle of creases): (x, y, z in metres, land 0…1, shape, s0) → metres
const LAYERS = {
  continents(seed, peaks) {
    const r = unitNoise(seed, { frequency: 1 / 2600, octaves: 5, gain: 0.4, fractal: 'ridged' });
    return (x, y, z, land, shape, s0, range) => r(x, y, z) * peaks * land * land * (0.2 + 0.8 * range);
  },
  archipelago(seed, peaks) {
    const r = unitNoise(seed, { frequency: 1 / 1400, octaves: 4, gain: 0.4, fractal: 'ridged' });
    return (x, y, z, land, shape, s0, range) => r(x, y, z) * peaks * land * land * (0.3 + 0.7 * range);
  },
  canyons(seed, peaks) {
    const f = unitNoise(seed, { frequency: 1 / 3200, octaves: 3 });
    return (x, y, z, land) => land * (0.5 * peaks - peaks * (1 - Math.abs(2 * f(x, y, z) - 1)) ** 8);
  },
  mesas(seed, peaks) {
    const f = unitNoise(seed, { frequency: 1 / 1800, octaves: 4 });
    return (x, y, z, land, shape, s0, range) => land * peaks * smoothstep(0.55, 0.6, f(x, y, z) + 0.12 * (range - 0.5));
  },
  dunes(seed, peaks) {
    const crest = unitNoise(seed, { frequency: 1 / 300, octaves: 3, gain: 0.45, fractal: 'ridged' });
    const f = unitNoise(seed + 1, { frequency: 1 / 1800, octaves: 2 });
    return (x, y, z, land) => land * peaks * crest(x, 2.6 * y, z) ** 1.6 * (0.35 + 0.65 * smoothstep(0.3, 0.7, f(x, y, z)));
  },
  craters(seed, peaks) {
    const big = cells3For(seed, { frequency: 1 / 3500 });
    const small = cells3For(seed + 1, { frequency: 1 / 900 });
    return (x, y, z, land) => land * peaks * (bowl(big(x, y, z)) + 0.3 * bowl(small(x, y, z)));
  },
  ridges(seed, peaks) {
    const r = unitNoise(seed, { frequency: 1 / 1600, octaves: 5, gain: 0.4, fractal: 'ridged' });
    return (x, y, z, land, shape, s0, range) => land * r(x, y, z) * peaks * (0.15 + 0.85 * range);
  },
  plateaus(seed, peaks) {
    return (x, y, z, land, shape, s0) => {
      let h = 0;
      for (let k = 1; k <= 3; k++) h += smoothstep(s0 + 0.12 * k, s0 + 0.12 * k + 0.03, shape);
      return peaks * h;
    };
  },
};

// the shape's value at the asked quantile over the sphere: the measured sea share is the asked one
function thresholdOf(shape, sea) {
  const v = FIB_512.map(([x, y, z]) => shape(x, y, z)).sort((a, b) => a - b);
  if (sea <= 0) return v[0] - 1e-6;
  return v[Math.min(511, Math.floor(sea * 512))];
}

export function groundOf({ kind, sea, peaks, wet = false }, seed, radius) {
  const t = TERRAIN[kind];
  const shape = noise3For(seed, { frequency: t.shape, octaves: 5 });
  const s0 = thresholdOf(shape, sea);
  const layer = LAYERS[kind](seed + 17, peaks);
  // where the mountains gather: a few ranges a planet, so they read as regions from orbit
  const ranges = noise3For(seed + 29, { frequency: 2.6, octaves: 3 });
  const under = wet ? 420 : t.lift;
  return ([x, y, z]) => {
    const s = shape(x, y, z);
    const land = smoothstep(s0, s0 + 0.12, s);
    const lift = (s - s0) * (s >= s0 ? t.lift : under);
    const range = smoothstep(0.38, 0.62, ranges(x, y, z) * 0.5 + 0.5);
    return { h: lift + layer(x * radius, y * radius, z * radius, land, s, s0, range), land };
  };
}
