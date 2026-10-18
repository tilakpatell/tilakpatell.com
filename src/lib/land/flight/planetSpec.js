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
// (supabase/migrations' planets check); an Expanse planet is its sector.js id
// lowered, 'e:sx,sz:i:j', and either case is read back.
//
// Pure: no three.js, nothing from a world. An Expanse row is
// { id (lower case), name, type, seed (the generator's bigint, as a string),
// system: { faction, traffic, hazard } }; `expanse` is the rows or a lookup,
// id → row | null.
//
//   planetsOf(rows) → { id, name, type, seed }[]: the named worlds, then the rows'
//   TYPE_BIOMES[type] → an Expanse planet's biomes
//   TERRAIN_VERSION → the ground's version (what's built is put back on a newer one)
//   ROSTER_EXTRA → the fields a spec has beside the old seventeen, at the fifty's values
//   planetSpecOf(id, { expanse }) → { id, name, seed, type, climate, biomes, pois, pits,
//     palette, clutter, step, soft, ground, water, fog, landmarks, hero, ...ROSTER_EXTRA } | null

import { fold } from './fnl.js';
import { canonicalId, expanseLookup } from './expanse.js';
import { hash64 } from './hash.js';
import { PLANE_CLIMATE, SEEDED_EXPANSE, TYPE_BIOMES, TYPE_LOOK, WORLDS, expand, familyOf } from './planetTables.js';
import { parseSpaceId } from '../../space/address.js';

// The ground's version, for what's built on it (the shared world's
// terrain_version): bumped by hand whenever this file or ./planetTables.js
// changes a planet's ground, so a turret stored on the old ground's height is
// put back on the new one's. planetSpec.test.js hashes the ground and fails
// when it moves without this.
// (2: Naboo's land drawn after the game's Theed, lane E2)
export const TERRAIN_VERSION = 2;

export { TYPE_BIOMES };

// what a spec has beside the old seventeen: the fifty carry these values, and
// a generated planet or moon overrides kind, parent and buildable
export const ROSTER_EXTRA = { kind: 'planet', parent: null, buildable: true, round: null, character: null, sky: null, weather: null, flora: null, fauna: null, exotic: null };

const SEEDED = new Set(SEEDED_EXPANSE.map(([id]) => id));

// a named world's seed is its own where it has one (Hoth's), else its id hashed
const seedOf = (w) => w.seed ?? fold(hash64('fly', w.id));

// an Expanse row's seed is the generator's, folded as it always was
const expanseSeed = (row) => fold(BigInt(row.seed));

export const planetsOf = (expanse = []) => [
  ...WORLDS.map((w) => ({ id: w.id, name: w.name, type: w.type, seed: seedOf(w) })),
  ...expanse.map((r) => ({ id: r.id, name: r.name, type: r.type, seed: expanseSeed(r) })),
];

const specOf = ({ id, name, type, seed }, w, extra = ROSTER_EXTRA) => ({
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
  ...extra,
});

const templateOf = (type) => {
  const look = TYPE_LOOK[type];
  return { biomes: TYPE_BIOMES[type], palette: look.palette, clutter: look.clutter, soft: look.soft, ground: look.ground, water: look.water };
};

export function planetSpecOf(planetId, { expanse = null } = {}) {
  if (typeof planetId !== 'string') return null;
  const named = planetId.toLowerCase();
  const w = WORLDS.find((x) => x.id === named);
  if (w) return specOf({ id: named, name: w.name, type: w.type, seed: seedOf(w) }, w);
  const id = canonicalId(planetId);
  if (!id) return null;
  const p = expanseLookup(expanse)(id);
  if (!p) return null;
  // the thirteen are the roster: their old template spec, buildable
  if (SEEDED.has(id)) return TYPE_BIOMES[p.type] ? specOf({ id, name: p.name, type: p.type, seed: expanseSeed(p) }, templateOf(p.type)) : null;
  const family = familyOf(p.type);
  if (!TYPE_BIOMES[family]) return null;
  const moon = parseSpaceId(id).moon !== undefined;
  const extra = { ...ROSTER_EXTRA, kind: moon ? 'moon' : 'planet', parent: moon ? (p.parent ?? null) : null, buildable: false };
  return specOf({ id, name: p.name, type: family, seed: expanseSeed(p) }, templateOf(family), extra);
}
