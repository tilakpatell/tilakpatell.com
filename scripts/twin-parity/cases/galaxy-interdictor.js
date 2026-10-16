// The Interdictor’s twin (src/components/galaxy/nodes/interdictor.js)
// against interdictor.js: the cruiser (a grey stand-in in its slot) dropping
// in, its flash and its gravity well a third of a second on, seen from
// outside the well and from inside it, by the ship.
import * as THREE from 'three';
import * as IO from '../../../src/components/galaxy/interdictor.js';
import * as IN from '../../../src/components/galaxy/nodes/interdictor.js';

const models = { slot: () => {
  const holder = new THREE.Group();
  holder.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 9), new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.6 })));
  return { holder };
}, drop() {} };

const scene = (I, eye, look) => ({ scene, camera }) => {
  scene.background = new THREE.Color(0x02030a);
  camera.far = 1000;
  camera.position.set(...eye);
  camera.lookAt(...look);
  camera.updateProjectionMatrix();
  const d = I.createInterdictor(scene, { models });
  d.arrive({ at: [0, 0, 0], heading: 0.6, drift: [0.4, 0, 0.2] });
  // (a fixed clock: ten frames at 30 a second, from t = 2)
  for (let f = 1; f <= 10; f++) d.update(1 / 30, 2 + f / 30);
};

export default {
  'galaxy-interdictor:outside': { node: scene(IN, [60, 80, 330], [0, 0, 0]), classic: scene(IO, [60, 80, 330], [0, 0, 0]) },
  'galaxy-interdictor:inside': { node: scene(IN, [14, 6, 22], [0, 0, 0]), classic: scene(IO, [14, 6, 22], [0, 0, 0]) },
};
