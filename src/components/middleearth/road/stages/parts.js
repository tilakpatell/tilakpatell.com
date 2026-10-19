// The stages’ building blocks, shared from the second stage on: a geometry
// in one colour moved into place (its colour in its vertices, so a stage’s
// statics merge into one mesh on one material), and that merge. Hobbiton
// keeps its own copy in its props.js, written before this was.
//
//   part(geometry, colour, { at, yaw, pitch, roll, scale }) → BufferGeometry
//   merged(parts, material, name) → THREE.Mesh, or null for no parts
//   mergeStatics(root, { keep }) → root: the chapters’ builders make a
//     mesh a material a building (a Bree house is a dozen); this merges
//     every still mesh under root into one a material (and a set of
//     attributes), in root’s frame, leaving what `keep` holds (the parts a
//     scene moves), instanced and skinned meshes as they were
//   C(hex) → THREE.Color

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || kept.has(o) || Array.isArray(o.material) || !o.visible) return;
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
