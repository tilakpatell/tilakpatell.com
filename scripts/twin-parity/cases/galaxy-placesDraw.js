// The places to find, drawn: ../../../src/components/galaxy/placesDraw.js
// against its twin, nodes/placesDraw.js. One of each kind of place set out
// near the origin (the solids lit by the scene’s sun, the glows over them,
// the comet’s tail away from the sun, the nebula’s puffs), the same seeded
// shapes both sides, at one moment of the blinks; from afar and close to.
import * as THREE from 'three';
import * as PO from '../../../src/components/galaxy/placesDraw.js';
import * as PN from '../../../src/components/galaxy/nodes/placesDraw.js';

const PLACES = [
  { id: 'w', kind: 'wreck', at: [-14, 2, 0] },
  { id: 'c', kind: 'comet', at: [10, -2, -10] },
  { id: 'r', kind: 'rocks', at: [0, -8, -30] },
  { id: 'b', kind: 'beacon', at: [-4, 6, 8] },
  { id: 'o', kind: 'outpost', at: [16, 6, 10] },
  { id: 'n', kind: 'nebula', at: [-30, 0, -60] },
];

const places = (P, { from, to, small = false }) => ({ scene, camera }) => {
  camera.position.set(...from);
  camera.lookAt(...to);
  camera.far = 2000;
  camera.updateProjectionMatrix();
  scene.background = new THREE.Color(0x05070c);
  const p = P.createPlaces({ places: PLACES, sun: [0.5, 0.3, 0.8], small });
  p.update(2.3, 1 / 60);
  scene.add(p.group);
};

export default {
  'galaxy:places': { node: places(PN, { from: [0, 30, 90], to: [0, 0, -10] }), classic: places(PO, { from: [0, 30, 90], to: [0, 0, -10] }) },
  'galaxy:places:near': { node: places(PN, { from: [-2, 6, 22], to: [-6, 3, 0] }), classic: places(PO, { from: [-2, 6, 22], to: [-6, 3, 0] }) },
  'galaxy:places:small': { node: places(PN, { from: [20, 10, 40], to: [0, 0, -30], small: true }), classic: places(PO, { from: [20, 10, 40], to: [0, 0, -30], small: true }) },
};
