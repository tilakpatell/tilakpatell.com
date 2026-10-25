// The flight's planets, composed: the pure tables (lib/land/flight) given
// the Expanse they fly over. This is the one file of the flight that reads
// the Expanse's generator, so the tables stay pure (lib knows no page) and
// the flight can be lifted out without the Expanse noticing.
//
//   EXPANSE → the thirteen Expanse rows the roster flies, in sector order
//   expanseRow(id) → any Expanse planet's or moon's row on the middle layer,
//     or null (a typed /fly/e:… URL reaches past the thirteen, as it always
//     has; every spelling of an id, lib/land/flight/expanse.js's canonicalId,
//     is one row). Another layer is the 3D generator's to answer.
//   moonRowOf(planet, system, k) → the planet's moon k as a row, from the
//     generator's moonList, or null
//   PLANETS → the fifty, { id, name, type, seed }
//   planetSpecOf(id) → the planet's spec, or null
//   lifeOf(spec) → what lives on it
//   occurrencesOf(spec), eventsOf(spec) → what is there to find, and what happens

import { makeSector } from '../gen/sector.js';
import { UNIVERSE } from '../gen/seed.js';
import { moonsOf } from '../gen/systems.js';
import { parseSpaceId } from '../../../lib/space/address.js';
import { canonicalId } from '../../../lib/land/flight/expanse';
import { planetSpecOf as specWith, planetsOf } from '../../../lib/land/flight/planetSpec';
import { lifeFor } from '../../../lib/land/flight/lifeTables';
import { occurrencesFor } from '../../../lib/land/flight/occurrences';
import { eventsFor } from '../../../lib/land/flight/eventTables';

const EXPANSE_COUNT = 13;
// the order the roster takes them in: sectors round home
const SECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]];

// a planet and its system as plain data: what the tables read, and no more
const systemRowOf = (s) => ({ faction: s.faction ? { id: s.faction.id } : null, traffic: s.traffic, hazard: s.hazard ?? null });
const rowOf = (p, s) => ({
  id: p.id.toLowerCase(),
  name: p.name,
  type: p.type,
  seed: String(p.seed),
  radius: p.radius,
  // (a count, or the list a planet with its bodies carries)
  moons: typeof p.moons === 'number' ? p.moons : (p.moons?.length ?? 0),
  rings: Boolean(p.rings),
  system: systemRowOf(s),
});

export function moonRowOf(p, s, k) {
  const m = p.moonList?.[k];
  if (!m) return null;
  const parent = p.id.toLowerCase();
  return { id: `${parent}:${k}`, name: m.name, type: m.type, seed: String(m.seed), radius: m.radius, system: systemRowOf(s), parent };
}

export function expanseRow(id) {
  const c = canonicalId(id);
  const at = c && parseSpaceId(c);
  if (!at || at.sy !== 0) return null;
  const s = makeSector(UNIVERSE, at.sx, at.sz).systems[at.system];
  const p = s?.planets[at.planet];
  if (!p) return null;
  // (the legacy sector's planets carry a count of moons; the generator's moonsOf makes them)
  return at.moon === undefined ? rowOf(p, s) : moonRowOf({ ...p, moonList: moonsOf(p) }, s, at.moon);
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
