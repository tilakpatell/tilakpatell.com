// The universe map, the world module: ./scene.js (a scene written for
// lib/three/useScene) on the world runtime, through fromScene, as the
// galaxy is (galaxy/module.js). It draws with the runtime’s renderer, at
// 1.5× at most as it always has, and softens through its post chain when
// frames run late, so the canvas is never resized for it (`sharpness:
// 'own'`: lowerQuality takes the runtime’s level, ./qualityStep.js). Its own
// watchdog, pace and calibration went with the move: the runtime’s cadence,
// controller and tune() are its now. What it tells the page comes out as
// rt.events; the page reaches the scene’s own calls (dive, travel, fire…)
// as rt.current.world.scene (UniverseMap.jsx). Still 'glsl': the port to
// the node renderer is a pull request of its own.

import { fromScene } from '../../runtime/module';

export default fromScene('universe', (canvas, ctx) => import('./scene').then((m) => m.create(canvas, ctx)), {
  mb: 6, // (WORLD_MB['/universe']: the planets’ maps, the stations and the ships)
  ratio: 1.5,
  sharpness: 'own', // (the pace’s steps are the post’s: lowerQuality)
});
