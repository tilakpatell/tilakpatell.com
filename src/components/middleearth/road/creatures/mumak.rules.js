// The mûmak’s walk: the four-beat of creatures.js’s WALK (hind left, fore
// left, hind right, fore right), slow and heavy, at about a metre a second,
// a long stride and every foot down most of the cycle, so no more than two
// are ever off the ground. Pure: the scene swings the legs by it.
//
//   feetAt(t, { speed = PACE }) → [{ x, lift }] × 4, footAt’s for each leg
//   (x from 1 at the foot’s fall to −1 at its lift, lift 0 while it bears)

import { STANCE, WALK, footAt } from '../../creatures';

export const PACE = 1; // m/s
export const STRIDE = 2.6; // m a cycle

export function feetAt(t, { speed = PACE } = {}) {
  if (!(speed > 0)) return WALK.map(() => ({ x: 0, lift: 0 }));
  const cycle = (t * speed) / STRIDE;
  return WALK.map((o) => footAt(cycle + o, STANCE.walk));
}
