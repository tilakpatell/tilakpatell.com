// The Shire’s edge’s landmarks, built in code and flat-shaded on the house’s
// look: the fences of Maggot’s crop with the gap two hobbits came through,
// a scarecrow and a spilt basket of mushrooms; the hollow in the Woody End,
// its banks and the great beech whose roots arch over the lane; and
// Bucklebury Ferry: the landing stages either side of the Brandywine, the
// rope across and the lanterns of Buckland on the far bank. Everything
// still is one mesh; the raft its own, so it crosses. In the stage’s frame:
// the lane along +z from 0, +x on the walker’s left.
//
//   buildProps({ material, heightAt, level }) → { group, raft, dispose }
//     level(z): the Brandywine’s water under the lane at z (the raft floats on it)
//   GAP, BEECH, BANK, LANDING, RAFT, FAR: where they stand, for the beats and the scene

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { C, merged, part } from '../parts';

export const GAP = [4.2, 24]; // the fence’s gap, where Merry and Pippin came through
export const BEECH = [6.2, 94]; // the great beech on the left bank of the hollow
export const BANK = { z: [84, 104], top: 1.9, x: [2.6, 9] }; // the left bank: z span, height, inner and outer foot
export const LANDING = { z: [124, 137], deck: 0.45 }; // the near stage, its deck over the lane at its start
export const RAFT = { w: 4.4, d: 7, deck: 0.35 }; // the deck over the water
export const FAR = { z: [161, 171] }; // the far stage

const EARTH = C(0x6b5038);
const MOSS = C(0x4f6a2e);
const ROOT = C(0x7a6650);
const BARK = C(0x8a8478);
const LEAF = C(0x557a34);
const WOOD = C(0x7a5434);
const PLANK = C(0x8f6a44);
const DARK = C(0x3e2c1e);
const STRAW = C(0xc9a75a);
const CLOTH = C(0x6a4a3a);
const CAP = C(0xd8c8a8);

function fenceParts(heightAt, parts) {
  // posts and two rails each side of the lane through the crop; the gap on the left
  for (const side of [1, -1])
    for (let z = -6; z < 56; z += 3) {
      const x = side * GAP[0];
      const gap = side > 0 && z + 3 > GAP[1] - 2 && z < GAP[1] + 2;
      const y = heightAt(x, z);
      parts.push(part(new THREE.BoxGeometry(0.12, 1.2, 0.12), WOOD, { at: [x, y + 0.6, z] }));
      if (gap) {
        // (the rail they broke, hanging off its post)
        parts.push(part(new THREE.BoxGeometry(0.08, 0.1, 2.2), WOOD, { at: [x + 0.3, y + 0.5, z + 0.9], pitch: 0.35, yaw: 0.4 }));
        continue;
      }
      for (const h of [0.45, 0.95]) parts.push(part(new THREE.BoxGeometry(0.07, 0.09, 3), WOOD, { at: [x, y + h, z + 1.5] }));
    }
  // the scarecrow over the corn, and the spilt basket at the gap
  const [sx, sz] = [-16, 30];
  const sy = heightAt(sx, sz);
  parts.push(part(new THREE.BoxGeometry(0.12, 2.6, 0.12), WOOD, { at: [sx, sy + 1.3, sz] }));
  parts.push(part(new THREE.BoxGeometry(1.8, 0.1, 0.1), WOOD, { at: [sx, sy + 2, sz] }));
  parts.push(part(new THREE.ConeGeometry(0.45, 1.1, 6), CLOTH, { at: [sx, sy + 1.6, sz] }));
  parts.push(part(new THREE.SphereGeometry(0.24, 6, 4), STRAW, { at: [sx, sy + 2.4, sz] }));
  parts.push(part(new THREE.ConeGeometry(0.38, 0.4, 7), STRAW, { at: [sx, sy + 2.7, sz] }));
  const [bx, bz] = [1.8, GAP[1] + 1.5];
  const by = heightAt(bx, bz);
  parts.push(part(new THREE.CylinderGeometry(0.28, 0.2, 0.26, 8, 1, true), STRAW, { at: [bx, by + 0.14, bz], roll: 1.3 }));
  for (let i = 0; i < 7; i++) {
    const a = i * 2.1;
    const r = 0.3 + (i % 3) * 0.22;
    const at = [bx - 0.2 - Math.cos(a) * r, by, bz + Math.sin(a) * r];
    parts.push(part(new THREE.CylinderGeometry(0.03, 0.04, 0.09, 5), CAP, { at: [at[0], at[1] + 0.045, at[2]] }));
    parts.push(part(new THREE.SphereGeometry(0.08, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), C(0xb08a5a), { at: [at[0], at[1] + 0.09, at[2]] }));
  }
}

function hollowParts(heightAt, parts) {
  // the banks: the left high, its face toward the lane; the right lower
  const [z0, z1] = BANK.z;
  const ridge = (inner, outer, top, side) => {
    const shape = new THREE.Shape();
    shape.moveTo(side * inner, 0);
    shape.lineTo(side * (inner + 0.9), top);
    shape.lineTo(side * (outer - 1.2), top);
    shape.lineTo(side * outer, 0);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false });
  };
  const yAt = (x) => Math.min(heightAt(x, z0 + 4), heightAt(x, (z0 + z1) / 2), heightAt(x, z1 - 4)) - 0.15;
  parts.push(part(ridge(BANK.x[0], BANK.x[1], BANK.top, 1), EARTH, { at: [0, yAt(BANK.x[0]), z0] }));
  parts.push(part(new THREE.BoxGeometry(BANK.x[1] - BANK.x[0] - 2, 0.18, z1 - z0), MOSS, { at: [(BANK.x[0] + BANK.x[1]) / 2 + 0.1, yAt(BANK.x[0]) + BANK.top + 0.05, (z0 + z1) / 2] }));
  parts.push(part(ridge(2.4, 6.5, 1.1, -1), EARTH, { at: [0, yAt(-2.4), z0 + 3], scale: [1, 1, 0.75] }));
  // the beech: a pale trunk, a high crown, and its roots in arches over the lane
  const [tx, tz] = BEECH;
  const ty = yAt(BANK.x[0]) + BANK.top;
  parts.push(part(new THREE.CylinderGeometry(0.75, 1.25, 10, 9), BARK, { at: [tx, ty + 5, tz] }));
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const r = i % 3 === 0 ? 1.5 : 4.5;
    parts.push(part(new THREE.IcosahedronGeometry(3 + (i % 3) * 0.6, 0), LEAF.clone().offsetHSL(0, 0, (i % 4) * 0.02 - 0.03), { at: [tx + Math.cos(a) * r, ty + 11 + (i % 3) * 1.2, tz + Math.sin(a) * r] }));
  }
  const lane = heightAt(0, tz);
  for (let i = 0; i < 7; i++) {
    const dz = (i - 3) * 1.4 + Math.sin(i * 2.3) * 0.4;
    const reach = i % 2 ? -1.3 : -0.4; // (alternate ones over the whole lane, to the far side)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(tx - 0.6, ty + 0.6, tz + dz * 0.4),
      new THREE.Vector3(BANK.x[0] + 0.6, ty + 0.2, tz + dz),
      new THREE.Vector3(1.2, lane + 2 + (i % 3) * 0.2, tz + dz * 1.1),
      new THREE.Vector3(reach, lane + 1.5, tz + dz * 1.15),
      new THREE.Vector3(reach - 0.5, lane - 0.2, tz + dz * 1.2),
    ]);
    parts.push(part(new THREE.TubeGeometry(curve, 14, 0.07 + (i % 3) * 0.025, 5), ROOT, {}));
  }
}

function ferryParts(heightAt, level, parts) {
  // the landing stages: planks on posts out from either bank, their decks level with the lane where they start
  const stage = ([z0, z1], from) => {
    const y = heightAt(0, from) + LANDING.deck;
    parts.push(part(new THREE.BoxGeometry(4.6, 0.16, z1 - z0), PLANK, { at: [0, y - 0.08, (z0 + z1) / 2] }));
    for (let z = z0 + 0.6; z < z1; z += 2.4)
      for (const x of [-2.1, 2.1]) {
        const foot = Math.min(heightAt(x, z), level(z) - 1.2);
        parts.push(part(new THREE.CylinderGeometry(0.13, 0.15, y - foot, 6), DARK, { at: [x, (y + foot) / 2, z] }));
      }
    return y;
  };
  const near = stage(LANDING.z, LANDING.z[0]);
  const far = stage(FAR.z, FAR.z[1]);
  // the rope across, from post to post, a little over the raft’s rail
  const rope = new THREE.CatmullRomCurve3([new THREE.Vector3(2.7, near + 1.4, LANDING.z[0] + 2), new THREE.Vector3(2.7, level(150) + 1.5, 150), new THREE.Vector3(2.7, far + 1.4, FAR.z[1] - 2)]);
  parts.push(part(new THREE.TubeGeometry(rope, 24, 0.03, 4), DARK, {}));
  for (const [z, y] of [[LANDING.z[0] + 2, near], [FAR.z[1] - 2, far]]) parts.push(part(new THREE.CylinderGeometry(0.12, 0.14, 1.8, 6), WOOD, { at: [2.7, y + 0.6, z] }));
  // (the posts of Buckland’s two lanterns at the far stage’s end)
  for (const x of [-2.1, 2.1]) parts.push(part(new THREE.CylinderGeometry(0.07, 0.08, 1.6, 5), DARK, { at: [x, far + 0.8, FAR.z[1] - 0.8] }));
  return { near, far };
}

function raftMesh(material) {
  const parts = [];
  // logs side by side, two cross-beams, a rail each side, a post for the lantern
  for (let i = 0; i < 9; i++) parts.push(part(new THREE.CylinderGeometry(0.24, 0.24, RAFT.d, 6), PLANK.clone().offsetHSL(0, 0, (i % 3) * 0.02), { at: [-RAFT.w / 2 + 0.25 + i * 0.49, -0.12, 0], pitch: Math.PI / 2 }));
  for (const z of [-RAFT.d / 2 + 0.6, RAFT.d / 2 - 0.6]) parts.push(part(new THREE.BoxGeometry(RAFT.w, 0.1, 0.25), DARK, { at: [0, 0.1, z] }));
  for (const x of [-RAFT.w / 2 + 0.1, RAFT.w / 2 - 0.1]) {
    parts.push(part(new THREE.BoxGeometry(0.08, 0.08, RAFT.d - 0.4), WOOD, { at: [x, 0.95, 0] }));
    for (const z of [-2.6, 0, 2.6]) parts.push(part(new THREE.BoxGeometry(0.08, 0.95, 0.08), WOOD, { at: [x, 0.5, z] }));
  }
  parts.push(part(new THREE.BoxGeometry(0.1, 1.9, 0.1), WOOD, { at: [RAFT.w / 2 - 0.3, 0.95, RAFT.d / 2 - 0.4] }));
  return merged(parts, material, 'shire-edge:raft');
}

export function buildProps({ material, heightAt, level }) {
  const group = new THREE.Group();
  group.name = 'shire-edge:props';
  const parts = [];
  fenceParts(heightAt, parts);
  hollowParts(heightAt, parts);
  const decks = ferryParts(heightAt, level, parts);
  const statics = merged(parts, material, 'shire-edge:statics');
  group.add(statics);

  // the lanterns: the raft’s, and two at the far stage, Buckland’s light across the water
  const lampMat = new MeshBasicNodeMaterial({ color: new THREE.Color(1.7, 1.15, 0.5) });
  const lampGeo = new THREE.SphereGeometry(0.14, 6, 4);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 2);
  const mx = new THREE.Matrix4();
  [-2.1, 2.1].forEach((x, i) => lamps.setMatrixAt(i, mx.makeTranslation(x, decks.far + 1.7, FAR.z[1] - 0.8)));
  lamps.name = 'shire-edge:lamps';
  group.add(lamps);

  const raft = new THREE.Group();
  raft.name = 'shire-edge:raft';
  raft.add(raftMesh(material));
  const raftLamp = new THREE.Mesh(lampGeo, lampMat);
  raftLamp.position.set(RAFT.w / 2 - 0.3, 1.95, RAFT.d / 2 - 0.4);
  raft.add(raftLamp);
  group.add(raft);

  return {
    group,
    raft,
    decks,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
      lampMat.dispose();
    },
  };
}
