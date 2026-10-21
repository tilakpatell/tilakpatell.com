// Models drawn as instances, for anything a world stands many of: the
// town's kit props (./town/scene.js), a dimension's set pieces, props and
// traffic (./dimensions/surround.js).
//
// partsOf(root, { node, tall, paint }) → [{ geometry, material, local }] | null
//   the meshes of `node` (by name; the whole of `root` if none is named),
//   each with its place under it, scaled to `tall` and stood on the ground
//   at the origin; painted in the toon look unless they come painted
//   (`paint: false`: a cast prop, already in the cast's paint). null if the
//   node isn't there.
// instanced(parts, list, { shadows }) → InstancedMesh[]
//   each part as an instanced mesh, one instance a placement { x, z, turn, s, y }
// stoodOn(model, { x, z, y, h, turn }) → Group
//   a model stood `h` tall on (x, z) at height y, turned `turn`

import * as THREE from 'three';
import { gentleRamp } from './kit';
import { toonify } from '../portal/toon';

export function partsOf(scene, { node = null, tall, paint = true }) {
  const root = node ? scene.getObjectByName(node) : scene;
  if (!root) return null;
  if (paint) toonify(root, { gradientMap: gentleRamp() });
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const k = tall / Math.max(1e-6, box.max.y - box.min.y);
  const mid = box.getCenter(new THREE.Vector3());
  // (from the scene's frame to the model's own: its foot's middle at the origin, `tall` high)
  const to = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-mid.x, -box.min.y, -mid.z));
  const parts = [];
  root.traverse((o) => {
    if (o.isMesh) parts.push({ geometry: o.geometry, material: o.material, local: to.clone().multiply(o.matrixWorld) });
  });
  return parts;
}

export function instanced(parts, list, { shadows }) {
  if (!list.length) return [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  return parts.map((p) => {
    const mesh = new THREE.InstancedMesh(p.geometry, p.material, list.length);
    list.forEach((o, i) => {
      const s = o.s ?? 1;
      m.compose(new THREE.Vector3(o.x, o.y ?? 0, o.z), q.setFromAxisAngle(up, o.turn ?? 0), new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m.clone().multiply(p.local));
    });
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    return mesh;
  });
}

export function stoodOn(model, { x, z, y = 0, h, turn = 0 }) {
  const holder = new THREE.Group();
  model.rotation.y = turn;
  holder.add(model);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const k = h / Math.max(1e-6, box.max.y - box.min.y);
  holder.scale.setScalar(k);
  holder.position.set(x - ((box.min.x + box.max.x) / 2) * k, y - box.min.y * k, z - ((box.min.z + box.max.z) / 2) * k);
  return holder;
}
