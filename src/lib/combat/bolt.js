// A bolt's flight, the one step every blaster on the site flies by: yours,
// theirs at you, and theirs at each other. Each frame a bolt flies the
// segment `speed · dt` and that segment is tested against the world's solids
// (a raycast the world gives: ground, walls, props), the bodies (capsules)
// and the raised blades, nearest first, so a bolt stops at the first thing
// in its way and nothing fast tunnels through anything thin. The solids are
// asked last, and only as far as the nearest body or blade on it: a solid
// the world does something to when it's met (a landing's prop, knocked)
// isn't met behind the person the bolt hits first.
//
// createBolts({ pool = 48 }) → { fire(spec) → bolt, step(dt, world) →
// events[], live() → bolt[], clear() }.
// spec: { from, dir, speed = 90, range = 120, owner, side ('you' | 'them' |
// 'none', or a faction), damage, colour, deflect = false, ghost = false, tag,
// ballistic } (plain [x, y, z] arrays; `tag` is the caller's, carried
// untouched; a `ghost` is a battle's tracer, stopped by solids and hurting
// nobody; `ballistic`, a projectiles.json row: the bolt flies by
// lib/combat/ballistics.js's flight at `speed`, falling and slowing as the
// row says, and is gone at its ttl; the segment test is the same).
// world: { solids(a, b) → { at, normal, surface? } | null (b: as far as it's
// to look, short of the step's end where a body or a blade is in the way),
// bodies: [{ id, a, b, r, side, allies?, ref }], blades: [{ id, base, tip, r,
// side, ref, test? }] } (`test(a, b)` → { t, at } | null: a guard of a shape
// of its own, the 2017 game's deflect shield, in place of the segment's capsule)
// (`allies`: the sides whose bolts pass a body by, as a rebel's pass you).
// events: { type: 'hit', bolt, body, at } | { type: 'solid', bolt, at,
// normal, surface (what the solids said it struck, for its material) } | { type: 'deflect', bolt, blade, at } | { type: 'gone', bolt }.
//
// A bolt never hits its owner's body (it leaves from inside their capsule)
// nor a body on its own side; a 'none' bolt hits anyone else. A bolt marked
// `deflect` that meets a blade of another side is turned back along its line
// and becomes the blade's: it flies home at whoever fired it.
//
// The geometry is exported for the blade's sweep (lib/combat/blade.js):
// segSeg(a, b, c, d) → { s, t, dist }, segCapsule(a, b, ca, cb, r) → { t, at }
// | null. Pure: plain arrays, no three.js.

import { flight, launch } from './ballistics';

const EPS = 1e-9;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// The closest points of segments ab and cd: a + s(b − a), c + t(d − c), and
// how far apart they are (Ericson, Real-Time Collision Detection, 5.1.9).
export function segSeg(a, b, c, d) {
  const d1 = sub(b, a);
  const d2 = sub(d, c);
  const r = sub(a, c);
  const aa = dot(d1, d1);
  const ee = dot(d2, d2);
  const f = dot(d2, r);
  let s;
  let t;
  if (aa <= EPS && ee <= EPS) {
    s = 0;
    t = 0;
  } else if (aa <= EPS) {
    s = 0;
    t = clamp01(f / ee);
  } else {
    const cc = dot(d1, r);
    if (ee <= EPS) {
      t = 0;
      s = clamp01(-cc / aa);
    } else {
      const bb = dot(d1, d2);
      const den = aa * ee - bb * bb;
      s = den > EPS ? clamp01((bb * f - cc * ee) / den) : 0;
      t = (bb * s + f) / ee;
      if (t < 0) {
        t = 0;
        s = clamp01(-cc / aa);
      } else if (t > 1) {
        t = 1;
        s = clamp01((bb - cc) / aa);
      }
    }
  }
  const p = lerp(a, b, s);
  const q = lerp(c, d, t);
  const dd = sub(p, q);
  return { s, t, dist: Math.sqrt(dot(dd, dd)) };
}

// How far point p is from segment cd.
function pointSeg(p, c, d) {
  const cd = sub(d, c);
  const len = dot(cd, cd);
  const t = len > EPS ? clamp01(dot(sub(p, c), cd) / len) : 0;
  const e = sub(p, lerp(c, d, t));
  return Math.sqrt(dot(e, e));
}

// Where segment ab first comes within r of segment ca–cb (enters the capsule):
// its fraction t along ab and the point, or null if it never does. The
// distance from a point moving along a line to a segment is convex, so from
// the closest approach back to a the entry is found by halving.
export function segCapsule(a, b, ca, cb, r) {
  if (pointSeg(a, ca, cb) <= r) return { t: 0, at: [...a] };
  const k = segSeg(a, b, ca, cb);
  if (k.dist > r) return null;
  let lo = 0;
  let hi = k.s;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (pointSeg(lerp(a, b, mid), ca, cb) <= r) hi = mid;
    else lo = mid;
  }
  return { t: hi, at: lerp(a, b, hi) };
}

export const BOLT_SPEED = 90; // m/s, every blaster's (an enemy's lead is worked out at it)
const SPEED = BOLT_SPEED;
const RANGE = 120; // m
const TURNS = 3; // most a bolt is turned in one frame (two blades crossed)

export function createBolts({ pool = 48 } = {}) {
  const slots = Array.from({ length: pool }, (_, i) => ({ slot: i, alive: false, seq: 0, pos: [0, 0, 0], dir: [0, 0, 1], from: [0, 0, 0] }));
  let seq = 0;

  const take = () => {
    let best = null;
    for (const b of slots) {
      if (!b.alive) return b;
      if (!best || b.seq < best.seq) best = b;
    }
    return best;
  };

  return {
    fire({ from, dir, speed = SPEED, range = RANGE, owner = null, side = 'none', damage = 0, colour = '#ff3b30', deflect = false, ghost = false, tag = null, ballistic = null }) {
      const b = take();
      const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      b.alive = true;
      b.seq = ++seq;
      b.from = [from[0], from[1], from[2]];
      b.pos = [from[0], from[1], from[2]];
      b.dir = [dir[0] / len, dir[1] / len, dir[2] / len];
      b.speed = speed;
      b.range = range;
      b.flown = 0;
      b.owner = owner;
      b.side = side;
      b.damage = damage;
      b.colour = colour;
      b.deflect = deflect;
      b.deflected = false;
      b.ghost = ghost;
      b.tag = tag;
      b.ballistic = ballistic;
      if (ballistic) {
        b.vel = launch(ballistic, b.dir, speed);
        b.life = 0;
      }
      return b;
    },

    step(dt, world) {
      const events = [];
      const bodies = world?.bodies ?? [];
      const blades = world?.blades ?? [];
      for (const b of slots) {
        if (!b.alive) continue;
        let left = Math.min(b.speed * dt, b.range - b.flown);
        let spent = false; // (a ballistic bolt's life run out this step)
        if (b.ballistic) {
          // the row's step decides where it gets to; the segment there is tested as any other
          const f = flight(b.ballistic, b, dt);
          const d = sub(b.pos, f.from);
          const len = Math.sqrt(dot(d, d));
          b.pos = f.from;
          if (len > EPS) b.dir = [d[0] / len, d[1] / len, d[2] / len];
          left = Math.min(len, b.range - b.flown);
          spent = f.gone;
        }
        for (let turn = 0; turn < TURNS && left > 0 && b.alive; turn++) {
          const a = b.pos;
          const e = [a[0] + b.dir[0] * left, a[1] + b.dir[1] * left, a[2] + b.dir[2] * left];
          let t = 1;
          let what = null;
          if (b.deflect) {
            for (const bl of blades) {
              if (bl.side === b.side) continue;
              const k = bl.test ? bl.test(a, e) : segCapsule(a, e, bl.base, bl.tip, bl.r);
              if (k && k.t < t) {
                t = k.t;
                what = { type: 'deflect', bolt: b, blade: bl, at: k.at };
              }
            }
          }
          for (const body of b.ghost ? [] : bodies) {
            if (body.id === b.owner || (b.side !== 'none' && (body.side === b.side || body.allies?.includes(b.side)))) continue;
            const k = segCapsule(a, e, body.a, body.b, body.r);
            if (k && k.t < t) {
              t = k.t;
              what = { type: 'hit', bolt: b, body, at: k.at };
            }
          }
          // then the solids, as far as that: one there or short of it wins
          // (on a tie the wall, as for a muzzle inside one), and one past it
          // is never asked
          const wall = world?.solids?.(a, t < 1 ? lerp(a, e, t) : e);
          if (wall) {
            const w = sub(wall.at, a);
            const tw = Math.sqrt(dot(w, w)) / left;
            if (tw <= t + EPS) {
              t = tw;
              what = { type: 'solid', bolt: b, at: [...wall.at], normal: wall.normal ?? null, surface: wall.surface ?? null };
            }
          }
          const went = left * t;
          b.flown += went;
          left -= went;
          b.pos = what ? what.at.slice() : e;
          if (!what) break;
          events.push(what);
          if (what.type !== 'deflect') {
            b.alive = false;
            break;
          }
          // turned: back along its line, the blade's now, home at its shooter
          b.dir = [-b.dir[0], -b.dir[1], -b.dir[2]];
          if (b.ballistic) b.vel = [-b.vel[0], -b.vel[1], -b.vel[2]];
          b.side = what.blade.side;
          b.owner = what.blade.id;
          b.deflect = false;
          b.deflected = true;
          b.flown = 0;
          left = Math.min(left, b.range);
        }
        if (b.alive && (spent || b.flown >= b.range - EPS)) {
          b.alive = false;
          events.push({ type: 'gone', bolt: b });
        }
      }
      return events;
    },

    live() {
      return slots.filter((b) => b.alive);
    },

    // (all of them gone at once: the walk's over)
    clear() {
      for (const b of slots) b.alive = false;
    },
  };
}
