// A world's surface, the world module: ./scene.js (a scene written for
// lib/three/useScene) on the world runtime, through fromScene, at 1.5× at
// most as it always has. The galaxy hands over to it as the ship comes
// down through the air (pages/Galaxy.jsx), and it hands back as the ship
// climbs out (pages/GalaxySurface.jsx).

import { fromScene } from '../../../runtime/module';

// The renderer (runtime/backend.js): WebGPU, the node renderer, at every
// level where the browser has it; without it the node renderer over WebGL 2
// at high and ultra, the classic renderer at low and mid. The scene is the same file on
// both; what it draws with is the looks set its renderer can draw
// (looks/nodes.js, or looks/classic.js through the classic branch, which
// the node renderer's closure leaves out: runtime/shadingClosure.js).
const looksFor = (backend) => (backend === 'webgl' ? import(/* classic */ './looks/classic') : import('./looks/nodes'));

export default fromScene('galaxy-surface', (canvas, ctx) => Promise.all([import('./scene'), looksFor(ctx.rt.gfx.backend)]).then(([m, set]) => m.create(canvas, ctx, set)), {
  shading: 'nodes', // (everything the node path reaches is TSL: the twins, nodes/, looks/nodes.js)
  classic: true, // (looks/classic.js: the GLSL originals, for low and mid without WebGPU)
  mb: 19, // (WORLD_MB['/galaxy'], which counts its worlds' surfaces)
  ratio: 1.5,
  sharpness: 'own', // (the pace's steps are the post's: lowerQuality)
});
