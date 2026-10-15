// A world's surface, the world module: ./scene.js (a scene written for
// lib/three/useScene) on the world runtime, through fromScene, at 1.5× at
// most as it always has (1,280 × 720 at most at Low, the floor). The galaxy hands over to it as the ship comes
// down through the air (pages/Galaxy.jsx), and it hands back as the ship
// climbs out (pages/GalaxySurface.jsx).

import { fromScene } from '../../../runtime/module';
import { device } from '../../../lib/device';
import { floorRatio } from '../../../lib/floorRatio';

const surface = fromScene('galaxy-surface', (canvas, ctx) => import('./scene').then((m) => m.create(canvas, ctx)), {
  shading: 'nodes', // (everything it reaches is TSL: the twins, nodes/; the node renderer, on WebGPU or WebGL 2)
  mb: 19, // (WORLD_MB['/galaxy'], which counts its worlds' surfaces)
  sharpness: 'own', // (the pace's steps are the post's: lowerQuality)
});
// (1.5 at most, read as each world starts; at Low, the floor, 1,280 × 720 at
// most: lib/floorRatio. A getter of the module's own: fromScene reads its
// options once)
Object.defineProperty(surface, 'ratio', {
  enumerable: true,
  get: () => (typeof window === 'undefined' ? 1.5 : floorRatio(1.5, { w: window.innerWidth, h: window.innerHeight, detail: device().detail })),
});
export default surface;
