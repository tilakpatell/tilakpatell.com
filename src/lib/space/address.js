// The universe's address: cubic sectors SECTOR across, sector (sx, sy, sz)
// centred on (sx * SECTOR, sy * SECTOR, sz * SECTOR). Every lane reads sector
// keys and place ids through here, so nobody writes a second parser. The
// middle layer (sy 0) keeps the old two-number form, 'E:sx,sz'. Pure, no
// imports.
//
// SECTOR
// sectorAt(x, y, z) → [sx, sy, sz]; sectorCentre(sx, sy, sz) → [x, y, z]
// sectorKey(sx, sy, sz) → 'E:sx,sz' or 'E:sx,sz,sy'; parseSectorKey(key) → [sx, sy, sz] or null
// parseSpaceId(id) → { sx, sy, sz, key, system?, planet?, moon?, wonder? } or null
// spaceId([sx, sy, sz], ...parts) → 'E:sx,sz:i:j:k' or 'E:sx,sz:w<n>'
// sameSpaceId(a, b) → true when both parse to the same place

export const SECTOR = 120000;

// (+ 0 turns -0 into 0)
export const sectorAt = (x, y, z) => [
  Math.round(x / SECTOR) + 0,
  Math.round(y / SECTOR) + 0,
  Math.round(z / SECTOR) + 0,
];
export const sectorCentre = (sx, sy, sz) => [sx * SECTOR, sy * SECTOR, sz * SECTOR];
export const sectorKey = (sx, sy, sz) =>
  sy === 0 ? `E:${sx},${sz}` : `E:${sx},${sz},${sy}`;

// sx, sz, then an optional sy
const KEY = /^E:(-?\d+),(-?\d+)(?:,(-?\d+))?$/i;
// the same sector, then :system, :system:planet, :system:planet:moon or :w<wonder>
const ID = /^E:(-?\d+),(-?\d+)(?:,(-?\d+))?:(?:w(\d+)|(\d+)(?::(\d+)(?::(\d+))?)?)$/i;

export function parseSectorKey(key) {
  const m = typeof key === "string" && KEY.exec(key);
  return m ? [Number(m[1]) + 0, Number(m[3] ?? 0) + 0, Number(m[2]) + 0] : null;
}

export function parseSpaceId(id) {
  const m = typeof id === "string" && ID.exec(id);
  if (!m) return null;
  const sx = Number(m[1]) + 0;
  const sz = Number(m[2]) + 0;
  const sy = Number(m[3] ?? 0) + 0;
  const out = { sx, sy, sz, key: sectorKey(sx, sy, sz) };
  if (m[4] !== undefined) out.wonder = Number(m[4]);
  if (m[5] !== undefined) out.system = Number(m[5]);
  if (m[6] !== undefined) out.planet = Number(m[6]);
  if (m[7] !== undefined) out.moon = Number(m[7]);
  return out;
}

export const spaceId = ([sx, sy, sz], ...parts) =>
  [sectorKey(sx, sy, sz), ...parts.map((p) => (typeof p === "object" ? `w${p.wonder}` : p))].join(":");

export function sameSpaceId(a, b) {
  const pa = parseSpaceId(a);
  const pb = parseSpaceId(b);
  if (!pa || !pb) return false;
  return (
    pa.key === pb.key &&
    pa.system === pb.system &&
    pa.planet === pb.planet &&
    pa.moon === pb.moon &&
    pa.wonder === pb.wonder
  );
}
