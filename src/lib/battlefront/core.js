// What the sim and the bots share: the clock's constants, the muzzle and the trigger. Pure.
//   STEP, THINK, SENSE, SQUAD (seconds)    profile, clock()    muzzleOf(s) → [x, y, z]    shoot(sim, s, aim) → bool

import { eyeOf } from './soldier.js';
import { fire as fireGun } from './weapons.js';

export const STEP = 0.05;
export const THINK = 0.2;
export const SENSE = 0.1;
export const SQUAD = 0.5;

// Where a run's time goes, for the balance runner's --profile (milliseconds; off unless asked).
export const profile = { on: false, think: 0, bolts: 0, path: 0 };
export const clock = () => (profile.on ? performance.now() : 0);

// The muzzle: forward of the eye, a little under it.
const MUZZLE = 0.45;

export function muzzleOf(s) {
  const eye = eyeOf(s);
  return [eye[0] + Math.sin(s.yaw) * MUZZLE, eye[1] - 0.15, eye[2] + Math.cos(s.yaw) * MUZZLE];
}

// pull the trigger toward a point: the gun says whether and how many bolts, and when
export function shoot(sim, s, aim) {
  if (!s.alive || !s.gun || !aim) return false;
  const shots = fireGun(s.gun, sim.time, { stance: s.stance, moving: s.moving });
  if (!shots) return false;
  // firing ends spawn protection
  s.safeUntil = -Infinity;
  for (const shot of shots) sim.pending.push({ owner: s.id, at: shot.at, dir: shot.dir, aim: [...aim] });
  return true;
}
