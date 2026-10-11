// The ships you can fly round the universe map (./shipModelsCore.js says
// what they are and how they're built), in livery.js's paint: GLSL, for the
// worlds on WebGLRenderer. ./shipModelsNodes.js is the same on the node
// renderer.
//
// buildShip(kind, textures, { build }) → the ship (shipModelsCore.js)

import { createLivery } from './livery';
import { buildShipWith } from './shipModelsCore';

export { BUILT, CREW_INK, ENGINES, LENGTH, SHIP_MODELS } from './shipModelsCore';

export const buildShip = (kind, T, opts) => buildShipWith(createLivery, kind, T, opts);
