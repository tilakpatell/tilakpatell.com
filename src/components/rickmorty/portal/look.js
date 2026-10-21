// Portal panic’s look (components/worlds/looks.js): painted. The show’s flat
// colours on a two-step toon ramp (./toon.js), a line round the cast only and
// no film grade, each dimension its own sky
// and ground (Portal3D.js’s DIMS); the palette is the cast’s and the
// arenas’ own. The house tone (Neutral, through houseOn). Its bloom is under
// white: the shots, the portals and the bursts are the light of a small
// arena seen from high up.

export const LOOK = {
  art: 'painted',
  palette: ['#2f7fd6', '#4f9a3c', '#8e4462', '#c4652c', '#343e52', '#d8848f', '#9dff5a', '#111111'],
  tone: 'house',
  bloom: { strength: 0.55, radius: 0.4, threshold: 0.92 },
  why: {
    art: 'the cast is the shared Meshy cast (./meshyCast.js) under the toon ramp, with a toy-box fallback (./cast.js)',
    bloom: 'the shots, the portals and the bursts glow from high above a small arena, and the arenas’ ground stays under the threshold',
  },
};

// The line round the cast, in metres: the camera's about 21 m above the
// arena, so wider than C-137's, as wide as the toy-box shapes' (./cast.js)
export const CAST_INK = 0.03;
