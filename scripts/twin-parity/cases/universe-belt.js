// universe/belt.js against its twin, universe/beltNodes.js: a ring of the
// belt’s instanced rocks (a boulder among them) close up, turned a little,
// one hidden; and the dust round the camera, at two pixel ratios’ sizes.
import * as BO from '../../../src/components/universe/belt.js';
import * as BN from '../../../src/components/universe/beltNodes.js';

const belt = (B) => ({ scene, camera }) => {
  camera.position.set(0, 2.2, 5.5);
  camera.lookAt(0, 0, 0);
  const b = B.createBelt({ band: { inner: 2, outer: 3.6, height: 0.8 }, count: 240, scale: 0.3, seed: 1977 });
  b.hide(5);
  b.update(40);
  scene.add(b.group);
};

const dust = (B, dpr) => ({ scene, camera }) => {
  const d = B.createDust({ small: false });
  scene.add(d.points);
  camera.updateMatrixWorld();
  d.update(camera.position, 1, dpr);
};

export default {
  'universe-belt:rocks': { node: belt(BN), classic: belt(BO) },
  'universe-belt:dust': { node: dust(BN, 1), classic: dust(BO, 1) },
  'universe-belt:dust:dpr2': { node: dust(BN, 2), classic: dust(BO, 2) },
};
