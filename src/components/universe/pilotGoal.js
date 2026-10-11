// Flying to another pilot: the autopilot's goal for them, a parking spot
// behind their ship that moves as they do. Pure (no three.js, no React), so
// it's tested in Node; scene.js and the galaxy's scene fly it.
//
// A pilot's goal is `pilot:<their id>`. It's in the space only while their
// pose is (pilots.js's pose(id): sampled, in this place, not hidden), so a
// pilot who goes offline or out of sight takes their goal with them and the
// trip ends; nothing of theirs is kept that they aren't sending now, but for
// a gap of a few seconds in their poses (online/pilotsRules.js's HOLD_MS: a
// slow frame on their side, packets late), which goes on to where they last were.
//
// pilotId(goal) → their id, or null for any other goal
// parkBehind(pose, { back }) → { x, y, z, heading }: `back` units behind
//   them along their heading, at their height, facing the way they face
// pilotSpace(space, id, pose) → the space with their goal in it (or out of
//   it, for no pose); every other goal as it was
// reached(ship, pose, within) → whether the ship is within reach of them
// REAIM_MS: how often the park is worked out again while the trip runs

import { forward } from './ship';

export const PILOT_GOAL = /^pilot:/;
export const REAIM_MS = 1000;
const BACK = 6;
const WITHIN = 8;

export const pilotId = (goal) => (typeof goal === 'string' && PILOT_GOAL.test(goal) && goal.length > 6 ? goal.slice(6) : null);

// (a pose with any number in it that isn't one is no pose: it would put the
// goal nowhere and the autopilot after it)
const real = (pose) => Boolean(pose) && [pose.x, pose.y, pose.z, pose.heading].every(Number.isFinite);

export function parkBehind(pose, { back = BACK } = {}) {
  if (!real(pose)) return null;
  const [fx, fz] = forward(pose.heading);
  return { x: pose.x - fx * back, y: pose.y, z: pose.z - fz * back, heading: pose.heading };
}

export function pilotSpace(space, id, pose) {
  const key = `pilot:${id}`;
  const goals = { ...space.goals };
  delete goals[key];
  const park = parkBehind(pose);
  // (`at` as the other goals have it, for the HUD's diamond; nothing solid,
  // so nothing to steer round or crash into)
  if (park) goals[key] = { id: key, ...park, at: [park.x, park.y, park.z], r: 0, reach: 0 };
  return { ...space, goals };
}

export function reached(ship, pose, within = WITHIN) {
  if (!ship || !real(pose)) return false;
  return Math.hypot(ship.x - pose.x, (ship.y ?? 0) - pose.y, ship.z - pose.z) <= within;
}
