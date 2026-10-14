// Where a ship is and how it is turned, in one place: the scene draws a ship
// at its pose and the hull tests hit it at the same one, so what is hit is
// what is seen. A pose is { at0, at1, basis, scale }: the ship’s position at
// the start and end of the step ([x, y, z] each), its rotation as a
// column-major Float32Array(9) (the x, y and z axes) and its drawn size.
// No three.js here (the scene feeds the columns to its own quaternion).
//
// Each takes an optional `out` (newPose()'s, or a Float32Array(9) for
// basisOf) to fill in place: the war asks for its ships' poses every step,
// for every bolt near one, and makes nothing new doing it.

const UP = { x: 0, y: 1, z: 0 };

const arr = (p) => (Array.isArray(p) ? [p[0], p[1], p[2]] : [p.x, p.y, p.z]);
// p's xyz into the three-long array o
const into = (o, p) => {
  if (Array.isArray(p)) {
    o[0] = p[0];
    o[1] = p[1];
    o[2] = p[2];
  } else {
    o[0] = p.x;
    o[1] = p.y;
    o[2] = p.z;
  }
  return o;
};

// a pose to fill: { at0, at1, basis, scale }
export const newPose = () => ({ at0: [0, 0, 0], at1: [0, 0, 0], basis: new Float32Array(9), scale: 1 });

// z along `fwd`, x = up × z (to (1, 0, 0) when they line up), y = z × x, then
// x and y rolled about the nose by `bank` (into the turn)
export function basisOf(fwd, up, bank = 0, out = null) {
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
  const m = out ?? new Float32Array(9);
  m[0] = xx;
  m[1] = xy;
  m[2] = xz;
  m[3] = yx;
  m[4] = yy;
  m[5] = yz;
  m[6] = zx;
  m[7] = zy;
  m[8] = zz;
  return m;
}

// a capital ship’s ride at anchor (still when the scene is reduced)
export const bobOf = (cap, t, reduced) => (reduced ? 0 : Math.sin(t * 0.3 + cap.id) * 0.15);

export function capitalPose(cap, t, reduced, out = null) {
  const y = cap.pos.y + bobOf(cap, t, reduced);
  if (!out) {
    const at = [cap.pos.x, y, cap.pos.z];
    return { at0: at, at1: at.slice(), basis: basisOf(cap.fwd, cap.up), scale: cap.size };
  }
  out.at0[0] = out.at1[0] = cap.pos.x;
  out.at0[1] = out.at1[1] = y;
  out.at0[2] = out.at1[2] = cap.pos.z;
  basisOf(cap.fwd, cap.up, 0, out.basis);
  out.scale = cap.size;
  return out;
}

// a fighter is carried on from its last step (`seen`), top to the world’s up
export function fighterPose(f, frame = 0, out = null) {
  void frame;
  if (!out) return { at0: arr(f.prev ?? f.pos), at1: arr(f.seen ?? f.pos), basis: basisOf(f.fwd, UP, f.bank), scale: f.size };
  into(out.at0, f.prev ?? f.pos);
  into(out.at1, f.seen ?? f.pos);
  basisOf(f.fwd, UP, f.bank, out.basis);
  out.scale = f.size;
  return out;
}

export function runnerPose(r, out = null) {
  if (!out) return { at0: arr(r.prev ?? r.pos), at1: arr(r.seen ?? r.pos), basis: basisOf(r.fwd, UP), scale: r.size };
  into(out.at0, r.prev ?? r.pos);
  into(out.at1, r.seen ?? r.pos);
  basisOf(r.fwd, UP, 0, out.basis);
  out.scale = r.size;
  return out;
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

// the player: three’s 'YXZ' Euler of pitch, heading and −bank (galaxy/scene.js
// orientOf), nose along −z. `prev` is where the ship was at the step’s start
export function playerPose(ship, prev) {
  const a = Math.cos(ship.pitch || 0);
  const b = Math.sin(ship.pitch || 0);
  const c = Math.cos(ship.heading);
  const d = Math.sin(ship.heading);
  const r = -(ship.bank || 0);
  const e = Math.cos(r);
  const f = Math.sin(r);
  const ce = c * e;
  const cf = c * f;
  const de = d * e;
  const df = d * f;
  const basis = new Float32Array([ce + df * b, a * f, cf * b - de, de * b - cf, a * e, df + ce * b, a * d, -b, a * c]);
  const at1 = [ship.x, ship.y, ship.z];
  return { at0: prev ? arr(prev) : at1.slice(), at1, basis, scale: 1 };
}
