// Bree’s landmarks, built with the Bree chapter’s own builders
// (towns/bree/build.js, on the Road’s town kit darkened for a wet night as
// the chapter darkens its own) at the Road’s scale: the stockade of
// sharpened logs across the road and its West-gate, with the gatekeeper’s
// hatch and his lodge; the lane of tall houses, stone below and oak and
// plaster above, each floor jettied over the one under it, a lantern at
// every door; the Prancing Pony with its sign and its door open on the
// common room’s light; the stable, the well, the market’s stalls shut for
// the night, crates and barrels; the hobbits’ room across the lane; and the
// back way out through the stockade. In the stage’s frame: the lane along
// +z from 0, +x on the walker’s left.
//
//   buildProps({ K, material, heightAt }) → { group, gate, dispose }
//   GATE, PONY, WING, BACK, BREE: where they stand, and the scale, for the beats and the scene

import * as THREE from 'three';
import { C, disposeBuilt, merged, mergeStatics, part } from '../parts';
import { barrels, crates, gate as buildGate, house, lodge, pony, stable, stall, stockade, well } from '../../../towns/bree/build';
import { barn, benchParts, fencePostGeo, fenceRailGeo, hayBaleParts, hole, mergeAll, parts, signpost } from '../../../shire/build';

export const BREE = 0.8; // the Road’s man (1.8 m) over the chapter’s Big Folk (2.3)
export const GATE = { z: 22, half: 2.6 }; // the West-gate across the lane, its leaves either side of the middle
export const PONY = { x: -7.2, z: 92, door: [-3.2, 92], bench: [-3.4, 95.6] }; // the inn on the right of the lane, its door to the lane
export const WING = { x: 7.4, z: 101, window: [4.2, 1.5, 101] }; // the hobbits’ room across the lane: its window is where the Riders strike
export const BACK = { z: 146, half: 1.6 }; // the back way out, a gap in the stockade

// the lane’s houses, either side, their fronts to it: [side, z, w (front), d, floors, roof, stone, seed, door]
const HOUSES = [
  [1, 31, 7, 7, 3, 'slate', true, 3, 0x5a3a24],
  [-1, 34, 6, 7, 2, 'thatch', false, 4, 0x2e4a3a],
  [1, 42, 6, 6, 2, 'slate', true, 5, 0x6a2e24],
  [-1, 45, 7, 8, 3, 'slate', true, 6, 0x3a3a52],
  [1, 53, 6, 7, 3, 'thatch', false, 7, 0x4a3a28],
  [-1, 57, 6, 7, 2, 'slate', true, 8, 0x5a4a2a],
  [1, 72, 7, 8, 2, 'slate', true, 9, 0x2e3a4a],
  [-1, 71, 6, 7, 3, 'thatch', false, 10, 0x6a3a24],
  [1, 82, 6, 7, 3, 'slate', true, 11, 0x3a4a2a],
  [1, 114, 7, 8, 2, 'slate', true, 12, 0x5a2e2e],
  [-1, 116, 6, 8, 3, 'thatch', false, 13, 0x3a3a3a],
  [1, 125, 6, 6, 2, 'slate', true, 14, 0x4a2a1e],
  [-1, 127, 7, 7, 2, 'slate', true, 15, 0x2a3a2a],
];
const LANE = 3.4; // m: the lane’s half-width to the house fronts
const SHIRE = 0.68; // the Road’s hobbit over the Shire chapter’s: the holes’ scale
// the holes of the Little Folk in Bree-hill’s face toward the road: the hill’s
// middle and the slope they’re dug into (degrees round from +x, metres out),
// each a door colour and a seed
const HILL = [-140, 90];
const DUG = [[-24, 74, 0x7a3f2a, 21], [-14, 70, 0x2e4a6a, 23], [-5, 76, 0x5a6a2a, 25], [6, 72, 0x8a2e2e, 27], [16, 77, 0x3a5a3a, 29], [27, 73, 0x6a4a2a, 31]];
const FARM = { barn: [-30, 10], paddock: { x: [-46, -14], z: [1.5, 18.5] } }; // a farmstead outside the West-gate (inside the stage: before 0 is the last one’s ground)

// a builder’s group stood on the land at (x, z), turned (its front, +z, to `yaw`), at the Road’s scale
function stand(g, heightAt, x, z, yaw, s = BREE, foot = 0) {
  g.position.set(x, heightAt(x, z) + foot, z);
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
// (a front to the lane: the left side’s houses face −x, the right side’s +x)
const FACE = { 1: -Math.PI / 2, [-1]: Math.PI / 2 };

export function buildProps({ K, material, heightAt }) {
  const group = new THREE.Group();
  group.name = 'bree:props';
  const ground = (x, z) => heightAt(x, z);

  // the stockade across the road, broken by the West-gate, and again at the back with its gap
  const segs = [
    [-90, GATE.z, -GATE.half - 0.5, GATE.z],
    [GATE.half + 0.5, GATE.z, 90, GATE.z],
    [-90, BACK.z, -BACK.half, BACK.z],
    [BACK.half, BACK.z, 90, BACK.z],
  ];
  group.add(stockade(K, segs, ground, { inside: [0, (GATE.z + BACK.z) / 2] }).group);
  const gate = buildGate(K);
  // (its outer face, +z, to the road outside: the travellers come from −z)
  stand(gate.group, heightAt, 0, GATE.z, Math.PI, 1);
  group.add(gate.group);
  group.add(stand(lodge(K).group, heightAt, GATE.half + 4.2, GATE.z + 5, FACE[1]));

  // the lane’s houses
  const lamps = [];
  for (const [side, z, w, d, floors, roof, stone, seed, door] of HOUSES) {
    const h = house(K, { w, d, floors, roof, stone, seed, door });
    group.add(stand(h.group, heightAt, side * (LANE + (d * BREE) / 2), z, FACE[side]));
    h.group.updateMatrixWorld(true);
    if (h.lamp) lamps.push(h.group.localToWorld(h.lamp.clone()));
  }
  // the Prancing Pony, its door to the lane; a bench under its eaves
  const inn = pony(K);
  group.add(stand(inn.group, heightAt, PONY.x, PONY.z, FACE[-1]));
  const bench = new THREE.Group();
  const bk = parts();
  benchParts(bk, K, 1.6);
  bk.build(bench);
  group.add(stand(bench, heightAt, PONY.bench[0], PONY.bench[1], FACE[-1], 1));
  group.add(stand(stable(K).group, heightAt, -8, 107.5, FACE[-1]));
  // the hobbits’ room across the lane: a low house of its own, its window to the lane
  group.add(stand(house(K, { w: 6, d: 5, floors: 1, roof: 'thatch', stone: true, seed: 2, door: 0x4a3a2a }).group, heightAt, WING.x, WING.z, FACE[1]));
  // the well, the market’s stalls shut for the night, crates and barrels by the doors
  group.add(stand(well(K).group, heightAt, 4.9, 63, 0));
  group.add(stand(stall(K, { cloth: 0xa8452e }).group, heightAt, 4.6, 48, FACE[1]));
  group.add(stand(stall(K, { cloth: 0x3a5a8a }).group, heightAt, -4.6, 64, FACE[-1]));
  for (const [x, z, yaw] of [[-4.2, 86.5, 0.3], [4.3, 89, 1.1], [-4, 110, 2]]) group.add(stand(crates(K).group, heightAt, x, z, yaw));
  for (const [x, z, yaw] of [[-4.3, 99, 0], [4.1, 120, 1.4], [3.9, 36, 0.7]]) group.add(stand(barrels(K).group, heightAt, x, z, yaw));

  // cobbles down the middle of the lane, a little darker than the road, gate to back
  const cobbles = [];
  for (let z = GATE.z; z < BACK.z; z += 8) cobbles.push(part(new THREE.BoxGeometry(3.6, 0.04, 8), C(0x4a4640).offsetHSL(0, 0, ((z * 0.13) % 1) * 0.03), { at: [0, heightAt(0, z + 4) + 0.03, z + 4] }));
  group.add(merged(cobbles, material, 'bree:cobbles'));
  // (the town’s builders draw a house in a dozen meshes: one a material for the whole town, the gate’s leaves left to move)
  // Bree-hill’s holes, their doors and round windows to the road (lit at night with the town’s)
  for (const [deg, r, door, seed] of DUG) {
    const a = (deg * Math.PI) / 180;
    const x = HILL[0] + Math.cos(a) * r;
    const z = HILL[1] + Math.sin(a) * r;
    const h = hole(K, { R: 3.8, door, seed });
    // (its mound’s middle a little into the slope behind the door)
    const back = (h.front ?? 3) * SHIRE;
    group.add(stand(h.group, heightAt, x - Math.cos(a) * back, z - Math.sin(a) * back, Math.atan2(Math.cos(a), Math.sin(a)), SHIRE, -0.15));
  }
  // the farmstead outside the gate: the barn, its hay, the paddock’s fence; the signpost where the roads meet
  group.add(stand(barn(K).group, heightAt, FARM.barn[0], FARM.barn[1], FACE[-1], SHIRE * 0.95));
  for (const [x, z, yaw] of [[-20, 6, 0.3], [-21.4, 7.4, 1.1], [-19.6, 8.8, 2.4], [-23, 15, 0.7]]) group.add(stand(bits((bk) => hayBaleParts(bk, K)), heightAt, x, z, yaw, SHIRE));
  {
    const { x: [x0, x1], z: [z0, z1] } = FARM.paddock;
    const posts = [];
    const runs = [];
    for (let x = x0; x <= x1; x += 2.4) posts.push([x, z0], [x, z1]);
    for (let z = z0 + 2.4; z < z1; z += 2.4) posts.push([x0, z]);
    for (let x = x0; x < x1 - 1; x += 2.4) runs.push([x + 1.2, z0, 0], [x + 1.2, z1, 0]);
    for (let z = z0; z < z1 - 1; z += 2.4) runs.push([x0, z + 1.2, Math.PI / 2]);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const post = new THREE.InstancedMesh(fencePostGeo(), K.mats.fence, posts.length);
    posts.forEach(([x, z], i) => post.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z), z), q.identity(), new THREE.Vector3(SHIRE, SHIRE * 1.2, SHIRE))));
    const rail = new THREE.InstancedMesh(mergeAll([fenceRailGeo(0.45, 1), fenceRailGeo(0.85, 2)]), K.mats.fence, runs.length);
    runs.forEach(([x, z, yaw], i) => rail.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z), z), q.setFromAxisAngle(up, yaw), new THREE.Vector3(2.4, SHIRE * 1.2, SHIRE))));
    group.add(post, rail);
  }
  group.add(stand(signpost(K, ['Bree', 'The Greenway', 'The East Road']).group, heightAt, 3.4, 6, FACE[1], SHIRE * 1.2));
  mergeStatics(group, { keep: [gate.group] });

  return {
    group,
    gate,
    lamps,
    dispose() {
      group.removeFromParent();
      // (the stage’s own vertex-coloured material is the stage’s to free; the rest the builders made, but the kit’s)
      disposeBuilt(group, { mats: { ...K.mats, material } });
    },
  };
}
