// shipModels.js on the node renderer: the same ships, the same exports, in
// liveryNodes.js's paint (the same uniforms, as node hooks), so a world on
// three's node renderer reaches no GLSL through its ships.
//
// buildShip(kind, textures, { build }) → the ship (shipModelsCore.js)

import { createLivery } from './liveryNodes';
import { buildShipWith } from './shipModelsCore';

export { BUILT, CREW_INK, ENGINES, LENGTH, SHIP_MODELS } from './shipModelsCore';

export const buildShip = (kind, T, opts) => buildShipWith(createLivery, kind, T, opts);
