// A skinned part's skeleton cut to the joints its vertices use. A 2017
// figure's every part is exported on the whole rig (248 to 252 joints: the
// face's 79, the fingers, the weapon's), and three sends a part's whole
// joint list to the graphics chip each frame, and again for the frame
// before (the velocity pass), for every pass the part is drawn in. A
// trooper's backpack is on one joint, its cape on four, its legs on
// thirteen, its head on fifty-one; on Hoth 101 parts sent 25,000 matrices a
// frame for the 2,000 their vertices read. The picture is the same to the
// bit: the same bones, the same inverses, the same weights, only renumbered.
//
// The geometry is the file's, shared by every copy of the body, so the
// renumbered one is made once a geometry (its other attributes are the
// file's own, shared on the chip too) and kept beside it; a copy bound to a
// rig whose joints are named otherwise gets its own.
//
//   usedJoints(geometry) → number[] (ascending) | null (no skin on it)
//   pruneSkin(mesh) → joints dropped (0: none to drop, or done before)

import * as THREE from 'three';

const pruned = new WeakMap(); // the file's geometry → { geometry, used, names }

export function usedJoints(geometry) {
  const si = geometry?.attributes?.skinIndex;
  const sw = geometry?.attributes?.skinWeight;
  if (!si || !sw) return null;
  const used = new Set();
  for (let v = 0; v < si.count; v++) for (let k = 0; k < si.itemSize; k++) if (sw.getComponent(v, k) > 0) used.add(si.getComponent(v, k));
  return [...used].sort((a, b) => a - b);
}

function renumbered(geometry, used) {
  const si = geometry.attributes.skinIndex;
  const sw = geometry.attributes.skinWeight;
  const to = new Map(used.map((j, i) => [j, i]));
  const array = new Uint16Array(si.count * si.itemSize);
  // (a slot with no weight reads joint 0: any joint, times nothing)
  for (let v = 0; v < si.count; v++) for (let k = 0; k < si.itemSize; k++) array[v * si.itemSize + k] = sw.getComponent(v, k) > 0 ? to.get(si.getComponent(v, k)) : 0;
  const out = new THREE.BufferGeometry();
  out.name = geometry.name;
  out.setIndex(geometry.index);
  for (const [name, attribute] of Object.entries(geometry.attributes)) out.setAttribute(name, name === 'skinIndex' ? new THREE.BufferAttribute(array, si.itemSize) : attribute);
  for (const [name, list] of Object.entries(geometry.morphAttributes ?? {})) out.morphAttributes[name] = list;
  out.morphTargetsRelative = geometry.morphTargetsRelative;
  for (const g of geometry.groups) out.addGroup(g.start, g.count, g.materialIndex);
  out.setDrawRange(geometry.drawRange.start, geometry.drawRange.count);
  out.boundingBox = geometry.boundingBox;
  out.boundingSphere = geometry.boundingSphere;
  out.userData = { ...geometry.userData, skinPruned: true };
  return out;
}

export function pruneSkin(mesh) {
  const geometry = mesh?.geometry;
  const skeleton = mesh?.skeleton;
  if (!mesh?.isSkinnedMesh || !geometry || !skeleton?.bones?.length || geometry.userData?.skinPruned) return 0;
  let kept = pruned.get(geometry);
  // (the joints by name: a copy on a rig numbered otherwise is not this one's)
  if (kept && kept.used.some((j, i) => skeleton.bones[j]?.name !== kept.names[i])) kept = null;
  if (!kept) {
    const used = usedJoints(geometry);
    if (!used?.length || used.length >= skeleton.bones.length || used.at(-1) >= skeleton.bones.length) return 0;
    kept = { geometry: renumbered(geometry, used), used, names: used.map((j) => skeleton.bones[j].name) };
    pruned.set(geometry, kept);
  }
  const dropped = skeleton.bones.length - kept.used.length;
  const bindMatrix = mesh.bindMatrix.clone();
  mesh.geometry = kept.geometry;
  mesh.bind(new THREE.Skeleton(kept.used.map((j) => skeleton.bones[j]), kept.used.map((j) => skeleton.boneInverses[j].clone())), bindMatrix);
  return dropped;
}
