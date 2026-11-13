// The Expanse as the flight's pure tables take it: rows, or a lookup from an
// id to a row. Its own file so the life tables need not load the planets'
// (and their noise) to read it.
//
//   expanseLookup(rows | (id) => row | null) → (id) => row | null
//   canonicalId(id) → a planet's or moon's id, lower case, its sector as the
//     space address writes it ('e:sx,sz:i:j[:k]', its height only off the middle
//     layer), or null for anything else (a system, a wonder, junk, a non-string)

import { parseSpaceId, spaceId } from '../../space/address.js';

// checked here first, so how lenient the address's own parser is never decides
const PLANET_OR_MOON = /^e:-?\d+,-?\d+(?:,-?\d+)?(?::\d+){2,3}$/i;

export function canonicalId(id) {
  if (typeof id !== 'string' || !PLANET_OR_MOON.test(id)) return null;
  const p = parseSpaceId(id);
  if (!p || p.planet === undefined) return null;
  const parts = p.moon === undefined ? [p.system, p.planet] : [p.system, p.planet, p.moon];
  return spaceId([p.sx, p.sy, p.sz], ...parts).toLowerCase();
}

export const expanseLookup = (expanse) =>
  typeof expanse === 'function' ? expanse : (id) => expanse?.find((r) => r.id === id) ?? null;
