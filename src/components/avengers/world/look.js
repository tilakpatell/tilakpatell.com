// The compound’s look (components/worlds/looks.js): scanned, the HQ
// engine’s physically based materials, scanned ground and glTF figures,
// under the house look (Neutral through houseOn, ../hq/stage.js).
//
// The bloom is its own and over white: a threshold of 1.55 with a soft knee
// of 0.9, so a sunlit glass wing doesn’t flare and only the lamps, the
// reactor and the portal (lifted with hot()) glow, at a strength of 0.36.

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: Object.freeze({ threshold: 1.55, strength: 0.36, radius: 0.5, knee: 0.9 }),
  why: {
    bloom: 'over white on purpose: the glass wing catches the sun, so only what is lifted well past 1 glows',
  },
};
