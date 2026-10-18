// The Nazgûl: ../../../src/components/middleearth/towns/wraithsShaders.js
// against its twin, nodes/towns/wraithsShaders.js. The kit (wraiths.js)
// builds the same Nazgûl on both sides; on the node side its materials are
// swapped for the twin's, made on the kit's own uniforms, and the night the
// steel sees prefiltered by the node renderer. (The kit is built on a
// classic renderer of its own there: its night is the GLSL's, and isn't
// drawn.) Two Nazgûl in the wind, one hunting with its sword up, by night,
// through the Ring half on and fully on.
import * as THREE from 'three';
import { createWraithKit } from '../../../src/components/middleearth/towns/wraiths.js';
import * as TW from '../../../src/components/middleearth/nodes/towns/wraithsShaders.js';

let builder = null;

const nazgul =
  (twin, ring) =>
  ({ scene, camera, renderer, sun }) => {
    builder ??= twin ? new THREE.WebGLRenderer() : null;
    const kit = createWraithKit(twin ? builder : renderer);
    let setRing = kit.setRing;
    let swap = null;
    if (twin) {
      const t = TW.wraithMaterials(kit.uniforms, {
        weave: kit.mats.cloth.map,
        weaveN: kit.mats.cloth.normalMap,
        env: TW.nightEnv(renderer),
      });
      setRing = t.setRing;
      swap = new Map(Object.keys(kit.mats).map((k) => [kit.mats[k], t.mats[k]]));
    }
    scene.background = new THREE.Color(0x0c1018);
    sun.intensity = 1.2;
    sun.color.set(0xb8c8ff);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c2016, roughness: 0.95 }));
    scene.add(ground);
    const ns = [
      { seed: 1, at: [-0.7, 0, 0], face: -1.2, pose: { sniff: 0.8 } },
      { seed: 2, at: [0.9, 0, -0.6], face: -2.2, pose: { hunt: 1 } },
    ].map(({ seed, at, face, pose }) => {
      const n = kit.nazgul({ seed });
      n.group.position.set(...at);
      n.group.rotation.y = face;
      if (swap)
        n.group.traverse((o) => {
          if (swap.has(o.material)) o.material = swap.get(o.material);
        });
      scene.add(n.group);
      return { n, pose };
    });
    setRing(ring);
    for (let k = 0; k <= 30; k++) {
      const t = 2 + k / 30;
      kit.tick(t);
      for (const { n, pose } of ns) kit.animate(n, t, pose);
    }
    camera.position.set(0.4, 1.7, 4.6);
    camera.lookAt(0, 1.2, 0);
  };

export default {
  'middleearth:wraiths:night': {
    node: nazgul(true, 0),
    classic: nazgul(false, 0),
  },
  'middleearth:wraiths:ring-half': {
    node: nazgul(true, 0.5),
    classic: nazgul(false, 0.5),
  },
  'middleearth:wraiths:ring': {
    node: nazgul(true, 1),
    classic: nazgul(false, 1),
  },
};
