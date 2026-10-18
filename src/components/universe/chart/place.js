// Placing marks on a frame: the one door both charts (the nav map and the
// no-3D mini-map) put their marks through. Pure: it imports only the chart's
// own maths and the sector address, no React, no DOM and no three.js.
//
// A Mark is the input shape:
//   { id, kind, name, at: [x, y, z], priority, color,
//     levels: Array<'system' | 'neighbourhood' | 'universe'>,
//     shape?: 'dot' | 'cloud' | 'hole' | 'star' | 'portal' | 'sun' | 'pilot' | 'fight',
//     reach?, pickable? }
// An empty name means no label. An id is unique per chart. Lane 6b adds
// generated places, events and pilots as more marks with their own levels,
// through this door and no other.
//
// labelSize(name, fontPx) → [w, h] in px
// placeMarks(view, marks, frame, opts) → Placed[] in the marks' order (the tab
//   order), each { id, mark, x, y, footX, footY, size, side, edge, depth } in
//   frame units. opts: { level, keep, fontPx, scale, sides, avoid, levels }
// placeShip(view, ship, frame) → { x, y, angle, edge }
// sectorGrid(view, n) → [{ key, points }]; ringOn(view, centre, radius, n)
// fitRange(focus, marks, pad), miniView(marks), reveal(view, mark)

import { SECTOR, sectorAt, sectorCentre, sectorKey } from '../../../lib/space/address';
import { declutter } from './declutter';
import { CHART, createView, levelOf, project, reachOn, toFrame } from './projection';

const num = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);

// The 16 px dot and its gap come to 22 px; a letter is about 0.58 of the font.
export const labelSize = (name, fontPx) => [name.length * 0.58 * fontPx + 22, Math.max(24, 1.6 * fontPx)];

export function placeMarks(view, marks, frame, opts = {}) {
  const {
    level = levelOf(view.range),
    keep = [],
    fontPx = 11,
    scale = 1,
    sides,
    avoid = [],
    levels = true,
  } = opts;
  const kept = new Set(keep);

  const placed = [];
  for (const mark of marks) {
    const pinned = kept.has(mark.id);
    const p = project(view, mark.at);
    if (!pinned && (!p.inside || (levels && !mark.levels.includes(level)))) continue;
    const dot = toFrame(frame, [p.u, p.v], { pin: pinned });
    // A kept mark off the chart has no stem: its foot is where its dot is pinned.
    const foot = dot.edge && pinned ? dot : toFrame(frame, p.foot, { pin: pinned });
    placed.push({
      id: mark.id,
      mark,
      x: dot.x,
      y: dot.y,
      footX: foot.x,
      footY: foot.y,
      size: reachOn(view, mark.at, mark.reach ?? 0) * frame.r,
      side: null,
      edge: dot.edge,
      depth: p.depth,
    });
  }

  const labels = [];
  for (const p of placed) {
    if (!p.mark.name) continue;
    const [w, h] = labelSize(p.mark.name, fontPx);
    labels.push({
      id: p.id,
      x: p.x * scale,
      y: p.y * scale,
      w,
      h,
      priority: kept.has(p.id) ? Infinity : p.mark.priority,
    });
  }
  const dots = [
    ...placed.map((p) => ({ x: p.x * scale, y: p.y * scale })),
    ...avoid.map((a) => ({ x: a.x * scale, y: a.y * scale })),
  ];
  // (a round frame is drawn clipped to its box's inscribed circle, wider than
  // its chart radius r: a name inside that circle is never cut)
  const bounds =
    frame.shape === 'circle'
      ? { cx: frame.cx * scale, cy: frame.cy * scale, r: (Math.min(frame.w, frame.h) / 2) * scale }
      : { x0: 0, y0: 0, x1: frame.w * scale, y1: frame.h * scale };
  const sidesOf = declutter(labels, { bounds, dots, ...(sides ? { sides } : {}) });
  for (const p of placed) p.side = sidesOf.get(p.id) ?? null;
  return placed;
}

// The nose is (−sin h, −cos h) in (x, z), as ship.js's forward (heading 0 is
// −z). It is turned by the yaw the way project turns a warped point, and its b
// is squashed by the tilt; y points down the screen, so atan2 reads clockwise.
export function placeShip(view, ship, frame) {
  const at = project(view, [ship.x, ship.y, ship.z]);
  const dot = toFrame(frame, [at.u, at.v], { pin: true });
  const h = num(ship.heading);
  const nx = -Math.sin(h);
  const nz = -Math.cos(h);
  const c = Math.cos(view.yaw);
  const s = Math.sin(view.yaw);
  const a = nx * c - nz * s;
  const b = (nx * s + nz * c) * Math.cos(view.pitch);
  const angle = (Math.atan2(b, a) * 180) / Math.PI;
  return { x: dot.x, y: dot.y, angle: num(angle), edge: dot.edge };
}

// 12 points an edge, corners included, so a corner sits on both its edges.
const EDGE_POINTS = 12;

export function sectorGrid(view, n) {
  const [fx, sy, fz] = sectorAt(view.focus[0], view.focus[1], view.focus[2]);
  const half = SECTOR / 2;
  const y = view.focus[1];
  const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
  const out = [];
  for (let dx = -n; dx <= n; dx += 1) {
    for (let dz = -n; dz <= n; dz += 1) {
      const sx = fx + dx;
      const sz = fz + dz;
      const [cx, , cz] = sectorCentre(sx, sy, sz);
      const points = [];
      for (let e = 0; e < 4; e += 1) {
        const [x0, z0] = corners[e];
        const [x1, z1] = corners[(e + 1) % 4];
        for (let i = 0; i < EDGE_POINTS; i += 1) {
          const t = i / (EDGE_POINTS - 1);
          const p = project(view, [cx + x0 + (x1 - x0) * t, y, cz + z0 + (z1 - z0) * t]);
          points.push([p.u, p.v]);
        }
      }
      out.push({ key: sectorKey(sx, sy, sz), points });
    }
  }
  return out;
}

// The ring is closed here: its first point is repeated at the end, so the SVG
// need not close the path.
export function ringOn(view, centre, radius, n = 64) {
  const points = [];
  for (let i = 0; i <= n; i += 1) {
    const a = ((i % n) / n) * Math.PI * 2;
    const p = project(view, [centre[0] + Math.cos(a) * radius, centre[1], centre[2] + Math.sin(a) * radius]);
    points.push([p.u, p.v]);
  }
  return points;
}

const clampRange = (r) => Math.min(CHART.range.max, Math.max(CHART.range.min, r));

export function fitRange(focus, marks, pad = 1.05) {
  if (!marks.length) return CHART.range.open;
  const furthest = Math.max(...marks.map((m) => Math.hypot(m.at[0] - focus[0], m.at[1] - focus[1], m.at[2] - focus[2])));
  return clampRange(furthest * pad);
}

export const miniView = (marks) =>
  createView({ focus: [0, 0, 0], range: fitRange([0, 0, 0], marks), pitch: CHART.miniPitch, follow: false });

export function reveal(view, mark) {
  let next = view;
  const here = CHART.levels.findIndex((l) => l.id === levelOf(view.range));
  if (!mark.levels.includes(CHART.levels[here].id)) {
    // The nearest level the mark shows on, the finer one winning a tie.
    let best = -1;
    CHART.levels.forEach((l, j) => {
      if (!mark.levels.includes(l.id)) return;
      if (best < 0 || Math.abs(j - here) < Math.abs(best - here)) best = j;
    });
    if (best >= 0) {
      const range = best < here ? CHART.levels[best].upTo * 0.9 : CHART.levels[best - 1].upTo * 1.2;
      next = { ...next, range: clampRange(range) };
    }
  }
  const [fx, fy, fz] = next.focus;
  const dist = Math.hypot(mark.at[0] - fx, mark.at[1] - fy, mark.at[2] - fz);
  if (dist > 0.9 * next.range) next = { ...next, focus: [mark.at[0], fy, mark.at[2]], follow: false };
  return next;
}
