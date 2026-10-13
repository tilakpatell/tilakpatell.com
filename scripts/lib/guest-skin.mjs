// A guest's mesh on the fitted skeleton (./guest-skeleton.mjs): where its
// vertices stand when the guest stands as the game's man does at rest, and
// its weights on the game's bones. Meshy modelled it with its arms out and
// down in one plane; the game's man rests with his elbows bent and his
// forearms before him. So the mesh is posed there through its own Meshy
// skin (linear blend skinning, the same sum a renderer does), each of its
// joints turned as guest-skeleton.mjs's turnsOf says and put at the fitted
// joint, and what comes out is kept as the new bind: at the fitted rest the
// figure is exactly what Meshy's rig would draw in that pose. A weight then
// moves to its joint's counterpart, one for one, so every later pose bends
// the mesh as Meshy's weights meant; the head's two helpers, which the
// game's skeleton has no bone for, give theirs to the head. No finger is
// weighted: a guest's hand is a mitten on the hand bone. Pure.
//
//   bindPose(meshySkeleton) → Map<Meshy joint, Matrix4>: each node at rest,
//     in metres (the root's scale taken out of the matrix)
//   restPose(meshySkeleton, fitted, map) → Map<Meshy joint, Matrix4>: each
//     joint from the hips down at the fitted joint, turned as its long bone
//     is turned; a joint with no counterpart goes with its parent
//   bakeBind(positions, normals, skinIndex, skinWeight, meshyBind, restPose, joints)
//     → { positions, normals }: the mesh posed from the one to the other
//     (joints: the skin's joint names, in its order)
//   targetsOf(joints, map) → [game bone…]: where each of the skin's joints
//     ({ name, parent }, in its order) sends its weight
//   moveWeights(skinIndex, skinWeight, map, gameIndexOf, joints)
//     → { skinIndex, skinWeight }: the weights on the game's bones, in the
//     file's own order, four at most, summing to one

import * as THREE from 'three';
import { turnsOf, worldsOf } from './guest-skeleton.mjs';

const ONE = new THREE.Vector3(1, 1, 1);
// the head's helpers, which the fitted skeleton carries under their own names
const HELPERS = new Set(['head_end', 'headfront']);

export function bindPose(meshySkeleton) {
  const out = new Map();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (const [name, world] of worldsOf(meshySkeleton)) {
    world.decompose(p, q, s);
    out.set(name, new THREE.Matrix4().compose(p, q, ONE));
  }
  return out;
}

export function restPose(meshySkeleton, fitted, map) {
  const own = bindPose(meshySkeleton);
  const fit = worldsOf(fitted);
  const place = (m) => new THREE.Vector3().setFromMatrixPosition(m);
  const joints = {};
  for (const [from, to] of map) joints[to] = place(own.get(from)).toArray();
  // (the fitted skeleton rests as the game's does, so its long bones point the game's way)
  const turns = turnsOf(joints, fitted);
  const still = new THREE.Quaternion();
  const turned = new Map();
  const out = new Map();
  const q = new THREE.Quaternion();
  for (const r of meshySkeleton) {
    const to = map.get(r.name);
    let at;
    let turn;
    if (to) {
      turn = turns[to] ?? still;
      at = place(fit.get(to));
    } else if (out.has(r.parent)) {
      // (with its parent: at its own node where the fitted skeleton has one, else carried)
      turn = turned.get(r.parent);
      at = HELPERS.has(r.name) && fit.has(r.name) ? place(fit.get(r.name)) : place(own.get(r.name)).sub(place(own.get(r.parent))).applyQuaternion(turn).add(place(out.get(r.parent)));
    } else continue;
    turned.set(r.name, turn);
    q.setFromRotationMatrix(own.get(r.name)).premultiply(turn);
    out.set(r.name, new THREE.Matrix4().compose(at, q, ONE));
  }
  return out;
}

export function bakeBind(positions, normals, skinIndex, skinWeight, meshyBind, pose, joints) {
  const mats = joints.map((n) => (pose.has(n) && meshyBind.has(n) ? pose.get(n).clone().multiply(meshyBind.get(n).clone().invert()) : null));
  const count = positions.length / 3;
  const out = { positions: new Float32Array(count * 3), normals: normals ? new Float32Array(count * 3) : null };
  const p = new THREE.Vector3();
  const sum = new THREE.Vector3();
  const nsum = new THREE.Vector3();
  for (let v = 0; v < count; v++) {
    sum.set(0, 0, 0);
    nsum.set(0, 0, 0);
    let total = 0;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight[v * 4 + k];
      if (!(w > 0)) continue;
      const m = mats[skinIndex[v * 4 + k]];
      if (!m) throw new Error(`vertex ${v} is on ${joints[skinIndex[v * 4 + k]] ?? 'no joint'}, which has no pose`);
      total += w;
      sum.addScaledVector(p.fromArray(positions, v * 3).applyMatrix4(m), w);
      if (normals) nsum.addScaledVector(p.fromArray(normals, v * 3).transformDirection(m), w);
    }
    if (!(total > 0)) throw new Error(`vertex ${v} has no weight`);
    sum.multiplyScalar(1 / total).toArray(out.positions, v * 3);
    if (normals) nsum.normalize().toArray(out.normals, v * 3);
  }
  return out;
}

export function targetsOf(joints, map) {
  const parent = new Map(joints.map((j) => [j.name, j.parent]));
  return joints.map((j) => {
    let name = j.name;
    while (name != null && !map.has(name)) name = parent.get(name);
    if (name == null) throw new Error(`${j.name} has no mapped joint above it`);
    return map.get(name);
  });
}

const MOST = 4; // joints a vertex keeps

export function moveWeights(skinIndex, skinWeight, map, gameIndexOf, joints) {
  const targets = targetsOf(joints, map).map((name) => {
    const i = gameIndexOf(name);
    if (!(i >= 0)) throw new Error(`the skeleton has no ${name} to take a weight`);
    return i;
  });
  const count = skinIndex.length / 4;
  const out = { skinIndex: new Uint16Array(count * 4), skinWeight: new Float32Array(count * 4) };
  const acc = new Map();
  for (let v = 0; v < count; v++) {
    acc.clear();
    for (let k = 0; k < 4; k++) {
      const w = skinWeight[v * 4 + k];
      if (w > 0) acc.set(targets[skinIndex[v * 4 + k]], (acc.get(targets[skinIndex[v * 4 + k]]) ?? 0) + w);
    }
    // (in the order the file has them: joints only ever merge, so there are
    // never more than it had, and the first of two equal weights stays first,
    // which is the one the Wardrobe reads a vertex's zone from)
    const top = [...acc.entries()].slice(0, MOST);
    const sum = top.reduce((s, [, w]) => s + w, 0);
    if (!(sum > 0)) throw new Error(`vertex ${v} has no weight`);
    top.forEach(([j, w], k) => {
      out.skinIndex[v * 4 + k] = j;
      out.skinWeight[v * 4 + k] = w / sum;
    });
  }
  return out;
}
