// The second Death Star, inside: the game's own DeathStar02_01, walked as a
// district of Endor (lane E4's follow-up; the owner's choice of 11 October:
// its own place, reached by the shuttle on the shield generator's pad, so
// /deathstar/inside's rooms and stories stay as they are).
//
// The pack (/models/galaxy/bf2017/levels/endor/deathstar/level.json,
// `node scripts/bf2017-level.mjs levels/mp/deathstar02_01 --world endor
// --district deathstar --inside --spawn --floor 586.4`) is in its own map's
// frame: you land on the first team's spawn deck, the game's 586.4 m, at 0.
// Its walls, decks and ceilings are the game's DSI master shader
// (lib/three/surface/dsi.js). The map has no terrain: off a deck and down a
// shaft, you're put back where you landed. None of the forest comes in, its
// places, people and scatter are under the sky (ownMap.js, lane E3's rule
// for a district in its own frame), and nor does the day: a black dome,
// the station's own lamps, its haze.
//
//   DEATHSTAR: the district row;  DEATHSTAR_ZONE: the way in, on the main map

import { ownMap } from './ownMap';

// the shuttle on the shield generator's pad (the place at [400, −230], its
// Lambda at [−10, 41] in the place)
const PAD = [390, -189];
// a shaft's foot: under the lowest deck walked, above the station's core
export const DEATHSTAR_FALL = -60;

export const DEATHSTAR = {
  id: 'deathstar',
  name: 'The second Death Star',
  level: 'endor/deathstar',
  land: { at: [0, 0], yaw: 0 },
  line: 'Inside the half-built battle station over Endor: its corridors, hangars and gantries, the game’s own.',
  door: { at: [0, 6], r: 2.4, prompt: 'Take the shuttle back down to Endor' },
  ground: { layers: [], flats: [], pits: [] },
  site: {
    ...ownMap('endor/deathstar').site,
    noGround: true,
    fall: DEATHSTAR_FALL,
    water: null,
    grass: null,
    skyships: [],
    flyovers: [],
    weather: [],
    gameLight: null,
    picture: null,
    sky: { zenith: '#050608', horizon: '#0c0e12', haze: 1, hazeColor: '#0c0e12', suns: [{ az: 0.9, el: 1.35, color: '#e8eef8', size: 0, glow: 0 }], clouds: null, bodies: [], stars: 0 },
    // (lit from within: the station's lamps, no sun and none of its shadow)
    light: { sun: 0.5, sky: '#5a6270', ground: '#1c1e22', ambient: 0.9, shadow: false },
    fog: { color: '#0c0e12', density: 0.006 },
  },
};

export const DEATHSTAR_ZONE = { id: 'deathstarshuttle', name: 'The second Death Star', door: { at: PAD, r: 4, prompt: 'Board the shuttle up to the Death Star' }, to: { district: 'deathstar' } };
