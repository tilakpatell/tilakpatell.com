// Middle-earth's other travellers: ../../../src/components/middleearth/
// towns/ghosts.js against its twin, nodes/towns/ghosts.js. Two of them, the
// map's toy figures (made in code, so nothing waits on a model), faded in
// and shimmering, their names over their heads and their rings of light
// under them; close, for the rim's light at their edges, and from further
// off with one walking.
import * as THREE from "three";
import { makeToyFigure } from "../../../src/components/middleearth/mapFigures.js";
import * as GO from "../../../src/components/middleearth/towns/ghosts.js";
import * as GN from "../../../src/components/middleearth/nodes/towns/ghosts.js";

const looks = [
  { hair: 0x3a2214, coat: 0x8a3a2a, cloak: 0x5f6b48, seed: 1 },
  { hair: 0xc8a060, coat: 0x2a4a6a, seed: 4 },
];

const travellers =
  (G, { near }) =>
  ({ scene, camera }) => {
    let i = 0;
    const ghosts = G.createGhosts({
      make: () => {
        const f = makeToyFigure(looks[i++ % looks.length]);
        return { ...f, top: 1.6 };
      },
    });
    scene.add(ghosts.group);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x2c3a24, roughness: 0.9 }),
    );
    scene.add(ground);
    const list = (t) => [
      { id: "abc", name: "Samwise", x: -0.6, z: 0, face: 0.6, moving: false },
      {
        id: "xyz",
        name: "Pippin",
        x: 0.7 + t * 0.4,
        z: -0.4,
        face: 0,
        moving: true,
      },
    ];
    for (let k = 0; k < 4; k++)
      ghosts.update(list(k * 0.25), 1.3 + k * 0.25, 0.25);
    if (near) {
      camera.position.set(0.2, 1.2, 2.6);
      camera.lookAt(0, 0.8, 0);
    } else {
      camera.position.set(1.5, 2.4, 5.5);
      camera.lookAt(0, 0.7, 0);
    }
  };

export default {
  "middleearth:ghosts:near": {
    node: travellers(GN, { near: true }),
    classic: travellers(GO, { near: true }),
  },
  "middleearth:ghosts:far": {
    node: travellers(GN, { near: false }),
    classic: travellers(GO, { near: false }),
  },
};
