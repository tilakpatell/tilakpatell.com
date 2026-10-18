// Generated planets as their tests are given them: points on the sphere,
// scattered the same way every run. z = 2r − 1 and an angle round it is
// uniform on the unit sphere (Archimedes: equal heights of a sphere's band
// hold equal areas).
//
// roundSpec is a round planet's spec put together by hand, before anything
// generates one: what sphereField reads, with one POI. Its `sea` and `peaks`
// are the middle of the character's ranges unless asked.
//
//   MOONS → two moon rows of 'e:3,-2:1:0' as the generator will give them (rocky, then icy)
//   randomDirs(n, seed) → n unit [x, y, z] arrays
//   roundSpec({ type = 'rock', kind = 'craters', seed = 7, radius = 20000, sea, peaks }) → spec

import { seeded } from '../../../seeded.js';
import { TERRAIN } from '../characters.js';
import { roundBiomes } from '../planetTables.js';
import { dirOfLatLon } from '../sphere.js';

export function randomDirs(n, seed) {
  const r = seeded(seed);
  return Array.from({ length: n }, () => {
    const z = 2 * r() - 1;
    const a = 2 * Math.PI * r();
    const s = Math.sqrt(1 - z * z);
    return [s * Math.cos(a), s * Math.sin(a), z];
  });
}

const mid = ([a, b]) => (a + b) / 2;

export function roundSpec({ type = 'rock', kind = 'craters', seed = 7, radius = 20000, sea, peaks } = {}) {
  return {
    id: `round-${type}-${kind}-${seed}`,
    seed,
    type,
    biomes: roundBiomes(type),
    character: { kind, sea: sea ?? mid(TERRAIN[kind].sea), peaks: peaks ?? mid(TERRAIN[kind].peaks) },
    round: { radius, at: dirOfLatLon(0, 0) },
    water: type === 'ocean' || type === 'forest' ? { kind: 'sea', level: 0 } : null,
    // (its `at` is the chart's business, and sphereField doesn't read it)
    pois: [{ id: 'poi-0', name: 'Ruins', kind: 'ruins', dir: dirOfLatLon(5, 10), at: [0, 0], r: 120, edge: 100 }],
  };
}

const SYSTEM = { faction: null, traffic: 0.2, hazard: null };
export const MOONS = [
  { id: 'e:3,-2:1:0:0', name: 'Ostra I', type: 'rocky', seed: '12345', system: SYSTEM, parent: 'e:3,-2:1:0' },
  { id: 'e:3,-2:1:0:1', name: 'Ostra II', type: 'icy', seed: '67890', system: SYSTEM, parent: 'e:3,-2:1:0' },
];
