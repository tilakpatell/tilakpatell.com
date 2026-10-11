// Foliage's normals, the geometry half of foliage.js (moved here so a world
// on either renderer reaches them without the other's shading:
// foliage.js and foliageNodes.js re-export them).
//
//   spherifyNormals(geometry, { centre, radii, keep })  normals out from an ellipsoid (pure)
//   liftNormals(geometry, { keep })                     normals turned up, as a lawn's (pure)

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

// Every vertex's normal pointed out from the middle of an ellipsoid round the
// geometry (its bounding box's, unless `centre` and `radii` are given), with
// `keep` of its own normal left in: 0 is a smooth ball, 1 is as it was. A
// little kept stops a crown reading as one plastic sphere. Changes the
// geometry's normals in place and gives it back.
export function spherifyNormals(geometry, { centre = null, radii = null, keep = 0.25 } = {}) {
  const pos = geometry.attributes.position;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nrm = geometry.attributes.normal;
  let c = centre;
  let r = radii;
  if (!c || !r) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    c ??= box.getCenter(new THREE.Vector3());
    r ??= box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  }
  const inv = new THREE.Vector3(1 / Math.max(1e-6, r.x), 1 / Math.max(1e-6, r.y), 1 / Math.max(1e-6, r.z));
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(c).multiply(inv);
    if (v.lengthSq() < 1e-12) v.copy(UP);
    v.normalize();
    n.fromBufferAttribute(nrm, i);
    v.multiplyScalar(1 - keep).addScaledVector(n, keep);
    if (v.lengthSq() < 1e-12) v.copy(UP);
    v.normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  nrm.needsUpdate = true;
  return geometry;
}

// Every normal turned toward straight up, `keep` of its own left: blades
// and spiky leaves lit as the ground they grow from, not as the hundred
// edges they are. In place; gives the geometry back.
export function liftNormals(geometry, { keep = 0.25 } = {}) {
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nrm = geometry.attributes.normal;
  const n = new THREE.Vector3();
  for (let i = 0; i < nrm.count; i++) {
    n.fromBufferAttribute(nrm, i).multiplyScalar(keep).addScaledVector(UP, 1 - keep);
    if (n.lengthSq() < 1e-12) n.copy(UP);
    n.normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  nrm.needsUpdate = true;
  return geometry;
}
