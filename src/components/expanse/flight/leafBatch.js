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
// room); a leaf too big for any free slot gets one of its own, and a full
// batch is made again twice the size with the leaves in use put back (never
// resized in place: see grow). Its buffers only grow (to the most leaves a
// flight has held at once) and are freed with the ground.
//
//   createLeafBatch(material, { slots, parent }) → { mesh (the BatchedMesh,
//     made at the first leaf and put under `parent`), add(leaf, answer) →
//     handle (hidden), show(handle, on), remove(handle), live(), dispose() }
//   answer: the worker's { positions, normals, indices }; leaf: { x0, z0, key }

import * as THREE from 'three';

export function createLeafBatch(material, { slots = 64, parent = null } = {}) {
  let mesh = null;
  const free = []; // { geometry, instance, verts, indices }, hidden, kept for the next leaf
  const held = new Set(); // the slots in use: { …, leaf, answer, shown }
  const at = new THREE.Matrix4();
  // (the answer's arrays wrapped as the batch reads a geometry: no copy)
  const wrap = (a) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3));
    g.setIndex(new THREE.BufferAttribute(a.indices, 1));
    return g;
  };
  const make = (instances, verts, indices) => {
    const m = new THREE.BatchedMesh(instances, verts, indices, material);
    m.name = 'flight-ground-leaves';
    m.sortObjects = false;
    // (its own bounds would be every leaf's, worked out again as they change: each leaf is culled on its own)
    m.frustumCulled = false;
    return m;
  };
  // a slot's leaf into the batch: a new stretch of its buffers and an instance
  const place = (slot) => {
    slot.geometry = mesh.addGeometry(wrap(slot.answer), slot.verts, slot.indices);
    slot.instance = mesh.addInstance(slot.geometry);
    mesh.setMatrixAt(slot.instance, at.makeTranslation(slot.leaf.x0, 0, slot.leaf.z0));
    mesh.setVisibleAt(slot.instance, slot.shown);
  };
  // (three r186 has no public reading of how much of the buffers is taken
  // or how big they are: its own fields)
  const fits = (verts, indices) => mesh.instanceCount < mesh.maxInstanceCount && mesh._nextVertexStart + verts <= mesh._maxVertexCount && mesh._nextIndexStart + indices <= mesh._maxIndexCount;
  // a full batch made again twice the size, the leaves in use put back
  // (three's batch node takes the batch's matrix and indirect textures as
  // the material is built, and setInstanceCount makes new ones: resized,
  // the built material would go on reading the old), the old one freed
  const grow = (verts, indices) => {
    const was = mesh;
    let v = verts;
    let i = indices;
    for (const h of held) {
      v += h.verts;
      i += h.indices;
    }
    mesh = make(Math.max(was.maxInstanceCount * 2, held.size + 1), Math.max(was._maxVertexCount * 2, v), Math.max(was._maxIndexCount * 2, i));
    for (const h of held) place(h);
    free.length = 0;
    was.removeFromParent();
    was.dispose();
    parent?.add(mesh);
  };

  return {
    get mesh() {
      return mesh;
    },
    add(leaf, answer) {
      const verts = answer.positions.length / 3;
      const indices = answer.indices.length;
      if (!mesh) {
        mesh = make(slots, slots * verts, slots * indices);
        parent?.add(mesh);
      }
      // the smallest free slot it fits, or a new one
      let best = -1;
      for (let i = 0; i < free.length; i++) if (free[i].verts >= verts && free[i].indices >= indices && (best < 0 || free[i].verts < free[best].verts)) best = i;
      let slot;
      if (best >= 0) {
        slot = Object.assign(free.splice(best, 1)[0], { leaf, answer, shown: false });
        mesh.setGeometryAt(slot.geometry, wrap(answer));
        mesh.setMatrixAt(slot.instance, at.makeTranslation(leaf.x0, 0, leaf.z0));
        mesh.setVisibleAt(slot.instance, false);
      } else {
        if (!fits(verts, indices)) grow(verts, indices);
        slot = { leaf, answer, shown: false, verts, indices };
        place(slot);
      }
      held.add(slot);
      return slot;
    },
    show(slot, on) {
      slot.shown = on;
      mesh.setVisibleAt(slot.instance, on);
    },
    remove(slot) {
      mesh.setVisibleAt(slot.instance, false);
      held.delete(slot);
      slot.shown = false;
      slot.leaf = slot.answer = null;
      free.push(slot);
    },
    live: () => held.size,
    dispose() {
      if (mesh) {
        mesh.removeFromParent();
        mesh.dispose();
      }
      mesh = null;
      free.length = 0;
      held.clear();
    },
  };
}
