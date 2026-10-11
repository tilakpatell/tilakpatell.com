// Which renderer's looks the surface draws with: ./nodes.js on the node
// renderer, ./classic.js on the classic one (the low level's,
// runtime/backend.js). The scene picks once, as it is made
// (module.js hands it the set its backend can draw, and scene.js calls
// pickLooks), and every part that makes a material asks looks() rather than
// import a renderer's file itself, so the node renderer's closure reaches
// no GLSL and the classic renderer is handed no node material. Until a
// scene picks, the node set (the tests, a part made on its own).
//
//   pickLooks(set) → set; looks() → the set in use

import * as nodes from './nodes';

let current = nodes;

export function pickLooks(set) {
  current = set ?? nodes;
  return current;
}

export const looks = () => current;
