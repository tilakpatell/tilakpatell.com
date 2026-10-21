// Gorgoroth's Eye, beam and pool: ../../../src/components/middleearth/
// gorgorothShaders.js against its twin, nodes/gorgorothShaders.js. The Eye
// looking aside, calm and angry; the beam seen from the side as it reaches
// down to its pool, the two sharing their uniforms.
import * as THREE from 'three';
import * as GO from '../../../src/components/middleearth/gorgorothShaders.js';
import * as GN from '../../../src/components/middleearth/nodes/gorgorothShaders.js';

const floor = (scene, color = 0x3a3026) => {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color }));
  scene.add(f);
};

const eye =
  (G, anger) =>
  ({ scene, camera }) => {
    scene.background.set(0x0a0402);
    const m = G.eyeMaterial();
    m.uniforms.uTime.value = 7.3;
    m.uniforms.uLook.value = anger ? -0.2 : 0.15;
    m.uniforms.uAnger.value = anger;
    const e = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), m);
    scene.add(e);
    camera.position.set(0, 0, 34);
    camera.lookAt(0, 0, 0);
  };

const beam =
  (G) =>
  ({ scene, camera }) => {
    scene.background.set(0x0c0605);
    floor(scene, 0x24160e);
    const m = G.beamMaterial();
    m.uniforms.uTime.value = 4.2;
    m.uniforms.uPower.value = 1.6;
    m.uniforms.uColor.value.setRGB(1.8, 0.6, 0.2);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.1, 1, 28, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), m);
    b.position.set(0, 6, -6);
    b.lookAt(0, 0, 0);
    b.scale.set(2.2, 2.2, 8.5);
    b.frustumCulled = false;
    b.renderOrder = 4;
    scene.add(b);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), G.poolMaterial(m.uniforms));
    pool.scale.set(3, 1, 2);
    pool.position.y = 0.12;
    pool.renderOrder = 3;
    scene.add(pool);
    camera.position.set(9, 4, 6);
    camera.lookAt(0, 2.5, -2);
  };

export default {
  'middleearth:gorgoroth:eye': { node: eye(GN, 0), classic: eye(GO, 0) },
  'middleearth:gorgoroth:eye:angry': { node: eye(GN, 1), classic: eye(GO, 1) },
  'middleearth:gorgoroth:beam': { node: beam(GN), classic: beam(GO) },
};
