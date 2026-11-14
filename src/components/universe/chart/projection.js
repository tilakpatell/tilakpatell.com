// The nav map's and the mini-map's chart: one projection for both, centred
// on a focus (the ship, by default), on the 0.375-power radial scale the map
// has always had, re-centred wherever the focus is. Near detail opens up and
// far places still fit, at any zoom from a system to everything known.
// Pure: no imports, numbers in and out. A view is
//   { focus: [x, y, z], range, yaw, pitch, follow }
// range is how far out the chart's rim is; yaw turns it about the vertical;
// pitch tilts it from straight down (0) towards the side (CHART.pitchMax);
// follow says the focus rides with the ship.
//
// CHART, FRAMES
// createView(partial) → view; warp(d, range) → the scaled offset
// project(view, at) → { u, v, foot, depth, inside }   (chart units: the rim is 1)
// unproject(view, [u, v]) → [x, y, z] on the focus's level
// zoomBy, panBy, orbitBy, flatten, recentre, track → a view
// levelOf(range) → 'system' | 'neighbourhood' | 'universe'
// reachOn(view, at, reach) → a body's radius on the chart
// ringsFor(range) → the range rings' radii, powers of ten
// toFrame(frame, [u, v], { pin }) → { x, y, edge }
// between(from, to, k) → the view k of the way (0…1) from one to the other
//
// Every mark stands on a stem from the focus's level. Looking straight down,
// a true projection would hide every height, so the stems never shrink below
// CHART.stemFloor of their tilted length: a short oblique stem still says up
// or down.

export const CHART = {
  power: 0.375,
  range: { min: 300, open: 120000, max: 3000000 },
  pitchMax: 1.35,
  stemFloor: 0.45,
  miniPitch: Math.acos(0.42), // (the flat mini-map's old tilt: MiniMap's TILT)
  levels: [
    { id: 'system', upTo: 8000 },
    { id: 'neighbourhood', upTo: 250000 },
    { id: 'universe', upTo: Infinity },
  ],
};

// The two charts' frames, in their SVG's units: the nav map's circle (its
// old V = 1000 and nav.js's 0.47 margin) and the mini-map's box (600 × 300,
// its old middle 8 above the box's).
export const FRAMES = {
  nav: { w: 1000, h: 1000, cx: 500, cy: 500, r: 470, shape: 'circle' },
  mini: { w: 600, h: 300, cx: 300, cy: 142, r: 266, shape: 'box', pad: 8 },
};

const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const wrap = (a) => {
  if (a >= -Math.PI && a < Math.PI) return a + 0; // (as it is: no rounding)
  const w = (((a + Math.PI) % TAU) + TAU) % TAU - Math.PI;
  return w + 0;
};
const clampRange = (r) => clamp(r, CHART.range.min, CHART.range.max);

export function createView(partial = {}) {
  return {
    focus: partial.focus ? [...partial.focus] : [0, 0, 0],
    range: Number.isFinite(partial.range) && partial.range > 0 ? partial.range : CHART.range.open,
    yaw: wrap(partial.yaw ?? 0),
    pitch: clamp(partial.pitch ?? 0, 0, CHART.pitchMax),
    follow: Boolean(partial.follow),
  };
}

export function warp([dx, dy, dz], range) {
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 0) || !Number.isFinite(len)) return [0, 0, 0];
  const k = (len / range) ** CHART.power / len;
  return [dx * k, dy * k, dz * k];
}

export function project(view, at) {
  const f = view.focus;
  const d = [at[0] - f[0], (at[1] ?? f[1]) - f[1], at[2] - f[2]];
  const [wx, wy, wz] = warp(d, view.range);
  const c = Math.cos(view.yaw);
  const s = Math.sin(view.yaw);
  const a = wx * c - wz * s;
  const b = wx * s + wz * c;
  const vFoot = b * Math.cos(view.pitch);
  const v = vFoot - wy * Math.max(Math.sin(view.pitch), CHART.stemFloor);
  return {
    u: a + 0,
    v: v + 0,
    foot: [a + 0, vFoot + 0],
    depth: b * Math.sin(view.pitch) + wy * Math.cos(view.pitch) + 0,
    inside: Math.hypot(d[0], d[2]) <= view.range, // (by how far across: a height never takes a place off, its stem says it)
  };
}

export function unproject(view, [u, v]) {
  const f = view.focus;
  const a = u;
  const b = v / Math.cos(view.pitch);
  const c = Math.cos(view.yaw);
  const s = Math.sin(view.yaw);
  const wx = a * c + b * s;
  const wz = -a * s + b * c;
  const rho = Math.hypot(wx, wz);
  if (!(rho > 0)) return [...f];
  const len = view.range * rho ** (1 / CHART.power);
  return [f[0] + (wx / rho) * len, f[1], f[2] + (wz / rho) * len];
}

export function zoomBy(view, factor) {
  if (!Number.isFinite(factor) || factor <= 0) return view;
  const range = clampRange(view.range / factor);
  return range === view.range ? view : { ...view, range };
}

// (the focus moves to the point drawn where the hand's opposite is, so the
// old middle lands exactly where the drag went: a linear pan would race the
// ship away, the 0.375 scale being steepest at the middle)
export function panBy(view, [du, dv]) {
  if (!Number.isFinite(du) || !Number.isFinite(dv) || (du === 0 && dv === 0)) return view;
  const [x, , z] = unproject(view, [-du, -dv]);
  return { ...view, focus: [x, view.focus[1], z], follow: false };
}

export function orbitBy(view, [dyaw, dpitch]) {
  if (!Number.isFinite(dyaw) || !Number.isFinite(dpitch)) return view;
  const yaw = wrap(view.yaw + dyaw);
  const pitch = clamp(view.pitch + dpitch, 0, CHART.pitchMax);
  return yaw === view.yaw && pitch === view.pitch ? view : { ...view, yaw, pitch };
}

export const flatten = (view) => (view.yaw === 0 && view.pitch === 0 ? view : { ...view, yaw: 0, pitch: 0 });

export const recentre = (view, ship) => ({ ...view, focus: [ship.x, ship.y ?? 0, ship.z], follow: true });

// on every look at the ship: following, the focus is the ship; otherwise only
// its height is, so the stems stay measured from the ship's level
export function track(view, ship) {
  if (!ship || !Number.isFinite(ship.x) || !Number.isFinite(ship.z)) return view;
  const y = Number.isFinite(ship.y) ? ship.y : 0;
  const [fx, fy, fz] = view.focus;
  if (view.follow) return fx === ship.x && fy === y && fz === ship.z ? view : { ...view, focus: [ship.x, y, ship.z] };
  return fy === y ? view : { ...view, focus: [fx, y, fz] };
}

export const levelOf = (range) => CHART.levels.find((l) => range < l.upTo).id;

export function reachOn(view, at, reach) {
  const f = view.focus;
  const dist = Math.hypot(at[0] - f[0], (at[1] ?? f[1]) - f[1], at[2] - f[2]);
  const rho = (r) => (Math.max(0, r) / view.range) ** CHART.power;
  return (rho(dist + reach) - rho(dist - reach)) / 2;
}

export function ringsFor(range) {
  const out = [];
  for (let k = Math.ceil(Math.log10(range / 100) - 1e-9); 10 ** k < range; k++) out.push(10 ** k);
  return out;
}

export function toFrame(frame, [u, v], { pin = false } = {}) {
  let x = frame.cx + u * frame.r;
  let y = frame.cy + v * frame.r;
  if (frame.shape === 'circle') {
    const d = Math.hypot(u, v);
    const edge = d > 1;
    if (edge && pin) {
      const k = 0.97 / d;
      x = frame.cx + u * k * frame.r;
      y = frame.cy + v * k * frame.r;
    }
    return { x, y, edge };
  }
  const p = frame.pad ?? 0;
  const edge = x < p || x > frame.w - p || y < p || y > frame.h - p;
  if (edge && pin) {
    x = clamp(x, p, frame.w - p);
    y = clamp(y, p, frame.h - p);
  }
  return { x, y, edge };
}

// A glide's view k of the way from one view to another: the range on a
// log scale (so a zoom reads even, a system to everything), the focus in a
// line, the turn the short way round. At 1 it is `to` itself.
export function between(from, to, k) {
  if (k >= 1) return to;
  if (k <= 0) return from;
  const lerp = (a, b) => a + (b - a) * k;
  const turn = wrap(to.yaw - from.yaw);
  return {
    focus: from.focus.map((f, i) => lerp(f, to.focus[i])),
    range: Math.exp(lerp(Math.log(from.range), Math.log(to.range))),
    yaw: wrap(from.yaw + turn * k),
    pitch: lerp(from.pitch, to.pitch),
    follow: to.follow,
  };
}
