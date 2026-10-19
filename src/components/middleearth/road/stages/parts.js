// The stages’ building blocks, shared from the second stage on: a geometry
// in one colour moved into place (its colour in its vertices, so a stage’s
// statics merge into one mesh on one material), and that merge.
//
//   part(geometry, colour, { at, yaw, pitch, roll, scale }) → BufferGeometry
//   merged(parts, material, name) → THREE.Mesh, or null for no parts
//   mergeStatics(root, { keep }) → root: the chapters’ builders make a
//     mesh a material a building (a Bree house is a dozen); this merges
//     every still mesh under root into one a material (and a set of
//     attributes), in root’s frame, leaving what `keep` holds (the parts a
//     scene moves), instanced and skinned meshes as they were
//   disposeBuilt(root, K): the geometry under root, and the materials (and
//     their maps) a builder made for itself (a sign, a hatch) rather than
//     took from the kit, which the kit’s own dispose frees
//   canopy(heightAt, { x: [x0, x1], z: [z0, z1], rise, cells }) → BufferGeometry: the
//     body of a standing crop a field across, a rippled sheet of ripe ears
//     `rise` over the land, gold with a field’s light and dark, its x0 edge
//     (the lane’s, under the clumps there) dropping to the ground; faces up
//     whichever way x runs (a few thousand triangles where clumps would be millions)
//   waterOn(land, i) → (x, z) → the height of the land’s i-th river’s water
//     there, or null off it: what carries a boat
//   C(hex) → THREE.Color

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { nearestOn } from '../../../../lib/land/paths.js';
import { riverLevel } from '../terrain';

export const C = (hex) => new THREE.Color(hex);

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const p = new THREE.Vector3();
const s = new THREE.Vector3();

export function part(geometry, colour, { at = [0, 0, 0], yaw = 0, pitch = 0, roll = 0, scale = [1, 1, 1] } = {}) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colour.toArray(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  m.compose(p.set(...at), q.setFromEuler(e.set(pitch, yaw, roll, 'YXZ')), s.set(...scale));
  return g.applyMatrix4(m);
}

export function merged(parts, material, name) {
  if (!parts.length) return null;
  const mesh = new THREE.Mesh(mergeGeometries(parts), material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const SHARED = ['position', 'normal', 'uv', 'color'];

export function mergeStatics(root, { keep = [] } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const kept = new Set();
  for (const k of keep) k?.traverse((o) => kept.add(o));
  const buckets = new Map();
  const gone = [];
  // (a hidden part, or one under a hidden group, is left as it is: a scene may show it)
  root.traverseVisible((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || kept.has(o) || Array.isArray(o.material)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!SHARED.includes(name)) g.deleteAttribute(name);
    g.morphAttributes = {};
    g.clearGroups();
    g.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    const key = `${Object.keys(g.attributes).sort().join()}`;
    if (!buckets.has(o.material)) buckets.set(o.material, new Map());
    const by = buckets.get(o.material);
    if (!by.has(key)) by.set(key, { geos: [], cast: false, receive: false });
    const b = by.get(key);
    b.geos.push(g);
    b.cast ||= o.castShadow;
    b.receive ||= o.receiveShadow;
    gone.push(o);
  });
  for (const o of gone) o.removeFromParent();
  for (const [material, by] of buckets)
    for (const { geos, cast, receive } of by.values()) {
      const mesh = new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], material);
      mesh.name = `${root.name || 'statics'}:${material.name || material.type}`;
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      root.add(mesh);
      if (geos.length > 1) for (const g of geos) g.dispose();
    }
  return root;
}

export function disposeBuilt(root, K) {
  const kit = new Set(Object.values(K?.mats ?? {}));
  const done = new Set();
  root.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [o.material].flat()) {
      if (!m || kit.has(m) || done.has(m)) continue;
      done.add(m);
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  });
}

export function canopy(heightAt, { x: [x0, x1], z: [z0, z1], rise = 0.95, cells = [34, 60] }) {
  const [nx, nz] = cells;
  const g = new THREE.PlaneGeometry(1, 1, nx, nz);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;
    const v = pos.getY(i) + 0.5;
    const x = x0 + (x1 - x0) * u;
    const z = z0 + (z1 - z0) * v;
    const ripple = Math.sin(x * 0.9 + z * 0.4) * 0.08 + Math.sin(z * 1.7 - x * 0.3) * 0.06 + (((i * 7919) % 13) / 13) * 0.12;
    pos.setXYZ(i, x, heightAt(x, z) + (rise + ripple) * Math.min(1, u * 6), z);
    c.setRGB(0.78, 0.62, 0.3).offsetHSL(0, 0, ripple * 0.6 - 0.04);
    c.toArray(col, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  // (laid with x running toward +x it faces down: its faces turned up)
  if (x1 > x0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  }
  g.computeVertexNormals();
  const flat = g.toNonIndexed();
  g.dispose();
  return flat;
}

export function waterOn(land, i) {
  const r = land.rivers?.[i];
  if (!r) return () => null;
  const level = riverLevel(land.field, r);
  return (x, z) => {
    const { m, d } = nearestOn(r.line, x, z);
    return d <= r.width / 2 ? level(m) : null;
  };
}
