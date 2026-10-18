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
// Pure: runs in Node and in the flight's terrain worker.
//
// A round spec (spec.round) is flown as a plane too: (x, z) are metres along
// the sphere from the landing spot, read through the exponential-map chart
// (sphere.js) into sphereField, built once. No step, pits or POI levelling
// here: the orbit map reads the same numbers bit for bit.
//
//   planetField(spec) → { heightAt(x, z) → metres, biomeAt(x, z) → index of the heaviest }
//   fieldKey(spec) → string: what tells two cached fields apart (id, plus the spot on a round planet)

import { fieldAt } from '../layers.js';
import { flatten } from '../flats.js';
import { biomeWeights } from './biomes.js';
import { noiseFor } from './fnl.js';
import { chartOf } from './sphere.js';
import { sphereField } from './sphereField.js';

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

export function fieldKey(spec) {
  return spec.round ? `${spec.id}@${spec.round.at.join(',')}` : spec.id;
}

export function planetField(spec) {
  if (spec.round) {
    const chart = chartOf(spec.round.at, spec.round.radius);
    const sphere = sphereField(spec);
    return {
      heightAt: (x, z) => sphere.heightAt(chart.toDir(x, z)),
      biomeAt: (x, z) => sphere.biomeAt(chart.toDir(x, z)),
    };
  }
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
