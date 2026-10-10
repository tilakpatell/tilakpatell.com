// What the surface's node materials share: the GLSL's habits written once
// in TSL, so each port reads line for line against the shader it replaced.
//
//   rev(a, b, x)        GLSL's smoothstep(a, b, x) with a > b (falling), defined on every backend
//   held(list)          a uniform array as the GLSL had it ({ value: [...] }), with a node an element
//                       sharing the element's object, so a caller's .value[i].copy(…) reaches the shader
//   onFar(material)     drawn on the far plane, behind everything (gl_Position.z = gl_Position.w)

import { cameraProjectionMatrix, cameraViewMatrix, modelWorldMatrix, positionLocal, smoothstep, uniform, vec4 } from 'three/tsl';

export const rev = (a, b, x) => smoothstep(b, a, x).oneMinus();

export function held(list) {
  return { value: list, nodes: list.map((v) => uniform(v)) };
}

export function onFar(material) {
  const clip = cameraProjectionMatrix.mul(cameraViewMatrix).mul(modelWorldMatrix.mul(vec4(positionLocal, 1)));
  material.vertexNode = vec4(clip.xy, clip.w, clip.w);
  return material;
}
