// The host of Rohan: ../../../src/components/middleearth/towns/edoras/
// folkShaders.js against its twin, nodes/towns/edoras/folkShaders.js. The
// kit (folk.js) builds the host on both sides; on each side its host,
// banner and flag materials are that side's, made on the kit's own
// uniforms. A few dozen Riders instanced in a column, some with
// banners, galloping a little way into their stride and standing; a lone
// Rider (not instanced: one seed for all) and a banner on its pole, waving.
import * as THREE from 'three';
import { createEdorasFolk } from '../../../src/components/middleearth/towns/edoras/folk.js';
import * as GF from '../../../src/components/middleearth/towns/edoras/folkShaders.js';
import * as TF from '../../../src/components/middleearth/nodes/towns/edoras/folkShaders.js';

const host =
  (twin, { ride, lone }) =>
  ({ scene, camera, renderer }) => {
    const folk = createEdorasFolk(renderer);
    const kit = folk.host();
    // (each side's materials made on the kit's own uniforms: since the flip
    // the kit itself makes the twin's)
    const u = kit.material.userData.uniforms;
    const S = twin ? TF : GF;
    const mats = {
      host: S.hostMaterial(u),
      banner: S.bannerMaterial(u, true),
      flag: S.bannerMaterial(u, false),
    };
    scene.background = new THREE.Color(0x8aa4c0);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6a7a44, roughness: 0.95 }));
    scene.add(ground);
    if (lone) {
      const r = new THREE.Mesh(kit.geometry, mats.host);
      r.rotation.y = 0.5;
      scene.add(r);
      const flag = folk.banner();
      flag.material = mats.flag;
      flag.position.set(-1.6, 0, -0.8);
      scene.add(flag);
      camera.position.set(2.5, 2.4, 4.5);
      camera.lookAt(0, 1.4, 0);
    } else {
      const rows = 5;
      const cols = 6;
      const riders = new THREE.InstancedMesh(kit.geometry, mats.host, rows * cols);
      const banners = new THREE.InstancedMesh(kit.banner.geometry, mats.banner, cols);
      const m = new THREE.Matrix4();
      let b = 0;
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++) {
          m.makeRotationY(-0.3).setPosition(-j * 2.6 + (i % 2) * 0.7, 0, i * 1.5 - 3);
          riders.setMatrixAt(i * cols + j, m);
          if (i === 2) banners.setMatrixAt(b++, m);
        }
      scene.add(riders, banners);
      camera.position.set(4.5, 3.2, 6.5);
      camera.lookAt(-5, 1, 0);
    }
    kit.ride(ride);
    for (let k = 0; k <= 20; k++) folk.tick(1 + k * 0.03);
  };

export default {
  'middleearth:folk:host': {
    node: host(true, { ride: 1, lone: false }),
    classic: host(false, { ride: 1, lone: false }),
  },
  'middleearth:folk:host-standing': {
    node: host(true, { ride: 0, lone: false }),
    classic: host(false, { ride: 0, lone: false }),
  },
  'middleearth:folk:lone': {
    node: host(true, { ride: 0.6, lone: true }),
    classic: host(false, { ride: 0.6, lone: true }),
  },
};
