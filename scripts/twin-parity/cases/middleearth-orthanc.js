// Orthanc’s shaders: ../../../src/components/middleearth/towns/orthanc/
// propsShaders.js and sceneShaders.js against their twins under nodes/towns/
// orthanc/. The palantír waking and with the Eye in it; the tower’s black
// stone, its rims cold and its undersides lit by the pits, high and low;
// and Saruman’s robe of many colours turning on a figure’s shape, its
// iridescence and sheen as the scene gives them.
import * as THREE from "three";
import * as PO from "../../../src/components/middleearth/towns/orthanc/propsShaders.js";
import * as PN from "../../../src/components/middleearth/nodes/towns/orthanc/propsShaders.js";
import * as SO from "../../../src/components/middleearth/towns/orthanc/sceneShaders.js";
import * as SN from "../../../src/components/middleearth/nodes/towns/orthanc/sceneShaders.js";

const stone =
  (P, { wake, eye, turn = 0 }) =>
  ({ scene, camera }) => {
    scene.background = new THREE.Color(0x050608);
    const m = P.stoneMaterial();
    m.uniforms.uTime.value = 4.3;
    m.uniforms.uWake.value = wake;
    m.uniforms.uEye.value = eye;
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), m);
    s.rotation.y = turn;
    scene.add(s);
    camera.position.set(0.4, 0.3, 3.2);
    camera.lookAt(0, 0, 0);
  };

// the tower’s faces: an eight-sided shaft, steps up to it and blades out
// from its foot, flat-faced as the kit cuts them
const flat = (g) => {
  const n = g.toNonIndexed();
  n.computeVertexNormals();
  return n;
};
const tower =
  (P, high) =>
  ({ scene, camera }) => {
    scene.background = new THREE.Color(0x1a1c22);
    const m = P.glassyStone(
      new THREE.MeshStandardMaterial({
        color: 0x9a9ca8,
        roughness: 0.3,
        metalness: 0.35,
      }),
    );
    const shaft = new THREE.Mesh(
      flat(new THREE.CylinderGeometry(6, 7, 60, 8).rotateY(Math.PI / 8)),
      m,
    );
    shaft.position.y = 30;
    scene.add(shaft);
    for (let i = 0; i < 6; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 1.2), m);
      step.position.set(0, 0.25 + i * 0.5, 9 - i * 1);
      scene.add(step);
    }
    for (const sx of [-1, 1]) {
      const blade = new THREE.Mesh(
        flat(new THREE.ConeGeometry(0.9, 9, 3).rotateX(Math.PI / 2 - 0.36)),
        m,
      );
      blade.position.set(sx * 4, 2, 8);
      scene.add(blade);
    }
    if (high) {
      camera.position.set(14, 48, 22);
      camera.lookAt(0, 40, 0);
    } else {
      camera.position.set(8, 3, 22);
      camera.lookAt(0, 5, 0);
    }
  };

const robe =
  (S) =>
  ({ scene, camera }) => {
    const robeTime = { value: 2.7 };
    const m = S.manyColoursRobe(
      new THREE.MeshPhysicalMaterial({
        color: 0xf4f0ff,
        roughness: 0.32,
        metalness: 0.15,
        iridescence: 1,
        iridescenceIOR: 1.9,
        iridescenceThicknessRange: [160, 900],
        sheen: 0.6,
        sheenColor: new THREE.Color(0xffd8f0),
      }),
      robeTime,
    );
    const body = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          [0.05, 0],
          [0.7, 0],
          [0.55, 0.6],
          [0.38, 1.2],
          [0.3, 1.5],
          [0.42, 1.6],
          [0.12, 1.75],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        48,
      ),
      m,
    );
    scene.add(body);
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.2, 1.1, 24),
      m,
    );
    arm.position.set(0.5, 1.0, 0.1);
    arm.rotation.z = 0.5;
    scene.add(arm);
    camera.position.set(0.6, 1.1, 3.2);
    camera.lookAt(0, 0.85, 0);
  };

const both = (f, ...a) => ({ node: f(PN, ...a), classic: f(PO, ...a) });

export default {
  "middleearth:orthanc:stone:waking": both(stone, { wake: 0.6, eye: 0 }),
  "middleearth:orthanc:stone:eye": both(stone, { wake: 1, eye: 1, turn: 0.4 }),
  "middleearth:orthanc:tower:low": both(tower, false),
  "middleearth:orthanc:tower:high": both(tower, true),
  "middleearth:orthanc:robe": { node: robe(SN), classic: robe(SO) },
};
