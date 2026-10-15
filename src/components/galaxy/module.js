// The galaxy, the world module: ./scene.js (a scene written for
// lib/three/useScene) on the world runtime, through fromScene. It draws
// with the runtime's renderer, at 1.5× at most as it always has, and
// softens through its post chain when frames run late, as the universe map
// does, so the canvas is never resized for it (`sharpness: 'own'`); what it
// tells the page comes out as rt.events; the page reaches the scene's own
// calls (jump, goTo, fire…) as rt.current.world.scene. Landing on a planet
// is a handover to ./surface/module.js (pages/Galaxy.jsx), and taking off
// is one back (pages/GalaxySurface.jsx).

import { fromScene } from '../../runtime/module';

const galaxy = fromScene('galaxy', (canvas, ctx) => import('./scene').then((m) => m.create(canvas, ctx)), {
  mb: 19, // (WORLD_MB['/galaxy']: the galaxy and its worlds' surfaces)
  ratio: 1.5,
  sharpness: 'own', // (the pace's steps are the post's: lowerQuality)
});

// (development: the scene's named views, for scripts/gpu-parity.mjs, are the
// world's, where the script asks for them, as Earth's are; fromScene is the
// runtime's and passes on only what every scene has, so they're added here)
export default import.meta.env.DEV
  ? {
      ...galaxy,
      async create(rt, props) {
        const world = await galaxy.create(rt, props);
        world.view = (name) => world.scene.view(name);
        return world;
      },
    }
  : galaxy;
