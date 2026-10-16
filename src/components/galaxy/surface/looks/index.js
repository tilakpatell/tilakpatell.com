// The surface's looks: ./nodes.js, the twins lane T wrote beside each GLSL
// original and the game's light under them, on whichever renderer the
// surface is made on (WebGPU, or the node renderer over WebGL 2:
// runtime/backend.js; there is no classic path, by the owner's ruling on
// lane T2). Every part that makes a material asks looks() rather than
// import the twins itself, so the surface names what it draws with in one
// place.
//
//   looks() → the set

import * as nodes from './nodes';

export const looks = () => nodes;
