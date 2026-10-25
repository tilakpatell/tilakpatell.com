// Where on a planet each of its biomes lives. Two low-frequency warped
// noises (temperature t and moisture m, each 0…1) place every point in a
// climate square; a biome sits at a point of that square with a reach, and
// its weight falls off over the outer 40 % of the reach, so two biomes blend
// across a band instead of meeting at a cliff. The weights sum to 1; the
// first biome is the ground between the others, taking whatever weight they
// leave, so a point outside every reach is wholly the first biome's.
//
// Pure: runs in Node and in the flight's terrain worker.
//
//   biomeWeights(spec, x, z) → number[] (one a biome, summing to 1)
//   climateOf(spec) → (x, z) → [t, m] (cached by spec)
//   weightsAt(biomes, t, m) → number[]: the weights at a point of the
//     climate square, however the climate was found (a round planet's is a
//     field of the direction: sphereField.js)

import { noiseFor } from './fnl.js';

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// one pair of noises a spec, not one a call: a leaf asks 1,225 points
const climates = new WeakMap();
export function climateOf(spec) {
  let c = climates.get(spec);
  if (!c) {
    const t = noiseFor(spec.seed, { ...spec.climate, octaves: 3 });
    const m = noiseFor(spec.seed + 1, { ...spec.climate, octaves: 3 });
    c = (x, z) => [t(x, z) * 0.5 + 0.5, m(x, z) * 0.5 + 0.5];
    climates.set(spec, c);
  }
  return c;
}

export function biomeWeights(spec, x, z) {
  const [t, m] = climateOf(spec)(x, z);
  return weightsAt(spec.biomes, t, m);
}

export function weightsAt(biomes, t, m) {
  const w = biomes.map((b) => 1 - smoothstep(b.reach * 0.6, b.reach, Math.hypot(t - b.at[0], m - b.at[1])));
  // The first biome takes what the others leave of 1, so where they fade
  // out it fades in. Normalising alone would make one biome's last sliver
  // of weight a whole 1 at the edge of its reach, and the land would step
  // from its stack to the first's in a metre: a cliff a hundred metres high.
  let sum = 0;
  for (const v of w) sum += v;
  if (sum < 1) {
    w[0] += 1 - sum;
    sum = 1;
  }
  return w.map((v) => v / sum);
}
