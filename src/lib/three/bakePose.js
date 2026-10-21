// A rigged figure stood in a pose, as plain geometry: the clip played to
// `t` on a mixer of its own, every skinned vertex put where its bones hold
// it (positions, and normals turned with them), in the space of `root`. So
// a crowd can draw a rigged figure as still copies, instanced, without a
// skeleton per copy and without a model file of its own. The figure is
// left as it was found: its bones go back to where they stood.
//
// bakePose(root, clip, t = 0) → BufferGeometry | null
//   root: the figure (its bones and skinned meshes under it); clip: an
//   AnimationClip, or null for the pose it stands in. One geometry, its
//   skinned meshes merged (position, normal, uv, index), or null if it has
//   no skinned mesh.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function bakePose(root, clip, t = 0) {
  const skinned = [];
  root.traverse((o) => {
    if (o.isSkinnedMesh) skinned.push(o);
  });
  if (!skinned.length) return null;

  // (every bone's pose, to put back after)
  const bones = new Set(skinned.flatMap((m) => m.skeleton.bones));
  const held = [...bones].map((b) => [b, b.position.clone(), b.quaternion.clone(), b.scale.clone()]);

  const mixer = clip ? new THREE.AnimationMixer(root) : null;
  if (mixer) {
    // (once, held at its end: a `t` at or past the clip's length is its last pose)
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    mixer.setTime(Math.min(t, clip.duration));
  }
  root.updateMatrixWorld(true);

  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const p = new THREE.Vector3();
  const n4 = new THREE.Vector4();
  const n = new THREE.Vector3();
  const geos = skinned.map((mesh) => {
    const src = mesh.geometry;
    const count = src.attributes.position.count;
    m.multiplyMatrices(toRoot, mesh.matrixWorld);
    nm.getNormalMatrix(m);
    const pos = new Float32Array(count * 3);
    const nor = src.attributes.normal ? new Float32Array(count * 3) : null;
    for (let i = 0; i < count; i++) {
      mesh.getVertexPosition(i, p).applyMatrix4(m);
      p.toArray(pos, i * 3);
      if (nor) {
        n4.set(src.attributes.normal.getX(i), src.attributes.normal.getY(i), src.attributes.normal.getZ(i), 0);
        mesh.applyBoneTransform(i, n4);
        n.set(n4.x, n4.y, n4.z).applyMatrix3(nm).normalize();
        n.toArray(nor, i * 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (nor) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const uv = src.attributes.uv;
    if (uv) {
      const out = new Float32Array(uv.count * 2);
      for (let i = 0; i < uv.count; i++) {
        out[i * 2] = uv.getX(i);
        out[i * 2 + 1] = uv.getY(i);
      }
      g.setAttribute('uv', new THREE.BufferAttribute(out, 2));
    }
    if (src.index) g.setIndex(src.index.clone());
    return g;
  });

  if (mixer) {
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
  }
  for (const [b, pos, q, s] of held) {
    b.position.copy(pos);
    b.quaternion.copy(q);
    b.scale.copy(s);
  }
  root.updateMatrixWorld(true);

  if (geos.length === 1) return geos[0];
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return merged;
}
