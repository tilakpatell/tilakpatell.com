// Invincible’s city (components/worlds/looks.js): scanned, the HQ engine’s
// physically based materials and glTF figures under the house look
// (Neutral through houseOn, ../../avengers/hq/stage.js).
//
// The bloom keeps the numbers the city was lit by, a threshold of 0.92, so
// the windows at night, the beacons and the villains’ blasts glow as they
// did; the house’s threshold of 1 wants them lifted over white with hot()
// and looked at on a real GPU first.

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: Object.freeze({ threshold: 0.92, strength: 0.5, radius: 0.5 }),
  why: {
    bloom: 'the city draws with the bloom it was lit by (0.92) until its night windows and blasts are lifted over white with hot()',
  },
};
