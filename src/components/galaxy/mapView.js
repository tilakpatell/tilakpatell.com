// The galaxy map's zoom and pan (HoloMap.jsx): a view { k, x, y } draws the
// map's square at k times the box, its top-left at (x, y) in fractions of
// the box's side, so the stage's transform is translate(x·100%, y·100%)
// scale(k) from its top-left corner. The square always covers the box: x
// and y stay within 1 − k and 0. Points on the map are in grid squares (a
// system's `pos`); the square is FRAME, the galaxy's whole disc and a margin
// round it, so none of it's cut off at the map's edge: the disc runs past
// the atlas's 21 squares on the east and the north, and the grid past the
// disc on the west.

import { CORE, RIM } from './systems';

const MARGIN = 0.6; // (grid squares round the disc: Kamino's name, past its southern rim, below it)
const r3 = (v) => Math.round(v * 1000) / 1000;
export const FRAME = Object.freeze({ x0: r3(CORE[0] - RIM - MARGIN), z0: r3(CORE[1] - RIM - MARGIN), size: r3(2 * (RIM + MARGIN)) });

export const K_MIN = 1;
export const K_MAX = 4;
export const FIT = Object.freeze({ k: 1, x: 0, y: 0 });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function clampView(v) {
  const k = clamp(v.k, K_MIN, K_MAX);
  return { k, x: clamp(v.x, 1 - k, 0), y: clamp(v.y, 1 - k, 0) };
}

// zoomed by `factor` about the box's point (u, w), which stays where it is
export function zoomAt(v, factor, u, w) {
  const k = clamp(v.k * factor, K_MIN, K_MAX);
  const r = k / v.k;
  return clampView({ k, x: u - (u - v.x) * r, y: w - (w - v.y) * r });
}

export const panBy = (v, du, dw) => clampView({ k: v.k, x: v.x + du, y: v.y + dw });

// where a map point is on the square, as fractions of its side (at the whole map)
export const onSquare = ([px, pz], f = FRAME) => [(px - f.x0) / f.size, (pz - f.z0) / f.size];

// where a map point is in the box, as fractions of its side
export function toBox(v, p, f = FRAME) {
  const [u, w] = onSquare(p, f);
  return [v.x + v.k * u, v.y + v.k * w];
}

// whether a map point is in the box, `pad` in from its edges
export function onView(v, p, { frame = FRAME, pad = 0.04 } = {}) {
  const [u, w] = toBox(v, p, frame);
  return u >= pad && u <= 1 - pad && w >= pad && w <= 1 - pad;
}

// the closest view with every point on it, `margin` units round them, no
// nearer than kMax
export function frameUnits(points, { frame = FRAME, margin = 1.6, kMax = 3 } = {}) {
  if (!points.length) return FIT;
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  const x0 = Math.min(...xs) - margin;
  const x1 = Math.max(...xs) + margin;
  const z0 = Math.min(...zs) - margin;
  const z1 = Math.max(...zs) + margin;
  const k = clamp(frame.size / Math.max(x1 - x0, z1 - z0), K_MIN, Math.min(kMax, K_MAX));
  const [cx, cz] = onSquare([(x0 + x1) / 2, (z0 + z1) / 2], frame);
  return clampView({ k, x: 0.5 - k * cx, y: 0.5 - k * cz });
}

// the view with a map point in the middle of the box, at the zoom it has (or `kMin`, when that's less: a point is only worth
// centring on once there's a view to move); the square still covers the box, so a point near its edge is as near the middle as that
// allows
export function centreOn(v, p, { frame = FRAME, kMin = K_MIN } = {}) {
  const k = clamp(Math.max(v.k, kMin), K_MIN, K_MAX);
  const [u, w] = onSquare(p, frame);
  return clampView({ k, x: 0.5 - k * u, y: 0.5 - k * w });
}
