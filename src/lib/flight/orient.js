// Which way round the ship is, in 3D, as plain numbers: quaternions as
// [x, y, z, w], and the three angles the rest of the map keeps (ship.js's
// heading, pitch and bank). Pure (no three.js), so it's tested in Node and
// can go anywhere: ship.js turns the ship with it, the multiplayer's
// protocol blends other pilots' poses with it.
//
// The angles are three.js's 'YXZ' Euler: turn by `heading` about +y (0 is
// the nose down −z, growing turning left), tip the nose up by `pitch` about
// the ship's own x, then roll it right by `bank` about its own nose. Any way
// round at all comes out as them (pitch within ±π/2, bank within ±π: over
// the top of a loop, heading swings round half a turn and bank turns over),
// so a model set from them (group.rotation.set(pitch, heading, −bank, 'YXZ'))
// is the ship exactly, upside down or straight up.

export const NOSE = [0, 0, -1];
export const UP = [0, 1, 0];
export const RIGHT = [1, 0, 0];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function normalize(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

// a then b: b turned in a's frame (a · b)
export function mul(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}

// the turn back (rotate(conj(q), v) is v in q's own frame)
export const conj = (q) => [-q[0], -q[1], -q[2], q[3]];

// a turn of `angle` radians about a unit axis
export function axisAngle(axis, angle) {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

// v turned by q
export function rotate(q, v) {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  // t = 2 (q.xyz × v); v + w t + q.xyz × t
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

export function fromAngles(heading, pitch = 0, bank = 0) {
  const c1 = Math.cos(pitch / 2);
  const s1 = Math.sin(pitch / 2);
  const c2 = Math.cos(heading / 2);
  const s2 = Math.sin(heading / 2);
  const c3 = Math.cos(-bank / 2);
  const s3 = Math.sin(-bank / 2);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3];
}

export function toAngles(q) {
  const [x, y, z, w] = normalize(q);
  const m13 = 2 * (x * z + y * w);
  const m21 = 2 * (x * y + z * w);
  const m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - x * w);
  const m33 = 1 - 2 * (x * x + y * y);
  const pitch = Math.asin(-clamp(m23, -1, 1));
  if (Math.abs(m23) < 1 - 1e-10) return { heading: Math.atan2(m13, m33), pitch, bank: -Math.atan2(m21, m22) };
  // straight up or down: the turn and the roll are the same thing, all of it the turn
  const m11 = 1 - 2 * (y * y + z * z);
  const m31 = 2 * (x * z - y * w);
  return { heading: Math.atan2(-m31, m11), pitch, bank: 0 };
}

// the shortest way from a to b, t of the way (0 is a, 1 is b)
export function slerp(a, b, t) {
  let [bx, by, bz, bw] = b;
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (cos > 0.9995) return normalize([a[0] + (bx - a[0]) * t, a[1] + (by - a[1]) * t, a[2] + (bz - a[2]) * t, a[3] + (bw - a[3]) * t]);
  const th = Math.acos(cos);
  const s = Math.sin(th);
  const ka = Math.sin((1 - t) * th) / s;
  const kb = Math.sin(t * th) / s;
  return [a[0] * ka + bx * kb, a[1] * ka + by * kb, a[2] * ka + bz * kb, a[3] * ka + bw * kb];
}

// q with its nose swung toward `dir` (a unit vector, the map's own axes) by
// at most `max` radians, the shortest way (so it keeps as much of its roll
// as it can)
export function turnToward(q, dir, max) {
  if (!(max > 0)) return q;
  const f = rotate(q, NOSE);
  const ax = [f[1] * dir[2] - f[2] * dir[1], f[2] * dir[0] - f[0] * dir[2], f[0] * dir[1] - f[1] * dir[0]];
  const s = Math.hypot(ax[0], ax[1], ax[2]);
  const c = f[0] * dir[0] + f[1] * dir[1] + f[2] * dir[2];
  const angle = Math.atan2(s, c);
  if (angle < 1e-9) return q;
  // (dead the other way: over the top, about the ship's own right)
  const axis = s > 1e-9 ? [ax[0] / s, ax[1] / s, ax[2] / s] : rotate(q, RIGHT);
  return normalize(mul(axisAngle(axis, Math.min(angle, max)), q));
}
