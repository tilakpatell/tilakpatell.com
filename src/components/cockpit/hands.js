// What the pilot's body does through a launch (./pilot.js draws it), pure:
// at a moment `t` (ms from the go) of a vehicle's plan (./timeline.js), how
// far each move has got, 0…1.
//
// The Falcon (falconHands): you lean in over the console, your right hand
// leaves the yoke for the hyperdrive levers and pushes them home, Chewie's
// hand beside yours; then, the ship away, your hand goes back to the yoke and
// the jump presses you back into the seat.
//
//   lean    the back bent towards the console (1: all the way in); under
//           0 it's pressed back into the seat by the jump
//   reach   the right hand on the levers (0: on the yoke)
//   push    the levers pushed forward under it (they stay there)

import { smooth } from './timeline';

const REST = { lean: 0, reach: 0, push: 0 };

export function falconHands(plan, t, { launching = true } = {}) {
  if (!launching || t <= 0) return { ...REST };
  // (in from the moment you go, the hand on the levers a quarter of a second
  // later, and the push under it as it lands)
  const lean = 0.8 * smooth(t / 320) * (1 - smooth((t - 1050) / 500)) - pressed(plan, t);
  const reach = smooth(t / 280) * (1 - smooth((t - 1150) / 450));
  const push = smooth((t - 200) / 420);
  return { lean, reach, push };
}

// the jump's push back into the seat: building with the go, eased off as
// the flash comes
const pressed = (plan, t) => 0.3 * smooth((t - plan.spool) / 700) * (1 - smooth((t - (plan.peak - 300)) / 300));
