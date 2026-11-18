// The chart's hands and keys, as changes to its view (projection.js): the
// keys + − 0, the wheel, a drag (anchored on where it began: the steps of a
// drag would barely move a fisheye), a Shift- or right-drag that turns and
// tilts it, two fingers that pinch, turn and tilt, and the arrows through
// the places. Pure: useChartView.js feeds it the browser's events.
//
// ZOOM_STEP, ORBIT
// chartKey(e, { typing }) → 'zoomIn' | 'zoomOut' | 'back' | null
// wheelFactor(deltaY, deltaMode) → a zoom factor
// panFrom(anchor, total, frame) → view
// gestureStep(view, message, frame, { orbit }) → view
// ringStep(ids, key, id) → the next id, or undefined

import { orbitBy, panBy, zoomBy } from './projection';

export const ZOOM_STEP = 1.5; // (a button's or a key's zoom: the galaxy map's)
export const ORBIT = { yaw: Math.PI, pitch: Math.PI / 2 }; // (radians for a drag across the whole box)
const LINE = { 0: 1, 1: 16, 2: 120 }; // (a wheel's delta in px, lines or pages: Firefox's wheel is in lines)

const KEYS = { '+': 'zoomIn', '=': 'zoomIn', '-': 'zoomOut', _: 'zoomOut', 0: 'back' };
export function chartKey({ key, meta = false, ctrl = false, alt = false, metaKey, ctrlKey, altKey } = {}, { typing = false } = {}) {
  if (typing || meta || ctrl || alt || metaKey || ctrlKey || altKey) return null;
  return KEYS[key] ?? null;
}

export function wheelFactor(deltaY, deltaMode) {
  const dy = deltaY * (LINE[deltaMode] ?? 1);
  if (!Number.isFinite(dy)) return 1;
  return Math.exp(-Math.max(-60, Math.min(60, dy)) * 0.0068); // (a trackpad's small steps a little; a wheel's notch, about ZOOM_STEP)
}

export const panFrom = (anchor, total, frame) => panBy(anchor, [(total[0] * frame.w) / frame.r, (total[1] * frame.h) / frame.r]);

export function gestureStep(view, m, frame, { orbit = true } = {}) {
  if (!m || m.pan) return view;
  if (m.orbit) return orbit ? orbitBy(view, [m.orbit[0] * ORBIT.yaw, -m.orbit[1] * ORBIT.pitch]) : view;
  if (m.zoom !== undefined) {
    const zoomed = zoomBy(view, m.zoom);
    return orbit ? orbitBy(zoomed, [m.turn ?? 0, -(m.tilt ?? 0) * ORBIT.pitch]) : zoomed;
  }
  return view;
}

export function ringStep(ids, key, id) {
  if (!ids.length) return undefined;
  const i = ids.indexOf(id);
  const last = ids.length - 1;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return ids[i < 0 ? 0 : (i + 1) % ids.length];
    case 'ArrowLeft':
    case 'ArrowUp':
      return ids[i < 0 ? last : (i - 1 + ids.length) % ids.length];
    case 'Home':
      return ids[0];
    case 'End':
      return ids[last];
    default:
      return undefined;
  }
}
