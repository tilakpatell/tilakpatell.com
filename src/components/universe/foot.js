// On foot: out of the ship and walking about on a planet, as plain numbers
// (no three.js), so it's tested in Node; footScene.js draws it and the
// scene drives it.
//
// Everything here is in the planet's own space: its middle at the origin,
// its surface R out. A person is where they stand (n, a unit vector out
// from the middle), which way they face (f, a unit vector along the ground)
// and how high they are off it (h, jumping). They walk and run where they
// face, turn on the spot, step sideways, jump, and go round any obstacle
// (the parked ship); the ground curves away under them, so a walk in a
// straight line goes round the planet.
//
// A planet with a trench round its middle (the Death Star's) has its rim
// to walk up to and no further: the ship comes down beside it, its door
// toward it, and a squad comes from your side of it.
//
// The planets are huge against a person (a few hundred of them tall at the
// smallest), so a squad of the Galactic Federation (who are after every crew
// that lands anywhere) comes over the horizon now and then: they walk at
// you, stop at a distance, and shoot, not very well (wide the first time,
// leading you as you run, never through a rock). Your bolts and theirs fly
// straight (the ground hardly curves over a shot's length) on the one bolt
// step every blaster on the site flies by (lib/combat/bolt.js): the people
// as capsules (footBodies), the planet and what stands on it as its solids
// (footSolids).

import { FIRST, lead, scatter } from '../../lib/combat/accuracy';
import { segCapsule } from '../../lib/combat/bolt';
import { createPress } from '../../lib/press';

export const METRE = 0.027; // map units (the ship's 0.26 long is about an RV's ten metres)

export const FOOT = {
  walk: 1.8 * METRE, // a second
  run: 6 * METRE,
  back: 1.2 * METRE,
  side: 1.5 * METRE,
  accel: 12 * METRE, // a second, a second
  turn: 2.6, // radians a second
  gravity: 9.8 * METRE, // a second, a second
  jump: 4.2 * METRE, // up, a second (a metre high, near enough)
  radius: 0.35 * METRE, // a person, for bumping into things
  board: 6 * METRE, // how close to the ship's middle to get back in
  bolt: 60 * METRE, // a second
  boltLife: 1.6, // seconds
  hit: 0.55 * METRE, // how close a bolt must pass a person's middle
  health: 100,
  heal: 9, // health a second, once out of trouble a while
};

// the skill tree's ground branch on foot (hangar/skills's fx), as the
// galaxy's worlds take it (galaxy/perks.js's groundSkills): a tenth more
// health is a tenth less from each hit (the bar stays FOOT.health's), the
// medic on the heal a second, the hard hitter on your own shots at the
// troops (there are no other pilots' on foot to hit), and coolant and
// steady hands on the gun (footArms.js's footWeapon)
const factor = (v) => (Number.isFinite(v) && v > 0 ? v : 1);
export const footSkills = (fx) => ({ hurt: 1 / factor(fx?.health), heal: FOOT.heal * factor(fx?.heal), damage: factor(fx?.damage), heat: factor(fx?.heat), cool: factor(fx?.cool), spread: factor(fx?.spread) });

// who comes after a crew on the ground: the Federation's troops (which
// side's come is sides.js's `squads`)
export const TROOPS = {
  gromflomite: { name: 'Gromflomite', tall: 1.95 * METRE, hp: 2, speed: 2.2 * METRE, fire: [1.3, 2.4], range: [9, 14], spread: 0.09, damage: 9 },
  cop: { name: 'Federation cop', tall: 1.9 * METRE, hp: 3, speed: 2.6 * METRE, fire: [1.1, 2.0], range: [8, 12], spread: 0.07, damage: 11 },
  gazorpian: { name: 'Gazorpian', tall: 2.6 * METRE, hp: 6, speed: 3.4 * METRE, fire: null, range: [0, 1.2], spread: 0, damage: 18 }, // no gun: it charges, and hits
  // and Albuquerque's (sides.js): DEA agents, steady, and the cartel's gunmen, who come close
  dea: { name: 'DEA agent', tall: 1.85 * METRE, hp: 3, speed: 2.5 * METRE, fire: [1.0, 1.9], range: [9, 13], spread: 0.06, damage: 11 },
  cartel: { name: 'Cartel gunman', tall: 1.8 * METRE, hp: 2, speed: 2.9 * METRE, fire: [0.9, 1.6], range: [6, 10], spread: 0.11, damage: 9 },
  jackscrew: { name: 'Jack’s crew', tall: 1.85 * METRE, hp: 3, speed: 2.4 * METRE, fire: [1.2, 2.2], range: [8, 13], spread: 0.1, damage: 12 },
  // the Empire's: stormtroopers (they miss, but there are a lot of them),
  // scout troopers (quick, closer in), and a probe droid that hangs back
  // out of reach and, once it's had you in sight `calls` seconds, calls a
  // squad in (march's `calls`)
  stormtrooper: { name: 'Stormtrooper', tall: 1.83 * METRE, hp: 2, speed: 2.3 * METRE, fire: [0.8, 1.5], range: [9, 14], spread: 0.13, damage: 9 },
  scout: { name: 'Scout trooper', tall: 1.8 * METRE, hp: 2, speed: 3.4 * METRE, fire: [0.9, 1.6], range: [6, 10], spread: 0.09, damage: 8 },
  probe: { name: 'Probe droid', tall: 2.2 * METRE, hp: 3, speed: 2.0 * METRE, fire: null, range: [16, 20], spread: 0, damage: 0, calls: 8 },
  // Evil Morty's guard: Mortys, quick and wild
  mortyguard: { name: 'Morty guard', tall: 1.6 * METRE, hp: 1, speed: 3.0 * METRE, fire: [0.7, 1.3], range: [7, 11], spread: 0.14, damage: 8 },
};

// a bolt on foot, for the one step: how fast, how far
export const BOLT = { speed: FOOT.bolt, range: FOOT.bolt * FOOT.boltLife };
const STANDS = 2.2 * METRE; // the least a solid stands (a rock you can't see over); `top` if it says

// how big each ship is parked, against the people who fly it (in flight
// they're all drawn the same size): a scale on the flying model
export const PARKED = { rv: 1.1, cruiser: 0.55, xwing: 1.35, falcon: 3.2 };

// ── vectors (arrays of three) ──
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
// v turned by `angle` about the unit axis k (Rodrigues)
export function rotate(v, k, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kv = cross(k, v);
  const d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
}
// a along the ground at n: what's left of it once its part out from the middle is gone
export const flat = (a, n) => unit(add(a, n, -dot(a, n)));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const vec = { dot, cross, add, scale, len, unit };

// where someone stands, in the planet's space
export const at = (w, R) => scale(w.n, R + (w.h ?? 0));
// their right, along the ground
export const rightOf = (w) => cross(w.f, w.n);

// where to come down on a planet (its middle `c`, radius R) from a ship at
// `from` (both in the map's space): on the near side, leaning toward the
// light (`light`, a unit direction toward it), so it's day where you land
export function landingSpot(from, c, light = null) {
  let n = unit([from[0] - c[0], from[1] - c[1], from[2] - c[2]]);
  if (light) {
    n = unit(add(n, light, 0.7));
    if (dot(n, unit([from[0] - c[0], from[1] - c[1], from[2] - c[2]])) < 0.3) n = unit([from[0] - c[0], from[1] - c[1], from[2] - c[2]]);
  }
  return n;
}

// a heading along the ground at n, as close as it can be to `toward`
export function facingAlong(n, toward) {
  const f = add(toward, n, -dot(toward, n));
  if (len(f) > 1e-6) return unit(f);
  const any = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return flat(any, n);
}

// ── A trench round the middle ──
// `band`: a planet's trench, in its own space ({ half, home, arc }): its
// channel's half width either side of the planet's middle (y = 0: it runs
// round level), in map units, and the arc of it there is (round from the
// way `home`, an angle, either way: all the way round at π)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const alongArc = (n, band, pad) => band.arc >= Math.PI || Math.abs(wrap(Math.atan2(n[2], n[0]) - band.home)) <= band.arc + pad;
// whether n is in the trench (or within `pad` of its rim, map units)
export const inTrench = (n, band, R, pad = 0) => Boolean(band) && Math.abs(n[1]) < Math.sin((band.half + pad) / R) && alongArc(n, band, pad / R);

// Where to come down by a trench, from `n` (where it'd come down anyway):
// `back` from the rim (map units) on the side of it n is on, as near n as
// that is, facing along it with the door (on the right) toward it.
export function byTrench(n, band, R, back) {
  const lat = (band.half + back) / R;
  const side = n[1] < 0 ? -1 : 1;
  let lon = Math.atan2(n[2], n[0]);
  if (band.arc < Math.PI) {
    // (in from the trench's ends, if it doesn't go all the way round)
    const most = Math.max(0, band.arc - back / R);
    lon = band.home + clamp(wrap(lon - band.home), -most, most);
  }
  const spot = [Math.cos(lon) * Math.cos(lat), side * Math.sin(lat), Math.sin(lon) * Math.cos(lat)];
  let f = flat([-Math.sin(lon), 0, Math.cos(lon)], spot);
  if (dot(cross(f, spot), [0, -side, 0]) < 0) f = scale(f, -1);
  return { n: spot, f };
}

// someone standing at n, facing f
export const person = (n, f, extra = {}) => ({ n: unit(n), f: flat(f, unit(n)), h: 0, vh: 0, speed: 0, side: 0, ...extra });

// somewhere along the ground from w: `d` (map units) ahead, `s` to the right
export function offset(w, d, s, R) {
  const dir = add(scale(w.f, d), rightOf(w), s);
  const dist = len(dir);
  if (dist < 1e-9) return { n: w.n, f: w.f };
  const axis = unit(cross(w.n, dir));
  const a = dist / R;
  return { n: unit(rotate(w.n, axis, a)), f: unit(flat(rotate(w.f, axis, a), unit(rotate(w.n, axis, a)))) };
}

// ── A landing's things (landings/), round where the ship comes down ──
// A thing at (x, z) metres on a flat frame laid at `frame` ({ n, f }: the
// spot, and the way it faces), three.js's way round (+z ahead, +x to its
// left, n × f, and up out of the ground), put on the sphere: where it
// stands, and which way its own +z faces (`yaw`, turned as three.js turns
// a thing about its up: +z round toward +x)
export function place(frame, x, z, R, yaw = 0) {
  const o = offset(frame, z * METRE, -x * METRE, R);
  return { n: o.n, f: yaw ? unit(rotate(o.f, o.n, yaw)) : o.f };
}

// A thing's solids, in its own frame in metres (a builder's: { circle: [x,
// z, r] } or { box: [x, z, hw, hd, yaw?] }), as circles along the ground
// round where it stands (`spot`, as place gives): what walk() goes round. A
// box is a row of circles down its length, each as wide as it is.
export function solidsOn(spot, solids, R) {
  const out = [];
  const at = (x, z, r) => out.push({ n: place(spot, x, z, R).n, r: r * METRE });
  for (const s of solids ?? []) {
    if (s.circle) at(...s.circle);
    else if (s.box) {
      const [x, z, hw, hd, yaw = 0] = s.box;
      const long = Math.max(hw, hd);
      const r = Math.max(Math.min(hw, hd), 0.3);
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      // down its long side (its x or its z, turned by its yaw)
      const [ax, az] = hw >= hd ? [c, -sn] : [sn, c];
      const reach = Math.max(0, long - r);
      const count = Math.min(24, Math.max(1, Math.ceil(reach / r) + 1));
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? -reach + (2 * reach * i) / (count - 1) : 0;
        at(x + ax * t, z + az * t, r);
      }
    }
  }
  return out;
}

// the distance along the ground between two people (or spots), map units
export const apart = (a, b, R) => Math.acos(clamp(dot(a.n, b.n), -1, 1)) * R;

// the turn (radians, + to the left) from facing `f` at `n` to facing `to`
export function bearing(n, f, to) {
  const t = flat(to, n);
  return Math.atan2(dot(cross(f, t), n), dot(f, t));
}

// One step of `dt` seconds for someone on a planet of radius R.
// input: { move: −1…1 (forward +), strafe: −1…1 (right +), turn: −1…1
// (right +), run, jump, speed? (a top speed of their own) }; obstacles:
// [{ n, r }] they go round (r along the ground, map units), and a trench
// ({ band }, as byTrench's) they stop at the rim of.
export function walk(w, input, dt, R, obstacles = []) {
  dt = clamp(dt, 0, 0.05);
  const move = clamp(input.move || 0, -1, 1);
  const strafe = clamp(input.strafe || 0, -1, 1);
  const turn = clamp(input.turn || 0, -1, 1);
  // turning: on the spot, the right way round the way up is
  let f = turn ? unit(rotate(w.f, w.n, -turn * FOOT.turn * dt)) : w.f;
  let n = w.n;
  const top = input.speed ?? (move > 0 ? (input.run ? FOOT.run : FOOT.walk) : FOOT.back);
  const ease = (v, want) => v + clamp(want - v, -FOOT.accel * dt, FOOT.accel * dt);
  const speed = ease(w.speed || 0, move * top);
  const side = ease(w.side || 0, strafe * FOOT.side);
  // along the ground: a turn about the planet's middle, carrying the facing with it
  const dir = add(scale(f, speed), cross(f, n), side);
  const dist = len(dir) * dt;
  if (dist > 1e-9) {
    const axis = unit(cross(n, dir));
    const a = dist / (R + (w.h ?? 0));
    n = unit(rotate(n, axis, a));
    f = flat(rotate(f, axis, a), n);
  }
  // round anything in the way
  for (const o of obstacles) {
    if (o.band) {
      // back up onto the rim, on the side they were on
      if (!inTrench(n, o.band, R, FOOT.radius)) continue;
      const lim = Math.sin((o.band.half + FOOT.radius) / R);
      const side = Math.sign(w.n[1]) || Math.sign(n[1]) || 1;
      const k = Math.sqrt(1 - lim * lim) / (Math.hypot(n[0], n[2]) || 1);
      n = [n[0] * k, side * lim, n[2] * k];
      f = flat(f, n);
      continue;
    }
    const gap = Math.acos(clamp(dot(n, o.n), -1, 1)) * R;
    const min = o.r + FOOT.radius;
    if (gap >= min) continue;
    const away = len(add(n, o.n, -dot(n, o.n))) > 1e-9 ? flat(n, o.n) : flat(f, o.n);
    n = unit(add(scale(o.n, Math.cos(min / R)), away, Math.sin(min / R)));
    f = flat(f, n);
  }
  // up and down: a jump, and back to the ground
  let h = w.h ?? 0;
  let vh = w.vh ?? 0;
  // (a press, createJump's: one a key-down, held a buffer's while in the air
  // and spent on landing, with the coyote time lib/press.js gives; or, for
  // the walkers the scene moves itself, a plain yes)
  const grounded = h <= 1e-6;
  const jump = input.jump;
  if (typeof jump?.take === 'function') jump.ground(grounded, dt);
  if (grounded && (typeof jump?.take === 'function' ? jump.take() : jump)) vh = FOOT.jump;
  vh -= FOOT.gravity * dt;
  h += vh * dt;
  if (h <= 0) {
    h = 0;
    vh = 0;
  }
  return { ...w, n, f, h, vh, speed, side };
}

// Your jump key as a press (lib/press.js): `hold(down)` every frame with
// whether the key's down, and walk() given `press` as its jump. A key held
// down jumps once, not again on every landing; a press a hair before
// landing jumps as the feet touch.
export function createJump(opts) {
  const press = createPress(opts);
  let held = false;
  return {
    press,
    hold(down) {
      if (down && !held) press.press();
      held = Boolean(down);
    },
    reset() {
      held = false;
      press.reset();
    },
  };
}

// Turning someone to face somewhere: the turn input (−1…1) that brings them round
export const turnToward = (w, to, gain = 3) => clamp(-bearing(w.n, w.f, to) * gain, -1, 1);

// ── The Federation's squads ──

let nextId = 1;

// A squad coming over the horizon at `w` (the player), from one side:
// `count` of them, spread out, `dist` away along the ground (and on a
// planet with a trench, `band`, from somewhere on the player's side of it)
export function squad(rand, w, R, { count = 3, dist = 46 * METRE, kinds = ['gromflomite', 'gromflomite', 'cop'], band = null } = {}) {
  let out = [];
  for (let tries = 0; tries < 12; tries++) {
    out = troopsFrom(rand, w, R, count, dist, kinds);
    if (!band || out.every((t) => !inTrench(t.n, band, R, 2 * METRE) && Math.sign(t.n[1]) === Math.sign(w.n[1]))) break;
  }
  return out;
}
function troopsFrom(rand, w, R, count, dist, kinds) {
  const from = rand() * Math.PI * 2;
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = from + (i - (count - 1) / 2) * (0.22 + rand() * 0.12);
    const d = dist * (0.9 + rand() * 0.25);
    const spot = offset(w, Math.cos(a) * d, Math.sin(a) * d, R);
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const facing = facingAlong(spot.n, add(w.n, spot.n, -1)); // toward the player
    out.push({ id: nextId++, kind, ...person(spot.n, facing), hp: TROOPS[kind].hp, cool: 1 + rand() * 1.5, hold: TROOPS[kind].range[0] + rand() * (TROOPS[kind].range[1] - TROOPS[kind].range[0]), alive: true, dead: 0, swing: 0, aim: 0 });
  }
  return out;
}

// One step for a squad: each goes at the nearest of `targets` ([{ id, n,
// h }], the player and whoever's with them), stops at its distance and
// fires (or, without a gun, closes in and hits). One with a gun brings it
// up as a target comes within reach (`aim`, 0…1: up in a quarter of a
// second, down in half of one once they've gone), for the drawing to read.
// A troop that `calls` (a probe droid) never closes in nor fires: once it's
// had a target in sight that many seconds, it calls a squad in, once.
// Returns { troops, shots, hits, calls }: calls are [{ by (the troop), n
// (where it is) }]; shots are new bolts ({ from, dir, owner:
// 'troop', kind, damage, by (the trooper), range (to what it's aimed at) }),
// hits are blows landed ({ target, damage }).
export function march(troops, targets, dt, R, rand, obstacles = []) {
  const solids = footSolids(obstacles, R);
  const shots = [];
  const hits = [];
  const calls = [];
  const out = troops.map((t) => {
    if (!t.alive) return { ...t, dead: t.dead + dt };
    if (t.shove?.left > 0) return shoved(t, dt, R);
    const spec = TROOPS[t.kind];
    let best = null;
    let bd = Infinity;
    for (const g of targets) {
      const d = apart(t, g, R);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    if (!best) return t;
    const toward = add(best.n, t.n, -1);
    const turn = turnToward(t, toward, 4);
    const aimed = Math.abs(bearing(t.n, t.f, toward)) < 0.25;
    const hold = t.hold * METRE;
    // close the gap (a little the other way if they're too close), and step
    // sideways a little while they shoot, so they're not sitting ducks
    const move = bd > hold ? 1 : bd < hold * 0.6 ? -0.6 : 0;
    const strafe = bd <= hold && spec.fire ? Math.sin(t.id * 1.7 + (t.swing += dt) * 0.9) * 0.8 : 0;
    const next = walk(t, { move, strafe, turn, speed: move > 0 ? spec.speed : FOOT.back }, dt, R, obstacles);
    if (spec.calls) {
      // (a probe: watching from its distance, and calling them in)
      const watched = bd <= hold * 1.5 ? (t.watched ?? 0) + dt : (t.watched ?? 0);
      const called = Boolean(t.called) || watched > spec.calls;
      if (called && !t.called) calls.push({ by: t.id, n: next.n });
      return { ...next, cool: t.cool, swing: t.swing, aim: 0, watched, called };
    }
    const engaged = Boolean(spec.fire) && bd <= hold * 1.5;
    const aim = clamp((t.aim ?? 0) + (engaged ? dt / 0.25 : -dt / 0.6), 0, 1);
    let cool = t.cool - dt;
    if (cool <= 0 && aimed) {
      if (spec.fire && bd <= hold * 1.4) {
        const from = add(at(next, R), next.n, spec.tall * 0.62);
        const chest = add(at(best, R), best.n, METRE * 1.1);
        // (a mover led: where they'll be when the bolt gets there)
        const to = best.f ? lead(chest, velOf(best), from, FOOT.bolt) : chest;
        const way = len(add(to, from, -1));
        const wall = solids(from, to);
        if (wall && len(add(wall.at, from, -1)) < way * 0.9) cool = 0.3; // (no line: it looks again in a moment)
        else {
          cool = spec.fire[0] + rand() * (spec.fire[1] - spec.fire[0]);
          // (the first at you goes wide on purpose: you hear it, and have a moment)
          const spread = spec.spread * 0.6 * (t.fired ? 1 : FIRST);
          const dir = scatter(add(to, from, -1), spread, rand);
          shots.push({ from, dir, owner: 'troop', kind: t.kind, damage: spec.damage, by: t.id, range: way, spread, lead: len(add(to, chest, -1)) });
          return { ...next, cool, swing: t.swing, aim, fired: true };
        }
      } else if (!spec.fire && bd <= spec.range[1] * METRE + FOOT.radius) {
        cool = 1.1;
        hits.push({ target: best.id, damage: spec.damage, from: t.id });
      }
    }
    return { ...next, cool: Math.max(cool, -0.5), swing: t.swing, aim };
  });
  return { troops: out, shots, hits, calls };
}

// shoved (an ability's: a push, a repulse, a blast; universe/footAbilities.js's
// shoveOf): carried along the ground the way it went, slowing to nothing over
// the shove's time, off its feet by its own lift (vh), and neither aiming nor
// firing till it's down again
function shoved(t, dt, R) {
  const s = t.shove;
  const d = s.speed * (s.left / s.total) * dt;
  const moved = offset(t, dot(s.dir, t.f) * d, dot(s.dir, rightOf(t)) * d, R);
  let vh = (t.vh ?? 0) - FOOT.gravity * dt;
  let h = (t.h ?? 0) + vh * dt;
  if (h <= 0) {
    h = 0;
    vh = 0;
  }
  const left = s.left - dt;
  return { ...t, n: moved.n, f: moved.f, h, vh, speed: 0, side: 0, aim: 0, cool: Math.max(t.cool, 0.4), shove: left > 0 ? { ...s, left } : null };
}

// ── Bolts ──

// how someone's moving, in the planet's space, map units a second
export const velOf = (w) => add(scale(w.f, w.speed || 0), cross(w.f, w.n), w.side || 0);

// The people as the bolt step sees them: you and your mate (side 'you'),
// the troops alive (side 'troop', by their ids), each a capsule from the
// shins to the crown along where they stand.
export function footBodies({ me = null, mate = null, troops = [], R }) {
  const out = [];
  const stand = (id, w, tall, r, side) => {
    const g = at(w, R);
    out.push({ id, a: add(g, w.n, r), b: add(g, w.n, Math.max(r, tall - r)), r, side });
  };
  if (me) stand('me', me, 1.8 * METRE, FOOT.hit * 0.75, 'you');
  if (mate) stand('mate', mate, 1.8 * METRE, FOOT.hit * 0.75, 'you');
  for (const t of troops) if (t.alive) stand(t.id, t, TROOPS[t.kind].tall, TROOPS[t.kind].tall * 0.24, 'troop');
  return out;
}

// What stops a bolt on a planet of radius R: the ground (the sphere) and
// each obstacle ({ n, r }, as walk() goes round), standing `top` (or as
// tall as it's wide, and never less than STANDS) from the ground; a trench
// is a hole, not a wall. One marked `pass` is walked round but not shot
// at (a fixed thing a landing's physics holds: its own body there, the
// pole you see, stops a bolt, landings/physics.js). → (a, b) → { at,
// normal } | null.
export function footSolids(obstacles, R) {
  return (a, b) => {
    const d = add(b, a, -1);
    const l = len(d);
    let best = 1;
    let hit = null;
    // the ground: where |a + t·d| comes down to R
    const A = dot(d, d);
    const B = 2 * dot(a, d);
    const C = dot(a, a) - R * R;
    if (C <= 0) return { at: [...a], normal: unit(a) };
    const disc = B * B - 4 * A * C;
    if (A > 0 && disc >= 0) {
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t >= 0 && t <= 1) {
        best = t;
        hit = { at: add(a, d, t), normal: null };
        hit.normal = unit(hit.at);
      }
    }
    const mid = add(a, d, 0.5);
    for (const o of obstacles) {
      if (!o.n || o.pass) continue;
      const top = o.top ?? Math.max(o.r * 2, STANDS);
      const foot = scale(o.n, R);
      // (too far off this segment to matter)
      if (len(add(foot, mid, -1)) > l / 2 + o.r + top) continue;
      const k = segCapsule(a, b, scale(o.n, R - o.r), scale(o.n, R + Math.max(0, top - o.r)), o.r);
      if (k && k.t < best) {
        best = k.t;
        const up = clamp(dot(add(k.at, foot, -1), o.n), 0, top);
        const out = add(k.at, add(foot, o.n, up), -1);
        hit = { at: k.t === 0 ? [...a] : k.at, normal: len(out) > 1e-9 ? unit(out) : scale(unit(d), -1) };
      }
    }
    return hit;
  };
}

// The nearest of `troops` round w's facing (within `cone` radians either
// side, and `range` along the ground): what a shot goes at
export function aimAt(w, troops, R, { cone = 0.45, range = 30 * METRE } = {}) {
  let best = null;
  let score = Infinity;
  for (const t of troops) {
    if (!t.alive) continue;
    const d = apart(w, t, R);
    if (d > range) continue;
    const b = Math.abs(bearing(w.n, w.f, add(t.n, w.n, -1)));
    if (b > cone) continue;
    const s = d * (1 + b * 2);
    if (s < score) {
      score = s;
      best = t;
    }
  }
  return best;
}
