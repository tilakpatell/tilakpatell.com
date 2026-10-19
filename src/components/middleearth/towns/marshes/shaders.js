// The Marshes’ shader, for the chapter’s classic renderer: the drowned
// faces under the water. The builders reach it through the kit
// (K.shaders), so the builders’ files carry no GLSL and a ‘nodes’ world may
// build with them on its own materials.

import * as THREE from 'three';

const FACE_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime, uLift;
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.xz += vec2(sin(uTime * 0.7 + p.z * 9.0), cos(uTime * 0.6 + p.x * 8.0)) * 0.006;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    vec3 ray = wp.xyz - cameraPosition;
    float dist = length(ray);
    ray /= dist;
    float lift = min(uLift / max(0.15, -ray.y), dist * 0.8);
    vec4 cl = projectionMatrix * (viewMatrix * vec4(wp.xyz - ray * lift, 1.0));
    gl_Position.z = cl.z / cl.w * gl_Position.w;
    #include <fog_vertex>
  }`;
const FACE_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform sampler2D uMap;
  uniform float uK, uTime;
  uniform vec3 uTint;
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vec2 uv = vUv + vec2(sin(uTime * 1.3 + vUv.y * 18.0), cos(uTime * 1.1 + vUv.x * 15.0)) * 0.006;
    vec4 c = texture2D(uMap, uv);
    float lit = 0.62 + 0.38 * max(dot(normalize(vN), normalize(vec3(0.3, 1.0, -0.4))), 0.0);
    gl_FragColor = vec4(c.rgb * uTint * lit, c.a * uK);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

// The face's material: its uniforms (as face() makes them) drawn by the
// shaders above.
export function faceMaterial(uniforms) {
  return new THREE.ShaderMaterial({ uniforms, vertexShader: FACE_VERT, fragmentShader: FACE_FRAG, transparent: true, depthWrite: false, fog: true });
}
