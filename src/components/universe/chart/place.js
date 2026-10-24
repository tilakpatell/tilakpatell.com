// Marks onto a frame: the one way the nav map and the no-3D mini-map put
// places, the ship and their outlines on a chart. Pure: no React, no DOM, no
// three.js. It reads the view through projection.js, thins the names through
// declutter.js and finds the sectors through the universe's address.
//
// A Mark is what a chart is given to draw:
//   { id, kind, name, at: [x, y, z], priority, color,
//     levels: ['system' | 'neighbourhood' | 'universe', …],
//     shape?: 'dot' | 'cloud' | 'hole' | 'star' | 'portal' | 'sun' | 'pilot' | 'fight',
//     reach?, pickable? }
// An empty name means no label, and an id is unique on its chart. Lane 6b adds
// the generated places, events and pilots as more marks with their own levels,
// through no other door: nothing here changes for them.
//
// labelSize(name, fontPx) → [w, h] in px, the dot and its name together
// placeMarks(view, marks, frame, opts) → Placed[], in the marks' order (the tab order)
//   Placed = { id, mark, x, y, footX, footY, size, side, edge, depth }, in frame units
// placeShip(view, ship, frame) → { x, y, angle, edge }, or null with no ship
// sectorGrid(view, n) → [{ key, points }]; ringOn(view, centre, radius, n) → points
//   (closed outlines, in chart units, for the drawing to put through toFrame)
// fitRange(focus, marks, pad) → range; miniView(marks) → View
// reveal(view, mark) → View, zoomed and moved till the mark is on the chart
//
// A mark the view's level doesn't show, or past the range, is left off,
// unless it is kept (the picked place): a kept mark is always on, pinned to
// the rim when it is off the chart, and its name goes down first. A pinned
// mark has no stem, since its foot is off the chart too. A mark with no number
// for its place is never drawn.

import { SECTOR, sectorAt, sectorCentre, sectorKey } from '../../../lib/space/address';
import { declutter } from './declutter';
import { CHART, createView, levelOf, project, reachOn, toFrame } from './projection';

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const finiteAt = (at) => Array.isArray(at) && finite(at[0]) && finite(at[1]) && finite(at[2]);
const clampRange = (r) => Math.min(CHART.range.max, Math.max(CHART.range.min, r));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const uv = (view, at) => {
  const p = project(view, at);
  return [p.u, p.v];
};

const EDGE = 12; // points along a sector's edge, its corners among them: the scale bends straight lines

// px: a name's letters at about 0.58 of the font's size, then the 16 px dot and its gap
export const labelSize = (name, fontPx) => [name.length * 0.58 * fontPx + 22, Math.max(24, 1.6 * fontPx)];

// the box the names must stay in, in px: a round frame is cut to the biggest
// circle round its middle (the nav map's chart clips the rest)
function boundsOf(frame, scale) {
  const { w, h, cx, cy } = frame;
  if (frame.shape === 'circle') return { cx: cx * scale, cy: cy * scale, r: Math.min(cx, cy, w - cx, h - cy) * scale };
  return { x0: 0, y0: 0, x1: w * scale, y1: h * scale };
}

export function placeMarks(view, marks, frame, opts = {}) {
  const { level = levelOf(view.range), keep = [], fontPx = 11, scale = 1, sides, avoid = [], levels = true } = opts;
  const kept = new Set(keep);
  const placed = [];
  for (const mark of marks) {
    if (!finiteAt(mark.at)) continue;
    const pinned = kept.has(mark.id);
    const p = project(view, mark.at);
    if (!pinned && ((levels && !mark.levels?.includes(level)) || !p.inside)) continue;
    const { x, y, edge } = toFrame(frame, [p.u, p.v], { pin: pinned });
    const foot = pinned && edge ? { x, y } : toFrame(frame, p.foot);
    const size = reachOn(view, mark.at, mark.reach ?? 0) * frame.r;
    placed.push({ id: mark.id, mark, x, y, footX: foot.x, footY: foot.y, size, side: null, edge, depth: p.depth });
  }
  const labels = placed
    .filter((p) => p.mark.name)
    .map((p) => {
      const [w, h] = labelSize(p.mark.name, fontPx);
      return { id: p.id, x: p.x * scale, y: p.y * scale, w, h, priority: kept.has(p.id) ? Infinity : p.mark.priority };
    });
  const dots = [...placed, ...avoid].map((d) => ({ x: d.x * scale, y: d.y * scale }));
  const side = declutter(labels, { bounds: boundsOf(frame, scale), sides, dots });
  for (const p of placed) p.side = side.get(p.id) ?? null;
  return placed;
}

// The ship is always on the frame, pinned to its rim when it is far off. Its
// nose is (−sin h, −cos h) on x and z (ship.js's forward: heading 0 is −z),
// turned with the chart and squashed by its tilt; angle is in degrees,
// clockwise from right, as an SVG rotate takes it.
export function placeShip(view, ship, frame) {
  if (!ship || !finiteAt([ship.x, ship.y, ship.z])) return null;
  const { x, y, edge } = toFrame(frame, uv(view, [ship.x, ship.y, ship.z]), { pin: true });
  const h = finite(ship.heading) ? ship.heading : 0;
  const [nx, nz] = [-Math.sin(h), -Math.cos(h)];
  const a = nx * Math.cos(view.yaw) - nz * Math.sin(view.yaw);
  const b = (nx * Math.sin(view.yaw) + nz * Math.cos(view.yaw)) * Math.cos(view.pitch);
  return { x, y, angle: (Math.atan2(b, a) * 180) / Math.PI, edge };
}

// each sector within n of the focus's, on its layer, outlined on the ship's plane
export function sectorGrid(view, n) {
  const [fx, fy, fz] = view.focus;
  const [sx0, sy, sz0] = sectorAt(fx, fy, fz);
  const k = finite(n) ? Math.max(0, Math.floor(n)) : 0;
  const half = SECTOR / 2;
  const grid = [];
  for (let sz = sz0 - k; sz <= sz0 + k; sz++) {
    for (let sx = sx0 - k; sx <= sx0 + k; sx++) {
      const [cx, , cz] = sectorCentre(sx, sy, sz);
      const corners = [[cx - half, cz - half], [cx + half, cz - half], [cx + half, cz + half], [cx - half, cz + half]];
      const points = [];
      corners.forEach(([ax, az], e) => {
        const [bx, bz] = corners[(e + 1) % 4];
        for (let i = 0; i < EDGE - 1; i++) {
          const t = i / (EDGE - 1);
          points.push(uv(view, [ax + (bx - ax) * t, fy, az + (bz - az) * t]));
        }
      });
      points.push([...points[0]]);
      grid.push({ key: sectorKey(sx, sy, sz), points });
    }
  }
  return grid;
}

// a closed ring round a centre, level with it
export function ringOn(view, centre, radius, n = 64) {
  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = ((i % n) / n) * 2 * Math.PI;
    points.push(uv(view, [centre[0] + radius * Math.cos(t), centre[1], centre[2] + radius * Math.sin(t)]));
  }
  return points;
}

export function fitRange(focus, marks, pad = 1.05) {
  let far = 0;
  for (const m of marks) if (finiteAt(m.at)) far = Math.max(far, dist(m.at, focus));
  return clampRange(far * pad);
}

export const miniView = (marks) => createView({ focus: [0, 0, 0], range: fitRange([0, 0, 0], marks), pitch: CHART.miniPitch, follow: false });

// the range a level is entered at: just under its top going in, just over
// the top of the one below it going out
function rangeInto(i, from) {
  return clampRange(i < from ? CHART.levels[i].upTo * 0.9 : CHART.levels[i - 1].upTo * 1.2);
}

// Shows a mark: a level that doesn't show it gives way to the nearest one
// that does (the least zoom), then a mark past 0.9 of the range brings the
// focus to it and lets go of the ship.
export function reveal(view, mark) {
  if (!mark || !finiteAt(mark.at)) return view;
  let { range } = view;
  const from = CHART.levels.findIndex((l) => l.id === levelOf(range));
  const allowed = CHART.levels.map((l, i) => (mark.levels?.includes(l.id) ? i : -1)).filter((i) => i >= 0);
  if (allowed.length && !allowed.includes(from)) {
    const zoom = (r) => Math.abs(Math.log(r / view.range));
    range = allowed.map((i) => rangeInto(i, from)).reduce((best, r) => (zoom(r) < zoom(best) ? r : best));
  }
  if (dist(mark.at, view.focus) <= 0.9 * range) return range === view.range ? view : { ...view, range };
  return { ...view, range, focus: [mark.at[0], view.focus[1], mark.at[2]], follow: false };
}
