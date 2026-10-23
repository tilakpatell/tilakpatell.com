// Invincible’s city (components/worlds/looks.js): scanned, the HQ engine’s
// physically based materials and glTF figures under the house look
// (Neutral through houseOn, ../../avengers/hq/stage.js).
//
// The bloom is the house's (lib/three/bloom) but for its threshold: what
// glows is only what is lifted over white with hot() (the spires’ beacons
// at 3, the lamps’ globes and the traffic lights at night at 3, the
// villains’ bolts and blasts, Eve’s atom), never the city lit. Its noon sun
// is 4.2 (./sceneLook.js), which puts a lit white wall, the crossings and
// Mark’s yellow at 1.3 to 1.7 in linear light: at the house's threshold of
// 1 those glowed, and at 0.92, the bloom the city was first lit by, the
// whole frame glared white on mid and high (low draws no bloom). So the
// threshold is 2, with a soft knee of 0.3 so a beacon fades in, not on.

import { BLOOM } from '../../../lib/three/bloom';

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: Object.freeze({ ...BLOOM, threshold: 2, knee: 0.3 }),
  why: {
    bloom: 'the noon sun (4.2) lights white to 1.3–1.7 in linear light, so only what hot() lifts past 2 glows',
  },
};
