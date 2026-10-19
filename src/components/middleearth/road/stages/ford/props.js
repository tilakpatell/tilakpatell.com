// The Ford’s landmarks, built in code and flat-shaded on the house’s look:
// the trolls’ clearing with the cold fire-pit and the cave’s mouth behind
// them, the Last Bridge’s three stone arches over the Hoarwell, and the
// Ford: its stones across the Bruinen and the dark of Rivendell’s pines on
// the far bank. Everything still is one mesh. In the stage’s frame: the
// road along +z from 0, +x on the walker’s left.
//
//   buildProps({ material, heightAt }) → { group, deck, dispose }
//   TROLLS, BRIDGE, FORD: where they stand, for the beats and the scene

import * as THREE from 'three';
import { C, merged, part } from '../parts';

export const TROLLS = [[7.5, 36, -2.4], [10.5, 40, -1.6], [6.8, 43, -2.9]]; // x, z, facing: the three over their cold fire
export const BRIDGE = { z: [41, 63], w: 4.6 }; // the Last Bridge: its deck’s span along the road, its width
export const FORD = { z: 168, stones: 9 }; // the Bruinen’s middle at the road, and the stones across it

const STONE = C(0x8c8880);
const DARK = C(0x45403a);
const ASH = C(0x5a5650);
const MOSS = C(0x5f6e46);

function clearingParts(heightAt, parts) {
  // the fire-pit the trolls bent over, long cold, and a spit across it
  const [fx, fz] = [9, 40];
  const y = heightAt(fx, fz);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.push(part(new THREE.DodecahedronGeometry(0.35, 0), STONE, { at: [fx + Math.cos(a) * 1.4, y + 0.1, fz + Math.sin(a) * 1.4] }));
  }
  parts.push(part(new THREE.CylinderGeometry(1.1, 1.2, 0.1, 10), ASH, { at: [fx, y + 0.02, fz] }));
  for (const dx of [-1.6, 1.6]) parts.push(part(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 5), DARK, { at: [fx + dx, y + 0.9, fz] }));
  parts.push(part(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 5), DARK, { at: [fx, y + 1.75, fz], roll: Math.PI / 2 }));
  // the cave’s mouth in the bank behind them, its stone door ajar
  const [cx, cz] = [17, 44];
  const cy = heightAt(cx, cz);
  parts.push(part(new THREE.DodecahedronGeometry(4.5, 0), MOSS, { at: [cx + 2, cy + 1, cz], scale: [1, 0.8, 1.4] }));
  parts.push(part(new THREE.BoxGeometry(0.4, 2.6, 2.2), DARK, { at: [cx - 2.2, cy + 1.2, cz] }));
  parts.push(part(new THREE.BoxGeometry(0.5, 2.8, 1.4), STONE, { at: [cx - 2.6, cy + 1.3, cz - 1.8], yaw: 0.6 }));
}

function bridgeParts(heightAt, parts) {
  const [z0, z1] = BRIDGE.z;
  const deck = Math.max(heightAt(0, z0), heightAt(0, z1)) + 0.25;
  const len = z1 - z0;
  parts.push(part(new THREE.BoxGeometry(BRIDGE.w, 0.5, len), STONE, { at: [0, deck - 0.25, (z0 + z1) / 2] }));
  // the parapets, low, and their coping
  for (const x of [-BRIDGE.w / 2 + 0.2, BRIDGE.w / 2 - 0.2]) {
    parts.push(part(new THREE.BoxGeometry(0.4, 0.7, len), STONE, { at: [x, deck + 0.35, (z0 + z1) / 2] }));
    parts.push(part(new THREE.BoxGeometry(0.5, 0.1, len), DARK, { at: [x, deck + 0.75, (z0 + z1) / 2] }));
  }
  // three arches: piers down to the bed, each span’s underside an arch
  const span = len / 3;
  for (let k = 0; k <= 3; k++) {
    const z = z0 + k * span;
    const foot = heightAt(0, z) - 2;
    parts.push(part(new THREE.BoxGeometry(BRIDGE.w, deck - foot, 1.4), STONE, { at: [0, (deck + foot) / 2 - 0.4, z] }));
  }
  for (let k = 0; k < 3; k++) {
    const z = z0 + (k + 0.5) * span;
    const arch = new THREE.CylinderGeometry(span / 2, span / 2, BRIDGE.w, 12, 1, true, 0, Math.PI);
    parts.push(part(arch, STONE, { at: [0, deck - 0.5, z], yaw: Math.PI / 2, roll: Math.PI / 2, pitch: 0, scale: [1, 1, 0.55] }));
  }
  return deck;
}

function fordParts(heightAt, parts) {
  // the stones of the Ford, a broken line across the shallows beside the road
  for (let i = 0; i < FORD.stones; i++) {
    const z = FORD.z - 8 + i * 2;
    const x = 2.6 + Math.sin(i * 1.7) * 0.5;
    parts.push(part(new THREE.DodecahedronGeometry(0.5 + (i % 3) * 0.15, 0), STONE, { at: [x, heightAt(x, z) + 0.2, z], yaw: i, scale: [1.2, 0.7, 1] }));
  }
}

export function buildProps({ material, heightAt }) {
  const group = new THREE.Group();
  group.name = 'ford:props';
  const parts = [];
  clearingParts(heightAt, parts);
  const deck = bridgeParts(heightAt, parts);
  fordParts(heightAt, parts);
  group.add(merged(parts, material, 'ford:statics'));
  return {
    group,
    deck,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
    },
  };
}
