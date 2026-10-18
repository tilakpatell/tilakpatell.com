// ../../../towns/marshes/propsShaders.js on the node renderer: the drowned
// faces, their GLSL line for line in TSL, the same names. The uniforms keep
// the GLSL’s names on `material.uniforms` (uniform nodes, so face()’s
// `.value` writes land; uMap the picture’s texture node). Each face is a
// fresh node material, as each was a fresh ShaderMaterial. The face is
// drawn where it lies but its depth taken `uLift` m higher, as the GLSL
// wrote gl_Position.z: here the vertex’s clip position, whole.

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  cos,
  dot,
  length,
  max,
  min,
  modelWorldMatrix,
  normalGeometry,
  normalize,
  positionGeometry,
  sin,
  texture,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

// A face’s material, `map` its picture; ./props.js’s face() writes its
// uniforms (uTime, uK) every frame.
export function faceMaterial(map) {
  const uniforms = {
    uTime: uniform(0),
    uK: uniform(0),
    uLift: uniform(0.72),
    uTint: uniform(new THREE.Color(0xa4c4b8)),
  };
  const u = uniforms;
  // (tonemapped and in colour space, as the GLSL’s chunks had it)
  const m = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  const p0 = positionGeometry;
  const p = vec3(
    p0.x.add(sin(u.uTime.mul(0.7).add(p0.z.mul(9))).mul(0.006)),
    p0.y,
    p0.z.add(cos(u.uTime.mul(0.6).add(p0.x.mul(8))).mul(0.006)),
  );
  m.positionNode = p;
  const wp = modelWorldMatrix.mul(vec4(p, 1));
  const vN = varying(
    normalize(modelWorldMatrix.mul(vec4(normalGeometry, 0)).xyz),
    "vN",
  );
  const clip = cameraProjectionMatrix.mul(cameraViewMatrix.mul(wp));
  const ray0 = wp.xyz.sub(cameraPosition);
  const dist = length(ray0);
  const ray = ray0.div(dist);
  const lift = min(u.uLift.div(max(0.15, ray.y.negate())), dist.mul(0.8));
  const cl = cameraProjectionMatrix.mul(
    cameraViewMatrix.mul(vec4(wp.xyz.sub(ray.mul(lift)), 1)),
  );
  m.vertexNode = vec4(clip.x, clip.y, cl.z.div(cl.w).mul(clip.w), clip.w);
  const vUv = uv();
  const at = vUv.add(
    vec2(
      sin(u.uTime.mul(1.3).add(vUv.y.mul(18))),
      cos(u.uTime.mul(1.1).add(vUv.x.mul(15))),
    ).mul(0.006),
  );
  const c = texture(map, at);
  uniforms.uMap = c;
  const lit = max(dot(normalize(vN), normalize(vec3(0.3, 1.0, -0.4))), 0)
    .mul(0.38)
    .add(0.62);
  m.colorNode = vec4(c.rgb.mul(u.uTint).mul(lit), c.a.mul(u.uK));
  m.uniforms = uniforms;
  return m;
}
