// Where the White City stands on the Road: the Minas Tirith chapter's city
// (towns/minastirith/layout.js: seven walls round its middle, the Great
// Gate on the east at the first wall, the Citadel 76 m up) turned so its
// east looks back down the road, the gate's sill on the lane at GATE metres
// in, and the causeway up to it from the Pelennor. In the stage's frame
// (the lane along +z, x = 0). Pure.
//
//   CITY: { at: [x, y, z], turn }: the city's middle and its turn about y
//   toStage(x, y, z) → [x, y, z]: a point of the chapter's in the stage's frame
//   floorAt(x, z) → the height the causeway and the first level carry a
//     walker at, or null off them (the land's)
//   COURT: { y, tree, fountain, aragorn, company, hobbits, camera, look }:
//     the coronation's places, in the stage's frame

import { COURT_Y, FOUNTAIN, LEVEL_Y, ROAD_W, TREE, WALL_R } from '../../../towns/minastirith/layout';

export const GATE = 110; // m into the stage: the Great Gate's sill
const SILL = WALL_R[0] + 1; // the chapter's x of the sill
const FOOT = 196; // the chapter's x where the causeway starts to climb
const FIELD = 236; // its x where the causeway begins, on the field
export const CITY = { at: [0, 0, GATE + SILL], turn: Math.PI / 2 };

// (turned a quarter: the chapter's east, +x, is the stage's −z)
export const toStage = (x, y, z) => [CITY.at[0] + z, CITY.at[1] + y, CITY.at[2] - x];

const climbFrom = CITY.at[2] - FOOT;
const fieldFrom = CITY.at[2] - FIELD;
// the walk in through the gate, as far as the second wall's foot
const inside = CITY.at[2] - WALL_R[1] - 2;

export function floorAt(x, z) {
  if (Math.abs(x) > ROAD_W / 2 || z < fieldFrom || z > inside) return null;
  if (z < climbFrom) return CITY.at[1];
  if (z < GATE) return CITY.at[1] + (LEVEL_Y[0] * (z - climbFrom)) / (GATE - climbFrom);
  return CITY.at[1] + LEVEL_Y[0];
}

const at = (x, z) => toStage(x, COURT_Y, z);
const tree = at(TREE.x, TREE.z);
const fountain = at(FOUNTAIN.x, FOUNTAIN.z);
// (between the fountain and the Tree's lawn: the King with his back to the Tree, the four before him)
const kingZ = tree[2] - TREE.lawn - 0.4;
const hobbitZ = fountain[2] + FOUNTAIN.r + 1.2;
export const COURT = {
  y: CITY.at[1] + COURT_Y,
  tree,
  fountain,
  aragorn: [0, kingZ],
  company: { arwen: [1.4, kingZ + 0.3], gandalfwhite: [-2.1, kingZ - 0.6], legolas: [2.8, kingZ - 1], gimli: [-3.3, kingZ - 1.3] },
  hobbits: { frodo: [-0.55, hobbitZ], sam: [0.55, hobbitZ], merry: [-1.6, hobbitZ - 0.5], pippin: [1.6, hobbitZ - 0.5] },
  // over the fountain from behind the four, the King and the Tree beyond them
  camera: [-3.4, CITY.at[1] + COURT_Y + 2.6, fountain[2] - 3.4],
  look: [0.4, CITY.at[1] + COURT_Y + 1.2, kingZ + 0.5],
};
