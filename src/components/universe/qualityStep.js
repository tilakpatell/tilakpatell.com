// The runtime’s quality level (runtime/quality.js, through the world’s
// lowerQuality) as the universe map draws it. Each of lib/three/pace’s steps
// is a little softer through the post (its sharpness, over a canvas that
// keeps its size: module.js’s `sharpness: 'own'`), the aberration and the
// soft edge gone from step 3 (post.js’s setLevel), the blasts as pops from
// step 2 or on a low tier, the rocks’ relief flat from step 3 and the
// planets’ detail by the step (planets.js’s setLevel): what the map’s own
// pace did before the runtime’s took over. One past the steps is the floor
// (`floor`), where the map sheds its own effects, as its watchdog’s onSlow
// had it do.
//
// A level is where to be, not a step down from where it was: the runtime
// asks for any (its calibration walks them, sharpest first, and a world
// starts at the level the last one left), so each is worked out whole.
//
// stepAt(level, { tier, low }) → { sharpness, step, blasts, relief, floor }

import { STEPS } from '../../lib/three/pace';

export function stepAt(level = STEPS.length, { tier = 'high', low = false } = {}) {
  // (no level, or none that’s a number, is the floor: fromScene’s onSlow)
  const l = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : STEPS.length;
  const step = Math.min(l, STEPS.length - 1);
  const floor = l >= STEPS.length;
  return {
    sharpness: STEPS[step],
    step,
    blasts: step >= 2 || tier === 'low' || low || floor ? 'pop' : 'full',
    relief: step >= 3 ? 0 : 1,
    floor,
  };
}
