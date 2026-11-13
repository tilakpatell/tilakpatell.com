// Marks onto a chart's frame: the one door both charts place through (the
// nav map's NavChart.jsx and the flat MiniMap.jsx), on projection.js's view.
// A mark is
//   { id, kind, name, at: [x, y, z], priority, color,
//     levels: ['system' | 'neighbourhood' | 'universe', …],
//     shape?: 'dot' | 'cloud' | 'hole' | 'star' | 'portal' | 'sun' | 'pilot' | 'fight',
//     reach?, pickable? }
// An empty name has no label; ids are unique on a chart. Lane 6b adds the
// generated places, the events and the pilots everywhere as more marks with
// their own levels, through no other door: nothing here changes for them.
// Names are laid out by chartLabels.js, the nav map's own placer, highest
// priority first; a name with no clear side is left off (its dot stays).
// Pure: sector maths through lib/space/address.js.
//
// labelSize(name, fontPx) → [w, h]
// placeMarks(view, marks, frame, { level, keep, fontPx, scale, sides, avoid, levels, measure, height, obstacles, dot, gap }) → [{ id, mark, x, y, footX, footY, size, side, dx, dy, edge, depth }]
// placeShip(view, ship, frame) → { x, y, angle, edge }
// sectorGrid(view, n) → [{ key, at: [sx, sy, sz], ring, points: [[u, v], …], corner: [u, v] }]
// ringOn(view, centre, radius, n) → [[u, v], …]
// fitRange(focus, marks, pad) → range; miniView(marks) → view
// reveal(view, mark) → a view that shows it

import { SECTOR, sectorAt, sectorCentre, sectorKey } from '../../../lib/space/address';
import { placeLabels } from '../chartLabels';
import { CHART, createView, levelOf, project, reachOn, toFrame } from './projection';

// a name's box, in px, before the browser measures it: its letters, and the dot and gap before it
export const labelSize = (name, fontPx) => [name.length * 0.58 * fontPx + 22, Math.max(24, 1.6 * fontPx)];

const byPriority = (keep) => (a, b) => {
  const pa = keep.has(a.mark.id) ? Infinity : a.mark.priority;
  const pb = keep.has(b.mark.id) ? Infinity : b.mark.priority;
  return pb - pa || (a.mark.id < b.mark.id ? -1 : a.mark.id > b.mark.id ? 1 : 0);
};

export function placeMarks(view, marks, frame, opts = {}) {
  const { level = levelOf(view.range), fontPx = 11, scale = 1, sides, avoid = [], levels = true, measure = null, height = null, obstacles = [], dot, gap } = opts;
  const keep = new Set((opts.keep ?? []).filter(Boolean));
  const out = [];
  for (const mark of marks) {
    const kept = keep.has(mark.id);
    if (!kept && levels && !mark.levels.includes(level)) continue;
    const p = project(view, mark.at);
    if (!kept && !p.inside) continue;
    // (in range across but drawn past the rim, far above or below: held at the rim, on its stem)
    const at = toFrame(frame, [p.u, p.v], { pin: kept || p.inside });
    const foot = toFrame(frame, p.foot, { pin: kept || p.inside });
    // (a mark pinned from off the chart stands on no stem: its foot is off the chart too)
    const footAt = at.edge && foot.edge ? at : foot;
    out.push({ id: mark.id, mark, x: at.x, y: at.y, footX: footAt.x, footY: footAt.y, size: reachOn(view, mark.at, mark.reach ?? 0) * frame.r, side: null, dx: 0, dy: 0, edge: at.edge, depth: p.depth });
  }
  // the names, highest priority first, clear of one another, of every dot and of the ship
  const named = out.filter((p) => p.mark.name).sort(byPriority(keep));
  const h = height ?? labelSize('', fontPx)[1];
  const size = frame.w * scale;
  const ships = avoid.map(({ x, y }) => ({ x0: (x - 14) * scale, y0: (y - 14) * scale, x1: (x + 14) * scale, y1: (y + 14) * scale }));
  const sideOf = placeLabels(
    [...named.map((p) => ({ id: p.id, x: p.x * scale, y: p.y * scale, text: p.mark.name })), ...out.filter((p) => !p.mark.name).map((p) => ({ id: p.id, x: p.x * scale, y: p.y * scale, text: '', label: false }))],
    {
      size,
      measure: measure ?? ((t) => labelSize(t, fontPx)[0]),
      height: h,
      obstacles: [...ships, ...obstacles],
      ...(dot === undefined ? {} : { dot }),
      ...(gap === undefined ? {} : { gap }),
      ...(frame.shape === 'box' ? { box: { x0: 0, y0: 0, x1: frame.w * scale, y1: frame.h * scale } } : {}),
      ...(sides ? { sides } : {}),
    },
  );
  for (const p of named) {
    const l = sideOf.get(p.id);
    if (!l) continue;
    p.dx = l.dx;
    p.dy = l.dy;
    p.side = l.off ? null : l.side;
  }
  return out;
}

export function placeShip(view, ship, frame) {
  const p = project(view, [ship.x, ship.y ?? view.focus[1], ship.z]);
  const at = toFrame(frame, [p.u, p.v], { pin: true });
  const h = Number.isFinite(ship.heading) ? ship.heading : 0;
  // the nose, (−sin h, −cos h) in x and z (ship.js: heading 0 is −z), turned and tilted with the chart
  const nx = -Math.sin(h);
  const nz = -Math.cos(h);
  const c = Math.cos(view.yaw);
  const s = Math.sin(view.yaw);
  const a = nx * c - nz * s;
  const b = (nx * s + nz * c) * Math.cos(view.pitch);
  return { x: at.x, y: at.y, angle: (Math.atan2(b, a) * 180) / Math.PI + 0, edge: at.edge };
}

// The sectors round the focus's, on its layer, outlined at its height:
// `ring` is how many sectors out from the focus's each is (the chart fades
// them out with it, so the grid reads as going on past what's drawn).
const EDGE_POINTS = 12;
export function sectorGrid(view, n) {
  const [sx, sy, sz] = sectorAt(...view.focus);
  const y = view.focus[1];
  const half = SECTOR / 2;
  const out = [];
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) {
      const [cx, , cz] = sectorCentre(sx + i, sy, sz + j);
      const corners = [
        [cx - half, cz - half],
        [cx + half, cz - half],
        [cx + half, cz + half],
        [cx - half, cz + half],
      ];
      const points = [];
      for (let e = 0; e < 4; e++) {
        const [x0, z0] = corners[e];
        const [x1, z1] = corners[(e + 1) % 4];
        for (let k = 0; k < EDGE_POINTS - 1; k++) {
          const t = k / (EDGE_POINTS - 1);
          const p = project(view, [x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t]);
          points.push([p.u, p.v]);
        }
      }
      points.push(points[0]);
      const corner = project(view, [cx - half * 0.94, y, cz - half * 0.94]);
      out.push({ key: sectorKey(sx + i, sy, sz + j), at: [sx + i, sy, sz + j], ring: Math.max(Math.abs(i), Math.abs(j)), points, corner: [corner.u, corner.v] });
    }
  return out;
}

export function ringOn(view, centre, radius, n = 64) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const p = project(view, [centre[0] + Math.cos(a) * radius, centre[1], centre[2] + Math.sin(a) * radius]);
    out.push([p.u, p.v]);
  }
  return out;
}

export function fitRange(focus, marks, pad = 1.05) {
  let far = 0;
  for (const m of marks) far = Math.max(far, Math.hypot(m.at[0] - focus[0], m.at[1] - focus[1], m.at[2] - focus[2]));
  return Math.min(CHART.range.max, Math.max(CHART.range.min, far * pad));
}

export const miniView = (marks) => createView({ focus: [0, 0, 0], range: fitRange([0, 0, 0], marks), pitch: CHART.miniPitch });

export function reveal(view, mark) {
  let next = view;
  const ids = CHART.levels.map((l) => l.id);
  const here = ids.indexOf(levelOf(view.range));
  if (mark.levels?.length && !mark.levels.includes(ids[here])) {
    const allowed = mark.levels.map((l) => ids.indexOf(l)).filter((i) => i >= 0);
    const to = allowed.reduce((best, i) => (Math.abs(i - here) < Math.abs(best - here) ? i : best), allowed[0]);
    const range = to < here ? CHART.levels[to].upTo * 0.9 : CHART.levels[to - 1].upTo * 1.2;
    next = { ...next, range: Math.min(CHART.range.max, Math.max(CHART.range.min, range)) };
  }
  const f = next.focus;
  if (Math.hypot(mark.at[0] - f[0], mark.at[2] - f[2]) > 0.9 * next.range) next = { ...next, focus: [mark.at[0], f[1], mark.at[2]], follow: false };
  return next;
}
