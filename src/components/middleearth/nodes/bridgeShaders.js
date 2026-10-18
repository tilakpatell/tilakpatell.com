// ../bridgeShaders.js on the node renderer: the ward in TSL, line for line
// with the GLSL, its `opacity` a uniform node on `material.uniforms` (the
// bridge writes `.value` there, as before). The tone map and the output
// colour space are the renderer’s own, as the GLSL’s chunks were; a
// ShaderMaterial never took fog.

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  abs,
  dot,
  normalViewGeometry,
  normalize,
  positionView,
  pow,
  uniform,
  varying,
  vec3,
} from "three/tsl";

// the staff's ward: a shell of light, bright at its rim
export function wardMaterial() {
  const uniforms = { opacity: uniform(0) };
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const vN = varying(normalViewGeometry, "vN");
  const vV = varying(normalize(positionView.negate()), "vV");
  const rim = pow(abs(dot(normalize(vN), normalize(vV))).oneMinus(), 2.2);
  mat.colorNode = vec3(1.5, 2.1, 3.2).mul(rim.add(0.06));
  mat.opacityNode = uniforms.opacity;
  mat.uniforms = uniforms;
  return mat;
}
