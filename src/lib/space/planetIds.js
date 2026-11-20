// A planet's or moon's id as the flight and the universe's looks both key it:
// lower case, its sector as the space address writes it. Pure.
//
//   canonicalId(id) → 'e:sx,sz:i:j[:k]' (its height only off the middle layer), or null for
//     anything else (a system, a wonder, junk, a non-string)

import { parseSpaceId, spaceId } from './address.js';

// checked here first, so how lenient the address's own parser is never decides
const PLANET_OR_MOON = /^e:-?\d+,-?\d+(?:,-?\d+)?(?::\d+){2,3}$/i;

export function canonicalId(id) {
  if (typeof id !== 'string' || !PLANET_OR_MOON.test(id)) return null;
  const p = parseSpaceId(id);
  if (!p || p.planet === undefined) return null;
  const parts = p.moon === undefined ? [p.system, p.planet] : [p.system, p.planet, p.moon];
  return spaceId([p.sx, p.sy, p.sz], ...parts).toLowerCase();
}
