import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { pruneSkin, usedJoints } from './skinPrune.js';

// a rig of `n` bones in a row along x, and a part of three vertices on the joints given
function rig(n) {
  const bones = Array.from({ length: n }, (_, i) => {
    const b = new THREE.Bone();
    b.name = `bone${i}`;
    b.position.set(i === 0 ? 0 : 1, 0, 0);
    return b;
  });
  for (let i = 1; i < n; i++) bones[i - 1].add(bones[i]);
  bones[0].updateMatrixWorld(true);
  return bones;
}
function part(bones, joints, weights) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 2, 1, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  return mesh;
}
const JOINTS = [5, 2, 0, 0, 2, 0, 0, 0, 5, 7, 0, 0];
const WEIGHTS = [0.75, 0.25, 0, 0, 1, 0, 0, 0, 0.5, 0.5, 0, 0];

// where three's skinning puts a vertex, for a mesh as it stands
function skinned(mesh, v) {
  const out = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, v);
  mesh.updateMatrixWorld(true);
  mesh.skeleton.update();
  return mesh.applyBoneTransform(v, out).toArray().map((x) => Math.round(x * 1e5) / 1e5);
}

describe('a part’s skin cut to the joints it uses', () => {
  it('names the joints with a weight, and no others', () => {
    const mesh = part(rig(10), JOINTS, WEIGHTS);
    expect(usedJoints(mesh.geometry)).toEqual([2, 5, 7]);
    expect(usedJoints(new THREE.BufferGeometry())).toBe(null);
  });

  it('keeps those bones and their inverses, renumbered, and says how many went', () => {
    const bones = rig(10);
    const mesh = part(bones, JOINTS, WEIGHTS);
    const inverses = mesh.skeleton.boneInverses.map((m) => m.clone());
    expect(pruneSkin(mesh)).toBe(7);
    expect(mesh.skeleton.bones).toEqual([bones[2], bones[5], bones[7]]);
    expect(mesh.skeleton.boneInverses.map((m) => m.elements)).toEqual([inverses[2], inverses[5], inverses[7]].map((m) => m.elements));
    expect([...mesh.geometry.attributes.skinIndex.array]).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0]);
  });

  it('moves no vertex: the same place before and after, in a pose', () => {
    const bones = rig(10);
    const mesh = part(bones, JOINTS, WEIGHTS);
    bones[2].rotation.z = 0.7;
    bones[5].rotation.y = -0.4;
    bones[6].position.y = 0.3;
    const before = [0, 1, 2].map((v) => skinned(mesh, v));
    pruneSkin(mesh);
    expect([0, 1, 2].map((v) => skinned(mesh, v))).toEqual(before);
  });

  it('leaves the file’s geometry as it was, and makes the cut one once for every copy', () => {
    const a = part(rig(10), JOINTS, WEIGHTS);
    const file = a.geometry;
    const b = new THREE.SkinnedMesh(file, a.material);
    const bonesB = rig(10);
    b.add(bonesB[0]);
    b.bind(new THREE.Skeleton(bonesB));
    pruneSkin(a);
    pruneSkin(b);
    expect([...file.attributes.skinIndex.array]).toEqual(JOINTS);
    expect(a.geometry).not.toBe(file);
    expect(b.geometry).toBe(a.geometry);
    expect(a.geometry.attributes.position).toBe(file.attributes.position);
    expect(b.skeleton.bones).toEqual([bonesB[2], bonesB[5], bonesB[7]]);
  });

  it('does nothing twice, nor to a part on every joint, nor to what is no skinned part', () => {
    const mesh = part(rig(10), JOINTS, WEIGHTS);
    pruneSkin(mesh);
    const skeleton = mesh.skeleton;
    expect(pruneSkin(mesh)).toBe(0);
    expect(mesh.skeleton).toBe(skeleton);
    const whole = part(rig(3), [0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0.5, 0.25, 0.25, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    expect(pruneSkin(whole)).toBe(0);
    expect(pruneSkin(new THREE.Mesh())).toBe(0);
    expect(pruneSkin(null)).toBe(0);
  });

  it('gives a copy on a rig named otherwise its own cut', () => {
    const a = part(rig(10), JOINTS, WEIGHTS);
    const file = a.geometry;
    pruneSkin(a);
    const other = rig(10);
    other.forEach((bone, i) => (bone.name = `other${i}`));
    const b = new THREE.SkinnedMesh(file, a.material);
    b.add(other[0]);
    b.bind(new THREE.Skeleton(other));
    expect(pruneSkin(b)).toBe(7);
    expect(b.skeleton.bones).toEqual([other[2], other[5], other[7]]);
  });
});
