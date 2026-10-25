// A round planet's ground, as functions of the direction on its unit sphere:
// its climate, its biomes, its heights and its places' flats. A generated
// planet's whole ground is this; the flight reads it through the chart round
// the landing spot (sphere.js), and the orbit map is baked from it, so the
// ground seen from orbit is the ground landed on.
//
// The climate is two 3D noises of the direction (CLIMATE_SPHERE), so its
// wavelength is set against the circumference whatever the planet's size;
// the temperature falls off toward the poles. A point of the climate square
// weighs the biomes as a plane planet's does (biomes.js's weightsAt).
//
// The height is the terrain character's land (characters.js), plus each
// biome's base and its hills, weighted, plus a little detail: one hills
// noise, which a biome makes rougher or smoother (planetTables.js's
// ROUND_ROUGH). It's pressed softly into −200…1150 m, inside the flight's
// own −200…1200, past 900 m up and −150 m down. Then the places are levelled
// in last, by flats.js's rule (lib/land/flats.js) with the distance along
// the ground (radius × the angle), each to the land's own height at its
// middle; the flight reads a POI's chart `at`, this its `dir`.
//
// The spec it reads (plain data, so it crosses to a worker):
//   { id, seed: int32, type, biomes: roundBiomes(type), character: { kind, sea, peaks },
//     round: { radius: metres, at: dir }, water: { kind, level, colour? } | null,
//     pois: [{ id, name, kind, dir, at: [x, z], r, edge? }] }
//
// Pure: runs in Node and in a worker.
//
//   CLIMATE_SPHERE = { frequency, octaves, stretch }: the climate's noise of
//     the unit direction, and how far each is stretched about 0.5
//   SLOPE_STEP: metres either way a slope is read over
//   sphereField(spec) → { heightAt(dir) → metres, biomeAt(dir) → index of the heaviest,
//     climateAt(dir) → [t, m], sample(dir) → { h, slope: 0…1 (1 − normal.y), biome } }

import { smoothstep } from '../../noise.js';
import { weightsAt } from './biomes.js';
import { groundOf } from './characters.js';
import { noise3For } from './fnl.js';
import { angleBetween, chartOf, unit } from './sphere.js';

export const CLIMATE_SPHERE = Object.freeze({ frequency: 1.6, octaves: 3, stretch: 1.5 });
export const SLOPE_STEP = 8;

// the hills' and the detail's own salts, off the planet's seed (the
// climate has seed and seed + 1, the land characters.js's salts)
const SALT = { hills: 0x3c6ef372, detail: 0x7f4a7c15 };
const HILLS = 26; // m, at a rough of 1
const DETAIL = 3; // m either way

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// past 900 m up and −150 m down, eased in by a tanh, so the ground never
// passes 1150 or −200 and never creases where the easing starts
const soft = (h) => (h > 900 ? 900 + 250 * Math.tanh((h - 900) / 250) : h < -150 ? -150 - 50 * Math.tanh((-150 - h) / 50) : h);

export function sphereField(spec) {
  const { seed, biomes } = spec;
  const { radius } = spec.round;
  const land = groundOf(spec.character, seed, radius, spec.water);
  const opts = { frequency: CLIMATE_SPHERE.frequency, octaves: CLIMATE_SPHERE.octaves };
  const nt = noise3For(seed, opts);
  const nm = noise3For(seed + 1, opts);
  // a noise read 0…1, then stretched about 0.5 and clamped, so the climate
  // reaches the corners of its square
  const k = CLIMATE_SPHERE.stretch;
  const read = (n) => clamp01(0.5 + n * 0.5 * k);
  const hills = noise3For(seed ^ SALT.hills, { frequency: 1 / 520, octaves: 4 });
  const detail = noise3For(seed ^ SALT.detail, { frequency: 1 / 70, octaves: 3 });

  const climate = (x, y, z) => [0.55 * (1 - Math.abs(y)) + 0.45 * read(nt(x, y, z)), read(nm(x, y, z))];
  const climateAt = (dir) => {
    const [x, y, z] = unit(dir);
    return climate(x, y, z);
  };

  const raw = (dir) => {
    const u = unit(dir);
    const [x, y, z] = u;
    const [t, m] = climate(x, y, z);
    const w = weightsAt(biomes, t, m);
    let base = 0;
    let rough = 0;
    for (let i = 0; i < w.length; i++) {
      base += w[i] * biomes[i].base;
      rough += w[i] * biomes[i].rough;
    }
    // (the hills and the detail in metres of the point, as the land's layers are)
    const px = x * radius;
    const py = y * radius;
    const pz = z * radius;
    const h = land(u).h + base + rough * (hills(px, py, pz) * 0.5 + 0.5) * HILLS + detail(px, py, pz) * DETAIL;
    return soft(h);
  };

  // flats.js's pads, on the sphere
  const pads = (spec.pois ?? []).map((p) => {
    const edge = p.edge ?? Math.max(8, p.r * 0.6);
    return { dir: unit(p.dir), r: p.r, edge, h: raw(p.dir) };
  });
  const heightAt = !pads.length
    ? raw
    : (dir) => {
        const u = unit(dir);
        let h = raw(u);
        for (const p of pads) {
          const d = radius * angleBetween(u, p.dir);
          if (d >= p.r + p.edge) continue;
          h += (p.h - h) * (1 - smoothstep(p.r, p.r + p.edge, d));
        }
        return h;
      };

  const biomeAt = (dir) => {
    const w = weightsAt(biomes, ...climateAt(dir));
    let best = 0;
    for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
    return best;
  };

  // central differences along the ground's own east and north, SLOPE_STEP
  // either way; 1 − 1/hypot(1, g) is groundLook.js's 1 − normal.y
  const sample = (dir) => {
    const u = unit(dir);
    const h = heightAt(u);
    const c = chartOf(u, radius);
    const s = SLOPE_STEP;
    const gx = (heightAt(c.toDir(s, 0)) - heightAt(c.toDir(-s, 0))) / (2 * s);
    const gz = (heightAt(c.toDir(0, s)) - heightAt(c.toDir(0, -s))) / (2 * s);
    return { h, slope: 1 - 1 / Math.hypot(1, gx, gz), biome: biomeAt(u) };
  };

  return { heightAt, biomeAt, climateAt, sample };
}
