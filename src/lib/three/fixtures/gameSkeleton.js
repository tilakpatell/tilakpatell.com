// A figure on the game's skeleton, standing (facing +z, its left on +x): the
// fifteen ragdoll bodies' bones and the ones between them the ragdoll skips
// (the upper spine, the neck, the shoulders). Shared by ragdoll2017's tests
// and the Battlefront world's ragdolls.
//
//   skeleton() → { name: Bone } (under one root Object3D, world matrices set)

import * as THREE from 'three';

export function skeleton() {
  const root = new THREE.Object3D();
  const bones = {};
  const add = (name, parent, x, y, z = 0) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    (parent ? bones[parent] : root).add(b);
    bones[name] = b;
  };
  add('Hips', null, 0, 1, 0);
  add('Spine', 'Hips', 0, 0.1);
  add('Spine1', 'Spine', 0, 0.15);
  add('Spine2', 'Spine1', 0, 0.15);
  add('Neck', 'Spine2', 0, 0.12);
  add('Head', 'Neck', 0, 0.1);
  for (const [s, k] of [['Left', 1], ['Right', -1]]) {
    add(`${s}Shoulder`, 'Spine2', 0.05 * k, 0.08);
    add(`${s}Arm`, `${s}Shoulder`, 0.12 * k, 0);
    add(`${s}ForeArm`, `${s}Arm`, 0.28 * k, 0);
    add(`${s}Hand`, `${s}ForeArm`, 0.25 * k, 0);
    add(`${s}UpLeg`, 'Hips', 0.1 * k, -0.05);
    add(`${s}Leg`, `${s}UpLeg`, 0, -0.43, 0.01);
    add(`${s}Foot`, `${s}Leg`, 0, -0.43, -0.01);
  }
  root.updateMatrixWorld(true);
  return bones;
}
