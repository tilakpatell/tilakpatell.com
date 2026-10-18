// Middle-earth's map, as data: what the drawn map (./Map.jsx) and the painted
// one behind the page (./mapPaint.js) both draw from. Everything is placed on
// an 800×560 sheet, projected from Tolkien's geography (./sheet.js reads
// ./geography.js); the helpers here turn it into peaks and trees.

export { SHEET, PLACES, REGIONS, SEAS, RIVERS, RANGES, FORESTS, MARSHES, LAKES, ROADS, nameAt, stopNameAt } from './sheet';

// The little peaks along a range: [x, y, size]. A range is a polyline
// [[x, y], …]; the old straight form (x0, y0, x1, y1) is a one-segment
// polyline. Each segment is spaced as a straight range always was, and a
// joint is not doubled.
export function peaks(points, ...rest) {
  if (typeof points === 'number') {
    const [y0, x1, y1, ...more] = rest;
    return peaks([[points, y0], [x1, y1]], ...more);
  }
  const [every = 13, size = 9] = rest;
  const out = [];
  for (let s = 1; s < points.length; s++) {
    const [x0, y0] = points[s - 1];
    const [x1, y1] = points[s];
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / every));
    for (let i = s === 1 ? 0 : 1; i <= n; i++) out.push([x0 + ((x1 - x0) * i) / n + (out.length % 2 ? 3 : -3), y0 + ((y1 - y0) * i) / n, size]);
  }
  return out;
}

// a run of little peaks along a range, as a path
export function range(points, ...rest) {
  const all = peaks(points, ...rest);
  const size = all[0]?.[2] ?? 9;
  return all.map(([x, y]) => `M${x - size / 2} ${y + size / 3} L${x} ${y - size / 2} L${x + size / 2} ${y + size / 3} `).join('');
}

// a patch of trees in an ellipse: [x, y, r]
export function wood(cx, cy, rx, ry, seed, count = 40) {
  let s = seed;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    return [cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 3 + r() * 2.5];
  });
}

const inside = (pts, x, y) => {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

// the trees of a forest (./sheet.js's FORESTS): an ellipse { at, rx, ry } as
// wood() places them, or a polygon { points } filled the same way, each tree
// drawn from the same seeded run so the wood is the same on every painter
export function trees(shape, seed, count) {
  if (!shape.points) return wood(shape.at[0], shape.at[1], shape.rx, shape.ry, seed, count);
  const xs = shape.points.map((p) => p[0]);
  const ys = shape.points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let s = seed;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 20; tries++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    const size = 3 + r() * 2.5;
    if (inside(shape.points, x, y)) out.push([x, y, size]);
  }
  return out;
}

// a marsh's hatching: short level strokes across its ellipse, [x0, y, x1]
export function hatch({ at, rx, ry }) {
  const out = [];
  for (let y = -ry + 1.5; y < ry; y += 2.6) {
    const half = rx * Math.sqrt(1 - (y / ry) ** 2);
    for (let x = -half + (((y * 3.7) % 3) + 3) % 3; x < half - 2.6; x += 5) out.push([at[0] + x, at[1] + y, at[0] + x + 2.6]);
  }
  return out;
}
