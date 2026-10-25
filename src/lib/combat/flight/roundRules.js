// A heavy round's flight, as plain rules (rounds.js flies the meshes by them,
// for the universe map and the galaxy both): a moment's straight run off
// the rails, then steered onto what the guns had locked when it went, at
// its weapon's homing rate (weapons.js's steer), and, right by its target,
// straight into its middle. A part of the Citadel's siege is a point on a
// wall, not a ship to snap into, so it's met where it's met. Pure, tested.
//
//   RAILS                             seconds of straight run before it homes
//   homeOn(d, find) → d.target         its target looked up by id (find: the scene's sight.find): gone, null, and it flies straight
//   steerRound(d, at, dt, scratch)    d.v turned onto d.target.at (in place)
//   nearTarget(d, at) → boolean       right by its target: a step to its middle meets it

import { steer } from './guns';

export const RAILS = 0.12;
const REACH = 0.35; // (how far past a target's size it snaps in)

// the target a round was launched at, found by its id each step: a hunter shot
// down is gone from the scene's foes, so the round flies on straight, and one
// back (out of hiding) is homed on again
export function homeOn(d, find) {
  d.target = d.targetId == null ? null : find(d.targetId);
  return d.target;
}

// `d`: { v: [x, y, z], homing (rad/s), target: { at: { x, y, z } } | null, age (s) };
// `at`: where the round is; `scratch`: a [0, 0, 0] the caller keeps (nothing made a frame)
export function steerRound(d, at, dt, scratch) {
  const tg = d.target;
  if (!tg?.at || d.age <= RAILS) return;
  scratch[0] = tg.at.x - at.x;
  scratch[1] = tg.at.y - at.y;
  scratch[2] = tg.at.z - at.z;
  const l = Math.sqrt(scratch[0] * scratch[0] + scratch[1] * scratch[1] + scratch[2] * scratch[2]) || 1;
  scratch[0] /= l;
  scratch[1] /= l;
  scratch[2] /= l;
  steer(d.v, scratch, d.homing, dt);
}

export function nearTarget(d, at) {
  const tg = d.target;
  if (!tg?.at || tg.siegePart !== undefined) return false;
  return Math.hypot(tg.at.x - at.x, tg.at.y - at.y, tg.at.z - at.z) < (tg.size ?? 0.3) + REACH;
}
