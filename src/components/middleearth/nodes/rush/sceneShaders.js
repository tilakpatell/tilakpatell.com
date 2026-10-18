// ../../rush/sceneShaders.js on the node renderer: the ring over a station
// in TSL, line for line with the GLSL, its uniforms uniform nodes under the
// GLSL’s names on `material.uniforms`, so the scene’s `.value` writes still
// land. The GLSL had no tone-mapping chunk, so neither does this
// (toneMapped: false), and a ShaderMaterial never took fog.

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Discard,
  Fn,
  atan,
  length,
  mix,
  select,
  smoothstep,
  step,
  uniform,
  uv,
  vec3,
} from "three/tsl";

// A ring over a station, filling clockwise from the top.
export function ringMaterial() {
  const uniforms = {
    uK: uniform(0),
    uCol: uniform(new THREE.Color()),
    uFlash: uniform(0),
  };
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const u = uniforms;
  const p = uv().mul(2).sub(1);
  const r = length(p);
  mat.colorNode = Fn(() => {
    Discard(r.greaterThan(1));
    const a = atan(p.x, p.y).div(6.2831853).add(0.5);
    const back = vec3(0.08, 0.06, 0.05);
    const col = select(
      r.lessThan(0.6),
      back,
      select(a.greaterThan(u.uK.oneMinus()), u.uCol, vec3(0.22, 0.2, 0.18)),
    );
    return mix(col, vec3(1, 0.25, 0.15), u.uFlash.mul(step(0.6, r)));
  })();
  // (the GLSL’s smoothstep(1.0, 0.92, r), its edges put in order for WGSL)
  mat.opacityNode = smoothstep(0.92, 1, r).oneMinus().mul(0.95);
  mat.uniforms = uniforms;
  return mat;
}
