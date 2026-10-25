// A round planet's terrain character: the shape of its land and sea, as a
// function of the direction on its unit sphere (3D noise, fnl.js), so the
// ground has no seam and wraps. The eight are the endless universe spec's
// (section E): continents, archipelago, canyons, mesas, dunes, craters,
// ridges and plateaus. The round planet's field lays its biomes' hills over
// this.
//
// One noise of the direction, `shape`, decides land from sea: `s0` is its
// `sea` quantile over FIB_512, so the share under 0 is the share asked. Land
// rises from s0 by `lift` metres a unit of shape; under it the sea floor goes
// down 420 m a unit on a planet with water, or `lift` on a dry one (where
// `sea` is the share of dry basins). Each kind's own layer is added on top,
// in metres of the point (dir × radius), so a crater is as wide on a small
// planet as on a big one.
//
// Within TERRAIN's ranges a dry planet's ground keeps to −190…1150 m and
// never climbs 60 m in 4 m, at 15 and at 60 km (the test holds both); a sea
// floor goes deeper, for the field to press.
//
// Pure: runs in Node and in the flight's terrain worker.
//
//   CHARACTERS: the eight kinds, in the spec's order
//   TERRAIN[kind] → { shape: frequency on the unit sphere, sea: [lo, hi], peaks: [lo, hi] metres, lift: metres }
//   groundOf({ kind, sea, peaks }, seed: int32, radius: metres, water = null) → (dir) → { h: metres, land: 0…1 }
//     water is the spec's (any truthy one is a sea, lava's too)
//   FIB_512: 512 Fibonacci-sphere unit directions, evenly over the sphere

import { cells3For, noise3For } from './fnl.js';
import { unit } from './sphere.js';

export const CHARACTERS = Object.freeze(['continents', 'archipelago', 'canyons', 'mesas', 'dunes', 'craters', 'ridges', 'plateaus']);

// Starting values, to be tuned by eye. The lifts and the craters' and
// ridges' peaks are already lower than first drawn, so the deepest dry basin
// and the highest ridge stay inside the bounds above for any seed.
const row = (shape, sea, peaks, lift) => Object.freeze({ shape, sea: Object.freeze(sea), peaks: Object.freeze(peaks), lift });
export const TERRAIN = Object.freeze({
  continents: row(1.3, [0.35, 0.6], [300, 900], 220),
  archipelago: row(3.2, [0.62, 0.8], [150, 450], 170),
  canyons: row(1.0, [0, 0.15], [150, 350], 60),
  mesas: row(1.0, [0, 0.15], [60, 160], 60),
  dunes: row(0.9, [0, 0.1], [20, 60], 40),
  craters: row(1.0, [0, 0.1], [60, 140], 60),
  ridges: row(1.1, [0, 0.3], [550, 1000], 120),
  plateaus: row(1.0, [0, 0.3], [80, 200], 0),
});

// metres a unit of shape under the sea, on a planet with water
const SEA_FLOOR = 420;
// the shore: land is 0 at s0 and 1 this much shape above it
const SHORE = 0.12;

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
export const FIB_512 = Object.freeze(
  Array.from({ length: 512 }, (_, i) => {
    const y = 1 - (2 * i + 1) / 512;
    const r = Math.sqrt(1 - y * y);
    return Object.freeze(unit([Math.cos(i * GOLDEN) * r, y, Math.sin(i * GOLDEN) * r]));
  }),
);

// each noise its own salt off the planet's seed, so the land's shape never
// runs along another of the planet's noises (its climate's, say)
const SALT = { shape: 0x2545f491, a: 0x68e31da4, b: 0x1b56c4e9 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// a 3D noise read 0…1
const read01 = (seed, opts) => {
  const n = noise3For(seed, opts);
  return (x, y, z) => (n(x, y, z) + 1) / 2;
};

// a crater by the distance to its middle, in cells: a bowl to its rim at
// 0.6, then a raised lip round it. The lip is added to the bowl, so the
// rim is a crease and never a cliff.
const bowl = (d) => (d < 0.6 ? -(1 - (d / 0.6) ** 2) : 0) + 0.3 * Math.exp(-(((d - 0.6) / 0.12) ** 2));

// each kind's layer: (x, y, z) in metres, land 0…1, the shape and s0 → metres
const LAYERS = {
  continents(seed, peaks) {
    const r = read01(seed ^ SALT.a, { fractal: 'ridged', frequency: 1 / 2600, octaves: 5 });
    return (x, y, z, land) => r(x, y, z) * peaks * land * land;
  },
  archipelago(seed, peaks) {
    const r = read01(seed ^ SALT.a, { fractal: 'ridged', frequency: 1 / 1400, octaves: 4 });
    return (x, y, z, land) => r(x, y, z) * peaks * land * land;
  },
  // a high plain at half the peaks, cut by canyons along the noise's zeros
  canyons(seed, peaks) {
    const f = read01(seed ^ SALT.a, { frequency: 1 / 3200, octaves: 3 });
    return (x, y, z, land) => land * (0.5 * peaks - peaks * (1 - Math.abs(2 * f(x, y, z) - 1)) ** 8);
  },
  mesas(seed, peaks) {
    const f = read01(seed ^ SALT.a, { frequency: 1 / 1800, octaves: 4 });
    return (x, y, z, land) => land * peaks * smoothstep(0.55, 0.6, f(x, y, z));
  },
  // crests squeezed along the pole's axis, so they run with the latitude,
  // in fields that come and go
  dunes(seed, peaks) {
    const crest = read01(seed ^ SALT.a, { fractal: 'ridged', frequency: 1 / 300, octaves: 3, gain: 0.45 });
    const field = read01(seed ^ SALT.b, { frequency: 1 / 1800, octaves: 2 });
    return (x, y, z, land) => land * peaks * crest(x, 2.6 * y, z) ** 1.6 * (0.35 + 0.65 * smoothstep(0.3, 0.7, field(x, y, z)));
  },
  craters(seed, peaks) {
    const big = cells3For(seed ^ SALT.a, { frequency: 1 / 3500 });
    const small = cells3For(seed ^ SALT.b, { frequency: 1 / 900 });
    return (x, y, z, land) => land * peaks * (bowl(big(x, y, z)) + 0.3 * bowl(small(x, y, z)));
  },
  ridges(seed, peaks) {
    const r = read01(seed ^ SALT.a, { fractal: 'ridged', frequency: 1 / 1600, octaves: 5 });
    return (x, y, z, land) => land * r(x, y, z) * peaks;
  },
  // three terraces up the shape's own slope, a shore's width apart
  plateaus(seed, peaks, s0) {
    return (x, y, z, land, shape) => {
      let steps = 0;
      for (let k = 1; k <= 3; k++) steps += smoothstep(s0 + SHORE * k, s0 + SHORE * k + 0.03, shape);
      return peaks * steps;
    };
  },
};

// the q quantile of the shape over FIB_512, read between its two neighbours
function quantileOf(shape, q) {
  const v = FIB_512.map(([x, y, z]) => shape(x, y, z)).sort((a, b) => a - b);
  const at = clamp01(q) * (v.length - 1);
  const i = Math.floor(at);
  return i + 1 < v.length ? v[i] + (v[i + 1] - v[i]) * (at - i) : v[i];
}

export function groundOf({ kind, sea, peaks }, seed, radius, water = null) {
  const t = TERRAIN[kind];
  const shape = noise3For(seed ^ SALT.shape, { frequency: t.shape, octaves: 5 });
  const s0 = quantileOf(shape, sea);
  const under = water ? SEA_FLOOR : t.lift;
  const layer = LAYERS[kind](seed, peaks, s0);
  return (dir) => {
    const [dx, dy, dz] = dir;
    const s = shape(dx, dy, dz);
    const land = smoothstep(s0, s0 + SHORE, s);
    const h = (s - s0) * (s >= s0 ? t.lift : under) + layer(dx * radius, dy * radius, dz * radius, land, s);
    return { h, land };
  };
}
