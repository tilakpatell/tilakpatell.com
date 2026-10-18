// The rush's ring over a station: ../../../src/components/middleearth/
// rush/sceneShaders.js against its twin, nodes/rush/sceneShaders.js. Four
// rings, part filled and one flashing, over a floor they ignore the depth
// of.
import * as THREE from "three";
import * as RO from "../../../src/components/middleearth/rush/sceneShaders.js";
import * as RN from "../../../src/components/middleearth/nodes/rush/sceneShaders.js";

const floor = (scene, color = 0x3a3026) => {
  const f = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color }),
  );
  scene.add(f);
};

const rings =
  (R) =>
  ({ scene, camera }) => {
    floor(scene);
    const geo = new THREE.PlaneGeometry(0.5, 0.5);
    const states = [
      [0.15, 0xe0a030, 0],
      [0.5, 0x60c040, 0],
      [0.85, 0x40a0e0, 0.3],
      [1, 0xe04020, 1],
    ];
    states.forEach(([k, col, flash], i) => {
      const r = new THREE.Mesh(geo, R.ringMaterial());
      r.material.uniforms.uK.value = k;
      r.material.uniforms.uCol.value.set(col);
      r.material.uniforms.uFlash.value = flash;
      r.position.set((i - 1.5) * 0.62, 0.4 + (i % 2) * 0.1, 0);
      r.scale.setScalar(1.1);
      scene.add(r);
    });
    camera.position.set(0, 0.9, 2.2);
    camera.lookAt(0, 0.4, 0);
  };

export default {
  "middleearth:rush:rings": { node: rings(RN), classic: rings(RO) },
};
