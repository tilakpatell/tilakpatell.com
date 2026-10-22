// Caradhras’ landmarks: the Walls of Moria across the road’s end, built
// with the Moria chapter’s own West-gate (towns/moria/gate.js: the Doors of
// Durin in ithildin on their cliff, the holly either side) on the Road’s
// Moria kit, its face turned to the road; the mountain’s wall going on
// either side of it in Rivendell’s jointed rock, darker; and the slab of
// snow the avalanche lets go off the shoulder above the road. In the
// stage’s frame: the road along +z from 0, +x on the walker’s left.
//
//   buildProps({ K, road, heightAt, tier }) → { group, gate, slab, dispose }
//   GATE_AT, GATE_SCALE, LAKE, SLAB: where they stand, for the beats and the scene

import * as THREE from 'three';
import { westGate } from '../../../towns/moria/gate';
import { cliffGeo } from '../../../towns/rivendell/valley';
import { mergeStatics, roled } from '../parts';
import { wearParts } from '../../partsWear';

export const GATE_AT = 160; // m: the cliff’s face across the road
export const GATE_SCALE = 1.3; // the chapter’s doors 5 m tall; the films’ greater
export const LAKE = { at: [-42, 134], area: { x0: -78, z0: 108, w: 62, d: 50 } }; // the black water under the Walls, on the right
export const SLAB = { from: [17, 86], to: [3, 90], w: 13, d: 7 }; // the avalanche: off the shoulder on the left, across the road ahead

export function buildProps({ K, road, heightAt, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'caradhras:props';

  // the Walls and the Doors, their face to the road (the chapter’s gate looks +z)
  const gate = westGate(K);
  gate.group.position.set(0, heightAt(0, GATE_AT - 6) - 0.2, GATE_AT);
  gate.group.rotation.y = Math.PI;
  gate.group.scale.setScalar(GATE_SCALE);
  group.add(gate.group);

  // the mountain’s wall on from the cliff either side, its face to the road (one instanced draw)
  const material = wearParts(road.material({ vertexColors: true, flatShading: true, color: 0x8a8c94 }), { tier });
  const wall = [];
  const step = tier === 'low' ? 18 : 12;
  for (let x = 26, i = 0; x <= 150; x += step, i++)
    for (const side of [-1, 1]) wall.push([side * x, GATE_AT + 4 + (i % 3) * 3, 1.6 + (i % 4) * 0.15, 3.2 + ((i * 5) % 7) * 0.2, side * ((i % 5) - 2) * 0.05]);
  const cliffs = new THREE.InstancedMesh(roled(cliffGeo(5), 'rock'), material, wall.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  wall.forEach(([x, z, sxz, sy, turn], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI + turn);
    m.compose(new THREE.Vector3(x, heightAt(x, z) - 6, z), q, new THREE.Vector3(sxz, sy, sxz));
    cliffs.setMatrixAt(i, m);
  });
  cliffs.name = 'caradhras:walls';
  group.add(cliffs);

  // the slab of snow on the shoulder, waiting to go
  const snow = road.material({ color: 0xf2f5fa, flatShading: true });
  const slabGeo = new THREE.BoxGeometry(SLAB.w, 1.6, SLAB.d, 4, 1, 2);
  // (its top rough, so it reads as a crust of snow and not a box)
  const pos = slabGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setY(i, pos.getY(i) + Math.sin(pos.getX(i) * 1.7 + pos.getZ(i)) * 0.35);
  slabGeo.computeVertexNormals();
  const slab = new THREE.Mesh(slabGeo, snow);
  slab.name = 'caradhras:slab';
  group.add(slab);

  // (the gate’s pieces one a material, its two leaves left to swing)
  mergeStatics(group, { keep: [slab, cliffs, ...gate.leaves] });

  return {
    group,
    gate,
    slab,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
      material.dispose();
      snow.dispose();
    },
  };
}
