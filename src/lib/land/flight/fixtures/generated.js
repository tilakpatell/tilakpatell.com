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
//   MOONS → two moon rows of one planet, 'e:3,-2:1:0': moon 0 rocky, moon 1
//     icy, as expanse/flight/planets.js's moonRowOf makes them from the
//     generator's moons (the second with no radius, which a row may leave out)
//   randomSystems(planets, seed) → row[][]: systems, each its planets' rows
//     as expanse/flight/planets.js's rowOf makes them, until there are at
//     least `planets` rows. A system is in a sector with x and z in −40…40,
//     never (0, 0) nor (1, 0) (the seeded one), at an index 0–23 and no two
//     alike; it has 1–7 planets, 0…n−1, their types drawn with the
//     generator's weights and their radii in its ranges
//     (expanse/gen/tables.js's PLANET_TYPES), 0–3 moons, rings one time in
//     twenty, and a system held by a faction or not, with pirates or not
//   lookupOf(rows) → (id) → row | null
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

// the generator's types: their weights and radii (expanse/gen/tables.js's
// PLANET_TYPES), copied so lib needn't reach up into a world for them
const TYPES = [
  ['rock', 5, [18, 50]], ['ice', 3, [20, 60]], ['gas', 3, [80, 140]], ['lava', 1.5, [18, 45]],
  ['ocean', 1.5, [30, 70]], ['desert', 2, [24, 60]], ['forest', 1, [28, 65]], ['ringed', 1, [70, 130]],
];
const TOTAL = TYPES.reduce((a, [, w]) => a + w, 0);
const typeOf = (r) => {
  let x = r() * TOTAL;
  for (const t of TYPES) if ((x -= t[1]) < 0) return t;
  return TYPES[TYPES.length - 1];
};
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
// a 64-bit seed, written as the generator's bigint is
const seed64 = (r) => String((BigInt(Math.floor(r() * 2 ** 32)) << 32n) | BigInt(Math.floor(r() * 2 ** 32)));

export function randomSystems(planets, seed) {
  const r = seeded(seed);
  const systems = [];
  const used = new Set();
  let count = 0;
  while (count < planets) {
    const sx = int(r, -40, 40);
    const sz = int(r, -40, 40);
    const key = `e:${sx},${sz}:${int(r, 0, 23)}`;
    if ((sz === 0 && (sx === 0 || sx === 1)) || used.has(key)) continue;
    used.add(key);
    const system = { faction: r() < 0.5 ? { id: 'empire' } : null, traffic: r(), hazard: r() < 0.25 ? 'pirates' : null };
    const rows = Array.from({ length: int(r, 1, 7) }, (_, j) => {
      const [type, , [lo, hi]] = typeOf(r);
      return { id: `${key}:${j}`, name: `P${count + j}`, type, seed: seed64(r), radius: int(r, lo, hi), moons: int(r, 0, 3), rings: r() < 0.05, system: { ...system, faction: system.faction && { ...system.faction } } };
    });
    systems.push(rows);
    count += rows.length;
  }
  return systems;
}

export function lookupOf(rows) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return (id) => byId.get(id) ?? null;
}

const MOON_SYSTEM = () => ({ faction: null, traffic: 0.2, hazard: null });
export const MOONS = [
  { id: 'e:3,-2:1:0:0', name: 'Ostra I', type: 'rocky', seed: '11400714819323198485', radius: 9.5, system: MOON_SYSTEM(), parent: 'e:3,-2:1:0' },
  { id: 'e:3,-2:1:0:1', name: 'Ostra II', type: 'icy', seed: '7046029254386353131', system: MOON_SYSTEM(), parent: 'e:3,-2:1:0' },
];
