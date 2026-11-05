// The open part of the canvas (flight.js's cover()) eased from where it was
// to where the panel now leaves it, so the planets, their names and the
// lens shift glide over when the panel tucks away, a card grows the phone's
// sheet or the touch grid comes, instead of leaping there in one frame.
//
// A critically damped spring, stepped in closed form: no overshoot (the
// view never swings past the panel's edge and back), the same path at any
// frame rate, and a long frame (a tab coming back) lands on the goal rather
// than flying past it. At OPEN_EASE.rate it's 98% of the way in a fifth of
// a second and there, to within half a pixel, in under 0.3 s.
//
//   easeOpen(rect, vel, to, dt) → { rect, vel, done }
//     rect, to: cover()'s { x, y, w, h, sx, sy }; vel: the last step's (null to start still)
//   sameOpen(a, b) → whether two are the same to within a fraction of a pixel

// (rate: 1/s; near: px from the goal, still: px/s, half a pixel a frame at
// 60 Hz, under which it's put on the goal)
export const OPEN_EASE = { rate: 30, near: 0.5, still: 30 };

const KEYS = ['x', 'y', 'w', 'h', 'sx', 'sy'];

export function easeOpen(rect, vel, to, dt, { rate = OPEN_EASE.rate } = {}) {
  const h = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const e = Math.exp(-rate * h);
  const r = {};
  const v = {};
  let done = true;
  for (const k of KEYS) {
    const d = rect[k] - to[k];
    const v0 = vel?.[k] ?? 0;
    const a = v0 + rate * d;
    const nd = (d + a * h) * e;
    const nv = (v0 - rate * a * h) * e;
    r[k] = to[k] + nd;
    v[k] = nv;
    if (Math.abs(nd) > OPEN_EASE.near || Math.abs(nv) > OPEN_EASE.still) done = false;
  }
  // (there: the goal itself, so what reads it compares equal and stops asking for frames)
  return done ? { rect: { ...to }, vel: null, done } : { rect: r, vel: v, done };
}

export const sameOpen = (a, b) => Boolean(a && b) && KEYS.every((k) => Math.abs(a[k] - b[k]) < 0.5);
