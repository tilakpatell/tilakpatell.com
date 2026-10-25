// A planet's ground: each biome's layer stack, weighted by where the point
// sits in the climate (biomes.js), summed; then the POIs levelled in last
// (lib/land/flats.js), so inside a POI's r the height is its h exactly,
// whatever the biomes round it do.
//
// A biome's relief is lib/land/layers.js's layers (the shapes the galaxy's
// surfaces and the planets' land share), plus one kind of its own, `fnl`:
// { type: 'fnl', noise: noiseFor's options, height } for the stylised
// planets' warped, ping-pong ground the value noise can't make.
//
// After the POIs, two things a world may have: `pits` ({ at, r, depth }: a
// cone dug into the land, the Pit of Carkoon's kind) and `step` (metres:
// every height snapped to that grid, so the pixel world is terraces).
//
// A round planet (a spec with `round`: a generated one) is none of that.
// Its ground is a field of the direction on its sphere (sphereField.js),
// and the flight's (x, z) is the chart round its landing spot (sphere.js's
// exponential map): (x, z) walks hypot(x, z) metres along the ground that
// way, so 2πR on it comes round to where it began. Its POIs are levelled on
// the sphere, by their `dir`.
//
// Pure: runs in Node and in the flight's terrain worker.
//
//   planetField(spec) → { heightAt(x, z) → metres, biomeAt(x, z) → index of the heaviest }
//   fieldKey(spec) → string: what a field is cached by. A plane's is its id;
//     a round one's is its id and its spot, since one planet landed at two
//     spots is two charts

import { fieldAt } from '../layers.js';
import { flatten } from '../flats.js';
import { biomeWeights } from './biomes.js';
import { noiseFor } from './fnl.js';
import { chartOf } from './sphere.js';
import { sphereField } from './sphereField.js';

export const fieldKey = (spec) => (spec.round ? `${spec.id}@${spec.round.at.join(',')}` : spec.id);

function roundField(spec) {
  const ground = sphereField(spec);
  const { toDir } = chartOf(spec.round.at, spec.round.radius);
  return { heightAt: (x, z) => ground.heightAt(toDir(x, z)), biomeAt: (x, z) => ground.biomeAt(toDir(x, z)) };
}

function stackOf(spec, b, i) {
  const seed = spec.seed + i * 101;
  const own = { seed, base: b.base ?? 0, relief: b.relief.filter((l) => l.type !== 'fnl') };
  const fnl = b.relief.filter((l) => l.type === 'fnl').map((l, k) => ({ n: noiseFor(seed + 7 + k, l.noise), height: l.height }));
  return (x, z) => {
    let h = fieldAt(own, x, z);
    for (const f of fnl) h += f.n(x, z) * f.height;
    return h;
  };
}

export function planetField(spec) {
  if (spec.round) return roundField(spec);
  const stacks = spec.biomes.map((b, i) => stackOf(spec, b, i));
  const raw = (x, z) => {
    const w = biomeWeights(spec, x, z);
    let h = 0;
    for (let i = 0; i < w.length; i++) if (w[i] > 0) h += w[i] * stacks[i](x, z);
    return h;
  };
  const flat = flatten(raw, spec.pois);
  const pits = spec.pits ?? [];
  const dug = !pits.length
    ? flat
    : (x, z) => {
        let h = flat(x, z);
        for (const p of pits) {
          const d = Math.hypot(x - p.at[0], z - p.at[1]);
          if (d < p.r) h -= p.depth * (1 - d / p.r) ** 0.85;
        }
        return h;
      };
  const step = spec.step;
  // (+ 0: a −0 from Math.round(−0.4) is 0)
  const heightAt = step ? (x, z) => Math.round(dug(x, z) / step) * step + 0 : dug;
  const biomeAt = (x, z) => {
    const w = biomeWeights(spec, x, z);
    let best = 0;
    for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
    return best;
  };
  return { heightAt, biomeAt };
}
