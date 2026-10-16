// The galaxy's space sky: sky.js against nodes/sky.js, each the whole sky
// as the galaxy makes it (baked into its cube, then the sphere, the stars,
// the suns and the other systems' stars over it), from where a system sits,
// at two quality levels, looking two ways: toward the galaxy's core and
// toward the system's sun (the picked beacon nearest the view, pulsing).
// Seeded by the system, so the same every run; levels and systems with no
// panorama of the game's (loading one is not the shader's question).
import * as THREE from 'three';
import * as SO from '../../../src/components/galaxy/sky.js';
import * as SN from '../../../src/components/galaxy/nodes/sky.js';
import { coreBearing, systemById } from '../../../src/components/galaxy/systems.js';

const skyCase = (S, { id, level, look }) => async ({ scene, camera, renderer }) => {
  camera.far = 10000;
  camera.position.set(0, 0, 0);
  camera.updateProjectionMatrix();
  const sys = systemById(id);
  const dir = new THREE.Vector3(...(look === 'core' ? coreBearing(sys).dir : sys.suns[0].dir)).normalize();
  // (a little off the line, so the core or the sun isn't dead centre)
  dir.add(new THREE.Vector3(0.12, 0.08, 0)).normalize();
  camera.lookAt(dir);
  camera.updateMatrixWorld();
  const sky = S.createSky({ level, renderer });
  sky.setSystem(sys);
  sky.setRatio(1);
  const nearest = sky.beacons.reduce((a, b) => (b.dir.dot(dir) > a.dir.dot(dir) ? b : a));
  sky.focus(nearest.id);
  await sky.prepare();
  sky.bake();
  scene.add(sky.group);
  sky.update(camera, 0.7);
};
const pair = (opts) => ({ node: skyCase(SN, opts), classic: skyCase(SO, opts) });

export default {
  'galaxy:sky:hoth-low-core': pair({ id: 'hoth', level: 'low', look: 'core' }),
  'galaxy:sky:hoth-low-sun': pair({ id: 'hoth', level: 'low', look: 'sun' }),
  'galaxy:sky:kashyyyk-mid-core': pair({ id: 'kashyyyk', level: 'mid', look: 'core' }),
  'galaxy:sky:tatooine-low-sun': pair({ id: 'tatooine', level: 'low', look: 'sun' }),
};
