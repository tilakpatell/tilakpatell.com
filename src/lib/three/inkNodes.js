// ink.js on the node renderer: the ink line round the cast (an inverted
// hull pushed out along its own smoothed normals) and a rim of light on
// them, as node materials and hooks (./hookNodes.js), with the same names,
// arguments and uniforms. smoothNormals is ink.js's, copied: importing it
// would bring its GLSL into a 'nodes' world's closure.
//
//   smoothNormals(geometry) → geometry (its `inkNormal`)
//   inkHull(root, width, { clipY, color }) → the hull's MeshBasicNodeMaterial
//   rimToon(material, { color, power, strength }) → the node material

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Discard, If, attribute, clamp, diffuseColor, dot, normalLocal, normalView, normalize, positionGeometry, positionViewDirection, pow, transformNormalToView, uniform } from 'three/tsl';
import { asNode, onColor, onLight, onPosition, wrap } from './hookNodes';

const INK = 0x1b1424;

// `inkNormal` for a geometry (once: it's kept on the geometry, which clones
// of a figure share). Returns the geometry.
export function smoothNormals(geometry) {
  if (geometry.attributes.inkNormal) return geometry;
  const pos = geometry.attributes.position;
  const n = pos.count;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const step = Math.max(1e-9, (geometry.boundingSphere?.radius || 1) * 1e-4);
  // which welded point each vertex is
  const keys = new Map();
  const weld = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) / step)},${Math.round(pos.getY(i) / step)},${Math.round(pos.getZ(i) / step)}`;
    let w = keys.get(k);
    if (w === undefined) keys.set(k, (w = keys.size));
    weld[i] = w;
  }
  const sum = new Float32Array(keys.size * 3);
  const index = geometry.index;
  const tris = index ? index.count / 3 : n / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const face = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const corners = [a, b, c];
  for (let t = 0; t < tris; t++) {
    const ids = [0, 1, 2].map((j) => (index ? index.getX(t * 3 + j) : t * 3 + j));
    ids.forEach((id, j) => corners[j].fromBufferAttribute(pos, id));
    face.subVectors(c, b).cross(e1.subVectors(a, b));
    if (face.lengthSq() === 0) continue;
    face.normalize();
    // each corner's share: the angle the face makes there
    for (let j = 0; j < 3; j++) {
      e1.subVectors(corners[(j + 1) % 3], corners[j]);
      e2.subVectors(corners[(j + 2) % 3], corners[j]);
      const angle = e1.angleTo(e2);
      if (!Number.isFinite(angle)) continue;
      const w = weld[ids[j]] * 3;
      sum[w] += face.x * angle;
      sum[w + 1] += face.y * angle;
      sum[w + 2] += face.z * angle;
    }
  }
  const out = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const w = weld[i] * 3;
    v.set(sum[w], sum[w + 1], sum[w + 2]);
    if (v.lengthSq() === 0) v.set(0, 1, 0);
    v.normalize();
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  geometry.setAttribute('inkNormal', new THREE.BufferAttribute(out, 3));
  return geometry;
}

// An ink line round every mesh under `root`, skinned or not: their back
// faces drawn flat, pushed out along `inkNormal` once posed, in view space
// (so `width` is in the scene's units whatever scale the model or its
// skeleton has). None above `clipY`, in the meshes' own units (the
// cruiser's glass). Returns the material, for the caller to dispose.
export function inkHull(root, width, { clipY = null, color = INK } = {}) {
  const mat = new MeshBasicNodeMaterial({ color, side: THREE.BackSide });
  // (the ink's normals in for the geometry's, before three skins and
  // instances them, so a skinned mesh bends them with its bones)
  onPosition(mat, (p) => {
    normalLocal.assign(attribute('inkNormal', 'vec3'));
    return p;
  }, `ink-${width.toFixed(4)}-${clipY}`);
  // pushed out along them in view space, after the projection's view position
  wrap(mat, 'setupPositionView', (pv) => pv.add(normalize(transformNormalToView(normalLocal)).mul(width)), 'ink:push');
  if (clipY != null) {
    onColor(mat, () => {
      If(positionGeometry.y.toVarying('vInkY').greaterThan(clipY), () => Discard());
      return null;
    }, 'ink:clip');
  }
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.ink) meshes.push(o);
  });
  for (const o of meshes) {
    smoothNormals(o.geometry);
    let h;
    if (o.isSkinnedMesh) {
      h = new THREE.SkinnedMesh(o.geometry, mat);
      h.bind(o.skeleton, o.bindMatrix);
      h.bindMode = o.bindMode;
    } else h = new THREE.Mesh(o.geometry, mat);
    h.userData.ink = true;
    h.userData.noPaint = true;
    h.frustumCulled = false;
    h.castShadow = false;
    h.position.copy(o.position);
    h.quaternion.copy(o.quaternion);
    h.scale.copy(o.scale);
    o.parent.add(h);
  }
  return mat;
}

// A rim of light round a toon material's edges (opaque_fragment's line: the
// light out plus the rim, by how far the surface turns from the eye), kept
// with whatever hooks the material has. A classic material comes back as
// its node twin: use what's returned.
export function rimToon(material, { color = 0xffffff, power = 3, strength = 0.35 } = {}) {
  const m = asNode(material);
  const rim = { rimColor: uniform(new THREE.Color(color)), rimPower: uniform(power), rimStrength: uniform(strength) };
  m.userData.rim = rim;
  onLight(
    m,
    (light) => light.add(rim.rimColor.mul(diffuseColor.rgb).mul(pow(clamp(dot(normalView, positionViewDirection), 0, 1).oneMinus(), rim.rimPower)).mul(rim.rimStrength)),
    'rim',
    rim,
  );
  return m;
}
