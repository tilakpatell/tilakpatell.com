// Every vehicle seat's camera, from the game's rows
// (src/data/bf2017/cameras.json's `vehicles`: each vehicle's camera layer,
// ThirdPersonCameraTransformerEntityData in seat order and its
// VelocityRedirectCameraTransformerEntityData). Pure: no three.js.
//
//   createVehicleMemo() → the look kept between frames and through a seat change
//   vehicleLook(memo, seat, input, dt) → { yaw, pitch } (degrees, relative to the vehicle)
//     seat: rows.vehicles[id].seats[i] ({ pitch: [lo, hi], yaw: [lo, hi], inertia: { input, none } })
//     input: { yaw, pitch } this frame's look (radians, the walker's senses:
//       yaw about the up from +z toward +x, positive pitch looks up), zero or
//       absent for none
//   redirectFor(row, seat) → the seat's redirect chain, or null
//   redirect(memo, chain, motion, dt) → offsets (degrees), one per entry
//   vehiclePose(memo, seat, input, dt, { pivot, heading, arm, fov, offset })
//     → { at, lookAt, fov, roll, yaw, pitch }
//
// The transformer chain: the look's rates carry `inertia.input` of
// themselves each of the game's ticks while there is input, `inertia.none`
// when there is none (so a stick let go coasts and stops), the angles
// within the seat's limits. A seat change keeps the angles and their rates:
// an angle outside the new seat's limits is drawn back inside at
// LIMIT_SETTLE per second (no snap), and a rate pushing it further out dies
// at the same rate; an angle inside meets the limit as a wall.
// The redirect: each RedirectData entry turns one of the vehicle's motions
// into the camera's turn at its ConversionRate (a negative rate leans the
// camera against it), smoothed by its Inertia per tick. Which motion each
// entry reads is the transformer's own and not in the export, so the caller
// hands `motion` in the record's order (lane 5's vehicles: the turn rate,
// the climb rate, the speed, the slip).

// (hand: the game's simulation rate; the record's Inertia is the share of
// a rate kept from one tick to the next)
export const TICK = 30;
// (hand: how fast a seat change brings an angle inside its new limits, per
// second: within a second, all but e^-6 of the way)
export const LIMIT_SETTLE = 6;
// (hand: the seat's arm and field when the vehicle's rows have none; the
// cameras' offsets are in the vehicles' meshes, not the export)
export const VEHICLE_ARM = 8;
export const VEHICLE_FOV = 70;

const RAD = Math.PI / 180;
const fin = (v) => Number.isFinite(v);
const keepFor = (inertia, dt) => (dt > 0 ? Math.pow(Math.max(0, Math.min(1, inertia ?? 0)), dt * TICK) : 1);

export function createVehicleMemo() {
  return { yaw: 0, pitch: 0, vy: 0, vp: 0, offsets: [] };
}

export function redirectFor(row, seat = 0) {
  return row?.redirect?.[seat] ?? null;
}

// one axis: the rate with its inertia, the angle within [lo, hi]
function axis(angle, rate, want, input, seatInertia, limits, dt) {
  const keep = keepFor(input ? seatInertia?.input : seatInertia?.none, dt);
  let v = rate * keep + want * (1 - keep);
  let a = angle + v * dt;
  const [lo, hi] = limits ?? [-Infinity, Infinity];
  const wasOut = angle < lo - 1e-9 || angle > hi + 1e-9;
  if (wasOut) {
    // (outside since a seat change: drawn back in, the outward rate dying)
    const settle = Math.exp(-LIMIT_SETTLE * dt);
    const edge = angle < lo ? lo : hi;
    const out = Math.sign(angle - edge);
    if (Math.sign(v) === out) v *= settle;
    a = angle + v * dt;
    a = edge + (a - edge) * settle;
    if ((out > 0 && a < edge) || (out < 0 && a > edge)) a = edge;
  } else if (a < lo || a > hi) {
    a = a < lo ? lo : hi;
    v = 0;
  }
  return [a, v];
}

export function vehicleLook(memo, seat, input = {}, dt = 0) {
  const h = fin(dt) && dt > 0 ? dt : 0;
  const iy = fin(input?.yaw) ? input.yaw / RAD : 0;
  const ip = fin(input?.pitch) ? input.pitch / RAD : 0;
  const has = iy !== 0 || ip !== 0;
  // (the look's rate this frame, degrees a second)
  const wy = h > 0 ? iy / h : 0;
  const wp = h > 0 ? ip / h : 0;
  [memo.yaw, memo.vy] = axis(memo.yaw, memo.vy, wy, has, seat?.inertia, seat?.yaw, h);
  [memo.pitch, memo.vp] = axis(memo.pitch, memo.vp, wp, has, seat?.inertia, seat?.pitch, h);
  return { yaw: memo.yaw, pitch: memo.pitch };
}

export function redirect(memo, chain, motion = [], dt = 0) {
  const h = fin(dt) && dt > 0 ? dt : 0;
  const out = (memo.offsets ??= []);
  (chain ?? []).forEach((d, i) => {
    const keep = keepFor(d.inertia, h);
    const want = (d.rate ?? 0) * (fin(motion[i]) ? motion[i] : 0);
    out[i] = (out[i] ?? 0) * keep + want * (1 - keep);
  });
  out.length = chain?.length ?? 0;
  return out;
}

export function vehiclePose(memo, seat, input, dt, { pivot = [0, 0, 0], heading = 0, arm = VEHICLE_ARM, fov = VEHICLE_FOV, offset = null } = {}) {
  const look = vehicleLook(memo, seat, input, dt);
  // (the look over the vehicle's heading, the redirect's offsets on top)
  const yaw = heading + (look.yaw + (offset?.yaw ?? 0)) * RAD;
  const pitch = (look.pitch + (offset?.pitch ?? 0)) * RAD;
  const cp = Math.cos(pitch);
  const d = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
  const at = [pivot[0] - d[0] * arm, pivot[1] - d[1] * arm, pivot[2] - d[2] * arm];
  return { at, lookAt: [at[0] + d[0], at[1] + d[1], at[2] + d[2]], fov, roll: 0, yaw: look.yaw, pitch: look.pitch };
}
