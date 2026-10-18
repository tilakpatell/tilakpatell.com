// His brawl drawn and felt (./brawl.js's outs, as ./scene.js's events):
// the crater a slam or a dive leaves (on a tower's face, its crash), the
// camera's knock and the stop by how hard, the street running from it. The
// pound's ring is ./villains.js's to draw, with the foes it passes. And his
// poses for it: arms up holding what he carries, crossed for his block.

import { groundAt } from './map';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// His arms up over his head, holding what he carries (./brawl.js's grab),
// and crossed in front of him, his block (where he has no hit clip to hold
// at its first frame).
export const HOLD_UP = { armR: [-0.25, 1, 0.15], foreR: [-0.1, 1, 0.25], armL: [0.25, 1, 0.15], foreL: [0.1, 1, 0.25] };
export const GUARD = { armR: [-0.35, 0.1, 0.9], foreR: [0.65, 0.55, 0.35], armL: [0.35, 0.1, 0.9], foreL: [-0.65, 0.55, 0.35] };

// one of the brawl's events this frame
export function brawlFeel(e, { fx, feel, scare }) {
  // (a counter's stop is the longest)
  if (e.kind === 'slam' || e.kind === 'diveHit') {
    if (e.tower != null) fx.impact(e.at, [0, 1, 0], e.force ?? 60);
    else fx.slam([e.at[0], groundAt(e.at[0], e.at[2]), e.at[2]], Math.max(60, e.force ?? 60));
    feel.trauma(clamp((e.force ?? 60) / 120, 0.4, 1));
    feel.hitstop(70);
    scare.push({ x: e.at[0], z: e.at[2], r: 40 });
  } else if (e.kind === 'pound') {
    feel.trauma(0.5);
    scare.push({ x: e.at[0], z: e.at[2], r: 45 });
  } else if (e.kind === 'counter') {
    feel.trauma(0.3);
    feel.hitstop(110);
  } else feel.trauma(0.15);
}
