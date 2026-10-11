// A world's surface, the world module: ./scene.js (a scene written for
// lib/three/useScene) on the world runtime, through fromScene, at 1.5× at
// most as it always has. The galaxy hands over to it as the ship comes
// down through the air (pages/Galaxy.jsx), and it hands back as the ship
// climbs out (pages/GalaxySurface.jsx).

import { fromScene } from '../../../runtime/module';

export default fromScene('galaxy-surface', (canvas, ctx) => import('./scene').then((m) => m.create(canvas, ctx)), {
  shading: 'nodes', // (everything it reaches is TSL: the twins, nodes/; the node renderer, on WebGPU or WebGL 2)
  mb: 19, // (WORLD_MB['/galaxy'], which counts its worlds' surfaces)
  ratio: 1.5,
  sharpness: 'own', // (the pace's steps are the post's: lowerQuality)
});
