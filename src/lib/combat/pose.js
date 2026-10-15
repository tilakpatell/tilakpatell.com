// Where a ship is and how it is turned, in one place: the scene draws a ship
// at its pose and the hull tests hit it at the same one, so what is hit is
// what is seen. A pose is { at0, at1, basis, scale }: the ship’s position at
// the start and end of the step ([x, y, z] each), its rotation as a
// column-major Float32Array(9) (the x, y and z axes) and its drawn size.
// No three.js here (the scene feeds the columns to its own quaternion).

const UP = { x: 0, y: 1, z: 0 };

const arr = (p) => (Array.isArray(p) ? [p[0], p[1], p[2]] : [p.x, p.y, p.z]);

// z along `fwd`, x = up × z (to (1, 0, 0) when they line up), y = z × x, then
// x and y rolled about the nose by `bank` (into the turn)
export function basisOf(fwd, up, bank = 0) {
  const l = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
  const zx = fwd.x / l;
  const zy = fwd.y / l;
  const zz = fwd.z / l;
  let xx = up.y * zz - up.z * zy;
  let xy = up.z * zx - up.x * zz;
  let xz = up.x * zy - up.y * zx;
  if (xx * xx + xy * xy + xz * xz < 1e-8) {
    xx = 1;
    xy = 0;
    xz = 0;
  }
  const xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl;
  xy /= xl;
  xz /= xl;
  let yx = zy * xz - zz * xy;
  let yy = zz * xx - zx * xz;
  let yz = zx * xy - zy * xx;
  if (bank) {
    const c = Math.cos(bank);
    const s = Math.sin(bank);
    const tx = xx * c + yx * s;
    const ty = xy * c + yy * s;
    const tz = xz * c + yz * s;
    yx = yx * c - xx * s;
    yy = yy * c - xy * s;
    yz = yz * c - xz * s;
    xx = tx;
    xy = ty;
    xz = tz;
  }
  return new Float32Array([xx, xy, xz, yx, yy, yz, zx, zy, zz]);
}

// a capital ship’s ride at anchor (still when the scene is reduced)
export const bobOf = (cap, t, reduced) => (reduced ? 0 : Math.sin(t * 0.3 + cap.id) * 0.15);

export function capitalPose(cap, t, reduced) {
  const at = [cap.pos.x, cap.pos.y + bobOf(cap, t, reduced), cap.pos.z];
  return { at0: at, at1: at.slice(), basis: basisOf(cap.fwd, cap.up), scale: cap.size };
}

// a fighter is carried on from its last step (`seen`), top to the world’s up
export function fighterPose(f, frame = 0) {
  void frame;
  return { at0: arr(f.prev ?? f.pos), at1: arr(f.seen ?? f.pos), basis: basisOf(f.fwd, UP, f.bank), scale: f.size };
}

export function runnerPose(r) {
  return { at0: arr(r.prev ?? r.pos), at1: arr(r.seen ?? r.pos), basis: basisOf(r.fwd, UP), scale: r.size };
}

// a hunter flies nose along its velocity (kept as it was when it stops: here
// +z), rolled by −bank (hunters.js lookAt, then rotateZ(−bank))
export function hunterPose(h) {
  const { x, y, z } = h.vel;
  const moving = x * x + y * y + z * z > 1e-6;
  const at = arr(h.pos);
  const prev = h.prev ? arr(h.prev) : at;
  return { at0: prev, at1: at, basis: basisOf(moving ? h.vel : { x: 0, y: 0, z: 1 }, UP, -(h.bank || 0)), scale: h.type.size };
}

// three’s 'YXZ' Euler (yaw about y, then pitch about x, then roll about z) as
// a column-major basis: what rotation.set(pitch, yaw, roll, 'YXZ') draws
export function yxzBasis(pitch, yaw, roll) {
  const a = Math.cos(pitch);
  const b = Math.sin(pitch);
  const c = Math.cos(yaw);
  const d = Math.sin(yaw);
  const e = Math.cos(roll);
  const f = Math.sin(roll);
  const ce = c * e;
  const cf = c * f;
  const de = d * e;
  const df = d * f;
  return new Float32Array([ce + df * b, a * f, cf * b - de, de * b - cf, a * e, df + ce * b, a * d, -b, a * c]);
}

// the player: three’s 'YXZ' Euler of pitch, heading and −bank (galaxy/scene.js
// orientOf), nose along −z. `prev` is where the ship was at the step’s start
export function playerPose(ship, prev) {
  const basis = yxzBasis(ship.pitch || 0, ship.heading, -(ship.bank || 0));
  const at1 = [ship.x, ship.y, ship.z];
  return { at0: prev ? arr(prev) : at1.slice(), at1, basis, scale: 1 };
}

// the director’s capital ship that jumps in on you (universe/capitalRules.js,
// drawn by setpieces.js): its unit model at `len`, turned by rotation.set(pitch,
// heading + π, roll, 'YXZ'), at `at`; still (a streak can’t be hit)
export function pieceCapitalPose(c) {
  const at = [c.at[0], c.at[1], c.at[2]];
  return { at0: at, at1: at.slice(), basis: yxzBasis(c.pitch || 0, c.heading + Math.PI, c.roll || 0), scale: c.len };
}
