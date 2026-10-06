// One quality level for the runtime: the device's tier and its budget
// (lib/device), the pace that softens the picture when frames come late
// (lib/three/pace), and a floor under it: when the pace has been at its
// last step for `floorAfter` ms of frames and the frames are still late,
// the level goes one past the steps, once, so a module can shed its own
// effects (what a scene's `onSlow` meant). The pixel ratio to draw at is
// the budget's, never past the screen's own (`dpr`: a 1× screen draws at
// 1), under a module's cap where it has one (`ratioUnder`), × scale; the
// runtime sets it on the renderer.
//
// createQuality({ tier, pace, floorAfter, dpr }) → { tier, budget, level,
//   scale, ratio, ratioUnder(cap), on(fn) → undo, frame(now) → the new
//   level or null, reset() }

import { BUDGETS, device } from '../lib/device';
import { STEPS, createPace } from '../lib/three/pace';

export function createQuality({ tier = device().tier, pace = createPace(), floorAfter = 2500, dpr = Infinity } = {}) {
  const budget = BUDGETS[tier] ?? BUDGETS.high;
  const last = STEPS.length - 1;
  const listeners = new Set();
  let level = 0;
  let scale = 1;
  let atLastSince = null; // when the pace reached its last step
  let floored = false;
  const tell = (l) => {
    for (const fn of listeners) fn(l);
  };
  return {
    tier,
    budget,
    get level() {
      return level;
    },
    get scale() {
      return scale;
    },
    get ratio() {
      return Math.min(budget.ratio, dpr) * scale;
    },
    ratioUnder(cap = Infinity) {
      return Math.min(cap ?? Infinity, budget.ratio, dpr) * scale;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    frame(now) {
      const changed = pace.frame(now);
      if (changed !== null && !floored) {
        scale = pace.scale;
        if (pace.level !== level) {
          level = pace.level;
          atLastSince = level === last ? now : null;
          tell(level);
          return level;
        }
      } else if (floored) {
        scale = STEPS[last];
      }
      if (!floored && level === last) {
        if (atLastSince === null) atLastSince = now;
        else if (now - atLastSince >= floorAfter) {
          floored = true;
          level = STEPS.length;
          tell(level);
          return level;
        }
      }
      return null;
    },
    reset() {
      pace.reset();
      level = 0;
      scale = 1;
      atLastSince = null;
      floored = false;
    },
  };
}
