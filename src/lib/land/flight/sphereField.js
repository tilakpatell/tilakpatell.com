// A round planet's ground, as functions of a direction on its unit sphere:
// its climate (colder toward the poles), the biomes that climate places,
// its height (the character's land, ./characters.js, plus each biome's base
// and roughness, hills and detail) and its places levelled in, as
// lib/land/flats.js levels the plane planets' POIs but measured along the
// sphere. The flight reads it through a chart (./sphere.js chartOf,
// ./field.js); the orbit map bakes it (./orbitMap.js). One field, both.
//
// A round spec: { id, seed: int32, type: family, biomes (roundBiomes),
//   character: { kind, sea, peaks }, round: { radius: metres, at: dir },
//   water: { kind, level, colour? } | null, pois: [{ id, name, kind, dir, at, r, edge }] }
//
// Pure: runs in Node and in a worker.
//
//   CLIMATE_SPHERE → the climate's noise; SLOPE_STEP → metres between slope samples
//   sphereField(spec) → { heightAt(dir), biomeAt(dir), climateAt(dir) → [t, m],
//     sample(dir) → { h, slope (1 − normal.y), biome } } (cached by spec)

import { groundOf } from './characters.js';
import { noise3For } from './fnl.js';
import { weightsAt } from './biomes.js';
import { angleBetween, chartOf } from './sphere.js';

export const CLIMATE_SPHERE = { frequency: 1.6, octaves: 3, stretch: 1.5 };
export const SLOPE_STEP = 8;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// the range pressed into −200…1150, gently
const soft = (h) => {
  if (h > 900) return 900 + 250 * Math.tanh((h - 900) / 250);
  if (h < -150) return -150 - 50 * Math.tanh((-150 - h) / 50);
  return h;
};

const heaviest = (w) => {
  let best = 0;
  for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
  return best;
};

function build(spec) {
  const { seed, biomes, character } = spec;
  const R = spec.round.radius;
  const climate = { ...CLIMATE_SPHERE, ...(spec.climate?.stretch ? spec.climate : {}) };
  const nt = noise3For(seed, { frequency: climate.frequency, octaves: climate.octaves });
  const nm = noise3For(seed + 1, { frequency: climate.frequency, octaves: climate.octaves });
  const stretch = (n) => clamp01(0.5 + n * 0.5 * climate.stretch);
  const climateAt = ([x, y, z]) => [clamp01(0.55 * (1 - Math.abs(y)) + 0.45 * stretch(nt(x, y, z))), stretch(nm(x, y, z))];

  const ground = groundOf({ ...character, wet: Boolean(spec.water) }, seed + 3, R);
  const hills = noise3For(seed + 5, { frequency: 1 / 520, octaves: 4 });
  const detail = noise3For(seed + 6, { frequency: 1 / 70, octaves: 3 });
  const raw = (dir) => {
    const w = weightsAt(biomes, ...climateAt(dir));
    const [x, y, z] = [dir[0] * R, dir[1] * R, dir[2] * R];
    const hl = (hills(x, y, z) * 0.5 + 0.5) * 26;
    let h = ground(dir).h + detail(x, y, z) * 3;
    for (let i = 0; i < w.length; i++) if (w[i] > 0) h += w[i] * (biomes[i].base + biomes[i].rough * hl);
    return h;
  };

  const pads = (spec.pois ?? []).map((p) => {
    const edge = p.edge ?? Math.max(8, p.r * 0.6);
    return { dir: p.dir, r: p.r, edge, reach: (p.r + edge) / R, h: raw(p.dir) };
  });
  const heightAt = (dir) => {
    let h = raw(dir);
    for (const p of pads) {
      // (a cheap test first: the chord is shorter than the arc)
      const dx = dir[0] - p.dir[0], dy = dir[1] - p.dir[1], dz = dir[2] - p.dir[2];
      if (dx * dx + dy * dy + dz * dz >= p.reach * p.reach * 1.0001) continue;
      const d = angleBetween(dir, p.dir) * R;
      if (d >= p.r + p.edge) continue;
      h += (p.h - h) * (1 - smoothstep(p.r, p.r + p.edge, d));
    }
    return soft(h);
  };
  const biomeAt = (dir) => heaviest(weightsAt(biomes, ...climateAt(dir)));
  const sample = (dir) => {
    const h = heightAt(dir);
    const c = chartOf(dir, R);
    const s = SLOPE_STEP;
    const gx = (heightAt(c.toDir(s, 0)) - heightAt(c.toDir(-s, 0))) / (2 * s);
    const gz = (heightAt(c.toDir(0, s)) - heightAt(c.toDir(0, -s))) / (2 * s);
    return { h, slope: 1 - 1 / Math.hypot(1, gx, gz), biome: biomeAt(dir) };
  };
  return { heightAt, biomeAt, climateAt, sample };
}

const fields = new WeakMap();
export function sphereField(spec) {
  let f = fields.get(spec);
  if (!f) fields.set(spec, (f = build(spec)));
  return f;
}
