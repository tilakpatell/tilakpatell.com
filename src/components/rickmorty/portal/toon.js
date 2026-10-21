// The look of the show: flat colour, lit and one step of shadow
// (MeshToonMaterial on ./toonCore.js's two-step gradient). The one line is
// round the cast, lib/three/ink.js's hull, drawn with each figure; nothing
// draws a line over the whole picture.

import { toon, toonifyWith } from './toonCore';

// (the paint is ./toonCore.js's, where a node world reaches it too)
export { gradient, releaf, releafMap, toon } from './toonCore';

export const toonify = toonifyWith(toon);
