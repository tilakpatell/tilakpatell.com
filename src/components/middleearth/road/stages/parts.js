// The stages’ building blocks, shared from the second stage on: a geometry
// in one colour moved into place (its colour in its vertices, so a stage’s
// statics merge into one mesh on one material), and that merge. Hobbiton
// keeps its own copy in its props.js, written before this was.
//
//   part(geometry, colour, { at, yaw, pitch, roll, scale }) → BufferGeometry
//   merged(parts, material, name) → THREE.Mesh, or null for no parts
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
