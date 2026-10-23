// Space, as plain numbers: what happens once Mark flies up out of the
// city's air (./flight.js says when, with an 'exit'). The Earth is a
// sphere with the city on top of it, so where he was over the city is
// where he is over the world: [x, RE + y, z]. Up here he drifts where he
// was going (there's no air to slow him), goes twenty-odd times faster
// flat out, lands on the Moon or Mars and stands on them, jumps off again,
// and when he dives back into the air ('reenter') he comes down over the
// city again. The distances are a game's, not the solar system's: the
// Moon is a couple of minutes' cruise away, Mars a long flat-out flight.

import { pressOf, turn } from './flight';
import { WORLD } from './map';

export const SPACE = {
  RE: 60000, // the Earth's radius
  cruise: 500, // m/s, with only a direction held
  top: 6000, // flat out
  accel: 350,
  boostAccel: 1600,
  brake: 700,
  drift: 0.04, // how much of his speed goes, a second, with nothing held
  // low over the Moon or Mars (within `low` m of the ground) he flies as in the air: a walk's
  // cruise and the air's flat out, braking hard into them, and still when let go, so he can come
  // to an astronaut, carry one to the ship and fight on the ground (./offworld/mars.js)
  low: 400,
  lowCruise: 30,
  lowTop: 160,
  lowAccel: 120,
  lowBrake: 2100,
  lowStop: 2,
  blend: 600, // over `low`, up turns from the ground's to the sky's across this many metres
  reentry: WORLD.ceiling - 1500, // back into the air below this
  bound: 900000,
};

// what's out there: [x, y, z] its middle, r its radius
export const BODIES = [
  // (both low over the city's horizon, on the side the noon sun lights from the Earth)
  { id: 'moon', name: 'The Moon', c: [111000, 18000, -99000], r: 9000 },
  { id: 'mars', name: 'Mars', c: [86000, 64500, -417000], r: 7000 },
];

const STEP = 1 / 120;
const len = (v) => Math.hypot(v[0], v[1], v[2]);
export const altitudeOf = (h) => len(h.p) - SPACE.RE;

// From the city's air to space: the same place, the same speed.
export function intoSpace(h) {
  return { ...h, zone: 'space', p: [h.p[0], SPACE.RE + h.p[1], h.p[2]], v: [...h.v], dir: [...h.dir], mode: 'air', perch: null, reentered: false, ev: [] };
}

// From space back into the city's air: over the city (wherever he came
// down: it's the only city there is), just under the top of the sky,
// coming down.
export function outOfSpace(h) {
  const r = len(h.p) || 1;
  const up = h.p.map((v) => v / r);
  const lim = WORLD.half - 250;
  const over = up[1] > 0.96;
  const x = over ? Math.max(-lim, Math.min(lim, h.p[0])) : 0;
  const z = over ? Math.max(-lim, Math.min(lim, h.p[2])) : 0;
  const radial = h.v[0] * up[0] + h.v[1] * up[1] + h.v[2] * up[2];
  let v = [h.v[0] - up[0] * radial, Math.min(-40, radial), h.v[2] - up[2] * radial];
  const sp = len(v);
  if (sp > 450) v = v.map((c) => (c * 450) / sp);
  const s = len(v) || 1;
  return { ...h, zone: 'city', mode: 'air', p: [x, WORLD.ceiling - 300, z], v, spd: s, dir: v.map((c) => c / s), perch: null, boomed: s > 120, exited: true, stun: 0, crouch: 0, ev: [] };
}

// how high a point is over the ground of the nearest of the Moon and Mars
export function overBody(p) {
  let best = Infinity;
  for (const b of BODIES) best = Math.min(best, Math.hypot(p[0] - b.c[0], p[1] - b.c[1], p[2] - b.c[2]) - b.r);
  return best;
}
// Which way is up at p: away from the ground of the Moon or Mars low over it
// (and on it), the sky's up (+y) far from both, turned between across
// `blend` over `low`. The camera's frame (./scene.js), his look
// (./InvWorld.jsx) and his flight here all stand on it.
export function upOver(p) {
  let best = null;
  for (const b of BODIES) {
    const d = [p[0] - b.c[0], p[1] - b.c[1], p[2] - b.c[2]];
    const l = Math.hypot(...d);
    if (!best || l - b.r < best.alt) best = { alt: l - b.r, n: d.map((c) => c / (l || 1)) };
  }
  const t = Math.min(1, Math.max(0, (best.alt - SPACE.low) / SPACE.blend));
  const k = t * t * (3 - 2 * t);
  const u = [best.n[0] * (1 - k), best.n[1] * (1 - k) + k, best.n[2] * (1 - k)];
  const l = Math.hypot(...u) || 1;
  return u.map((c) => c / l);
}
// v turned by the least turn that takes +y to `up` (or back, `inverse`)
export function turnUp(v, up, inverse = false) {
  const c = up[1]; // (+y · up)
  if (c > 1 - 1e-12) return [...v];
  // the axis +y × up, and the angle's sine (its length); straight down, any level axis
  let k = [up[2], 0, -up[0]];
  let sn = Math.hypot(k[0], k[2]);
  if (sn < 1e-9) {
    k = [1, 0, 0];
    sn = 0;
  } else k = k.map((x) => x / sn);
  if (inverse) sn = -sn;
  const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const kx = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return v.map((x, i) => x * c + kx[i] * sn + k[i] * kv * (1 - c));
}

function stepOnce(h, input, dt, press) {
  if (h.mode === 'perch') {
    if (press.take() || (input.up ?? 0) > 0.5) {
      const n = h.perch.n;
      h.mode = 'air';
      h.p = h.p.map((v, i) => v + n[i] * 0.5);
      h.v = n.map((c) => c * 40);
      h.ev.push({ type: 'launch', body: h.perch.body });
      h.perch = null;
    } else return;
  }
  // where he wants to go: the camera's way, and up or down (off the ground he is over, upOver)
  const [lx, ly, lz] = input.look;
  const U = upOver(h.p);
  const cr = [ly * U[2] - lz * U[1], lz * U[0] - lx * U[2], lx * U[1] - ly * U[0]];
  const rl = Math.hypot(...cr) || 1;
  const right = cr.map((c) => c / rl);
  const fwd = input.fwd ?? 0;
  const side = input.side ?? 0;
  const vert = (input.up ?? 0) - (input.down ?? 0);
  const m = [0, 1, 2].map((i) => input.look[i] * fwd + right[i] * side + U[i] * vert);
  const ml = len(m);
  const sp = len(h.v);
  const low = overBody(h.p) < SPACE.low;
  if (input.boost || ml > 0.05) {
    const D = ml > 0.05 ? m.map((c) => c / ml) : [lx, ly, lz];
    const S = input.boost ? (low ? SPACE.lowTop : SPACE.top) : (low ? SPACE.lowCruise : SPACE.cruise) * Math.min(1, ml);
    const dir = sp > 1 ? turn(h.v.map((c) => c / sp), D, (3 - 1.8 * Math.min(1, sp / SPACE.top)) * dt) : D;
    const accel = low ? SPACE.lowAccel : input.boost ? SPACE.boostAccel : SPACE.accel;
    const ns = sp < S ? Math.min(S, sp + accel * dt) : Math.max(S, sp - (low ? SPACE.lowBrake : SPACE.brake) * dt);
    h.v = dir.map((c) => c * ns);
  } else h.v = h.v.map((c) => c * Math.max(0, 1 - (low ? SPACE.lowStop : SPACE.drift) * dt));
  h.p = h.p.map((c, i) => c + h.v[i] * dt);

  // the Moon and Mars: stand on whichever he comes down on
  for (const b of BODIES) {
    const d = [h.p[0] - b.c[0], h.p[1] - b.c[1], h.p[2] - b.c[2]];
    const dl = len(d);
    if (dl >= b.r || dl < 1e-6) continue;
    const n = d.map((c) => c / dl);
    h.p = b.c.map((c, i) => c + n[i] * b.r);
    h.ev.push({ type: 'land', body: b.id, speed: len(h.v), at: [...h.p], n });
    h.mode = 'perch';
    h.perch = { body: b.id, n };
    h.v = [0, 0, 0];
    return;
  }
  // the Earth: back into the air
  const r = len(h.p) || 1;
  const radial = (h.v[0] * h.p[0] + h.v[1] * h.p[1] + h.v[2] * h.p[2]) / r;
  if (!h.reentered && r - SPACE.RE < SPACE.reentry && radial < 0) {
    h.reentered = true;
    h.ev.push({ type: 'reenter', speed: len(h.v) });
  }
  if (r - SPACE.RE < 200) h.p = h.p.map((c) => (c * (SPACE.RE + 200)) / r);
  if (r > SPACE.bound) h.p = h.p.map((c) => (c * SPACE.bound) / r);
}

export function stepSpace(hero, input, dt) {
  const h = { ...hero, p: [...hero.p], v: [...hero.v], ev: [] };
  const n = Math.max(1, Math.ceil(dt / STEP - 1e-9));
  // (the jump as on the ground: ./flight.js's press, pressed a moment early still goes)
  const press = pressOf(input);
  for (let i = 0; i < n; i++) {
    press.ground(h.mode === 'perch', dt / n);
    stepOnce(h, input, dt / n, press);
  }
  const s = len(h.v);
  h.spd = s;
  if (s > 1e-6) h.dir = h.v.map((c) => c / s);
  // (his heading across the ground he is over: the sky's, far from the Moon and Mars)
  const vl = turnUp(h.v, upOver(h.p), true);
  if (s > 3) h.face = Math.atan2(vl[0], vl[2]);
  return h;
}
