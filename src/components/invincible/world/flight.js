// Flying as Invincible, as plain numbers: walking and running on the ground,
// taking off, hanging in the air, cruising where the camera looks, going
// flat out (the sound barrier goes with a boom), coming down soft or hard
// enough to crack the street (or into the water, with a splash), and
// bouncing off a tower hit too fast. Pure: the scene reads the hero and the
// events each step leaves in `ev`.
//
// The hero: { p: [x, y, z] (his feet), v (velocity), spd and dir (his air
// speed and its direction), face (the way he faces, as a yaw: forward is
// (sin, cos)), mode: 'ground' | 'air', crouch (seconds left of a hard
// landing), stun (seconds left of a crash), boomed, exited (gone up
// through the top of the sky, until he's back under it), ev }.
//
// Input: { fwd, side (−1…1, from the camera), up, down (0…1), boost, run,
// jump (this step only), look: the camera's forward, a unit vector, press
// (a jumpPress(): the jump pressed a moment early or late still lands, and
// `jump` is read through it), free (this step only: R, let go of the water),
// carry (he's holding something: ./brawl.js's grab, at CARRY of his speeds,
// and a wall met over BUMP m/s is a `bump`) }. dive(hero, at) sends him down
// onto a point at 90 m/s whatever's held, until he lands (./brawl.js's dive).

import { createPress } from '../../../lib/press';
import { BRAWL } from './brawl';
import { WATER_Y, WORLD, groundAt, near } from './map';

export const FLY = {
  walk: 4,
  run: 9,
  cruise: 40, // m/s, flying with nothing held but a direction
  climb: 25, // straight up
  descend: 12, // straight down, gently
  top: 260, // flat out
  accel: 45, // m/s² toward a cruise
  boostAccel: 85, // and flat out
  brake: 45, // slowing down to a cruise
  stop: 60, // slowing to a hover
  barrier: 120, // the boom, going over this
  rearm: 90, // and again once back under this
  slam: 18, // m/s down: a hard landing
  skim: 14, // faster than this along the ground, he keeps flying
  impact: 60, // m/s into a wall: a crash, not a bump
  bounce: 1 / 3,
  takeoff: 14,
  lift: 0.35, // seconds the jump carries him before he hovers
  crouch: 0.6, // seconds getting up from a hard landing
  stun: 0.5, // and from a crash
  R: 0.45, // how wide he is, from his middle
  H: 1.8, // how tall
  step: 0.6, // what he steps up onto on foot
};
const STEP = 1 / 120;
// carrying something, his speeds are this much of them; into a wall faster than BUMP, it's slammed
export const CARRY = BRAWL.grab.slow;
const BUMP = BRAWL.slam.speed;

// The jump’s press (lib/press.js): pressed up to `buffer` before he can go
// (still in the air, or getting up from a slam) it goes when he can; up to
// `coyote` after he flew off an edge, it still goes as a jump. The handler
// keeps one, calls press() on the key’s edge and hands it in as input.press.
export const JUMP = { buffer: 0.12, coyote: 0.1 };
export const jumpPress = () => createPress(JUMP);

// the jump of a step's input: its press, or the old one-step flag as one
// (seen in the step’s first slice only, and only on his feet)
export const pressOf = (input) => input.press ?? flag(Boolean(input.jump));
function flag(on) {
  let slices = 0;
  let feet = false;
  return {
    ground(onGround) {
      feet = onGround;
      if (slices++ > 0) on = false;
    },
    take() {
      const was = on && feet;
      on = false;
      return was;
    },
  };
}

const len = (x, y, z) => Math.hypot(x, y, z);
export const speedOf = (h) => len(h.v[0], h.v[1], h.v[2]);
export const forwardOf = (yaw) => [Math.sin(yaw), 0, Math.cos(yaw)];

export function newHero({ x, y, z, face = 0 }) {
  return { p: [x, y ?? groundAt(x, z), z], v: [0, 0, 0], spd: 0, dir: forwardOf(face), face, mode: 'ground', crouch: 0, stun: 0, lift: 0, boomed: false, dive: null, t: 0, ev: [] };
}

// Down onto `at` at `speed`, whatever's held, until he lands (or `time`
// goes by). `through`: a point in the air to fly through instead, the dive
// over once he's there (Omni-Man's line-break).
export const dive = (h, at, speed = BRAWL.dive.speed, { time = 5, through = false } = {}) => ({ ...h, mode: 'air', dive: { at: [...at], speed, t: 0, time, through } });

// The highest thing under (x, z) that isn't above `below`: the land, the
// water (`water` true), a roof or a bridge.
const scratch = [];
export function surfaceAt(world, x, z, below) {
  const g = groundAt(x, z);
  let y = Math.max(g, WATER_Y);
  let water = g < WATER_Y;
  for (const b of near(world, x, z, 0, scratch)) {
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1 || b.y1 > below || b.y1 < y) continue;
    y = b.y1;
    water = false;
  }
  return { y, water };
}

// Where the move keys send him, in the world: the camera's forward and right
// on the ground (on foot), or its forward as it is (in the air), plus up and down.
function wish(input, air) {
  const [lx, ly, lz] = input.look;
  const fl = len(lx, air ? ly : 0, lz) || 1;
  const f = [lx / fl, air ? ly / fl : 0, lz / fl];
  const rl = Math.hypot(lx, lz) || 1;
  const r = [-lz / rl, 0, lx / rl];
  const fwd = input.fwd ?? 0;
  const side = input.side ?? 0;
  const vert = air ? (input.up ?? 0) - (input.down ?? 0) : 0;
  return [f[0] * fwd + r[0] * side, f[1] * fwd + vert, f[2] * fwd + r[2] * side, f];
}

// turn unit vector a toward unit vector b by at most `max` radians
export function turn(a, b, max) {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const ang = Math.acos(dot);
  if (ang <= max || ang < 1e-6) return [b[0], b[1], b[2]];
  // the part of b square to a, then round by `max`
  let px = b[0] - a[0] * dot;
  let py = b[1] - a[1] * dot;
  let pz = b[2] - a[2] * dot;
  let pl = len(px, py, pz);
  if (pl < 1e-6) {
    // straight back: turn over the top
    [px, py, pz] = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const d = px * a[0] + py * a[1] + pz * a[2];
    px -= a[0] * d;
    py -= a[1] * d;
    pz -= a[2] * d;
    pl = len(px, py, pz);
  }
  const c = Math.cos(max);
  const s = Math.sin(max) / pl;
  return [a[0] * c + px * s, a[1] * c + py * s, a[2] * c + pz * s];
}

const easeAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

// Push him out of anything he's gone into; returns the wall's normal and
// how fast he was going into it, or null.
function collide(h, prev, world) {
  const { R, H } = FLY;
  let hit = null;
  for (const b of near(world, h.p[0], h.p[2], R + 1, scratch)) {
    if (h.p[0] + R <= b.x0 || h.p[0] - R >= b.x1 || h.p[2] + R <= b.z0 || h.p[2] - R >= b.z1) continue;
    if (h.p[1] + H <= b.y0 || h.p[1] >= b.y1) continue;
    // came down onto it, or up under it
    if (prev[1] >= b.y1 - 1e-6) {
      h.p[1] = b.y1;
      continue;
    }
    if (prev[1] + H <= b.y0 + 1e-6) {
      h.p[1] = b.y0 - H;
      if (h.v[1] > 0) h.v[1] = 0;
      continue;
    }
    // into a wall: the side he came from, else the shallowest way out
    const outs = [
      [prev[0] + R <= b.x0 + 1e-6, h.p[0] + R - b.x0, [-1, 0, 0]],
      [prev[0] - R >= b.x1 - 1e-6, b.x1 - (h.p[0] - R), [1, 0, 0]],
      [prev[2] + R <= b.z0 + 1e-6, h.p[2] + R - b.z0, [0, 0, -1]],
      [prev[2] - R >= b.z1 - 1e-6, b.z1 - (h.p[2] - R), [0, 0, 1]],
    ];
    const came = outs.filter((o) => o[0]);
    const [, depth, n] = (came.length ? came : outs).reduce((a, o) => (o[1] < a[1] ? o : a));
    h.p[0] += n[0] * depth;
    h.p[2] += n[2] * depth;
    const into = -(h.v[0] * n[0] + h.v[2] * n[2]);
    if (into > 0) {
      if (!hit || into > hit.into) hit = { n, into, at: [h.p[0], h.p[1] + H / 2, h.p[2]], building: b.building ?? null, house: b.house ?? null };
      h.v[0] += n[0] * into;
      h.v[2] += n[2] * into;
    }
  }
  return hit;
}

function stepAir(h, input, dt, world) {
  const [mx, my, mz, f] = wish(input, true);
  const m = len(mx, my, mz);
  const k = input.carry ? CARRY : 1;
  let S = 0;
  let D = h.dir;
  if (h.dive) {
    // a dive: straight at the point, at its speed, nothing held counts
    h.dive.t += dt;
    const d = [h.dive.at[0] - h.p[0], h.dive.at[1] - h.p[1], h.dive.at[2] - h.p[2]];
    const l = len(d[0], d[1], d[2]) || 1;
    h.dir = [d[0] / l, d[1] / l, d[2] / l];
    h.spd = h.dive.speed;
    if (h.dive.t > h.dive.time || (h.dive.through && l < Math.max(2, h.dive.speed * dt))) h.dive = null;
  } else if (h.stun > 0) {
    h.stun -= dt;
    S = 0;
  } else if (input.boost) {
    D = m > 0.05 ? [mx / m, my / m, mz / m] : f;
    S = FLY.top * k;
  } else if (m > 0.05) {
    D = [mx / m, my / m, mz / m];
    const flat = Math.hypot(mx, mz);
    S = flat < 0.05 ? (my > 0 ? FLY.climb : FLY.descend) * Math.min(1, m) : FLY.cruise * k * Math.min(1, m);
  }
  if (!h.dive) {
    // just off the ground: the jump carries him up before he settles into a hover
    if (h.lift > 0) {
      h.lift -= dt;
      if (S === 0) S = h.spd;
    }
    // the direction swings round, slower the faster he's going; from a hover, at once
    if (h.spd < 2) h.dir = [D[0], D[1], D[2]];
    else if (S > 0) h.dir = turn(h.dir, D, (4 - 2.6 * Math.min(1, h.spd / FLY.top)) * dt);
    if (h.spd < S) h.spd = Math.min(S, h.spd + (input.boost ? FLY.boostAccel : FLY.accel) * dt);
    else h.spd = Math.max(S, h.spd - (S === 0 ? FLY.stop : FLY.brake) * dt);
  }
  h.v = [h.dir[0] * h.spd, h.dir[1] * h.spd, h.dir[2] * h.spd];

  // the sound barrier
  if (!h.boomed && h.spd > FLY.barrier) {
    h.boomed = true;
    h.ev.push({ type: 'boom', at: [...h.p], dir: [...h.dir] });
  } else if (h.boomed && h.spd < FLY.rearm) h.boomed = false;

  const prev = [...h.p];
  h.p[0] += h.v[0] * dt;
  h.p[1] += h.v[1] * dt;
  h.p[2] += h.v[2] * dt;
  const hit = collide(h, prev, world);
  if (hit) {
    if (hit.into > FLY.impact && h.stun <= 0) {
      // a crash: thrown back off it (what was along the wall half gone), and a moment to get his bearings
      for (const a of [0, 1, 2]) h.v[a] = h.v[a] * 0.5 + hit.n[a] * hit.into * FLY.bounce;
      h.stun = FLY.stun;
      h.dive = null;
      h.ev.push({ type: 'impact', speed: hit.into, at: hit.at, n: hit.n, building: hit.building, house: hit.house });
    } else if (input.carry && hit.into > BUMP) h.ev.push({ type: 'bump', speed: hit.into, at: hit.at, n: hit.n, building: hit.building, house: hit.house });
    h.spd = len(h.v[0], h.v[1], h.v[2]);
    if (h.spd > 1e-6) h.dir = [h.v[0] / h.spd, h.v[1] / h.spd, h.v[2] / h.spd];
  }

  // the ground, a roof, the water
  const s = surfaceAt(world, h.p[0], h.p[2], Math.max(h.p[1], prev[1]) + 1e-6);
  if (h.p[1] <= s.y) {
    h.p[1] = s.y;
    const down = -h.v[1];
    const flat = Math.hypot(h.v[0], h.v[2]);
    const hard = down > FLY.slam;
    const soft = !hard && flat < FLY.skim && (down > 0.5 || (input.down ?? 0) > 0);
    if (s.water && (hard || soft)) {
      // the splash only on the way down onto it; once he's at its surface,
      // holding down or a boost into it just goes nowhere (no splash every step)
      if (prev[1] > s.y + 1e-6) splash(h);
      else h.v[1] = Math.max(0, h.v[1]);
    } else if (hard) land(h, 'slam');
    else if (soft) land(h, 'land');
    else if (h.dir[1] < 0) {
      // skimming along it
      h.dir = flatten(h.dir, h.face);
      h.v = [h.dir[0] * h.spd, 0, h.dir[2] * h.spd];
    }
  }
  if (h.mode === 'air') {
    const fl = Math.hypot(h.v[0], h.v[2]);
    const yaw = fl > 3 ? Math.atan2(h.v[0], h.v[2]) : Math.atan2(input.look[0], input.look[2]);
    h.face = easeAngle(h.face, yaw, 1 - Math.exp(-(fl > 3 ? 10 : 3) * dt));
  }
}

// a direction along the ground (from one straight up or down, the way he faces)
function flatten(d, face) {
  const l = Math.hypot(d[0], d[2]);
  return l > 1e-6 ? [d[0] / l, 0, d[2] / l] : forwardOf(face);
}

// He can't stand on the water, so where he'd land or crack the street he
// stops dead at its surface instead, hanging there: no crater, a splash.
function splash(h) {
  h.dive = null;
  h.ev.push({ type: 'splash', at: [...h.p], speed: h.spd });
  h.spd = 0;
  h.v = [0, 0, 0];
  h.dir = flatten(h.dir, h.face);
}

function land(h, type) {
  h.dive = null;
  h.ev.push({ type, at: [...h.p], speed: h.spd });
  h.mode = 'ground';
  h.crouch = type === 'slam' ? FLY.crouch : 0;
  h.spd = 0;
  h.v = [0, 0, 0];
}

// up off the ground (or the water, or out of a fall off an edge just now)
function takeoff(h, input) {
  const [mx, , mz] = wish(input, false);
  const m = Math.hypot(mx, mz);
  h.mode = 'air';
  h.dir = m > 0.05 ? norm([mx / m, 1.6, mz / m]) : [0, 1, 0];
  h.spd = FLY.takeoff;
  h.lift = FLY.lift;
  h.v = [h.dir[0] * h.spd, h.dir[1] * h.spd, h.dir[2] * h.spd];
  h.ev.push({ type: 'takeoff', at: [...h.p] });
  h.p[1] += 0.05;
}

// hanging at the water's surface (a splash stops him there)
export function onWater(h, world) {
  if (h.mode !== 'air') return false;
  const s = surfaceAt(world, h.p[0], h.p[2], h.p[1] + 1e-6);
  return s.water && h.p[1] - s.y < 0.05;
}

function stepGround(h, input, dt, world, press) {
  if (h.crouch > 0) {
    h.crouch = Math.max(0, h.crouch - dt);
    return;
  }
  if (press.take() || (input.up ?? 0) > 0.5) {
    takeoff(h, input);
    return;
  }
  const [mx, , mz] = wish(input, false);
  const m = Math.min(1, Math.hypot(mx, mz));
  const top = input.run || input.boost ? FLY.run : FLY.walk;
  const want = m > 0.05 ? [(mx / Math.hypot(mx, mz)) * top * m, (mz / Math.hypot(mx, mz)) * top * m] : [0, 0];
  const k = 1 - Math.exp(-12 * dt);
  h.v[0] += (want[0] - h.v[0]) * k;
  h.v[2] += (want[1] - h.v[2]) * k;
  h.v[1] = 0;
  const prev = [...h.p];
  h.p[0] += h.v[0] * dt;
  h.p[2] += h.v[2] * dt;
  // (lifted a step's height for the walls, so a kerb or a low roof's edge is stepped onto)
  h.p[1] += FLY.step;
  prev[1] += FLY.step;
  collide(h, prev, world);
  h.p[1] -= FLY.step;
  const s = surfaceAt(world, h.p[0], h.p[2], h.p[1] + FLY.step);
  if (s.water || s.y < h.p[1] - FLY.step) {
    // off the edge (or out over the water): he doesn't fall, he flies
    h.mode = 'air';
    h.spd = Math.hypot(h.v[0], h.v[2]);
    h.dir = h.spd > 0.1 ? [h.v[0] / h.spd, 0, h.v[2] / h.spd] : forwardOf(h.face);
  } else h.p[1] = s.y;
  if (m > 0.05) h.face = easeAngle(h.face, Math.atan2(mx, mz), 1 - Math.exp(-12 * dt));
}

function norm(v) {
  const l = len(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// One step of `dt` seconds (any length: it's taken in slices of 1/120 s).
export function stepHero(hero, input, dt, world) {
  const h = { ...hero, p: [...hero.p], v: [...hero.v], dir: [...hero.dir], dive: hero.dive ? { ...hero.dive } : null, ev: [] };
  const n = Math.max(1, Math.ceil(dt / STEP - 1e-9));
  const sub = dt / n;
  const press = pressOf(input);
  // R: off the water, as if from the ground (else he hangs there until up or forward)
  if (input.free && onWater(h, world)) takeoff(h, input);
  for (let i = 0; i < n; i++) {
    // (on his feet and able to go: a slam's crouch is not yet)
    press.ground(h.mode === 'ground' && h.crouch <= 0, sub);
    if (h.mode === 'ground') stepGround(h, input, sub, world, press);
    else {
      // just off an edge (coyote time): the jump he meant
      if (press.take()) takeoff(h, input);
      stepAir(h, input, sub, world);
    }
    // the edges of the world, and the top of the sky
    const lim = WORLD.half;
    for (const a of [0, 2]) {
      if (Math.abs(h.p[a]) > lim) {
        h.p[a] = Math.sign(h.p[a]) * lim;
        if (Math.sign(h.v[a]) === Math.sign(h.p[a])) h.v[a] = 0;
      }
    }
    if (h.p[1] >= WORLD.ceiling) {
      // the top of the sky: going up into it at all, he's out ('exit': ./orbit.js takes over).
      // (Not only fast: held against it, his rise is taken away every step,
      // so a slow one could never build into a fast one and he'd be stuck.)
      if (h.v[1] > 0 && !h.exited) {
        h.exited = true;
        h.ev.push({ type: 'exit', at: [...h.p], speed: Math.hypot(...h.v) });
      }
      h.p[1] = WORLD.ceiling;
      if (h.v[1] > 0) h.v[1] = 0;
    } else if (h.exited) h.exited = false;
    if (h.mode === 'air') {
      h.spd = len(h.v[0], h.v[1], h.v[2]);
      if (h.spd > 1e-6) h.dir = [h.v[0] / h.spd, h.v[1] / h.spd, h.v[2] / h.spd];
    }
    h.t += sub;
  }
  return h;
}
