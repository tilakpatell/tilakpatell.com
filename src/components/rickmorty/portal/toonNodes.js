// toon.js on the node renderer: the same paint (flat colour in two or three
// steps of light, a Kenney model's materials turned toon, the leaf greens
// recoloured), its materials MeshToonNodeMaterials, with the same names
// and arguments. The ink pass is not here: it is an EffectComposer pass, a
// classic post chain the node renderer hasn't got, and a world on nodes
// draws its line, if it has one, in its own TSL post.
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
