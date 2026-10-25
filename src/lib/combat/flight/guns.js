// The flight core's guns, as plain rules both maps fire by (the universe
// map's scene.js and the galaxy's, and the C-137 street's): each ship's
// pace, a fan of shots, a homing round's steering, the pace under a cut,
// one shot's punch, and the pool of bolts in flight. Pure, tested
// (guns.test.js; fan and steer through universe/weapons.test.js, gunsUnder
// through galaxy/pickups.test.js, shotPunch through galaxy/gunRules.test.js,
// where they were).
//
//   createGuns({ count = 40, point }) → { bolts, fire, step, strike, clear }
//     point: () → a point { x, y, z } (the scene's THREE.Vector3, so its hit
//       tests get what they always did); made here, once, and never after
//     bolts: the slots, { on, at, from, v, life, punch, damage, heavy, warPunch,
//       heading, pitch, scale, fresh } (fresh: true till the scene has turned and
//       sized the mesh it draws the slot with)
//     fire(at, dirs, speed, { life, punch, damage, heavy = false, scale }): a bolt
//       along each unit direction, from a copy of at (a full pool takes slot 0)
//     step(dt, sources) → any still in flight: each bolt on by v·dt, offered to
//       the sources in order till one takes it
//     strike(from, to, shot, sources) → what took it, or null: one shot's
//       segment offered to the sources, from copies of from and to
//     clear(): every bolt gone
//   a source: (from, to, shot) → truthy if it took the shot (and played what
//     the hit does: that's the scene's)
//   a shot: { punch, damage, v, heavy, warPunch }; strike's `v` is the way
//     from → to when the shot has none

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

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createGuns({ count = 40, point }) {
  const bolts = [];
  for (let i = 0; i < count; i++) bolts.push({ on: false, at: point(), from: point(), v: [0, 0, 0], life: 0, punch: 1, damage: undefined, heavy: false, warPunch: 1, heading: 0, pitch: 0, scale: 1, fresh: false });
  // (strike's segment and shot, kept)
  const sFrom = point();
  const sTo = point();
  const sShot = { punch: 1, damage: undefined, v: [0, 0, 0], heavy: false, warPunch: 1 };
  const free = () => {
    for (let i = 0; i < bolts.length; i++) if (!bolts[i].on) return bolts[i];
    return bolts[0];
  };
  return {
    bolts,
    fire(at, dirs, speed, { life, punch, damage, heavy = false, scale }) {
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i];
        const b = free();
        b.on = true;
        b.fresh = true;
        b.at.x = at.x;
        b.at.y = at.y;
        b.at.z = at.z;
        b.v[0] = d[0] * speed;
        b.v[1] = d[1] * speed;
        b.v[2] = d[2] * speed;
        b.life = life;
        b.punch = punch;
        b.damage = damage;
        b.heavy = heavy;
        b.warPunch = punch;
        b.scale = scale;
        // (targeting.js's aimAngles, without its arrays: the same to the bit)
        const l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) || 1;
        b.heading = Math.atan2(-(d[0] / l), -(d[2] / l));
        b.pitch = Math.asin(clamp(d[1] / l, -1, 1));
      }
    },
    step(dt, sources) {
      let any = false;
      for (let i = 0; i < bolts.length; i++) {
        const b = bolts[i];
        if (!b.on) continue;
        b.life -= dt;
        if (b.life <= 0) {
          b.on = false;
          continue;
        }
        any = true;
        b.from.x = b.at.x;
        b.from.y = b.at.y;
        b.from.z = b.at.z;
        b.at.x += b.v[0] * dt;
        b.at.y += b.v[1] * dt;
        b.at.z += b.v[2] * dt;
        for (let k = 0; k < sources.length; k++) {
          if (sources[k](b.from, b.at, b)) {
            b.on = false;
            break;
          }
        }
      }
      return any;
    },
    strike(from, to, shot, sources) {
      sFrom.x = from.x;
      sFrom.y = from.y;
      sFrom.z = from.z;
      sTo.x = to.x;
      sTo.y = to.y;
      sTo.z = to.z;
      sShot.punch = shot.punch;
      sShot.damage = shot.damage;
      if (shot.v) {
        sShot.v[0] = shot.v[0];
        sShot.v[1] = shot.v[1];
        sShot.v[2] = shot.v[2];
      } else {
        sShot.v[0] = to.x - from.x;
        sShot.v[1] = to.y - from.y;
        sShot.v[2] = to.z - from.z;
      }
      sShot.heavy = shot.heavy ?? false;
      sShot.warPunch = shot.warPunch ?? shot.punch;
      for (let k = 0; k < sources.length; k++) {
        const r = sources[k](sFrom, sTo, sShot);
        if (r) return r;
      }
      return null;
    },
    clear() {
      for (let i = 0; i < bolts.length; i++) bolts[i].on = false;
    },
  };
}
