// The expanse's grid: square sectors SECTOR across, sector (sx, sz) centred
// on (sx * SECTOR, sz * SECTOR) and reaching SECTOR / 2 each way. Sector
// (0, 0) is the authored map. This is the middle layer (sy 0) of the shared
// address in src/lib/space/address.js, kept in its old two-number shape.
// Pure.
//
// SECTOR
// sectorAt(x, z) → [sx, sz]
// sectorId(sx, sz) → 'E:sx,sz'; parseSector(id) → [sx, sz] or null
// sectorCentre(sx, sz) → [x, 0, z]

import {
  SECTOR,
  sectorAt as addressAt,
  sectorCentre as addressCentre,
  sectorKey,
} from "../../../lib/space/address";

// 120,000 was the universe's spread to six (scale.js's SPREAD); the authored map's edge is written
// from it now, 59,000 out (universe/layout.js), so sector 0,0 reaches past it.
export { SECTOR };

export const sectorAt = (x, z) => {
  const [sx, , sz] = addressAt(x, 0, z);
  return [sx, sz];
};
export const sectorId = (sx, sz) => sectorKey(sx, 0, sz);
// (stricter than the address's parser: two numbers only, an upper-case E)
export function parseSector(id) {
  const m = typeof id === "string" && /^E:(-?\d+),(-?\d+)$/.exec(id);
  return m ? [Number(m[1]) + 0, Number(m[2]) + 0] : null;
}
export const sectorCentre = (sx, sz) => addressCentre(sx, 0, sz);
