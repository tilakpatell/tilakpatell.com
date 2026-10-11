// The heroes-versus-villains mission's shader as nodes
// (../missions/hvvScene.js): the arena's edge, a soft wall of light
// standing off the ground, line for line, its uniforms on
// `material.uniforms` too (the frame writes uniforms.uTime.value). The
// wall's geometry is hvvScene.js's wallGeometry, whose `v` (0 at the
// ground, 1 at the top) it reads.
//
//   wallMaterial(color) → material (.uniforms: uColor, uTime)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, sin, uniform } from 'three/tsl';

export function wallMaterial(color = '#bcd8ff') {
  const u = { uColor: uniform(new THREE.Color(color)), uTime: uniform(0) };
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const vV = attribute('v', 'float');
  const fade = vV.oneMinus();
  material.colorNode = u.uColor.mul(1.6);
  material.opacityNode = fade.mul(fade).mul(sin(u.uTime.mul(1.6).add(vV.mul(6))).mul(0.08).add(0.32));
  material.uniforms = u;
  return material;
}
