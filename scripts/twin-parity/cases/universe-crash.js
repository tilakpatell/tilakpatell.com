// universe/crash.js against its twin, universe/crashNodes.js: a crash on a
// planet (the flash, the sparks, the bits of hull and the shockwave over
// its surface) early and late, a crash into the sun, the cruiser’s portal
// open, and the others’ ring of light coming back.
import * as THREE from 'three';
import * as CO from '../../../src/components/universe/crash.js';
import * as CN from '../../../src/components/universe/crashNodes.js';

// (the sparks and the hull’s bits fly at random: the same draws on both
// sides. A node material makes more objects than a ShaderMaterial, each
// drawing a uuid at random too, so those draws are left to the real
// Math.random and out of the crash’s sequence)
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

const v = (x, y, z) => new THREE.Vector3(x, y, z);

const hit = (C, { age, sun = false }) => ({ scene, camera }) =>
  seededRandom(() => {
    camera.position.set(0.6, 1.4, 4.2);
    camera.lookAt(0, 0.4, 0);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshStandardMaterial({ color: '#556070', roughness: 0.9 }));
    scene.add(body);
    const crash = C.createCrash(scene);
    const normal = v(0.2, 0.6, 0.77).normalize();
    crash.hit({ point: normal.clone(), normal, body, radius: 1, sun });
    for (let a = 0; a < age; a += 0.05) crash.update(0.05, camera);
  });

const arrive = (C, kind, age) => ({ scene, camera }) =>
  seededRandom(() => {
    camera.position.set(0, 0.4, 1.6);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const crash = C.createCrash(scene);
    crash.arrive({ point: v(0, 0, 0), kind, heading: 0.4 });
    for (let a = 0; a < age; a += 0.05) crash.update(0.05, camera);
  });

const pair = (make, ...args) => ({ node: make(CN, ...args), classic: make(CO, ...args) });

export default {
  'universe-crash:hit:early': pair(hit, { age: 0.2 }),
  'universe-crash:hit:late': pair(hit, { age: 1.6 }),
  'universe-crash:sun': pair(hit, { age: 0.3, sun: true }),
  'universe-crash:portal': pair(arrive, 'cruiser', 0.6),
  'universe-crash:ring': pair(arrive, 'xwing', 0.2),
};
