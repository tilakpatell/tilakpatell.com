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

// makePool(geometry, material, size, parent) → { mesh, add() → slot,
//   set(slot, x, y, z, scale, visible), remove(slot), clear(), dispose() }
//   things that come and go and move every frame (the cast's blob shadows),
//   drawn as one InstancedMesh: a slot each, a hidden or let-go slot drawn
//   at no size; full, it grows to twice its size in a new mesh (put in
//   `parent` in the old one's place). Not culled: its things move, and one
//   draw of a few flat discs costs less than its bounds made every frame.
const NOWHERE = new THREE.Matrix4().makeScale(0, 0, 0);

export function makePool(geometry, material, size, parent = null) {
  const make = (n) => {
    const im = new THREE.InstancedMesh(geometry, material, n);
    im.frustumCulled = false;
    im.count = 0;
    return im;
  };
  let mesh = make(size);
  parent?.add(mesh);
  const free = [];
  const m = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const grow = () => {
    const next = make(mesh.instanceMatrix.count * 2);
    next.instanceMatrix.array.set(mesh.instanceMatrix.array);
    next.count = mesh.count;
    next.instanceMatrix.needsUpdate = true;
    if (parent) {
      parent.remove(mesh);
      parent.add(next);
    }
    mesh.dispose();
    mesh = next;
  };
  return {
    get mesh() {
      return mesh;
    },
    add() {
      if (free.length) return free.pop();
      if (mesh.count === mesh.instanceMatrix.count) grow();
      const slot = mesh.count++;
      mesh.setMatrixAt(slot, NOWHERE);
      mesh.instanceMatrix.needsUpdate = true;
      return slot;
    },
    set(slot, x, y, z, s, visible) {
      if (visible) m.compose(at.set(x, y, z), turn, scale.setScalar(s));
      mesh.setMatrixAt(slot, visible ? m : NOWHERE);
      mesh.instanceMatrix.needsUpdate = true;
    },
    remove(slot) {
      mesh.setMatrixAt(slot, NOWHERE);
      mesh.instanceMatrix.needsUpdate = true;
      free.push(slot);
    },
    // (every slot let go at once: a new area's cast)
    clear() {
      mesh.count = 0;
      free.length = 0;
    },
    dispose() {
      parent?.remove(mesh);
      mesh.dispose();
    },
  };
}
