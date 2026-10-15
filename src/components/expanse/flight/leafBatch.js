// The ground's leaves as one object: a BatchedMesh, a slot a leaf (its own
// stretch of the batch's buffers and an instance standing it at its corner),
// so the node renderer walks, checks and binds one object for the whole
// ground where it walked a mesh a leaf (lane FL3's counts: 58 of the 216
// draws at Hoth's start, each paying the node renderer's per-object cost).
// On WebGL 2 the leaves go out as one multi-draw; on WebGPU three still
// issues a draw a leaf from the one object, so there it is the main
// thread's walk that shrinks, not the chip's draws.
// The batch culls its leaves by their own bounds and does not sort them:
// the ground is opaque and depth-tested, so the order changes no pixel.
//
// A freed slot is hidden and kept for the next leaf that fits it (three's
// addGeometry only ever appends, so a ground that streamed would run out of
// room); a leaf too big for any free slot gets one of its own, and the batch
// doubles when it is full. The buffers only grow (to the most leaves of
// the largest size a flight has held at once) and are freed with the ground.
//
//   createLeafBatch(material, { slots, parent }) → { mesh (the BatchedMesh,
//     made at the first leaf and put under `parent`), add(leaf, answer) →
//     handle (hidden), show(handle, on), remove(handle), live(), dispose() }
//   answer: the worker's { positions, normals, indices }; leaf: { x0, z0, key }

import * as THREE from 'three';

export function createLeafBatch(material, { slots = 64, parent = null } = {}) {
  let mesh = null;
  const free = []; // { geometry, instance, verts, indices }, hidden, kept for the next leaf
  let live = 0;
  const at = new THREE.Matrix4();
  // (the answer's arrays wrapped as the batch reads a geometry: no copy)
  const wrap = (a) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3));
    g.setIndex(new THREE.BufferAttribute(a.indices, 1));
    return g;
  };
  const make = (verts, indices) => {
    mesh = new THREE.BatchedMesh(slots, slots * verts, slots * indices, material);
    mesh.name = 'flight-ground-leaves';
    mesh.sortObjects = false;
    // (its own bounds would be every leaf's, worked out again as they change: each leaf is culled on its own)
    mesh.frustumCulled = false;
    parent?.add(mesh);
  };
  // room for one more slot of this size, the batch doubled if it has none
  // (three r186 has no public reading of how much of the buffers is taken
  // or how big they are: its own fields, which setGeometrySize also reads)
  const room = (verts, indices) => {
    const m = mesh;
    const usedV = m._nextVertexStart;
    const usedI = m._nextIndexStart;
    const full = m.instanceCount >= m.maxInstanceCount || usedV + verts > m._maxVertexCount || usedI + indices > m._maxIndexCount;
    if (!full) return;
    m.setInstanceCount(Math.max(m.maxInstanceCount * 2, m.instanceCount + 1));
    m.setGeometrySize(Math.max(m._maxVertexCount * 2, usedV + verts), Math.max(m._maxIndexCount * 2, usedI + indices));
  };

  return {
    get mesh() {
      return mesh;
    },
    add(leaf, a) {
      const verts = a.positions.length / 3;
      const indices = a.indices.length;
      const g = wrap(a);
      if (!mesh) make(verts, indices);
      // the smallest free slot it fits, or a new one
      let best = -1;
      for (let i = 0; i < free.length; i++) if (free[i].verts >= verts && free[i].indices >= indices && (best < 0 || free[i].verts < free[best].verts)) best = i;
      let slot;
      if (best >= 0) {
        slot = free.splice(best, 1)[0];
        mesh.setGeometryAt(slot.geometry, g);
      } else {
        room(verts, indices);
        const geometry = mesh.addGeometry(g, verts, indices);
        slot = { geometry, instance: mesh.addInstance(geometry), verts, indices };
      }
      mesh.setMatrixAt(slot.instance, at.makeTranslation(leaf.x0, 0, leaf.z0));
      mesh.setVisibleAt(slot.instance, false);
      live++;
      return slot;
    },
    show(slot, on) {
      mesh.setVisibleAt(slot.instance, on);
    },
    remove(slot) {
      mesh.setVisibleAt(slot.instance, false);
      free.push(slot);
      live--;
    },
    live: () => live,
    dispose() {
      if (mesh) {
        mesh.removeFromParent();
        mesh.dispose();
      }
      mesh = null;
      free.length = 0;
      live = 0;
    },
  };
}
