// The flight core's guns, as plain rules both maps fire by (the universe
// map's scene.js and the galaxy's, and the C-137 street's): each ship's
// pace, a fan of shots, a homing round's steering, the pace under a cut
// and one shot's punch. Pure, tested (guns.test.js; fan and steer through
// universe/weapons.test.js, gunsUnder through galaxy/pickups.test.js,
// shotPunch through galaxy/gunRules.test.js, where they were).

// seconds between shots with the trigger held (the X-wing's four cannons
// fire in turn, so it's quickest; the RV is a man with a gun out of the window)
export const CADENCE = { xwing: 0.12, falcon: 0.16, cruiser: 0.19, rv: 0.2 };

// the directions of a fan of `count` shots about `dir` (a unit [x, y, z]),
// `cone` radians apart, spread across the view (side to side, one a little
// high and one low so it reads as a fan, not a line). jitter: −1…1 per shot.
export function fan(dir, count, cone, jitter = () => 0) {
  if (count <= 1 || !cone) return [dir];
  // a side vector (level) and an up vector, both across the shot
  let sx = -dir[2];
  let sz = dir[0];
  const sl = Math.hypot(sx, sz) || 1;
  sx /= sl;
  sz /= sl;
  // up = side × dir (the side vector is level, so its y is 0)
  const ux = -sz * dir[1];
  const uy = sz * dir[0] - sx * dir[2];
  const uz = sx * dir[1];
  const out = [];
  for (let i = 0; i < count; i++) {
    const across = (i - (count - 1) / 2) * cone + jitter() * cone * 0.25;
    const up = (i % 2 ? 0.5 : -0.5) * cone * (i === (count - 1) / 2 ? 0 : 1) + jitter() * cone * 0.25;
    const x = dir[0] + sx * across + ux * up;
    const y = dir[1] + uy * up;
    const z = dir[2] + sz * across + uz * up;
    const l = Math.hypot(x, y, z) || 1;
    out.push([x / l, y / l, z / l]);
  }
  return out;
}

// turn velocity `v` toward `to` (a unit direction) by at most `rate` radians
// a second, keeping its speed: a homing round's steering. In place.
export function steer(v, to, rate, dt) {
  const speed = Math.hypot(v[0], v[1], v[2]) || 1;
  const fx = v[0] / speed;
  const fy = v[1] / speed;
  const fz = v[2] / speed;
  const dot = Math.max(-1, Math.min(1, fx * to[0] + fy * to[1] + fz * to[2]));
  const angle = Math.acos(dot);
  if (angle < 1e-5) return v;
  if (rate * dt >= angle) {
    v[0] = to[0] * speed;
    v[1] = to[1] * speed;
    v[2] = to[2] * speed;
    return v;
  }
  // turned by exactly rate·dt toward `to`, in the plane the two share
  let px = to[0] - fx * dot;
  let py = to[1] - fy * dot;
  let pz = to[2] - fz * dot;
  const pl = Math.hypot(px, py, pz) || 1;
  px /= pl;
  py /= pl;
  pz /= pl;
  const c = Math.cos(rate * dt);
  const s = Math.sin(rate * dt);
  v[0] = (fx * c + px * s) * speed;
  v[1] = (fy * c + py * s) * speed;
  v[2] = (fz * c + pz * s) * speed;
  return v;
}

// Rapid fire's cut to the guns' delay (`delay`, ×0.6) can't take them under
// `fastest`, the quickest any gun may fire. Where that holds it back (the
// X-wing's own are at it already), what it couldn't give in shots it gives in
// punch, so the buff is worth the same a second on every ship: the bolts hit
// `punch` times as hard, up to `cap`. `base` is the seconds between shots as
// the guns are fitted. → { gap: seconds between shots, punch } written into
// `out` (this is asked every frame the trigger is down).
export const RAPID_PUNCH_CAP = 1.5;
// The pace under a cut in general: `base` the seconds between shots as
// the guns are fitted, under `fastest` as they may be, and what a quicker
// part or a pickup can't give in shots it gives in punch, up to the cap.
export function pace(base, delay, fastest, out = { gap: 0, punch: 1 }) {
  const wanted = base * delay;
  out.gap = Math.max(fastest, wanted);
  out.punch = Math.min(RAPID_PUNCH_CAP, out.gap / wanted);
  return out;
}
export function gunsUnder(base, delay, fastest, out = { gap: 0, punch: 1 }) {
  return pace(Math.max(fastest, base), delay, fastest, out); // (from what they fire at without it)
}

// one shot's punch on a hunter: the guns fitted in the shipyard (g), the
// pickups' rapid fire (gun) and the weapon's own (w)
export const shotPunch = (w, g, gun) => (g?.punch ?? 1) * (gun?.punch ?? 1) * (w?.punch ?? 1);
