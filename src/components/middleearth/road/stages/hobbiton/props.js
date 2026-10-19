// Hobbiton’s landmarks, built in code and flat-shaded on the house’s look:
// the Hill with six round doors in its west face (Bag End’s the Sketchfab
// door), the Party Tree with its lanterns and the long tables under it, the
// mill on the Water with its wheel, hedges along the lane, and Gandalf’s
// cart. Everything that stands still is one mesh (its colours in its
// vertices), the lanterns one instanced draw, the wheel its own so it turns.
// In the stage’s frame: the lane along +z from 0, +x on the walker’s left.
//
//   buildProps({ material, heightAt, rt }) → { group, update(dt), dispose }
//   buildCart(material) → THREE.Group (the bed, the wheels, the crates of fireworks)
//   HILL, DOORS, TREE, MILL: where they stand, for the beats and the scene

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// the Hill: a turf dome on terrain.js’s rise, the doors round its foot
export const HILL = { at: [34, 6], r: 18, squash: 0.6 };
export const TREE = [30, 128]; // the Party Tree
export const MILL = [-26, 118]; // the mill on the Water’s near bank
// the doors round the Hill’s west face, Bag End’s the one facing the lane
export const DOORS = [
  { a: 150, colour: 0xc9a227 },
  { a: 163, colour: 0xa8322d },
  { a: 180, colour: 0x2f6b3a, bagEnd: true },
  { a: 194, colour: 0x2d4f8a },
  { a: 207, colour: 0x7a3f8f },
  { a: 220, colour: 0xc9a227 },
].map((d) => {
  const r = (d.a * Math.PI) / 180;
  // (at the dome’s foot, where its face rises steepest: a door set into the Hill)
  const at = HILL.r + 0.08;
  return { ...d, x: HILL.at[0] + Math.cos(r) * at, z: HILL.at[1] + Math.sin(r) * at, yaw: Math.atan2(Math.cos(r), Math.sin(r)) };
});

const C = (hex) => new THREE.Color(hex);
const STONE = C(0x9a8f80);
const WOOD = C(0x7a5434);
const DARK = C(0x4a3424);
const LEAF = C(0x3f7a2e);
const HEDGE = C(0x3d6b2a);
const CLOTH = C(0xe8dfc8);
const THATCH = C(0xb08a4a);

// a geometry in one colour, moved into place
function part(geometry, colour, { at = [0, 0, 0], yaw = 0, pitch = 0, roll = 0, scale = [1, 1, 1] } = {}) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colour.toArray(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), new THREE.Vector3(...scale));
  return g.applyMatrix4(m);
}

function doorParts(d, y, parts) {
  const out = (k) => [d.x + Math.sin(d.yaw) * k, y, d.z + Math.cos(d.yaw) * k];
  // the round stone frame, the door in it, the knob, a round window beside
  parts.push(part(new THREE.TorusGeometry(0.95, 0.16, 6, 18), STONE, { at: out(0.05), yaw: d.yaw }));
  if (!d.bagEnd) parts.push(part(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 18), C(d.colour), { at: out(0), yaw: d.yaw, pitch: Math.PI / 2 }));
  if (!d.bagEnd) parts.push(part(new THREE.SphereGeometry(0.07, 6, 4), C(0xd4b04a), { at: out(0.1), yaw: d.yaw }));
  const side = [Math.cos(d.yaw) * 1.7, 0.25, -Math.sin(d.yaw) * 1.7];
  const w = out(0.02);
  parts.push(part(new THREE.TorusGeometry(0.42, 0.09, 5, 14), WOOD, { at: [w[0] + side[0], w[1] + side[1], w[2] + side[2]], yaw: d.yaw }));
  parts.push(part(new THREE.CircleGeometry(0.36, 14), C(0xf2d88a), { at: [w[0] + side[0], w[1] + side[1], w[2] + side[2]], yaw: d.yaw }));
  // a short path of flat stones down from the step, and a gate in a low fence
  for (let k = 1; k <= 4; k++) {
    const p = out(0.6 + k * 0.9);
    parts.push(part(new THREE.CylinderGeometry(0.35, 0.38, 0.08, 7), STONE, { at: [p[0], y - 0.85 - k * 0.12, p[2]] }));
  }
}

function hillParts(heightAt, parts) {
  const [x, z] = HILL.at;
  // (its foot at the lowest of the ground round it, so no edge floats)
  let low = Infinity;
  for (let a = 0; a < 16; a++) low = Math.min(low, heightAt(x + Math.cos(a / 2.55) * HILL.r, z + Math.sin(a / 2.55) * HILL.r));
  parts.push(part(new THREE.SphereGeometry(HILL.r, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), C(0x5d8f3c), { at: [x, low - 0.3, z], scale: [1, HILL.squash, 1] }));
  // a chimney or two through the turf, and the hedge along its crown
  for (const [dx, dz] of [[-4, 3], [3, -5]]) parts.push(part(new THREE.CylinderGeometry(0.35, 0.4, 2.2, 6), STONE, { at: [x + dx, low + HILL.r * HILL.squash * 0.92, z + dz] }));
  return low;
}

function treeParts(heightAt, parts) {
  const [x, z] = TREE;
  const y = heightAt(x, z);
  parts.push(part(new THREE.CylinderGeometry(0.8, 1.4, 8, 9), WOOD, { at: [x, y + 4, z] }));
  for (const [dx, dz, a] of [[2.5, 0, 0.4], [-2.2, 1, 2.2], [0.5, -2.4, 4]]) parts.push(part(new THREE.CylinderGeometry(0.25, 0.5, 5, 6), WOOD, { at: [x + dx * 0.6, y + 8, z + dz * 0.6], yaw: a, roll: 0.6 }));
  // the crown: a dozen lobes, wide and low as a party tree’s
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 3 === 0 ? 2 : 5.5;
    parts.push(part(new THREE.IcosahedronGeometry(3.4 + (i % 4) * 0.5, 0), LEAF.clone().offsetHSL(0, 0, (i % 5) * 0.015 - 0.03), { at: [x + Math.cos(a) * r, y + 10.5 + (i % 3), z + Math.sin(a) * r] }));
  }
}

function tableParts(heightAt, parts) {
  // three long tables under the tree, cloths on them, benches either side
  for (let t = 0; t < 3; t++) {
    const x = TREE[0] - 12 + t * 5;
    const z = TREE[1] - 4;
    const y = heightAt(x, z);
    parts.push(part(new THREE.BoxGeometry(1.1, 0.08, 7), CLOTH, { at: [x, y + 0.82, z] }));
    for (const dz of [-3.2, 3.2]) for (const dx of [-0.45, 0.45]) parts.push(part(new THREE.BoxGeometry(0.1, 0.8, 0.1), WOOD, { at: [x + dx, y + 0.4, z + dz] }));
    for (const dx of [-0.95, 0.95]) parts.push(part(new THREE.BoxGeometry(0.35, 0.45, 6.8), WOOD, { at: [x + dx, y + 0.22, z] }));
  }
}

function millParts(heightAt, parts) {
  const [x, z] = MILL;
  const y = heightAt(x, z);
  parts.push(part(new THREE.BoxGeometry(5, 4, 6), STONE, { at: [x, y + 1.6, z] }));
  // the thatch: a prism along z
  const roof = new THREE.CylinderGeometry(3.6, 3.6, 6.6, 3, 1);
  parts.push(part(roof, THATCH, { at: [x, y + 4.4, z], pitch: Math.PI / 2, roll: Math.PI / 2, scale: [1, 1, 0.55] }));
  parts.push(part(new THREE.BoxGeometry(0.1, 1.6, 1), DARK, { at: [x + 2.52, y + 0.6, z] }));
}

function hedgeParts(heightAt, parts) {
  // along the lane’s two sides where no field opens off it
  for (const [z0, z1] of [[58, 104], [158, 204]])
    for (const side of [1, -1])
      for (let z = z0; z < z1; z += 3.6) {
        const x = side * 5.2;
        const h = 1 + ((z * 7.3) % 1) * 0.35;
        parts.push(part(new THREE.IcosahedronGeometry(1, 1), HEDGE.clone().offsetHSL(0, 0, ((z * 3.1) % 1) * 0.05 - 0.025), { at: [x, heightAt(x, z) + h * 0.6, z + 1.8], scale: [0.75, h, 2.1] }));
      }
}

export function buildCart(material) {
  const parts = [];
  parts.push(part(new THREE.BoxGeometry(1.4, 0.35, 2.4), WOOD, { at: [0, 0.75, 0] }));
  for (const sx of [-0.72, 0.72]) {
    parts.push(part(new THREE.BoxGeometry(0.06, 0.35, 2.4), DARK, { at: [sx, 1.05, 0] }));
    parts.push(part(new THREE.TorusGeometry(0.5, 0.06, 5, 12), DARK, { at: [sx * 1.1, 0.52, -0.4], yaw: Math.PI / 2 }));
  }
  for (const sx of [-0.35, 0.35]) parts.push(part(new THREE.BoxGeometry(0.06, 0.06, 2), WOOD, { at: [sx, 0.7, 2] }));
  // the fireworks: crates and rockets in the bed
  const fire = [0xb8322a, 0x2d5aa8, 0xd8b030];
  for (let i = 0; i < 6; i++) parts.push(part(new THREE.BoxGeometry(0.42, 0.32, 0.42), C(fire[i % 3]), { at: [(i % 2) * 0.5 - 0.25, 1.1, -0.8 + Math.floor(i / 2) * 0.5], yaw: i * 0.3 }));
  for (let i = 0; i < 5; i++) parts.push(part(new THREE.ConeGeometry(0.06, 0.5, 5), C(fire[i % 3]), { at: [0.3 - i * 0.15, 1.45, 0.6] }));
  const mesh = new THREE.Mesh(mergeGeometries(parts), material);
  mesh.name = 'hobbiton:cart';
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

export function buildProps({ material, heightAt, rt = null }) {
  const group = new THREE.Group();
  group.name = 'hobbiton:props';
  const parts = [];
  const foot = hillParts(heightAt, parts);
  for (const d of DOORS) doorParts(d, Math.max(foot, heightAt(d.x, d.z)) + 0.95, parts);
  treeParts(heightAt, parts);
  tableParts(heightAt, parts);
  millParts(heightAt, parts);
  hedgeParts(heightAt, parts);
  const statics = new THREE.Mesh(mergeGeometries(parts), material);
  statics.name = 'hobbiton:statics';
  group.add(statics);

  // the lanterns: strung in rings round the tree, warm, one draw
  const lanternMat = new MeshBasicNodeMaterial({ color: new THREE.Color(1.6, 1.05, 0.45) });
  const N = 48;
  const lanterns = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), lanternMat, N);
  const m = new THREE.Matrix4();
  for (let i = 0; i < N; i++) {
    const ring = i % 2;
    const a = (i / N) * Math.PI * 4;
    const r = ring ? 9 : 6.5;
    const x = TREE[0] + Math.cos(a) * r;
    const z = TREE[1] + Math.sin(a) * r;
    m.makeTranslation(x, heightAt(x, z) + (ring ? 4.2 : 6.5) - Math.abs(Math.sin(a * 3)) * 0.6, z);
    lanterns.setMatrixAt(i, m);
  }
  lanterns.name = 'hobbiton:lanterns';
  group.add(lanterns);

  // the mill-wheel in the Water, turning
  const wp = [];
  wp.push(part(new THREE.TorusGeometry(2.2, 0.12, 5, 20), WOOD, { yaw: Math.PI / 2 }));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    wp.push(part(new THREE.BoxGeometry(0.5, 0.08, 0.6), DARK, { at: [0, Math.sin(a) * 2.2, Math.cos(a) * 2.2], pitch: -a }));
    wp.push(part(new THREE.BoxGeometry(0.06, 0.06, 2.2), WOOD, { at: [0, Math.sin(a) * 1.1, Math.cos(a) * 1.1], pitch: -a }));
  }
  const wheel = new THREE.Mesh(mergeGeometries(wp), material);
  wheel.name = 'hobbiton:wheel';
  wheel.position.set(MILL[0] - 3, heightAt(MILL[0], MILL[1]) + 0.9, MILL[1]);
  group.add(wheel);

  // Bag End’s own door, the Sketchfab model, in the Hill’s west face
  const bag = DOORS.find((d) => d.bagEnd);
  let door = null;
  Promise.resolve(rt?.assets?.gltf?.('/models/sketchfab/bag-end-door.glb'))
    .then((g) => {
      if (!g?.scene || !group.parent) return;
      door = g.scene.clone(true);
      const box = new THREE.Box3().setFromObject(door);
      const size = box.getSize(new THREE.Vector3());
      // (scaled so its widest side is the frame’s 1.9 m, set on its foot)
      const k = 1.9 / Math.max(size.x, size.y, size.z, 1e-3);
      door.scale.setScalar(k);
      const c = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
      door.position.set(bag.x - c.x, Math.max(foot, heightAt(bag.x, bag.z)) + 0.95 - c.y, bag.z - c.z);
      door.rotation.y = bag.yaw;
      door.name = 'hobbiton:bag-end';
      group.add(door);
    })
    .catch(() => {});

  return {
    group,
    update(dt) {
      wheel.rotation.x -= dt * 0.9;
    },
    dispose() {
      group.removeFromParent();
      statics.geometry.dispose();
      wheel.geometry.dispose();
      lanterns.geometry.dispose();
      lanternMat.dispose();
    },
  };
}
