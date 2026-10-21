// Generated planets as their tests are given them: points on the sphere,
// scattered the same way every run. z = 2r − 1 and an angle round it is
// uniform on the unit sphere (Archimedes: equal heights of a sphere's band
// hold equal areas).
//
// roundSpec is a round planet's spec put together by hand, before anything
// generates one: what sphereField reads, with one POI. Its `sea` and `peaks`
// are the middle of the character's ranges unless asked.
//
// randomSystems makes whole systems of rows as the universe's generator
// gives them (expanse/gen/sector.js): 1–7 planets a system, their types by
// its weights, each radius in its type's range. The ranges are copied here
// as numbers (expanse/gen/tables.js's PLANET_TYPES), as a fixture of the
// pure layer may not import a component.
//
//   MOONS → two moon rows of 'e:3,-2:1:0' as the generator will give them (rocky, then icy)
//   SHEET_RIDGES → two ridges planets' rows from the contact sheet (scripts/planet-contact-sheet.mjs,
//     tiles 4 and 15), whose landing spot was a flat plane before the first place was chosen for relief
//   randomDirs(n, seed) → n unit [x, y, z] arrays
//   roundSpec({ type = 'rock', kind = 'craters', seed = 7, radius = 20000, sea, peaks }) → spec
//   randomSystems(planets, seed) → [[row…]…], systems until there are `planets` rows,
//     never in the seeded sector (1, 0) or home (0, 0)
//   lookupOf(rows) → (id) → row | null

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

// the generator's rows for e:6,18:2:1 and e:27,-22:14:0, as expanseRow gives them
export const SHEET_RIDGES = [
  { id: 'e:6,18:2:1', name: 'Vouvowom', type: 'rock', seed: '12120064596203740373', radius: 29, moons: 2, rings: false, system: { faction: { id: 'E:6,18:f0' }, traffic: 0.05, hazard: 'storm' } },
  { id: 'e:27,-22:14:0', name: 'Miooo', type: 'ice', seed: '7329199095134414442', radius: 44, moons: 2, rings: false, system: { faction: { id: 'independent' }, traffic: 0.05, hazard: 'storm' } },
];

// [type, weight, radius]: the generator's (expanse/gen/tables.js:25-90)
const TYPES = [
  ['rock', 5, [18, 50]],
  ['ice', 3, [20, 60]],
  ['gas', 3, [80, 140]],
  ['lava', 1.5, [18, 45]],
  ['ocean', 1.5, [30, 70]],
  ['desert', 2, [24, 60]],
  ['forest', 1, [28, 65]],
  ['ringed', 1, [70, 130]],
];
const WEIGHT = TYPES.reduce((s, [, w]) => s + w, 0);

export function randomSystems(planets, seed) {
  const r = seeded(seed);
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const typeOf = () => {
    let x = r() * WEIGHT;
    for (const t of TYPES) if ((x -= t[1]) < 0) return t;
    return TYPES[TYPES.length - 1];
  };
  // 64 bits from two draws, as the generator's seeds are
  const seedOf = () => String((BigInt(Math.floor(r() * 2 ** 32)) << 32n) | BigInt(Math.floor(r() * 2 ** 32)));
  const systems = [];
  const used = new Set();
  let count = 0;
  while (count < planets) {
    const sx = int(-40, 40);
    const sz = int(-40, 40);
    const key = `e:${sx},${sz}:${int(0, 23)}`;
    // (the seeded sector and home are the roster's, and a system is made once)
    if ((sx === 1 && sz === 0) || (sx === 0 && sz === 0) || used.has(key)) continue;
    used.add(key);
    const system = { faction: r() < 0.5 ? { id: 'empire' } : null, traffic: r(), hazard: r() < 0.2 ? 'pirates' : null };
    const n = int(1, 7);
    systems.push(
      Array.from({ length: n }, (_, j) => {
        const [type, , [lo, hi]] = typeOf();
        return { id: `${key}:${j}`, name: `Planet ${count + j}`, type, seed: seedOf(), radius: Math.round(lo + r() * (hi - lo)), moons: int(0, 3), rings: r() < 0.05, system };
      }),
    );
    count += n;
  }
  return systems;
}

export function lookupOf(rows) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return (id) => byId.get(typeof id === 'string' ? id.toLowerCase() : id) ?? null;
}
