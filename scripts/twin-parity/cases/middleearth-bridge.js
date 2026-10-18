// The bridge's ward: ../../../src/components/middleearth/bridgeShaders.js
// against its twin, nodes/bridgeShaders.js. The shell lit over a dark
// floor, most of the way in.
import * as THREE from "three";
import * as BO from "../../../src/components/middleearth/bridgeShaders.js";
import * as BN from "../../../src/components/middleearth/nodes/bridgeShaders.js";

const floor = (scene, color = 0x3a3026) => {
  const f = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color }),
  );
  scene.add(f);
};

const ward =
  (B) =>
  ({ scene, camera }) => {
    scene.background.set(0x0a0604);
    floor(scene, 0x2a1a12);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 32, 18),
      B.wardMaterial(),
    );
    dome.material.uniforms.opacity.value = 0.8;
    dome.position.set(0, 1.1, 0);
    scene.add(dome);
    camera.position.set(0, 1.6, 4.5);
    camera.lookAt(0, 1, 0);
  };

export default {
  "middleearth:bridge:ward": { node: ward(BN), classic: ward(BO) },
};
