// The universe map, the world module: ./scene.js (a scene written for
// lib/three/useScene) on the world runtime, through fromScene, as the
// galaxy is (galaxy/module.js). It draws with the runtime’s renderer, at
// 2× at most: a laptop’s Retina screen at its own pixels (at the 1.5× it
// had, the planets’ names over it were sharper than the planets), and
// softens through its post chain when frames run late, so the canvas is
// never resized for it (`sharpness: 'own'`: lowerQuality takes the
// runtime’s level, ./qualityStep.js). The canvas is the screen’s own
// pixels (`canvas: 'screen'`): the budget’s least (1.5 on a 1× screen at
// ultra) and the visitor’s render resolution are drawn inside the post,
// folded down to the canvas or, softer than it, brought up by FSR 1
// (post.js’s finish), so a weak chip spends its time on the picture, not
// on a canvas bigger than its screen. Its own
// watchdog and pace went with the move: the runtime’s cadence and
// controller are its now; it calibrates itself, as it did (scene.js’s
// prepare), and hands the answer to the runtime’s quality level. What it
// tells the page comes out as rt.events; the page reaches the scene’s own calls (dive, travel, fire…)
// as rt.current.world.scene (UniverseMap.jsx). Still 'glsl': the port to
// the node renderer is a pull request of its own.

import { fromScene } from '../../runtime/module';

export default {
  ...fromScene('universe', (canvas, ctx) => import('./scene').then((m) => m.create(canvas, ctx)), {
    mb: 6, // (WORLD_MB['/universe']: the planets’ maps, the stations and the ships)
    ratio: 2, // (a 1× screen still draws at the budget’s least, lib/device’s minRatio)
    sharpness: 'own', // (the pace’s steps are the post’s: lowerQuality)
    canvas: 'screen', // (the least and the render resolution are the post’s: its finish)
  }),
  // (its own calibration, in its prepare: scene.js times its passes, the
  // runtime's tune() a whole frame)
  calibrate: false,
};
