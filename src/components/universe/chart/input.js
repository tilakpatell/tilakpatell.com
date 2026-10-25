// The chart's hands and keys, as views: what a key, the wheel, a drag and two
// fingers (lib/gesture.js's messages) do to the chart. Pure: no React, no DOM,
// no three.js. useChartView.js feeds it the browser's events.
//
// ZOOM_STEP: a button's or a key's zoom (the galaxy map's)
// ORBIT = { yaw, pitch }: the radians a drag across the whole box turns and tilts
// chartKey({ key, meta, ctrl, alt }, { typing }) → 'zoomIn' | 'zoomOut' | 'back' | null:
//   + and = zoom in, - and _ zoom out, 0 goes back to the ship; nothing while
//   typing (a minus is the field's) or with a modifier. A KeyboardEvent's own
//   metaKey, ctrlKey and altKey count the same, so the event can go in as it is.
//   Shift never counts: it is how + and _ are typed.
// wheelFactor(deltaY, deltaMode) → the zoom a turn of the wheel gives
// panFrom(anchor, total, frame) → View: a whole drag's pan, from the view at
//   its first move (projection.js's panBy says why a fisheye can't pan step by step)
// gestureStep(view, message, frame, { orbit }) → View, for every message but a pan
// ringStep(ids, key, id) → the id the arrows, Home or End go to, or undefined
// createClicks() → { click(swallow, detail), double() }: whether a click, or a
//   double click, is a drag's and to be swallowed
//
// A pinch zooms about the focus, as the wheel and the keys do, so a followed
// ship stays in the middle. Two fingers turning turn the chart, and sliding up
// tilts it, as a drag up with the modifier does. A message that changes
// nothing, or one with no number in it, gives back the same view.

import { orbitBy, panBy, zoomBy } from './projection';

export const ZOOM_STEP = 1.5;
export const ORBIT = Object.freeze({ yaw: Math.PI, pitch: Math.PI / 2 });

const KEYS = Object.freeze({ '+': 'zoomIn', '=': 'zoomIn', '-': 'zoomOut', _: 'zoomOut', 0: 'back' });
const LINE = { 0: 1, 1: 16, 2: 120 }; // (a wheel's delta in px, lines or pages: Firefox's wheel is in lines)
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function chartKey(e, { typing = false } = {}) {
  if (!e || typing || e.meta || e.ctrl || e.alt || e.metaKey || e.ctrlKey || e.altKey) return null;
  return Object.hasOwn(KEYS, e.key) ? KEYS[e.key] : null;
}

export function wheelFactor(deltaY, deltaMode) {
  const dy = deltaY * (LINE[deltaMode] ?? 1);
  if (!Number.isFinite(dy)) return 1;
  return Math.exp(-clamp(dy, -60, 60) * 0.0068); // (a trackpad's small steps a little; a wheel's notch, about ZOOM_STEP)
}

// total is the drag's summed pan, in fractions of the box: a box's width is
// the frame's w, and the frame's radius r is 1 on the chart
export const panFrom = (anchor, total, frame) => panBy(anchor, [(total[0] * frame.w) / frame.r, (total[1] * frame.h) / frame.r]);

// (frame is the box the message was read in: a pan needs it, and every other
// message is in the box's own fractions already)
export function gestureStep(view, message, frame, { orbit = true } = {}) {
  if (!message || message.pan) return view;
  if (message.orbit) return orbit ? orbitBy(view, [message.orbit[0] * ORBIT.yaw, -message.orbit[1] * ORBIT.pitch]) : view;
  if (!('zoom' in message)) return view;
  const zoomed = zoomBy(view, message.zoom);
  return orbit ? orbitBy(zoomed, [message.turn, -message.tilt * ORBIT.pitch]) : zoomed;
}

// one focus group's arrows: they step and wrap, and from an id not in it the
// first step lands on the end the key points away from (right on the first,
// left on the last); Home and End jump to the ends
export function ringStep(ids, key, id) {
  const n = ids.length;
  if (!n) return undefined;
  const i = ids.indexOf(id);
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return ids[i < 0 ? n - 1 : (i - 1 + n) % n];
    case 'ArrowRight':
    case 'ArrowDown':
      return ids[i < 0 ? 0 : (i + 1) % n];
    case 'Home':
      return ids[0];
    case 'End':
      return ids[n - 1];
    default:
      return undefined;
  }
}

// A drag's click is swallowed (swallow is gesture.js's takeClick()), and so
// is the double click it is part of, either way round: a place's double click
// sends the ship, and a press on its name that moved the chart must never do
// that. A click series starts again at a detail of 1; a keyboard's click
// (detail 0) is never a drag's.
export function createClicks() {
  let dragged = false; // (whether the series under way has had a drag's click in it)
  return {
    click(swallow, detail) {
      if (!(detail > 1)) dragged = false;
      const drags = Boolean(swallow) && detail > 0;
      if (drags) dragged = true;
      return drags;
    },
    double() {
      const was = dragged;
      dragged = false;
      return was;
    },
  };
}
