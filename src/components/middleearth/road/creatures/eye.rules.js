// The Eye of Sauron, pure: its gaze swept back and forth over the land,
// resting at each end, and whether its beam is on you.
//
//   SWEEP: seconds a sweep there and back takes
//   sweep(t) → { yaw (rad, + to its left), pause (resting at an end) }
//   onYou(yawTo, yaw) → boolean: the beam on what lies at yawTo, the short way round

export const SWEEP = 16; // s
const WIDE = 1.2; // rad either way
const HALF = 0.18; // rad: the beam’s half width
const REST = 0.15; // the share of a sweep it rests at each end

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function sweep(t) {
  const u = (((t % SWEEP) + SWEEP) % SWEEP) / SWEEP;
  const move = 0.5 - REST;
  if (u < REST) return { yaw: -WIDE, pause: true };
  if (u < 0.5) return { yaw: -WIDE + 2 * WIDE * smooth((u - REST) / move), pause: false };
  if (u < 0.5 + REST) return { yaw: WIDE, pause: true };
  return { yaw: WIDE - 2 * WIDE * smooth((u - 0.5 - REST) / move), pause: false };
}

export function onYou(yawTo, yaw) {
  const d = Math.atan2(Math.sin(yawTo - yaw), Math.cos(yawTo - yaw));
  return Math.abs(d) <= HALF;
}
