// push.js on the node renderer: the same front and pool (./pushCore.js),
// drawn by a MeshBasicNodeMaterial with the same flags and its uniforms on
// `material.uniforms` too, so the frame's `u.uAge.value = age` writes them
// as before. Its rim line for line with push.js's GLSL.
//
// createPush(parent) → { ready: Promise, push(from, dir, { colour, pull, reach }) → bool, update(dt), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, dot, float, normalViewGeometry, normalize, positionViewDirection, pow, uniform } from 'three/tsl';
import { createPushWith } from './pushCore';

// a front's material: its colour, and its age (0…1) the frame writes
// (exported for the twins' comparison: scripts/twin-parity)
export function pushMaterial() {
  const u = { uColour: uniform(new THREE.Color()), uAge: uniform(1) };
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const rim = pow(abs(dot(normalize(normalViewGeometry), positionViewDirection)).oneMinus(), 3);
  const k = u.uAge.oneMinus();
  // (never over the bloom's threshold: a wave of air, not a light)
  mat.colorNode = u.uColour.mul(rim).mul(k).mul(k).mul(1.2);
  mat.opacityNode = float(1);
  mat.uniforms = u;
  return mat;
}

export const createPush = (parent) => createPushWith(pushMaterial, parent);
