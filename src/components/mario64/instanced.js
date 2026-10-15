// The props that never move, drawn as one mesh a kind. Each prop is its own
// root with its own mesh under it (./models/things.js), which the node
// renderer walks, binds and draws one by one in every pass: the castle
// grounds' twelve trees were twelve draws in the frame and twelve in the
// sun's shadow. The node renderer spends more of the main thread a mesh
// than the classic one, so a world moved to it is rebuilt with fewer (lane
// FL3: docs/superpowers/specs/2026-10-15-engine-floor-design.md §4.4).
//
// instanceStill(group, still) → how many instanced meshes were made
//   the meshes of the group's children that still(child) says never move,
//   gathered by geometry and material into one InstancedMesh each where two
//   or more share them, each instance where its mesh stood; the props' own
//   meshes leave the frame (their roots stay, so a prop's model and its
//   update() are as they were). A skinned mesh, or one with several
//   materials, is left alone.

import * as THREE from 'three';

export function instanceStill(group, still) {
  group.updateMatrixWorld(true);
  const into = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const sets = new Map();
  for (const child of group.children) {
    if (!still(child)) continue;
    child.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
      const key = `${o.geometry.uuid}/${o.material.uuid}`;
      if (!sets.has(key)) sets.set(key, []);
      sets.get(key).push(o);
    });
  }
  let made = 0;
  const m = new THREE.Matrix4();
  for (const meshes of sets.values()) {
    if (meshes.length < 2) continue;
    const [first] = meshes;
    const im = new THREE.InstancedMesh(first.geometry, first.material, meshes.length);
    meshes.forEach((o, i) => {
      im.setMatrixAt(i, m.multiplyMatrices(into, o.matrixWorld));
      o.removeFromParent();
    });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = first.castShadow;
    im.receiveShadow = first.receiveShadow;
    im.computeBoundingSphere();
    im.name = `${first.name || first.geometry.type} × ${meshes.length}`;
    group.add(im);
    made++;
  }
  return made;
}
