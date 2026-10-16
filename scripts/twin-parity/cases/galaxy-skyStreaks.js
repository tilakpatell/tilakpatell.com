// The galaxy’s sky traffic: ../../../src/components/galaxy/skyStreaks.js
// against its twin, nodes/skyStreaks.js. The same lanes and the same seeded
// traffic on both sides, stepped the same, round a small planet (the whole scaled down) that hides
// the streaks behind it (they test depth).
import * as THREE from 'three';
import * as SO from '../../../src/components/galaxy/skyStreaks.js';
import * as SN from '../../../src/components/galaxy/nodes/skyStreaks.js';

const seeded = (seed = 9) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// (most of them out ahead of the camera, which sits off the planet looking
// out to the sky, as a pilot does; one back past it, cut at the near side)
const LINKS = [
  [0.3, 0.1, -1],
  [0.1, 0.35, -1],
  [0.45, -0.15, -1],
  [-0.1, 0.2, -1],
  [0.25, 0.25, -0.8],
  [0.05, 0.12, 1],
].map((d, i) => ({ id: `l${i}`, dir: new THREE.Vector3(...d).normalize().toArray() }));

const streaks = (S, steps, from = [30, 14, 30], to = [0, 0, -25]) => ({ scene, camera, renderer }) => {
  camera.position.set(...from);
  camera.lookAt(...to);
  camera.far = 4000;
  camera.updateProjectionMatrix();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(2, 32, 16), new THREE.MeshStandardMaterial({ color: 0x8a6a4a })));
  const s = S.createSkyStreaks({ renderer, rand: seeded(5) });
  s.setSystem(LINKS, 100);
  // (the sky the streaks run out to, 3000 off, brought in to 60, so a case of
  // 256 pixels sees them along their length: the width is in pixels, kept)
  s.group.scale.setScalar(0.02);
  for (let i = 0; i < steps; i++) s.update(1 / 30);
  scene.add(s.group);
};

export default {
  'galaxy:skyStreaks': { node: streaks(SN, 20), classic: streaks(SO, 20) },
  'galaxy:skyStreaks:later': { node: streaks(SN, 75), classic: streaks(SO, 75) },
  // (on the lane back past the camera: its streaks cut off at the near side)
  'galaxy:skyStreaks:near': { node: streaks(SN, 30, [0.4, 1.2, 9], [0, 0, 0]), classic: streaks(SO, 30, [0.4, 1.2, 9], [0, 0, 0]) },
};
