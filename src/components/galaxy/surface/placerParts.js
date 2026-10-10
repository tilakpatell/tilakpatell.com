// The placer's pieces that hold no state of a placer's own (placer.js
// re-exports what the rest of the galaxy imports from it): a thing hung
// clear of the fog, a cluster's members, the far-off light copy (a
// THREE.LOD), a kit model's footprint, a model's radius, what a built thing
// adds to the world, and the instancing helpers.

import * as THREE from 'three';

// a solid in the world from one in the thing's own frame
export function addSolid(world, s, at, yaw, scale, top) {
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const tx = (x, z) => [at[0] + (x * c + z * sn) * scale, at[2] + (-x * sn + z * c) * scale];
  const opt = { top: s.top != null ? at[1] + s.top * scale : top, base: s.base != null ? at[1] + s.base * scale : null, tag: s.tag ?? null };
  if (s.circle) {
    const [x, z] = tx(s.circle[0], s.circle[1]);
    world.solids.circle(x, z, s.circle[2] * scale, opt);
  } else if (s.box) {
    const [x, z] = tx(s.box[0], s.box[1]);
    world.solids.box(x, z, s.box[2] * scale, s.box[3] * scale, yaw + (s.box[4] ?? 0), opt);
  }
}

// something hung in the sky, far past where the fog would swallow it: its
// materials drawn clear of it (the copies share a model's materials, so
// every copy of that model on this page is; only sky things are placed so)
export function unfogged(o) {
  o.traverse((m) => {
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (!mat.fog) continue;
      mat.fog = false;
      mat.needsUpdate = true;
    }
    m.castShadow = false;
    m.receiveShadow = false;
  });
}

// A cluster's members (a catalogue entry's `cluster`: [kind, x, z, yaw, y]
// in its own frame, metres) as things to put: where the cluster stands,
// turned by its yaw and scaled by its scale
export function clusterSpecs(spec, members) {
  const yaw = spec.yaw ?? 0;
  const k = spec.scale ?? 1;
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  return members.map(([kind, x, z, turn = 0, y = 0]) => ({ ...spec, kind, at: [spec.at[0] + (x * c + z * sn) * k, spec.at[1] + (-x * sn + z * c) * k], yaw: yaw + turn, y: (spec.y ?? 0) + y * k, opts: undefined }));
}

// Far away, a model's light copy (<kind>.lod1.glb: a quarter of its
// triangles, its maps half the size). The switch is three times its radius
// out, and never nearer than 60 m.
export const lodDistance = (radius) => Math.max(60, 3 * radius);
// a THREE.LOD in the model's place: its position, turn and scale move up
// to the LOD, so either level is drawn in the same spot (`low` now, or
// later with addLowLevel)
export function withLod(full, low, radius) {
  const lod = new THREE.LOD();
  lod.name = full.name;
  lod.position.copy(full.position);
  lod.quaternion.copy(full.quaternion);
  lod.scale.copy(full.scale);
  full.parent?.remove(full);
  full.position.set(0, 0, 0);
  full.quaternion.identity();
  full.scale.set(1, 1, 1);
  lod.addLevel(full, 0);
  if (low) addLowLevel(lod, low, radius);
  return lod;
}
export function addLowLevel(lod, low, radius) {
  low.position.set(0, 0, 0);
  low.quaternion.identity();
  low.scale.set(1, 1, 1);
  lod.addLevel(low, lodDistance(radius));
}
// A kit model's footprint at scale 1, from its parts and its manifest row: a
// tree's its trunk (`trunk`, the row's, where it has one), so you walk under
// its crown; anything else's as a kind's model's, from its box (solid a
// little inside its edges, seated by a little more).
// → { trunk (null but for a tree), radius (solid), seat }
export function kitFootprint(parts, row) {
  const trunk = row?.kind === 'tree' && row.trunk > 0 ? row.trunk : null;
  if (trunk) return { trunk, radius: trunk, seat: trunk };
  const box = new THREE.Box3();
  for (const p of parts) {
    if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
    box.union(p.geometry.boundingBox.clone().applyMatrix4(p.local ?? new THREE.Matrix4()));
  }
  const size = box.getSize(new THREE.Vector3());
  const side = Math.min(size.x, size.z);
  return { trunk: null, radius: side * 0.35, seat: side * 0.45 };
}

// a model's radius (its bounding sphere's, measured once)
export function radiusOf(gltf) {
  const root = gltf.scene;
  if (root.userData.radius == null) root.userData.radius = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere()).radius;
  return root.userData.radius;
}

// What a built thing (props/*.js: { object, solids, floors, update, signal })
// adds to the world, set where it stands (`at`), turned by spec.yaw and
// scaled by spec.scale: its walls (unless spec.solid is false) and the floors
// you walk on, and, when its own meshes are drawn (`object`), its moving
// parts (an update each frame, an answer to signals).
export function applyBuilt(made, spec, at, world, sinks) {
  const { updates, signals, object } = sinks;
  const yaw = spec.yaw ?? 0;
  const k = spec.scale ?? 1;
  if (spec.solid !== false) for (const s of made.solids ?? []) addSolid(world, s, at, yaw, k, null);
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  for (const f of made.floors ?? []) {
    const placed = { ...f, x: at[0] + (f.x * c + f.z * sn) * k, z: at[2] + (-f.x * sn + f.z * c) * k, y: at[1] + f.y * k, r: f.r != null ? f.r * k : undefined, hw: f.hw != null ? f.hw * k : undefined, hd: f.hd != null ? f.hd * k : undefined, yaw: f.r != null ? undefined : (f.yaw ?? 0) + yaw };
    // (one that `moves`, a platform the builder lowers in its update: its
    // height read from the builder's own floor, live)
    if (f.moves) Object.defineProperty(placed, 'y', { get: () => at[1] + f.y * k, enumerable: true });
    world.floors.push(placed);
  }
  if (!object) return;
  // (one that `follows` you, a planet's shelling, is told where you are;
  // the rest have a third word of their own, a creature's pace)
  if (made.update) (made.follows && sinks.follows ? sinks.follows : updates).push(made.update);
  if (made.signal) signals.push(made.signal);
}

// the instances `which` of an instanced mesh, from its kept matrices `src`
export function copyInstances(mesh, src, which) {
  const dst = mesh.instanceMatrix.array;
  for (let k = 0; k < which.length; k++) dst.set(src.subarray(which[k] * 16, which[k] * 16 + 16), k * 16);
  mesh.count = which.length;
  mesh.instanceMatrix.needsUpdate = true;
}

// a built prop's meshes as instancing parts (for scattering a built kind)
export function partsOf(made) {
  const out = [];
  made.object.updateMatrixWorld(true);
  made.object.traverse((o) => {
    if (o.isMesh) out.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone(), shadow: o.castShadow });
  });
  return out;
}
