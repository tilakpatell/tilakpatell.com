// The assault mission's shaders as nodes (../missions/assaultScene.js): a
// command post's column of light and the meter that fills round its ring,
// line for line, their uniforms on `material.uniforms` too (the frame code
// writes uniforms.uColor.value, uFill.value).
//
//   columnMaterial(color, alpha) → material (.uniforms: uColor, uTime, uAlpha)
//   meterMaterial(color) → material (.uniforms: uColor, uFill)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, atan, float, positionGeometry, pow, sin, uniform, uv } from 'three/tsl';

export function columnMaterial(color, alpha) {
  const u = { uColor: uniform(new THREE.Color(color)), uTime: uniform(0), uAlpha: uniform(alpha) };
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const vUv = uv();
  const edge = abs(vUv.x.sub(0.5)).mul(2).oneMinus();
  const a = pow(edge, 1.6).mul(vUv.y.oneMinus()).mul(sin(u.uTime.mul(2).sub(vUv.y.mul(10))).mul(0.2).add(0.5)).mul(u.uAlpha);
  material.colorNode = u.uColor.mul(2);
  material.opacityNode = a;
  material.uniforms = u;
  return material;
}

// a ring that fills round from the top, by uFill (0…1)
export function meterMaterial(color) {
  const u = { uColor: uniform(new THREE.Color(color)), uFill: uniform(1) };
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const ang = atan(positionGeometry.x, positionGeometry.y).toVarying('vAng');
  const k = ang.add(3.14159265).div(6.2831853);
  material.colorNode = u.uColor.mul(2.4);
  material.opacityNode = float(0.85);
  material.maskNode = k.lessThanEqual(u.uFill);
  material.uniforms = u;
  return material;
}
