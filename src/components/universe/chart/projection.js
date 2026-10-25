// The chart's projection: the one the nav map and the no-3D mini-map both
// draw through. Pure: no React, no DOM, no three.js.
//
// A view looks at a focus, the ship by default. A point's offset from the
// focus is drawn on a 0.375-power scale, re-centred there: the view's range
// sits on the rim (radius 1 in chart units) and a tenth of it at 0.42, so the
// near detail and the far places share one chart. The view then turns (yaw)
// and tilts (pitch) that warped space into 3D.
//
// Every mark stands on a stem, from its foot on the plane at the focus's
// height to its own height. The stem is never drawn shorter than stemFloor of
// the height. Looking straight down, a true projection would hide every
// height, and the stems are how the chart says what is above or below the ship.
//
// CHART, FRAMES
// View = { focus: [x, y, z], range, yaw, pitch, follow }: yaw in [−π, π), pitch in [0, pitchMax]
// createView(partial) → View
// warp(d, range) → [wx, wy, wz]
// project(view, at) → { u, v, foot: [u, vFoot], depth, inside }: depth bigger
//   is nearer; inside is within the range across, whatever its height (the
//   home system's chart, the ship far below the disc, still has its stations)
// unproject(view, [u, v]) → [x, y, z], on the plane y = focus[1]
// zoomBy(view, factor), panBy(view, [du, dv]), orbitBy(view, [dyaw, dpitch]), flatten(view) → View
// recentre(view, ship), track(view, ship) → View
// levelOf(range) → 'system' | 'neighbourhood' | 'universe'
// reachOn(view, at, reach) → chart units
// ringsFor(range) → the powers of ten from range / 100 up to the range
// toFrame(frame, [u, v], { pin }) → { x, y, edge }; PIN, the fraction of a
//   round frame's radius a pinned point sits at
//
// A move that changes nothing gives back the same view, and a bad number
// (not finite, a zoom of 0 or less) or a missing ship changes nothing.

// my calls, pinned by projection.test.js so they can be tuned
export const CHART = Object.freeze({
  power: 0.375, // nav.js's root scale since the spread (CHART_VIEWS.all)
  range: Object.freeze({ min: 300, open: 120000, max: 3000000 }),
  pitchMax: 1.35, // short of side-on, so the plane never folds into a line
  stemFloor: 0.45,
  miniPitch: Math.acos(0.42), // the old flat map's tilt (its TILT, 0.42)
  levels: Object.freeze([
    Object.freeze({ id: 'system', upTo: 8000 }),
    Object.freeze({ id: 'neighbourhood', upTo: 250000 }),
    Object.freeze({ id: 'universe', upTo: Infinity }),
  ]),
});

// The two frames a chart is drawn in, in their SVGs' units, the old maps'
// numbers: nav is the old nav map's 1,000 across and nav.js's MARGIN (a
// radius 0.47 of it); mini is the old flat map's 600 by 300, its scale (half
// its width less 34) and its middle (8 above the box's).
export const FRAMES = Object.freeze({
  nav: Object.freeze({ w: 1000, h: 1000, cx: 500, cy: 500, r: 470, shape: 'circle' }),
  mini: Object.freeze({ w: 600, h: 300, cx: 300, cy: 142, r: 266, shape: 'box', pad: 8 }),
});

export const PIN = 0.97; // a pinned point sits just inside the round rim, so its dot is whole
const TURN = 2 * Math.PI;
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const clampRange = (r) => clamp(r, CHART.range.min, CHART.range.max);
const clampPitch = (p) => clamp(p, 0, CHART.pitchMax);
function wrapYaw(a) {
  let r = a - TURN * Math.floor((a + Math.PI) / TURN);
  if (r >= Math.PI) r -= TURN;
  if (r < -Math.PI) r += TURN;
  return r;
}

export function createView(partial = {}) {
  const { focus = [0, 0, 0], range = CHART.range.open, yaw = 0, pitch = 0, follow = false } = partial;
  return {
    focus: [focus[0], focus[1], focus[2]],
    range: finite(range) ? clampRange(range) : CHART.range.open,
    yaw: finite(yaw) ? wrapYaw(yaw) : 0,
    pitch: finite(pitch) ? clampPitch(pitch) : 0,
    follow: Boolean(follow),
  };
}

export function warp([dx, dy, dz], range) {
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return [0, 0, 0];
  const k = (len / range) ** CHART.power / len;
  return [dx * k, dy * k, dz * k];
}

export function project(view, at) {
  const { focus, range, yaw, pitch } = view;
  const d = [at[0] - focus[0], at[1] - focus[1], at[2] - focus[2]];
  const [wx, wy, wz] = warp(d, range);
  const a = wx * Math.cos(yaw) - wz * Math.sin(yaw);
  const b = wx * Math.sin(yaw) + wz * Math.cos(yaw);
  const vFoot = b * Math.cos(pitch);
  return {
    u: a,
    v: vFoot - wy * Math.max(Math.sin(pitch), CHART.stemFloor),
    foot: [a, vFoot],
    depth: b * Math.sin(pitch) + wy * Math.cos(pitch),
    inside: Math.hypot(d[0], d[2]) <= range, // (across: a height never takes a place off, its stem says it)
  };
}

export function unproject(view, [u, v]) {
  const { focus, range, yaw, pitch } = view;
  const b = v / Math.cos(pitch);
  const wx = u * Math.cos(yaw) + b * Math.sin(yaw);
  const wz = b * Math.cos(yaw) - u * Math.sin(yaw);
  const len = Math.hypot(wx, wz);
  if (len === 0) return [focus[0], focus[1], focus[2]];
  const k = (range * len ** (1 / CHART.power)) / len;
  return [focus[0] + wx * k, focus[1], focus[2] + wz * k];
}

export function zoomBy(view, factor) {
  if (!finite(factor) || factor <= 0) return view;
  const range = clampRange(view.range / factor);
  return range === view.range ? view : { ...view, range };
}

// The new focus is the point on the focus plane drawn at (−du, −dv), so the
// old middle is drawn at exactly (du, dv) and whatever was under the hand
// stays under it. A linear pan would race the ship away from the hand, since
// the scale is steepest at the middle. The hook anchors a whole drag on the
// view it began on (input.js's panFrom): step by step, a fisheye barely moves.
export function panBy(view, [du, dv]) {
  if (!finite(du) || !finite(dv)) return view;
  const [x, , z] = unproject(view, [-du, -dv]);
  return { ...view, focus: [x, view.focus[1], z], follow: false };
}

export function orbitBy(view, [dyaw, dpitch]) {
  const yaw = finite(dyaw) ? wrapYaw(view.yaw + dyaw) : view.yaw;
  const pitch = finite(dpitch) ? clampPitch(view.pitch + dpitch) : view.pitch;
  return yaw === view.yaw && pitch === view.pitch ? view : { ...view, yaw, pitch };
}

export const flatten = (view) => (view.yaw === 0 && view.pitch === 0 ? view : { ...view, yaw: 0, pitch: 0 });

const shipAt = (ship) => (ship && finite(ship.x) && finite(ship.y) && finite(ship.z) ? [ship.x, ship.y, ship.z] : null);

export function recentre(view, ship) {
  const at = shipAt(ship);
  return at ? { ...view, focus: at, follow: true } : view;
}

// on every where() tick: a followed ship is the focus; otherwise the focus
// only takes the ship's height, so the stems are still measured from it
export function track(view, ship) {
  const at = shipAt(ship);
  if (!at) return view;
  const [fx, fy, fz] = view.focus;
  if (view.follow) return at[0] === fx && at[1] === fy && at[2] === fz ? view : { ...view, focus: at };
  return at[1] === fy ? view : { ...view, focus: [fx, at[1], fz] };
}

export const levelOf = (range) => (CHART.levels.find((l) => range < l.upTo) ?? CHART.levels.at(-1)).id;

// how big a body of this reach is drawn where it is: half the stretch of the
// scale across it, so it grows as the chart zooms in and shrinks at the rim
export function reachOn(view, at, reach) {
  const { focus, range } = view;
  const dist = Math.hypot(at[0] - focus[0], at[1] - focus[1], at[2] - focus[2]);
  const r = finite(reach) ? Math.max(0, reach) : 0;
  const rho = (n) => (n / range) ** CHART.power;
  return (rho(dist + r) - rho(Math.max(0, dist - r))) / 2;
}

export function ringsFor(range) {
  if (!finite(range) || range <= 0) return [];
  const rings = [];
  for (let k = Math.floor(Math.log10(range / 100)); ; k++) {
    const ring = Number(`1e${k}`); // (exact, where 10 ** k may not be)
    if (ring >= range) return rings;
    if (ring >= range / 100) rings.push(ring);
  }
}

// chart units to a frame's: edge is outside the circle, or the box inset by
// its pad; pinned, an outside point comes back onto the rim or into the box
export function toFrame(frame, [u, v], { pin = false } = {}) {
  const { cx, cy, r } = frame;
  if (frame.shape === 'circle') {
    const out = Math.hypot(u, v);
    const edge = out > 1;
    const k = edge && pin ? PIN / out : 1;
    return { x: cx + u * r * k, y: cy + v * r * k, edge };
  }
  const pad = frame.pad ?? 0;
  const x = cx + u * r;
  const y = cy + v * r;
  const edge = x < pad || x > frame.w - pad || y < pad || y > frame.h - pad;
  if (!edge || !pin) return { x, y, edge };
  return { x: clamp(x, pad, frame.w - pad), y: clamp(y, pad, frame.h - pad), edge };
}
