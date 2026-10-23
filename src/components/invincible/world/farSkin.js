// A skinned figure far out (Mark at Mars, 400 km from the origin) drawn
// without its bones' slack. three sends each bone's matrix up in world
// space as 32-bit floats, and at 4e5 m a float holds a place to a few
// centimetres; the shader then takes the mesh's own world back off them,
// and what is left of his suit jitters by that much a vertex (it speckled,
// with or without a shadow on it). Here each skeleton's matrices are made
// relative to its mesh in doubles before they go up, and its meshes are
// detached (their bind inverse then their bind's own, which is what the
// shader takes back off): the same figure, in small numbers, for one bound
// where it loaded, near the origin (every figure is: lib/three/rig's). A
// skeleton whose meshes stand in different places is left as it is.
//
//   preciseSkin(root) → { undo() }   (undo: back as three has it)

import * as THREE from 'three';

const ONE = new THREE.Matrix4();

export function preciseSkin(root) {
  const bySkeleton = new Map();
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (!bySkeleton.has(o.skeleton)) bySkeleton.set(o.skeleton, []);
    bySkeleton.get(o.skeleton).push(o);
  });
  root.updateMatrixWorld(true);
  const done = [];
  for (const [skeleton, meshes] of bySkeleton) {
    const [first] = meshes;
    if (!meshes.every((m) => m.matrixWorld.equals(first.matrixWorld) && m.bindMatrix.equals(first.bindMatrix))) continue;
    const update = skeleton.update;
    const modes = meshes.map((m) => m.bindMode);
    for (const m of meshes) {
      m.bindMode = THREE.DetachedBindMode;
      m.bindMatrixInverse.copy(m.bindMatrix).invert();
    }
    const rel = new THREE.Matrix4();
    const bone = new THREE.Matrix4();
    // bind × (the mesh's world)⁻¹ × the bone's world × its inverse: what the
    // shader's bind inverse, times this, times bind, makes of a vertex is
    // where three's own would have put it
    skeleton.update = function () {
      rel.copy(first.matrixWorld).invert().premultiply(first.bindMatrix);
      for (let i = 0; i < this.bones.length; i++) {
        bone.multiplyMatrices(this.bones[i] ? this.bones[i].matrixWorld : ONE, this.boneInverses[i]).premultiply(rel);
        bone.toArray(this.boneMatrices, i * 16);
      }
      if (this.boneTexture !== null) this.boneTexture.needsUpdate = true;
    };
    done.push({ skeleton, meshes, update, modes });
  }
  return {
    undo() {
      for (const d of done) {
        d.skeleton.update = d.update;
        d.meshes.forEach((m, i) => {
          m.bindMode = d.modes[i];
          m.updateMatrixWorld(true);
        });
      }
      done.length = 0;
    },
  };
}
