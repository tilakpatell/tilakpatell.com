// The Rick and Morty pages’ look outside their worlds (components/worlds/
// looks.js): the cruiser flying down the page (./cruiser3d.js), the galaxy
// behind it (./GalaxyBackdrop.jsx) and the planets. Painted, as the worlds
// are: the show’s flat colours, toon-shaded, the cruiser and its crew
// outlined by the hull (lib/three/ink.js); the palette the
// cruiser’s and the backdrop’s. Each is a small renderer of its own with no
// tone mapper and no bloom: its colours are written as they are to be seen,
// over the page.

export const LOOK = {
  art: 'painted',
  palette: ['#c9ced6', '#5b6470', '#3f9fd6', '#9dff5a', '#1b1424', '#3a2a5c', '#f2d24a', '#e2468f'],
  tone: 'none',
  bloom: false,
  why: {
    tone: 'small renderers over the page, their colours authored as final (no tone mapper, as the page’s other scenes)',
  },
};
