// The Shire’s edge’s landmarks, built with the Shire chapter’s own builders
// (shire/build.js, on the Road’s town kit) at the Road’s scale, where a
// hobbit is two thirds of the chapter’s: Maggot’s fences either side of
// the crop with the gap two hobbits came through, his barn across the
// field, a scarecrow, hay, a barrow of pumpkins and the mushrooms spilt in
// the lane; hedges into the Woody End and the old tree on its bank whose
// roots the four hide under; and Bucklebury Ferry: its signpost, the
// landing stages either side of the Brandywine, the rope across, barrels,
// the lanterns of Buckland on the far bank, and the raft, its own so it
// crosses. In the stage’s frame: the lane along +z from 0, +x on the
// walker’s left.
//
//   buildProps({ K, material, heightAt, level, tier }) → { group, raft, decks, hollow, dispose }
//     K: townKit.js’s kit; material: the stage’s vertex-coloured one (the
//     ferry’s timbers); level(z): the Brandywine’s water under the lane at z
//   GAP, TREE, HOLLOW, LANDING, RAFT, FAR: where they stand, for the beats and the scene

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { C, canopy, disposeBuilt, merged, part } from '../parts';
import { barn, barrelParts, cabbageGeo, fencePostGeo, fenceRailGeo, hayBaleParts, lanternParts, mergeAll, mushroomParts, parts, pumpkinGeo, rootTree, scarecrowParts, signpost, wheatGeo, wheelbarrowParts } from '../../../shire/build';
import { hedgeBlock, wheatClump } from '../shireLight';

export const SHIRE = 0.68; // the Road’s hobbit (1.05 m) over the chapter’s (1.55)
export const GAP = [4.2, 24]; // the fence’s gap, where Merry and Pippin came through
export const HOLLOW = [2.5, 94]; // the mouth of the hollow under the old tree’s roots, at the lane’s left edge
export const LANDING = { z: [124, 137], deck: 0.45 }; // the near stage, its deck over the lane at its start
export const RAFT = { w: 4.4, d: 7, deck: 0.35 }; // the deck over the water
export const FAR = { z: [161, 171] }; // the far stage
const FENCE = { x: 4.2, z: [-6, 56], step: 2 }; // the crop’s fences: either side of the lane, a post every two metres
const HEDGES = [[60, 84], [102, 122]]; // z spans of hedge either side, into and out of the wood

const PLANK = C(0x8f6a44);
const DARK = C(0x3e2c1e);
const WOOD = C(0x7a5434);

// a builder’s group stood on the land at (x, z), turned and at the Road’s scale
function stand(g, heightAt, x, z, yaw = 0, s = SHIRE) {
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = yaw;
  g.scale.setScalar(s);
  return g;
}
// a parts function’s pieces built into a group of their own
function bits(fn) {
  const g = new THREE.Group();
  const bk = parts();
  fn(bk);
  bk.build(g);
  return g;
}

// the fences and hedges, instanced: posts, rails in pairs, hedge blocks
function lanes(K, heightAt, tier) {
  const out = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(SHIRE, SHIRE, SHIRE);
  const along = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const posts = [];
  const rails = [];
  for (const side of [1, -1])
    for (let z = FENCE.z[0]; z <= FENCE.z[1]; z += FENCE.step) {
      const x = side * FENCE.x;
      posts.push([x, z]);
      const gap = side > 0 && z + FENCE.step > GAP[1] - 1.5 && z < GAP[1] + 1.5;
      if (z + FENCE.step <= FENCE.z[1] && !gap) rails.push([x, z + FENCE.step / 2]);
    }
  const post = new THREE.InstancedMesh(fencePostGeo(), K.mats.fence, posts.length);
  posts.forEach(([x, z], i) => post.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z), z), q.identity(), s)));
  const railGeo = mergeAll([fenceRailGeo(0.45, 1), fenceRailGeo(0.85, 2)]);
  const rail = new THREE.InstancedMesh(railGeo, K.mats.fence, rails.length + 1);
  rails.forEach(([x, z], i) => rail.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z), z), along, new THREE.Vector3(FENCE.step, SHIRE, SHIRE))));
  // (the rail they broke, hanging off its post into the lane)
  const broke = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, Math.PI / 2 + 0.35, 0.2));
  rail.setMatrixAt(rails.length, m.compose(new THREE.Vector3(GAP[0] - 0.4, heightAt(GAP[0], GAP[1]) - 0.15, GAP[1] - 0.6), broke, new THREE.Vector3(FENCE.step * 0.9, SHIRE, SHIRE)));
  const blocks = [];
  for (const [z0, z1] of HEDGES) for (const side of [1, -1]) for (let z = z0; z < z1; z += 0.95) blocks.push([side * 4.8, z]);
  const hedge = new THREE.InstancedMesh(hedgeBlock(), K.mats.hedge, blocks.length);
  blocks.forEach(([x, z], i) => hedge.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.1, z), along, new THREE.Vector3(1, 0.85 + ((z * 7.1) % 1) * 0.25, 0.9))));
  // the standing crop close to the lane: the chapter’s wheat clumps, thick by the fences
  // (four rows deep by the fence; one on low, where the scatter’s corn stands behind it)
  const rows = tier === 'low' ? 1 : 4;
  const step = tier === 'low' ? 2 : 0.7;
  const clumps = [];
  for (const side of [1, -1]) for (let z = FENCE.z[0]; z < FENCE.z[1]; z += step) for (let k = 0; k < rows; k++) clumps.push([side * (FENCE.x + 0.6 + k * 0.7 + ((z * 3.7 + k) % 1) * 0.4), z + ((k * 0.37) % 1) * 0.6]);
  const wheat = new THREE.InstancedMesh(wheatClump(), K.mats.wheat, clumps.length);
  clumps.forEach(([x, z], i) => wheat.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z), z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (x * 13 + z) % 6.28), new THREE.Vector3(0.9, 0.85 + ((x * z) % 1) * 0.3, 0.9))));
  for (const mesh of [post, rail, hedge, wheat]) {
    // (the wheat takes the fences’ and hedges’ shade but casts none: its own fell
    // only among its clumps, and drawn into the cascades it was most of the stage’s triangles)
    mesh.castShadow = mesh !== wheat;
    mesh.receiveShadow = true;
    out.push(mesh);
  }
  return out;
}

// the body of the crop behind the near clumps: a canopy a side (parts.js), its lane edge under the clumps
function cropParts(heightAt, parts) {
  for (const side of [1, -1]) parts.push(canopy(heightAt, { x: [side * (FENCE.x + 2.6), side * (FENCE.x + 34)], z: [FENCE.z[0] - 4, FENCE.z[1] + 2] }));
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
  for (const x of [-2.1, 2.1]) parts.push(part(new THREE.CylinderGeometry(0.07, 0.08, 1.6, 5), DARK, { at: [x, far + 0.8, FAR.z[1] - 0.8] }));
  return { near, far };
}

function raftMesh(material) {
  const p = [];
  // logs side by side, two cross-beams, a rail each side, a post for the lantern
  for (let i = 0; i < 9; i++) p.push(part(new THREE.CylinderGeometry(0.24, 0.24, RAFT.d, 6), PLANK.clone().offsetHSL(0, 0, (i % 3) * 0.02), { at: [-RAFT.w / 2 + 0.25 + i * 0.49, -0.12, 0], pitch: Math.PI / 2 }));
  for (const z of [-RAFT.d / 2 + 0.6, RAFT.d / 2 - 0.6]) p.push(part(new THREE.BoxGeometry(RAFT.w, 0.1, 0.25), DARK, { at: [0, 0.1, z] }));
  for (const x of [-RAFT.w / 2 + 0.1, RAFT.w / 2 - 0.1]) {
    p.push(part(new THREE.BoxGeometry(0.08, 0.08, RAFT.d - 0.4), WOOD, { at: [x, 0.95, 0] }));
    for (const z of [-2.6, 0, 2.6]) p.push(part(new THREE.BoxGeometry(0.08, 0.95, 0.08), WOOD, { at: [x, 0.5, z] }));
  }
  p.push(part(new THREE.BoxGeometry(0.1, 1.9, 0.1), WOOD, { at: [RAFT.w / 2 - 0.3, 0.95, RAFT.d / 2 - 0.4] }));
  return merged(p, material, 'shire-edge:raft');
}

export function buildProps({ K, material, heightAt, level, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'shire-edge:props';
  for (const mesh of lanes(K, heightAt, tier)) group.add(mesh);

  // Maggot’s barn across the field on the right, its doors to the lane; the farm’s dressing
  group.add(stand(barn(K).group, heightAt, -42, 16, Math.PI / 2, SHIRE * 0.9));
  group.add(stand(bits((bk) => scarecrowParts(bk, K)), heightAt, -16, 30, Math.PI / 2));
  group.add(stand(bits((bk) => scarecrowParts(bk, K)), heightAt, 19, 8, -Math.PI / 2));
  for (const [x, z, yaw] of [[-8.2, 50, 0.3], [-9.4, 51.4, 1.2], [-8.6, 53, 0.1], [7.6, 54, 2]]) group.add(stand(bits((bk) => hayBaleParts(bk, K)), heightAt, x, z, yaw));
  const crops = { cabbage: cabbageGeo(), pumpkin: pumpkinGeo(), wheat: wheatGeo() };
  group.add(stand(bits((bk) => wheelbarrowParts(bk, K, crops)), heightAt, -6.4, 44, 0.6));
  // the mushrooms the two came out with, spilt in the lane at the gap
  for (const [x, z, yaw] of [[1.6, 25.2, 0], [0.9, 26.1, 1.4], [2.3, 26.6, 2.6], [1.2, 27.3, 0.8]]) group.add(stand(bits((bk) => mushroomParts(bk, K)), heightAt, x, z, yaw, SHIRE * 0.8));

  // the old tree on its bank, the hollow under its roots turned to the lane
  const tree = rootTree(K);
  tree.group.rotation.y = -Math.PI / 2;
  tree.group.scale.setScalar(SHIRE * 1.25);
  const mouth = tree.hollow.clone().multiplyScalar(SHIRE * 1.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  tree.group.position.set(HOLLOW[0] - mouth.x, heightAt(HOLLOW[0], HOLLOW[1]) - 0.1, HOLLOW[1] - mouth.z);
  group.add(tree.group);

  // the ferry: its signpost at the fork, the landing stages, the rope, barrels and lanterns
  group.add(stand(signpost(K, ['Bucklebury Ferry', 'Stock', 'The Marish']).group, heightAt, -3.4, 118, Math.PI / 2, SHIRE * 1.1));
  for (const [x, z] of [[3.2, 122], [3.6, 123.2], [-3.1, 121.6]]) group.add(stand(bits((bk) => barrelParts(bk, K, { h: 0.9, r: 0.3 })), heightAt, x, z, z));
  const fp = [];
  cropParts(heightAt, fp);
  const decks = ferryParts(heightAt, level, fp);
  group.add(merged(fp, material, 'shire-edge:ferry'));
  // Buckland’s lanterns on the far stage: the chapter’s lantern, lit
  for (const x of [-2.1, 2.1]) group.add(bits((bk) => lanternParts(bk, K, x, decks.far + 1.7, FAR.z[1] - 0.8, 1, 0)));

  const raft = new THREE.Group();
  raft.name = 'shire-edge:raft';
  raft.add(raftMesh(material));
  const lampMat = new MeshBasicNodeMaterial({ color: new THREE.Color(1.7, 1.15, 0.5) });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), lampMat);
  lamp.position.set(RAFT.w / 2 - 0.3, 1.95, RAFT.d / 2 - 0.4);
  raft.add(lamp);
  group.add(raft);

  return {
    group,
    raft,
    decks,
    dispose() {
      group.removeFromParent();
      // (the stage’s own vertex-coloured material is the stage’s to free; the rest the builders made, but the kit’s)
      disposeBuilt(group, { mats: { ...K.mats, material } });
    },
  };
}
