// The flight's planets: what a planet id flies over. The fifty are the
// roster of docs/research/2026-10-09-planet-geographies.md, in its order:
// the galaxy's 17 worlds, the Rick and Morty sector's 10, the universe map's
// 10 fandom planets (each written out in ./planetTables.js: its biomes,
// POIs, pits, palette, clutter, and `step` or `soft` where it has them),
// then 13 of the Expanse's generated planets, each through its type's stacks
// (TYPE_BIOMES, the galaxy's worlds as templates), its own seed and no POIs.
// The Expanse is given, as rows (expanse/flight/planets.js makes them from
// the generator): lib knows no page, and the flight can go without the
// Expanse noticing.
// Scattered islands and craters are placed from the planet's own seed.
//
// Ids are lower case because the shared world's database takes nothing else
// (supabase/migrations' planets check). An Expanse planet or moon is its
// generator id through expanse.js's canonicalId, 'e:sx,sz:i:j' or
// 'e:sx,sz:i:j:k' (a sector off the middle layer writes its height too), and
// every spelling of it is read back as that one.
//
// Only the fifty are built on (the endless universe's spec): a named world
// and the thirteen seeded Expanse planets (SEEDED_EXPANSE) are the roster,
// as they were, with ROSTER_EXTRA's fields beside theirs. Any other planet
// or moon the rows know is made from its family's template for now, and is
// not to be built on.
//
// Pure: no three.js, nothing from a world. An Expanse row is
// { id (lower case), name, type, seed (the generator's bigint, as a string),
// radius, moons (a count), rings, system: { faction, traffic, hazard } }; a
// moon's is { id, name, type: 'rocky' | 'icy', seed, radius?, system, parent
// (its planet's id) }. `expanse` is the rows or a lookup, id → row | null.
//
//   planetsOf(rows) → { id, name, type, seed }[]: the named worlds, then the rows'
//   TYPE_BIOMES[type] → an Expanse planet's biomes
//   TERRAIN_VERSION → the ground's version (what's built is put back on a newer one)
//   ROSTER_EXTRA → the fields a spec gained after the fifty were locked, as the fifty have them
//   planetSpecOf(id, { expanse }) → { id, name, seed, type, climate, biomes, pois, pits,
//     palette, clutter, step, soft, ground, water, fog, landmarks, hero,
//     kind, parent, buildable, round, character, sky, weather, flora, fauna, exotic } | null

import { fold } from './fnl.js';
import { canonicalId, expanseLookup } from './expanse.js';
import { hash64 } from './hash.js';
import { PLANE_CLIMATE, SEEDED_EXPANSE, TYPE_BIOMES, TYPE_LOOK, WORLDS, expand, familyOf } from './planetTables.js';

// The ground's version, for what's built on it (the shared world's
// terrain_version): bumped by hand whenever this file or ./planetTables.js
// changes a planet's ground, so a turret stored on the old ground's height is
// put back on the new one's. planetSpec.test.js hashes the ground and fails
// when it moves without this.
// (2: Naboo's land drawn after the game's Theed, lane E2)
export const TERRAIN_VERSION = 2;

export { TYPE_BIOMES };

// What a spec says beyond the seventeen fields the fifty were locked with
// (planetSpec.test.js's roster): what kind of body it is, whose moon, whether
// it may be built on, and the generated planets' round ground and variety,
// none of which the fifty have.
export const ROSTER_EXTRA = { kind: 'planet', parent: null, buildable: true, round: null, character: null, sky: null, weather: null, flora: null, fauna: null, exotic: null };

// a named world's seed is its own where it has one (Hoth's), else its id hashed
const seedOf = (w) => w.seed ?? fold(hash64('fly', w.id));

// an Expanse row's seed is the generator's, folded as it always was
const expanseSeed = (row) => fold(BigInt(row.seed));

export const planetsOf = (expanse = []) => [
  ...WORLDS.map((w) => ({ id: w.id, name: w.name, type: w.type, seed: seedOf(w) })),
  ...expanse.map((r) => ({ id: r.id, name: r.name, type: r.type, seed: expanseSeed(r) })),
];

const specOf = ({ id, name, type, seed }, w) => ({
  id,
  name,
  seed,
  type,
  climate: PLANE_CLIMATE,
  biomes: expand(w.biomes, seed),
  pois: w.pois ?? [],
  pits: w.pits ?? [],
  palette: w.palette,
  clutter: w.clutter,
  step: w.step ?? 0,
  soft: Boolean(w.soft),
  ground: w.ground ?? null,
  water: w.water ?? null,
  fog: w.fog ?? null,
  landmarks: w.landmarks ?? [],
  hero: w.hero ?? null,
});

const SEEDED = new Set(SEEDED_EXPANSE.map(([id]) => id));
const known = (type) => Object.hasOwn(TYPE_BIOMES, type);

// a type's template: the galaxy world its stacks and its look are taken from
const templateOf = (type) => {
  const look = TYPE_LOOK[type];
  return { biomes: TYPE_BIOMES[type], palette: look.palette, clutter: look.clutter, soft: look.soft, ground: look.ground, water: look.water };
};

export function planetSpecOf(planetId, { expanse = null } = {}) {
  if (typeof planetId !== 'string') return null;
  const named = planetId.toLowerCase();
  const w = WORLDS.find((x) => x.id === named);
  if (w) return { ...specOf({ id: named, name: w.name, type: w.type, seed: seedOf(w) }, w), ...ROSTER_EXTRA };
  const id = canonicalId(planetId);
  const row = id && expanseLookup(expanse)(id);
  if (!row) return null;
  // the thirteen the roster flies, as they always were
  if (SEEDED.has(id)) return known(row.type) ? { ...specOf({ id, name: row.name, type: row.type, seed: expanseSeed(row) }, templateOf(row.type)), ...ROSTER_EXTRA } : null;
  const family = familyOf(row.type);
  if (!known(family)) return null;
  // (a moon's id is its planet's and its own number)
  const moon = id.split(':').length === 5;
  const extra = { ...ROSTER_EXTRA, kind: moon ? 'moon' : 'planet', parent: moon ? id.slice(0, id.lastIndexOf(':')) : null, buildable: false };
  return { ...specOf({ id, name: row.name, type: family, seed: expanseSeed(row) }, templateOf(family)), ...extra };
}
