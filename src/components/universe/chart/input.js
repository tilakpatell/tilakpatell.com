// The chart's hands and keys, as pure view changes: keys and the wheel become
// zooms, a drag's summed pan becomes a pan from where the drag began, and the
// other gestures (orbit, two fingers) become a zoom, a turn and a tilt. The
// hook (useChartView.js) feeds these. No React, no DOM.
import { orbitBy, panBy, zoomBy } from './projection';

export const ZOOM_STEP = 1.5; // (a button's or a key's zoom, the galaxy's)
export const ORBIT = { yaw: Math.PI, pitch: Math.PI / 2 }; // (radians for a drag across the whole box)

const LINE = { 0: 1, 1: 16, 2: 120 }; // (a wheel's delta in px, lines or pages: Firefox's wheel is in lines)
const KEYS = new Map([['+', 'zoomIn'], ['=', 'zoomIn'], ['-', 'zoomOut'], ['_', 'zoomOut'], ['0', 'back']]);
const num = (n) => (Number.isFinite(n) ? n : 0);

export function chartKey({ key, meta, ctrl, alt }, { typing = false } = {}) {
  if (typing || meta || ctrl || alt) return null;
  return KEYS.get(key) ?? null;
}

export function wheelFactor(deltaY, deltaMode) {
  const dy = deltaY * (LINE[deltaMode] ?? 1);
  if (!Number.isFinite(dy)) return 1;
  return Math.exp(-Math.max(-60, Math.min(60, dy)) * 0.0068); // (a trackpad's small steps a little; a wheel's notch, about ZOOM_STEP)
}

// A whole drag's summed pan fractions, applied to the view the drag began on.
export function panFrom(anchor, total, frame) {
  return panBy(anchor, [(num(total[0]) * frame.w) / frame.r, (num(total[1]) * frame.h) / frame.r]);
}

// Everything but a pan. The very same view comes back when nothing applied.
export function gestureStep(view, message, frame, { orbit = true } = {}) {
  let next = view;
  if (message.orbit) {
    if (orbit) next = orbitBy(next, [num(message.orbit[0]) * ORBIT.yaw, -num(message.orbit[1]) * ORBIT.pitch]);
  } else if (message.zoom !== undefined) {
    next = zoomBy(next, message.zoom);
    if (orbit) next = orbitBy(next, [num(message.turn), -num(message.tilt) * ORBIT.pitch]);
  }
  // (projection's wrap leaves float noise on a yaw it only added to, 0.3 → 0.3000000000000007: snapped off here)
  if (next.yaw !== view.yaw) next = { ...next, yaw: Math.round(next.yaw * 1e12) / 1e12 };
  return next.range === view.range && next.yaw === view.yaw && next.pitch === view.pitch ? view : next;
}

// The place a key steps to in a ring of ids, or undefined for any other key.
export function ringStep(ids, key, id) {
  const n = ids.length;
  if (!n) return undefined;
  if (key === 'Home') return ids[0];
  if (key === 'End') return ids[n - 1];
  const dir = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  if (!dir) return undefined;
  const at = ids.indexOf(id);
  if (at < 0) return dir > 0 ? ids[0] : ids[n - 1];
  return ids[(at + dir + n) % n];
}
