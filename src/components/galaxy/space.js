// A star system as somewhere to fly: the space ship.js's step() and
// autopilot() fly the ship through (universe/ship.js's SPACE has the same
// shape). Pure numbers, so it's tested in Node.
//
// A system is free all the way round: no disc to keep to, so the ceiling and
// the floor are a long way off (CEILING), and it ends at EDGE, where the ship
// is turned back (beyond it there's only hyperspace: the way to the next
// system is a jump, not a flight). Out in the open it opens up into the
// sublight drive (up to PULSE), so crossing the system doesn't drag, and it
// drops back to the boost as you come up on the planet or anything big round
// it (so you never arrive at it flat out). It goes by where the ship's
// heading, as the universe map's does (deep.js's gapAlong): flying past one,
// wide of it, or away from it, it stays open, so there's no wall round the
// planet or a battle's capital ships to crawl through.
//
// Well out from everything, the drive opens again into super speed: the
// ship's own overdrive (ship.js's OVERDRIVE, up to three times what the
// drive allows, its brakes squared so it stops in the same room), by how
// wide open it is the way it's going (wideAlong: none within WIDE.near of
// anything big's reach, all of it WIDE.ramp further out), so crossing an
// open system doesn't drag and nothing changes near the planet, where the
// moment from the films plays. The scene hands overdriveAt's number to
// step() as input.overdrive while the pilot boosts, and to the autopilot.
//
// A planet counts from just over its surface (AIR, of its radius), not from
// its reach: the worlds are grown (fit.js), so Hoth's reach is 150 units of
// air over its ground, and with the drive shut all through it, climbing out
// took twelve seconds at the boost, like glue.
//
// EDGE, CEILING, PULSE, WIDE; FAR (the camera's far plane, for all of it in view)
// makeSpace(solids) → { edge, ceilingAt, openness, driveAt, driveAlong, wideAlong, overdriveAt, homeAt, boostAt, brakeAt, coastAt, solids, goals }
// solids: [{ id, at: [x, y, z], r, reach, band?, swallow? }]: what the ship
// bumps into (the planet, its moons, the Death Star, the big rocks…); the
// ones with `goal` are somewhere the autopilot can take you.

import { OVERDRIVE, SHIP, headingTo } from '../universe/ship';
import { gapAlong } from '../universe/deep';
import { conj, fromAngles, rotate } from '../../lib/flight/orient';

export const EDGE = 2400;
export const CEILING = 420;
export const PULSE = 120;
// how far the camera sees: the gas giant a system orbits is out at up to
// fit.js's FIT.farthest (7,600) and over 900 across, so from the edge on the
// far side of the planet it's 10,000 off; the sky's drawn on the far plane
// whatever its distance, so seeing further costs nothing
export const FAR = 12000;
const NEAR = 26; // past a thing's reach: closer than this, the drive's down
const RAMP = 90; // and over this much further it opens all the way
const PARK = 6; // how far past a goal's reach the autopilot stops
export const AIR = 0.15; // a planet's, of its radius over its surface: where its drive's down (not its reach)
export const WIDE = { near: 500, ramp: 500 }; // past anything big's reach: no super speed within `near`, all of it `ramp` further out

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (k) => k * k * (3 - 2 * k);

export function makeSpace(solids, { edge = EDGE, ceiling = CEILING } = {}) {
  const goals = Object.fromEntries(solids.filter((o) => o.goal).map((o) => [o.id, o]));
  // the big things only count for how open it is (a pebble in a rock field
  // shouldn't cut the drive)
  const big = solids.filter((o) => o.r >= 1.5 || o.goal);
  // how open it is at (x, y, z) going the way `f` points (a unit vector;
  // none: as it would be going straight at the nearest thing)
  // (a planet closes it from just over its surface, the rest from their reach)
  const edgeOf = (o) => (o.planet ? o.r * (1 + AIR) : (o.reach ?? o.r));
  const driveAlong = (x, y, z, f = null) => {
    let gap = Infinity;
    for (const o of big) gap = Math.min(gap, gapAlong(x, y, z, f, o.at, edgeOf(o)));
    return smooth(clamp((gap - NEAR) / RAMP, 0, 1));
  };
  const openness = (x, y, z) => driveAlong(x, y, z);
  // how wide open it is at (x, y, z) going the way `f` points: super speed's share
  const wideAlong = (x, y, z, f = null) => {
    let gap = Infinity;
    for (const o of big) gap = Math.min(gap, gapAlong(x, y, z, f, o.at, o.reach ?? o.r));
    return smooth(clamp((gap - WIDE.near) / WIDE.ramp, 0, 1));
  };
  const overdriveAt = (x, y, z, f = null) => 1 + (OVERDRIVE - 1) * wideAlong(x, y, z, f);
  return {
    edge,
    ceilingAt: () => ceiling,
    openness,
    driveAt: openness, // (how far the sublight drive's open: all of how open it is)
    driveAlong, // (and the way the ship's going: step() and the autopilot use it)
    wideAlong,
    overdriveAt,
    homeAt: () => 0, // (none of the universe map's home-system handling)
    // (`open`, how open the drive is, if ship.js knows it already: less, held down by hunters)
    boostAt: (x, y, z, boost = SHIP.boost, open = openness(x, y, z)) => boost + (PULSE - boost) * open,
    brakeAt: (x, y, z, open = openness(x, y, z)) => SHIP.brake * (1 + 2.5 * open),
    coastAt: (x, y, z, open = openness(x, y, z)) => SHIP.coast * (1 + 3.5 * open),
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
