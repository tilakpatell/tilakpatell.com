// A two-joint skinned part as a 2017 body's file gives one: the mesh's node
// holds the file's quantisation (a small even scale and an offset, as a
// meshopt GLB's does), each joint's inverse carries it too, the bind matrix
// is the identity; posed by hand and stood far from the level's origin.
// The third vertex's weights sum to 0.999, as bytes do.

import * as THREE from 'three';

export function body({ at = [184.6, 385, -1342.5], yaw = 0.7 } = {}) {
  const root = new THREE.Group();
  const hip = new THREE.Bone();
  hip.position.set(0, 1, 0);
  const knee = new THREE.Bone();
  knee.position.set(0.1, -0.45, 0.02);
  hip.add(knee);
  root.add(hip);
  const quantised = new THREE.Matrix4().compose(new THREE.Vector3(-0.56, 0, -0.21), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1).multiplyScalar(1 / 2048));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([1200, 1900, 400, 900, 1100, 500, 1300, 300, 450], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 1, 0, 0, 0, 0, 1], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 0.5, 0.5, 0, 0, 0.75, 0.249, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ name: 'mat_body' }));
  quantised.decompose(mesh.position, mesh.quaternion, mesh.scale);
  root.add(mesh);
  root.updateMatrixWorld(true);
  const inverses = [hip, knee].map((b) => b.matrixWorld.clone().invert().multiply(quantised));
  mesh.bind(new THREE.Skeleton([hip, knee], inverses), new THREE.Matrix4());
  // a gun in the hand: a rigid mesh under the knee, its own scale
  const gun = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: 'M_E11' }));
  gun.scale.setScalar(0.245);
  gun.position.set(0.2, 0.1, 0.3);
  knee.add(gun);
  root.position.set(...at);
  root.rotation.y = yaw;
  hip.rotation.set(0.3, -0.2, 0.1);
  knee.rotation.x = 1.1;
  root.updateMatrixWorld(true);
  return { root, mesh, hip, knee, gun };
}

// Where three's own vertex stage puts vertex i of a skinned mesh in the
// world (Skinning.js's getSkinnedPosition, then the model matrix): the sum
// keeps its own w through bindMatrixInverse.
export function threeWorld(mesh, i) {
  const g = mesh.geometry;
  const p = new THREE.Vector4(g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i), 1).applyMatrix4(mesh.bindMatrix);
  const sum = new THREE.Vector4(0, 0, 0, 0);
  for (let k = 0; k < 4; k++) {
    const j = g.attributes.skinIndex.getComponent(i, k);
    const bone = new THREE.Matrix4().multiplyMatrices(mesh.skeleton.bones[j].matrixWorld, mesh.skeleton.boneInverses[j]);
    sum.addScaledVector(p.clone().applyMatrix4(bone), g.attributes.skinWeight.getComponent(i, k));
  }
  sum.applyMatrix4(mesh.bindMatrixInverse);
  return new THREE.Vector3(sum.x, sum.y, sum.z).applyMatrix4(mesh.matrixWorld);
}
