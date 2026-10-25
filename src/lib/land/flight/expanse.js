// The Expanse as the flight's pure tables take it: rows, or a lookup from an
// id to a row, and the one spelling of a planet's or a moon's id. Its own
// file so the life tables need not load the planets' (and their noise) to
// read it.
//
// An id is read through the shared address (lib/space/address.js), in either
// case and with its sector's height written or not, and written back lower
// case (the shared world's database takes nothing else) with the middle
// layer's two numbers: 'E:1,0,0:3:2' is 'e:1,0:3:2'. A system, a wonder or
// anything else isn't a planet or a moon, so it has no id here.
//
//   expanseLookup(rows | (id) => row | null) → (id) => row | null
//   canonicalId(id) → 'e:sx,sz[,sy]:i:j[:k]' | null

import { parseSpaceId, spaceId } from '../../space/address.js';

export const expanseLookup = (expanse) =>
  typeof expanse === 'function' ? expanse : (id) => expanse?.find((r) => r.id === id) ?? null;

// a planet's or a moon's id and nothing round it, checked here so how lenient
// the address is never decides what this takes
const PLANET_OR_MOON = /^e:-?\d+,-?\d+(?:,-?\d+)?(?::\d+){2,3}$/i;

export function canonicalId(id) {
  if (typeof id !== 'string' || !PLANET_OR_MOON.test(id)) return null;
  const p = parseSpaceId(id);
  if (!p || p.planet === undefined) return null;
  const parts = [p.system, p.planet, ...(p.moon === undefined ? [] : [p.moon])];
  // (a number too long to write back as itself is no place)
  if (![p.sx, p.sy, p.sz, ...parts].every(Number.isSafeInteger)) return null;
  return spaceId([p.sx, p.sy, p.sz], ...parts).toLowerCase();
}
