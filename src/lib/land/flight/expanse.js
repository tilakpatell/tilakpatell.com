// The Expanse as the flight's pure tables take it: rows, or a lookup from an
// id to a row. Its own file so the life tables need not load the planets'
// (and their noise) to read it.
//
//   expanseLookup(rows | (id) => row | null) → (id) => row | null
//   canonicalId(id) → a planet's or moon's id, lower case, its sector as the
//     space address writes it ('e:sx,sz:i:j[:k]', its height only off the middle
//     layer), or null for anything else (a system, a wonder, junk, a non-string)

import { canonicalId } from '../../space/planetIds.js';

// (canonicalId moved to lib/space/planetIds.js, which the universe reads too)
export { canonicalId };

export const expanseLookup = (expanse) =>
  typeof expanse === 'function' ? expanse : (id) => expanse?.find((r) => r.id === id) ?? null;
