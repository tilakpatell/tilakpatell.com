// The cockpit kit's twin (src/components/cockpit/kitNodes.js) against
// kit.js: a plated hull, a console's face with its lit buttons, and the
// glass seen from inside (its grazing rim, its smudges lit by the light
// outside), with the blinkers on the console at a fixed time.
import * as THREE from 'three';
import * as KO from '../../../src/components/cockpit/kit.js';
import * as KN from '../../../src/components/cockpit/kitNodes.js';

const plated = (K) => ({ scene, camera }) => {
  camera.position.set(0, 0.6, 3.2);
  camera.lookAt(0, 0, 0);
  const maps = K.platingMaps({ seed: 3 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), K.plated(maps, { rx: 2, ry: 1 }));
  box.rotation.y = 0.5;
  const tube = new THREE.Mesh(K.tubeAlong([[-1.4, -0.6, 0], [-1.2, 0.2, 0.3], [-1.3, 0.8, 0]], 0.12), K.plated(maps, { color: 0xbbaa99, metalness: 0.6, bump: 1 }));
  scene.add(box, tube);
};

const console_ = (K) => ({ scene, camera }) => {
  camera.position.set(0, 0, 2.2);
  camera.lookAt(0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), K.consoleMat(K.consoleMaps({ seed: 11 }), { glow: 1.6 }));
  scene.add(face);
  const b = K.blinkers(
    Array.from({ length: 12 }, (_, i) => [-1 + i * 0.18, -0.5, 0.01]),
    { size: 0.03 },
  );
  b.tick(2.7);
  scene.add(b.mesh);
  return { tick: () => b.tick(2.7) };
};

const glass = (K) => ({ scene, camera }) => {
  scene.background = new THREE.Color(0x0a0c14);
  // (inside a bubble, off its centre: the glass meets the eye at every angle)
  camera.position.set(0.3, 0, 0.75);
  camera.lookAt(0, 0, -1);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: 0x334466 }));
  back.position.z = -3;
  scene.add(back);
  const m = K.glassMat({ opacity: 0.12, rim: 0.6, smudge: 1 });
  m.userData.setLight?.(new THREE.Color(0.4, 0.8, 1.6));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), m);
  dome.renderOrder = 10;
  scene.add(dome);
  const s = K.glowSprite('#ffcc88', 0.8, 0.9);
  s.position.set(0.6, 0.3, -1.5);
  scene.add(s);
  // (the GLSL side's setLight lands once the shader is compiled: again each frame)
  return { tick: () => m.userData.setLight?.(new THREE.Color(0.4, 0.8, 1.6)) };
};

export default {
  'cockpit-kit:plated': { node: plated(KN), classic: plated(KO) },
  'cockpit-kit:console': { node: console_(KN), classic: console_(KO) },
  'cockpit-kit:glass': { node: glass(KN), classic: glass(KO) },
};
