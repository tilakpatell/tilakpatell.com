// A star system as somewhere to fly: the space ship.js's step() and
// autopilot() fly the ship through (universe/ship.js's SPACE has the same
// shape). Pure numbers, so it's tested in Node.
//
// A system is free all the way round: no disc to keep to, so the ceiling and
// the floor are a long way off (CEILING), and it ends at EDGE, where the ship
// is turned back (beyond it there's only hyperspace: the way to the next
// system is a jump, not a flight). Near the planet and the big things round
// it the boost is the boost; out in the open between them it opens up into
// the sublight drive (up to PULSE), so crossing the system doesn't drag, and
// drops back as you come up on anything (so you never arrive at it flat out).
//
// makeSpace(solids) → { edge, ceilingAt, openness, driveAt, homeAt, boostAt, brakeAt, coastAt, solids, goals }
// solids: [{ id, at: [x, y, z], r, reach, band?, swallow? }]: what the ship
// bumps into (the planet, its moons, the Death Star, the big rocks…); the
// ones with `goal` are somewhere the autopilot can take you.

import { SHIP, headingTo } from '../universe/ship';
import { conj, fromAngles, rotate } from '../universe/orient';

export const EDGE = 900;
export const CEILING = 420;
export const PULSE = 62;
const NEAR = 26; // past a thing's reach: closer than this, the drive's down
const RAMP = 90; // and over this much further it opens all the way
const PARK = 6; // how far past a goal's reach the autopilot stops

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (k) => k * k * (3 - 2 * k);

export function makeSpace(solids, { edge = EDGE, ceiling = CEILING } = {}) {
  const goals = Object.fromEntries(solids.filter((o) => o.goal).map((o) => [o.id, o]));
  // the big things only count for how open it is (a pebble in a rock field
  // shouldn't cut the drive)
  const big = solids.filter((o) => o.r >= 1.5 || o.goal);
  const openness = (x, y, z) => {
    let gap = Infinity;
    for (const o of big) {
      const dx = x - o.at[0];
      const dy = y - o.at[1];
      const dz = z - o.at[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - (o.reach ?? o.r);
      if (d < gap) gap = d;
    }
    return smooth(clamp((gap - NEAR) / RAMP, 0, 1));
  };
  return {
    edge,
    ceilingAt: () => ceiling,
    openness,
    driveAt: openness, // (how far the sublight drive's open: all of how open it is)
    homeAt: () => 0, // (none of the universe map's home-system handling)
    boostAt: (x, y, z, boost = SHIP.boost) => boost + (PULSE - boost) * openness(x, y, z),
    brakeAt: (x, y, z) => SHIP.brake * (1 + 2.5 * openness(x, y, z)),
    coastAt: (x, y, z) => SHIP.coast * (1 + 3.5 * openness(x, y, z)),
    solids,
    goals,
  };
}

// Where the autopilot parks at a goal, coming from `from` ([x, y, z]): out
// past its reach on the side it's coming from, level with its middle a
// little above, facing it; clear of everything else solid (round to the next
// side along if not). { x, y, z, heading }
export function parkBy(goal, from, solids = []) {
  const d = (goal.reach ?? goal.r) + PARK;
  let ax = from[0] - goal.at[0];
  let az = from[2] - goal.at[2];
  const al = Math.hypot(ax, az) || 1;
  ax /= al;
  az /= al;
  const a0 = Math.atan2(az, ax);
  for (let i = 0; i < 16; i++) {
    const a = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 8);
    const x = goal.at[0] + Math.cos(a) * d;
    const z = goal.at[2] + Math.sin(a) * d;
    const y = goal.at[1] + Math.min(goal.r * 0.25, 6);
    const clear = solids.every((o) => o === goal || Math.hypot(x - o.at[0], y - o.at[1], z - o.at[2]) > (o.reach ?? o.r) + 2);
    if (clear) return { x, y, z, heading: headingTo(goal.at[0] - x, goal.at[2] - z) };
  }
  const x = goal.at[0] + ax * d;
  const z = goal.at[2] + az * d;
  return { x, y: goal.at[1], z, heading: headingTo(goal.at[0] - x, goal.at[2] - z) };
}

const gapTo = (ship, o) => Math.hypot(ship.x - o.at[0], ship.y - o.at[1], ship.z - o.at[2]) - (o.reach ?? o.r);

// The goal the ship is at, if any (inside its reach and a little more);
// once at one it stays at it until it's clearly left
export function atGoal(ship, goals, current = null) {
  if (current && goals[current] && gapTo(ship, goals[current]) < PARK * 3) return current;
  let best = null;
  let bd = PARK * 1.6;
  for (const id in goals) {
    const o = goals[id];
    const d = gapTo(ship, o);
    if (d < bd) {
      best = o.id;
      bd = d;
    }
  }
  return best;
}

// How well the nose points along `dir` (a unit vector): the cosine of the
// angle between them, from ship.js's numbers
export function aligned(ship, dir) {
  const cp = Math.cos(ship.pitch || 0);
  const f = [-Math.sin(ship.heading) * cp, Math.sin(ship.pitch || 0), -Math.cos(ship.heading) * cp];
  return f[0] * dir[0] + f[1] * dir[1] + f[2] * dir[2];
}

// The stick that swings the nose round onto `dir` (a unit vector), the way a
// pilot would before a jump: turn and pull toward it in the ship's own frame
// (damped, so the turns' inertia doesn't carry it past), rolling level as it
// goes. { turn, climb, roll }
export function steerToward(ship, dir) {
  const q = fromAngles(ship.heading, ship.pitch || 0, ship.bank || 0);
  const b = rotate(conj(q), dir);
  const yaw = Math.atan2(-b[0], -b[2]); // > 0: off to the left
  const tip = Math.atan2(b[1], Math.sqrt(b[0] * b[0] + b[2] * b[2])); // > 0: above the nose
  return {
    turn: clamp(-yaw * 2.2 + (ship.rate || 0) * 0.12, -1, 1),
    climb: clamp(tip * 2.2 - (ship.tipRate || 0) * 0.12, -1, 1),
    roll: clamp(-(ship.bank || 0) * 1.5 * Math.cos(ship.pitch || 0), -1, 1),
  };
}
