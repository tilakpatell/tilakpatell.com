// C-137’s world’s look (components/worlds/looks.js): painted. The show’s
// flat colours on a two-step toon ramp (../portal/toon.js), a clean line
// round the cast only and no film grade are its art; the
// palette is the kit’s own (./kit.js: the walls, the floors, the wood, the
// metal, the glass, the portal’s green), and Morty’s and Rick’s clothes
// from the wardrobe (../wardrobe/) are the one mixed thing, on purpose.
// The house tone (Neutral, through ../stage): the exposure was tuned
// under it.
//
// One folder, three scenes, each with its own bloom (BLOOMS): the street
// and the rooms (LOOK’s), Roy’s life (a touch lower: its stage lights and
// its confetti), and the sewer’s run, whose laser, screws and slime glow
// under white on purpose, the drain being dark.

export const BLOOMS = {
  street: { strength: 0.55, radius: 0.45, threshold: 1.15 },
  roy: { strength: 0.5, radius: 0.42, threshold: 1.05 },
  sewer: { strength: 0.55, radius: 0.4, threshold: 0.9 },
};

export const LOOK = {
  art: 'painted',
  palette: ['#eee0bf', '#c4a77a', '#8a5a34', '#a3acb5', '#9fd4e6', '#9dff5a', '#f2d24a', '#2b2235'],
  tone: 'house',
  bloom: BLOOMS.street,
  why: {
    art: 'the wardrobe’s clothes are dressed on the cast as they are made, not from the palette',
    bloom: 'Roy’s life and the sewer’s run keep their own blooms (BLOOMS); the sewer’s is under white, its laser and screws the light in a dark drain',
  },
};

// The grade every Rick and Morty scene takes (../stage.js's and
// lib/stage3d's grade): none. The show has no grain, no vignette, no
// contrast curve and no tint, and with these values the grade changes nothing.
export const PLAIN = Object.freeze({ contrast: 0, saturation: 1, vignette: 0, grain: 0, shadow: Object.freeze([0, 0, 0]), high: Object.freeze([0, 0, 0]) });

// The line round the cast (lib/three/ink.js's hull, the cast's `ink`), in
// metres: about two pixels at 720p from the rooms' camera 3.6 m off, and
// thinner further away, as the show draws a wide shot.
export const CAST_INK = 0.01;
