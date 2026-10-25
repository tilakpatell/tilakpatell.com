// Targeting, for the ship on the universe map: which hunter the guns are
// locked on, where to shoot to hit it, how much a shot is helped onto it,
// whether a shot touched it, and where a thing off the edge of the screen is
// pointed to from. Pure (no three.js), so it's tested in Node; scene.js
// reads the ship, the hunters and the camera and draws the brackets
// (UniverseMap.jsx's HUD).
//
// A lock picks itself up: the hunter nearest the nose, within AIM.cone and
// AIM.range (one coming at you counts as nearer), and holds while it stays
// within the wider AIM.hold (a dogfight swings about), dropping once it's
// been outside that for AIM.lose seconds (AIM.loseManual for one picked by
// hand: T, Shift+T or a tap, however far it has gone). When its target goes down the guns move
// straight on to the next one inside the hold, so a fight flows; and a lock
// the guns picked themselves gives way when its target has sat wide of the
// nose (outside the pick-up cone) or out of the bolts' reach for AIM.swap
// seconds while another is squarely ahead: they don't stay on one flying
// off while the next comes down your throat. (One picked by hand never
// gives way like that.) The lead
// point is where a bolt fired now meets the target, allowing for its speed
// and the bolt's (the bolts are quick, well over twice the fastest hunter,
// so the lead stays a modest angle off); the pip sits there, and a shot
// within AIM.assist of it bends onto it (so the guns feel like a fighter's,
// not a pea shooter), with the help fading to nothing by AIM.assistEdge,
// a little more forgiving up and down than side to side, all of it scaled
// by the visitor's aim-assist setting. A hit is tested over the whole frame
// with both the bolt and the target moving (sweptHit), so nothing fast
// slips between two frames.
//
// And the nose follows the lock (trackNudge): with a lead point inside
// AIM.trackCone, the stick gets a nudge toward it, at most AIM.trackMax of
// full stick, growing with the angle off (AIM.trackGain), fading to nothing
// at the cone's edge, in the ship's own frame (a target above a ship rolled
// on its side is a turn), and giving way to the pilot's own stick as far as
// it pushes the other way at all; the visitor's lock-tracking setting
// scales it.
// The fighters' pace is hunterRules.js's (they fly the fight at a little
// over your speed), so between the two a fight can be followed.
//
// Points are { x, y, z } (the ship, a Vector3) or [x, y, z] (the map's
// places), in the map's own space.

import { conj, fromAngles, rotate } from '../../flight/orient';

export const AIM = {
  range: 60, // map units: nothing further out can be locked
  cone: 0.5, // radians off the nose to pick a target up (about 29°)
  hold: 1.05, // radians: a lock holds out to here (about 60°)
  lose: 2, // seconds outside the hold cone (or out of range) before it drops
  loseManual: 4, // the same, for a lock picked by hand
  swap: 0.8, // seconds a lock the guns picked may sit wide of the nose, or out of reach, before they take another that's squarely ahead
  trackCone: 0.7, // radians off the nose within which the nose follows the lock (about 40°)
  trackGain: 3, // how quickly the nudge grows with the angle off (full at a third of a radian)
  trackMax: 0.5, // of full stick, at most: the pilot's own stick always wins
  trackDead: 0.02, // a push the other way smaller than this is a resting hand, not a push
  threat: 0.25, // how much nearer the nose one coming at you counts (of the pick-up score)
  assist: 0.14, // radians: inside this, a shot bends fully onto the lead point (about 8°)
  assistEdge: 0.36, // radians: beyond this, no help at all
  vertical: 1.3, // how much more forgiving the help is up and down
  bolt: 60, // a bolt's own speed, over the ship's (scene.js adds the ship's)
  life: 0.85, // seconds a bolt flies
};

const X = (p) => (Array.isArray(p) ? p[0] : p.x);
const Y = (p) => (Array.isArray(p) ? p[1] : p.y);
const Z = (p) => (Array.isArray(p) ? p[2] : p.z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const len = (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); // (not Math.hypot: it makes garbage, and this runs every frame)
const unit = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const angleBetween = (a, b) => Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));

// the way the ship's nose points: along its heading (0 is −z, growing
// turning left), tipped by its pitch (into `out`, given one: the HUD's, kept)
export function nose(s, out = [0, 0, 0]) {
  const p = s.pitch || 0;
  const level = Math.cos(p);
  out[0] = -Math.sin(s.heading) * level;
  out[1] = Math.sin(p);
  out[2] = -Math.cos(s.heading) * level;
  return out;
}

// the direction from the ship to a point, as a unit vector
export const dirTo = (s, p) => unit([X(p) - s.x, Y(p) - s.y, Z(p) - s.z]);

// how far a point is from the ship, and how far off its nose (radians)
export function bearing(s, p) {
  const d = [X(p) - s.x, Y(p) - s.y, Z(p) - s.z];
  const dist = len(d);
  if (dist < 1e-6) return { dist, off: 0 };
  return { dist, off: angleBetween(nose(s), [d[0] / dist, d[1] / dist, d[2] / dist]) };
}

// The lock, one step on: `lock` is { id, out, manual?, wide? } (out: seconds
// its target has been outside the hold cone; manual: picked by hand; wide:
// seconds it's been held but outside the pick-up cone or out of reach) or null;
// `candidates` are { id, at, vel, size, threat? } (hunters.targets; threat
// 0 to 1, how much it's coming at you). Returns the new lock, or null. With
// `cycle` (true or 1, or −1 the other way), moves on to the next candidate
// round the nose (nearest the nose first); with `ring` too (an array of ids
// the caller keeps from press to press), round that instead, updated in place:
// what's no longer held drops out, what's newly held joins the end (nearest
// the nose first), and the rest keep their order, so the nose following the
// lock between presses doesn't turn the next press back.
export function track(s, candidates, lock, dt, { cycle = false, ring = null } = {}) {
  const seen = [];
  for (const c of candidates) {
    const b = bearing(s, c.at);
    if (b.dist > AIM.range * 1.3 && !(lock?.manual && c.id === lock.id)) continue; // (one picked by hand is looked for however far it's gone)
    seen.push({ c, ...b });
  }
  seen.sort((a, b) => a.off - b.off);
  const held = (e) => e.off < AIM.hold && e.dist <= AIM.range * 1.3;
  const current = lock ? seen.find((e) => e.c.id === lock.id) : null;
  if (cycle && seen.length && ring) {
    let w = 0;
    for (let r = 0; r < ring.length; r++) if (seen.some((e) => e.c.id === ring[r] && held(e))) ring[w++] = ring[r];
    ring.length = w;
    for (const e of seen) if (held(e) && !ring.includes(e.c.id)) ring.push(e.c.id);
    if (ring.length) {
      const i = current ? ring.indexOf(lock.id) : -1;
      const step = cycle === -1 ? -1 : 1;
      const id = ring[(((i < 0 && step < 0 ? 0 : i) + step) % ring.length + ring.length) % ring.length];
      return { id, out: 0, manual: true };
    }
  } else if (cycle && seen.length) {
    const ring = seen.filter(held);
    if (ring.length) {
      const i = current ? ring.findIndex((e) => e.c.id === lock.id) : -1;
      const step = cycle === -1 ? -1 : 1;
      const next = ring[(((i < 0 && step < 0 ? 0 : i) + step) % ring.length + ring.length) % ring.length];
      return { id: next.c.id, out: 0, manual: true };
    }
  }
  // the best to pick up inside `cone`: nearest the nose, nearer counting
  // for a little and one coming at you for more
  const pick = (cone, not = null) => {
    let best = null;
    let score = Infinity;
    for (const e of seen) {
      if (e === not || e.off > cone || e.dist > AIM.range) continue;
      const k = e.off / AIM.cone + 0.35 * (e.dist / AIM.range) - AIM.threat * clamp(e.c.threat || 0, 0, 1);
      if (k < score) {
        score = k;
        best = e;
      }
    }
    return best;
  };
  if (current) {
    const keep = (out) => (lock.manual ? { id: lock.id, out, manual: true } : { id: lock.id, out });
    if (held(current)) {
      if (lock.manual) return keep(0);
      // held, but wide of the nose or out of reach: after a moment of that,
      // the guns take one that's squarely ahead, if there is one
      const astray = current.off > AIM.cone || current.dist > AIM.range;
      if (!astray) return keep(0);
      const wide = (lock.wide || 0) + dt;
      const next = wide >= AIM.swap ? pick(AIM.cone, current) : null;
      return next ? { id: next.c.id, out: 0 } : { id: lock.id, out: 0, wide };
    }
    // slipping away: a moment's grace before it lets go
    const out = lock.out + dt;
    if (out < (lock.manual ? AIM.loseManual : AIM.lose)) return keep(out);
  }
  // a fresh one. Its target just gone (shot down), the guns look as wide as
  // the hold for the next, so the fight goes on
  const best = pick(lock && !current ? AIM.hold : AIM.cone);
  return best ? { id: best.c.id, out: 0 } : null;
}

// Where a bolt fired now from `from` at `speed` meets a target at `at`
// moving at `vel`: { x, y, z, t } (t: seconds till it gets there), or null
// when it never would (the target's too fast, or the maths has no answer).
export function intercept(from, speed, at, vel) {
  const dx = X(at) - X(from);
  const dy = Y(at) - Y(from);
  const dz = Z(at) - Z(from);
  const vx = X(vel);
  const vy = Y(vel);
  const vz = Z(vel);
  // |d + v t| = speed t
  const a = vx * vx + vy * vy + vz * vz - speed * speed;
  const b = 2 * (dx * vx + dy * vy + dz * vz);
  const c = dx * dx + dy * dy + dz * dz;
  let t;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) < 1e-9) return null;
    t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const r = Math.sqrt(disc);
    const t1 = (-b - r) / (2 * a);
    const t2 = (-b + r) / (2 * a);
    t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
  }
  if (!(t > 0) || !Number.isFinite(t)) return null;
  return { x: X(at) + vx * t, y: Y(at) + vy * t, z: Z(at) + vz * t, t };
}

// How much of the bend onto `want` (the way to the lead point) a shot along
// `dir` gets: 1 inside AIM.assist, 0 past AIM.assistEdge, fading between;
// the cones a little taller than they are wide (AIM.vertical), and both
// scaled by `strength` (the visitor's setting: 0 is no help at all).
export function assistAmount(dir, want, strength = 1) {
  if (!(strength > 0)) return 0;
  const a = aimAngles(dir);
  const b = aimAngles(want);
  const yaw = Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading)) * Math.cos((a.pitch + b.pitch) / 2);
  const dp = (b.pitch - a.pitch) / AIM.vertical;
  const off = Math.sqrt(yaw * yaw + dp * dp);
  const full = AIM.assist * strength;
  const edge = AIM.assistEdge * strength;
  return off <= full ? 1 : off >= edge ? 0 : 1 - (off - full) / (edge - full);
}

// A shot's direction, helped onto `want` that much.
export function assist(dir, want, strength = 1) {
  const k = assistAmount(dir, want, strength);
  if (k >= 1) return [...want];
  if (k <= 0) return [...dir];
  return unit([dir[0] + (want[0] - dir[0]) * k, dir[1] + (want[1] - dir[1]) * k, dir[2] + (want[2] - dir[2]) * k]);
}

// The nudge the stick gets toward a lock's lead point (`lead`: { x, y, z }
// or [x, y, z]), in the ship's own frame: { turn, climb }, each −1…1 (turn
// right and climb positive), at most AIM.trackMax of full stick, growing
// with the angle off (AIM.trackGain) and fading to nothing at AIM.trackCone;
// `strength` is the visitor's setting (0: none). `stick` is what the pilot
// is asking for already ({ turn, climb }): on an axis where they push the
// other way, the nudge lets go.
export function trackNudge(s, lead, strength = 1, stick = null) {
  const none = { turn: 0, climb: 0 };
  if (!(strength > 0) || !lead) return none;
  const d = dirTo(s, lead);
  const q = fromAngles(s.heading || 0, s.pitch || 0, s.bank || 0);
  const [x, y, z] = rotate(conj(q), d); // in the ship's frame: nose −z, up +y, right +x
  const off = Math.acos(clamp(-z, -1, 1));
  if (off >= AIM.trackCone || off < 1e-9) return none;
  const edge = 1 - clamp((off - AIM.trackCone * 0.6) / (AIM.trackCone * 0.4), 0, 1);
  const k = AIM.trackMax * strength * edge;
  const yaw = Math.atan2(x, -z);
  const pitch = Math.asin(clamp(y, -1, 1));
  let turn = clamp(yaw * AIM.trackGain, -1, 1) * k;
  let climb = clamp(pitch * AIM.trackGain, -1, 1) * k;
  if (stick) {
    // (any push the other way and it lets go on that axis: a nudge that
    // outweighed a light push would turn the ship against the pilot's hand)
    const against = (n, v) => (n * (v || 0) < 0 && Math.abs(v) > AIM.trackDead ? 0 : n);
    turn = against(turn, stick.turn);
    climb = against(climb, stick.climb);
  }
  if (Math.abs(turn) < 1e-12) turn = 0;
  if (Math.abs(climb) < 1e-12) climb = 0;
  return { turn, climb };
}

// a direction as the ship's own angles: the heading that points along it
// and the pitch up it (for turning a bolt to face the way it flies)
export function aimAngles(dir) {
  const d = unit(dir);
  return { heading: Math.atan2(-d[0], -d[2]), pitch: Math.asin(clamp(d[1], -1, 1)) };
}

// Whether a bolt going from `b0` to `b1` this frame touched a target going
// from `t0` to `t1` (within `r` of its middle), both moving at once: how far
// through the frame they met (0 to 1), or null. (Tested against where the
// target is only at the end of the frame, a quick one crossing the bolt's
// path is missed.)
// (now lib/combat/contact.js's sweptSpheres)
export { sweptSpheres as sweptHit } from '../contact';

// Where a marker for something off the screen goes: on the edge of the open
// part of the canvas (`rect`: { x, y, w, h }), `pad` px in, on the line from
// its middle out toward the thing's projected point (`p`: { x, y } in px and
// z, its depth in front; one behind the camera projects through the middle,
// so the way to it is turned round), and the angle the arrow turns to point
// that way (radians, 0 is right, growing clockwise as CSS does).
// (This and onScreen take the point, not its numbers: the HUD's writer calls
// them each frame, and a number handed to a call the engine hasn't inlined is
// made into an object of its own.)
export function edgeOf(p, rect, pad = 28, out = { x: 0, y: 0, angle: 0 }) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const hw = Math.max(1, rect.w / 2 - pad);
  const hh = Math.max(1, rect.h / 2 - pad);
  const way = p.z > 0 ? 1 : -1;
  const dx = (p.x - cx) * way;
  const dy = (p.y - cy) * way;
  const l = Math.sqrt(dx * dx + dy * dy);
  if (l < 1e-6) {
    out.x = cx;
    out.y = cy - hh;
    out.angle = -Math.PI / 2;
    return out;
  }
  const ux = dx / l;
  const uy = dy / l;
  const k = Math.min(hw / Math.max(1e-6, Math.abs(ux)), hh / Math.max(1e-6, Math.abs(uy)));
  out.x = cx + ux * k;
  out.y = cy + uy * k;
  out.angle = Math.atan2(uy, ux);
  return out;
}

// is a projected point (`p`: { x, y } in screen px, z its depth in front of
// the camera) where a bracket can sit: in front, and inside the open area
// with a margin
export function onScreen(p, rect, margin = 24) {
  return p.z > 0.3 && p.x >= rect.x + margin && p.x <= rect.x + rect.w - margin && p.y >= rect.y + margin && p.y <= rect.y + rect.h - margin;
}
