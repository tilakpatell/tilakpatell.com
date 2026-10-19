// The Red Book’s look (components/worlds/looks.js): painted. Its pages are
// card washed in watercolour and inked in code (./paint.js), the study’s
// solids flat colours and painted canvases, under the house tone, with a
// softer bloom than the house for the candles, the fire and the Eye.

export const LOOK = {
  art: 'painted',
  palette: ['#7e1d17', '#efe3c4', '#2b2116', '#93a86a', '#9fc0d6', '#ffcf6a', '#33394a', '#5c3a20', '#e0571a', '#8b8494'],
  tone: 'house',
  bloom: { threshold: 0.8, strength: 0.55, radius: 0.5 },
  why: {
    bloom: 'the candles, the fire and the Eye in the window are the only lights in a dark room, and bloom from a threshold of 0.8 so they glow without an HDR lift; drawn only on the tiers that bloom at all',
  },
};
