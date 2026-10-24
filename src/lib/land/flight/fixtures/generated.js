// The generated planets' fixtures, for the round ground's tests: directions
// spread evenly over the unit sphere, the same every run, and a round spec
// made by hand.
//
//   randomDirs(n, seed) → [x, y, z][]: uniform on the sphere (z = 2r − 1 and
//     an angle round it, Archimedes' rule), each one a unit array
//   roundSpec({ type = 'rock', kind = 'craters', seed = 7, radius = 20000, sea, peaks }) →
//     the spec sphereField.js reads: its spot at latitude 0, longitude 0, a
//     sea at 0 on an ocean or forest planet, one POI (Ruins) 5° north and 10°
//     east of it; sea and peaks the middle of the character's ranges when
//     left out
import { seeded } from '../../../seeded.js';
import { TERRAIN } from '../characters.js';
import { roundBiomes } from '../planetTables.js';
import { dirOfLatLon, unit } from '../sphere.js';

export function randomDirs(n, seed) {
  const r = seeded(seed);
  return Array.from({ length: n }, () => {
    const z = 2 * r() - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - z * z));
    return unit([s * Math.cos(a), s * Math.sin(a), z]);
  });
}

const mid = ([a, b]) => (a + b) / 2;

export function roundSpec({ type = 'rock', kind = 'craters', seed = 7, radius = 20000, sea, peaks } = {}) {
  const character = { kind, sea: sea ?? mid(TERRAIN[kind].sea), peaks: peaks ?? mid(TERRAIN[kind].peaks) };
  return {
    // every argument in the id, so a worker that caches by it never mixes two up
    id: `round:${type}:${kind}:${seed}:${radius}:${character.sea}:${character.peaks}`,
    seed,
    type,
    biomes: roundBiomes(type),
    character,
    round: { radius, at: dirOfLatLon(0, 0) },
    water: type === 'ocean' || type === 'forest' ? { kind: 'sea', level: 0 } : null,
    pois: [{ id: 'poi-0', name: 'Ruins', kind: 'ruins', dir: dirOfLatLon(5, 10), at: [0, 0], r: 120, edge: 100 }],
  };
}
