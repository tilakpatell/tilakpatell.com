// The galaxy, the world module: ./scene.js (a scene written for
// lib/three/useScene) on the world runtime, through fromScene. It draws
// with the runtime's renderer, the scene at 1.5× at most as it always has,
// and softens through its post chain when frames run late, as the universe map
// does, so the canvas is never resized for it (`sharpness: 'own'`). Its
// canvas is the screen's own pixels, 2× at most (`canvas: 'screen'`): the
// scene is folded down to it, or brought up to it by FSR 1 (universe/
// post.js's finish), so a Retina screen isn't stretched from 1.5 by the
// browser, and its calibration is kept afresh for that (`calibrateAs`); what it
// tells the page comes out as rt.events; the page reaches the scene's own
// calls (jump, goTo, fire…) as rt.current.world.scene. Landing on a planet
// is a handover to ./surface/module.js (pages/Galaxy.jsx), and taking off
// is one back (pages/GalaxySurface.jsx).

import { fromScene } from '../../runtime/module';

export default fromScene('galaxy', (canvas, ctx) => import('./scene').then((m) => m.create(canvas, ctx)), {
  mb: 19, // (WORLD_MB['/galaxy']: the galaxy and its worlds' surfaces)
  ratio: 2, // (the canvas's most; the scene's is 1.5, scene.js's mostRatio)
  sharpness: 'own', // (the pace's steps are the post's: lowerQuality)
  canvas: 'screen', // (the least and the render resolution are the post's: its finish)
  calibrateAs: 'galaxy-fsr', // (a level kept from the stretched canvas says nothing of this one)
});
