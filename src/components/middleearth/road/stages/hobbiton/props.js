// Hobbiton, drawn as the Shire chapter draws it (shire/build.js’s builders,
// on road/townKit.js’s kit, at the Road’s scale): the Hill in turf with Bag
// End on its west face and the holes of Bagshot Row round it, more holes
// dug into the banks along the lane with their gates, lamps and gardens,
// the Party Tree with its lanterns, the pavilion and the long tables, the
// mill on the Water with its wheel turning, the Green Dragon, a vegetable
// patch with its scarecrow, beehives, a washing line, sheep, a dog,
// signposts at the turnings and lamp-posts down the lane, the chapter’s
// oaks and hedges, and at the stage’s end the corn where Sam stops. In the
// stage’s frame: the lane along +z from 0, +x on the walker’s left.
//
//   buildProps({ K, material, heightAt, tier }) → { group, wheel, update(dt), dispose }
//     K: townKit.js’s kit; material: the stage’s vertex-coloured one (the tables)
//   buildCart(K) → { group, seat } (the chapter’s cart, its shafts to −z in the group)
//   SHIRE, HILL, DOORS, TREE, MILL: where they stand, for the beats and the scene

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { C, canopy, disposeBuilt, merged, mergeStatics, part } from '../parts';
import { bagEnd, barrelParts, beehiveParts, benchParts, bush, cabbageGeo, cart, dog, flowerBed, greenDragon, hayBaleParts, hedgeGeo, hole, lampParts, mailboxParts, mill, oaks, partyTree, parts, pavilion, pumpkinGeo, scarecrowParts, sheep, signpost, washingLine, wheatGeo, wheelbarrowParts } from '../../../shire/build';

export const SHIRE = 0.68; // the Road’s hobbit (1.05 m) over the chapter’s (1.55)
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
// the holes in the banks along the lane: x, z, the way the door faces, the mound’s radius, the door, a seed
const R = Math.PI / 2;
const HOLES = [
  [-13, 28, R, 4, 0xb8402c, 3],
  [-15.5, 44, R, 3.6, 0xd9a531, 5],
  [14, 50, -R, 4.2, 0x2f5f8a, 7],
  [15, 72, -R, 3.6, 0xa8322d, 11],
  [-10.5, 98, R, 3.8, 0x7a3f8f, 9],
  [-14, 176, R, 4, 0x2e6b3a, 13],
  [16, 190, -R, 3.8, 0xc9a227, 15],
];
const DRAGON = [-17, 152, R]; // the Green Dragon, its door to the lane
const PAVILION = [21, 146, Math.PI];
const PATCH = { x: [19, 27], z: [30, 41], crow: [23.5, 35.5] }; // the vegetable patch and its scarecrow
const CORN = { z: [198, 226], x: [5.5, 8.6], far: 30 }; // the field’s edge either side: clumps by the lane, the canopy behind to `far`
const HEDGES = [[1, 56, 68], [1, 78, 104], [1, 150, 184], [-1, 58, 88], [-1, 104, 112], [-1, 120, 140], [-1, 160, 170], [-1, 182, 196]]; // side, z from, z to
const OAKS = [[-22, 18, 1.1], [24, 30, 0.9], [-28, 82, 1.2], [27, 96, 1.0], [44, 150, 1.3], [-11, 204, 0.9], [14, 168, 1.1], [-33, 132, 1.0], [8, 230, 1.0], [48, 60, 1.2], [-40, 54, 1.1], [36, 196, 1.0]];
const SHEEP = [[-36, 178], [-40, 183], [-33, 188], [-44, 190], [-38, 195], [-31, 200]];

const CLOTH = C(0xe8dfc8);
const WOOD = C(0x7a5434);
const TURF = new THREE.Color(0x6f9a46);

// a builder’s group stood on the land at (x, z), turned and at the Road’s scale
function stand(g, heightAt, x, z, yaw = 0, s = SHIRE, sink = 0) {
  g.position.set(x, heightAt(x, z) - sink, z);
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
// a point `ahead` metres before a thing facing `yaw` and `side` to its right
const before = (x, z, yaw, ahead, side = 0) => [x + Math.sin(yaw) * ahead - Math.cos(yaw) * side, z + Math.cos(yaw) * ahead + Math.sin(yaw) * side];

// the Hill’s turf: a squashed dome, coloured a little by its height, in the kit’s turf (the chapters’ grass scan on it)
function hillMesh(K, heightAt) {
  const [x, z] = HILL.at;
  // (its foot at the lowest of the ground round it, so no edge floats)
  let low = Infinity;
  for (let a = 0; a < 16; a++) low = Math.min(low, heightAt(x + Math.cos(a / 2.55) * HILL.r, z + Math.sin(a / 2.55) * HILL.r));
  const g = new THREE.SphereGeometry(HILL.r, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / HILL.r;
    c.copy(TURF).offsetHSL(0.01 * Math.sin(pos.getX(i) * 0.7), 0, (y - 0.5) * 0.08 + Math.sin(pos.getX(i) * 1.3 + pos.getZ(i)) * 0.02);
    c.toArray(col, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 14, uv.getY(i) * 4);
  const mesh = new THREE.Mesh(g, K.mats.turf);
  mesh.position.set(x, low - 0.3, z);
  mesh.scale.set(1, HILL.squash, 1);
  mesh.name = 'hobbiton:hill';
  mesh.receiveShadow = true;
  return { mesh, low };
}

// a hole stood with its door at (x, z), facing `yaw`, a garden and a letterbox by its gate
function holeAt(K, heightAt, [x, z, yaw, r, door, seed], group, grand = false) {
  const h = grand ? bagEnd(K) : hole(K, { R: r, door, seed });
  // (its mound’s middle behind the door by the door’s own distance out)
  const front = (h.front ?? r * 0.8) * SHIRE;
  const [cx, cz] = before(x, z, yaw, -front);
  group.add(stand(h.group, heightAt, cx, cz, yaw, SHIRE, 0.1));
  // the garden before it: a bed of flowers either side of the path, the letterbox at the gate
  const [gx, gz] = before(x, z, yaw, 1.6);
  const bed = bits((bk) => {
    flowerBed(bk, K, -1.9, 0, 0, 2.2, 0.7, seed, undefined, 1.2);
    flowerBed(bk, K, 1.9, 0, 0, 2.2, 0.7, seed + 1, undefined, 1.2);
  });
  group.add(stand(bed, heightAt, gx, gz, yaw));
  const [mx, mz] = before(x, z, yaw, 2.6, 1.3);
  group.add(stand(bits((bk) => mailboxParts(bk, K, door)), heightAt, mx, mz, yaw));
  return h;
}

export function buildCart(K) {
  const c = cart(K);
  // (the chapter’s cart has its shafts to +x: turned so they lead to −z, the way it comes down the lane)
  c.group.rotation.y = Math.PI / 2;
  c.group.scale.setScalar(SHIRE * 1.1);
  const group = new THREE.Group();
  group.name = 'hobbiton:cart';
  group.add(c.group);
  const seat = c.seat.clone().multiplyScalar(SHIRE * 1.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  return { group, seat };
}

export function buildProps({ K, material, heightAt, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'hobbiton:props';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  // the Hill, Bag End on its west face and Bagshot Row round it
  const hill = hillMesh(K, heightAt);
  group.add(hill.mesh);
  DOORS.forEach((d, i) => holeAt(K, (x, z) => Math.max(hill.low, heightAt(x, z)), [d.x, d.z, d.yaw, 3.4, d.colour, 2 * i + 1], group, d.bagEnd));
  // the Hill’s surface over (x, z), and the chimneys through its turf, a little sunk in it
  const dome = (x, z) => hill.low - 0.3 + HILL.r * HILL.squash * Math.sqrt(Math.max(0, 1 - ((x - HILL.at[0]) ** 2 + (z - HILL.at[1]) ** 2) / HILL.r ** 2));
  for (const [dx, dz] of [[-4, 3], [3, -5], [-7, -6]]) group.add(stand(bits((bk) => bk.add(K.mats.stone, new THREE.CylinderGeometry(0.4, 0.46, 2.6, 7), { p: [0, 1.3, 0] })), dome, HILL.at[0] + dx, HILL.at[1] + dz, 0, SHIRE, 0.5));
  // bushes and their flowers over the Hill’s face and along its crown, as the chapter has its gardens
  const hb = new THREE.Group();
  const hbk = parts();
  for (let i = 0; i < 26; i++) {
    const a = (100 + ((i * 37) % 160)) * (Math.PI / 180);
    const r = HILL.r * (0.25 + ((i * 0.61) % 0.7));
    const x = HILL.at[0] + Math.cos(a) * r;
    const z = HILL.at[1] + Math.sin(a) * r;
    bush(hbk, K, x, dome(x, z) - 0.25, z, 0.7 + (i % 4) * 0.22, i + 3, i % 3 === 0 ? 10 : 0);
  }
  hbk.build(hb);
  group.add(hb);
  // the holes along the lane
  for (const h of HOLES) holeAt(K, heightAt, h, group);

  // the Party Field: the tree, its lanterns, the pavilion, the long tables
  const tree = partyTree(K);
  group.add(stand(tree.group, heightAt, TREE[0], TREE[1], 0, 0.95, 0.1));
  group.add(stand(pavilion(K).group, heightAt, PAVILION[0], PAVILION[1], PAVILION[2], SHIRE));
  const tp = [];
  for (let t = 0; t < 3; t++) {
    const x = TREE[0] - 12 + t * 5;
    const z = TREE[1] - 4;
    const y = heightAt(x, z);
    tp.push(part(new THREE.BoxGeometry(1.1, 0.08, 7), CLOTH, { at: [x, y + 0.82, z] }));
    for (const dz of [-3.2, 3.2]) for (const dx of [-0.45, 0.45]) tp.push(part(new THREE.BoxGeometry(0.1, 0.8, 0.1), WOOD, { at: [x + dx, y + 0.4, z + dz] }));
    for (const dx of [-0.95, 0.95]) tp.push(part(new THREE.BoxGeometry(0.35, 0.45, 6.8), WOOD, { at: [x + dx, y + 0.22, z] }));
  }
  group.add(merged(tp, material, 'hobbiton:tables'));
  // the lanterns strung in rings round the tree, warm, one draw
  const lanternMat = new MeshBasicNodeMaterial({ color: new THREE.Color(1.6, 1.05, 0.45) });
  const N = 48;
  const lanterns = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), lanternMat, N);
  for (let i = 0; i < N; i++) {
    const ring = i % 2;
    const a = (i / N) * Math.PI * 4;
    const r = ring ? 9 : 6.5;
    const x = TREE[0] + Math.cos(a) * r;
    const z = TREE[1] + Math.sin(a) * r;
    lanterns.setMatrixAt(i, m.makeTranslation(x, heightAt(x, z) + (ring ? 4.2 : 6.5) - Math.abs(Math.sin(a * 3)) * 0.6, z));
  }
  lanterns.name = 'hobbiton:lanterns';
  group.add(lanterns);

  // the mill on the Water, its door to the lane and its wheel turning
  const theMill = mill(K);
  group.add(stand(theMill.group, heightAt, MILL[0], MILL[1], R, SHIRE * 1.1, 0.05));
  // the Green Dragon, its barrels by the door, a bench
  group.add(stand(greenDragon(K).group, heightAt, DRAGON[0], DRAGON[1], DRAGON[2], SHIRE, 0.05));
  for (const [dx, dz] of [[4.6, -3.2], [4.9, -2.2], [4.4, -1.2]]) group.add(stand(bits((bk) => barrelParts(bk, K)), heightAt, DRAGON[0] + dx, DRAGON[1] + dz, dz));
  group.add(stand(bits((bk) => benchParts(bk, K)), heightAt, DRAGON[0] + 4.6, DRAGON[1] + 2.4, R));

  // the vegetable patch: cabbages and pumpkins in rows, the scarecrow over them, a wheelbarrow
  const crops = { cabbage: cabbageGeo(), pumpkin: pumpkinGeo(), wheat: wheatGeo() };
  for (const [geo, mat, row0] of [[crops.cabbage, K.mats.cabbage, 0], [crops.pumpkin, K.mats.pumpkin, 1]]) {
    const at = [];
    for (let row = row0; row < 6; row += 2) for (let z = PATCH.z[0]; z < PATCH.z[1]; z += 0.9) at.push([PATCH.x[0] + 1 + row * 1.2, z + ((row * 0.37) % 1) * 0.4]);
    const crop = new THREE.InstancedMesh(geo, mat, at.length);
    at.forEach(([x, z], i) => crop.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z), z), q.setFromAxisAngle(up, (x * 7 + z) % 6.28), new THREE.Vector3(SHIRE, SHIRE, SHIRE))));
    crop.castShadow = true;
    group.add(crop);
  }
  group.add(stand(bits((bk) => scarecrowParts(bk, K)), heightAt, PATCH.crow[0], PATCH.crow[1], -R));
  group.add(stand(bits((bk) => wheelbarrowParts(bk, K, crops)), heightAt, 11.5, 56, 0.6));

  // the dressing: signposts at the turnings, lamp-posts down the lane, benches, beehives, hay, a washing line
  group.add(stand(signpost(K, ['Bag End', 'The Party Field', 'Bywater', 'The East Road']).group, heightAt, 3.6, 14, -R, SHIRE * 1.1));
  group.add(stand(signpost(K, ['The Green Dragon', 'Bywater', 'The Mill']).group, heightAt, -3.6, 108, R, SHIRE * 1.1));
  group.add(stand(signpost(K, ['The East Road', 'Hobbiton']).group, heightAt, 3.6, 196, -R, SHIRE * 1.1));
  for (let z = 6, side = 1; z < 210; z += 17, side = -side) group.add(stand(bits((bk) => lampParts(bk, K)), heightAt, side * 3.3, z, side > 0 ? -R : R));
  for (const [x, z, yaw] of [[-3.8, 22, R], [3.8, 86, -R], [23, 117, 0]]) group.add(stand(bits((bk) => benchParts(bk, K)), heightAt, x, z, yaw));
  for (const [x, z] of [[21, 58], [22.4, 59], [20.6, 60.4]]) group.add(stand(bits((bk) => beehiveParts(bk, K)), heightAt, x, z, x));
  for (const [x, z, yaw] of [[-34, 196, 0.4], [-35.6, 198, 1.3], [-33, 199.6, 2.2]]) group.add(stand(bits((bk) => hayBaleParts(bk, K)), heightAt, x, z, yaw));
  group.add(stand(washingLine(K, 5).group, heightAt, -19.5, 36, 0.25));
  // the beasts: sheep in the low field, a dog by Bag End’s gate
  SHEEP.forEach(([x, z], i) => group.add(stand(sheep(K, { seed: i + 1 }).group, heightAt, x, z, i * 1.7)));
  const bag = DOORS.find((d) => d.bagEnd);
  const [dx, dz] = before(bag.x, bag.z, bag.yaw, 3.2, -1.6);
  group.add(stand(dog(K).group, heightAt, dx, dz, bag.yaw + 1.2));

  // the chapter’s oaks, instanced, and its hedges along the lane
  for (const [k, oak] of oaks().entries()) {
    const list = OAKS.filter((_, i) => i % 3 === k);
    for (const [geo, mat] of [[oak.trunk, K.mats.trunk], [oak.crown, K.mats.crown]]) {
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, z, s], i) => inst.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.1, z), q.setFromAxisAngle(up, x + z), new THREE.Vector3(s, s, s).multiplyScalar(SHIRE * 1.6))));
      inst.castShadow = true;
      group.add(inst);
    }
  }
  const blocks = [];
  for (const [side, z0, z1] of HEDGES) for (let z = z0; z < z1; z += 0.95) blocks.push([side * 4.6, z]);
  const along = new THREE.Quaternion().setFromAxisAngle(up, R);
  const hedge = new THREE.InstancedMesh(hedgeGeo(), K.mats.hedge, blocks.length);
  blocks.forEach(([x, z], i) => hedge.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.1, z), along, new THREE.Vector3(1, 0.85 + ((z * 7.1) % 1) * 0.25, 0.9))));
  hedge.castShadow = true;
  group.add(hedge);

  // the corn at the field’s edge, either side of the lane: the chapter’s
  // clumps by it (fewer on low), the field’s body behind them a canopy
  const step = tier === 'low' ? 1.5 : 0.75;
  const clumps = [];
  for (const side of [1, -1]) for (let z = CORN.z[0]; z < CORN.z[1]; z += step) for (let x = CORN.x[0]; x < CORN.x[1]; x += step) clumps.push([side * (x + ((z * 3.7) % 1) * 0.5), z + ((x * 1.3) % 1) * 0.4]);
  const wheat = new THREE.InstancedMesh(crops.wheat, K.mats.wheat, clumps.length);
  clumps.forEach(([x, z], i) => wheat.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z), z), q.setFromAxisAngle(up, (x * 13 + z) % 6.28), new THREE.Vector3(0.9, 0.8 + ((x * z) % 1) * 0.3, 0.9))));
  group.add(wheat);
  group.add(merged([1, -1].map((side) => canopy(heightAt, { x: [side * (CORN.x[1] - 1), side * CORN.far], z: CORN.z, cells: [24, 30] })), material, 'hobbiton:corn'));

  // (a builder draws a hole in a dozen meshes: one a material for the stage, what moves kept)
  mergeStatics(group, { keep: [theMill.wheel, lanterns, hedge, wheat].filter(Boolean) });

  return {
    group,
    wheel: theMill.wheel,
    update(dt) {
      if (theMill.wheel) theMill.wheel.rotation.z -= dt * 0.6;
    },
    dispose() {
      group.removeFromParent();
      lanternMat.dispose();
      // (the stage’s own vertex-coloured material is the stage’s to free; the rest the builders made, but the kit’s)
      disposeBuilt(group, { mats: { ...K.mats, material } });
    },
  };
}
