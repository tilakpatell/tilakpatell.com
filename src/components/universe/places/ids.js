// A generated place's id, and where the place is at a time. These stand apart
// from the resolver (resolve.js) because a module is never split across
// chunks: anything nav.js took from resolve.js would bring the generator onto
// every page that loads nav.js (the home page's mini-map, ⌘K and the site's
// root). So this file imports only the address and the expanse's light face,
// which import nothing. Pure (no React, DOM or three.js).
//
// isPlaceId(id) → true when id is a generated place's id in any spelling
//   (e: or E:, a middle-layer sector with or without its ,0), and its numbers
//   read back as they are written
// canonicalPlace(id) → the generator's own form, 'E:sx,sz:i:j:k' or
//   'E:sx,sz,sy:w<n>' (spaceId's), or null
// atTime(place, t) → [x, y, z] (a new array) or null: where a destination or a row
//   round the ship ({ place, src: { row, planet? }, move? }) is at t on the
//   shared clock. A planet is on its orbit, a moon round its planet, a row
//   carrying its card's mover where move(row, t) says, and anything else where
//   its row is (or, with no row, where it is). The mover rides on the row, so
//   this file needs no card.

import { parseSpaceId, spaceId } from '../../../lib/space/address.js';
import { moonAt, orbitAt } from '../../expanse/shared/orbits';

// (a number past what a double holds exactly is written back as another, or
// as Infinity, so its id would name somewhere else or nowhere)
const exact = (...ns) => ns.every((n) => n === undefined || Number.isSafeInteger(n));

export function canonicalPlace(id) {
  const p = parseSpaceId(id);
  if (!p || !exact(p.sx, p.sy, p.sz, p.system, p.planet, p.moon, p.wonder)) return null;
  const parts = p.wonder !== undefined ? [{ wonder: p.wonder }] : [p.system, p.planet, p.moon].filter((n) => n !== undefined);
  return spaceId([p.sx, p.sy, p.sz], ...parts);
}

export const isPlaceId = (id) => canonicalPlace(id) !== null;

export function atTime(place, t) {
  const row = place?.src?.row;
  if (place?.place === 'planet') return orbitAt(row, t);
  if (place?.place === 'moon') return moonAt(row, place.src.planet, t);
  if (typeof place?.move === 'function') return place.move(row, t);
  const at = row?.at ?? place?.at;
  return at ? [at[0], at[1], at[2]] : null;
}
