// Ship contact: what happens when your ship flies into another ship. The law
// is shared by every map you fly (the universe and the galaxy), so it knows
// no world and no three.js; a scene reads its numbers, never copies them.
//
// CONTACT: every number of the law (closing speeds in units a second).
// bodyRadius(size) → a ship's body for contact, from its size (its length).
// sweptSpheres(a0, a1, b0, b1, r) → how far through the frame (0 to 1) two
//   spheres moving at once came within `r` of each other, or null. Points
//   are { x, y, z } or [x, y, z].
// touchAt(a0, a1, b0, b1, r) → the same test, answering the moment they
//   first came within `r` (0 when they already were), not the nearest: where
//   two ships met, so the push and the closing speed are read there.
// closingSpeed(vYou, vThem, normal) → how fast the two close along `normal`
//   (pointing from them toward you), 0 when they part.
// contact(into, size) → { kind: 'glance' | 'ram', damage, punch, keep, push }:
//   under `soft` a glance (no harm, most of your speed kept); else a ram
//   (shields lost by the other ship's size and the closing speed, capped;
//   `punch` hits on the other ship; `keep` the share of your speed kept);
//   `push` how hard the other ship's knocked off its line (shove's).
// shove(into, size) → units a second added to the other ship's way, along
//   the contact: `shove` of the closing speed, less for a ship bigger than
//   `shoveSize`, capped.
// knock(o, dv): the other ship ({ vel, bank, side? }, a hunter's or a
//   wingman's, flown by their rules) knocked: `dv` added to its way, so its
//   nose is off its line and comes back round at its own turn rate; rocked
//   by it.
// keptSpeed(speed, keep, boost) → your speed after it: `keep` of it, but
//   from twice the boost no lower than the boost (a rock's rule; between,
//   no lower than how far past the boost you were), and never faster than
//   you were; the sign kept.
//
// A ship too big to move (a capital, a battleship) is not a body for this
// law: it is a solid, and ship.js's step bumps or crashes you on it as on a
// planet. Pure: no three.js.

export const CONTACT = {
  soft: 1.3, // closing speed under which it's a glance (SHIP.crash's 2.4 × 0.55, as a planet's soft bump)
  crash: 2.4, // and over which a big ship is a crash (SHIP.crash; a small ship is never a crash)
  base: 6, // shields a ram takes, at least
  perSize: 7, // and for each unit of the other ship's size (its length, as the fleets give it)
  perSpeed: 0.5, // and for each unit a second of closing speed past `soft`
  most: 45, // at most (ROCK_HIT.most)
  cool: 0.35, // seconds after a contact before another with the same ship counts
  slow: 0.3, // the share of your speed kept after a ram (ROCK_HIT.slow)
  glance: 0.85, // and after a glance
  punchEvery: 5, // a ram is one hit on the other ship, and one more for each of these units a second past `soft`
  punchMost: 4,
  shove: 0.5, // the share of the closing speed the other ship's knocked off its line by
  shoveSize: 0.5, // a ship longer than this is knocked less, by its length
  shoveMost: 6,
  rock: 0.3, // its bank rocked by this for each unit a second of the knock (at most 1.1)
};

// tighter than hunterRules' hitRadius, which forgives a laser
export const bodyRadius = (size) => size * 0.5 + 0.08;

const X = (p) => (Array.isArray(p) ? p[0] : p.x);
const Y = (p) => (Array.isArray(p) ? p[1] : p.y);
const Z = (p) => (Array.isArray(p) ? p[2] : p.z);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// (targeting.js's sweptHit, moved here; it re-exports this.) Tested against
// where the other is only at the end of the frame, a quick one crossing the
// way would be missed, so both move at once.
export function sweptSpheres(a0, a1, b0, b1, r) {
  const rx = X(a0) - X(b0);
  const ry = Y(a0) - Y(b0);
  const rz = Z(a0) - Z(b0);
  const dx = X(a1) - X(b1) - rx;
  const dy = Y(a1) - Y(b1) - ry;
  const dz = Z(a1) - Z(b1) - rz;
  const dd = dx * dx + dy * dy + dz * dz;
  const k = dd > 1e-12 ? clamp(-(rx * dx + ry * dy + rz * dz) / dd, 0, 1) : 0;
  const px = rx + dx * k;
  const py = ry + dy * k;
  const pz = rz + dz * k;
  return px * px + py * py + pz * pz <= r * r ? k : null;
}

export function touchAt(a0, a1, b0, b1, r) {
  const rx = X(a0) - X(b0);
  const ry = Y(a0) - Y(b0);
  const rz = Z(a0) - Z(b0);
  const c = rx * rx + ry * ry + rz * rz - r * r;
  if (c <= 0) return 0;
  const dx = X(a1) - X(b1) - rx;
  const dy = Y(a1) - Y(b1) - ry;
  const dz = Z(a1) - Z(b1) - rz;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-12) return null;
  const b = rx * dx + ry * dy + rz * dz; // half the linear term
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const k = (-b - Math.sqrt(disc)) / a;
  return k >= 0 && k <= 1 ? k : null;
}

export function closingSpeed(vYou, vThem, normal) {
  return Math.max(
    0,
    (vThem.x - vYou.x) * normal.x + (vThem.y - vYou.y) * normal.y + (vThem.z - vYou.z) * normal.z,
  );
}

export function contact(into, size) {
  const push = shove(into, size);
  if (into < CONTACT.soft) return { kind: 'glance', damage: 0, punch: 0, keep: CONTACT.glance, push };
  const past = into - CONTACT.soft;
  return {
    kind: 'ram',
    damage: Math.min(CONTACT.most, CONTACT.base + CONTACT.perSize * size + CONTACT.perSpeed * past),
    punch: Math.min(CONTACT.punchMost, 1 + Math.floor(past / CONTACT.punchEvery)),
    keep: CONTACT.slow,
    push,
  };
}

export function shove(into, size) {
  return Math.min(CONTACT.shoveMost, (Math.max(0, into) * CONTACT.shove) / Math.max(1, size / CONTACT.shoveSize));
}

export function knock(o, dv) {
  o.vel.x += dv.x;
  o.vel.y += dv.y;
  o.vel.z += dv.z;
  const m = Math.sqrt(dv.x * dv.x + dv.y * dv.y + dv.z * dv.z);
  o.bank = clamp((o.bank ?? 0) + (o.side ?? 1) * Math.min(1.1, m * CONTACT.rock), -1.6, 1.6);
}

// (the floor eases in past the boost, `s − boost` up to the boost itself: a
// step at the boost let a ram at the boost's overshoot, or a tuned boost,
// keep nearly all its speed while one at the boost lost most of it)
export function keptSpeed(speed, keep, boost) {
  const s = Math.abs(speed);
  return Math.sign(speed) * Math.max(s * keep, clamp(s - boost, 0, boost));
}
