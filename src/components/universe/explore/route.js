// The hyperdrive's reach into generated space, and the hops a long jump takes.
// Only a generated place (an `E:` id) is held to the range: every hand-made
// place, the neighbourhoods' worlds and both portals among them, is always one
// jump away (the layout session's rule). A target past the range is never
// refused: the trip goes in hops, each at most `range` sectors on, one
// recharge between them. Pure.
//
// isGenerated(id) → boolean
// sectorGap(a, b) → sectors between two [sx, sy, sz] (Chebyshev)
// hyperRoute(from, to, range) → [[sx, sy, sz], …]: the hops, the last `to`
// hopPoint(ship, target, k, n) → [x, y, z]: where hop k of n comes out, that
//   share of the way along the straight line

export const isGenerated = (id) => typeof id === 'string' && id.startsWith('E:');

export const sectorGap = (a, b) => Math.max(...[0, 1, 2].map((i) => Math.abs((a?.[i] ?? 0) - (b?.[i] ?? 0))));

export function hyperRoute(from, to, range) {
  const r = Number.isFinite(range) && range >= 1 ? Math.floor(range) : 1;
  const d = sectorGap(from, to);
  if (d <= r) return [[...to]];
  const n = Math.ceil(d / r);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? [...to] : [0, 1, 2].map((a) => Math.round(from[a] + ((to[a] - from[a]) * (i + 1)) / n))));
}

export const hopPoint = (ship, target, k, n) => [0, 1, 2].map((a) => ship[a] + ((target[a] - ship[a]) * k) / n);
