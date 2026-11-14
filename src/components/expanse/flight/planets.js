// The flight's planets, composed: the pure tables (lib/land/flight) given
// the Expanse they fly over. This is the one file of the flight that reads
// the Expanse's generator, so the tables stay pure (lib knows no page) and
// the flight can be lifted out without the Expanse noticing.
//
//   EXPANSE → the thirteen Expanse rows the roster flies, in sector order
//   expanseRow(id) → any Expanse planet's or moon's row, or null (a typed /fly/e:… URL
//     reaches past the thirteen, as it always has; any layer of the space, through
//     the generator's placeOf)
//   moonRowOf(planet, systemRow, k) → the row of a planet's k-th moon (its moonList's), or null
//   PLANETS → the fifty, { id, name, type, seed }
//   planetSpecOf(id) → the planet's spec, or null
//   lifeOf(spec) → what lives on it
//   occurrencesOf(spec), eventsOf(spec) → what is there to find, and what happens

import { makeSector } from '../gen/sector.js';
import { placeOf } from '../gen/space.js';
import { UNIVERSE } from '../gen/seed.js';
import { parseSpaceId } from '../../../lib/space/address.js';
import { canonicalId } from '../../../lib/land/flight/expanse';
import { planetSpecOf as specWith, planetsOf } from '../../../lib/land/flight/planetSpec';
import { lifeFor } from '../../../lib/land/flight/lifeTables';
import { occurrencesFor } from '../../../lib/land/flight/occurrences';
import { eventsFor } from '../../../lib/land/flight/eventTables';

const EXPANSE_COUNT = 13;
// the order the roster takes them in: sectors round home
const SECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]];
// a system as the tables read it: who holds it, how busy, how dangerous
const systemRowOf = (s) => ({ faction: s.faction ? { id: s.faction.id } : null, traffic: s.traffic, hazard: s.hazard ?? null });

// a planet and its system as plain data: what the tables read, and no more
const rowOf = (p, s) => ({
  id: p.id.toLowerCase(),
  name: p.name,
  type: p.type,
  seed: String(p.seed),
  radius: p.radius,
  moons: typeof p.moons === 'number' ? p.moons : (p.moons?.length ?? 0),
  rings: Boolean(p.rings),
  system: systemRowOf(s),
});

export function moonRowOf(p, system, k) {
  const m = p.moonList?.[k];
  if (!m) return null;
  return { id: `${p.id.toLowerCase()}:${k}`, name: m.name, type: m.type, seed: String(m.seed), radius: m.radius, system, parent: p.id.toLowerCase() };
}

export function expanseRow(id) {
  const canon = canonicalId(id);
  if (!canon) return null;
  const a = parseSpaceId(canon);
  const place = placeOf(UNIVERSE, a.moon === undefined ? canon : canon.slice(0, canon.lastIndexOf(':')));
  if (place?.kind !== 'planet') return null;
  const s = place.sector.systems[a.system];
  return a.moon === undefined ? rowOf(place.row, s) : moonRowOf(place.row, systemRowOf(s), a.moon);
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
