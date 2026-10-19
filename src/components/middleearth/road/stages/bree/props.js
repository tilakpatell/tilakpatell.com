// Bree’s landmarks, built in code and flat-shaded on the house’s look: the
// West-gate in its hedge with the gatekeeper’s hatch, a lane of tall crooked
// houses with their upper storeys out over it, the Prancing Pony with its
// common room behind a lit window, its sign, and the back way out through
// the hedge. Everything still is one mesh; the lit windows one instanced
// draw, unlit so the rain’s dark never dims them. In the stage’s frame:
// the lane along +z from 0, +x on the walker’s left.
//
//   buildProps({ material, heightAt }) → { group, dispose }
//   GATE, PONY, ROOM, BACK: where they stand, for the beats and the scene

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { C, merged, part } from '../parts';

export const GATE = { z: 14, half: 3.2 }; // the West-gate across the lane, its opening either side of the middle
export const PONY = { x: -7, z0: 84, z1: 102, window: [-7, 1.7, 94] }; // the inn’s front on the right of the lane, its common-room window
export const ROOM = { x: [-15, -7.3], z: [86, 100] }; // the common room inside it
export const WING = { x: 7, z: 98, window: [7, 1.4, 100] }; // the hobbits’ room across the lane: its window is where the Riders strike
export const BACK = { z: 146 }; // the back way out, through the hedge

const TIMBER = C(0x3a2a1e);
const PLASTER = C(0xb8a888);
const STONE = C(0x6e665c);
const ROOF = C(0x4a3a30);
const THATCH = C(0x7a6440);
const HEDGE = C(0x2f4a26);
const WOOD = C(0x5e4430);
const FLOOR = C(0x4a3626);

// a house: a stone ground floor, a jettied plaster upper floor or two in a timber frame, a steep roof, a chimney
function houseParts(heightAt, { x, z, w, d, storeys, lean = 0, roof = ROOF, face }, parts, windows) {
  const y = Math.min(heightAt(x - w / 2, z), heightAt(x + w / 2, z), heightAt(x, z - d / 2), heightAt(x, z + d / 2)) - 0.2;
  parts.push(part(new THREE.BoxGeometry(w, 3, d), STONE, { at: [x, y + 1.5, z] }));
  let top = y + 3;
  for (let s = 1; s < storeys; s++) {
    const out = s * 0.5;
    parts.push(part(new THREE.BoxGeometry(w + out, 2.6, d + 0.3), PLASTER, { at: [x + face * out * 0.5, top + 1.3, z], roll: lean * s }));
    // the frame’s beams across the face
    for (const dy of [0.1, 1.3, 2.5]) parts.push(part(new THREE.BoxGeometry(0.16, 0.16, d + 0.34), TIMBER, { at: [x + face * ((w + out) / 2 + out * 0.5), top + dy, z], roll: lean * s }));
    for (let k = -1; k <= 1; k++) parts.push(part(new THREE.BoxGeometry(0.16, 2.6, 0.16), TIMBER, { at: [x + face * ((w + out) / 2 + out * 0.5), top + 1.3, z + (k * d) / 3] }));
    windows.push([x + face * ((w + out) / 2 + out * 0.5 + 0.02), top + 1.4, z - d / 6, face]);
    if (storeys > 2 || s === 1) windows.push([x + face * ((w + out) / 2 + out * 0.5 + 0.02), top + 1.4, z + d / 6, face]);
    top += 2.6;
  }
  // the roof: a prism along the lane, leaning with the house
  const r = new THREE.CylinderGeometry(w * 0.72, w * 0.72, d + 0.8, 3, 1);
  parts.push(part(r, roof, { at: [x, top + w * 0.36, z], pitch: Math.PI / 2, roll: Math.PI / 2 + lean * storeys, scale: [1, 1, 0.75] }));
  parts.push(part(new THREE.BoxGeometry(0.7, 2.2, 0.7), STONE, { at: [x - face * w * 0.25, top + w * 0.5 + 0.6, z + d * 0.3] }));
  windows.push([x + face * (w / 2 + 0.02), y + 1.5, z, face]);
  return top;
}

function gateParts(heightAt, parts, windows) {
  // the hedge either side, dense and tall, and the two great posts
  for (const side of [1, -1]) {
    for (let x = GATE.half + 1; x < 70; x += 2.6) parts.push(part(new THREE.IcosahedronGeometry(1.6, 1), HEDGE.clone().offsetHSL(0, 0, ((x * 0.37) % 1) * 0.04), { at: [side * x, heightAt(side * x, GATE.z) + 1.6, GATE.z], scale: [1.1, 1.4, 0.9] }));
    const px = side * (GATE.half + 0.4);
    parts.push(part(new THREE.BoxGeometry(0.7, 5.2, 0.7), WOOD, { at: [px, heightAt(px, GATE.z) + 2.6, GATE.z] }));
    // the gates, swung back against the hedge
    parts.push(part(new THREE.BoxGeometry(0.2, 3.8, GATE.half), WOOD, { at: [side * (GATE.half + 0.3), heightAt(px, GATE.z) + 1.9, GATE.z + GATE.half / 2 + 0.3] }));
  }
  parts.push(part(new THREE.BoxGeometry(GATE.half * 2 + 1.5, 0.5, 0.6), WOOD, { at: [0, heightAt(0, GATE.z) + 5, GATE.z] }));
  // the gatekeeper’s lodge on the left inside the gate, its hatch toward the lane
  const lx = GATE.half + 3;
  houseParts(heightAt, { x: lx, z: GATE.z + 4, w: 3, d: 3.4, storeys: 1, face: -1, roof: THATCH }, parts, windows);
}

function ponyParts(heightAt, parts, windows) {
  const y = heightAt(PONY.x, (PONY.z0 + PONY.z1) / 2) - 0.2;
  const [wz0, wz1] = [PONY.window[2] - 1.2, PONY.window[2] + 1.2];
  // the front wall to the lane, left open where the window is (sill to lintel)
  const front = (z0, z1, y0, y1) => parts.push(part(new THREE.BoxGeometry(0.4, y1 - y0, z1 - z0), STONE, { at: [PONY.x, y + (y0 + y1) / 2, (z0 + z1) / 2] }));
  front(PONY.z0, wz0, 0, 3.2);
  front(wz1, PONY.z1, 0, 3.2);
  front(wz0, wz1, 0, 0.9);
  front(wz0, wz1, 2.5, 3.2);
  parts.push(part(new THREE.BoxGeometry(0.22, 0.12, 2.6), TIMBER, { at: [PONY.x + 0.15, y + 0.9, PONY.window[2]] }));
  for (const dz of [-0.6, 0, 0.6]) parts.push(part(new THREE.BoxGeometry(0.06, 1.6, 0.06), TIMBER, { at: [PONY.x + 0.1, y + 1.7, PONY.window[2] + dz] }));
  // the room inside: floor, back wall, ends, the bar along the back, a bench and table in the corner
  const [rx0, rx1] = ROOM.x;
  parts.push(part(new THREE.BoxGeometry(rx1 - rx0, 0.1, ROOM.z[1] - ROOM.z[0]), FLOOR, { at: [(rx0 + rx1) / 2, y + 0.05, (ROOM.z[0] + ROOM.z[1]) / 2] }));
  parts.push(part(new THREE.BoxGeometry(0.4, 3.2, ROOM.z[1] - ROOM.z[0]), PLASTER, { at: [rx0, y + 1.6, (ROOM.z[0] + ROOM.z[1]) / 2] }));
  for (const z of ROOM.z) parts.push(part(new THREE.BoxGeometry(rx1 - rx0, 3.2, 0.4), PLASTER, { at: [(rx0 + rx1) / 2, y + 1.6, z] }));
  parts.push(part(new THREE.BoxGeometry(rx1 - rx0, 0.3, ROOM.z[1] - ROOM.z[0]), TIMBER, { at: [(rx0 + rx1) / 2, y + 3.1, (ROOM.z[0] + ROOM.z[1]) / 2] }));
  parts.push(part(new THREE.BoxGeometry(1, 1.1, 6), WOOD, { at: [rx0 + 2.4, y + 0.55, PONY.window[2]] }));
  for (let i = 0; i < 4; i++) parts.push(part(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 8), WOOD, { at: [rx0 + 0.7, y + 0.35 + (i % 2) * 0.72, PONY.window[2] - 2 + i], pitch: Math.PI / 2 }));
  parts.push(part(new THREE.BoxGeometry(1.4, 0.08, 1.4), WOOD, { at: [rx1 - 2, y + 0.75, ROOM.z[1] - 2.2] }));
  parts.push(part(new THREE.BoxGeometry(1.6, 0.45, 0.45), WOOD, { at: [rx1 - 2, y + 0.22, ROOM.z[1] - 1.1] }));
  // the inn above: two jettied storeys, a big roof, and its sign on a bracket over the lane
  const top = houseParts(heightAt, { x: PONY.x - 4, z: (PONY.z0 + PONY.z1) / 2, w: 8, d: PONY.z1 - PONY.z0, storeys: 3, face: 1, lean: 0.01 }, parts, windows);
  parts.push(part(new THREE.BoxGeometry(2.4, 0.1, 0.1), TIMBER, { at: [PONY.x + 1.2, y + 4.2, PONY.z0 + 2] }));
  parts.push(part(new THREE.BoxGeometry(0.08, 1.2, 1.5), C(0xd8c8a0), { at: [PONY.x + 2, y + 3.5, PONY.z0 + 2] }));
  return top;
}

function hedgeBack(heightAt, parts) {
  // the hedge again at the back of the town, a gap in it for the way out
  for (const side of [1, -1]) for (let x = 2.4; x < 70; x += 2.6) parts.push(part(new THREE.IcosahedronGeometry(1.5, 1), HEDGE, { at: [side * x, heightAt(side * x, BACK.z) + 1.4, BACK.z], scale: [1.1, 1.3, 0.9] }));
}

// the lane’s houses, either side, each a little crooked: [x, z, w, d, storeys, lean]
const HOUSES = [
  [8, 30, 6, 7, 3, -0.02],
  [-8, 34, 6, 8, 2, 0.015],
  [8.5, 44, 6, 6, 2, 0.02],
  [-8, 48, 6, 7, 3, -0.015],
  [8, 58, 6, 8, 3, 0.012],
  [-8.5, 62, 6, 7, 2, -0.02],
  [8, 72, 7, 8, 2, -0.01],
  [-8, 74, 6, 7, 3, 0.02],
  [8.5, 86, 6, 7, 3, 0.015],
  [8, 112, 6, 8, 2, -0.02],
  [-8, 112, 6, 8, 3, 0.012],
  [8.5, 124, 6, 6, 2, 0.02],
  [-8, 126, 6, 7, 2, -0.015],
];

export function buildProps({ material, heightAt }) {
  const group = new THREE.Group();
  group.name = 'bree:props';
  const parts = [];
  const windows = [];
  gateParts(heightAt, parts, windows);
  for (const [x, z, w, d, storeys, lean] of HOUSES) houseParts(heightAt, { x: x + Math.sign(x) * (w / 2 - 3), z, w, d, storeys, lean, face: -Math.sign(x) }, parts, windows);
  ponyParts(heightAt, parts, windows);
  // the hobbits’ room across the lane from the Pony: its own low wing, a window to the lane
  houseParts(heightAt, { x: WING.x + 2, z: WING.z, w: 4, d: 6, storeys: 1, face: -1, roof: THATCH }, parts, windows);
  hedgeBack(heightAt, parts);
  // cobbles down the middle of the lane: a long strip a little darker than the road
  for (let z = GATE.z; z < BACK.z; z += 8) parts.push(part(new THREE.BoxGeometry(3.6, 0.04, 8), C(0x4a4640).offsetHSL(0, 0, ((z * 0.13) % 1) * 0.03), { at: [0, heightAt(0, z + 4) + 0.03, z + 4] }));
  group.add(merged(parts, material, 'bree:statics'));

  // the windows, lit from within: one draw, unlit
  const glow = new MeshBasicNodeMaterial({ color: new THREE.Color(1.5, 0.95, 0.42) });
  const pane = new THREE.PlaneGeometry(0.9, 1.1);
  const lit = new THREE.InstancedMesh(pane, glow, windows.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  windows.forEach(([x, y, z, face], i) => {
    q.setFromAxisAngle(up, (face * Math.PI) / 2);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    lit.setMatrixAt(i, m);
  });
  lit.name = 'bree:windows';
  group.add(lit);

  return {
    group,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
      glow.dispose();
    },
  };
}
