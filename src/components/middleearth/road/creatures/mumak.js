// A mûmak of Harad, built: a great grey beast half again an elephant’s
// height, its four tusks long and curved, a war-tower lashed on its back
// with red cloths, walking the slow four-beat of mumak.rules.js. Faces +z;
// its feet on y = 0 at its origin.
//
//   createMumak(road, { scale }) → { group, update(t, speed), dispose() }

import * as THREE from 'three';
import { feetAt } from './mumak.rules';
import { C, merged, part } from '../stages/parts';

const H = 9; // m to the top of its back
const LEG = { r: 0.95, len: 5.6, at: [[1.7, 2.9], [1.7, -3.1], [-1.7, 2.9], [-1.7, -3.1]] }; // [x, z]: hind left, fore left… as WALK’s order (left +x)
const ORDER = [1, 0, 3, 2]; // WALK’s legs (hind left, fore left, hind right, fore right) → LEG.at’s

export function createMumak(road, { scale = 1 } = {}) {
  const material = road.material({ vertexColors: true, flatShading: true });
  const group = new THREE.Group();
  group.name = 'road:mumak';
  const grey = 0xa08a6c; // (warm: the Road’s cool sky turns a cold grey violet)
  const body = [
    part(new THREE.SphereGeometry(1, 14, 10), C(grey), { at: [0, LEG.len + 1.8, 0], scale: [3, 2.6, 5.2] }),
    part(new THREE.SphereGeometry(1, 12, 9), C(grey), { at: [0, LEG.len + 2.6, 5.2], scale: [1.9, 2, 2] }),
    // the trunk, hanging and curled
    part(new THREE.CylinderGeometry(0.35, 0.7, 5, 8), C(0x8a7e6c), { at: [0, LEG.len - 0.2, 7.2], pitch: 0.25 }),
    // the ears
    part(new THREE.SphereGeometry(1, 8, 6), C(0x8e8270), { at: [1.8, LEG.len + 2.6, 4.6], scale: [0.25, 1.8, 1.5] }),
    part(new THREE.SphereGeometry(1, 8, 6), C(0x8e8270), { at: [-1.8, LEG.len + 2.6, 4.6], scale: [0.25, 1.8, 1.5] }),
    // the war-tower and its cloths
    part(new THREE.BoxGeometry(3.6, 3, 4.4), C(0x5a3a22), { at: [0, LEG.len + 5.6, -0.4] }),
    part(new THREE.BoxGeometry(4.4, 0.3, 6.4), C(0x8c1c14), { at: [0, LEG.len + 4.1, -0.4] }),
    part(new THREE.ConeGeometry(2.8, 2.4, 4), C(0x8c1c14), { at: [0, LEG.len + 8.3, -0.4], yaw: Math.PI / 4 }),
  ];
  // four tusks, long and curving up
  for (const [x, y, k] of [[0.8, 0.4, 1], [-0.8, 0.4, 1], [1.2, -0.4, 0.75], [-1.2, -0.4, 0.75]]) body.push(part(new THREE.ConeGeometry(0.28 * k, 5.5 * k, 6), C(0xe8dcc0), { at: [x, LEG.len + 1.8 + y, 7.4 + k], pitch: 1.2, roll: x * 0.1 }));
  const trunk = merged(body, material, 'mumak:body');
  group.add(trunk);
  // the legs, each a column swung from its shoulder
  const legGeo = new THREE.CylinderGeometry(LEG.r * 0.9, LEG.r, LEG.len, 10).translate(0, -LEG.len / 2, 0);
  const legCol = new THREE.Float32BufferAttribute(new Float32Array(legGeo.attributes.position.count * 3).fill(0.5), 3);
  legGeo.setAttribute('color', legCol);
  const legs = LEG.at.map(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, material);
    leg.position.set(x, LEG.len, z);
    leg.castShadow = true;
    group.add(leg);
    return leg;
  });
  group.scale.setScalar((scale * H) / (LEG.len + 4.4));
  return {
    group,
    update(t, speed = 1) {
      const feet = feetAt(t, { speed });
      feet.forEach((f, i) => {
        const leg = legs[ORDER[i]];
        leg.rotation.x = -f.x * 0.22;
        leg.position.y = LEG.len + f.lift * 0.5;
      });
      // (the body rolls and dips a little with the stride)
      trunk.rotation.z = Math.sin(t * speed * 1.2) * 0.02;
      trunk.position.y = -Math.abs(Math.sin(t * speed * 1.2)) * 0.12;
    },
    dispose() {
      group.removeFromParent();
      trunk.geometry.dispose();
      legGeo.dispose();
      material.dispose();
    },
  };
}
