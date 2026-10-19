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
import { benchParts, parts } from '../../../shire/build';

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

// a builder’s group stood on the land at (x, z), turned (its front, +z, to `yaw`), at the Road’s scale
function stand(g, heightAt, x, z, yaw, s = BREE, foot = 0) {
  g.position.set(x, heightAt(x, z) + foot, z);
  g.rotation.y = yaw;
  g.scale.setScalar(s);
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
