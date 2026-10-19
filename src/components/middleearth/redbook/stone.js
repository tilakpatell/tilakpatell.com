// The Palantír, pure (the design’s §5): which place it looks at, and the
// gaze that looks back. Held still, the gaze grows; turning it rests the
// gaze. At EYE seconds the Eye opens inside the stone (`eye`, 0…1 by
// DROP), at DROP the stone is dropped (`dropped` true on that step alone)
// and can’t be held again for a moment.
//
//   newStone() → { held, gaze, eye, dropped, rest }
//   stepStone(stone, dt, { held, turning }) → the next
//   nearest(pins, [x, y], reach) → the pin nearest that point on the sheet, or null

export const EYE = 25; // s
export const DROP = 30; // s
const REST = 3; // s after a drop before it can be held again

export const newStone = () => ({ held: false, gaze: 0, eye: 0, dropped: false, rest: 0 });

export function stepStone(s, dt, { held = false, turning = false } = {}) {
  const rest = Math.max(0, s.rest - dt);
  if (!held || rest > 0) return { held: false, gaze: 0, eye: 0, dropped: false, rest };
  const gaze = s.gaze + (turning ? 0 : dt);
  if (gaze >= DROP) return { held: false, gaze: 0, eye: 0, dropped: true, rest: REST };
  return { held: true, gaze, eye: Math.min(1, Math.max(0, (gaze - EYE) / (DROP - EYE))), dropped: false, rest };
}

export function nearest(pins, [x, y], reach = Infinity) {
  let best = null;
  let d = reach;
  for (const p of pins) {
    const e = Math.hypot(p.at[0] - x, p.at[1] - y);
    if (e < d) {
      d = e;
      best = p;
    }
  }
  return best;
}
