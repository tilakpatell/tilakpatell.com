// The fell beast’s flight over the Marshes: round and round a ring high
// over the pools, banked into its turn, its head on the ring’s tangent, so
// its shadow sweeps the marsh and the walkers once a lap. Pure: the scene
// reads where it is and how it leans.
//
//   circle(t, { at = [0, 0], r, period = PERIOD, dir = 1 }) → { x, z, yaw, bank }
//     t: seconds; dir 1 turns anticlockwise seen from above, −1 the other way
//   yaw: the heading (0 along +z, as the scenes’ figures face), bank: the
//   roll into the turn, radians

export const PERIOD = 14; // s a lap
export const BANK = 0.42; // rad: a steady lean into the ring

export function circle(t, { at = [0, 0], r, period = PERIOD, dir = 1 } = {}) {
  const a = dir * (t / period) * Math.PI * 2;
  const x = at[0] + Math.cos(a) * r;
  const z = at[1] + Math.sin(a) * r;
  // (the tangent of (cos a, sin a) as a turns with dir)
  const yaw = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
  return { x, z, yaw, bank: BANK * dir };
}
