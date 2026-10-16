// universe/cme.js against its twin, universe/cmeNodes.js: a star’s coronal
// mass ejection seen side on, once while it rises (the glare swelling, the
// prominences lifting off the limb) and once as the shell runs out, its
// three caps webbed with filaments. Stepped by hand, no clock, so each side
// draws the same.
import * as CO from '../../../src/components/universe/cme.js';
import * as CN from '../../../src/components/universe/cmeNodes.js';

const STAR = { at: [0, 0, 0], r: 1, color: '#ffbb77' };

const ejection = (C, steps) => ({ THREE, scene, camera }) => {
  const star = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.0, 0.5) }));
  scene.add(star);
  const e = C.createEjection(scene, {});
  e.launch(STAR, { x: 6, y: 1, z: -2 }, { rise: 3, speed: 8, reach: 12 });
  let t = 5;
  for (const dt of steps) e.update(dt, (t += dt), camera);
};

export default {
  'universe:cme:rise': { node: ejection(CN, [1, 1]), classic: ejection(CO, [1, 1]) },
  'universe:cme:shell': { node: ejection(CN, [1, 1, 1, 0.25]), classic: ejection(CO, [1, 1, 1, 0.25]) },
  'universe:cme:late': { node: ejection(CN, [1, 1, 1, 0.6]), classic: ejection(CO, [1, 1, 1, 0.6]) },
};
