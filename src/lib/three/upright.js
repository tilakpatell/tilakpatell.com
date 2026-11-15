// A thing that faces the eye and stays upright: a glow, a corona, a cloud of
// gas turned toward where the camera is (not the way its screen faces) and
// kept square to the world's up, never the camera's. Turned with the
// camera's own turn (its roll: a bank, a barrel roll), a sun's streamers and
// a nebula's clouds spun on the sky each time the ship banked; turned to the
// camera's plane rather than its place, they swung as it flew past. Facing
// its place is also how a round thing really looks: a sphere's outline is a
// circle square to the line from the eye, wherever it is on the screen.
//
//   uprightBasis(centre, eye) → { right, up, toward } (unit [x, y, z]s, in
//     the world's axes; `toward` from the centre to the eye, `right` level)
//   faceUpright(obj, eye, q?) turns obj (a plane facing +z) so, under its
//     parent's turn; eye the camera's world position
//   UPRIGHT_GLSL: vec3 upright(vec3 centre, vec2 offset), the same in a
//     vertex shader, centre and the result in world space (cameraPosition)
//
// Looking straight down or up at it (within about two degrees) the world's
// up is no use, and the world's -z stands in.

import * as THREE from 'three';

const NEAR_POLE = 0.9995;

const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 1];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function uprightBasis(centre, eye) {
  const toward = unit([eye[0] - centre[0], eye[1] - centre[1], eye[2] - centre[2]]);
  const ref = Math.abs(toward[1]) > NEAR_POLE ? [0, 0, -1] : [0, 1, 0];
  const right = unit(cross(ref, toward));
  return { right, up: cross(toward, right), toward };
}

const at = new THREE.Vector3();
const basis = new THREE.Matrix4();
const parentQ = new THREE.Quaternion();
const vx = new THREE.Vector3();
const vy = new THREE.Vector3();
const vz = new THREE.Vector3();

export function faceUpright(obj, eye, q = new THREE.Quaternion()) {
  obj.getWorldPosition(at);
  const { right, up, toward } = uprightBasis(at.toArray(), [eye.x, eye.y, eye.z]);
  basis.makeBasis(vx.fromArray(right), vy.fromArray(up), vz.fromArray(toward));
  q.setFromRotationMatrix(basis);
  if (obj.parent) {
    obj.parent.getWorldQuaternion(parentQ);
    q.premultiply(parentQ.invert());
  }
  obj.quaternion.copy(q);
  return obj;
}

export const UPRIGHT_GLSL = /* glsl */ `
vec3 upright(vec3 centre, vec2 offset) {
  vec3 f = cameraPosition - centre;
  float l = length(f);
  f = l > 1e-6 ? f / l : vec3(0.0, 0.0, 1.0);
  vec3 ref = abs(f.y) > ${NEAR_POLE} ? vec3(0.0, 0.0, -1.0) : vec3(0.0, 1.0, 0.0);
  vec3 r = normalize(cross(ref, f));
  return centre + r * offset.x + cross(f, r) * offset.y;
}`;
