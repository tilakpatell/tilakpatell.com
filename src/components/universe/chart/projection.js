// The chart's projection: the maths the nav map and the no-3D mini-map both
// draw through. Centred on a focus (the ship, unless the visitor has panned),
// zoomed on a radial power scale so the near things stay big and the far
// things still fit, and turned and tilted into 3D. Pure, no imports.
//
// CHART, FRAMES
// createView(partial) → View { focus, range, yaw, pitch, follow }
// warp(d, range) → [wx, wy, wz]
// project(view, at) → { u, v, foot, depth, inside }
// unproject(view, [u, v]) → [x, y, z] on the focus plane
// zoomBy(view, factor), panBy(view, [du, dv]), orbitBy(view, [dyaw, dpitch]), flatten(view)
// recentre(view, ship), track(view, ship)
// levelOf(range) → 'system' | 'neighbourhood' | 'universe'
// reachOn(view, at, reach) → chart units
// ringsFor(range) → powers of ten
// toFrame(frame, [u, v], { pin }) → { x, y, edge }
//
// Every mark stands on a stem from its foot (where it sits on the ship's
// level) up or down to the mark itself. The stem has a floor, stemFloor: looking
// straight down, a true projection would squash every height to nothing and
// hide it, so a short oblique stem is kept to show whether a thing is above or
// below.

export const CHART = {
  power: 0.375,
  range: { min: 300, open: 120000, max: 3000000 },
  pitchMax: 1.35,
  stemFloor: 0.45,
  // (the mini-map's old tilt)
  miniPitch: Math.acos(0.42),
  levels: [
    { id: 'system', upTo: 8000 },
    { id: 'neighbourhood', upTo: 250000 },
    { id: 'universe', upTo: Infinity },
  ],
};

// (the nav map's V and margin, and the mini-map's W, H, K and centre)
export const FRAMES = {
  nav: { w: 1000, h: 1000, cx: 500, cy: 500, r: 470, shape: 'circle' },
  mini: { w: 600, h: 300, cx: 300, cy: 142, r: 266, shape: 'box', pad: 8 },
};

const TAU = Math.PI * 2;
const num = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);
// (+ 0 turns -0 into 0)
const wrap = (a) => ((((num(a) + Math.PI) % TAU) + TAU) % TAU) - Math.PI + 0;
const clampPitch = (p) => Math.min(CHART.pitchMax, Math.max(0, num(p))) + 0;
const clampRange = (r) => Math.min(CHART.range.max, Math.max(CHART.range.min, r));

export function createView(partial = {}) {
  const f = partial.focus || [0, 0, 0];
  return {
    focus: [num(f[0]) + 0, num(f[1]) + 0, num(f[2]) + 0],
    range: clampRange(num(partial.range, CHART.range.open)),
    yaw: wrap(partial.yaw),
    pitch: clampPitch(partial.pitch),
    follow: partial.follow === true,
  };
}

export function warp(d, range) {
  const len = Math.hypot(d[0], d[1], d[2]);
  if (!(len > 0)) return [0, 0, 0];
  const k = (len / range) ** CHART.power / len;
  return [d[0] * k + 0, d[1] * k + 0, d[2] * k + 0];
}

export function project(view, at) {
  const { focus, range, yaw, pitch } = view;
  const d = [at[0] - focus[0], at[1] - focus[1], at[2] - focus[2]];
  const [wx, wy, wz] = warp(d, range);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const a = wx * c - wz * s;
  const b = wx * s + wz * c;
  const vFoot = b * Math.cos(pitch);
  return {
    u: a + 0,
    v: vFoot - wy * Math.max(Math.sin(pitch), CHART.stemFloor) + 0,
    foot: [a + 0, vFoot + 0],
    depth: b * Math.sin(pitch) + wy * Math.cos(pitch) + 0,
    inside: Math.hypot(d[0], d[1], d[2]) <= range,
  };
}

// The plane y = focus[1] is where wy = 0, so v is the foot alone.
export function unproject(view, [u, v]) {
  const { focus, range, yaw, pitch } = view;
  const a = u;
  const b = v / Math.cos(pitch);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const wx = a * c + b * s;
  const wz = -a * s + b * c;
  const rho = Math.hypot(wx, wz);
  if (!(rho > 0)) return [focus[0], focus[1], focus[2]];
  const k = (range * rho ** (1 / CHART.power)) / rho;
  return [focus[0] + wx * k, focus[1], focus[2] + wz * k];
}

export function zoomBy(view, factor) {
  if (!Number.isFinite(factor) || factor <= 0) return view;
  return { ...view, range: clampRange(view.range / factor) };
}

export function panBy(view, [du, dv]) {
  const [x, , z] = unproject(view, [-du, -dv]);
  return { ...view, focus: [x + 0, view.focus[1], z + 0], follow: false };
}

export function orbitBy(view, [dyaw, dpitch]) {
  return { ...view, yaw: wrap(view.yaw + num(dyaw)), pitch: clampPitch(view.pitch + num(dpitch)) };
}

export const flatten = (view) => ({ ...view, yaw: 0, pitch: 0 });

export const recentre = (view, ship) => ({ ...view, focus: [ship.x, ship.y, ship.z], follow: true });

export function track(view, ship) {
  const [fx, fy, fz] = view.focus;
  if (view.follow) {
    if (fx === ship.x && fy === ship.y && fz === ship.z) return view;
    return { ...view, focus: [ship.x, ship.y, ship.z] };
  }
  if (fy === ship.y) return view;
  return { ...view, focus: [fx, ship.y, fz] };
}

export function levelOf(range) {
  for (const l of CHART.levels) if (range < l.upTo) return l.id;
  return CHART.levels[CHART.levels.length - 1].id;
}

export function reachOn(view, at, reach) {
  const dist = Math.hypot(at[0] - view.focus[0], at[1] - view.focus[1], at[2] - view.focus[2]);
  const rho = (r) => (r / view.range) ** CHART.power;
  return (rho(dist + reach) - rho(Math.max(0, dist - reach))) / 2;
}

export function ringsFor(range) {
  const rings = [];
  for (let k = 0; k <= 15; k += 1) {
    const p = 10 ** k;
    if (p >= range / 100 && p < range) rings.push(p);
  }
  return rings;
}

// A ship 10^12 out still lands on a finite spot, so the clamp comes first.
const FAR = 1e6;
export function toFrame(frame, [u, v], { pin = false } = {}) {
  let pu = Math.max(-FAR, Math.min(FAR, num(u)));
  let pv = Math.max(-FAR, Math.min(FAR, num(v)));
  let edge;
  if (frame.shape === 'circle') {
    const len = Math.hypot(pu, pv);
    edge = len > 1;
    if (edge && pin) {
      pu = (pu / len) * 0.97;
      pv = (pv / len) * 0.97;
    }
  } else {
    const x = frame.cx + pu * frame.r;
    const y = frame.cy + pv * frame.r;
    const pad = frame.pad || 0;
    const x0 = pad;
    const x1 = frame.w - pad;
    const y0 = pad;
    const y1 = frame.h - pad;
    edge = x < x0 || x > x1 || y < y0 || y > y1;
    if (edge && pin) {
      return { x: Math.min(x1, Math.max(x0, x)), y: Math.min(y1, Math.max(y0, y)), edge };
    }
  }
  return { x: frame.cx + pu * frame.r, y: frame.cy + pv * frame.r, edge };
}
