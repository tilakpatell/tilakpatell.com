// The fell beast over the Marshes: the Marshes chapter’s own (towns/
// marshes/beast.js, a Nazgûl on it) flown round its ring by the rule
// (fellbeast.rules.js), banked into the turn, its wings beating.
//
//   createFellBeast(K) → { group, update(t, { at, r, height }), dispose() }
//     K: the town kit with the Marshes’ mats (marshesKit.js’s)

import * as THREE from 'three';
import { fellBeast } from '../../towns/marshes/beast';
import { circle } from './fellbeast.rules';

const SCALE = 0.8;

export function createFellBeast(K) {
  const beast = fellBeast(K);
  const group = new THREE.Group();
  group.name = 'road:fellbeast';
  // (the chapter’s faces +x; the rule’s heading is along +z)
  beast.group.rotation.y = -Math.PI / 2;
  beast.group.scale.setScalar(SCALE);
  const bank = new THREE.Group();
  bank.add(beast.group);
  group.add(bank);
  group.traverse((o) => o.isMesh && (o.frustumCulled = false));
  return {
    group,
    update(t, { at = [0, 0], r = 30, height = 24 } = {}) {
      const p = circle(t, { at, r });
      group.position.set(p.x, height, p.z);
      group.rotation.y = p.yaw;
      bank.rotation.z = -p.bank;
      beast.animate(t, { flap: 1 });
    },
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
    },
  };
}
