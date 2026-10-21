// A landmark's still meshes merged, a material at a time: the node renderer
// pays for each object it draws about twice what the classic one does (a
// uniform block bound and its textures bound again a draw: lane FL3's
// counts), and a POI is a hundred-odd small meshes that never move once
// placed (Echo Base 95 draws, the trench 34). Watched for `frames` ticks
// after its things are in; what stood still all that while is baked into
// one geometry a material, in the landmark's own frame, and taken out of
// the graph; what moved (the ion cannon's turret) is left as it is.
//
// Only what a merge draws the same: shown, under nothing hidden and no LOD
// (the placer wraps a full model in a THREE.LOD, whose levels the renderer
// shows one at a time: taken out, each would draw at every distance), and
// its showing unchanged while watched (a beacon blinks by `visible`); one
// material (not a list), opaque (a
// merge would change the order transparent things are drawn in), a
// determinant above nought (a mirrored mesh's faces would turn inside out),
// no skin, no instances, and a material with no hook that reads the
// object's own frame (an enumerable userData mark other than the kit's
// bake-time `density` and `role`: windNodes' sway, the windows', the
// foliage's; or a positionNode of its own). Geometries merge only with
// their like: indexed with indexed, the same attributes in the same form.
//
// The originals' geometry stays the landmark's to free (shared with the
// placer's model cache, counted by ./landmarkScene.js), with it.
//
//   createMerge(group, { frames }) → { tick() → true once merged, stats()
//     → { merged, into, kept }, dispose() (the merged geometries freed) }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const BAKED = new Set(['density', 'role']); // (the kit's: used as it bakes UVs, never in a shader)

const plain = (m) => Boolean(m) && !Array.isArray(m) && !m.transparent && !m.positionNode && Object.keys(m.userData).every((k) => BAKED.has(k));

const mergeable = (o) => o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !o.isBatchedMesh && plain(o.material) && !Object.keys(o.geometry.morphAttributes).length;

// what a geometry can be merged with: its index, and each attribute's name and form
const layout = (g) =>
  `${g.index ? 'i' : 'n'}|${Object.entries(g.attributes)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, a]) => `${k}:${a.itemSize}:${a.normalized ? 1 : 0}:${(a.isInterleavedBufferAttribute ? a.data.array : a.array).constructor.name}`)
    .join(',')}`;

// shown, and under no LOD and nothing hidden, up to the group
const free = (o, group) => {
  for (let p = o; p && p !== group; p = p.parent) if (!p.visible || p.isLOD) return false;
  return true;
};

export function createMerge(group, { frames = 60 } = {}) {
  const inv = new THREE.Matrix4();
  // each candidate's matrix in the group's frame
  const rel = (o, out) => out.copy(o.matrixWorld).premultiply(inv);
  const read = () => {
    group.updateWorldMatrix(true, true);
    inv.copy(group.matrixWorld).invert();
  };
  read();
  const watched = new Map(); // mesh → its first matrix in the group
  group.traverse((o) => mergeable(o) && free(o, group) && watched.set(o, rel(o, new THREE.Matrix4())));
  const moved = new Set();
  const made = []; // the merged meshes, ours to free
  const stats = { merged: 0, into: 0, kept: 0 };
  const tmp = new THREE.Matrix4();
  let left = frames;

  const merge = () => {
    const buckets = new Map();
    for (const [o, m] of watched) {
      if (moved.has(o) || !o.parent || m.determinant() <= 0) continue;
      const key = `${o.material.uuid}|${o.renderOrder}|${o.castShadow}|${o.receiveShadow}|${o.layers.mask}|${o.frustumCulled}|${layout(o.geometry)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push([o, m]);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const parts = list.map(([o, m]) => o.geometry.clone().applyMatrix4(m));
      const geometry = mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      if (!geometry) continue;
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();
      const mesh = new THREE.Mesh(geometry, list[0][0].material);
      mesh.name = 'landmark-merged';
      const first = list[0][0];
      Object.assign(mesh, { renderOrder: first.renderOrder, castShadow: first.castShadow, receiveShadow: first.receiveShadow, frustumCulled: first.frustumCulled });
      mesh.layers.mask = first.layers.mask;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      made.push(mesh);
      for (const [o] of list) o.removeFromParent();
      stats.merged += list.length;
      stats.into++;
    }
    group.traverse((o) => o.isMesh && !made.includes(o) && stats.kept++);
    watched.clear();
  };

  return {
    tick() {
      if (left <= 0) return false;
      read();
      for (const [o, m] of watched) if (!moved.has(o) && (!rel(o, tmp).equals(m) || !free(o, group))) moved.add(o);
      if (--left > 0) return false;
      merge();
      return true;
    },
    stats: () => ({ ...stats }),
    dispose() {
      for (const m of made) {
        m.removeFromParent();
        m.geometry.dispose();
      }
      made.length = 0;
    },
  };
}
