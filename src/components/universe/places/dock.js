// Docking at a generated station, as a rule. Pure (no React, DOM or
// three.js), and it takes only the ship's gaps.
//
// A ship docks when it comes in slowly to just past the station's park
// (reach + PARK_GAP.near, where the autopilot stops), and stays docked until
// it is well clear, so sitting at the dock's edge, or drifting there, doesn't
// flicker between docked and not. Docking says only where the ship is: what
// it opens, and when, is the scene's (only a trip's own end, once).
//
// DOCK = { speed, in, out }: docked within the park + in at under speed
//   (units a second); undocked past the park + out
// dockState(ship, station, was) → boolean. ship: { x, y, z, speed } (a
//   missing speed reads as still, as around.js's does); station: a row
//   (around.js's) with { place, at, reach }; was: whether it was docked.
//   With was false: within reach + PARK_GAP.near + DOCK.in of the station's
//   at, and |speed| under DOCK.speed. With was true: within reach +
//   PARK_GAP.near + DOCK.out, at any speed. False for anything not a station.

import { PARK_GAP } from '../ship';

export const DOCK = Object.freeze({ speed: 1, in: 2, out: 30 });

export function dockState(ship, station, was) {
  if (station?.place !== 'station' || !station.at) return false;
  const d = Math.hypot(ship.x - station.at[0], ship.y - station.at[1], ship.z - station.at[2]);
  const park = (station.reach ?? 0) + PARK_GAP.near;
  if (was) return d <= park + DOCK.out;
  return d <= park + DOCK.in && Math.abs(ship.speed ?? 0) < DOCK.speed;
}
