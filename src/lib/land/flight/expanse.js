// The Expanse as the flight's pure tables take it: rows, or a lookup from an
// id to a row. Its own file so the life tables need not load the planets'
// (and their noise) to read it.
//
//   canonicalId(id) → the lower-case planet or moon id, 'e:sx,sz:i:j[:k]' (a sector off the middle
//     layer keeps its sy), or null for a system, a wonder, junk or a non-string
//   expanseLookup(rows | (id) => row | null) → (id) => row | null

import { parseSpaceId, spaceId } from '../../space/address.js';

// (the shape is checked here, so how lenient address.js is doesn't matter)
const PLACE = /^e:-?\d+,-?\d+(?:,-?\d+)?(?::\d+){2,3}$/i;

export function canonicalId(id) {
  if (typeof id !== 'string' || !PLACE.test(id)) return null;
  const a = parseSpaceId(id);
  if (!a || a.planet === undefined) return null;
  const parts = a.moon === undefined ? [a.system, a.planet] : [a.system, a.planet, a.moon];
  return spaceId([a.sx, a.sy, a.sz], ...parts).toLowerCase();
}

export const expanseLookup = (expanse) =>
  typeof expanse === 'function' ? expanse : (id) => expanse?.find((r) => r.id === id) ?? null;
