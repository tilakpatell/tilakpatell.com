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

// systems of generated planets as the generator would make their rows (its type weights and
// radii, expanse/gen/tables.js), never in the seeded sectors, until there are `planets` rows
const TYPES = { rock: [5, [18, 50]], ice: [3, [20, 60]], gas: [3, [80, 140]], lava: [1.5, [18, 45]], ocean: [1.5, [30, 70]], desert: [2, [24, 60]], forest: [1, [28, 65]], ringed: [1, [70, 130]] };
export function randomSystems(planets, seed) {
  const rnd = seeded(seed);
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const typeOf = () => {
    let r = rnd() * Object.values(TYPES).reduce((a, [w]) => a + w, 0);
    for (const [t, [w]] of Object.entries(TYPES)) if ((r -= w) < 0) return t;
    return 'rock';
  };
  const systems = [];
  const seen = new Set();
  let count = 0;
  while (count < planets) {
    const [sx, sz] = [int(-40, 40), int(-40, 40)];
    if ((sx === 0 || sx === 1) && sz === 0) continue;
    const key = `e:${sx},${sz}:${int(0, 23)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const system = { faction: rnd() < 0.5 ? null : { id: 'empire' }, traffic: rnd(), hazard: rnd() < 0.2 ? 'pirates' : null };
    const rows = Array.from({ length: int(1, 7) }, (_, j) => {
      const type = typeOf();
      const [a, b] = TYPES[type][1];
      return { id: `${key}:${j}`, name: `P${count + j}`, type, seed: String(BigInt(Math.floor(rnd() * 2 ** 52)) * 4099n + BigInt(j)), radius: Math.round(a + rnd() * (b - a)), moons: int(0, 3), rings: rnd() < 0.05, system };
    });
    count += rows.length;
    systems.push(rows);
  }
  return systems;
}

export const lookupOf = (rows) => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return (id) => byId.get(id) ?? null;
};
