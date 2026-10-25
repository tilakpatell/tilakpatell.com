// A generated place's id made into a destination, by the generator: the place
// the id names, its card (cards.js) and where it is at a time. It stores
// nothing: no row is kept, saved or written anywhere, and the card is made
// afresh on every call, which is cheap. The only memory is the generator's
// own, placeOf's last eight sectors. Pure (no React, DOM or three.js).
//
// It looks first among the sectors it's given (a scene's). With build, a
// place outside them makes its whole sector on the calling thread, 45 to 130
// ms, so the scene never passes it: it fetches a sector from the worker pool
// instead. Only the terminal and tests build. It is on the generator's side,
// so a page that loads the nav takes ids.js, never this.
//
// resolvePlace(id, { universe = UNIVERSE, t = spaceTime(Date.now()), sectors
//   = null, build = true } = {}) → Destination | null. sectors is a Map,
//   read by get(key) and then by each sector's own id among its values (lane
//   2's chunk grid keys its cells 'cx,cy,cz'), or any iterable of sectors. A
//   sector found there answers alone: a place it hasn't got isn't there.
//   Null for anything not there, junk included; it never throws.
// lookupOf(opts) → { place(id) → Destination | null }, resolvePlace with
//   those options, in the shape nav.js takes
// Destination: the place's card (cards.js's Card) and { id (canonical),
//   generated: true, place: 'system' | 'planet' | 'moon' | 'station' |
//   'thing' | 'extra' | 'wonder', at: [x, y, z] (at t), t, move (the card's
//   mover, or null), moving (a planet, a moon or a mover), sector: 'main' (no
//   generated place is in the Curve), key (its sector's key), cube: [sx, sy,
//   sz], to: null, src: { row, system, planet } (the generator's rows, shared
//   with its cache: read them, never write them) }

import { parseSpaceId } from '../../../lib/space/address.js';
import { UNIVERSE, placeIn, placeOf, spaceTime } from '../../expanse/shared/gen';
import { placeCard } from './cards';
import { atTime, canonicalPlace } from './ids';

function sectorIn(sectors, key) {
  if (!sectors) return null;
  const hit = typeof sectors.get === 'function' ? sectors.get(key) : null;
  if (hit) return hit;
  const list = typeof sectors.values === 'function' ? sectors.values() : sectors;
  if (typeof list?.[Symbol.iterator] !== 'function') return null;
  for (const s of list) if (s?.id === key) return s;
  return null;
}

export function resolvePlace(id, { universe = UNIVERSE, t = spaceTime(Date.now()), sectors = null, build = true } = {}) {
  const canon = canonicalPlace(id);
  if (!canon) return null;
  const p = parseSpaceId(canon);
  const sector = sectorIn(sectors, p.key);
  const found = sector ? placeIn(sector, p) : build ? placeOf(universe, canon) : null;
  if (!found) return null;
  const systems = found.sector.systems;
  const system = found.kind === 'station' ? systems[found.row.i] : p.system !== undefined ? systems[p.system] : null;
  const planet = p.moon !== undefined ? system?.planets[p.planet] : null;
  const card = placeCard({ ...found, system, planet });
  if (!card) return null;
  // (the card first, so nothing of it can stand in for the place's own fields;
  // its mover is `move`, and `at` is set from it after)
  const dest = {
    ...card,
    id: canon,
    generated: true,
    place: found.kind,
    t,
    move: card.move ?? null,
    sector: 'main',
    key: p.key,
    cube: [p.sx, p.sy, p.sz],
    to: null,
    src: { row: found.row, system: system ?? null, planet: planet ?? null },
  };
  dest.at = atTime(dest, t);
  dest.moving = found.kind === 'planet' || found.kind === 'moon' || dest.move !== null;
  return dest;
}

export const lookupOf = (opts) => ({ place: (id) => resolvePlace(id, opts) });
