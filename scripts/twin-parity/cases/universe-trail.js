// universe/trail.js against its twin, universe/trailNodes.js: a plume
// flown across the view at cruise, one boosting, and the cruiser’s plasma
// with its sparks of portal green.
import * as THREE from 'three';
import * as TO from '../../../src/components/universe/trail.js';
import * as TN from '../../../src/components/universe/trailNodes.js';

// (the plasma’s phase and the sparks are drawn at random: the same draws on
// both sides; a node material’s uuids are left to the real Math.random)
const seededRandom = (run) => {
  const had = Math.random;
  let s = 7;
  Math.random = () => (/generateUUID/.test(new Error().stack) ? had() : ((s = (s * 16807) % 2147483647) - 1) / 2147483646);
  try {
    return run();
  } finally {
    Math.random = had;
  }
};

const fly = (T, { opts, colour, core, stretch = 1, frames = 45 }) => ({ scene, camera }) =>
  seededRandom(() => {
    camera.position.set(0, 1.2, 3.2);
    camera.lookAt(0, 0, 0);
    const trail = T.createTrail(opts);
    trail.setColors(colour, core);
    scene.add(trail.mesh);
    const nozzle = new THREE.Vector3(-1.5, 0, 0);
    for (let i = 1; i <= frames; i++) {
      nozzle.x += 0.05;
      nozzle.y = Math.sin(i * 0.12) * 0.3;
      trail.update(1 / 60, i / 60, nozzle, 1, camera.position, stretch);
    }
  });

const pair = (o) => ({ node: fly(TN, o), classic: fly(TO, o) });

export default {
  'universe-trail:cruise': pair({ opts: { width: 0.12, life: 1, length: 2.2 }, colour: '#ff6a36', core: '#fff0dc' }),
  'universe-trail:boost': pair({ opts: { width: 0.12, life: 1, length: 1.6, cap: { length: 2, peak: 3 } }, colour: '#4aa8ff', core: '#ffffff', stretch: 2 }),
  'universe-trail:plasma': pair({ opts: { width: 0.14, life: 1, length: 2.2, wobble: 1, sparks: 40 }, colour: '#7cff4a', core: '#eaffd0', stretch: 1.8 }),
};
