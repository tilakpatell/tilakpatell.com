// A ship near a moving generated place goes round with it. Pure (no React,
// DOM or three.js), and it takes only the ship's gaps, the ids and parking,
// never the generator.
//
// Why: a generated planet moves up to about 0.9 units a second (orbit 180,
// 52 turns a cycle), and a moon a little more. The autopilot's stop needs the
// ship under 0.25 units a second, and a parked ship, stick let go, drifts off
// at the planet's speed. So the ship is carried by one body, its frame: the
// trip's goal, if that's a planet or moon, else the planet or moon it's at.
// Only ever that one. Carried by whichever body weighed most, a moon going
// by a ship parked at its planet picked the ship up: over E:1,0, 183 of 746
// parked ships were dragged over a unit off their park within five minutes,
// the worst by 252 units.
//
// A body gives all of its motion out to the greater of 2 reaches and its
// park + 14 (PARK_GAP.out), so a planet that parks past its moons is carried
// as fully as one parked at reach + 4, easing to none 2 reaches further out.
// A change of frame cross-fades over 2 s, so handing over from a planet to
// its moon is no jolt. Flown in by hand from open space, the frame comes on
// whole as the planet's zone takes you, a change of under a unit a second
// while you're under way; a trip has no such step, its goal being the frame
// from the start. The motion is the body's between two times on the space
// clock, whatever the frame's dt, so a slow device stops at a moving place
// too.
//
// CARRY = { inner, outer, fade }: inner and outer in reaches, fade in seconds
// carryZone(body) → { inner, outer }: all of its motion within inner, none
//   past outer (body.park, a row's park distance, or parkDistance(body))
// carryWeight(dist, zone) → 0…1, 1 − smoothstep(inner, outer, dist)
// frameOf(rows, { here, going }) → the row whose id is going, when it's a
//   planet or moon; else the row whose id is here, when it's one; else null
// carryFrames(frames, body, dt) → a new [{ body, k, zone }]: body's entry
//   (matched by id) rises by dt / fade to 1, joining at 0 while another fades
//   out and at 1 into an empty list (a ship placed at a park is carried from
//   its first frame); every other entry falls as much and is dropped at 0. A
//   null body lets them all fall. zone is carryZone(body), worked out once
//   when the body joins and kept while it stays (the same id, the same place)
// carry(ship, frames, t0, t1) → the ship moved by Σ k × weight × the body's
//   motion from t0 to t1 (a moon's includes its planet's), the weight from
//   how far the ship is from the body at t0, in the entry's zone (or
//   carryZone(body) for an entry made by hand). The same object when that's
//   nothing or t1 is t0. It runs every frame, so it makes no array.

import { PARK_GAP } from '../ship';
import { atTime } from './ids';
import { parkDistance } from './park';

export const CARRY = { inner: 2, outer: 4, fade: 2 };

const carries = (row) => row?.place === 'planet' || row?.place === 'moon';
const smoothstep = (e0, e1, x) => {
  const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
};

export function carryZone(body) {
  const park = body.park ?? parkDistance(body);
  const inner = Math.max(CARRY.inner * body.reach, park + PARK_GAP.out);
  return { inner, outer: inner + (CARRY.outer - CARRY.inner) * body.reach };
}

export const carryWeight = (dist, zone) => 1 - smoothstep(zone.inner, zone.outer, dist);

export function frameOf(rows, { here, going }) {
  const find = (id) => (id == null ? null : (rows.find((r) => r.id === id && carries(r)) ?? null));
  return find(going) ?? find(here);
}

export function carryFrames(frames, body, dt) {
  const dk = dt / CARRY.fade;
  const out = [];
  let joined = false;
  for (const f of frames) {
    if (body && f.body.id === body.id) {
      out.push({ body, k: Math.min(1, f.k + dk), zone: f.zone ?? carryZone(body) });
      joined = true;
    } else if (f.k - dk > 0) out.push({ ...f, k: f.k - dk });
  }
  // (into an empty list there's nothing to fade from, so it's whole at once)
  if (body && !joined) out.push({ body, k: frames.length ? Math.min(1, dk) : 1, zone: carryZone(body) });
  return out;
}

const A = [0, 0, 0];
const B = [0, 0, 0];

export function carry(ship, frames, t0, t1) {
  if (t1 === t0) return ship;
  let dx = 0;
  let dy = 0;
  let dz = 0;
  for (const { body, k, zone } of frames) {
    if (!(k > 0)) continue;
    const a = atTime(body, t0, A);
    if (!a) continue;
    const w = k * carryWeight(Math.hypot(ship.x - a[0], ship.y - a[1], ship.z - a[2]), zone ?? carryZone(body));
    if (!(w > 0)) continue;
    const b = atTime(body, t1, B);
    dx += w * (b[0] - a[0]);
    dy += w * (b[1] - a[1]);
    dz += w * (b[2] - a[2]);
  }
  if (dx === 0 && dy === 0 && dz === 0) return ship;
  return { ...ship, x: ship.x + dx, y: ship.y + dy, z: ship.z + dz };
}
