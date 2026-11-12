// Fixtures for the generated planets' tests: directions spread evenly over
// the sphere, drawn from a seed; a round spec made by hand.
import { seeded } from '../../../seeded.js';
import { TERRAIN } from '../characters.js';
import { CLIMATE_SPHERE } from '../sphereField.js';
import { roundBiomes } from '../planetTables.js';
import { dirOfLatLon } from '../sphere.js';

// uniform on the sphere: z = 2r − 1 and an angle round it (in y-up terms, y)
export function randomDirs(n, seed) {
  const rnd = seeded(seed);
  return Array.from({ length: n }, () => {
    const y = 2 * rnd() - 1;
    const a = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - y * y);
    return [Math.cos(a) * s, y, Math.sin(a) * s];
  });
}

// a round spec by hand, as generated.js would make one: one POI, its chart at (0, 0)
export function roundSpec({ type = 'rock', kind = 'craters', seed = 7, radius = 20000, sea, peaks } = {}) {
  const t = TERRAIN[kind];
  return {
    id: `test:${type}:${kind}`,
    seed,
    type,
    climate: CLIMATE_SPHERE,
    biomes: roundBiomes(type),
    character: { kind, sea: sea ?? (t.sea[0] + t.sea[1]) / 2, peaks: peaks ?? (t.peaks[0] + t.peaks[1]) / 2 },
    round: { radius, at: dirOfLatLon(0, 0) },
    water: type === 'ocean' || type === 'forest' ? { kind: 'sea', level: 0 } : null,
    pois: [{ id: 'poi-0', name: 'Ruins', kind: 'ruins', dir: dirOfLatLon(5, 10), at: [0, 0], r: 120, edge: 100 }],
  };
}

// two moons of one planet, as expanse/flight/planets.js's moonRowOf makes their rows
const MOON_SYSTEM = { faction: null, traffic: 0.2, hazard: null };
export const MOONS = [
  { id: 'e:3,-2:1:0:0', name: 'Zurktar I', type: 'rocky', seed: '9081726354', radius: 6, system: MOON_SYSTEM, parent: 'e:3,-2:1:0' },
  { id: 'e:3,-2:1:0:1', name: 'Zurktar II', type: 'icy', seed: '1928374655', radius: 4, system: MOON_SYSTEM, parent: 'e:3,-2:1:0' },
];
