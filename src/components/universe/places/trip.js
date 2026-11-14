// How long a long trip takes, by a formula, not by flying it. Pure (no React,
// DOM or three.js). The nav imports it, so it takes only the ship's numbers,
// and nothing from nav.js.
//
// Why: nav.js's tripTime flies the trip on the real physics for at most 150
// s, so a place thousands of sectors off had no time, only a dash. In the
// open the autopilot turns to the park, runs up to the pulse drive (three
// times that on super speed), holds it and comes down onto the stop, and
// that flies in a straight line's time plus an overhead that hardly moves
// with the distance. Fitted to the autopilot in open space at 2,000, 10,000
// and 40,000 off, nose on, side on and tail on: cruise flies in D / 300 +
// 7.07 s nose on, super in D / 900 + 4.7 to 6.2 s, and the formula is within
// 0.9 s of every one of the eighteen.
//
// TRIP = { extra, turn }, in seconds, each by drive: extra is the run-up and
//   the stop, turn the most a turn to face the park adds (tail on)
// longTrip(ship, park, drive) → seconds, for drive 'cruise' or 'super' (any
//   other reads as cruise): D / v + extra + turn × angle / π, D the 3D
//   distance from the ship to the park, v = SHIP.pulse (× OVERDRIVE on
//   super), angle between the ship's nose and the way to the park (0 when D
//   is 0). Finite for any finite input. The jump's time is nav.js's
//   HYPER.length, applied there.

import { OVERDRIVE, SHIP, noseOf } from '../ship';

export const TRIP = { extra: { cruise: 7.1, super: 5.6 }, turn: { cruise: 1.7, super: 0.5 } };

const gear = (drive) => (drive === 'super' ? 'super' : 'cruise');

export function longTrip(ship, park, drive) {
  const g = gear(drive);
  const dx = (park.x ?? 0) - (ship.x ?? 0);
  const dy = (park.y ?? 0) - (ship.y ?? 0);
  const dz = (park.z ?? 0) - (ship.z ?? 0);
  const D = Math.hypot(dx, dy, dz);
  const v = SHIP.pulse * (g === 'super' ? OVERDRIVE : 1);
  let angle = 0;
  if (D > 0) {
    const [nx, ny, nz] = noseOf(ship);
    const n = Math.hypot(nx, ny, nz) || 1;
    const cos = (nx * dx + ny * dy + nz * dz) / (n * D);
    angle = Math.acos(Math.min(1, Math.max(-1, cos)));
  }
  return D / v + TRIP.extra[g] + (TRIP.turn[g] * angle) / Math.PI;
}
