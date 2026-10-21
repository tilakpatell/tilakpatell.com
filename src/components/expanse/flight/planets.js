// The flight's planets, composed: the pure tables (lib/land/flight) given
// the Expanse they fly over. This is the one file of the flight that reads
// the Expanse's generator, so the tables stay pure (lib knows no page) and
// the flight can be lifted out without the Expanse noticing.
//
//   EXPANSE → the thirteen Expanse rows the roster flies, in sector order
//   moonRowOf(p, s, k) → a moon's row from the planet's moonList, or null
//   expanseRow(id) → any Expanse planet's row, or null (a typed /fly/e:… URL
//     reaches past the thirteen, as it always has; a sector above or below the
//     middle layer resolves through the 3D generator)
//   PLANETS → the fifty, { id, name, type, seed }
//   planetSpecOf(id) → the planet's spec, or null
//   lifeOf(spec) → what lives on it
//   occurrencesOf(spec), eventsOf(spec) → what is there to find, and what happens

import { canonicalId } from '../../../lib/land/flight/expanse';
import { parseSpaceId } from '../../../lib/space/address';
import { makeSector } from '../gen/sector.js';
import { fullSector } from '../gen/space.js';
import { addBodies } from '../gen/systems.js';
import { UNIVERSE } from '../gen/seed.js';
import { planetSpecOf as specWith, planetsOf } from '../../../lib/land/flight/planetSpec';
import { lifeFor } from '../../../lib/land/flight/lifeTables';
import { occurrencesFor } from '../../../lib/land/flight/occurrences';
import { eventsFor } from '../../../lib/land/flight/eventTables';

const EXPANSE_COUNT = 13;
// the order the roster takes them in: sectors round home
const SECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]];

// a planet and its system as plain data: what the tables read, and no more
const systemOf = (s) => ({ faction: s.faction ? { id: s.faction.id } : null, traffic: s.traffic, hazard: s.hazard ?? null });
const rowOf = (p, s) => ({
  id: p.id.toLowerCase(),
  name: p.name,
  type: p.type,
  seed: String(p.seed),
  radius: p.radius,
  moons: typeof p.moons === 'number' ? p.moons : (p.moons?.length ?? 0),
  rings: Boolean(p.rings),
  system: systemOf(s),
});

// a moon from the generator's moon rows (lane 2: `moonList` on the planet)
export function moonRowOf(p, s, k) {
  const m = p.moonList?.[k];
  if (!m) return null;
  const parent = p.id.toLowerCase();
  const row = { id: `${parent}:${k}`, name: m.name, type: m.type, seed: String(m.seed), system: systemOf(s), parent };
  if (m.radius !== undefined) row.radius = m.radius;
  return row;
}

export function expanseRow(id) {
  const c = canonicalId(id);
  const a = c && parseSpaceId(c);
  if (!a) return null;
  // The middle layer keeps today's path (the fixture and the seeded thirteen
  // rest on it; a raw sector's planets have no moon rows, addBodies gives them
  // moonList). The layers above and below are the 3D generator's, which
  // composes that same path and appends its own systems, without the lattice
  // of small things, which no planet row reads.
  const sector = a.sy === 0 ? addBodies(makeSector(UNIVERSE, a.sx, a.sz)) : fullSector(UNIVERSE, a.sx, a.sy, a.sz, { things: false });
  const s = sector.systems[a.system];
  const p = s?.planets[a.planet];
  if (!p) return null;
  return a.moon === undefined ? rowOf(p, s) : moonRowOf(p, s, a.moon);
}

function expanseRows() {
  const rows = [];
  for (const [sx, sz] of SECTORS) {
    for (const s of makeSector(UNIVERSE, sx, sz).systems) for (const p of s.planets) if (rows.length < EXPANSE_COUNT) rows.push(rowOf(p, s));
    if (rows.length >= EXPANSE_COUNT) break;
  }
  return rows;
}

export const EXPANSE = expanseRows();
export const PLANETS = planetsOf(EXPANSE);
export const planetSpecOf = (id) => specWith(id, { expanse: expanseRow });
export const lifeOf = (spec) => lifeFor(spec, { expanse: expanseRow });
export const occurrencesOf = (spec) => occurrencesFor(spec, null, { expanse: expanseRow });
export const eventsOf = (spec) => eventsFor(spec, null, { expanse: expanseRow });
