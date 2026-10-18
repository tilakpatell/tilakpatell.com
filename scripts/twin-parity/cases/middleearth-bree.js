// Bree’s scene’s shader: ../../../src/components/middleearth/towns/bree/
// sceneShaders.js against its twin, nodes/towns/bree/sceneShaders.js. The
// Nazgûl’s sight on the ground, the scene’s own fan of rings and spokes
// under it: two Riders, one searching and one that has seen you.
import * as THREE from 'three';
import * as SO from '../../../src/components/middleearth/towns/bree/sceneShaders.js';
import * as SN from '../../../src/components/middleearth/nodes/towns/bree/sceneShaders.js';

// story.js’s, the two the sight reads
const NAZGUL = { sight: 9, cone: 0.52 };

// scene.js’s fanGeo
const RINGS_N = 10;
const SPOKES = 18;
const fanGeo = () => {
  const pos = [];
  const local = [];
  const idx = [];
  pos.push(0, 0, 0);
  local.push(0, 0);
  for (let r = 1; r <= RINGS_N; r++)
    for (let k = 0; k <= SPOKES; k++) {
      const a = -NAZGUL.cone * 1.15 + (k / SPOKES) * NAZGUL.cone * 2.3;
      const d = (r / RINGS_N) * NAZGUL.sight;
      pos.push(Math.cos(a) * d, 0, -Math.sin(a) * d);
      local.push(Math.cos(a) * d, -Math.sin(a) * d);
    }
  const at = (r, k) => (r === 0 ? 0 : 1 + (r - 1) * (SPOKES + 1) + k);
  for (let r = 0; r < RINGS_N; r++)
    for (let k = 0; k < SPOKES; k++) {
      if (r === 0) idx.push(0, at(1, k), at(1, k + 1));
      else idx.push(at(r, k), at(r + 1, k), at(r + 1, k + 1), at(r, k), at(r + 1, k + 1), at(r, k + 1));
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('local', new THREE.Float32BufferAttribute(local, 2));
  g.setIndex(idx);
  return g;
};

const sight =
  (S) =>
  ({ scene, camera }) => {
    scene.background = new THREE.Color(0x0c1018);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2a3020 }));
    scene.add(ground);
    [
      [-3, 0.6, 0.3, 0x8aa0d8, 2.2],
      [4, 2.6, 0.46, 0xd84a3a, 5.1],
    ].forEach(([x, turn, opacity, colour, t], i) => {
      const m = S.sightMaterial(NAZGUL, i);
      m.uniforms.uOpacity.value = opacity;
      m.uniforms.uTime.value = t;
      m.uniforms.uColor.value.set(colour);
      const mesh = new THREE.Mesh(fanGeo(), m);
      mesh.position.set(x, 0.06, -2);
      mesh.rotation.y = turn;
      mesh.renderOrder = 2;
      scene.add(mesh);
    });
    camera.position.set(0, 9, 10);
    camera.lookAt(0, 0, -2);
  };

export default {
  'middleearth:bree:sight': { node: sight(SN), classic: sight(SO) },
};
