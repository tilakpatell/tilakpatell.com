// How each of the other pilots is drawn, now the universe is spread wide:
// a ship near you, and otherwise nothing in the sky (the chart's blip is
// NavMap.jsx's); and where a trip to one goes through a gap in their poses.
// Pure, so it's tested in Node; pilots.js reads it each frame.

// map units: within this of you, a pilot is drawn as their ship
export const DRAW = 3000;

// ms: how long past their last pose a pilot is still somewhere to fly to.
// Their ship is hidden once no pose has come for STALE_MS (protocol.js), but
// a gap of a few seconds is a long frame on their side (software drawing, a
// shader compiling as you come into their view), a tab put behind another a
// moment, or a burst of late packets, not a pilot gone: a trip to them
// (pilotGoal.js) steers on to where they last were through it. Hidden, down
// on a planet, shot down, blocked or gone from the room ends it at once.
export const HOLD_MS = 6000;

// The pose a trip to a pilot goes by (pilots.js's pose(id)), with `at`, when
// it was theirs: `live` (where they are now, or null), else the one `held`
// from before while it's younger than `hold`; null once they've `gone`.
export function holdPose(held, live, now, { gone = false, hold = HOLD_MS } = {}) {
  if (live) return { ...live, at: now };
  if (gone || !held || !(now - held.at <= hold)) return null;
  return held;
}

// 'ship' | 'blip', for a pilot at `pose` (protocol.js's) seen from `me`
// ({ x, y, z }, or null: not flying, so everyone's far). (An old client's
// lane bit, from when there were hyperlanes, means nothing now.)
export function howToDraw(pose, me) {
  return me && Math.hypot(pose.x - me.x, pose.y - me.y, pose.z - me.z) <= DRAW ? 'ship' : 'blip';
}
