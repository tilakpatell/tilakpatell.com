// Angstrom Levy's dimensions, as rules (./scene.js draws a dimension,
// ./InvWorld.jsx moves the rules between them): the same city (./map.js)
// drawn another way. Four: home; the burnt city, where this world's Mark
// lost (night, every tower broken to 0.7, nobody about, embers); the
// drowned city (the water at 12 m, the towers standing out of it, dusk);
// the mirror city (the map reflected in x, a cold palette, the crowd
// walking backwards). Only home keeps the city's damage and standing: the
// others are visited. Plain [x, y, z] arrays, metres.
//
// Angstrom himself is ./foes.js's `angstrom` (six blows; hit, he portals
// away and is back behind Mark), the mirror Mark its `mirror` (Mark's own
// row as a foe); the mission "Every version of you" is ./season2.js's.

import { WATER_Y } from './map';

export const DIMENSIONS = {
  home: { id: 'home', name: 'Home', water: WATER_Y, look: null, ruins: 0, crowd: 'yes', mirror: false, tint: null, embers: false, saves: true },
  burnt: { id: 'burnt', name: 'The burnt city', water: WATER_Y, look: 'night', ruins: 0.7, crowd: 'none', mirror: false, tint: [0.62, 0.5, 0.42], embers: true, saves: false },
  drowned: { id: 'drowned', name: 'The drowned city', water: 12, look: 'dusk', ruins: 0, crowd: 'none', mirror: false, tint: [0.72, 0.82, 0.92], embers: false, saves: false },
  mirror: { id: 'mirror', name: 'The mirror city', water: WATER_Y, look: 'noon', ruins: 0, crowd: 'backwards', mirror: true, tint: [0.74, 0.84, 1.0], embers: false, saves: false },
};
export const DIM_IDS = Object.keys(DIMENSIONS);
export const dimensionOf = (id) => DIMENSIONS[id] ?? DIMENSIONS.home;
// whether what the city keeps (its damage, its opinion of Mark) is kept from here
export const savesHere = (id) => dimensionOf(id).saves === true;

// Angstrom's portals have the Flaxan one's size, in his green
export const PORTAL_R = 22;
export const PORTAL_SPEED = 20;
export const ANGSTROM_GREEN = 0x7cff4a;

// Going through: the hero keeps his place and his speed (the city is the
// same city), the foes are cleared (a fight does not follow him), and the
// rules' world is the dimension's (`worldFor`). → { dim, h, foes }
export function enter(id, hero, foes) {
  const d = dimensionOf(id);
  return { dim: d.id, h: { ...hero, p: [...hero.p], v: [...hero.v] }, foes: { ...foes, on: false, foes: [], bolts: [], cars: [], rings: [] } };
}
// the map's world as a dimension's rules see it: the same boxes, mirrored
// in x for the mirror (./map.js's `near` reads `mirror`), and its water
// level (./flight.js's `surfaceAt` reads `water`)
export function worldFor(world, id) {
  const d = dimensionOf(id);
  if (d.id === 'home') return world;
  return Object.assign(Object.create(world), { mirror: d.mirror, water: d.water, dim: d.id });
}
export const mirrorX = (p) => [-p[0], p[1], p[2]];
