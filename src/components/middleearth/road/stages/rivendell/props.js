// Rivendell’s landmarks, built in code and flat-shaded on the house’s look,
// slender and pale where Bree was crooked and dark: the Last Homely House’s
// pavilions on terraces stepping down into the valley on the right, three
// falls on its far cliff, the bridge over the stream, the Council’s garden
// with its ring of chairs and the Ring on its plinth, the shards of Narsil
// on their table under an arch, Bilbo’s bench, and the arch the nine walk
// out under. Everything still is one mesh; the falls and the Ring their own
// unlit draws. In the stage’s frame: the road along +z from 0, +x on the
// walker’s left.
//
//   buildProps({ material, heightAt }) → { group, ring, deck, dispose }
//   COUNCIL, NARSIL, BENCH, ARCH, BRIDGE, FALLS: where they stand, for the beats and the scene

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { C, merged, part } from '../parts';

export const BRIDGE = { z: [43, 57], w: 3.2 }; // over the stream
export const COUNCIL = { at: [-5.5, 85], r: 3.6, chairs: 10 }; // the ring of chairs, the plinth in its middle
export const NARSIL = [-2.4, 103.5]; // the shards’ table
export const BENCH = [2.6, 119]; // Bilbo’s bench, facing the road
export const ARCH = { z: 145, w: 5 }; // the way out
export const FALLS = [[-150, 70, 46], [-160, 98, 58], [-146, 126, 40]]; // x, z, height of each fall on the valley’s far cliff

const PALE = C(0xd8ccb0);
const STONE = C(0xb8ab92);
const ROOF = C(0xb08a4c);
const WOOD = C(0x8a6a44);
const DARK = C(0x5a4a38);
const STEEL = C(0xc4c8d0);
const CLOTH = C(0x6a3a3a);

// a pavilion: slender columns, a deck, a roof sweeping up at its corners
function pavilion(heightAt, { x, z, w, d, h = 4, yaw = 0, levels = 1 }, parts) {
  const y = heightAt(x, z);
  parts.push(part(new THREE.BoxGeometry(w + 2, 0.5, d + 2), STONE, { at: [x, y - 0.1, z], yaw }));
  let top = y;
  for (let l = 0; l < levels; l++) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (const [dx, dz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2], [0, d / 2]])
      parts.push(part(new THREE.CylinderGeometry(0.16, 0.2, h, 6), PALE, { at: [x + dx * c + dz * s, top + h / 2, z - dx * s + dz * c] }));
    parts.push(part(new THREE.BoxGeometry(w + 0.6, 0.3, d + 0.6), PALE, { at: [x, top + h, z], yaw }));
    top += h + 0.3;
  }
  // the roof: a low pyramid, its eaves wide
  const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.85, 2.2, 4, 1);
  parts.push(part(roof, ROOF, { at: [x, top + 1.1, z], yaw: yaw + Math.PI / 4, scale: [1, 1, d / w] }));
  return top;
}

function valleyParts(heightAt, parts) {
  // the house down the valley’s slope on the right: terraces and pavilions, a tower
  const houses = [
    { x: -24, z: 66, w: 6, d: 5, levels: 1 },
    { x: -34, z: 80, w: 8, d: 6, levels: 2 },
    { x: -30, z: 98, w: 7, d: 7, levels: 1 },
    { x: -46, z: 90, w: 9, d: 7, levels: 2 },
    { x: -42, z: 112, w: 6, d: 6, levels: 1 },
    { x: -58, z: 104, w: 7, d: 9, levels: 2 },
    { x: -20, z: 128, w: 6, d: 6, levels: 1 },
    { x: -62, z: 78, w: 6, d: 6, levels: 3, h: 3.4 },
  ];
  for (const p of houses) pavilion(heightAt, p, parts);
  // the far cliff behind the falls, so they fall from something
  for (const [x, z, h] of FALLS) parts.push(part(new THREE.BoxGeometry(14, h + 12, 22), C(0x7a7266), { at: [x - 6, heightAt(x, z) + (h + 12) / 2 - 4, z] }));
}

function bridgeParts(heightAt, parts) {
  const [z0, z1] = BRIDGE.z;
  const deck = Math.max(heightAt(0, z0), heightAt(0, z1)) + 0.2;
  parts.push(part(new THREE.BoxGeometry(BRIDGE.w, 0.24, z1 - z0), PALE, { at: [0, deck - 0.12, (z0 + z1) / 2] }));
  // one slender arch under it, and a thin rail either side on posts like stems
  const arch = new THREE.TorusGeometry((z1 - z0) / 2, 0.22, 5, 20, Math.PI);
  parts.push(part(arch, PALE, { at: [0, deck - 0.3, (z0 + z1) / 2], yaw: Math.PI / 2, scale: [1, 0.55, 1] }));
  for (const x of [-BRIDGE.w / 2, BRIDGE.w / 2]) {
    parts.push(part(new THREE.CylinderGeometry(0.04, 0.04, z1 - z0, 5), PALE, { at: [x, deck + 0.95, (z0 + z1) / 2], pitch: Math.PI / 2 }));
    for (let z = z0; z <= z1; z += 2) parts.push(part(new THREE.CylinderGeometry(0.035, 0.05, 0.95, 5), PALE, { at: [x, deck + 0.47, z] }));
  }
  return deck;
}

function councilParts(heightAt, parts) {
  const [cx, cz] = COUNCIL.at;
  const y = heightAt(cx, cz);
  parts.push(part(new THREE.CylinderGeometry(COUNCIL.r + 1.4, COUNCIL.r + 1.4, 0.16, 24), STONE, { at: [cx, y + 0.02, cz] }));
  // the plinth in the middle, and the chairs round it facing in
  parts.push(part(new THREE.CylinderGeometry(0.32, 0.4, 0.95, 8), PALE, { at: [cx, y + 0.5, cz] }));
  for (let i = 0; i < COUNCIL.chairs; i++) {
    const a = (i / COUNCIL.chairs) * Math.PI * 2 + 0.3;
    const x = cx + Math.cos(a) * COUNCIL.r;
    const z = cz + Math.sin(a) * COUNCIL.r;
    const face = Math.atan2(cx - x, cz - z);
    parts.push(part(new THREE.BoxGeometry(0.6, 0.08, 0.55), WOOD, { at: [x, y + 0.5, z], yaw: face }));
    parts.push(part(new THREE.BoxGeometry(0.6, 1.1, 0.08), WOOD, { at: [x - Math.sin(face) * 0.27, y + 1, z - Math.cos(face) * 0.27], yaw: face }));
    for (const s of [-0.25, 0.25]) parts.push(part(new THREE.BoxGeometry(0.06, 0.5, 0.06), DARK, { at: [x + Math.cos(face) * s, y + 0.25, z - Math.sin(face) * s], yaw: face }));
  }
  // an arbour over it: four tall stems and a ring of beams
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push(part(new THREE.CylinderGeometry(0.14, 0.18, 5.2, 6), PALE, { at: [cx + Math.cos(a) * (COUNCIL.r + 1.2), y + 2.6, cz + Math.sin(a) * (COUNCIL.r + 1.2)] }));
  }
  parts.push(part(new THREE.TorusGeometry(COUNCIL.r + 1.2, 0.14, 5, 28), PALE, { at: [cx, y + 5.2, cz], pitch: Math.PI / 2 }));
  return y + 0.98;
}

function narsilParts(heightAt, parts) {
  const [x, z] = NARSIL;
  const y = heightAt(x, z);
  parts.push(part(new THREE.BoxGeometry(1.3, 0.8, 2.4), STONE, { at: [x, y + 0.4, z] }));
  parts.push(part(new THREE.BoxGeometry(1.1, 0.04, 2.2), CLOTH, { at: [x, y + 0.82, z] }));
  // the shards: the hilt and blade’s first span, three broken lengths laid as they fell
  parts.push(part(new THREE.BoxGeometry(0.06, 0.04, 0.5), C(0xc8a040), { at: [x, y + 0.86, z - 0.75] }));
  parts.push(part(new THREE.BoxGeometry(0.4, 0.04, 0.06), C(0xc8a040), { at: [x, y + 0.86, z - 0.5] }));
  for (const [dz, len, yaw] of [[-0.15, 0.6, 0], [0.45, 0.42, 0.12], [0.85, 0.3, -0.18]]) parts.push(part(new THREE.BoxGeometry(0.08, 0.025, len), STEEL, { at: [x + yaw * 0.6, y + 0.85, z + dz], yaw }));
  // the arch over the table
  const arch = new THREE.TorusGeometry(1.7, 0.16, 5, 18, Math.PI);
  parts.push(part(arch, PALE, { at: [x, y, z], yaw: Math.PI / 2 }));
}

function benchParts(heightAt, parts) {
  const [x, z] = BENCH;
  const y = heightAt(x, z);
  parts.push(part(new THREE.BoxGeometry(0.5, 0.08, 1.8), WOOD, { at: [x, y + 0.48, z] }));
  parts.push(part(new THREE.BoxGeometry(0.08, 0.6, 1.8), WOOD, { at: [x + 0.25, y + 0.8, z] }));
  for (const dz of [-0.75, 0.75]) parts.push(part(new THREE.BoxGeometry(0.4, 0.46, 0.08), DARK, { at: [x, y + 0.23, z + dz] }));
}

function archParts(heightAt, parts) {
  const y = heightAt(0, ARCH.z);
  for (const x of [-ARCH.w / 2, ARCH.w / 2]) parts.push(part(new THREE.CylinderGeometry(0.28, 0.34, 5, 8), PALE, { at: [x, y + 2.5, ARCH.z] }));
  parts.push(part(new THREE.TorusGeometry(ARCH.w / 2, 0.24, 6, 20, Math.PI), PALE, { at: [0, y + 5, ARCH.z] }));
}

export function buildProps({ material, heightAt }) {
  const group = new THREE.Group();
  group.name = 'rivendell:props';
  const parts = [];
  valleyParts(heightAt, parts);
  const deck = bridgeParts(heightAt, parts);
  const plinth = councilParts(heightAt, parts);
  narsilParts(heightAt, parts);
  benchParts(heightAt, parts);
  archParts(heightAt, parts);
  group.add(merged(parts, material, 'rivendell:statics'));

  // the falls: three pale sheets down the far cliff, unlit, a little see-through
  const fallMat = new MeshBasicNodeMaterial({ color: new THREE.Color(0.86, 0.92, 0.98), transparent: true, opacity: 0.82, depthWrite: false });
  const falls = merged(
    FALLS.map(([x, z, h]) => part(new THREE.PlaneGeometry(4, h, 1, 6), C(0xffffff), { at: [x + 1.2, heightAt(x, z) + h / 2 - 2, z], yaw: Math.PI / 2 })),
    fallMat,
    'rivendell:falls',
  );
  falls.castShadow = false;
  group.add(falls);
  // the Ring on its plinth: gold, unlit, so it catches the eye in any light
  const ringMat = new MeshBasicNodeMaterial({ color: new THREE.Color(1.6, 1.2, 0.45) });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 16), ringMat);
  ring.position.set(COUNCIL.at[0], plinth + 0.03, COUNCIL.at[1]);
  ring.rotation.x = Math.PI / 2;
  ring.name = 'rivendell:ring';
  group.add(ring);

  return {
    group,
    ring,
    deck,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
      fallMat.dispose();
      ringMat.dispose();
    },
  };
}
