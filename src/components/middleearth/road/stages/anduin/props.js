// The Anduin’s landmarks, built with the Lothlórien chapter’s Argonath and
// boats (towns/lorien/{argonath,boat}.js) and Amon Hen’s Seat, camp and
// woods (towns/amonhen/{seat,camp,forest}.js) on the Road’s kits: the two
// Kings of old either side of the river, a hand raised against the north;
// Tol Brandir’s spire standing out of the lake ahead; the camp on the lawn
// of Parth Galen and the boats drawn up by it; the Seat of Seeing on its
// platform on the hill’s shoulder, its steps to the road; pines and beeches
// round it; and the vision from the Seat, four small pictures in the sky to
// the west: Orthanc, Edoras, the White City, and the Dark Tower with the
// Eye. In the stage’s frame: the road along +z from 0, +x on the walker’s
// left.
//
//   buildProps({ K, road, heightAt, level, tier }) → { group, boats, seat, vision, eye, dispose }
//   ARGONATH, SEAT, CAMP: where they stand, for the beats and the scene

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv } from 'three/tsl';
import { argonath, riverCliffGeo, riverRockGeo } from '../../../towns/lorien/argonath';
import { boat as buildBoat } from '../../../towns/lorien/boat';
import { seat as buildSeat } from '../../../towns/amonhen/seat';
import { camp as buildCamp } from '../../../towns/amonhen/camp';
import { beechGeo, pineGeo } from '../../../towns/amonhen/forest';
import { eyeColour } from '../../creatures/eye';
import { C, merged, mergeStatics, part } from '../parts';
import { wearParts } from '../../partsWear';

export const ARGONATH = { z: 72, scale: 0.6 }; // m: the Kings, either side of the river (at 0.6 the chapter’s: 55 m to their hands, close enough to the river to be seen from it)
export const SEAT = { at: [-7, 118] }; // the Seat of Seeing, its steps (+x) to the road
export const CAMP = { at: [-8, 104] }; // the lawn of Parth Galen
const TOL = [-30, 230, 70]; // Tol Brandir: x, z, height

// the woods round Parth Galen: [x, z, kind] (on low every other)
// (none west of the Seat, where its view goes)
const WOODS = [[-16, 96, 'pine'], [-22, 100, 'beech'], [-18, 138, 'pine'], [-28, 142, 'beech'], [-12, 146, 'pine'], [-34, 150, 'pine'], [-26, 92, 'beech'], [8, 124, 'pine'], [12, 112, 'beech'], [6, 98, 'beech'], [-8, 152, 'pine']];

// the vision’s four pictures: a few boxes and cones each, in the site’s colours
function visions() {
  const tower = (dark, h, r) => [part(new THREE.CylinderGeometry(r * 0.8, r, h, 8), C(dark), { at: [0, h / 2, 0] }), ...[0, 1, 2, 3].map((i) => part(new THREE.ConeGeometry(r * 0.3, h * 0.25, 4), C(dark), { at: [Math.cos(i * 1.57) * r * 0.6, h + h * 0.1, Math.sin(i * 1.57) * r * 0.6] }))];
  const orthanc = tower(0x15161a, 18, 2.2);
  const edoras = [part(new THREE.ConeGeometry(9, 6, 9), C(0x6a7a3a), { at: [0, 3, 0] }), part(new THREE.BoxGeometry(5, 2.4, 2.6), C(0xc89a3a), { at: [0, 7.2, 0] }), part(new THREE.ConeGeometry(3.4, 2, 4), C(0xd8b04a), { at: [0, 9.4, 0], yaw: Math.PI / 4 })];
  const city = [0, 1, 2, 3, 4, 5, 6].map((i) => part(new THREE.CylinderGeometry(8 - i, 8.4 - i, 2.2, 14), C(0xeceae2), { at: [0, 1.1 + i * 2.2, 0] }));
  city.push(part(new THREE.CylinderGeometry(0.4, 0.5, 6, 6), C(0xf6f4ee), { at: [0, 18, 0] }));
  const dark = tower(0x0c0a0a, 26, 3.4);
  return [orthanc, edoras, city, dark];
}

export function buildProps({ K, road, heightAt, level, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'anduin:props';
  const material = wearParts(road.material({ vertexColors: true, flatShading: true }), { tier });

  // the Argonath, facing up the river at the boats coming down it
  const rocks = [riverRockGeo(3), riverRockGeo(7), riverRockGeo(12)];
  const kings = argonath(K, rocks);
  kings.group.position.set(0, level(0, ARGONATH.z) ?? heightAt(0, ARGONATH.z), ARGONATH.z);
  kings.group.rotation.y = Math.PI;
  kings.group.scale.setScalar(ARGONATH.scale);
  group.add(kings.group);

  // Tol Brandir out of the lake ahead, a spire of rock
  const tol = new THREE.Mesh(riverCliffGeo(5), K.mats.cliff);
  tol.position.set(TOL[0], heightAt(TOL[0], TOL[1]) - 4, TOL[1]);
  tol.scale.set(3.2, TOL[2] / 8, 3.2);
  group.add(tol);

  // the camp on the lawn, and three boats (the scene carries them)
  const camp = buildCamp(K);
  camp.group.position.set(CAMP.at[0], heightAt(...CAMP.at), CAMP.at[1]);
  group.add(camp.group);
  const boats = [0, 1, 2].map(() => {
    const b = buildBoat(K);
    b.group.rotation.y = -Math.PI / 2;
    group.add(b.group);
    return b;
  });

  // the Seat of Seeing on the hill’s shoulder, its steps to the road
  const seat = buildSeat(K);
  seat.group.position.set(SEAT.at[0], heightAt(...SEAT.at), SEAT.at[1]);
  group.add(seat.group);

  // the woods: pines and beeches, two instanced draws
  const kinds = { pine: pineGeo(3), beech: beechGeo(5) };
  const m = new THREE.Matrix4();
  for (const [kind, geo] of Object.entries(kinds)) {
    const list = WOODS.filter((w, i) => w[2] === kind && (tier !== 'low' || i % 2 === 0));
    const trees = new THREE.InstancedMesh(geo, K.mats.tree ?? K.mats.fern, list.length);
    list.forEach(([x, z], i) => {
      const k = 1.4 + ((i * 5) % 4) * 0.15;
      m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 2.3), new THREE.Vector3(k, k, k));
      trees.setMatrixAt(i, m);
    });
    trees.name = `anduin:${kind}`;
    group.add(trees);
  }

  // the vision: four pictures in the sky to the west, shown by the scene
  const vision = new THREE.Group();
  vision.name = 'anduin:vision';
  const sky = new MeshBasicNodeMaterial({ vertexColors: true, transparent: true, opacity: 0.9, fog: false });
  visions().forEach((parts, i) => {
    const p = merged(parts, sky, `anduin:vision${i}`);
    const [x, z] = [-70 - (i % 2) * 14, 92 + i * 18];
    p.position.set(x, heightAt(x, z) + 30 + i * 4, z);
    p.rotation.y = Math.PI / 2;
    p.castShadow = false;
    vision.add(p);
  });
  // the Eye over the Dark Tower’s top
  const tEye = uniform(0);
  const kEye = uniform(1);
  const eyeMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  eyeMat.colorNode = eyeColour(uv(), { k: kEye, time: tEye });
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), eyeMat);
  const dark = vision.children[3];
  eye.position.set(dark.position.x + 2, dark.position.y + 32, dark.position.z);
  eye.rotation.y = Math.PI / 2;
  vision.add(eye);
  vision.visible = false;
  group.add(vision);

  // (the stills one a material: the boats, the vision and the Kings’ hands as they are)
  mergeStatics(group, { keep: [...boats.map((b) => b.group), vision, kings.group] });

  return {
    group,
    boats,
    seat,
    vision,
    eye: { tick: (t) => void (tEye.value = t), set: (k) => void (kEye.value = k) },
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
      for (const r of rocks) r.dispose();
      material.dispose();
      sky.dispose();
      eyeMat.dispose();
    },
  };
}
