// The atmosphere’s twin (src/lib/three/atmosphereNodes.js against
// atmosphere.js): the shell round a dark planet seen from space with one
// sun and with two, a flat (cartoon) air, and the sky from just above the
// ground, looking along the horizon toward a low sun.
import * as THREE from 'three';
import * as AO from '../../../src/lib/three/atmosphere.js';
import * as AN from '../../../src/lib/three/atmosphereNodes.js';

const SUN = { dir: new THREE.Vector3(1, 0.4, 0.6).normalize().toArray(), colour: [1.25, 1.2, 1.1] };
const SUN2 = { dir: new THREE.Vector3(-1, -0.2, 0.5).normalize().toArray(), colour: '#ff6a3a' };

const planet = (A, { radius = 1, air, suns, camera: at, look = [0, 0, 0] }) => ({ scene, camera }) => {
  scene.background = new THREE.Color(0x000000);
  camera.position.set(...at);
  camera.lookAt(...look);
  camera.updateMatrixWorld();
  const ground = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 40), new THREE.MeshBasicMaterial({ color: 0x0b0c10 }));
  scene.add(ground);
  const shell = A.createAtmosphere({ radius, suns, ...air });
  shell.mesh.renderOrder = 2;
  shell.update(new THREE.Vector3());
  scene.add(shell.mesh);
};
const pair = (opts) => ({ node: planet(AN, opts), classic: planet(AO, opts) });

const blue = { colour: '#7fb0ff', top: 1.12, density: 2, falloff: 3.5 };
export default {
  'atmosphere:space': pair({ air: blue, suns: [SUN], camera: [0.6, 0.8, 3.4] }),
  'atmosphere:space-two-suns': pair({ air: { ...blue, glow: 1.2 }, suns: [SUN, SUN2], camera: [-0.4, 0.5, 3.4] }),
  'atmosphere:flat': pair({ air: { colour: '#b8ff5a', top: 1.15, flat: true }, suns: [SUN], camera: [0.6, 0.8, 3.4] }),
  'atmosphere:inside': pair({ radius: 10, air: { ...blue, top: 1.06, steps: 12 }, suns: [{ dir: new THREE.Vector3(1, 0.08, 0.3).normalize().toArray(), colour: [1.25, 1.2, 1.1] }], camera: [0, 10.05, 0], look: [10, 10.6, 3] }),
};
