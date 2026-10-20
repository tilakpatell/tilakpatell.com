// Cirith Ungol’s landmarks: the straight stair cut up the dark cliff, black
// boulders and sheer rock either side of it; Shelob’s Lair, a rough arched
// tunnel of black rock over the road with webs strung across it and bones
// along its walls, a side passage on the left she comes out of; the Tower
// above the pass on the left, black tiers and horns with red slits; and the
// two Watchers either side of the gate out, three-faced, seated, their eyes
// red. Built with the Cirith Ungol chapter’s boulders and webs (towns/
// cirithungol/{stairs,tunnels}.js) on the Road’s kit. In the stage’s frame:
// the road along +z from 0, +x on the walker’s left.
//
//   buildProps({ K, road, heightAt, tier }) → { group, eyes, dispose }
//   STAIR, LAIR, TOWER, GATE: where they stand, for the beats and the scene

import * as THREE from 'three';
import { rockGeo, webGeo } from '../../../towns/cirithungol/props';
import { C, merged, mergeStatics, part } from '../parts';

export const STAIR = { from: 2, to: 54, step: 0.55 }; // m along the road: the steps
export const LAIR = { from: 58, to: 112, r: 3.4, side: [5, 88] }; // the tunnel over the road; her side passage’s mouth [x, z]
export const TOWER = { at: [22, 124] }; // the Tower of Cirith Ungol, on the left above the pass
export const GATE = { z: 134, x: 3.2 }; // the Watchers either side of the gate out

const rand = (i) => {
  const x = Math.sin(i * 91.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
};

export function buildProps({ K, road, heightAt, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'cirith-ungol:props';
  const low = tier === 'low';
  const material = road.material({ vertexColors: true, flatShading: true });
  const { mats } = K;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);

  // the stair: worn steps up the lane, the rock sheer either side (two instanced draws)
  const steps = [];
  for (let z = STAIR.from; z < STAIR.to; z += STAIR.step) steps.push(z);
  const stepMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.3, STAIR.step * 0.96), mats.rock, steps.length);
  steps.forEach((z, i) => {
    q.setFromAxisAngle(UP, (rand(i) - 0.5) * 0.08);
    m.compose(new THREE.Vector3((rand(i + 7) - 0.5) * 0.15, heightAt(0, z) - 0.08, z), q, new THREE.Vector3(1, 1, 1));
    stepMesh.setMatrixAt(i, m);
  });
  stepMesh.name = 'cirith-ungol:steps';
  group.add(stepMesh);
  const cliff = [];
  for (let z = -6, i = 0; z < STAIR.to + 6; z += low ? 5 : 3.5, i++)
    for (const side of [-1, 1]) cliff.push([side * (2.2 + rand(i * 2 + side) * 1.4), z, 1.6 + rand(i + 30) * 1.2, 2.5 + rand(i + 60) * 2.5]);
  const walls = new THREE.InstancedMesh(rockGeo(3), mats.rock, cliff.length);
  cliff.forEach(([x, z, s, h], i) => {
    q.setFromAxisAngle(UP, rand(i + 90) * 6.28);
    m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.6, z), q, new THREE.Vector3(s, s * h, s));
    walls.setMatrixAt(i, m);
  });
  walls.name = 'cirith-ungol:cliff';
  group.add(walls);

  // Shelob’s Lair: a rough arch of black rock over the road, its floor the land’s
  const len = LAIR.to - LAIR.from;
  const arch = new THREE.CylinderGeometry(LAIR.r, LAIR.r, len, 14, Math.ceil(len / 3), true, -Math.PI / 2, Math.PI);
  arch.rotateX(-Math.PI / 2); // (the half with z ≥ 0 turned up: the roof)
  // (roughened, so it reads as rock and not a pipe; the side passage’s mouth left open)
  const pos = arch.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 1 + (Math.sin(z * 1.3 + x * 2.1) * 0.08 + Math.sin(z * 0.37 + y * 3.1) * 0.06);
    pos.setXYZ(i, x * k, y * k, z);
  }
  arch.computeVertexNormals();
  const lair = new THREE.Mesh(arch, road.material({ color: 0x3a3632, side: THREE.BackSide, flatShading: true }));
  lair.position.set(0, heightAt(0, (LAIR.from + LAIR.to) / 2) - 0.4, (LAIR.from + LAIR.to) / 2);
  lair.name = 'cirith-ungol:lair';
  group.add(lair);
  // the webs: sheets across the roof and the corners (one instanced draw)
  const webs = [];
  for (let i = 0; i < (low ? 8 : 16); i++) {
    const z = LAIR.from + 4 + rand(i + 300) * (len - 8);
    const side = i % 2 ? 1 : -1;
    webs.push([side * (1.6 + rand(i + 310) * 0.8), z, 0.8 + rand(i + 320) * 0.6, side > 0 ? -Math.PI / 2 : Math.PI / 2]);
  }
  const web = new THREE.InstancedMesh(webGeo(2), mats.web, webs.length);
  webs.forEach(([x, z, s, turn], i) => {
    q.setFromAxisAngle(UP, turn);
    m.compose(new THREE.Vector3(x, heightAt(0, z) + 1.2, z), q, new THREE.Vector3(s, s, s));
    web.setMatrixAt(i, m);
  });
  web.name = 'cirith-ungol:webs';
  group.add(web);

  // the Tower above the pass: black tiers and horns, red slits
  const t = [];
  const [tx, tz] = TOWER.at;
  const ty = heightAt(tx, tz) - 2;
  const black = C(0x2a2624);
  [[14, 12], [11, 14], [8, 12], [5.5, 10]].reduce((y, [w, h]) => {
    t.push(part(new THREE.BoxGeometry(w, h, w), black, { at: [tx, y + h / 2, tz], yaw: 0.2 }));
    return y + h;
  }, ty);
  for (const s of [-1, 1]) t.push(part(new THREE.ConeGeometry(1.2, 9, 5), black, { at: [tx + s * 2.2, ty + 52, tz], roll: s * -0.25 }));
  group.add(merged(t, material, 'cirith-ungol:tower'));
  const slitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.27, 0.06).multiplyScalar(1.7) });
  const slits = [];
  for (let i = 0; i < 9; i++) slits.push(part(new THREE.BoxGeometry(0.4, 1.4, 0.2), C(0xffffff), { at: [tx - 3 + (i % 3) * 3, ty + 14 + Math.floor(i / 3) * 11, tz - 7.6 + Math.floor(i / 3) * 1.4] }));
  group.add(merged(slits, slitMat, 'cirith-ungol:slits'));

  // the Watchers either side of the gate out: seated, three-faced, eyes red
  const w = [];
  const eyes = [];
  for (const s of [-1, 1]) {
    const x = s * GATE.x;
    const y = heightAt(x, GATE.z);
    w.push(part(new THREE.BoxGeometry(1.4, 1.2, 1.4), C(0x2e2a28), { at: [x, y + 0.6, GATE.z] }));
    w.push(part(new THREE.BoxGeometry(1.1, 1.6, 1), C(0x2e2a28), { at: [x, y + 2, GATE.z] }));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + (s < 0 ? Math.PI / 2 : -Math.PI / 2);
      w.push(part(new THREE.SphereGeometry(0.32, 6, 5), C(0x2e2a28), { at: [x + Math.sin(a) * 0.3, y + 3.1, GATE.z + Math.cos(a) * 0.3] }));
      eyes.push(part(new THREE.SphereGeometry(0.07, 5, 4), C(0xffffff), { at: [x + Math.sin(a) * 0.58, y + 3.15, GATE.z + Math.cos(a) * 0.58] }));
    }
  }
  group.add(merged(w, material, 'cirith-ungol:watchers'));
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.2, 0.08).multiplyScalar(2.4) });
  group.add(merged(eyes, eyeMat, 'cirith-ungol:eyes'));

  mergeStatics(group, { keep: [stepMesh, walls, web, lair] });

  return {
    group,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
      material.dispose();
      lair.material.dispose();
      slitMat.dispose();
      eyeMat.dispose();
    },
  };
}
