// rock.js against rockNodes.js: the universe map's rocks, pitted (high, at
// two scales, a boulder among them, and the belt's instanced rocks, each
// its own stretch of the noise), flat (low), and a rock material of the
// caller's hooked (the meteors' and deep space's way).
import * as THREE from 'three';
import * as RO from '../../../src/lib/three/rock.js';
import * as RN from '../../../src/lib/three/rockNodes.js';

const close = (camera) => {
  camera.position.set(0, 1.2, 3.4);
  camera.lookAt(0, 0, 0);
};

const rocks =
  (R, tier) =>
  ({ scene, camera }) => {
    close(camera);
    const a = new THREE.Mesh(R.rock(11), R.rockMaterial({ tier }));
    a.material.color.set('#8a7f72');
    a.position.set(-1.1, 0.4, 0);
    const b = new THREE.Mesh(R.rock(53, { craters: true }), R.rockMaterial({ tier, scale: 1.6 }));
    b.material.color.set('#6f6a64');
    b.position.set(1.0, 0.3, 0);
    b.scale.setScalar(1.2);
    b.rotation.set(0.4, 0.8, 0);
    scene.add(a, b);
    // the belt's way: one shape, many instances, each coloured
    const inst = new THREE.InstancedMesh(R.rock(5), R.rockMaterial({ tier }), 5);
    const m = new THREE.Matrix4();
    const rand = R.rng(9);
    for (let i = 0; i < 5; i++) {
      m.compose(new THREE.Vector3(-1.6 + i * 0.8, -0.9, 0.3), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, 0)), new THREE.Vector3().setScalar(0.3 + rand() * 0.15));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, new THREE.Color().setHSL(0.08, 0.15, 0.35 + rand() * 0.2));
    }
    scene.add(inst);
  };

const hooked =
  (R) =>
  ({ scene, camera }) => {
    close(camera);
    const mat = R.rockHook(
      new THREE.MeshStandardMaterial({
        color: '#8a7f72',
        roughness: 0.95,
        metalness: 0.04,
        flatShading: true,
      }),
      { tier: 'mid' },
    );
    const a = new THREE.Mesh(R.rock(23), mat);
    a.scale.setScalar(1.4);
    a.rotation.set(0.3, 1.1, 0.2);
    scene.add(a);
  };

// the belt's way: one rock material on several shapes, each instanced
// (the belt's four), and on a plain mesh beside them, so the material is
// built into more than one program from the same nodes
const shared =
  (R) =>
  ({ scene, camera }) => {
    close(camera);
    const mat = R.rockMaterial({ tier: 'high' });
    const rand = R.rng(4);
    const m = new THREE.Matrix4();
    [3, 7, 19, 31].forEach((seed, i) => {
      const inst = new THREE.InstancedMesh(R.rock(seed), mat, 2 + i);
      for (let k = 0; k < inst.count; k++) {
        m.compose(new THREE.Vector3(-1.6 + i * 1.05, -0.9 + k * 0.45, rand() * 0.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, 0)), new THREE.Vector3().setScalar(0.18 + rand() * 0.08));
        inst.setMatrixAt(k, m);
        inst.setColorAt(k, new THREE.Color().setHSL(0.08, 0.15, 0.3 + rand() * 0.2));
      }
      scene.add(inst);
    });
    const plain = new THREE.Mesh(R.rock(41), mat);
    plain.position.set(0, 1.0, -0.5);
    plain.scale.setScalar(0.5);
    scene.add(plain);
  };

export default {
  'rock:high': { node: rocks(RN, 'high'), classic: rocks(RO, 'high') },
  'rock:low': { node: rocks(RN, 'low'), classic: rocks(RO, 'low') },
  'rock:hook': { node: hooked(RN), classic: hooked(RO) },
  'rock:shared': { node: shared(RN), classic: shared(RO) },
};
