// The surface's activity's shader as nodes (../activity.js): the beam of
// light standing on a spot, line for line, its uniforms on
// `material.uniforms` too (the frame code writes uniforms.uTime.value).
//
//   beamMaterial(color) → material (.uniforms: uColor, uTime)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, pow, sin, uniform, uv } from 'three/tsl';

export function beamMaterial(color) {
  const u = { uColor: uniform(new THREE.Color(color)), uTime: uniform(0) };
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const vUv = uv();
  const edge = abs(vUv.x.sub(0.5)).mul(2).oneMinus();
  const a = pow(edge, 2).mul(vUv.y.oneMinus()).mul(sin(u.uTime.mul(3).sub(vUv.y.mul(12))).mul(0.25).add(0.55));
  material.colorNode = u.uColor.mul(2.2);
  material.opacityNode = a;
  material.uniforms = u;
  return material;
}
