// ../../towns/ghosts.js on the node renderer: the other travellers drawn as
// the towns draw them (../../towns/ghostsOf.js, which holds no shader), pale
// and lit from the edges by ../../towns/ghostNodes.js's material, the rim of
// light in nodes from ../../towns/ghostLook.js's numbers, where the
// original's is a GLSL hook; the same exports, so a town changes only the
// file it imports them from.

import { pose } from '../../mapFigures';
import { makePerson } from '../../shire/people';
import { ALLY_HALO, GHOST_HALO, createGhostsOf } from '../../towns/ghostsOf';
import { ghostNodeMaterial } from '../../towns/ghostNodes';

export { ALLY_HALO, GHOST_HALO };

// (the original's ghostMaterial, made of nodes)
export const ghostMaterial = () => ghostNodeMaterial();

// (the drawing is ghostsOf.js's; here, the Frodo, his walk and the rim of light)
export function createGhosts({ make = () => makePerson('frodo'), animate = (f, t, p) => pose(f, t, { moving: p.moving }), ...rest } = {}) {
  return createGhostsOf({ paint: ghostMaterial, make, animate, ...rest });
}
