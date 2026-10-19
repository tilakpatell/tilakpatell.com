// Middle-earth's kit: ../../../src/components/middleearth/kit.js against its
// twin, nodes/kit.js. The lava in a fogged scene round a hot spot, a little
// way into its flow; the sky dome plain and with Mordor's lit cloud and a
// flash; fire, embers and smoke from the particle pool, emitted and stepped
// the same (Math.random seeded for each side).
import * as THREE from 'three';
import * as KO from '../../../src/components/middleearth/kit.js';
import * as KN from '../../../src/components/middleearth/nodes/kit.js';

const seeded = (fn) => {
  const real = Math.random;
  let s = 0x2f6b;
  Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
};

const lava =
  (K) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x2a1008, 4, 22);
    const m = K.lavaMaterial({
      scale: 0.35,
      heat: 1.1,
      spot: [1, -1],
      reach: 0.08,
    });
    m.uniforms.uTime.value = 12.5;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), m);
    scene.add(floor);
    camera.position.set(0, 3, 7);
    camera.lookAt(0, 0, -2);
  };
// the bridge's sea: Bridge3D's numbers, far below in its dense fog
const sea =
  (K) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.FogExp2(0x140805, 0.011);
    const m = K.lavaMaterial({ scale: 0.06, spot: [0.5, -6], reach: 0.0026 });
    m.uniforms.uTime.value = 21.3;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(520, 360).rotateX(-Math.PI / 2), m);
    s.position.set(0, -22, -90);
    scene.add(s);
    camera.position.set(-4, 4, 14);
    camera.lookAt(0, -14, -20);
  };
const sky =
  (K, cloud) =>
  ({ scene, camera }) => {
    const dome = K.skyDome(60, cloud ? { cloud: 1, glow: [1, 0.1, -0.4] } : {});
    dome.material.uniforms.uTime.value = 30;
    if (cloud) dome.material.uniforms.uFlash.value = 0.6;
    scene.add(dome);
    camera.position.set(0, 1, 0);
    camera.lookAt(10, 3, -6);
  };
const particles =
  (K, ramp, additive) =>
  ({ scene, camera }) => {
    const p = K.createParticles(64, {
      ramp: K[ramp],
      additive,
      stretch: 1.4,
      gravity: 0.6,
      swirl: 0.4,
    });
    scene.add(p.mesh);
    seeded(() => {
      for (let i = 0; i < 40; i++) {
        p.emit((Math.random() - 0.5) * 3, Math.random() * 0.5, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 0.4, 0.8 + Math.random(), (Math.random() - 0.5) * 0.4, 1.5 + Math.random(), 0.6, 1.4, 1);
        p.step(0.03);
      }
    });
    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 1, 0);
  };

export default {
  'middleearth:kit:lava': { node: lava(KN), classic: lava(KO) },
  'middleearth:kit:lava:sea': { node: sea(KN), classic: sea(KO) },
  'middleearth:kit:sky': { node: sky(KN, false), classic: sky(KO, false) },
  'middleearth:kit:sky:mordor': { node: sky(KN, true), classic: sky(KO, true) },
  'middleearth:kit:fire': {
    node: particles(KN, 'FIRE', true),
    classic: particles(KO, 'FIRE', true),
  },
  'middleearth:kit:smoke': {
    node: particles(KN, 'SMOKE', false),
    classic: particles(KO, 'SMOKE', false),
  },
};
