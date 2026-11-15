// Which card the page shows for a link to a generated place
// (/universe/E:1,0:0:0). The page never resolves an id itself (that would
// carry the generator onto the site's root): the scene finds it and says so,
// or, with no scene running (3D off, failed or lost), the card says where it
// is and that it's flown to in 3D, so it never waits for ever. Pure.
//
// cardRow(place, found, map) → the row to show, or null:
//   place: the link's canonical id, or null; found: { id, dest } from the
//   scene (dest null for nothing there); map: 'live' | 'loading' | 'flat'.
//   What the scene found for this place, else a flat row with no scene to
//   find it, else a pending row while it looks.

import { parseSpaceId } from '../../../lib/space/address.js';

export function cardRow(place, found, map) {
  if (!place) return null;
  if (found?.id === place) return found.dest ?? null;
  const p = parseSpaceId(place);
  const cube = p ? [p.sx, p.sy, p.sz] : [0, 0, 0];
  return map === 'flat' ? { id: place, generated: true, flat: true, cube } : { id: place, generated: true, pending: true, cube };
}
