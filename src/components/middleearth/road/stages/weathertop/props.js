// Weathertop’s landmarks, built in code and flat-shaded on the house’s
// look: the broken ring of Amon Sûl’s wall on the hill’s crown (the road
// goes in at one gap and out at another), its fallen stones, the dell under
// the summit with Sam’s fire-ring, his pans and the packs. Everything still
// is one mesh. In the stage’s frame: the road along +z from 0, +x on the
// walker’s left.
//
//   buildProps({ material, heightAt }) → { group, dispose }
//   RING, FIRE: where they stand, for the beats and the scene

import * as THREE from 'three';
import { C, merged, part } from '../parts';

export const RING = { at: [0, 122], r: 13 }; // Amon Sûl’s wall on the crown
export const FIRE = [1.8, 68.5]; // Sam’s fire in the dell, beside the road

const STONE = C(0x8a8478);
const MOSS = C(0x5e6a48);
const DARK = C(0x3a342c);
const IRON = C(0x2a2a2e);
const PACK = C(0x6a5a3a);

function ringParts(heightAt, parts) {
  const [cx, cz] = RING.at;
  // the wall in broken lengths round the crown, with gaps where the road goes through
  for (let a = 0; a < 360; a += 9) {
    const r = (a * Math.PI) / 180;
    const x = cx + Math.sin(r) * RING.r;
    const z = cz + Math.cos(r) * RING.r;
    if (Math.abs(x) < 3.2) continue; // (the road’s gaps, at the ring’s front and back)
    // (the height of each length, broken unevenly: tall on the west, low on the east)
    const h = 0.6 + Math.abs(Math.sin(a * 0.11) * 2.6) + (x < 0 ? 0.8 : 0) - ((a * 37) % 7) * 0.15;
    if (h < 0.4) continue;
    const y = heightAt(x, z);
    parts.push(part(new THREE.BoxGeometry(2.2, h, 1.2), STONE.clone().offsetHSL(0, 0, ((a * 13) % 9) * 0.006), { at: [x, y + h / 2 - 0.2, z], yaw: r }));
    if (h > 1.4) parts.push(part(new THREE.BoxGeometry(2.25, 0.12, 1.25), MOSS, { at: [x, y + h - 0.2, z], yaw: r }));
  }
  // fallen stones, inside and out
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4;
    const r = RING.r + (i % 2 ? -3 : 3) * (0.5 + (i % 3) * 0.4);
    const x = cx + Math.sin(a) * r;
    const z = cz + Math.cos(a) * r;
    if (Math.abs(x) < 2.6) continue;
    parts.push(part(new THREE.BoxGeometry(1 + (i % 3) * 0.4, 0.5 + (i % 2) * 0.3, 0.8), STONE, { at: [x, heightAt(x, z) + 0.15, z], yaw: a, roll: (i % 4) * 0.12 }));
  }
}

function dellParts(heightAt, parts) {
  const [fx, fz] = FIRE;
  const y = heightAt(fx, fz);
  // the fire-ring, the pan on its stones, the packs and a bedroll
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(part(new THREE.DodecahedronGeometry(0.18, 0), STONE, { at: [fx + Math.cos(a) * 0.55, y + 0.08, fz + Math.sin(a) * 0.55] }));
  }
  for (let i = 0; i < 4; i++) parts.push(part(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 5), DARK, { at: [fx, y + 0.12, fz], yaw: i * 0.8, roll: Math.PI / 2 }));
  parts.push(part(new THREE.CylinderGeometry(0.22, 0.18, 0.12, 10), IRON, { at: [fx + 0.4, y + 0.3, fz] }));
  for (const [dx, dz] of [[1.6, -0.8], [2.2, 0.7], [-1.4, 1.2]]) parts.push(part(new THREE.BoxGeometry(0.5, 0.6, 0.35), PACK, { at: [fx + dx, heightAt(fx + dx, fz + dz) + 0.3, fz + dz], yaw: dx }));
  parts.push(part(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 8), C(0x7a2e2a), { at: [fx + 2.6, y + 0.16, fz - 1.4], yaw: 0.4, roll: Math.PI / 2 }));
  // the dell’s rim: a few big stones on the slope above
  for (let i = 0; i < 6; i++) {
    const x = fx + 4 + (i % 3) * 2.2;
    const z = fz - 4 + i * 1.6;
    parts.push(part(new THREE.DodecahedronGeometry(0.8 + (i % 2) * 0.4, 0), STONE, { at: [x, heightAt(x, z) + 0.3, z], yaw: i }));
  }
}

export function buildProps({ material, heightAt }) {
  const group = new THREE.Group();
  group.name = 'weathertop:props';
  const parts = [];
  ringParts(heightAt, parts);
  dellParts(heightAt, parts);
  group.add(merged(parts, material, 'weathertop:statics'));
  return {
    group,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
    },
  };
}
