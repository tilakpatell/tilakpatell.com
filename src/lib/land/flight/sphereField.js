// A generated planet's round ground: its climate, biomes, heights and POI
// flats, each a function of a unit direction on its sphere, so nothing has a
// seam, a pole or an edge. The flight reads it through a chart round the
// landing spot (field.js) and the orbit map bakes it texel by texel.
//
// - Climate. Two 3D noises of the direction (CLIMATE_SPHERE), each read 0…1
//   and stretched about 0.5 so the planet reaches the corners of the climate
//   square. Temperature leans on the latitude too: 0.55 of it is how far
//   from a pole the point is, so the poles are cold whatever the noise does.
// - Biomes. biomes.js's weightsAt at that climate; each biome keeps its base
//   height and scales one hilly noise by its `rough` (planetTables.js's
//   ROUND_ROUGH), in place of its plane relief.
// - Height. The character's ground (characters.js's groundOf), the weighted
//   biomes and a few metres of detail, pressed softly into −200…1150 m.
// - POI flats. flats.js's rule on the sphere, the distance a great circle's:
//   inside r a POI is its level exactly (the raw height at its direction),
//   eased back to the land over its edge.
//
// sample(dir) reads the slope as the flight's chart does, the four heights
// SLOPE_STEP m either way along chartOf(dir, radius)'s x and z, in the same
// order, so the orbit map's texel and the flight's ground agree to the bit.
//
// The noises are built once a call of sphereField: the terrain worker and
// the orbit map's bake ask one field for millions of heights.
//
// Pure: runs in Node and in a worker.
//
//   CLIMATE_SPHERE = { frequency, octaves, stretch }
//   SLOPE_STEP: metres either side of a point its slope is read over
//   sphereField(spec) → {
//     heightAt(dir) → metres, biomeAt(dir) → index of the heaviest biome,
//     climateAt(dir) → [t, m] (each 0…1), sample(dir) → { h, slope: 0…1, biome } }

import { weightsAt } from './biomes.js';
import { groundOf } from './characters.js';
import { noise3For } from './fnl.js';
import { angleBetween, chartOf, unit } from './sphere.js';

// frequency is in cycles across the unit sphere, so a climate band is the
// same share of any planet's circumference
export const CLIMATE_SPHERE = { frequency: 1.6, octaves: 3, stretch: 1.5 };
export const SLOPE_STEP = 8;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// the range pressed into −200…1150 m: untouched between −150 and 900, eased
// (tanh: steady where it starts, never past its bound) beyond
const soft = (h) => {
  if (h > 900) return 900 + 250 * Math.tanh((h - 900) / 250);
  if (h < -150) return -150 - 50 * Math.tanh((-150 - h) / 50);
  return h;
};

// the hills' and the detail's own noises, seeded apart from the climate's
const HILLS = 0x2c1b3c6d;
const DETAIL = 0x297a2d39;

export function sphereField(spec) {
  const R = spec.round.radius;
  const biomes = spec.biomes;
  const base = biomes.map((b) => b.base ?? 0);
  const rough = biomes.map((b) => b.rough ?? 1);
  const ground = groundOf({ ...spec.character, wet: Boolean(spec.water) }, spec.seed, R);

  const { frequency, octaves, stretch } = CLIMATE_SPHERE;
  const nt = noise3For(spec.seed, { frequency, octaves });
  const nm = noise3For(spec.seed + 1, { frequency, octaves });
  // read 0…1, then stretched about 0.5: 0.5 + (0.5n + 0.5 − 0.5)·stretch
  const stretched = (n) => clamp01(0.5 + 0.5 * n * stretch);
  const climate = (d) => [0.55 * (1 - Math.abs(d[1])) + 0.45 * stretched(nt(d[0], d[1], d[2])), stretched(nm(d[0], d[1], d[2]))];

  // in metres at p = dir × radius: hills 0…26 m before a biome's roughness,
  // detail ±3 m (fbm read 0…1 is (n + 1)/2, so 2·fbm − 1 is n)
  const hills = noise3For(spec.seed ^ HILLS, { frequency: 1 / 520, octaves: 4 });
  const detail = noise3For(spec.seed ^ DETAIL, { frequency: 1 / 70, octaves: 3 });

  const raw = (d) => {
    const w = weightsAt(biomes, ...climate(d));
    let b = 0;
    let r = 0;
    for (let i = 0; i < w.length; i++) {
      b += w[i] * base[i];
      r += w[i] * rough[i];
    }
    const x = d[0] * R;
    const y = d[1] * R;
    const z = d[2] * R;
    return soft(ground(d).h + b + r * ((hills(x, y, z) + 1) / 2) * 26 + detail(x, y, z) * 3);
  };

  // each POI's pad, as flats.js makes it; `cos` is a cheap first test (the
  // dot product) for a point well out of its reach, a thousandth wider than
  // the reach so it never skips a point the rule would touch
  const pads = (spec.pois ?? []).map((p) => {
    const dir = unit(p.dir);
    const edge = p.edge ?? Math.max(8, p.r * 0.6);
    const reach = p.r + edge;
    return { dir, r: p.r, edge, reach, cos: Math.cos(Math.min(Math.PI, (reach / R) * 1.001)), h: p.h ?? raw(dir) };
  });

  const heightAt = (dir) => {
    const d = unit(dir);
    let h = raw(d);
    for (const p of pads) {
      if (d[0] * p.dir[0] + d[1] * p.dir[1] + d[2] * p.dir[2] <= p.cos) continue;
      const at = R * angleBetween(d, p.dir);
      if (at >= p.reach) continue;
      const w = 1 - smoothstep(p.r, p.reach, at);
      h += (p.h - h) * w;
    }
    return h;
  };

  const climateAt = (dir) => climate(unit(dir));

  const biomeAt = (dir) => {
    const w = weightsAt(biomes, ...climateAt(dir));
    let best = 0;
    for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
    return best;
  };

  const sample = (dir) => {
    const c = chartOf(dir, R);
    const at = (x, z) => heightAt(c.toDir(x, z));
    const s = SLOPE_STEP;
    const gx = (at(s, 0) - at(-s, 0)) / (2 * s);
    const gz = (at(0, s) - at(0, -s)) / (2 * s);
    // groundLook.js's 1 − normal.y, the normal of the plane through them
    return { h: heightAt(dir), slope: 1 - 1 / Math.hypot(1, gx, gz), biome: biomeAt(dir) };
  };

  return { heightAt, biomeAt, climateAt, sample };
}
