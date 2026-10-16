// universe/powerFx.js against its twin, universe/powerFxNodes.js (the
// ship powers: the torpedoes, the death ray from the side and from the
// chase camera, the magnet’s rings, the crystal and the shockwave).
import * as PO from '../../../src/components/universe/powerFx.js';
import * as PN from '../../../src/components/universe/powerFxNodes.js';

const look = (camera, [x, y, z], at = [0, 0, 0]) => {
  camera.position.set(x, y, z);
  camera.lookAt(...at);
  camera.updateMatrixWorld();
};

// (the powers’ clock run on so far first: the beam’s crawl and the rings’ turns)
const power = (P, what) => ({ scene, camera }) => {
  const fx = P.createPowerFx(scene);
  fx.update(0.37);
  if (what === 'torpedoes') {
    look(camera, [0, 0.4, 1.2]);
    fx.torpedoes([{ x: -0.2, y: 0, z: 0, vx: 0.2, vy: 0, vz: -3 }, { x: 0.25, y: 0.1, z: -0.3, vx: 1, vy: 0.3, vz: -1 }, { x: 0, y: -0.15, z: 0.2, vx: -1, vy: 0, vz: 0 }]);
  }
  if (what === 'beam-side') {
    look(camera, [3, 0.6, -2.5], [0, 0, -2.5]);
    fx.beam({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -5 });
  }
  if (what === 'beam-chase') {
    look(camera, [0.12, 0.25, 1.4], [0, 0, -3]);
    fx.beam({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -6 });
  }
  if (what === 'magnet') {
    look(camera, [0, 0.6, 2.4]);
    fx.magnet({ x: 0, y: 0, z: 0 }, 0.8);
  }
  if (what === 'crystal') {
    look(camera, [0, 0.1, 0.6]);
    fx.crystal({ x: 0, y: 0, z: 0 }, 1);
  }
  if (what.startsWith('shock')) {
    look(camera, [0, 1, 6]);
    fx.shock({ x: 0, y: 0, z: 0 }, 2.5);
    fx.update(what === 'shock:early' ? 0.12 : 0.33);
  }
  fx.update(0);
};

const pair = (make, ...args) => ({ node: make(PN, ...args), classic: make(PO, ...args) });

export default {
  'universe-powerFx:torpedoes': pair(power, 'torpedoes'),
  'universe-powerFx:beam-side': pair(power, 'beam-side'),
  'universe-powerFx:beam-chase': pair(power, 'beam-chase'),
  'universe-powerFx:magnet': pair(power, 'magnet'),
  'universe-powerFx:crystal': pair(power, 'crystal'),
  'universe-powerFx:shock:early': pair(power, 'shock:early'),
  'universe-powerFx:shock:late': pair(power, 'shock:late'),
};
