// Rivendell’s landmarks, built with the Rivendell chapter’s own builders
// (towns/rivendell/build.js, on the Road’s town kit with its elven stone)
// at the Road’s scale: the Last Homely House on its terraces down the
// valley on the right, pavilions on the slope below it, the bridge over
// the stream on its single slender arch, the Council’s court on its spur
// with its ten chairs and the plinth, the hall where the shards of Narsil
// lie, Bilbo’s pavilion with his desk and chair, lanterns on their bent
// stems along the road, golden birches, and the south gate the nine walk
// out under. The falls on the far cliff stay the stage’s own: pale sheets,
// unlit, off the chapter’s pale jointed rock. In the stage’s frame: the road along +z from 0, +x on the
// walker’s left.
//
//   buildProps({ K, material, heightAt }) → { group, ring, deck(z), seat, chairs, dispose }
//   COUNCIL, NARSIL, BENCH, ARCH, BRIDGE, FALLS, ELVEN: where they stand, and the scale, for the beats and the scene

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { C, merged, part } from '../parts';
import { bridge as buildBridge, colonnade, court, gate, house, lamp, pavilion, terrace } from '../../../towns/rivendell/build';
import { birchGeo, cliffGeo } from '../../../towns/rivendell/valley';

export const ELVEN = 0.8; // the Road’s man (1.8 m) over the chapter’s Big Folk (2.3)
export const BRIDGE = { z: [43, 57], w: 2.1, rise: 1.3 * ELVEN }; // over the stream, its deck humped as the chapter’s
export const COUNCIL = { at: [-9, 85] }; // the court on its spur, its way in to the road
export const NARSIL = [-9.5, 103.5]; // the hall of the shards, open to the road
export const BENCH = [6.2, 119]; // Bilbo’s pavilion, open to the road
export const ARCH = { z: 145, w: 4.2 }; // the south gate, the way out
export const FALLS = [[-150, 70, 46], [-160, 98, 58], [-146, 126, 40]]; // x, z, height of each fall on the valley’s far cliff

// the valley down on the right: [x, z, what, yaw]; the house faces the road
const VALLEY = [
  [-34, 94, 'house', Math.PI / 2],
  [-24, 70, 'pavilion', Math.PI / 2],
  [-46, 76, 'pavilion', Math.PI / 2.4],
  [-48, 112, 'pavilion', Math.PI / 1.7],
  [-22, 128, 'pavilion', Math.PI / 2],
];
// terraces stepping down under the house: [x, z, w, d, h]
const TERRACES = [
  [-34, 94, 20, 14, 1.6],
  [-24, 70, 9, 9, 1.2],
  [-46, 76, 9, 9, 2.2],
];
const LAMPS = [[2.6, 36, -Math.PI / 2], [-2.6, 66, Math.PI / 2], [2.6, 96, -Math.PI / 2], [-2.6, 130, Math.PI / 2]];
const BIRCHES = [[9, 24], [-8, 30], [12, 62], [-14, 58], [10, 80], [14, 102], [-4, 116], [12, 136], [-16, 140], [18, 50], [-30, 52], [-40, 128], [22, 116], [-20, 108]];

// a builder’s group stood on the land at (x, z), turned (its front, +z, to `yaw`), at the Road’s scale
function stand(g, heightAt, x, z, yaw, s = ELVEN, foot = 0) {
  g.position.set(x, heightAt(x, z) + foot, z);
  g.rotation.y = yaw;
  g.scale.setScalar(s);
  return g;
}
// a point in a stood group’s frame, in the stage’s
const out = (g, v) => {
  g.updateMatrixWorld(true);
  return v.clone().applyMatrix4(g.matrix);
};

export function buildProps({ K, material, heightAt }) {
  const group = new THREE.Group();
  group.name = 'rivendell:props';

  for (const [x, z, w, d, h] of TERRACES) group.add(stand(terrace(K, w, d, h).group, heightAt, x, z, Math.PI / 2, ELVEN, -0.4));
  const tops = new Map(TERRACES.map(([x, z, , , h]) => [`${x},${z}`, h * ELVEN - 0.4]));
  for (const [x, z, what, yaw] of VALLEY) {
    const b = what === 'house' ? house(K) : pavilion(K);
    group.add(stand(b.group, heightAt, x, z, yaw, ELVEN, tops.get(`${x},${z}`) ?? 0));
  }

  // the bridge, along the road over the stream (its ends at the banks’ height)
  const [z0, z1] = BRIDGE.z;
  const foot = Math.max(heightAt(0, z0), heightAt(0, z1)) + 0.05;
  const br = buildBridge(K, (z1 - z0) / ELVEN);
  br.group.position.set(0, foot, (z0 + z1) / 2);
  br.group.rotation.y = Math.PI / 2;
  br.group.scale.setScalar(ELVEN);
  group.add(br.group);
  const deck = (z) => (z <= z0 || z >= z1 ? foot : foot + BRIDGE.rise * Math.sin((Math.PI * (z - z0)) / (z1 - z0)));

  // the Council’s court, its way in (+z) to the road (+x)
  const ct = court(K);
  stand(ct.group, heightAt, COUNCIL.at[0], COUNCIL.at[1], Math.PI / 2, ELVEN, 0.02);
  group.add(ct.group);
  const chairs = ct.seats.map((s) => {
    const p = out(ct.group, new THREE.Vector3(s.x, 0, s.z));
    return { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(COUNCIL.at[0] - p.x, COUNCIL.at[1] - p.z) };
  });
  const plinth = out(ct.group, ct.plinthTop);

  // the hall of Narsil, open to the road, the shards on their stand within
  group.add(stand(colonnade(K, { withShards: true }).group, heightAt, NARSIL[0], NARSIL[1], Math.PI / 2));

  // Bilbo’s pavilion, open to the road; he sits at his desk facing up the road
  const pv = pavilion(K);
  stand(pv.group, heightAt, BENCH[0], BENCH[1], -Math.PI / 2);
  group.add(pv.group);
  const s = out(pv.group, pv.seat);
  const seat = { x: s.x, y: s.y - 0.5 * ELVEN, z: s.z, yaw: 0 };

  // the south gate, and lanterns along the road
  group.add(stand(gate(K).group, heightAt, 0, ARCH.z, 0, 1));
  for (const [x, z, yaw] of LAMPS) group.add(stand(lamp(K).group, heightAt, x, z, yaw));

  // golden birches through the valley, one instanced draw
  const birch = new THREE.InstancedMesh(birchGeo(2), material, BIRCHES.length);
  const m = new THREE.Matrix4();
  BIRCHES.forEach(([x, z], i) => {
    const k = 0.62 + ((i * 37) % 10) * 0.03;
    m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.1, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 2.1), new THREE.Vector3(k, k, k));
    birch.setMatrixAt(i, m);
  });
  birch.name = 'rivendell:birches';
  group.add(birch);

  // the valley’s far wall, the chapter’s rock, its face to the road (one instanced draw)
  const wall = [];
  for (let z = -30, i = 0; z <= 200; z += 15, i++) wall.push([-152 - (i % 3) * 5, z, 1.25 + (i % 4) * 0.12, 2.7 + ((i * 5) % 7) * 0.12]);
  const cliffs = new THREE.InstancedMesh(cliffGeo(3), material, wall.length);
  wall.forEach(([x, z, sxz, sy], i) => {
    m.compose(new THREE.Vector3(x, heightAt(x, z) - 4, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + ((i % 5) - 2) * 0.06), new THREE.Vector3(sxz, sy, sxz));
    cliffs.setMatrixAt(i, m);
  });
  cliffs.name = 'rivendell:cliffs';
  group.add(cliffs);
  // the falls: three pale sheets down the far cliff, unlit, a little see-through
  const fallMat = new MeshBasicNodeMaterial({ color: new THREE.Color(0.86, 0.92, 0.98), transparent: true, opacity: 0.82, depthWrite: false });
  const falls = merged(
    FALLS.map(([x, z, h]) => part(new THREE.PlaneGeometry(7, h, 1, 6), C(0xffffff), { at: [x + 6, heightAt(x, z) + h / 2 - 4, z], yaw: Math.PI / 2 })),
    fallMat,
    'rivendell:falls',
  );
  falls.castShadow = false;
  group.add(falls);
  // the Ring on its plinth: gold, unlit, so it catches the eye in any light
  const ringMat = new MeshBasicNodeMaterial({ color: new THREE.Color(1.6, 1.2, 0.45) });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 16), ringMat);
  ring.position.set(plinth.x, plinth.y + 0.02, plinth.z);
  ring.rotation.x = Math.PI / 2;
  ring.name = 'rivendell:ring';
  group.add(ring);

  return {
    group,
    ring,
    deck,
    chairs,
    seat,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
      fallMat.dispose();
      ringMat.dispose();
    },
  };
}
