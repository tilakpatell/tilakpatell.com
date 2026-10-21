// A ghost's material for the node renderer (WebGPU, or WebGL 2 under it):
// ./ghosts.js's pale and its rim of light, made of nodes, since that renderer
// runs no GLSL (an onBeforeCompile is passed over, and the rim with it). The
// numbers are ./ghostLook.js's, the same the GLSL reads. A world on the node
// renderer draws its ghosts with ./ghostsOf.js and this as its `paint`
// (middleearth/shared/ghostsOf.js and ghostNodes.js), never ghosts.js, whose
// GLSL its closure mustn't reach (runtime/shading.test.js).
//
//   ghostNodeMaterial({ glowStrength }?) → a MeshStandardNodeMaterial

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { abs, dot, float, materialEmissive, normalView, positionViewDirection, pow, vec3 } from 'three/tsl';
import { GHOST } from './ghostLook';

export function ghostNodeMaterial({ glowStrength = GHOST.glowStrength } = {}) {
  const m = new MeshStandardNodeMaterial({ color: new THREE.Color(GHOST.tint), emissive: new THREE.Color(GHOST.glow), emissiveIntensity: glowStrength, roughness: GHOST.roughness, transparent: true, opacity: 0, depthWrite: false });
  // the glow as ever, and the rim on top of it: 1 − |n · v|, to its power
  // (the GLSL's `normal` and `vViewPosition` are these two, in view space)
  const rim = pow(float(1).sub(abs(dot(normalView, positionViewDirection))), GHOST.rimPower);
  m.emissiveNode = materialEmissive.add(vec3(...GHOST.rim).mul(rim).mul(GHOST.rimStrength));
  return m;
}
