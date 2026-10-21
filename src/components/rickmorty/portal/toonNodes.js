// toon.js on the node renderer: the same paint (flat colour, lit and one
// step of shadow, a Kenney model's materials turned toon, the leaf greens
// recoloured), its materials MeshToonNodeMaterials, with the same names
// and arguments. A world on nodes draws its cast's line as the GLSL one
// does, with a hull (lib/three/inkNodes.js).
//
//   gradient() → the light steps
//   toon(color, extra) → a MeshToonNodeMaterial on them
//   toonify(root, { tint, mix, glow, gradientMap, aniso, dispose }) → root
//   releaf(color, leaf), releafMap(map, leaf)

import { MeshToonNodeMaterial } from 'three/webgpu';
import { toonWith, toonifyWith } from './toonCore';

export { gradient, releaf, releafMap } from './toonCore';

export const toon = toonWith(MeshToonNodeMaterial);
export const toonify = toonifyWith(toon);
