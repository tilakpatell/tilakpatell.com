// A sector's stars and wonders as specks, the far layer's way
// (universe/farStars.js's slots), and how a wonder looks, as a speck and as
// itself. Pure (no three.js, no DOM), so the sector worker (gen/job.js) makes
// a sector's specks where it makes the sector; sectors.js lends these names
// as it always has.
//
// WONDER: { [kind]: how it looks }; WONDER_SPECK: a wonder's speck's radius,
//   a share of its size (where it's real goes by it: levels.js's realAt)
// starsOf(sector, { wonders = true }) → { at, color, r, count }: its stars,
//   then its wonders (none if wonders is false), `at` from the sector's
//   middle (3 a speck), `color` a hex colour's bytes (3 a speck), `r` a
//   star's radius or a wonder's speck's
// slotOf(sector) → { centre, at, color, r, count, key }: farStars' setSlot's,
//   starsOf's from the sector's middle, keyed by the sector's id

export const WONDER = {
  nebula: { color: '#b48cff' },
  pulsar: { color: '#b8f4ff', r: 0.15 },
  derelict: { color: '#7a808c', r: 0.12, dark: '#2a2d33' },
  rogue: { color: '#6b5a50', r: 0.5, dark: '#1e1a18' },
};
export const WONDER_SPECK = 0.4;

const NONE = [];

// a hex colour's bytes, into `out` at `i`
const bytesInto = (hex, out, i) => {
  const n = parseInt(hex.slice(1), 16);
  out[i] = (n >> 16) & 255;
  out[i + 1] = (n >> 8) & 255;
  out[i + 2] = n & 255;
};

export function starsOf(sector, { wonders = true } = {}) {
  const o = sector.origin;
  const { systems } = sector;
  const ws = wonders ? sector.wonders : NONE;
  const n = systems.length + ws.length;
  const at = new Float32Array(n * 3);
  const color = new Uint8Array(n * 3);
  const r = new Float32Array(n);
  const put = (i, p, hex, size) => {
    at[i * 3] = p[0] - o[0];
    at[i * 3 + 1] = p[1] - o[1];
    at[i * 3 + 2] = p[2] - o[2];
    bytesInto(hex, color, i * 3);
    r[i] = size;
  };
  systems.forEach((s, i) => put(i, s.at, s.star.color, s.star.size));
  ws.forEach((w, j) => put(systems.length + j, w.at, (WONDER[w.kind] ?? WONDER.rogue).color, w.size * WONDER_SPECK));
  return { at, color, r, count: n };
}

export const slotOf = (sector) => ({ centre: [...sector.origin], ...starsOf(sector), key: sector.id });
